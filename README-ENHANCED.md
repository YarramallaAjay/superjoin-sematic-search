# Enhanced Semantic Parsing and Storage Pipeline

A comprehensive, production-ready semantic parsing and storage pipeline for Excel workbooks with intelligent normalization, structured data extraction, and advanced vector search capabilities.

## 🚀 Features

### Core Functionality
- **Semantic Normalization**: Intelligent mapping of business terms using configurable dictionaries
- **Structured Data Extraction**: Automatic identification and extraction of metrics, dimensions, and time data
- **ID Exclusion**: Smart detection and exclusion of unique identifiers from embeddings
- **Vector Search**: MongoDB Atlas vector search with semantic similarity scoring
- **Hybrid Search**: Combination of vector search and structured filtering for optimal results

### Advanced Capabilities
- **Query Understanding**: Natural language query parsing and normalization
- **Result Re-ranking**: Intelligent scoring based on exact matches and semantic similarity
- **Batch Processing**: Efficient handling of large workbooks with progress tracking
- **Error Handling**: Robust error handling with retry mechanisms and fallbacks
- **Performance Monitoring**: Comprehensive logging and performance metrics

## 🏗️ Architecture

### Components Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Excel File   │───▶│  Enhanced Parser │───▶│  MongoDB Atlas  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │ Semantic Search  │◀───│   Vector Index  │
                       └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Query Results   │
                       └──────────────────┘
```

### Data Flow

1. **Input Processing**: Excel workbook → Buffer → XLSX parsing
2. **Semantic Analysis**: Header analysis → Metric/dimension identification → Normalization
3. **Data Extraction**: Cell value extraction → Time hint detection → Structured field mapping
4. **Embedding Generation**: Semantic string creation → Vector embedding → Storage
5. **Search & Retrieval**: Query parsing → Vector search → Filtering → Re-ranking

## 📁 File Structure

```
├── config/
│   └── semantic-dictionary.json     # Configurable normalization mappings
├── utils/
│   └── semantic-normalizer.ts       # Core normalization logic
├── embedder/
│   ├── parse-enhanced.ts            # Enhanced workbook parser
│   ├── store-enhanced.ts            # Enhanced storage functions
│   ├── semantic-search.ts           # Semantic search engine
│   ├── ingest-enhanced.ts           # Main ingestion orchestrator
│   └── embedding.ts                 # Embedding generation (existing)
├── models/
│   └── workbook.ts                  # Enhanced MongoDB schemas
└── tests/
    └── test-enhanced-pipeline.test.ts # Comprehensive test suite
```

## 🔧 Configuration

### Semantic Dictionary

The `config/semantic-dictionary.json` file contains mappings for:

- **Metrics**: Revenue, Gross Profit, Net Profit, etc.
- **Dimensions**: Customer, Region, Product, Department, etc.
- **Time**: Year, Quarter, Month patterns
- **Status**: Open, Closed, Cancelled, etc.
- **Priority**: High, Medium, Low levels

Example:
```json
{
  "metrics": {
    "Revenue": ["sales", "turnover", "topline", "gross income"],
    "Gross Profit": ["gross margin", "gp", "gross profit"]
  },
  "dimensions": {
    "Region": ["geography", "location", "area", "region"],
    "Customer": ["client", "account", "customer id", "buyer"]
  }
}
```

## 🚀 Usage

### Basic Ingestion

```typescript
import { ingestWorkbookEnhanced } from './embedder/ingest-enhanced';
import * as fs from 'fs';

const buffer = fs.readFileSync('workbook.xlsx');
const result = await ingestWorkbookEnhanced(
  'tenant_123',
  'Financial Report 2023',
  buffer,
  {
    clearExisting: true,
    testSearch: true,
    searchQueries: ['revenue analysis', 'profit margins']
  }
);

console.log(`Processed ${result.cellCount} cells in ${result.processingTime}ms`);
```

### Semantic Search

```typescript
import { semanticSearchEngine } from './embedder/semantic-search';

// Natural language search
const results = await semanticSearchEngine.semanticSearch(
  'profit margin analysis for Q1 2023',
  {
    tenantId: 'tenant_123',
    limit: 10,
    minScore: 0.3
  }
);

// Filter-based search
const filterResults = await semanticSearchEngine.searchByFilters({
  tenantId: 'tenant_123',
  year: 2023,
  region: 'North'
}, { limit: 20 });
```

### Custom Normalization

```typescript
import { semanticNormalizer } from './utils/semantic-normalizer';

// Normalize individual values
const normalized = semanticNormalizer.normalizeValue('sales');
console.log(normalized); // { original: 'sales', normalized: 'Revenue', category: 'metric', confidence: 1.0 }

// Extract time hints
const timeHints = semanticNormalizer.extractTimeHints('2023 Q1');
console.log(timeHints); // { year: 2023, quarter: 'Q1' }

// Build semantic strings
const semanticString = semanticNormalizer.buildSemanticString(
  'Revenue',
  { region: 'North', customer: 'TKT0032' },
  { year: 2023, quarter: 'Q1' }
);
console.log(semanticString); // "Revenue | North | 2023 | Q1"
```

## 🔍 Search Pipeline

### 1. Query Parsing
- Extract metrics, dimensions, and time filters
- Normalize using semantic dictionary
- Build structured query representation

### 2. Vector Search
- Generate query embedding
- Run MongoDB Atlas `$vectorSearch`
- Retrieve top-k candidates

### 3. Structured Filtering
- Apply time, region, customer filters
- Filter by score thresholds
- Maintain result quality

### 4. Result Re-ranking
- Boost exact metric matches
- Prioritize dimension matches
- Enhance time-based relevance
- Sort by final score

### 5. Context Enrichment
- Include semantic strings
- Provide structured fields
- Add business context
- Enable LLM reasoning

## 📊 Data Model

### Enhanced AtlasCell Schema

```typescript
{
  _id: string,
  tenantId: string,
  workbookId: string,
  sheetId: string,
  
  // Semantic representation
  semanticString: string,
  
  // Structured fields
  metric: string,
  normalizedMetric: string,
  
  // Time dimensions
  year: number,
  quarter: string,
  month: string,
  
  // Business dimensions
  region: string,
  customerId: string,
  customerName: string,
  product: string,
  department: string,
  
  // Status and priority
  status: string,
  priority: string,
  
  // Value and metadata
  value: any,
  unit: string,
  dataType: string,
  
  // Features
  features: {
    isPercentage: boolean,
    isMargin: boolean,
    isGrowth: boolean,
    isAggregation: boolean,
    isForecast: boolean,
    isUniqueIdentifier: boolean
  },
  
  // Vector search
  embedding: number[],
  
  // Source information
  sourceCell: string,
  sourceFormula: string
}
```

## 🧪 Testing

### Run Comprehensive Tests

```bash
# Test the complete pipeline
npm run test-enhanced-pipeline

# Or run directly with ts-node
npx ts-node tests/test-enhanced-pipeline.test.ts
```

### Test Coverage

The test suite covers:
- Semantic normalization
- Time hint extraction
- Unique identifier detection
- Semantic string building
- Query parsing
- Workbook ingestion
- Semantic search
- Filter-based search
- Statistics and monitoring

## 📈 Performance

### Optimization Features

- **Batch Processing**: Configurable batch sizes for parsing and storage
- **Parallel Processing**: Concurrent embedding generation
- **Smart Caching**: Reverse lookup maps for normalization
- **Indexed Queries**: MongoDB compound indexes for fast filtering
- **Vector Search**: Efficient similarity search with MongoDB Atlas

### Expected Performance

- **Parsing**: 100-1000 cells/second (depending on complexity)
- **Embedding**: 10-50 cells/second (API rate limited)
- **Storage**: 500-2000 cells/second (batch optimized)
- **Search**: 10-100ms response time (indexed queries)

## 🔒 Security & Best Practices

### Security Features

- **Tenant Isolation**: Strict tenant-based data separation
- **Input Validation**: Comprehensive input sanitization
- **Error Handling**: Secure error messages without data leakage
- **Rate Limiting**: Built-in API rate limiting for embeddings

### Best Practices

- **Environment Variables**: Secure API key management
- **Connection Pooling**: Efficient database connection management
- **Transaction Safety**: Atomic operations for data consistency
- **Monitoring**: Comprehensive logging and error tracking

## 🚀 Deployment

### Prerequisites

- Node.js 18+ with TypeScript support
- MongoDB Atlas with vector search enabled
- Google Generative AI API key
- Sufficient memory for large workbook processing

### Environment Variables

```bash
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/database
GEMINI_API_KEY=your_google_ai_api_key
NODE_ENV=production
```

### Production Considerations

- **Scaling**: Horizontal scaling with load balancers
- **Monitoring**: Application performance monitoring (APM)
- **Backup**: Regular database backups and disaster recovery
- **Updates**: Semantic dictionary versioning and updates

## 🔮 Future Enhancements

### Planned Features

- **Multi-language Support**: International semantic dictionaries
- **Advanced Analytics**: Business intelligence and trend analysis
- **Real-time Processing**: Stream processing for live data
- **Machine Learning**: Automated dictionary expansion and optimization
- **API Gateway**: RESTful API with authentication and rate limiting

### Extension Points

- **Custom Normalizers**: Plugin architecture for domain-specific logic
- **Alternative Embeddings**: Support for multiple embedding providers
- **Advanced Filters**: Complex query building and optimization
- **Data Export**: Multiple export formats and integrations

## 📚 API Reference

### Core Functions

#### `ingestWorkbookEnhanced(tenantId, workbookName, buffer, options)`
Main ingestion function with semantic normalization.

#### `semanticSearchEngine.semanticSearch(query, options)`
Natural language semantic search with vector similarity.

#### `semanticSearchEngine.searchByFilters(filters, options)`
Structured filter-based search without semantic processing.

#### `semanticNormalizer.normalizeValue(value)`
Normalize individual values using semantic dictionary.

### Options & Configuration

All functions support comprehensive options for:
- Result limiting and pagination
- Score thresholds and filtering
- Tenant and workbook isolation
- Performance tuning and optimization

## 🤝 Contributing

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Run tests: `npm test`
5. Start development: `npm run dev`

### Code Standards

- TypeScript with strict typing
- Comprehensive error handling
- Extensive logging and monitoring
- Unit and integration tests
- Documentation and examples

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation and examples
- Review the test suite for usage patterns
- Contact the development team

---

**Built with ❤️ for intelligent data processing and semantic search**
