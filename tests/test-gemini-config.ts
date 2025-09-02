import { GoogleGenerativeAI } from "@google/generative-ai";
import { llmConfig, validateLLMConfig } from "../apps/config/llm-config";

async function testGeminiConfig() {
  console.log("🧪 Testing Gemini LLM Configuration...");
  
  // Validate configuration
  const isValid = validateLLMConfig();
  console.log(`Configuration valid: ${isValid}`);
  
  // Test Gemini initialization
  try {
    const geminiConfig = llmConfig.gemini;
    console.log("📊 Gemini Config:", {
      model: geminiConfig.model,
      temperature: geminiConfig.temperature,
      maxTokens: geminiConfig.maxTokens,
      hasApiKey: !!geminiConfig.apiKey
    });
    
    const genAI = new GoogleGenerativeAI(geminiConfig.apiKey);
    const model = genAI.getGenerativeModel({ 
      model: geminiConfig.model,
      generationConfig: {
        temperature: geminiConfig.temperature,
        maxOutputTokens: geminiConfig.maxTokens
      }
    });
    
    console.log("✅ Gemini model created successfully");
    
    // Test a simple generation
    const prompt = "Hello! Please respond with 'Gemini is working!' and nothing else.";
    console.log("🤖 Testing generation with prompt:", prompt);
    
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    console.log("✅ Generation successful!");
    console.log("📝 Response:", response);
    
    if (response.includes("Gemini is working")) {
      console.log("🎉 Gemini LLM is fully functional!");
    } else {
      console.log("⚠️ Response format unexpected, but generation worked");
    }
    
  } catch (error) {
    console.error("❌ Gemini test failed:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
  }
}

// Run the test
testGeminiConfig().catch(console.error);
