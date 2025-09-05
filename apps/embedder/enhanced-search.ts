import { MongoClient, Db, Collection } from "mongodb";
import { embeddingService } from "./embedding";
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
  sheetName: string;
  rowName: string;
  colName: string;
  rowIndex: number;
  colIndex: number;
  cellAddress: string;
  dataType: string;
  unit: string;
  features: {
    isPercentage: boolean;
    isMargin: boolean;
    isGrowth: boolean;
    isAggregation: boolean;
    isForecast: boolean;
    isUniqueIdentifier: boolean;
  };
  sourceCell: string,
  sourceFormula: string,
  metric: string;
  value: any;
  year?: number;
  month?: string;
  quarter?: string;
  dimensions: Record<string, any>;
}

interface LLMResponse {
  answer: string;
  confidence: number;
  reasoning: string;
  dataPoints: number;
  sources: string[];
  generatedTable: string;
}

interface EnhancedQuery {
  originalQuery: string;
  normalizedQuery: string;
  dimensions: string[];
  timeFilters: { year?: number; month?: string; quarter?: string; period?: string };
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

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
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
   * Initialize the Gemini LLM model
   */
  private async initializeLLM(): Promise<void> {
    try {
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

  /**
   * No query normalization - use original query as-is
   */
  private async enhanceQueryNormalization(query: string): Promise<EnhancedQuery> {
    console.log("🔍 No query normalization - using original query");
    
    const normalizedQuery = query;
    const dimensions = this.extractDimensions(query);
    const timeFilters = this.extractTimeFilters(query);

    console.log("✅ Query processing completed (no normalization)");
    console.log(`📝 Original query: "${query}"`);
    console.log(`📝 Query used for search: "${normalizedQuery}"`);
    console.log(`📊 Dimensions: ${dimensions.join(', ')}`);
    console.log(`📅 Time Filters: ${JSON.stringify(timeFilters, null, 2)}`);
    if (timeFilters.year) console.log(`📅 Year: ${timeFilters.year}`);
    if (timeFilters.month) console.log(`📅 Month: ${timeFilters.month}`);
    if (timeFilters.quarter) console.log(`📅 Quarter: ${timeFilters.quarter}`);
    if (timeFilters.period) console.log(`📅 Period: ${timeFilters.period}`);

    return {
      originalQuery: query,
      normalizedQuery,
      dimensions,
      timeFilters,
      businessContext: "No query normalization - original query preserved"
    };
  }

  /**
   * Extract metrics from query (simple pattern matching)
   */
  private extractMetrics(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    const metrics: string[] = [];
    
    if (lowerQuery.includes('revenue') || lowerQuery.includes('sales')) metrics.push('revenue');
    if (lowerQuery.includes('profit') || lowerQuery.includes('margin')) metrics.push('profit');
    if (lowerQuery.includes('cost') || lowerQuery.includes('expense')) metrics.push('cost');
    if (lowerQuery.includes('growth') || lowerQuery.includes('yoy')) metrics.push('growth');
    
    return metrics;
  }

  /**
   * Extract dimensions from query (simple pattern matching)
   */
  private extractDimensions(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    const dimensions: string[] = [];
    
    if (lowerQuery.includes('region') || lowerQuery.includes('location')) dimensions.push('region');
    if (lowerQuery.includes('product') || lowerQuery.includes('item')) dimensions.push('product');
    if (lowerQuery.includes('customer') || lowerQuery.includes('client')) dimensions.push('customer');
    if (lowerQuery.includes('department') || lowerQuery.includes('division')) dimensions.push('department');
    
    return dimensions;
  }

  /**
   * Extract time filters from query with comprehensive date pattern matching
   */
  private extractTimeFilters(query: string): { year?: number; month?: string; quarter?: string; period?: string } {
    const lowerQuery = query.toLowerCase();
    const timeFilters: { year?: number; month?: string; quarter?: string; period?: string } = {};
    
    // Extract year patterns
    const yearPatterns = [
      /\b(20\d{2})\b/,
      /\b(19\d{2})\b/,
      /\b(2\d{3})\b/,
      /\b(1\d{3})\b/,
      /\b(\d{2})['s]?\b/
    ];
    
    for (const pattern of yearPatterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        let year = parseInt(match[1]);
        if (year < 100) {
          year = year >= 50 ? 1900 + year : 2000 + year;
        }
        timeFilters.year = year;
        break;
      }
    }
    
    // Extract month patterns
    const monthPatterns = [
      /\b(january|jan)\b/i,
      /\b(february|feb)\b/i,
      /\b(march|mar)\b/i,
      /\b(april|apr)\b/i,
      /\b(may)\b/i,
      /\b(june|jun)\b/i,
      /\b(july|jul)\b/i,
      /\b(august|aug)\b/i,
      /\b(september|sept?)\b/i,
      /\b(october|oct)\b/i,
      /\b(november|nov)\b/i,
      /\b(december|dec)\b/i
    ];
    
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                        'july', 'august', 'september', 'october', 'november', 'december'];
    
    for (let i = 0; i < monthPatterns.length; i++) {
      const match = lowerQuery.match(monthPatterns[i]);
      if (match) {
        timeFilters.month = monthNames[i];
        break;
      }
    }
    
    // Extract quarter patterns
    const quarterPatterns = [
      /\b(q[1-4])\b/i,
      /\b(quarter\s*[1-4])\b/i,
      /\b(first|second|third|fourth)\s*quarter\b/i,
      /\b(1st|2nd|3rd|4th)\s*quarter\b/i
    ];
    
    for (const pattern of quarterPatterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        if (match[1].toLowerCase().startsWith('q')) {
          timeFilters.quarter = match[1].toUpperCase();
        } else if (match[1].toLowerCase().includes('1') || match[1].toLowerCase().includes('first')) {
          timeFilters.quarter = 'Q1';
        } else if (match[1].toLowerCase().includes('2') || match[1].toLowerCase().includes('second')) {
          timeFilters.quarter = 'Q2';
        } else if (match[1].toLowerCase().includes('3') || match[1].toLowerCase().includes('third')) {
          timeFilters.quarter = 'Q3';
        } else if (match[1].toLowerCase().includes('4') || match[1].toLowerCase().includes('fourth')) {
          timeFilters.quarter = 'Q4';
        }
        break;
      }
    }
    
    // Extract time period patterns
    const periodPatterns = [
      /\b(this\s*(year|month|quarter|week))\b/i,
      /\b(last\s*(year|month|quarter|week))\b/i,
      /\b(previous\s*(year|month|quarter|week))\b/i,
      /\b(current\s*(year|month|quarter|week))\b/i,
      /\b(ytd|year\s*to\s*date)\b/i,
      /\b(mtd|month\s*to\s*date)\b/i,
      /\b(qtd|quarter\s*to\s*date)\b/i,
      /\b(annual|yearly)\b/i,
      /\b(monthly)\b/i,
      /\b(quarterly)\b/i,
      /\b(weekly)\b/i,
      /\b(daily)\b/i
    ];
    
    for (const pattern of periodPatterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        timeFilters.period = match[1].toLowerCase();
        break;
      }
    }
    
    // Extract fiscal year patterns
    const fiscalPatterns = [
      /\b(fy\s*(\d{2,4}))\b/i,
      /\b(fiscal\s*(year|yr)\s*(\d{2,4}))\b/i,
      /\b(fy\s*(\d{2})\s*-\s*(\d{2}))\b/i
    ];
    
    for (const pattern of fiscalPatterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        if (match[2] && match[3]) {
          let startYear = parseInt(match[2]);
          if (startYear < 100) startYear = 2000 + startYear;
          timeFilters.year = startYear;
          timeFilters.period = 'fiscal_year';
        } else if (match[2]) {
          let year = parseInt(match[2]);
          if (year < 100) year = 2000 + year;
          timeFilters.year = year;
          timeFilters.period = 'fiscal_year';
        }
        break;
      }
    }
    
    // Extract relative time patterns
    const relativePatterns = [
      /\b(past\s*(\d+)\s*(year|month|quarter|week)s?)\b/i,
      /\b(last\s*(\d+)\s*(year|month|quarter|week)s?)\b/i,
      /\b(previous\s*(\d+)\s*(year|month|quarter|week)s?)\b/i,
      /\b(recent\s*(\d+)\s*(year|month|quarter|week)s?)\b/i
    ];
    
    for (const pattern of relativePatterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        const count = parseInt(match[2]);
        const unit = match[3].toLowerCase();
        timeFilters.period = `last_${count}_${unit}s`;
        break;
      }
    }
    
    return timeFilters;
  }

  /**
   * Stage 1: Vector Search with proper filtering
   */
  private async performVectorSearch(
    normalizedQuery: string,
    workbookId: string,
    tenantId: string,
    topK: number = 1000
  ): Promise<SearchResult[]> {
    if (!this.dbConfig) {
      throw new Error("Database not connected. Call connect() first.");
    }

    console.log("🔍 Stage 1: Performing vector search with proper filtering");
    console.log(`📝 Normalized query: "${normalizedQuery}"`);
    console.log(`📚 Workbook: ${workbookId}, Tenant: ${tenantId}`);

    const queryEmbeddingRequest = [{
      cellId: 'query',
      semanticString: normalizedQuery
    }];
    const queryEmbeddings = await embeddingService.makeEmbeddingsOptimized(queryEmbeddingRequest);
    const embedding = queryEmbeddings[0]?.embedding || new Array(768).fill(0);

    const pureVectorPipeline = [
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: embedding,
          numCandidates: 1000,
          limit: topK * 5
        }
      }
    ];

    console.log("Pure Vector Search Pipeline:", JSON.stringify(pureVectorPipeline, null, 2));

    let rawResults: any[] = [];
    
    try {
      console.log("🔍 Attempting pure vector search...");
      rawResults = await this.dbConfig.collection
        .aggregate(pureVectorPipeline)
        .toArray();
      console.log(`✅ Pure vector search successful: ${rawResults.length} results`);
      
      const processedResults = rawResults.map((doc: any) => ({
        _id: doc._id,
        tenantId: doc.tenantId,
        workbookId: doc.workbookId,
        sheetId: doc.sheetId,
        sheetName: doc.sheetName || 'Unknown',
        rowName: doc.rowName,
        colName: doc.colName,
        rowIndex: doc.rowIndex,
        colIndex: doc.colIndex,
        cellAddress: doc.cellAddress,
        dataType: doc.dataType,
        unit: doc.unit,
        features: doc.features,
        sourceCell: doc.sourceCell,
        sourceFormula: doc.sourceFormula,
        metric: doc.metric,
        value: doc.value,
        year: doc.year,
        month: doc.month,
        quarter: doc.quarter,
        dimensions: doc.dimensions || {}
      })).filter((doc: any) => doc.workbookId === workbookId && doc.tenantId === tenantId);
      
      rawResults = processedResults;
      
    } catch (vectorError: any) {
      console.log("⚠️  Pure vector search failed, trying alternative approach...");
      console.log("❌ Vector search error:", vectorError.message || vectorError);
      
      let normalSearchResults: any[] = [];
      const directPipeline = [
        {
          $match: {
            tenantId: tenantId
          }
        },
        {
          $project: {
            _id: 1,
            tenantId: 1,
            workbookId: 1,
            sheetId: 1,
            sheetName: 1,
            semanticString: 1,
            metric: 1,
            value: 1,
            year: 1,
            month: 1,
            dimensions: 1,
            score: 1
          }
        },
        { $sort: { year: -1, month: 1 } },
        { $limit: topK }
      ];

      console.log("📑 Direct Search Pipeline (Strategy 3):", JSON.stringify(directPipeline, null, 2));
      
      normalSearchResults = await this.dbConfig.collection
        .aggregate(directPipeline)
        .toArray();

      console.log(`✅ Direct search returned ${normalSearchResults.length} results`);
    }

    console.log(`✅ Vector search retrieved ${rawResults.length} results`);
    return rawResults;
  }

  /**
   * Stage 2: Semantic Dictionary-Based Structured Data Retrieval
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

    const workbookIds = Array.from(new Set(vectorResults.map(r => r.workbookId)));
    const sheetIds = Array.from(new Set(vectorResults.map(r => r.sheetId)));
    const metrics = Array.from(new Set(vectorResults.map(r => r.metric)));
    console.log("🔍 Semantic-based structured data query with:", {
      workbookIds,
      sheetIds,
      metrics,
      filters,
      extractedDimensions: enhancedQuery.dimensions
    });

    const structuredPipeline: any[] = [
      {
        $match: {
          workbookId: { $in: workbookIds },
          sheetId: { $in: sheetIds },
          ...(filters.tenantId && { tenantId: filters.tenantId }),
          ...(filters.year && { year: filters.year }),
          ...(filters.month && { month: filters.month }),
          ...(filters.quarter && { quarter: filters.quarter })
        }
      },
      {
        $project: {
          _id: 1,
          tenantId: 1,
          workbookId: 1,
          sheetId: 1,
          sheetName: 1,
          semanticString: 1,
          rowName: 1,
          colName: 1,
          rowIndex: 1,
          colIndex: 1,
          cellAddress: 1,
          rawValue: 1,
          value: 1,
          dataType: 1,
          unit: 1,
          features: 1,
          sourceCell: 1,
          sourceFormula: 1
        }
      },
      { $sort: { year: -1, month: 1 } }
    ];

    console.log("📑 Semantic-Based Structured Data Pipeline:", JSON.stringify(structuredPipeline, null, 2));

    const rawResults = await this.dbConfig.collection
      .aggregate(structuredPipeline)
      .toArray();

    const results: SearchResult[] = rawResults.map((doc: any) => ({
      _id: doc._id,
      tenantId: doc.tenantId,
      workbookId: doc.workbookId,
      sheetId: doc.sheetId,
      sheetName: doc.sheetName || 'Unknown',
      rowName: doc.rowName,
      colName: doc.colName,
      rowIndex: doc.rowIndex,
      colIndex: doc.colIndex,
      cellAddress: doc.cellAddress,
      dataType: doc.dataType,
      unit: doc.unit,
      features: doc.features,
      sourceCell: doc.sourceCell,
      sourceFormula: doc.sourceFormula,
      metric: doc.metric,
      value: doc.value,
      year: doc.year,
      month: doc.month,
      quarter: doc.quarter,
      dimensions: doc.dimensions || {},
    }));

    console.log(`✅ Retrieved ${results.length} semantic-based structured data points`);
    return results;
  }

  /**
   * Stage 3: LLM Answer Generation
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
        sources: [],
        generatedTable: ""
      };
    }

    console.log("🔍 Gemini LLM Model Status:", {
      hasModel: !!this.llmModel,
      modelType: typeof this.llmModel,
      hasGenerateContent: !!(this.llmModel as any).generateContent
    });

    console.log("🤖 Stage 3: Generating Gemini LLM answer");

    const contextData = this.prepareLLMContext(structuredData);
    const prompt = this.buildLLMPrompt(enhancedQuery, contextData, originalQuery);

    try {
      const result = await this.llmModel.generateContent(prompt);
      console.log("🔍 Gemini LLM response:", result.response.text());
      const text = result.response.text() || 'No response generated';

      console.log("✅ Gemini LLM response generated successfully");

      const parsedResponse = this.parseLLMResponse(text, structuredData.length);
      return parsedResponse.llmResponse;
    } catch (error) {
      console.error("❌ Gemini LLM generation failed:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return {
        answer: "I'm unable to generate a complete answer at the moment. Please try rephrasing your question.",
        confidence: 0.3,
        reasoning: `Gemini LLM generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        dataPoints: structuredData.length,
        sources: [],
        generatedTable: ""
      };
    }
  }

  /**
   * Prepare LLM context from structured data
   */
  private prepareLLMContext(data: SearchResult[]): { context: string } {
    if (!data || data.length === 0) {
      return {
        context: "No structured data available for analysis.",
      };
    }

    console.log("🧠 Preparing LLM context with data:", data.length, "items");
    
    const groupedData: Map<string, {
      workbookId: string;
      sheetName: string;
      rowName: string;
      colName: string;
      year?: string;
      month?: string;
      quarter?: string;
      value: string;
      features: any;
      dimensions: any;
      dataType: string;
      unit: string;
    }[]> = new Map();
    
    data.forEach((item) => {
      const key = `${item.sheetName}_${item.metric}`;
      
      const groupedItem: {
        workbookId: string;
        sheetName: string;
        rowName: string;
        colName: string;
        year?: string;
        month?: string;
        quarter?: string;
        value: string;
        features: any;
        dimensions: any;
        dataType: string;
        unit: string;
      } = {
        workbookId: item.workbookId,
        sheetName: item.sheetName || 'Unknown',
        rowName: item.rowName || 'Unknown',
        colName: item.colName || 'Unknown',
        value: String(item.value || 'N/A'),
        features: item.features || {},
        dimensions: item.dimensions || {},
        dataType: item.dataType || 'unknown',
        unit: item.unit || 'N/A'
      };
      
      if (item.dataType === "date") {
        if (item.year) groupedItem.year = String(item.year);
        if (item.month) groupedItem.month = item.month;
        if (item.quarter) groupedItem.quarter = item.quarter;
      }
      
      if (!groupedData.has(key)) {
        groupedData.set(key, []);
      }
      groupedData.get(key)!.push(groupedItem);
    });

    const contextData = {
      totalDataPoints: data.length,
      groupedData: groupedData.values()
    };

    const context = JSON.stringify(contextData, null, 2);

    console.log("✅ LLM context prepared with", groupedData.size, "grouped data points");
    return { context };
  }

  /**
   * Build LLM prompt with context and instructions
   */
  private buildLLMPrompt(enhancedQuery: EnhancedQuery, contextData: any, originalQuery: string): string {
    return `You are a financial data analyst assistant. You have access to structured financial data and need to provide accurate, insightful answers based on the available data.

ORIGINAL USER QUERY: "${originalQuery}"

CONTEXT DATA:
${contextData.context}

INSTRUCTIONS:
1. Understand the query thoroughly and analyze the context data provided
2. If additional data is needed, inform the user about it and continue with generating the result
3. Based on the query type, provide appropriate analysis:
   - If the result is to list out, list the results according to the context data
   - If the result is to calculate, calculate the result according to the context data
   - If the result is to show, show the result according to the context data
   - If the result is to compare, compare the results according to the context data
   - If the result is to analyze, analyze the results according to the context data
   - If the result is to summarize, summarize the results according to the context data
   - If the result is to predict, predict the results according to the context data
   - If the result is to trend, trend the results according to the context data
   - If the result is to forecast, forecast the results according to the context data

4. Provide your insights to the user

5. IMPORTANT: Create a dynamic table structure that best represents your analysis:
   - Have appropriate headers based on the data you're presenting
   - Include relevant rows with actual data from the context
   - Use proper HTML table structure with <table>, <thead>, <tbody>, <tr>, <th>, <td> tags
   - Be structured to clearly present the key findings from your analysis

6. Format your response as follows:
   ANSWER: [Your detailed answer here]
   CONFIDENCE: [High/Medium/Low]
   REASONING: [Your reasoning process]
   KEY_INSIGHTS: [Key insights from the analysis]
   
   [Your dynamic table here using proper HTML table tags]`;
  }

  /**
   * Parse LLM response and extract structured data
   */
  private parseLLMResponse(response: string, dataPointCount: number): { llmResponse: LLMResponse; generatedTable: string } {
    try {
      const answerMatch = response.match(/ANSWER:\s*(.+?)(?=\n|$)/i);
      const confidenceMatch = response.match(/CONFIDENCE:\s*(.+?)(?=\n|$)/i);
      const reasoningMatch = response.match(/REASONING:\s*(.+?)(?=\n|$)/i);
      const insightsMatch = response.match(/KEY_INSIGHTS:\s*(.+?)(?=\n|$)/i);

      const confidence = confidenceMatch ? 
        (confidenceMatch[1].toLowerCase().includes('high') ? 0.9 :
         confidenceMatch[1].toLowerCase().includes('medium') ? 0.6 : 0.3) : 0.5;

      const tableMatch = response.match(/(<table[^>]*>[\s\S]*?<\/table>)/i);
      const generatedTable = tableMatch ? tableMatch[1] : '';

      const llmResponse: LLMResponse = {
        answer: answerMatch ? answerMatch[1].trim() : response.trim(),
        confidence,
        reasoning: reasoningMatch ? reasoningMatch[1].trim() : "Analysis based on available data",
        dataPoints: dataPointCount,
        sources: insightsMatch ? [insightsMatch[1].trim()] : [],
        generatedTable: generatedTable
      };

      return { llmResponse, generatedTable };
    } catch (error) {
      const llmResponse: LLMResponse = {
        answer: response.trim(),
        confidence: 0.5,
        reasoning: "Response parsing failed, returning raw LLM output",
        dataPoints: dataPointCount,
        sources: [],
        generatedTable: ''
      };
      return { llmResponse, generatedTable: '' };
    }
  }

  /**
   * Main enhanced search function implementing the improved three-stage pipeline
   */
  async semanticSearch({
    tenantId,
    workbookId,
    query,
    topK = 500
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
    generatedTable: string;
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

    console.log("🚀 Starting enhanced semantic search pipeline (No Query Normalization)");
    console.log(`🔍 Original Query: "${query}"`);

    const startTime = Date.now();

    // 1️⃣ Query Processing (No Normalization - Original Query Preserved)
    const queryEnhancementStart = Date.now();
    const enhancedQuery = await this.enhanceQueryNormalization(query);
    const queryEnhancementTime = Date.now() - queryEnhancementStart;

    // 2️⃣ Stage 1: Vector Search with proper filtering
    const vectorStartTime = Date.now();
    const vectorResults = await this.performVectorSearch(
      enhancedQuery.originalQuery,
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
      vectorResults,
      query
    );
    const llmGenerationTime = Date.now() - llmStartTime;

    // Extract the generated table from the LLM response
    const generatedTable = llmResponse.generatedTable || '';

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
      generatedTable,
      searchMetadata: {
        queryEnhancementTime,
        vectorSearchTime,
        structuredDataTime,
        llmGenerationTime,
        totalTime
      }
    };
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    if (this.dbConfig) {
      await this.dbConfig.client.close();
      this.dbConfig = null;
      console.log("🔌 Disconnected from DB");
    }
  }

  /**
   * Explore database content
   */
  async exploreDatabase(): Promise<{ totalDocs: number; hasData: boolean }> {
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
            year: doc.year,
            month: doc.month,
            quarter: doc.quarter,
            sheetName: doc.sheetName,
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

  /**
   * Find available tenant/workbook combinations
   */
  async findAvailableCombinations(): Promise<Array<{ tenantId: string; workbookId: string; count: number }>> {
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

  /**
   * Test search with available data
   */
  async testWithAvailableData(): Promise<void> {
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
}

  
