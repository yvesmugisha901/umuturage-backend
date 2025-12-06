// controllers/isiboController.js
import pool from "../config/db.js";
import bcrypt from "bcrypt";

// ----------------------------- HOUSEHOLDS -----------------------------

export const addHousehold = async (req, res) => {
    try {
        const { head, members, location } = req.body;
        const isiboLeaderId = req.user.id;

        const result = await pool.query(
            `INSERT INTO households (isibo_leader_id, head, members, location, status, date_added)
       VALUES ($1, $2, $3, $4, 'pending', NOW())
       RETURNING *`,
            [isiboLeaderId, head, members, location]
        );

        // Add notification
        await pool.query(
            `INSERT INTO notifications (isibo_leader_id, type, message, status, created_at)
       VALUES ($1, 'info', $2, 'unread', NOW())`,
            [isiboLeaderId, `New household added: ${head}`]
        );

        return res.status(201).json({ message: "Household submitted!", household: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const getHouseholds = async (req, res) => {
    try {
        const isiboLeaderId = req.user.id;

        const result = await pool.query(
            `SELECT * FROM households WHERE isibo_leader_id = $1 ORDER BY date_added DESC`,
            [isiboLeaderId]
        );

        return res.json({ households: result.rows });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const updateHousehold = async (req, res) => {
    try {
        const id = req.params.id;
        const { head, members, location, status } = req.body;
        const isiboLeaderId = req.user.id;

        const result = await pool.query(
            `UPDATE households
       SET head = $1, members = $2, location = $3, status = $4
       WHERE id = $5 AND isibo_leader_id = $6
       RETURNING *`,
            [head, members, location, status, id, isiboLeaderId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Household not found or you are not authorized" });
        }

        // Add notification
        await pool.query(
            `INSERT INTO notifications (isibo_leader_id, type, message, status, created_at)
       VALUES ($1, 'info', $2, 'unread', NOW())`,
            [isiboLeaderId, `Household updated: ${head}`]
        );

        return res.json({ message: "Household updated!", household: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const deleteHousehold = async (req, res) => {
    try {
        const id = req.params.id;
        const isiboLeaderId = req.user.id;

        const result = await pool.query(
            `DELETE FROM households WHERE id = $1 AND isibo_leader_id = $2 RETURNING *`,
            [id, isiboLeaderId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Household not found or you are not authorized" });
        }

        // Add notification
        await pool.query(
            `INSERT INTO notifications (isibo_leader_id, type, message, status, created_at)
       VALUES ($1, 'info', $2, 'unread', NOW())`,
            [isiboLeaderId, `Household deleted: ${result.rows[0].head}`]
        );

        return res.json({ message: "Household deleted!", household: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};

// ----------------------------- REPORTS -----------------------------

export const getReports = async (req, res) => {
    try {
        const isiboLeaderId = req.user.id;

        const totalResult = await pool.query(
            `SELECT COUNT(*) AS total_households FROM households WHERE isibo_leader_id = $1`,
            [isiboLeaderId]
        );

        const totalMembersResult = await pool.query(
            `SELECT COALESCE(SUM(members),0) AS total_members FROM households WHERE isibo_leader_id = $1`,
            [isiboLeaderId]
        );

        const pendingResult = await pool.query(
            `SELECT COUNT(*) AS pending_approvals FROM households WHERE isibo_leader_id = $1 AND status = 'pending'`,
            [isiboLeaderId]
        );

        const weeklyDataResult = await pool.query(
            `SELECT DATE_TRUNC('week', date_added) AS week_start,
              COUNT(*) AS households_added,
              COALESCE(SUM(members),0) AS members_added
       FROM households
       WHERE isibo_leader_id = $1
       GROUP BY week_start
       ORDER BY week_start ASC
       LIMIT 4`,
            [isiboLeaderId]
        );

        const weeklyData = weeklyDataResult.rows.map(row => ({
            week: row.week_start.toISOString().slice(0, 10),
            householdsAdded: parseInt(row.households_added),
            membersAdded: parseInt(row.members_added)
        }));

        return res.json({
            totalHouseholds: parseInt(totalResult.rows[0].total_households),
            totalMembers: parseInt(totalMembersResult.rows[0].total_members),
            pendingApprovals: parseInt(pendingResult.rows[0].pending_approvals),
            weeklyData
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};

// ----------------------------- NOTIFICATIONS -----------------------------

export const getNotifications = async (req, res) => {
    try {
        const isiboLeaderId = req.user.id;

        const result = await pool.query(
            `SELECT * FROM notifications WHERE isibo_leader_id = $1 ORDER BY created_at DESC`,
            [isiboLeaderId]
        );

        return res.json({ notifications: result.rows });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const addNotification = async (req, res) => {
    try {
        const isiboLeaderId = req.user.id;
        const { type, message } = req.body;

        const result = await pool.query(
            `INSERT INTO notifications (isibo_leader_id, type, message, status, created_at)
       VALUES ($1, $2, $3, 'unread', NOW())
       RETURNING *`,
            [isiboLeaderId, type, message]
        );

        return res.status(201).json({ message: "Notification added!", notification: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const markNotificationRead = async (req, res) => {
    try {
        const notificationId = req.params.id;

        const result = await pool.query(
            `UPDATE notifications SET status = 'read' WHERE id = $1 RETURNING *`,
            [notificationId]
        );

        return res.json({ message: "Notification marked as read", notification: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const markAllNotificationsRead = async (req, res) => {
    try {
        const isiboLeaderId = req.user.id;

        await pool.query(
            `UPDATE notifications SET status = 'read' WHERE isibo_leader_id = $1`,
            [isiboLeaderId]
        );

        return res.json({ message: "All notifications marked as read" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};

// ----------------------------- SETTINGS -----------------------------
export const getSettings = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT id, username, email FROM users WHERE id = $1`,
            [userId]
        );

        return res.json({ settings: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const updateSettings = async (req, res) => {
    try {
        const userId = req.user.id;
        const { username, email, password } = req.body;

        let hashedPassword;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            hashedPassword = await bcrypt.hash(password, salt);
        }

        const result = await pool.query(
            `UPDATE users 
       SET username = $1, email = $2, password = COALESCE($3, password)
       WHERE id = $4
       RETURNING id, username, email`,
            [username, email, hashedPassword, userId]
        );

        return res.json({ message: "Settings updated!", settings: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};

// ----------------------------- CALENDAR -----------------------------
export const getCalendarEvents = async (req, res) => {
    try {
        const isiboLeaderId = req.user.id;

        const result = await pool.query(
            `SELECT * FROM calendar_events WHERE isibo_leader_id = $1 ORDER BY date ASC`,
            [isiboLeaderId]
        );

        return res.json({ events: result.rows });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const addCalendarEvent = async (req, res) => {
    try {
        const isiboLeaderId = req.user.id;
        const { title, description, date, type } = req.body;

        const result = await pool.query(
            `INSERT INTO calendar_events (isibo_leader_id, title, description, date, type)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [isiboLeaderId, title, description, date, type]
        );

        return res.status(201).json({ message: "Event added!", event: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const updateCalendarEvent = async (req, res) => {
    try {
        const eventId = req.params.id;
        const { title, description, date, type } = req.body;

        const result = await pool.query(
            `UPDATE calendar_events
       SET title = $1, description = $2, date = $3, type = $4
       WHERE id = $5
       RETURNING *`,
            [title, description, date, type, eventId]
        );

        return res.json({ message: "Event updated!", event: result.rows[0] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};

export const deleteCalendarEvent = async (req, res) => {
    try {
        const eventId = req.params.id;

        await pool.query(`DELETE FROM calendar_events WHERE id = $1`, [eventId]);

        return res.json({ message: "Event deleted!" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};
