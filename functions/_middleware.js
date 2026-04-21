const AUTH_COOKIE_NAME = 'sp500_session';
const SUPPORTER_COOKIE_NAME = 'sp500_supporter';
const MEMBER_ACCESS_COOKIE_NAME = 'sp500_member_access';
const LOGIN_PATH = '/__auth/login';
const STATUS_PATH = '/__auth/status';
const LOGOUT_PATH = '/__auth/logout';
const MEMBERS_CHALLENGE_PATH = '/__members/challenge';
const MEMBERS_VERIFY_PATH = '/__members/verify';
const MEMBERS_TABLE_PATH = '/__members/table';
const MEMBERS_EXPORT_PATH = '/__members/export';
const SUPPORTER_CHECKOUT_PATH = '/__supporter/checkout';
const SUPPORTER_CLAIM_PATH = '/__supporter/claim';
const SUPPORTER_WEBHOOK_PATH = '/__supporter/webhook';
const MEMBERS_DATA_PATH = '/data/current-members.json';
const PREDICTIONS_DATA_PATH = '/data/predictions.json';
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEFAULT_SUPPORTER_TTL_SECONDS = 60 * 60 * 24;
const DEFAULT_SUPPORTER_PENDING_TTL_SECONDS = 60 * 60 * 2;
const DEFAULT_MEMBER_ACCESS_TTL_SECONDS = 60 * 30;
const DEFAULT_MEMBER_CHALLENGE_TTL_SECONDS = 60 * 5;
const DEFAULT_MEMBER_CHALLENGE_DIFFICULTY = 3;
const DEFAULT_MEMBERS_PAGE_SIZE = 50;
const MAX_MEMBERS_PAGE_SIZE = 100;
const SUPPORTER_CLAIM_PREFIX = 'supporter-claim:';

const MEMBERS_SORT_KEYS = new Set([
  'ticker',
  'security',
  'sector',
  'sectorDominance',
  'currentMemberSince',
  'lastLeftAt',
  'dividendRate',
  'dividendYield',
  'marketCap',
  'forwardPE',
  'price',
]);

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
    const supporter = await hasSupporterAccess(request, env);
    return Response.json({
      authenticated,
      supporter,
      supporterEnabled: isSupporterCheckoutConfigured(env),
      canExport: authenticated || supporter,
      supporterExportTtlSeconds: isSupporterCheckoutConfigured(env) ? getSupporterTtl(env) : null,
    });
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

  if (url.pathname === MEMBERS_CHALLENGE_PATH) {
    return handleMembersChallenge(env);
  }

  if (url.pathname === MEMBERS_VERIFY_PATH) {
    return handleMembersVerify(request, env);
  }

  if (url.pathname === MEMBERS_TABLE_PATH) {
    if (await isAuthenticated(request, env) || await hasSupporterAccess(request, env) || await hasMemberAccess(request, env)) {
      return handleMembersTable(context);
    }

    return new Response('Browser verification required.', { status: 401 });
  }

  if (url.pathname === MEMBERS_EXPORT_PATH) {
    if (await isAuthenticated(request, env) || await hasSupporterAccess(request, env)) {
      return handleMembersExport(context);
    }

    return new Response('Export access required.', { status: 403 });
  }

  if (url.pathname === SUPPORTER_CHECKOUT_PATH) {
    return handleSupporterCheckout(request, env);
  }

  if (url.pathname === SUPPORTER_CLAIM_PATH) {
    return handleSupporterClaim(request, env);
  }

  if (url.pathname === SUPPORTER_WEBHOOK_PATH) {
    return handleSupporterWebhook(request, env);
  }

  if (url.pathname === MEMBERS_DATA_PATH) {
    return new Response('Not found.', { status: 404 });
  }

  if (url.pathname === PREDICTIONS_DATA_PATH) {
    if (await isAuthenticated(request, env)) {
      return withNoStore(await next());
    }

    return new Response('Authentication required.', { status: 401 });
  }

  if (isPublicPath(url.pathname)) {
    return next();
  }

  if (await isAuthenticated(request, env)) {
    return next();
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

function withNoStore(response) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function getConfigError(env) {
  if (!env.PROTECTED_EMAIL) return 'Missing Cloudflare Pages secret: PROTECTED_EMAIL';
  if (!env.PROTECTED_PASSWORD) return 'Missing Cloudflare Pages secret: PROTECTED_PASSWORD';
  if (!env.AUTH_SESSION_SECRET) return 'Missing Cloudflare Pages secret: AUTH_SESSION_SECRET';
  return '';
}

function isSupporterCheckoutConfigured(env) {
  return Boolean(
    env.LEMON_SQUEEZY_API_KEY
      && env.LEMON_SQUEEZY_STORE_ID
      && env.LEMON_SQUEEZY_VARIANT_ID
      && env.LEMON_SQUEEZY_WEBHOOK_SECRET
      && env.SUPPORTER_CLAIMS,
  );
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

  const sessionValue = await createSignedToken({
    email: submittedEmail,
    scope: 'auth',
    exp: Math.floor(Date.now() / 1000) + getSessionTtl(env),
  }, env.AUTH_SESSION_SECRET);
  const headers = new Headers({ Location: redirectTo });
  headers.append('Set-Cookie', serializeCookie(AUTH_COOKIE_NAME, sessionValue, getSessionTtl(env)));

  return new Response(null, {
    status: 302,
    headers,
  });
}

function handleLogout(request) {
  const homeUrl = new URL('/', request.url);
  const headers = new Headers({ Location: homeUrl.toString() });
  headers.append('Set-Cookie', `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  headers.append('Set-Cookie', `${MEMBER_ACCESS_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);

  return new Response(null, {
    status: 302,
    headers,
  });
}

async function handleMembersChallenge(env) {
  const challengeToken = await createSignedToken({
    scope: 'member-challenge',
    nonce: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + getMemberChallengeTtl(env),
  }, env.AUTH_SESSION_SECRET);

  return Response.json({
    challengeToken,
    difficulty: getMemberChallengeDifficulty(env),
  }, {
    headers: { 'cache-control': 'no-store' },
  });
}

async function handleMembersVerify(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed.', { status: 405 });
  }

  const body = await readJson(request);
  const challengeToken = String(body.challengeToken ?? '');
  const solution = String(body.solution ?? '');
  const payload = await verifySignedToken(challengeToken, env.AUTH_SESSION_SECRET);

  if (!payload || payload.scope !== 'member-challenge' || typeof payload.nonce !== 'string') {
    return Response.json({ error: 'Invalid challenge.' }, { status: 400 });
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return Response.json({ error: 'Challenge expired.' }, { status: 400 });
  }

  const digest = await sha256Hex(`${challengeToken}:${solution}`);
  if (!digest.startsWith('0'.repeat(getMemberChallengeDifficulty(env)))) {
    return Response.json({ error: 'Challenge failed.' }, { status: 401 });
  }

  const ttl = getMemberAccessTtl(env);
  const accessToken = await createSignedToken({
    scope: 'member-access',
    exp: Math.floor(Date.now() / 1000) + ttl,
  }, env.AUTH_SESSION_SECRET);
  const headers = new Headers({ 'cache-control': 'no-store' });
  headers.append('Set-Cookie', serializeCookie(MEMBER_ACCESS_COOKIE_NAME, accessToken, ttl));
  return new Response(null, { status: 204, headers });
}

async function handleMembersTable(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return new Response('Method not allowed.', { status: 405 });
  }

  const url = new URL(request.url);
  const query = String(url.searchParams.get('query') ?? '').trim();
  const sortKey = getMembersSortKey(url.searchParams.get('sort'));
  const sortDirection = getMembersSortDirection(url.searchParams.get('direction'), sortKey);
  const pageSize = getMembersPageSize(url.searchParams.get('pageSize'));
  const requestedPage = getPositiveInteger(url.searchParams.get('page')) || 1;

  const dataset = await loadCurrentMembersData(context);
  const allRows = Array.isArray(dataset.currentMembers) ? dataset.currentMembers : [];
  const sectorMarketCaps = getSectorMarketCaps(allRows);
  const filteredRows = filterMemberRows(allRows, query);
  const sortedRows = [...filteredRows].sort((left, right) => {
    const comparison = compareMembershipValues(
      getMembershipSortValue(left, sortKey, sectorMarketCaps),
      getMembershipSortValue(right, sortKey, sectorMarketCaps),
      sortDirection,
    );

    if (comparison !== 0) return comparison;
    return left.ticker.localeCompare(right.ticker, undefined, { sensitivity: 'base' });
  });

  const totalCount = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const startIndex = (page - 1) * pageSize;
  const pageRows = sortedRows.slice(startIndex, startIndex + pageSize);

  return Response.json({
    generatedAt: dataset.generatedAt,
    currentMembers: pageRows,
    sectorMarketCaps: Object.fromEntries(sectorMarketCaps.entries()),
    totalCount,
    page,
    pageSize,
    totalPages,
  }, {
    headers: { 'cache-control': 'no-store' },
  });
}

async function handleMembersExport(context) {
  const { request } = context;

  if (request.method !== 'GET') {
    return new Response('Method not allowed.', { status: 405 });
  }

  const url = new URL(request.url);
  const format = getExportFormat(url.searchParams.get('format'));
  const decimalSeparator = getDecimalSeparator(url.searchParams.get('decimal'));
  const query = String(url.searchParams.get('query') ?? '').trim();
  const sortKey = getMembersSortKey(url.searchParams.get('sort'));
  const sortDirection = getMembersSortDirection(url.searchParams.get('direction'), sortKey);

  const dataset = await loadCurrentMembersData(context);
  const allRows = Array.isArray(dataset.currentMembers) ? dataset.currentMembers : [];
  const sectorMarketCaps = getSectorMarketCaps(allRows);
  const filteredRows = filterMemberRows(allRows, query);
  const sortedRows = [...filteredRows].sort((left, right) => {
    const comparison = compareMembershipValues(
      getMembershipSortValue(left, sortKey, sectorMarketCaps),
      getMembershipSortValue(right, sortKey, sectorMarketCaps),
      sortDirection,
    );

    if (comparison !== 0) return comparison;
    return left.ticker.localeCompare(right.ticker, undefined, { sensitivity: 'base' });
  });

  const exportDocument = buildMembershipExportDocument(sortedRows, sectorMarketCaps, {
    generatedAt: dataset.generatedAt,
    decimalSeparator,
  });

  if (format === 'csv') {
    const delimiter = decimalSeparator === ',' ? ';' : ',';
    const csvText = buildDelimitedText(
      [...exportDocument.metadataRows, exportDocument.headerRow, ...exportDocument.dataRows],
      delimiter,
    );

    return new Response(`\uFEFF${csvText}\n`, {
      headers: {
        'cache-control': 'no-store',
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${buildExportFilename('csv', dataset.generatedAt)}"`,
      },
    });
  }

  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('S&P 500 Members');
  const xlsxFormats = getXlsxNumberFormats(decimalSeparator);

  worksheet.columns = membershipExportColumns.map((columnWidth, index) => ({
    key: String(index),
    width: columnWidth,
  }));

  for (const row of exportDocument.metadataRows) {
    const addedRow = worksheet.addRow(row);
    if (row.length) {
      addedRow.getCell(1).font = { bold: true };
      addedRow.getCell(2).alignment = { wrapText: true };
    }
  }

  const headerRow = worksheet.addRow(exportDocument.headerRow);
  headerRow.font = { bold: true };
  worksheet.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number, column: membershipExportHeaders.length },
  };

  // Write rows in the export-specific column order. For XLSX we write real Date objects
  // for Member since / Last left so Excel treats them as dates.
  for (const row of sortedRows) {
    const memberSinceDate = row.currentMemberSince ? new Date(row.currentMemberSince) : null;
    const lastLeftDate = row.lastLeftAt ? new Date(row.lastLeftAt) : null;
    const eps = (typeof row.metrics?.price === 'number' && typeof row.metrics?.trailingPE === 'number' && row.metrics?.trailingPE)
      ? (row.metrics.price / row.metrics.trailingPE)
      : null;

    worksheet.addRow([
      row.ticker,
      row.security,
      row.sector,
      getSectorDominance(row, sectorMarketCaps),
      row.dividend?.hasDividend ? row.dividend.dividendRate : null,
      row.dividend?.dividendYield ?? null,
      row.metrics?.marketCap ?? null,
      memberSinceDate,
      lastLeftDate,
      null, // MA50
      null, // MA200
      eps,
      row.metrics?.forwardPE ?? null,
      row.metrics?.price ?? null,
    ]);
  }

  // Apply XLSX number formats
  worksheet.getColumn(4).numFmt = xlsxFormats.percent; // Dominance
  worksheet.getColumn(5).numFmt = xlsxFormats.currency; // Dividend
  worksheet.getColumn(6).numFmt = xlsxFormats.percent; // Yield
  worksheet.getColumn(7).numFmt = xlsxFormats.currency; // Market cap
  worksheet.getColumn(8).numFmt = 'mm/dd/yyyy'; // Member since
  worksheet.getColumn(9).numFmt = 'mm/dd/yyyy'; // Last left
  worksheet.getColumn(10).numFmt = xlsxFormats.currency; // MA50
  worksheet.getColumn(11).numFmt = xlsxFormats.currency; // MA200
  worksheet.getColumn(12).numFmt = xlsxFormats.decimal; // EPS
  worksheet.getColumn(13).numFmt = xlsxFormats.decimal; // Forward P/E
  worksheet.getColumn(14).numFmt = xlsxFormats.currency; // Current price

  const workbookBytes = await workbook.xlsx.writeBuffer();
  return new Response(workbookBytes, {
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${buildExportFilename('xlsx', dataset.generatedAt)}"`,
    },
  });
}

async function handleSupporterCheckout(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed.', { status: 405 });
  }

  if (!isSupporterCheckoutConfigured(env)) {
    return Response.json({ error: 'Lemon Squeezy supporter checkout is not configured.' }, { status: 503 });
  }

  const claimToken = crypto.randomUUID();
  const claimKey = getSupporterClaimKey(claimToken);
  const origin = new URL(request.url).origin;
  const claimUrl = `${origin}${SUPPORTER_CLAIM_PATH}?claim=${encodeURIComponent(claimToken)}`;
  const expiresAt = new Date(Date.now() + getSupporterPendingTtl(env) * 1000).toISOString();

  await env.SUPPORTER_CLAIMS.put(claimKey, JSON.stringify({
    status: 'pending',
    createdAt: new Date().toISOString(),
  }), { expirationTtl: getSupporterPendingTtl(env) });

  const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${String(env.LEMON_SQUEEZY_API_KEY)}`,
    },
    body: JSON.stringify({
      data: {
        type: 'checkouts',
        attributes: {
          product_options: {
            redirect_url: claimUrl,
            receipt_button_text: 'Return to S&P 500 Monitor',
            receipt_link_url: claimUrl,
          },
          checkout_data: {
            custom: {
              claim_token: claimToken,
            },
          },
          expires_at: expiresAt,
        },
        relationships: {
          store: {
            data: { type: 'stores', id: String(env.LEMON_SQUEEZY_STORE_ID) },
          },
          variant: {
            data: { type: 'variants', id: String(env.LEMON_SQUEEZY_VARIANT_ID) },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    await env.SUPPORTER_CLAIMS.delete(claimKey);
    const details = await response.text();
    return Response.json({ error: `Could not create Lemon Squeezy checkout. ${details}`.trim() }, { status: 502 });
  }

  const payload = await response.json();
  const checkoutUrl = payload?.data?.attributes?.url;

  if (typeof checkoutUrl !== 'string' || !checkoutUrl) {
    await env.SUPPORTER_CLAIMS.delete(claimKey);
    return Response.json({ error: 'Lemon Squeezy checkout URL was missing from the response.' }, { status: 502 });
  }

  return Response.json({ url: checkoutUrl }, {
    headers: { 'cache-control': 'no-store' },
  });
}

async function handleSupporterClaim(request, env) {
  const url = new URL(request.url);
  const claimToken = String(url.searchParams.get('claim') ?? '').trim();

  if (!claimToken) {
    return new Response('Missing supporter claim.', { status: 400 });
  }

  if (!isSupporterCheckoutConfigured(env)) {
    return new Response('Lemon Squeezy supporter checkout is not configured.', { status: 503 });
  }

  const record = await readSupporterClaim(env, claimToken);
  if (record?.status === 'paid') {
    const ttl = getSupporterTtl(env);
    const supporterToken = await createSignedToken({
      scope: 'supporter',
      claimToken,
      exp: Math.floor(Date.now() / 1000) + ttl,
    }, env.AUTH_SESSION_SECRET);

    await env.SUPPORTER_CLAIMS.put(getSupporterClaimKey(claimToken), JSON.stringify({
      ...record,
      claimedAt: new Date().toISOString(),
    }), { expirationTtl: ttl });

    const headers = new Headers({ Location: new URL('/', request.url).toString() });
    headers.append('Set-Cookie', serializeCookie(SUPPORTER_COOKIE_NAME, supporterToken, ttl));
    return new Response(null, { status: 302, headers });
  }

  if (record?.status === 'revoked') {
    return renderSupporterClaimPage('Your payment could not unlock export access because the order was refunded or revoked.', false);
  }

  return renderSupporterClaimPage('Waiting for Lemon Squeezy to confirm your payment. This page refreshes automatically.', true);
}

async function handleSupporterWebhook(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed.', { status: 405 });
  }

  if (!isSupporterCheckoutConfigured(env)) {
    return new Response('Lemon Squeezy supporter checkout is not configured.', { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('X-Signature') || '';
  const expectedSignature = await signHex(rawBody, String(env.LEMON_SQUEEZY_WEBHOOK_SECRET));

  if (!timingSafeEqual(signature, expectedSignature)) {
    return new Response('Invalid signature.', { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const eventName = String(request.headers.get('X-Event-Name') || payload?.meta?.event_name || '');
  const claimToken = String(payload?.meta?.custom_data?.claim_token || '').trim();

  if (!claimToken) {
    return new Response('ok', { status: 200 });
  }

  const claimKey = getSupporterClaimKey(claimToken);
  const record = await readSupporterClaim(env, claimToken) || { status: 'pending' };
  const orderStatus = String(payload?.data?.attributes?.status || '');
  const orderIdentifier = String(payload?.data?.attributes?.identifier || '');

  if (eventName === 'order_created' && orderStatus === 'paid') {
    await env.SUPPORTER_CLAIMS.put(claimKey, JSON.stringify({
      ...record,
      status: 'paid',
      orderIdentifier,
      paidAt: new Date().toISOString(),
    }), { expirationTtl: getSupporterTtl(env) });
  }

  if (eventName === 'order_refunded' || orderStatus === 'refunded' || orderStatus === 'fraudulent') {
    await env.SUPPORTER_CLAIMS.put(claimKey, JSON.stringify({
      ...record,
      status: 'revoked',
      orderIdentifier,
      revokedAt: new Date().toISOString(),
    }), { expirationTtl: getSupporterTtl(env) });
  }

  return new Response('ok', { status: 200 });
}

function getSessionTtl(env) {
  const configured = Number.parseInt(String(env.AUTH_SESSION_TTL_SECONDS ?? ''), 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SESSION_TTL_SECONDS;
}

function getSupporterTtl(env) {
  const configured = Number.parseInt(String(env.SUPPORTER_EXPORT_TTL_SECONDS ?? ''), 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SUPPORTER_TTL_SECONDS;
}

function getSupporterPendingTtl(env) {
  const configured = Number.parseInt(String(env.SUPPORTER_PENDING_TTL_SECONDS ?? ''), 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SUPPORTER_PENDING_TTL_SECONDS;
}

function getMemberAccessTtl(env) {
  const configured = Number.parseInt(String(env.MEMBER_ACCESS_TTL_SECONDS ?? ''), 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MEMBER_ACCESS_TTL_SECONDS;
}

function getMemberChallengeTtl(env) {
  const configured = Number.parseInt(String(env.MEMBER_CHALLENGE_TTL_SECONDS ?? ''), 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MEMBER_CHALLENGE_TTL_SECONDS;
}

function getMemberChallengeDifficulty(env) {
  const configured = Number.parseInt(String(env.MEMBER_CHALLENGE_DIFFICULTY ?? ''), 10);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MEMBER_CHALLENGE_DIFFICULTY;
}

async function loadCurrentMembersData(context) {
  const assetUrl = new URL(MEMBERS_DATA_PATH, context.request.url).toString();
  const assetRequest = new Request(assetUrl, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  const assetResponse = await context.env.ASSETS.fetch(assetRequest);

  if (!assetResponse.ok) {
    throw new Error('Could not load the current members dataset.');
  }

  return await assetResponse.json();
}

function filterMemberRows(rows, query) {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return rows;

  return rows.filter((row) => [row.ticker, row.security, row.sector, row.subIndustry].join(' ').toLowerCase().includes(normalized));
}

function getSectorMarketCaps(rows) {
  const totals = new Map();

  for (const row of rows) {
    const marketCap = row?.metrics?.marketCap;
    if (typeof marketCap !== 'number' || Number.isNaN(marketCap)) continue;
    totals.set(row.sector, (totals.get(row.sector) || 0) + marketCap);
  }

  return totals;
}

function getSectorDominance(row, sectorMarketCaps) {
  const marketCap = row?.metrics?.marketCap;
  if (typeof marketCap !== 'number' || Number.isNaN(marketCap)) return null;

  const sectorTotal = sectorMarketCaps.get(row.sector);
  if (typeof sectorTotal !== 'number' || Number.isNaN(sectorTotal) || sectorTotal <= 0) return null;

  return marketCap / sectorTotal;
}

function getMembershipSortValue(row, key, sectorMarketCaps) {
  switch (key) {
    case 'ticker':
      return row.ticker;
    case 'security':
      return row.security;
    case 'sector':
      return row.sector;
    case 'sectorDominance':
      return getSectorDominance(row, sectorMarketCaps);
    case 'currentMemberSince':
      return row.currentMemberSince ? Date.parse(row.currentMemberSince) : null;
    case 'lastLeftAt':
      return row.lastLeftAt ? Date.parse(row.lastLeftAt) : null;
    case 'dividendRate':
      return row.dividend?.hasDividend ? row.dividend.dividendRate : null;
    case 'dividendYield':
      return row.dividend?.dividendYield ?? null;
    case 'marketCap':
      return row.metrics?.marketCap ?? null;
    case 'forwardPE':
      return row.metrics?.forwardPE ?? null;
    case 'price':
      return row.metrics?.price ?? null;
    default:
      return null;
  }
}

function compareMembershipValues(left, right, direction) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  const modifier = direction === 'asc' ? 1 : -1;

  if (typeof left === 'string' && typeof right === 'string') {
    return left.localeCompare(right, undefined, { sensitivity: 'base' }) * modifier;
  }

  if (left < right) return -1 * modifier;
  if (left > right) return 1 * modifier;
  return 0;
}

function getMembersSortKey(value) {
  return MEMBERS_SORT_KEYS.has(value) ? value : 'marketCap';
}

function getMembersSortDirection(value, sortKey) {
  if (value === 'asc' || value === 'desc') return value;

  switch (sortKey) {
    case 'ticker':
    case 'security':
    case 'sector':
      return 'asc';
    default:
      return 'desc';
  }
}

function getMembersPageSize(value) {
  const parsed = getPositiveInteger(value);
  if (!parsed) return DEFAULT_MEMBERS_PAGE_SIZE;
  return Math.min(parsed, MAX_MEMBERS_PAGE_SIZE);
}

function getPositiveInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const membershipExportColumns = [10, 28, 22, 14, 14, 10, 16, 12, 12, 12, 12, 12, 12, 14];
const exportDataSources = [
  'Wikipedia current S&P 500 constituents and change history',
  'Wikipedia S&P 400, S&P 600, and Nasdaq-100 constituent lists',
  'Finviz quote pages for market cap, valuation, and dividend fields',
];
const exportWarningText = 'This file is generated automatically from public data sources and is intended for monitoring and research only. It is not financial advice.';
const membershipExportHeaders = [
  'Ticker', 'Company', 'Sector', 'Dominance', 'Dividend', 'Yield', 'Market cap', 'Member since', 'Last left',
  'MA50', 'MA200', 'EPS', 'Forward P/E', 'Current price',
];

function getExportFormat(value) {
  return value === 'csv' ? 'csv' : 'xlsx';
}

function getDecimalSeparator(value) {
  return value === ',' ? ',' : '.';
}

function getExportLocale(decimalSeparator) {
  return decimalSeparator === ',' ? 'de-DE' : 'en-US';
}

function getXlsxNumberFormats() {
  return {
    percent: '0.00%',
    currency: '$#,##0.00',
    decimal: '0.00',
  };
}

function formatExportDate(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
}

function formatExportDateTime(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

function formatTimestampForFilename(value) {
  const fallback = new Date().toISOString();
  const date = value ? new Date(value) : new Date(fallback);
  const safeValue = Number.isNaN(date.getTime()) ? fallback : date.toISOString();
  return safeValue.replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
}

function buildExportFilename(format, generatedAt) {
  return `sp500-members-${formatTimestampForFilename(generatedAt)}.${format}`;
}

function formatLocalizedNumber(value, locale, options) {
  if (value === null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat(locale, options).format(value);
}

function formatLocalizedCurrency(value, locale, currency = 'USD') {
  if (value === null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function formatLocalizedPercent(value, locale) {
  if (value === null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function buildMembershipExportDocument(rows, sectorMarketCaps, { generatedAt, decimalSeparator }) {
  const locale = getExportLocale(decimalSeparator);

  const exportHeaders = [
    'Ticker', 'Company', 'Sector', 'Dominance', 'Dividend', 'Yield', 'Market cap', 'Member since', 'Last left',
    'MA50', 'MA200', 'EPS', 'Forward P/E', 'Current price',
  ];

  return {
    metadataRows: [
      ['Warning', exportWarningText],
      ['Data sources', exportDataSources.join(' | ')],
      ['Snapshot generated', formatExportDateTime(generatedAt)],
      [],
    ],
    headerRow: exportHeaders,
    dataRows: rows.map((row) => {
      const eps = (typeof row.metrics?.price === 'number' && typeof row.metrics?.trailingPE === 'number' && row.metrics?.trailingPE)
        ? (row.metrics.price / row.metrics.trailingPE)
        : null;

      return [
        row.ticker,
        row.security,
        row.sector,
        formatLocalizedPercent(getSectorDominance(row, sectorMarketCaps), locale),
        row.dividend?.hasDividend ? formatLocalizedCurrency(row.dividend.dividendRate, locale, row.dividend.currency || 'USD') : 'No dividend',
        formatLocalizedPercent(row.dividend?.dividendYield ?? null, locale),
        formatLocalizedCurrency(row.metrics?.marketCap ?? null, locale, row.metrics?.currency || 'USD'),
        formatExportDate(row.currentMemberSince),
        formatExportDate(row.lastLeftAt),
        '', // MA50
        '', // MA200
        eps === null ? 'N/A' : formatLocalizedNumber(eps, locale, { maximumFractionDigits: 2 }),
        formatLocalizedNumber(row.metrics?.forwardPE ?? null, locale, { maximumFractionDigits: 2 }),
        formatLocalizedCurrency(row.metrics?.price ?? null, locale, row.metrics?.currency || 'USD'),
      ];
    }),
  };
}

function buildDelimitedText(rows, delimiter) {
  return rows.map((row) => row.map((value) => {
    const normalized = String(value ?? '');
    if (normalized.includes('"') || normalized.includes('\n') || normalized.includes(delimiter)) {
      return `"${normalized.replace(/"/g, '""')}"`;
    }

    return normalized;
  }).join(delimiter)).join('\n');
}

async function isAuthenticated(request, env) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return false;

  const sessionValue = parseCookies(cookieHeader)[AUTH_COOKIE_NAME];
  if (!sessionValue) return false;

  const payload = await verifySignedToken(sessionValue, env.AUTH_SESSION_SECRET);
  if (!payload) return false;

  return payload.scope === 'auth' && payload.email === String(env.PROTECTED_EMAIL).trim().toLowerCase();
}

async function hasSupporterAccess(request, env) {
  if (!isSupporterCheckoutConfigured(env)) return false;

  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return false;

  const sessionValue = parseCookies(cookieHeader)[SUPPORTER_COOKIE_NAME];
  if (!sessionValue) return false;

  const payload = await verifySignedToken(sessionValue, env.AUTH_SESSION_SECRET);
  if (!payload || payload.scope !== 'supporter' || typeof payload.claimToken !== 'string') {
    return false;
  }

  const claim = await readSupporterClaim(env, payload.claimToken);
  return Boolean(claim && claim.status === 'paid');
}

async function hasMemberAccess(request, env) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return false;

  const sessionValue = parseCookies(cookieHeader)[MEMBER_ACCESS_COOKIE_NAME];
  if (!sessionValue) return false;

  const payload = await verifySignedToken(sessionValue, env.AUTH_SESSION_SECRET);
  return Boolean(payload && payload.scope === 'member-access');
}

async function createSignedToken(payload, secret) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = await signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

async function verifySignedToken(token, secret) {
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

  if (!payload || typeof payload.exp !== 'number') {
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

async function signHex(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readSupporterClaim(env, claimToken) {
  if (!env.SUPPORTER_CLAIMS) return null;
  const raw = await env.SUPPORTER_CLAIMS.get(getSupporterClaimKey(claimToken));
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getSupporterClaimKey(claimToken) {
  return `${SUPPORTER_CLAIM_PREFIX}${claimToken}`;
}

function timingSafeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
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
      <form method="post" action="${LOGIN_PATH}">
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

function renderSupporterClaimPage(message, shouldRefresh) {
  return new Response(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${shouldRefresh ? '<meta http-equiv="refresh" content="3" />' : ''}
    <title>Unlocking export</title>
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
      }

      main {
        width: min(100%, 460px);
        border: 1px solid rgba(16, 35, 61, 0.08);
        background: rgba(255, 255, 255, 0.92);
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
        margin: 0;
        color: #40556f;
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="eyebrow">Supporter unlock</div>
      <h1>Finalizing payment</h1>
      <p>${escapeHtml(message)}</p>
    </main>
  </body>
</html>`, {
    status: shouldRefresh ? 202 : 200,
    headers: { 'content-type': 'text/html; charset=UTF-8', 'cache-control': 'no-store' },
  });
}