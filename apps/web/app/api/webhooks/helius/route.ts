import { NextRequest, NextResponse } from 'next/server';
import { redis } from '../../../../lib/redis';
import { REDIS_CHANNELS } from '@aegis/shared';

export async function POST(req: NextRequest) {
  try {
    // Basic auth check (Helius sends an auth header if configured, or we can check the body)
    // For now, we assume Helius is sending to a secret URL or we validate payload structure.
    
    const body = await req.json();

    // Helius sends an array of transactions usually
    if (!Array.isArray(body) && !body.type) {
         // It might be a test ping or different format
    }

    // Publish to Redis for the Sentinel Agent
    await redis.publish(REDIS_CHANNELS.HELIUS_WEBHOOK, JSON.stringify(body));

    console.log('Received Helius webhook, published to Redis');

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error handling Helius webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
