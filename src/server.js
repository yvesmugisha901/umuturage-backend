// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./config/db.js";

// Routes
import userRoutes from "./routes/userRoutes.js";
import isiboRoutes from "./routes/isiboRoutes.js";
import villageRoutes from "./routes/villageRoutes.js"; // includes dashboard, notifications, profile, settings

// Load environment variables
dotenv.config();

// Create server
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Mount routes
app.use("/api/users", userRoutes);
app.use("/api/isibo", isiboRoutes);
app.use("/api/village", villageRoutes); // all village-related routes including settings/profile

// Test route
app.get("/", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");
        res.json({ message: "Umuturage API running...", time: result.rows[0].now });
    } catch (err) {
        res.status(500).json({ error: "Database connection error", details: err });
    }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
