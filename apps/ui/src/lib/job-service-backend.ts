import { API_CONFIG } from './config';

export interface JobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStep: string;
  steps: JobStep[];
  fileName: string;
  fileSize: number;
  result?: {
    totalRows: number;
    processedRows: number;
    embeddingsGenerated: number;
    errors: any[];
  };
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobStep {
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export class BackendJobService {
  private static baseUrl = API_CONFIG.BACKEND_URL;

  /**
   * Create a new file processing job
   */
  static async createJob(data: {
    fileName: string;
    filePath: string;
    fileUrl: string;
    fileSize: number;
    userId?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/jobs/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error('Error creating job:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create job'
      };
    }
  }

  /**
   * Get job status and progress
   */
  static async getJobStatus(jobId: string): Promise<{ success: boolean; data?: JobStatus; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/jobs/${jobId}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error('Error getting job status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get job status'
      };
    }
  }

  /**
   * Cancel a processing job
   */
  static async cancelJob(jobId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/jobs/${jobId}/cancel`, {
        method: 'POST',
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error('Error cancelling job:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel job'
      };
    }
  }

  /**
   * Poll job status until completion
   */
  static async pollJobStatus(
    jobId: string,
    options: {
      onProgress?: (job: JobStatus) => void;
      onComplete?: (job: JobStatus) => void;
      onError?: (error: string) => void;
      pollInterval?: number;
      maxAttempts?: number;
    } = {}
  ): Promise<JobStatus | null> {
    const {
      onProgress,
      onComplete,
      onError,
      pollInterval = 2000,
      maxAttempts = 150 // 5 minutes with 2s intervals
    } = options;

    let attempts = 0;
    let lastStatus = '';

    const poll = async (): Promise<JobStatus | null> => {
      attempts++;
      
      if (attempts > maxAttempts) {
        const error = 'Polling timeout - job may still be processing';
        onError?.(error);
        return null;
      }

      try {
        const result = await this.getJobStatus(jobId);
        
        if (!result.success || !result.data) {
          throw new Error(result.error || 'Failed to get job status');
        }

        const job = result.data;
        
        // Only call onProgress if status or progress has changed
        if (lastStatus !== `${job.status}-${job.progress}`) {
          lastStatus = `${job.status}-${job.progress}`;
          onProgress?.(job);
        }

        // Check if job is complete
        if (['completed', 'failed', 'cancelled'].includes(job.status)) {
          onComplete?.(job);
          return job;
        }

        // Continue polling
        setTimeout(() => poll(), pollInterval);
        return null;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        onError?.(errorMsg);
        return null;
      }
    };

    return poll();
  }

  /**
   * Get user's jobs
   */
  static async getUserJobs(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
    } = {}
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());
      if (options.status) params.append('status', options.status);

      const response = await fetch(`${this.baseUrl}/api/jobs/user/${userId}?${params}`);
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error('Error getting user jobs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user jobs'
      };
    }
  }

  /**
   * Create a complete upload and processing workflow
   */
  static async processFile(
    file: File,
    supabaseFilePath: string,
    supabaseFileUrl: string,
    options: {
      userId?: string;
      onProgress?: (job: JobStatus) => void;
      onComplete?: (job: JobStatus) => void;
      onError?: (error: string) => void;
    } = {}
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      // Create the job
      const createResult = await this.createJob({
        fileName: file.name,
        filePath: supabaseFilePath,
        fileUrl: supabaseFileUrl,
        fileSize: file.size,
        userId: options.userId,
      });

      if (!createResult.success || !createResult.data?.jobId) {
        throw new Error(createResult.error || 'Failed to create processing job');
      }

      const jobId = createResult.data.jobId;

      // Start polling for updates
      this.pollJobStatus(jobId, {
        onProgress: options.onProgress,
        onComplete: options.onComplete,
        onError: options.onError,
      });

      return {
        success: true,
        jobId,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      options.onError?.(errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }
}