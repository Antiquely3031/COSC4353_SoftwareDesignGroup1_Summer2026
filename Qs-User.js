//PART 3: Queue management module

const baseAPI = "https://localhost:3000/api";
const userID = 1; //placeholder for user ID, no database created for now

const services = [
    {
        id: 1,
        name: "Advising academics",
        approxWaitTime: 18,
        priority: "Medium"
    },
    {
        id: 2,
        name: "Welfare check",
        approxWaitTime: 46,
        priority: "High"
    }

];

const queueEntries = [ 
{
   id: 1,
   userID: 101,
   serviceID: 2003,
   userName: "Bob333",
   status: "Waiting",
   priority: "Medium",
   joinedQueueTime: "2026-15-01T10:00:00Z",
}
];

//Loading pages with conditions
document.addEventListener("DOMContentLoaded", () =>
{
    if(document.getElementById("joinQueuePage"))
    {
        JoinQueuePage();
    }
    if(document.getElementById("dashboardPage"))
    {
        DashboardPage();
    }
    if(document.getElementById("queueStatusPage"))
    {
        QueueStatusPage();
    }
    if(document.getElementById("historyPage"))
    {
        HistoryPage();
    }
});
//Join Queue Page
function JoinQueuePage()
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
    serviceSelect.addEventListener("change", () => {
        const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
        const serviceName = selectedOption.textContent.trim();
        const waitTime = selectedOption.dataset.wait;

        if (!serviceSelect.value) {
            selectedService.textContent = "None selected";
            estimatedWait.textContent = "Select a service";
            return;
        }

        selectedService.textContent = serviceName;
        estimatedWait.textContent = `${waitTime} minutes`;
    });

    // Join queue
    joinQueueForm.addEventListener("submit", (event) => {
        event.preventDefault();

        const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];

        if (!serviceSelect.value) {
            joinQueueMessage.textContent = "Please select a service before joining a queue.";
            return;
        }

        const queueData = {
            serviceId: serviceSelect.value,
            serviceName: selectedOption.textContent.trim(),
            estimatedWait: selectedOption.dataset.wait,
            position: generateMockPosition(),
            status: "Waiting",
            joinedAt: new Date().toLocaleString()
        };

        localStorage.setItem("currentQueue", JSON.stringify(queueData));

        addNotification(`You joined the ${queueData.serviceName} queue.`);
        addHistoryRecord(queueData.serviceName, "Waiting");

        joinQueueMessage.textContent =
            `You joined the ${queueData.serviceName} queue. ` +
            `Your estimated wait time is ${queueData.estimatedWait} minutes.`;

        // Optional: send user to Queue Status page after joining
        // window.location.href = "queue-status.html";
    });

    // Leave queue
    leaveQueueButton.addEventListener("click", () => {
        const currentQueue = getCurrentQueue();

        if (!currentQueue) {
            joinQueueMessage.textContent = "You are not currently in a queue.";
            return;
        }

        addNotification(`You left the ${currentQueue.serviceName} queue.`);
        addHistoryRecord(currentQueue.serviceName, "Canceled");

        localStorage.removeItem("currentQueue");

        joinQueueMessage.textContent =
            `You have left the ${currentQueue.serviceName} queue.`;
    });
}

//dashboard page
function DashboardPage()
{
    const currentQueue = getCurrentQueue();

    const serviceName = document.getElementById("dashboardService");
    const queuePosition = document.getElementById("dashboardPosition");
    const waitTime = document.getElementById("dashboardWaitTime");
    const queueStatus = document.getElementById("dashboardStatus");
    const notificationList = document.getElementById("dashboardNotifications");

    if (currentQueue) {
        if (serviceName) serviceName.textContent = currentQueue.serviceName;
        if (queuePosition) queuePosition.textContent = currentQueue.position;
        if (waitTime) waitTime.textContent = currentQueue.estimatedWait;
        if (queueStatus) queueStatus.textContent = currentQueue.status;
    }

    if (notificationList) {
        displayNotifications(notificationList);
    }
}

//queue status page
function QueueStatusPage()
{
    const currentQueue = getCurrentQueue();
    const serviceName = document.getElementById("dashboardService");
    const queuePosition = document.getElementById("dashboardPosition");
    const waitTime = document.getElementById("dashboardWaitTime");
    const queueStatus = document.getElementById("dashboardStatus");
    const notificationList = document.getElementById("dashboardNotifications");

    if (currentQueue) {
        if (serviceName) serviceName.textContent = currentQueue.serviceName;
        if (queuePosition) queuePosition.textContent = currentQueue.position;
        if (waitTime) waitTime.textContent = currentQueue.estimatedWait;
        if (queueStatus) queueStatus.textContent = currentQueue.status;
    }

    if (notificationList) {
        displayNotifications(notificationList);
    }
}

//history page
function HistoryPage()
{
    const historyBody = document.getElementById("historyBody");

    if(!historyBody) {
        return;
    }

    const history = getHistory();

    historyBody.innerHTML = "";
    if (history.length === 0) {
        historyBody.innerHTML = `
            <tr>
                <td colspan="4">No queue history available.</td>
            </tr>
        `;
        return;
    }

    history.forEach(record => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${record.serviceName}</td>
            <td>${record.date}</td>
            <td>${record.time}</td>
            <td>
                <span class="outcome ${record.statusClass}">
                    ${record.status}
                </span>
            </td>
        `;

        historyBody.appendChild(row);
    }); 
}

function getCurrentQueue() {
    const queueData = localStorage.getItem("currentQueue");

    if (!queueData) {
        return null;
    }

    return JSON.parse(queueData);
}


function generateMockPosition() {
    return Math.floor(Math.random() * 10) + 1;
}


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


function addHistoryRecord(serviceName, status) {
    const history = getHistory();

    const now = new Date();

    let statusClass = "completed";

    if (status.toLowerCase() === "canceled") {
        statusClass = "canceled";
    } else if (status.toLowerCase() === "no show") {
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
