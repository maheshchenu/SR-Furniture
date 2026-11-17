
const express = require("express");
const router = express.Router();

const {
  addManufacturer,
  getManufacturers,
  getManufacturerById,
  addPurchase,
  addPayment,
  updateManufacturer,
  deleteManufacturer,
} = require("../controllers/manufacturerController");

// Manufacturer APIs
router.post("/", addManufacturer);
router.get("/", getManufacturers);
router.get("/:id", getManufacturerById);
router.put("/:id", updateManufacturer);
router.delete("/:id", deleteManufacturer);

// Purchase APIs
router.post("/:id/purchases", addPurchase);

// Payment API for a specific purchase bill
router.post("/:id/purchases/:purchaseId/payments", addPayment);

module.exports = router;
