import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";  // <-- import routes after dotenv & pool
import isiboRoutes from "./routes/isiboRoutes.js";

app.use("/api/isibo", isiboRoutes);
dotenv.config();

const app = express(); // <-- app must be declared BEFORE using it

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/users", userRoutes);

// Test route
app.get("/", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json({ message: "Umuturage API running...", time: result.rows[0].now });
    } catch (err) {
        res.status(500).json({ error: "Database connection error", details: err });
    }
});

app.listen(process.env.PORT, () => {
    console.log("Server running on port", process.env.PORT);
});
