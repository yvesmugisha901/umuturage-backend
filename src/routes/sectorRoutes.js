import express from "express";
import {
    getSectorDashboard,
    getPendingApprovals,
    approveCellData,
    rejectCellData,
    getManagedCells,
    getSectorReports,
    getSectorNotifications,
    getSectorSettings,
    updateSectorSettings,
} from "../controllers/sectorController.js";
import authenticateToken from "../middleware/authMiddleware.js";

const router = express.Router();

// ✅ All routes require authentication
router.use(authenticateToken);

// Sector Dashboard
router.get("/dashboard", getSectorDashboard);

// Pending approvals from cells
router.get("/pending-approvals", getPendingApprovals);

// Approve/Reject cell data
router.put("/pending-approvals/:id/approve", approveCellData);
router.put("/pending-approvals/:id/reject", rejectCellData);

// Managed cells
router.get("/cells", getManagedCells);

// Reports
router.get("/reports", getSectorReports);

// Notifications
router.get("/notifications", getSectorNotifications);

// Settings
router.get("/settings", getSectorSettings);
router.put("/settings", updateSectorSettings);

export default router;
