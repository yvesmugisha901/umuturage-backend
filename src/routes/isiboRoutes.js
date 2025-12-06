import express from "express";
import {
    addHousehold,
    getHouseholds,
    updateHousehold,
    deleteHousehold,
    getReports,
    getNotifications,
    addNotification,
    markNotificationRead,
    markAllNotificationsRead, // ✅ Added here
} from "../controllers/isiboController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// ---------------- HOUSEHOLDS ----------------
// Add household (only isibo leader)
router.post("/households", authMiddleware, addHousehold);

// Get all households belonging to this isibo leader
router.get("/households", authMiddleware, getHouseholds);

// Update a household
router.put("/households/:id", authMiddleware, updateHousehold);

// Delete a household
router.delete("/households/:id", authMiddleware, deleteHousehold);

// ---------------- REPORTS ----------------
// Get report summary (total households, total members, pending, weekly data)
router.get("/reports", authMiddleware, getReports);

// ---------------- NOTIFICATIONS ----------------
// Get all notifications for this isibo leader
router.get("/notifications", authMiddleware, getNotifications);

// Add a notification manually (if needed)
router.post("/notifications", authMiddleware, addNotification);

// Mark a single notification as read
router.put("/notifications/:id/read", authMiddleware, markNotificationRead);

// Mark all notifications as read
router.put("/notifications/read-all", authMiddleware, markAllNotificationsRead);

export default router;
