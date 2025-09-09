import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/lib/config';

export async function GET() {
  try {
    const response = await fetch(`${API_CONFIG.BACKEND_URL}/api/workbooks`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(data)
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch workbooks',
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
}