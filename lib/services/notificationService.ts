/**
 * Notification service for sending user notifications
 * Handles email notifications for question flag resolutions
 */

import { sendEmail } from '../email/emailSender';

export interface FlagResolvedNotification {
  userEmail: string;
  userFirstName?: string;
  questionId: string;
  questionText: string;
  flagType: string;
  resolutionNote?: string;
}

/**
 * Sends an email notification when an admin fixes a flagged question
 * This builds trust and community loyalty by closing the feedback loop
 */
export async function sendFlagResolvedNotification(
  notification: FlagResolvedNotification
): Promise<boolean> {
  const { userEmail, userFirstName, questionId, questionText, flagType, resolutionNote } =
    notification;

  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'http://localhost:3000';

  // Truncate question text if too long for email
  const truncatedQuestion =
    questionText.length > 200 ? questionText.substring(0, 200) + '...' : questionText;

  const subject = `PANaCEa - We Fixed Your Flagged Question #${questionId.substring(0, 8)}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #e2e8f0;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; width: 100%; background-color: #1e293b; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #334155;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #60a5fa;">PANaCEa</h1>
                  <p style="margin: 8px 0 0; font-size: 14px; color: #94a3b8;">Adaptive Medical Learning</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  ${userFirstName ? `<p style="margin: 0 0 20px; font-size: 16px; color: #e2e8f0;">Thank you, ${userFirstName}! 🎉</p>` : '<p style="margin: 0 0 20px; font-size: 16px; color: #e2e8f0;">Thank you! 🎉</p>'}
                  
                  <p style="margin: 0 0 20px; font-size: 16px; color: #e2e8f0; line-height: 1.6;">
                    We've reviewed and fixed the issue you reported with question <strong>#${questionId.substring(0, 8)}</strong>.
                  </p>
                  
                  <!-- Issue Type Badge -->
                  <div style="margin: 20px 0; padding: 12px 16px; background-color: #1e40af; border-radius: 8px;">
                    <p style="margin: 0; font-size: 14px; color: #93c5fd;">
                      <strong>Issue Type:</strong> ${formatFlagType(flagType)}
                    </p>
                  </div>
                  
                  <!-- Question Preview -->
                  <div style="margin: 20px 0; padding: 16px; background-color: #0f172a; border-left: 4px solid #60a5fa; border-radius: 4px;">
                    <p style="margin: 0; font-size: 14px; color: #cbd5e1; line-height: 1.6;">
                      ${truncatedQuestion}
                    </p>
                  </div>
                  
                  ${
                    resolutionNote
                      ? `
                  <!-- Resolution Note -->
                  <div style="margin: 20px 0; padding: 16px; background-color: #065f46; border-radius: 8px;">
                    <p style="margin: 0 0 8px; font-size: 13px; color: #6ee7b7; font-weight: 600;">
                      What We Fixed:
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #d1fae5; line-height: 1.6;">
                      ${resolutionNote}
                    </p>
                  </div>
                  `
                      : ''
                  }
                  
                  <table role="presentation" style="width: 100%; margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${appUrl}" style="display: inline-block; padding: 14px 32px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 500;">Continue Studying</a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 20px 0 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                    Your feedback helps us maintain the highest quality medical education content. Thank you for being an active member of the PANaCEa community!
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; text-align: center; border-top: 1px solid #334155;">
                  <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">
                    PANaCEa - Professional Medical Education Platform
                  </p>
                  <p style="margin: 0; font-size: 12px; color: #475569;">
                    Building trust through community feedback
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

  return sendEmail({
    to: userEmail,
    subject,
    html,
  });
}

/**
 * Formats flag type for display in email
 */
function formatFlagType(flagType: string): string {
  const types: Record<string, string> = {
    typo: 'Typo or Grammar Issue',
    incorrect_answer: 'Incorrect Answer',
    unclear: 'Unclear Question',
    outdated: 'Outdated Information',
    other: 'Other Issue',
  };

  return types[flagType] || flagType;
}

/**
 * Sends a notification to admin when a new question is flagged
 */
export async function sendAdminFlagNotification(
  adminEmail: string,
  questionFlag: {
    id: string;
    questionId: string;
    questionText: string;
    flagType: string;
    description: string;
    userEmail?: string;
    userFirstName?: string;
  }
): Promise<boolean> {
  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'http://localhost:3000';
  const adminUrl = `${appUrl}/admin/flags/${questionFlag.id}`;

  const truncatedQuestion =
    questionFlag.questionText.length > 200
      ? questionFlag.questionText.substring(0, 200) + '...'
      : questionFlag.questionText;

  const subject = `PANaCEa - New Question Flag: ${formatFlagType(questionFlag.flagType)}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #e2e8f0;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; width: 100%; background-color: #1e293b; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #334155;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #f59e0b;">Admin Alert</h1>
                  <p style="margin: 8px 0 0; font-size: 14px; color: #94a3b8;">Question Flagged for Review</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <p style="margin: 0 0 20px; font-size: 16px; color: #e2e8f0; line-height: 1.6;">
                    A user has flagged a question for review.
                  </p>
                  
                  <!-- Flag Details -->
                  <div style="margin: 20px 0; padding: 16px; background-color: #0f172a; border-radius: 8px;">
                    <p style="margin: 0 0 8px; font-size: 13px; color: #94a3b8;">
                      <strong>Flag Type:</strong> ${formatFlagType(questionFlag.flagType)}
                    </p>
                    ${
                      questionFlag.userFirstName
                        ? `
                    <p style="margin: 0 0 8px; font-size: 13px; color: #94a3b8;">
                      <strong>Reported by:</strong> ${questionFlag.userFirstName}
                    </p>
                    `
                        : ''
                    }
                    <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                      <strong>Question ID:</strong> #${questionFlag.questionId.substring(0, 8)}
                    </p>
                  </div>
                  
                  <!-- Question Preview -->
                  <div style="margin: 20px 0; padding: 16px; background-color: #0f172a; border-left: 4px solid #f59e0b; border-radius: 4px;">
                    <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8; text-transform: uppercase;">
                      Question Text:
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #cbd5e1; line-height: 1.6;">
                      ${truncatedQuestion}
                    </p>
                  </div>
                  
                  <!-- User Description -->
                  <div style="margin: 20px 0; padding: 16px; background-color: #0f172a; border-radius: 8px;">
                    <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8; text-transform: uppercase;">
                      User's Description:
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #cbd5e1; line-height: 1.6;">
                      ${questionFlag.description}
                    </p>
                  </div>
                  
                  <table role="presentation" style="width: 100%; margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${adminUrl}" style="display: inline-block; padding: 14px 32px; background-color: #f59e0b; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 500;">Review in Admin Panel</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; text-align: center; border-top: 1px solid #334155;">
                  <p style="margin: 0; font-size: 13px; color: #64748b;">
                    PANaCEa Admin Dashboard
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

  return sendEmail({
    to: adminEmail,
    subject,
    html,
  });
}
