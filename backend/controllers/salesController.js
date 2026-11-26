
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
        let size = null;
        let availableStock = 0;
        let variantName = "";
        let sizeName = "";
        let color = "";
        let mrp = Number(product.mrp || 0);
        let purchasePrice = Number(product.purchasePrice || 0);

        if (product.sizes && product.sizes.length > 0) {
          const { sizeId } = item;
          if (!sizeId || !mongoose.Types.ObjectId.isValid(sizeId)) {
            throw new Error(`Please select a Size/Type for ${product.name}`);
          }
          size = product.sizes.id(sizeId);
          if (!size) throw new Error("Selected Size/Type not found");
          availableStock = Number(size.quantity || 0);
          sizeName = size.name || "";
          mrp = Number(size.mrp || 0);
          purchasePrice = Number(size.purchasePrice || 0);
        } else if (product.variants && product.variants.length > 0) {
          // Legacy products remain sellable; new products never create this level.
          const { variantId } = item;
          if (!variantId || !mongoose.Types.ObjectId.isValid(variantId)) throw new Error(`Please select a legacy variant for ${product.name}`);
          variant = product.variants.id(variantId);
          if (!variant) throw new Error("Selected legacy variant not found");
          availableStock = Number(variant.quantity || 0);
          variantName = variant.name || "";
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

        if (size) size.quantity -= qty;
        else if (variant) variant.quantity -= qty;
        else product.quantity -= qty;

        product.markModified("sizes");
        product.markModified("variants");
        await product.save({ session });

        subtotal += totalAmount;
        totalItems += qty;
        totalProfit += profit;

        billItems.push({
          productId: product._id,
          productName: product.name,
          category: product.category,
          sizeId: size ? size._id : null,
          sizeName,
          variantId: variant ? variant._id : null,
          variantName,
          color,
          warranty: String(size?.warranty ?? item.warranty ?? ""),
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


// EDIT EXISTING BILL
// Stock is restored from the old bill and deducted for the edited bill
// inside one MongoDB transaction, so a failed edit cannot leave partial stock changes.
const updateBill = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid bill ID" });
    }

    const {
      items,
      billNumber,
      date,
      customerName = "",
      customerMobile = "",
      discount = 0,
      paidAmount,
      gstRate = 0,
      placeOfSupply = "Andhra Pradesh",
    } = req.body;

    const manualBillNumber = String(billNumber || "").trim();
    if (!manualBillNumber) {
      return res.status(400).json({ success: false, message: "Please enter a bill number" });
    }

    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: "Please select a valid bill date" });
    }

    const billDate = new Date(`${date}T00:00:00.000Z`);
    if (
      Number.isNaN(billDate.getTime()) ||
      billDate.toISOString().slice(0, 10) !== date
    ) {
      return res.status(400).json({ success: false, message: "Invalid bill date" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Please add at least one product" });
    }

    const discountValue = Number(discount);
    const gstValue = Number(gstRate);
    if (!Number.isFinite(discountValue) || discountValue < 0) {
      return res.status(400).json({ success: false, message: "Invalid discount amount" });
    }
    if (!Number.isFinite(gstValue) || gstValue < 0 || gstValue > 100) {
      return res.status(400).json({ success: false, message: "GST rate must be between 0 and 100" });
    }

    let updatedSale;

    await session.withTransaction(async () => {
      const sale = await Sale.findById(id).session(session);
      if (!sale) throw new Error("Bill not found");

      const duplicateBill = await Sale.findOne({
        billNumber: manualBillNumber,
        _id: { $ne: id },
      }).session(session);

      if (duplicateBill) {
        const error = new Error("This bill number already exists. Please enter a unique bill number.");
        error.statusCode = 409;
        throw error;
      }

      // 1. Restore quantities from the original bill.
      for (const oldItem of sale.items) {
        const product = await Product.findById(oldItem.productId).session(session);
        if (!product) {
          throw new Error(`Cannot restore stock: product "${oldItem.productName}" was not found`);
        }

        if (oldItem.sizeId) {
          const size = product.sizes.id(oldItem.sizeId);
          if (!size) throw new Error(`Cannot restore stock: Size/Type "${oldItem.sizeName}" was not found`);
          size.quantity = Number(size.quantity || 0) + Number(oldItem.quantity || 0);
        } else if (oldItem.variantId) {
          const variant = product.variants.id(oldItem.variantId);
          if (!variant) throw new Error(`Cannot restore stock: variant "${oldItem.variantName}" was not found`);
          variant.quantity = Number(variant.quantity || 0) + Number(oldItem.quantity || 0);
        } else {
          product.quantity = Number(product.quantity || 0) + Number(oldItem.quantity || 0);
        }

        product.markModified("sizes");
        product.markModified("variants");
        await product.save({ session });
      }

      // 2. Validate edited products and deduct the new quantities.
      let subtotal = 0;
      let totalItems = 0;
      let totalProfit = 0;
      const billItems = [];

      for (const item of items) {
        const { productId, quantity, sellingPrice } = item;

        if (
          !mongoose.Types.ObjectId.isValid(productId) ||
          !Number.isInteger(Number(quantity)) ||
          Number(quantity) <= 0
        ) {
          throw new Error("Invalid product or quantity");
        }

        const qty = Number(quantity);
        const product = await Product.findById(productId).session(session);
        if (!product) throw new Error("Product not found");

        let variant = null;
        let size = null;
        let availableStock = 0;
        let variantName = "";
        let sizeName = "";
        const color = String(item.color || "");
        let mrp = Number(product.mrp || 0);
        let purchasePrice = Number(product.purchasePrice || 0);

        if (product.sizes && product.sizes.length > 0) {
          const sizeId = item.sizeId;
          if (!sizeId || !mongoose.Types.ObjectId.isValid(sizeId)) {
            throw new Error(`Please select a Size/Type for ${product.name}`);
          }
          size = product.sizes.id(sizeId);
          if (!size) throw new Error(`Selected Size/Type not found for ${product.name}`);
          availableStock = Number(size.quantity || 0);
          sizeName = size.name || "";
          mrp = Number(size.mrp || 0);
          purchasePrice = Number(size.purchasePrice || 0);
        } else if (product.variants && product.variants.length > 0) {
          const variantId = item.variantId;
          if (!variantId || !mongoose.Types.ObjectId.isValid(variantId)) {
            throw new Error(`Please select a legacy variant for ${product.name}`);
          }
          variant = product.variants.id(variantId);
          if (!variant) throw new Error(`Selected legacy variant not found for ${product.name}`);
          availableStock = Number(variant.quantity || 0);
          variantName = variant.name || "";
          mrp = Number(variant.mrp || 0);
          purchasePrice = Number(variant.purchasePrice || 0);
        } else {
          availableStock = Number(product.quantity || 0);
        }

        if (availableStock < qty) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${availableStock}`);
        }

        const price = Number(sellingPrice);
        if (!Number.isFinite(price) || price <= 0) {
          throw new Error(`Invalid selling price for ${product.name}`);
        }

        const totalAmount = Number((price * qty).toFixed(2));
        const profit = Number(((price - purchasePrice) * qty).toFixed(2));

        if (size) size.quantity -= qty;
        else if (variant) variant.quantity -= qty;
        else product.quantity -= qty;

        product.markModified("sizes");
        product.markModified("variants");
        await product.save({ session });

        subtotal += totalAmount;
        totalItems += qty;
        totalProfit += profit;

        billItems.push({
          productId: product._id,
          productName: product.name,
          category: product.category,
          sizeId: size ? size._id : null,
          sizeName,
          variantId: variant ? variant._id : null,
          variantName,
          color,
          warranty: String(size?.warranty ?? item.warranty ?? ""),
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

      // If paidAmount is omitted, retain the existing total paid.
      const requestedPaid = paidAmount === undefined
        ? Number(sale.paidAmount || 0)
        : Number(paidAmount);

      if (!Number.isFinite(requestedPaid) || requestedPaid < 0 || requestedPaid > grandTotal) {
        throw new Error("Paid amount must be between ₹0 and the bill total");
      }

      // Keep payment history aligned with the edited paid total.
      // Any increase is recorded as an adjustment; any decrease is deducted
      // from the newest payment entries first.
      const paymentEntries = sale.payments.map((payment) => ({
        _id: payment._id,
        amount: Number(payment.amount || 0),
        note: payment.note || "",
        date: payment.date || new Date(),
      }));

      let paymentSum = paymentEntries.reduce((sum, payment) => sum + payment.amount, 0);
      const difference = Number((requestedPaid - paymentSum).toFixed(2));

      if (difference > 0.009) {
        paymentEntries.push({
          amount: difference,
          note: "Payment adjustment during bill edit",
          date: new Date(),
        });
      } else if (difference < -0.009) {
        let amountToReduce = Math.abs(difference);
        for (let index = paymentEntries.length - 1; index >= 0 && amountToReduce > 0.009; index--) {
          const reduction = Math.min(paymentEntries[index].amount, amountToReduce);
          paymentEntries[index].amount = Number((paymentEntries[index].amount - reduction).toFixed(2));
          amountToReduce = Number((amountToReduce - reduction).toFixed(2));
          if (paymentEntries[index].amount <= 0.009) paymentEntries.splice(index, 1);
        }
      }

      const balanceDue = Number((grandTotal - requestedPaid).toFixed(2));

      sale.billNumber = manualBillNumber;
      sale.customerName = String(customerName || "").trim();
      sale.customerMobile = String(customerMobile || "").trim();
      sale.items = billItems;
      sale.totalItems = totalItems;
      sale.subtotal = Number(subtotal.toFixed(2));
      sale.discount = discountValue;
      sale.gstRate = gstValue;
      sale.taxableAmount = Number(taxableAmount.toFixed(2));
      sale.cgstAmount = Number(cgstAmount.toFixed(2));
      sale.sgstAmount = Number(sgstAmount.toFixed(2));
      sale.igstAmount = Number(igstAmount.toFixed(2));
      sale.placeOfSupply = placeOfSupply;
      sale.grandTotal = grandTotal;
      sale.paidAmount = requestedPaid;
      sale.balanceDue = balanceDue;
      sale.paymentStatus = balanceDue <= 0.009 ? "Paid" : "Partial";
      sale.payments = paymentEntries;
      sale.totalProfit = Number(totalProfit.toFixed(2));
      sale.date = billDate;

      await sale.save({ session });
      updatedSale = sale;
    });

    return res.status(200).json({
      success: true,
      message: "Bill updated successfully",
      sale: updatedSale,
    });
  } catch (error) {
    const statusCode = error.statusCode || (
      error.code === 11000 ? 409 :
      error.message === "Bill not found" ? 404 : 400
    );

    return res.status(statusCode).json({
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
  updateBill,
  addPayment,
};
