import { NextRequest, NextResponse } from 'next/server';
import { config } from 'dotenv';
import { EnhancedSearch } from '../../../../../embedder/enhanced-search';

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
      // Initialize the EnhancedSearch instance
      const search = new EnhancedSearch();
      
      // Connect to the database
      await search.connect();
      
      // Perform the semantic search
      const results = await search.semanticSearch({
        query,
        tenantId,
        workbookId,
        topK: 50
      });
      
      if (!results) {
        throw new Error('No search results returned');
      }

      // Clean up the connection
      await search.disconnect();

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
            sheetName: 'Fallback Sheet',
            rowName: 'Global',
            colName: 'Revenue',
            rowIndex: 1,
            colIndex: 1,
            cellAddress: 'A1',
            dataType: 'number',
            unit: 'USD',
            features: {
              isPercentage: false,
              isMargin: false,
              isGrowth: false,
              isAggregation: false,
              isForecast: false,
              isUniqueIdentifier: false
            },
            sourceCell: 'A1',
            sourceFormula: '',
            metric: 'Revenue',
            value: 1000000,
            year: 2023,
            month: undefined,
            quarter: undefined,
            dimensions: {}
          }
        ],
        llmResponse: {
          answer: "This is a fallback response. The backend integration failed with error: " + (backendError instanceof Error ? backendError.message : String(backendError)),
          confidence: 0.3,
          reasoning: "Fallback mode due to backend connection issues",
          dataPoints: 1,
          sources: ["Fallback data"],
          generatedTable: ""
        },
        generatedTable: "",
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
