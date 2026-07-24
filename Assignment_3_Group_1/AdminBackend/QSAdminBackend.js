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

// Functions for Dashboard
function Status_Changer(service_name, new_status) 
{
    const targetService = Services_Container.find(s => s.name === service_name);
    
    if (!targetService) {   return null;  }
    
    targetService.operation_status = new_status;
    return targetService;
}

// Express Route to handle status changes
app.patch('/api/admin/services/status', (req, res) => {
    const { name, status } = req.body;

    if (!(name && status)) 
    {
      return res.status(400).json({ error: 'Missing name or status in request body.' });
    }

    const updatedService = Status_Changer(name, status);

    if (updatedService) 
    {
      // Broadcast real-time update to all connected WebSocket clients
      io.emit('queue_updated', Services_Container);

      return res.status(200).json({
        message: 'Status updated successfully',
        service: updatedService
      });
    }

    return res.status(404).json({ error: 'Service not found.' });
});

// Functions and Functionality for Service Management
// POST: Create a new service
app.post('/api/admin/services', (req, res) => {
    const { name, description, expected_duration, priority } = req.body;

    if (!name || !description) {
        return res.status(400).json({ error: 'Name and description are required.' });
    }

    const existingService = Services_Container.find(s => s.name === name);
    if (existingService) {
        return res.status(409).json({ error: 'Service with this name already exists.' });
    }

    const newService = new Service_Entry(
        name,
        description,
        Number(expected_duration) || 0,
        Number(priority) || 1,
        0,
        'clopen'
    );

    Services_Container.push(newService);

    // Broadcast updated container over WebSockets
    io.emit('queue_updated', Services_Container);

    return res.status(201).json({ message: 'Service created successfully', service: newService });
});

// PUT: Update an existing service
app.put('/api/admin/services', (req, res) => {
    const { name, description, expected_duration, priority } = req.body;

    const targetService = Services_Container.find(s => s.name === name);
    if (!targetService) {
        return res.status(404).json({ error: 'Service not found.' });
    }

    targetService.description = description;
    targetService.expected_duration = Number(expected_duration) || 0;
    targetService.priority = Number(priority) || 1;

    io.emit('queue_updated', Services_Container);

    return res.status(200).json({ message: 'Service updated successfully', service: targetService });
});

// DELETE: Remove a service by name
app.delete('/api/admin/services/:name', (req, res) => {
    const serviceName = req.params.name;
    const initialLength = Services_Container.length;

    const index = Services_Container.findIndex(s => s.name === serviceName);
    if (index === -1) {
        return res.status(404).json({ error: 'Service not found.' });
    }

    Services_Container.splice(index, 1);

    io.emit('queue_updated', Services_Container);

    return res.status(200).json({ message: 'Service deleted successfully' });
});

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
/* istanbul ignore next*/
if (require.main === module) {
    startServer(3000);
}

// Export for Jest testing
module.exports = { app, server, io, startServer, Service_Entry, Container_Initializer, Status_Changer };
