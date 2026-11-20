
const mongoose = require("mongoose");
const Sale = require("../models/Sale");
const Product = require("../models/Product");

// GET ALL SALES
const getSales = async (req, res) => {
  try {
    const sales = await Sale.find().sort({ date: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      sales,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// GET SINGLE SALE
const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bill ID",
      });
    }

    const sale = await Sale.findById(id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    res.status(200).json({
      success: true,
      sale,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// CREATE BILL
const createBill = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      items,
      billNumber,
      date,
      customerName = "",
      customerMobile = "",
      discount = 0,
      paidAmount = 0,
      gstRate = 0,
      placeOfSupply = "Andhra Pradesh",
    } = req.body;

    // VALIDATE BILL NUMBER
    const manualBillNumber = String(billNumber || "").trim();

    if (!manualBillNumber) {
      return res.status(400).json({
        success: false,
        message: "Please enter a bill number",
      });
    }

    // VALIDATE BILL DATE
    if (
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid bill date",
      });
    }

    const billDate = new Date(`${date}T00:00:00.000Z`);

    if (
      Number.isNaN(billDate.getTime()) ||
      billDate.toISOString().slice(0, 10) !== date
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid bill date",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please add at least one product",
      });
    }

    const discountValue = Number(discount);
    const paidValue = Number(paidAmount);
    const gstValue = Number(gstRate);
    if (!Number.isFinite(gstValue) || gstValue < 0 || gstValue > 100) return res.status(400).json({ success: false, message: "GST rate must be between 0 and 100" });

    if (
      !Number.isFinite(discountValue) ||
      !Number.isFinite(paidValue) ||
      discountValue < 0 ||
      paidValue < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid discount or paid amount",
      });
    }

    let createdSale;

    await session.withTransaction(async () => {
      // CHECK DUPLICATE BILL NUMBER
      const existingBill = await Sale.findOne({
        billNumber: manualBillNumber,
      }).session(session);

      if (existingBill) {
        throw new Error("This bill number already exists. Please enter a unique bill number.");
      }

      let subtotal = 0;
      let totalItems = 0;
      let totalProfit = 0;
      const billItems = [];

      for (const item of items) {
        const {
          productId,
          variantId,
          quantity,
          sellingPrice,
        } = item;

        if (
          !mongoose.Types.ObjectId.isValid(productId) ||
          !Number.isInteger(Number(quantity)) ||
          Number(quantity) <= 0
        ) {
          throw new Error("Invalid product or quantity");
        }

        const qty = Number(quantity);

        const product = await Product.findById(productId).session(session);

        if (!product) {
          throw new Error("Product not found");
        }

        let variant = null;
        let availableStock = 0;
        let variantName = "";
        let color = "";
        let mrp = Number(product.mrp || 0);
        let purchasePrice = Number(product.purchasePrice || 0);

        if (product.variants && product.variants.length > 0) {
          if (
            !variantId ||
            !mongoose.Types.ObjectId.isValid(variantId)
          ) {
            throw new Error(`Please select a variant for ${product.name}`);
          }

          variant = product.variants.id(variantId);

          if (!variant) {
            throw new Error("Selected variant not found");
          }

          availableStock = Number(variant.quantity || 0);
          variantName = variant.name || "";
          color = variant.color || "";
          mrp = Number(variant.mrp || 0);
          purchasePrice = Number(variant.purchasePrice || 0);
        } else {
          availableStock = Number(product.quantity || 0);
        }

        if (availableStock < qty) {
          throw new Error(
            `Insufficient stock for ${product.name}. Available: ${availableStock}`
          );
        }

        const price = Number(sellingPrice);

        if (!Number.isFinite(price) || price <= 0) {
          throw new Error(`Invalid selling price for ${product.name}`);
        }

        const totalAmount = price * qty;
        const profit = (price - purchasePrice) * qty;

        if (variant) {
          variant.quantity -= qty;
        } else {
          product.quantity -= qty;
        }

        product.markModified("variants");
        await product.save({ session });

        subtotal += totalAmount;
        totalItems += qty;
        totalProfit += profit;

        billItems.push({
          productId: product._id,
          productName: product.name,
          category: product.category,
          variantId: variant ? variant._id : null,
          variantName,
          color,
          quantity: qty,
          mrp,
          purchasePrice,
          sellingPrice: price,
          totalAmount,
          profit,
          availableStock: availableStock - qty,
        });
      }

      if (discountValue > subtotal) {
        throw new Error("Discount cannot be greater than subtotal");
      }

      const taxableAmount = subtotal - discountValue;
      const isInterState = !String(placeOfSupply).toLowerCase().includes("andhra");
      const totalGST = taxableAmount * gstValue / 100;
      const cgstAmount = isInterState ? 0 : totalGST / 2;
      const sgstAmount = isInterState ? 0 : totalGST / 2;
      const igstAmount = isInterState ? totalGST : 0;
      const grandTotal = Number((taxableAmount + totalGST).toFixed(2));

      if (paidValue > grandTotal) {
        throw new Error("Paid amount cannot be greater than bill total");
      }

      const balanceDue = grandTotal - paidValue;

      const sale = new Sale({
        // Keep MongoDB's automatic _id unchanged
        billNumber: manualBillNumber,
        customerName,
        customerMobile,
        items: billItems,
        totalItems,
        subtotal,
        discount: discountValue,
        gstRate: gstValue,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        placeOfSupply,
        grandTotal,
        paidAmount: paidValue,
        balanceDue,
        paymentStatus: balanceDue > 0 ? "Partial" : "Paid",
        payments:
          paidValue > 0
            ? [
                {
                  amount: paidValue,
                  note: "Initial payment",
                  date: new Date(),
                },
              ]
            : [],
        totalProfit,
        date: billDate,
      });

      await sale.save({ session });
      createdSale = sale;
    });

    res.status(201).json({
      success: true,
      message: "Bill created successfully",
      sale: createdSale,
    });
  } catch (error) {
    // MongoDB UNIQUE INDEX: handles duplicate requests safely,
    // including two requests arriving at nearly the same time.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This bill number already exists. Please enter a unique bill number.",
      });
    }

    const statusCode =
      error.message?.includes("already exists") ? 409 : 400;

    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  } finally {
    await session.endSession();
  }
};

// ADD CUSTOMER PAYMENT
const addPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, note = "" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bill ID",
      });
    }

    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid payment amount",
      });
    }

    const sale = await Sale.findById(id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    if (paymentAmount > sale.balanceDue) {
      return res.status(400).json({
        success: false,
        message: `Maximum pending amount is ₹${sale.balanceDue}`,
      });
    }

    sale.payments.push({
      amount: paymentAmount,
      note,
      date: new Date(),
    });

    sale.paidAmount += paymentAmount;
    sale.balanceDue = sale.grandTotal - sale.paidAmount;
    sale.paymentStatus = sale.balanceDue <= 0 ? "Paid" : "Partial";

    await sale.save();

    res.status(200).json({
      success: true,
      message: "Payment added successfully",
      sale,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// PERMANENTLY DELETE BILL. Deliberately does not modify product stock.
const deleteBill = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid bill ID" });
    }
    const deletedSale = await Sale.findByIdAndDelete(id);
    if (!deletedSale) {
      return res.status(404).json({ success: false, message: "Bill not found" });
    }
    // Payment history is embedded in the Sale document, so it is removed with the bill.
    // Product stock is intentionally left unchanged.
    return res.status(200).json({ success: true, message: "Bill permanently deleted. Stock quantity was not changed." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  deleteBill,
  getSales,
  getSaleById,
  createBill,
  addPayment,
};
