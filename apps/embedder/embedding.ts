import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "dotenv";

config();
export interface EmbeddingRequest {
  cellId: string;
  semanticString: string;
}

export interface EmbeddingResult {
  cellId: string;
  embedding: number[];
  index: number;
}

export class EmbeddingService {
  private model: any;
  private modelLoaded: boolean = false;
  private readonly batchSize: number = 20;
  private readonly retryAttempts: number = 5;
  private readonly retryDelay: number = 2000;
  private readonly itemDelay: number = 500;
  private readonly batchDelay: number = 1500;

  /**
   * Initialize the embedding model
   */
  private async initializeModel(): Promise<void> {
    if (this.modelLoaded) return;

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyBcAwm2APnl4vWQw6ro8LiXtPbnCJsUmkI');
      this.model = genAI.getGenerativeModel({ model: "embedding-001" });
      this.modelLoaded = true;
      console.log("✅ Embedding model initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize embedding model:", error);
      throw error;
    }
  }

  /**
   * Retry mechanism with exponential backoff
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.retryAttempts,
    baseDelay: number = this.retryDelay
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`   ⏳ Retry attempt ${attempt}/${maxRetries} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  /**
   * Process a single embedding request
   */
  private async processSingleEmbedding(
    request: EmbeddingRequest,
    globalIndex: number
  ): Promise<EmbeddingResult> {
    try {
      // Validate string before sending to API
      if (!request.semanticString || request.semanticString.trim().length === 0) {
        console.warn(`⚠️  Skipping empty string for cellId: ${request.cellId}`);
        return {
          cellId: request.cellId,
          embedding: new Array(768).fill(0),
          index: globalIndex
        };
      }

      console.log(`   🔄 Embedding: "${request.semanticString}" (cellId: ${request.cellId}, index: ${globalIndex + 1})`);
      
      const result = await this.retryWithBackoff(async () => {
        return await this.model.embedContent(request.semanticString);
      });
      
      console.log(`   ✅ Successfully embedded: "${request.semanticString}" for cellId: ${request.cellId}`);
      
      return {
        cellId: request.cellId,
        embedding: result.embedding.values,
        index: globalIndex
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to embed text for cellId: ${request.cellId}: "${request.semanticString}"`);
      console.error(`   Error:`, errorMessage);
      
      // Return a zero vector as fallback
      return {
        cellId: request.cellId,
        embedding: new Array(768).fill(0),
        index: globalIndex
      };
    }
  }

  /**
   * Process a batch of embedding requests
   */
  private async processBatch(
    batch: EmbeddingRequest[],
    batchIndex: number,
    totalBatches: number,
    startIndex: number
  ): Promise<EmbeddingResult[]> {
    console.log(`   → Processing batch ${batchIndex}/${totalBatches} (${batch.length} items)`);
    
    const batchResults: EmbeddingResult[] = [];
    
    // Process batch items sequentially to avoid overwhelming the API
    for (let j = 0; j < batch.length; j++) {
      const request = batch[j];
      const globalIndex = startIndex + j;
      
      const result = await this.processSingleEmbedding(request, globalIndex);
      batchResults.push(result);
      
      // Add small delay between individual items to avoid rate limiting
      if (j < batch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, this.itemDelay));
      }
    }
    
    console.log(`   ✅ Completed batch ${batchIndex}/${totalBatches}`);
    return batchResults;
  }

  /**
   * Create batches from the input array
   */
  private createBatches(requests: EmbeddingRequest[]): EmbeddingRequest[][] {
    const batches: EmbeddingRequest[][] = [];
    
    for (let i = 0; i < requests.length; i += this.batchSize) {
      batches.push(requests.slice(i, i + this.batchSize));
    }
    
    return batches;
  }

  /**
   * Main method to generate embeddings with batching and async processing
   */
  async makeEmbeddingsOptimized(requests: EmbeddingRequest[]): Promise<{cellId: string, embedding: number[]}[]> {
    // Initialize model if not already loaded
    await this.initializeModel();
    
    console.log(`🚀 Optimized embedding generation for ${requests.length} strings...`);
    
    // Log all strings being processed for debugging
    console.log(`📋 All strings to be embedded:`);
    requests.forEach((req, idx) => {
      console.log(`   ${idx + 1}: "${req.semanticString}" (cellId: ${req.cellId})`);
    });
    
    // Create batches
    const batches = this.createBatches(requests);
    const totalBatches = batches.length;
    const embeddings:{cellId: string, embedding: number[]}[] = [];
    
    // Process batches sequentially to avoid overwhelming the API
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchIndex = i + 1;
      const startIndex = i * this.batchSize;
      
      // Process the batch
      const batchResults = await this.processBatch(batch, batchIndex, totalBatches, startIndex);
      
      // Map results back to their original positions using cellId
      for (const result of batchResults) {
        const originalIndex = requests.findIndex(req => req.cellId === result.cellId);
        if (originalIndex !== -1) {
          embeddings.push(result);
        }
      }
      
      // Add longer delay between batches
      if (i < batches.length - 1) {
        console.log(`   ⏳ Waiting ${this.batchDelay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, this.batchDelay));
      }
    }
    
    console.log(`✅ Optimized embedding generation complete: ${embeddings.length} embeddings`);
    return embeddings;
  }

  /**
   * Alternative method using Promise.all for parallel processing within batches
   */
  async makeEmbeddingsParallel(requests: EmbeddingRequest[]): Promise<{cellId: string, embedding: number[]}[]> {
    // Initialize model if not already loaded
    await this.initializeModel();
    
    console.log(`🚀 Parallel embedding generation for ${requests.length} strings...`);
    
    // Create batches
    const batches = this.createBatches(requests);
    const totalBatches = batches.length;
    const embeddings: {cellId: string, embedding: number[]}[] = [];
    
    // Process batches sequentially, but items within each batch in parallel
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchIndex = i + 1;
      const startIndex = i * this.batchSize;
      
      console.log(`   → Processing batch ${batchIndex}/${totalBatches} (${batch.length} items) in parallel`);
      
      // Process batch items in parallel using Promise.all
      const batchPromises = batch.map((request, j) => {
        const globalIndex = startIndex + j;
        return this.processSingleEmbedding(request, globalIndex);
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // Map results back to their original positions using cellId
      for (const result of batchResults) {
        const originalIndex = requests.findIndex(req => req.cellId === result.cellId);
        if (originalIndex !== -1) {
          embeddings.push(result);
        }
      }
      
      console.log(`   ✅ Completed batch ${batchIndex}/${totalBatches}`);
      
      // Add delay between batches
      if (i < batches.length - 1) {
        console.log(`   ⏳ Waiting ${this.batchDelay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, this.batchDelay));
      }
    }
    
    console.log(`✅ Parallel embedding generation complete: ${embeddings.length} embeddings`);
    return embeddings;
  }
}

// Export singleton instance for backward compatibility
export const embeddingService = new EmbeddingService();

// Legacy function export for backward compatibility
export const makeEmbeddingsOptimized = embeddingService.makeEmbeddingsOptimized.bind(embeddingService);
