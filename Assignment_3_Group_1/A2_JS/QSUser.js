//PART 3: Queue management module

const baseAPI = "http://localhost:3000/api";
// Placeholder user ID because there is no real database/authentication yet
const userID = 1;

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
document.addEventListener("DOMContentLoaded", () =>
{
    if(document.getElementById("joinQueuePage"))
    {
        setupJoinQueuePage();
    }
    if(document.getElementById("dashboardPage"))
    {
        setupDashboardPage();
    }
    if(document.getElementById("queueStatusPage"))
    {
        setupQueueStatusPage();
    }
    if(document.getElementById("historyPage"))
    {
        setupHistoryPage();
    }
});

//Join Queue Page
function setupJoinQueuePage()
{
    const serviceSelect = document.getElementById("serviceSelect");
    const selectedService = document.getElementById("selectedService");
    const estimatedWait = document.getElementById("estimatedWait");
    const joinQueueForm = document.getElementById("joinQueueForm");
    const leaveQueueButton = document.getElementById("leaveQueueButton");
    const joinQueueMessage = document.getElementById("joinQueueMessage");

    if (!serviceSelect || !joinQueueForm) {
        return;
    }

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

        QSNotify.queueJoined(queueData.serviceName);
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
        QSNotify.left(serviceName);
        addHistoryRecord(serviceName, "Canceled");

        joinQueueMessage.textContent =
            `You have left the ${serviceName} queue. You may now join another queue.`;

        selectedService.textContent = "None selected";
        estimatedWait.textContent = "Select a service";
        serviceSelect.value = "";
    });
}

//dashboard page
function setupDashboardPage()
{
    const currentQueue = getCurrentQueue();

    const serviceName = document.getElementById("dashboardService");
    const queuePosition = document.getElementById("dashboardPosition");
    const waitTime = document.getElementById("dashboardWaitTime");
    const queueStatus = document.getElementById("dashboardStatus");
    //const notificationList = document.getElementById("dashboardNotifications");

    if (currentQueue) {
        if (serviceName)serviceName.textContent = currentQueue.serviceName;
        if (queuePosition) queuePosition.textContent = currentQueue.position;
        if (waitTime) waitTime.textContent = currentQueue.estimatedWait;
        if (queueStatus) queueStatus.textContent = currentQueue.status;
    }

//    if (notificationList) {
//        displayNotifications(notificationList);
//    }
//}

//queue status page
function setupQueueStatusPage() {
    const currentQueue = getCurrentQueue();

    const serviceName = document.getElementById("statusService");
    const queuePosition = document.getElementById("statusPosition");
    const waitTime = document.getElementById("statusWaitTime");
    const queueStatus = document.getElementById("statusCurrent");
    const statusMessage = document.getElementById("statusMessage");
    const leaveButton = document.getElementById("statusLeaveButton");

    if (!currentQueue) {
        if (statusMessage) {
            statusMessage.textContent = "You are not currently waiting in a queue.";
        }
        return;
    }

    if (serviceName) serviceName.textContent = currentQueue.serviceName;
    if (queuePosition) queuePosition.textContent = currentQueue.position;
    QSNotify.positionUpdate(currentQueue.serviceName, Number(currentQueue.position));
    if (waitTime) waitTime.textContent = `${currentQueue.estimatedWait} minutes`;
    if (queueStatus) queueStatus.textContent = currentQueue.status;

    if (statusMessage) {
        statusMessage.textContent =
            `You are currently waiting for ${currentQueue.serviceName}.`;
    }

    if (leaveButton) {
    leaveButton.addEventListener("click", () => {
        decreaseQueueCount(currentQueue.serviceId);

        QSNotify.left(currentQueue.serviceName);
        addHistoryRecord(currentQueue.serviceName, "Canceled");

        localStorage.removeItem("currentQueue");

        if (serviceName) serviceName.textContent = "No active queue";
        if (queuePosition) queuePosition.textContent = "--";
        if (waitTime) waitTime.textContent = "--";
        if (queueStatus) queueStatus.textContent = "Not Joined";

        statusMessage.textContent =
            `You have left the ${currentQueue.serviceName} queue.`;
    });
}
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
/*
function addNotification(message) {
    const notifications = getNotifications();

    notifications.unshift({
        message: message,
        time: new Date().toLocaleTimeString()
    });

    localStorage.setItem("notifications", JSON.stringify(notifications));
}

function getNotifications() {
    const notifications = localStorage.getItem("notifications");

    if (!notifications) {
        return [];
    }

    return JSON.parse(notifications);
}

function displayNotifications(notificationList) {
    const notifications = getNotifications();

    notificationList.innerHTML = "";

    if (notifications.length === 0) {
        notificationList.innerHTML = "<li>No notifications yet.</li>";
        return;
    }

    notifications.forEach(notification => {
        const li = document.createElement("li");
        li.textContent = `${notification.message} (${notification.time})`;
        notificationList.appendChild(li);
    });
}
*/
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

function getNextQueuePosition(serviceId)
{
    const queueCounts = JSON.parse(localStorage.getItem("queueCounts")) || {};
    if(!queueCounts[serviceId])
    {
        queueCounts[serviceId] = 0;
    }
    queueCounts[serviceId]++;
    localStorage.setItem("queueCount", JSON.stringify(queueCounts));

    return queueCounts[serviceId];
}

function decreaseQueueCount(serviceId) {
    const queueCounts = JSON.parse(localStorage.getItem("queueCounts")) || {};

    if (queueCounts[serviceId] && queueCounts[serviceId] > 0) {
        queueCounts[serviceId]--;
    }

    localStorage.setItem("queueCounts", JSON.stringify(queueCounts));
}
