// Import semantic dictionary data
// let semanticDictionary: Record<string, Record<string, string[]>>;

// try {
//   // Try to import the JSON file
// } catch (error) {
//   console.warn('Failed to import semantic dictionary JSON, using fallback data');
//   // Fallback semantic dictionary
//   semanticDictionary = {
//     metrics: {
//       "Revenue": ["sales", "turnover", "topline", "gross income", "income", "revenue"],
//       "Gross Profit": ["gross margin", "gp", "gross profit", "gross income"],
//       "Net Profit": ["net income", "bottom line", "profit after tax", "np", "net profit"]
//     },
//     dimensions: {
//       "Customer": ["client", "account", "customer id", "buyer", "customer"],
//       "Region": ["geography", "location", "area", "region", "territory"],
//       "Product": ["product", "item", "sku", "product name", "service"]
//     },
//     time: {
//       "Year": ["fy", "financial year", "year", "calendar year", "annual"],
//       "Quarter": ["q1", "q2", "q3", "q4", "quarter", "quarterly"],
//       "Month": ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
//     },
//     status: {
//       "Open": ["open", "active", "pending", "in progress", "ongoing"],
//       "Closed": ["closed", "completed", "resolved", "finished", "done"]
//     },
//     priority: {
//       "High": ["high", "critical", "urgent", "priority 1", "top priority"],
//       "Medium": ["medium", "normal", "standard", "priority 2", "moderate"],
//       "Low": ["low", "minor", "low priority", "priority 3", "minimal"]
//     }
//   };
// }

export interface NormalizedValue {
  original: string;
  normalized: string;
  category: 'metric' | 'dimension' | 'time' | 'status' | 'priority' | 'unknown';
  confidence: number;
}

export interface QueryFilters {
  tenantId?: string;
  workbookId?: string;
  year?: number | number[];
  quarter?: string | string[];
  month?: string | string[];
  region?: string | string[];
  customerId?: string | string[];
  product?: string | string[];
  department?: string | string[];
  status?: string | string[];
  priority?: string | string[];
}

export class SemanticNormalizer {
  private static instance: SemanticNormalizer;
  private reverseLookup: Map<string, { normalized: string; category: NormalizedValue['category'] }> = new Map();

  private constructor() {
    this.buildReverseLookup();
  }

  public static getInstance(): SemanticNormalizer {
    if (!SemanticNormalizer.instance) {
      SemanticNormalizer.instance = new SemanticNormalizer();
    }
    return SemanticNormalizer.instance;
  }

  private buildReverseLookup(): void {
    Object.entries(semanticDictionary).forEach(([category, mappings]) => {
      Object.entries(mappings).forEach(([normalized, variants]) => {
        variants.forEach((variant) => {
          this.reverseLookup.set(variant.toLowerCase(), {
            normalized,
            category: category as NormalizedValue['category'],
          });
        });
      });
    });
  }

  // ---- Value normalization ----
  public normalizeValue(value: string): NormalizedValue {
    if (!value || typeof value !== 'string') {
      return { original: value, normalized: value, category: 'unknown', confidence: 0 };
    }

    const lowerValue = value.toLowerCase().trim();

    if (this.reverseLookup.has(lowerValue)) {
      const match = this.reverseLookup.get(lowerValue)!;
      return { original: value, ...match, confidence: 1.0 };
    }

    // fallback: no match
    return { original: value, normalized: value, category: 'unknown', confidence: 0 };
  }

  // ---- Metric-specific normalization ----
  public normalizeMetric(value: string): string {
    const norm = this.normalizeValue(value);
    return norm.category === 'metric' ? norm.normalized : value;
  }

  // ---- Time extraction ----
  public extractTimeHints(value: string): { year?: number; quarter?: string; month?: string } {
    const hints: { year?: number; quarter?: string; month?: string } = {};
    if (!value) return hints;

    const yearMatch = value.match(/\b(20\d{2})\b/);
    if (yearMatch) hints.year = parseInt(yearMatch[1]);

    const quarterMatch = value.match(/\bQ([1-4])\b/i);
    if (quarterMatch) hints.quarter = `Q${quarterMatch[1]}`;

    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const lowerValue = value.toLowerCase();
    for (let i = 0; i < months.length; i++) {
      if (lowerValue.includes(months[i])) {
        hints.month = months[i].charAt(0).toUpperCase() + months[i].slice(1);
        if (!hints.quarter) hints.quarter = `Q${Math.floor(i / 3) + 1}`;
        break;
      }
    }
    return hints;
  }

  public isUniqueIdentifier(value: string): boolean {
    if (!value || typeof value !== 'string') return false;
    const patterns = [
      /^[a-z]{2,4}\d{3,6}$/i, // TKT0032, E1032
      /^[a-z]+\d+$/i, // Customer123
      /^[a-f0-9]{8,}$/i, // UUID
      /^[a-z0-9]{4,8}$/i, // Short codes
    ];
    return patterns.some((p) => p.test(value));
  }

  // ---- Semantic string builder ----
  public buildSemanticString(
    sheetName: string,
    metric: string,
    dimensions: Record<string, any>,
    structured?: { year?: number; quarter?: string; month?: string }
  ): string {
    const normalizedMetric = this.normalizeMetric(metric);
    const normalizedDims = Object.entries(dimensions)
      .filter(([_, v]) => !this.isUniqueIdentifier(String(v)))
      .map(([_, v]) => this.normalizeValue(String(v)).normalized)
      .filter((d) => d && d !== 'unknown');

    const timeParts: string[] = [];
    if (structured?.year) timeParts.push(String(structured.year));
    if (structured?.quarter) timeParts.push(structured.quarter);
    if (structured?.month) timeParts.push(structured.month);

    return [sheetName, normalizedMetric, ...normalizedDims, ...timeParts].filter(Boolean).join(' | ');
  }

  // ---- Query parser ----
  public parseQuery(query: string): {
    metrics: string[];
    dimensions: string[];
    filters: QueryFilters;
    timeFilters: { year?: number; quarter?: string; month?: string };
  } {
    const words = query.toLowerCase().split(/\s+/);
    const metrics: string[] = [];
    const dimensions: string[] = [];
    const filters: QueryFilters = {};
    const timeFilters: { year?: number; quarter?: string; month?: string } = {};

    words.forEach((word) => {
      const norm = this.normalizeValue(word);
      if (norm.category === 'metric') metrics.push(norm.normalized);
      if (norm.category === 'dimension') dimensions.push(norm.normalized);
      if (norm.category === 'time') {
        const hints = this.extractTimeHints(word);
        if (hints.year) timeFilters.year = hints.year;
        if (hints.quarter) timeFilters.quarter = hints.quarter;
        if (hints.month) timeFilters.month = hints.month;
      }
    });

    return { metrics, dimensions, filters, timeFilters };
  }

  // ---- Enhanced Query Normalization ----
  public normalizeQuery(query: string): string {
    if (!query || typeof query !== 'string') return '';
    
    console.log(`🔍 Normalizing query: "${query}"`);
    
    // Split query into meaningful phrases and words
    const phrases = this.extractPhrases(query);
    const normalizedParts: string[] = [];
    
    // Process each phrase/word
    phrases.forEach(phrase => {
      const normalized = this.normalizeValue(phrase);
      if (normalized.confidence > 0.3) { // Only include if we have reasonable confidence
        normalizedParts.push(normalized.normalized);
      } else {
        // For low confidence, try to extract meaningful parts
        const meaningfulParts = this.extractMeaningfulParts(phrase);
        normalizedParts.push(...meaningfulParts);
      }
    });
    
    // Remove duplicates and filter out empty values
    const uniqueParts = [...new Set(normalizedParts)].filter(part => 
      part && part !== 'unknown' && part.trim().length > 0
    );
    
    const normalizedQuery = uniqueParts.join(' | ');
    console.log(`📝 Normalized query: "${normalizedQuery}"`);
    
    return normalizedQuery;
  }

  // ---- Extract meaningful phrases from query ----
  private extractPhrases(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    const phrases: string[] = [];
    
    // Extract multi-word phrases that might be in our dictionary
    const multiWordPhrases = this.findMultiWordPhrases(lowerQuery);
    phrases.push(...multiWordPhrases);
    
    // Extract individual words that aren't part of multi-word phrases
    const words = lowerQuery.split(/\s+/);
    const usedWords = new Set<string>();
    
    // Mark words that are part of multi-word phrases
    multiWordPhrases.forEach(phrase => {
      phrase.split(/\s+/).forEach(word => usedWords.add(word));
    });
    
    // Add remaining individual words
    words.forEach(word => {
      if (!usedWords.has(word) && word.length > 2) { // Only meaningful words
        phrases.push(word);
      }
    });
    
    return phrases;
  }

  // ---- Find multi-word phrases in dictionary ----
  private findMultiWordPhrases(query: string): string[] {
    const phrases: string[] = [];
    
    // Check all categories for multi-word phrases
    Object.entries(semanticDictionary).forEach(([category, mappings]) => {
      Object.entries(mappings).forEach(([normalized, variants]) => {
        variants.forEach(variant => {
          if (variant.includes(' ') && query.includes(variant.toLowerCase())) {
            phrases.push(variant);
          }
        });
      });
    });
    
    return phrases;
  }

  // ---- Extract meaningful parts from low-confidence phrases ----
  private extractMeaningfulParts(phrase: string): string[] {
    const parts: string[] = [];
    const lowerPhrase = phrase.toLowerCase();
    
    // Check if any part of the phrase matches our dictionary
    Object.entries(semanticDictionary).forEach(([category, mappings]) => {
      Object.entries(mappings).forEach(([normalized, variants]) => {
        variants.forEach(variant => {
          if (lowerPhrase.includes(variant.toLowerCase())) {
            parts.push(normalized);
          }
        });
      });
    });
    
    // If no matches found, return the original phrase if it's meaningful
    if (parts.length === 0 && phrase.length > 2) {
      parts.push(phrase);
    }
    
    return parts;
  }
}

export const semanticNormalizer = SemanticNormalizer.getInstance();
