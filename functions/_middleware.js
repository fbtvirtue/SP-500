const COOKIE_NAME = 'sp500_session';
const LOGIN_PATH = '/__auth/login';
const STATUS_PATH = '/__auth/status';
const LOGOUT_PATH = '/__auth/logout';
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  const configError = getConfigError(env);
  if (configError) {
    return new Response(configError, {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=UTF-8' },
    });
  }

  if (url.pathname === STATUS_PATH) {
    const authenticated = await isAuthenticated(request, env);
    return Response.json({ authenticated });
  }

  if (url.pathname === LOGIN_PATH) {
    if (request.method === 'POST') {
      return handleLogin(request, env, '/');
    }

    if (await isAuthenticated(request, env)) {
      return Response.redirect(new URL('/', request.url), 302);
    }

    return renderLoginPage({ redirectTo: '/', hasError: false });
  }

  if (url.pathname === LOGOUT_PATH) {
    return handleLogout(request);
  }

  if (isPublicPath(url.pathname)) {
    return next();
  }

  if (await isAuthenticated(request, env)) {
    return next();
  }

  if (url.pathname === '/data/predictions.json') {
    return new Response('Authentication required.', { status: 401 });
  }

  return new Response('Not found.', { status: 404 });
}

function isPublicPath(pathname) {
  return pathname === '/'
    || pathname === '/index.html'
    || pathname === '/favicon.ico'
    || pathname.startsWith('/assets/')
    || pathname === '/data/latest.json';
}

function getConfigError(env) {
  if (!env.PROTECTED_EMAIL) return 'Missing Cloudflare Pages secret: PROTECTED_EMAIL';
  if (!env.PROTECTED_PASSWORD) return 'Missing Cloudflare Pages secret: PROTECTED_PASSWORD';
  if (!env.AUTH_SESSION_SECRET) return 'Missing Cloudflare Pages secret: AUTH_SESSION_SECRET';
  return '';
}

async function handleLogin(request, env, fallbackRedirect = '/') {
  const form = await request.formData();
  const redirectTo = getSafeRedirect(form.get('redirect')) || fallbackRedirect;
  const submittedEmail = String(form.get('email') ?? '').trim().toLowerCase();
  const submittedPassword = String(form.get('password') ?? '');
  const expectedEmail = String(env.PROTECTED_EMAIL).trim().toLowerCase();
  const expectedPassword = String(env.PROTECTED_PASSWORD);

  if (submittedEmail !== expectedEmail || submittedPassword !== expectedPassword) {
    return renderLoginPage({ redirectTo, hasError: true }, 401);
  }

  const sessionValue = await createSessionToken(submittedEmail, env.AUTH_SESSION_SECRET, getSessionTtl(env));
  const headers = new Headers({ Location: redirectTo });
  headers.append('Set-Cookie', serializeCookie(COOKIE_NAME, sessionValue, getSessionTtl(env)));

  return new Response(null, {
    status: 302,
    headers,
  });
}

function handleLogout(request) {
  const homeUrl = new URL('/', request.url);
  const headers = new Headers({ Location: homeUrl.toString() });
  headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);

  return new Response(null, {
    status: 302,
    headers,
  });
}

function getSessionTtl(env) {
  const configured = Number.parseInt(String(env.AUTH_SESSION_TTL_SECONDS ?? ''), 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SESSION_TTL_SECONDS;
}

async function isAuthenticated(request, env) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return false;

  const sessionValue = parseCookies(cookieHeader)[COOKIE_NAME];
  if (!sessionValue) return false;

  const payload = await verifySessionToken(sessionValue, env.AUTH_SESSION_SECRET);
  if (!payload) return false;

  return payload.email === String(env.PROTECTED_EMAIL).trim().toLowerCase();
}

async function createSessionToken(email, secret, ttlSeconds) {
  const payload = {
    email,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = await signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

async function verifySessionToken(token, secret) {
  const [encodedPayload, providedSignature] = token.split('.');
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = await signValue(encodedPayload, secret);
  if (expectedSignature !== providedSignature) return null;

  let payload;

  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload));
  } catch {
    return null;
  }

  if (!payload || typeof payload.email !== 'string' || typeof payload.exp !== 'number') {
    return null;
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

async function signValue(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return encodeBase64Url(signature);
}

function parseCookies(cookieHeader) {
  return cookieHeader.split(';').reduce((cookies, part) => {
    const [name, ...valueParts] = part.trim().split('=');
    if (!name) return cookies;
    cookies[name] = valueParts.join('=');
    return cookies;
  }, {});
}

function serializeCookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function getSafeRedirect(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  return value;
}

function encodeBase64Url(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function renderLoginPage({ redirectTo, hasError }, status = 200) {
  const message = hasError ? 'Incorrect email or password.' : 'Sign in to view the S&P 500 monitor.';

  return new Response(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>S&P 500 Monitor Login</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "Segoe UI", sans-serif;
        background: linear-gradient(180deg, #f4f7fb 0%, #ebf2fa 38%, #f8fbff 100%);
        color: #10233d;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at 10% 10%, rgba(21, 101, 192, 0.12), transparent 24%),
          radial-gradient(circle at 90% 0%, rgba(0, 150, 136, 0.1), transparent 20%),
          linear-gradient(180deg, #f4f7fb 0%, #ebf2fa 38%, #f8fbff 100%);
      }

      main {
        width: min(100%, 430px);
        border: 1px solid rgba(16, 35, 61, 0.08);
        background: rgba(255, 255, 255, 0.9);
        border-radius: 28px;
        padding: 28px;
        box-shadow: 0 18px 50px rgba(16, 35, 61, 0.08);
      }

      .eyebrow {
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: #0f5bd6;
      }

      h1 {
        margin: 12px 0 10px;
        font-size: 2rem;
        line-height: 1;
      }

      p {
        margin: 0 0 20px;
        color: #40556f;
        line-height: 1.6;
      }

      label {
        display: block;
        margin-bottom: 14px;
        font-size: 0.92rem;
        font-weight: 600;
      }

      input {
        width: 100%;
        margin-top: 8px;
        padding: 14px 16px;
        border: 1px solid rgba(16, 35, 61, 0.12);
        border-radius: 14px;
        font: inherit;
      }

      button {
        width: 100%;
        padding: 14px 16px;
        border: 0;
        border-radius: 14px;
        background: #0f5bd6;
        color: white;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      .message {
        margin-bottom: 18px;
        padding: 12px 14px;
        border-radius: 14px;
        background: ${hasError ? 'rgba(196, 62, 62, 0.10)' : 'rgba(15, 91, 214, 0.08)'};
        color: ${hasError ? '#8d2020' : '#21436f'};
      }
    </style>
  </head>
  <body>
    <main>
      <div class="eyebrow">Protected Dashboard</div>
      <h1>S&P 500 Monitor</h1>
      <p>Sign in to unlock the protected prediction view while keeping the home dashboard public.</p>
      <div class="message">${message}</div>
      <form method="post" action="${escapeHtml(redirectTo)}">
        <input type="hidden" name="redirect" value="${escapeHtml(redirectTo)}" />
        <label>
          Email
          <input type="email" name="email" autocomplete="username" required />
        </label>
        <label>
          Password
          <input type="password" name="password" autocomplete="current-password" required />
        </label>
        <button type="submit">Sign in</button>
      </form>
    </main>
  </body>
</html>`, {
    status,
    headers: { 'content-type': 'text/html; charset=UTF-8' },
  });
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}