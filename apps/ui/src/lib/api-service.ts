import { SearchRequest, SearchResponse, SearchResult, LLMResponse } from './search-client';

export interface UploadResponse {
  success: boolean;
  message: string;
  fileName?: string;
  documentCount?: number;
  processingTime?: number;
  tenantId?: string;
  workbookId?: string;
  cellCount?: number;
  status?: string;
  storageResult?: any;
  embeddingResult?: any;
}

export interface ProcessingStatus {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  fileName?: string;
}

class APIService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
  }

  // Excel Upload and Processing
  async uploadExcelFile(file: File): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('timestamp', new Date().toISOString());

      const response = await fetch(`${this.baseUrl}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  }

  // Semantic Search
  async performSearch(request: SearchRequest): Promise<SearchResponse> {
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
      console.error('Search error:', error);
      throw error;
    }
  }

  // Get Processing Status
  async getProcessingStatus(fileName: string): Promise<ProcessingStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/status?fileName=${encodeURIComponent(fileName)}`);
      
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Status check error:', error);
      throw error;
    }
  }

  // Get Available Data
  async getAvailableData(): Promise<{
    collections: string[];
    documentCounts: Record<string, number>;
    lastUpdated: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/data/status`);
      
      if (!response.ok) {
        throw new Error(`Data status check failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Data status error:', error);
      throw error;
    }
  }

  // Test LLM Connection
  async testLLMConnection(): Promise<{
    google: boolean;
    deepseek: boolean;
    openai: boolean;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/llm/test`);
      
      if (!response.ok) {
        throw new Error(`LLM test failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('LLM test error:', error);
      throw error;
    }
  }
}

export const apiService = new APIService();
