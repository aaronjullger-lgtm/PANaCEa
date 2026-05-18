import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  getClerkE2ECredentials,
  missingClerkE2ECredentialsMessage,
  signInWithClerkCredentials,
} from '../helpers/clerkAuth';

const authRequired = process.env.E2E_REQUIRE_AUTH === '1';
const clerkCredentials = getClerkE2ECredentials();
const hasAuthCredentials = Boolean(clerkCredentials);
const hiddenPrivateBetaRoutes = [
  '/daily-challenges',
  '/live-collaboration',
  '/explorer',
  '/clinical-eye',
  '/visualizer',
  '/lecture-converter',
  '/technique-check',
] as const;

if (authRequired && !hasAuthCredentials) {
  throw new Error(missingClerkE2ECredentialsMessage());
}

async function getJson(request: APIRequestContext, path: string, token?: string) {
  const response = await request.get(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const body = await response.json();
  return { response, body };
}

async function postJson(
  request: APIRequestContext,
  path: string,
  token: string,
  data: Record<string, unknown>
) {
  const response = await request.post(path, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await response.json();
  return { response, body };
}

function dataFromEnvelope(body: any) {
  return body?.ok === true ? body.data : body?.data;
}

function expectStandardError(body: any, code: string) {
  expect(body).toMatchObject({
    ok: false,
    error: {
      code,
    },
  });
}

function taskLaunchUrl(task: any): string {
  const route =
    typeof task?.route === 'string' && task.route.startsWith('/')
      ? task.route
      : '/study/main-session';
  const url = new URL(route, 'https://panacea.test');
  const launchParams =
    task?.launchParams && typeof task.launchParams === 'object' ? task.launchParams : {};

  for (const [key, value] of Object.entries(launchParams)) {
    if (value != null) url.searchParams.set(key, String(value));
  }
  if (task?.mode) url.searchParams.set('mode', String(task.mode));
  if (task?.id) url.searchParams.set('taskId', String(task.id));
  if (!url.searchParams.has('source')) url.searchParams.set('source', 'study-plan');

  return `${url.pathname}${url.search}`;
}

test.describe('production smoke: public runtime', () => {
  test('GET /api/health returns public liveness', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      endpoint: '/api/health',
      status: 'ok',
    });
    expect(body.checks?.functionDeployed?.status).toBe('pass');
    expect(body).not.toHaveProperty('diagnostics');
  });

  test('app shell loads at /study', async ({ page }) => {
    const response = await page.goto('/study', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/missing publishable key/i);
  });

  test('unauthenticated protected API request returns standard 401 shape', async ({ request }) => {
    const response = await request.get('/api/user/stats');
    expect(response.status()).toBe(401);

    const body = await response.json();
    expectStandardError(body, 'UNAUTHORIZED');
  });
});

test.describe.serial('production smoke: authenticated core study loop', () => {
  test('signs in, studies, persists progress, launches plan context, and searches content', async ({
    page,
    request,
  }, testInfo) => {
    if (!clerkCredentials) {
      test.skip(true, 'Set Clerk smoke credentials to run authenticated smoke.');
      return;
    }

    const token = await signInWithClerkCredentials(page, clerkCredentials, {
      startPath: '/study',
    });
    await page.context().storageState({ path: testInfo.outputPath('auth-state.json') });

    for (const route of hiddenPrivateBetaRoutes) {
      const hiddenRouteResponse = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(hiddenRouteResponse?.status()).toBeLessThan(500);
      await expect(page.locator('body')).toContainText(/not part of the beta yet/i);
    }

    for (const route of ['/medical-database', '/clinical-profile'] as const) {
      const routeResponse = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(routeResponse?.status()).toBeLessThan(500);
      await expect(page.locator('body')).not.toContainText(/not part of the beta yet/i);
    }

    const adminResponse = await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    expect(adminResponse?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toContainText(/admin|access|authorized|dashboard/i);

    await page.goto('/study', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.dispatchEvent(new Event('panacea:open-command-palette')));
    await expect(page.getByText('Clinical Eye (Visual Dx)')).toHaveCount(0);
    await expect(page.getByText('Explorer')).toHaveCount(0);
    await page.keyboard.press('Escape');

    const dashboardBefore = await getJson(request, '/api/dashboard/stats', token);
    expect(dashboardBefore.response.status()).toBe(200);
    expect(dataFromEnvelope(dashboardBefore.body)).toBeTruthy();

    const generated = await postJson(request, '/api/study/session/generate', token, {
      mode: 'adaptive',
      size: 5,
      blueprintStage: 'production-smoke',
    });
    expect(generated.response.status()).toBe(200);
    const session = dataFromEnvelope(generated.body);
    expect(session?.sessionId).toEqual(expect.any(String));
    expect(Array.isArray(session?.questions)).toBe(true);
    expect(session.questions.length).toBeGreaterThan(0);

    const sessionQuestions = await getJson(
      request,
      `/api/study/session/${encodeURIComponent(session.sessionId)}/questions`,
      token
    );
    expect(sessionQuestions.response.status()).toBe(200);
    expect(dataFromEnvelope(sessionQuestions.body)?.questions?.length).toBeGreaterThan(0);

    const sessionPage = await page.goto(`/session/${encodeURIComponent(session.sessionId)}`, {
      waitUntil: 'domcontentloaded',
    });
    expect(sessionPage?.status()).toBeLessThan(500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).not.toContainText(/could not load session/i, {
      timeout: 15_000,
    });

    const firstQuestion = session.questions[0];
    const idempotencyKey = `production-smoke-${Date.now()}-${String(firstQuestion.id).slice(0, 16)}`;
    const attempt = await postJson(request, '/api/questions/attempt', token, {
      questionId: firstQuestion.id,
      isCorrect: true,
      selectedAnswer: 0,
      system: firstQuestion.system ?? firstQuestion.condition?.system ?? undefined,
      conditionId: firstQuestion.conditionId ?? undefined,
      questionType: firstQuestion.questionType ?? 'question',
      mode: 'session',
      timeSpentMs: 1000,
      idempotencyKey,
    });
    expect(attempt.response.status()).toBe(200);
    expect(dataFromEnvelope(attempt.body)?.success).toBe(true);

    const duplicateAttempt = await postJson(request, '/api/questions/attempt', token, {
      questionId: firstQuestion.id,
      isCorrect: true,
      selectedAnswer: 0,
      system: firstQuestion.system ?? firstQuestion.condition?.system ?? undefined,
      questionType: firstQuestion.questionType ?? 'question',
      mode: 'session',
      timeSpentMs: 1000,
      idempotencyKey,
    });
    expect(duplicateAttempt.response.status()).toBe(200);
    expect(dataFromEnvelope(duplicateAttempt.body)?.success).toBe(true);

    const dashboardAfter = await getJson(request, '/api/dashboard/stats', token);
    expect(dashboardAfter.response.status()).toBe(200);
    expect(dataFromEnvelope(dashboardAfter.body)).toBeTruthy();

    const planResponse = await getJson(request, '/api/users/me/daily-plan', token);
    expect(planResponse.response.status()).toBe(200);
    const plan = dataFromEnvelope(planResponse.body);
    expect(Array.isArray(plan?.tasks ?? plan?.recommendedSessions)).toBe(true);
    const task = (plan.tasks ?? plan.recommendedSessions ?? [])[0];
    if (task) {
      const launchResponse = await page.goto(taskLaunchUrl(task), {
        waitUntil: 'domcontentloaded',
      });
      expect(launchResponse?.status()).toBeLessThan(500);

      await postJson(request, '/api/users/me/daily-plan', token, {
        action: 'complete',
        taskId: task.id,
        questionsAnswered: 1,
        accuracy: 1,
        durationMinutes: 1,
      });
    }

    const conditionSearch = await getJson(
      request,
      `/api/conditions/search?q=${encodeURIComponent('asthma')}&limit=5`
    );
    expect(conditionSearch.response.status()).toBe(200);

    const drugSearch = await getJson(
      request,
      `/api/drugs/search?q=${encodeURIComponent('metformin')}&limit=5`
    );
    expect(drugSearch.response.status()).toBe(200);

    const conditionResults = dataFromEnvelope(conditionSearch.body) ?? [];
    const drugResults = dataFromEnvelope(drugSearch.body) ?? [];
    expect(conditionResults.length + drugResults.length).toBeGreaterThan(0);

    const noResultSearch = await getJson(
      request,
      `/api/conditions/search?q=${encodeURIComponent('__no_such_condition_!@#_2026')}&limit=5`
    );
    expect(noResultSearch.response.status()).toBe(200);
    expect(dataFromEnvelope(noResultSearch.body)).toEqual([]);
  });
});
