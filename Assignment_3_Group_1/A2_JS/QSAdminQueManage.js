//  Startup
document.addEventListener("ServicesRendered", () => {
    // Target the list items already produced by Admin.js
    const Button_List = document.querySelectorAll('.scroll-list-box ul li');

    Button_List.forEach((li, index) => {
        const Button = li.querySelector('button');
        Button.onclick = function() {Queue_List_Loaded(Button);};
    });

    Queue_List_Loaded(null);

    // Buttons
    const Serve_Button_Serve= document.getElementById('SIAB-serve');
    const Serve_Button_Remove = document.getElementById('SIAB-remove');
    const Serve_Button_Deselect = document.getElementById('AB-Deselect');
    
    Serve_Button_Serve.addEventListener('click', Serve_Next_Client);
    Serve_Button_Deselect.addEventListener('click', Deselect_Queue);
    Serve_Button_Remove.addEventListener('click', Remove_Client);
});

// Functions
function Deselect_Queue() 
{
    const Title_Box = document.querySelector('.SLB-Title p:nth-child(2)');
    Title_Box.textContent = "Select Service";

    const Service_List = document.querySelector('.queue-list-box ul');
    Service_List.innerHTML = "";
    Update_Upcoming_Client();
}

function Removing_First_Client() 
{
    const First_Queue_Item = document.querySelector('.queue-list-box ul li');
    
    if (First_Queue_Item) 
    {
        First_Queue_Item.remove();
        Update_Upcoming_Client();
    }
}

function Remove_Client() 
{
    Removing_First_Client();
}

function Serve_Next_Client() 
{
    Removing_First_Client();
}

function Update_Upcoming_Client() 
{
    const Display_Target = document.getElementById('next-client-display');
    const First_Client_Paragraph = document.querySelector('.queue-list-box ul li p');

    if (Display_Target) 
    {
        if (First_Client_Paragraph) {Display_Target.textContent = First_Client_Paragraph.textContent.trim();}
        else {Display_Target.textContent = "None";}
    }
}

function Queue_List_Loaded(Service_Button) 
{
    // The title
    if (Service_Button) 
    {
        const Service_Name = Service_Button.textContent.trim();
        const Title_Box = document.querySelector('.SLB-Title p:nth-child(2)');

        Title_Box.textContent = Service_Name;
    }

    // Queue List Box
    const Service_List = document.querySelector('.queue-list-box ul');
    Service_List.innerHTML = "";

    for (let index = 1; index <= 30; index++) 
    {
        const Index_li = document.createElement('li');
        const Name = `Placeholder ${index}`;

        // Add the sorting attributes directly during item template construction
        Index_li.setAttribute('draggable', 'true');
        Index_li.classList.add('sortable-item');
        
        Index_li.innerHTML = `<p>${Name}</p>`;
        Service_List.appendChild(Index_li);
    }

    // Initialize the Drag & Drop Event Handlers
    Enable_Queue_Sorting(Service_List);

    Update_Upcoming_Client();
}

function Enable_Queue_Sorting(List_Element) 
{
    let draggingItem = null;

    List_Element.addEventListener('dragstart', (event) => {
        draggingItem = event.target.closest('.sortable-item');
        if (draggingItem) {draggingItem.classList.add('dragging');}
    });

    List_Element.addEventListener('dragend', (event) => {
        const targetItem = event.target.closest('.sortable-item');

        if (targetItem) {targetItem.classList.remove('dragging');}

        document.querySelectorAll('.sortable-item').forEach(item => item.classList.remove('over'));
        draggingItem = null;
    });

    List_Element.addEventListener('dragover', (event) => {
        event.preventDefault();
        
        // Find out which item the cursor is hovering over
        const draggingOverItem = getDragAfterElement(List_Element, event.clientY);
        
        document.querySelectorAll('.sortable-item').forEach(item => item.classList.remove('over'));
        
        if (!draggingItem) {return;}

        if (draggingOverItem) 
        {
            draggingOverItem.classList.add('over');
            List_Element.insertBefore(draggingItem, draggingOverItem);
        } else {List_Element.appendChild(draggingItem);}
    });
}

function getDragAfterElement(container, y) 
{
    const draggableElements = [...container.querySelectorAll('.sortable-item:not(.dragging)')];

    Update_Upcoming_Client();
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (!(offset < 0 && offset > closest.offset)) {return closest;}

        return { offset: offset, element: child };
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}
