// Startup
    document.addEventListener("ServicesRendered", () => {
        // Buttons
        const Action_Buttons = document.querySelectorAll('#action-buttons button');
        Action_Buttons.forEach(button => {button.addEventListener("click", Service_Status_Change)});

        // Service List
        const Services = event.detail.services;
        const Button_List = document.querySelectorAll('.scroll-list-box ul li');

        Button_List.forEach((li, index) => {
            const Button = li.querySelector('button');

            // Require Information
            const Queue_Length_Count = Services[index].queue_length;
            const Status = Services[index].operation_status;

            // Modifications
            Button.innerHTML += `<p>${Queue_Length_Count}</p><p>${Status}</p>`;
            Button.onclick = function() {Service_Selected(Button);};
        });
    });

// Functions

function Service_Selected(Service_Button) 
{
    // Variabels
        // Externals
        const SCB_Name = document.getElementById('SCB-Name');
        const SCB_Status = document.getElementById('SCB-Status');

        // Interal
        let Service_Details = Service_Button.querySelectorAll('p');
        Service_Details = [...Service_Details].map(p => p.textContent.trim());

    // Modifications
    SCB_Name.textContent = Service_Details[0];
    SCB_Status.textContent = Service_Details[2];
}

async function Operation_Status_Sender(service_name, status) 
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
                name: service_name,
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
    // Startup Variabels
        // Source
        const SCB_Name = document.getElementById('SCB-Name');
        const SCB_Status = document.getElementById('SCB-Status');

        // Text
        const Service_Name = SCB_Name.textContent;
        const Service_Status = Action_Button.target.textContent.trim();

    // Checks
    if (!(Service_Name !== "Select Service" && Service_Status !== SCB_Status.textContent.trim())) {return;}
    if (Service_Status === "Deselect") 
    {
        // Alter Modifictions
        SCB_Name.textContent = "Select Service";
        SCB_Status.textContent = "NaN";
        return;
    }

    // Send to the Backend
    Operation_Status_Sender(Service_Name, Service_Status);
    
    // Modifications
    const Listed_Service = document.getElementById(`Button-Service-${Service_Name}`);
    const LS_Status = Listed_Service.querySelector('p:nth-child(3)');
    
    LS_Status.textContent = Service_Status;
    SCB_Status.textContent = Service_Status;
}