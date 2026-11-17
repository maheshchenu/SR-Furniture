
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword || !process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Admin login configuration missing in .env",
      });
    }

    const isEmailMatch =
      email.toLowerCase().trim() === adminEmail.toLowerCase().trim();

    const isPasswordMatch = await bcrypt.compare(
      password,
      adminPassword
    ).catch(() => false);

    // Also support plain password from .env
    const passwordMatch =
      isPasswordMatch || password === adminPassword;

    if (!isEmailMatch || !passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      token,
      admin: {
        email: adminEmail,
        role: "admin",
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

module.exports = { adminLogin };
