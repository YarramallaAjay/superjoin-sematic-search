import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const { filePath } = await request.json();

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: 'File path is required' },
        { status: 400 }
      );
    }

    // Generate a signed URL that the backend can use to access the file
    // Valid for 1 hour (3600 seconds)
    const { data, error } = await supabase.storage
      .from('uploads')
      .createSignedUrl(filePath, 3600);

    if (error) {
      console.error('Error creating signed URL:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    if (!data?.signedUrl) {
      return NextResponse.json(
        { success: false, error: 'Failed to create signed URL' },
        { status: 500 }
      );
    }

    console.log(`📋 Created signed URL for backend access: ${filePath}`);

    return NextResponse.json({
      success: true,
      signedUrl: data.signedUrl
    });

  } catch (error) {
    console.error('Error in get-file-url:', error);
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