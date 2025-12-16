import pool from "../config/db.js";

/* =====================================================
   VILLAGE DASHBOARD
===================================================== */
export const getVillageDashboard = async (req, res) => {
    try {
        const villageLeaderId = req.user.id;

        // Get isibos under this village leader
        const isibosResult = await pool.query(
            `SELECT id FROM isibos WHERE isibo_leader_id = $1`,
            [villageLeaderId]
        );

        const isiboIds = isibosResult.rows.map(i => i.id);

        if (isiboIds.length === 0) {
            return res.json({
                totalHouseholds: 0,
                totalMembers: 0,
                pendingUpdates: 0,
                recentActivity: []
            });
        }

        const householdsResult = await pool.query(
            `SELECT COUNT(*) FROM households WHERE isibo_id = ANY($1)`,
            [isiboIds]
        );

        const membersResult = await pool.query(
            `SELECT COALESCE(SUM(members),0) FROM households WHERE isibo_id = ANY($1)`,
            [isiboIds]
        );

        const pendingResult = await pool.query(
            `SELECT COUNT(*) FROM pending_updates 
       WHERE status='pending' AND isibo_id = ANY($1)`,
            [isiboIds]
        );

        const activityResult = await pool.query(
            `SELECT message, created_at 
       FROM notifications 
       WHERE isibo_leader_id = ANY($1)
       ORDER BY created_at DESC
       LIMIT 5`,
            [isiboIds]
        );

        res.json({
            totalHouseholds: Number(householdsResult.rows[0].count),
            totalMembers: Number(membersResult.rows[0].coalesce),
            pendingUpdates: Number(pendingResult.rows[0].count),
            recentActivity: activityResult.rows
        });
    } catch (error) {
        console.error("getVillageDashboard error:", error);
        res.status(500).json({ message: "Dashboard error" });
    }
};

/* =====================================================
   PENDING UPDATES
===================================================== */
export const getPendingUpdates = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT pu.id, pu.change_type, pu.date_submitted,
              u.username AS submitted_by, i.name AS isibo_name
       FROM pending_updates pu
       JOIN users u ON pu.submitted_by = u.id
       JOIN isibos i ON pu.isibo_id = i.id
       WHERE pu.status='pending'
       ORDER BY pu.date_submitted DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error("getPendingUpdates error:", error);
        res.status(500).json({ message: "Failed to fetch pending updates" });
    }
};

export const approveUpdate = async (req, res) => {
    try {
        await pool.query(
            `UPDATE pending_updates 
       SET status='approved', date_updated=CURRENT_TIMESTAMP 
       WHERE id=$1`,
            [req.params.id]
        );

        res.json({ message: "Update approved successfully" });
    } catch (error) {
        console.error("approveUpdate error:", error);
        res.status(500).json({ message: "Failed to approve update" });
    }
};

export const rejectUpdate = async (req, res) => {
    try {
        await pool.query(
            `UPDATE pending_updates 
       SET status='rejected', date_updated=CURRENT_TIMESTAMP 
       WHERE id=$1`,
            [req.params.id]
        );

        res.json({ message: "Update rejected successfully" });
    } catch (error) {
        console.error("rejectUpdate error:", error);
        res.status(500).json({ message: "Failed to reject update" });
    }
};

/* =====================================================
   VILLAGE REPORTS
===================================================== */
export const getVillageReports = async (req, res) => {
    try {
        const villageLeaderId = req.user.id;

        const isibosResult = await pool.query(
            `SELECT id FROM isibos WHERE isibo_leader_id = $1`,
            [villageLeaderId]
        );

        const isiboIds = isibosResult.rows.map(i => i.id);

        if (isiboIds.length === 0) {
            return res.json({
                totalHouseholds: 0,
                totalMembers: 0,
                recentActivity: []
            });
        }

        const households = await pool.query(
            `SELECT COUNT(*) FROM households WHERE isibo_id = ANY($1)`,
            [isiboIds]
        );

        const members = await pool.query(
            `SELECT COALESCE(SUM(members),0) FROM households WHERE isibo_id = ANY($1)`,
            [isiboIds]
        );

        res.json({
            totalHouseholds: Number(households.rows[0].count),
            totalMembers: Number(members.rows[0].coalesce),
            recentActivity: []
        });
    } catch (error) {
        console.error("getVillageReports error:", error);
        res.status(500).json({ message: "Failed to fetch reports" });
    }
};

/* =====================================================
   VILLAGE NOTIFICATIONS
===================================================== */
export const getVillageNotifications = async (req, res) => {
    try {
        const villageLeaderId = req.user.id;

        const isibosResult = await pool.query(
            `SELECT id FROM isibos WHERE isibo_leader_id = $1`,
            [villageLeaderId]
        );

        const isiboIds = isibosResult.rows.map(i => i.id);

        if (isiboIds.length === 0) return res.json([]);

        const notificationsResult = await pool.query(
            `SELECT message, created_at 
       FROM notifications 
       WHERE isibo_leader_id = ANY($1)
       ORDER BY created_at DESC`,
            [isiboIds]
        );

        res.json(notificationsResult.rows);
    } catch (error) {
        console.error("getVillageNotifications error:", error);
        res.status(500).json({ message: "Failed to fetch notifications" });
    }
};

/* =====================================================
   VILLAGE PROFILE
===================================================== */
export const getVillageProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT u.id, u.username, u.email, r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("getVillageProfile error:", error);
        res.status(500).json({ message: "Failed to fetch profile" });
    }
};

export const updateVillageProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { username, email } = req.body;

        await pool.query(
            `UPDATE users 
       SET username=$1, email=$2, updated_at=CURRENT_TIMESTAMP
       WHERE id=$3`,
            [username, email, userId]
        );

        res.json({ message: "Profile updated successfully" });
    } catch (error) {
        console.error("updateVillageProfile error:", error);
        res.status(500).json({ message: "Failed to update profile" });
    }
};
