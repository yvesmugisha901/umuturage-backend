import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
    getVillageDashboard,
    getPendingUpdates,
    approveUpdate,
    rejectUpdate,
    getVillageReports,
    getVillageNotifications,
    getVillageProfile,
    updateVillageProfile
} from "../controllers/villageController.js";

const router = express.Router();

// Dashboard
router.get("/dashboard", authMiddleware, getVillageDashboard);

// Pending updates
router.get("/pending-updates", authMiddleware, getPendingUpdates);
router.put("/pending-updates/:id/approve", authMiddleware, approveUpdate);
router.put("/pending-updates/:id/reject", authMiddleware, rejectUpdate);

// Reports
router.get("/reports", authMiddleware, getVillageReports);

// Notifications
router.get("/notifications", authMiddleware, getVillageNotifications);

// Settings/Profile
router.get("/profile", authMiddleware, getVillageProfile);
router.put("/profile", authMiddleware, updateVillageProfile);

export default router;
