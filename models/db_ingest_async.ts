import mongoose from "mongoose";
import crypto from "crypto";
import {
  WorkbookModel,
  SheetModel,
  AtlasCellModel,
  TenantModel,
} from "./workbook";
import { parseWorkbookEnhanced } from "../embedder/parse";
import { config } from "dotenv";

config({ path: ".env.local" });

let isConnected = false;

export async function connectDB() {
  if (isConnected) {
    console.log("Using existing database connection");
    return;
  }

  try {
    const uri =
      process.env.MONGO_DB_URL ||
      "mongodb+srv://ajay_db_owner:Mongo_SpaaS@cluster0.eedbshd.mongodb.net/SpaaS";

    console.log("Attempting to connect to MongoDB...");

    await mongoose.connect(uri, {
      dbName: "SpaaS",
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 30000,
      bufferCommands: false,
      maxIdleTimeMS: 30000,
      waitQueueTimeoutMS: 30000,
    });

    isConnected = true;
    console.log("✅ Connected to MongoDB with Mongoose");
    console.log("   Connection state:", mongoose.connection.readyState);
    console.log("   Database name:", mongoose.connection.name);
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    isConnected = false;
    throw new Error(
      `Failed to connect to MongoDB: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

async function disconnectDB() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log("Disconnected from MongoDB");
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down gracefully...");
  await disconnectDB();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  await disconnectDB();
  process.exit(0);
});

async function parseAndStoreWorkbookAsync(
  tenantId: string,
  workbookId: string,
  fileBuffer: Buffer
): Promise<{ cellCount: number; embeddingCount: number }> {
  console.log("📊 Starting async parsing and storage...");

  const cellCount = { count: 0 };
  const embeddingCount = { count: 0 };

  // Callback function to store each cell as it's parsed
  const onCellParsed = async (cell: any, cellId: string) => {
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
  const onSheetParsed = async (sheetName: string, rowCount: number, colCount: number, sheetCellCount: number) => {
    // Sheet stats will be processed later
  };

  const parsedCells = await parseWorkbookEnhanced(tenantId, workbookId, fileBuffer, onCellParsed, onSheetParsed);

  // Update embeddings in batches
  const batchSize = 100;
  for (let i = 0; i < parsedCells.length; i += batchSize) {
    const batch = parsedCells.slice(i, i + batchSize);
    const updatePromises = batch.map((cell: any, index: number) => {
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
    embeddingCount.count += batch.length;
  }

  return { cellCount: cellCount.count, embeddingCount: embeddingCount.count };
}

export async function ingestWorkbookAsync(
  tenantId: string,
  fileBuffer: Buffer,
  workbookName: string
): Promise<{
  workbookId: string;
  sheetCount: number;
  cellCount: number;
  processingTime: number;
  cellsPerSecond: number;
}> {
  console.log("🚀 Starting async workbook ingestion...");

  await connectDB();

  // ⚡ Deterministic workbook ID based on file hash
  const contentHash = crypto
    .createHash("sha256")
    .update(fileBuffer)
    .digest("hex");
  const workbookId = contentHash.slice(0, 22);

  console.log("📋 Workbook ID:", workbookId);

  // Tenant + workbook parallel fetch
  const [tenant, existingWorkbook] = await Promise.all([
    TenantModel.findById(tenantId),
    WorkbookModel.findById(workbookId),
  ]);

  if (!tenant) {
    console.log("👤 Creating new tenant:", tenantId);
    await new TenantModel({
      _id: tenantId,
      name: `Tenant ${tenantId}`,
    }).save();
  }

  let workbook;
  if (!existingWorkbook) {
    console.log("📚 Creating new workbook:", workbookName);
    workbook = new WorkbookModel({
      _id: workbookId,
      tenantId,
      name: workbookName,
      contentHash,
      sheets: [],
    });
    await workbook.save();
  } else {
    console.log("📚 Workbook exists, clearing existing cells...");
    workbook = existingWorkbook;
    await AtlasCellModel.deleteMany({ workbookId });
  }

  // ⏱️ Start parsing + storage
  const startTime = Date.now();
  const parseResult = await parseAndStoreWorkbookAsync(
    tenantId,
    workbookId,
    fileBuffer
  );
  const parseTime = Date.now() - startTime;

  console.log(`⏱️  Parsing + storage completed in ${parseTime}ms`);

  // 🗂 Update workbook metadata
  const uniqueSheets = await AtlasCellModel.distinct("sheetId", { workbookId });

  const sheetPromises = uniqueSheets.map(async (sheetId) => {
    const sheetName = sheetId.replace("sh_", "");

    const [cellCount, rowCount, colCount] = await Promise.all([
      AtlasCellModel.countDocuments({ workbookId, sheetId }),
      AtlasCellModel.distinct("metric", { workbookId, sheetId }).then(
        (r) => r.length
      ),
      AtlasCellModel.distinct("dimensions", { workbookId, sheetId }).then(
        (c) => c.length
      ),
    ]);

    await SheetModel.findByIdAndUpdate(
      sheetId,
      {
        _id: sheetId,
        workbookId,
        name: sheetName,
        rowCount,
        colCount,
        cellCount,
      },
      { upsert: true, new: true }
    );

    return sheetId;
  });

  const updatedSheets = await Promise.all(sheetPromises);

  workbook.sheets = updatedSheets;
  await workbook.save();

  const totalTime = Date.now() - startTime;

  console.log(`✅ Async ingestion complete in ${totalTime}ms`);
  console.log("📈 Performance metrics:");
  console.log(`   - Cells processed: ${parseResult.cellCount}`);
  console.log(`   - Embeddings generated: ${parseResult.embeddingCount}`);
  console.log(`   - Sheets created: ${updatedSheets.length}`);
  console.log(`   - Total time: ${totalTime}ms`);
  console.log(
    `   - Cells per second: ${Math.round(
      parseResult.cellCount / (totalTime / 1000)
    )}`
  );

  return {
    workbookId,
    sheetCount: updatedSheets.length,
    cellCount: parseResult.cellCount,
    processingTime: totalTime,
    cellsPerSecond: Math.round(
      parseResult.cellCount / (totalTime / 1000)
    ),
  };
}

export { mongoose };
