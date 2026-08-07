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

// Create the unified HTTP server for ADMIN operations (REST + Admin WS)
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Create a completely separate HTTP server instance for USER-side SSE traffic
const userApp = express();
userApp.use(cors());
userApp.use(express.json());
const userServer = http.createServer(userApp);

// Array to track open SSE client streams
let userClients = [];

class Queue_Entry 
{
  constructor(queue_entry_id, user_id, user_name, position, line_status, join_time) 
  {
    this.queue_entry_id = queue_entry_id;
    this.user_id = user_id;
    this.user_name = user_name;
    this.position = position;
    this.line_status = line_status;
    this.join_time = join_time;
  }
}

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
    /* istanbul ignore if */
    if (Initial_Gen_Reset_Key) await pool.query('CALL Mock_Initialization_Generation(30);');

    const [rows] = await pool.query('SELECT * FROM vw_AdminServiceQueueState;');

    const Container = rows.map(row => 
    {
      let parsedQueue = [];
      if (typeof row.Queue_Array === 'string') 
      {
          try { parsedQueue = JSON.parse(row.Queue_Array); } 
          /* istanbul ignore next */
          catch (e) { parsedQueue = []; }
      } 
      /* istanbul ignore next */
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
          /* istanbul ignore next */
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

// Helper to broadcast synchronization changes to Admin WebSockets and User SSE streams simultaneously
function broadcastQueueUpdate()
{
  io.emit('queue_updated', Services_Container);
  
  const stringifiedData = JSON.stringify(Services_Container);
  userClients.forEach(client => {  client.res.write(`data: ${stringifiedData}\n\n`);  });
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
        broadcastQueueUpdate();

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

    broadcastQueueUpdate();

    return res.status(201).json({ message: 'Service created successfully', service: newService });
  } 
  catch (error) {  return res.status(500).json({ error: error.message });  }
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

    broadcastQueueUpdate();

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

    broadcastQueueUpdate();

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
  /* istanbul ignore next */
  if (typeof fetch !== 'function') { return; } 
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

// -------------------------------------------------------------
// CONNECTION HUB 1: ADMIN WEB-SOCKET PORT (Privileged Scope)
// -------------------------------------------------------------
io.on('connection', (socket) => 
{
  console.log('Admin connected to Queue WS:', socket.id);

  socket.emit('queue_updated', Services_Container);

  socket.on('disconnect', (reason) => 
  {
      console.log(`Admin disconnected from Queue WS (${socket.id}). Reason: ${reason}`);
  });

  socket.on('serve_client', async (data) => 
  {
    const { service_id, queue_entry_id } = data || {};
    const service = Services_Container.find(s => String(s.service_id) === String(service_id));

    if (service && service.Queue_Array.length > 0) 
    {
      let servedClient = null;
      let targetIndex = -1;

      if (queue_entry_id !== undefined && queue_entry_id !== null)
      {
        targetIndex = service.Queue_Array.findIndex(item => item && String(item.queue_entry_id) === String(queue_entry_id));
      }
      else targetIndex = 0;

      if (targetIndex !== -1)
      {
        servedClient = service.Queue_Array.splice(targetIndex, 1)[0];

        // Recalculate positions for remaining entries sequentially in memory and database
        try 
        {
          for (let i = 0; i < service.Queue_Array.length; i++) 
          {
            const entry = service.Queue_Array[i];
            if (entry && entry.queue_entry_id) 
            {
              entry.position = i + 1;
              await pool.query('CALL UPDATE_Queue_Entry(?, ?, ?);', [
                entry.queue_entry_id, 
                entry.position, 
                entry.line_status || 'waiting'
              ]);
            }
          }
        } 
        catch (dbErr) 
        {
          console.error('Failed to shift remaining queue entry positions after serving:', dbErr.message);
        }

        service.queue_length = service.Queue_Array.length;
        broadcastQueueUpdate();

        const notifyPayload = (servedClient && servedClient.user_id) ? servedClient.user_id : servedClient;
        notifyServed(notifyPayload, service.name);

        // Persist serving state changes in database safely preserving historical context
        if (servedClient && servedClient.queue_entry_id)
        {
          try 
          {
            await pool.query('CALL UPDATE_Queue_Entry(?, ?, ?);', [
              servedClient.queue_entry_id, 
              servedClient.position || 1, 
              'served'
            ]);
          } 
          catch (dbErr) 
          {
            console.error('Failed to persist served client status to database:', dbErr.message);
          }
        }
      }
    }
  });

  socket.on('remove_client', async (data) => 
  {
    const { service_id, queue_entry_id } = data || {};
    const service = Services_Container.find(s => String(s.service_id) === String(service_id));

    if (service && service.Queue_Array.length > 0) 
    {
      let targetIndex = -1;

      if (queue_entry_id !== undefined && queue_entry_id !== null)
      {
        targetIndex = service.Queue_Array.findIndex(item => item && String(item.queue_entry_id) === String(queue_entry_id));
      }
      else targetIndex = 0;

      if (targetIndex !== -1)
      {
        const removedClient = service.Queue_Array.splice(targetIndex, 1)[0];

        // Recalculate positions for remaining entries sequentially in memory and database
        try 
        {
          for (let i = 0; i < service.Queue_Array.length; i++) 
          {
            const entry = service.Queue_Array[i];
            if (entry && entry.queue_entry_id) 
            {
              entry.position = i + 1;
              await pool.query('CALL UPDATE_Queue_Entry(?, ?, ?);', [
                entry.queue_entry_id, 
                entry.position, 
                entry.line_status || 'waiting'
              ]);
            }
          }
        } 
        catch (dbErr) 
        {
          console.error('Failed to shift remaining queue entry positions after removal:', dbErr.message);
        }

        service.queue_length = service.Queue_Array.length;
        broadcastQueueUpdate();

        // Persist removal in database safely preserving historical context
        if (removedClient && removedClient.queue_entry_id)
        {
          try 
          {
            await pool.query('CALL UPDATE_Queue_Entry(?, ?, ?);', [
              removedClient.queue_entry_id, 
              removedClient.position || 1, 
              'canceled'
            ]);
          } 
          catch (dbErr) 
          {
            console.error('Failed to persist client removal to database:', dbErr.message);
          }
        }
      }
    }
  });

  socket.on('reorder_queue', async (data) => 
  {
    const { service_id, updated_queue } = data || {};
    const service = Services_Container.find(s => String(s.service_id) === String(service_id));

    if (service && Array.isArray(updated_queue)) 
    {
      service.Queue_Array = updated_queue;
      service.queue_length = service.Queue_Array.length;

      // Update positions for each entry sequentially in DB
      try 
      {
        for (let i = 0; i < service.Queue_Array.length; i++) 
        {
          const entry = service.Queue_Array[i];
          if (entry && entry.queue_entry_id) 
          {
            entry.position = i + 1;
            await pool.query('CALL UPDATE_Queue_Entry(?, ?, ?);', [entry.queue_entry_id, entry.position, 'waiting']);
          }
        }
      } 
      catch (dbErr) 
      {
        console.error('Failed to persist queue reordering to database:', dbErr.message);
      }

      broadcastQueueUpdate();
    }
  });
});

// -------------------------------------------------------------
// CONNECTION HUB 2: USER SERVER-SENT EVENTS ROUTER (Public Scope)
// -------------------------------------------------------------
userApp.get('/api/users/queue/stream', (req, res) => 
{
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  userClients.push(newClient);

  console.log(`Public User stream connected via SSE. Stream Count: ${userClients.length}`);

  // Push instant baseline state upon connection
  res.write(`data: ${JSON.stringify(Services_Container)}\n\n`);

  req.on('close', () => 
  {
    userClients = userClients.filter(client => client.id !== clientId);
    console.log(`Public User stream disconnected from SSE. Stream Count: ${userClients.length}`);
  });
});

userApp.post('/api/users/queue/join', (req, res) => 
{
  const { service_id, client_entry } = req.body || {};
  const service = Services_Container.find(s => String(s.service_id) === String(service_id));

  if (!service) return res.status(404).json({ error: 'Service target not found.' });
  if (!client_entry) return res.status(400).json({ error: 'Missing client entry data.' });

  service.Queue_Array.push(client_entry);
  service.queue_length = service.Queue_Array.length;
  broadcastQueueUpdate();

  return res.status(200).json({ message: 'Joined successfully.' });
});

userApp.post('/api/users/queue/leave', (req, res) => 
{
  const { service_id, queue_entry_id } = req.body || {};
  const service = Services_Container.find(s => String(s.service_id) === String(service_id));
  
  if (!service) return res.status(404).json({ error: 'Service target not found.' });
  if (queue_entry_id === undefined || queue_entry_id === null) return res.status(400).json({ error: 'Missing queue entry identifier.' });

  const index = service.Queue_Array.findIndex(item => item && String(item.queue_entry_id) === String(queue_entry_id));

  /* istanbul ignore else */
  if (index !== -1) 
  {
    service.Queue_Array.splice(index, 1);
    service.queue_length = service.Queue_Array.length;
    broadcastQueueUpdate();
    return res.status(200).json({ message: 'Left queue successfully.' });
  }

  return res.status(404).json({ error: 'Queue entry not found within service.' });
});

async function startServer(adminPort = 3000, userPort = 3005) 
{
  Services_Container = await Container_Initializer();
  
  // Start the User listener channel
  userServer.listen(userPort, () => {
    console.log(`User Queue SSE Event stream listening on port ${userPort}`);
  });

  // Start the Admin listener channel
  return server.listen(adminPort, () => 
  {
    console.log(`AdminBackend (HTTP + WebSockets) listening on port ${adminPort}`);
  });
}

/* istanbul ignore next */
if (require.main === module) startServer(3000, 3005);

module.exports = { 
  app, server, userServer, io, userApp, 
  startServer, 
  Service_Entry, Queue_Entry, 
  Container_Initializer, 
  Status_Changer 
};