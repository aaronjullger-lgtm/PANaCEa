/**
 * Clerk Webhook Handler for Cloudflare Pages
 * Handles user lifecycle events: created, updated, deleted
 */

import { Webhook } from 'svix';
import { createEdgePrismaClient, safePrismaDisconnect } from '../_shared/prisma-edge';

interface Env {
  CLERK_WEBHOOK_SECRET?: string;
  DATABASE_URL?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

interface EmailAddress {
  id: string;
  email_address: string;
}

interface ClerkUserEvent {
  id: string;
  email_addresses?: EmailAddress[];
  primary_email_address_id?: string;
  first_name?: string | null;
  last_name?: string | null;
}

interface WebhookEvent {
  type: string;
  data: ClerkUserEvent;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  // Get webhook secret
  const WEBHOOK_SECRET = env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET is not configured');
    return new Response('Error: Webhook secret not configured', { status: 500 });
  }

  // Get Svix headers
  const svix_id = request.headers.get('svix-id');
  const svix_timestamp = request.headers.get('svix-timestamp');
  const svix_signature = request.headers.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('Missing svix headers');
    return new Response('Error: Missing svix headers', { status: 400 });
  }

  // Get request body
  const body = await request.text();

  // Verify webhook signature
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error: Verification failed', { status: 400 });
  }

  // Initialize Prisma client
  const prisma = createEdgePrismaClient(env.DATABASE_URL);

  try {
    switch (evt.type) {
      case 'user.created':
      case 'user.updated': {
        const { id, email_addresses, first_name, last_name, primary_email_address_id } = evt.data;

        // Robust email extraction: try primary first, fallback to first email
        let primaryEmail = email_addresses?.find((email) => email.id === primary_email_address_id);

        // Fallback to first email if primary not found
        if (!primaryEmail && email_addresses && email_addresses.length > 0) {
          primaryEmail = email_addresses[0];
        }

        if (!primaryEmail?.email_address) {
          console.error('No email found for user:', id);
          return new Response('Error: No email found', { status: 400 });
        }

        // Upsert user - create if doesn't exist, update if exists
        const now = new Date();
        await prisma.user.upsert({
          where: { clerkId: id },
          create: {
            clerkId: id,
            email: primaryEmail.email_address,
            firstName: first_name || null,
            lastName: last_name || null,
            role: 'USER',
            createdAt: now,
            updatedAt: now,
          },
          update: {
            email: primaryEmail.email_address,
            firstName: first_name || null,
            lastName: last_name || null,
            // Explicitly do NOT update role - preserve existing value
          },
        });

        console.log(`User ${evt.type === 'user.created' ? 'created' : 'updated'}: ${id}`);
        return new Response('Success', { status: 200 });
      }

      case 'user.deleted': {
        const { id } = evt.data;

        if (!id) {
          console.error('No user ID provided for deletion');
          return new Response('Error: No user ID', { status: 400 });
        }

        // FIX (Audit 8/F5): Replace hard cascade delete with soft-delete.
        // prisma.user.delete() with onDelete:Cascade in the schema would
        // permanently and irrecoverably destroy all QuestionAttempts, ReviewLogs,
        // UserProgress, SRSItems, OSCE sessions, and the entire learning history
        // the moment a Clerk account is removed (whether accidentally or by admin).
        //
        // Instead: mark the account as 'deleted' with a 30-day grace period.
        // A nightly cron (cron/purge-deleted-users) can permanently remove
        // accounts where deletionScheduledAt < now() after the retention window.
        try {
          const retentionDays = 30;
          const deletionScheduledAt = new Date();
          deletionScheduledAt.setDate(deletionScheduledAt.getDate() + retentionDays);

          await prisma.user.update({
            where: { clerkId: id },
            data: {
              accountStatus: 'deleted',
              deletionScheduledAt,
            },
          });
          console.log(
            `User soft-deleted: ${id} — data retained until ${deletionScheduledAt.toISOString()}`
          );
        } catch (error) {
          // User might not exist (webhook fired before user.created, or already soft-deleted)
          console.warn(`Could not soft-delete user ${id}:`, error);
          // Return 200 anyway so Clerk stops retrying
        }

        return new Response('Success', { status: 200 });
      }

      default:
        // Safety valve: handles role.*, subscription.*, and any other events
        // Log and ignore to prevent Clerk retry storms
        console.log(`Ignored event: ${evt.type}`);
        return new Response('Ignored', { status: 200 });
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response('Error: Processing failed', { status: 500 });
  } finally {
    // Disconnect Prisma client
    await safePrismaDisconnect(prisma);
  }
}
