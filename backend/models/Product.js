
const mongoose = require("mongoose");

// PRODUCT VARIANT SCHEMA
const variantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    color: {
      type: String,
      default: "",
      trim: true,
    },

    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    mrp: {
      type: Number,
      default: 0,
      min: 0,
    },

    purchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    sellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: true }
);

// STOCK HISTORY SCHEMA
const stockHistorySchema = new mongoose.Schema(
  {
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    variantName: {
      type: String,
      default: "General Stock",
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    date: {
      type: String,
      required: true,
    },

    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// PRODUCT SCHEMA
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    company: {
      type: String,
      required: true,
      trim: true,
    },

    model: {
      type: String,
      required: true,
      trim: true,
    },

    addedDate: {
      type: String,
      default: () => new Date().toISOString().slice(0, 10),
    },

    variants: {
      type: [variantSchema],
      default: [],
      validate: {
        validator: function (variants) {
          return variants.length > 0;
        },
        message: "At least one product variant is required.",
      },
    },

    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    mrp: {
      type: Number,
      default: 0,
      min: 0,
    },

    purchasePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    sellingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    stockHistory: {
      type: [stockHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", productSchema);
