# SuperJoin Semantic Search

A powerful semantic search platform that transforms Excel data into intelligent, searchable insights using AI-powered embeddings and natural language processing.

## 🚀 Project Overview

SuperJoin Semantic Search is a full-stack application that enables users to upload Excel files, automatically parse and embed the data semantically, and perform intelligent searches using natural language queries. The system combines advanced data parsing, vector embeddings, and AI-powered analysis to provide comprehensive business intelligence.

## 🏗️ Architecture & Tech Stack

### **Frontend (Next.js 15 + React 19)**
- **Framework**: Next.js 15 with App Router
- **UI Library**: React 19 with TypeScript
- **Styling**: Tailwind CSS v3 with shadcn/ui components
- **State Management**: React hooks (useState, useMemo, useEffect)
- **Icons**: Lucide React
- **Build Tool**: Turbopack for fast development

### **Backend & Data Processing**
- **Runtime**: Node.js with TypeScript
- **Database**: MongoDB Atlas with vector search capabilities
- **Excel Processing**: XLSX library for parsing Excel files
- **AI Integration**: Google Gemini 1.5 Flash for embeddings and analysis
- **Monorepo**: Turborepo for managing multiple packages

### **AI & ML Components**
- **Embeddings**: Google Gemini Embedding API (768-dimensional vectors)
- **LLM**: Google Gemini 1.5 Flash for natural language processing
- **Vector Search**: MongoDB Atlas Vector Search for semantic similarity
- **Semantic Normalization**: Custom business term dictionary

## 🔄 Data Flow & Processing Pipeline

### **1. Excel Upload & Parsing**

```typescript
// Intelligent Excel parsing with semantic formatting
interface EnhancedParsedCell {
  _id: string;
  tenantId: string;
  workbookId: string;
  sheetName: string;
  rowName: string | null;
  colName: string | null;
  value: number | string | Date | null;
  metric: string;
  semanticString: string; // "SheetName | RowName_ColName | Year | Month"
  dataType: "number" | "string" | "date" | "percent" | "ratio";
  embedding: number[]; // 768-dimensional vector
  features: {
    isPercentage: boolean;
    isMargin: boolean;
    isGrowth: boolean;
    isAggregation: boolean;
    isForecast: boolean;
  };
}
```

**Parsing Logic:**
- **Coded Rows** (e.g., "CUST_001"): Uses column headers → `"Sales | customer_region | 2023 | Jan"`
- **Normal Rows** (e.g., "John Smith"): Uses RowName_ColName format → `"Sales | John Smith_Revenue | 2023 | Jan"`
- **Intelligent Type Detection**: Automatically identifies numbers, dates, percentages, and ratios
- **Semantic String Generation**: Creates meaningful context for embeddings

### **2. Async Embedding Generation**

```typescript
// Batch embedding generation with retry logic
class EmbeddingService {
  private async processBatch(
    batch: EmbeddingRequest[],
    batchIndex: number,
    totalBatches: number
  ): Promise<EmbeddingResult[]> {
    // Process embeddings in batches of 50
    // Retry failed requests with exponential backoff
    // Return 768-dimensional vectors for each semantic string
  }
}
```

**Embedding Process:**
- **Batch Processing**: Processes embeddings in batches of 50 for efficiency
- **Retry Logic**: Exponential backoff for failed requests
- **Vector Dimensions**: 768-dimensional vectors using Gemini Embedding API
- **Error Handling**: Zero vectors as fallback for failed embeddings

### **3. MongoDB Storage with Vector Search**

```typescript
// Enhanced storage with vector search support
async function storeCellsEnhanced(
  cells: EnhancedParsedCell[],
  batchSize: number = 100
): Promise<StorageResult> {
  // Batch insert with error handling
  // Create vector search indexes
  // Store embeddings for semantic search
}
```

**Storage Strategy:**
- **Batch Operations**: Inserts data in batches of 100 for optimal performance
- **Vector Indexes**: Creates MongoDB Atlas Vector Search indexes
- **Error Recovery**: Continues processing even if some cells fail
- **Metadata Preservation**: Stores all cell metadata and features

### **4. Semantic Search & Retrieval**

```typescript
// Enhanced search with semantic normalization
class EnhancedSearch {
  async search(query: string): Promise<SearchResponse> {
    // 1. Normalize query using semantic dictionary
    // 2. Generate query embedding
    // 3. Perform vector similarity search
    // 4. Generate AI analysis with structured data
  }
}
```

**Search Process:**
- **Query Normalization**: Uses business term dictionary for consistent search
- **Vector Similarity**: MongoDB Atlas Vector Search for semantic matching
- **AI Analysis**: Gemini generates structured analysis and insights
- **Structured Results**: Returns both raw data and AI-generated analysis

## 🤖 AI Integration & Usage

### **How AI Was Used in Development**

#### **1. Code Generation & Bootstrapping**
- **Project Structure**: AI helped design the monorepo architecture
- **Component Creation**: Generated initial React components and TypeScript interfaces
- **API Routes**: Created Next.js API routes for upload and search functionality
- **Database Schemas**: Designed MongoDB document structures and indexes

#### **2. Intelligent Parsing Logic**
```typescript
// AI-assisted parsing logic for different data types
private parseNumericValue(value: any): number | null {
  // AI helped design intelligent numeric parsing
  // Handles currency symbols, commas, percentages
  // Converts "15%" to 0.15, "$1,000" to 1000
}
```

#### **3. Semantic Normalization**
```typescript
// AI-generated business term dictionary
private getSemanticDictionary(): Record<string, string[]> {
  return {
    "revenue": ["sales", "income", "earnings", "turnover"],
    "profit": ["net income", "earnings", "bottom line"],
    "cost": ["expense", "expenditure", "outlay"],
    // ... 50+ business terms with variations
  };
}
```

#### **4. UI Component Generation**
- **shadcn/ui Integration**: AI helped structure the component library
- **Responsive Design**: Generated Tailwind CSS classes for mobile-first design
- **Data Visualization**: Created table components and data display logic
- **Interactive Elements**: Built search interfaces and result displays

#### **5. Error Handling & Debugging**
```typescript
// AI-assisted error handling patterns
try {
  const result = await this.llmModel.generateContent(prompt);
  // Process result
} catch (error) {
  // AI helped design comprehensive fallback responses
  return {
    llmResponse: {
      answer: fallbackAnswer,
      confidence: 0.3,
      reasoning: `Technical issue: ${error.message}`
    }
  };
}
```

#### **6. Logging & Monitoring**
- **Structured Logging**: AI helped design comprehensive logging patterns
- **Debug Information**: Created detailed debugging output for development
- **Performance Monitoring**: Added timing and performance metrics
- **Error Tracking**: Implemented error categorization and reporting

## 📊 Data Structures & Formats

### **Enhanced Parsed Cell**
```typescript
interface EnhancedParsedCell {
  _id: string;                    // Unique identifier
  tenantId: string;               // Multi-tenant support
  workbookId: string;             // Workbook reference
  sheetName: string;              // Excel sheet name
  rowName: string | null;         // Row identifier
  colName: string | null;         // Column header
  value: number | string | Date;  // Parsed value
  metric: string;                 // Business metric name
  semanticString: string;         // Embedding context
  dataType: string;               // Data type classification
  embedding: number[];            // 768-dim vector
  features: CellFeatures;         // Business features
  dimensions: Record<string, any>; // Additional metadata
}
```

### **Search Result**
```typescript
interface SearchResult {
  _id: string;
  tenantId: string;
  workbookId: string;
  sheetName: string;
  rowName: string;
  colName: string;
  value: any;
  metric: string;
  dataType: string;
  features: BusinessFeatures;
  dimensions: Record<string, any>;
}
```

### **LLM Response**
```typescript
interface LLMResponse {
  answer: string;                 // Main analysis
  confidence: number;             // Confidence score
  reasoning: string;              // Analysis reasoning
  dataPoints: number;             // Data points analyzed
  sources: string[];              // Key insights
  generatedTable: string;         // Structured data
}
```

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+ 
- MongoDB Atlas account
- Google Gemini API key
- npm or yarn

### **Installation**
```bash
# Clone the repository
git clone <repository-url>
cd superjoin-semantic-search

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your MongoDB and Gemini API keys
```

### **Environment Variables**
```env
MONGO_DB_URL=mongodb+srv://username:password@cluster.mongodb.net/database
GEMINI_API_KEY=your_gemini_api_key_here
```

### **Development**
```bash
# Start development server
npm run dev

# Start UI only
npm run dev:ui

# Build for production
npm run build
```

### **Testing**
```bash
# Test database connection
npm run test-connection

# Test parsing functionality
npm run test-parsing

# Test search functionality
npm run test-search

# Test complete workflow
npm run test-complete-workflow
```

## 🔧 Configuration

### **LLM Configuration**
```typescript
// apps/config/llm-config.ts
export const llmConfig = {
  gemini: {
    model: 'gemini-1.5-flash',
    temperature: 0.3,
    maxTokens: 2000
  },
  mongo: {
    database: 'SpaaS',
    collections: {
      atlascells: 'atlascells',    // Vector search enabled
      atlasCell: 'AtlasCell',      // Fallback collection
      analysis: 'analysis'         // Analysis results
    }
  }
};
```

### **MongoDB Vector Search Setup**
```javascript
// Vector search index configuration
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    }
  ]
}
```

## 📈 Performance Optimizations

### **Async Processing**
- **Batch Embeddings**: Process embeddings in batches of 50
- **Parallel Uploads**: Concurrent file processing
- **Streaming Results**: Real-time search results
- **Caching**: Embedding and search result caching

### **Database Optimizations**
- **Vector Indexes**: Optimized for semantic search
- **Batch Operations**: Bulk inserts and updates
- **Connection Pooling**: Efficient database connections
- **Query Optimization**: Indexed searches and aggregations

## 🎯 Key Features

### **Intelligent Data Parsing**
- ✅ Automatic data type detection
- ✅ Business term normalization
- ✅ Semantic string generation
- ✅ Multi-sheet workbook support

### **Advanced Search**
- ✅ Natural language queries
- ✅ Semantic similarity search
- ✅ Business context understanding
- ✅ Multi-dimensional filtering

### **AI-Powered Analysis**
- ✅ Automated insights generation
- ✅ Structured data analysis
- ✅ Business intelligence reports
- ✅ Trend analysis and forecasting

### **User Experience**
- ✅ Modern, responsive UI
- ✅ Real-time search results
- ✅ Interactive data visualization
- ✅ Mobile-friendly design

## 🔮 Future Enhancements

- **Multi-language Support**: International business terms
- **Advanced Analytics**: Machine learning insights
- **API Integration**: RESTful API for external access
- **Real-time Collaboration**: Multi-user editing
- **Advanced Visualizations**: Charts and graphs
- **Export Capabilities**: PDF and Excel export

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For support and questions, please open an issue in the GitHub repository.

---

**Built with ❤️ using AI-assisted development, modern web technologies, and intelligent data processing.**