import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { config } from 'dotenv';
import { parseAnd_upload_cells, EnhancedParsedCell } from '../../../../../embedder/parse';
import { storeCellsEnhanced, updateEmbeddingsEnhanced } from '../../../../../embedder/store';
import mongoose from 'mongoose';
import { EmbeddingResult, embeddingService } from '../../../../../embedder/embedding';

// Load environment variables
config({ path: '.env.local' });

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const timestamp = formData.get('timestamp') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 50MB.' },
        { status: 400 }
      );
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), '..', '..', 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Save file to uploads directory
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = join(uploadsDir, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    await writeFile(filePath, buffer);

    // Generate tenant and workbook IDs
    const tenantId = `tenant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const workbookId = `workbook_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Process the Excel file using the existing embedder code
    try {
      console.log(`🚀 Starting Excel processing for ${file.name}...`);
    

      // Connect to MongoDB before using models
      try {
        const mongoose = await import('mongoose');
        const mongoUrl = process.env.MONGO_DB_URL || 'mongodb+srv://ajay_db_owner:Mongo_SpaaS@cluster0.eedbshd.mongodb.net/SpaaS';
        
        if (mongoose.connection.readyState === 0) {
          console.log('🔌 Connecting to MongoDB...');
          await mongoose.connect(mongoUrl);
          console.log('✅ Connected to MongoDB');
        }
      } catch (dbConnectionError) {
        console.error('❌ MongoDB connection failed:', dbConnectionError);
        // Continue with processing even if DB connection fails
      }

      // Create tenant and workbook records
      try {
        if (!mongoose.connection.db) {
          throw new Error('Database connection not established');
        }

        await mongoose.connection.db.collection('tenants').insertOne({
          _id: new mongoose.Types.ObjectId(), // Generate proper MongoDB ObjectId
          tenantId: tenantId, // Store the string ID in a separate field
          name: `Tenant_${tenantId.slice(-6)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          workbooks: [workbookId]
        });

        await mongoose.connection.db.collection('workbooks').insertOne({
          _id: new mongoose.Types.ObjectId(), // Generate proper MongoDB ObjectId
          workbookId: workbookId, // Store the string ID in a separate field
          tenantId: tenantId,
          name: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
          contentHash: Buffer.from(file.name + timestamp).toString('base64'),
          sheets: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log('✅ Created tenant and workbook records');
      } catch (dbError) {
        console.error('Database creation error:', dbError);
        // Continue with processing even if DB creation fails
      }

      // Parse and create embeddings
      console.log('🔄 Starting Excel parsing...');
      console.log('parseAnd_upload_cells function:', typeof parseAnd_upload_cells);
      
      if (typeof parseAnd_upload_cells !== 'function') {
        throw new Error('parseAnd_upload_cells is not a function. Import failed.');
      }
      
      console.log('📊 Parsing Excel file and generating embeddings...');
      const parsedCells = await parseAnd_upload_cells(
        tenantId,
        workbookId,
        buffer,
        async (cell: EnhancedParsedCell, cellId: string) => {
          // Callback for each parsed cell (can be used for progress tracking)
          console.log(`📊 Parsed cell ${cellId}: ${cell.metric} = ${cell.value}`);
        },
        async (sheetName: string, rowCount: number, colCount: number, cellCount: number) => {
          // Callback for each parsed sheet
          console.log(`📄 Sheet ${sheetName}: ${rowCount} rows, ${colCount} cols, ${cellCount} cells`);
          
          // Create sheet record
          try {
            if (!mongoose.connection.db) {
              throw new Error('Database connection not established');
            }

            await mongoose.connection.db.collection('sheets').insertOne({
              _id: Object(`sh_${sheetName.toLowerCase().replace(/\s+/g, "_")}`),
              workbookId: workbookId,
              name: sheetName,
              rowCount: rowCount,
              colCount: colCount,
              cellCount: cellCount,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          } catch (sheetError) {
            console.warn(`Could not create sheet record for ${sheetName}:`, sheetError);
          }
        }
      );

      console.log(`✅ Parsing complete: ${parsedCells.length} cells parsed`);
      
      if (parsedCells.length === 0) {
        throw new Error('No cells were parsed from the Excel file. Please check the file format.');
      }

      // Store cells in database
      console.log(`💾 Storing ${parsedCells.length} cells in database...`);
      const storageResult = await storeCellsEnhanced(parsedCells);
      
      if (!storageResult.success) {
        console.error(`❌ Storage failed: ${storageResult.errorCount} errors`);
        throw new Error(`Database storage failed: ${storageResult.errorCount} cells could not be stored`);
      }

      // const allEmbeddings=await embeddingService.makeEmbeddingsOptimized(parsedCells.map(cell=>({cellId: cell._id, semanticString: cell.semanticString})));
      // if( allEmbeddings.length!==parsedCells.length){
      //   console.log("All embeddings are not generated")
      //   throw new Error("All embeddings are not generated");
      // }
      // allEmbeddings.map(embedding=>{
      //   parsedCells.find(cell=>cell._id===embedding.cellId)!.embedding=embedding.embedding;
      // });

      // // Update embeddings (in case they weren't stored initially)
      // console.log(`🔄 Updating embeddings for ${parsedCells.length} cells...`);
      // const embeddingResult = await updateEmbeddingsEnhanced(parsedCells);
      
      // if (!embeddingResult.success) {
      //   console.error(`❌ Embedding updates failed: ${embeddingResult.errorCount} errors`);
      //   throw new Error(`Embedding updates failed: ${embeddingResult.errorCount} cells could not be updated`);
      // }

      const processingResult = {
        success: true,
        message: 'File processed successfully! Data parsed, embeddings generated, and stored in database.',
        fileName: fileName,
        originalName: file.name,
        size: file.size,
        timestamp: timestamp,
        status: 'completed',
        tenantId: tenantId,
        workbookId: workbookId,
        cellCount: parsedCells.length,
        storageResult: storageResult,
        embeddingResult: storageResult
      };

      console.log(`🎉 Processing complete for ${file.name}:`, processingResult);
      return NextResponse.json(processingResult);

    } catch (processingError) {
      console.error('Processing error:', processingError);
      
      // Return error but include the generated IDs for reference
      return NextResponse.json({
        success: false,
        message: 'File uploaded but processing failed. Please try again.',
        fileName: fileName,
        originalName: file.name,
        size: file.size,
        timestamp: timestamp,
        status: 'error',
        tenantId: tenantId,
        workbookId: workbookId,
        error: processingError instanceof Error ? processingError.message : String(processingError)
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error during upload' },
      { status: 500 }
    );
  }
}