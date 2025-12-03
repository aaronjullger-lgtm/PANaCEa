/**
 * Clerk authentication verification endpoint
 * Verifies JWT tokens and returns user information
 */

interface Env {
  CLERK_SECRET_KEY?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

/**
 * Verify a Clerk session token
 * This is a simplified version - in production, use @clerk/backend
 */
async function verifyClerkToken(token: string, secretKey: string): Promise<{ userId: string; email: string } | null> {
  try {
    // In a real implementation, you would verify the JWT signature
    // For now, we'll use a simplified version that calls Clerk's API
    const response = await fetch('https://api.clerk.com/v1/sessions/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      userId: data.user_id,
      email: data.email,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const secretKey = env.CLERK_SECRET_KEY;

    if (!secretKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const userInfo = await verifyClerkToken(token, secretKey);

    if (!userInfo) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        userId: userInfo.userId,
        email: userInfo.email,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('Verification error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
