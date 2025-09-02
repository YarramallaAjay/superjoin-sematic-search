import * as XLSX from "xlsx";
import { semanticNormalizer } from "../utils/semantic-normalizer";
import { makeEmbeddingsOptimized } from "./embedding";

export interface EnhancedParsedCell {
  _id: string;
  tenantId: string;
  workbookId: string;
  sheetId: string;

  semanticString: string; // for embedding

  metric: string;
  normalizedMetric: string;

  year?: number;
  quarter?: string;
  month?: string;
  region?: string;
  customerId?: string;
  customerName?: string;
  product?: string;
  department?: string;
  channel?: string;
  category?: string;
  status?: string;
  priority?: string;

  dimensions: Record<string, any>;

  value: any;
  unit: string;
  dataType: string;

  features: {
    isPercentage: boolean;
    isMargin: boolean;
    isGrowth: boolean;
    isAggregation: boolean;
    isForecast: boolean;
    isUniqueIdentifier: boolean;
  };

  embedding: number[];

  sourceCell: string | null;
  sourceFormula: string | null;
}

// -------- Parser ---------

export async function parseWorkbookEnhanced(
  tenantId: string,
  workbookId: string,
  buffer: Buffer,
  onCellParsed?: (cell: EnhancedParsedCell, cellId: string) => Promise<void>,
  onSheetParsed?: (sheetName: string, rowCount: number, colCount: number, cellCount: number) => Promise<void>
): Promise<EnhancedParsedCell[]> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const parsed: EnhancedParsedCell[] = [];
  const semanticStrings: string[] = [];

  console.log("📊 Starting enhanced workbook parsing...");

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, any>[];
    if (!rows.length) continue;

    const headers = Object.keys(rows[0]);
    const metrics = headers.filter((h) => rows.some((r) => isNumeric(r[h])));
    const dimensions = headers.filter((h) => !metrics.includes(h));

    console.log(`📄 Sheet: ${sheetName}`);
    console.log("   → Metrics:", metrics);
    console.log("   → Dimensions:", dimensions);

    const sheetCells: EnhancedParsedCell[] = [];
    const sheetSemanticStrings: string[] = [];

    for (let rIndex = 0; rIndex < rows.length; rIndex++) {
      const row = rows[rIndex];

      for (const metric of metrics) {
        const metricVal = row[metric];
        if (!isNumeric(metricVal)) continue;

        const dims: Record<string, any> = {};
        const structuredFields: Record<string, any> = {};

        for (const dim of dimensions) {
          if (!row[dim]) continue;

          const dimValue = String(row[dim]);
          dims[dim] = dimValue;

          const normalized = semanticNormalizer.normalizeValue(dimValue);
          const timeHints = semanticNormalizer.extractTimeHints(dimValue);

          if (normalized.category === "time") {
            if (timeHints.year) structuredFields.year = timeHints.year;
            if (timeHints.quarter) structuredFields.quarter = timeHints.quarter;
            if (timeHints.month) structuredFields.month = timeHints.month;
          } else if (normalized.category === "dimension") {
            if (normalized.normalized === "Region") structuredFields.region = dimValue;
            if (normalized.normalized === "Customer") {
              if (semanticNormalizer.isUniqueIdentifier(dimValue)) {
                structuredFields.customerId = dimValue;
                structuredFields.isUniqueIdentifier = true;
              } else {
                structuredFields.customerName = dimValue;
              }
            }
            if (normalized.normalized === "Product") structuredFields.product = dimValue;
            if (normalized.normalized === "Department") structuredFields.department = dimValue;
            if (normalized.normalized === "Channel") structuredFields.channel = dimValue;
            if (normalized.normalized === "Category") structuredFields.category = dimValue;
          } else if (normalized.category === "status") {
            structuredFields.status = normalized.normalized;
          } else if (normalized.category === "priority") {
            structuredFields.priority = normalized.normalized;
          }
        }

        const normalizedMetric = semanticNormalizer.normalizeMetric(metric);

        const semanticString = semanticNormalizer.buildSemanticString(
          sheetName,
          normalizedMetric,
          dims,
          structuredFields
        );

        const dataType = determineDataType(metricVal, metric);
        const features = determineFeatures(metric, metricVal, dataType);

        const cellId = `cell_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const parsedCell: EnhancedParsedCell = {
          _id: cellId,
          tenantId,
          workbookId,
          sheetId: `sh_${sheetName.toLowerCase().replace(/\s+/g, "_")}`,
          semanticString,

          metric,
          normalizedMetric,
          ...structuredFields,

          dimensions: dims,
          value: metricVal,
          unit: determineUnit(metric),
          dataType,
          features,

          embedding: [],
          sourceCell: `R${rIndex + 2}`, // keep simple, row-based reference
          sourceFormula: null,
        };

        sheetCells.push(parsedCell);
        sheetSemanticStrings.push(semanticString);

        if (onCellParsed) await onCellParsed(parsedCell, cellId);
      }
    }

    if (onSheetParsed)
      await onSheetParsed(sheetName, rows.length, headers.length, sheetCells.length);

    parsed.push(...sheetCells);
    semanticStrings.push(...sheetSemanticStrings);
  }

  console.log(`📊 Total metric cells parsed: ${parsed.length}`);

  const embeddings = await makeEmbeddingsOptimized(semanticStrings); // batch size
  parsed.forEach((cell, idx) => {
    if (embeddings[idx]) cell.embedding = embeddings[idx];
  });

  console.log(`✅ Attached embeddings to ${parsed.length} cells`);
  return parsed;
}

// -------- Helpers ----------

function isNumeric(val: any): boolean {
  return typeof val === "number" && !isNaN(val);
}

function determineDataType(value: any, metric: string): "number" | "string" | "date" | "percent" | "ratio" {
  if (typeof value === "number") return "number";
  if (typeof value === "string") {
    if (value.includes("%") || metric.toLowerCase().includes("margin")) return "percent";
    if (value.includes("/") || value.includes(":")) return "ratio";
    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) return "date";
  }
  return "string";
}

function determineUnit(metric: string): string {
  const lower = metric.toLowerCase();
  if (lower.includes("margin") || lower.includes("rate") || lower.includes("%")) return "%";
  if (lower.includes("ratio")) return "ratio";
  return "INR";
}

function determineFeatures(
  metric: string,
  value: any,
  dataType: string
): EnhancedParsedCell["features"] {
  const lowerMetric = metric.toLowerCase();
  return {
    isPercentage: dataType === "percent" || lowerMetric.includes("margin"),
    isMargin: lowerMetric.includes("margin") || lowerMetric.includes("profit"),
    isGrowth: lowerMetric.includes("growth") || lowerMetric.includes("yoy") || lowerMetric.includes("qoq"),
    isAggregation: lowerMetric.includes("total") || lowerMetric.includes("sum") || lowerMetric.includes("average"),
    isForecast: lowerMetric.includes("forecast") || lowerMetric.includes("budget"),
    isUniqueIdentifier: false,
  };
}
