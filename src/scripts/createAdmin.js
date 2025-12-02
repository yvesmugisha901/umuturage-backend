import pool from "../config/db.js";
import bcrypt from "bcrypt";

const createAdmin = async () => {
    try {
        const username = "Super Admin";
        const email = "admin@example.com";
        const password = "Admin@123"; // ✅ Known password for testing
        const role = "admin";

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        console.log("Hashed password:", hashedPassword);

        // Get role id
        const roleData = await pool.query(
            "SELECT id FROM roles WHERE name=$1",
            [role]
        );

        if (roleData.rows.length === 0) {
            console.log("Admin role does not exist!");
            return;
        }

        const role_id = roleData.rows[0].id;

        // Insert admin user
        const result = await pool.query(
            "INSERT INTO users (username, email, password, role_id) VALUES ($1,$2,$3,$4) RETURNING id, username, email, role_id",
            [username, email, hashedPassword, role_id]
        );

        console.log("Admin created:", result.rows[0]);
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

createAdmin();
