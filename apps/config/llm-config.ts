import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

export interface LLMConfig {
  gemini: {
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  mongo: {
    url: string;
    database: string;
    collections: {
      atlascells: string;
      atlasCell: string;
      analysis: string;
    };
  };
}

export const llmConfig: LLMConfig = {
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || 'AIzaSyBcAwm2APnl4vWQw6ro8LiXtPbnCJsUmkI',
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    maxTokens: 2000
  },
  mongo: {
    url: process.env.MONGO_DB_URL || 'mongodb+srv://ajay_db_owner:Mongo_SpaaS@cluster0.eedbshd.mongodb.net/SpaaS',
    database: 'SpaaS',
    collections: {
      atlascells: 'atlascells',
      atlasCell: 'AtlasCell',
      analysis: 'analysis'
    }
  }
};

export function validateLLMConfig(): boolean {
  const requiredEnvVars = ['GEMINI_API_KEY', 'MONGO_DB_URL'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`⚠️ Missing environment variables: ${missingVars.join(', ')}`);
    console.warn('Using default values from code');
    return false;
  }
  
  console.log('✅ All required environment variables are set');
  return true;
}

export function getGeminiConfig() {
  return llmConfig.gemini;
}

export function getMongoConfig() {
  return llmConfig.mongo;
}
