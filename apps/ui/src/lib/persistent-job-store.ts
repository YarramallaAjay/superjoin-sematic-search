import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface JobData {
  jobId: string;
  fileName: string;
  fileSize: number;
  filePath: string;
  storageBucket: string;
  tenantId?: string;
  workbookId?: string;
  status: 'queued' | 'uploading' | 'uploaded' | 'parsing' | 'processing' | 'embedding' | 'storing' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  errorMessage?: string;
  resultData?: any;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

class PersistentJobStore {
  private jobsFile = join(process.cwd(), '.next', 'jobs.json');
  private jobs = new Map<string, JobData>();

  constructor() {
    this.loadJobs();
  }

  private loadJobs(): void {
    try {
      if (existsSync(this.jobsFile)) {
        const data = readFileSync(this.jobsFile, 'utf8');
        const jobsArray = JSON.parse(data) as JobData[];
        this.jobs.clear();
        jobsArray.forEach(job => {
          this.jobs.set(job.jobId, job);
        });
        console.log(`📁 Loaded ${jobsArray.length} jobs from persistent storage`);
      }
    } catch (error) {
      console.error('⚠️ Failed to load jobs from file:', error);
      this.jobs.clear();
    }
  }

  private saveJobs(): void {
    try {
      const jobsArray = Array.from(this.jobs.values());
      writeFileSync(this.jobsFile, JSON.stringify(jobsArray, null, 2));
      console.log(`💾 Saved ${jobsArray.length} jobs to persistent storage`);
    } catch (error) {
      console.error('⚠️ Failed to save jobs to file:', error);
    }
  }

  get(jobId: string): JobData | undefined {
    this.loadJobs(); // Always reload to get latest data
    return this.jobs.get(jobId);
  }

  set(jobId: string, job: JobData): void {
    this.loadJobs(); // Reload first
    this.jobs.set(jobId, job);
    this.saveJobs(); // Save immediately
  }

  update(jobId: string, updates: Partial<JobData>): JobData | null {
    this.loadJobs(); // Reload first
    const job = this.jobs.get(jobId);
    if (!job) return null;

    const updatedJob = {
      ...job,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.jobs.set(jobId, updatedJob);
    this.saveJobs(); // Save immediately
    return updatedJob;
  }

  delete(jobId: string): boolean {
    this.loadJobs(); // Reload first
    const deleted = this.jobs.delete(jobId);
    if (deleted) {
      this.saveJobs(); // Save immediately
    }
    return deleted;
  }

  has(jobId: string): boolean {
    this.loadJobs(); // Always reload to check latest state
    return this.jobs.has(jobId);
  }

  list(): JobData[] {
    this.loadJobs(); // Always reload to get latest data
    return Array.from(this.jobs.values());
  }
}

// Use global to persist across Next.js hot reloads
const globalForJobStore = globalThis as unknown as { persistentJobStore: PersistentJobStore };

export const jobStore = globalForJobStore.persistentJobStore ?? new PersistentJobStore();

if (!globalForJobStore.persistentJobStore) {
  globalForJobStore.persistentJobStore = jobStore;
}