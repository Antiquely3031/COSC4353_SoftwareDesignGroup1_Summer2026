document.addEventListener("DOMContentLoaded", () => {
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
});