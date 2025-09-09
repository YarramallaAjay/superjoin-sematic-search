import { config } from "dotenv";

/**
 * Centralized Configuration for Superjoin Semantic Search
 * All environment variables and API endpoints in one place
 */
config()
// API URLs
export const API_CONFIG = {
  // Backend API URL
  BACKEND_URL: process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_URL || 'https://superjoin-backend.onrender.com' || 'http://localhost:3001',
  
  // Frontend API URL (for internal API calls)
  FRONTEND_URL: process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3001',
  


  // Supabase configuration
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL|| 'https://nlzrbiizpgplukaauvgx.supabase.co',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY|| 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5senJiaWl6cGdwbHVrYWF1dmd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMzYxNzQsImV4cCI6MjA3MjkxMjE3NH0.TBS7jy_v878vzXWYnyjE192TGAM4SdcVdXukcPMTNsc',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
} as const;

// Database configuration
export const DATABASE_CONFIG = {
  MONGO_DB_URL: process.env.MONGO_DB_URL!,
} as const;

// AI/ML API Keys
export const AI_CONFIG = {
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
} as const;

// Storage configuration
export const STORAGE_CONFIG = {
  UPLOAD_BUCKET: 'uploads',
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  RECOMMENDED_FILE_SIZE: 5 * 1024 * 1024, // 5MB for optimal processing
  ALLOWED_EXTENSIONS: ['.xlsx', '.xls', '.csv'],
} as const;

// Job processing configuration
export const JOB_CONFIG = {
  BATCH_SIZE: 100,
  TIMEOUT_MS: 10 * 60 * 1000, // 10 minutes
  POLL_INTERVAL_MS: 30 * 1000, // 30 seconds
  MAX_RETRIES: 60, // 30 minutes total
} as const;

// Validation helpers
export function validateConfig(): { isValid: boolean; missingVars: string[] } {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
    'MONGO_DB_URL'
  ];
  
  const missingVars = requiredVars.filter(varName => {
    const value = process.env[varName];
    return !value || value.trim() === '';
  });
  
  return {
    isValid: missingVars.length === 0,
    missingVars
  };
}

export default {
  API_CONFIG,
  DATABASE_CONFIG,
  AI_CONFIG,
  STORAGE_CONFIG,
  JOB_CONFIG,
  validateConfig
};