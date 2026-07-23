//  Startup
document.addEventListener("ServicesRendered", () => {
    // Service List
    const Button_List = document.querySelectorAll('.scroll-list-box ul li');

    Button_List.forEach((li, index) => {
        const Button = li.querySelector('button');
        Button.onclick = function() {Service_Selected(Button);};
    });

    // Form quieter
    const Queue_Form = document.querySelector('form');
    Queue_Form.addEventListener('submit', (event) => {event.preventDefault();});
});

// Functions
function Service_Selected(Service_Button) 
{
    const Text_Field = document.getElementById('name-field');
    const Service_Name = Service_Button.textContent.trim();
    Text_Field.value = Service_Name;
}