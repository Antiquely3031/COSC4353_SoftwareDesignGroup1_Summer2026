// Mock the ES Module database pool before requiring QSAdminBackend
jest.mock('../../Assignment_4_Group_1/QSAdminDB/QSAdminDBPool', () => ({
  __esModule: true,
  default: {
    query: jest.fn().mockImplementation((sql, params) => {
      const sqlString = typeof sql === 'string' ? sql : '';

      if (params && (params[0] === 500 || params[0] === '500' || params[0] === 'TriggerError')) {
        return Promise.reject(new Error('Mocked Database Failure Execution'));
      }

      // 1. Mock SELECT queries for the main queue view (vw_AdminServiceQueueState)
      if (sqlString.includes('vw_AdminServiceQueueState')) 
      {
        const mockRows = Array.from({ length: 30 }, (_, i) => ({
          service_id: i + 1,
          name: `Placeholder ${i + 1}`,
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

      // 2. Mock INSERT queries (POST route)
      if (sqlString.toUpperCase().includes('INSERT')) 
      {
        return Promise.resolve([
          [ [{ generated_id: 31 }] ], 
          { affectedRows: 1 }
        ]);
      }

      // 3. Mock UPDATE and DELETE queries
      if (sqlString.toUpperCase().includes('UPDATE') || sqlString.toUpperCase().includes('DELETE')) 
      {
        return Promise.resolve([{ affectedRows: 1 }]);
      }

      // 4. Mock single-record or post-insert SELECT queries
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
const pool = require('../../Assignment_4_Group_1/QSAdminDB/QSAdminDBPool').default;
const { 
  startServer, 
  Service_Entry, 
  Queue_Entry, 
  Container_Initializer, 
  Status_Changer,
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

describe('Network Engine, Endpoint routing & Dynamic Protocols', () => 
{
  let adminPort;
  let userPort;

  beforeAll(async () => 
  {
    // Boot both components under randomized unallocated dynamic test ports
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

    test('POST /api/admin/services covers every custom field validation rule', async () => 
    {
      // Missing field validations
      let res = await request(server).post('/api/admin/services').send({ description: 'D', expected_duration: 10 });
      expect(res.status).toBe(400);
      res = await request(server).post('/api/admin/services').send({ name: 'N', expected_duration: 10 });
      expect(res.status).toBe(400);
      res = await request(server).post('/api/admin/services').send({ name: 'N', description: 'D' });
      expect(res.status).toBe(400);

      // Character string lengths bounds evaluation
      res = await request(server).post('/api/admin/services').send({ name: 'A'.repeat(105), description: 'D', expected_duration: 10 });
      expect(res.status).toBe(400);

      // Numeric parser validations
      res = await request(server).post('/api/admin/services').send({ name: 'N', description: 'D', expected_duration: 'invalid-num' });
      expect(res.status).toBe(400);

      // Check explicit priority configurations mappings
      res = await request(server).post('/api/admin/services').send({ name: 'Low Prio P', description: 'D', expected_duration: 5, priority: '1' });
      expect(res.status).toBe(201);
      res = await request(server).post('/api/admin/services').send({ name: 'Medium Prio P', description: 'D', expected_duration: 5, priority: 'medium' });
      expect(res.status).toBe(201);
      res = await request(server).post('/api/admin/services').send({ name: 'High Prio P', description: 'D', expected_duration: 5, priority: 'high' });
      expect(res.status).toBe(201);

      // Duplicate detection conflict responses
      res = await request(server).post('/api/admin/services').send({ name: 'Placeholder 2', description: 'D', expected_duration: 10 });
      expect(res.status).toBe(409);

      // Exception branch evaluation
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

      // Valid execution that requires moving positions based on updated priority levels
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

      // Target service 4, entry 1 explicitly to isolate data mutation and trigger position loop
      socketClient.emit('serve_client', { service_id: 4, queue_entry_id: 1 });
    });

    test('serve_client targets index zero fallback when target id parameters are omitted', (done) => 
    {
      socketClient.once('queue_updated', () => done());
      socketClient.emit('serve_client', { service_id: 4 });
    });

    test('serve_client handles cascading position database query failures gracefully', (done) => 
    {
      pool.query.mockImplementationOnce(() => Promise.reject(new Error('Internal Cascading Shift Error')));
      
      // Send the event
      socketClient.emit('serve_client', { service_id: 4, queue_entry_id: 2 });
      
      // Since the backend safely catches the error and suppresses the broadcast,
      // assert that the socket connection survives the error state.
      setTimeout(() => {
        expect(socketClient.connected).toBe(true);
        done();
      }, 50);
    });

    test('remove_client removes targeted items from queue arrays and re-indexes remaining elements cleanly', (done) => 
    {
      socketClient.once('queue_updated', () => done());
      // Isolated to service_id: 5 to ensure queue entry index 2 safely exists uncaught by prior operations
      socketClient.emit('remove_client', { service_id: 5, queue_entry_id: 2 });
    });

    test('remove_client targets fallback element zero when array parameters are missing', (done) => 
    {
      socketClient.once('queue_updated', () => done());
      socketClient.emit('remove_client', { service_id: 5 });
    });

    test('remove_client handles cascading position database query failures gracefully', (done) => 
    {
      pool.query.mockImplementationOnce(() => Promise.reject(new Error('Internal Cascading Shift Cancel Error')));
      socketClient.once('queue_updated', () => done());
      socketClient.emit('remove_client', { service_id: 5, queue_entry_id: 3 });
    });

    test('reorder_queue applies custom array structural mappings', (done) => 
    {
      const customConfiguration = [{ queue_entry_id: 777, user_name: 'Overwritten Client Sequence' }];
      
      socketClient.once('queue_updated', (payload) => 
      {
        try {
          const updatedMatch = payload.find(s => s.service_id === 6);
          
          // Use objectContaining or match the property structure to account for the position injection
          expect(updatedMatch.Queue_Array).toEqual([
            expect.objectContaining({
              queue_entry_id: 777,
              user_name: 'Overwritten Client Sequence'
            })
          ]);
          
          done();
        } catch (error) {
          done(error); // Routes the assertion failure out instantly without hanging
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

  describe('User Scope Server-Sent Events (SSE) Interface', () => 
  {
    test('stream channel establishes event headers and updates data streams', (done) => 
    {
      // Native http client bypasses Supertest stream accumulation bugs
      const req = http.get(`http://localhost:${userPort}/api/users/queue/stream`, (res) => {
        expect(res.headers['content-type']).toBe('text/event-stream');
        expect(res.headers['cache-control']).toBe('no-cache');
        expect(res.headers['connection']).toBe('keep-alive');
        
        // Destroy connection manually immediately to release event loop
        req.destroy();
        done();
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
    // Tear down initialized cluster setup safely first to claim port 3000
    await new Promise(resolve => server.close(resolve));
    await new Promise(resolve => userServer.close(resolve));

    const alternativeInstance = await startServer();
    expect(alternativeInstance.address().port).toBe(3000);
    await new Promise(resolve => alternativeInstance.close(resolve));
  });
});