import { MongoClient } from "mongodb";
import { config } from "dotenv";

config({ path: ".env.local" });

async function checkVectorIndex() {
  console.log("🔍 Checking Vector Index Configuration");
  console.log("=".repeat(60));

  const uri = process.env.MONGO_DB_URL || "mongodb+srv://ajay_db_owner:Mongo_SpaaS@cluster0.eedbshd.mongodb.net/SpaaS/";
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");
    
    const db = client.db("SpaaS");
    
    // Check collections
    const collections = await db.listCollections().toArray();
    console.log("\n📋 Available collections:", collections.map(c => c.name));
    
    // Check if analysis collection has embeddings
    const analysisCollection = db.collection("analysis");
    const sampleDoc = await analysisCollection.findOne({});
    
    if (sampleDoc) {
      console.log("\n📋 Sample document structure:");
      console.log("Keys:", Object.keys(sampleDoc));
      console.log("Has embedding:", !!sampleDoc.embedding);
      if (sampleDoc.embedding) {
        console.log("Embedding type:", typeof sampleDoc.embedding);
        console.log("Embedding length:", Array.isArray(sampleDoc.embedding) ? sampleDoc.embedding.length : 'N/A');
      }
    }
    
    // Check indexes on analysis collection
    console.log("\n🔍 Checking indexes on analysis collection...");
    const indexes = await analysisCollection.indexes();
    console.log("Indexes:", indexes.map(idx => ({
      name: idx.name,
      key: idx.key,
      unique: idx.unique,
      sparse: idx.sparse,
      background: idx.background
    })));
    
    // Check if there's a vector index
    const vectorIndex = indexes.find(idx => idx.name === "vector_index");
    if (vectorIndex) {
      console.log("\n✅ Found vector index:", vectorIndex);
    } else {
      console.log("\n❌ No vector index found with name 'vector_index'");
      
      // Check for any index that might be a vector index
      const possibleVectorIndexes = indexes.filter(idx => 
        Object.keys(idx.key).some(key => key.includes('embedding') || key.includes('vector'))
      );
      
      if (possibleVectorIndexes.length > 0) {
        console.log("\n🔍 Possible vector indexes found:");
        possibleVectorIndexes.forEach(idx => console.log("  -", idx));
      }
    }
    
    // Try to create a simple vector search to see the exact error
    console.log("\n🧪 Testing simple vector search...");
    try {
      const testEmbedding = new Array(1536).fill(0.1); // Create a test embedding
      const testPipeline = [
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: testEmbedding,
            numCandidates: 10,
            limit: 5
          }
        }
      ];
      
      console.log("📑 Test pipeline:", JSON.stringify(testPipeline, null, 2));
      
      const results = await analysisCollection.aggregate(testPipeline).toArray();
      console.log("✅ Vector search successful:", results.length, "results");
      
    } catch (error: any) {
      console.log("❌ Vector search failed with error:", error.message);
      console.log("Error details:", error);
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await client.close();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

checkVectorIndex().catch(console.error);
