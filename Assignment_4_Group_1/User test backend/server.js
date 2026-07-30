console.log("server.js started");

const express = require("express");
const cors = require("cors");
require("dotenv").config();
const db = require("./db");
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", async(req, res) => {
    res.send("QueueSmart backend is running");
});
// Test link to copy-paste in browser to observe: http://localhost:3000/api/services
app.get("/api/services", async (req, res) => {
    try{
        const [rows] = await db.query(
            "SELECT service_id, service_name, description, expected_duration, priority_level FROM Service"
        );
        res.json(rows);
    }
    catch(error)
    {
        console.error("Error retrieving services", error);
        res.status(500).json({
                error: "Failed to retrieve services"
        });
    }
});

const PORT = process.env.PORT || 3000;
//Connection testing, if this appears we have a successful commection
app.listen(PORT, () => {
    console.log(`QueueSmart backend running on http://localhost:${PORT}`);
});