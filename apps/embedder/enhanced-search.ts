import { MongoClient, Db, Collection } from "mongodb";
import { embeddingProvider } from "./embedding";
import { enhancedSemanticNormalizer } from "../utils/enhanced-semantic-normalizer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { llmConfig } from "../config/llm-config";

type dbConfig = {
  client: MongoClient;
  db: Db;
  collection: Collection;
};

interface SearchResult {
  _id: string;
  tenantId: string;
  workbookId: string;
  sheetId: string;
  semanticString: string;
  metric: string;
  normalizedMetric: string;
  value: any;
  year?: number;
  quarter?: string;
  month?: string;
  region?: string;
  product?: string;
  customerId?: string;
  customerName?: string;
  department?: string;
  status?: string;
  priority?: string;
  score: number;
}

interface LLMResponse {
  answer: string;
  confidence: number;
  reasoning: string;
  dataPoints: number;
  sources: string[];
}

interface EnhancedQuery {
  originalQuery: string;
  normalizedQuery: string;
  metrics: string[];
  dimensions: string[];
  timeFilters: { year?: number; quarter?: string; month?: string };
  businessContext: string;
}

export class EnhancedSearch {
  private uri: string;
  private client: MongoClient;
  private dbConfig: dbConfig | null = null;
  private llmModel: any;

  constructor() {
    this.uri = llmConfig.mongo.url;
    this.client = new MongoClient(this.uri);
    this.initializeLLM();
  }

  private async initializeLLM() {
    try {
      // Initialize Gemini LLM using configuration
      const geminiConfig = llmConfig.gemini;
      const genAI = new GoogleGenerativeAI(geminiConfig.apiKey);
      const model = genAI.getGenerativeModel({ 
        model: geminiConfig.model,
        generationConfig: {
          temperature: geminiConfig.temperature,
          maxOutputTokens: geminiConfig.maxTokens
        }
      });
      
      if (model) {
        console.log("✅ Gemini LLM model initialized successfully");
        console.log(`📊 Model: ${geminiConfig.model}, Temperature: ${geminiConfig.temperature}`);
        this.llmModel = model;
      } else {
        throw new Error("Failed to get Gemini model instance");
      }
    } catch (error) {
      console.error("❌ Failed to initialize Gemini LLM model:", error);
      this.llmModel = null;
    }
  }

  async connect() {
    const client = await this.client.connect();
    const db = client.db(llmConfig.mongo.database);
    
    // Check which collection has data and supports vector search
    const collections = await db.listCollections().toArray();
    console.log("📋 Available collections:", collections.map(c => `${c.name} (${c.type || 'collection'})`));
    
    let collection;
    let collectionName = llmConfig.mongo.collections.atlascells;
    
    // Priority: atlascells (supports vector search) > AtlasCell > analysis (view)
    try {
      const atlascellsCount = await db.collection(llmConfig.mongo.collections.atlascells).countDocuments();
      if (atlascellsCount > 0) {
        collection = db.collection(llmConfig.mongo.collections.atlascells);
        collectionName = llmConfig.mongo.collections.atlascells;
        console.log(`✅ Using atlascells collection (${atlascellsCount} documents) - SUPPORTS VECTOR SEARCH`);
      } else {
        const atlasCellCount = await db.collection(llmConfig.mongo.collections.atlasCell).countDocuments();
        if (atlasCellCount > 0) {
          collection = db.collection(llmConfig.mongo.collections.atlasCell);
          collectionName = llmConfig.mongo.collections.atlasCell;
          console.log(`✅ Using AtlasCell collection (${atlasCellCount} documents)`);
        } else {
          // Last resort: try analysis view (no vector search support)
          const analysisCount = await db.collection(llmConfig.mongo.collections.analysis).countDocuments();
          if (analysisCount > 0) {
            collection = db.collection(llmConfig.mongo.collections.analysis);
            collectionName = llmConfig.mongo.collections.analysis;
            console.log(`⚠️  Using analysis view (${analysisCount} documents) - NO VECTOR SEARCH SUPPORT`);
          } else {
            // Default to atlascells
            collection = db.collection(llmConfig.mongo.collections.atlascells);
            console.log("⚠️  No data found, using atlascells as default");
          }
        }
      }
    } catch (error) {
      console.error("❌ Error checking collections:", error);
      // Fallback to atlascells
      collection = db.collection(llmConfig.mongo.collections.atlascells);
      collectionName = llmConfig.mongo.collections.atlascells;
      console.log("🔄 Fallback to atlascells collection");
    }

    this.dbConfig = { client, db, collection };
    console.log(`✅ Connected to DB for enhanced search using ${collectionName} collection`);
  }

  /**
   * Strict semantic dictionary-based query normalization
   * No AI - only uses semantic dictionary for exact matching
   */
  private async enhanceQueryNormalization(query: string): Promise<EnhancedQuery> {
    console.log("🔍 Strict semantic dictionary normalization");
    
    // Use only semantic dictionary normalization - no AI
    const queryAnalysis = enhancedSemanticNormalizer.analyzeQuery(query);
    const { metrics, dimensions, timeFilters } = queryAnalysis;
    
    // Build normalized query using semantic dictionary only
    const normalizedQuery = enhancedSemanticNormalizer.createNormalizedQueryString({
      ...queryAnalysis,
      metrics,
      dimensions
    });

    console.log("✅ Semantic dictionary normalization completed");
    console.log(`📝 Original: "${query}"`);
    console.log(`📝 Normalized: "${normalizedQuery}"`);
    console.log(`📊 Metrics: ${metrics.join(', ')}`);
    console.log(`📊 Dimensions: ${dimensions.join(', ')}`);
    console.log(`📅 Time Filters: ${JSON.stringify(timeFilters)}`);

    return {
      originalQuery: query,
      normalizedQuery,
      metrics,
      dimensions,
      timeFilters,
      businessContext: "Semantic dictionary normalization"
    };
  }



  /**
   * Stage 1: Vector Search with proper filtering
   * Performs semantic search using normalized query embeddings with workbookId/tenantId filters
   */
  private async performVectorSearch(
    normalizedQuery: string,
    workbookId: string,
    tenantId: string,
    topK: number = 50
  ): Promise<SearchResult[]> {
    if (!this.dbConfig) {
      throw new Error("Database not connected. Call connect() first.");
    }

    console.log("🔍 Stage 1: Performing vector search with proper filtering");
    console.log(`📝 Normalized query: "${normalizedQuery}"`);
    console.log(`📚 Workbook: ${workbookId}, Tenant: ${tenantId}`);

    // Generate embedding for the normalized query
    const model = await embeddingProvider();
    const queryEmbedding = await model.embedContent(normalizedQuery);
    const embedding = queryEmbedding.embedding.values;

    // Strategy 1: Pure vector search without any pre-filtering (MongoDB Atlas requirement)
    // This ensures $vectorSearch is absolutely the first and only stage initially
    const pureVectorPipeline = [
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: embedding,
          numCandidates: 1000, // Get more candidates to filter from
          limit: topK * 5 // Get more results to filter from
        }
      }
    ];

    console.log("📑 Pure Vector Search Pipeline:", JSON.stringify(pureVectorPipeline, null, 2));

    let rawResults: any[] = [];
    
    try {
      // Try pure vector search first (no filtering)
      console.log("🔍 Attempting pure vector search...");
      rawResults = await this.dbConfig.collection
        .aggregate(pureVectorPipeline)
        .toArray();
      console.log(`✅ Pure vector search successful: ${rawResults.length} results`);
      
      // Now filter the results in memory for workbookId and tenantId
      const filteredResults = rawResults.filter(doc => 
        doc.workbookId === workbookId && doc.tenantId === tenantId
      );
      
      console.log(`🔍 Filtered results: ${filteredResults.length} match workbookId/tenantId criteria`);
      
      // Apply additional processing to filtered results
      const processedResults = filteredResults.slice(0, topK).map((doc: any) => ({
        _id: doc._id,
        tenantId: doc.tenantId,
        workbookId: doc.workbookId,
        sheetId: doc.sheetId,
        semanticString: doc.semanticString,
        metric: doc.metric,
        normalizedMetric: doc.normalizedMetric || doc.metric,
        value: doc.value,
        year: doc.year,
        quarter: doc.quarter,
        month: doc.month,
        region: doc.region,
        product: doc.product,
        customerId: doc.customerId,
        customerName: doc.customerName,
        department: doc.department,
        status: doc.status,
        priority: doc.priority,
        score: doc.score || 0
      }));
      
      rawResults = processedResults;
      
    } catch (vectorError: any) {
      console.log("⚠️  Pure vector search failed, trying alternative approach...");
      console.log("❌ Vector search error:", vectorError.message || vectorError);
      
      // Strategy 2: Try with minimal vector search pipeline
      try {
        console.log("🔄 Attempting minimal vector search...");
        const minimalVectorPipeline = [
          {
            $vectorSearch: {
              index: "vector_index",
              path: "embedding",
              queryVector: embedding,
              numCandidates: 100,
              limit: 50
            }
          }
        ];
        
        rawResults = await this.dbConfig.collection
          .aggregate(minimalVectorPipeline)
          .toArray();
          
        console.log(`✅ Minimal vector search successful: ${rawResults.length} results`);
        
        // Filter in memory
        const filteredResults = rawResults.filter(doc => 
          doc.workbookId === workbookId && doc.tenantId === tenantId
        );
        
        rawResults = filteredResults.slice(0, topK);
        
      } catch (minimalError: any) {
        console.log("⚠️  Minimal vector search also failed, falling back to direct search...");
        console.log("❌ Minimal vector search error:", minimalError.message || minimalError);
        
        // Strategy 3: Fallback to direct search
        const directPipeline = [
          {
            $match: {
              workbookId: workbookId,
              tenantId: tenantId
            }
          },
          {
            $project: {
              _id: 1,
              tenantId: 1,
              workbookId: 1,
              sheetId: 1,
              semanticString: 1,
              metric: 1,
              normalizedMetric: 1,
              value: 1,
              year: 1,
              quarter: 1,
              month: 1,
              region: 1,
              product: 1,
              customerId: 1,
              customerName: 1,
              department: 1,
              status: 1,
              priority: 1,
              score: 1
            }
          },
          { $sort: { year: -1, quarter: 1, month: 1 } },
          { $limit: topK }
        ];

        console.log("📑 Direct Search Pipeline (Strategy 3):", JSON.stringify(directPipeline, null, 2));
        
        rawResults = await this.dbConfig.collection
          .aggregate(directPipeline)
          .toArray();

        console.log(`✅ Direct search returned ${rawResults.length} results`);
      }
    }

    // Transform MongoDB documents to SearchResult interface
    const results: SearchResult[] = rawResults.map((doc: any) => ({
      _id: doc._id,
      tenantId: doc.tenantId,
      workbookId: doc.workbookId,
      sheetId: doc.sheetId,
      semanticString: doc.semanticString,
      metric: doc.metric,
      normalizedMetric: doc.normalizedMetric || doc.metric, // Fallback to metric if normalizedMetric doesn't exist
      value: doc.value,
      year: doc.year,
      quarter: doc.quarter,
      month: doc.month,
      region: doc.region,
      product: doc.product,
      customerId: doc.customerId,
      customerName: doc.customerName,
      department: doc.department,
      status: doc.status,
      priority: doc.priority,
      score: doc.score || 0
    }));

    console.log(`✅ Vector search retrieved ${results.length} results`);
    return results;
  }

  /**
   * Stage 2: Semantic Dictionary-Based Structured Data Retrieval
   * Uses semantic dictionary analysis to retrieve complete structured data
   */
  private async retrieveStructuredDataWithSemantics(
    vectorResults: SearchResult[],
    enhancedQuery: EnhancedQuery,
    filters: any
  ): Promise<SearchResult[]> {
    if (!this.dbConfig) {
      throw new Error("Database not connected. Call connect() first.");
    }

    console.log("📊 Stage 2: Semantic dictionary-based structured data retrieval");

    // Extract unique identifiers from vector search results
    const workbookIds = [...new Set(vectorResults.map(r => r.workbookId))];
    const sheetIds = [...new Set(vectorResults.map(r => r.sheetId))];
    const metrics = [...new Set(vectorResults.map(r => r.metric))]; // Use actual metric field

    console.log("🔍 Semantic-based structured data query with:", {
      workbookIds,
      sheetIds,
      metrics,
      filters,
      extractedMetrics: enhancedQuery.metrics,
      extractedDimensions: enhancedQuery.dimensions
    });

    // Build structured data query based on semantic dictionary analysis
    const structuredPipeline: any[] = [
      {
        $match: {
          workbookId: { $in: workbookIds },
          sheetId: { $in: sheetIds },
          ...(filters.tenantId && { tenantId: filters.tenantId }),
          ...(filters.year && { year: filters.year }),
          ...(filters.quarter && { quarter: filters.quarter }),
          ...(filters.month && { month: filters.month }),
          ...(filters.region && { region: filters.region }),
          ...(filters.product && { product: filters.product }),
          ...(filters.customerId && { customerId: filters.customerId })
        }
      },
      {
        $project: {
          _id: 1,
          tenantId: 1,
          workbookId: 1,
          sheetId: 1,
          semanticString: 1,
          metric: 1,
          normalizedMetric: 1,
          value: 1,
          year: 1,
          quarter: 1,
          month: 1,
          region: 1,
          product: 1,
          customerId: 1,
          customerName: 1,
          department: 1,
          status: 1,
          priority: 1,
          score: 1
        }
      },
      { $sort: { year: -1, quarter: 1, month: 1 } }
    ];

    console.log("📑 Semantic-Based Structured Data Pipeline:", JSON.stringify(structuredPipeline, null, 2));

    const rawResults = await this.dbConfig.collection
      .aggregate(structuredPipeline)
      .toArray();

    // Transform MongoDB documents to SearchResult interface
    const results: SearchResult[] = rawResults.map((doc: any) => ({
      _id: doc._id,
      tenantId: doc.tenantId,
      workbookId: doc.workbookId,
      sheetId: doc.sheetId,
      semanticString: doc.semanticString,
      metric: doc.metric,
      normalizedMetric: doc.normalizedMetric,
      value: doc.value,
      year: doc.year,
      quarter: doc.quarter,
      month: doc.month,
      region: doc.region,
      product: doc.product,
      customerId: doc.customerId,
      customerName: doc.customerName,
      department: doc.department,
      status: doc.status,
      priority: doc.priority,
      score: doc.score || 0
    }));

    console.log(`✅ Retrieved ${results.length} semantic-based structured data points`);
    return results;
  }

  /**
   * Fallback structured data retrieval method
   */
  private async retrieveStructuredDataFallback(
    vectorResults: SearchResult[],
    filters: any
  ): Promise<SearchResult[]> {
    if (!this.dbConfig) {
      throw new Error("Database not connected. Call connect() first.");
    }
    
    console.log("📊 Stage 2: Fallback structured data retrieval");

    // Extract unique identifiers from vector search results
    const workbookIds = [...new Set(vectorResults.map(r => r.workbookId))];
    const sheetIds = [...new Set(vectorResults.map(r => r.sheetId))];
    const metrics = [...new Set(vectorResults.map(r => r.metric))]; // Use actual metric field, not normalizedMetric

    console.log("🔍 Building structured data query with:", {
      workbookIds,
      sheetIds,
      metrics,
      filters
    });

    // Build structured data query - use fields that actually exist in the database
    const structuredPipeline: any[] = [
      {
        $match: {
          workbookId: { $in: workbookIds },
          sheetId: { $in: sheetIds },
          // Remove normalizedMetric filter since it doesn't exist in the database
          ...(filters.tenantId && { tenantId: filters.tenantId }),
          ...(filters.year && { year: filters.year }),
          ...(filters.quarter && { quarter: filters.quarter }),
          ...(filters.month && { month: filters.month }),
          ...(filters.region && { region: filters.region }),
          ...(filters.product && { product: filters.product }),
          ...(filters.customerId && { customerId: filters.customerId })
        }
      },
      {
        $project: {
          _id: 1,
          tenantId: 1,
          workbookId: 1,
          sheetId: 1,
          semanticString: 1,
          metric: 1,
          normalizedMetric: 1,
          value: 1,
          year: 1,
          quarter: 1,
          month: 1,
          region: 1,
          product: 1,
          customerId: 1,
          customerName: 1,
          department: 1,
          status: 1,
          priority: 1,
          score: 1
        }
      },
      { $sort: { year: -1, quarter: 1, month: 1 } }
    ];

    console.log("📑 Structured Data Pipeline:", JSON.stringify(structuredPipeline, null, 2));

    const rawResults = await this.dbConfig.collection
      .aggregate(structuredPipeline)
      .toArray();

    console.log(`🔍 Raw structured data results: ${rawResults.length} documents`);
    if (rawResults.length > 0) {
      console.log("📋 Sample raw document:", JSON.stringify(rawResults[0], null, 2));
    }

    const results: SearchResult[] = rawResults.map((doc: any) => ({
      _id: doc._id,
      tenantId: doc.tenantId,
      workbookId: doc.workbookId,
      sheetId: doc.sheetId,
      semanticString: doc.semanticString,
      metric: doc.metric,
      normalizedMetric: doc.normalizedMetric,
      value: doc.value,
      year: doc.year,
      quarter: doc.quarter,
      month: doc.month,
      region: doc.region,
      product: doc.product,
      customerId: doc.customerId,
      customerName: doc.customerName,
      department: doc.department,
      status: doc.status,
      priority: doc.priority,
      score: doc.score || 0
    }));

    console.log(`✅ Retrieved ${results.length} structured data points (fallback)`);
    return results;
  }

  /**
   * Stage 3: LLM Answer Generation
   * Sends structured data to LLM for intelligent answer generation
   */
  private async generateLLMAnswer(
    enhancedQuery: EnhancedQuery,
    structuredData: SearchResult[],
    originalQuery: string
  ): Promise<LLMResponse> {
    if (!this.llmModel) {
      console.error("❌ Gemini LLM model not initialized");
      return {
        answer: "LLM model not available. Please check configuration.",
        confidence: 0.1,
        reasoning: "Gemini LLM model not initialized",
        dataPoints: structuredData.length,
        sources: []
      };
    }

    console.log("🔍 Gemini LLM Model Status:", {
      hasModel: !!this.llmModel,
      modelType: typeof this.llmModel,
      hasGenerateContent: !!(this.llmModel as any).generateContent
    });

    console.log("🤖 Stage 3: Generating Gemini LLM answer");

    // Prepare context for LLM
    const contextData = this.prepareLLMContext(structuredData);
    
    const prompt = this.buildLLMPrompt(enhancedQuery, contextData, originalQuery);

    try {
      // Use Gemini's generateContent method
      const result = await this.llmModel.generateContent(prompt);
      const text = result.response.text() || 'No response generated';

      console.log("✅ Gemini LLM response generated successfully");

      // Parse LLM response
      return this.parseLLMResponse(text, structuredData.length);
    } catch (error) {
      console.error("❌ Gemini LLM generation failed:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return {
        answer: "I'm unable to generate a complete answer at the moment. Please try rephrasing your question.",
        confidence: 0.3,
        reasoning: `Gemini LLM generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        dataPoints: structuredData.length,
        sources: []
      };
    }
  }

  private prepareLLMContext(data: SearchResult[]): string {
    if (!data || data.length === 0) {
      return "No structured data available for analysis.";
    }

    console.log("🧠 Preparing LLM context with data:", data.length, "items");
    
    // Group data by semantic string and metric for better context
    const groupedData = new Map<string, any[]>();
    
    data.forEach(item => {
      // Use semanticString if available, otherwise fall back to metric
      const semanticKey = item.semanticString || item.metric || 'unknown';
      const key = `${semanticKey}_${item.year || 'unknown'}_${item.quarter || 'unknown'}`;
      
      if (!groupedData.has(key)) {
        groupedData.set(key, []);
      }
      groupedData.get(key)!.push(item);
    });

    let context = `Available data points (${data.length} total):\n`;
    groupedData.forEach((items, key) => {
      const [semanticKey, year, quarter] = key.split('_');
      const values = items.map(item => ({
        value: item.value,
        region: item.region,
        product: item.product,
        customer: item.customerName,
        month: item.month,
        sheetId: item.sheetId
      }));
      
      context += `\n📊 ${semanticKey} (${year} ${quarter}):\n`;
      values.forEach(v => {
        context += `  - Value: ${v.value}`;
        if (v.region) context += ` | Region: ${v.region}`;
        if (v.product) context += ` | Product: ${v.product}`;
        if (v.customer) context += ` | Customer: ${v.customer}`;
        if (v.month) context += ` | Month: ${v.month}`;
        if (v.sheetId) context += ` | Sheet: ${v.sheetId}`;
        context += '\n';
      });
    });

    console.log("✅ LLM context prepared with", groupedData.size, "grouped data points");
    return context;
  }

  private buildLLMPrompt(enhancedQuery: EnhancedQuery, contextData: string, originalQuery: string): string {
    return `You are a financial data analyst assistant. You have access to structured financial data and need to provide accurate, insightful answers based on the available data.

ORIGINAL USER QUERY: "${originalQuery}"
SEMANTIC NORMALIZATION: "${enhancedQuery.normalizedQuery}"
EXTRACTED METRICS: ${enhancedQuery.metrics.join(', ') || 'None detected'}
EXTRACTED DIMENSIONS: ${enhancedQuery.dimensions.join(', ') || 'None detected'}
TIME FILTERS: ${JSON.stringify(enhancedQuery.timeFilters)}

${contextData}

INSTRUCTIONS:
1. Analyze the available data to answer the user's question
2. Provide specific numbers and insights when possible
3. If the data is insufficient, clearly state what's missing
4. Use business-friendly language
5. Include relevant context about time periods, regions, or other dimensions
6. If calculations are needed, show your reasoning
7. Reference specific data points and values from the context
8. If you see patterns in the data, highlight them

Please provide your answer in the following format:
ANSWER: [Your detailed answer here]
CONFIDENCE: [High/Medium/Low based on data completeness]
REASONING: [Brief explanation of how you arrived at the answer]
DATA_POINTS_USED: [Number of relevant data points]
KEY_INSIGHTS: [2-3 key takeaways from the data]`;
  }

  private parseLLMResponse(response: string, dataPointCount: number): LLMResponse {
    try {
      // Extract structured parts from LLM response
      const answerMatch = response.match(/ANSWER:\s*(.+?)(?=\n|$)/i);
      const confidenceMatch = response.match(/CONFIDENCE:\s*(.+?)(?=\n|$)/i);
      const reasoningMatch = response.match(/REASONING:\s*(.+?)(?=\n|$)/i);
      const insightsMatch = response.match(/KEY_INSIGHTS:\s*(.+?)(?=\n|$)/i);

      const confidence = confidenceMatch ? 
        (confidenceMatch[1].toLowerCase().includes('high') ? 0.9 :
         confidenceMatch[1].toLowerCase().includes('medium') ? 0.6 : 0.3) : 0.5;

      return {
        answer: answerMatch ? answerMatch[1].trim() : response.trim(),
        confidence,
        reasoning: reasoningMatch ? reasoningMatch[1].trim() : "Analysis based on available data",
        dataPoints: dataPointCount,
        sources: insightsMatch ? [insightsMatch[1].trim()] : []
      };
    } catch (error) {
      return {
        answer: response.trim(),
        confidence: 0.5,
        reasoning: "Response parsing failed, returning raw LLM output",
        dataPoints: dataPointCount,
        sources: []
      };
    }
  }

  /**
   * Main enhanced search function implementing the improved three-stage pipeline
   */
  async semanticSearch({
    tenantId,
    workbookId,
    query,
    topK = 50
  }: {
    tenantId: string;
    workbookId: string;
    query: string;
    topK?: number;
  }): Promise<{
    query: string;
    enhancedQuery: EnhancedQuery;
    vectorResults: SearchResult[];
    structuredData: SearchResult[];
    llmResponse: LLMResponse;
    searchMetadata: {
      queryEnhancementTime: number;
      vectorSearchTime: number;
      structuredDataTime: number;
      llmGenerationTime: number;
      totalTime: number;
    };
  }> {
    if (!this.dbConfig) {
      throw new Error("Database not connected. Call connect() first.");
    }

    console.log("🚀 Starting improved enhanced semantic search pipeline");
    console.log(`🔍 Query: "${query}"`);

    const startTime = Date.now();

    // 1️⃣ Enhanced Query Normalization with Semantic Dictionary
    const queryEnhancementStart = Date.now();
    const enhancedQuery = await this.enhanceQueryNormalization(query);
    const queryEnhancementTime = Date.now() - queryEnhancementStart;

    // 2️⃣ Stage 1: Vector Search with proper filtering
    const vectorStartTime = Date.now();
    const vectorResults = await this.performVectorSearch(
      enhancedQuery.normalizedQuery,
      workbookId,
      tenantId,
      topK
    );
    const vectorSearchTime = Date.now() - vectorStartTime;

    // 3️⃣ Stage 2: Semantic Dictionary-Based Structured Data Retrieval
    const structuredStartTime = Date.now();
    const structuredData = await this.retrieveStructuredDataWithSemantics(
      vectorResults,
      enhancedQuery,
      { tenantId, workbookId }
    );
    const structuredDataTime = Date.now() - structuredStartTime;

    // 4️⃣ Stage 3: LLM Answer Generation
    const llmStartTime = Date.now();
    const llmResponse = await this.generateLLMAnswer(
      enhancedQuery,
      structuredData,
      query
    );
    const llmGenerationTime = Date.now() - llmStartTime;

    const totalTime = Date.now() - startTime;

    console.log("✅ Improved enhanced search pipeline completed");
    console.log(`⏱️  Total time: ${totalTime}ms`);
    console.log(`📊 Results: ${structuredData.length} data points, ${vectorResults.length} vector matches`);

    return {
      query,
      enhancedQuery,
      vectorResults,
      structuredData,
      llmResponse,
      searchMetadata: {
        queryEnhancementTime,
        vectorSearchTime,
        structuredDataTime,
        llmGenerationTime,
        totalTime
      }
    };
  }

  async disconnect() {
    if (this.dbConfig) {
      await this.dbConfig.client.close();
      this.dbConfig = null;
      console.log("🔌 Disconnected from DB");
    }
  }

  // Database exploration and testing methods
  async exploreDatabase() {
    if (!this.dbConfig) {
      throw new Error("Database not connected. Call connect() first.");
    }

    console.log("🔍 Exploring database content...");
    
    try {
      const totalDocs = await this.dbConfig.collection.countDocuments();
      console.log(`📊 Total documents in collection: ${totalDocs}`);

      if (totalDocs > 0) {
        const sampleDocs = await this.dbConfig.collection.find().limit(3).toArray();
        console.log("📋 Sample documents:");
        sampleDocs.forEach((doc, index) => {
          console.log(`  Doc ${index + 1}:`, {
            tenantId: doc.tenantId,
            workbookId: doc.workbookId,
            metric: doc.metric,
            normalizedMetric: doc.normalizedMetric,
            year: doc.year,
            quarter: doc.quarter,
            region: doc.region,
            hasEmbedding: !!doc.embedding
          });
        });
      }

      return { totalDocs, hasData: totalDocs > 0 };
    } catch (error) {
      console.error("❌ Error exploring database:", error);
      throw error;
    }
  }

  async findAvailableCombinations() {
    if (!this.dbConfig) {
      throw new Error("Database not connected. Call connect() first.");
    }

    console.log("🔍 Finding available tenant/workbook combinations...");
    
    try {
      const pipeline = [
        {
          $group: {
            _id: { tenantId: "$tenantId", workbookId: "$workbookId" },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            tenantId: "$_id.tenantId",
            workbookId: "$_id.workbookId",
            count: 1,
            _id: 0
          }
        },
        { $sort: { count: -1 } }
      ];

      const rawResults = await this.dbConfig.collection.aggregate(pipeline).toArray();
      const results = rawResults.map((doc: any) => ({
        tenantId: doc.tenantId,
        workbookId: doc.workbookId,
        count: doc.count
      }));

      console.log(`✅ Found ${results.length} combinations:`);
      results.forEach((combo, index) => {
        console.log(`  ${index + 1}. ${combo.tenantId}/${combo.workbookId}: ${combo.count} docs`);
      });

      return results;
    } catch (error) {
      console.error("❌ Error finding combinations:", error);
      throw error;
    }
  }

  async testWithAvailableData() {
    if (!this.dbConfig) {
      throw new Error("Database not connected. Call connect() first.");
    }

    console.log("🧪 Testing search with available data...");
    
    try {
      const combinations = await this.findAvailableCombinations();
      
      if (combinations.length === 0) {
        console.log("⚠️  No data combinations found to test with");
        return;
      }

      // Test with the first available combination
      const testCombo = combinations[0];
      console.log(`\n🔍 Testing with: ${testCombo.tenantId}/${testCombo.workbookId}`);

      const testQueries = [
        "revenue performance",
        "profit analysis",
        "sales by region"
      ];

      for (const query of testQueries) {
        console.log(`\n📝 Testing query: "${query}"`);
        try {
          const results = await this.semanticSearch({
            tenantId: testCombo.tenantId,
            workbookId: testCombo.workbookId,
            query,
            topK: 5
          });
          
          console.log(`✅ Query successful: ${results.structuredData.length} data points found`);
          console.log(`📊 LLM Answer: ${results.llmResponse.answer}`);
        } catch (error) {
          console.error(`❌ Query failed: ${error}`);
        }
      }
    } catch (error) {
      console.error("❌ Error testing with available data:", error);
      throw error;
    }
  }

  async run() {
    await this.connect();

    const results = await this.semanticSearch({
      tenantId: "tenant1234",
      workbookId: "wb_abc123",
      query: "What was the average bottom line performance in 2021?",
      topK: 25
    });

    console.log("📊 Enhanced Search Results:");
    console.log("Query:", results.query);
    console.log("Enhanced Query:", results.enhancedQuery.normalizedQuery);
    console.log("Normalization Method:", results.enhancedQuery.businessContext);
    console.log("LLM Answer:", results.llmResponse.answer);
    console.log("Confidence:", results.llmResponse.confidence);
    console.log("Data Points Used:", results.llmResponse.dataPoints);
    console.log("Search Metadata:", results.searchMetadata);

    await this.disconnect();
  }
}
