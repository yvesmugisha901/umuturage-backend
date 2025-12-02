import pool from "../config/db.js";

// Add household
export const addHousehold = async (req, res) => {
    try {
        const { head, members, location } = req.body;
        const isiboLeaderId = req.user.id; // from JWT

        const result = await pool.query(
            `INSERT INTO households (isibo_leader_id, head, members, location)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
            [isiboLeaderId, head, members, location]
        );

        return res.status(201).json({ message: "Household submitted!", household: result.rows[0] });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};

// Get households for logged-in isibo leader
export const getHouseholds = async (req, res) => {
    try {
        const isiboLeaderId = req.user.id;

        const result = await pool.query(
            `SELECT * FROM households WHERE isibo_leader_id = $1 ORDER BY id DESC`,
            [isiboLeaderId]
        );

        return res.json(result.rows);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error" });
    }
};
