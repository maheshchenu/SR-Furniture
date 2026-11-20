const express = require("express");

const {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  addStock,
} = require("../controllers/productController");

const router = express.Router();

router.get("/", getProducts);
router.post("/", addProduct);
router.post("/stock", addStock);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

module.exports = router;
