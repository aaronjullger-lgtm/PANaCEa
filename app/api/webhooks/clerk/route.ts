import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // Get the Clerk webhook secret from environment
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('CLERK_WEBHOOK_SECRET is not set in environment variables');
  }

  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new NextResponse('Error: Missing svix headers', { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the webhook signature
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new NextResponse('Error: Verification failed', { status: 400 });
  }

  // Handle the webhook event
  const eventType = evt.type;

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name } = evt.data;

    // Get the primary email
    const primaryEmail = email_addresses?.find(
      (email) => email.id === evt.data.primary_email_address_id
    );

    if (!primaryEmail?.email_address) {
      return new NextResponse('Error: No primary email found', { status: 400 });
    }

    try {
      if (eventType === 'user.created') {
        // Create new user with default role USER
        await prisma.user.create({
          data: {
            clerkId: id,
            email: primaryEmail.email_address,
            firstName: first_name || null,
            lastName: last_name || null,
            role: 'USER',
          },
        });
      } else if (eventType === 'user.updated') {
        // Update existing user without changing role
        await prisma.user.update({
          where: { clerkId: id },
          data: {
            email: primaryEmail.email_address,
            firstName: first_name || null,
            lastName: last_name || null,
            // Explicitly do not update role - preserve existing value
          },
        });
      }

      return new NextResponse('Success', { status: 200 });
    } catch (error) {
      console.error('Error syncing user to database:', error);
      return new NextResponse('Error: Database sync failed', { status: 500 });
    }
  }

  // Return 200 for unhandled event types
  return new NextResponse('Success', { status: 200 });
}
