import { AtlasCellModel, WorkbookModel, TenantModel } from '../models/workbook';
import mongoose from 'mongoose';

async function checkDatabase() {
  try {
    // Connect to MongoDB
    console.log("📡 Connecting to MongoDB...");
    const uri = process.env.MONGODB_URI || "mongodb+srv://ajay_db_owner:Mongo_SpaaS@cluster0.eedbshd.mongodb.net/SpaaS";
    await mongoose.connect(uri);
    console.log("✅ Connected to MongoDB");

    // Check what collections exist
    console.log("\n📋 Checking Collections...");
    if (mongoose.connection.db) {
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log("Available collections:");
      collections.forEach(col => {
        console.log(`  - ${col.name}`);
      });
    }

    // Check AtlasCell collection specifically
    console.log("\n🔍 Checking AtlasCell Collection...");
    const totalCells = await AtlasCellModel.countDocuments({});
    console.log(`Total cells in AtlasCell: ${totalCells}`);

    if (totalCells > 0) {
      const cellsWithEmbeddings = await AtlasCellModel.countDocuments({
        embedding: { $exists: true, $ne: [] }
      });
      console.log(`Cells with embeddings: ${cellsWithEmbeddings}`);

      // Get a sample cell
      const sampleCell = await AtlasCellModel.findOne({}).lean();
      console.log("\n📋 Sample cell:");
      console.log(JSON.stringify(sampleCell, null, 2));
    }

    // Check other collections
    console.log("\n🔍 Checking Other Collections...");
    const totalWorkbooks = await WorkbookModel.countDocuments({});
    console.log(`Total workbooks: ${totalWorkbooks}`);

    const totalTenants = await TenantModel.countDocuments({});
    console.log(`Total tenants: ${totalTenants}`);

    // Check if there are any collections with similar names
    console.log("\n🔍 Checking for Similar Collection Names...");
    if (mongoose.connection.db) {
      const allCollections = await mongoose.connection.db.listCollections().toArray();
      const cellCollections = allCollections.filter(col => 
        col.name.toLowerCase().includes('cell') || 
        col.name.toLowerCase().includes('atlas')
      );
      
      if (cellCollections.length > 0) {
        console.log("Found potential cell collections:");
        for (const col of cellCollections) {
          const count = await mongoose.connection.db.collection(col.name).countDocuments();
          console.log(`  - ${col.name}: ${count} documents`);
          
          // If there are documents, show a sample
          if (count > 0) {
            const sample = await mongoose.connection.db.collection(col.name).findOne({});
            console.log(`    Sample document: ${JSON.stringify(sample, null, 2)}`);
          }
        }
      }
      
      // Check all collections for any data
      console.log("\n🔍 Checking All Collections for Data...");
      for (const col of allCollections) {
        const count = await mongoose.connection.db.collection(col.name).countDocuments();
        if (count > 0) {
          console.log(`  - ${col.name}: ${count} documents`);
          const sample = await mongoose.connection.db.collection(col.name).findOne({});
          console.log(`    Sample: ${JSON.stringify(sample, null, 2)}`);
        }
      }
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

checkDatabase();
