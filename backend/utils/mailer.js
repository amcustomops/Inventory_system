const nodemailer = require('nodemailer');
const pool = require('../db');
const axios = require('axios');

let cachedTransporter = null;

async function getTransporter() {
    if (cachedTransporter) {
        return cachedTransporter;
    }

    const service = process.env.EMAIL_SERVICE;
    const host = process.env.EMAIL_HOST;
    const port = process.env.EMAIL_PORT;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (user && pass && (service || host)) {
        let transportConfig;
        
        if (service) {
            console.log(`[MAIL] Using configured service transporter: ${service}`);
            transportConfig = {
                service,
                auth: { user, pass },
                family: 4 // Force IPv4
            };
        } else if (host && (host.includes('gmail.com') || host.includes('googlemail.com'))) {
            console.log(`[MAIL] Auto-detecting Gmail service for host: ${host}. Switching to secure SSL (port 465) via Gmail service.`);
            transportConfig = {
                service: 'gmail',
                auth: { user, pass },
                family: 4
            };
        } else {
            const isSecure = Number(port) === 465;
            console.log(`[MAIL] Using configured SMTP transporter: ${host}:${port || (isSecure ? 465 : 587)} (secure: ${isSecure})`);
            transportConfig = {
                host,
                port: Number(port) || (isSecure ? 465 : 587),
                secure: isSecure,
                auth: { user, pass },
                family: 4
            };
        }

        cachedTransporter = nodemailer.createTransport(transportConfig);
        
        try {
            console.log(`[MAIL] Verifying SMTP connection...`);
            await cachedTransporter.verify();
            console.log(`[MAIL] SMTP connection verified successfully.`);
        } catch (err) {
            console.error(`[MAIL] SMTP connection verification failed:`, err);
        }
        return cachedTransporter;
    }

    console.log('[MAIL] No SMTP configuration found in env. Creating Ethereal Test Account...');
    try {
        const testAccount = await nodemailer.createTestAccount();
        console.log('[MAIL] Ethereal Test Account Created:', testAccount.user);
        cachedTransporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
        try {
            console.log(`[MAIL] Verifying Ethereal SMTP connection...`);
            await cachedTransporter.verify();
            console.log(`[MAIL] Ethereal SMTP connection verified successfully.`);
        } catch (err) {
            console.error(`[MAIL] Ethereal SMTP verification failed:`, err);
        }
        return cachedTransporter;
    } catch (err) {
        console.error('[MAIL] Failed to create Ethereal Test Account. Falling back to console-only logger.', err);
        cachedTransporter = {
            sendMail: async (mailOptions) => {
                console.log('=== EMAIL LOG FALLBACK ===');
                console.log('To:', mailOptions.to);
                console.log('Subject:', mailOptions.subject);
                console.log('HTML Body Preview:', mailOptions.html.substring(0, 1000) + '...');
                console.log('==========================');
                return { messageId: 'console-mock-id' };
            },
            verify: async () => true
        };
        return cachedTransporter;
    }
}

// -------------------------------------------------------------
// Unified platform email wrapper (Indigo Slate Theme)
// -------------------------------------------------------------
function renderPlatformEmailWrapper(title, preheader, contentHtml) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
</head>
<body style="background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px 0; color: #e2e8f0;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #111827; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; border-collapse: separate; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
        <!-- Top Indigo Header Bar -->
        <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #3b82f6 100%); padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Smart Inventory Platform</h1>
                <p style="color: rgba(255, 255, 255, 0.85); margin: 5px 0 0 0; font-size: 13px; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;">${preheader}</p>
            </td>
        </tr>
        
        <!-- Main Body Card -->
        <tr>
            <td style="padding: 30px;">
                ${contentHtml}
            </td>
        </tr>
        
        <!-- Dark Footer -->
        <tr>
            <td style="background-color: #0f172a; padding: 20px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                <p style="margin: 0; font-size: 11px; color: #4b5563; line-height: 1.4;">
                    This is an automated email request from the Smart Inventory Platform. <br />
                    &copy; 2026 Smart Inventory Platforms. All rights reserved.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

function renderWelcomeTemplate(data) {
    const content = `
        <p style="margin: 0 0 15px 0; font-size: 15px; color: #f8fafc; font-weight: 600;">Hello ${data.name},</p>
        <p style="margin: 0 0 25px 0; font-size: 13.5px; line-height: 1.6; color: #94a3b8;">
            Your organization, <strong style="color: #f8fafc;">${data.companyName}</strong>, has been successfully onboarded onto our platform. Here are your credentials to log in and get started.
        </p>

        <!-- Credentials Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1f2937; border: 1px solid #374151; border-radius: 12px; margin-bottom: 25px; padding: 16px; font-size: 13px;">
            <tr>
                <td style="padding: 6px; color: #94a3b8;" width="40%">
                    <strong style="color: #e2e8f0;">Login URL:</strong>
                </td>
                <td style="padding: 6px; color: #f8fafc;" width="60%">
                    <a href="${data.loginUrl}" style="color: #6366f1; text-decoration: none; font-weight: 600;">${data.loginUrl}</a>
                </td>
            </tr>
            <tr>
                <td style="padding: 6px; color: #94a3b8;">
                    <strong style="color: #e2e8f0;">Registered Email:</strong>
                </td>
                <td style="padding: 6px; color: #f8fafc;">
                    ${data.email}
                </td>
            </tr>
            <tr>
                <td style="padding: 6px; color: #94a3b8;">
                    <strong style="color: #e2e8f0;">Temporary Password:</strong>
                </td>
                <td style="padding: 6px; color: #f8fafc;">
                    <code style="background-color: #111827; padding: 2px 6px; border-radius: 4px; color: #38bdf8; font-family: monospace; font-size: 14px;">${data.temporaryPassword}</code>
                </td>
            </tr>
        </table>

        <div style="margin-top: 30px; padding: 15px; background-color: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; border-radius: 8px; font-size: 12px; line-height: 1.5; color: #fca5a5;">
            <strong>Security Notice:</strong> For security reasons, please reset your password immediately after logging in.
        </div>
    `;
    return renderPlatformEmailWrapper(
        `Welcome to ${data.companyName} - Smart Inventory SaaS`,
        'Workspace Onboarding',
        content
    );
}

function renderInviteTemplate(data) {
    const content = `
        <p style="margin: 0 0 15px 0; font-size: 15px; color: #f8fafc; font-weight: 600;">Hello ${data.name},</p>
        <p style="margin: 0 0 25px 0; font-size: 13.5px; line-height: 1.6; color: #94a3b8;">
            You have been invited to join the workspace for <strong style="color: #f8fafc;">${data.companyName}</strong> on the Smart Inventory Platform. Your account has been prepared with the role <strong style="color: #f8fafc;">${data.role}</strong>.
        </p>

        <!-- Credentials Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1f2937; border: 1px solid #374151; border-radius: 12px; margin-bottom: 25px; padding: 16px; font-size: 13px;">
            <tr>
                <td style="padding: 6px; color: #94a3b8;" width="40%">
                    <strong style="color: #e2e8f0;">Workspace Login URL:</strong>
                </td>
                <td style="padding: 6px; color: #f8fafc;" width="60%">
                    <a href="${data.loginUrl}" style="color: #6366f1; text-decoration: none; font-weight: 600;">${data.loginUrl}</a>
                </td>
            </tr>
            <tr>
                <td style="padding: 6px; color: #94a3b8;">
                    <strong style="color: #e2e8f0;">Username/Email:</strong>
                </td>
                <td style="padding: 6px; color: #f8fafc;">
                    ${data.email}
                </td>
            </tr>
            <tr>
                <td style="padding: 6px; color: #94a3b8;">
                    <strong style="color: #e2e8f0;">Temporary Password:</strong>
                </td>
                <td style="padding: 6px; color: #f8fafc;">
                    <code style="background-color: #111827; padding: 2px 6px; border-radius: 4px; color: #38bdf8; font-family: monospace; font-size: 14px;">${data.temporaryPassword}</code>
                </td>
            </tr>
        </table>

        <div style="margin-top: 30px; padding: 15px; background-color: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; border-radius: 8px; font-size: 12px; line-height: 1.5; color: #fca5a5;">
            <strong>Security Notice:</strong> For security reasons, please reset your password immediately after logging in.
        </div>
    `;
    return renderPlatformEmailWrapper(
        `You are Invited - ${data.companyName} Workspace`,
        'Workspace Invitation',
        content
    );
}

function renderPOTemplate(data) {
    const content = `
        <p style="margin: 0 0 15px 0; font-size: 15px; color: #f8fafc; font-weight: 600;">Dear ${data.supplierName},</p>
        <p style="margin: 0 0 25px 0; font-size: 13.5px; line-height: 1.6; color: #94a3b8;">
            We are placing a new purchase order request with your company. Below is the detailed specification of items and quantities. Please confirm receipt and provide an estimated delivery timeline.
        </p>

        <!-- PO Metadata Details Card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1f2937; border: 1px solid #374151; border-radius: 12px; margin-bottom: 25px; padding: 16px; font-size: 13px;">
            <tr>
                <td style="padding: 4px; color: #94a3b8;" width="50%">
                    <strong style="color: #e2e8f0;">PO Number:</strong> ${data.poNumber}
                </td>
                <td style="padding: 4px; color: #94a3b8;" width="50%">
                    <strong style="color: #e2e8f0;">PO Date:</strong> ${data.formattedDate}
                </td>
            </tr>
            <tr>
                <td style="padding: 4px; color: #94a3b8;" width="50%">
                    <strong style="color: #e2e8f0;">Status:</strong> <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; background-color: #4f46e5; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">${data.status}</span>
                </td>
                <td style="padding: 4px; color: #94a3b8;" width="50%">
                    <strong style="color: #e2e8f0;">Shipping To:</strong> <span style="color: #f8fafc;">${data.shippingAddress || 'Main Warehouse'}</span>
                </td>
            </tr>
        </table>

        <!-- Items Specification Table -->
        <h3 style="color: #818cf8; margin: 0 0 12px 0; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-left: 3px solid #6366f1; padding-left: 8px;">Items Requested</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 25px; font-size: 12.5px;">
            <thead>
                <tr style="background-color: #1f2937; color: #94a3b8; border-bottom: 1px solid #374151;">
                    <th style="padding: 10px 12px; text-align: left; border-radius: 8px 0 0 8px;">Item Details</th>
                    <th style="padding: 10px 12px; text-align: center;">Qty</th>
                    <th style="padding: 10px 12px; text-align: right;">Unit Price</th>
                    <th style="padding: 10px 12px; text-align: center;">Tax</th>
                    <th style="padding: 10px 12px; text-align: right; border-radius: 0 8px 8px 0;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${data.rowsHtml}
            </tbody>
        </table>

        <!-- Grand Total Row -->
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td width="55%"></td>
                <td width="45%">
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13.5px; border-top: 1px solid #374151; padding-top: 8px;">
                        <tr>
                            <td style="padding: 6px 0; color: #94a3b8; font-weight: 500;">Grand Total:</td>
                            <td style="padding: 6px 0; text-align: right; color: #10b981; font-weight: 800; font-size: 17px;">₹${data.grandTotal.toFixed(2)}</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
        
        <!-- Delivery Note / Call To Action Banner -->
        <div style="margin-top: 30px; padding: 15px; background-color: rgba(99, 102, 241, 0.08); border-left: 3px solid #6366f1; border-radius: 8px; font-size: 12px; line-height: 1.5; color: #94a3b8;">
            <strong>Instructions:</strong> Please confirm this order within 24 hours. Keep this PO number <strong>${data.poNumber}</strong> referenced in all delivery notes and invoices.
        </div>
    `;
    return renderPlatformEmailWrapper(
        `New Purchase Order Request - ${data.poNumber}`,
        'Official Purchase Order',
        content
    );
}

// -------------------------------------------------------------
// Unified Platform Dispatcher
// -------------------------------------------------------------
async function sendPlatformEmail(to, type, data) {
    console.log(`[MAIL] Triggered sendPlatformEmail for type: ${type} to: ${to}`);

    // 1. Compile template HTML and Subject
    let subject = '';
    let html = '';

    if (type === 'WELCOME_EMAIL') {
        subject = `Welcome to ${data.companyName} - Smart Inventory SaaS`;
        html = renderWelcomeTemplate(data);
    } else if (type === 'INVITE_USER') {
        subject = `You are Invited - ${data.companyName} Workspace`;
        html = renderInviteTemplate(data);
    } else if (type === 'PURCHASE_ORDER') {
        subject = `New Purchase Order Request - ${data.poNumber}`;
        html = renderPOTemplate(data);
    } else {
        throw new Error(`[MAIL] Unknown email type: ${type}`);
    }

    // 2. Resolve sender email configurations
    const resendApiKey = process.env.RESEND_API_KEY;
    const brevoApiKey = process.env.BREVO_API_KEY;
    let emailFrom = process.env.EMAIL_FROM || 'no-reply@smartinventory.com';

    // Fallback: Resend sandbox account requirements
    if (resendApiKey && (!emailFrom || emailFrom === 'no-reply@smartinventory.com' || emailFrom.includes('smartinventory.com'))) {
        console.log('[MAIL] Custom domain not verified. Defaulting sender to onboarding@resend.dev for Resend sandbox mode.');
        emailFrom = 'onboarding@resend.dev';
    }

    let emailTo = to;
    if (resendApiKey && emailFrom === 'onboarding@resend.dev') {
        const sandboxRecipient = process.env.EMAIL_USER || 'adikadia05@gmail.com';
        console.log(`[MAIL] Resend sandbox mode detected. Overriding recipient "${emailTo}" to "${sandboxRecipient}" to prevent Resend 403 Validation Error.`);
        emailTo = sandboxRecipient;
    }

    // 3. Database connection and Logging
    let conn = null;
    let logId = null;
    try {
        conn = await pool.getConnection();
        const logResult = await conn.query(
            'INSERT INTO EMAIL_LOGS (from_email, to_email, subject, body, created_at, success) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)',
            [emailFrom, emailTo, subject, html, false]
        );
        logId = logResult.insertId;
        console.log(`[MAIL] Created email log entry with ID: ${logId}`);
    } catch (logErr) {
        console.log('[MAIL] Database context not found or EMAIL_LOGS write skipped:', logErr.message);
    }

    let sentSuccessfully = false;

    // 4. Send email through resolved client channel
    try {
        if (resendApiKey) {
            console.log(`[MAIL] RESEND_API_KEY detected. Routing email via Resend HTTP API...`);
            const response = await axios.post('https://api.resend.com/emails', {
                from: `"Smart Inventory System" <${emailFrom}>`,
                to: [emailTo],
                subject: subject,
                html: html
            }, {
                headers: {
                    'Authorization': `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[MAIL] Email sent successfully via Resend API. ID: ${response.data.id}`);
            sentSuccessfully = true;
        } else if (brevoApiKey) {
            console.log(`[MAIL] BREVO_API_KEY detected. Routing email via Brevo HTTP API...`);
            const response = await axios.post('https://api.brevo.com/v3/smtp/email', {
                sender: { name: "Smart Inventory System", email: emailFrom },
                to: [{ email: emailTo, name: data.name || data.supplierName || emailTo }],
                subject: subject,
                htmlContent: html
            }, {
                headers: {
                    'api-key': brevoApiKey,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[MAIL] Email sent successfully via Brevo API. ID: ${response.data.messageId}`);
            sentSuccessfully = true;
        } else {
            console.log(`[MAIL] Routing email via SMTP (Nodemailer)...`);
            const transporter = await getTransporter();
            const mailOptions = {
                from: `"Smart Inventory System" <${emailFrom}>`,
                to: emailTo,
                subject: subject,
                html: html
            };
            const info = await transporter.sendMail(mailOptions);
            console.log(`[MAIL] Email sent successfully via SMTP. Message ID: ${info.messageId}`);

            if (info.messageId && nodemailer.getTestMessageUrl) {
                const previewUrl = nodemailer.getTestMessageUrl(info);
                if (previewUrl) {
                    console.log(`[MAIL] [Ethereal Email Preview] URL: ${previewUrl}`);
                }
            }
            sentSuccessfully = true;
        }

        // Update DB log on success
        if (conn && logId) {
            await conn.query(
                'UPDATE EMAIL_LOGS SET success = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?',
                [sentSuccessfully, logId]
            );
        }
    } catch (sendErr) {
        console.error(`[MAIL] Failed to send email:`, sendErr.message);
        if (conn && logId) {
            try {
                await conn.query(
                    'UPDATE EMAIL_LOGS SET success = false, sent_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [logId]
                );
            } catch (updateErr) {
                console.error('[MAIL] Failed to update email log status to failed:', updateErr.message);
            }
        }
        throw sendErr;
    } finally {
        if (conn) conn.release();
    }
}

// -------------------------------------------------------------
// Legacy Wrapper for PO Email
// -------------------------------------------------------------
async function sendPurchaseOrderEmail(poId) {
    console.log(`[MAIL] Triggered sendPurchaseOrderEmail wrapper for PO ID: ${poId}`);
    let conn;
    try {
        conn = await pool.getConnection();

        // 1. Fetch PO details
        const poRows = await conn.query('SELECT * FROM PURCHASE_ORDERS WHERE id = ?', [poId]);
        if (poRows.length === 0) {
            console.error(`[MAIL] Purchase Order ID ${poId} not found in database. Aborting.`);
            return;
        }
        const po = poRows[0];

        // 2. Fetch Supplier details
        const supplierRows = await conn.query('SELECT name, email FROM SUPPLIERS WHERE id = ?', [po.supplier_id]);
        if (supplierRows.length === 0) {
            console.error(`[MAIL] Supplier ID ${po.supplier_id} for PO ID ${poId} not found. Aborting.`);
            return;
        }
        const supplier = supplierRows[0];

        if (!supplier.email) {
            console.warn(`[MAIL] Supplier "${supplier.name}" has no email configured. Skipping email dispatch.`);
            return;
        }

        // 3. Fetch Items with joined product details
        const itemRows = await conn.query(`
            SELECT poi.*, p.name as product_name, p.sku 
            FROM PURCHASE_ORDER_ITEMS poi 
            JOIN PRODUCTS p ON poi.product_id = p.id 
            WHERE poi.purchase_order_id = ?
        `, [poId]);

        if (itemRows.length === 0) {
            console.warn(`[MAIL] Purchase Order ID ${poId} has no items. Skipping email dispatch.`);
            return;
        }

        // 4. Generate HTML table rows
        let rowsHtml = '';
        let grandTotal = 0;

        for (let item of itemRows) {
            const qty = Number(item.ordered_quantity || 0);
            const price = Number(item.cost_price || 0);
            const taxPercent = Number(item.tax_percentage || 0);
            const subtotal = qty * price;
            const taxAmount = subtotal * (taxPercent / 100);
            const itemTotal = subtotal + taxAmount;

            grandTotal += itemTotal;

            rowsHtml += `
                <tr style="border-bottom: 1px solid #1e293b;">
                    <td style="padding: 12px; text-align: left; border-bottom: 1px solid #1e293b;">
                        <span style="display: block; font-weight: bold; color: #f8fafc; font-size: 13px;">${item.product_name}</span>
                        <span style="display: block; font-size: 11px; color: #94a3b8;">SKU: ${item.sku}</span>
                    </td>
                    <td style="padding: 12px; text-align: center; color: #e2e8f0; border-bottom: 1px solid #1e293b;">${qty}</td>
                    <td style="padding: 12px; text-align: right; color: #e2e8f0; border-bottom: 1px solid #1e293b;">₹${price.toFixed(2)}</td>
                    <td style="padding: 12px; text-align: center; color: #e2e8f0; border-bottom: 1px solid #1e293b;">${taxPercent}%</td>
                    <td style="padding: 12px; text-align: right; color: #f8fafc; font-weight: bold; border-bottom: 1px solid #1e293b;">₹${itemTotal.toFixed(2)}</td>
                </tr>
            `;
        }

        const formattedDate = po.po_date ? new Date(po.po_date).toLocaleDateString() : new Date().toLocaleDateString();
        const poNumberStr = po.po_number || `PO-${po.id}`;

        await sendPlatformEmail(supplier.email, 'PURCHASE_ORDER', {
            supplierName: supplier.name,
            poNumber: poNumberStr,
            formattedDate,
            status: po.status,
            shippingAddress: po.shipping_address,
            rowsHtml,
            grandTotal
        });

    } catch (err) {
        console.error(`Error in sendPurchaseOrderEmail wrapper for PO #${poId}:`, err);
    } finally {
        if (conn) conn.release();
    }
}

module.exports = {
    sendPlatformEmail,
    sendPurchaseOrderEmail
};
