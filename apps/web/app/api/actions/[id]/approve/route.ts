import { NextRequest, NextResponse } from 'next/server';
import { redis } from '../../../../lib/redis';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const key = `aegis:pending:${id}`;
    
    // In a real app, verify signature/user here.
    // The body might contain the signed transaction hash if executed on frontend.
    const body = await req.json().catch(() => ({}));
    
    const actionDataStr = await redis.get(key);
    if (!actionDataStr) {
        return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }
    const actionData = JSON.parse(actionDataStr);

    await redis.srem('aegis:pending_actions', id);
    await redis.del(key);
    
    // Publish approval
    await redis.publish('aegis:updates', JSON.stringify({
        type: 'APPROVED',
        actionId: id,
        action: actionData,
        payload: body, // Pass through signature or tx hash
        timestamp: Date.now()
    }));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error approving action:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
