import { NextRequest, NextResponse } from 'next/server';
import { INJECTIVE_MAINNET } from '@/types/chain';

/**
 * API Route to proxy Blockscout API requests
 * This avoids CORS issues when calling Blockscout from the browser
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json(
      { error: 'Address parameter is required' },
      { status: 400 }
    );
  }

  try {
    // Fetch from Blockscout API server-side (no CORS issues) - MAINNET
    const apiUrl = `${INJECTIVE_MAINNET.explorerUrl}/api/v2/addresses/${address}/transactions`;
    
    console.log(`[API] Fetching transactions from: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log(`[API] Response status: ${response.status}`);

    if (!response.ok) {
      // Check if it's a 404 - might mean no transactions yet
      if (response.status === 404) {
        // Return empty transactions list instead of error
        return NextResponse.json({
          items: [],
          next_page_params: null
        });
      }
      
      return NextResponse.json(
        { error: `Blockscout API returned ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type');
    
    // Check if response is HTML (error page) instead of JSON
    if (contentType?.includes('text/html')) {
      console.log('[API] Received HTML instead of JSON - probably no transactions');
      return NextResponse.json({
        items: [],
        next_page_params: null
      });
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
