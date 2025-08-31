import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB() {
  if (isConnected) {
    console.log('Using existing database connection');
    return;
  }

  try {
    const uri =process.env.MONGO_DB_URL||'mongodb+srv://ajay_db_owner:Mongo_SpaaS@cluster0.eedbshd.mongodb.net/';
    
    console.log('Attempting to connect to MongoDB...');
    
    await mongoose.connect(uri, {
      dbName: 'SpaaS', // Specify database name separately
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000, // Increased timeout for server selection
      socketTimeoutMS: 60000, // Increased socket timeout
      connectTimeoutMS: 30000, // Increased connection timeout
      bufferCommands: false, // Disable buffering to prevent timeout issues
      // Additional timeout settings for operations
      maxIdleTimeMS: 30000,
      waitQueueTimeoutMS: 30000,
    });

    isConnected = true;
    console.log('Connected to MongoDB with Mongoose successfully');
    console.log('Connection state:', mongoose.connection.readyState);
    console.log('Database name:', mongoose.connection.name);
    
    // Test the connection
    
    
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    isConnected = false;
    throw new Error(`Failed to connect to MongoDB: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function disconnectDB() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('Disconnected from MongoDB');
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await disconnectDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await disconnectDB();
  process.exit(0);
});
export {mongoose};
