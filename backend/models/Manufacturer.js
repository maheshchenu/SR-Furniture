
const mongoose = require("mongoose");

// Payment Schema
const paymentSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentDate: {
      type: Date,
      required: true,
    },
    paymentMode: {
      type: String,
      default: "Cash",
    },
    reference: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Purchase Bill Schema
const purchaseBillSchema = new mongoose.Schema(
  {
    billNumber: {
      type: String,
      default: "",
    },
    purchaseDate: {
      type: Date,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    payments: {
      type: [paymentSchema],
      default: [],
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Manufacturer Schema
const manufacturerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    notes: {
      type: String,
      default: "",
    },
    purchases: {
      type: [purchaseBillSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Virtual: Total Purchase Amount
manufacturerSchema.virtual("totalPurchaseAmount").get(function () {
  return this.purchases.reduce(
    (total, bill) => total + bill.totalAmount,
    0
  );
});

// Virtual: Total Paid Amount
manufacturerSchema.virtual("totalPaidAmount").get(function () {
  return this.purchases.reduce(
    (total, bill) =>
      total +
      bill.payments.reduce(
        (paymentTotal, payment) => paymentTotal + payment.amount,
        0
      ),
    0
  );
});

// Virtual: Remaining Balance
manufacturerSchema.virtual("remainingBalance").get(function () {
  return this.totalPurchaseAmount - this.totalPaidAmount;
});

manufacturerSchema.set("toJSON", { virtuals: true });
manufacturerSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Manufacturer", manufacturerSchema);
