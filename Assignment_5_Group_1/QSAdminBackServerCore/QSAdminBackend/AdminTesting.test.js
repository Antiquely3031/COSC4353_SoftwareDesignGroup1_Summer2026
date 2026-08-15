// Mock the ES Module database pool before requiring QSAdminBackend
jest.mock('../QSAdminDB/QSAdminDBPool', () => ({
  __esModule: true,
  default: {
    query: jest.fn().mockImplementation((sql, params) => {
      const sqlString = typeof sql === 'string' ? sql : '';

      if (params && (params[0] === 500 || params[0] === '500' || params[0] === 'TriggerError')) {
        return Promise.reject(new Error('Mocked Database Failure Execution'));
      }

      // 1. Mock stored procedure CALL GetAdminReportStats(?)
      if (sqlString.toUpperCase().includes('GETADMINREPORTSTATS')) {
        const overallStats = [{
          total_queue_entries: 25,
          total_unique_users: 18,
          total_users_served: 20,
          total_users_canceled: 5,
          average_wait_time_minutes: 12.5
        }];

        const servicesStats = [
          {
            service_id: 1,
            service_name: 'Test Service A',
            description: 'According to all known laws of aviation, there is no way that a bee should be able to fly.',
            expected_duration: 5,
            priority_level: 'High',
            total_service_entries: 15,
            users_served: 12,
            users_waiting: 1,
            users_canceled: 2,
            avg_service_wait_time_minutes: 10.2
          },
          {
            service_id: 2,
            service_name: 'Test Service B',
            description: 'Standard operational queue service endpoint for customer intake.',
            expected_duration: 10,
            priority_level: 'Medium',
            total_service_entries: 10,
            users_served: 8,
            users_waiting: 0,
            users_canceled: 2,
            avg_service_wait_time_minutes: 15.8
          }
        ];

        const userHistory = [
          {
            queue_entry_id: 101,
            user_id: 'usr_1',
            user_name: 'Alice',
            service_name: 'Test Service A',
            status: 'served',
            join_time: '2026-08-10 10:00:00'
          }
        ];

        return Promise.resolve([[overallStats, servicesStats, userHistory]]);
      }

      // 2. Mock SELECT queries for the main queue view (vw_AdminServiceQueueState)
      if (sqlString.includes('vw_AdminServiceQueueState')) 
      {
        const mockRows = Array.from({ length: 30 }, (_, i) => ({
          service_id: i + 1,
          name: `Service ${i + 1}`,
          description: `Description ${i + 1}`,
          expected_duration: i + 1,
          priority: i % 3 === 2 ? 'High' : (i % 3 === 1 ? 'Medium' : 'Low'),
          operation_status: i % 2 === 0 ? 'open' : 'closed',
          Queue_Array: i === 0 
            ? '[]' 
            : JSON.stringify(Array.from({ length: 10 }, (_, k) => ({
                queue_entry_id: k + 1,
                user_id: `user_${k + 1}`,
                user_name: `Person ${k + 1}`,
                position: k + 1,
                line_status: 'waiting'
              }))),
          queue_length: i === 0 ? 0 : 10
        }));

        // Insert one malformed string row and one raw array row to target JSON parsing branches
        mockRows.push({
          service_id: 101,
          name: 'Malformed JSON Service',
          description: 'Testing JSON parsing try/catch branches',
          expected_duration: 10,
          priority: 'Low',
          operation_status: 'open',
          Queue_Array: '{ invalid-json: true }',
          queue_length: 0
        });

        mockRows.push({
          service_id: 102,
          name: 'Raw Array Service',
          description: 'Testing pre-parsed array check branches',
          expected_duration: 10,
          priority: 'Medium',
          operation_status: 'open',
          Queue_Array: [{ queue_entry_id: 88, user_id: 'u88', user_name: 'Raw User', position: 1, line_status: 'waiting' }, null],
          queue_length: 1
        });

        return Promise.resolve([mockRows]);
      }

      // 3. Mock INSERT queries (POST route)
      if (sqlString.toUpperCase().includes('INSERT')) 
      {
        return Promise.resolve([
          [ [{ generated_id: 31 }] ], 
          { affectedRows: 1 }
        ]);
      }

      // 4. Mock UPDATE and DELETE queries
      if (sqlString.toUpperCase().includes('UPDATE') || sqlString.toUpperCase().includes('DELETE')) 
      {
        return Promise.resolve([{ affectedRows: 1 }]);
      }

      // 5. Mock single-record or post-insert SELECT queries
      if (sqlString.toUpperCase().includes('SELECT')) 
      {
        const paramVal = params && params[0] !== undefined ? params[0] : '';
        
        let targetName = 'New Test Service';
        let targetPriority = 'Medium';

        if (typeof paramVal === 'string' && paramVal.length > 0) 
        {
          targetName = paramVal;
          if (paramVal.toLowerCase().includes('high') || paramVal.toLowerCase().includes('three')) targetPriority = 'High';
          else if (paramVal.toLowerCase().includes('low') || paramVal.toLowerCase().includes('one')) targetPriority = 'Low';
        }

        const createdRow = {
          service_id: typeof paramVal === 'number' ? paramVal : 31,
          name: targetName,
          description: 'A newly created service for testing.',
          expected_duration: 15,
          priority: targetPriority,
          operation_status: 'closed',
          Queue_Array: '[]',
          queue_length: 0
        };

        return Promise.resolve([[createdRow]]);
      }

      return Promise.resolve([{ insertId: 31, affectedRows: 1 }]);
    })
  }
}));

const request = require('supertest');
const ioClient = require('socket.io-client');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const pool = require('../QSAdminDB/QSAdminDBPool').default;
const { 
  startServer, 
  Service_Entry, 
  Queue_Entry, 
  Container_Initializer, 
  Status_Changer,
  Precompile_ProViews,
  userServer,
  server
} = require('./QSAdminBackend');

describe('Structural Data & Model Unit Tests', () => 
{
  test('Queue_Entry constructor builds model specifications precisely', () => 
  {
    const entry = new Queue_Entry(1, 'usr_100', 'John Doe', 1, 'waiting', '2026-08-06T14:00:00Z');
    
    expect(entry.queue_entry_id).toBe(1);
    expect(entry.user_id).toBe('usr_100');
    expect(entry.user_name).toBe('John Doe');
    expect(entry.position).toBe(1);
    expect(entry.line_status).toBe('waiting');
    expect(entry.join_time).toBe('2026-08-06T14:00:00Z');
  });

  test('Service_Entry fallback defaults to an empty array when argument validation fails', () => {
    const brokenService = new Service_Entry(99, 'Broken', 'Desc', 10, 2, 0, 'open', 'NotAnArray');
    expect(brokenService.Queue_Array).toEqual([]);
  });

  test('Container_Initializer handles try/catch JSON exceptions and raw arrays safely', async () => 
  {
    const container = await Container_Initializer();
    expect(container).toBeDefined();

    const malformedTarget = container.find(s => s.service_id === 101);
    expect(malformedTarget).toBeDefined();
    expect(malformedTarget.Queue_Array).toEqual([]);

    const arrayTarget = container.find(s => s.service_id === 102);
    expect(arrayTarget).toBeDefined();
    expect(arrayTarget.Queue_Array.length).toBe(1);
    expect(arrayTarget.Queue_Array[0].user_name).toBe('Raw User');
  });

  test('Container_Initializer sorts items safely using numeric weight rules', async () => 
  {
    const container = await Container_Initializer();
    for (let i = 0; i < container.length - 1; i++) 
    {
      expect(container[i].priority).toBeGreaterThanOrEqual(container[i + 1].priority);
    }
  });

  test('Container_Initializer safely absorbs database infrastructure errors', async () => {
    pool.query.mockImplementationOnce(() => Promise.reject(new Error('Forced Fatal Database Breakdown')));
    const result = await Container_Initializer();
    expect(result).toEqual([]);
  });
});

describe('Database Migration & Precompilation Operations', () => {
  let readFileSyncSpy;
  let consoleLogSpy;
  let consoleErrorSpy;
  let originalQueryMock;

  beforeEach(() => {
    originalQueryMock = pool.query.getMockImplementation();

    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
      if (filePath.includes('QSAdminDBQuey.sql')) {
        return 'USE QueueSmartDB; DROP VIEW IF EXISTS vw_Test; CREATE VIEW vw_Test AS SELECT * FROM Tbl;';
      }
      if (filePath.includes('QSAdminDBTransAct.sql')) {
        return 'USE QueueSmartDB; DROP PROCEDURE IF EXISTS Mock_Init; CREATE PROCEDURE Mock_Init() BEGIN SELECT 1; END;';
      }
      return '';
    });
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    readFileSyncSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    
    if (originalQueryMock) {
      pool.query.mockImplementation(originalQueryMock);
    }
  });

  test('Precompile_ProViews reads SQL structures, parses schemas using delimiter filters, and updates components', async () => {
    pool.query.mockImplementation(() => Promise.resolve());
    
    await Precompile_ProViews();

    expect(readFileSyncSpy).toHaveBeenCalledTimes(2);
    expect(pool.query).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Successfully precompiled database views and stored procedures')
    );
  });

  test('Precompile_ProViews catches system and filesystem runtime exceptions gracefully', async () => {
    pool.query.mockImplementation(() => Promise.reject(new Error('Precompile Execution Failure Simulation')));

    await Precompile_ProViews();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to precompile database views and procedures:'),
      expect.any(String)
    );
  });
});

describe('Network Engine, Endpoint routing & Dynamic Protocols', () => 
{
  let adminPort;
  let userPort;
  let defaultPoolQueryMock;

  beforeAll(async () => 
  {
    defaultPoolQueryMock = pool.query.getMockImplementation();
    await startServer(0, 0);
    adminPort = server.address().port;
    userPort = userServer.address().port;
  });

  afterAll(async () => 
  {
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => userServer.close(resolve));
  });

  describe('HTTP REST Operations Matrix', () => {
    
    test('GET /api/admin/services fetches complete operational workspace state', async () => 
    {
      const response = await request(server).get('/api/admin/services');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('Status_Changer normalizes status inputs completely', async () => {
      const updatedClose = await Status_Changer(1, 'close');
      expect(updatedClose.operation_status).toBe('closed');
      
      const updatedClosed = await Status_Changer(1, 'closed');
      expect(updatedClosed.operation_status).toBe('closed');
      
      const updatedOpen = await Status_Changer(1, '  open  ');
      expect(updatedOpen.operation_status).toBe('open');

      const updatedInvalid = await Status_Changer(99999, 'open');
      expect(updatedInvalid).toBeNull();
    });

    test('PATCH /api/admin/services/status checks validation and exception bounds', async () => 
    {
      let response = await request(server).patch('/api/admin/services/status').send({ service_id: 2 });
      expect(response.status).toBe(400);

      response = await request(server).patch('/api/admin/services/status').send({ service_id: 99999, status: 'open' });
      expect(response.status).toBe(404);

      pool.query.mockImplementationOnce(() => Promise.reject(new Error('Fatal Update Error')));
      response = await request(server).patch('/api/admin/services/status').send({ service_id: 1, status: 'closed' });
      expect(response.status).toBe(500);
    });

    test('generates PDF reports with page breaks when services list exceeds page height', async () => {
      // Mock GetAdminReportStats returning >8 services to exceed y > 250
      pool.query.mockImplementationOnce(() => {
        const mockServices = Array.from({ length: 9 }, (_, i) => ({
          service_id: i + 1,
          service_name: `Service ${i + 1}`,
          description: `Description ${i + 1}`,
          expected_duration: 10,
          priority_level: 'High',
          total_service_entries: 5,
          users_served: 4,
          users_waiting: 1,
          users_canceled: 0,
          avg_service_wait_time_minutes: 5.0
        }));

        return Promise.resolve([ [ [{}], mockServices, [] ] ]);
      });

      const response = await request(server)
        .post('/api/admin/reports/generate')
        .send({ timeframe: 'week' });

      expect(response.status).toBe(200);
    });

    test('PATCH /api/admin/services/status successfully updates status and broadcasts update', async () => {
      const response = await request(server)
        .patch('/api/admin/services/status')
        .send({ service_id: 1, status: 'closed' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Status updated successfully');
      expect(response.body.service.operation_status).toBe('closed');
    });

    test('POST /api/admin/services covers every custom field validation rule', async () => 
    {
      let res = await request(server).post('/api/admin/services').send({ description: 'D', expected_duration: 10 });
      expect(res.status).toBe(400);
      res = await request(server).post('/api/admin/services').send({ name: 'N', expected_duration: 10 });
      expect(res.status).toBe(400);
      res = await request(server).post('/api/admin/services').send({ name: 'N', description: 'D' });
      expect(res.status).toBe(400);

      res = await request(server).post('/api/admin/services').send({ name: 'A'.repeat(105), description: 'D', expected_duration: 10 });
      expect(res.status).toBe(400);

      res = await request(server).post('/api/admin/services').send({ name: 'N', description: 'D', expected_duration: 'invalid-num' });
      expect(res.status).toBe(400);

      res = await request(server).post('/api/admin/services').send({ name: 'Low Prio P', description: 'D', expected_duration: 5, priority: '1' });
      expect(res.status).toBe(201);
      res = await request(server).post('/api/admin/services').send({ name: 'Medium Prio P', description: 'D', expected_duration: 5, priority: 'medium' });
      expect(res.status).toBe(201);
      res = await request(server).post('/api/admin/services').send({ name: 'High Prio P', description: 'D', expected_duration: 5, priority: 'high' });
      expect(res.status).toBe(201);

      res = await request(server).post('/api/admin/services').send({ name: 'Service 2', description: 'D', expected_duration: 10 });
      expect(res.status).toBe(409);

      res = await request(server).post('/api/admin/services').send({ name: 'TriggerError', description: 'D', expected_duration: 10 });
      expect(res.status).toBe(500);
    });

    test('PUT /api/admin/services evaluates schema validation and sorting adjustments', async () => 
    {
      let res = await request(server).put('/api/admin/services').send({ name: 'Ghost' });
      expect(res.status).toBe(400);

      res = await request(server).put('/api/admin/services').send({ service_id: 2, name: '', description: 'D', expected_duration: 5 });
      expect(res.status).toBe(400);

      res = await request(server).put('/api/admin/services').send({ service_id: 99999, name: 'Ghost', description: 'D', expected_duration: 5 });
      expect(res.status).toBe(404);

      res = await request(server).put('/api/admin/services').send({ service_id: 3, name: 'Reordered Element', description: 'Desc', expected_duration: 45, priority: 'low' });
      expect(res.status).toBe(200);

      pool.query.mockImplementationOnce(() => Promise.reject(new Error('Fatal Put Error')));
      res = await request(server).put('/api/admin/services').send({ service_id: 2, name: 'Crash Test', description: 'Desc', expected_duration: 10 });
      expect(res.status).toBe(500);
    });

    test('DELETE /api/admin/services/:id clears services from memory map', async () => 
    {
      let res = await request(server).delete('/api/admin/services/99999');
      expect(res.status).toBe(404);

      res = await request(server).delete('/api/admin/services/2');
      expect(res.status).toBe(200);

      pool.query.mockImplementationOnce(() => Promise.reject(new Error('Fatal Delete Error')));
      res = await request(server).delete('/api/admin/services/3');
      expect(res.status).toBe(500);
    });

    describe('POST /api/admin/reports/generate Suite', () => {
      let writeFileSyncSpy;
      let mkdirSyncSpy;
      let existsSyncSpy;

      beforeEach(() => {
        pool.query.mockImplementation(defaultPoolQueryMock);
        writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        mkdirSyncSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
        existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      });

      afterEach(() => {
        writeFileSyncSpy.mockRestore();
        mkdirSyncSpy.mockRestore();
        existsSyncSpy.mockRestore();
      });

      test('triggers rate limiter or unhandled error on line 445 when threshold exceeded', async () => {
        let response;
        for (let i = 0; i < 105; i++) {
          response = await request(server).get('/api/admin/services');
        }
        expect([200, 429]).toContain(response.status);
      });

      test('triggers generic error handler on line 445', async () => {
        pool.query.mockImplementationOnce(() => {
          return Promise.reject(new Error('Internal Server Error'));
        });

        const response = await request(server)
          .post('/api/admin/reports/generate')
          .send({ timeframe: 'week' });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Internal Server Error' });
      });

      test('generates reports for default timeframe (week)', async () => {
        const response = await request(server)
          .post('/api/admin/reports/generate')
          .send({});

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('created successfully');
        expect(response.body.folderPath).toBeDefined();
        expect(mkdirSyncSpy).toHaveBeenCalled();
        expect(writeFileSyncSpy).toHaveBeenCalledTimes(4); // 2 CSVs + 2 PDFs
      });

      test('generates reports for month, quarter, and annual timeframes', async () => {
        const timeframes = ['month', 'quarter', 'annual'];

        for (const timeframe of timeframes) {
          const response = await request(server)
            .post('/api/admin/reports/generate')
            .send({ timeframe });

          expect(response.status).toBe(200);
          expect(response.body.message).toContain('created successfully');
        }
      });

      test('handles Sunday date calculations branch (day === 0) for weekly reports (Line 242)', async () => {
        // Mock Date to simulate a Sunday (e.g. Aug 16, 2026)
        const mockSunday = new Date('2026-08-16T10:00:00Z');
        jest.useFakeTimers().setSystemTime(mockSunday);

        const response = await request(server)
          .post('/api/admin/reports/generate')
          .send({ timeframe: 'week' });

        expect(response.status).toBe(200);
        jest.useRealTimers();
      });

      test('handles null/undefined service field fallbacks and empty list fallbacks (Lines 260-262, 287, 297, 300-301, 340-341)', async () => {
        // Procedure returns null procedureResults rows and service objects with missing fields
        pool.query.mockImplementationOnce(() => {
          const mockServiceStatsWithNulls = [
            {
              service_id: 99,
              service_name: 'Null Field Service',
              description: null,          // triggers (s.description || '').replace(...) & s.description || 'N/A'
              expected_duration: null,    // triggers s.expected_duration || 0
              priority_level: null,       // triggers s.priority_level || 'Medium'
              total_service_entries: 0,
              users_served: 0,
              users_waiting: 0,
              users_canceled: 0,
              avg_service_wait_time_minutes: 0
            }
          ];
          return Promise.resolve([[ [{}], mockServiceStatsWithNulls, null ]]);
        });

        const response = await request(server)
          .post('/api/admin/reports/generate')
          .send({ timeframe: 'week' });

        expect(response.status).toBe(200);
      });

      test('handles existing target directory without re-creating folder', async () => {
        existsSyncSpy.mockReturnValueOnce(true); // Pretend folder exists

        const response = await request(server)
          .post('/api/admin/reports/generate')
          .send({ timeframe: 'week' });

        expect(response.status).toBe(200);
        expect(mkdirSyncSpy).not.toHaveBeenCalled();
      });

      test('returns 500 status on database failure during report stats query', async () => {
        pool.query.mockImplementationOnce(() => Promise.reject(new Error('Report Query Failure')));

        const response = await request(server)
          .post('/api/admin/reports/generate')
          .send({ timeframe: 'week' });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Report Query Failure');
      });
    });
  });

  describe('WebSocket Admin Scope Architecture', () => 
  {
    let socketClient;

    beforeEach((done) => 
    {
      socketClient = ioClient(`http://localhost:${adminPort}`, { transports: ['websocket'], forceNew: true });
      socketClient.once('queue_updated', () => done());
    });

    afterEach(() => 
    {
      if (socketClient.connected) socketClient.disconnect();
    });

    test('serve_client handles explicit queue entry parameters, cascades internal positions, and fires notifications', (done) => 
    {
      global.fetch = jest.fn().mockImplementation(() => Promise.resolve({ ok: true }));

      socketClient.once('queue_updated', () => 
      {
        expect(global.fetch).toHaveBeenCalled();
        done();
      });

      socketClient.emit('serve_client', { service_id: 4, queue_entry_id: 1 });
    });

    test('serve_client targets index zero fallback when target id parameters are omitted', (done) => 
    {
      socketClient.once('queue_updated', () => done());
      socketClient.emit('serve_client', { service_id: 4 });
    });

    test('serve_client handles non-existent queue_entry_id without throwing', (done) => {
      socketClient.emit('serve_client', { service_id: 4, queue_entry_id: 999999 });

      setTimeout(() => {
        expect(socketClient.connected).toBe(true);
        done();
      }, 50);
    });

    test('serve_client handles cascading position database query failures gracefully', (done) => 
    {
      pool.query.mockImplementationOnce(() => Promise.reject(new Error('Internal Cascading Shift Error')));
      
      socketClient.emit('serve_client', { service_id: 4, queue_entry_id: 2 });
      
      setTimeout(() => {
        expect(socketClient.connected).toBe(true);
        done();
      }, 50);
    });

    test('serve_client targets index zero fallback branch handling when entry ids are fully omitted', (done) =>
    {
      pool.query.mockImplementationOnce(() => Promise.reject(new Error('Internal shift fallback error')));
      socketClient.emit('serve_client', { service_id: 5 });
      
      setTimeout(() => {
        expect(socketClient.connected).toBe(true);
        done();
      }, 50);
    });

    test('remove_client removes targeted items from queue arrays and re-indexes remaining elements cleanly', (done) => 
    {
      socketClient.once('queue_updated', () => done());
      socketClient.emit('remove_client', { service_id: 5, queue_entry_id: 2 });
    });

    test('remove_client targets fallback element zero when array parameters are missing', (done) => 
    {
      socketClient.once('queue_updated', () => done());
      socketClient.emit('remove_client', { service_id: 5 });
    });

    test('remove_client handles non-existent queue_entry_id without throwing', (done) => {
      socketClient.emit('remove_client', { service_id: 5, queue_entry_id: 999999 });

      setTimeout(() => {
        expect(socketClient.connected).toBe(true);
        done();
      }, 50);
    });

    test('remove_client handles cascading position database query failures gracefully', (done) => 
    {
      pool.query.mockImplementationOnce(() => Promise.reject(new Error('Internal Cascading Shift Cancel Error')));
      socketClient.emit('remove_client', { service_id: 5, queue_entry_id: 3 });
      
      setTimeout(() => {
        expect(socketClient.connected).toBe(true);
        done();
      }, 50);
    });

    test('QE_Service_Shfit breaks early when encountering entry missing queue_entry_id', (done) => {
      const malformedQueue = [
        { queue_entry_id: 10, user_name: 'Valid Entry' },
        { user_name: 'Missing ID Entry' }
      ];

      socketClient.once('queue_updated', () => {
        socketClient.emit('serve_client', { service_id: 6, queue_entry_id: 10 });

        setTimeout(() => {
          expect(socketClient.connected).toBe(true);
          done();
        }, 50);
      });

      socketClient.emit('reorder_queue', { service_id: 6, updated_queue: malformedQueue });
    });

    test('reorder_queue applies custom array structural mappings', (done) => 
    {
      const customConfiguration = [{ queue_entry_id: 777, user_name: 'Overwritten Client Sequence' }];
      
      socketClient.once('queue_updated', (payload) => 
      {
        try {
          const updatedMatch = payload.find(s => s.service_id === 6);
          
          expect(updatedMatch.Queue_Array).toEqual([
            expect.objectContaining({
              queue_entry_id: 777,
              user_name: 'Overwritten Client Sequence'
            })
          ]);
          
          done();
        } catch (error) {
          done(error);
        }
      });

      socketClient.emit('reorder_queue', { service_id: 6, updated_queue: customConfiguration });
    });

    test('reorder_queue handles database shift errors gracefully', (done) => 
    {
      pool.query.mockImplementationOnce(() => Promise.reject(new Error('Internal Reorder Persistence Error')));
      socketClient.once('queue_updated', () => done());
      socketClient.emit('reorder_queue', { service_id: 6, updated_queue: [{ queue_entry_id: 888 }] });
    });

    test('null operations are safely ignored by intercept guards without crashing servers', (done) => 
    {
      socketClient.emit('serve_client', null);
      socketClient.emit('remove_client', undefined);
      socketClient.emit('reorder_queue', null);
      socketClient.emit('serve_client', { service_id: 99999 });

      setTimeout(() => {
        expect(socketClient.connected).toBe(true);
        done();
      }, 30);
    });
  });

  describe('User Scope Server-Sent Events (SSE) Interface Matrix', () => 
  {
    test('stream channel establishes event headers and broadcasts write payloads to clients (Lines 227-228)', (done) => 
    {
      const req = http.get(`http://localhost:${userPort}/api/users/queue/stream`, (res) => {
        expect(res.headers['content-type']).toBe('text/event-stream');
        expect(res.headers['cache-control']).toBe('no-cache');
        expect(res.headers['connection']).toBe('keep-alive');
        
        // Trigger a service status patch to invoke broadcastQueueUpdate() and send SSE data
        request(server)
          .patch('/api/admin/services/status')
          .send({ service_id: 1, status: 'closed' })
          .end(() => {
            req.destroy();
            done();
          });
      });
    });

    test('join route appends payload directly to target tracking containers', async () => 
    {
      let res = await request(userServer).post('/api/users/queue/join').send({ service_id: 99999, client_entry: {} });
      expect(res.status).toBe(404);

      res = await request(userServer).post('/api/users/queue/join').send({ service_id: 7 });
      expect(res.status).toBe(400);

      const payload = { queue_entry_id: 99, user_id: 'u99', user_name: 'SSE Joined User' };
      res = await request(userServer).post('/api/users/queue/join').send({ service_id: 7, client_entry: payload });
      expect(res.status).toBe(200);
    });

    test('leave route deletes items from real-time dynamic structures', async () => 
    {
      let res = await request(userServer).post('/api/users/queue/leave').send({ service_id: 99999 });
      expect(res.status).toBe(404);

      res = await request(userServer).post('/api/users/queue/leave').send({ service_id: 7 });
      expect(res.status).toBe(400);

      res = await request(userServer).post('/api/users/queue/leave').send({ service_id: 7, queue_entry_id: 3 });
      expect(res.status).toBe(200);

      res = await request(userServer).post('/api/users/queue/leave').send({ service_id: 7, queue_entry_id: 1045 });
      expect(res.status).toBe(404);
    });
  });

  test('startServer runtime handles fallbacks cleanly when parameter fields are empty', async () => 
  {
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => userServer.close(resolve));

    const alternativeInstance = await startServer();
    expect(alternativeInstance.address().port).toBe(4000);
    await new Promise(resolve => alternativeInstance.close(resolve));
  });
});
