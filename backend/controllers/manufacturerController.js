
const Manufacturer = require("../models/Manufacturer");

// Helper: Calculate supplier summary
const getSummary = (manufacturer) => {
  let totalPurchase = 0;
  let totalPaid = 0;

  manufacturer.purchases.forEach((bill) => {
    totalPurchase += Number(bill.totalAmount || 0);

    bill.payments.forEach((payment) => {
      totalPaid += Number(payment.amount || 0);
    });
  });

  return {
    totalPurchase,
    totalPaid,
    remainingBalance: totalPurchase - totalPaid,
  };
};

// 1. Add Manufacturer
exports.addManufacturer = async (req, res) => {
  try {
    const { name, phone, address, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Manufacturer name is required",
      });
    }

    const manufacturer = await Manufacturer.create({
      name: name.trim(),
      phone,
      address,
      notes,
    });

    res.status(201).json({
      success: true,
      message: "Manufacturer added successfully",
      manufacturer: {
        ...manufacturer.toObject(),
        summary: getSummary(manufacturer),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 2. Get All Manufacturers
exports.getManufacturers = async (req, res) => {
  try {
    const manufacturers = await Manufacturer.find().sort({
      createdAt: -1,
    });

    const result = manufacturers.map((manufacturer) => ({
      ...manufacturer.toObject(),
      summary: getSummary(manufacturer),
    }));

    res.status(200).json({
      success: true,
      count: result.length,
      manufacturers: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 3. Get Single Manufacturer
exports.getManufacturerById = async (req, res) => {
  try {
    const manufacturer = await Manufacturer.findById(req.params.id);

    if (!manufacturer) {
      return res.status(404).json({
        success: false,
        message: "Manufacturer not found",
      });
    }

    res.status(200).json({
      success: true,
      manufacturer: {
        ...manufacturer.toObject(),
        summary: getSummary(manufacturer),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 4. Add Purchase Bill
exports.addPurchase = async (req, res) => {
  try {
    const { billNumber, purchaseDate, totalAmount, paidAmount, notes } =
      req.body;

    const manufacturer = await Manufacturer.findById(req.params.id);

    if (!manufacturer) {
      return res.status(404).json({
        success: false,
        message: "Manufacturer not found",
      });
    }

    const total = Number(totalAmount);
    const paid = Number(paidAmount || 0);

    if (!Number.isFinite(total) || total <= 0) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid purchase amount",
      });
    }

    if (!Number.isFinite(paid) || paid < 0 || paid > total) {
      return res.status(400).json({
        success: false,
        message: "Paid amount must be between 0 and total amount",
      });
    }

    if (!purchaseDate || Number.isNaN(new Date(purchaseDate).getTime())) {
      return res.status(400).json({
        success: false,
        message: "Valid purchase date is required",
      });
    }

    const purchase = {
      billNumber: billNumber || "",
      purchaseDate,
      totalAmount: total,
      notes: notes || "",
      payments: [],
    };

    // Initial payment
    if (paid > 0) {
      purchase.payments.push({
        amount: paid,
        paymentDate: purchaseDate,
        paymentMode: "Cash",
        reference: "",
        notes: "Initial purchase payment",
      });
    }

    manufacturer.purchases.push(purchase);

    await manufacturer.save();

    const addedPurchase =
      manufacturer.purchases[manufacturer.purchases.length - 1];

    res.status(201).json({
      success: true,
      message: "Purchase bill added successfully",
      purchase: addedPurchase,
      summary: getSummary(manufacturer),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 5. Add Payment to a Specific Purchase Bill
exports.addPayment = async (req, res) => {
  try {
    const { amount, paymentDate, paymentMode, reference, notes } = req.body;

    const { id, purchaseId } = req.params;

    const manufacturer = await Manufacturer.findById(id);

    if (!manufacturer) {
      return res.status(404).json({
        success: false,
        message: "Manufacturer not found",
      });
    }

    const purchase = manufacturer.purchases.id(purchaseId);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase bill not found",
      });
    }

    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid payment amount",
      });
    }

    if (!paymentDate || Number.isNaN(new Date(paymentDate).getTime())) {
      return res.status(400).json({
        success: false,
        message: "Valid payment date is required",
      });
    }

    const alreadyPaid = purchase.payments.reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0
    );

    const remaining = purchase.totalAmount - alreadyPaid;

    if (paymentAmount > remaining) {
      return res.status(400).json({
        success: false,
        message: `Payment cannot exceed remaining balance of ${remaining}`,
      });
    }

    purchase.payments.push({
      amount: paymentAmount,
      paymentDate,
      paymentMode: paymentMode || "Cash",
      reference: reference || "",
      notes: notes || "",
    });

    await manufacturer.save();

    res.status(201).json({
      success: true,
      message: "Payment recorded successfully",
      purchase,
      summary: getSummary(manufacturer),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 6. Update Manufacturer
exports.updateManufacturer = async (req, res) => {
  try {
    const { name, phone, address, notes } = req.body;

    if (name !== undefined && !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Manufacturer name cannot be empty",
      });
    }

    const manufacturer = await Manufacturer.findByIdAndUpdate(
      req.params.id,
      {
        ...(name !== undefined && { name: name.trim() }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(notes !== undefined && { notes }),
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!manufacturer) {
      return res.status(404).json({
        success: false,
        message: "Manufacturer not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Manufacturer updated successfully",
      manufacturer: {
        ...manufacturer.toObject(),
        summary: getSummary(manufacturer),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 7. Delete Manufacturer
exports.deleteManufacturer = async (req, res) => {
  try {
    const manufacturer = await Manufacturer.findByIdAndDelete(req.params.id);

    if (!manufacturer) {
      return res.status(404).json({
        success: false,
        message: "Manufacturer not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Manufacturer deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
