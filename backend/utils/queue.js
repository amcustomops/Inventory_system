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
            if (name === 'send-welcome-email') {
                const nodemailer = require('nodemailer');
                const mailerTransporter = nodemailer.createTransport({
                    host: process.env.EMAIL_HOST,
                    port: process.env.EMAIL_PORT,
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    }
                });

                const emailFrom = process.env.EMAIL_FROM || 'no-reply@smartinventory.com';
                const subject = `Welcome to ${data.companyName} - Smart Inventory SaaS`;
                
                const html = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h2 style="color: #4f46e5; text-align: center;">Welcome to Smart Inventory Platform</h2>
                        <p>Hello <strong>${data.name}</strong>,</p>
                        <p>Your organization, <strong>${data.companyName}</strong>, has been successfully onboarded.</p>
                        <p>Here are your credentials to log in:</p>
                        <p><strong>Login URL:</strong> <a href="${data.loginUrl}">${data.loginUrl}</a></p>
                        <p><strong>Username:</strong> ${data.email}</p>
                        <p><strong>Temporary Password:</strong> <code>${data.temporaryPassword}</code></p>
                    </div>
                `;

                await mailerTransporter.sendMail({
                    from: `"Smart Inventory System" <${emailFrom}>`,
                    to: data.email,
                    subject: subject,
                    html: html
                });
                console.log(`[Mock Queue] Welcome email successfully sent to ${data.email} via Mock Queue.`);
            }
        } catch (e) {
            console.error('[Mock Queue] Job execution failed:', e.message);
        }
    });

    return { id: `mock-${Date.now()}` };
}

module.exports = { emailQueue };
