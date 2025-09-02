# 🧠 Semantic Search Dashboard

A comprehensive AI-powered semantic search system for financial data analysis, built with Next.js, MongoDB Atlas Vector Search, and DeepSeek AI.

## 🏗️ Project Structure

```
superjoin-semantic-search/
├── apps/
│   └── ui/                    # Next.js UI application
│       ├── src/
│       │   ├── app/          # App router pages
│       │   ├── components/   # UI components
│       │   └── lib/          # Utilities
│       └── package.json
├── embedder/                  # Backend search engine
│   ├── enhanced-search.ts     # Main search class
│   └── embedding.ts           # Embedding provider
├── utils/                     # Utility functions
│   └── enhanced-semantic-normalizer.ts
├── config/                    # Configuration files
│   └── semantic-dictionary.json
├── tests/                     # Test scripts
└── package.json               # Root workspace config
```

## 🚀 Features

### 🔍 **Semantic Search Engine**
- **Vector Search**: MongoDB Atlas Vector Search integration
- **Semantic Normalization**: Advanced query processing using semantic dictionary
- **Hybrid Search**: Combines vector similarity with structured filtering
- **Fallback Mechanisms**: Robust error handling and alternative search strategies

### 🎨 **Modern UI Dashboard**
- **Responsive Design**: Built with Tailwind CSS and shadcn/ui
- **Tabbed Interface**: Search, Chat, Results, AI Insights, and Analytics
- **Real-time Chat**: Conversational AI interface for natural language queries
- **Data Visualization**: Rich tables and analytics displays

### 🤖 **AI Integration**
- **DeepSeek LLM**: Advanced language model for intelligent responses
- **Context-Aware**: Analyzes structured data to provide insights
- **Confidence Scoring**: Transparent AI reasoning and confidence levels

## 🛠️ Technology Stack

### **Frontend**
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Beautiful, accessible UI components
- **Lucide React** - Modern icon library

### **Backend**
- **MongoDB Atlas** - Cloud database with vector search
- **Node.js** - JavaScript runtime
- **OpenAI SDK** - DeepSeek API integration
- **MongoDB Driver** - Database connectivity

### **AI & ML**
- **Vector Embeddings** - Semantic similarity search
- **Semantic Dictionary** - Domain-specific normalization
- **LLM Integration** - DeepSeek for intelligent analysis

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- MongoDB Atlas account
- DeepSeek API key

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd superjoin-semantic-search
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd apps/ui && npm install
   cd ../..
   ```

3. **Environment Configuration**
   Create `.env.local` in the root directory:
   ```env
   MONGO_DB_URL=your_mongodb_atlas_connection_string
   DEEPSEEK_API_KEY=your_deepseek_api_key
   ```

4. **Start Development**
   ```bash
   # Start UI only
   npm run dev:ui
   
   # Start backend testing
   npm run dev:backend
   
   # Start both (if configured)
   npm run dev
   ```

## 🎯 Usage

### **Semantic Search**
1. Navigate to the **Search** tab
2. Select your tenant and workbook
3. Enter natural language queries like:
   - "What was the revenue in Q1 2023?"
   - "Show me profit margins by region"
   - "How did sales grow compared to last year?"

### **AI Chat Interface**
1. Go to the **Chat** tab
2. Ask questions in natural language
3. Get intelligent responses with confidence scores
4. View data points used in analysis

### **Results & Insights**
- **Results Tab**: View structured data in organized tables
- **AI Insights**: See AI-generated analysis and reasoning
- **Analytics**: Monitor search performance and usage metrics

## 🔧 Development

### **Adding New Components**
```bash
cd apps/ui
npx shadcn@latest add [component-name]
```

### **Running Tests**
```bash
# Test semantic normalization
npm run test-normalization

# Test enhanced search
npm run test-enhanced-search

# Explore database
npm run explore-and-test
```

### **Building for Production**
```bash
npm run build:ui
```

## 📊 API Endpoints

### **POST /api/search**
Search for financial data using semantic queries.

**Request Body:**
```json
{
  "query": "revenue performance by region",
  "tenantId": "tenant_test_enhanced",
  "workbookId": "Company Financial Model MultiYear",
  "topK": 50
}
```

**Response:**
```json
{
  "query": "revenue performance by region",
  "enhancedQuery": { ... },
  "vectorResults": [ ... ],
  "structuredData": [ ... ],
  "llmResponse": { ... },
  "searchMetadata": { ... }
}
```

## 🎨 UI Components

### **Core Components**
- **Search Interface**: Advanced query input with examples
- **Chat Interface**: Conversational AI assistant
- **Data Tables**: Rich data visualization
- **Analytics Dashboard**: Performance metrics and insights

### **Design System**
- **New York Theme**: Clean, professional aesthetic
- **Responsive Layout**: Mobile-first design approach
- **Accessibility**: WCAG compliant components
- **Dark Mode Ready**: Theme switching capability

## 🔍 Search Pipeline

1. **Query Normalization**: Convert natural language to semantic format
2. **Vector Search**: Find similar embeddings in MongoDB Atlas
3. **Structured Retrieval**: Get complete data context
4. **AI Analysis**: Generate intelligent insights using DeepSeek
5. **Response Formatting**: Present results in user-friendly format

## 🚧 Roadmap

### **Phase 1** ✅
- [x] Core semantic search engine
- [x] MongoDB Atlas integration
- [x] Basic UI dashboard
- [x] DeepSeek LLM integration

### **Phase 2** 🚧
- [ ] Real-time data streaming
- [ ] Advanced analytics charts
- [ ] User authentication
- [ ] Query history and favorites

### **Phase 3** 📋
- [ ] Multi-tenant support
- [ ] API rate limiting
- [ ] Advanced caching
- [ ] Performance monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the test examples

---

**Built with ❤️ using Next.js, MongoDB Atlas, and DeepSeek AI**
