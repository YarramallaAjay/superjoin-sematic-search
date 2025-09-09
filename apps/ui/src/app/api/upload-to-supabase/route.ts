import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { API_CONFIG } from '@/lib/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// For now, use anon key. In production, use service role key for server-side operations
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Generate unique file path
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${timestamp}_${cleanFileName}`;

    console.log(`📤 Uploading file to Supabase: ${filePath}`);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ Supabase upload error:', error);
      return NextResponse.json(
        { success: false, error: error.message, details: error },
        { status: 400 }
      );
    }

    console.log(`✅ File uploaded successfully: ${data?.path}`);

    fetch(`${API_CONFIG.BACKEND_URL}/api/upload`, {
      method: 'POST',
      body: JSON.stringify({
        filePath: data?.path || filePath
      })
    });

    return NextResponse.json({
      success: true,
      filePath: data?.path || filePath,
      message: 'File uploaded successfully to Supabase'
    });

  } catch (error) {
    console.error('❌ Server upload error:', error);
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