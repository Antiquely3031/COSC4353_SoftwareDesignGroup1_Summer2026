//  Startup
document.addEventListener("ServicesRendered", () => {
    // Service List
    const Services = event.detail.services;
    const Button_List = document.querySelectorAll('.scroll-list-box ul li');

    Button_List.forEach((li, index) => {
        const Button = li.querySelector('button');
        Button.onclick = function() {Service_Selected(Button, Services[index]);};
    });

    // Form quieter
    const Queue_Form = document.querySelector('form');
    Queue_Form.addEventListener('submit', (event) => {event.preventDefault();});

    // Action Buttons
    const Create_Button = document.getElementById('ABATSSB-create');
    const Save_Button = document.getElementById('ABATSSB-save');
    const Delete_Button = document.getElementById('ABATSSB-delete');
    const Deselect_Button = document.getElementById('AB-Deselect');

    Create_Button.addEventListener('click', () => Handle_Service_Action('POST'));
    Save_Button.addEventListener('click', () => Handle_Service_Action('PUT'));
    Delete_Button.addEventListener('click', Handle_Service_Delete);
    Deselect_Button.addEventListener('click', Clear_Form_Fields);
});

// Functions

function Service_Selected(Service_Button, service) 
{
    const Text_Field = document.getElementById('name-field');
    const Service_Name = Service_Button.textContent.trim();
    Text_Field.value = Service_Name;

    const Description_Field = document.querySelector('textarea');
    const Service_Desc = service.description;
    Description_Field.value = Service_Desc;

    const Time_Field = document.getElementById('expection-time-field');
    const Service_Time = service.expected_duration;
    Time_Field.value = Service_Time;

    const Priority_Radios = [...document.querySelectorAll('input[type="radio"]')];
    const Service = service.priority;
    switch(Service) 
    {
        case 1: Priority_Radios[0].checked = true; break;
        case 2: Priority_Radios[1].checked = true; break;
        case 3: Priority_Radios[2].checked = true; break;
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

    sortedServices.forEach((service) => {
        const li = document.createElement('li');
        const button = document.createElement('button');

        button.type = 'button';
        button.textContent = service.name;

        button.onclick = () => Service_Selected(button, service);

        li.appendChild(button);
        Scroll_Box_UL.appendChild(li);
    });
}

function Get_Selected_Priority() 
{
    const Priority_Radios = [...document.querySelectorAll('input[name="priority-status"]')];

    for(let index = 0; index < 3; index++) {    if(Priority_Radios[index]?.checked) {return index + 1;}    }
    
    return 1;
}

// Send Create (POST) or Save (PUT) actions
async function Handle_Service_Action(method) 
{
    const name = document.getElementById('name-field').value.trim();
    const description = document.getElementById('description-box').value.trim();
    const expected_duration = document.getElementById('expection-time-field').value;
    const priority = Get_Selected_Priority();

    if (!(name && description)) return;

    try 
    {
        const response = await fetch('http://localhost:3000/api/admin/services', 
        {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, expected_duration, priority })
        });

        if (response.ok) {
            const data = await response.json();
            // Re-fetch or update list in place if needed
            Refresh_Services_In_Place();
        } else {    console.error(`Failed to ${method} service:`, response.statusText);     }
    } catch (error) {    console.error('Network error modifying service:', error);      }
}

// Send Delete (DELETE) action
async function Handle_Service_Delete() 
{
    const name = document.getElementById('name-field').value.trim();
    if (!name) return;

    try 
    {
        const response = await fetch(`http://localhost:3000/api/admin/services/${encodeURIComponent(name)}`, 
        {    method: 'DELETE'   });

        if (response.ok) 
        {
            Clear_Form_Fields();
            Refresh_Services_In_Place();
        } else {    console.error('Failed to delete service:', response.statusText);    }
    } catch (error) {    console.error('Network error deleting service:', error);    }
}

// Re-fetch services from backend and update DOM smoothly
async function Refresh_Services_In_Place() 
{
    try 
    {
        const res = await fetch('http://localhost:3000/api/admin/services');
        const services = await res.json();
        Render_Service_List(services);
    } catch (err) {    console.error('Error refreshing service list:', err);    }
}

// Reset form inputs
function Clear_Form_Fields() {    document.getElementById('service-detial-form').reset();     }