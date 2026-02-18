import express from "express";
import {
    getCellDashboard,
    getPendingApprovals,
    approveVillageData,
    rejectVillageData,
    getManagedVillages,
    getCellReports,
    getCellNotifications,
    getCellSettings,
    updateCellSettings,
} from "../controllers/cellController.js";
import authenticateToken  from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ All routes require authentication
router.use(authenticateToken);

// Cell Dashboard
router.get("/dashboard", getCellDashboard);

// Pending approvals from villages
router.get("/pending-approvals", getPendingApprovals);

// Approve/Reject village data
router.put("/pending-approvals/:id/approve", approveVillageData);
router.put("/pending-approvals/:id/reject", rejectVillageData);

// Managed villages
router.get("/villages", getManagedVillages);

// Reports
router.get("/reports", getCellReports);

// Notifications
router.get("/notifications", getCellNotifications);

// Settings
router.get("/settings", getCellSettings);
router.put("/settings", updateCellSettings);

export default router;
