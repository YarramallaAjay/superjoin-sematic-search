import { parseWorkbookEnhanced, EnhancedParsedCell } from "../embedder/parse";
import { storeCellsEnhanced, updateEmbeddingsEnhanced, StorageResult } from "../embedder/store";
import { semanticSearchEngine } from "../embedder/search";
import { semanticNormalizer } from "../utils/semantic-normalizer";
import { makeEmbeddingsOptimized } from "../embedder/embedding";
import mongoose from "mongoose";
import * as fs from "fs";
import * as path from "path";

// Test configuration
const TEST_TENANT_ID = "tenant_test_enhanced";
const TEST_WORKBOOK_PATH = path.join(__dirname, "./Vector_Embeddings_Test_Workbook.xlsx");

// Test queries to validate search functionality
const TEST_QUERIES = [
  "profit margin analysis",
  "revenue by region 2023",
  "cost of goods sold Q1",
  "operating expenses growth",
  "net profit forecast",
  "customer performance metrics",
  "regional sales analysis",
  "quarterly financial ratios"
];

async function testEnhancedPipelineFlow() {
  console.log("🚀 Testing Enhanced Pipeline Flow: Parse → Embed → Store → Search");
  console.log("=" .repeat(80));

  try {
    // Connect to MongoDB
    console.log("📡 Connecting to MongoDB...");
    const uri = process.env.MONGODB_URI || "mongodb+srv://ajay_db_owner:Mongo_SpaaS@cluster0.eedbshd.mongodb.net/SpaaS";
    await mongoose.connect(uri);
    console.log("✅ Connected to MongoDB");

    // Step 1: Test Enhanced Parsing
    console.log("\n📊 Step 1: Testing Enhanced Workbook Parsing");
    console.log("-".repeat(60));
    
    if (!fs.existsSync(TEST_WORKBOOK_PATH)) {
      console.log(`⚠️ Test workbook not found at ${TEST_WORKBOOK_PATH}`);
      console.log("Skipping workbook parsing test...");
      return;
    }

    const workbookBuffer = fs.readFileSync(TEST_WORKBOOK_PATH);
    console.log(`📁 Reading test workbook: ${path.basename(TEST_WORKBOOK_PATH)}`);
    
    const parseStartTime = Date.now();
    const parsedCells = await parseWorkbookEnhanced(
      TEST_TENANT_ID,
      "Company Financial Model MultiYear",
      workbookBuffer
    );
    const parseTime = Date.now() - parseStartTime;

    console.log(`✅ Parsing completed in ${parseTime}ms`);
    console.log(`   - Total cells parsed: ${parsedCells.length}`);
    
    // Extract semantic strings from cells
    const semanticStrings = parsedCells.map(cell => cell.semanticString);
    console.log(`   - Semantic strings generated: ${semanticStrings.length}`);

    if (semanticStrings.length > 0) {
      console.log("\n📋 Sample Semantic Strings:");
      semanticStrings.slice(0, 5).forEach((str: string, index: number) => {
        console.log(`   ${index + 1}: "${str}"`);
      });
    }

    // Step 2: Test Enhanced Storage
    console.log("\n💾 Step 2: Testing Enhanced Data Storage");
    console.log("-".repeat(60));
    
    const storeStartTime = Date.now();
    const storageResult = await storeCellsEnhanced(parsedCells);
    const storeTime = Date.now() - storeStartTime;

    console.log(`✅ Storage completed in ${storeTime}ms`);
    console.log(`   - Cells stored: ${storageResult.cellCount}`);
    console.log(`   - Errors: ${storageResult.errors.length}`);

    if (storageResult.errors.length > 0) {
      console.log("\n⚠️ Storage Errors:");
      storageResult.errors.slice(0, 3).forEach((error, index) => {
        console.log(`   ${index + 1}: ${error}`);
      });
    }

    // Step 3: Test Enhanced Embedding Generation (Truly Async)
    console.log("\n🧠 Step 3: Testing Enhanced Embedding Generation (Truly Async)");
    console.log("-".repeat(60));
    
    const embedStartTime = Date.now();
    const testSemanticStrings = semanticStrings.slice(0, 12); // Test with first 12 strings
    console.log(`📝 Generating embeddings for ${testSemanticStrings.length} semantic strings with true concurrency...`);
    
    // Process embeddings with true async concurrency
    const batchSize = 4;
    const embeddingPromises: Promise<{ batchIndex: number; embeddings: number[][]; time: number }>[] = [];
    
    // Start all batches concurrently with individual timing
    for (let i = 0; i < testSemanticStrings.length; i += batchSize) {
      const batchIndex = Math.floor(i / batchSize) + 1;
      const batch = testSemanticStrings.slice(i, i + batchSize);
      
      const batchPromise = (async () => {
        const batchStartTime = Date.now();
        console.log(`   → Starting batch ${batchIndex} with ${batch.length} strings...`);
        
        const batchEmbeddings = await makeEmbeddingsOptimized(batch);
        const batchTime = Date.now() - batchStartTime;
        
        console.log(`   ✅ Batch ${batchIndex} completed in ${batchTime}ms`);
        return { batchIndex, embeddings: batchEmbeddings, time: batchTime };
      })();
      
      embeddingPromises.push(batchPromise);
    }
    
    // Wait for all batches to complete concurrently
    console.log(`   🚀 All ${embeddingPromises.length} batches started concurrently...`);
    const batchResults = await Promise.all(embeddingPromises);
    const embedTime = Date.now() - embedStartTime;
    
    // Combine all embeddings
    const embeddings = batchResults.flatMap(result => result.embeddings);
    const totalBatchTime = batchResults.reduce((sum, result) => sum + result.time, 0);

    console.log(`✅ Truly async embedding generation completed in ${embedTime}ms`);
    console.log(`   - Embeddings generated: ${embeddings.length}`);
    console.log(`   - Embedding dimension: ${embeddings[0]?.length || 0}`);
    console.log(`   - Average time per embedding: ${(embedTime / embeddings.length).toFixed(2)}ms`);
    console.log(`   - Concurrent batches processed: ${embeddingPromises.length}`);
    console.log(`   - Total batch processing time: ${totalBatchTime}ms`);
    console.log(`   - Time saved through concurrency: ${(totalBatchTime - embedTime)}ms`);

    // Step 4: Test Enhanced Embedding Storage (Truly Async)
    console.log("\n💾 Step 4: Testing Enhanced Embedding Storage (Truly Async)");
    console.log("-".repeat(60));
    
    // Create cells with embeddings for update
    const cellsWithEmbeddings = parsedCells.slice(0, embeddings.length).map((cell, index) => ({
      ...cell,
      embedding: embeddings[index] || []
    }));
    
    const updateStartTime = Date.now();
    
    // Process storage with true async concurrency
    const storageBatchSize = 4;
    const storagePromises: Promise<{ batchIndex: number; result: StorageResult; time: number }>[] = [];
    
    // Start all storage batches concurrently with individual timing
    for (let i = 0; i < cellsWithEmbeddings.length; i += storageBatchSize) {
      const batchIndex = Math.floor(i / storageBatchSize) + 1;
      const batch = cellsWithEmbeddings.slice(i, i + storageBatchSize);
      
      const storagePromise = (async () => {
        const batchStartTime = Date.now();
        console.log(`   → Starting storage batch ${batchIndex} with ${batch.length} cells...`);
        
        const batchResult = await updateEmbeddingsEnhanced(batch);
        const batchTime = Date.now() - batchStartTime;
        
        console.log(`   ✅ Storage batch ${batchIndex} completed in ${batchTime}ms`);
        return { batchIndex, result: batchResult, time: batchTime };
      })();
      
      storagePromises.push(storagePromise);
    }
    
    // Wait for all storage batches to complete concurrently
    console.log(`   🚀 All ${storagePromises.length} storage batches started concurrently...`);
    const storageResults = await Promise.all(storagePromises);
    const updateTime = Date.now() - updateStartTime;

    // Aggregate results
    const totalUpdated = storageResults.reduce((sum, item) => sum + item.result.cellCount, 0);
    const totalErrors = storageResults.reduce((sum, item) => sum + item.result.errors.length, 0);
    const totalStorageTime = storageResults.reduce((sum, item) => sum + item.time, 0);

    console.log(`✅ Truly async embedding storage completed in ${updateTime}ms`);
    console.log(`   - Embeddings updated: ${totalUpdated}`);
    console.log(`   - Errors: ${totalErrors}`);
    console.log(`   - Concurrent storage batches: ${storagePromises.length}`);
    console.log(`   - Total storage processing time: ${totalStorageTime}ms`);
    console.log(`   - Time saved through concurrency: ${(totalStorageTime - updateTime)}ms`);

    // Step 5: Test Vector Search (Truly Async)
    console.log("\n🔍 Step 5: Testing Vector Search (Truly Async)");
    console.log("-".repeat(60));
    
    const searchQueries = TEST_QUERIES.slice(0, 4); // Test with 4 queries
    const searchStartTime = Date.now();
    
    // Run search queries with true async concurrency
    const searchPromises = searchQueries.map(async (query, index) => {
      try {
        const queryStartTime = Date.now();
        console.log(`   → Starting search query ${index + 1}: "${query}"`);
        
        const searchResults = await semanticSearchEngine.semanticSearch(query, {
          tenantId: TEST_TENANT_ID,
          limit: 5,
          minScore: 0.1
        });
        const queryTime = Date.now() - queryStartTime;
        
        console.log(`   ✅ Search query ${index + 1} completed in ${queryTime}ms`);
        return {
          query,
          results: searchResults,
          time: queryTime,
          success: true
        };
      } catch (error) {
        const queryTime = Date.now() - searchStartTime;
        console.log(`   ❌ Search query ${index + 1} failed in ${queryTime}ms`);
        return {
          query,
          results: [],
          time: queryTime,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });
    
    console.log(`   🚀 All ${searchPromises.length} search queries started concurrently...`);
    const searchResults = await Promise.all(searchPromises);
    const totalSearchTime = Date.now() - searchStartTime;
    
    // Calculate individual vs total time
    const totalIndividualTime = searchResults.reduce((sum, result) => sum + result.time, 0);
    
    console.log(`✅ Truly async search completed in ${totalSearchTime}ms`);
    console.log(`   - Total individual query time: ${totalIndividualTime}ms`);
    console.log(`   - Time saved through concurrency: ${(totalIndividualTime - totalSearchTime)}ms`);
    
    // Display results
    searchResults.forEach((result, index) => {
      console.log(`\n   Query ${index + 1}: "${result.query}"`);
      if (result.success) {
        console.log(`      → Found ${result.results.length} results in ${result.time}ms`);
        if (result.results.length > 0) {
          result.results.slice(0, 2).forEach((searchResult, idx) => {
            console.log(`      ${idx + 1}: "${searchResult.semanticString}"`);
            console.log(`         Score: ${searchResult.score.toFixed(3)}, Value: ${searchResult.value} ${searchResult.unit || ''}`);
          });
        }
      } else {
        console.log(`      ❌ Search failed: ${result.error}`);
      }
    });

    // Step 6: Test Fallback Text Search
    console.log("\n🔍 Step 6: Testing Fallback Text Search");
    console.log("-".repeat(60));
    
    try {
      const textSearchResults = await semanticSearchEngine.semanticSearch("revenue", {
        tenantId: TEST_TENANT_ID,
        limit: 5
      });

      console.log(`   → Text search found ${textSearchResults.length} results`);
      
      if (textSearchResults.length > 0) {
        textSearchResults.slice(0, 3).forEach((result, index) => {
          console.log(`   ${index + 1}: "${result.semanticString}"`);
          console.log(`      Value: ${result.value} ${result.unit || ''}`);
          console.log(`      Metric: ${result.metric}`);
        });
      }
      
    } catch (error) {
      console.error(`   ❌ Text search failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 7: Test Filter-Based Search
    console.log("\n🔍 Step 7: Testing Filter-Based Search");
    console.log("-".repeat(60));
    
    try {
      const filterResults = await semanticSearchEngine.searchByFilters({
        tenantId: TEST_TENANT_ID
      }, { limit: 5 });

      console.log(`   → Filter search found ${filterResults.length} results`);
      
      if (filterResults.length > 0) {
        filterResults.slice(0, 3).forEach((result, index) => {
          console.log(`   ${index + 1}: "${result.semanticString}"`);
          console.log(`      Value: ${result.value} ${result.unit || ''}`);
          console.log(`      Metric: ${result.metric}`);
        });
      }
      
    } catch (error) {
      console.error(`   ❌ Filter search failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 8: Performance Summary
    console.log("\n📊 Step 8: Performance Summary");
    console.log("-".repeat(60));
    
    const totalTime = parseTime + storeTime + embedTime + updateTime;
    console.log(`⏱️ Total processing time: ${totalTime}ms`);
    console.log(`   - Parsing: ${parseTime}ms (${((parseTime/totalTime)*100).toFixed(1)}%)`);
    console.log(`   - Storage: ${storeTime}ms (${((storeTime/totalTime)*100).toFixed(1)}%)`);
    console.log(`   - Embedding: ${embedTime}ms (${((embedTime/totalTime)*100).toFixed(1)}%)`);
    console.log(`   - Update: ${updateTime}ms (${((updateTime/totalTime)*100).toFixed(1)}%)`);
    
    console.log(`📈 Throughput metrics:`);
    console.log(`   - Cells per second: ${(parsedCells.length / (totalTime/1000)).toFixed(1)}`);
    console.log(`   - Embeddings per second: ${(embeddings.length / (embedTime/1000)).toFixed(1)}`);
    console.log(`   - Storage operations per second: ${(storageResult.cellCount / (storeTime/1000)).toFixed(1)}`);

    console.log("\n🎉 Enhanced Pipeline Flow Test Complete!");
    console.log("=" .repeat(80));

  } catch (error) {
    console.error("❌ Test failed:", error instanceof Error ? error.message : String(error));
    console.error(error);
  } finally {
    // Disconnect from MongoDB
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log("🔌 Disconnected from MongoDB");
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testEnhancedPipelineFlow().catch(console.error);
}

export { testEnhancedPipelineFlow };
