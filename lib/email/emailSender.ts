/**
 * Email sender utility for PANaCEa platform
 * Handles password reset and email verification emails
 */

import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Creates a nodemailer transporter based on environment configuration
 */
function createTransporter() {
  const config = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  };

  if (!config.auth.user || !config.auth.pass) {
    console.warn('SMTP credentials not configured. Email sending will fail.');
  }

  return nodemailer.createTransport(config);
}

/**
 * Sends an email using the configured SMTP transporter
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.SMTP_FROM || 'PANaCEa <noreply@panacea.app>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

/**
 * Strips HTML tags for plain text version
 * Performs multiple passes to ensure complete removal of nested tags
 */
function stripHtml(html: string): string {
  let text = html;
  // Perform multiple passes to remove nested tags
  let previousText = '';
  while (previousText !== text) {
    previousText = text;
    text = text.replace(/<[^>]*>/g, '');
  }
  // Replace HTML entities for plain text (safe: no HTML context after stripping tags)
  // Note: Order matters - decode &amp; last to avoid double-decoding
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&') // Decode &amp; last
    .trim();
}

/**
 * Sends a password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  firstName?: string
): Promise<boolean> {
  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'http://localhost:3000';
  const resetUrl = `${appUrl}/reset-password/${resetToken}`;

  const subject = 'PANaCEa - Password Reset Request';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: var(--color-bg-primary); color: var(--color-text-secondary);">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; width: 100%; background-color: var(--color-bg-secondary); border-radius: 12px; box-shadow: 0 4px 6px var(--color-shadow-soft);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid var(--color-border);">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: var(--color-accent);">PANaCEa</h1>
                  <p style="margin: 8px 0 0; font-size: 14px; color: var(--color-text-muted);">Adaptive Medical Learning</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  ${firstName ? `<p style="margin: 0 0 20px; font-size: 16px; color: var(--color-text-secondary);">Hello ${firstName},</p>` : ''}
                  
                  <p style="margin: 0 0 20px; font-size: 16px; color: var(--color-text-secondary); line-height: 1.6;">
                    You recently requested to reset your password for your PANaCEa account. Click the button below to reset it.
                  </p>
                  
                  <table role="presentation" style="width: 100%; margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: var(--color-accent); color: var(--color-text-inverse); text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 500;">Reset Password</a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 20px 0 0; font-size: 14px; color: var(--color-text-muted); line-height: 1.6;">
                    If you did not request a password reset, please ignore this email. This link will expire in 1 hour.
                  </p>
                  
                  <p style="margin: 20px 0 0; font-size: 13px; color: var(--color-text-muted); line-height: 1.6;">
                    If the button above doesn't work, copy and paste this URL into your browser:<br>
                    <span style="color: var(--color-accent);">${resetUrl}</span>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; text-align: center; border-top: 1px solid var(--color-border);">
                  <p style="margin: 0; font-size: 13px; color: var(--color-text-muted);">
                    PANaCEa - Professional Medical Education Platform
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
}

/**
 * Sends an email verification email
 */
export async function sendVerificationEmail(
  email: string,
  verifyToken: string,
  firstName?: string
): Promise<boolean> {
  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'http://localhost:3000';
  const verifyUrl = `${appUrl}/verify/${verifyToken}`;

  const subject = 'PANaCEa - Verify Your Email Address';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: var(--color-bg-primary); color: var(--color-text-secondary);">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; width: 100%; background-color: var(--color-bg-secondary); border-radius: 12px; box-shadow: 0 4px 6px var(--color-shadow-soft);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid var(--color-border);">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: var(--color-accent);">PANaCEa</h1>
                  <p style="margin: 8px 0 0; font-size: 14px; color: var(--color-text-muted);">Adaptive Medical Learning</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  ${firstName ? `<p style="margin: 0 0 20px; font-size: 16px; color: var(--color-text-secondary);">Welcome, ${firstName}</p>` : '<p style="margin: 0 0 20px; font-size: 16px; color: var(--color-text-secondary);">Welcome to PANaCEa</p>'}
                  
                  <p style="margin: 0 0 20px; font-size: 16px; color: var(--color-text-secondary); line-height: 1.6;">
                    Thank you for joining PANaCEa. To complete your registration and access your account, please verify your email address by clicking the button below.
                  </p>
                  
                  <table role="presentation" style="width: 100%; margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${verifyUrl}" style="display: inline-block; padding: 14px 32px; background-color: var(--color-accent); color: var(--color-text-inverse); text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 500;">Verify Email Address</a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 20px 0 0; font-size: 14px; color: var(--color-text-muted); line-height: 1.6;">
                    This link will expire in 24 hours. If you did not create an account, please ignore this email.
                  </p>
                  
                  <p style="margin: 20px 0 0; font-size: 13px; color: var(--color-text-muted); line-height: 1.6;">
                    If the button above doesn't work, copy and paste this URL into your browser:<br>
                    <span style="color: var(--color-accent);">${verifyUrl}</span>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; text-align: center; border-top: 1px solid var(--color-border);">
                  <p style="margin: 0; font-size: 13px; color: var(--color-text-muted);">
                    PANaCEa - Professional Medical Education Platform
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
}
