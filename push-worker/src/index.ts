import {
  buildPushPayload,
  type PushSubscription,
} from '@block65/webcrypto-web-push';

interface Env {
  DB: D1Database;
  APP_ORIGIN: string;
  VAPID_SUBJECT: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}

interface Reminder {
  goalId: string;
  title: string;
  body: string;
  time: string;
  kind: 'once' | 'daily' | 'weekly';
  weekdays: number[];
  nextAt?: string;
  skipDate?: string;
}

interface SubscriptionRow {
  device_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string;
  reminders_json: string;
  last_sent_json: string;
}

interface LocalClock {
  date: string;
  time: string;
  weekday: number;
}

const weekdayNumbers: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const corsHeaders = (env: Env) => ({
  'Access-Control-Allow-Origin': env.APP_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Vary': 'Origin',
});

const json = (env: Env, value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: {
    ...corsHeaders(env),
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
});

const localClock = (date: Date, timezone: string): LocalClock => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
    weekday: weekdayNumbers[part('weekday')] ?? -1,
  };
};

const isDue = (reminder: Reminder, clock: LocalClock, now: Date) => {
  if (reminder.skipDate === clock.date) return false;
  if (reminder.kind === 'once') {
    if (!reminder.nextAt) return false;
    const dueAt = Date.parse(reminder.nextAt);
    const delay = now.getTime() - dueAt;
    return delay >= 0 && delay < 10 * 60 * 1000;
  }
  if (reminder.time !== clock.time) return false;
  return reminder.kind === 'daily' || reminder.weekdays.includes(clock.weekday);
};

const sentKey = (reminder: Reminder, clock: LocalClock) =>
  reminder.kind === 'once'
    ? `${reminder.goalId}:${reminder.time}:${reminder.nextAt}`
    : `${reminder.goalId}:${reminder.time}:${clock.date}`;

const sendPush = async (
  env: Env,
  row: SubscriptionRow,
  payload: { title: string; body: string; goalId?: string },
) => {
  const subscription: PushSubscription = {
    endpoint: row.endpoint,
    expirationTime: null,
    keys: { p256dh: row.p256dh, auth: row.auth },
  };
  const init = await buildPushPayload({
    data: payload,
    options: { ttl: 300, urgency: 'high' },
  }, subscription, {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  });
  return fetch(row.endpoint, init);
};

const deliverDueReminders = async (env: Env) => {
  const result = await env.DB.prepare(
    `SELECT device_id, endpoint, p256dh, auth, timezone, reminders_json, last_sent_json
     FROM subscriptions
     WHERE reminders_json != '[]'
     ORDER BY updated_at DESC
     LIMIT 1000`,
  ).all<SubscriptionRow>();
  const now = new Date();
  let pushes = 0;

  for (const row of result.results) {
    if (pushes >= 40) break;
    let reminders: Reminder[];
    let lastSent: Record<string, number>;
    try {
      reminders = JSON.parse(row.reminders_json) as Reminder[];
      lastSent = JSON.parse(row.last_sent_json) as Record<string, number>;
    } catch {
      continue;
    }

    const clock = localClock(now, row.timezone);
    let changed = false;
    for (const reminder of reminders) {
      if (pushes >= 40 || !isDue(reminder, clock, now)) continue;
      const key = sentKey(reminder, clock);
      if (lastSent[key]) continue;

      const response = await sendPush(env, row, {
        title: `Quest: ${reminder.title}`,
        // Older clients sent the quest title as the body; drop it so the
        // notification does not repeat itself.
        body: reminder.body === reminder.title ? '' : reminder.body,
        goalId: reminder.goalId,
      });
      pushes += 1;

      if (response.status === 404 || response.status === 410) {
        await env.DB.prepare('DELETE FROM subscriptions WHERE device_id = ?')
          .bind(row.device_id)
          .run();
        changed = false;
        break;
      }
      if (response.ok) {
        lastSent[key] = now.getTime();
        changed = true;
      }
    }

    if (changed) {
      const cutoff = now.getTime() - 14 * 24 * 60 * 60 * 1000;
      const compact = Object.fromEntries(
        Object.entries(lastSent).filter(([, sentAt]) => sentAt >= cutoff),
      );
      await env.DB.prepare('UPDATE subscriptions SET last_sent_json = ? WHERE device_id = ?')
        .bind(JSON.stringify(compact), row.device_id)
        .run();
    }
  }
};

const handleRequest = async (request: Request, env: Env) => {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }
  if (request.headers.get('Origin') && request.headers.get('Origin') !== env.APP_ORIGIN) {
    return json(env, { error: 'Origin not allowed' }, 403);
  }
  if (request.method === 'GET' && url.pathname === '/config') {
    return json(env, { vapidPublicKey: env.VAPID_PUBLIC_KEY });
  }
  if (request.method === 'GET' && url.pathname === '/health') {
    return json(env, { ok: true });
  }
  if (request.method === 'PUT' && url.pathname === '/subscriptions') {
    const body = await request.json() as {
      deviceId?: string;
      timezone?: string;
      subscription?: {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      reminders?: Reminder[];
    };
    if (
      !body.deviceId
      || !/^[0-9a-f-]{36}$/i.test(body.deviceId)
      || !body.timezone
      || !body.subscription?.endpoint?.startsWith('https://')
      || !body.subscription.keys?.p256dh
      || !body.subscription.keys.auth
      || !Array.isArray(body.reminders)
    ) {
      return json(env, { error: 'Invalid subscription' }, 400);
    }
    try {
      localClock(new Date(), body.timezone);
    } catch {
      return json(env, { error: 'Invalid timezone' }, 400);
    }

    await env.DB.batch([
      env.DB.prepare('DELETE FROM subscriptions WHERE endpoint = ? AND device_id != ?')
        .bind(body.subscription.endpoint, body.deviceId),
      env.DB.prepare(
        `INSERT INTO subscriptions
          (device_id, endpoint, p256dh, auth, timezone, reminders_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(device_id) DO UPDATE SET
           endpoint = excluded.endpoint,
           p256dh = excluded.p256dh,
           auth = excluded.auth,
           timezone = excluded.timezone,
           reminders_json = excluded.reminders_json,
           updated_at = excluded.updated_at`,
      ).bind(
        body.deviceId,
        body.subscription.endpoint,
        body.subscription.keys.p256dh,
        body.subscription.keys.auth,
        body.timezone,
        JSON.stringify(body.reminders.slice(0, 200)),
        Date.now(),
      ),
    ]);
    return json(env, { ok: true, reminders: Math.min(body.reminders.length, 200) });
  }
  if (request.method === 'POST' && url.pathname === '/test') {
    const body = await request.json() as { deviceId?: string };
    if (!body.deviceId) return json(env, { error: 'Missing device ID' }, 400);
    const row = await env.DB.prepare(
      `SELECT device_id, endpoint, p256dh, auth, timezone, reminders_json, last_sent_json
       FROM subscriptions WHERE device_id = ?`,
    ).bind(body.deviceId).first<SubscriptionRow>();
    if (!row) return json(env, { error: 'Subscription not found' }, 404);
    const response = await sendPush(env, row, {
      title: 'LifeQuest Web Push test',
      body: 'Background notifications are working.',
    });
    if (response.status === 404 || response.status === 410) {
      await env.DB.prepare('DELETE FROM subscriptions WHERE device_id = ?').bind(body.deviceId).run();
    }
    return json(env, { ok: response.ok, status: response.status }, response.ok ? 200 : 502);
  }
  return json(env, { error: 'Not found' }, 404);
};

export default {
  fetch: handleRequest,
  scheduled(_controller, env, context) {
    context.waitUntil(deliverDueReminders(env));
  },
} satisfies ExportedHandler<Env>;
