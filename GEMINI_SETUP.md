# 🚀 Gemini LLM Setup Guide

## 📋 Prerequisites

1. **Google Cloud Account** - You need a Google Cloud account
2. **Gemini API Access** - Enable Gemini API in Google AI Studio
3. **API Key** - Generate an API key from Google AI Studio

## 🔑 Getting Your Gemini API Key

### Step 1: Visit Google AI Studio
- Go to [Google AI Studio](https://aistudio.google.com/)
- Sign in with your Google account

### Step 2: Enable Gemini API
- Navigate to "Get API key" section
- Click "Create API key"
- Copy the generated API key

### Step 3: Configure Environment
Create a `.env.local` file in your project root:

```bash
# Gemini AI Configuration
GEMINI_API_KEY=your_actual_api_key_here

# MongoDB Configuration  
MONGO_DB_URL=mongodb+srv://ajay_db_owner:Mongo_SpaaS@cluster0.eedbshd.mongodb.net/SpaaS
```

## 🧪 Testing the Configuration

Run the test script to verify Gemini is working:

```bash
npm run test-gemini
```

Expected output:
```
🧪 Testing Gemini LLM Configuration...
Configuration valid: true
📊 Gemini Config: { model: 'gemini-1.5-flash', temperature: 0.3, maxTokens: 1000, hasApiKey: true }
✅ Gemini model created successfully
🤖 Testing generation with prompt: Hello! Please respond with 'Gemini is working!' and nothing else.
✅ Generation successful!
📝 Response: Gemini is working!
🎉 Gemini LLM is fully functional!
```

## ⚙️ Configuration Options

The Gemini configuration is managed in `config/llm-config.ts`:

```typescript
export const llmConfig: LLMConfig = {
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || 'default_key',
    model: 'gemini-1.5-flash',        // Model to use
    temperature: 0.3,                  // Creativity level (0.0 = focused, 1.0 = creative)
    maxTokens: 1000                    // Maximum response length
  }
};
```

## 🔧 Troubleshooting

### Common Issues:

1. **"API key not found"**
   - Ensure `.env.local` file exists in project root
   - Check that `GEMINI_API_KEY` is set correctly

2. **"Gemini model not initialized"**
   - Verify your API key is valid
   - Check internet connection
   - Ensure you have Gemini API access enabled

3. **"Generation failed"**
   - Check API quota limits
   - Verify model name is correct
   - Check API key permissions

### Testing Individual Components:

```bash
# Test Gemini configuration only
npm run test-gemini

# Test enhanced search with Gemini
npm run test-enhanced-search

# Test complete workflow
npm run test-complete-workflow
```

## 📚 Model Information

- **gemini-1.5-flash**: Fast, efficient model for most use cases
- **gemini-1.5-pro**: More capable model for complex reasoning
- **gemini-2.0-flash**: Latest model with improved performance

## 🔒 Security Notes

- Never commit your `.env.local` file to version control
- Keep your API key secure and rotate it regularly
- Monitor API usage to avoid unexpected charges
- Use environment variables for production deployments

## 🎯 Next Steps

Once Gemini is configured:

1. **Test the search functionality** - Upload an Excel file and try searching
2. **Verify LLM responses** - Check that AI-generated answers are working
3. **Monitor performance** - Watch for any errors in the console
4. **Customize prompts** - Modify the LLM prompt in `enhanced-search.ts`

## 📞 Support

If you encounter issues:

1. Check the console logs for detailed error messages
2. Verify your API key and permissions
3. Test with the provided test scripts
4. Check Google AI Studio status page for service issues
