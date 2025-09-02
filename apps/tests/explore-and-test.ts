import { EnhancedSearch } from '../embedder/enhanced-search';

async function exploreAndTest() {
  const search = new EnhancedSearch();
  
  try {
    console.log("🚀 Starting database exploration and search testing...");
    
    // Connect to database
    await search.connect();
    
    // 1. Explore what data exists
    console.log("\n" + "=".repeat(60));
    console.log("🔍 STEP 1: EXPLORING DATABASE");
    console.log("=".repeat(60));
    await search.exploreDatabase();
    
    // 2. Find available tenant/workbook combinations
    console.log("\n" + "=".repeat(60));
    console.log("🔍 STEP 2: FINDING AVAILABLE DATA COMBINATIONS");
    console.log("=".repeat(60));
    const combinations = await search.findAvailableCombinations();
    
    if (combinations.length === 0) {
      console.log("❌ No data combinations found. Cannot proceed with testing.");
      return;
    }
    
    console.log("📊 Available combinations:");
    combinations.forEach((combo, index) => {
      console.log(`  ${index + 1}. Tenant: ${combo.tenantId}, Workbook: ${combo.workbookId} (${combo.count} documents)`);
    });
    
    // 3. Test search with the first available combination
    console.log("\n" + "=".repeat(60));
    console.log("🧪 STEP 3: TESTING SEARCH WITH AVAILABLE DATA");
    console.log("=".repeat(60));
    await search.testWithAvailableData();
    
    // 4. Test with a specific query if we have data
    if (combinations.length > 0) {
      const { tenantId, workbookId } = combinations[0];
      
      console.log("\n" + "=".repeat(60));
      console.log("🧪 STEP 4: TESTING SPECIFIC QUERIES");
      console.log("=".repeat(60));
      
      const testQueries = [
        "revenue",
        "profit 2023",
        "EBITDA",
        "sales performance",
        "financial metrics"
      ];
      
      for (const query of testQueries) {
        console.log(`\n🔍 Testing query: "${query}"`);
        try {
          const results = await search.semanticSearch({
            tenantId,
            workbookId,
            query,
            topK: 5
          });
          
          console.log(`✅ Query: "${query}"`);
          console.log(`📊 Vector results: ${results.vectorResults.length}`);
          console.log(`📊 Structured data: ${results.structuredData.length}`);
          console.log(`🤖 LLM Answer: ${results.llmResponse.answer.substring(0, 100)}...`);
          console.log(`🎯 Confidence: ${results.llmResponse.confidence}`);
          
        } catch (error) {
          console.error(`❌ Query "${query}" failed:`, error);
        }
      }
    }
    
  } catch (error) {
    console.error("❌ Exploration and testing failed:", error);
  } finally {
    await search.disconnect();
    console.log("\n🔌 Disconnected from database");
  }
}

// Run the exploration and testing
exploreAndTest().catch(console.error);
