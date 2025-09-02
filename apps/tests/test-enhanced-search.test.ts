import { EnhancedSearch } from '../embedder/enhanced-search';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function testEnhancedSearch() {
  console.log('🚀 Testing Enhanced Search Pipeline');
  
  const search = new EnhancedSearch();
  
  try {
    // Connect to database first
    console.log('🔌 Connecting to database...');
    await search.connect();
    console.log('✅ Database connected successfully');
    
    // Test 1: Basic financial query
    console.log('\n📊 Test 1: Basic Financial Query');
    const result1 = await search.semanticSearch({
      tenantId: "tenant_test_enhanced",
      workbookId: "Company Financial Model MultiYear",
      query: "What was the average bottom line performance in 2021?",
      topK: 25
    });
    
    console.log('✅ Test 1 Results:');
    console.log('Query:', result1.query);
    console.log('Enhanced Query:', result1.enhancedQuery.normalizedQuery);
    console.log('Business Context:', result1.enhancedQuery.businessContext);
    console.log('LLM Answer:', result1.llmResponse.answer);
    console.log('Confidence:', result1.llmResponse.confidence);
    console.log('Data Points Used:', result1.llmResponse.dataPoints);
    console.log('Search Metadata:', result1.searchMetadata);
    
    // Test 2: Complex query with multiple dimensions
    console.log('\n📊 Test 2: Complex Multi-Dimensional Query');
    const result2 = await search.semanticSearch({
      tenantId: "tenant_test_enhanced",
      workbookId: "Company Financial Model MultiYear",
      query: "Show me revenue trends by region and product for Q3 2022",
      topK: 30
    });
    
    console.log('✅ Test 2 Results:');
    console.log('Query:', result2.query);
    console.log('Enhanced Query:', result2.enhancedQuery.normalizedQuery);
    console.log('Business Context:', result2.enhancedQuery.businessContext);
    console.log('LLM Answer:', result2.llmResponse.answer);
    console.log('Confidence:', result2.llmResponse.confidence);
    console.log('Data Points Used:', result2.llmResponse.dataPoints);
    
    // Test 3: Time-based analysis
    console.log('\n📊 Test 3: Time-Based Analysis');
    const result3 = await search.semanticSearch({
      tenantId: "tenant_test_enhanced",
      workbookId: "Company Financial Model MultiYear",
      query: "Compare EBITDA margins between Q1 and Q4 2023",
      topK: 20
    });
    
    console.log('✅ Test 3 Results:');
    console.log('Query:', result3.query);
    console.log('Enhanced Query:', result3.enhancedQuery.normalizedQuery);
    console.log('Business Context:', result3.enhancedQuery.businessContext);
    console.log('LLM Answer:', result3.llmResponse.answer);
    console.log('Confidence:', result3.llmResponse.confidence);
    console.log('Data Points Used:', result3.llmResponse.dataPoints);
    
    // Performance summary
    console.log('\n📈 Performance Summary:');
    const allResults = [result1, result2, result3];
    const avgVectorTime = allResults.reduce((sum, r) => sum + r.searchMetadata.vectorSearchTime, 0) / allResults.length;
    const avgStructuredTime = allResults.reduce((sum, r) => sum + r.searchMetadata.structuredDataTime, 0) / allResults.length;
    const avgLLMTime = allResults.reduce((sum, r) => sum + r.searchMetadata.llmGenerationTime, 0) / allResults.length;
    const avgTotalTime = allResults.reduce((sum, r) => sum + r.searchMetadata.totalTime, 0) / allResults.length;
    
    console.log(`Average Vector Search Time: ${avgVectorTime.toFixed(2)}ms`);
    console.log(`Average Structured Data Time: ${avgStructuredTime.toFixed(2)}ms`);
    console.log(`Average LLM Generation Time: ${avgLLMTime.toFixed(2)}ms`);
    console.log(`Average Total Time: ${avgTotalTime.toFixed(2)}ms`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await search.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testEnhancedSearch()
    .then(() => {
      console.log('✅ All tests completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    });
}

export { testEnhancedSearch };
