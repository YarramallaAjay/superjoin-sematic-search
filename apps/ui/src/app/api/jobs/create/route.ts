import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { jobStore, JobData } from '@/lib/persistent-job-store';
import { API_CONFIG, STORAGE_CONFIG, JOB_CONFIG } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, fileSize, filePath, storageBucket = 'uploads', tenantId, workbookId } = body;

    if (!fileName || !fileSize || !filePath) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: fileName, fileSize, filePath' },
        { status: 400 }
      );
    }

    // Check file size - recommend smaller files for better processing
    if (fileSize > STORAGE_CONFIG.RECOMMENDED_FILE_SIZE) {
      console.warn(`⚠️ Large file detected: ${Math.round(fileSize / 1024 / 1024)}MB. Processing may take longer or timeout.`);
    }

    // Generate unique job ID
    const jobId = uuidv4();

    // Create job record
    const job: JobData = {
      jobId,
      fileName,
      fileSize,
      filePath,
      storageBucket,
      tenantId,
      workbookId,
      status: 'queued',
      progress: 0,
      currentStep: 'Job created, waiting for processing...',
      errorMessage: undefined,
      resultData: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: undefined
    };

    // Store job using job store
    jobStore.set(jobId, job);
    
    console.log(`✅ Job created: ${jobId} for file: ${fileName}`);
    
    // Start processing immediately
    processJobAsync(jobId).catch(console.error);

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Job created successfully'
    });

  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// Simple job processing: Download from Supabase and call backend
async function processJobAsync(jobId: string) {
  const job = jobStore.get(jobId);
  if (!job) return;

  try {
    console.log(`🚀 Processing job: ${jobId}`);
    
    updateJob(jobId, {
      status: 'parsing',
      progress: 20,
      currentStep: 'Downloading file from Supabase...'
    });

    // Download file from Supabase
    const fileBlob = await downloadFileFromSupabase(job.filePath);
    if (!fileBlob) {
      throw new Error('Failed to download file from Supabase');
    }

    updateJob(jobId, {
      status: 'parsing',
      progress: 50,
      currentStep: 'Sending to backend for processing...'
    });

    // Send to optimized backend for processing (single endpoint, fast embeddings)
    const formData = new FormData();
    formData.append('file', fileBlob, job.fileName);

    console.log(`📤 Calling optimized backend: ${API_CONFIG.BACKEND_URL}/api/upload`);

    // Use longer timeout with optimized backend
    const response = await fetch(`${API_CONFIG.BACKEND_URL}/api/upload`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(300000) // 5 minutes with fast embeddings
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // If it's a 504 timeout, provide more helpful error message
      if (response.status === 504) {
        throw new Error(`Processing timeout. File might be too large. Try breaking it into smaller files.`);
      }
      
      throw new Error(`Backend failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Optimized backend processing completed:', result);

    // Update job with results
    updateJob(jobId, {
      status: 'completed',
      progress: 100,
      currentStep: 'Processing completed successfully!',
      completedAt: new Date().toISOString(),
      resultData: {
        tenantId: result.tenantId,
        workbookId: result.workbookId,
        cellCount: result.cellCount,
        success: result.success,
        fileName: result.fileName,
        size: result.size
      }
    });

    console.log(`✅ Job ${jobId} completed with data in MongoDB`);

  } catch (error) {
    console.error(`❌ Job ${jobId} failed:`, error);
    updateJob(jobId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Processing failed',
      currentStep: 'Processing failed - check logs'
    });
  }
}

// Download file from Supabase
async function downloadFileFromSupabase(filePath: string): Promise<Blob | null> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(API_CONFIG.SUPABASE_URL, API_CONFIG.SUPABASE_ANON_KEY);

    console.log(`📥 Downloading: ${filePath}`);

    const { data, error } = await supabase.storage
      .from(STORAGE_CONFIG.UPLOAD_BUCKET)
      .download(filePath);

    if (error) {
      console.error('Supabase download error:', error);
      return null;
    }

    console.log(`✅ Downloaded: ${data?.size} bytes`);
    return data;
  } catch (error) {
    console.error('Download error:', error);
    return null;
  }
}


function updateJob(jobId: string, updates: Partial<JobData>) {
  jobStore.update(jobId, updates);
}