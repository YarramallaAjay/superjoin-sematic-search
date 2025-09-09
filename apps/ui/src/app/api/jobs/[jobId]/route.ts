import { NextRequest, NextResponse } from 'next/server';
import { jobStore } from '@/lib/persistent-job-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    console.log(`🔍 Looking for job: ${jobId}`);
    console.log(`📊 Total jobs in store: ${jobStore.list().length}`);
    console.log(`📋 Available job IDs: [${jobStore.list().map(j => j.jobId.slice(-8)).join(', ')}]`);

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Get job from storage (in production: MongoDB query)
    const job = jobStore.get(jobId);

    if (!job) {
      console.log(`❌ Job not found: ${jobId}`);
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    console.log(`✅ Found job: ${jobId} with status: ${job.status}`);
    

    return NextResponse.json({
      success: true,
      job
    });

  } catch (error) {
    console.error('Error fetching job:', error);
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Cancel/delete job
    const job = jobStore.get(jobId);
    if (job && (job.status === 'queued' || job.status === 'parsing' || job.status === 'embedding')) {
      jobStore.delete(jobId);
      
      return NextResponse.json({
        success: true,
        message: 'Job cancelled successfully'
      });
    }

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Job cannot be cancelled in current state' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error cancelling job:', error);
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