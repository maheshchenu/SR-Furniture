const express = require("express");
const router = express.Router();

const {
  addManufacturer,
  getManufacturers,
  getManufacturerById,
  addPurchase,
  updatePurchase,
  addPayment,
  updatePayment,
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
router.put("/:id/purchases/:purchaseId", updatePurchase);

// Payment APIs for a specific purchase bill
router.post("/:id/purchases/:purchaseId/payments", addPayment);
router.put("/:id/purchases/:purchaseId/payments/:paymentId", updatePayment);

module.exports = router;
