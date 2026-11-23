const mongoose = require("mongoose");
const Product = require("../models/Product");

const getProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, products });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const buildSizes = (sizes) => {
  if (!Array.isArray(sizes) || !sizes.length) throw new Error("At least one Size/Type is required.");
  return sizes.map((size) => {
    if (!size.name?.trim()) throw new Error("Size/Type name is required.");
    const mrp = Number(size.mrp || 0);
    const purchasePrice = Number(size.purchasePrice || 0);
    const sellingPrice = Number(size.sellingPrice || 0);
    const quantity = Number(size.quantity || 0);
    if (![mrp, purchasePrice, sellingPrice, quantity].every(Number.isFinite) || !Number.isInteger(quantity) || [mrp, purchasePrice, sellingPrice, quantity].some((n) => n < 0)) throw new Error("Enter valid Size/Type prices and stock quantity.");
    return {
      ...(size._id && mongoose.Types.ObjectId.isValid(size._id) ? { _id: size._id } : {}),
      name: size.name.trim(), warranty: String(size.warranty || "").trim(),
      mrp, purchasePrice, sellingPrice, quantity,
    };
  });
};

const validateFields = ({ category, company, model, addedDate }) => {
  if (!category?.trim()) throw new Error("Category is required.");
  if (!company?.trim()) throw new Error("Company is required.");
  if (!model?.trim()) throw new Error("Model is required.");
  if (addedDate && Number.isNaN(new Date(addedDate).getTime())) throw new Error("Enter a valid added date.");
};

const addProduct = async (req, res) => {
  try {
    const { name, category, company, model, addedDate, sizes } = req.body;
    validateFields({ category, company, model, addedDate });
    const product = await Product.create({
      name: name?.trim() || `${category.trim()} - ${company.trim()} - ${model.trim()}`,
      category: category.trim(), company: company.trim(), model: model.trim(),
      addedDate: addedDate || new Date().toISOString().slice(0, 10),
      sizes: buildSizes(sizes),
    });
    return res.status(201).json({ success: true, message: "Product added successfully!", product });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: "Invalid product ID." });
    const { name, category, company, model, addedDate, sizes } = req.body;
    validateFields({ category, company, model, addedDate });
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });
    product.name = name?.trim() || `${category.trim()} - ${company.trim()} - ${model.trim()}`;
    product.category = category.trim(); product.company = company.trim(); product.model = model.trim();
    if (addedDate) product.addedDate = addedDate;
    // Update direct size records. Legacy variants are intentionally not overwritten.
    product.sizes = buildSizes(sizes);
    await product.save();
    return res.status(200).json({ success: true, message: "Product updated successfully.", product });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid product ID." });
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });
    return res.status(200).json({ success: true, message: "Product deleted successfully!" });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

const addStock = async (req, res) => {
  try {
    const { productId, sizeId, variantId, quantity, date } = req.body;
    if (!mongoose.Types.ObjectId.isValid(productId)) return res.status(400).json({ success: false, message: "Invalid product ID." });
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ success: false, message: "Enter a valid stock quantity." });
    if (!date || Number.isNaN(new Date(date).getTime())) return res.status(400).json({ success: false, message: "Enter a valid stock date." });
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: "Product not found." });
    let history = { sizeId: null, sizeName: "General Stock", quantity: qty, date };
    if (product.sizes?.length) {
      if (!sizeId || !mongoose.Types.ObjectId.isValid(sizeId)) return res.status(400).json({ success: false, message: "Select a valid Size/Type." });
      const size = product.sizes.id(sizeId);
      if (!size) return res.status(404).json({ success: false, message: "Size/Type not found." });
      size.quantity += qty; history.sizeId = size._id; history.sizeName = size.name;
    } else if (product.variants?.length) {
      // Backward compatibility for products created before the direct Size/Type structure.
      if (!variantId || !mongoose.Types.ObjectId.isValid(variantId)) return res.status(400).json({ success: false, message: "Select a valid legacy variant." });
      const variant = product.variants.id(variantId);
      if (!variant) return res.status(404).json({ success: false, message: "Legacy variant not found." });
      variant.quantity += qty; history.variantId = variant._id; history.variantName = variant.name;
    } else product.quantity = (product.quantity || 0) + qty;
    product.stockHistory.push(history);
    await product.save();
    return res.status(200).json({ success: true, message: "Stock updated successfully!", product });
  } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

module.exports = { getProducts, addProduct, updateProduct, deleteProduct, addStock };
