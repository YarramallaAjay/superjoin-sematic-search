import mongoose from 'mongoose';

import crypto from "crypto";
import { WorkbookModel, SheetModel, AtlasCellModel, TenantModel } from "./workbook";
import { parseWorkbookEnhanced } from '../embedder/parse';
import { config } from 'dotenv';
config({path: '.env.local'})
let isConnected = false;

 export async function connectDB() {
  if (isConnected) {
    console.log('Using existing database connection');
    return;
  }

  try {
    const uri =process.env.MONGO_DB_URL||'mongodb+srv://ajay_db_owner:Mongo_SpaaS@cluster0.eedbshd.mongodb.net/SpaaS';
    
    console.log('Attempting to connect to MongoDB...');
    
    await mongoose.connect(uri, {
      dbName: 'SpaaS', // Specify database name separately
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000, // Increased timeout for server selection
      socketTimeoutMS: 60000, // Increased socket timeout
      connectTimeoutMS: 30000, // Increased connection timeout
      bufferCommands: false, // Disable buffering to prevent timeout issues
      // Additional timeout settings for operations
      maxIdleTimeMS: 30000,
      waitQueueTimeoutMS: 30000,
    });

    isConnected = true;
    console.log('Connected to MongoDB with Mongoose successfully');
    console.log('Connection state:', mongoose.connection.readyState);
    console.log('Database name:', mongoose.connection.name);
    
    // Test the connection
    
    
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    isConnected = false;
    throw new Error(`Failed to connect to MongoDB: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

 async function disconnectDB() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('Disconnected from MongoDB');
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await disconnectDB();
  process.exit(0);
});




 export async function ingestWorkbook(
  tenantId: string,
  fileBuffer: Buffer,
  workbookName: string
) {
  // Ensure database connection
  await connectDB();

  const contentHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  const workbookId = Buffer.from(workbookName).toString('base64').slice(0,22);
        console.log('Workbook ID:', workbookId);

  // Check if tenant exists, create if not
  let tenant = await TenantModel.findById(tenantId);
  if (!tenant) {
    tenant = new TenantModel({
      _id: tenantId,
      name: `Tenant ${tenantId}`
    });
    await tenant.save();
    console.log('Created new tenant:', tenantId);
  }

  // Check if workbook already exists
  let workbook = await WorkbookModel.findById(workbookId);
  if (!workbook) {
    workbook = new WorkbookModel({
      _id: workbookId,
      tenantId,
      name: workbookName,
      contentHash,
      sheets: []
    });
    await workbook.save();
  } else {
    console.log('Workbook already exists, updating...');
    // Clear existing cells for this workbook
    await AtlasCellModel.deleteMany({ workbookId });
  }

  const sheetNames = new Set<string>();
  const cellCount = { count: 0 };
  const sheetStats = new Map<string, { rowCount: number; colCount: number; cellCount: number }>();

  // Callback function to store each cell as it's parsed
  const onCellParsed = async (cell: any, cellId: string) => {
    // Add sheet to set for later processing
    sheetNames.add(cell.sheetId);
    
    // Store cell document immediately (without embedding for now)
    const cellDoc = new AtlasCellModel({
      _id: cellId,
      ...cell,
      embedding: [] // Will be updated later
    });
    await cellDoc.save();
    cellCount.count++;
  };

  // Callback function to store sheet statistics
  const onSheetParsed = async (sheetName: string, rowCount: number, colCount: number, cellCount: number) => {
    const sheetId = `sh_${sheetName.toLowerCase().replace(/\s+/g, "_")}`;
    sheetStats.set(sheetId, { rowCount, colCount, cellCount });
  };

  const parsedCells = await parseWorkbookEnhanced(tenantId, workbookId, fileBuffer, onCellParsed, onSheetParsed);

  // Create sheet documents with actual sheet data
  for (const sId of sheetNames) {
    const sheetName = sId.replace("sh_", "");
    const stats = sheetStats.get(sId) || { rowCount: 0, colCount: 0, cellCount: 0 };
    
    // Check if sheet already exists
    let sheetDoc = await SheetModel.findById(sId);
    if (!sheetDoc) {
      sheetDoc = new SheetModel({
        _id: sId,
        workbookId,
        name: sheetName,
        rowCount: stats.rowCount,
        colCount: stats.colCount,
        cellCount: stats.cellCount
      });
      await sheetDoc.save();
    } else {
      // Update existing sheet with new stats
      sheetDoc.rowCount = stats.rowCount;
      sheetDoc.colCount = stats.colCount;
      sheetDoc.cellCount = stats.cellCount;
      await sheetDoc.save();
    }
    workbook.sheets.push(sId);
  }
  await workbook.save();

  // Update embeddings in batches
  const batchSize = 100;
  for (let i = 0; i < parsedCells.length; i += batchSize) {
    const batch = parsedCells.slice(i, i + batchSize);
    const updatePromises = batch.map((cell: any, index: number) => {
      const cellId = `cell_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return AtlasCellModel.updateOne(
        { 
          tenantId: cell.tenantId,
          workbookId: cell.workbookId,
          sheetId: cell.sheetId,
          sourceCell: cell.sourceCell
        },
        { $set: { embedding: cell.embedding } }
      );
    });
    await Promise.all(updatePromises);
  }

  return { workbookId, sheetCount: sheetNames.size, cellCount: cellCount.count };
}

export {mongoose}