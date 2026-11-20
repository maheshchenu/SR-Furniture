const mongoose = require("mongoose");
const Product = require("../models/Product");

// GET ALL PRODUCTS
const getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    return res.status(200).json({ success: true, products });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Shared validation and payload builder for product variants
const buildVariants = (variants) => {
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new Error("At least one product size/variant is required.");
  }

  return variants.map((variant) => {
    if (!variant.name?.trim()) {
      throw new Error("Variant size/name is required.");
    }

    const mrp = Number(variant.mrp);
    const purchasePrice = Number(variant.purchasePrice);
    const sellingPrice = Number(variant.sellingPrice);
    const quantity = Number(variant.quantity);

    if (
      !Number.isFinite(mrp) ||
      !Number.isFinite(purchasePrice) ||
      !Number.isFinite(sellingPrice) ||
      !Number.isInteger(quantity) ||
      mrp < 0 || purchasePrice < 0 || sellingPrice < 0 || quantity < 0
    ) {
      throw new Error("Please enter valid variant prices and quantity.");
    }

    return {
      ...(variant._id && mongoose.Types.ObjectId.isValid(variant._id)
        ? { _id: variant._id }
        : {}),
      name: variant.name.trim(),
      warranty: variant.warranty?.trim() || "",
      mrp,
      purchasePrice,
      sellingPrice,
      quantity,
    };
  });
};

const validateProductFields = ({ category, company, model, addedDate }) => {
  if (!category?.trim()) throw new Error("Category is required.");
  if (!company?.trim()) throw new Error("Company name is required.");
  if (!model?.trim()) throw new Error("Model name is required.");
  if (!addedDate || Number.isNaN(new Date(addedDate).getTime())) {
    throw new Error("Please enter a valid product added date.");
  }
};

// ADD PRODUCT
const addProduct = async (req, res) => {
  try {
    const { name, category, company, model, addedDate, variants } = req.body;
    validateProductFields({ category, company, model, addedDate });
    const productName = name?.trim() || `${category.trim()} - ${company.trim()} - ${model.trim()}`;
    const product = await Product.create({
      name: productName,
      category: category.trim(),
      company: company.trim(),
      model: model.trim(),
      addedDate,
      variants: buildVariants(variants),
    });

    return res.status(201).json({
      success: true,
      message: "Product added successfully!",
      product,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// UPDATE PRODUCT (including direct stock correction)
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID." });
    }

    const { name, category, company, model, addedDate, variants } = req.body;
    validateProductFields({ category, company, model, addedDate });
    const updatedVariants = buildVariants(variants);
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    product.name = name?.trim() || `${category.trim()} - ${company.trim()} - ${model.trim()}`;
    product.category = category.trim();
    product.company = company.trim();
    product.model = model.trim();
    product.addedDate = addedDate;

    // Preserve existing variant _ids where supplied so historical sale references remain stable.
    product.variants = updatedVariants;

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product updated successfully. Stock quantities have been saved.",
      product,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE PRODUCT
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID." });
    }

    const product = await Product.findByIdAndDelete(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    return res.status(200).json({ success: true, message: "Product deleted successfully!" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ADD STOCK (increments quantity and records stock history)
const addStock = async (req, res) => {
  try {
    const { productId, variantId, quantity, date } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID." });
    }

    const stockQuantity = Number(quantity);
    if (!Number.isInteger(stockQuantity) || stockQuantity <= 0) {
      return res.status(400).json({ success: false, message: "Enter a valid stock quantity." });
    }

    if (!date || Number.isNaN(new Date(date).getTime())) {
      return res.status(400).json({ success: false, message: "Please enter a valid stock date." });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    let variantName = "General Stock";
    let stockVariantId = null;

    if (product.variants.length > 0) {
      if (!variantId || !mongoose.Types.ObjectId.isValid(variantId)) {
        return res.status(400).json({ success: false, message: "Please select a valid product variant." });
      }

      const variant = product.variants.id(variantId);
      if (!variant) {
        return res.status(404).json({ success: false, message: "Product variant not found." });
      }

      variant.quantity += stockQuantity;
      variantName = variant.name;
      stockVariantId = variant._id;
    } else {
      product.quantity = (product.quantity || 0) + stockQuantity;
    }

    product.stockHistory.push({
      variantId: stockVariantId,
      variantName,
      quantity: stockQuantity,
      date,
    });

    await product.save();
    return res.status(200).json({ success: true, message: "Stock updated successfully!", product });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  addStock,
};
