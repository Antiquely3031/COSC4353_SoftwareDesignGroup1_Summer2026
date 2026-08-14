console.log("server.js started");

const express = require("express");
const cors = require("cors");
require("dotenv").config();
const db = require("./db");
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
    res.send("QueueSmart backend is running");
});
// Test link to copy-paste in browser to observe: http://localhost:3000/api/services
app.get("/api/services", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT service_id, service_name, description, expected_duration, priority_level FROM Service"
        );
        res.json(rows);
    }
    catch (error) {
        console.error("Error retrieving services", error);
        res.status(500).json({
            error: "Failed to retrieve services"
        });
    }
});

// implementing POST execution for a /api/queue/join endpoint
app.post("/api/queue/join", async (req, res) => {
    try {
        const { userId, serviceId } = req.body;

        if (!userId || !serviceId) {
            return res.status(400).json({
                error: "Missing userId or serviceId"
            });
        }
        //a change of plan when transiting to the remote database patrick planned instead, however userID = 1 isnt sufficient becuase the
        //possibility of not existing is very likely so we adapt to be flexible with user ID's
        const [userRows] = await db.query(
            "SELECT user_id FROM UserCredentials WHERE user_id = ?",
            [userId]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                error: "User does not exist. Please log in with a valid user account."
            });
        }
        const [queues] = await db.query(
            "SELECT queue_id FROM `Queue` WHERE service_id = ? AND status = 'open'",
            [serviceId]
        );

        if (queues.length === 0) {
            return res.status(404).json({
                error: "No open queue found for this service"
            });
        }

        const queueId = queues[0].queue_id;
        //so far we can only allow one queue entry per user, option of allowing user to join
        //multiple queue but not twice of the same queue 
        // const [existing] = await db.query(
        //     "SELECT queue_entry_id FROM QueueEntry WHERE user_id = ? AND status = 'waiting'",
        //     [userId]
        // );

        //this version will allow user to join multiple queue
        //BUT cannot join duplicate queues of same service
        const [existing] = await db.query(
            `SELECT queue_entry_id 
            FROM QueueEntry 
            WHERE user_id = ? 
                AND queue_id = ? 
                AND status = 'waiting'`,
            [userId, queueId]
        );
        if (existing.length > 0) {
            return res.status(400).json({
                error: "User is already waiting in a queue waiting for this service"
            });
        }

        const [positionRows] = await db.query(
            "SELECT COUNT(*) AS count FROM QueueEntry WHERE queue_id = ? AND status = 'waiting'",
            [queueId]
        );

        const position = positionRows[0].count + 1;

        await db.query(
            "INSERT INTO QueueEntry (queue_id, user_id, position, status) VALUES (?, ?, ?, 'waiting')",
            [queueId, userId, position]
        );

        const [serviceRows] = await db.query(
            "SELECT service_name, expected_duration FROM Service WHERE service_id = ?",
            [serviceId]
        );

        const service = serviceRows[0];

        res.json({
            serviceId: serviceId,
            serviceName: service.service_name,
            position: position,
            estimatedWait: position * service.expected_duration,
            status: "Waiting"
        });

    } catch (error) {
        console.error("Error joining queue:", error);

        res.status(500).json({
            error: "Failed to join queue"
        });
    }
});

//leave queue endpoint
app.post("/api/queue/leave", async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                error: "Missing userId"
            });
        }

        const [activeRows] = await db.query(
            `SELECT qe.queue_entry_id, qe.queue_id, qe.user_id, qe.position, s.service_name
             FROM QueueEntry qe
             JOIN \`Queue\` q ON qe.queue_id = q.queue_id
             JOIN Service s ON q.service_id = s.service_id
             WHERE qe.user_id = ? AND qe.status = 'waiting'
             LIMIT 1`,
            [userId]
        );

        if (activeRows.length === 0) {
            return res.status(404).json({
                error: "User is not currently waiting in a queue"
            });
        }

        const activeEntry = activeRows[0];

        await db.query(
            `UPDATE QueueEntry
             SET status = 'canceled'
             WHERE queue_entry_id = ?`,
            [activeEntry.queue_entry_id]
        );

        res.json({
            message: "User left queue successfully",
            serviceName: activeEntry.service_name,
            status: "Canceled"
        });

    } catch (error) {
        console.error("Error leaving queue:", error);

        res.status(500).json({
            error: "Failed to leave queue"
        });
    }
});

//to get current queue status for user
app.get("/api/queue/status/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const [rows] = await db.query(
            `SELECT 
                qe.queue_entry_id,
                qe.queue_id,
                qe.user_id,
                qe.position,
                qe.join_time,
                qe.status,
                s.service_id,
                s.service_name,
                s.expected_duration
             FROM QueueEntry qe
             JOIN \`Queue\` q ON qe.queue_id = q.queue_id
             JOIN Service s ON q.service_id = s.service_id
             WHERE qe.user_id = ? AND qe.status = 'waiting'
             LIMIT 1`,
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: "user currently not in queue"
            });
        }

        const entry = rows[0];

        res.json({
            userId: entry.user_id,
            serviceId: entry.service_id,
            serviceName: entry.service_name,
            queueEntryId: entry.queue_entry_id,
            queueId: entry.queue_id,
            position: entry.position,
            estimatedWait: entry.position * entry.expected_duration,
            joinedAt: entry.join_time,
            status: entry.status
        });
    }
    catch (error) {
        console.error("Error retrieving status of queue for user", error);
        res.status(500).json({
            error: "Failed to retrieve queue stats"
        })
    }
});
//to get queue history of the user
app.get("/api/queue/history/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const [rows] = await db.query(
            `SELECT 
                qe.queue_entry_id,
                qe.queue_id,
                qe.user_id,
                qe.position,
                qe.join_time,
                qe.status,
                s.service_name,
                s.expected_duration
             FROM QueueEntry qe
             JOIN \`Queue\` q ON qe.queue_id = q.queue_id
             JOIN Service s ON q.service_id = s.service_id
             WHERE qe.user_id = ?
             ORDER BY qe.join_time DESC`,
            [userId]
        );

        res.json(rows);
    }
    catch (error) {
        console.error("Error retrieving queue history for user", error);
        res.status(500).json({
            error: "Failed to retrieve queue history"
        });
    }
});
app.get("/api/smart/wait-times", async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT 
                s.service_id,
                s.service_name,
                s.expected_duration,
                COUNT(qe.queue_entry_id) AS waiting_count,
                COUNT(qe.queue_entry_id) * s.expected_duration AS estimated_wait
             FROM Service s
             JOIN \`Queue\` q 
                ON s.service_id = q.service_id
             LEFT JOIN QueueEntry qe 
                ON q.queue_id = qe.queue_id 
                AND qe.status = 'waiting'
             WHERE q.status = 'open'
             GROUP BY s.service_id, s.service_name, s.expected_duration
             ORDER BY estimated_wait ASC`
        );
        res.json(rows);
    }
    catch (error) {
        console.log("Error retrieving with wait times", error);
        res.status(500).json({
            error: "Failed to retrieve wait times"
        });
    }
});
const PORT = process.env.PORT || 3000;

//Connection testing, if this appears we have a successful commection
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`QueueSmart backend running on http://localhost:${PORT}`);
    });
}

// Export app so Supertest can test the routes.
module.exports = app;