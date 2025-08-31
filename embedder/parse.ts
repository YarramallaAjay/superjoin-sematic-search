import * as XLSX from "xlsx";
import { makeEmbeddings } from "./embedding";

interface ParsedCell {
  tenantId: string;
  workbookId: string;
  sheetId: string;
  metric: string;
  dimensions: Record<string, string>;
  semanticString: string;
  value: any;
  unit: string;
  dataType: string;
  features: {
    isPercentage: boolean;
    isMargin: boolean;
    isGrowth: boolean;
    isAggregation: boolean;
    isForecast: boolean;
  };
  year?: number;
  quarter?: string;
  month?: string;
  embedding: number[];
  sourceCell: string;
  sourceFormula: string | null;
}

// ---------- Helpers ----------

function isNumeric(val: any): boolean {
  return typeof val === "number" || (!isNaN(val) && val !== null && val !== "");
}

function normalizeHeader(text: string): string {
  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower.includes("sales") || lower.includes("turnover")) return "Revenue";
  if (lower.includes("gross") && lower.includes("profit")) return "Gross Profit";
  if (lower.includes("net") && lower.includes("profit")) return "Net Profit";
  if (lower.includes("ebit")) return "Operating Profit";
  if (lower.includes("cogs")) return "Cost of Goods Sold";
  if (lower.includes("margin")) return "Margin";
  return text.trim();
}

function extractTimeHint(val: string): { year?: number; quarter?: string; month?: string } {
  const hints: any = {};
  const lower = (val || "").toLowerCase();

  const yearMatch = val.match(/\b(20\d{2})\b/);
  if (yearMatch) hints.year = parseInt(yearMatch[1]);

  const quarterMatch = val.match(/\bQ([1-4])\b/i);
  if (quarterMatch) hints.quarter = `Q${quarterMatch[1]}`;

  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  for (let i = 0; i < months.length; i++) {
    if (lower.includes(months[i])) {
      hints.month = months[i].charAt(0).toUpperCase() + months[i].slice(1);
      if (!hints.quarter) hints.quarter = `Q${Math.floor(i / 3) + 1}`;
      break;
    }
  }
  return hints;
}

function formatTimeHint(hints: { year?: number; quarter?: string; month?: string }): string {
  if (hints.year && hints.quarter) return `${hints.year} ${hints.quarter}`;
  if (hints.year && hints.month) return `${hints.month} ${hints.year}`;
  if (hints.year) return `${hints.year}`;
  return "";
}

// ---------- Main Parser ----------

export async function parseWorkbook(
  tenantId: string,
  workbookId: string,
  buffer: Buffer,
  onCellParsed?: (cell: ParsedCell, cellId: string) => Promise<void>,
  onSheetParsed?: (sheetName: string, rowCount: number, colCount: number, cellCount: number) => Promise<void>
): Promise<ParsedCell[]> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const parsed: ParsedCell[] = [];
  const embeddingPromises: Promise<number[]>[] = [];
  const cellIds: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, any>[];
    if (!rows.length) continue;

    // Detect metrics vs. dimensions
    const headers = Object.keys(rows[0]);
    const metrics = headers.filter(h => rows.some(r => isNumeric(r[h])));
    const dimensions = headers.filter(h => !metrics.includes(h));
    
    let sheetCellCount = 0;

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];

      for (const metric of metrics) {
        const metricName = normalizeHeader(metric);
        const metricVal = row[metric];
        if (metricVal == null || metricVal === "") continue;

        const dims: Record<string, string> = {};
        const dimParts: string[] = [];
        let timeHints: any = {};

        for (const d of dimensions) {
          if (!row[d]) continue;
          const hints = extractTimeHint(String(row[d]));
          if (Object.keys(hints).length) timeHints = { ...timeHints, ...hints };
          const formatted = formatTimeHint(hints) || row[d];
          dims[d] = formatted;
          dimParts.push(`${d}=${formatted}`);
        }

        const semanticString = [normalizeHeader(sheetName), metricName, ...dimParts].join(" | ");
        
        // Generate unique cell ID
        const cellId = `cell_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        cellIds.push(cellId);

        // Start embedding generation asynchronously
        const embeddingPromise = makeEmbeddings([semanticString]).then(embeddings => embeddings[0]);
        embeddingPromises.push(embeddingPromise);

        // Reconstruct provenance (optional: cell address)
        const colIndex = headers.indexOf(metric);
        const addr = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex }); // +1 skips header row
        const cell = ws[addr];

        const parsedCell: ParsedCell = {
          tenantId,
          workbookId,
          sheetId: `sh_${sheetName.toLowerCase().replace(/\s+/g, "_")}`,
          metric: metricName,
          dimensions: dims,
          semanticString,
          value: metricVal,
          unit: typeof metricVal === "string" && metricVal.includes("%") ? "%" : "USD",
          dataType:
            typeof metricVal === "number"
              ? "number"
              : typeof metricVal === "string" && metricVal.includes("%")
              ? "percent"
              : "string",
          features: {
            isPercentage: typeof metricVal === "string" && metricVal.includes("%"),
            isMargin: metricName.toLowerCase().includes("margin"),
            isGrowth: metricName.toLowerCase().includes("growth"),
            isAggregation: metricName.toLowerCase().includes("total"),
            isForecast: sheetName.toLowerCase().includes("forecast"),
          },
          ...timeHints,
          embedding: [], // will be filled later
          sourceCell: addr,
          sourceFormula: (cell as any)?.f || null,
        };

        parsed.push(parsedCell);
        sheetCellCount++;

        // If callback provided, store cell in DB immediately
        if (onCellParsed) {
          await onCellParsed(parsedCell, cellId);
        }
      }
    }
    
    // Call sheet parsed callback
    if (onSheetParsed) {
      await onSheetParsed(sheetName, rows.length, headers.length, sheetCellCount);
    }
  }

  // Wait for all embeddings to complete
  const embeddings = await Promise.all(embeddingPromises);
  
  // Attach embeddings to parsed cells
  parsed.forEach((rec, i) => {
    rec.embedding = embeddings[i];
  });

  return parsed;
}
