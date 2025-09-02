import { NextRequest, NextResponse } from 'next/server';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

export async function POST(request: NextRequest) {
  try {
    const { query, tenantId, workbookId } = await request.json();

    if (!query || !tenantId || !workbookId) {
      return NextResponse.json(
        { error: 'Missing required fields: query, tenantId, workbookId' },
        { status: 400 }
      );
    }

    // Try to use the core backend if available
    try {
      // Dynamic import of the core backend
      const enhancedSearchModule = await import('../../../../../embedder/enhanced-search');
      const EnhancedSearch = enhancedSearchModule.EnhancedSearch;
      
      // Initialize and connect to the search system
      const enhancedSearch = new EnhancedSearch();
      await enhancedSearch.connect();
      
      // Perform the semantic search
      const results = await enhancedSearch.semanticSearch({
        query,
        tenantId,
        workbookId,
        topK: 50
      });
      
      if (!results) {
        throw new Error('No search results returned');
      }

      console.log(`✅ Search completed successfully for query: "${query}"`);
      return NextResponse.json(results);

    } catch (backendError) {
      console.warn('Backend integration failed, using fallback mock data:', backendError);
      
      // Fallback to basic mock data if backend fails
      const fallbackResults = {
        query,
        enhancedQuery: {
          originalQuery: query,
          normalizedQuery: `fallback ${query.toLowerCase()}`,
          metrics: ['revenue'],
          dimensions: ['region'],
          timeFilters: { year: 2023 },
          businessContext: "Fallback mock data - backend connection failed"
        },
        vectorResults: [],
        structuredData: [
          {
            _id: 'fallback_1',
            tenantId,
            workbookId,
            sheetId: 'sheet_1',
            semanticString: 'Revenue | Global | 2023',
            metric: 'Revenue',
            normalizedMetric: 'revenue',
            value: 1000000,
            year: 2023,
            score: 0.5
          }
        ],
        llmResponse: {
          answer: "This is a fallback response. The backend integration failed with error: " + (backendError instanceof Error ? backendError.message : String(backendError)),
          confidence: 0.3,
          reasoning: "Fallback mode due to backend connection issues",
          dataPoints: 1,
          sources: ["Fallback data"]
        },
        searchMetadata: {
          queryEnhancementTime: 100,
          vectorSearchTime: 0,
          structuredDataTime: 50,
          llmGenerationTime: 100,
          totalTime: 250
        }
      };

      return NextResponse.json(fallbackResults);
    }

  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
