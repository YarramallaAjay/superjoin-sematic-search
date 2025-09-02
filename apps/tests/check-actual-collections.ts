import { MongoClient } from "mongodb";
import { config } from "dotenv";

config({ path: ".env.local" });

async function checkActualCollections() {
  console.log("🔍 Finding Actual Collections for Vector Search");
  console.log("=".repeat(60));

  const uri = process.env.MONGO_DB_URL || "mongodb+srv://ajay_db_owner:Mongo_SpaaS@cluster0.eedbshd.mongodb.net/SpaaS/";
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB");
    
    const db = client.db("SpaaS");
    
    // Check collections
    const collections = await db.listCollections().toArray();
    console.log("\n📋 Available collections:");
    collections.forEach(col => {
      console.log(`  - ${col.name} (type: ${col.type || 'collection'})`);
    });
    
    // Check each collection for embeddings and try vector search
    for (const colInfo of collections) {
      if (colInfo.type === 'view') {
        console.log(`\n⏭️  Skipping view: ${colInfo.name}`);
        continue;
      }
      
      console.log(`\n🔍 Checking collection: ${colInfo.name}`);
      
      try {
        const collection = db.collection(colInfo.name);
        
        // Check if collection has documents with embeddings
        const sampleDoc = await collection.findOne({ embedding: { $exists: true } });
        
        if (sampleDoc) {
          console.log(`  ✅ Found documents with embeddings`);
          console.log(`  📊 Sample document keys:`, Object.keys(sampleDoc));
          console.log(`  🧠 Embedding length:`, Array.isArray(sampleDoc.embedding) ? sampleDoc.embedding.length : 'N/A');
          
          // Try vector search on this collection
          console.log(`  🧪 Testing vector search...`);
          try {
            const testEmbedding = new Array(768).fill(0.1); // Use 768 based on what we saw
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
            
            const results = await collection.aggregate(testPipeline).toArray();
            console.log(`  ✅ Vector search successful: ${results.length} results`);
            
            // This collection supports vector search!
            console.log(`\n🎯 COLLECTION ${colInfo.name} SUPPORTS VECTOR SEARCH!`);
            console.log(`   Use this collection instead of the 'analysis' view`);
            
          } catch (vectorError: any) {
            console.log(`  ❌ Vector search failed:`, vectorError.message);
          }
          
        } else {
          console.log(`  ❌ No documents with embeddings found`);
        }
        
      } catch (error: any) {
        console.log(`  ❌ Error accessing collection:`, error.message);
      }
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await client.close();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

checkActualCollections().catch(console.error);
