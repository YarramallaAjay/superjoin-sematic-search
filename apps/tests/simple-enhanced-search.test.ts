import { EnhancedSearch } from '../embedder/enhanced-search';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function simpleTest() {
  console.log('🚀 Simple Enhanced Search Test');
  
  const search = new EnhancedSearch();
  
  try {
    // Connect to database first
    console.log('🔌 Connecting to database...');
    await search.connect();
    console.log('✅ Database connected successfully');
    
    // Single test with proper error handling
    console.log('\n📊 Testing Enhanced Search');
    const result = await search.semanticSearch({
      tenantId: "tenant_test_enhanced",
      workbookId: "Company Financial Model MultiYear",
      query: "What was the average bottom line performance in 2021?",
      topK: 25
    });
    
    console.log('✅ Test Results:');
    console.log('Query:', result.query);
    console.log('Enhanced Query:', result.enhancedQuery.normalizedQuery);
    console.log('Business Context:', result.enhancedQuery.businessContext);
    console.log('Metrics Found:', result.enhancedQuery.metrics.join(', '));
    console.log('Dimensions Found:', result.enhancedQuery.dimensions.join(', '));
    console.log('Vector Results:', result.vectorResults.length);
    console.log('Structured Data:', result.structuredData.length);
    console.log('LLM Answer:', result.llmResponse.answer);
    console.log('Confidence:', result.llmResponse.confidence);
    console.log('Data Points Used:', result.llmResponse.dataPoints);
    
    console.log('\n📈 Performance Metrics:');
    console.log(`Query Enhancement: ${result.searchMetadata.queryEnhancementTime}ms`);
    console.log(`Vector Search: ${result.searchMetadata.vectorSearchTime}ms`);
    console.log(`Structured Data: ${result.searchMetadata.structuredDataTime}ms`);
    console.log(`LLM Generation: ${result.searchMetadata.llmGenerationTime}ms`);
    console.log(`Total Time: ${result.searchMetadata.totalTime}ms`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
  } finally {
    await search.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
if (require.main === module) {
  simpleTest()
    .then(() => {
      console.log('✅ Simple test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Simple test failed:', error);
      process.exit(1);
    });
}

export { simpleTest };
