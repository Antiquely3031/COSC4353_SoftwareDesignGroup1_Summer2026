// Startup
    // Buttons
    const Action_Buttons = document.querySelectorAll('#action-buttons button');

    Action_Buttons.forEach(button => {button.addEventListener("click", Service_Status_Change)});

    // Getting and setting up the service list
    const Service_List = document.querySelector('.scroll-list-box ul');

    for (let index = 1; index <= 30; index++) 
    {
        // Variables
        const Index_li = document.createElement('li');
        const Name = `Placeholder ${index}`;

        // Shorthands
        const Button_Class = `button-feedback`;
        const Button_Id = `Button-Service-${Name}`;
        const Calling_Function = `Service_Selected(this)`;
        const Button_Parts = [
            `<button type="button" class="${Button_Class}" id="${Button_Id}" onclick="${Calling_Function}">`, 
            `</button>`
        ];

        // Assembly
        Index_li.innerHTML = `${Button_Parts[0]}<p>${Name}</p><p>NaN</p>${Button_Parts[1]}`;
        Service_List.appendChild(Index_li);
    }

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
    SCB_Status.textContent = Service_Details[1];
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

    //Core
    if (Service_Name === "Select Service") {return;}

    const Listed_Service = document.getElementById(`Button-Service-${Service_Name}`);
    const LS_Status = Listed_Service.querySelector('p:nth-child(2)');
    
    LS_Status.textContent = Service_Status;
    SCB_Status.textContent = Service_Status;
}