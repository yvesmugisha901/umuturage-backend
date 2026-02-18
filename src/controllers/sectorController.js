import pool from "../config/db.js";

const SECTOR_LEADER_ROLE_ID = 5;

/**
 * ================================
 * SECTOR DASHBOARD
 * ================================
 */
export const getSectorDashboard = async (req, res) => {
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

        // ✅ Check if the user is a sector leader
        if (user.role_id !== SECTOR_LEADER_ROLE_ID) {
            return res.status(403).json({ message: "Access denied. Only sector leaders allowed." });
        }

        // ✅ Get the sector managed by this leader
        const sectorRes = await pool.query(
            `SELECT id FROM sectors WHERE sector_leader_id = $1`,
            [userId]
        );

        if (sectorRes.rows.length === 0) {
            return res.json({
                totalCells: 0,
                totalVillages: 0,
                totalHouseholds: 0,
                totalMembers: 0,
                pendingApprovals: 0,
                recentActivity: [],
            });
        }

        const sectorId = sectorRes.rows[0].id;

        // ✅ Fetch total cells
        const cellsRes = await pool.query(
            `SELECT COUNT(*) AS total
             FROM cells
             WHERE sector_id = $1`,
            [sectorId]
        );

        // ✅ Fetch total villages
        const villagesRes = await pool.query(
            `SELECT COUNT(*) AS total
             FROM villages v
             JOIN cells c ON v.cell_id = c.id
             WHERE c.sector_id = $1`,
            [sectorId]
        );

        // ✅ Fetch total households
        const householdsRes = await pool.query(
            `SELECT COUNT(*) AS total
             FROM households h
             JOIN isibos i ON h.isibo_id = i.id
             JOIN villages v ON i.village_id = v.id
             JOIN cells c ON v.cell_id = c.id
             WHERE c.sector_id = $1`,
            [sectorId]
        );

        // ✅ Fetch total members
        const membersRes = await pool.query(
            `SELECT COALESCE(SUM(h.members), 0) AS total
             FROM households h
             JOIN isibos i ON h.isibo_id = i.id
             JOIN villages v ON i.village_id = v.id
             JOIN cells c ON v.cell_id = c.id
             WHERE c.sector_id = $1`,
            [sectorId]
        );

        // ✅ Fetch pending approvals (households approved by cells but pending at sector level)
        const pendingRes = await pool.query(
            `SELECT COUNT(*) AS total
             FROM households h
             JOIN isibos i ON h.isibo_id = i.id
             JOIN villages v ON i.village_id = v.id
             JOIN cells c ON v.cell_id = c.id
             WHERE c.sector_id = $1 AND h.status = 'cell_approved'`,
            [sectorId]
        );

        // ✅ Fetch recent activity
        const activityRes = await pool.query(
            `SELECT
                'Cell ' || c.name || ' approved household from Village ' || v.name AS message,
                h.updated_at AS created_at
             FROM households h
             JOIN isibos i ON h.isibo_id = i.id
             JOIN villages v ON i.village_id = v.id
             JOIN cells c ON v.cell_id = c.id
             WHERE c.sector_id = $1 AND h.status = 'cell_approved'
             ORDER BY h.updated_at DESC
             LIMIT 5`,
            [sectorId]
        );

        res.json({
            totalCells: Number(cellsRes.rows[0].total),
            totalVillages: Number(villagesRes.rows[0].total),
            totalHouseholds: Number(householdsRes.rows[0].total),
            totalMembers: Number(membersRes.rows[0].total),
            pendingApprovals: Number(pendingRes.rows[0].total),
            recentActivity: activityRes.rows,
        });
    } catch (error) {
        console.error("Sector dashboard error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * ================================
 * GET PENDING APPROVALS FROM CELLS
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
        if (user.role_id !== SECTOR_LEADER_ROLE_ID) {
            return res.status(403).json({ message: "Access denied. Only sector leaders allowed." });
        }

        // ✅ Fetch households approved by cells but pending at sector level
        const result = await pool.query(
            `SELECT 
                h.id,
                h.head,
                h.members,
                h.location,
                h.status,
                h.date_added,
                h.cell_approved_at,
                i.name AS isibo_name,
                i.id AS isibo_id,
                v.name AS village_name,
                v.id AS village_id,
                c.name AS cell_name,
                c.id AS cell_id,
                u.username AS cell_leader_name
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            JOIN cells c ON v.cell_id = c.id
            LEFT JOIN users u ON c.cell_leader_id = u.id
            JOIN sectors s ON c.sector_id = s.id
            WHERE s.sector_leader_id = $1
              AND h.status = 'cell_approved'
            ORDER BY h.cell_approved_at DESC`,
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
 * APPROVE CELL SUBMISSION (SECTOR LEVEL)
 * ================================
 */
export const approveCellData = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Verify the household belongs to this sector leader's sector
        const householdRes = await pool.query(
            `SELECT h.id
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            JOIN cells c ON v.cell_id = c.id
            JOIN sectors s ON c.sector_id = s.id
            WHERE h.id = $1
              AND s.sector_leader_id = $2
              AND h.status = 'cell_approved'`,
            [id, userId]
        );

        if (householdRes.rows.length === 0) {
            return res.status(404).json({ message: "Household not found or already processed" });
        }

        // Update status to sector_approved
        await pool.query(
            `UPDATE households 
             SET status = 'sector_approved', 
                 sector_approved_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [id]
        );

        res.json({ message: "Household approved at sector level successfully" });
    } catch (error) {
        console.error("Approve cell data error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * ================================
 * REJECT CELL SUBMISSION (SECTOR LEVEL)
 * ================================
 */
export const rejectCellData = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Verify the household belongs to this sector leader's sector
        const householdRes = await pool.query(
            `SELECT h.id
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            JOIN cells c ON v.cell_id = c.id
            JOIN sectors s ON c.sector_id = s.id
            WHERE h.id = $1
              AND s.sector_leader_id = $2
              AND h.status = 'cell_approved'`,
            [id, userId]
        );

        if (householdRes.rows.length === 0) {
            return res.status(404).json({ message: "Household not found or already processed" });
        }

        // Send back to cell for revision
        await pool.query(
            `UPDATE households 
             SET status = 'approved',
                 sector_approved_at = NULL,
                 updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [id]
        );

        res.json({ message: "Household rejected and sent back to cell" });
    } catch (error) {
        console.error("Reject cell data error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * ================================
 * GET CELLS UNDER THIS SECTOR
 * ================================
 */
export const getManagedCells = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get the sector managed by this leader
        const sectorRes = await pool.query(
            `SELECT id FROM sectors WHERE sector_leader_id = $1`,
            [userId]
        );

        if (sectorRes.rows.length === 0) {
            return res.json([]);
        }

        const sectorId = sectorRes.rows[0].id;

        // Get all cells with their statistics
        const result = await pool.query(
            `SELECT 
                c.id,
                c.name,
                u.username AS cell_leader_name,
                COUNT(DISTINCT v.id) AS total_villages,
                COUNT(DISTINCT i.id) AS total_isibos,
                COUNT(h.id) AS total_households,
                COALESCE(SUM(h.members), 0) AS total_members,
                COUNT(CASE WHEN h.status = 'approved' THEN 1 END) AS village_approved,
                COUNT(CASE WHEN h.status = 'cell_approved' THEN 1 END) AS cell_approved,
                COUNT(CASE WHEN h.status = 'sector_approved' THEN 1 END) AS sector_approved,
                COUNT(CASE WHEN h.status = 'pending' THEN 1 END) AS pending
            FROM cells c
            LEFT JOIN users u ON c.cell_leader_id = u.id
            LEFT JOIN villages v ON v.cell_id = c.id
            LEFT JOIN isibos i ON i.village_id = v.id
            LEFT JOIN households h ON h.isibo_id = i.id
            WHERE c.sector_id = $1
            GROUP BY c.id, c.name, u.username
            ORDER BY c.name`,
            [sectorId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Managed cells error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * ================================
 * SECTOR REPORTS
 * ================================
 */
export const getSectorReports = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get the sector managed by this leader
        const sectorRes = await pool.query(
            `SELECT id, name FROM sectors WHERE sector_leader_id = $1`,
            [userId]
        );

        if (sectorRes.rows.length === 0) {
            return res.json({
                sectorName: "",
                totalCells: 0,
                totalVillages: 0,
                totalIsibos: 0,
                totalHouseholds: 0,
                totalMembers: 0,
                villageApprovedHouseholds: 0,
                cellApprovedHouseholds: 0,
                sectorApprovedHouseholds: 0,
                pendingHouseholds: 0,
                rejectedHouseholds: 0,
                cellBreakdown: [],
                recentActivity: [],
            });
        }

        const sectorId = sectorRes.rows[0].id;
        const sectorName = sectorRes.rows[0].name;

        // Total cells
        const cellsRes = await pool.query(
            `SELECT COUNT(*) AS total FROM cells WHERE sector_id = $1`,
            [sectorId]
        );

        // Total villages
        const villagesRes = await pool.query(
            `SELECT COUNT(*) AS total
             FROM villages v
             JOIN cells c ON v.cell_id = c.id
             WHERE c.sector_id = $1`,
            [sectorId]
        );

        // Total isibos
        const isibosRes = await pool.query(
            `SELECT COUNT(*) AS total
             FROM isibos i
             JOIN villages v ON i.village_id = v.id
             JOIN cells c ON v.cell_id = c.id
             WHERE c.sector_id = $1`,
            [sectorId]
        );

        // Total households and members
        const totalsRes = await pool.query(
            `SELECT 
                COUNT(*) AS total_households,
                COALESCE(SUM(h.members), 0) AS total_members
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            JOIN cells c ON v.cell_id = c.id
            WHERE c.sector_id = $1`,
            [sectorId]
        );

        // Village approved (pending at cell)
        const villageApprovedRes = await pool.query(
            `SELECT COUNT(*) AS total
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            JOIN cells c ON v.cell_id = c.id
            WHERE c.sector_id = $1 AND h.status = 'approved'`,
            [sectorId]
        );

        // Cell approved (pending at sector)
        const cellApprovedRes = await pool.query(
            `SELECT COUNT(*) AS total
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            JOIN cells c ON v.cell_id = c.id
            WHERE c.sector_id = $1 AND h.status = 'cell_approved'`,
            [sectorId]
        );

        // Sector approved
        const sectorApprovedRes = await pool.query(
            `SELECT COUNT(*) AS total
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            JOIN cells c ON v.cell_id = c.id
            WHERE c.sector_id = $1 AND h.status = 'sector_approved'`,
            [sectorId]
        );

        // Pending at village
        const pendingRes = await pool.query(
            `SELECT COUNT(*) AS total
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            JOIN cells c ON v.cell_id = c.id
            WHERE c.sector_id = $1 AND h.status = 'pending'`,
            [sectorId]
        );

        // Rejected
        const rejectedRes = await pool.query(
            `SELECT COUNT(*) AS total
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            JOIN cells c ON v.cell_id = c.id
            WHERE c.sector_id = $1 AND h.status = 'rejected'`,
            [sectorId]
        );

        // Breakdown by Cell
        const cellBreakdownRes = await pool.query(
            `SELECT 
                c.name AS cell_name,
                u.username AS cell_leader,
                COUNT(DISTINCT v.id) AS total_villages,
                COUNT(DISTINCT i.id) AS total_isibos,
                COUNT(h.id) AS total_households,
                COALESCE(SUM(h.members), 0) AS total_members,
                COUNT(CASE WHEN h.status = 'approved' THEN 1 END) AS village_approved,
                COUNT(CASE WHEN h.status = 'cell_approved' THEN 1 END) AS cell_approved,
                COUNT(CASE WHEN h.status = 'sector_approved' THEN 1 END) AS sector_approved,
                COUNT(CASE WHEN h.status = 'pending' THEN 1 END) AS pending,
                COUNT(CASE WHEN h.status = 'rejected' THEN 1 END) AS rejected
            FROM cells c
            LEFT JOIN users u ON c.cell_leader_id = u.id
            LEFT JOIN villages v ON v.cell_id = c.id
            LEFT JOIN isibos i ON i.village_id = v.id
            LEFT JOIN households h ON h.isibo_id = i.id
            WHERE c.sector_id = $1
            GROUP BY c.id, c.name, u.username
            ORDER BY c.name`,
            [sectorId]
        );

        // Recent activity
        const activityRes = await pool.query(
            `SELECT
                'Cell ' || c.name || ' - Village ' || v.name || ' - Household from Isibo ' || i.name AS message,
                h.updated_at AS created_at,
                h.status
            FROM households h
            JOIN isibos i ON h.isibo_id = i.id
            JOIN villages v ON i.village_id = v.id
            JOIN cells c ON v.cell_id = c.id
            WHERE c.sector_id = $1
            ORDER BY h.updated_at DESC
            LIMIT 10`,
            [sectorId]
        );

        res.json({
            sectorName,
            totalCells: Number(cellsRes.rows[0].total),
            totalVillages: Number(villagesRes.rows[0].total),
            totalIsibos: Number(isibosRes.rows[0].total),
            totalHouseholds: Number(totalsRes.rows[0].total_households),
            totalMembers: Number(totalsRes.rows[0].total_members),
            villageApprovedHouseholds: Number(villageApprovedRes.rows[0].total),
            cellApprovedHouseholds: Number(cellApprovedRes.rows[0].total),
            sectorApprovedHouseholds: Number(sectorApprovedRes.rows[0].total),
            pendingHouseholds: Number(pendingRes.rows[0].total),
            rejectedHouseholds: Number(rejectedRes.rows[0].total),
            cellBreakdown: cellBreakdownRes.rows,
            recentActivity: activityRes.rows,
        });
    } catch (error) {
        console.error("Sector reports error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * ================================
 * SECTOR NOTIFICATIONS
 * ================================
 */
export const getSectorNotifications = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get the sector managed by this leader
        const sectorRes = await pool.query(
            `SELECT id FROM sectors WHERE sector_leader_id = $1`,
            [userId]
        );

        if (sectorRes.rows.length === 0) {
            return res.json([]);
        }

        const sectorId = sectorRes.rows[0].id;

        // Get notifications from all cells in this sector
        const result = await pool.query(
            `SELECT n.*, c.name as cell_name, v.name as village_name
            FROM notifications n
            JOIN users u ON n.isibo_leader_id = u.id
            JOIN isibos i ON u.id = i.isibo_leader_id
            JOIN villages v ON i.village_id = v.id
            JOIN cells c ON v.cell_id = c.id
            WHERE c.sector_id = $1
            ORDER BY n.created_at DESC`,
            [sectorId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Sector notifications error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * ================================
 * SECTOR SETTINGS
 * ================================
 */
export const getSectorSettings = async (req, res) => {
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

export const updateSectorSettings = async (req, res) => {
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
