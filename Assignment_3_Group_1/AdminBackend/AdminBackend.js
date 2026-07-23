// I, Elvis Noel Trujillo Chairez, got the admin portion of the project as shown in assignment 2.
// This is just a placeholder for the repo; so that y'all can place your files without making a mess
// in the repo.

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io'); // or standard 'ws'

const app = express();
app.use(cors());
app.use(express.json());

// Create the unified HTTP server
const server = http.createServer(app);

// Attach WebSockets to the HTTP server
const io = new Server(server, {
  cors: { origin: "*" }
});

class Service_Entry {
  Queue_Array = [];

  constructor(name, description, expected_duration, priority, queue_length, operation_status) 
  {
    this.name = name;
    this.priority = priority;
    this.description = description;
    this.queue_length = queue_length;
    this.operation_status = operation_status;
    this.expected_duration = expected_duration;

    for(let index = 1; index <= 60; index++) 
    {
      const Client_Name = `Person ${index}`;
      this.Queue_Array.push(Client_Name);
    }
  }
}

function Container_Initializer() {
  const Container = [];
  let Desc = "According to all known laws of aviation, there is no way that a bee should be able to fly.";

  for (let index = 1; index <= 30; index++) {
    const Entry = new Service_Entry(`Placeholder ${index}`, `${Desc} ${index}`, index, index % 4, 42, "clopen");
    Container.push(Entry);
  }

  return Container;
}

const Services_Container = Container_Initializer();

// Express Route
app.get('/api/admin/services', (req, res) => {
    res.status(200).json(Services_Container);
});

// WebSocket Connection Logic
io.on('connection', (socket) => {
  console.log('Client connected to Queue WS:', socket.id);

  // Send initial queue state to newly connected client
  socket.emit('queue_updated', Services_Container);

  // Example event: Queue Management updates client status
  socket.on('serve_client', (data) => {
      // Logic to remove/serve client from queue...
      io.emit('queue_updated', Services_Container); // Broadcast updated list to all admins
  });
});

// Function to start the server programmatically
function startServer(port = 3000) {
  return server.listen(port, () => {
      console.log(`AdminBackend (HTTP + WebSockets) listening on port ${port}`);
  });
}

// Automatically start if executed directly via Node (`node AdminBackend.js`)
if (require.main === module) {
    startServer(3000);
}

// Export for Jest testing
module.exports = { app, server, io, startServer, Service_Entry, Container_Initializer };