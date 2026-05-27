const { Queue } = require('bullmq');
const Redis = require('ioredis');
require('dotenv').config();

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = Number(process.env.REDIS_PORT) || 6379;

let realQueue = null;
let isRedisConnected = false;

try {
    console.log(`[Queue] Initializing Redis connection to ${redisHost}:${redisPort}...`);
    const connection = new Redis({
        host: redisHost,
        port: redisPort,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        showFriendlyErrorStack: true,
        retryStrategy: () => null // Fail fast
    });

    connection.on('connect', () => {
        console.log(`[Queue] Successfully connected to Redis server at ${redisHost}:${redisPort}`);
        isRedisConnected = true;
        realQueue = new Queue('email-queue', { connection });
    });

    connection.on('error', (err) => {
        if (!isRedisConnected) {
            console.warn('[Queue] Redis is offline. Dynamic email features will run via synchronous in-memory worker.');
        }
    });

} catch (err) {
    console.warn('[Queue] BullMQ initialization threw error, using synchronous fallback.', err.message);
}

// Stable wrapper object exported to backend services
const emailQueue = {
    async add(name, data) {
        if (isRedisConnected && realQueue) {
            try {
                return await realQueue.add(name, data);
            } catch (err) {
                console.warn(`[Queue] BullMQ failed to queue job '${name}'. Running fallback...`, err.message);
                return executeJobLocally(name, data);
            }
        } else {
            return executeJobLocally(name, data);
        }
    }
};

async function executeJobLocally(name, data) {
    console.log(`[Mock Queue] Processing job '${name}' synchronously...`);
    
    // Execute job logic asynchronously on next tick to avoid blocking
    setImmediate(async () => {
        try {
            const { sendPlatformEmail } = require('./mailer');
            if (name === 'send-welcome-email') {
                await sendPlatformEmail(data.email, 'WELCOME_EMAIL', data);
                console.log(`[Mock Queue] Welcome email successfully sent to ${data.email} via Mock Queue.`);
            } else if (name === 'invite-user') {
                await sendPlatformEmail(data.email, 'INVITE_USER', data);
                console.log(`[Mock Queue] Invite user email successfully sent to ${data.email} via Mock Queue.`);
            }
        } catch (e) {
            console.error('[Mock Queue] Job execution failed:', e.message);
        }
    });

    return { id: `mock-${Date.now()}` };
}

module.exports = { emailQueue };
