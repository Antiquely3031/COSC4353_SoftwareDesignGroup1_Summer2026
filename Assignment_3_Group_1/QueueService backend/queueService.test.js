const { joinQueue, leaveQueue } = require("./queueService");

function createMockDB() {
    return {
        services: [
            {
                id: 1,
                name: "Advising Academics",
                expectedDuration: 18
            },
            {
                id: 2,
                name: "Welfare Check",
                expectedDuration: 46
            }
        ],
        queueEntries: [],
        history: []
    };
}

test("user can join a valid queue", () => {
    const mockDB = createMockDB();

    const result = joinQueue(mockDB, 1, 1);

    expect(result.success).toBe(true);
    expect(result.queueEntry.serviceName).toBe("Advising Academics");
    expect(result.queueEntry.position).toBe(1);
    expect(result.queueEntry.estimatedWait).toBe(18);
    expect(result.queueEntry.status).toBe("Waiting");
});

test("user cannot join without a valid service", () => {
    const mockDB = createMockDB();

    const result = joinQueue(mockDB, 1, 999);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Service not found");
});

test("user cannot join two queues at once", () => {
    const mockDB = createMockDB();

    joinQueue(mockDB, 1, 1);
    const secondResult = joinQueue(mockDB, 1, 2);

    expect(secondResult.success).toBe(false);
    expect(secondResult.error).toBe("User is already in a queue");
});

test("second user receives position 2 in the same queue", () => {
    const mockDB = createMockDB();

    joinQueue(mockDB, 1, 1);
    const result = joinQueue(mockDB, 2, 1);

    expect(result.success).toBe(true);
    expect(result.queueEntry.position).toBe(2);
    expect(result.queueEntry.estimatedWait).toBe(36);
});

test("user can leave a queue", () => {
    const mockDB = createMockDB();

    joinQueue(mockDB, 1, 1);
    const result = leaveQueue(mockDB, 1);

    expect(result.success).toBe(true);
    expect(result.queueEntry.status).toBe("Canceled");
    expect(mockDB.history.length).toBe(1);
    expect(mockDB.history[0].status).toBe("Canceled");
});

test("user cannot leave if they are not in a queue", () => {
    const mockDB = createMockDB();

    const result = leaveQueue(mockDB, 1);

    expect(result.success).toBe(false);
    expect(result.error).toBe("User is not currently in a queue");
});