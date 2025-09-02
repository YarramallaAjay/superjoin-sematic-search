import { enhancedSemanticNormalizer } from '../utils/enhanced-semantic-normalizer';

async function testEnhancedNormalization() {
  console.log("🧪 Testing Enhanced Semantic Normalization");
  console.log("=".repeat(60));

  // Test 1: Query Analysis
  console.log("\n🔍 TEST 1: Query Analysis");
  console.log("-".repeat(40));
  
  const testQueries = [
    "What was the revenue in Q1 2023?",
    "Show me EBITDA performance by region",
    "Net profit margin for the last fiscal year",
    "Sales growth in North America",
    "Operating expenses by department"
  ];

  testQueries.forEach((query, index) => {
    console.log(`\n📝 Query ${index + 1}: "${query}"`);
    const analysis = enhancedSemanticNormalizer.analyzeQuery(query);
    
    console.log(`✅ Metrics: ${analysis.metrics.join(', ') || 'None'}`);
    console.log(`✅ Dimensions: ${analysis.dimensions.join(', ') || 'None'}`);
    console.log(`✅ Time Filters: ${JSON.stringify(analysis.timeFilters)}`);
    console.log(`✅ Operations: ${analysis.operations.join(', ') || 'None'}`);
    console.log(`✅ Performance: ${analysis.performance.join(', ') || 'None'}`);
    console.log(`✅ Business Context: ${analysis.businessContext}`);
    
    const normalizedQuery = enhancedSemanticNormalizer.createNormalizedQueryString(analysis);
    console.log(`✅ Normalized Query: "${normalizedQuery}"`);
  });

  // Test 2: Value Normalization
  console.log("\n\n🔍 TEST 2: Value Normalization");
  console.log("-".repeat(40));
  
  const testValues = [
    "sales",
    "revenue",
    "ebitda",
    "Q1",
    "2023",
    "north america",
    "marketing",
    "high priority",
    "open status",
    "unknown term"
  ];

  testValues.forEach((value, index) => {
    console.log(`\n📊 Value ${index + 1}: "${value}"`);
    const normalized = enhancedSemanticNormalizer.normalizeValue(value);
    
    console.log(`✅ Original: "${normalized.originalValue}"`);
    console.log(`✅ Normalized: "${normalized.normalizedValue}"`);
    console.log(`✅ Category: ${normalized.semanticCategory}`);
    console.log(`✅ Confidence: ${normalized.confidence}`);
  });

  // Test 3: Excel Data Normalization
  console.log("\n\n🔍 TEST 3: Excel Data Normalization");
  console.log("-".repeat(40));
  
  const sampleExcelData = [
    {
      metric: "sales revenue",
      year: "2023",
      quarter: "Q1",
      region: "north america",
      value: 1000000
    },
    {
      metric: "ebitda",
      year: "2023",
      quarter: "Q1",
      region: "europe",
      value: 500000
    },
    {
      metric: "operating expenses",
      year: "2023",
      quarter: "Q1",
      department: "marketing",
      value: 200000
    }
  ];

  console.log("📊 Sample Excel Data:");
  sampleExcelData.forEach((row, index) => {
    console.log(`  Row ${index + 1}:`, row);
  });

  const normalizedData = enhancedSemanticNormalizer.normalizeExcelData(sampleExcelData);
  
  console.log("\n✅ Normalized Excel Data:");
  normalizedData.forEach((row, index) => {
    console.log(`  Row ${index + 1}:`, {
      originalMetric: row.metric,
      normalizedMetric: row.metricNormalized,
      metricCategory: row.metricCategory,
      metricConfidence: row.metricConfidence,
      enhancedSemanticString: row.enhancedSemanticString
    });
  });

  // Test 4: Available Terms
  console.log("\n\n🔍 TEST 4: Available Terms");
  console.log("-".repeat(40));
  
  const categories = ['metrics', 'dimensions', 'time', 'operations', 'performance'];
  
  categories.forEach(category => {
    const terms = enhancedSemanticNormalizer.getAvailableTerms(category);
    console.log(`\n📋 ${category.toUpperCase()} (${terms.length} terms):`);
    console.log(`  ${terms.slice(0, 5).join(', ')}${terms.length > 5 ? `... and ${terms.length - 5} more` : ''}`);
  });

  // Test 5: Synonyms
  console.log("\n\n🔍 TEST 5: Synonyms");
  console.log("-".repeat(40));
  
  const testTerms = [
    { category: 'metrics', term: 'Revenue' },
    { category: 'dimensions', term: 'Customer' },
    { category: 'time', term: 'Year' }
  ];

  testTerms.forEach(({ category, term }) => {
    const synonyms = enhancedSemanticNormalizer.getSynonyms(category, term);
    console.log(`\n📚 Synonyms for "${term}" (${category}):`);
    console.log(`  ${synonyms.join(', ')}`);
  });

  console.log("\n✅ Enhanced Semantic Normalization Test Completed!");
}

// Run the test
testEnhancedNormalization().catch(console.error);
