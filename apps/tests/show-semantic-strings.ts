import { EnhancedSearch } from '../embedder/enhanced-search';

async function showSemanticStrings() {
  console.log("🔍 Showing Retrieved Vector Semantic Strings");
  console.log("=".repeat(60));

  const search = new EnhancedSearch();
  
  try {
    await search.connect();
    
    // Test with a simple query to see what semantic strings are retrieved
    const testQuery = "financial metrics";
    console.log(`\n📝 Testing Query: "${testQuery}"`);
    
    const results = await search.semanticSearch({
      tenantId: "tenant_test_enhanced",
      workbookId: "Company Financial Model MultiYear",
      query: testQuery,
      topK: 10
    });

    console.log("\n📊 SEARCH RESULTS SUMMARY:");
    console.log(`✅ Query: "${results.query}"`);
    console.log(`✅ Enhanced Query: "${results.enhancedQuery.normalizedQuery}"`);
    console.log(`✅ Vector Results: ${results.vectorResults.length} items`);
    console.log(`✅ Structured Data: ${results.structuredData.length} items`);

    console.log("\n🔍 VECTOR SEARCH RESULTS (Semantic Strings):");
    console.log("-".repeat(50));
    
    if (results.vectorResults.length > 0) {
      results.vectorResults.forEach((result, index) => {
        console.log(`\n📋 Result ${index + 1}:`);
        console.log(`  🆔 ID: ${result._id}`);
        console.log(`  📊 Metric: ${result.metric}`);
        console.log(`  🔄 Normalized Metric: ${result.normalizedMetric}`);
        console.log(`  🧠 Semantic String: "${result.semanticString}"`);
        console.log(`  💰 Value: ${result.value}`);
        console.log(`  📅 Year: ${result.year || 'N/A'}`);
        console.log(`  🗓️  Quarter: ${result.quarter || 'N/A'}`);
        console.log(`  🌍 Region: ${result.region || 'N/A'}`);
        console.log(`  📈 Score: ${result.score}`);
        console.log(`  🏢 Tenant: ${result.tenantId}`);
        console.log(`  📚 Workbook: ${result.workbookId}`);
        console.log(`  📄 Sheet: ${result.sheetId}`);
      });
    } else {
      console.log("⚠️  No vector results found");
    }

    console.log("\n📊 STRUCTURED DATA RESULTS:");
    console.log("-".repeat(50));
    
    if (results.structuredData.length > 0) {
      results.structuredData.forEach((data, index) => {
        console.log(`\n📋 Data ${index + 1}:`);
        console.log(`  🆔 ID: ${data._id}`);
        console.log(`  📊 Metric: ${data.metric}`);
        console.log(`  🔄 Normalized Metric: ${data.normalizedMetric}`);
        console.log(`  🧠 Semantic String: "${data.semanticString}"`);
        console.log(`  💰 Value: ${data.value}`);
        console.log(`  📅 Year: ${data.year || 'N/A'}`);
        console.log(`  🗓️  Quarter: ${data.quarter || 'N/A'}`);
        console.log(`  🌍 Region: ${data.region || 'N/A'}`);
        console.log(`  📈 Score: ${data.score}`);
      });
    } else {
      console.log("⚠️  No structured data found");
    }

    console.log("\n🤖 LLM RESPONSE:");
    console.log("-".repeat(50));
    console.log(`📝 Answer: ${results.llmResponse.answer}`);
    console.log(`🎯 Confidence: ${results.llmResponse.confidence}`);
    console.log(`🧠 Reasoning: ${results.llmResponse.reasoning}`);
    console.log(`📊 Data Points Used: ${results.llmResponse.dataPoints}`);
    console.log(`🔍 Sources: ${results.llmResponse.sources.join(', ') || 'None'}`);

    console.log("\n⏱️  PERFORMANCE METRICS:");
    console.log("-".repeat(50));
    console.log(`🚀 Query Enhancement: ${results.searchMetadata.queryEnhancementTime}ms`);
    console.log(`🔍 Vector Search: ${results.searchMetadata.vectorSearchTime}ms`);
    console.log(`📊 Structured Data: ${results.searchMetadata.structuredDataTime}ms`);
    console.log(`🤖 LLM Generation: ${results.searchMetadata.llmGenerationTime}ms`);
    console.log(`⏱️  Total Time: ${results.searchMetadata.totalTime}ms`);

  } catch (error) {
    console.error("❌ Error during search:", error);
  } finally {
    await search.disconnect();
  }
}

// Run the test
showSemanticStrings().catch(console.error);
