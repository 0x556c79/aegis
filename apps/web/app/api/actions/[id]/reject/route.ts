import { NextRequest, NextResponse } from 'next/server';
import { redis } from '../../../../../lib/redis';

export async function POST(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id } = context.params;
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const pendingKey = `aegis:pending:${id}`;
    await redis.srem('aegis:pending_actions', id);
    await redis.del(pendingKey);

    await redis.publish(
      'aegis:updates',
      JSON.stringify({
        type: 'REJECTED',
        actionId: id,
        timestamp: Date.now(),
      })
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error rejecting action:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
