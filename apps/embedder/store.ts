import { AtlasCellModel } from "../models/workbook";
import { EnhancedParsedCell } from "./parse";

export interface StorageResult {
  success: boolean;
  cellCount: number;
  errorCount: number;
  errors: string[];
}

export async function storeCellsEnhanced(
  cells: EnhancedParsedCell[],
  batchSize: number = 100
): Promise<StorageResult> {
  const result: StorageResult = {
    success: true,
    cellCount: 0,
    errorCount: 0,
    errors: []
  };

  console.log(`💾 Storing ${cells.length} enhanced cells in batches of ${batchSize}...`);

  try {
    // Process in batches
    for (let i = 0; i < cells.length; i += batchSize) {
      const batch = cells.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(cells.length / batchSize);

      console.log(`   → Processing batch ${batchIndex}/${totalBatches} (${batch.length} items)`);

      try {
        // Transform cells to match MongoDB schema
        const docs = batch.map(cell => ({
          _id: cell._id,
          tenantId: cell.tenantId,
          workbookId: cell.workbookId,
          sheetId: cell.sheetId,
          sheetName: cell.sheetName,
          
          // Precise cell location
          rowIndex: cell.rowIndex,
          colIndex: cell.colIndex,
          rowName: cell.rowName,
          colName: cell.colName,
          cellAddress: cell.cellAddress,
          
          // Raw and parsed values
          rawValue: cell.rawValue,
          value: cell.value,
          metric: cell.metric,
          
          // Semantic string for embedding
          semanticString: cell.semanticString,
          
          // Time dimensions (year, month, quarter)
          year: cell.year,
          month: cell.month,
          quarter: cell.quarter,
          
          // All dimensions (preserved as-is)
          dimensions: cell.dimensions,
          
          // Data type and features
          dataType: cell.dataType,
          unit: cell.unit,
          features: cell.features,
          
          // Embedding
          embedding: cell.embedding,
          
          // Source information
          sourceCell: cell.sourceCell,
          sourceFormula: cell.sourceFormula,
          
          // Metadata
          createdAt: new Date(),
          updatedAt: new Date()
        }));

        // Insert batch
        await AtlasCellModel.insertMany(docs, { ordered: false });
        
        result.cellCount += batch.length;
        console.log(`   ✅ Stored ${batch.length} cells successfully`);
        
      } catch (batchError) {
        const errorMsg = `Batch ${batchIndex} failed: ${batchError instanceof Error ? batchError.message : String(batchError)}`;
        console.error(`❌ ${errorMsg}`);
        result.errors.push(errorMsg);
        result.errorCount += batch.length;
        result.success = false;
      }

      // Add delay between batches to avoid overwhelming the database
      if (i + batchSize < cells.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Storage complete: ${result.cellCount} cells stored, ${result.errorCount} errors`);
    
  } catch (error) {
    const errorMsg = `Storage operation failed: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`❌ ${errorMsg}`);
    result.errors.push(errorMsg);
    result.success = false;
  }

  return result;
}

export async function updateEmbeddingsEnhanced(
  cells: EnhancedParsedCell[],
  batchSize: number = 50
): Promise<StorageResult> {
  const result: StorageResult = {
    success: true,
    cellCount: 0,
    errorCount: 0,
    errors: []
  };

  console.log(`🔄 Updating embeddings for ${cells.length} cells...`);

  try {
    // Process in batches
    for (let i = 0; i < cells.length; i += batchSize) {
      const batch = cells.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(cells.length / batchSize);

      console.log(`   → Updating batch ${batchIndex}/${totalBatches} (${batch.length} items)`);

      try {
        // Update embeddings for the batch
        const updatePromises = batch.map(cell =>
          AtlasCellModel.updateOne(
            { _id: cell._id },
            { 
              $set: { 
                embedding: cell.embedding,
                updatedAt: new Date()
              } 
            }
          )
        );

        await Promise.all(updatePromises);
        
        result.cellCount += batch.length;
        console.log(`   ✅ Updated embeddings for ${batch.length} cells`);
        
      } catch (batchError) {
        const errorMsg = `Embedding update batch ${batchIndex} failed: ${batchError instanceof Error ? batchError.message : String(batchError)}`;
        console.error(`❌ ${errorMsg}`);
        result.errors.push(errorMsg);
        result.errorCount += batch.length;
        result.success = false;
      }

      // Add delay between batches
      if (i + batchSize < cells.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ Embedding updates complete: ${result.cellCount} cells updated, ${result.errorCount} errors`);
    
  } catch (error) {
    const errorMsg = `Embedding update operation failed: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`❌ ${errorMsg}`);
    result.errors.push(errorMsg);
    result.success = false;
  }

  return result;
}

export async function clearExistingData(
  tenantId: string,
  workbookId: string
): Promise<void> {
  try {
    console.log(`🧹 Clearing existing data for workbook ${workbookId}...`);
    
    // Delete existing cells for this workbook
    const deleteResult = await AtlasCellModel.deleteMany({
      tenantId,
      workbookId
    });
    
    console.log(`✅ Cleared ${deleteResult.deletedCount} existing cells`);
    
  } catch (error) {
    console.error(`❌ Failed to clear existing data:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}
