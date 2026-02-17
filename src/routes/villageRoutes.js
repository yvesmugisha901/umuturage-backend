import express from "express";
import {
    getVillageDashboard,
    getPendingUpdates,
    approveUpdate,
    rejectUpdate,
    getVillageReports,
    getVillageNotifications,
    getVillageSettings,
    updateVillageSettings
} from "../controllers/villageController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/dashboard", getVillageDashboard);

router.get("/pending-updates", getPendingUpdates);
router.put("/pending-updates/:id/approve", approveUpdate);
router.put("/pending-updates/:id/reject", rejectUpdate);

router.get("/reports", getVillageReports);
router.get("/notifications", getVillageNotifications);

router.get("/settings", getVillageSettings);
router.put("/settings", updateVillageSettings);

export default router;
