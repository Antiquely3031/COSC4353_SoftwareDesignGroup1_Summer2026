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