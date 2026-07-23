document.addEventListener("DOMContentLoaded", () => {
    Hamburger_Menu();
    Service_Selection_Box();
});

function Hamburger_Menu() 
{
    const menuButton = document.querySelector("header nav button");
    const sidebar = document.querySelector("header nav ul");

    if (!(menuButton && sidebar)) {return;}

    // Toggle menu via hamburger button click
    menuButton.addEventListener("click", () => {
        sidebar.classList.toggle("active");
    });

    // Close sidebar if user clicks outside of it
    document.addEventListener("click", (event) => {
        if (!sidebar.contains(event.target) && !menuButton.contains(event.target)) {sidebar.classList.remove("active");}
    });

    // --- Drag/Swipe to Close Functionality ---
    let touchStartX = 0;
    let touchCurrentX = 0;

    // Capture where the touch starts on the sidebar
    sidebar.addEventListener("touchstart", (event) => {
        touchStartX = event.touches[0].clientX;
        touchCurrentX = touchStartX; // Reset current X tracking
    }, { passive: true });

    // Track horizontal finger movement
    sidebar.addEventListener("touchmove", (event) => {
        touchCurrentX = event.touches[0].clientX;
        
        let swipeDistance = touchStartX - touchCurrentX;

        // Optional enhancement: Provide real-time visual feedback while dragging left
        if (swipeDistance > 0 && sidebar.classList.contains("active")) 
        {
            sidebar.style.transition = "none"; // Temporarily disable transition during manual drag
            sidebar.style.transform = `translateX(${-swipeDistance}px)`;
        }
    }, { passive: true });

    // Determine if the gesture was a deliberate swipe left when finger lifts
    sidebar.addEventListener("touchend", () => {
        sidebar.style.transition = ""; // Restore original CSS ease-in-out transition timing
        
        let swipeDistance = touchStartX - touchCurrentX;
        const swipeThreshold = 60; // Pixels required to trigger a close action

        if (swipeDistance > swipeThreshold && sidebar.classList.contains("active")) {sidebar.classList.remove("active");}

        // Reset inline transform styles so the standard CSS rule takes back control
        sidebar.style.transform = "";
    });
}

async function Get_Service_List() {
    try 
    {
        const response = await fetch('http://localhost:3000/api/admin/services');
        
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const services = await response.json();
        return services;
    } catch (error) 
    {
        console.error('Failed to fetch admin service list:', error);
        return []; // Fallback to an empty list on network error
    }
}

async function Service_Selection_Box() {
    const Service_List = document.querySelector('.scroll-list-box ul');
    if (!Service_List) { return; }

    const services = await Get_Service_List();
    Service_List.innerHTML = '';

    if (services.length === 0) {
        Service_List.innerHTML = '<li><p style="color: var(--text)">No services available or backend unreachable.</p></li>';
        return;
    }

    // Populate DOM dynamically using server response
    services.forEach((service, index) => {
        const Index_li = document.createElement('li');
        
        // Clean ID string formulation
        const cleanName = service.name.replace(/\s+/g, ' ');
        const Button_Class = 'button-feedback';
        const Button_Id = `Button-Service-${cleanName}`;

        Index_li.innerHTML = `
            <button type="button" class="${Button_Class}" id="${Button_Id}">
                <p>${service.name}</p>
            </button>
        `;

        Service_List.appendChild(Index_li);
    });

    document.dispatchEvent(new CustomEvent("ServicesRendered", {detail: { services: services }}));
}