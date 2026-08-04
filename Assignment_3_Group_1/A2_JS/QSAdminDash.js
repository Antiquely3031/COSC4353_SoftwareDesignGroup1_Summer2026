// Startup
document.addEventListener("ServicesRendered", (event) => {
    // Buttons
    const Action_Buttons = document.querySelectorAll('#action-buttons button');
    Action_Buttons.forEach(button => {button.addEventListener("click", Service_Status_Change)});

    // Service List
    const Services = event.detail.services;
    const Button_List = document.querySelectorAll('.scroll-list-box ul li');

    Button_List.forEach((li, index) => {
        const Button = li.querySelector('button');

        // Store ID attribute on element
        Button.dataset.serviceId = Services[index].service_id;

        // Require Information
        const Queue_Length_Count = Services[index].queue_length;
        const Status = Services[index].operation_status;

        // Modifications
        Button.innerHTML += `<p>${Queue_Length_Count}</p><p>${Status}</p>`;
        Button.onclick = function() { Service_Selected(Button, Services[index]); };
    });
});

// Functions

function Service_Selected(Service_Button, service) 
{
    // Variables
    const SCB_Name = document.getElementById('SCB-Name');
    const SCB_Status = document.getElementById('SCB-Status');

    // Store selected service_id on container dataset
    const SCB_Box = document.getElementById('selected-service-card') || document.body;
    SCB_Box.dataset.selectedServiceId = service.service_id;

    // Modifications
    SCB_Name.textContent = service.name;
    SCB_Status.textContent = service.operation_status;
}

async function Operation_Status_Sender(service_id, status) 
{
    try 
    {
        const response = await fetch('http://localhost:3000/api/admin/services/status', 
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

        if (!response.ok) 
        {
            console.error('Failed to update status on server:', response.statusText);
        }
    } catch (error) 
    {
        console.error('Network error updating operation status:', error);
    }
}

function Service_Status_Change(Action_Button) 
{
    // Startup Variables
    const SCB_Name = document.getElementById('SCB-Name');
    const SCB_Status = document.getElementById('SCB-Status');

    const SCB_Box = document.getElementById('selected-service-card') || document.body;
    const Service_Id = SCB_Box.dataset.selectedServiceId;
    const Service_Status = Action_Button.target.textContent.trim();

    // Checks
    if (!(Service_Id && Service_Status !== SCB_Status.textContent.trim())) { return; }
    if (Service_Status === "Deselect") 
    {
        // Alter Modifications
        SCB_Name.textContent = "Select Service";
        SCB_Status.textContent = "NaN";
        delete SCB_Box.dataset.selectedServiceId;
        return;
    }

    // Send to the Backend
    Operation_Status_Sender(Service_Id, Service_Status);
    
    // Modifications
    const Listed_Button = document.querySelector(`button[data-service-id="${Service_Id}"]`);
    if (Listed_Button) 
    {
        const LS_Status = Listed_Button.querySelector('p:nth-child(3)');
        if (LS_Status) LS_Status.textContent = Service_Status.toLowerCase();
    }
    SCB_Status.textContent = Service_Status.toLowerCase();
}