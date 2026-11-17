
const express = require("express");

const {
  getSales,
  getSaleById,
  createBill,
  addPayment,
} = require("../controllers/salesController");

const router = express.Router();

// Get all bills
router.get("/", getSales);

// Create new bill
router.post("/", createBill);

// Add customer payment
router.post("/:id/payments", addPayment);

// Get single bill
router.get("/:id", getSaleById);

module.exports = router;
