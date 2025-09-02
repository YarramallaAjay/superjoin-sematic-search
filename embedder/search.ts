import { AtlasCellModel } from "../models/workbook";
import { semanticNormalizer, QueryFilters } from "../utils/semantic-normalizer";
import { makeEmbeddingsOptimized } from "./embedding";

export interface SearchResult {
  _id: string;
  tenantId: string;
  workbookId: string;
  sheetId: string;
  semanticString: string;
  metric: string;
  normalizedMetric: string;
  value: any;
  unit: string;
  dataType: string;
  year?: number;
  quarter?: string;
  month?: string;
  region?: string;
  customerId?: string;
  customerName?: string;
  product?: string;
  department?: string;
  channel?: string;
  category?: string;
  status?: string;
  priority?: string;
  dimensions: Record<string, any>;
  features: {
    isPercentage: boolean;
    isMargin: boolean;
    isGrowth: boolean;
    isAggregation: boolean;
    isForecast: boolean;
    isUniqueIdentifier: boolean;
  };
  score: number;
  sourceCell: string;
  sourceFormula?: string;
}

export interface SearchOptions {
  tenantId?: string;
  workbookId?: string;
  limit?: number;
  minScore?: number;
  includeFilters?: boolean;
}

export class SemanticSearchEngine {
  private static instance: SemanticSearchEngine;

  private constructor() {}

  public static getInstance(): SemanticSearchEngine {
    if (!SemanticSearchEngine.instance) {
      SemanticSearchEngine.instance = new SemanticSearchEngine();
    }
    return SemanticSearchEngine.instance;
  }

  /**
   * Main semantic search function implementing the complete pipeline
   */
  public async semanticSearch(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    console.log(`🔍 Semantic search for: "${query}"`);
    console.log(`📋 Options:`, options);

    try {
      // Step 1: Parse query → Extract metrics, dimensions, filters
      const { metrics, dimensions, filters, timeFilters } = semanticNormalizer.parseQuery(query);
      console.log(`📊 Parsed query:`, { metrics, dimensions, filters, timeFilters });

      // Step 2: Normalize metrics/dimensions using semantic dictionary
      const normalizedMetrics = metrics.map(m => semanticNormalizer.normalizeValue(m).normalized);
      const normalizedDimensions = dimensions.map(d => semanticNormalizer.normalizeValue(d).normalized);
      console.log(`🔄 Normalized:`, { metrics: normalizedMetrics, dimensions: normalizedDimensions });

      // Step 3: Build queryEmbedding with normalized semantic string
      const querySemanticString = this.buildQuerySemanticString(
        normalizedMetrics,
        normalizedDimensions,
        timeFilters
      );
      console.log(`📝 Query semantic string: "${querySemanticString}"`);

      // Generate embedding for the query
      const queryEmbeddings = await makeEmbeddingsOptimized([querySemanticString]);
      if (!queryEmbeddings.length || !queryEmbeddings[0].length) {
        throw new Error("Failed to generate query embedding");
      }
      const queryEmbedding = queryEmbeddings[0];
      console.log(`📏 Query embedding length: ${queryEmbedding.length}`);

      // Step 4: Try vector search, fallback to text search if it fails
      let vectorSearchResults: any[] = [];
      try {
        vectorSearchResults = await this.runVectorSearch(
          queryEmbedding,
          options,
          options.limit || 50
        );
        console.log(`🔍 Vector search returned ${vectorSearchResults.length} candidates`);
      } catch (vectorError) {
        console.warn(`⚠️ Vector search failed, using text search fallback:`, vectorError instanceof Error ? vectorError.message : String(vectorError));
        // Fallback to text search
        vectorSearchResults = await this.fallbackTextSearch(query, options, timeFilters);
        console.log(`🔍 Text search fallback returned ${vectorSearchResults.length} candidates`);
      }

      // Step 5: Apply structured filters
      const filteredResults = this.applyStructuredFilters(
        vectorSearchResults,
        options,
        timeFilters
      );
      console.log(`🔍 After filtering: ${filteredResults.length} results`);

      // Step 6: Re-rank results by similarity + exact filter matches
      const reRankedResults = this.reRankResults(
        filteredResults,
        normalizedMetrics,
        normalizedDimensions,
        timeFilters
      );

      // Step 7: Return enriched context
      const finalResults = reRankedResults.slice(0, options.limit || 10);
      console.log(`✅ Search complete: ${finalResults.length} results returned`);

      return finalResults;

    } catch (error) {
      console.error(`❌ Semantic search failed:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Build semantic string for the query
   */
  private buildQuerySemanticString(
    metrics: string[],
    dimensions: string[],
    timeFilters: { year?: number; quarter?: string; month?: string }
  ): string {
    const parts: string[] = [];
    
    // Add dimensions first
    if (dimensions.length > 0) {
      parts.push(...dimensions);
    }
    
    // Add metrics
    if (metrics.length > 0) {
      parts.push(...metrics);
    }
    
    // Add time information
    if (timeFilters.year) parts.push(String(timeFilters.year));
    if (timeFilters.quarter) parts.push(timeFilters.quarter);
    if (timeFilters.month) parts.push(timeFilters.month);

    return parts.filter(part => part && part.trim()).join(' | ');
  }

  /**
   * Fallback text-based search using MongoDB text search and regex
   */
  private async fallbackTextSearch(
    query: string,
    options: SearchOptions,
    timeFilters: { year?: number; quarter?: string; month?: string }
  ): Promise<any[]> {
    console.log(`🔍 Using fallback text search for: "${query}"`);
    
    const { metrics, dimensions } = semanticNormalizer.parseQuery(query);
    const normalizedMetrics = metrics.map(m => semanticNormalizer.normalizeValue(m).normalized);
    const normalizedDimensions = dimensions.map(d => semanticNormalizer.normalizeValue(d).normalized);

    // Build search query
    const searchQuery: any = {};
    
    // Basic filters
    if (options.tenantId) searchQuery.tenantId = options.tenantId;
    if (options.workbookId) searchQuery.workbookId = options.workbookId;
    
    // Time filters
    if (timeFilters.year) searchQuery.year = timeFilters.year;
    if (timeFilters.quarter) searchQuery.quarter = timeFilters.quarter;
    if (timeFilters.month) searchQuery.month = timeFilters.month;

    // Text search on semantic string
    if (query.trim()) {
      const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
      if (searchTerms.length > 0) {
        searchQuery.$or = [
          // Search in semantic string
          { semanticString: { $regex: searchTerms.join('|'), $options: 'i' } },
          // Search in metric names
          { metric: { $regex: searchTerms.join('|'), $options: 'i' } },
          // Search in normalized metrics
          { normalizedMetric: { $in: normalizedMetrics } }
        ];
      }
    }

    console.log(`📂 Fallback search query:`, JSON.stringify(searchQuery, null, 2));

    const results = await AtlasCellModel.find(searchQuery)
      .limit((options.limit || 50) * 2) // Get more results for re-ranking
      .sort({ updatedAt: -1 })
      .lean();

    // Add dummy scores for consistency
    return results.map((result, index) => ({
      ...result,
      score: 1.0 - (index * 0.01) // Decreasing scores for ranking
    }));
  }

  /**
   * Run vector search using MongoDB Atlas $vectorSearch
   */
  private async runVectorSearch(
    queryEmbedding: number[],
    options: SearchOptions,
    limit: number
  ): Promise<any[]> {
    const pipeline = [
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: Math.min(limit * 3, 200), // Get more candidates for filtering
          limit: limit * 2
        }
      },
      {
        $match: {
          // Basic filters
          ...(options.workbookId && { workbookId: options.workbookId })
        }
      },
      {
        $project: {
          tenantId: 1,
          workbookId: 1,
          sheetId: 1,
          semanticString: 1,
          metric: 1,
          normalizedMetric: 1,
          value: 1,
          unit: 1,
          dataType: 1,
          year: 1,
          quarter: 1,
          month: 1,
          region: 1,
          customerId: 1,
          customerName: 1,
          product: 1,
          department: 1,
          channel: 1,
          category: 1,
          status: 1,
          priority: 1,
          dimensions: 1,
          features: 1,
          sourceCell: 1,
          sourceFormula: 1,
          score: { $meta: "vectorSearchScore" }
        }
      }
    ];

    console.log(`📂 Running vector search pipeline:`, JSON.stringify(pipeline, null, 2));
    
    const results = await AtlasCellModel.aggregate(pipeline);
    return results;
  }

  /**
   * Apply structured filters to vector search results
   */
  private applyStructuredFilters(
    results: any[],
    options: SearchOptions,
    timeFilters: { year?: number; quarter?: string; month?: string }
  ): any[] {
    return results.filter(result => {
      // Apply time filters
      if (timeFilters.year && result.year !== timeFilters.year) return false;
      if (timeFilters.quarter && result.quarter !== timeFilters.quarter) return false;
      if (timeFilters.month && result.month !== timeFilters.month) return false;

      // Apply score threshold
      if (options.minScore && result.score < options.minScore) return false;

      return true;
    });
  }

  /**
   * Re-rank results prioritizing exact matches on normalized metric/dim/time
   */
  private reRankResults(
    results: any[],
    normalizedMetrics: string[],
    normalizedDimensions: string[],
    timeFilters: { year?: number; quarter?: string; month?: string }
  ): SearchResult[] {
    return results
      .map(result => {
        let score = result.score;
        
        // Boost score for exact metric matches
        if (normalizedMetrics.includes(result.normalizedMetric)) {
          score += 0.3;
        }
        
        // Boost score for exact dimension matches
        const resultDimensions = [
          result.region,
          result.product,
          result.department,
          result.channel,
          result.category
        ].filter(Boolean);
        
        const dimensionMatches = normalizedDimensions.filter(dim => 
          resultDimensions.includes(dim)
        ).length;
        
        if (dimensionMatches > 0) {
          score += 0.2 * dimensionMatches;
        }
        
        // Boost score for exact time matches
        if (timeFilters.year && result.year === timeFilters.year) score += 0.2;
        if (timeFilters.quarter && result.quarter === timeFilters.quarter) score += 0.15;
        if (timeFilters.month && result.month === timeFilters.month) score += 0.1;
        
        return { ...result, score };
      })
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .map(result => ({
        _id: result._id,
        tenantId: result.tenantId || '',
        workbookId: result.workbookId || '',
        sheetId: result.sheetId || '',
        semanticString: result.semanticString || '',
        metric: result.metric || '',
        normalizedMetric: result.metric || '', // Use metric as normalizedMetric
        value: result.value,
        unit: result.unit || '',
        dataType: result.dataType || '',
        year: result.year,
        quarter: result.quarter,
        month: result.month,
        region: result.region,
        customerId: result.customer, // Map customer to customerId
        customerName: result.customer, // Map customer to customerName
        product: result.product,
        department: undefined, // Not in schema
        channel: undefined, // Not in schema
        category: undefined, // Not in schema
        status: undefined, // Not in schema
        priority: undefined, // Not in schema
        dimensions: {}, // Not in schema, use empty object
        features: {
          isPercentage: result.features?.isPercentage || false,
          isMargin: result.features?.isMargin || false,
          isGrowth: result.features?.isGrowth || false,
          isAggregation: result.features?.isAggregation || false,
          isForecast: result.features?.isForecast || false,
          isUniqueIdentifier: false // Add missing property
        },
        score: result.score,
        sourceCell: result.sourceCell || '',
        sourceFormula: result.sourceFormula
      }));
  }

  /**
   * Search by specific filters without semantic search
   */
  public async searchByFilters(
    filters: QueryFilters,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    console.log(`🔍 Filter-based search:`, filters);
    
    const query: any = {};
    
    // Build MongoDB query from filters
    if (filters.tenantId) query.tenantId = filters.tenantId;
    if (filters.workbookId) query.workbookId = filters.workbookId;
    if (filters.year) query.year = Array.isArray(filters.year) ? { $in: filters.year } : filters.year;
    if (filters.quarter) query.quarter = Array.isArray(filters.quarter) ? { $in: filters.quarter } : filters.quarter;
    if (filters.month) query.month = Array.isArray(filters.month) ? { $in: filters.month } : filters.month;
    if (filters.region) query.region = Array.isArray(filters.region) ? { $in: filters.region } : filters.region;
    if (filters.customerId) query.customer = Array.isArray(filters.customerId) ? { $in: filters.customerId } : filters.customerId;
    if (filters.product) query.product = Array.isArray(filters.product) ? { $in: filters.product } : filters.product;
    if (filters.department) query.department = Array.isArray(filters.department) ? { $in: filters.department } : filters.department;
    if (filters.status) query.status = Array.isArray(filters.status) ? { $in: filters.status } : filters.status;
    if (filters.priority) query.priority = Array.isArray(filters.priority) ? { $in: filters.priority } : filters.priority;

    console.log(`📂 MongoDB query:`, JSON.stringify(query, null, 2));
    
    const results = await AtlasCellModel.find(query)
      .limit(options.limit || 100)
      .sort({ updatedAt: -1 })
      .lean();

    return results.map(result => ({
      _id: result._id,
      tenantId: result.tenantId || '',
      workbookId: result.workbookId || '',
      sheetId: result.sheetId || '',
      semanticString: result.semanticString || '',
      metric: result.metric || '',
      normalizedMetric: result.metric || '', // Use metric as normalizedMetric
      value: result.value,
      unit: result.unit || '',
      dataType: result.dataType || '',
      year: result.year || undefined,
      quarter: result.quarter || undefined,
      month: result.month || undefined,
      region: result.region || undefined,
      customerId: result.customer || undefined, // Map customer to customerId
      customerName: result.customer || undefined, // Map customer to customerName
      product: result.product || undefined,
      department: undefined, // Not in schema
      channel: undefined, // Not in schema
      category: undefined, // Not in schema
      status: undefined, // Not in schema
      priority: undefined, // Not in schema
      dimensions: {}, // Not in schema, use empty object
      features: {
        isPercentage: result.features?.isPercentage || false,
        isMargin: result.features?.isMargin || false,
        isGrowth: result.features?.isGrowth || false,
        isAggregation: result.features?.isAggregation || false,
        isForecast: result.features?.isForecast || false,
        isUniqueIdentifier: false // Add missing property
      },
      score: 1.0, // Default score for filter-based search
      sourceCell: result.sourceCell || '',
      sourceFormula: result.sourceFormula || undefined
    }));
  }
}

export const semanticSearchEngine = SemanticSearchEngine.getInstance();
