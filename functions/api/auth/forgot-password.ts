/**
 * Forgot password API endpoint
 * Generates a reset token and sends reset email
 */

import { PrismaClient } from '@prisma/client';
import { generateToken, hashToken, generateTokenExpiry } from '../../../lib/auth/tokens';
import { sendPasswordResetEmail } from '../../../lib/email/emailSender';

const prisma = new PrismaClient();

interface RequestBody {
  email: string;
}

export async function onRequestPost(context: any) {
  try {
    const body: RequestBody = await context.request.json();
    const { email } = body;

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid email address required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    // Even if user doesn't exist, return 200
    if (!user) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate reset token
    const resetToken = generateToken();
    const hashedToken = await hashToken(resetToken);
    const expiry = generateTokenExpiry(1); // 1 hour

    // Update user with reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiry: expiry,
      },
    });

    // Send email (async, don't wait for completion)
    sendPasswordResetEmail(email, resetToken, user.firstName || undefined).catch((error) => {
      console.error('Failed to send password reset email:', error);
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Forgot password error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
