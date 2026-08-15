jest.mock("./db", () => ({
    query: jest.fn()
}));

const request = require("supertest");
const app = require("./server");
const db = require("./db");

//test 1
beforeEach(() => {
    jest.clearAllMocks();
});

describe("Queue routes", () => {
    test("POST /api/queue/join returns 400 when userId or serviceId is missing", async () => {
        const response = await request(app)
            .post("/api/queue/join")
            .send({ userId: 1 });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "Missing userId or serviceId"
        });
    });

    test("POST /api/queue/join returns 404 when user does not exist", async () => {
        db.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
            .post("/api/queue/join")
            .send({ userId: 999, serviceId: 31 });

        expect(response.statusCode).toBe(404);
        expect(response.body).toEqual({
            error: "User does not exist. Please log in with a valid user account."
        });
    });

    test("POST /api/queue/join successfully joins queue", async () => {
        db.query
            .mockResolvedValueOnce([[{ user_id: 1 }]]) // user exists
            .mockResolvedValueOnce([[{ queue_id: 10 }]]) // open queue exists
            .mockResolvedValueOnce([[]]) // not already waiting
            .mockResolvedValueOnce([[{ count: 2 }]]) // position count
            .mockResolvedValueOnce([{ insertId: 99 }]) // insert
            .mockResolvedValueOnce([[{
                service_name: "Advising Academics",
                expected_duration: 18
            }]]); // service info

        const response = await request(app)
            .post("/api/queue/join")
            .send({ userId: 1, serviceId: 31 });

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({
            serviceId: 31,
            serviceName: "Advising Academics",
            position: 3,
            estimatedWait: 54,
            status: "Waiting"
        });
    });

    test("GET /api/queue/status/:userId returns current queue status", async () => {
        db.query.mockResolvedValueOnce([[{
            queue_entry_id: 5,
            queue_id: 10,
            user_id: 1,
            position: 2,
            join_time: "2026-08-14T12:00:00.000Z",
            status: "waiting",
            service_id: 31,
            service_name: "Advising Academics",
            expected_duration: 18
        }]]);

        const response = await request(app).get("/api/queue/status/1");

        expect(response.statusCode).toBe(200);
        expect(response.body.serviceName).toBe("Advising Academics");
        expect(response.body.position).toBe(2);
        expect(response.body.estimatedWait).toBe(36);
    });

    test("GET /api/queue/status/:userId returns 404 when user is not waiting", async () => {
        db.query.mockResolvedValueOnce([[]]);

        const response = await request(app).get("/api/queue/status/1");

        expect(response.statusCode).toBe(404);
        expect(response.body).toEqual({
            error: "user currently not in queue"
        });
    });

    test("GET /api/queue/history/:userId returns queue history", async () => {
        const mockHistory = [
            {
                queue_entry_id: 1,
                queue_id: 10,
                user_id: 1,
                position: 1,
                join_time: "2026-08-14T12:00:00.000Z",
                status: "served",
                service_name: "IT Help Desk",
                expected_duration: 12
            }
        ];

        db.query.mockResolvedValueOnce([mockHistory]);

        const response = await request(app).get("/api/queue/history/1");

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(mockHistory);
    });

    test("GET /api/smart/wait-times returns smart wait estimates", async () => {
        const mockWaitTimes = [
            {
                service_id: 33,
                service_name: "IT Help Desk",
                expected_duration: 12,
                waiting_count: 1,
                estimated_wait: 12
            }
        ];

        db.query.mockResolvedValueOnce([mockWaitTimes]);

        const response = await request(app).get("/api/smart/wait-times");

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual(mockWaitTimes);
    });
    describe("Additional backend coverage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("GET / returns backend running message", async () => {
        const response = await request(app).get("/");

        expect(response.statusCode).toBe(200);
        expect(response.text).toBe("QueueSmart backend is running");
    });

    test("POST /api/queue/join returns 404 when no open queue exists", async () => {
        db.query
            .mockResolvedValueOnce([[{ user_id: 1 }]]) // user exists
            .mockResolvedValueOnce([[]]); // no open queue

        const response = await request(app)
            .post("/api/queue/join")
            .send({ userId: 1, serviceId: 31 });

        expect(response.statusCode).toBe(404);
        expect(response.body).toEqual({
            error: "No open queue found for this service"
        });
    });

    test("POST /api/queue/join returns 400 when user is already waiting for same service", async () => {
        db.query
            .mockResolvedValueOnce([[{ user_id: 1 }]]) // user exists
            .mockResolvedValueOnce([[{ queue_id: 10 }]]) // open queue exists
            .mockResolvedValueOnce([[{ queue_entry_id: 99 }]]); // duplicate waiting entry

        const response = await request(app)
            .post("/api/queue/join")
            .send({ userId: 1, serviceId: 31 });

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "User is already waiting in a queue waiting for this service"
        });
    });

    test("POST /api/queue/join returns 500 when database throws error", async () => {
        db.query.mockRejectedValueOnce(new Error("Database failure"));

        const response = await request(app)
            .post("/api/queue/join")
            .send({ userId: 1, serviceId: 31 });

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: "Failed to join queue"
        });
    });

    test("POST /api/queue/leave returns 400 when userId is missing", async () => {
        const response = await request(app)
            .post("/api/queue/leave")
            .send({});

        expect(response.statusCode).toBe(400);
        expect(response.body).toEqual({
            error: "Missing userId"
        });
    });

    test("POST /api/queue/leave returns 404 when user is not waiting", async () => {
        db.query.mockResolvedValueOnce([[]]);

        const response = await request(app)
            .post("/api/queue/leave")
            .send({ userId: 1 });

        expect(response.statusCode).toBe(404);
        expect(response.body).toEqual({
            error: "User is not currently waiting in a queue"
        });
    });

    test("POST /api/queue/leave successfully cancels active queue entry", async () => {
        db.query
            .mockResolvedValueOnce([[{
                queue_entry_id: 5,
                queue_id: 10,
                user_id: 1,
                position: 1,
                service_name: "IT Help Desk"
            }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        const response = await request(app)
            .post("/api/queue/leave")
            .send({ userId: 1 });

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({
            message: "User left queue successfully",
            serviceName: "IT Help Desk",
            status: "Canceled"
        });
    });

    test("POST /api/queue/leave returns 500 when database throws error", async () => {
        db.query.mockRejectedValueOnce(new Error("Database failure"));

        const response = await request(app)
            .post("/api/queue/leave")
            .send({ userId: 1 });

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: "Failed to leave queue"
        });
    });

    test("GET /api/queue/status/:userId returns 500 when database throws error", async () => {
        db.query.mockRejectedValueOnce(new Error("Database failure"));

        const response = await request(app).get("/api/queue/status/1");

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: "Failed to retrieve queue stats"
        });
    });

    test("GET /api/queue/history/:userId returns 500 when database throws error", async () => {
        db.query.mockRejectedValueOnce(new Error("Database failure"));

        const response = await request(app).get("/api/queue/history/1");

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: "Failed to retrieve queue history"
        });
    });

    test("GET /api/smart/wait-times returns 500 when database throws error", async () => {
        db.query.mockRejectedValueOnce(new Error("Database failure"));

        const response = await request(app).get("/api/smart/wait-times");

        expect(response.statusCode).toBe(500);
        expect(response.body).toEqual({
            error: "Failed to retrieve wait times"
        });
    });
});
});