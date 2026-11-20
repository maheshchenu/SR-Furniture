
const express = require("express");

const {
  getSales,
  getSaleById,
  createBill,
  addPayment,
  deleteBill,
} = require("../controllers/salesController");

const router = express.Router();

// Get all bills
router.get("/", getSales);

// Create new bill
router.post("/", createBill);

// Permanently delete bill without changing stock
router.delete("/:id", deleteBill);

// Add customer payment
router.post("/:id/payments", addPayment);

// Get single bill
router.get("/:id", getSaleById);

module.exports = router;
