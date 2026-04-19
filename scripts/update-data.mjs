import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicDataDirectory = path.join(projectRoot, 'public', 'data');
const latestSnapshotPath = path.join(projectRoot, 'public', 'data', 'latest.json');
const currentMembersPath = path.join(projectRoot, 'public', 'data', 'current-members.json');
const predictionsPath = path.join(projectRoot, 'public', 'data', 'predictions.json');
const snapshotDirectory = path.join(projectRoot, 'public', 'data', 'snapshots');
const fundamentalsCachePath = path.join(projectRoot, 'public', 'data', 'fundamentals-cache.json');

const SOURCE_URLS = {
  sp500: 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies',
  sp400: 'https://en.wikipedia.org/wiki/List_of_S%26P_400_companies',
  sp600: 'https://en.wikipedia.org/wiki/List_of_S%26P_600_companies',
  nasdaq100: 'https://en.wikipedia.org/wiki/Nasdaq-100',
};

const FINVIZ_DELAY_MS = 500;
const FUNDAMENTALS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SECTOR_PEER_MINIMUM = 8;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(value) {
  return String(value || '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTicker(value) {
  const cleaned = cleanText(value).toUpperCase();
  const [token] = cleaned.split(/\s+/);
  return token || '';
}

function toYahooTicker(ticker) {
  return String(ticker || '').replace(/\./g, '-');
}

function toFinvizTicker(ticker) {
  return String(ticker || '').replace(/\./g, '-');
}

function normalizeHeader(value) {
  return cleanText(value).toLowerCase();
}

function normalizeDate(value) {
  const cleaned = cleanText(value);
  if (!cleaned || cleaned.toLowerCase() === 'unknown') return null;
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function safeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseScaledNumber(rawValue) {
  const cleaned = cleanText(rawValue).replace(/,/g, '').replace(/\$/g, '');
  if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'n/a') return null;
  const match = cleaned.match(/^(-?\d+(?:\.\d+)?)([KMBT])?$/i);
  if (!match) return safeNumber(cleaned);
  const value = Number(match[1]);
  const suffix = String(match[2] || '').toUpperCase();
  const multiplier = suffix === 'T'
    ? 1_000_000_000_000
    : suffix === 'B'
      ? 1_000_000_000
      : suffix === 'M'
        ? 1_000_000
        : suffix === 'K'
          ? 1_000
          : 1;
  return value * multiplier;
}

function parsePercent(rawValue) {
  const cleaned = cleanText(rawValue).replace(/,/g, '');
  if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'n/a') return null;
  const match = cleaned.match(/(-?\d+(?:\.\d+)?)%/);
  if (!match) return safeNumber(cleaned);
  return Number(match[1]) / 100;
}

function parseDividendValue(rawValue) {
  const cleaned = cleanText(rawValue);
  if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'n/a') {
    return { dividendRate: null, dividendYield: null };
  }

  const amountMatch = cleaned.match(/(-?\d+(?:\.\d+)?)/);
  const yieldMatch = cleaned.match(/\(([-\d.]+)%\)/);
  return {
    dividendRate: amountMatch ? Number(amountMatch[1]) : null,
    dividendYield: yieldMatch ? Number(yieldMatch[1]) / 100 : null,
  };
}

async function fetchHtml(url, options = {}) {
  const { retries = 0, initialBackoffMs = 1000 } = options;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      },
    });

    if (response.ok) {
      return await response.text();
    }

    if (response.status === 429 && attempt < retries) {
      await sleep(initialBackoffMs * (attempt + 1));
      continue;
    }

    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  throw new Error(`Failed to fetch ${url}`);
}

function findHeaderIndex(headers, candidates) {
  for (const candidate of candidates) {
    const index = headers.indexOf(candidate);
    if (index >= 0) return index;
  }
  return -1;
}

function parseConstituentTable($, table, sourceIndex) {
  const headers = $(table).find('tr').first().find('th').map((_, cell) => normalizeHeader($(cell).text())).get();
  const tickerIndex = findHeaderIndex(headers, ['symbol', 'ticker']);
  const securityIndex = findHeaderIndex(headers, ['security', 'company']);
  const sectorIndex = findHeaderIndex(headers, ['gics sector', 'sector', 'icb industry']);
  const subIndustryIndex = findHeaderIndex(headers, ['gics sub-industry', 'sub-industry', 'industry', 'icb subsector']);
  const headquartersIndex = findHeaderIndex(headers, ['headquarters location', 'headquarters']);
  const dateAddedIndex = findHeaderIndex(headers, ['date added', 'date first added']);
  const cikIndex = findHeaderIndex(headers, ['cik']);
  const foundedIndex = findHeaderIndex(headers, ['founded']);

  if (tickerIndex < 0 || securityIndex < 0 || sectorIndex < 0) {
    return [];
  }

  return $(table).find('tbody tr').map((_, row) => {
    const cells = $(row).find('td');
    if (!cells.length) return null;
    return {
      ticker: normalizeTicker($(cells[tickerIndex]).text()),
      security: cleanText($(cells[securityIndex]).text()),
      sector: cleanText($(cells[sectorIndex]).text()),
      subIndustry: subIndustryIndex >= 0 ? cleanText($(cells[subIndustryIndex]).text()) : '',
      headquarters: headquartersIndex >= 0 ? cleanText($(cells[headquartersIndex]).text()) : '',
      dateAdded: dateAddedIndex >= 0 ? normalizeDate($(cells[dateAddedIndex]).text()) : null,
      cik: cikIndex >= 0 ? cleanText($(cells[cikIndex]).text()) : '',
      founded: foundedIndex >= 0 ? cleanText($(cells[foundedIndex]).text()) : '',
      sourceIndex,
    };
  }).get().filter((company) => company && company.ticker && company.security);
}

function parseConstituents(html, sourceIndex) {
  const $ = cheerio.load(html);
  const directTable = $('table#constituents').first();
  if (directTable.length) {
    const parsed = parseConstituentTable($, directTable, sourceIndex);
    if (parsed.length) return parsed;
  }

  const tables = $('table.wikitable, table.wikitable.sortable').toArray();
  for (const table of tables) {
    const parsed = parseConstituentTable($, table, sourceIndex);
    if (parsed.length) return parsed;
  }

  throw new Error(`Constituent table missing for ${sourceIndex}`);
}

function parseChanges(html) {
  const $ = cheerio.load(html);
  const table = $('table#changes');
  if (!table.length) return [];

  return table.find('tbody tr').map((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 5) return null;
    return {
      date: normalizeDate($(cells[0]).text()),
      addedTicker: normalizeTicker($(cells[1]).text()),
      addedSecurity: cleanText($(cells[2]).text()),
      removedTicker: normalizeTicker($(cells[3]).text()),
      removedSecurity: cleanText($(cells[4]).text()),
    };
  }).get().filter((entry) => entry && entry.date);
}

function getNextSnapshotAt(generatedAt) {
  const next = new Date(generatedAt);
  next.setTime(next.getTime() + 60 * 60 * 1000);
  return next.toISOString();
}

function getRecentChanges(changes, generatedAt) {
  const cutoff = new Date(generatedAt);
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  cutoff.setUTCHours(0, 0, 0, 0);

  const recent = changes
    .filter((change) => {
      const timestamp = Date.parse(`${change.date}T00:00:00Z`);
      return Number.isFinite(timestamp) && timestamp >= cutoff.getTime();
    })
    .sort((left, right) => String(right.date).localeCompare(String(left.date)));

  return {
    joinedLast7Days: recent
      .filter((change) => change.addedTicker)
      .map((change) => ({
        date: change.date,
        ticker: change.addedTicker,
        security: change.addedSecurity,
      })),
    leftLast7Days: recent
      .filter((change) => change.removedTicker)
      .map((change) => ({
        date: change.date,
        ticker: change.removedTicker,
        security: change.removedSecurity,
      })),
  };
}

function buildMembershipMap(currentConstituents, changes) {
  const currentMap = new Map(currentConstituents.map((company) => [company.ticker, company]));
  const history = new Map();

  for (const change of changes) {
    if (change.addedTicker) {
      const record = history.get(change.addedTicker) || { ticker: change.addedTicker, events: [], periods: [] };
      record.events.push({ type: 'added', date: change.date });
      history.set(change.addedTicker, record);
    }
    if (change.removedTicker) {
      const record = history.get(change.removedTicker) || { ticker: change.removedTicker, events: [], periods: [] };
      record.events.push({ type: 'removed', date: change.date });
      history.set(change.removedTicker, record);
    }
  }

  for (const [ticker, record] of history.entries()) {
    record.events.sort((left, right) => String(left.date).localeCompare(String(right.date)));
    let currentStart = null;
    for (const event of record.events) {
      if (event.type === 'added') {
        currentStart = event.date;
      } else {
        record.periods.push({ enteredAt: currentStart, leftAt: event.date });
        currentStart = null;
      }
    }

    if (currentMap.has(ticker)) {
      const current = currentMap.get(ticker);
      record.periods.push({ enteredAt: currentStart || current.dateAdded || null, leftAt: null });
      record.currentMemberSince = currentStart || current.dateAdded || null;
      record.lastLeftAt = [...record.periods].reverse().find((period) => period.leftAt)?.leftAt || null;
    } else {
      record.currentMemberSince = null;
      record.lastLeftAt = [...record.periods].reverse().find((period) => period.leftAt)?.leftAt || null;
    }
  }

  for (const current of currentConstituents) {
    if (history.has(current.ticker)) continue;
    history.set(current.ticker, {
      ticker: current.ticker,
      events: [],
      periods: [{ enteredAt: current.dateAdded || null, leftAt: null }],
      currentMemberSince: current.dateAdded || null,
      lastLeftAt: null,
    });
  }

  return history;
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let currentIndex = 0;

  async function runner() {
    while (currentIndex < items.length) {
      const nextIndex = currentIndex;
      currentIndex += 1;
      results[nextIndex] = await worker(items[nextIndex], nextIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runner()));
  return results;
}

async function loadFundamentalsCache() {
  try {
    const raw = await readFile(fundamentalsCachePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function isFreshCacheEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const fetchedAt = new Date(String(entry.fetchedAt || '')).getTime();
  if (!Number.isFinite(fetchedAt)) return false;
  return fetchedAt >= Date.now() - FUNDAMENTALS_CACHE_TTL_MS;
}

async function fetchQuoteMetrics(ticker) {
  const finvizTicker = toFinvizTicker(ticker);
  try {
    await sleep(FINVIZ_DELAY_MS);
    const html = await fetchHtml(`https://finviz.com/quote.ashx?t=${encodeURIComponent(finvizTicker)}&p=d`, {
      retries: 3,
      initialBackoffMs: 1500,
    });
    const $ = cheerio.load(html);
    const metrics = new Map();

    $('table.snapshot-table2 tr').each((_, row) => {
      const cells = $(row).find('td');
      for (let index = 0; index < cells.length; index += 2) {
        const key = cleanText($(cells[index]).text());
        const value = cleanText($(cells[index + 1]).text());
        if (key) metrics.set(key, value);
      }
    });

    const dividend = parseDividendValue(metrics.get('Dividend TTM') || metrics.get('Dividend Est.') || '');

    return {
      marketCap: parseScaledNumber(metrics.get('Market Cap')),
      price: safeNumber(metrics.get('Price')),
      currency: 'USD',
      trailingPE: safeNumber(metrics.get('P/E')),
      forwardPE: safeNumber(metrics.get('Forward P/E')),
      priceToBook: safeNumber(metrics.get('P/B')),
      returnOnEquity: parsePercent(metrics.get('ROE')),
      profitMargins: parsePercent(metrics.get('Profit Margin')),
      operatingMargins: parsePercent(metrics.get('Oper. Margin')),
      debtToEquity: safeNumber(metrics.get('Debt/Eq')),
      currentRatio: safeNumber(metrics.get('Current Ratio')),
      revenueGrowth: parsePercent(metrics.get('Sales Q/Q')),
      earningsGrowth: parsePercent(metrics.get('EPS Q/Q')),
      averageDailyVolume: parseScaledNumber(metrics.get('Avg Volume')),
      dividendRate: dividend.dividendRate,
      dividendYield: dividend.dividendYield,
    };
  } catch (error) {
    console.warn(`Quote lookup failed for ${ticker}:`, error instanceof Error ? error.message : String(error));
    return {
      marketCap: null,
      price: null,
      currency: 'USD',
      trailingPE: null,
      forwardPE: null,
      priceToBook: null,
      returnOnEquity: null,
      profitMargins: null,
      operatingMargins: null,
      debtToEquity: null,
      currentRatio: null,
      revenueGrowth: null,
      earningsGrowth: null,
      averageDailyVolume: null,
      dividendRate: null,
      dividendYield: null,
    };
  }
}

function percentileScore(collection, selector, value, higherBetter = true) {
  const values = collection.map(selector).filter((item) => Number.isFinite(item));
  if (!values.length || value === null || !Number.isFinite(value)) return 50;
  const sorted = [...values].sort((left, right) => left - right);
  const lastIndex = sorted.length - 1;
  if (lastIndex <= 0) return 50;
  let index = sorted.findIndex((entry) => value <= entry);
  if (index === -1) index = lastIndex;
  const rank = index / lastIndex;
  const score = higherBetter ? rank * 100 : (1 - rank) * 100;
  return Math.max(0, Math.min(100, score));
}

function getPeerCollection(collection, company) {
  const peers = collection.filter((item) => item.sector === company.sector);
  return peers.length >= SECTOR_PEER_MINIMUM ? peers : collection;
}

function scoreFallOut(currentCompanies, company) {
  const peers = getPeerCollection(currentCompanies, company);
  let score = 0;
  score += percentileScore(currentCompanies, (item) => item.metrics.marketCap, company.metrics.marketCap, false) * 0.35;
  score += percentileScore(peers, (item) => item.metrics.profitMargins, company.metrics.profitMargins, false) * 0.15;
  score += percentileScore(peers, (item) => item.metrics.returnOnEquity, company.metrics.returnOnEquity, false) * 0.15;
  score += percentileScore(currentCompanies, (item) => item.metrics.revenueGrowth, company.metrics.revenueGrowth, false) * 0.1;
  score += percentileScore(currentCompanies, (item) => item.metrics.earningsGrowth, company.metrics.earningsGrowth, false) * 0.1;
  score += percentileScore(peers, (item) => item.metrics.currentRatio, company.metrics.currentRatio, false) * 0.05;
  score += percentileScore(peers, (item) => item.metrics.debtToEquity, company.metrics.debtToEquity, true) * 0.1;
  if ((company.metrics.trailingPE ?? 0) <= 0) score += 8;
  return Math.max(0, Math.min(100, score));
}

function scoreEntry(candidates, company) {
  const peers = getPeerCollection(candidates, company);
  let score = 0;
  score += percentileScore(candidates, (item) => item.metrics.marketCap, company.metrics.marketCap, true) * 0.3;
  score += percentileScore(peers, (item) => item.metrics.profitMargins, company.metrics.profitMargins, true) * 0.15;
  score += percentileScore(peers, (item) => item.metrics.returnOnEquity, company.metrics.returnOnEquity, true) * 0.15;
  score += percentileScore(candidates, (item) => item.metrics.revenueGrowth, company.metrics.revenueGrowth, true) * 0.1;
  score += percentileScore(candidates, (item) => item.metrics.earningsGrowth, company.metrics.earningsGrowth, true) * 0.1;
  score += percentileScore(peers, (item) => item.metrics.currentRatio, company.metrics.currentRatio, true) * 0.1;
  score += percentileScore(peers, (item) => item.metrics.debtToEquity, company.metrics.debtToEquity, false) * 0.1;
  if (company.sourceIndex === 'Nasdaq-100') score += 3;
  if (company.sourceIndex === 'S&P 400') score += 2;
  if ((company.metrics.trailingPE ?? 0) <= 0) score *= 0.7;
  return Math.max(0, Math.min(100, score));
}

function scoreUndervalued(currentCompanies, company) {
  const peers = getPeerCollection(currentCompanies, company);
  let score = 0;
  score += percentileScore(peers, (item) => item.metrics.forwardPE ?? item.metrics.trailingPE, company.metrics.forwardPE ?? company.metrics.trailingPE, false) * 0.3;
  score += percentileScore(peers, (item) => item.metrics.trailingPE ?? item.metrics.forwardPE, company.metrics.trailingPE ?? company.metrics.forwardPE, false) * 0.1;
  score += percentileScore(peers, (item) => item.metrics.priceToBook, company.metrics.priceToBook, false) * 0.2;
  score += percentileScore(peers, (item) => item.dividend.dividendYield, company.dividend.dividendYield, true) * 0.1;
  score += percentileScore(peers, (item) => item.metrics.profitMargins, company.metrics.profitMargins, true) * 0.1;
  score += percentileScore(peers, (item) => item.metrics.returnOnEquity, company.metrics.returnOnEquity, true) * 0.1;
  score += percentileScore(peers, (item) => item.metrics.debtToEquity, company.metrics.debtToEquity, false) * 0.05;
  score += percentileScore(peers, (item) => item.metrics.revenueGrowth, company.metrics.revenueGrowth, true) * 0.05;
  return Math.max(0, Math.min(100, score));
}

function scoreOvervalued(currentCompanies, company) {
  const peers = getPeerCollection(currentCompanies, company);
  let score = 0;
  score += percentileScore(peers, (item) => item.metrics.forwardPE ?? item.metrics.trailingPE, company.metrics.forwardPE ?? company.metrics.trailingPE, true) * 0.3;
  score += percentileScore(peers, (item) => item.metrics.trailingPE ?? item.metrics.forwardPE, company.metrics.trailingPE ?? company.metrics.forwardPE, true) * 0.1;
  score += percentileScore(peers, (item) => item.metrics.priceToBook, company.metrics.priceToBook, true) * 0.25;
  score += percentileScore(peers, (item) => item.dividend.dividendYield, company.dividend.dividendYield, false) * 0.1;
  score += percentileScore(peers, (item) => item.metrics.profitMargins, company.metrics.profitMargins, false) * 0.1;
  score += percentileScore(peers, (item) => item.metrics.returnOnEquity, company.metrics.returnOnEquity, false) * 0.05;
  score += percentileScore(peers, (item) => item.metrics.debtToEquity, company.metrics.debtToEquity, true) * 0.1;
  return Math.max(0, Math.min(100, score));
}

function describeFallOut(company) {
  const reasons = [];
  if ((company.metrics.marketCap ?? Infinity) < 20000000000) reasons.push('smaller market-cap profile');
  if ((company.metrics.profitMargins ?? 1) < 0.05) reasons.push('thin profitability');
  if ((company.metrics.earningsGrowth ?? 1) < 0) reasons.push('negative earnings growth');
  if ((company.metrics.debtToEquity ?? 0) > 150) reasons.push('high leverage');
  return reasons.length ? reasons.join(', ') : 'mixed fundamentals versus current constituents';
}

function describeEntry(company) {
  const reasons = [];
  if ((company.metrics.marketCap ?? 0) > 10000000000) reasons.push('large-cap size');
  if ((company.metrics.profitMargins ?? 0) > 0.08) reasons.push('solid profitability');
  if ((company.metrics.returnOnEquity ?? 0) > 0.12) reasons.push('healthy return on equity');
  if ((company.metrics.debtToEquity ?? 999) < 80) reasons.push('manageable leverage');
  if (company.sourceIndex) reasons.push(`${company.sourceIndex} candidate`);
  return reasons.length ? reasons.join(', ') : 'balanced quality and size profile';
}

function describeUndervalued(company) {
  const reasons = [];
  if ((company.metrics.forwardPE ?? company.metrics.trailingPE ?? 999) < 15) reasons.push('discounted sector-relative earnings multiple');
  if ((company.metrics.priceToBook ?? 999) < 3) reasons.push('contained book multiple');
  if ((company.dividend.dividendYield ?? 0) > 0.02) reasons.push('dividend support');
  if ((company.metrics.profitMargins ?? 0) > 0.12) reasons.push('quality support');
  return reasons.length ? reasons.join(', ') : 'valuation looks moderate against the universe';
}

function describeOvervalued(company) {
  const reasons = [];
  if ((company.metrics.forwardPE ?? company.metrics.trailingPE ?? 0) > 28) reasons.push('stretched sector-relative earnings multiple');
  if ((company.metrics.priceToBook ?? 0) > 6) reasons.push('elevated book multiple');
  if ((company.dividend.dividendYield ?? 1) < 0.005) reasons.push('limited income support');
  return reasons.length ? reasons.join(', ') : 'premium valuation versus the universe';
}

function rankCompanies(companies, scoreKey, commentaryBuilder, top = 25) {
  return [...companies]
    .filter((company) => Number.isFinite(company.scores[scoreKey]))
    .sort((left, right) => (right.scores[scoreKey] ?? 0) - (left.scores[scoreKey] ?? 0))
    .slice(0, top)
    .map((company, index) => ({
      ...company,
      rank: index + 1,
      commentary: commentaryBuilder(company),
    }));
}

async function main() {
  const generatedAt = new Date().toISOString();
  const [sp500Html, sp400Html, sp600Html, nasdaqHtml] = await Promise.all([
    fetchHtml(SOURCE_URLS.sp500),
    fetchHtml(SOURCE_URLS.sp400),
    fetchHtml(SOURCE_URLS.sp600),
    fetchHtml(SOURCE_URLS.nasdaq100),
  ]);

  const currentMembersRaw = parseConstituents(sp500Html, 'S&P 500');
  const changes = parseChanges(sp500Html);
  const candidateUniverseRaw = [
    ...parseConstituents(sp400Html, 'S&P 400'),
    ...parseConstituents(sp600Html, 'S&P 600'),
    ...parseConstituents(nasdaqHtml, 'Nasdaq-100'),
  ].filter((company) => !currentMembersRaw.some((member) => member.ticker === company.ticker));
  const dedupedCandidates = new Map();
  for (const candidate of candidateUniverseRaw) {
    if (!candidate?.ticker || dedupedCandidates.has(candidate.ticker)) continue;
    dedupedCandidates.set(candidate.ticker, candidate);
  }
  const membershipMap = buildMembershipMap(currentMembersRaw, changes);
  const fundamentalsCache = await loadFundamentalsCache();
  const recentChanges = getRecentChanges(changes, generatedAt);

  const allTickers = [...new Set([...currentMembersRaw, ...dedupedCandidates.values()].map((company) => company.ticker).filter(Boolean))];
  const metricsEntries = await runWithConcurrency(allTickers, 1, async (ticker) => {
    const cached = fundamentalsCache[ticker];
    if (isFreshCacheEntry(cached)) {
      return [ticker, cached.metrics];
    }

    const metrics = await fetchQuoteMetrics(ticker);
    fundamentalsCache[ticker] = {
      fetchedAt: new Date().toISOString(),
      metrics,
    };
    return [ticker, metrics];
  });
  const metricsMap = new Map(metricsEntries);

  const hydrateCompany = (company, currentMember) => {
    const membership = membershipMap.get(company.ticker) || {
      currentMemberSince: company.dateAdded || null,
      lastLeftAt: null,
      periods: [{ enteredAt: company.dateAdded || null, leftAt: currentMember ? null : null }],
    };
    const metrics = metricsMap.get(company.ticker) || {};
    return {
      ticker: company.ticker,
      yahooTicker: toYahooTicker(company.ticker),
      security: company.security,
      sector: company.sector,
      subIndustry: company.subIndustry,
      sourceIndex: company.sourceIndex,
      headquarters: company.headquarters,
      cik: company.cik,
      founded: company.founded,
      currentMember,
      currentMemberSince: membership.currentMemberSince || company.dateAdded || null,
      lastLeftAt: membership.lastLeftAt || null,
      membershipHistory: membership.periods || [],
      dividend: {
        hasDividend: (metrics.dividendRate ?? 0) > 0 || (metrics.dividendYield ?? 0) > 0,
        dividendRate: metrics.dividendRate ?? null,
        dividendYield: metrics.dividendYield ?? null,
        currency: metrics.currency || 'USD',
      },
      metrics: {
        marketCap: metrics.marketCap ?? null,
        price: metrics.price ?? null,
        currency: metrics.currency || 'USD',
        trailingPE: metrics.trailingPE ?? null,
        forwardPE: metrics.forwardPE ?? null,
        priceToBook: metrics.priceToBook ?? null,
        returnOnEquity: metrics.returnOnEquity ?? null,
        profitMargins: metrics.profitMargins ?? null,
        operatingMargins: metrics.operatingMargins ?? null,
        debtToEquity: metrics.debtToEquity ?? null,
        currentRatio: metrics.currentRatio ?? null,
        revenueGrowth: metrics.revenueGrowth ?? null,
        earningsGrowth: metrics.earningsGrowth ?? null,
        averageDailyVolume: metrics.averageDailyVolume ?? null,
      },
      scores: {
        fallOutRisk: null,
        entryScore: null,
        undervaluedScore: null,
        overvaluedScore: null,
      },
    };
  };

  const currentMembers = currentMembersRaw.map((company) => hydrateCompany(company, true));
  const candidateUniverse = [...dedupedCandidates.values()].map((company) => hydrateCompany(company, false));

  for (const company of currentMembers) {
    company.scores.fallOutRisk = scoreFallOut(currentMembers, company);
    company.scores.undervaluedScore = scoreUndervalued(currentMembers, company);
    company.scores.overvaluedScore = scoreOvervalued(currentMembers, company);
  }

  for (const company of candidateUniverse) {
    company.scores.entryScore = scoreEntry(candidateUniverse, company);
  }

  const predictionSnapshot = {
    generatedAt,
    possibleFallOut: rankCompanies(currentMembers, 'fallOutRisk', describeFallOut, 25),
    possibleEntrants: rankCompanies(candidateUniverse, 'entryScore', describeEntry, 25),
    undervalued: rankCompanies(currentMembers, 'undervaluedScore', describeUndervalued, 25),
    overvalued: rankCompanies(currentMembers, 'overvaluedScore', describeOvervalued, 25),
  };

  const snapshot = {
    generatedAt,
    schedule: {
      nextSnapshotAt: getNextSnapshotAt(generatedAt),
    },
    methodology: {
      disclaimer: 'This dashboard uses transparent heuristics inspired by common bank and sell-side screening practice. It is not an official S&P Dow Jones methodology and is not investment advice.',
      fallOutFactors: [
        'Lower market capitalization relative to current constituents.',
        'Weak profit margins and return on equity.',
        'Negative or slowing earnings and revenue growth.',
        'Higher leverage and weaker balance-sheet support.',
        'Reduced liquidity versus the current index cohort.',
      ],
      entryFactors: [
        'Larger market capitalization inside the candidate universe.',
        'Positive profitability and return on equity.',
        'Favorable revenue and earnings growth.',
        'Manageable leverage and current-ratio support.',
        'Candidate set is sourced from current S&P 400, S&P 600, and Nasdaq-100 constituents outside the S&P 500.',
      ],
      valuationFactors: [
        'Sector-relative forward and trailing P/E comparisons.',
        'Sector-relative price-to-book comparisons.',
        'Dividend yield as valuation support.',
        'Profitability, return on equity, and revenue growth as quality controls.',
        'Debt profile to avoid purely low-quality cheap names.',
      ],
    },
    summary: {
      currentConstituentCount: currentMembers.length,
      candidateUniverseCount: candidateUniverse.length,
      dividendPayers: currentMembers.filter((company) => company.dividend.hasDividend).length,
      nonDividendPayers: currentMembers.filter((company) => !company.dividend.hasDividend).length,
    },
    sources: [
      { label: 'Wikipedia: List of S&P 500 companies', url: SOURCE_URLS.sp500 },
      { label: 'Wikipedia: List of S&P 400 companies', url: SOURCE_URLS.sp400 },
      { label: 'Wikipedia: List of S&P 600 companies', url: SOURCE_URLS.sp600 },
      { label: 'Wikipedia: Nasdaq-100', url: SOURCE_URLS.nasdaq100 },
      { label: 'Finviz quote pages for fundamentals and dividend fields', url: 'https://finviz.com/' },
    ],
    recentChanges,
  };

  const currentMembersSnapshot = {
    generatedAt,
    currentMembers,
  };

  await mkdir(publicDataDirectory, { recursive: true });
  await writeFile(latestSnapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  await writeFile(currentMembersPath, `${JSON.stringify(currentMembersSnapshot, null, 2)}\n`, 'utf8');
  await writeFile(predictionsPath, `${JSON.stringify(predictionSnapshot, null, 2)}\n`, 'utf8');
  await writeFile(fundamentalsCachePath, `${JSON.stringify(fundamentalsCache, null, 2)}\n`, 'utf8');
  await rm(snapshotDirectory, { recursive: true, force: true });

  console.log(`Snapshot written: ${latestSnapshotPath}`);
  console.log(`Current members written: ${currentMembersPath}`);
  console.log(`Predictions written: ${predictionsPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
