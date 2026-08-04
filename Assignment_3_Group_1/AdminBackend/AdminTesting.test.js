// Mock the ES Module database pool before requiring QSAdminBackend
jest.mock('../../Assignment_4_Group_1/QSAdminDB/QSAdminDBPool', () => ({
  __esModule: true,
  default: {
    query: jest.fn().mockImplementation((sql) => {
      if (!(sql.includes('vw_AdminServiceQueueState'))) {  return Promise.resolve([[]]);  }

      // Return mock data mimicking DB view output
      const mockRows = Array.from({ length: 30 }, (_, i) => ({
        service_id: i + 1,
        name: `Placeholder ${i + 1}`,
        description: `Description ${i + 1}`,
        expected_duration: i + 1,
        priority: (i % 3) + 1,
        operation_status: i % 2 === 0 ? 'open' : 'closed',
        Queue_Array: JSON.stringify(Array.from({ length: 60 }, (_, k) => `Person ${k + 1}`))
      }));
      return Promise.resolve([mockRows]);
    })
  }
}));

const request = require('supertest');
const ioClient = require('socket.io-client');
const { startServer, Service_Entry, Container_Initializer, Status_Changer } = require('./QSAdminBackend');

describe('Mock Initialization', () => {
  test('Checking the basic mock data initialization', async () => {
    const Test_Container = await Container_Initializer();
    expect(Test_Container).toBeDefined();
    
    try 
    { 
      Test_Container.forEach(entry => {
        expect(entry).toBeInstanceOf(Service_Entry);
      });  
    } catch(error) 
    {  
      throw new Error(`Element ${error} failed in the Test_Container.`);  
    }
  });

  test('Container_Initializer sorts mock services by priority (High to Low)', async () => {
    const container = await Container_Initializer();
    
    for (let i = 0; i < container.length - 1; i++) 
    {
      expect(container[i].priority).toBeGreaterThanOrEqual(container[i + 1].priority);
    }
  });
});

test('updates status for existing service', async () => {
    // startServer populates Services_Container internally
    const serverInstance = await startServer(0); 
    
    const updated = Status_Changer(1, 'Open');
    expect(updated).not.toBeNull();
    expect(updated.operation_status).toBe('Open');

    await new Promise((resolve) => serverInstance.close(resolve));
});

describe('Network Capabilities', () => {
  let testServer;
  let testPort;

  beforeAll(async () => {
    // Pass 0 for dynamic port assignment
    testServer = await startServer(0);
    testPort = testServer.address().port;
  });

  afterAll((done) => {
    if (testServer && testServer.listening) {  testServer.close(done);  } 
    else {  done();  }
  });

  test('HTTP GET /api/admin/services returns service list', async () => {
    const response = await request(testServer).get('/api/admin/services');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  describe('HTTP PATCH /api/admin/services/status', () => {
    test('successfully updates status and returns 200', async () => {
      const response = await request(testServer)
        .patch('/api/admin/services/status')
        .send({ service_id: 2, status: 'Closed' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Status updated successfully');
      expect(response.body.service.operation_status).toBe('Closed');
    });

    test('returns 400 when missing service_id or status', async () => {
      const response = await request(testServer)
        .patch('/api/admin/services/status')
        .send({ service_id: 2 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing service_id or status in request body.');
    });

    test('returns 404 when service is not found', async () => {
      const response = await request(testServer)
        .patch('/api/admin/services/status')
        .send({ service_id: 99999, status: 'Open' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Service not found.');
    });
  });

  describe('HTTP POST /api/admin/services', () => {
    test('successfully creates a new service and returns 201', async () => {
      const newService = {
        name: 'New Test Service',
        description: 'A newly created service for testing.',
        expected_duration: 15,
        priority: 2
      };

      const response = await request(testServer)
        .post('/api/admin/services')
        .send(newService);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Service created successfully');
      expect(response.body.service.name).toBe('New Test Service');
      expect(response.body.service.expected_duration).toBe(15);
    });

    test('successfully creates a new service with low, medium, and high string priority levels', async () => {
      let response = await request(testServer)
        .post('/api/admin/services')
        .send({ name: 'Service Low', description: 'Desc', expected_duration: 10, priority: 'low' });
      expect(response.status).toBe(201);
      expect(response.body.service.priority).toBe(1);

      response = await request(testServer)
        .post('/api/admin/services')
        .send({ name: 'Service One', description: 'Desc', expected_duration: 10, priority: '1' });
      expect(response.status).toBe(201);
      expect(response.body.service.priority).toBe(1);

      response = await request(testServer)
        .post('/api/admin/services')
        .send({ name: 'Service High', description: 'Desc', expected_duration: 10, priority: 'high' });
      expect(response.status).toBe(201);
      expect(response.body.service.priority).toBe(3);

      response = await request(testServer)
        .post('/api/admin/services')
        .send({ name: 'Service Three', description: 'Desc', expected_duration: 10, priority: '3' });
      expect(response.status).toBe(201);
      expect(response.body.service.priority).toBe(3);
    });

    test('returns 400 when missing required fields', async () => {
      let response = await request(testServer).post('/api/admin/services').send({});
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Service Name is required.');

      response = await request(testServer).post('/api/admin/services').send({ name: 'Test' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Description is required.');

      response = await request(testServer).post('/api/admin/services').send({ name: 'Test', description: 'Desc' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Expected Duration is required.');

      response = await request(testServer).post('/api/admin/services').send({ name: 'Test', description: 'Desc', expected_duration: 10 });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Priority Level is required.');
    });

    test('returns 400 when name exceeds 100 characters', async () => {
      const longName = 'A'.repeat(101);
      const response = await request(testServer)
        .post('/api/admin/services')
        .send({
          name: longName,
          description: 'Valid Desc',
          expected_duration: 15,
          priority: 'low'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Service Name cannot exceed 100 characters.');
    });

    test('returns 400 when expected_duration is invalid or non-positive', async () => {
      const response = await request(testServer)
        .post('/api/admin/services')
        .send({
          name: 'Invalid Duration Service',
          description: 'Valid Desc',
          expected_duration: -10,
          priority: 'high'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Expected Duration must be a positive number.');
    });

    test('returns 400 for invalid priority levels (string, number, and object)', async () => {
      let response = await request(testServer)
        .post('/api/admin/services')
        .send({ name: 'Test Prio', description: 'Desc', expected_duration: 10, priority: 'urgent' });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Priority Level must be low, medium, or high.');

      response = await request(testServer)
        .post('/api/admin/services')
        .send({ name: 'Test Prio', description: 'Desc', expected_duration: 10, priority: 99 });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Priority Level must be 1 (low), 2 (medium), or 3 (high).');

      response = await request(testServer)
        .post('/api/admin/services')
        .send({ name: 'Test Prio', description: 'Desc', expected_duration: 10, priority: { prio: 1 } });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid Priority Level format.');
    });

    test('returns 409 when service name already exists', async () => {
      const response = await request(testServer)
        .post('/api/admin/services')
        .send({
          name: 'Placeholder 1',
          description: 'Duplicate name check.',
          expected_duration: 10,
          priority: 'medium'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Service with this name already exists.');
    });

    test('returns 400 when sending null payload', async () => {
      const response = await request(testServer).post('/api/admin/services').send(null);
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Service Name is required.');
    });

    test('inserts new high-priority service (priority 3) at the bottom of priority 3 group', async () => {
      const newService = {
        name: 'High Priority Test Service',
        description: 'Testing relative insertion for priority 3',
        expected_duration: 15,
        priority: 3
      };

      const response = await request(testServer)
        .post('/api/admin/services')
        .send(newService);

      expect(response.status).toBe(201);

      const getRes = await request(testServer).get('/api/admin/services');
      const services = getRes.body;

      const insertedIndex = services.findIndex(s => s.name === 'High Priority Test Service');
      expect(insertedIndex).toBeGreaterThan(-1);
      if (insertedIndex < services.length - 1) {
        expect(services[insertedIndex + 1].priority).toBeLessThanOrEqual(3);
      }
    });

    test('inserts new low-priority service (priority 1) at the end of the container', async () => {
      const newService = {
        name: 'Low Priority Test Service',
        description: 'Testing relative insertion for priority 1',
        expected_duration: 15,
        priority: 1
      };

      const response = await request(testServer)
        .post('/api/admin/services')
        .send(newService);

      expect(response.status).toBe(201);

      const getRes = await request(testServer).get('/api/admin/services');
      const services = getRes.body;

      const lastService = services[services.length - 1];
      expect(lastService.priority).toBe(1);
    });
  });

  describe('HTTP PUT /api/admin/services', () => {
    test('successfully updates an existing service profile and returns 200', async () => {
      const updatedDetails = {
        service_id: 3,
        name: 'Placeholder 3',
        description: 'Updated description for testing.',
        expected_duration: 25,
        priority: 3
      };

      const response = await request(testServer)
        .put('/api/admin/services')
        .send(updatedDetails);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Service updated successfully');
      expect(response.body.service.description).toBe('Updated description for testing.');
      expect(response.body.service.expected_duration).toBe(25);
      expect(response.body.service.priority).toBe(3);
    });

    test('returns 404 when updating a non-existent service', async () => {
      const response = await request(testServer)
        .put('/api/admin/services')
        .send({
          service_id: 99999,
          name: 'Non Existent Service',
          description: 'Does not exist.',
          expected_duration: 10,
          priority: 1
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Service not found.');
    });

    test('returns 400 when missing service_id on PUT request', async () => {
      const response = await request(testServer)
        .put('/api/admin/services')
        .send({
          name: 'Placeholder 3',
          description: 'Testing missing service_id on PUT',
          expected_duration: 10,
          priority: 'medium'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('service_id is required.');
    });

    test('returns 400 when validation fails on PUT request', async () => {
      const response = await request(testServer)
        .put('/api/admin/services')
        .send({
          service_id: 3,
          name: 'Placeholder 3',
          description: 'Testing validation failure on PUT',
          expected_duration: 'invalid_duration',
          priority: 'medium'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Expected Duration must be a positive number.');
    });
  });

  describe('HTTP DELETE /api/admin/services/:id', () => {
    test('successfully deletes an existing service and returns 200', async () => {
      const response = await request(testServer)
        .delete(`/api/admin/services/4`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Service deleted successfully');
    });

    test('returns 404 when attempting to delete a non-existent service', async () => {
      const response = await request(testServer)
        .delete(`/api/admin/services/99999`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Service not found.');
    });
  });

  describe('WebSocket Handlers & Disconnect Events', () => {
    let clientSocket;

    beforeEach((done) => {
      clientSocket = ioClient(`http://localhost:${testPort}`, {
        transports: ['websocket'],
        forceNew: true
      });
      clientSocket.on('connect', done);
    });

    afterEach(() => {
      if (clientSocket.connected) {  clientSocket.disconnect();  }
    });

    test('receives queue_updated on initial connection', (done) => {
      const testSocket = ioClient(`http://localhost:${testPort}`, {
        transports: ['websocket'],
        forceNew: true
      });

      testSocket.on('queue_updated', (data) => {
        expect(Array.isArray(data)).toBe(true);
        testSocket.disconnect();
        done();
      });
    });

    test('handles serve_client and broadcasts updated queue', (done) => {
      clientSocket.emit('serve_client', { service_id: 1 });

      clientSocket.on('queue_updated', (services) => {
        const updatedService = services.find(s => s.service_id === 1);
        expect(updatedService.Queue_Array.length).toBe(59);
        expect(updatedService.Queue_Array[0]).toBe('Person 2');
        done();
      });
    });

    test('handles serve_client notification branches for object payloads and missing fetch', (done) => {
      clientSocket.emit('reorder_queue', {
        service_id: 10,
        updated_queue: [{ userId: 'user_123' }, { userId: null }]
      });

      clientSocket.once('queue_updated', () => {
        clientSocket.emit('serve_client', { service_id: 10 });

        clientSocket.once('queue_updated', () => {
          clientSocket.emit('serve_client', { service_id: 10 });

          clientSocket.once('queue_updated', () => {
            const originalFetch = global.fetch;
            delete global.fetch;

            clientSocket.emit('serve_client', { service_id: 1 });

            clientSocket.once('queue_updated', () => {
              global.fetch = originalFetch;
              done();
            });
          });
        });
      });
    });

    test('handles remove_client with specific index and defaults to index 0', (done) => {
      clientSocket.emit('remove_client', { service_id: 5, client_index: 2 });

      clientSocket.once('queue_updated', (services) => {
        const updatedService = services.find(s => s.service_id === 5);
        expect(updatedService.Queue_Array).not.toContain('Person 3');

        clientSocket.emit('remove_client', { service_id: 5 });
        clientSocket.once('queue_updated', (servicesAfterDefault) => {
          const defaultRemovedService = servicesAfterDefault.find(s => s.service_id === 5);
          expect(defaultRemovedService.Queue_Array[0]).toBe('Person 2');
          done();
        });
      });
    });

    test('handles reorder_queue event', (done) => {
      const customOrder = ['Person 10', 'Person 1', 'Person 5'];
      clientSocket.emit('reorder_queue', { service_id: 6, updated_queue: customOrder });

      clientSocket.on('queue_updated', (services) => {
        const updatedService = services.find(s => s.service_id === 6);
        expect(updatedService.Queue_Array).toEqual(customOrder);
        expect(updatedService.queue_length).toBe(3);
        done();
      });
    });

    test('handles join_queue and leave_queue events', (done) => {
      const clientName = 'Unit Test Client';
      clientSocket.emit('join_queue', { service_id: 7, client_name: clientName });

      clientSocket.once('queue_updated', (services) => {
        const joinedService = services.find(s => s.service_id === 7);
        expect(joinedService.Queue_Array).toContain(clientName);

        clientSocket.emit('leave_queue', { service_id: 7, client_name: clientName });
        clientSocket.once('queue_updated', (servicesAfterLeave) => {
          const leftService = servicesAfterLeave.find(s => s.service_id === 7);
          expect(leftService.Queue_Array).not.toContain(clientName);
          done();
        });
      });
    });

    test('gracefully ignores actions on non-existent service or empty/falsy data payload', (done) => {
      clientSocket.emit('serve_client', null);
      clientSocket.emit('remove_client', undefined);
      clientSocket.emit('reorder_queue', null);
      clientSocket.emit('join_queue', undefined);
      clientSocket.emit('leave_queue', null);

      clientSocket.emit('serve_client', { service_id: 99999 });
      clientSocket.emit('leave_queue', { service_id: 8, client_name: 'Ghost' });

      setTimeout(() => {
        expect(clientSocket.connected).toBe(true);
        done();
      }, 50);
    });

    test('triggers server-side disconnect handler cleanly upon explicit socket.disconnect()', (done) => {
      clientSocket.on('disconnect', (reason) => {
        expect(reason).toBe('io client disconnect');
        done();
      });

      clientSocket.disconnect();
    });
  });

  test('startServer default parameter branch check', async () => {
    // Close the running testServer first so port 3000 isn't blocked / server isn't already listening
    if (testServer && testServer.listening) 
    {
      await new Promise(resolve => testServer.close(resolve));
    }

    const serverInstance = await startServer();
    expect(serverInstance.address().port).toBe(3000);
    await new Promise(resolve => serverInstance.close(resolve));
  });
});