import mongoose, { Schema, model } from "mongoose";

// Tenant
const TenantSchema = new Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  workbooks: [{ type: String, ref: 'Workbook' }]
});

// Workbook
const WorkbookSchema = new Schema({
  _id: { type: String, required: true },
  tenantId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  contentHash: { type: String, required: true, index: true },
  sheets: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Sheet
const SheetSchema = new Schema({
  _id: { type: String, required: true },
  workbookId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  rowCount: { type: Number, default: 0 },
  colCount: { type: Number, default: 0 },
  cellCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Cell (AtlasCell) - Updated for new interface
const AtlasCellSchema = new Schema({
  _id: { type: String, required: true },
  tenantId: { type: String, required: true, index: true },
  workbookId: { type: String, required: true, index: true },
  sheetId: { type: String, required: true, index: true },

  // Precise cell location
  sheetName: { type: String, required: true },
  rowIndex: Number,
  colIndex: Number,
  rowName: String,
  colName: String,
  cellAddress: String,

  // Raw and parsed values
  rawValue: Schema.Types.Mixed,
  value: Schema.Types.Mixed,
  metric: String,              // e.g. "EBITDA Margin", "Net Sales"

  // Semantic string for embedding
  semanticString: { type: String, required: true },

  // Time dimensions (year, month, quarter)
  year: Number,
  month: String,
  quarter: { type: String, enum: ["Q1", "Q2", "Q3", "Q4"] },

  // All dimensions (preserved as-is)
  dimensions: { type: Schema.Types.Mixed, default: {} },

  // Data type and features
  dataType: { type: String, enum: ["number", "string", "date", "percent", "ratio"] },
  unit: { type: String, default: "INR" },
  features: {
    isPercentage: { type: Boolean, default: false },
    isMargin: { type: Boolean, default: false },
    isGrowth: { type: Boolean, default: false },
    isAggregation: { type: Boolean, default: false },
    isForecast: { type: Boolean, default: false }
  },

  // Vector embedding
  embedding: [{ type: Number, required: true }],

  // Provenance
  sourceCell: String,
  sourceFormula: String,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Prevent model recompilation in development
export const TenantModel = mongoose.models.tenants || model("tenants", TenantSchema);
export const WorkbookModel = mongoose.models.workbooks || model("workbooks", WorkbookSchema);
export const SheetModel = mongoose.models.sheets || model("sheets", SheetSchema);
export const AtlasCellModel = mongoose.models.atlascells || model("atlascells", AtlasCellSchema);
