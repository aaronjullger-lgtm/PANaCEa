/**
 * Reset password API endpoint
 * Validates reset token and updates password
 */

import { PrismaClient } from '@prisma/client';
import { verifyToken, hashPassword, isTokenExpired } from '../../../lib/auth/tokens';

const prisma = new PrismaClient();

interface RequestBody {
  token: string;
  newPassword: string;
}

export async function onRequestPost(context: any) {
  try {
    const body: RequestBody = await context.request.json();
    const { token, newPassword } = body;

    // Validate input
    if (!token || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Token and new password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters long' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Find user with valid reset token
    const users = await prisma.user.findMany({
      where: {
        resetToken: { not: null },
        resetTokenExpiry: { not: null },
      },
    });

    let matchedUser = null;
    for (const user of users) {
      if (user.resetToken && await verifyToken(token, user.resetToken)) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired reset token' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check token expiry
    if (isTokenExpired(matchedUser.resetTokenExpiry)) {
      return new Response(
        JSON.stringify({ error: 'Reset token has expired' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Note: Since this is Clerk-based auth, we can't directly update passwords
    // This would need to use Clerk's API to update the password
    // For now, we'll clear the token and return an error message
    // indicating that password management should go through Clerk

    // Clear reset token
    await prisma.user.update({
      where: { id: matchedUser.id },
      data: {
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return new Response(
      JSON.stringify({
        error: 'Password reset is managed through Clerk authentication. Please use the Clerk sign-in flow to reset your password.',
        clerkUserId: matchedUser.clerkId,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );

    // If implementing custom password storage (not using Clerk):
    // const hashedPassword = await hashPassword(newPassword);
    // await prisma.user.update({
    //   where: { id: matchedUser.id },
    //   data: {
    //     password: hashedPassword,
    //     resetToken: null,
    //     resetTokenExpiry: null,
    //   },
    // });

  } catch (error) {
    console.error('Reset password error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
