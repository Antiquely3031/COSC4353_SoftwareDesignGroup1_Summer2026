let currentSelectedServiceId = null;
let globalServicesState = [];

// Startup
document.addEventListener("ServicesRendered", (event) => 
{
    // Service List
    globalServicesState = event.detail.services;
    Render_Service_List(globalServicesState);

    // Form quieter
    const Queue_Form = document.querySelector('form');
    if (Queue_Form) 
    {
        Queue_Form.addEventListener('submit', (e) => { e.preventDefault(); });
    }

    // Action Buttons
    const Create_Button = document.getElementById('ABATSSB-create');
    const Save_Button = document.getElementById('ABATSSB-save');
    const Delete_Button = document.getElementById('ABATSSB-delete');
    const Deselect_Button = document.getElementById('AB-Deselect');

    if (Create_Button) Create_Button.addEventListener('click', () => Handle_Service_Action('POST'));
    if (Save_Button) Save_Button.addEventListener('click', () => Handle_Service_Action('PUT'));
    if (Delete_Button) Delete_Button.addEventListener('click', Handle_Service_Delete);
    if (Deselect_Button) Deselect_Button.addEventListener('click', Clear_Form_Fields);
});

// WebSocket Real-time Event Listener
if (typeof io !== 'undefined') 
{
    const socket = io('http://localhost:3000');

    socket.on('queue_updated', (updatedServices) => 
    {
        globalServicesState = updatedServices;
        Render_Service_List(globalServicesState);
    });
}

// Functions

function Service_Selected(Service_Button, service) 
{
    if (!service) return;

    currentSelectedServiceId = service.service_id;

    const Text_Field = document.getElementById('name-field');
    if (Text_Field) Text_Field.value = service.name;

    const Description_Field = document.querySelector('textarea');
    if (Description_Field) Description_Field.value = service.description;

    const Time_Field = document.getElementById('expection-time-field');
    if (Time_Field) Time_Field.value = service.expected_duration;

    const Priority_Radios = [...document.querySelectorAll('input[name="priority-status"]')];
    if (Priority_Radios.length >= 3) 
    {
        switch(service.priority) 
        {
            case 1: Priority_Radios[0].checked = true; break;
            case 2: Priority_Radios[1].checked = true; break;
            case 3: Priority_Radios[2].checked = true; break;
        }
    }
}

// Renders list without reloading
function Render_Service_List(Services) 
{
    const Scroll_Box_UL = document.querySelector('.scroll-list-box ul');
    if (!Scroll_Box_UL) return;

    Scroll_Box_UL.innerHTML = ''; // Smooth in-place DOM clear

    // Ensure list is sorted High to Low (3 -> 2 -> 1)
    const sortedServices = [...Services].sort((a, b) => b.priority - a.priority);

    let selectedServiceStillExists = false;
    let freshSelectedService = null;

    sortedServices.forEach((service) => 
    {
        const li = document.createElement('li');
        const button = document.createElement('button');

        button.type = 'button';
        button.textContent = service.name;
        button.dataset.serviceId = service.service_id;

        button.onclick = () => Service_Selected(button, service);

        li.appendChild(button);
        Scroll_Box_UL.appendChild(li);

        // Fixed variable name check (currentSelectedServiceId instead of currentSelectedId)
        if (currentSelectedServiceId && String(service.service_id) === String(currentSelectedServiceId)) 
        {
            selectedServiceStillExists = true;
            freshSelectedService = service;
        }
    });

    // Refresh active form input fields if selected service was updated remotely
    if (selectedServiceStillExists && freshSelectedService) 
    {
        const Selected_Button = document.querySelector(`button[data-service-id="${freshSelectedService.service_id}"]`);
        Service_Selected(Selected_Button, freshSelectedService);
    } 
    else if (currentSelectedServiceId && !selectedServiceStillExists) 
    {
        // Clear inputs if selected service was deleted by another admin
        Clear_Form_Fields();
    }
}

function Get_Selected_Priority() 
{
    const Priority_Radios = [...document.querySelectorAll('input[name="priority-status"]')];

    for(let index = 0; index < 3; index++) if(Priority_Radios[index]?.checked) return index + 1;
    
    return 2;
}

// Send Create (POST) or Save (PUT) actions
async function Handle_Service_Action(method) 
{
    const name = document.getElementById('name-field').value.trim();
    const description = document.querySelector('textarea').value.trim();
    const expected_duration = document.getElementById('expection-time-field').value;
    const priority = Get_Selected_Priority();

    if (!(name && description)) return;

    const payload = { name, description, expected_duration, priority };
    if (method === 'PUT') 
    {
        if (!currentSelectedServiceId) return;
        payload.service_id = currentSelectedServiceId;
    }

    try 
    {
        const response = await fetch('http://localhost:3000/api/admin/services', 
        {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) Clear_Form_Fields();
        else console.error(`Failed to ${method} service:`, response.statusText); 
    } 
    catch (error) {    console.error('Network error modifying service:', error);     }
}

// Send Delete (DELETE) action
async function Handle_Service_Delete() 
{
    if (!currentSelectedServiceId) return;

    try 
    {
        const response = await fetch(`http://localhost:3000/api/admin/services/${encodeURIComponent(currentSelectedServiceId)}`, 
        { method: 'DELETE' });

        if (response.ok) Clear_Form_Fields();
        else console.error('Failed to delete service:', response.statusText);
    } 
    catch (error) {    console.error('Network error deleting service:', error);    }
}

// Reset form inputs
function Clear_Form_Fields() 
{ 
    currentSelectedServiceId = null;
    const form = document.getElementById('service-detial-form');
    if (form) form.reset(); 
}