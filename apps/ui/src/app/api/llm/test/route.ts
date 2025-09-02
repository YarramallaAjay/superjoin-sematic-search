import { NextRequest, NextResponse } from 'next/server';
import { config } from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// Load environment variables
config({ path: '.env.local' });

export async function GET(request: NextRequest) {
  try {
    const results = {
      google: false,
      deepseek: false,
      openai: false,
      errors: [] as string[]
    };

    // Test Google Gemini API
    try {
      const geminiApiKey = process.env.GEMINI_API_KEY || 'AIzaSyBcAwm2APnl4vWQw6ro8LiXtPbnCJsUmkI';
      if (geminiApiKey) {
        const genAI = new GoogleGenerativeAI(geminiApiKey);
        const model = genAI.getGenerativeModel({ model: 'embedding-001' });
        
        // Test with a simple embedding
        const testText = "test";
        const result = await model.embedContent(testText);
        
        if (result.embedding.values && result.embedding.values.length > 0) {
          results.google = true;
          console.log("✅ Google Gemini API working");
        }
      }
    } catch (error) {
      const errorMsg = `Google Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`;
      results.errors.push(errorMsg);
      console.error("❌ Google Gemini API failed:", error);
    }

    // Test DeepSeek API
    try {
      const googleKey = process.env.GEMINI_API_KEY || '';
      if (deepseekApiKey) {
        const deepseek = new OpenAI({
          apiKey: deepseekApiKey,
          baseURL: 'https://api.deepseek.com/v1',
        });
        
        // Test with a simple completion
        const completion = await deepseek.chat.completions.create({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10,
        });
        
        if (completion.choices && completion.choices.length > 0) {
          results.deepseek = true;
          console.log("✅ DeepSeek API working");
        }
      }
    } catch (error) {
      const errorMsg = `DeepSeek: ${error instanceof Error ? error.message : 'Unknown error'}`;
      results.errors.push(errorMsg);
      console.error("❌ DeepSeek API failed:", error);
    }

    // Test OpenAI API (if configured)
    try {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (openaiApiKey) {
        const openai = new OpenAI({
          apiKey: openaiApiKey,
        });
        
        // Test with a simple completion
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10,
        });
        
        if (completion.choices && completion.choices.length > 0) {
          results.openai = true;
          console.log("✅ OpenAI API working");
        }
      } else {
        console.log("ℹ️ OpenAI API key not configured");
      }
    } catch (error) {
      const errorMsg = `OpenAI: ${error instanceof Error ? error.message : 'Unknown error'}`;
      results.errors.push(errorMsg);
      console.error("❌ OpenAI API failed:", error);
    }

    // Return results
    return NextResponse.json({
      success: results.google || results.deepseek || results.openai,
      results,
      timestamp: new Date().toISOString(),
      message: results.errors.length > 0 
        ? `Some LLM APIs failed: ${results.errors.join(', ')}`
        : 'All configured LLM APIs are working'
    });

  } catch (error) {
    console.error('LLM test error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error during LLM testing',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
