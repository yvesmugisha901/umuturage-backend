import pool from "../config/db.js";

const CELL_LEADER_ROLE_ID = 4;

/**
 * ================================
 * CELL DASHBOARD
 * ================================
 */
export const getCellDashboard = async (req, res) => {
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

        // ✅ Check if the user is a cell leader
        if (user.role_id !== CELL_LEADER_ROLE_ID) {
            return res.status(403).json({ message: "Access denied. Only cell leaders allowed." });
        }

        // ✅ Get the cell managed by this leader
        const cellRes = await pool.query(
            `SELECT id FROM cells WHERE cell_leader_id = $1`,
            [userId]
        );

        if (cellRes.rows.length === 0) {
            return res.json({
                totalVillages: 0,
                totalHouseholds: 0,
                totalMembers: 0,
                pendingApprovals: 0,
                recentActivity: [],
            });
        }

        const cellId = cellRes.rows[0].id;

        // ✅ Fetch total villages
        const villagesRes = await pool.query(
            `SELECT COUNT(*) AS total
             FROM villages
             WHERE cell_id = $1`,
            [cellId]
        );

        // ✅ Fetch total households (from all villages in this cell)
        const householdsRes = await pool.query(
            `SELECT COUNT(*) AS total
             FROM households h
             JOIN isibos i ON h.isibo_id = i.id
             JOIN villages v ON i.village_id = v.id
             WHERE v.cell_id = $1`,
            [cellId]
        );

        // ✅ Fetch total members
        const membersRes = await pool.query(
            `SELECT COALESCE(SUM(h.members), 0) AS total
             FROM households h
             JOIN isibos i ON h.isibo_id = i.id
             JOIN villages v ON i.village_id = v.id
             WHERE v.cell_id = $1`,
            [cellId]
        );

        // ✅ Fetch pending approvals (households approved by village but pending at cell level)
        const pendingRes = await pool.query(
            `SELECT COUNT(*) AS total
             FROM households h
             JOIN isibos i ON h.isibo_id = i.id
             JOIN villages v ON i.village_id = v.id
             WHERE v.cell_id = $1 AND h.status = 'approved'`,
            [cellId]
        );

        // ✅ Fetch recent activity (latest household approvals from villages)
        const activityRes = await pool.query(
            `SELECT
                'Village ' || v.name || ' approved household from Isibo ' || i.name AS message,
                h.date_added AS created_at
             FROM households h
             JOIN isibos i ON h.isibo_id = i.id
             JOIN villages v ON i.village_id = v.id
             WHERE v.cell_id = $1 AND h.status = 'approved'
             ORDER BY h.date_added DESC
             LIMIT 5`,
            [cellId]
        );

        res.json({
            totalVillages: Number(villagesRes.rows[0].total),
            totalHouseholds: Number(householdsRes.rows[0].total),
            totalMembers: Number(membersRes.rows[0].total),
            pendingApprovals: Number(pendingRes.rows[0].total),
            recentActivity: activityRes.rows,
        });
    } catch (error) {
        console.error("Cell dashboard error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * ================================
 * GET PENDING APPROVALS FROM VILLAGES
 * ================================
 */
export const getPendingApprovals = async (req, res) => {
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
        if (user.role_id !== CELL_LEADER_ROLE_ID) {
            return res.status(403).json({ message: "Access denied. Only cell leaders allowed." });
        }

        // ✅ Fetch households approved by villages but pending at cell level
        const result = await pool.query(
            `SELECT 
                h.id,
                h.head,
                h.members,
                h.location,
                h.status,
                h.date_added,
                i.name AS isibo_name,
                i.id AS isibo_id,
                v.name AS village_name,
                v.id AS village_id,
                u.username AS village_leader_name
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            LEFT JOIN users u ON v.village_leader_id = u.id
            JOIN cells c ON v.cell_id = c.id
            WHERE c.cell_leader_id = $1
              AND h.status = 'approved'
            ORDER BY h.date_added DESC`,
            [userId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Pending approvals error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * ================================
 * APPROVE VILLAGE SUBMISSION (CELL LEVEL)
 * ================================
 */
export const approveVillageData = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Verify the household belongs to this cell leader's cell
        const householdRes = await pool.query(
            `SELECT h.id
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            JOIN cells c ON v.cell_id = c.id
            WHERE h.id = $1
              AND c.cell_leader_id = $2
              AND h.status = 'approved'`,
            [id, userId]
        );

        if (householdRes.rows.length === 0) {
            return res.status(404).json({ message: "Household not found or already processed" });
        }

        // Update status to cell_approved (or you can add a new column cell_approved_at)
        await pool.query(
            `UPDATE households 
             SET status = 'cell_approved', 
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [id]
        );

        res.json({ message: "Household approved at cell level successfully" });
    } catch (error) {
        console.error("Approve village data error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * ================================
 * REJECT VILLAGE SUBMISSION (CELL LEVEL)
 * ================================
 */
export const rejectVillageData = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Verify the household belongs to this cell leader's cell
        const householdRes = await pool.query(
            `SELECT h.id
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            JOIN cells c ON v.cell_id = c.id
            WHERE h.id = $1
              AND c.cell_leader_id = $2
              AND h.status = 'approved'`,
            [id, userId]
        );

        if (householdRes.rows.length === 0) {
            return res.status(404).json({ message: "Household not found or already processed" });
        }

        // Update status back to pending (send back to village)
        await pool.query(
            `UPDATE households 
             SET status = 'pending', 
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [id]
        );

        res.json({ message: "Household rejected and sent back to village" });
    } catch (error) {
        console.error("Reject village data error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * ================================
 * GET VILLAGES UNDER THIS CELL
 * ================================
 */
export const getManagedVillages = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get the cell managed by this leader
        const cellRes = await pool.query(
            `SELECT id FROM cells WHERE cell_leader_id = $1`,
            [userId]
        );

        if (cellRes.rows.length === 0) {
            return res.json([]);
        }

        const cellId = cellRes.rows[0].id;

        // Get all villages with their statistics
        const result = await pool.query(
            `SELECT 
                v.id,
                v.name,
                u.username AS village_leader_name,
                COUNT(DISTINCT i.id) AS total_isibos,
                COUNT(h.id) AS total_households,
                COALESCE(SUM(h.members), 0) AS total_members,
                COUNT(CASE WHEN h.status = 'approved' THEN 1 END) AS approved,
                COUNT(CASE WHEN h.status = 'pending' THEN 1 END) AS pending,
                COUNT(CASE WHEN h.status = 'cell_approved' THEN 1 END) AS cell_approved
            FROM villages v
            LEFT JOIN users u ON v.village_leader_id = u.id
            LEFT JOIN isibos i ON i.village_id = v.id
            LEFT JOIN households h ON h.isibo_id = i.id
            WHERE v.cell_id = $1
            GROUP BY v.id, v.name, u.username
            ORDER BY v.name`,
            [cellId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Managed villages error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * ================================
 * CELL REPORTS
 * ================================
 */
export const getCellReports = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get the cell managed by this leader
        const cellRes = await pool.query(
            `SELECT id, name FROM cells WHERE cell_leader_id = $1`,
            [userId]
        );

        if (cellRes.rows.length === 0) {
            return res.json({
                cellName: "",
                totalVillages: 0,
                totalIsibos: 0,
                totalHouseholds: 0,
                totalMembers: 0,
                approvedHouseholds: 0,
                pendingHouseholds: 0,
                cellApprovedHouseholds: 0,
                rejectedHouseholds: 0,
                villageBreakdown: [],
                recentActivity: [],
            });
        }

        const cellId = cellRes.rows[0].id;
        const cellName = cellRes.rows[0].name;

        // Total villages
        const villagesRes = await pool.query(
            `SELECT COUNT(*) AS total FROM villages WHERE cell_id = $1`,
            [cellId]
        );

        // Total isibos
        const isibosRes = await pool.query(
            `SELECT COUNT(*) AS total
             FROM isibos i
             JOIN villages v ON i.village_id = v.id
             WHERE v.cell_id = $1`,
            [cellId]
        );

        // Total households and members
        const totalsRes = await pool.query(
            `SELECT 
                COUNT(*) AS total_households,
                COALESCE(SUM(h.members), 0) AS total_members
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            WHERE v.cell_id = $1`,
            [cellId]
        );

        // Approved by village (pending at cell)
        const approvedRes = await pool.query(
            `SELECT COUNT(*) AS total
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            WHERE v.cell_id = $1 AND h.status = 'approved'`,
            [cellId]
        );

        // Pending at village
        const pendingRes = await pool.query(
            `SELECT COUNT(*) AS total
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            WHERE v.cell_id = $1 AND h.status = 'pending'`,
            [cellId]
        );

        // Approved by cell
        const cellApprovedRes = await pool.query(
            `SELECT COUNT(*) AS total
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            WHERE v.cell_id = $1 AND h.status = 'cell_approved'`,
            [cellId]
        );

        // Rejected
        const rejectedRes = await pool.query(
            `SELECT COUNT(*) AS total
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            WHERE v.cell_id = $1 AND h.status = 'rejected'`,
            [cellId]
        );

        // Breakdown by Village
        const villageBreakdownRes = await pool.query(
            `SELECT 
                v.name AS village_name,
                u.username AS village_leader,
                COUNT(DISTINCT i.id) AS total_isibos,
                COUNT(h.id) AS total_households,
                COALESCE(SUM(h.members), 0) AS total_members,
                COUNT(CASE WHEN h.status = 'approved' THEN 1 END) AS approved,
                COUNT(CASE WHEN h.status = 'pending' THEN 1 END) AS pending,
                COUNT(CASE WHEN h.status = 'cell_approved' THEN 1 END) AS cell_approved,
                COUNT(CASE WHEN h.status = 'rejected' THEN 1 END) AS rejected
            FROM villages v
            LEFT JOIN users u ON v.village_leader_id = u.id
            LEFT JOIN isibos i ON i.village_id = v.id
            LEFT JOIN households h ON h.isibo_id = i.id
            WHERE v.cell_id = $1
            GROUP BY v.id, v.name, u.username
            ORDER BY v.name`,
            [cellId]
        );

        // Recent activity
        const activityRes = await pool.query(
            `SELECT
                'Village ' || v.name || ' - Household from Isibo ' || i.name AS message,
                h.date_added AS created_at,
                h.status
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            WHERE v.cell_id = $1
            ORDER BY h.date_added DESC
            LIMIT 10`,
            [cellId]
        );

        res.json({
            cellName,
            totalVillages: Number(villagesRes.rows[0].total),
            totalIsibos: Number(isibosRes.rows[0].total),
            totalHouseholds: Number(totalsRes.rows[0].total_households),
            totalMembers: Number(totalsRes.rows[0].total_members),
            approvedHouseholds: Number(approvedRes.rows[0].total),
            pendingHouseholds: Number(pendingRes.rows[0].total),
            cellApprovedHouseholds: Number(cellApprovedRes.rows[0].total),
            rejectedHouseholds: Number(rejectedRes.rows[0].total),
            villageBreakdown: villageBreakdownRes.rows,
            recentActivity: activityRes.rows,
        });
    } catch (error) {
        console.error("Cell reports error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * ================================
 * CELL NOTIFICATIONS
 * ================================
 */
export const getCellNotifications = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get the cell managed by this leader
        const cellRes = await pool.query(
            `SELECT id FROM cells WHERE cell_leader_id = $1`,
            [userId]
        );

        if (cellRes.rows.length === 0) {
            return res.json([]);
        }

        const cellId = cellRes.rows[0].id;

        // Get notifications from all villages in this cell
        const result = await pool.query(
            `SELECT n.*, v.name as village_name
            FROM notifications n
            JOIN users u ON n.isibo_leader_id = u.id
            JOIN isibos i ON u.id = i.isibo_leader_id
            JOIN villages v ON i.village_id = v.id
            WHERE v.cell_id = $1
            ORDER BY n.created_at DESC`,
            [cellId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Cell notifications error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * ================================
 * CELL SETTINGS
 * ================================
 */
export const getCellSettings = async (req, res) => {
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

export const updateCellSettings = async (req, res) => {
    const { username, email } = req.body;
    const userId = req.user.id;

    try {
        await pool.query(
            `UPDATE users SET username = $1, email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [username, email, userId]
        );

        res.json({ message: "Settings updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};
