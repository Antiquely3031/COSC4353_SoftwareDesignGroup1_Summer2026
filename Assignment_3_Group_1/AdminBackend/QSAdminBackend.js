// I, Elvis Noel Trujillo Chairez, got the admin portion of the project as shown in assignment 2.
// This is just a placeholder for the repo; so that y'all can place your files without making a mess
// in the repo.

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const pool = require('../../Assignment_4_Group_1/QSAdminDB/QSAdminDBPool').default;

const app = express();
app.use(cors());
app.use(express.json());

// Create the unified HTTP server
const server = http.createServer(app);

// Attach WebSockets to the HTTP server
const io = new Server(server, { cors: { origin: "*" } });

class Service_Entry 
{
  Queue_Array = [];

  constructor(service_id, name, description, expected_duration, priority = 2, queue_length = 0, operation_status = 'open', queue_array = []) 
  {
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

function normalizeStatus(status) 
{
  const lower = String(status).toLowerCase().trim();
  if (lower === 'close' || lower === 'closed') return 'closed';
  return 'open';
}

async function Container_Initializer() 
{
  try 
  {
    const Initial_Gen_Reset_Key = false;
    if (Initial_Gen_Reset_Key) await pool.query('CALL Mock_Initialization_Generation(30);');

    const [rows] = await pool.query('SELECT * FROM vw_AdminServiceQueueState;');

    const Container = rows.map(row => 
    {
      let parsedQueue = [];
      if (typeof row.Queue_Array === 'string') 
      {
          try { parsedQueue = JSON.parse(row.Queue_Array); } 
          catch (e) { parsedQueue = []; }
      } 
      else if (Array.isArray(row.Queue_Array)) parsedQueue = row.Queue_Array;

      parsedQueue = parsedQueue.filter(item => item !== null);

      return new Service_Entry(
          row.service_id,
          row.name,
          row.description,
          Number(row.expected_duration),
          Number(row.priority) || 2,
          Number(row.queue_length),
          normalizeStatus(row.operation_status || 'open'),
          parsedQueue
      );
    });

    return sortServicesByPriority(Container);
  } 
  catch (error) 
  {
    console.error('Error executing DB initialization procedure or querying view:', error.message);
    return [];
  }
}

let Services_Container = [];

function validateServicePayload(payload) 
{
  const { name, description, expected_duration, priority } = payload || {};

  if (name === undefined || name === null || String(name).trim() === '') return { valid: false, error: 'Service Name is required.' };
  if (description === undefined || description === null || String(description).trim() === '') return { valid: false, error: 'Description is required.' };
  if (expected_duration === undefined || expected_duration === null || String(expected_duration).trim() === '') return { valid: false, error: 'Expected Duration is required.' };

  const nameStr = String(name).trim();
  if (nameStr.length > 100) return { valid: false, error: 'Service Name cannot exceed 100 characters.' };

  const parsedDuration = Number(expected_duration);
  if (isNaN(parsedDuration) || parsedDuration <= 0) return { valid: false, error: 'Expected Duration must be a positive number.' };

  let numericPriority = 2;
  let dbEnumPriority = 'Medium';
  
  if (priority !== undefined && priority !== null && String(priority).trim() !== '') 
  {
      const lowerPrio = String(priority).toLowerCase().trim();
      switch (lowerPrio) 
      {
          case 'low': case '1': numericPriority = 1; dbEnumPriority = 'Low'; break;
          case 'medium': case '2': numericPriority = 2; dbEnumPriority = 'Medium'; break;
          case 'high': case '3': numericPriority = 3; dbEnumPriority = 'High'; break;
          default: return { valid: false, error: 'Priority Level must be low, medium, or high.' };
      }
  }

  return {
    valid: true,
    data: {
      name: nameStr,
      description: String(description).trim(),
      expected_duration: parsedDuration,
      priority: numericPriority,
      dbPriority: dbEnumPriority
    }
  };
}

async function Status_Changer(service_id, new_status) 
{
    const targetService = Services_Container.find(s => String(s.service_id) === String(service_id));

    if (!targetService) return null;

    const formattedStatus = normalizeStatus(new_status);

    await pool.query('CALL Service_Status_UPDATE(?, ?);', [service_id, formattedStatus]);
    targetService.operation_status = formattedStatus;
    return targetService;
}

app.patch('/api/admin/services/status', async (req, res) => 
{
    const { service_id, status } = req.body;

    if (!(service_id && status)) return res.status(400).json({ error: 'Missing service_id or status in request body.' });

    try 
    {
      const updatedService = await Status_Changer(service_id, status);

      if (updatedService) 
      {
        io.emit('queue_updated', Services_Container);

        return res.status(200).json({
            message: 'Status updated successfully',
            service: updatedService
        });
      }

      return res.status(404).json({ error: 'Service not found.' });
    } 
    catch (error) {  return res.status(500).json({ error: error.message });  }
});

app.post('/api/admin/services', async (req, res) => 
{
  const validation = validateServicePayload(req.body);
  if (!validation.valid) return res.status(400).json({ error: validation.error });

  const { name, description, expected_duration, priority, dbPriority } = validation.data;

  const existingService = Services_Container.find(s => s.name === name);
  if (existingService) return res.status(409).json({ error: 'Service with this name already exists.' });

  try 
  {
    const [rows] = await pool.query('CALL INSERT_Service(?, ?, ?, ?);', [name, description, expected_duration, dbPriority]);
    const generatedId = rows[0][0].generated_id;

    const newService = new Service_Entry(
      generatedId,
      name,
      description,
      expected_duration,
      priority,
      0
    );

    let insertIndex = Services_Container.findIndex(s => s.priority < priority);

    if (insertIndex === -1) Services_Container.push(newService);
    else Services_Container.splice(insertIndex, 0, newService);

    io.emit('queue_updated', Services_Container);

    return res.status(201).json({ message: 'Service created successfully', service: newService });
  } 
  catch (error) 
  {
    return res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/services', async (req, res) => 
{
  const { service_id } = req.body;
  if (!service_id) return res.status(400).json({ error: 'service_id is required.' });

  const validation = validateServicePayload(req.body);
  if (!validation.valid) return res.status(400).json({ error: validation.error });

  const { name, description, expected_duration, priority, dbPriority } = validation.data;

  const existingIndex = Services_Container.findIndex(s => String(s.service_id) === String(service_id));
  if (existingIndex === -1) return res.status(404).json({ error: 'Service not found.' });

  try 
  {
    await pool.query('CALL UPDATE_Service(?, ?, ?, ?, ?);', [service_id, name, description, expected_duration, dbPriority]);

    const targetService = Services_Container[existingIndex];
    targetService.name = name;
    targetService.description = description;
    targetService.expected_duration = expected_duration;
    targetService.priority = priority;

    // Remove from current position and re-insert at the bottom of its target priority group
    Services_Container.splice(existingIndex, 1);

    let targetIndex = Services_Container.findIndex(s => s.priority < priority);
    if (targetIndex === -1) Services_Container.push(targetService);
    else Services_Container.splice(targetIndex, 0, targetService);

    io.emit('queue_updated', Services_Container);

    return res.status(200).json({ message: 'Service updated successfully', service: targetService });
  } 
  catch (error) {  return res.status(500).json({ error: error.message });  }
});

app.delete('/api/admin/services/:id', async (req, res) => 
{
  const serviceId = req.params.id;

  const index = Services_Container.findIndex(s => String(s.service_id) === String(serviceId));
  if (index === -1) return res.status(404).json({ error: 'Service not found.' });

  try 
  {
    await pool.query('CALL DELETE_Service(?);', [serviceId]);

    Services_Container.splice(index, 1);

    io.emit('queue_updated', Services_Container);

    return res.status(200).json({ message: 'Service deleted successfully' });
  } 
  catch (error) {  return res.status(500).json({ error: error.message });  }
});

app.get('/api/admin/services', (req, res) => {  res.status(200).json(Services_Container);  });

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

io.on('connection', (socket) => 
{
  console.log('Client connected to Queue WS:', socket.id);

  socket.emit('queue_updated', Services_Container);

  socket.on('disconnect', (reason) => 
  {
      console.log(`Client disconnected from Queue WS (${socket.id}). Reason: ${reason}`);
  });

  socket.on('serve_client', (data) => 
  {
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

  socket.on('remove_client', (data) => 
  {
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

  socket.on('reorder_queue', (data) => 
  {
    const { service_id, updated_queue } = data || {};
    const service = Services_Container.find(s => String(s.service_id) === String(service_id));

    if (service && Array.isArray(updated_queue)) 
    {
      service.Queue_Array = updated_queue;
      service.queue_length = service.Queue_Array.length;
      io.emit('queue_updated', Services_Container);
    }
  });

  socket.on('join_queue', (data) => 
  {
    const { service_id, client_name } = data || {};
    const service = Services_Container.find(s => String(s.service_id) === String(service_id));

    if (service && client_name) 
    {
      service.Queue_Array.push(client_name);
      service.queue_length = service.Queue_Array.length;
      io.emit('queue_updated', Services_Container);
    }
  });

  socket.on('leave_queue', (data) => 
  {
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

async function startServer(port = 3000) 
{
  Services_Container = await Container_Initializer();
  return server.listen(port, () => 
  {
    console.log(`AdminBackend (HTTP + WebSockets) listening on port ${port}`);
  });
}

if (require.main === module) startServer(3000);

module.exports = { app, server, io, startServer, Service_Entry, Container_Initializer, Status_Changer };