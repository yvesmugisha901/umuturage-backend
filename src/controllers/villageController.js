import pool from "../config/db.js";

const VILLAGE_LEADER_ROLE_ID = 3;

/**
 * ================================
 * VILLAGE DASHBOARD
 * ================================
 */
export const getVillageDashboard = async (req, res) => {
    try {
        const userId = req.user.id;

        // ✅ Fetch the user's role from the database
        const userRes = await pool.query(
            `SELECT u.id, u.username, r.id AS role_id, r.name AS role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
            [userId]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = userRes.rows[0];

        // ✅ Check if the user is a village leader
        if (user.role_id !== VILLAGE_LEADER_ROLE_ID) {
            return res.status(403).json({ message: "Access denied. Only village leaders allowed." });
        }

        // ✅ Get the village managed by this leader
        const villageRes = await pool.query(
            `SELECT id FROM villages WHERE village_leader_id = $1`,
            [userId]
        );

        if (villageRes.rows.length === 0) {
            return res.json({
                totalHouseholds: 0,
                totalMembers: 0,
                pendingUpdates: 0,
                recentActivity: [],
            });
        }

        const villageId = villageRes.rows[0].id;

        // ✅ Fetch total households
        const householdsRes = await pool.query(
            `SELECT COUNT(*) AS total
       FROM households h
       JOIN isibos i ON h.isibo_id = i.id
       WHERE i.village_id = $1`,
            [villageId]
        );

        // ✅ Fetch total members
        const membersRes = await pool.query(
            `SELECT COALESCE(SUM(h.members), 0) AS total
       FROM households h
       JOIN isibos i ON h.isibo_id = i.id
       WHERE i.village_id = $1`,
            [villageId]
        );

        // ✅ Fetch pending updates
        const pendingRes = await pool.query(
            `SELECT COUNT(*) AS total
       FROM households h
       JOIN isibos i ON h.isibo_id = i.id
       WHERE i.village_id = $1 AND h.status = 'pending'`,
            [villageId]
        );

        // ✅ Fetch recent activity (latest household additions)
        const activityRes = await pool.query(
            `SELECT
          'New household added by Isibo ' || i.name AS message,
          h.date_added AS created_at
       FROM households h
       JOIN isibos i ON h.isibo_id = i.id
       WHERE i.village_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
            [villageId]
        );

        res.json({
            totalHouseholds: Number(householdsRes.rows[0].total),
            totalMembers: Number(membersRes.rows[0].total),
            pendingUpdates: Number(pendingRes.rows[0].total),
            recentActivity: activityRes.rows,
        });
    } catch (error) {
        console.error("Village dashboard error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * ================================
 * GET PENDING UPDATES
 * ================================
 */
export const getPendingUpdates = async (req, res) => {
    try {
        const userId = req.user.id;

        // ✅ Fetch user's role
        const userRes = await pool.query(
            `SELECT u.id, u.username, r.id AS role_id, r.name AS role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
            [userId]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = userRes.rows[0];

        // ✅ Check role
        if (user.role_id !== VILLAGE_LEADER_ROLE_ID) {
            return res.status(403).json({ message: "Access denied. Only village leaders allowed." });
        }

        // ✅ Fetch pending households for this leader's village
        const result = await pool.query(
            `SELECT 
                h.id,
                h.head,
                h.members,
                h.location,
                h.status,
                h.date_added,
                i.name AS isibo_name,
                i.id AS isibo_id
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            WHERE v.village_leader_id = $1
              AND h.status = 'pending'
            ORDER BY h.date_added DESC`,
            [userId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Pending updates error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * ================================
 * APPROVE UPDATE
 * ================================
 */
export const approveUpdate = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Verify the household belongs to this village leader's village
        const householdRes = await pool.query(
            `SELECT h.id
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            WHERE h.id = $1
              AND v.village_leader_id = $2
              AND h.status = 'pending'`,
            [id, userId]
        );

        if (householdRes.rows.length === 0) {
            return res.status(404).json({ message: "Household not found or already processed" });
        }

        // Update status to approved
        await pool.query(
            `UPDATE households SET status = 'approved' WHERE id = $1`,
            [id]
        );

        res.json({ message: "Household approved successfully" });
    } catch (error) {
        console.error("Approve household error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * ================================
 * REJECT UPDATE
 * ================================
 */
export const rejectUpdate = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Verify the household belongs to this village leader's village
        const householdRes = await pool.query(
            `SELECT h.id
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            WHERE h.id = $1
              AND v.village_leader_id = $2
              AND h.status = 'pending'`,
            [id, userId]
        );

        if (householdRes.rows.length === 0) {
            return res.status(404).json({ message: "Household not found or already processed" });
        }

        // Update status to rejected
        await pool.query(
            `UPDATE households SET status = 'rejected' WHERE id = $1`,
            [id]
        );

        res.json({ message: "Household rejected successfully" });
    } catch (error) {
        console.error("Reject household error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * ================================
 * VILLAGE REPORTS
 * ================================
 */
export const getVillageReports = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get the village managed by this leader
        const villageRes = await pool.query(
            `SELECT id FROM villages WHERE village_leader_id = $1`,
            [userId]
        );

        if (villageRes.rows.length === 0) {
            return res.json({
                totalHouseholds: 0,
                totalMembers: 0,
                approvedHouseholds: 0,
                pendingHouseholds: 0,
                rejectedHouseholds: 0,
                isiboBreakdown: [],
                recentActivity: [],
            });
        }

        const villageId = villageRes.rows[0].id;

        // Total households and members
        const totalsRes = await pool.query(
            `SELECT 
                COUNT(*) AS total_households,
                COALESCE(SUM(h.members), 0) AS total_members
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            WHERE i.village_id = $1`,
            [villageId]
        );

        // Approved households
        const approvedRes = await pool.query(
            `SELECT COUNT(*) AS total
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            WHERE i.village_id = $1 AND h.status = 'approved'`,
            [villageId]
        );

        // Pending households
        const pendingRes = await pool.query(
            `SELECT COUNT(*) AS total
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            WHERE i.village_id = $1 AND h.status = 'pending'`,
            [villageId]
        );

        // Rejected households
        const rejectedRes = await pool.query(
            `SELECT COUNT(*) AS total
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            WHERE i.village_id = $1 AND h.status = 'rejected'`,
            [villageId]
        );

        // Breakdown by Isibo
        const isiboBreakdownRes = await pool.query(
            `SELECT 
                i.name AS isibo_name,
                COUNT(h.id) AS total_households,
                COALESCE(SUM(h.members), 0) AS total_members,
                COUNT(CASE WHEN h.status = 'approved' THEN 1 END) AS approved,
                COUNT(CASE WHEN h.status = 'pending' THEN 1 END) AS pending,
                COUNT(CASE WHEN h.status = 'rejected' THEN 1 END) AS rejected
            FROM isibos i
            LEFT JOIN households h ON h.isibo_id = i.id
            WHERE i.village_id = $1
            GROUP BY i.id, i.name
            ORDER BY i.name`,
            [villageId]
        );

        // Recent activity
        const activityRes = await pool.query(
            `SELECT
                'New household added by Isibo ' || i.name AS message,
                h.date_added AS created_at
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            WHERE i.village_id = $1
            ORDER BY created_at DESC
            LIMIT 10`,
            [villageId]
        );

        res.json({
            totalHouseholds: Number(totalsRes.rows[0].total_households),
            totalMembers: Number(totalsRes.rows[0].total_members),
            approvedHouseholds: Number(approvedRes.rows[0].total),
            pendingHouseholds: Number(pendingRes.rows[0].total),
            rejectedHouseholds: Number(rejectedRes.rows[0].total),
            isiboBreakdown: isiboBreakdownRes.rows,
            recentActivity: activityRes.rows,
        });
    } catch (error) {
        console.error("Village reports error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
/**
 * ================================
 * VILLAGE NOTIFICATIONS
 * ================================
 */
export const getVillageNotifications = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get the village managed by this leader
        const villageRes = await pool.query(
            `SELECT id FROM villages WHERE village_leader_id = $1`,
            [userId]
        );

        if (villageRes.rows.length === 0) {
            return res.json([]); // No village, no notifications
        }

        const villageId = villageRes.rows[0].id;

        // Get notifications for all isibos in this village
        const result = await pool.query(
            `SELECT n.*, i.name as isibo_name
            FROM notifications n
            JOIN users u ON n.isibo_leader_id = u.id
            JOIN isibos i ON u.id = i.isibo_leader_id
            WHERE i.village_id = $1
            ORDER BY n.created_at DESC`,
            [villageId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Village notifications error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
/**
 * ================================
 * VILLAGE SETTINGS
 * ================================
 */
export const getVillageSettings = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(
            `SELECT id, username, email FROM users WHERE id = $1`,
            [userId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

export const updateVillageSettings = async (req, res) => {
    const { username, email } = req.body;
    const userId = req.user.id;

    try {
        await pool.query(
            `UPDATE users SET username = $1, email = $2 WHERE id = $3`,
            [username, email, userId]
        );

        res.json({ message: "Settings updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};