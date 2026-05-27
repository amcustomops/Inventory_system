const { Worker } = require('bullmq');
const nodemailer = require('nodemailer');
const axios = require('axios');
const Redis = require('ioredis');
require('dotenv').config();

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = Number(process.env.REDIS_PORT) || 6379;

let cachedTransporter = null;
let worker = null;

async function getTransporter() {
    if (cachedTransporter) return cachedTransporter;

    const host = process.env.EMAIL_HOST;
    const port = process.env.EMAIL_PORT;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (user && pass && host) {
        cachedTransporter = nodemailer.createTransport({
            host,
            port: Number(port) || 587,
            secure: Number(port) === 465,
            auth: { user, pass },
            family: 4 // Force IPv4
        });
        return cachedTransporter;
    }

    // Fallback to mock console logger
    cachedTransporter = {
        sendMail: async (mailOptions) => {
            console.log('=== EMAIL WORKER LOG FALLBACK ===');
            console.log('To:', mailOptions.to);
            console.log('Subject:', mailOptions.subject);
            console.log('Body:', mailOptions.html);
            console.log('=================================');
            return { messageId: 'mock-worker-id' };
        }
    };
    return cachedTransporter;
}

// Create connection to Redis with fail-fast strategy
const connection = new Redis({
    host: redisHost,
    port: redisPort,
    maxRetriesPerRequest: null, // Required by BullMQ
    connectTimeout: 2000,
    retryStrategy: () => null // Fail fast, do not retry endlessly
});

connection.on('connect', () => {
    console.log(`[Queue Worker] Connected to Redis server at ${redisHost}:${redisPort}. Initializing BullMQ Worker...`);
    
    worker = new Worker('email-queue', async (job) => {
        console.log(`[Queue Worker] Processing job #${job.id} type: ${job.name}`);
        
        if (job.name === 'send-welcome-email') {
            const { sendPlatformEmail } = require('../utils/mailer');
            await sendPlatformEmail(job.data.email, 'WELCOME_EMAIL', job.data);
            console.log(`[Queue Worker] Welcome email dispatched successfully to ${job.data.email}.`);
        } else if (job.name === 'invite-user') {
            const { sendPlatformEmail } = require('../utils/mailer');
            await sendPlatformEmail(job.data.email, 'INVITE_USER', job.data);
            console.log(`[Queue Worker] Invite user email dispatched successfully to ${job.data.email}.`);
        }
    }, {
        connection,
        concurrency: 3
    });

    worker.on('completed', (job) => {
        console.log(`[Queue Worker] Job #${job.id} completed successfully.`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[Queue Worker] Job #${job.id} failed with error:`, err);
    });

    console.log('[Queue Worker] Background email queue worker started.');
});

connection.on('error', (err) => {
    // Gracefully handle connection offline state once without log spam
});

module.exports = {
    getWorker: () => worker
};
