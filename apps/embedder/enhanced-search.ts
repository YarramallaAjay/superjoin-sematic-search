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
    // Initialize LLM asynchronously - will be awaited in connect()
  }

  /**
   * Connect to the database and initialize LLM
   */
  async connect(): Promise<void> {
    // Initialize LLM first
    await this.initializeLLM();
    
    const client = await this.client.connect();
    const db = client.db(llmConfig.mongo.database);
    
    // Check which collection has data and supports vector search
    const collections = await db.listCollections().toArray();
    
    let collection;
    let collectionName = llmConfig.mongo.collections.atlascells;
    
    // Priority: atlascells (supports vector search) > AtlasCell > analysis (view)
    try {
      const atlascellsCount = await db.collection(llmConfig.mongo.collections.atlascells).countDocuments();
      if (atlascellsCount > 0) {
        collection = db.collection(llmConfig.mongo.collections.atlascells);
        collectionName = llmConfig.mongo.collections.atlascells;
      } else {
        const atlasCellCount = await db.collection(llmConfig.mongo.collections.atlasCell).countDocuments();
        if (atlasCellCount > 0) {
          collection = db.collection(llmConfig.mongo.collections.atlasCell);
          collectionName = llmConfig.mongo.collections.atlasCell;
        } else {
          // Last resort: try analysis view (no vector search support)
          const analysisCount = await db.collection(llmConfig.mongo.collections.analysis).countDocuments();
          if (analysisCount > 0) {
            collection = db.collection(llmConfig.mongo.collections.analysis);
            collectionName = llmConfig.mongo.collections.analysis;
          } else {
            // Default to atlascells
            collection = db.collection(llmConfig.mongo.collections.atlascells);
          }
        }
      }
    } catch (error) {
      // Fallback to atlascells
      collection = db.collection(llmConfig.mongo.collections.atlascells);
      collectionName = llmConfig.mongo.collections.atlascells;
    }

    this.dbConfig = { client, db, collection };
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
        this.llmModel = model;
      } else {
        throw new Error("Failed to get Gemini model instance");
      }
    } catch (error) {
      this.llmModel = null;
    }
  }

  /**
   * Semantic dictionary-based query normalization
   */
  private async enhanceQueryNormalization(query: string): Promise<EnhancedQuery> {
    const semanticDictionary = this.getSemanticDictionary();
    const normalizedQuery = this.normalizeQueryWithSemantics(query, semanticDictionary);
    const dimensions = this.extractDimensions(normalizedQuery);
    const timeFilters = this.extractTimeFilters(normalizedQuery);
    const businessContext = this.generateBusinessContext(query, normalizedQuery, semanticDictionary);
    return {
      originalQuery: query,
      normalizedQuery,
      dimensions,
      timeFilters,
      businessContext
    };
  }

  /**
   * Get comprehensive semantic dictionary for business terms
   * Organized to avoid conflicts and preserve semantic distinctions
   */
  private getSemanticDictionary(): Record<string, string[]> {
    return {
      // Financial Metrics - Keep distinct categories
      'revenue': ['sales', 'turnover', 'top line', 'gross revenue', 'net revenue'],
      'profit': ['net income', 'bottom line', 'profitability', 'gain', 'earnings'],
      'income': ['earnings', 'revenue', 'income'],
      'margin': ['profit margin', 'gross margin', 'net margin', 'operating margin', 'ebitda margin'],
      'cost': ['expense', 'expenditure', 'spending', 'outlay', 'costs', 'expenses'],
      'growth': ['increase', 'rise', 'expansion', 'yoy', 'year over year', 'growth rate', 'incremental'],
      
      // Business Dimensions
      'customer': ['client', 'buyer', 'purchaser', 'consumer', 'end user', 'account'],
      'product': ['item', 'goods', 'service', 'offering', 'solution', 'sku'],
      'region': ['area', 'territory', 'location', 'geography', 'market', 'zone'],
      'channel': ['route', 'pathway', 'medium', 'platform', 'outlet', 'distribution'],
      'segment': ['category', 'division', 'group', 'class', 'tier', 'bracket'],
      
      // Time Periods
      'quarterly': ['q1', 'q2', 'q3', 'q4', 'quarter', '3 months'],
      'monthly': ['month', 'monthly', 'per month', 'each month'],
      'yearly': ['annual', 'yearly', 'per year', 'yoy', 'year over year'],
      'daily': ['day', 'daily', 'per day', 'each day'],
      
      // Performance Indicators
      'performance': ['results', 'outcomes', 'metrics', 'kpi', 'indicators', 'measures'],
      'efficiency': ['productivity', 'effectiveness', 'optimization', 'utilization'],
      'quality': ['standard', 'grade', 'rating', 'score', 'level'],
      
      // Business Operations
      'sales_activity': ['selling', 'revenue generation', 'business development', 'commercial'],
      'marketing': ['promotion', 'advertising', 'campaign', 'branding', 'outreach'],
      'operations': ['processes', 'procedures', 'workflow', 'execution', 'delivery'],
      'finance': ['financial', 'accounting', 'treasury', 'fiscal', 'monetary'],
      
      // Comparative Terms
      'vs': ['versus', 'compared to', 'against', 'relative to', 'in comparison'],
      'trend': ['pattern', 'direction', 'trajectory', 'movement', 'change over time'],
      'forecast': ['prediction', 'projection', 'outlook', 'estimate', 'budget'],
      'actual': ['real', 'actualized', 'achieved', 'realized', 'current'],
      
      // Aggregation Terms
      'total': ['sum', 'aggregate', 'combined', 'overall', 'cumulative'],
      'average': ['mean', 'typical', 'standard', 'normal', 'regular'],
      'maximum': ['max', 'highest', 'peak', 'top', 'best'],
      'minimum': ['min', 'lowest', 'bottom', 'worst', 'least']
    };
  }

  /**
   * Normalize query using semantic dictionary with conflict detection
   */
  private normalizeQueryWithSemantics(query: string, dictionary: Record<string, string[]>): string {
    let normalizedQuery = query.toLowerCase();
    const changes: string[] = [];
    const appliedReplacements = new Set<string>();
    
    console.log(`🔍 Starting normalization of: "${normalizedQuery}"`);
    
    // First pass: detect potential conflicts
    const queryWords = normalizedQuery.split(/\s+/);
    const conflictMap = new Map<string, string[]>();
    
    // Build conflict map - which variations map to the same standard term
    for (const [standardTerm, variations] of Object.entries(dictionary)) {
      for (const variation of variations) {
        if (!conflictMap.has(standardTerm)) {
          conflictMap.set(standardTerm, []);
        }
        conflictMap.get(standardTerm)!.push(variation);
      }
    }
    
    // Check for conflicts in the query
    const queryConflicts: string[] = [];
    for (const [standardTerm, variations] of conflictMap.entries()) {
      const foundVariations = variations.filter(variation => 
        queryWords.some(word => word.includes(variation.toLowerCase()) || variation.toLowerCase().includes(word))
      );
      if (foundVariations.length > 1) {
        queryConflicts.push(`${standardTerm}: ${foundVariations.join(', ')}`);
      }
    }
    
    
    // Apply semantic normalization with conflict resolution
    const allReplacements: Array<{variation: string, standardTerm: string, priority: number}> = [];
    
    // Collect all replacements with priority (longer phrases get higher priority)
    for (const [standardTerm, variations] of Object.entries(dictionary)) {
      for (const variation of variations) {
        allReplacements.push({
          variation,
          standardTerm,
          priority: variation.length + (variation.includes(' ') ? 10 : 0) // Multi-word phrases get higher priority
        });
      }
    }
    
    // Sort by priority (highest first)
    allReplacements.sort((a, b) => b.priority - a.priority);
    
    // Apply replacements with conflict detection
    for (const {variation, standardTerm} of allReplacements) {
      const escapedVariation = variation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedVariation}\\b`, 'gi');
      
      // Check if this replacement would create a conflict
      const matches = normalizedQuery.match(regex);
      if (matches) {
        const wouldCreateConflict = matches.some(match => {
          const replacement = normalizedQuery.replace(regex, standardTerm);
          return replacement.includes(`${standardTerm} ${standardTerm}`) || 
                 replacement.includes(`${standardTerm} vs ${standardTerm}`) ||
                 replacement.includes(`${standardTerm} and ${standardTerm}`);
        });
        
        if (wouldCreateConflict) {
          console.log(`  ⚠️  Skipping "${variation}" → "${standardTerm}" to avoid conflict`);
          continue;
        }
      }
      
      const beforeReplace = normalizedQuery;
      normalizedQuery = normalizedQuery.replace(regex, standardTerm);
      
      if (beforeReplace !== normalizedQuery) {
        changes.push(`${variation} → ${standardTerm}`);
        appliedReplacements.add(standardTerm);
        console.log(`  ✅ Replaced "${variation}" with "${standardTerm}"`);
      }
    }
    
    // Clean up multiple spaces and normalize punctuation
    normalizedQuery = normalizedQuery
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, ' ')
      .trim();
    
    console.log(`📝 Normalization result: "${normalizedQuery}"`);
    if (changes.length > 0) {
      console.log(`🔄 Changes made: ${changes.join(', ')}`);
    } else {
      console.log(`ℹ️  No semantic changes needed`);
    }
    
    return normalizedQuery;
  }


  /**
   * Generate business context for the normalized query
   */
  private generateBusinessContext(originalQuery: string, normalizedQuery: string, dictionary: Record<string, string[]>): string {
    const changes: string[] = [];
    
    // Track what was normalized
    for (const [standardTerm, variations] of Object.entries(dictionary)) {
      for (const variation of variations) {
        if (originalQuery.toLowerCase().includes(variation.toLowerCase()) && 
            normalizedQuery.includes(standardTerm)) {
          changes.push(`${variation} → ${standardTerm}`);
        }
      }
    }
    
    if (changes.length > 0) {
      return `Query normalized using semantic dictionary: ${changes.join(', ')}`;
    }
    
    return "Query processed with semantic dictionary (no changes needed)";
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
            tenantId: tenantId,
            workbookId:workbookId
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
   * Stage 3: LLM Answer Generation - UPDATED to return structured data
   */
  private async generateLLMAnswer(
    enhancedQuery: EnhancedQuery,
    structuredData: SearchResult[],
    originalQuery: string
  ): Promise<{ llmResponse: LLMResponse; aiStructuredData: SearchResult[] }> {
    if (!this.llmModel) {
      console.error("❌ Gemini LLM model not initialized - providing fallback response");
      
      // Create a basic fallback response based on the data
      const metrics = structuredData.map(item => item.metric).filter((value, index, self) => self.indexOf(value) === index);
      const sheets = structuredData.map(item => item.sheetName).filter((value, index, self) => self.indexOf(value) === index);
      
      const fallbackAnswer = `I found ${structuredData.length} data points across ${sheets.length} sheets. The data includes metrics like: ${metrics.slice(0, 5).join(', ')}. However, I'm unable to provide a detailed analysis as the AI model is not available. Please check the configuration or try again later.`;
      
      return {
        llmResponse: {
          answer: fallbackAnswer,
          confidence: 0.2,
          reasoning: "LLM model not initialized - providing basic data summary",
          dataPoints: structuredData.length,
          sources: ["Data summary from available structured data"],
          generatedTable: ""
        },
        aiStructuredData: []
      };
    }



    const contextData = this.prepareLLMContext(structuredData);
    const prompt = this.buildLLMPrompt(enhancedQuery, contextData, originalQuery);


    try {
      if (!this.llmModel) {
        throw new Error("LLM model not initialized");
      }

      const result = await this.llmModel.generateContent(prompt);
      
      if (!result || !result.response) {
        throw new Error("No response from Gemini API");
      }

      const text = result.response.text();
      console.log(result.response)

      if (!text || text.trim().length === 0) {
        throw new Error("Empty response from Gemini API");
      }

      console.log("✅ Gemini LLM response generated successfully");

      const parsedResponse = this.parseLLMResponse(text, structuredData.length);
      return {
        llmResponse: parsedResponse.llmResponse,
        aiStructuredData: parsedResponse.aiStructuredData
      };
    } catch (error) {
      console.error("❌ Gemini LLM generation failed:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      
      // Provide a more helpful fallback response
      const fallbackAnswer = `Based on the available data (${structuredData.length} data points), I can see information about ${structuredData.map(item => item.metric).filter((value, index, self) => self.indexOf(value) === index).slice(0, 5).join(', ')}. However, I'm unable to generate a complete analysis at the moment due to a technical issue. Please try rephrasing your question or contact support if the issue persists.`;
      
      return {
        llmResponse: {
          answer: fallbackAnswer,
          confidence: 0.3,
          reasoning: `Gemini LLM generation failed: ${error instanceof Error ? error.message : 'Unknown error'}. This could be due to API limits, network issues, or model availability.`,
          dataPoints: structuredData.length,
          sources: [`Technical Error: ${error instanceof Error ? error.message : 'Unknown error'}`],
          generatedTable: ""
        },
        aiStructuredData: []
      };
    }
  }

  /**
   * Prepare LLM context from structured data
   */
  private prepareLLMContext(data: SearchResult[]): { context: string } {
    if (!data || data.length === 0) {
      return {
        context: JSON.stringify({
          totalDataPoints: 0,
          availableMetrics: [],
          availableSheets: [],
          availableYears: [],
          availableMonths: [],
          groupedData: [],
          message: "No structured data available for analysis."
        }, null, 2),
      };
    }

    
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
      // Group by metric (business term) instead of just sheet name
      const key = item.metric || item.colName || 'Unknown Metric';
      
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
      
      // Add time dimensions for all items, not just dates
      if (item.year) groupedItem.year = String(item.year);
      if (item.month) groupedItem.month = item.month;
      if (item.quarter) groupedItem.quarter = item.quarter;
      
      if (!groupedData.has(key)) {
        groupedData.set(key, []);
      }
      groupedData.get(key)!.push(groupedItem);
    });

    const contextData = {
      totalDataPoints: data.length,
      availableMetrics: Array.from(groupedData.keys()),
      availableSheets: [...new Set(data.map(item => item.sheetName))],
      availableYears: [...new Set(data.map(item => item.year).filter(Boolean))],
      availableMonths: [...new Set(data.map(item => item.month).filter(Boolean))],
      groupedData: Array.from(groupedData.entries()).map(([key, items]) => ({
        metric: key,
        itemCount: items.length,
        sampleValues: items.slice(0, 5).map(item => ({
          rowName: item.rowName,
          value: item.value,
          year: item.year,
          month: item.month,
          quarter: item.quarter,
          dataType: item.dataType
        })),
        allItems: items
      }))
    };

    const context = JSON.stringify(contextData, null, 2);
    
    
    return { context };
  }

  /**
   * Build LLM prompt with context and instructions - UPDATED to generate structured data
   */
  private buildLLMPrompt(enhancedQuery: EnhancedQuery, contextData: any, originalQuery: string): string {
    return `You are a financial data analyst assistant. You have access to structured financial data and need to provide accurate, insightful answers based on the available data.

ORIGINAL USER QUERY: "${originalQuery}"

CONTEXT DATA:
${contextData.context}

INSTRUCTIONS:
1. Analyze the context data structure:
   - totalDataPoints: Total number of data points available
   - availableMetrics: List of business metrics (Revenue, Sales, etc.)
   - availableSheets: List of Excel sheets
   - availableYears: List of years in the data
   - availableMonths: List of months in the data
   - groupedData: Data grouped by metric with sample values and all items

2. Understand the query thoroughly and match it with available data:
   - Check if the requested metrics exist in availableMetrics
   - Check if the requested time periods exist in availableYears/availableMonths
   - Use the groupedData to find relevant information

3. If the exact data is not available:
   - Clearly state what data is NOT available
   - List what data IS available (metrics, years, months)
   - Provide analysis based on the available data
   - Suggest alternative queries that can be answered with the available data

4. Based on the query type, provide appropriate analysis:
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

5. CRITICAL: Generate comprehensive structured data that matches the following JSON format for each analysis result:
   - Create MULTIPLE data points for different aspects of your analysis
   - Include calculations, comparisons, insights, trends, and key findings as separate structured data points
   - Use VARIED and MEANINGFUL metric names to create different categories
   - Generate at least 3-5 different data points for comprehensive analysis
   - Use the exact field names and structure provided below

6. Format your response as follows:
   ANSWER: [Your detailed answer here]
   CONFIDENCE: [High/Medium/Low]
   REASONING: [Your reasoning process]
   KEY_INSIGHTS: [Key insights from the analysis]
   
   STRUCTURED_DATA: [JSON array of structured data points matching this exact format:
   [
     {
       "_id": "ai_generated_1",
       "tenantId": "ai_analysis",
       "workbookId": "ai_analysis",
       "sheetId": "ai_analysis",
       "sheetName": "AI Analysis Results",
       "rowName": "[Row identifier - could be metric name, category, etc.]",
       "colName": "[Column identifier - could be value type, period, etc.]",
       "rowIndex": 1,
       "colIndex": 1,
       "cellAddress": "A1",
       "dataType": "[number|string|date|percent|ratio]",
       "unit": "[INR|percentage|ratio|count|etc.]",
       "features": {
         "isPercentage": false,
         "isMargin": false,
         "isGrowth": false,
         "isAggregation": false,
         "isForecast": false,
         "isUniqueIdentifier": false
       },
       "sourceCell": "AI_Generated",
       "sourceFormula": null,
       "metric": "[Metric name]",
       "value": "[Actual value - number, string, or date]",
       "year": [year if applicable],
       "month": "[month if applicable]",
       "quarter": "[quarter if applicable]",
       "dimensions": {}
     }
   ]
   ]

IMPORTANT NOTES:
- For calculations: Create separate data points for each calculation step and final result
- For comparisons: Create data points for each item being compared
- For trends: Create data points for each time period
- For insights: Create data points that represent key findings
- Use VARIED metric names like: "Revenue Analysis", "Cost Breakdown", "Profit Margins", "Growth Trends", "Performance Metrics", "Key Insights", "Comparative Analysis", "Financial Ratios", "Market Analysis", "Risk Assessment"
- Use appropriate dataType: "number" for calculations, "string" for text insights, "percent" for percentages
- Ensure all numeric values are actual numbers, not strings
- Include meaningful rowName and colName that describe what each data point represents
- Create at least 3-5 different categories to show comprehensive analysis

EXAMPLE STRUCTURED DATA:
[
  {
    "_id": "ai_generated_1",
    "metric": "Revenue Analysis",
    "rowName": "Total Revenue",
    "colName": "Current Period",
    "value": 1500000,
    "dataType": "number"
  },
  {
    "_id": "ai_generated_2", 
    "metric": "Profit Margins",
    "rowName": "Gross Margin",
    "colName": "Percentage",
    "value": 0.25,
    "dataType": "percent"
  },
  {
    "_id": "ai_generated_3",
    "metric": "Key Insights",
    "rowName": "Top Finding",
    "colName": "Description",
    "value": "Revenue increased by 15% compared to last quarter",
    "dataType": "string"
  }
]`;
  }

  /**
   * Parse LLM response and extract structured data - UPDATED to parse structured data
   */
  private parseLLMResponse(response: string, dataPointCount: number): { 
    llmResponse: LLMResponse; 
    generatedTable: string;
    aiStructuredData: SearchResult[];
  } {
    try {
      
      // Improved regex patterns to capture multi-line responses
      const answerMatch = response.match(/ANSWER:\s*([\s\S]*?)(?=\n\s*(?:CONFIDENCE|REASONING|KEY_INSIGHTS|STRUCTURED_DATA)|$)/i);
      const confidenceMatch = response.match(/CONFIDENCE:\s*([\s\S]*?)(?=\n\s*(?:ANSWER|REASONING|KEY_INSIGHTS|STRUCTURED_DATA)|$)/i);
      const reasoningMatch = response.match(/REASONING:\s*([\s\S]*?)(?=\n\s*(?:ANSWER|CONFIDENCE|KEY_INSIGHTS|STRUCTURED_DATA)|$)/i);
      const insightsMatch = response.match(/KEY_INSIGHTS:\s*([\s\S]*?)(?=\n\s*(?:ANSWER|CONFIDENCE|REASONING|STRUCTURED_DATA)|$)/i);
      

      const confidence = confidenceMatch ? 
        (confidenceMatch[1].toLowerCase().includes('high') ? 0.9 :
         confidenceMatch[1].toLowerCase().includes('medium') ? 0.6 : 0.3) : 0.5;

      // Extract structured data from LLM response
      const structuredDataMatch = response.match(/STRUCTURED_DATA:\s*(\[[\s\S]*?\])/i);
      let aiStructuredData: SearchResult[] = [];
      
      if (structuredDataMatch) {
        try {
          const structuredDataJson = structuredDataMatch[1];
          
          const parsedData = JSON.parse(structuredDataJson);
          if (Array.isArray(parsedData)) {
            aiStructuredData = parsedData.map((item, index) => ({
              _id: item._id || `ai_generated_${index + 1}`,
              tenantId: item.tenantId || "ai_analysis",
              workbookId: item.workbookId || "ai_analysis",
              sheetId: item.sheetId || "ai_analysis",
              sheetName: item.sheetName || "AI Analysis Results",
              rowName: item.rowName || "AI Result",
              colName: item.colName || "Value",
              rowIndex: item.rowIndex || index + 1,
              colIndex: item.colIndex || 1,
              cellAddress: item.cellAddress || `A${index + 1}`,
              dataType: item.dataType || "string",
              unit: item.unit || "N/A",
              features: {
                isPercentage: item.features?.isPercentage || false,
                isMargin: item.features?.isMargin || false,
                isGrowth: item.features?.isGrowth || false,
                isAggregation: item.features?.isAggregation || false,
                isForecast: item.features?.isForecast || false,
                isUniqueIdentifier: item.features?.isUniqueIdentifier || false
              },
              sourceCell: item.sourceCell || "AI_Generated",
              sourceFormula: item.sourceFormula || null,
              metric: item.metric || "AI Analysis",
              value: item.value,
              year: item.year,
              month: item.month,
              quarter: item.quarter,
              dimensions: item.dimensions || {}
            }));
            console.log("✅ Parsed AI structured data:", aiStructuredData.length, "items");
          }
        } catch (parseError) {
          console.error("❌ Failed to parse structured data from LLM:", parseError);
          aiStructuredData = [];
        }
      }

      // Fallback to HTML table if no structured data
      const tableMatch = response.match(/(<table[^>]*>[\s\S]*?<\/table>)/i);
      const generatedTable = tableMatch ? tableMatch[1] : '';

      // Parse insights properly - split by lines and filter out empty ones
      let insights: string[] = [];
      if (insightsMatch) {
        insights = insightsMatch[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(line => line.replace(/^[-•*]\s*/, '')); // Remove bullet points
      }

      // Fallback: if no structured parsing worked, use the full response as answer
      const finalAnswer = answerMatch ? answerMatch[1].trim() : response.trim();
      const finalReasoning = reasoningMatch ? reasoningMatch[1].trim() : "Analysis based on available data";
      
      console.log("✅ Final parsed response:");
      console.log("  Answer length:", finalAnswer);
      console.log("  Reasoning length:", finalReasoning.length);
      console.log("  Insights count:", insights.length);
      console.log("  Structured data count:", aiStructuredData.length);

      const llmResponse: LLMResponse = {
        answer: finalAnswer,
        confidence,
        reasoning: finalReasoning,
        dataPoints: dataPointCount + aiStructuredData.length,
        sources: insights.length > 0 ? insights : [],
        generatedTable: generatedTable
      };

      return { llmResponse, generatedTable, aiStructuredData };
    } catch (error) {
      console.error("❌ Error parsing LLM response:", error);
      const llmResponse: LLMResponse = {
        answer: response.trim(),
        confidence: 0.5,
        reasoning: "Response parsing failed, returning raw LLM output",
        dataPoints: dataPointCount,
        sources: [],
        generatedTable: ''
      };
      return { llmResponse, generatedTable: '', aiStructuredData: [] };
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

    console.log("🚀 Starting enhanced semantic search pipeline (Semantic Dictionary Normalization)");
    console.log(`🔍 Original Query: "${query}"`);

    const startTime = Date.now();

    // 1️⃣ Query Processing (Semantic Dictionary Normalization)
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

    // 4️⃣ Stage 3: LLM Answer Generation with Structured Data
    const llmStartTime = Date.now();
    const llmResult = await this.generateLLMAnswer(
      enhancedQuery,
      vectorResults,
      query
    );
    const llmGenerationTime = Date.now() - llmStartTime;

    // Merge original structured data with AI-generated structured data
    const combinedStructuredData = [...structuredData, ...llmResult.aiStructuredData];
    
    // Extract the generated table from the LLM response
    const generatedTable = llmResult.llmResponse.generatedTable || '';

    const totalTime = Date.now() - startTime;

    console.log("✅ Enhanced search pipeline completed with AI structured data");
    console.log(`⏱️  Total time: ${totalTime}ms`);
    console.log(`📊 Results: ${structuredData.length} original + ${llmResult.aiStructuredData.length} AI-generated = ${combinedStructuredData.length} total data points`);
    console.log(`🔍 Vector matches: ${vectorResults.length}`);

    return {
      query,
      enhancedQuery,
      vectorResults,
      structuredData: combinedStructuredData, // Return combined data
      llmResponse: llmResult.llmResponse,
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

    
    try {
      const totalDocs = await this.dbConfig.collection.countDocuments();
      if (totalDocs > 0) {
        const sampleDocs = await this.dbConfig.collection.find().limit(3).toArray();
      }

      return { totalDocs, hasData: totalDocs > 0 };
    } catch (error) {
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

  
