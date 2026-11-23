const mongoose = require("mongoose");

const sizeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  warranty: { type: String, default: "", trim: true },
  quantity: { type: Number, default: 0, min: 0 },
  mrp: { type: Number, default: 0, min: 0 },
  purchasePrice: { type: Number, default: 0, min: 0 },
  sellingPrice: { type: Number, default: 0, min: 0 },
}, { _id: true });

// Legacy variant schema is retained only so old product records remain readable.
const legacyVariantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  warranty: { type: String, default: "", trim: true },
  quantity: { type: Number, default: 0, min: 0 },
  mrp: { type: Number, default: 0, min: 0 },
  purchasePrice: { type: Number, default: 0, min: 0 },
  sellingPrice: { type: Number, default: 0, min: 0 },
}, { _id: true });

const stockHistorySchema = new mongoose.Schema({
  sizeId: { type: mongoose.Schema.Types.ObjectId, default: null },
  sizeName: { type: String, default: "General Stock" },
  // Legacy fields are preserved for older stock-history entries.
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  variantName: { type: String, default: "" },
  quantity: { type: Number, required: true, min: 1 },
  date: { type: String, required: true },
  addedAt: { type: Date, default: Date.now },
}, { _id: true });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  company: { type: String, required: true, trim: true },
  model: { type: String, required: true, trim: true },
  addedDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  // New hierarchy: Category -> Company -> Model -> sizes[] (direct Size/Type rows).
  sizes: { type: [sizeSchema], default: [] },
  // Legacy data only. New product creation uses sizes, not variants.
  variants: { type: [legacyVariantSchema], default: [] },
  quantity: { type: Number, default: 0, min: 0 },
  mrp: { type: Number, default: 0, min: 0 },
  purchasePrice: { type: Number, default: 0, min: 0 },
  sellingPrice: { type: Number, default: 0, min: 0 },
  stockHistory: { type: [stockHistorySchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);
