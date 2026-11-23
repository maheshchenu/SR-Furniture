const Company = require("../models/Company");

exports.getCompanies = async (req, res) => {
  try {
    const filter = req.query.category ? { category: String(req.query.category).trim() } : {};
    const companies = await Company.find(filter).sort({ name: 1 });
    res.status(200).json({ success: true, companies });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.addCompany = async (req, res) => {
  try {
    const category = String(req.body.category || "").trim();
    const name = String(req.body.name || "").trim();
    if (!category || !name) return res.status(400).json({ success: false, message: "Category and company name are required." });
    const normalizedName = name.toLocaleLowerCase();
    const existing = await Company.findOne({ category, normalizedName });
    if (existing) return res.status(200).json({ success: true, message: "Company already exists.", company: existing });
    const company = await Company.create({ category, name, normalizedName });
    return res.status(201).json({ success: true, message: "Company saved successfully.", company });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "Company already exists for this category." });
    return res.status(500).json({ success: false, message: error.message });
  }
};
