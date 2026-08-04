// I, Elvis Noel Trujillo Chairez, got the admin portion of the project as shown in assignment 2.
// This is just a placeholder for the repo; so that y'all can place your files without making a mess
// in the repo.

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io'); // or standard 'ws'

const pool = require('../../Assignment_4_Group_1/QSAdminDB/QSAdminDBPool').default;

const app = express();
app.use(cors());
app.use(express.json());

// Create the unified HTTP server
const server = http.createServer(app);

// Attach WebSockets to the HTTP server
const io = new Server(server, { cors: { origin: "*" } });

class Service_Entry {
  Queue_Array = [];

  constructor(service_id, name, description, expected_duration, priority, queue_length, operation_status, queue_array = []) {
    this.service_id = service_id;
    this.name = name;
    this.priority = priority;
    this.description = description;
    this.queue_length = queue_length;
    this.operation_status = operation_status;
    this.expected_duration = expected_duration;
    this.Queue_Array = Array.isArray(queue_array) ? queue_array : [];
  }
}

function sortServicesByPriority(services) {  return services.sort((a, b) => b.priority - a.priority);  }

async function Container_Initializer() 
{
  try 
  {
    // Execute stored procedure transaction to generate baseline dataset
    const Initial_Gen_Reset_Key = false;
    if (Initial_Gen_Reset_Key)  {  await pool.query('CALL Mock_Initialization_Generation(30);');  }

    // Query aggregated service-queue view
    const [rows] = await pool.query('SELECT * FROM vw_AdminServiceQueueState;');

    const Container = rows.map(row => {
      // Parse JSON array emitted by DB view
      let parsedQueue = [];
      if (typeof row.Queue_Array === 'string') 
      {
        try { parsedQueue = JSON.parse(row.Queue_Array); } catch (e) { parsedQueue = []; }
      } else if (Array.isArray(row.Queue_Array))  {  parsedQueue = row.Queue_Array;  }

      // Filter nulls produced by outer joins when queues are empty
      parsedQueue = parsedQueue.filter(item => item !== null);

      return new Service_Entry(
        row.service_id,
        row.name,
        row.description,
        Number(row.expected_duration),
        Number(row.priority),
        Number(row.queue_length),
        row.operation_status,
        parsedQueue
      );
    });

    return sortServicesByPriority(Container);
  } catch (error) 
  {
    console.error('Error executing DB initialization procedure or querying view:', error.message);
    return [];
  }
}

let Services_Container = [];

// Helper Function: Validation for POST and PUT payloads
function validateServicePayload(payload) 
{
  const { name, description, expected_duration, priority } = payload || {};

  // Required Fields Check
  if (name === undefined || name === null || String(name).trim() === '') 
  {
    return { valid: false, error: 'Service Name is required.' };
  }
  if (description === undefined || description === null || String(description).trim() === '') 
  {
    return { valid: false, error: 'Description is required.' };
  }
  if (expected_duration === undefined || expected_duration === null || String(expected_duration).trim() === '') 
  {
    return { valid: false, error: 'Expected Duration is required.' };
  }
  if (priority === undefined || priority === null || String(priority).trim() === '') 
  {
    return { valid: false, error: 'Priority Level is required.' };
  }

  // String Length Limit Check
  const nameStr = String(name).trim();
  if (nameStr.length > 100) 
  {
    return { valid: false, error: 'Service Name cannot exceed 100 characters.' };
  }

  // Expected Duration Field Type & Range Verification
  const parsedDuration = Number(expected_duration);
  if (isNaN(parsedDuration) || parsedDuration <= 0) 
  {
    return { valid: false, error: 'Expected Duration must be a positive number.' };
  }

  // Priority Level Field Verification (low / medium / high or numeric 1 / 2 / 3)
  let parsedPriority;
  switch (typeof priority) 
  {
    case 'string':
      const lowerPrio = priority.toLowerCase().trim();

      switch (lowerPrio) 
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
function Status_Changer(service_id, new_status) 
{
  const targetService = Services_Container.find(s => String(s.service_id) === String(service_id));

  if (!targetService) { return null; }

  targetService.operation_status = new_status;
  return targetService;
}

// Express Route to handle status changes
app.patch('/api/admin/services/status', (req, res) => {
  const { service_id, status } = req.body;

  if (!(service_id && status)) 
  {
    return res.status(400).json({ error: 'Missing service_id or status in request body.' });
  }

  const updatedService = Status_Changer(service_id, status);

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
    Date.now(),
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

  if (insertIndex === -1) 
  {
    // If no service has lower priority, push to the end of the array
    Services_Container.push(newService);
  } else 
  {
    // Insert right before the first lower-priority element
    Services_Container.splice(insertIndex, 0, newService);
  }

  // Broadcast updated container over WebSockets
  io.emit('queue_updated', Services_Container);

  return res.status(201).json({ message: 'Service created successfully', service: newService });
});

// PUT: Update an existing service
app.put('/api/admin/services', (req, res) => {
  const { service_id } = req.body;
  if (!service_id) { return res.status(400).json({ error: 'service_id is required.' }); }

  const validation = validateServicePayload(req.body);
  if (!validation.valid) { return res.status(400).json({ error: validation.error }); }

  const { name, description, expected_duration, priority } = validation.data;

  const targetService = Services_Container.find(s => String(s.service_id) === String(service_id));
  if (!targetService) { return res.status(404).json({ error: 'Service not found.' }); }

  targetService.name = name;
  targetService.description = description;
  targetService.expected_duration = expected_duration;
  targetService.priority = priority;

  io.emit('queue_updated', Services_Container);

  return res.status(200).json({ message: 'Service updated successfully', service: targetService });
});

// DELETE: Remove a service by service_id
app.delete('/api/admin/services/:id', (req, res) => {
  const serviceId = req.params.id;

  const index = Services_Container.findIndex(s => String(s.service_id) === String(serviceId));
  if (index === -1) { return res.status(404).json({ error: 'Service not found.' }); }

  Services_Container.splice(index, 1);

  io.emit('queue_updated', Services_Container);

  return res.status(200).json({ message: 'Service deleted successfully' });
});

// Express Route
app.get('/api/admin/services', (req, res) => {
  res.status(200).json(Services_Container);
});

// WebSocket Connection Logic
// (Richard) Tells the notification service (port 3001) that a client was served, so the
// served user gets a "Served" notification. Forward compatible, so if a queue entry is a
// plain string (current placeholder) it is used as the id adn if it becomes an object with
// a userId later, that is used instead
function notifyServed(servedClient, serviceName) {
  if (typeof fetch !== 'function') { return; } // guard for Node < 18
  const userId = (servedClient && typeof servedClient === 'object')
    ? servedClient.userId
    : servedClient;
  if (!(userId !== undefined && userId !== null)) { return; }

  fetch('http://localhost:3001/api/notifications/served', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: String(userId), serviceName: serviceName })
  }).catch(() => { /* notification service unreachable — ignore */ });
}

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
    const { service_id } = data || {};
    const service = Services_Container.find(s => String(s.service_id) === String(service_id));

    if (service && service.Queue_Array.length > 0) 
    {
      const servedClient = service.Queue_Array.shift();
      service.queue_length = service.Queue_Array.length;
      io.emit('queue_updated', Services_Container);

      notifyServed(servedClient, service.name);
    }
  });

  // ADMIN ACTION: Remove specific client or first client
  socket.on('remove_client', (data) => {
    const { service_id, client_index } = data || {};
    const service = Services_Container.find(s => String(s.service_id) === String(service_id));

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
    const { service_id, updated_queue } = data || {};
    const service = Services_Container.find(s => String(s.service_id) === String(service_id));

    if (service && Array.isArray(updated_queue)) 
    {
      service.Queue_Array = updated_queue;
      service.queue_length = service.Queue_Array.length;
      io.emit('queue_updated', Services_Container);
    }
  });

  // USER ACTION: Join Queue voluntarily
  socket.on('join_queue', (data) => {
    const { service_id, client_name } = data || {};
    const service = Services_Container.find(s => String(s.service_id) === String(service_id));

    if (service && client_name) 
    {
      service.Queue_Array.push(client_name);
      service.queue_length = service.Queue_Array.length;
      io.emit('queue_updated', Services_Container);
    }
  });

  // USER ACTION: Leave Queue voluntarily
  socket.on('leave_queue', (data) => {
    const { service_id, client_name } = data || {};
    const service = Services_Container.find(s => String(s.service_id) === String(service_id));
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
async function startServer(port = 3000) {
  Services_Container = await Container_Initializer();
  return server.listen(port, () => {
    console.log(`AdminBackend (HTTP + WebSockets) listening on port ${port}`);
  });
}

// Automatically start if executed directly via Node (`node AdminBackend.js`)
/* istanbul ignore next*/
if (require.main === module) {  startServer(3000);  }

// Export for Jest testing
module.exports = { app, server, io, startServer, Service_Entry, Container_Initializer, Status_Changer };