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
            const { email, name, companyName, temporaryPassword, loginUrl } = job.data;
            const subject = `Welcome to ${companyName} - Smart Inventory SaaS`;
            
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #4f46e5; text-align: center;">Welcome to Smart Inventory Platform</h2>
                    <p>Hello <strong>${name}</strong>,</p>
                    <p>Your organization, <strong>${companyName}</strong>, has been successfully onboarded onto our platform.</p>
                    <p>Here are your credentials to log in and get started:</p>
                    
                    <table style="width: 100%; margin: 20px 0; border-collapse: collapse; background-color: #f8fafc; border-radius: 6px;">
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>Login URL:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><a href="${loginUrl}" style="color: #4f46e5;">${loginUrl}</a></td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;"><strong>Registered Email:</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${email}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px;"><strong>Temporary Password:</strong></td>
                            <td style="padding: 10px;"><code>${temporaryPassword}</code></td>
                        </tr>
                    </table>

                    <p style="color: #ef4444; font-weight: bold;">Important: For security reasons, please reset your password immediately after logging in.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #64748b; text-align: center;">This is an automated system email. Do not reply directly.</p>
                </div>
            `;

            const resendApiKey = process.env.RESEND_API_KEY;
            const emailFrom = process.env.EMAIL_FROM || 'no-reply@smartinventory.com';
            
            let sent = false;

            try {
                if (resendApiKey) {
                    console.log('[Queue Worker] Sending via Resend HTTP API...');
                    await axios.post('https://api.resend.com/emails', {
                        from: `"Smart Inventory System" <${emailFrom}>`,
                        to: [email],
                        subject: subject,
                        html: html
                    }, {
                        headers: {
                            'Authorization': `Bearer ${resendApiKey}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    sent = true;
                } else {
                    console.log('[Queue Worker] Sending via SMTP...');
                    const transporter = await getTransporter();
                    await transporter.sendMail({
                        from: `"Smart Inventory System" <${emailFrom}>`,
                        to: email,
                        subject: subject,
                        html: html
                    });
                    sent = true;
                }
                console.log(`[Queue Worker] Welcome email sent successfully to ${email}.`);
            } catch (sendErr) {
                console.error(`[Queue Worker] Failed to send email via standard routes:`, sendErr.message);
                throw sendErr; // Fail job to trigger retry logic
            }
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
