// Global State Tracker for real-time Socket syncing
let globalServicesState = [];

// Startup
document.addEventListener("ServicesRendered", (event) => 
{
  // Buttons
  const Action_Buttons = document.querySelectorAll('#action-buttons button');
  Action_Buttons.forEach(button => 
  {
    button.addEventListener("click", Service_Status_Change);
  });

  // Service List
  globalServicesState = event.detail.services;
  Render_Dashboard_Services(globalServicesState);
});

// Render/Re-render helper function for DOM state synchronization
function Render_Dashboard_Services(Services)
{
  const List_Container = document.querySelector('.scroll-list-box ul');
  if (!List_Container) return;

  // Preserve currently selected service ID
  const SCB_Box = document.getElementById('selected-service-card') || document.body;
  const currentSelectedId = SCB_Box.dataset.selectedServiceId;

  List_Container.innerHTML = '';

  let currentlySelectedService = null;

  Services.forEach((service) => 
  {
    const li = document.createElement('li');
    const Button = document.createElement('button');

    Button.dataset.serviceId = service.service_id;

    const Queue_Length_Count = service.queue_length;
    const Status = service.operation_status;

    Button.innerHTML = `<p>${service.name}</p><p>${Queue_Length_Count}</p><p>${Status}</p>`;
    Button.onclick = function() 
    {
      Service_Selected(Button, service);
    };

    li.appendChild(Button);
    List_Container.appendChild(li);

    // Check if this item is the currently selected service
    if (currentSelectedId && String(service.service_id) === String(currentSelectedId))
    {
      currentlySelectedService = service;
    }
  });

  // If the user had a service selected, update their Actions card with the NEW fresh data from socket
  if (currentlySelectedService)
  {
    const Selected_Button = document.querySelector(`button[data-service-id="${currentlySelectedService.service_id}"]`);
    Service_Selected(Selected_Button, currentlySelectedService);
  }
  else if (currentSelectedId)
  {
    // If it was selected before but no longer exists in the incoming array (e.g., deleted), reset panel
    Reset_Selection_Panel();
  }
}

// Reset selection panel helper
function Reset_Selection_Panel()
{
  const SCB_Name = document.getElementById('SCB-Name');
  const SCB_Status = document.getElementById('SCB-Status');
  const SCB_Box = document.getElementById('selected-service-card') || document.body;

  if (SCB_Name) SCB_Name.textContent = "Select Service";
  if (SCB_Status) SCB_Status.textContent = "NaN";
  delete SCB_Box.dataset.selectedServiceId;
}

// WebSocket Live Sync Listener
if (typeof io !== 'undefined')
{
  const socket = io('http://localhost:4000');

  socket.on('queue_updated', (updatedServices) => 
  {
    globalServicesState = updatedServices;
    Render_Dashboard_Services(globalServicesState);
  });
}

// Functions
function Service_Selected(Service_Button, service) 
{
  if (!service) return;

  // Variables
  const SCB_Name = document.getElementById('SCB-Name');
  const SCB_Status = document.getElementById('SCB-Status');

  // Store selected service_id on container dataset
  const SCB_Box = document.getElementById('selected-service-card') || document.body;
  SCB_Box.dataset.selectedServiceId = service.service_id;

  // Modifications
  if (SCB_Name) SCB_Name.textContent = service.name;
  if (SCB_Status) SCB_Status.textContent = service.operation_status;
}

async function Operation_Status_Sender(service_id, status) 
{
  try 
  {
    const response = await fetch('http://localhost:4000/api/admin/services/status', 
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        service_id: service_id,
        status: status
      })
    });

    if (!response.ok) console.error('Failed to update status on server:', response.statusText);
  } 
  catch (error) {  console.error('Network error updating operation status:', error);  }
}

function Service_Status_Change(Action_Button) 
{
  // Startup Variables
  const SCB_Name = document.getElementById('SCB-Name');
  const SCB_Status = document.getElementById('SCB-Status');

  const SCB_Box = document.getElementById('selected-service-card') || document.body;
  const Service_Id = SCB_Box.dataset.selectedServiceId;
  let Service_Status = Action_Button.target.textContent.trim().toLowerCase();

  // Checks
  if (!Service_Id) return;
  
  if (Service_Status === "deselect") 
  {
    Reset_Selection_Panel();
    return;
  }

  if (Service_Status === 'close') Service_Status = 'closed';

  // Send to the Backend - Server will broadcast via WebSocket and re-render both screens automatically!
  Operation_Status_Sender(Service_Id, Service_Status);
}