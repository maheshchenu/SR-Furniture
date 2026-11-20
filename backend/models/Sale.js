
const mongoose = require("mongoose");

// BILL ITEM SCHEMA
const billItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    productName: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    variantName: {
      type: String,
      default: "",
      trim: true,
    },

    color: {
      type: String,
      default: "",
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
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
      required: true,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    profit: {
      type: Number,
      default: 0,
    },

    availableStock: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: true }
);

// PAYMENT HISTORY SCHEMA
const paymentSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    note: {
      type: String,
      default: "",
      trim: true,
    },

    date: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// MAIN SALE SCHEMA
const saleSchema = new mongoose.Schema(
  {
    billNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    customerName: {
      type: String,
      default: "",
      trim: true,
    },

    customerMobile: {
      type: String,
      default: "",
      trim: true,
    },

    items: {
      type: [billItemSchema],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: "A bill must contain at least one product.",
      },
    },

    totalItems: {
      type: Number,
      required: true,
      min: 0,
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    balanceDue: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["Paid", "Partial"],
      default: "Paid",
    },

    payments: {
      type: [paymentSchema],
      default: [],
    },

    gstRate: { type: Number, default: 0, min: 0, max: 100 },
    taxableAmount: { type: Number, default: 0, min: 0 },
    cgstAmount: { type: Number, default: 0, min: 0 },
    sgstAmount: { type: Number, default: 0, min: 0 },
    igstAmount: { type: Number, default: 0, min: 0 },
    placeOfSupply: { type: String, default: "Andhra Pradesh", trim: true },
    isCancelled: { type: Boolean, default: false },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: "", trim: true },
    totalProfit: {
      type: Number,
      default: 0,
    },

    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// INDEXES
saleSchema.index({ customerMobile: 1 });
saleSchema.index({ date: -1 });

// EXPORT MODEL
module.exports = mongoose.model("Sale", saleSchema);
