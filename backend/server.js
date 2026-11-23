const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const connectDB = require("./config/db");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const salesRoutes = require("./routes/salesRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const manufacturerRoutes = require("./routes/manufacturerRoutes");
const adminRoutes = require("./routes/adminRoutes");
const companyRoutes = require("./routes/companyRoutes");
const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/manufacturers", manufacturerRoutes);
app.use("/api/admin", adminRoutes);
app.get("/", (_req, res) => res.json({ success: true, message: "SR Furniture Backend is Running!" }));
const PORT = process.env.PORT || 5000;
(async () => {
  try { await connectDB(); app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); }
  catch (error) { console.error("Server startup failed:", error.message); process.exit(1); }
})();
