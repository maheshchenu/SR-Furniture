
const express = require("express");

const {
  getSales,
  getSaleById,
  createBill,
  updateBill,
  addPayment,
  deleteBill,
} = require("../controllers/salesController");

const router = express.Router();

// Get all bills
router.get("/", getSales);

// Create new bill
router.post("/", createBill);

// Update an existing bill (also adjusts product stock)
router.put("/:id", updateBill);

// Permanently delete bill without changing stock
router.delete("/:id", deleteBill);

// Add customer payment
router.post("/:id/payments", addPayment);

// Get single bill
router.get("/:id", getSaleById);

module.exports = router;
