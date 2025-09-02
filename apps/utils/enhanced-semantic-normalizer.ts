import * as fs from 'fs';
import * as path from 'path';

interface SemanticDictionary {
  metrics: Record<string, string[]>;
  dimensions: Record<string, string[]>;
  time: Record<string, string[]>;
  status: Record<string, string[]>;
  priority: Record<string, string[]>;
  operations: Record<string, string[]>;
  performance: Record<string, string[]>;
}

interface NormalizedData {
  originalValue: string;
  normalizedValue: string;
  semanticCategory: string;
  confidence: number;
}

interface QueryAnalysis {
  metrics: string[];
  dimensions: string[];
  timeFilters: { year?: number; quarter?: string; month?: string };
  operations: string[];
  performance: string[];
  status: string[];
  priority: string[];
  businessContext: string;
}

export class EnhancedSemanticNormalizer {
  private semanticDictionary: SemanticDictionary;

  constructor() {
    this.semanticDictionary = this.loadSemanticDictionary();
  }

  private loadSemanticDictionary(): SemanticDictionary {
    try {
      // Try multiple approaches to load the semantic dictionary
      
      // Approach 1: Try require (works in Node.js)
      try {
        const dictionaryData = require('./config/semantic-dictionary.json');
        console.log('✅ Semantic dictionary loaded via require');
        return dictionaryData;
      } catch (requireError) {
        console.log('⚠️ Require approach failed, trying file system...');
      }
      
      // Approach 2: Try file system (works in some contexts)
      try {
        const dictionaryPath = path.join(__dirname, './config/semantic-dictionary.json');
        const dictionaryContent = fs.readFileSync(dictionaryPath, 'utf-8');
        const parsed = JSON.parse(dictionaryContent);
        console.log('✅ Semantic dictionary loaded via file system');
        return parsed;
      } catch (fsError) {
        console.log('⚠️ File system approach failed, using fallback...');
      }
      
      // Approach 3: Fallback to embedded data
      console.log('🔄 Using fallback semantic dictionary');
      return this.getFallbackSemanticDictionary();
      
    } catch (error) {
      console.error('❌ All approaches failed, using fallback semantic dictionary:', error);
      return this.getFallbackSemanticDictionary();
    }
  }

  private getFallbackSemanticDictionary(): SemanticDictionary {
    return {
      metrics: {
        "Revenue": ["sales", "turnover", "topline", "gross income", "income", "revenue", "sales revenue", "total sales", "gross revenue", "net sales", "operating revenue"],
        "Gross Profit": ["gross margin", "gp", "gross profit", "gross income", "gross earnings", "gross profit margin", "gross profit %"],
        "Net Profit": ["net income", "bottom line", "profit after tax", "np", "net profit", "pat", "net earnings", "net profit margin", "net income margin", "final profit"],
        "Operating Profit": ["ebit", "ebitda", "operating income", "operating profit", "operating earnings", "operating margin", "operating profit margin", "operating income margin"],
        "Cost of Goods Sold": ["cogs", "direct costs", "production costs", "cost of sales", "cost of revenue", "direct expenses", "manufacturing costs", "product costs"],
        "Expenses": ["opex", "operating expenses", "selling costs", "administrative expenses", "overhead", "operating costs", "business expenses", "running costs", "operational expenses"],
        "Cash Flow": ["cf", "net cash", "cash inflow", "cash outflow", "operating cash flow", "cash flow from operations", "free cash flow", "cash generation", "cash position"],
        "Margin": ["profit margin", "operating margin", "net margin", "gross margin", "margin %", "profitability", "margin ratio", "profit ratio"],
        "Growth": ["yoy", "qoq", "growth rate", "increase", "change %", "growth", "growth %", "year over year", "quarter over quarter", "periodic growth", "expansion"],
        "Forecast": ["projection", "estimate", "budget", "forecast", "planned", "expected", "target", "outlook", "prediction", "planning"],
        "EBITDA": ["ebitda", "earnings before interest tax depreciation amortization", "ebitda margin", "ebitda %", "operating ebitda"],
        "EBIT": ["ebit", "earnings before interest and tax", "operating profit", "operating earnings", "operating income"],
        "Depreciation": ["depreciation", "dep", "amortization", "depreciation expense", "amortization expense", "capital depreciation"],
        "Interest": ["interest expense", "interest", "finance cost", "interest cost", "borrowing cost", "debt interest"],
        "Tax": ["tax expense", "tax", "income tax", "corporate tax", "taxation", "tax burden", "effective tax rate"],
        "Assets": ["total assets", "asset base", "capital assets", "fixed assets", "current assets", "asset value"],
        "Liabilities": ["total liabilities", "debt", "obligations", "payables", "current liabilities", "long term debt"],
        "Equity": ["shareholders equity", "book value", "net worth", "equity value", "owner equity"],
        "ROI": ["return on investment", "roi", "investment return", "return %", "investment yield"],
        "ROE": ["return on equity", "roe", "equity return", "shareholder return", "equity yield"],
        "ROA": ["return on assets", "roa", "asset return", "asset yield", "asset efficiency"]
      },
      dimensions: {
        "Customer": ["client", "account", "customer id", "buyer", "customer", "customer name", "end user", "purchaser", "consumer", "user"],
        "Region": ["geography", "location", "area", "region", "territory", "zone", "country", "state", "city", "market", "geographic"],
        "Product": ["product", "item", "sku", "product name", "service", "offering", "solution", "commodity", "goods", "merchandise"],
        "Department": ["dept", "department", "division", "unit", "team", "function", "business unit", "cost center", "profit center"],
        "Channel": ["channel", "sales channel", "distribution", "route to market", "sales route", "distribution channel", "sales method", "delivery method"],
        "Category": ["category", "segment", "classification", "type", "group", "class", "tier", "level", "bucket", "segment"],
        "Industry": ["industry", "sector", "business sector", "market sector", "vertical", "business vertical", "industry vertical"],
        "Company": ["company", "organization", "firm", "enterprise", "business", "corporation", "entity", "establishment"],
        "Brand": ["brand", "brand name", "trademark", "product brand", "company brand", "brand identity"],
        "Market": ["market", "marketplace", "business market", "target market", "market segment", "market area"]
      },
      time: {
        "Year": ["fy", "financial year", "year", "calendar year", "annual", "yearly", "fiscal year", "business year", "reporting year"],
        "Quarter": ["q1", "q2", "q3", "q4", "quarter", "quarterly", "three months", "3 month period", "quarter period", "fiscal quarter"],
        "Month": ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "month", "monthly", "30 day period", "calendar month"],
        "Period": ["period", "timeframe", "duration", "span", "interval", "cycle", "term", "phase"],
        "Date": ["date", "specific date", "point in time", "moment", "timestamp", "day", "week", "bi-weekly"]
      },
      status: {
        "Open": ["open", "active", "pending", "in progress", "ongoing", "current", "live", "running", "active status"],
        "Closed": ["closed", "completed", "resolved", "finished", "done", "finalized", "concluded", "terminated", "ended"],
        "Cancelled": ["cancelled", "cancelled", "abandoned", "terminated", "stopped", "discontinued", "halted", "suspended", "voided"]
      },
      priority: {
        "High": ["high", "critical", "urgent", "priority 1", "top priority", "immediate", "essential", "vital", "crucial"],
        "Medium": ["medium", "normal", "standard", "priority 2", "moderate", "average", "regular", "typical", "usual"],
        "Low": ["low", "minor", "low priority", "priority 3", "minimal", "insignificant", "trivial", "non-critical", "optional"]
      },
      operations: {
        "Sales": ["sales", "selling", "revenue generation", "business development", "sales operations", "sales process"],
        "Marketing": ["marketing", "advertising", "promotion", "brand awareness", "lead generation", "market development"],
        "Finance": ["finance", "financial", "accounting", "treasury", "financial management", "financial planning"],
        "Operations": ["operations", "operational", "business operations", "day to day", "operational efficiency", "process management"],
        "HR": ["hr", "human resources", "personnel", "staffing", "recruitment", "employee management", "workforce"],
        "IT": ["it", "information technology", "tech", "technology", "systems", "digital", "automation", "software"]
      },
      performance: {
        "Efficiency": ["efficiency", "productivity", "performance", "effectiveness", "optimization", "streamlining", "improvement"],
        "Quality": ["quality", "standards", "excellence", "reliability", "consistency", "accuracy", "precision"],
        "Speed": ["speed", "velocity", "pace", "rate", "timeliness", "response time", "processing time"],
        "Cost": ["cost", "expense", "expenditure", "spending", "investment", "budget", "financial impact"],
        "Volume": ["volume", "quantity", "amount", "scale", "magnitude", "size", "capacity", "throughput"]
      }
    };
  }

  /**
   * Normalize a single value using the semantic dictionary
   */
  public normalizeValue(value: string): NormalizedData {
    if (!value || typeof value !== 'string') {
      return {
        originalValue: value || '',
        normalizedValue: 'unknown',
        semanticCategory: 'unknown',
        confidence: 0
      };
    }

    const normalizedValue = value.toString().trim().toLowerCase();
    
    // Check all categories in the semantic dictionary
    const categories = Object.keys(this.semanticDictionary);
    
    for (const category of categories) {
      const categoryData = this.semanticDictionary[category as keyof SemanticDictionary];
      
      for (const [standardTerm, synonyms] of Object.entries(categoryData)) {
        // Check if the value matches the standard term
        if (normalizedValue === standardTerm.toLowerCase()) {
          return {
            originalValue: value,
            normalizedValue: standardTerm,
            semanticCategory: category,
            confidence: 1.0
          };
        }
        
        // Check if the value matches any synonyms
        if (synonyms.some(synonym => normalizedValue === synonym.toLowerCase())) {
          return {
            originalValue: value,
            normalizedValue: standardTerm,
            semanticCategory: category,
            confidence: 0.9
          };
        }
        
        // Check for partial matches
        if (synonyms.some(synonym => 
          normalizedValue.includes(synonym.toLowerCase()) || 
          synonym.toLowerCase().includes(normalizedValue)
        )) {
          return {
            originalValue: value,
            normalizedValue: standardTerm,
            semanticCategory: category,
            confidence: 0.7
          };
        }
      }
    }

    // If no match found, try to infer the category based on common patterns
    const inferredCategory = this.inferCategory(normalizedValue);
    
    return {
      originalValue: value,
      normalizedValue: value, // Keep original if no normalization possible
      semanticCategory: inferredCategory,
      confidence: 0.3
    };
  }

  /**
   * Infer category based on common patterns and context
   */
  private inferCategory(value: string): string {
    // Time patterns
    if (/^\d{4}$/.test(value) || /year|fy|fiscal/i.test(value)) {
      return 'time';
    }
    if (/q[1-4]|quarter/i.test(value)) {
      return 'time';
    }
    if (/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|month/i.test(value)) {
      return 'time';
    }

    // Metric patterns
    if (/revenue|sales|profit|income|margin|ebit|ebitda|roi|roe|roa/i.test(value)) {
      return 'metrics';
    }
    if (/cost|expense|depreciation|amortization|tax|interest/i.test(value)) {
      return 'metrics';
    }

    // Dimension patterns
    if (/customer|client|region|product|department|channel|category/i.test(value)) {
      return 'dimensions';
    }

    // Status patterns
    if (/open|closed|active|pending|completed|cancelled/i.test(value)) {
      return 'status';
    }

    // Priority patterns
    if (/high|medium|low|critical|urgent|normal/i.test(value)) {
      return 'priority';
    }

    // Operations patterns
    if (/sales|marketing|finance|operations|hr|it/i.test(value)) {
      return 'operations';
    }

    // Performance patterns
    if (/efficiency|quality|speed|cost|volume|performance/i.test(value)) {
      return 'performance';
    }

    return 'unknown';
  }

  /**
   * Normalize Excel data row by row
   */
  public normalizeExcelData(data: any[]): any[] {
    console.log('🔍 Normalizing Excel data using semantic dictionary...');
    
    return data.map((row, index) => {
      const normalizedRow: any = { ...row };
      
      // Normalize key fields
      const fieldsToNormalize = ['metric', 'normalizedMetric', 'semanticString', 'value', 'year', 'quarter', 'month'];
      
      fieldsToNormalize.forEach(field => {
        if (row[field] !== undefined && row[field] !== null) {
          const normalized = this.normalizeValue(row[field]);
          normalizedRow[`${field}Normalized`] = normalized.normalizedValue;
          normalizedRow[`${field}Category`] = normalized.semanticCategory;
          normalizedRow[`${field}Confidence`] = normalized.confidence;
        }
      });

      // Create enhanced semantic string
      if (row.metric || row.normalizedMetric) {
        const metric = row.metric || row.normalizedMetric;
        const normalizedMetric = this.normalizeValue(metric);
        
        normalizedRow.enhancedSemanticString = this.buildEnhancedSemanticString(
          normalizedMetric.normalizedValue,
          row.year,
          row.quarter,
          row.month,
          row.region,
          row.product,
          row.customerName
        );
      }

      if (index < 5) {
        console.log(`📊 Row ${index + 1} normalized:`, {
          original: row.metric || row.normalizedMetric,
          normalized: normalizedRow.metricNormalized || normalizedRow.normalizedMetricNormalized,
          category: normalizedRow.metricCategory || normalizedRow.normalizedMetricCategory,
          confidence: normalizedRow.metricConfidence || normalizedRow.normalizedMetricConfidence
        });
      }

      return normalizedRow;
    });
  }

  /**
   * Build enhanced semantic string for better embeddings
   */
  private buildEnhancedSemanticString(
    metric: string,
    year?: any,
    quarter?: any,
    month?: any,
    region?: any,
    product?: any,
    customer?: any
  ): string {
    const parts: string[] = [];
    
    // Add metric
    if (metric) {
      parts.push(metric);
    }
    
    // Add time components
    if (year) parts.push(`Year: ${year}`);
    if (quarter) parts.push(`Quarter: ${quarter}`);
    if (month) parts.push(`Month: ${month}`);
    
    // Add dimensions
    if (region) parts.push(`Region: ${region}`);
    if (product) parts.push(`Product: ${product}`);
    if (customer) parts.push(`Customer: ${customer}`);
    
    return parts.join(' | ');
  }

  /**
   * Analyze and normalize user query
   */
  public analyzeQuery(query: string): QueryAnalysis {
    console.log(`🔍 Analyzing query: "${query}"`);
    
    const normalizedQuery = query.toLowerCase();
    const analysis: QueryAnalysis = {
      metrics: [],
      dimensions: [],
      timeFilters: {},
      operations: [],
      performance: [],
      status: [],
      priority: [],
      businessContext: ''
    };

    // Extract metrics
    for (const [standardTerm, synonyms] of Object.entries(this.semanticDictionary.metrics)) {
      if (this.matchesAny(normalizedQuery, [standardTerm, ...synonyms])) {
        analysis.metrics.push(standardTerm);
      }
    }

    // Extract dimensions
    for (const [standardTerm, synonyms] of Object.entries(this.semanticDictionary.dimensions)) {
      if (this.matchesAny(normalizedQuery, [standardTerm, ...synonyms])) {
        analysis.dimensions.push(standardTerm);
      }
    }

    // Extract time filters
    analysis.timeFilters = this.extractTimeFilters(normalizedQuery);

    // Extract operations
    for (const [standardTerm, synonyms] of Object.entries(this.semanticDictionary.operations)) {
      if (this.matchesAny(normalizedQuery, [standardTerm, ...synonyms])) {
        analysis.operations.push(standardTerm);
      }
    }

    // Extract performance indicators
    for (const [standardTerm, synonyms] of Object.entries(this.semanticDictionary.performance)) {
      if (this.matchesAny(normalizedQuery, [standardTerm, ...synonyms])) {
        analysis.performance.push(standardTerm);
      }
    }

    // Extract status
    for (const [standardTerm, synonyms] of Object.entries(this.semanticDictionary.status)) {
      if (this.matchesAny(normalizedQuery, [standardTerm, ...synonyms])) {
        analysis.status.push(standardTerm);
      }
    }

    // Extract priority
    for (const [standardTerm, synonyms] of Object.entries(this.semanticDictionary.priority)) {
      if (this.matchesAny(normalizedQuery, [standardTerm, ...synonyms])) {
        analysis.priority.push(standardTerm);
      }
    }

    // Build business context
    analysis.businessContext = this.buildBusinessContext(analysis);

    console.log('✅ Query analysis completed:', analysis);
    return analysis;
  }

  /**
   * Check if query matches any of the given terms
   */
  private matchesAny(query: string, terms: string[]): boolean {
    return terms.some(term => 
      query.includes(term.toLowerCase()) || 
      term.toLowerCase().includes(query)
    );
  }

  /**
   * Extract time filters from query
   */
  private extractTimeFilters(query: string): { year?: number; quarter?: string; month?: string } {
    const timeFilters: { year?: number; quarter?: string; month?: string } = {};

    // Extract year
    const yearMatch = query.match(/(\d{4})/);
    if (yearMatch) {
      timeFilters.year = parseInt(yearMatch[1]);
    }

    // Extract quarter
    const quarterMatch = query.match(/q[1-4]|quarter/i);
    if (quarterMatch) {
      timeFilters.quarter = quarterMatch[0].toUpperCase();
    }

    // Extract month
    const monthMatch = query.match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i);
    if (monthMatch) {
      timeFilters.month = monthMatch[0].toLowerCase();
    }

    return timeFilters;
  }

  /**
   * Build business context from analysis
   */
  private buildBusinessContext(analysis: QueryAnalysis): string {
    const contextParts: string[] = [];

    if (analysis.metrics.length > 0) {
      contextParts.push(`Metrics: ${analysis.metrics.join(', ')}`);
    }

    if (analysis.dimensions.length > 0) {
      contextParts.push(`Dimensions: ${analysis.dimensions.join(', ')}`);
    }

    if (analysis.operations.length > 0) {
      contextParts.push(`Operations: ${analysis.operations.join(', ')}`);
    }

    if (analysis.performance.length > 0) {
      contextParts.push(`Performance: ${analysis.performance.join(', ')}`);
    }

    if (Object.keys(analysis.timeFilters).length > 0) {
      const timeParts = [];
      if (analysis.timeFilters.year) timeParts.push(`Year: ${analysis.timeFilters.year}`);
      if (analysis.timeFilters.quarter) timeParts.push(`Quarter: ${analysis.timeFilters.quarter}`);
      if (analysis.timeFilters.month) timeParts.push(`Month: ${analysis.timeFilters.month}`);
      contextParts.push(`Time: ${timeParts.join(', ')}`);
    }

    return contextParts.length > 0 ? contextParts.join(' | ') : 'Business analysis query';
  }

  /**
   * Create normalized query string for embeddings
   */
  public createNormalizedQueryString(analysis: QueryAnalysis): string {
    const parts: string[] = [];

    // Add primary metrics
    if (analysis.metrics.length > 0) {
      parts.push(analysis.metrics[0]); // Use first metric as primary
    }

    // Add dimensions
    if (analysis.dimensions.length > 0) {
      parts.push(analysis.dimensions.join(' and '));
    }

    // Add time context
    if (analysis.timeFilters.year) {
      parts.push(`Year ${analysis.timeFilters.year}`);
    }
    if (analysis.timeFilters.quarter) {
      parts.push(analysis.timeFilters.quarter);
    }
    if (analysis.timeFilters.month) {
      parts.push(analysis.timeFilters.month);
    }

    // Add operations context
    if (analysis.operations.length > 0) {
      parts.push(analysis.operations[0]);
    }

    // Add performance context
    if (analysis.performance.length > 0) {
      parts.push(analysis.performance[0]);
    }

    return parts.join(' | ');
  }

  /**
   * Get all available normalized terms for a category
   */
  public getAvailableTerms(category: string): string[] {
    const categoryData = this.semanticDictionary[category as keyof SemanticDictionary];
    if (!categoryData) {
      return [];
    }
    return Object.keys(categoryData);
  }

  /**
   * Get synonyms for a specific term
   */
  public getSynonyms(category: string, term: string): string[] {
    const categoryData = this.semanticDictionary[category as keyof SemanticDictionary];
    if (!categoryData || !categoryData[term]) {
      return [];
    }
    return categoryData[term];
  }
}

// Export singleton instance
export const enhancedSemanticNormalizer = new EnhancedSemanticNormalizer();
