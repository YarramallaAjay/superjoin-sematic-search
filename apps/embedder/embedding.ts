import { Models } from '@google/genai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';

config({ path: '.env.local' });

let modelLoaded = false;
let model: any;

async function embeddingProvider() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyBcAwm2APnl4vWQw6ro8LiXtPbnCJsUmkI');
  model = genAI.getGenerativeModel({ model: 'embedding-001' });
  if (model) modelLoaded = true;
  return model;
}

// Retry function with exponential backoff and better error handling
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`⚠️  Embedding attempt ${attempt + 1} failed:`, errorMessage);
      
      if (attempt === maxRetries) {
        console.error(`❌ Max retries (${maxRetries}) exceeded for embedding`);
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`⏳ Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

async function makeEmbeddings(semanticStrings: string[]): Promise<number[][]> {
  if (!modelLoaded) {
    await embeddingProvider();
  }
  
  console.log(`🔄 Generating embeddings for ${semanticStrings.length} strings...`);
  
  // Process in smaller batches to avoid rate limits
  const batchSize = 15; // Reduced batch size
  const embeddings: number[][] = [];
  
  for (let i = 0; i < semanticStrings.length; i += batchSize) {
    const batch = semanticStrings.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(semanticStrings.length / batchSize);
    
    console.log(`   → Processing batch ${batchIndex}/${totalBatches} (${batch.length} items)`);
    
    // Process batch with retry logic
    const batchPromises = batch.map(async (string, index) => {
      return retryWithBackoff(async () => {
        try {
          // Validate string before sending to API
          if (!string || string.trim().length === 0) {
            console.warn(`⚠️  Skipping empty string at index ${i + index}`);
            return new Array(768).fill(0);
          }
          
          const result = await model.embedContent(string);
          return result.embedding.values;
        } catch (error) {
          console.error(`❌ Failed to embed text at index ${i + index}:`, error);
          // Return a zero vector as fallback
          return new Array(768).fill(0);
        }
      }, 3, 2000); // 3 retries, 2 second base delay
    });
    
    const batchResults = await Promise.all(batchPromises);
    embeddings.push(...batchResults);
    
    // Add delay between batches to avoid rate limiting
    if (i + batchSize < semanticStrings.length) {
      console.log(`   ⏳ Waiting 1 second before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`✅ Generated ${embeddings.length} embeddings successfully`);
  return embeddings;
}

// Optimized version for large batches with better error handling
async function makeEmbeddingsOptimized(semanticStrings: string[]): Promise<number[][]> {
  if (!modelLoaded) {
    await embeddingProvider();
  }
  
  console.log(`🚀 Optimized embedding generation for ${semanticStrings.length} strings...`);
  
  // Log all strings being processed for debugging
  console.log(`📋 All strings to be embedded:`);
  semanticStrings.forEach((str, idx) => {
    console.log(`   ${idx + 1}: "${str}"`);
  });
  
  // Use smaller batches for better reliability
  const batchSize = 20; // Reduced from 10 to avoid overwhelming API
  const embeddings: number[][] = [];
  
  // Process batches sequentially to avoid overwhelming the API
  for (let i = 0; i < semanticStrings.length; i += batchSize) {
    const batch = semanticStrings.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(semanticStrings.length / batchSize);
    
    console.log(`   → Processing batch ${batchIndex}/${totalBatches} (${batch.length} items)`);
    
    // Process batch items sequentially instead of parallel to reduce API load
    const batchResults: number[][] = [];
    for (let j = 0; j < batch.length; j++) {
      const string = batch[j];
      const globalIndex = i + j;
      
      try {
        const embedding = await retryWithBackoff(async () => {
          // Validate string before sending to API
          if (!string || string.trim().length === 0) {
            console.warn(`⚠️  Skipping empty string at global index ${globalIndex}`);
            return new Array(768).fill(0);
          }
          
          console.log(`   🔄 Embedding: "${string}" (index ${globalIndex + 1})`);
          const result = await model.embedContent(string);
          console.log(`   ✅ Successfully embedded: "${string}"`);
          return result.embedding.values;
        }, 5, 2000); // Increased to 5 retries, 2 second base delay
        
        batchResults.push(embedding);
             } catch (error) {
         const errorMessage = error instanceof Error ? error.message : String(error);
         console.error(`❌ Failed to embed text in batch ${batchIndex}, item ${j + 1}: "${string}"`);
         console.error(`   Error:`, errorMessage);
         // Return a zero vector as fallback
         batchResults.push(new Array(768).fill(0));
       }
      
      // Add small delay between individual items to avoid rate limiting
      if (j < batch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    embeddings.push(...batchResults);
    console.log(`   ✅ Completed batch ${batchIndex}/${totalBatches}`);
    
    // Add longer delay between batches
    if (i + batchSize < semanticStrings.length) {
        console.log(`   ⏳ Waiting 3 seconds before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  console.log(`✅ Optimized embedding generation complete: ${embeddings.length} embeddings`);
  return embeddings;
}

export { embeddingProvider, makeEmbeddings, makeEmbeddingsOptimized };
