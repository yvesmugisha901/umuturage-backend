import express from "express";
import { addHousehold, getHouseholds } from "../controllers/isiboController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Add household (only isibo leader)
router.post("/households", authMiddleware, addHousehold);

// Get all households belonging to this isibo leader
router.get("/households", authMiddleware, getHouseholds);

export default router;
