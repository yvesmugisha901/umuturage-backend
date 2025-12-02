import bcrypt from "bcrypt";

const createHashedPassword = async () => {
    const password = "Admin@123"; // <-- replace with the new password you want
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    console.log("Hashed password:", hashedPassword);
};

createHashedPassword();
