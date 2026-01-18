export interface FlagResolvedNotification {
  userEmail: string;
  userFirstName?: string;
  questionId: string;
  questionText: string;
  flagType: string;
  resolutionNote?: string;
}

export interface AdminFlagNotification {
  id: string;
  questionId: string;
  questionText: string;
  flagType: string;
  description: string;
  userEmail?: string;
  userFirstName?: string;
}

export async function sendFlagResolvedNotification(
  notification: FlagResolvedNotification
): Promise<boolean> {
  console.log('[Email Stub] Sending flag resolved notification:', notification);
  // In a real Edge environment, use an HTTP-based email service like Resend, SendGrid, or Postmark API here.
  // nodemailer is not supported in Edge runtimes.
  return true;
}

export async function sendAdminFlagNotification(
  adminEmail: string,
  notification: AdminFlagNotification
): Promise<boolean> {
  console.log('[Email Stub] Sending admin flag notification to', adminEmail, ':', notification);
  return true;
}
