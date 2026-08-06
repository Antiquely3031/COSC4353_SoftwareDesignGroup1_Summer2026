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
            : JSON.stringify(Array.from({ length: 60 }, (_, k) => ({
                queue_entry_id: k + 1,
                user_id: `user_${k + 1}`,
                user_name: `Person ${k + 1}`,
                position: k + 1,
                line_status: 'waiting'
              }))),
          queue_length: i === 0 ? 0 : 60
        }));

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
const pool = require('../../Assignment_4_Group_1/QSAdminDB/QSAdminDBPool').default;
const { 
  startServer, 
  Service_Entry, 
  Queue_Entry, 
  Container_Initializer, 
  Status_Changer 
} = require('./QSAdminBackend');

describe('Mock Initialization', () => 
{
  test('Queue_Entry initializes constructor properties correctly', () => 
  {
    const entry = new Queue_Entry(1, 'usr_100', 'John Doe', 1, 'waiting', '2026-08-06T14:00:00Z');
    
    expect(entry.queue_entry_id).toBe(1);
    expect(entry.user_id).toBe('usr_100');
    expect(entry.user_name).toBe('John Doe');
    expect(entry.position).toBe(1);
    expect(entry.line_status).toBe('waiting');
    expect(entry.join_time).toBe('2026-08-06T14:00:00Z');
  });

  test('Checking the basic mock data initialization', async () => 
  {
    const Test_Container = await Container_Initializer();
    expect(Test_Container).toBeDefined();
    
    try 
    { 
      Test_Container.forEach(entry => 
      {
        expect(entry).toBeInstanceOf(Service_Entry);
      });  
    } 
    catch(error) 
    {
      throw new Error(`Element ${error} failed in the Test_Container.`);
    }
  });

  test('Container_Initializer sorts mock services by priority (High to Low)', async () => 
  {
    const container = await Container_Initializer();
    
    const priorityWeight = (p) => 
    {
      if (p === 'High' || p === 3) return 3;
      if (p === 'Medium' || p === 2) return 2;
      return 1;
    };

    for (let i = 0; i < container.length - 1; i++) 
    {
      expect(priorityWeight(container[i].priority)).toBeGreaterThanOrEqual(priorityWeight(container[i + 1].priority));
    }
  });

  test('handles services with empty queues without breaking initialization', async () => 
  {
    const container = await Container_Initializer();
    const emptyQueueService = container.find(s => s.service_id === 1);
    
    expect(emptyQueueService).toBeDefined();
    expect(emptyQueueService.Queue_Array).toEqual([]);
    expect(emptyQueueService.queue_length).toBe(0);
  });

  test('Container_Initializer returns empty array on database failure', async () => {
    const originalImplementation = pool.query;
    pool.query.mockImplementationOnce(() => Promise.reject(new Error('Forced Error')));
    
    const container = await Container_Initializer();
    expect(container).toEqual([]);
  });
});

describe('Network Capabilities', () => 
{
  let testServer;
  let testPort;

  beforeAll(async () => 
  {
    testServer = await startServer(0);
    testPort = testServer.address().port;
  });

  afterAll((done) => 
  {
    if (testServer && testServer.listening) testServer.close(done);
    else done();
  });

  test('updates status for existing service', async () => 
  {
    const updated = await Status_Changer(1, 'open');
    expect(updated).not.toBeNull();
    expect(updated.operation_status).toBe('open');
  });

  test('Status_Changer returns null when service is missing', async () => 
  {
    const updated = await Status_Changer(99999, 'open');
    expect(updated).toBeNull();
  });

  test('HTTP GET /api/admin/services returns service list', async () => 
  {
    const response = await request(testServer).get('/api/admin/services');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  describe('HTTP PATCH /api/admin/services/status', () => 
  {
    test('successfully updates status and returns 200', async () => 
    {
      const response = await request(testServer)
        .patch('/api/admin/services/status')
        .send({ service_id: 2, status: 'closed' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Status updated successfully');
      expect(response.body.service.operation_status).toBe('closed');
    });

    test('returns 400 when missing service_id or status', async () => 
    {
      const response = await request(testServer)
        .patch('/api/admin/services/status')
        .send({ service_id: 2 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing service_id or status in request body.');
    });

    test('returns 404 when service is not found', async () => 
    {
      const response = await request(testServer)
        .patch('/api/admin/services/status')
        .send({ service_id: 99999, status: 'open' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Service not found.');
    });

    test('returns 500 when database operation throws an exception', async () => 
    {
      // Force database logic crash on an existing service ID to pass validation layers
      pool.query.mockImplementationOnce(() => Promise.reject(new Error('Forced Error')));

      const response = await request(testServer)
        .patch('/api/admin/services/status')
        .send({ service_id: 1, status: 'open' }); 

      expect(response.status).toBe(500);
    });
  });

  describe('HTTP POST /api/admin/services', () => 
  {
    test('successfully creates a new service with empty queue and returns 201', async () => 
    {
      const newService = {
        name: 'New Unique Test Service',
        description: 'A newly created service for testing.',
        expected_duration: 15,
        priority: 2
      };

      const response = await request(testServer)
        .post('/api/admin/services')
        .send(newService);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Service created successfully');
      expect(response.body.service.name).toBe('New Unique Test Service');
      expect(response.body.service.expected_duration).toBe(15);
      expect(response.body.service.Queue_Array).toEqual([]);
    });

    test('successfully creates a new service with priority options conversion handles', async () => 
    {
      let response = await request(testServer)
        .post('/api/admin/services')
        .send({ name: 'Service Low', description: 'Desc', expected_duration: 10, priority: 'low' });
      expect(response.status).toBe(201);

      response = await request(testServer)
        .post('/api/admin/services')
        .send({ name: 'Service One', description: 'Desc', expected_duration: 10, priority: '1' });
      expect(response.status).toBe(201);

      response = await request(testServer)
        .post('/api/admin/services')
        .send({ name: 'Service High', description: 'Desc', expected_duration: 10, priority: 'high' });
      expect(response.status).toBe(201);
    });

    test('returns 400 when missing required fields', async () => 
    {
      let response = await request(testServer).post('/api/admin/services').send({});
      expect(response.status).toBe(400);

      response = await request(testServer).post('/api/admin/services').send({ name: 'Test' });
      expect(response.status).toBe(400);
    });

    test('returns 400 when name exceeds 100 characters', async () => 
    {
      const longName = 'A'.repeat(101);
      const response = await request(testServer)
        .post('/api/admin/services')
        .send({ name: longName, description: 'Valid Desc', expected_duration: 15 });

      expect(response.status).toBe(400);
    });

    test('returns 400 when expected_duration is invalid', async () => 
    {
      const response = await request(testServer)
        .post('/api/admin/services')
        .send({ name: 'Invalid Dur', description: 'Desc', expected_duration: -5 });

      expect(response.status).toBe(400);
    });

    test('returns 409 when service name already exists', async () => 
    {
      const response = await request(testServer)
        .post('/api/admin/services')
        .send({
          name: 'Placeholder 2',
          description: 'Duplicate check.',
          expected_duration: 10,
          priority: 'medium'
        });

      expect(response.status).toBe(409);
    });

    test('returns 500 when insert procedure fails execution', async () => {
      const response = await request(testServer)
        .post('/api/admin/services')
        .send({ name: 'TriggerError', description: 'Desc', expected_duration: 10 });

      expect(response.status).toBe(500);
    });
  });

  describe('HTTP PUT /api/admin/services', () => 
  {
    test('successfully updates an existing service profile and returns 200', async () => 
    {
      const updatedDetails = {
        service_id: 3,
        name: 'Placeholder 3 New Name',
        description: 'Updated description for testing.',
        expected_duration: 25,
        priority: 3
      };

      const response = await request(testServer)
        .put('/api/admin/services')
        .send(updatedDetails);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Service updated successfully');
    });

    test('returns 404 when updating a non-existent service', async () => 
    {
      const response = await request(testServer)
        .put('/api/admin/services')
        .send({ service_id: 99999, name: 'Ghost', description: 'No', expected_duration: 10 });

      expect(response.status).toBe(404);
    });

    test('returns 400 when missing service_id on PUT request', async () => 
    {
      const response = await request(testServer)
        .put('/api/admin/services')
        .send({ name: 'No ID', description: 'No', expected_duration: 10 });

      expect(response.status).toBe(400);
    });

    test('returns 500 when update routine experiences query errors', async () => {
      pool.query.mockImplementationOnce(() => Promise.reject(new Error('Forced Error')));

      const response = await request(testServer)
        .put('/api/admin/services')
        .send({ service_id: 1, name: 'Error Out', description: 'Desc', expected_duration: 10 });
        
      expect(response.status).toBe(500);
    });
  });

  describe('HTTP DELETE /api/admin/services/:id', () => 
  {
    test('successfully deletes an existing service and returns 200', async () => 
    {
      const response = await request(testServer).delete('/api/admin/services/4');
      expect(response.status).toBe(200);
    });

    test('returns 404 when attempting to delete a non-existent service', async () => 
    {
      const response = await request(testServer).delete('/api/admin/services/99999');
      expect(response.status).toBe(404);
    });

    test('returns 500 when deletion logic errors out', async () => {
      pool.query.mockImplementationOnce(() => Promise.reject(new Error('Forced Error')));
      
      const response = await request(testServer).delete('/api/admin/services/1');
      expect(response.status).toBe(500);
    });
  });

  describe('WebSocket Handlers & Disconnect Events', () => 
  {
    let clientSocket;

    beforeEach((done) => 
    {
      clientSocket = ioClient(`http://localhost:${testPort}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      // Drain the initial setup event completely before running test emits
      clientSocket.once('queue_updated', () => {
        done();
      });
    });

    afterEach(() => 
    {
      if (clientSocket && clientSocket.connected) clientSocket.disconnect();
    });

    test('receives queue_updated payload on initial connection', (done) => 
    {
      const checkSocket = ioClient(`http://localhost:${testPort}`, {
        transports: ['websocket'],
        forceNew: true
      });
      checkSocket.once('queue_updated', (data) => 
      {
        expect(Array.isArray(data)).toBe(true);
        checkSocket.disconnect();
        done();
      });
    });

    test('handles serve_client matching a specific queue_entry_id', (done) => 
    {
      clientSocket.once('queue_updated', (services) => 
      {
        const updatedService = services.find(s => s.service_id === 2);
        const targetedEntry = updatedService.Queue_Array.find(item => item.queue_entry_id === 2);
        expect(targetedEntry).toBeUndefined();
        done();
      });

      clientSocket.emit('serve_client', { service_id: 2, queue_entry_id: 2 });
    });

    test('handles serve_client and defaults to target index 0 if queue_entry_id is missing', (done) => 
    {
      clientSocket.once('queue_updated', (services) => 
      {
        const updatedService = services.find(s => s.service_id === 2);
        expect(updatedService.Queue_Array[0].queue_entry_id).not.toBe(1);
        done();
      });

      clientSocket.emit('serve_client', { service_id: 2 });
    });

    test('handles serve_client branches parsing user notification tracking payloads', (done) => 
    {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockImplementation(() => Promise.resolve({}));

      clientSocket.once('queue_updated', () => 
      {
        expect(global.fetch).toHaveBeenCalled();
        global.fetch = originalFetch;
        done();
      });

      clientSocket.emit('serve_client', { service_id: 3, queue_entry_id: 1 });
    });

    test('handles remove_client matching a specific queue_entry_id', (done) => 
    {
      clientSocket.once('queue_updated', (services) => 
      {
        const updatedService = services.find(s => s.service_id === 5);
        const targetedEntry = updatedService.Queue_Array.find(item => item.queue_entry_id === 5);
        expect(targetedEntry).toBeUndefined();
        done();
      });

      clientSocket.emit('remove_client', { service_id: 5, queue_entry_id: 5 });
    });

    test('handles remove_client and defaults to index 0 if queue_entry_id is missing', (done) => 
    {
      clientSocket.once('queue_updated', (services) => 
      {
        const updatedService = services.find(s => s.service_id === 5);
        expect(updatedService.Queue_Array[0].queue_entry_id).not.toBe(1);
        done();
      });

      clientSocket.emit('remove_client', { service_id: 5 });
    });

    test('handles reorder_queue event structures mapping array configurations', (done) => 
    {
      const customOrder = [
        { queue_entry_id: 99, user_name: 'Custom Order Client' }
      ];

      clientSocket.once('queue_updated', (services) => 
      {
        const updatedService = services.find(s => s.service_id === 6);
        expect(updatedService.Queue_Array).toEqual(customOrder);
        expect(updatedService.queue_length).toBe(1);
        done();
      });

      clientSocket.emit('reorder_queue', { service_id: 6, updated_queue: customOrder });
    });

    test('handles join_queue appending a formatted client_entry object structure', (done) => 
    {
      const clientEntryObject = {
        queue_entry_id: 500,
        user_id: 'new_user_1',
        user_name: 'Joined Client'
      };

      clientSocket.once('queue_updated', (services) => 
      {
        const joinedService = services.find(s => s.service_id === 7);
        const match = joinedService.Queue_Array.find(item => item.queue_entry_id === 500);
        expect(match).toBeDefined();
        done();
      });

      clientSocket.emit('join_queue', { service_id: 7, client_entry: clientEntryObject });
    });

    test('handles leave_queue searching specific queue_entry_id matches', (done) => 
    {
      clientSocket.once('queue_updated', (services) => 
      {
        const leftService = services.find(s => s.service_id === 8);
        const match = leftService.Queue_Array.find(item => item.queue_entry_id === 10);
        expect(match).toBeUndefined();
        done();
      });

      clientSocket.emit('leave_queue', { service_id: 8, queue_entry_id: 10 });
    });

    test('gracefully ignores actions on non-existent service or empty payloads', (done) => 
    {
      clientSocket.emit('serve_client', null);
      clientSocket.emit('remove_client', undefined);
      clientSocket.emit('reorder_queue', null);
      clientSocket.emit('join_queue', undefined);
      clientSocket.emit('leave_queue', null);
      clientSocket.emit('serve_client', { service_id: 99999 });

      setTimeout(() => 
      {
        expect(clientSocket.connected).toBe(true);
        done();
      }, 50);
    });
  });

  test('startServer default parameter fallback execution test', async () => 
  {
    if (testServer && testServer.listening) 
    {
      await new Promise(resolve => testServer.close(resolve));
    }

    const serverInstance = await startServer();
    expect(serverInstance.address().port).toBe(3000);
    await new Promise(resolve => serverInstance.close(resolve));
  });
});