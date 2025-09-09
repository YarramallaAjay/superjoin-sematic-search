export interface UploadResult {
  success: boolean;
  tenantId?: string;
  workbookId?: string;
  cellCount?: number;
  error?: string;
  fileName?: string;
  jobId?: string;
}

export interface UploadCallbacks {
  onProgress?: (progress: number, status: string) => void;
  onComplete?: (result: UploadResult) => void;
  onError?: (error: string) => void;
}

export class UploadService {
  private abortController: AbortController | null = null;

  async uploadFile(file: File, callbacks?: UploadCallbacks): Promise<UploadResult> {
    try {
      callbacks?.onProgress?.(10, 'Uploading to Supabase...');

      // Step 1: Upload to Supabase
      const supabaseResponse = await fetch('/api/upload-to-supabase', {
        method: 'POST',
        body: (() => {
          const formData = new FormData();
          formData.append('file', file);
          return formData;
        })(),
      });

      if (!supabaseResponse.ok) {
        throw new Error(`Supabase upload failed: ${supabaseResponse.status}`);
      }

      const supabaseResult = await supabaseResponse.json();
      
      if (!supabaseResult.success) {
        throw new Error(supabaseResult.error || 'Supabase upload failed');
      }

      callbacks?.onProgress?.(30, 'Creating processing job...');

      // Step 2: Create job for processing
      const jobResponse = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          filePath: supabaseResult.filePath,
          storageBucket: 'uploads',
        }),
      });

      if (!jobResponse.ok) {
        throw new Error(`Job creation failed: ${jobResponse.status}`);
      }

      const jobResult = await jobResponse.json();

      if (!jobResult.success) {
        throw new Error(jobResult.error || 'Job creation failed');
      }

      callbacks?.onProgress?.(50, 'Processing file...');

      // Step 3: Poll job status
      const result = await this.pollJobStatus(jobResult.jobId, callbacks);
      
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Upload failed';
      const result: UploadResult = {
        success: false,
        error: errorMsg,
        fileName: file.name
      };

      callbacks?.onError?.(errorMsg);
      callbacks?.onComplete?.(result);

      return result;
    }
  }

  private async pollJobStatus(jobId: string, callbacks?: UploadCallbacks): Promise<UploadResult> {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        
        if (!response.ok) {
          throw new Error(`Job status check failed: ${response.status}`);
        }

        const job = await response.json();

        if (job.status === 'completed') {
          const result: UploadResult = {
            success: true,
            jobId: jobId,
            tenantId: job.resultData?.tenantId,
            workbookId: job.resultData?.workbookId,
            cellCount: job.resultData?.cellCount,
            fileName: job.resultData?.fileName,
          };

          callbacks?.onProgress?.(100, 'Upload complete!');
          callbacks?.onComplete?.(result);
          return result;
        }

        if (job.status === 'failed') {
          throw new Error(job.errorMessage || 'Processing failed');
        }

        // Update progress
        callbacks?.onProgress?.(
          Math.min(50 + (job.progress || 0) * 0.5, 95), 
          job.currentStep || 'Processing...'
        );

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;

      } catch (error) {
        throw error;
      }
    }

    throw new Error('Processing timeout - job took too long');
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}