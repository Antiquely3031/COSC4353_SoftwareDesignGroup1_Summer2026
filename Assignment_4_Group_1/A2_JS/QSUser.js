//PART 3: Queue management module

const baseAPI = "http://localhost:3000/api";
// Placeholder user ID because there is no real database/authentication yet
//const userID = 1;

//temporary,until Patrick finishes with the userCredentials, if failure defaults back to 2
//ive inserted a test user in the database remove it later when finalizing the project
const userID = Number(sessionStorage.getItem("userID")) || 2;

// Mock service data.
// Later, this can come from GET /api/services.

const services = [
    {
        id: 1,
        name: "Advising Academics",
        approxWaitTime: 18,
        priority: "Medium"
    },
    {
        id: 2,
        name: "Welfare Check",
        approxWaitTime: 46,
        priority: "High"
    },
    {
        id: 3,
        name: "IT Help Desk",
        approxWaitTime: 12,
        priority: "Low"
    },
    {
        id: 4,
        name: "Financial Aid",
        approxWaitTime: 25,
        priority: "Medium"
    }
];
//Loading pages with conditions
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("joinQueuePage")) {
        setupJoinQueuePage();
    }
    if (document.getElementById("dashboardPage")) {
        setupDashboardPage();
    }
    if (document.getElementById("queueStatusPage")) {
        setupQueueStatusPage();
    }
    if (document.getElementById("historyPage")) {
        setupHistoryPage();
    }
});
//Join Queue Page
async function setupJoinQueuePage() {
    const serviceSelect = document.getElementById("serviceSelect");
    const selectedService = document.getElementById("selectedService");
    const estimatedWait = document.getElementById("estimatedWait");
    const joinQueueForm = document.getElementById("joinQueueForm");
    const leaveQueueButton = document.getElementById("leaveQueueButton");
    const joinQueueMessage = document.getElementById("joinQueueMessage");

    if (!serviceSelect || !joinQueueForm) {
        return;
    }
    //insertion of loadServicesDropdown() beginning of integration of database into JS
    await loadServicesDropdown();

    // Update wait time when service is selected
    function updateSelectedService() {
        const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];

        if (!serviceSelect.value) {
            selectedService.textContent = "None selected";
            estimatedWait.textContent = "Select a service";
            return;
        }

        selectedService.textContent = selectedOption.textContent.trim();
        estimatedWait.textContent = `${selectedOption.dataset.wait} minutes`;
    }
    serviceSelect.addEventListener("change", updateSelectedService);

    //will immediately when page loads
    updateSelectedService();

    joinQueueForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];

        if (!serviceSelect.value) {
            joinQueueMessage.textContent = "Please select a service before joining a queue.";
            return;
        }
        const existingQueue = getCurrentQueue();

        if (existingQueue) {
            joinQueueMessage.textContent =
                `You are already in the ${existingQueue.serviceName} queue at position ${existingQueue.position}.`;
            return;
        }
        //simulate a queue line (current position)
        const queueData = {
            serviceId: serviceSelect.value,
            serviceName: selectedOption.textContent.trim(),
            estimatedWait: selectedOption.dataset.wait,
            position: getNextQueuePosition(serviceSelect.value),
            status: "Waiting",
            joinedAt: new Date().toLocaleString()
        };

        localStorage.setItem("currentQueue", JSON.stringify(queueData));

        if (window.QSNotify && typeof QSNotify.queueJoined === "function") {
            QSNotify.queueJoined(queueData.serviceName);
        }
        addHistoryRecord(queueData.serviceName, "Joined");

        joinQueueMessage.textContent =
            `You joined the ${queueData.serviceName} queue. ` +
            `Your position is ${queueData.position}, and your estimated wait time is ${queueData.estimatedWait} minutes.`;
    });

    leaveQueueButton.addEventListener("click", () => {
        const currentQueue = getCurrentQueue();

        if (!currentQueue) {
            joinQueueMessage.textContent = "You are not currently in a queue.";
            return;
        }
        // Save values before removing the active queue
        const serviceId = currentQueue.serviceId;
        const serviceName = currentQueue.serviceName;

        // Clear active queue first
        localStorage.removeItem("currentQueue");

        // Then update related mock data
        decreaseQueueCount(serviceId);
        if (window.QSNotify && typeof QSNotify.left === "function") {
            QSNotify.left(serviceName);
        }
        addHistoryRecord(serviceName, "Canceled");

        joinQueueMessage.textContent =
            `You have left the ${serviceName} queue. You may now join another queue.`;

        selectedService.textContent = "None selected";
        estimatedWait.textContent = "Select a service";
        serviceSelect.value = "";
    });
}
// 7/29/2026 implmenting the new dynmaic after removing the hard-coded selection
async function setupDashboardPage() {
    const currentQueue = getCurrentQueue();
    const serviceName = document.getElementById("dashboardService");
    const queuePosition = document.getElementById("dashboardPosition");
    const waitTime = document.getElementById("dashboardWaitTime");
    const queueStatus = document.getElementById("dashboardStatus");

    //calling loadDashboardPage()
    await loadDashboardServices();
    if (currentQueue) {
        if (serviceName) serviceName.textContent = currentQueue.serviceName;
        if (queuePosition) queuePosition.textContent = currentQueue.position;
        if (waitTime) waitTime.textContent = currentQueue.estimatedWait;
        if (queueStatus) queueStatus.textContent = currentQueue.status;
    }
}

//queue status page
async function setupJoinQueuePage() {
    const serviceSelect = document.getElementById("serviceSelect");
    const selectedService = document.getElementById("selectedService");
    const estimatedWait = document.getElementById("estimatedWait");
    const joinQueueForm = document.getElementById("joinQueueForm");
    const leaveQueueButton = document.getElementById("leaveQueueButton");
    const joinQueueMessage = document.getElementById("joinQueueMessage");

    if (!serviceSelect || !joinQueueForm) {
        return;
    }
    //insertion of loadServicesDropdown() beginning of integration of database into JS
    await loadServicesDropdown();

    // Update wait time when service is selected
    function updateSelectedService() {
        const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];

        if (!serviceSelect.value) {
            selectedService.textContent = "None selected";
            estimatedWait.textContent = "Select a service";
            return;
        }

        selectedService.textContent = selectedOption.textContent.trim();
        estimatedWait.textContent = `${selectedOption.dataset.wait} minutes`;
    }
    serviceSelect.addEventListener("change", updateSelectedService);

    //will immediately when page loads
    updateSelectedService();

    joinQueueForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        //local storage implementation to be replaced by a backend calls 
        // const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];

        // if (!serviceSelect.value) {
        //     joinQueueMessage.textContent = "Please select a service before joining a queue.";
        //     return;
        // }
        // const existingQueue = getCurrentQueue();

        // if (existingQueue) {
        //     joinQueueMessage.textContent =
        //         `You are already in the ${existingQueue.serviceName} queue at position ${existingQueue.position}.`;
        //     return;
        // }
        // //simulate a queue line (current position)
        // const queueData = {
        //     serviceId: serviceSelect.value,
        //     serviceName: selectedOption.textContent.trim(),
        //     estimatedWait: selectedOption.dataset.wait,
        //     position: getNextQueuePosition(serviceSelect.value),
        //     status: "Waiting",
        //     joinedAt: new Date().toLocaleString()
        // };
        // // Old placeholder local storage code implementation replaced by backend call
        // // localStorage.setItem("currentQueue", JSON.stringify(queueData));
        // fetch('${baseAPI}/queue/join',{
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json'
        //     },
        //     body: JSON.stringify({
        //         userId: userID,
        //         serviceId: serviceSelect.value
        //     })
        // });
        // if (window.QSNotify && typeof QSNotify.queueJoined === "function") {
        //     QSNotify.queueJoined(queueData.serviceName);
        // }
        // addHistoryRecord(queueData.serviceName, "Joined");

        // joinQueueMessage.textContent =
        //     `You joined the ${queueData.serviceName} queue. ` +
        //     `Your position is ${queueData.position}, and your estimated wait time is ${queueData.estimatedWait} minutes.`;
        
        //8/2/2026 this condition is used to check if user selects service before joining queue
        if (!serviceSelect.value) {
            joinQueueMessage.textContent = "Please select a service before joining a queue.";
            return;
        }
        //the replacement of the previous hard-coded/local storage queue position
        try {
            const response = await fetch(`${baseAPI}/queue/join`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    userId: userID,
                    serviceId: serviceSelect.value
                })
            });

            const data = await response.json();
            if (!response.ok) {
                joinQueueMessage.textContent = data.error || "Failed to join queue.";
                return;
            }
            const queueData = {
                serviceId: data.serviceId,
                serviceName: data.serviceName,
                estimatedWait: data.estimatedWait,
                position: data.position,
                status: data.status,
                joinedAt: new Date().toLocaleString()
            };

            // Temporary: keep this so Dashboard and Queue Status still display correctly
            // until we create GET /api/queue/status/:userId
            localStorage.setItem("currentQueue", JSON.stringify(queueData));

            if (window.QSNotify && typeof QSNotify.queueJoined === "function") {
                QSNotify.queueJoined(queueData.serviceName);
            }

            addHistoryRecord(queueData.serviceName, "Joined");
            joinQueueMessage.textContent =
                `You joined the ${queueData.serviceName} queue. ` +
                `Your position is ${queueData.position}, and your estimated wait time is ${queueData.estimatedWait} minutes.`;

        } catch (error) {
            console.error("Error joining queue:", error);
            joinQueueMessage.textContent = "Unable to connect to the backend.";
        }
    });
}
//queue history page
function setupHistoryPage() {
    const historyListBody = document.getElementById("historyListBody");
    const summaryTotal = document.getElementById("summaryTotal");
    const summaryServed = document.getElementById("summaryServed");
    const summaryCanceled = document.getElementById("summaryCanceled");
    const summaryNoShow = document.getElementById("summaryNoShow");

    //default
    if (!historyListBody) {
        console.log("No history list found");
        return;
    }

    const history = getHistory();
    historyListBody.innerHTML = "";

    if (history.length === 0) {
        historyListBody.innerHTML = `
            <div class="history-row">
                <span>No queue history available.</span>
                <span>--</span>
                <span>--</span>
                <span>--</span>
            </div>
        `;

        if (summaryTotal) summaryTotal.textContent = 0;
        if (summaryServed) summaryServed.textContent = 0;
        if (summaryCanceled) summaryCanceled.textContent = 0;
        if (summaryNoShow) summaryNoShow.textContent = 0;
        return;
    }

    let servedCount = 0;
    let canceledCount = 0;
    let noShowCount = 0;

    history.forEach(record => {
        if (record.status.toLowerCase() === "served" || record.status.toLowerCase() === "completed") {
            servedCount++;
        }
        if (record.status.toLowerCase() === "canceled" || record.status.toLowerCase() === "cancelled") {
            canceledCount++;
        }
        if (record.status.toLowerCase() === "no show") {
            noShowCount++;
        }
        const row = document.createElement("div");
        row.classList.add("history-row");

        row.innerHTML = `
            <span>${record.serviceName}</span>
            <span>${record.date}</span>
            <span>${record.time}</span>
            <span class="outcome ${record.statusClass}">
                ${record.status}
            </span>
        `;
        historyListBody.appendChild(row);
    });

    if (summaryTotal) summaryTotal.textContent = history.length;
    if (summaryServed) summaryServed.textContent = servedCount;
    if (summaryCanceled) summaryCanceled.textContent = canceledCount;
    if (summaryNoShow) summaryNoShow.textContent = noShowCount;
}
//Helper functions
function getCurrentQueue() {
    const queueData = localStorage.getItem("currentQueue");

    if (!queueData) {
        return null;
    }
    return JSON.parse(queueData);
}
function addHistoryRecord(serviceName, status) {
    const history = getHistory();
    const now = new Date();
    //default value
    let statusClass = "completed";

    if (status.toLowerCase() === "canceled") {
        statusClass = "canceled";
    }
    if (status.toLowerCase() === "no show") {
        statusClass = "no-show";
    }

    history.unshift({
        serviceName: serviceName,
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        status: status,
        statusClass: statusClass
    });
    localStorage.setItem("queueHistory", JSON.stringify(history));
}

function getHistory() {
    const history = localStorage.getItem("queueHistory");

    if (!history) {
        return [];
    }
    return JSON.parse(history);
}
function getNextQueuePosition(serviceId) {
    const queueCounts = JSON.parse(localStorage.getItem("queueCounts")) || {};
    if (!queueCounts[serviceId]) {
        queueCounts[serviceId] = 0;
    }
    queueCounts[serviceId]++;
    localStorage.setItem("queueCounts", JSON.stringify(queueCounts));
    return queueCounts[serviceId];
}
function decreaseQueueCount(serviceId) {
    const queueCounts = JSON.parse(localStorage.getItem("queueCounts")) || {};

    if (queueCounts[serviceId] && queueCounts[serviceId] > 0) {
        queueCounts[serviceId]--;
    }

    localStorage.setItem("queueCounts", JSON.stringify(queueCounts));
}
// this section is added to assist in integrating the
async function loadServicesDropdown() {
    const serviceSelect = document.getElementById("serviceSelect");

    if (!serviceSelect) {
        return;
    }
    try {
        const response = await fetch(`${baseAPI}/services`);
        if (!response.ok) {
            throw new Error("Failed to load services from backend");
        }

        const services = await response.json();
        serviceSelect.innerHTML = `<option value="">Select a service</option>`;
        services.forEach(service => {
            const option = document.createElement("option");

            option.value = service.service_id;
            option.textContent = service.service_name;
            option.dataset.wait = service.expected_duration;

            serviceSelect.appendChild(option);
        });
    }
    catch (error) {
        console.error("Error loading services:", error);
        serviceSelect.innerHTML = `<option value="">Unable to load services</option>`;
    }
}
async function loadDashboardServices() {
    const serviceGrid = document.getElementById("dashboardServiceGrid");

    if (!serviceGrid) {
        return;
    }
    try {
        const response = await fetch(`${baseAPI}/services`);

        if (!response.ok) {
            throw new Error("Failed to load services from backend");
        }

        const services = await response.json();

        serviceGrid.innerHTML = "";

        services.forEach(service => {
            const serviceCard = document.createElement("div");
            serviceCard.classList.add("service-card");

            serviceCard.innerHTML = `
                <h3>${service.service_name}</h3>
                <p>Estimated wait: ${service.expected_duration} minutes</p>
                <a href="QSJoinQueue.html">Join Queue</a>
            `;

            serviceGrid.appendChild(serviceCard);
        });

    } catch (error) {
        console.error("Error loading dashboard services:", error);
        serviceGrid.innerHTML = "<p>Unable to load services.</p>";
    }
}

