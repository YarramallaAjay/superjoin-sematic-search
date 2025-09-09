import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// File upload utility
export interface UploadResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export const uploadFileToSupabase = async (
  file: File,
  bucket: string = 'uploads'
): Promise<UploadResult> => {
  try {
    console.log(`📤 Attempting direct Supabase upload for: ${file.name}`);
    
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `${fileName}`;

    // Try direct upload first
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.warn('⚠️ Direct upload failed, trying server-side fallback:', uploadError.message);
      
      // Fallback to server-side upload
      return await uploadViaServer(file);
    }

    console.log('✅ Direct Supabase upload successful');
    return {
      success: true,
      filePath
    };
  } catch (error) {
    console.error('❌ Upload error, trying server fallback:', error);
    // Fallback to server-side upload
    return await uploadViaServer(file);
  }
};

// Fallback server-side upload
const uploadViaServer = async (file: File): Promise<UploadResult> => {
  try {
    console.log(`📤 Attempting server-side upload for: ${file.name}`);
    
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload-to-supabase', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Server-side upload successful');
    
    return {
      success: true,
      filePath: result.filePath
    };
  } catch (error) {
    console.error('❌ Server-side upload failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Server upload failed'
    };
  }
};

// Get signed URL for uploaded file
export const getSignedUrl = async (filePath: string, bucket: string = 'uploads') => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }

  return data.signedUrl;
};