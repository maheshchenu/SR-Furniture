const mongoose = require("mongoose");
const companySchema = new mongoose.Schema({
  category: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  normalizedName: { type: String, required: true, trim: true, lowercase: true },
}, { timestamps: true });
companySchema.index({ category: 1, normalizedName: 1 }, { unique: true });
module.exports = mongoose.model("Company", companySchema);
