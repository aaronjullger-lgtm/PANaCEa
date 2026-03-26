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

  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://studypanacea.com';

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
                  ${userFirstName ? `<p style="margin: 0 0 20px; font-size: 16px; color: var(--color-text-secondary);">Thank you, ${userFirstName}! 🎉</p>` : '<p style="margin: 0 0 20px; font-size: 16px; color: var(--color-text-secondary);">Thank you! 🎉</p>'}
                  
                  <p style="margin: 0 0 20px; font-size: 16px; color: var(--color-text-secondary); line-height: 1.6;">
                    We've reviewed and fixed the issue you reported with question <strong>#${questionId.substring(0, 8)}</strong>.
                  </p>
                  
                  <!-- Issue Type Badge -->
                  <div style="margin: 20px 0; padding: 12px 16px; background-color: var(--color-bg-tertiary); border-radius: 8px;">
                    <p style="margin: 0; font-size: 14px; color: var(--color-text-secondary);">
                      <strong>Issue Type:</strong> ${formatFlagType(flagType)}
                    </p>
                  </div>
                  
                  <!-- Question Preview -->
                  <div style="margin: 20px 0; padding: 16px; background-color: var(--color-bg-primary); border-left: 4px solid var(--color-accent); border-radius: 4px;">
                    <p style="margin: 0; font-size: 14px; color: var(--color-text-secondary); line-height: 1.6;">
                      ${truncatedQuestion}
                    </p>
                  </div>
                  
                  ${
                    resolutionNote
                      ? `
                  <!-- Resolution Note -->
                  <div style="margin: 20px 0; padding: 16px; background-color: var(--color-bg-tertiary); border-radius: 8px;">
                    <p style="margin: 0 0 8px; font-size: 13px; color: var(--color-accent); font-weight: 600;">
                      What We Fixed:
                    </p>
                    <p style="margin: 0; font-size: 14px; color: var(--color-text-secondary); line-height: 1.6;">
                      ${resolutionNote}
                    </p>
                  </div>
                  `
                      : ''
                  }
                  
                  <table role="presentation" style="width: 100%; margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${appUrl}" style="display: inline-block; padding: 14px 32px; background-color: var(--color-accent); color: var(--color-text-inverse); text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 500;">Continue Studying</a>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 20px 0 0; font-size: 14px; color: var(--color-text-muted); line-height: 1.6;">
                    Your feedback helps us maintain the highest quality medical education content. Thank you for being an active member of the PANaCEa community!
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; text-align: center; border-top: 1px solid var(--color-border);">
                  <p style="margin: 0 0 8px; font-size: 13px; color: var(--color-text-muted);">
                    PANaCEa - Professional Medical Education Platform
                  </p>
                  <p style="margin: 0; font-size: 12px; color: var(--color-text-muted);">
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
  const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://studypanacea.com';
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
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: var(--color-bg-primary); color: var(--color-text-secondary);">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 600px; width: 100%; background-color: var(--color-bg-secondary); border-radius: 12px; box-shadow: 0 4px 6px var(--color-shadow-soft);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid var(--color-border);">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: var(--color-data-provisional);">Admin Alert</h1>
                  <p style="margin: 8px 0 0; font-size: 14px; color: var(--color-text-muted);">Question Flagged for Review</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <p style="margin: 0 0 20px; font-size: 16px; color: var(--color-text-secondary); line-height: 1.6;">
                    A user has flagged a question for review.
                  </p>
                  
                  <!-- Flag Details -->
                  <div style="margin: 20px 0; padding: 16px; background-color: var(--color-bg-tertiary); border-radius: 8px;">
                    <p style="margin: 0 0 8px; font-size: 13px; color: var(--color-text-muted);">
                      <strong>Flag Type:</strong> ${formatFlagType(questionFlag.flagType)}
                    </p>
                    ${
                      questionFlag.userFirstName
                        ? `
                    <p style="margin: 0 0 8px; font-size: 13px; color: var(--color-text-muted);">
                      <strong>Reported by:</strong> ${questionFlag.userFirstName}
                    </p>
                    `
                        : ''
                    }
                    <p style="margin: 0; font-size: 13px; color: var(--color-text-muted);">
                      <strong>Question ID:</strong> #${questionFlag.questionId.substring(0, 8)}
                    </p>
                  </div>
                  
                  <!-- Question Preview -->
                  <div style="margin: 20px 0; padding: 16px; background-color: var(--color-bg-primary); border-left: 4px solid var(--color-data-provisional); border-radius: 4px;">
                    <p style="margin: 0 0 8px; font-size: 12px; color: var(--color-text-muted); text-transform: uppercase;">
                      Question Text:
                    </p>
                    <p style="margin: 0; font-size: 14px; color: var(--color-text-secondary); line-height: 1.6;">
                      ${truncatedQuestion}
                    </p>
                  </div>
                  
                  <!-- User Description -->
                  <div style="margin: 20px 0; padding: 16px; background-color: var(--color-bg-primary); border-radius: 8px;">
                    <p style="margin: 0 0 8px; font-size: 12px; color: var(--color-text-muted); text-transform: uppercase;">
                      User's Description:
                    </p>
                    <p style="margin: 0; font-size: 14px; color: var(--color-text-secondary); line-height: 1.6;">
                      ${questionFlag.description}
                    </p>
                  </div>
                  
                  <table role="presentation" style="width: 100%; margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${adminUrl}" style="display: inline-block; padding: 14px 32px; background-color: var(--color-data-provisional); color: var(--color-text-inverse); text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 500;">Review in Admin Panel</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; text-align: center; border-top: 1px solid var(--color-border);">
                  <p style="margin: 0; font-size: 13px; color: var(--color-text-muted);">
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
