/**
 * AEGIS Daemon
 * 
 * Runs the persistent agents (Sentinel, Overseer) that need to monitor streams.
 * Usage: npx tsx src/daemon.ts
 */

import { Sentinel } from './agents/sentinel';
import { Overseer } from './agents/overseer';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log('🛡️ Starting AEGIS Daemon...');

    // Load Config
    const heliusKey = process.env.HELIUS_API_KEY;
    const redisUrl = process.env.REDIS_URL;
    const walletAddress = process.env.MONITOR_WALLET_ADDRESS;

    if (!heliusKey) {
        console.warn('⚠️ No HELIUS_API_KEY provided. Sentinel monitoring will be limited.');
    }
    if (!walletAddress) {
        console.warn('⚠️ No MONITOR_WALLET_ADDRESS provided. Sentinel idle.');
    }

    // Initialize Agents
    const sentinel = new Sentinel({
        heliusApiKey: heliusKey,
        redisUrl: redisUrl,
        checkInterval: 30000 // 30s poll
    });

    const overseer = new Overseer({
        redisUrl: redisUrl
    });

    // Start Sentinel
    if (walletAddress) {
        console.log(`[Daemon] Sentinel starting watch on ${walletAddress}`);
        await sentinel.startMonitoring(walletAddress);
    } else {
        console.log('[Daemon] Waiting for wallet to be registered...');
        // In a real app, we might listen to Redis 'register_wallet' events
    }

    // Keep process alive
    process.on('SIGINT', async () => {
        console.log('[Daemon] Shutting down...');
        await sentinel.stopMonitoring();
        process.exit(0);
    });
}

main().catch(err => {
    console.error('[Daemon] Fatal Error:', err);
    process.exit(1);
});
