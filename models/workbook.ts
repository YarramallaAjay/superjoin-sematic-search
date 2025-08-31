import mongoose, { Schema, model } from "mongoose";

const SheetSchema = new Schema({
    _id: { type: String, required: true },
    workbookId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const WorkbookSchema = new Schema({
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    contentHash: { type: String, required: true, index: true },
    sheets: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const TenantSchema = new Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const AtlasCellSchema = new Schema({
    _id: { type: String, required: true },
    tenantId: { type: String, required: true, index: true },
    workbookId: { type: String, required: true, index: true },
    sheetId: { type: String, required: true, index: true },

    rowHeader: String,
    colHeader: String,
    semanticString: { type: String, required: true },

    value: Schema.Types.Mixed,
    unit: { type: String, default: 'USD' },
    dataType: { type: String, enum: ['number', 'string', 'date', 'percent', 'ratio'] },

    features: {
        isPercentage: { type: Boolean, default: false },
        isMargin: { type: Boolean, default: false },
        isGrowth: { type: Boolean, default: false },
        isAggregation: { type: Boolean, default: false },
        isForecast: { type: Boolean, default: false }
    },

    year: Number,
    quarter: { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4'] },
    month: String,
    region: String,
    product: String,
    customer: String,

    embedding: [{ type: Number, required: true }],

    sourceCell: String,
    sourceFormula: String,

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Index for vector search (MongoDB Atlas Vector Search will hook here)

export const AtlasCellModel = model('AtlasCell', AtlasCellSchema);
export const workBookModel = model('Workbook', WorkbookSchema);
export const tenantModel = model('Tenant', TenantSchema);
export const sheetModel = model('Sheet', SheetSchema);
  