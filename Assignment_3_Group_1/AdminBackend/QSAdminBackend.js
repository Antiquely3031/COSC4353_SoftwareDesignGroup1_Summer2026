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

function sortServicesByPriority(services) 
{
  return services.sort((a, b) => b.priority - a.priority);
}

function Container_Initializer() 
{
  const Container = [];
  let Desc = "According to all known laws of aviation, there is no way that a bee should be able to fly.";

  for (let index = 1; index <= 30; index++) {
    const Entry = new Service_Entry(`Placeholder ${index}`, `${Desc} ${index}`, index, index % 4 || 1, 42, "clopen");
    Container.push(Entry);
  }

  return sortServicesByPriority(Container);
}

const Services_Container = Container_Initializer();

// Helper Function: Validation for POST and PUT payloads
function validateServicePayload(payload) 
{
  const { name, description, expected_duration, priority } = payload || {};

  // Required Fields Check
  if (name === undefined || name === null || String(name).trim() === '') {
    return { valid: false, error: 'Service Name is required.' };
  }
  if (description === undefined || description === null || String(description).trim() === '') {
    return { valid: false, error: 'Description is required.' };
  }
  if (expected_duration === undefined || expected_duration === null || String(expected_duration).trim() === '') {
    return { valid: false, error: 'Expected Duration is required.' };
  }
  if (priority === undefined || priority === null || String(priority).trim() === '') {
    return { valid: false, error: 'Priority Level is required.' };
  }

  // String Length Limit Check
  const nameStr = String(name).trim();
  if (nameStr.length > 100) {
    return { valid: false, error: 'Service Name cannot exceed 100 characters.' };
  }

  // Expected Duration Field Type & Range Verification
  const parsedDuration = Number(expected_duration);
  if (isNaN(parsedDuration) || parsedDuration <= 0) {
    return { valid: false, error: 'Expected Duration must be a positive number.' };
  }

  // Priority Level Field Verification (low / medium / high or numeric 1 / 2 / 3)
  let parsedPriority;
  switch (typeof priority) 
  {
    case 'string':
      const lowerPrio = priority.toLowerCase().trim();

      switch(lowerPrio) 
      {
        case 'low': case '1': parsedPriority = 1; break;
        case 'medium': case '2': parsedPriority = 2; break;
        case 'high': case '3': parsedPriority = 3; break;
        default: return { valid: false, error: 'Priority Level must be low, medium, or high.' };
      }
      break;
    case 'number':
      if (!([1, 2, 3].includes(priority))) { return { valid: false, error: 'Priority Level must be 1 (low), 2 (medium), or 3 (high).' }; }

      parsedPriority = priority;
      break;
    default: return { valid: false, error: 'Invalid Priority Level format.' };
  }

  return {
    valid: true,
    data: {
      name: nameStr,
      description: String(description).trim(),
      expected_duration: parsedDuration,
      priority: parsedPriority
    }
  };
}

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

    if (!(name && status)) {  return res.status(400).json({ error: 'Missing name or status in request body.' });  }

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
    const validation = validateServicePayload(req.body);
    if (!validation.valid) { return res.status(400).json({ error: validation.error }); }

    const { name, description, expected_duration, priority } = validation.data;

    const existingService = Services_Container.find(s => s.name === name);
    if (existingService) { return res.status(409).json({ error: 'Service with this name already exists.' }); }

    const newService = new Service_Entry(
        name,
        description,
        expected_duration,
        priority,
        0,
        'clopen'
    );

    // Find insertion index: Place at the end of the range for equal priority
    // Find the index of the first service with a STRICTLY LOWER priority
    let insertIndex = Services_Container.findIndex(s => s.priority < priority);
    
    if (insertIndex === -1) {
      // If no service has lower priority, push to the end of the array
      Services_Container.push(newService);
    } else {
      // Insert right before the first lower-priority element
      Services_Container.splice(insertIndex, 0, newService);
    }

    // Broadcast updated container over WebSockets
    io.emit('queue_updated', Services_Container);

    return res.status(201).json({ message: 'Service created successfully', service: newService });
});

// PUT: Update an existing service
app.put('/api/admin/services', (req, res) => {
    const validation = validateServicePayload(req.body);
    if (!validation.valid) {  return res.status(400).json({ error: validation.error });  }

    const { name, description, expected_duration, priority } = validation.data;

    const targetService = Services_Container.find(s => s.name === name);
    if (!targetService) {  return res.status(404).json({ error: 'Service not found.' });  }

    targetService.description = description;
    targetService.expected_duration = expected_duration;
    targetService.priority = priority;

    io.emit('queue_updated', Services_Container);

    return res.status(200).json({ message: 'Service updated successfully', service: targetService });
});

// DELETE: Remove a service by name
app.delete('/api/admin/services/:name', (req, res) => {
    const serviceName = req.params.name;

    const index = Services_Container.findIndex(s => s.name === serviceName);
    if (index === -1) {  return res.status(404).json({ error: 'Service not found.' });  }

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

  // SERVER-SIDE DISCONNECT HANDLER
  socket.on('disconnect', (reason) => {
    console.log(`Client disconnected from Queue WS (${socket.id}). Reason: ${reason}`);
  });

  // ADMIN ACTION: Serve next client (removes first person from array)
  socket.on('serve_client', (data) => {
    const { service_name } = data || {};
    const service = Services_Container.find(s => s.name === service_name);

    if (service && service.Queue_Array.length > 0) 
    {
      service.Queue_Array.shift();
      service.queue_length = service.Queue_Array.length;
      io.emit('queue_updated', Services_Container);
    }
  });

  // ADMIN ACTION: Remove specific client or first client
  socket.on('remove_client', (data) => {
    const { service_name, client_index } = data || {};
    const service = Services_Container.find(s => s.name === service_name);

    if (service && service.Queue_Array.length > 0) 
    {
      const indexToRemove = typeof client_index === 'number' ? client_index : 0;
      service.Queue_Array.splice(indexToRemove, 1);
      service.queue_length = service.Queue_Array.length;
      io.emit('queue_updated', Services_Container);
    }
  });

  // ADMIN ACTION: Drag & Drop Reorder
  socket.on('reorder_queue', (data) => {
    const { service_name, updated_queue } = data || {};
    const service = Services_Container.find(s => s.name === service_name);

    if (service && Array.isArray(updated_queue)) 
    {
      service.Queue_Array = updated_queue;
      service.queue_length = service.Queue_Array.length;
      io.emit('queue_updated', Services_Container);
    }
  });

  // USER ACTION: Join Queue voluntarily
  socket.on('join_queue', (data) => {
    const { service_name, client_name } = data || {};
    const service = Services_Container.find(s => s.name === service_name);

    if (service && client_name) 
    {
      service.Queue_Array.push(client_name);
      service.queue_length = service.Queue_Array.length;
      io.emit('queue_updated', Services_Container);
    }
  });

  // USER ACTION: Leave Queue voluntarily
  socket.on('leave_queue', (data) => {
    const { service_name, client_name } = data || {};
    const service = Services_Container.find(s => s.name === service_name);
    if (service && client_name) 
    {
      const index = service.Queue_Array.indexOf(client_name);
      
      if (index !== -1) 
      {
        service.Queue_Array.splice(index, 1);
        service.queue_length = service.Queue_Array.length;
        io.emit('queue_updated', Services_Container);
      }
    }
  });
});

// Function to start the server programmatically
function startServer(port = 3000) 
{
  return server.listen(port, () => {
      console.log(`AdminBackend (HTTP + WebSockets) listening on port ${port}`);
  });
}

// Automatically start if executed directly via Node (`node AdminBackend.js`)
/* istanbul ignore next*/
if (require.main === module) 
{
    startServer(3000);
}

// Export for Jest testing
module.exports = { app, server, io, startServer, Service_Entry, Container_Initializer, Status_Changer };