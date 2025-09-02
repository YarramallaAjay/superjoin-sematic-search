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

// Cell (AtlasCell)
const AtlasCellSchema = new Schema({
  _id: { type: String, required: true },
  tenantId: { type: String, required: true, index: true },
  workbookId: { type: String, required: true, index: true },
  sheetId: { type: String, required: true, index: true },

  // Structured fields
  sheetName: String,
  metric: String,              // e.g. "EBITDA Margin", "Net Sales"
  year: Number,
  quarter: { type: String, enum: ["Q1", "Q2", "Q3", "Q4"] },
  month: String,
  region: String,
  product: String,
  customer: String,

  // Semantic string for embeddings
  semanticString: { type: String, required: true },

  // Actual cell values
  value: Schema.Types.Mixed,
  unit: { type: String, default: "INR" },
  dataType: { type: String, enum: ["number", "string", "date", "percent", "ratio"] },

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

export const TenantModel = model("Tenant", TenantSchema);
export const WorkbookModel = model("Workbook", WorkbookSchema);
export const SheetModel = model("Sheet", SheetSchema);
export const AtlasCellModel = model("AtlasCell", AtlasCellSchema);
