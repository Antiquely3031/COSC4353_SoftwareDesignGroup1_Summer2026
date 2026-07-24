function joinQueue(mockDB, userId, serviceId) {
    if (!userId || !serviceId) {
        return {
            success: false,
            error: "Missing userId or serviceId"
        };
    }

    const service = mockDB.services.find(service => service.id === serviceId);

    if (!service) {
        return {
            success: false,
            error: "Service not found"
        };
    }

    const alreadyWaiting = mockDB.queueEntries.find(entry => {
        return entry.userId === userId && entry.status === "Waiting";
    });

    if (alreadyWaiting) {
        return {
            success: false,
            error: "User is already in a queue"
        };
    }

    const position = mockDB.queueEntries.filter(entry => {
        return entry.serviceId === serviceId && entry.status === "Waiting";
    }).length + 1;

    const queueEntry = {
        userId: userId,
        serviceId: serviceId,
        serviceName: service.name,
        position: position,
        estimatedWait: position * service.expectedDuration,
        status: "Waiting"
    };

    mockDB.queueEntries.push(queueEntry);

    return {
        success: true,
        queueEntry: queueEntry
    };
}

function leaveQueue(mockDB, userId) {
    const queueEntry = mockDB.queueEntries.find(entry => {
        return entry.userId === userId && entry.status === "Waiting";
    });

    if (!queueEntry) {
        return {
            success: false,
            error: "User is not currently in a queue"
        };
    }

    queueEntry.status = "Canceled";

    mockDB.history.push({
        userId: queueEntry.userId,
        serviceId: queueEntry.serviceId,
        serviceName: queueEntry.serviceName,
        status: "Canceled"
    });

    return {
        success: true,
        queueEntry: queueEntry
    };
}

module.exports = {
    joinQueue,
    leaveQueue
};