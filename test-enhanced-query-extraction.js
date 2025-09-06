// Test script to demonstrate enhanced query extraction with comprehensive filtering
const { EnhancedSearch } = require('./apps/embedder/enhanced-search.ts');

async function testEnhancedQueryExtraction() {
  console.log('🧪 Testing Enhanced Query Extraction with Comprehensive Filtering...\n');

  const search = new EnhancedSearch();
  
  // Test queries from different business domains to show generic approach
  const testQueries = [
    "calculate the hardware units sold in APAC region",
    "show me revenue growth for Q1 2023",
    "find customer satisfaction scores by department",
    "analyze employee performance metrics by team",
    "compare product sales between regions",
    "show me inventory levels for electronics category",
    "find patient outcomes by treatment type",
    "analyze website traffic by source channel"
  ];

  for (const query of testQueries) {
    console.log(`📝 Query: "${query}"`);
    
    try {
      // Test the enhanced query normalization
      const enhancedQuery = await search.enhanceQueryNormalization(query);
      
      console.log('🎯 Extracted Business Context:');
      console.log(`   Metrics: [${enhancedQuery.businessContext.metrics.join(', ')}]`);
      console.log(`   Dimensions: [${enhancedQuery.businessContext.dimensions.join(', ')}]`);
      console.log(`   Business Terms: [${enhancedQuery.businessContext.businessTerms.join(', ')}]`);
      console.log(`   Intent: ${enhancedQuery.businessContext.intent}`);
      console.log(`   Normalized Query: "${enhancedQuery.normalizedQuery}"`);
      
      // Show what filters would be applied
      console.log('🔍 Applied Filters:');
      if (enhancedQuery.businessContext.metrics.length > 0) {
        console.log(`   - Column/Metric filters: ${enhancedQuery.businessContext.metrics.join(' OR ')}`);
      }
      if (enhancedQuery.businessContext.businessTerms.length > 0) {
        console.log(`   - Business term filters: ${enhancedQuery.businessContext.businessTerms.join(' OR ')}`);
      }
      if (enhancedQuery.businessContext.dimensions.length > 0) {
        console.log(`   - Dimension filters: ${enhancedQuery.businessContext.dimensions.join(' OR ')}`);
      }
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error processing query: ${error.message}`);
      console.log('');
    }
  }

  console.log('✅ Generic filtering approach will improve search accuracy by:');
  console.log('   1. Using LLM to extract relevant terms from any business domain');
  console.log('   2. Filtering vector results by extracted terms (metrics, dimensions, business terms)');
  console.log('   3. Matching terms in row names, column names, values, and dimensions');
  console.log('   4. Combining semantic similarity with flexible term-based filtering');
  console.log('   5. Working across different industries without hardcoded assumptions');
}

// Run the test
testEnhancedQueryExtraction().catch(console.error);
