# Enhanced Semantic Search with LLM Integration

This enhanced search system implements a three-stage pipeline that combines vector search, structured data retrieval, and LLM-powered answer generation for intelligent financial data analysis.

## 🚀 Overview

The enhanced search system goes beyond traditional vector search by:

1. **Normalizing queries** using semantic dictionaries
2. **Performing vector search** on normalized queries for semantic similarity
3. **Retrieving complete structured data** based on search results
4. **Generating intelligent answers** using LLM (Gemini) with structured context

## 🏗️ Architecture

### Three-Stage Pipeline

```
User Query → Query Normalization → Vector Search → Structured Data Retrieval → LLM Answer Generation
     ↓              ↓                ↓                    ↓                    ↓
Natural Language → Semantic String → Embeddings → MongoDB Atlas → Gemini LLM → Intelligent Answer
```

### Stage 1: Query Normalization
- Parses natural language queries
- Extracts metrics, dimensions, and time filters
- Builds normalized semantic strings for embedding generation
- Uses configurable semantic dictionaries

### Stage 2: Vector Search
- Generates embeddings for normalized queries
- Performs MongoDB Atlas vector search
- Returns top-k semantically similar results
- Maintains vector search scores for ranking

### Stage 3: Structured Data Retrieval
- Extracts unique identifiers from vector search results
- Retrieves complete structured data using MongoDB aggregation
- Applies business filters (time, region, product, etc.)
- Ensures comprehensive data coverage

### Stage 4: LLM Answer Generation
- Prepares structured context for LLM
- Sends data to Gemini for intelligent analysis
- Generates business-friendly answers with confidence scores
- Provides reasoning and key insights

## 📁 Files

- **`embedder/enhanced-search.ts`** - Main enhanced search class
- **`tests/test-enhanced-search.test.ts`** - Test suite for the enhanced search
- **`ENHANCED_SEARCH_README.md`** - This documentation

## 🚀 Quick Start

### 1. Environment Setup

Ensure you have the following environment variables in `.env.local`:

```bash
MONGO_DB_URL=mongodb+srv://username:password@cluster.mongodb.net/
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Basic Usage

```typescript
import { EnhancedSearch } from './embedder/enhanced-search';

const search = new EnhancedSearch();
await search.connect();

const results = await search.semanticSearch({
  tenantId: "tenant1234",
  workbookId: "wb_abc123",
  query: "What was the average bottom line performance in 2021?",
  topK: 25
});

console.log("LLM Answer:", results.llmResponse.answer);
console.log("Confidence:", results.llmResponse.confidence);
console.log("Data Points Used:", results.llmResponse.dataPoints);

await search.disconnect();
```

### 3. Run Tests

```bash
npm run test-enhanced-search
```

## 🔍 Search Capabilities

### Query Types Supported

1. **Metric Queries**
   - "What is the revenue for Q3 2023?"
   - "Show me EBITDA margins"
   - "Average bottom line performance"

2. **Time-Based Analysis**
   - "Compare Q1 vs Q4 2023"
   - "Revenue trends over the last year"
   - "Monthly performance in 2022"

3. **Multi-Dimensional Queries**
   - "Revenue by region and product"
   - "Customer performance across departments"
   - "Regional EBITDA analysis"

4. **Comparative Analysis**
   - "Which quarter had the best performance?"
   - "Compare North vs South region"
   - "Product A vs Product B margins"

### Response Format

```typescript
interface SearchResult {
  query: string;                    // Original user query
  normalizedQuery: string;          // Normalized semantic string
  vectorResults: SearchResult[];    // Vector search results
  structuredData: SearchResult[];   // Complete structured data
  llmResponse: LLMResponse;         // LLM-generated answer
  searchMetadata: {                 // Performance metrics
    vectorSearchTime: number;
    structuredDataTime: number;
    llmGenerationTime: number;
    totalTime: number;
  };
}

interface LLMResponse {
  answer: string;                   // Human-readable answer
  confidence: number;               // Confidence score (0-1)
  reasoning: string;                // Explanation of reasoning
  dataPoints: number;               // Number of data points used
  sources: string[];                // Key insights and sources
}
```

## 🎯 Key Features

### 1. Intelligent Query Understanding
- **Semantic Normalization**: Maps business terms to standardized metrics
- **Context Extraction**: Identifies time periods, dimensions, and filters
- **Query Expansion**: Handles synonyms and related terms

### 2. Hybrid Search Strategy
- **Vector Search**: Semantic similarity using embeddings
- **Structured Filtering**: Business logic and constraints
- **Result Ranking**: Combines vector scores with business rules

### 3. LLM-Powered Analysis
- **Context-Aware**: Provides structured data context to LLM
- **Business Intelligence**: Generates insights and trends
- **Confidence Scoring**: Indicates answer reliability
- **Reasoning Transparency**: Explains how answers were derived

### 4. Performance Optimization
- **Batch Processing**: Efficient embedding generation
- **Connection Pooling**: Optimized database connections
- **Caching**: Vector search result caching
- **Parallel Processing**: Concurrent data retrieval

## 📊 Performance Metrics

### Typical Response Times
- **Vector Search**: 50-200ms
- **Structured Data Retrieval**: 100-500ms
- **LLM Generation**: 1000-3000ms
- **Total Pipeline**: 1200-4000ms

### Scalability
- **Concurrent Queries**: 10-50 simultaneous searches
- **Data Volume**: Millions of cells per workbook
- **Embedding Storage**: 768-dimensional vectors
- **Index Performance**: Sub-second response for large datasets

## 🔧 Configuration

### Semantic Dictionary
Customize business term mappings in `config/semantic-dictionary.json`:

```json
{
  "metrics": {
    "revenue": ["revenue", "sales", "top line", "gross sales"],
    "ebitda": ["ebitda", "operating profit", "operating income"],
    "net_income": ["net income", "bottom line", "net profit", "earnings"]
  },
  "dimensions": {
    "region": ["region", "territory", "area", "geography"],
    "product": ["product", "service", "offering", "solution"]
  }
}
```

### LLM Configuration
Modify LLM settings in the `EnhancedSearch` class:

```typescript
private async initializeLLM() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  // Change model as needed
  this.llmModel = genAI.getGenerativeModel({ 
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.3,        // Lower for more consistent answers
      topP: 0.8,              // Nucleus sampling
      maxOutputTokens: 2048    // Response length limit
    }
  });
}
```

## 🚨 Error Handling

### Graceful Degradation
- **LLM Failures**: Falls back to structured data summary
- **Vector Search Errors**: Retries with exponential backoff
- **Database Issues**: Connection retry and error reporting
- **Embedding Failures**: Zero-vector fallbacks

### Error Types
```typescript
// Common error scenarios
- Database connection failures
- LLM API rate limits
- Embedding generation errors
- Insufficient data for analysis
- Query parsing failures
```

## 🔮 Future Enhancements

### Planned Features
1. **Multi-Modal Support**: Image and chart analysis
2. **Advanced Analytics**: Statistical analysis and forecasting
3. **Real-Time Updates**: Live data streaming
4. **Custom LLM Models**: Fine-tuned domain-specific models
5. **Query History**: Learning from user interactions

### Integration Points
1. **API Gateway**: RESTful API endpoints
2. **WebSocket Support**: Real-time search updates
3. **Mobile SDK**: Native mobile applications
4. **BI Tools**: Power BI, Tableau connectors
5. **Chatbots**: Conversational AI integration

## 🧪 Testing

### Test Scenarios
1. **Basic Functionality**: Simple metric queries
2. **Complex Queries**: Multi-dimensional analysis
3. **Edge Cases**: Empty results, malformed queries
4. **Performance**: Load testing and benchmarking
5. **Error Handling**: Failure scenarios and recovery

### Running Tests
```bash
# Run all enhanced search tests
npm run test-enhanced-search

# Run specific test file
npx ts-node tests/test-enhanced-search.test.ts

# Run with verbose logging
DEBUG=enhanced-search npm run test-enhanced-search
```

## 📚 Examples

### Example 1: Revenue Analysis
```typescript
const query = "What was our total revenue in Q3 2023 and how does it compare to Q2?";

const results = await search.semanticSearch({
  tenantId: "tenant1234",
  workbookId: "wb_abc123",
  query,
  topK: 30
});

// Results include:
// - Vector search results for semantic similarity
// - Complete revenue data for Q2 and Q3 2023
// - LLM-generated comparison analysis
// - Confidence score and reasoning
```

### Example 2: Regional Performance
```typescript
const query = "Show me EBITDA performance by region for the last 4 quarters";

const results = await search.semanticSearch({
  tenantId: "tenant1234",
  workbookId: "wb_abc123",
  query,
  topK: 50
});

// Results include:
// - Regional EBITDA data across quarters
// - Trend analysis and insights
// - Performance rankings
// - Key drivers and recommendations
```

## 🤝 Contributing

### Development Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Run tests: `npm run test-enhanced-search`
5. Make changes and test thoroughly

### Code Standards
- **TypeScript**: Strict typing and interfaces
- **Error Handling**: Comprehensive error management
- **Logging**: Structured logging with levels
- **Documentation**: JSDoc comments for all methods
- **Testing**: Unit tests for all functionality

## 📄 License

This enhanced search system is part of the SuperJoin Semantic Search project. Please refer to the main project license for usage terms.

## 🆘 Support

For issues and questions:
1. Check the main project README
2. Review error logs and debugging output
3. Test with simple queries first
4. Verify environment configuration
5. Check MongoDB Atlas vector search setup

---

**Note**: This enhanced search system requires MongoDB Atlas with vector search capabilities and a valid Gemini API key for full functionality.
