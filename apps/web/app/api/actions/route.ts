import { NextRequest, NextResponse } from 'next/server';
import { redis } from '../../lib/redis';

export async function GET(req: NextRequest) {
  try {
    const keys = await redis.smembers('aegis:pending_actions');
    
    if (keys.length === 0) {
        return NextResponse.json({ actions: [] }, { status: 200 });
    }

    const pipeline = redis.pipeline();
    keys.forEach(key => {
        pipeline.get(`aegis:pending:${key}`);
    });

    const results = await pipeline.exec();
    const actions = results
        ?.map(([err, res]) => {
            if (err) {
                console.error('Redis error:', err);
                return null;
            }
            return res ? JSON.parse(res as string) : null;
        })
        .filter(Boolean) || [];

    return NextResponse.json({ actions }, { status: 200 });
  } catch (error) {
    console.error('Error fetching actions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
