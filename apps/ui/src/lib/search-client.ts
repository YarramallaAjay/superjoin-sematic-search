export interface SearchRequest {
  query: string;
  tenantId: string;
  workbookId: string;
  topK?: number;
}

export interface SearchResult {
  _id: string;
  tenantId: string;
  workbookId: string;
  sheetId: string;
  semanticString: string;
  metric: string;
  normalizedMetric: string;
  value: number | string;
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

export interface LLMResponse {
  answer: string;
  confidence: number;
  reasoning: string;
  dataPoints: number;
  sources: string[];
}

export interface SearchResponse {
  query: string;
  enhancedQuery: {
    originalQuery: string;
    normalizedQuery: string;
    metrics: string[];
    dimensions: string[];
    timeFilters: { year?: number; quarter?: string; month?: string };
    businessContext: string;
  };
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
}

class SearchClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Search client error:', error);
      throw error;
    }
  }

  // Method to directly call the backend (for development/testing)
  async searchBackend(request: SearchRequest): Promise<SearchResponse> {
    // This would be used when we have the backend running separately
    // For now, it falls back to the API route
    return this.search(request);
  }

  // Utility method to format search results for display
  formatResults(results: SearchResult[]) {
    return results.map(result => ({
      ...result,
      displayValue: this.formatValue(result.value),
      displayScore: this.formatScore(result.score),
    }));
  }

  private formatValue(value: number | string): string {
    if (typeof value === 'number') {
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(1)}K`;
      } else {
        return `$${value.toLocaleString()}`;
      }
    }
    return String(value);
  }

  private formatScore(score: number): string {
    if (score >= 0.9) return 'Very High';
    if (score >= 0.7) return 'High';
    if (score >= 0.5) return 'Medium';
    if (score >= 0.3) return 'Low';
    return 'Very Low';
  }
}

export const searchClient = new SearchClient();
