import axios from "axios";

// Use local API routes to avoid CORS issues
const API_URL = '/api';

export interface Workbook {
  id: string;
  name: string;
  tenantId: string;
  tenantName: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkbooksResponse {
  success: boolean;
  workbooks: Workbook[];
  error?: string;
}

export interface UploadResponse {
  success: boolean;
  tenantId?: string;
  workbookId?: string;
  cellCount?: number;
  error?: string;
  message?: string;
}

export interface SearchResult {
  _id: string;
  tenantId: string;
  workbookId: string;
  sheetId: string;
  sheetName: string;
  cellAddress: string;
  semanticString: string;
  metric: string;
  value: string | number | Date | null;
  year?: number;
  month?: string;
  quarter?: string;
  dimensions: Record<string, string | number | Date | null>;
  score: number;
}

export interface LLMResponse {
  answer: string;
  confidence: number;
  reasoning: string;
  keyInsights?: string;
  dataPoints: number;
  sources: string[];
  generatedTable?: string;
}

export interface SearchResponse {
  success: boolean;
  query?: string;
  enhancedQuery?: Record<string, unknown>;
  vectorResults?: SearchResult[];
  structuredData?: SearchResult[];
  llmResponse?: LLMResponse;
  generatedTable?: string;
  error?: string;
}

export class ApiService {
  /**
   * Upload Excel file for processing
   */
  async uploadExcelFile(file: File): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
        headers:{
          'Access-Control-Allow-Origin':'*'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Fetch available workbooks
   */
  async fetchWorkbooks(): Promise<WorkbooksResponse> {
    try {
      const response = await fetch(`${API_URL}/workbooks`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching workbooks:', error);
      throw error;
    }
  }

  /**
   * Perform semantic search using the selected workbook
   */
  async searchWithWorkbook(
    query: string, 
    workbookId: string, 
    tenantId: string,
    topK: number = 50
  ): Promise<SearchResponse> {
    try {
      const response = await fetch(`${API_URL}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          workbookId,
          tenantId,
          topK
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      console.log(response)

      return await response.json();
    } catch (error) {
      console.error('Error performing search:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
