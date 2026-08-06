//PART 3: Queue management module

const baseAPI = "http://localhost:3000/api";
const userID = Number(sessionStorage.getItem("userId")) || 1;

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

    joinQueueForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!serviceSelect.value) {
            joinQueueMessage.textContent = "Please select a service before joining a queue.";
            return;
        }

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

            if (window.QSNotify && typeof QSNotify.queueJoined === "function") {
                QSNotify.queueJoined(data.serviceName);
            }

            joinQueueMessage.textContent =
                `You joined the ${data.serviceName} queue. ` +
                `Your position is ${data.position}, and your estimated wait time is ${data.estimatedWait} minutes.`;

        } catch (error) {
            console.error("Error joining queue:", error);
            joinQueueMessage.textContent = "Unable to connect to the backend.";
        }
    });
    //leave queue button functionality
    if (leaveQueueButton) {
        //assuming user leaves instigate queue departure 
        leaveQueueButton.addEventListener("click", async () => {
            try {
                const data = await leaveQueueFromDatabase();
                if (window.QSNotify && typeof QSNotify.left === "function") {
                    QSNotify.left(data.serviceName);
                }
                //old call that is for local storage transition to backend
                //addHistoryRecord(data.serviceName, "Canceled");
                joinQueueMessage.textContent = `Left the ${data.serviceName} queue.`;

                selectedService.textContent = "None selected";
                estimatedWait.textContent = "select Service";
                //default value for selection
                serviceSelect.value = "";
            }
            catch (error) {
                console.error("Error leaving queue:", error);
                joinQueueMessage.textContent = error.message || "An error occurred while leaving the queue.";
            }
        });
    }
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
async function setupQueueStatusPage() {
    const currentQueue = getCurrentQueue();
    const serviceName = document.getElementById("statusService");
    const queuePosition = document.getElementById("statusPosition");
    const waitTime = document.getElementById("statusWaitTime");
    const queueStatus = document.getElementById("statusCurrent");
    const statusMessage = document.getElementById("statusMessage");
    const leaveButton = document.getElementById("statusLeaveButton");

    //new implementation of queue status page this time will be connected to backend
    try {
        const response = await fetch(`${baseAPI}/queue/status/${userID}`);
        const data = await response.json();

        if (!response.ok) {
            if (statusMessage) {
                statusMessage.innerHTML = data.error || "Unable to load queue status";
            }
            if (queueStatusCard) {
                queueStatusCard.style.display = "none";
            }
            return;
        }

        if (statusMessage) statusMessage.innerHTML = "<em>Now in queue</em>";
        if (serviceName) serviceName.textContent = data.serviceName;
        if (queuePosition) queuePosition.textContent = data.position;
        if (waitTime) waitTime.textContent = `${data.estimatedWait} minutes`;
        if (queueStatus) queueStatus.textContent = data.status;

    }
    catch (error) {
        console.error("Error loading queue status:", error);
        if (statusMessage) {
            statusMessage.textContent = "Unable to load queue status from backend.";
        }
    }

    if (statusLeaveButton) {
        statusLeaveButton.addEventListener("click", async () => {
            try {
                const response = await fetch(`${baseAPI}/queue/leave`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        userId: userID
                    })
                });

                const data = await response.json();
                if (!response.ok) {
                    if (statusMessage) {
                        statusMessage.textContent = data.error || "Unable to leave queue.";
                    }
                    return;
                }

                if (statusMessage) {
                    statusMessage.textContent = `You have left the ${data.serviceName} queue.`;
                }

                if (queueStatusCard) {
                    queueStatusCard.style.display = "none";
                }
                if (window.QSNotify && typeof QSNotify.left === "function") {
                    QSNotify.left(data.serviceName);
                }

            } catch (error) {
                console.error("Error leaving queue:", error);
                if (statusMessage) {
                    statusMessage.textContent = "Unable to connect to backend.";
                }
            }
        });
    }
}
//queue history page
async function setupHistoryPage() {
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

    try {
        const response = await fetch(`${baseAPI}/queue/history/${userID}`);
        const history = await response.json();

        if (!response.ok) {
            throw new Error(history.error || "Failed to load history.");
        }

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
            const status = record.status || "unknown";
            const statusLower = status.toLowerCase();

            let statusClass = "waiting";

            if (statusLower === "served" || statusLower === "completed") {
                servedCount++;
                statusClass = "completed";
            }

            if (statusLower === "canceled" || statusLower === "cancelled") {
                canceledCount++;
                statusClass = "canceled";
            }

            if (statusLower === "no show") {
                noShowCount++;
                statusClass = "no-show";
            }

            const joinedDate = record.join_time ? new Date(record.join_time) : null;
            const date = joinedDate ? joinedDate.toLocaleDateString() : "--";
            const time = joinedDate ? joinedDate.toLocaleTimeString() : "--";

            const row = document.createElement("div");
            row.classList.add("history-row");

            row.innerHTML = `
                <span>${record.service_name}</span>
                <span>${date}</span>
                <span>${time}</span>
                <span class="outcome ${statusClass}">
                    ${status}
                </span>
            `;

            historyListBody.appendChild(row);
        });

        if (summaryTotal) summaryTotal.textContent = history.length;
        if (summaryServed) summaryServed.textContent = servedCount;
        if (summaryCanceled) summaryCanceled.textContent = canceledCount;
        if (summaryNoShow) summaryNoShow.textContent = noShowCount;

    } catch (error) {
        console.error("Error loading queue history:", error);

        historyListBody.innerHTML = `
            <div class="history-row">
                <span>Unable to load queue history.</span>
                <span>--</span>
                <span>--</span>
                <span>--</span>
            </div>
        `;
    }
}
//Helper functions
// function getCurrentQueue() {
//     const queueData = localStorage.getItem("currentQueue");

//     if (!queueData) {
//         return null;
//     }
//     return JSON.parse(queueData);
// }
// function addHistoryRecord(serviceName, status) {
//     const history = getHistory();

//     const now = new Date();
//     //default value
//     let statusClass = "completed";

//     if (status.toLowerCase() === "canceled") {
//         statusClass = "canceled";
//     }
//     if (status.toLowerCase() === "no show") {
//         statusClass = "no-show";
//     }

//     history.unshift({
//         serviceName: serviceName,
//         date: now.toLocaleDateString(),
//         time: now.toLocaleTimeString(),
//         status: status,
//         statusClass: statusClass
//     });
//     localStorage.setItem("queueHistory", JSON.stringify(history));
// }
// function getHistory() {
//     const history = localStorage.getItem("queueHistory");

//     if (!history) {
//         return [];
//     }

//     return JSON.parse(history);
// }
// function getNextQueuePosition(serviceId) {
//     const queueCounts = JSON.parse(localStorage.getItem("queueCounts")) || {};
//     if (!queueCounts[serviceId]) {
//         queueCounts[serviceId] = 0;
//     }
//     queueCounts[serviceId]++;
//     localStorage.setItem("queueCounts", JSON.stringify(queueCounts));

//     return queueCounts[serviceId];
// }
// function decreaseQueueCount(serviceId) {
//     const queueCounts = JSON.parse(localStorage.getItem("queueCounts")) || {};

//     if (queueCounts[serviceId] && queueCounts[serviceId] > 0) {
//         queueCounts[serviceId]--;
//     }

//     localStorage.setItem("queueCounts", JSON.stringify(queueCounts));
// }
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
                <a href="QSJoinQueue.html">Join Queue</a>`;
            serviceGrid.appendChild(serviceCard);
        });

    } catch (error) {
        console.error("Error loading dashboard services:", error);
        serviceGrid.innerHTML = "<p>Unable to load services.</p>";
    }
}
//this helper function will assist in when user wants to leave queue
async function leaveQueueFromDatabase() {
    const response = await fetch(`${baseAPI}/queue/leave`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            userId: userID
        })
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Failed to leave queue.");
    }
    return data;
}
