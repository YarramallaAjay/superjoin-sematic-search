const { connectDB, disconnectDB } = require('../models/db');
const { model } = require('../embedder/search');

const testDBConnection = async () => {
    try {
        await connectDB();
        console.log('Database connection test successful');
    } catch (error) {
        console.error('Database connection test failed:', error);
    }
};

const testGeminiConnection = async () => {
    try {
        const response = await model.generateContent('Hello, how are you?');
        console.log('Gemini connection successful');
        console.log('Response:', response.response?.text() || 'No text in response');
    } catch (error) {
        console.error('Gemini connection test failed:', error);
    }
};

const runTests = async () => {
    console.log('Testing database connection...');
    await testDBConnection();
    
    console.log('\nTesting Gemini connection...');
    await testGeminiConnection();
    
    // Close connections
    await disconnectDB();
    process.exit(0);
};

runTests();
