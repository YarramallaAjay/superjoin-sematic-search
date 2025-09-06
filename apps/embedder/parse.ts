import * as XLSX from "xlsx";
import { makeEmbeddingsOptimized } from "./embedding";

/**
 * PRECISE CELL PARSING - INTELLIGENT SEMANTIC FORMATTING
 * 
 * This parser intelligently formats semantic strings based on row value type:
 * 
 * FOR CODED ROWS (like "CUST_001", "PROD_002", "SKU-001"):
 * - Uses actual column headers joined with underscore
 * - Example: "Sales | customer_region | 2023 | Jan"
 * 
 * FOR NORMAL ROWS (like "John Smith", "Company ABC"):
 * - Uses "RowName_ColName" format
 * - Example: "Sales | John Smith_Revenue | 2023 | Jan"
 * 
 * Semantic string format: "SheetName | SemanticPart | Year | Month"
 */

export interface EnhancedParsedCell {
  _id: string;
  tenantId: string;
  workbookId: string;
  sheetId: string;
  sheetName: string;

  // Precise cell location and data
  rowIndex: number;
  colIndex: number;
  rowName: string | null;
  colName: string | null;
  cellAddress: string; // e.g., "A1", "B5"

  // Raw values - no normalization
  rawValue: any;
  value: number | string | Date | null; // parsed numeric value, date, or string
  metric: string; // column header (e.g., "Revenue", "Gross Profit")
  
  // Semantic string for embedding (simple format: "SheetName | RowName_ColName | Year | Month")
  semanticString: string;

  // Time dimensions (year, month, quarter)
  year?: number;
  month?: string;
  quarter?: string;

  // Other dimensions (preserve original values, don't normalize)
  dimensions: Record<string, any>;

  // Data type and features
  dataType: "number" | "string" | "date" | "percent" | "ratio";
  unit: string;
  features: {
    isPercentage: boolean;
    isMargin: boolean;
    isGrowth: boolean;
    isAggregation: boolean;
    isForecast: boolean;
    isHeader: boolean;
    isData: boolean;
    isTotal: boolean;
  };

  embedding: number[];
  sourceCell: string;
  sourceFormula: string | null;
}

interface HeaderInfo {
  rowHeaders: string[];
  columnHeaders: string[];
  dataStartRow: number;
}

export class ExcelParser {
  private monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                        'july', 'august', 'september', 'october', 'november', 'december'];

  /**
   * Main function to parse and upload cells - ASYNC OPTIMIZED VERSION
   */
  async parseAndUploadCells(
    tenantId: string,
    workbookId: string,
    buffer: Buffer,
    onCellParsed?: (cell: EnhancedParsedCell, cellId: string) => Promise<void>,
    onSheetParsed?: (sheetName: string, rowCount: number, colCount: number, cellCount: number) => Promise<void>
  ): Promise<EnhancedParsedCell[]> {
    const wb = XLSX.read(buffer, { type: "buffer" });
    
    // Process all sheets in parallel for better performance
    const sheetPromises = wb.SheetNames.map(async (sheetName) => {
      const ws = wb.Sheets[sheetName];
      
      // Get the actual range of data in the sheet
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const maxRow = range.e.r;
      const maxCol = range.e.c;
      
      // Parse the sheet asynchronously
      const sheetCells = await this.parseSheetAsync(ws, sheetName, maxRow, maxCol, tenantId, workbookId);
      
      // Process cell callbacks in batches to avoid overwhelming the system
      if (onCellParsed && sheetCells.length > 0) {
        await this.processCellCallbacks(sheetCells, onCellParsed);
      }

      // Call sheet parsed callback
      if (onSheetParsed) {
        await onSheetParsed(sheetName, maxRow + 1, maxCol + 1, sheetCells.length);
      }

      return sheetCells;
    });

    // Wait for all sheets to be processed
    const sheetResults = await Promise.all(sheetPromises);
    const allCells = sheetResults.flat();

    // Generate embeddings for all cells at once (already optimized)
    const semanticStrings = allCells.map(cell => ({
      cellId: cell._id,
      semanticString: cell.semanticString
    }));
    
    const embeddings = await makeEmbeddingsOptimized(semanticStrings);
    if(embeddings.length !== allCells.length){
      throw new Error("All embeddings are not generated");
    }
    
    // Attach embeddings to cells using cellId mapping
    embeddings.forEach((embeddingResult) => {
      const cell = allCells.find(cell => cell._id === embeddingResult.cellId);
      if (cell) {
        cell.embedding = embeddingResult.embedding;
      }
    });

    console.log(`✅ Attached embeddings to ${allCells.length} cells`);
    return allCells;
  }

  /**
   * Process cell callbacks in batches to avoid overwhelming the system
   */
  private async processCellCallbacks(
    cells: EnhancedParsedCell[],
    onCellParsed: (cell: EnhancedParsedCell, cellId: string) => Promise<void>
  ): Promise<void> {
    const batchSize = 50; // Process 50 cells at a time
    
    for (let i = 0; i < cells.length; i += batchSize) {
      const batch = cells.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(cell => onCellParsed(cell, cell._id));
      await Promise.all(batchPromises);
      
      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < cells.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  /**
   * Parse a single sheet asynchronously
   */
  private async parseSheetAsync(
    ws: XLSX.WorkSheet, 
    sheetName: string, 
    maxRow: number, 
    maxCol: number,
    tenantId: string,
    workbookId: string
  ): Promise<EnhancedParsedCell[]> {
    // Use setImmediate to make this truly async and non-blocking
    return new Promise((resolve) => {
      setImmediate(async () => {
        const result = await this.parseSheet(ws, sheetName, maxRow, maxCol, tenantId, workbookId);
        resolve(result);
      });
    });
  }

  /**
   * Parse a single sheet (synchronous version - kept for compatibility)
   */
  private async parseSheet(
    ws: XLSX.WorkSheet, 
    sheetName: string, 
    maxRow: number, 
    maxCol: number,
    tenantId: string,
    workbookId: string
  ): Promise<EnhancedParsedCell[]> {
    const cells: EnhancedParsedCell[] = [];
    const timeInfo: { year?: number; month?: string; quarter?: string; hour?: number; ampm?: string } = {};
    
    // First pass: identify headers and data structure
    const headers = this.extractHeaders(ws, maxRow, maxCol);
    const dataStartRow = headers.dataStartRow;
    
    console.log(`   → Headers found at row ${headers.rowHeaders}:`, headers.columnHeaders);
    console.log(`   → Data starts at row ${dataStartRow}`);

    // Second pass: parse data cells with async-friendly processing
    const cellPromises: Promise<EnhancedParsedCell | null>[] = [];
    
    for (let rowIndex = dataStartRow; rowIndex <= maxRow; rowIndex++) {
      const rowData = this.extractRowData(ws, rowIndex, maxCol, headers);
      
      // Process each column in the row
      for (let colIndex = 0; colIndex < headers.columnHeaders.length; colIndex++) {
        // Create a promise for each cell to allow for async processing
        const cellPromise = this.processCellAsync(
          ws, rowIndex, colIndex, rowData, headers, 
          sheetName, tenantId, workbookId
        );
        cellPromises.push(cellPromise);
      }
    }
    
    // Wait for all cells to be processed
    const cellResults = await Promise.all(cellPromises);
    const validCells = cellResults.filter(cell => cell !== null) as EnhancedParsedCell[];
    
    return validCells;
  }

  /**
   * Process a single cell asynchronously
   */
  private async processCellAsync(
    ws: XLSX.WorkSheet,
    rowIndex: number,
    colIndex: number,
    rowData: any[],
    headers: HeaderInfo,
    sheetName: string,
    tenantId: string,
    workbookId: string
  ): Promise<EnhancedParsedCell | null> {
    return new Promise((resolve) => {
      setImmediate(() => {
        try {
          const colName = headers.columnHeaders[colIndex];
          const cellValue = rowData[colIndex];
            
          // Skip empty cells
          if (cellValue === null || cellValue === undefined || cellValue === '') {
            resolve(null);
            return;
          }

          // Process values with improved type detection
          let processedValue: any = null;
          let dataType: "number" | "string" | "date" | "percent" | "ratio" = "string";
          
          // First, check if it's explicitly a date (string patterns only)
          if (this.isDateValue(cellValue)) {
            processedValue = cellValue;
            dataType = "date";
          } else if (this.isNumeric(cellValue)) {
            // Parse as numeric value (integers, floats, decimals, percentages)
            const numericValue = this.parseNumericValue(cellValue);
            if (numericValue !== null) {
              processedValue = numericValue;
              
              // Determine if it's a percentage based on the original value
              if (typeof cellValue === "string" && cellValue.includes('%')) {
                dataType = "percent";
              } else {
                dataType = "number";
              }
            } else {
              // If numeric parsing failed, treat as string
              processedValue = String(cellValue);
              dataType = "string";
            }
          } else {
            // Non-numeric, non-date values are treated as strings
            processedValue = String(cellValue);
            dataType = "string";
          }

          // Extract row name (first column or coded value)
          const rowName = this.extractRowName(rowData, headers);
          
          // Extract time information
          const timeInfo = this.extractTimeInfo(rowData);
          
          // For coded rows like "CUST_001", use headers like "customer_region"
          // For normal rows, use "RowName_ColName" format
          const semanticString = this.buildSemanticString(sheetName, rowName, colName, rowData, headers.columnHeaders);
          
          // Create cell object
          const cell: EnhancedParsedCell = {
            _id: `cell_${Math.random().toString(36).substring(2, 15)}`,
            tenantId,
            workbookId,
            sheetId: `sh_${sheetName.toLowerCase().replace(/\s+/g, "_")}`,
            sheetName,
            
            rowIndex: rowIndex + 1, // 1-based
            colIndex: colIndex + 1, // 1-based
            rowName,
            colName,
            cellAddress: XLSX.utils.encode_cell({ r: rowIndex, c: colIndex }),
            
            rawValue: cellValue,
            value: processedValue, // Store the actual value (numeric or date)
            metric: colName,
            
            semanticString,

            year: timeInfo.year,
            month: timeInfo.month,
            quarter: timeInfo.quarter,
            
            dimensions: this.extractDimensions(rowData, headers.columnHeaders),
            
            dataType: dataType,
            unit: this.determineUnit(colName),
            features: this.determineFeatures(colName, cellValue, rowIndex, headers.dataStartRow),

            embedding: [],
            sourceCell: XLSX.utils.encode_cell({ r: rowIndex, c: colIndex }),
            sourceFormula: null,
          };

          resolve(cell);
        } catch (error) {
          // If there's an error processing the cell, return null
          resolve(null);
        }
      });
    });
  }

  /**
   * Legacy synchronous cell processing (kept for compatibility)
   */
  private processCellSync(
    ws: XLSX.WorkSheet,
    rowIndex: number,
    colIndex: number,
    rowData: any[],
    headers: HeaderInfo,
    sheetName: string,
    tenantId: string,
    workbookId: string
  ): EnhancedParsedCell | null {
    const colName = headers.columnHeaders[colIndex];
    const cellValue = rowData[colIndex];
      
    // Skip empty cells
    if (cellValue === null || cellValue === undefined || cellValue === '') {
      return null;
    }

    // Process values with improved type detection
    let processedValue: any = null;
    let dataType: "number" | "string" | "date" | "percent" | "ratio" = "string";
    
    // First, check if it's explicitly a date (string patterns only)
    if (this.isDateValue(cellValue)) {
      processedValue = cellValue;
      dataType = "date";
    } else if (this.isNumeric(cellValue)) {
      // Parse as numeric value (integers, floats, decimals, percentages)
      const numericValue = this.parseNumericValue(cellValue);
      if (numericValue !== null) {
        processedValue = numericValue;
        
        // Determine if it's a percentage based on the original value
        if (typeof cellValue === "string" && cellValue.includes('%')) {
          dataType = "percent";
        } else {
          dataType = "number";
        }
      } else {
        // If numeric parsing failed, treat as string
        processedValue = String(cellValue);
        dataType = "string";
      }
    } else {
      // Non-numeric, non-date values are treated as strings
      processedValue = String(cellValue);
      dataType = "string";
    }

    // Extract row name (first column or coded value)
    const rowName = this.extractRowName(rowData, headers);
    
    // Extract time information
    const timeInfo = this.extractTimeInfo(rowData);
    
    // For coded rows like "CUST_001", use headers like "customer_region"
    // For normal rows, use "RowName_ColName" format
    const semanticString = this.buildSemanticString(sheetName, rowName, colName, rowData, headers.columnHeaders);
    
    // Create cell object
    const cell: EnhancedParsedCell = {
      _id: `cell_${Math.random().toString(36).substring(2, 15)}`,
      tenantId,
      workbookId,
      sheetId: `sh_${sheetName.toLowerCase().replace(/\s+/g, "_")}`,
      sheetName,
      
      rowIndex: rowIndex + 1, // 1-based
      colIndex: colIndex + 1, // 1-based
      rowName,
      colName,
      cellAddress: XLSX.utils.encode_cell({ r: rowIndex, c: colIndex }),
      
      rawValue: cellValue,
      value: processedValue, // Store the actual value (numeric or date)
      metric: colName,
      
      semanticString,

      year: timeInfo.year,
      month: timeInfo.month,
      quarter: timeInfo.quarter,
      
      dimensions: this.extractDimensions(rowData, headers.columnHeaders),
      
      dataType: dataType,
      unit: this.determineUnit(colName),
      features: this.determineFeatures(colName, cellValue, rowIndex, headers.dataStartRow),

      embedding: [],
      sourceCell: XLSX.utils.encode_cell({ r: rowIndex, c: colIndex }),
      sourceFormula: null,
    };

    return cell;
  }

  /**
   * Legacy synchronous parsing (kept for compatibility) 
   */
  private parseSheetLegacy(
    ws: XLSX.WorkSheet, 
    sheetName: string, 
    maxRow: number, 
    maxCol: number,
    tenantId: string,
    workbookId: string
  ): EnhancedParsedCell[] {
    const cells: EnhancedParsedCell[] = [];
    const timeInfo: { year?: number; month?: string; quarter?: string; hour?: number; ampm?: string } = {};
    
    // First pass: identify headers and data structure
    const headers = this.extractHeaders(ws, maxRow, maxCol);
    const dataStartRow = headers.dataStartRow;
    
    console.log(`   → Headers found at row ${headers.rowHeaders}:`, headers.columnHeaders);
    console.log(`   → Data starts at row ${dataStartRow}`);

    // Second pass: parse data cells
    for (let rowIndex = dataStartRow; rowIndex <= maxRow; rowIndex++) {
      const rowData = this.extractRowData(ws, rowIndex, maxCol, headers);
      
      // Process each column in the row
      for (let colIndex = 0; colIndex < headers.columnHeaders.length; colIndex++) {
        const colName = headers.columnHeaders[colIndex];
        const cellValue = rowData[colIndex];
          
        // Skip empty cells
        if (cellValue === null || cellValue === undefined || cellValue === '') {
          continue;
        }

        // Process values with improved type detection
        let processedValue: any = null;
        let dataType: "number" | "string" | "date" | "percent" | "ratio" = "string";
        
        // First, check if it's explicitly a date (string patterns only)
        if (this.isDateValue(cellValue)) {
          processedValue = cellValue;
          dataType = "date";
        } else if (this.isNumeric(cellValue)) {
          // Parse as numeric value (integers, floats, decimals, percentages)
          const numericValue = this.parseNumericValue(cellValue);
          if (numericValue !== null) {
          processedValue = numericValue;
            
            // Determine if it's a percentage based on the original value
            if (typeof cellValue === "string" && cellValue.includes('%')) {
              dataType = "percent";
            } else {
          dataType = "number";
            }
          } else {
            // If numeric parsing failed, treat as string
            processedValue = String(cellValue);
            dataType = "string";
          }
        } else {
          // Non-numeric, non-date values are treated as strings
          processedValue = String(cellValue);
          dataType = "string";
        }

        // Extract row name (first column value) - preserve original value like "CUST_001"
        const rowName = rowData[0] ? String(rowData[0]) : null;
        
        // Create semantic string: "SheetName | RowName_ColName | Year | Month"
        // For coded rows like "CUST_001", use headers like "customer_region"
        // For normal rows, use "RowName_ColName" format
        const semanticString = this.buildSemanticString(sheetName, rowName, colName, rowData, headers.columnHeaders);
        
        // Extract time dimensions (only year and month)
        const timeInfo = this.extractTimeInfo(rowData);
        
        // Create cell object
        const cell: EnhancedParsedCell = {
          _id: `cell_${Math.random().toString(36).substring(2, 15)}`,
          tenantId,
          workbookId,
          sheetId: `sh_${sheetName.toLowerCase().replace(/\s+/g, "_")}`,
          sheetName,
          
          rowIndex: rowIndex + 1, // 1-based
          colIndex: colIndex + 1, // 1-based
          rowName,
          colName,
          cellAddress: XLSX.utils.encode_cell({ r: rowIndex, c: colIndex }),
          
          rawValue: cellValue,
          value: processedValue, // Store the actual value (numeric or date)
          metric: colName,
          
          semanticString,

          year: timeInfo.year,
          month: timeInfo.month,
          quarter: timeInfo.quarter,
          
          dimensions: this.extractDimensions(rowData, headers.columnHeaders),
          
          dataType: dataType,
          unit: this.determineUnit(colName),
          features: this.determineFeatures(colName, cellValue, rowIndex, dataStartRow),

          embedding: [],
          sourceCell: XLSX.utils.encode_cell({ r: rowIndex, c: colIndex }),
          sourceFormula: null,
        };

        // Debug logging for first few cells to show the new semantic format
        if (cells.length < 3) {
          const isCoded = rowName ? this.isCodedValue(rowName) : false;
          console.log(`   📊 Cell ${cells.length + 1}:`, {
            rowName: rowName,
            colName: colName,
            isCoded: isCoded,
            semanticString: semanticString,
            value: processedValue,
            dataType: dataType
          });
        }

        cells.push(cell);
      }
    }

    return cells;
  }

  /**
   * Extract headers from the worksheet
   */
  private extractHeaders(ws: XLSX.WorkSheet, maxRow: number, maxCol: number): HeaderInfo {
    // Look for the first row that contains mostly text values (headers)
    let headerRow = 0;
    let rowHeaders: string[] = [], columnHeaders: string[] = [];
    
    for (let row = 0; row <= Math.min(10, maxRow); row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: 0 });
      const cell = ws[cellAddress];
      const textCount = this.countTextCells(ws, row, maxCol);
      const totalCells = textCount + 1;

      if (cell && cell.v !== null && cell.v !== undefined) {
        rowHeaders.push(String(cell.v).trim());
      }
    }

    // Extract column names from the header row
    for (let col = 0; col <= maxCol; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: col });
      const cell = ws[cellAddress];
      
      if (cell && cell.v !== null && cell.v !== undefined) {
        columnHeaders.push(String(cell.v).trim());
      } else {
        columnHeaders.push(`Column_${col + 1}`);
      }
    }

    return {
      rowHeaders,
      columnHeaders,
      dataStartRow: headerRow + 1
    };
  }

  /**
   * Count text cells in a row
   */
  private countTextCells(ws: XLSX.WorkSheet, row: number, maxCol: number): number {
    let textCount = 0;
    
    for (let col = 0; col <= maxCol; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = ws[cellAddress];
      
      if (cell && cell.v !== null && cell.v !== undefined) {
        const value = cell.v;
        if (typeof value === 'string' || (typeof value === 'number' && !this.isNumeric(value))) {
          textCount++;
        }
      }
    }
    
    return textCount;
  }

  /**
   * Extract row data from the worksheet
   */
  private extractRowData(ws: XLSX.WorkSheet, row: number, maxCol: number, headers: HeaderInfo): any[] {
    const rowData: any[] = [];
    
    for (let col = 0; col < headers.columnHeaders.length; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = ws[cellAddress];
      
      if (cell && cell.v !== null && cell.v !== undefined) {
        rowData.push(cell.v);
      } else {
        rowData.push(null);
      }
    }
    console.log(rowData);
    
    return rowData;
  }

  /**
   * Build semantic string for the cell
   */
  private buildSemanticString(
    sheetName: string, 
    rowName: string | null, 
    colName: string, 
    rowData: any[], 
    columnHeaders: string[]
  ): string {
    const parts: string[] = [];
    
    // 1. Sheet name
    parts.push(sheetName);
    
    // 2. Determine the semantic part based on row value type
    let semanticPart: string;
    
    // For normal row names, use "RowName_ColName" format
    semanticPart = rowName ? `${rowName}|${colName}` : colName;
    
    parts.push(semanticPart);
    
    // 3. Time dimensions (only year and month)
    const timeInfo = this.extractTimeInfo(rowData);
    if (timeInfo.year) parts.push(String(timeInfo.year));
    if (timeInfo.month) parts.push(timeInfo.month);
    
    return parts.join(' | ');
  }

  /**
   * Extract time information from row data
   */
  private extractTimeInfo(rowData: any[]): { year?: number; month?: string; quarter?: string; hour?: number; ampm?: string } {
    const timeInfo: { year?: number; month?: string; quarter?: string; hour?: number; ampm?: string } = {};
    
    for (const value of rowData) {
      if (!value) continue;
      
      const strValue = String(value);
      
      // Extract year patterns (4-digit year, 2-digit year, year ranges)
      const yearPatterns = [
        /\b(20\d{2})\b/,           // 2023, 2024, etc.
        /\b(19\d{2})\b/,           // 1990, 1995, etc.
        /\b(2\d{3})\b/,            // 2000-2999
        /\b(1\d{3})\b/,            // 1000-1999
        /\b(\d{2})['s]?\b/         // '23, '24, 23s, 24s
      ];
      
      for (const pattern of yearPatterns) {
        const yearMatch = strValue.match(pattern);
        if (yearMatch && !timeInfo.year) {
          let year = parseInt(yearMatch[1]);
          // Handle 2-digit years
          if (year < 100) {
            year = year >= 50 ? 1900 + year : 2000 + year; // 50+ = 1950s, <50 = 2000s
          }
          timeInfo.year = year;
          break;
        }
      }
      
      // Extract month patterns (full names, abbreviations, numbers, roman numerals)
      const monthPatterns = [
        // Full month names
        /\b(january|jan)\b/i,
        /\b(february|feb)\b/i,
        /\b(march|mar)\b/i,
        /\b(april|apr)\b/i,
        /\b(may)\b/i,
        /\b(june|jun)\b/i,
        /\b(july|jul)\b/i,
        /\b(august|aug)\b/i,
        /\b(september|sept?)\b/i,
        /\b(october|oct)\b/i,
        /\b(november|nov)\b/i,
        /\b(december|dec)\b/i,
        // Month numbers (1-12)
        /\b(0?[1-9]|1[0-2])\b/,
        // Roman numerals
        /\b(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)\b/i
      ];
      
      const romanMonths = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];
      
      for (let i = 0; i < monthPatterns.length; i++) {
        const match = strValue.match(monthPatterns[i]);
        if (match && !timeInfo.month) {
          let monthIndex = -1;
          
          if (i < 12) {
            // Full month names
            monthIndex = i;
          } else if (i === 12) {
            // Month numbers
            monthIndex = parseInt(match[1]) - 1;
          } else if (i === 13) {
            // Roman numerals
            monthIndex = romanMonths.indexOf(match[1].toLowerCase());
          }
          
          if (monthIndex >= 0 && monthIndex < 12) {
            timeInfo.month = this.monthNames[monthIndex];
            break;
          }
        }
      }
      
      // Extract quarter patterns
      const quarterPatterns = [
        /\b(q[1-4])\b/i,           // Q1, Q2, Q3, Q4
        /\b(quarter\s*[1-4])\b/i,  // quarter 1, quarter 2, etc.
        /\b(first|second|third|fourth)\s*quarter\b/i, // first quarter, etc.
        /\b(1st|2nd|3rd|4th)\s*quarter\b/i,  // 1st quarter, etc.
        /\b(q[1-4]\s*\d{4})\b/i    // Q1 2023, Q2 2024
      ];
      
      for (const pattern of quarterPatterns) {
        const quarterMatch = strValue.match(pattern);
        if (quarterMatch && !timeInfo.quarter) {
          const quarterText = quarterMatch[1].toLowerCase();
          if (quarterText.startsWith('q')) {
            timeInfo.quarter = quarterText.toUpperCase();
          } else if (quarterText.includes('1') || quarterText.includes('first') || quarterText.includes('1st')) {
            timeInfo.quarter = 'Q1';
          } else if (quarterText.includes('2') || quarterText.includes('second') || quarterText.includes('2nd')) {
            timeInfo.quarter = 'Q2';
          } else if (quarterText.includes('3') || quarterText.includes('third') || quarterText.includes('3rd')) {
            timeInfo.quarter = 'Q3';
          } else if (quarterText.includes('4') || quarterText.includes('fourth') || quarterText.includes('4th')) {
            timeInfo.quarter = 'Q4';
          }
          break;
        }
      }
      
      // Extract time patterns (hours with AM/PM)
      const timePatterns = [
        /\b(0?[1-9]|1[0-2]):([0-5][0-9])\s*(am|pm)\b/i,  // 9:30 AM, 2:45 PM
        /\b(0?[1-9]|1[0-2])\s*(am|pm)\b/i,                 // 9 AM, 2 PM
        /\b(0?[1-9]|1[0-2]):([0-5][0-9])\b/,              // 9:30, 14:30 (24-hour)
        /\b([0-9]|1[0-9]|2[0-3]):([0-5][0-9])\b/          // 24-hour format
      ];
      
      for (const pattern of timePatterns) {
        const timeMatch = strValue.match(pattern);
        if (timeMatch && !timeInfo.hour) {
          let hour = parseInt(timeMatch[1]);
          const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
          
          // Handle AM/PM
          if (timeMatch[3]) {
            const ampm = timeMatch[3].toLowerCase();
            if (ampm === 'pm' && hour !== 12) {
              hour += 12;
            } else if (ampm === 'am' && hour === 12) {
              hour = 0;
            }
            timeInfo.ampm = ampm.toUpperCase();
          } else if (hour > 12) {
            // 24-hour format, determine AM/PM
            if (hour >= 12) {
              timeInfo.ampm = 'PM';
              if (hour > 12) hour -= 12;
            } else {
              timeInfo.ampm = 'AM';
            }
          }
          
          timeInfo.hour = hour;
          break;
        }
      }
    }
    
    // Auto-classify quarter based on month if not already set
    if (timeInfo.month && !timeInfo.quarter) {
      const monthIndex = this.monthNames.indexOf(timeInfo.month.toLowerCase());
      if (monthIndex >= 0) {
        if (monthIndex < 3) timeInfo.quarter = 'Q1';
        else if (monthIndex < 6) timeInfo.quarter = 'Q2';
        else if (monthIndex < 9) timeInfo.quarter = 'Q3';
        else timeInfo.quarter = 'Q4';
      }
    }
    
    return {
      year: timeInfo.year,
      month: timeInfo.month,
      quarter: timeInfo.quarter
    };
  }

  /**
   * Extract row name from row data
   */
  private extractRowName(rowData: any[], headers: HeaderInfo): string | null {
    if (!rowData || rowData.length === 0) return null;
    
    // Use the first non-empty value as row name
    for (let i = 0; i < rowData.length; i++) {
      const value = rowData[i];
      if (value !== null && value !== undefined && value !== '') {
        return String(value);
      }
    }
    
    return null;
  }

  /**
   * Extract dimensions from row data
   */
  private extractDimensions(rowData: any[], columnNames: string[]): Record<string, any> {
    const dimensions: Record<string, any> = {};
    
    for (let i = 0; i < rowData.length; i++) {
      const value = rowData[i];
      const colName = columnNames[i];
      
      if (value !== null && value !== undefined && value !== '') {
        // Store the original value exactly as it appears in Excel
        // This preserves values like "CUST_001", "PROD_002", "SKU-001", etc.
        // No normalization or transformation - keep original format
        dimensions[colName] = value;
      }
    }
    
    return dimensions;
  }

  /**
   * Check if a value is a coded identifier
   */
  private isCodedValue(value: string): boolean {
    if (!value || typeof value !== 'string') return false;
    
    // Pattern 1: UPPERCASE_123 (e.g., CUST_001, PROD_002)
    const pattern1 = /^[A-Z]+\_\d+$/;
    
    // Pattern 2: UPPERCASE123 (e.g., CUST001, PROD002)
    const pattern2 = /^[A-Z]+\d+$/;
    
    // Pattern 3: UPPERCASE-123 (e.g., SKU-001, ITEM-002)
    const pattern3 = /^[A-Z]+\-\d+$/;
    
    return pattern1.test(value) || pattern2.test(value) || pattern3.test(value);
  }

  /**
   * Check if a value is a date - FIXED to prevent numeric values from being treated as dates
   */
  private isDateValue(val: any): boolean {
    if (val === null || val === undefined) return false;
    
    // If it's already a Date object
    if (val instanceof Date) return true;
    
    // NEVER treat raw numbers as dates - this was the main issue
    // Excel dates should only be detected from string patterns or explicit date formatting
    if (typeof val === "number") {
      return false; // Numbers are always numeric, never dates
    }
    
    // If it's a string, check for explicit date patterns
    if (typeof val === "string") {
      const trimmedVal = val.trim();
      
      // Only consider it a date if it matches explicit date patterns
      const datePatterns = [
        /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,           // MM/DD/YYYY or M/D/YY
        /^\d{1,2}-\d{1,2}-\d{2,4}$/,             // MM-DD-YYYY or M-D-YY
        /^\d{4}-\d{1,2}-\d{1,2}$/,               // YYYY-MM-DD
        /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},?\s+\d{4}$/i, // Jan 15, 2023
        /^\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}$/i,   // 15 Jan 2023
        /^q[1-4]\s+\d{4}$/i,                      // Q1 2023, Q2 2024
        /^quarter\s*[1-4]\s+\d{4}$/i,             // Quarter 1 2023
        /^fy\s*\d{2,4}$/i,                        // FY23, FY2023
        /^fiscal\s*(year|yr)\s*\d{2,4}$/i         // Fiscal Year 23
      ];
      
      return datePatterns.some(pattern => pattern.test(trimmedVal));
    }
    
    return false;
  }

  /**
   * Parse numeric value from various formats - IMPROVED to handle more numeric types
   */
  private parseNumericValue(val: any): number | null {
    if (val === null || val === undefined) return null;
    
    // If it's already a number, return it if valid
    if (typeof val === "number") {
      return !isNaN(val) && isFinite(val) ? val : null;
    }
    
    // If it's a string, try to parse it
    if (typeof val === "string") {
      const trimmedVal = val.trim();
      
      // Skip empty strings
      if (trimmedVal === '') return null;
      
      // Remove common Excel formatting but preserve decimal points and negative signs
      const cleanVal = trimmedVal
        .replace(/[$,\s]/g, '')  // Remove currency symbols, commas, spaces
        .replace(/[^\d.-]/g, ''); // Keep only digits, decimal points, and negative signs
      
      // Handle percentage values
      if (trimmedVal.includes('%')) {
        const percentVal = parseFloat(cleanVal);
        return !isNaN(percentVal) && isFinite(percentVal) ? percentVal / 100 : null;
      }
      
      // Try to parse as number
      const parsed = parseFloat(cleanVal);
      return !isNaN(parsed) && isFinite(parsed) ? parsed : null;
    }
    
    return null;
  }

  /**
   * Check if a value is numeric - IMPROVED to be consistent with parseNumericValue
   */
  private isNumeric(val: any): boolean {
    if (val === null || val === undefined) return false;
    
    if (typeof val === "number") {
      return !isNaN(val) && isFinite(val);
    }
    
    if (typeof val === "string") {
      const trimmedVal = val.trim();
      if (trimmedVal === '') return false;
      
      // Remove common Excel formatting but preserve decimal points and negative signs
      const cleanVal = trimmedVal
        .replace(/[$,\s]/g, '')  // Remove currency symbols, commas, spaces
        .replace(/[^\d.-]/g, ''); // Keep only digits, decimal points, and negative signs
      
      const parsed = parseFloat(cleanVal);
      return !isNaN(parsed) && isFinite(parsed);
    }
    
    return false;
  }

  /**
   * Determine data type
   */
  private determineDataType(value: any, metric: string): "number" | "string" | "date" | "percent" | "ratio" {
    if (typeof value === "number") return "number";
    
    const lowerMetric = metric.toLowerCase();
    if (lowerMetric.includes("margin") || lowerMetric.includes("rate") || lowerMetric.includes("%")) return "percent";
    if (lowerMetric.includes("ratio")) return "ratio";
    
    return "number";
  }

  /**
   * Determine unit for the metric
   */
  private determineUnit(metric: string): string {
    const lower = metric.toLowerCase();
    if (lower.includes("margin") || lower.includes("rate") || lower.includes("%")) return "percentage";
    if (lower.includes("ratio")) return "ratio";
    return "INR";
  }

  /**
   * Determine features for the cell
   */
  private determineFeatures(
    metric: string,
    value: any,
    rowIndex: number,
    dataStartRow: number
  ): EnhancedParsedCell["features"] {
    const lowerMetric = metric.toLowerCase();
    
    return {
      isPercentage: lowerMetric.includes("margin") || lowerMetric.includes("rate") || lowerMetric.includes("%"),
      isMargin: lowerMetric.includes("margin") || lowerMetric.includes("profit"),
      isGrowth: lowerMetric.includes("growth") || lowerMetric.includes("yoy") || lowerMetric.includes("qoq"),
      isAggregation: lowerMetric.includes("total") || lowerMetric.includes("sum") || lowerMetric.includes("average"),
      isForecast: lowerMetric.includes("forecast") || lowerMetric.includes("budget") || lowerMetric.includes("projection"),
      isHeader: rowIndex === dataStartRow,
      isData: true,
      isTotal: lowerMetric.includes("total"),
    };
  }
}

// Export singleton instance for backward compatibility
export const excelParser = new ExcelParser();

// Legacy function export for backward compatibility
export const parseAnd_upload_cells = excelParser.parseAndUploadCells.bind(excelParser);
