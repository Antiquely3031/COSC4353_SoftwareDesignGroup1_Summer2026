let socket = null;
let currentSelectedServiceName = null;
let globalServicesContainer = [];

// Initialize Socket connection
if (typeof io !== 'undefined') {
    socket = io('http://localhost:3000');

    socket.on('connect', () => {
        console.log("Connected to Backend WS with ID:", socket.id);
    });

    // Explicit cleanup: Disconnect socket when refreshing or navigating away
    window.addEventListener('beforeunload', () => {
        if (socket) 
        {
            console.log("Closing Socket.io connection...");
            socket.disconnect();
        }
    });

    // Real-time listener for queue updates from backend
    socket.on('queue_updated', (services) => {
        globalServicesContainer = services;

        // Re-render currently selected queue if one is open
        if (currentSelectedServiceName) 
        {
            const activeService = globalServicesContainer.find(s => s.name === currentSelectedServiceName);

            if (activeService) {    renderQueueList(activeService);    } 
            else {    Deselect_Queue();    }
        }
    });
} else 
{
    console.error("Socket.io library (io) is not loaded! Include <script src='http://localhost:3000/socket.io/socket.io.js'></script> in your HTML.");
}

// Startup event binding
document.addEventListener("ServicesRendered", (event) => {
    if (event.detail && Array.isArray(event.detail.services)) {    globalServicesContainer = event.detail.services;    }

    bindSidebarButtons();

    // Load first service if available and none selected
    if (!currentSelectedServiceName && globalServicesContainer.length > 0) {    selectServiceByName(globalServicesContainer[0].name);    }

    // Bind action buttons
    const Serve_Button_Serve = document.getElementById('SIAB-serve');
    const Serve_Button_Remove = document.getElementById('SIAB-remove');
    const Serve_Button_Deselect = document.getElementById('AB-Deselect');
    
    if (Serve_Button_Serve) Serve_Button_Serve.onclick = Serve_Next_Client;
    if (Serve_Button_Deselect) Serve_Button_Deselect.onclick = Deselect_Queue;
    if (Serve_Button_Remove) Serve_Button_Remove.onclick = Remove_Client;
});

function bindSidebarButtons() {
    const Button_List = document.querySelectorAll('.scroll-list-box ul li button');
    Button_List.forEach((button) => {
        button.onclick = () => {
            const serviceName = button.textContent.trim();
            selectServiceByName(serviceName);
        };
    });
}

function selectServiceByName(serviceName) {
    currentSelectedServiceName = serviceName;
    const targetService = globalServicesContainer.find(s => s.name === serviceName);

    const Title_Box = document.querySelector('.SLB-Title p:nth-child(2)');
    if (Title_Box) Title_Box.textContent = serviceName;

    if (targetService) {    renderQueueList(targetService);    }
}

function Deselect_Queue() 
{
    currentSelectedServiceName = null;
    const Title_Box = document.querySelector('.SLB-Title p:nth-child(2)');
    if (Title_Box) Title_Box.textContent = "Select Service";

    const Service_List = document.querySelector('.queue-list-box ul');
    if (Service_List) Service_List.innerHTML = "";
    Update_Upcoming_Client();
}

function Remove_Client() 
{
    if (!currentSelectedServiceName) return;

    if (socket && socket.connected) {    socket.emit('remove_client', { service_name: currentSelectedServiceName, client_index: 0 });    } 
    else {    console.warn("Socket not connected to server.");    }
}

function Serve_Next_Client() 
{
    if (!currentSelectedServiceName) return;

    if (socket && socket.connected) {    socket.emit('serve_client', { service_name: currentSelectedServiceName });    } 
    else {    console.warn("Socket not connected to server.");    }
}

function Update_Upcoming_Client() 
{
    const Display_Target = document.getElementById('next-client-display');
    const First_Client_Paragraph = document.querySelector('.queue-list-box ul li p');

    if (Display_Target) 
    {
        if (First_Client_Paragraph) { Display_Target.textContent = First_Client_Paragraph.textContent.trim(); }
        else { Display_Target.textContent = "None"; }
    }
}

function renderQueueList(service) 
{
    const Service_List = document.querySelector('.queue-list-box ul');
    if (!Service_List) return;

    Service_List.innerHTML = "";

    if (!(service && Array.isArray(service.Queue_Array))) 
    {
        Update_Upcoming_Client();
        return;
    }

    service.Queue_Array.forEach((person) =>
    {
        const Index_li = document.createElement('li');
        Index_li.setAttribute('draggable', 'true');
        Index_li.classList.add('sortable-item');
        
        Index_li.innerHTML = `<p>${person}</p>`;
        Service_List.appendChild(Index_li);
    });

    Enable_Queue_Sorting(Service_List);
    Update_Upcoming_Client();
}

function Enable_Queue_Sorting(List_Element) 
{
    let draggingItem = null;

    List_Element.addEventListener('dragstart', (event) => {
        draggingItem = event.target.closest('.sortable-item');
        if (draggingItem) { draggingItem.classList.add('dragging'); }
    });

    List_Element.addEventListener('dragend', (event) => {
        const targetItem = event.target.closest('.sortable-item');
        if (targetItem) { targetItem.classList.remove('dragging'); }

        document.querySelectorAll('.sortable-item').forEach(item => item.classList.remove('over'));
        draggingItem = null;

        // Extract updated DOM order and emit to backend over WebSockets
        if (currentSelectedServiceName && socket && socket.connected) 
        {
            const updatedQueueNames = [...List_Element.querySelectorAll('.sortable-item p')].map(p => p.textContent.trim());

            socket.emit('reorder_queue', {
                service_name: currentSelectedServiceName,
                updated_queue: updatedQueueNames
            });
        }
    });

    List_Element.addEventListener('dragover', (event) => {
        event.preventDefault();
        
        const draggingOverItem = getDragAfterElement(List_Element, event.clientY);
        document.querySelectorAll('.sortable-item').forEach(item => item.classList.remove('over'));
        
        if (!draggingItem) { return; }

        if (draggingOverItem) 
        {
            draggingOverItem.classList.add('over');
            List_Element.insertBefore(draggingItem, draggingOverItem);
        } else { List_Element.appendChild(draggingItem); }
    });
}

function getDragAfterElement(container, y) 
{
    const draggableElements = [...container.querySelectorAll('.sortable-item:not(.dragging)')];

    Update_Upcoming_Client();
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (!(offset < 0 && offset > closest.offset)) { return closest; }

        return { offset: offset, element: child };
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}