const request = require('supertest');
const ioClient = require('socket.io-client');
const { startServer, Service_Entry, Container_Initializer, Status_Changer } = require('./QSAdminBackend');

test('Checking the basic mock data initialization', () => {
  const Test_Container = Container_Initializer();
  expect(Test_Container).toBeDefined();
  
  try { Test_Container.forEach(entry => {expect(entry).toBeInstanceOf(Service_Entry);});  }
  catch(error) {  throw new Error(`Element ${error} failed in the Test_Container.`);  }
});

test('updates status for existing service', () => {
    const updated = Status_Changer('Placeholder 1', 'Open');
    expect(updated).not.toBeNull();
    expect(updated.operation_status).toBe('Open');
});

describe('Network Capabilities', () => {
  let testServer;
  let testPort;

  beforeAll((done) => {
    // Pass 0 for reliable dynamic port assignment across test runners
    testServer = startServer(0);

    testServer.on('listening', () => {
      testPort = testServer.address().port;
      done();
    });
  });

  afterAll((done) => {
    if (testServer && testServer.listening) {testServer.close(done);} 
    else {done();}
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
        .send({ name: 'Placeholder 2', status: 'Closed' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Status updated successfully');
      expect(response.body.service.operation_status).toBe('Closed');
    });

    test('returns 400 when missing name or status', async () => {
      const response = await request(testServer)
        .patch('/api/admin/services/status')
        .send({ name: 'Placeholder 2' }); // missing status

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing name or status in request body.');
    });

    test('returns 404 when service is not found', async () => {
      const response = await request(testServer)
        .patch('/api/admin/services/status')
        .send({ name: 'Invalid Service Name', status: 'Open' });

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

    test('returns 400 when name or description is missing', async () => {
      const response = await request(testServer)
        .post('/api/admin/services')
        .send({ name: 'Incomplete Service' }); // missing description

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Name and description are required.');
    });

    test('returns 409 when service name already exists', async () => {
      const response = await request(testServer)
        .post('/api/admin/services')
        .send({
          name: 'Placeholder 1',
          description: 'Duplicate name check.'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Service with this name already exists.');
    });

    test('fallback check: assigns defaults when expected_duration and priority are missing or invalid', async () => {
      const response = await request(testServer)
        .post('/api/admin/services')
        .send({
          name: 'Fallback Test Service POST',
          description: 'Testing default fallback branches.'
        });

      expect(response.status).toBe(201);
      expect(response.body.service.expected_duration).toBe(0); // Triggers || 0 branch
      expect(response.body.service.priority).toBe(1); // Triggers || 1 branch
    });
  });

  describe('HTTP PUT /api/admin/services', () => {
    test('successfully updates an existing service profile and returns 200', async () => {
      const updatedDetails = {
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
          name: 'Non Existent Service',
          description: 'Does not exist.',
          expected_duration: 10,
          priority: 1
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Service not found.');
    });

    test('fallback check: assigns defaults when expected_duration and priority evaluate to falsy', async () => {
      const response = await request(testServer)
        .put('/api/admin/services')
        .send({
          name: 'Placeholder 3',
          description: 'Testing PUT fallback branches.',
          expected_duration: null,
          priority: undefined
        });

      expect(response.status).toBe(200);
      expect(response.body.service.expected_duration).toBe(0); // Triggers || 0 branch
      expect(response.body.service.priority).toBe(1); // Triggers || 1 branch
    });
  });

  describe('HTTP DELETE /api/admin/services/:name', () => {
    test('successfully deletes an existing service and returns 200', async () => {
      const response = await request(testServer)
        .delete(`/api/admin/services/${encodeURIComponent('Placeholder 4')}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Service deleted successfully');
    });

    test('returns 404 when attempting to delete a non-existent service', async () => {
      const response = await request(testServer)
        .delete(`/api/admin/services/${encodeURIComponent('Ghost Service')}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Service not found.');
    });
  });

  test('WebSocket receives queue_updated and handles serve_client', (done) => {
    const clientSocket = ioClient(`http://localhost:${testPort}`);

    clientSocket.on('queue_updated', (data) => {
      expect(Array.isArray(data)).toBe(true);

      clientSocket.emit('serve_client', { id: 1 });
      
      setTimeout(() => {
        clientSocket.disconnect();
        done();
      }, 50);
    });
  });

  test('startServer default parameter branch check', () => {
    // Invoking with undefined executes default assignment (port = 3000)
    // We mock server.listen temporarily to avoid duplicate port errors
    const originalListen = testServer.listen;
    let defaultPortUsed;
    
    // Spy on listen to verify default port 3000 without binding the network
    testServer.listen = (port) => {
      defaultPortUsed = port;
      return testServer;
    };

    startServer(); // Triggers port = 3000 default parameter

    expect(defaultPortUsed).toBe(3000);

    // Restore original listen function
    testServer.listen = originalListen;
  });
});