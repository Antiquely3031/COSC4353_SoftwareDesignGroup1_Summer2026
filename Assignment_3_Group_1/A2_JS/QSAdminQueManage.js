let socket = null;
let currentSelectedServiceId = null;
let globalServicesContainer = [];

// Initialize Socket connection
if (typeof io !== 'undefined') 
{
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
        if (currentSelectedServiceId) 
        {
            const activeService = globalServicesContainer.find(s => String(s.service_id) === String(currentSelectedServiceId));

            if (activeService) { renderQueueList(activeService); } 
            else { Deselect_Queue(); }
        }
    });
} else 
{
    console.error("Socket.io library (io) is not loaded! Include <script src='http://localhost:3000/socket.io/socket.io.js'></script> in your HTML.");
}

// Startup event binding
document.addEventListener("ServicesRendered", (event) => {
    if (event.detail && Array.isArray(event.detail.services)) { globalServicesContainer = event.detail.services; }

    bindSidebarButtons();

    // Load first service if available and none selected
    if (!currentSelectedServiceId && globalServicesContainer.length > 0) { selectServiceById(globalServicesContainer[0].service_id); }

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
    Button_List.forEach((button, index) => {
        if (globalServicesContainer[index]) {
            button.dataset.serviceId = globalServicesContainer[index].service_id;
        }
        button.onclick = () => {
            const serviceId = button.dataset.serviceId;
            selectServiceById(serviceId);
        };
    });
}

function selectServiceById(serviceId) {
    currentSelectedServiceId = serviceId;
    const targetService = globalServicesContainer.find(s => String(s.service_id) === String(serviceId));

    const Title_Box = document.querySelector('.SLB-Title p:nth-child(2)');
    if (Title_Box) Title_Box.textContent = targetService ? targetService.name : "Select Service";

    if (targetService) { renderQueueList(targetService); }
}

function Deselect_Queue() 
{
    currentSelectedServiceId = null;
    const Title_Box = document.querySelector('.SLB-Title p:nth-child(2)');
    if (Title_Box) Title_Box.textContent = "Select Service";

    const Service_List = document.querySelector('.queue-list-box ul');
    if (Service_List) Service_List.innerHTML = "";
    Update_Upcoming_Client();
}

function Remove_Client() 
{
    if (!currentSelectedServiceId) return;

    const Service_List = document.querySelector('.queue-list-box ul');
    const First_Item = Service_List ? Service_List.querySelector('.sortable-item') : null;
    const targetEntryId = First_Item ? First_Item.dataset.queueEntryId : null;

    if (socket && socket.connected) 
    { 
        socket.emit('remove_client', { 
            service_id: currentSelectedServiceId, 
            queue_entry_id: targetEntryId 
        }); 
    } 
    else { console.warn("Socket not connected to server."); }
}

function Serve_Next_Client() 
{
    if (!currentSelectedServiceId) return;

    const Service_List = document.querySelector('.queue-list-box ul');
    const First_Item = Service_List ? Service_List.querySelector('.sortable-item') : null;
    const targetEntryId = First_Item ? First_Item.dataset.queueEntryId : null;

    if (socket && socket.connected) 
    { 
        socket.emit('serve_client', { 
            service_id: currentSelectedServiceId, 
            queue_entry_id: targetEntryId 
        }); 
    } 
    else { console.warn("Socket not connected to server."); }
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

    service.Queue_Array.forEach((entry) =>
    {
        if (!entry) return;
        const Index_li = document.createElement('li');
        Index_li.setAttribute('draggable', 'true');
        Index_li.classList.add('sortable-item');
        
        // Save the metadata attributes onto the collection container item
        Index_li.dataset.queueEntryId = entry.queue_entry_id;
        Index_li.dataset.userId = entry.user_id;
        Index_li.dataset.position = entry.position;
        Index_li.dataset.lineStatus = entry.line_status;
        Index_li.dataset.joinTime = entry.join_time;
        
        Index_li.innerHTML = `<p>${entry.user_name}</p>`;
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

        // Extract updated DOM order parsing standard Queue_Entry data objects back to WS
        if (currentSelectedServiceId && socket && socket.connected) 
        {
            const updatedQueueObjects = [...List_Element.querySelectorAll('.sortable-item')].map(li => {
                return {
                    queue_entry_id: li.dataset.queueEntryId,
                    user_id: li.dataset.userId,
                    user_name: li.querySelector('p').textContent.trim(),
                    position: Number(li.dataset.position),
                    line_status: li.dataset.lineStatus,
                    join_time: li.dataset.joinTime
                };
            });

            socket.emit('reorder_queue', {
                service_id: currentSelectedServiceId,
                updated_queue: updatedQueueObjects
            });
        }
    });

    List_Element.addEventListener('dragover', (event) => {
        event.preventDefault();
        
        const draggingOverItem = getDragAfterElement(List_Element, event.clientY);
        document.querySelectorAll('.sortable-item').forEach(item => item.classList.remove('over'));
        
        if (!draggingItem) return;

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