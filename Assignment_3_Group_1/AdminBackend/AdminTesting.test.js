const request = require('supertest');
const ioClient = require('socket.io-client');
const { startServer, Service_Entry, Container_Initializer } = require('./QSAdminBackend');

test('Checking the basic mock data initialization', () => {
  const Test_Container = Container_Initializer();
  expect(Test_Container).toBeDefined();
  
  try { Test_Container.forEach(entry => {expect(entry).toBeInstanceOf(Service_Entry);});  }
  catch(error) {  throw new Error(`Element ${error} failed in the Test_Container.`);  }
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

  test('WebSocket receives queue_updated and handles serve_client', (done) => {
    const clientSocket = ioClient(`http://localhost:${testPort}`);

    clientSocket.on('queue_updated', (data) => {
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(30);

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