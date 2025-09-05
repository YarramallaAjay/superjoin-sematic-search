import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';

export async function GET() {
  try {
    // Connect to MongoDB
    const mongoUrl = process.env.MONGO_DB_URL || 'mongodb+srv://ajay_db_owner:Mongo_SpaaS@cluster0.eedbshd.mongodb.net/SpaaS';
    if (!mongoUrl) {
      console.error('❌ MongoDB URL not configured');
      return NextResponse.json({ error: 'MongoDB URL not configured' }, { status: 500 });
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUrl);
    console.log('✅ Connected to MongoDB');

    // Ensure connection is established
    if (!mongoose.connection.db) {
      throw new Error('Database connection not established');
    }

    // Get the database instance
    const db = mongoose.connection.db;
    console.log(`📊 Database: ${db.databaseName}`);
    
    // List all collections to debug
    const collections = await db.listCollections().toArray();
    console.log('📋 Available collections:', collections.map(c => c.name));
    
    // Fetch all workbooks directly from the workbooks collection
    const workbooksCollection = db.collection('workbooks');
    console.log('🔍 Fetching from workbooks collection...');
    
    const workbooks = await workbooksCollection.find({}).toArray();
    console.log(`✅ Fetched ${workbooks.length} workbooks`);

    // Log first few workbooks for debugging
    if (workbooks.length > 0) {
      console.log('📋 Sample workbooks:', workbooks.slice(0, 2).map(wb => ({
        _id: wb._id,
        workbookId: wb.workbookId,
        name: wb.name,
        tenantId: wb.tenantId
      })));
    }

    // Transform the results to match our interface
    const transformedWorkbooks = workbooks.map(wb => {
      // Handle different ID formats:
      // 1. New format: wb.workbookId (string)
      // 2. Old format: wb._id (ObjectId) - convert to string
      // 3. Fallback: if _id is an object with numeric keys, extract the string
      let idToUse;
      
      if (wb.workbookId) {
        // New format - use workbookId field
        idToUse = wb.workbookId;
      } else if (wb._id && typeof wb._id === 'object' && wb._id.constructor?.name === 'ObjectId') {
        // Old format - ObjectId, convert to string
        idToUse = wb._id.toString();
      } else if (wb._id && typeof wb._id === 'object' && Object.keys(wb._id).every(key => !isNaN(Number(key)))) {
        // Fallback - object with numeric keys, extract string
        idToUse = Object.values(wb._id).join('');
      } else {
        // Last resort - try toString or use a default
        idToUse = wb._id?.toString() || 'unknown';
      }
      
      console.log(`🔄 Transforming workbook ID:`, {
        original: wb._id,
        workbookId: wb.workbookId,
        idToUse: idToUse,
        type: typeof idToUse,
        finalType: typeof idToUse
      });
      
      return {
        id: idToUse, // Use the string ID
        name: wb.name || `Workbook ${idToUse.slice(-6)}`,
        tenantId: wb.tenantId,
        tenantName: `Tenant_${wb.tenantId.slice(-4)}`, // Simple tenant naming for now
        createdAt: wb.createdAt,
        updatedAt: wb.updatedAt
      };
    });

    console.log(`✅ Returning ${transformedWorkbooks.length} transformed workbooks`);

    return NextResponse.json({
      success: true,
      workbooks: transformedWorkbooks
    });

  } catch (error) {
    console.error('❌ Error fetching workbooks:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch workbooks',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    // Close the connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}
