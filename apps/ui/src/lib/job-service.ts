import { supabase } from './supabase';

export type JobStatus = 'queued' | 'uploading' | 'uploaded' | 'parsing' | 'embedding' | 'storing' | 'completed' | 'failed';

export interface JobData {
  jobId: string;
  fileName: string;
  fileSize: number;
  filePath: string;
  storageBucket: string;
  tenantId?: string;
  workbookId?: string;
  status: JobStatus;
  progress: number;
  currentStep?: string;
  errorMessage?: string;
  resultData?: any;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CreateJobRequest {
  fileName: string;
  fileSize: number;
  filePath: string;
  storageBucket?: string;
  tenantId?: string;
  workbookId?: string;
}

export interface CreateJobResponse {
  success: boolean;
  jobId?: string;
  error?: string;
}

export class JobService {
  private static readonly API_BASE = '/api/jobs';

  // Create a new job
  static async createJob(data: CreateJobRequest): Promise<CreateJobResponse> {
    try {
      const response = await fetch(`${this.API_BASE}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating job:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Get job status
  static async getJobStatus(jobId: string): Promise<JobData | null> {
    try {
      const response = await fetch(`${this.API_BASE}/${jobId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        console.error('Error fetching job status:', response.statusText);
        return null;
      }

      const data = await response.json();
      return data.success ? data.job : null;
    } catch (error) {
      console.error('Error fetching job status:', error);
      return null;
    }
  }

  // Subscribe to job updates using Supabase realtime
  static subscribeToJobUpdates(
    jobId: string,
    callback: (job: JobData) => void,
    onError?: (error: any) => void
  ) {
    // For MongoDB, we'll use polling instead of Supabase realtime
    // In production, consider using WebSocket or Server-Sent Events
    const pollInterval = setInterval(async () => {
      try {
        const job = await this.getJobStatus(jobId);
        if (job) {
          callback(job);
          
          // Stop polling if job is completed or failed
          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        if (onError) {
          onError(error);
        } else {
          console.error('Error polling job status:', error);
        }
      }
    }, 2000); // Poll every 2 seconds

    // Return cleanup function
    return () => {
      clearInterval(pollInterval);
    };
  }

  // Cancel a job
  static async cancelJob(jobId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE}/${jobId}/cancel`, {
        method: 'POST',
      });

      return response.ok;
    } catch (error) {
      console.error('Error canceling job:', error);
      return false;
    }
  }
}

export default JobService;