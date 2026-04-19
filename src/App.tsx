import { useEffect, useMemo, useState } from 'react';
import type { CompanyRecord, MembershipChange, PredictionData, RankedCompany, SnapshotData } from './types';

type RankedPanelKey = 'fallOut' | 'entrants' | 'undervalued' | 'overvalued';
type DashboardView = 'home' | 'prediction';

type MembershipSortKey =
  | 'ticker'
  | 'security'
  | 'sector'
  | 'sectorDominance'
  | 'currentMemberSince'
  | 'lastLeftAt'
  | 'dividendRate'
  | 'dividendYield'
  | 'marketCap'
  | 'forwardPE'
  | 'price';

type MembershipSortState = {
  key: MembershipSortKey;
  direction: 'asc' | 'desc';
};

const defaultMembershipSort: MembershipSortState = { key: 'marketCap', direction: 'desc' };

const membershipColumns: Array<{ key: MembershipSortKey; label: string; className?: string }> = [
  { key: 'ticker', label: 'Ticker', className: 'sticky-col sticky-col-1 ticker-column' },
  { key: 'security', label: 'Company', className: 'sticky-col sticky-col-2 company-column' },
  { key: 'sector', label: 'Sector' },
  { key: 'sectorDominance', label: 'Dominance' },
  { key: 'currentMemberSince', label: 'Member since' },
  { key: 'lastLeftAt', label: 'Last left' },
  { key: 'dividendRate', label: 'Dividend' },
  { key: 'dividendYield', label: 'Yield' },
  { key: 'marketCap', label: 'Market cap' },
  { key: 'forwardPE', label: 'Forward P/E' },
  { key: 'price', label: 'Current price' },
];

function formatDate(value: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatNumber(value: number | null, options?: Intl.NumberFormatOptions): string {
  if (value === null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', options).format(value);
}

function formatCurrency(value: number | null, currency = 'USD'): string {
  if (value === null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return 'N/A';
  return `${(value * 100).toFixed(2)}%`;
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {hint ? <div className="metric-hint">{hint}</div> : null}
    </div>
  );
}

function RankedTable({
  title,
  description,
  rows,
  scoreKey,
  isOpen,
  onToggle,
}: {
  title: string;
  description: string;
  rows: RankedCompany[];
  scoreKey: keyof RankedCompany['scores'];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <section className={`panel accordion-panel${isOpen ? ' open' : ''}`}>
      <button type="button" className="accordion-toggle" onClick={onToggle} aria-expanded={isOpen}>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="accordion-action" aria-hidden="true">
          <span className="accordion-state">{isOpen ? 'Hide' : 'Show'}</span>
          <span className={`accordion-chevron${isOpen ? ' open' : ''}`} />
        </span>
      </button>
      {isOpen ? <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Ticker</th>
              <th>Company</th>
              <th>Sector</th>
              <th>Score</th>
              <th>Dividend</th>
              <th>Commentary</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${title}-${row.ticker}`}>
                <td>{row.rank}</td>
                <td>{row.ticker}</td>
                <td>{row.security}</td>
                <td>{row.sector}</td>
                <td>{formatNumber(row.scores[scoreKey], { maximumFractionDigits: 1 })}</td>
                <td>
                  {row.dividend.hasDividend
                    ? `${formatCurrency(row.dividend.dividendRate, row.dividend.currency || 'USD')} / ${formatPercent(row.dividend.dividendYield)}`
                    : 'No dividend'}
                </td>
                <td>{row.commentary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div> : null}
    </section>
  );
}

function ChangeList({ title, rows, emptyMessage }: { title: string; rows: MembershipChange[]; emptyMessage: string }) {
  return (
    <div className="change-card">
      <h3>{title}</h3>
      {rows.length ? (
        <ul className="change-list">
          {rows.map((row) => (
            <li key={`${title}-${row.date}-${row.ticker}`} className="change-item">
              <div>
                <strong>{row.ticker}</strong>
                <span>{row.security}</span>
              </div>
              <time dateTime={row.date}>{formatDate(row.date)}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-copy">{emptyMessage}</p>
      )}
    </div>
  );
}

function SnapshotWatch({
  nextSnapshotAt,
  joinedLast7Days,
  leftLast7Days,
}: {
  nextSnapshotAt: string;
  joinedLast7Days: MembershipChange[];
  leftLast7Days: MembershipChange[];
}) {
  return (
    <section className="panel snapshot-watch">
      <div className="panel-header">
        <div>
          <h2>Snapshot watch</h2>
          <p>Tracks the next scheduled refresh time plus the last seven days of published S&amp;P 500 membership changes.</p>
        </div>
      </div>
      <div className="watch-grid">
        <MetricCard label="Next snapshot" value={formatDate(nextSnapshotAt)} hint={formatDateTime(nextSnapshotAt)} />
        <ChangeList
          title="Joined in 7 days"
          rows={joinedLast7Days}
          emptyMessage="No new S&P 500 additions were published in the last 7 days."
        />
        <ChangeList
          title="Left in 7 days"
          rows={leftLast7Days}
          emptyMessage="No S&P 500 removals were published in the last 7 days."
        />
      </div>
    </section>
  );
}

function getSectorDominance(row: CompanyRecord, sectorMarketCaps: Map<string, number>): number | null {
  const marketCap = row.metrics.marketCap;
  if (marketCap === null || Number.isNaN(marketCap)) return null;

  const sectorTotal = sectorMarketCaps.get(row.sector);
  if (!sectorTotal || Number.isNaN(sectorTotal)) return null;

  return marketCap / sectorTotal;
}

function getMembershipSortValue(
  row: CompanyRecord,
  key: MembershipSortKey,
  sectorMarketCaps: Map<string, number>,
): number | string | null {
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
      return row.dividend.hasDividend ? row.dividend.dividendRate : null;
    case 'dividendYield':
      return row.dividend.dividendYield;
    case 'marketCap':
      return row.metrics.marketCap;
    case 'forwardPE':
      return row.metrics.forwardPE;
    case 'price':
      return row.metrics.price;
    default:
      return null;
  }
}

function compareMembershipValues(
  left: number | string | null,
  right: number | string | null,
  direction: MembershipSortState['direction'],
): number {
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

function getInitialMembershipSortDirection(key: MembershipSortKey): MembershipSortState['direction'] {
  switch (key) {
    case 'ticker':
    case 'security':
    case 'sector':
      return 'asc';
    default:
      return 'desc';
  }
}

function MembershipTable({ rows }: { rows: CompanyRecord[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<MembershipSortState>(defaultMembershipSort);

  const sectorMarketCaps = useMemo(() => {
    const totals = new Map<string, number>();

    for (const row of rows) {
      const marketCap = row.metrics.marketCap;
      if (marketCap === null || Number.isNaN(marketCap)) continue;
      totals.set(row.sector, (totals.get(row.sector) ?? 0) + marketCap);
    }

    return totals;
  }, [rows]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => [row.ticker, row.security, row.sector, row.subIndustry].join(' ').toLowerCase().includes(normalized));
  }, [query, rows]);

  const sorted = useMemo(() => {
    return [...filtered].sort((left, right) => {
      const comparison = compareMembershipValues(
        getMembershipSortValue(left, sort.key, sectorMarketCaps),
        getMembershipSortValue(right, sort.key, sectorMarketCaps),
        sort.direction,
      );

      if (comparison !== 0) return comparison;
      return left.ticker.localeCompare(right.ticker, undefined, { sensitivity: 'base' });
    });
  }, [filtered, sectorMarketCaps, sort]);

  function toggleSort(key: MembershipSortKey) {
    setSort((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }

      return { key, direction: getInitialMembershipSortDirection(key) };
    });
  }

  return (
    <section className="panel">
      <div className="panel-header panel-header-stack">
        <div>
          <h2>Current S&amp;P 500 members</h2>
          <p>Includes current member since date, last known exit date, dividend status, and dividend amount.</p>
        </div>
        <div className="membership-toolbar">
          <input
            className="search"
            placeholder="Search company, ticker, or sector"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="button"
            className="reset-button"
            onClick={() => setSort(defaultMembershipSort)}
            disabled={sort.key === defaultMembershipSort.key && sort.direction === defaultMembershipSort.direction}
          >
            Reset sort
          </button>
        </div>
      </div>
      <div className="table-wrap tall">
        <table className="membership-table">
          <thead>
            <tr>
              {membershipColumns.map((column) => {
                const isActive = sort.key === column.key;
                const ariaSort = isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';

                return (
                  <th key={column.key} className={column.className} aria-sort={ariaSort}>
                    <button
                      type="button"
                      className={`sort-button${isActive ? ' active' : ''}`}
                      onClick={() => toggleSort(column.key)}
                      aria-label={`Sort by ${column.label}${isActive ? ` (${sort.direction})` : ''}`}
                    >
                      <span>{column.label}</span>
                      <span className="sort-indicator" aria-hidden="true">
                        <span className={`sort-arrow sort-arrow-up${isActive && sort.direction === 'asc' ? ' active' : ''}`} />
                        <span className={`sort-arrow sort-arrow-down${isActive && sort.direction === 'desc' ? ' active' : ''}`} />
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.ticker}>
                <td className={membershipColumns[0].className}>{row.ticker}</td>
                <td className={membershipColumns[1].className}>{row.security}</td>
                <td>{row.sector}</td>
                <td>{formatPercent(getSectorDominance(row, sectorMarketCaps))}</td>
                <td>{formatDate(row.currentMemberSince)}</td>
                <td>{formatDate(row.lastLeftAt)}</td>
                <td>{row.dividend.hasDividend ? formatCurrency(row.dividend.dividendRate, row.dividend.currency || 'USD') : 'No dividend'}</td>
                <td>{formatPercent(row.dividend.dividendYield)}</td>
                <td>{formatCurrency(row.metrics.marketCap, row.metrics.currency || 'USD')}</td>
                <td>{formatNumber(row.metrics.forwardPE, { maximumFractionDigits: 2 })}</td>
                <td>{formatCurrency(row.metrics.price, row.metrics.currency || 'USD')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function App() {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [predictionData, setPredictionData] = useState<PredictionData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState<DashboardView>('home');
  const [openRankedPanels, setOpenRankedPanels] = useState<Record<RankedPanelKey, boolean>>({
    fallOut: false,
    entrants: false,
    undervalued: false,
    overvalued: false,
  });
  const canLogout = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname);

  useEffect(() => {
    void fetch('/data/latest.json', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load generated S&P 500 data. Run npm run update:data first.');
        return await response.json() as SnapshotData;
      })
      .then((payload) => setData(payload))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load snapshot.'));

    void fetch('/__auth/status', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not determine authentication state.');
        return await response.json() as { authenticated?: boolean };
      })
      .then((payload) => {
        const authenticated = Boolean(payload.authenticated);
        setIsAuthenticated(authenticated);
        if (!authenticated) {
          setActiveView('home');
        } else if (new URLSearchParams(window.location.search).get('view') === 'prediction') {
          setActiveView('prediction');
        }
      })
      .catch(() => setIsAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated || activeView !== 'prediction' || predictionData) return;

    void fetch('/data/predictions.json', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load prediction data.');
        return await response.json() as PredictionData;
      })
      .then((payload) => setPredictionData(payload))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load prediction data.'));
  }, [activeView, isAuthenticated, predictionData]);

  if (error) {
    return (
      <main className="app-shell">
        <section className="hero panel">
          <h1>S&amp;P 500 Monitor</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="app-shell">
        <section className="hero panel">
          <h1>S&amp;P 500 Monitor</h1>
          <p>Loading the latest snapshot…</p>
        </section>
      </main>
    );
  }

  const toggleRankedPanel = (panel: RankedPanelKey) => {
    setOpenRankedPanels((current) => ({
      ...current,
      [panel]: !current[panel],
    }));
  };

  return (
    <main className="app-shell">
      <section className="hero panel">
        <div className="hero-copy">
          <div className="hero-topline">
            <div className="eyebrow">Hourly market structure monitor</div>
            <div className="hero-actions">
              <button
                type="button"
                className={`view-button${activeView === 'home' ? ' active' : ''}`}
                onClick={() => {
                  setActiveView('home');
                  setShowLoginForm(false);
                }}
              >
                Home
              </button>
              {isAuthenticated ? (
                <button
                  type="button"
                  className={`view-button${activeView === 'prediction' ? ' active' : ''}`}
                  onClick={() => {
                    setActiveView('prediction');
                    setShowLoginForm(false);
                  }}
                >
                  Prediction
                </button>
              ) : (
                <button
                  type="button"
                  className={`view-button${showLoginForm ? ' active' : ''}`}
                  onClick={() => setShowLoginForm((current) => !current)}
                >
                  Log in
                </button>
              )}
              {canLogout && isAuthenticated ? <a className="logout-button" href="/__auth/logout">Log out</a> : null}
            </div>
          </div>
          <h1>S&amp;P 500 membership, dividend, and valuation dashboard</h1>
          <p>
            Tracks current members, highlights 25 possible removals and 25 possible entrants,
            records member entry and exit dates, and flags the 25 most overvalued and undervalued companies
            using a transparent sector-relative heuristic inspired by common bank and sell-side screening practices.
          </p>
        </div>
        <div className="hero-meta">
          <MetricCard label="Snapshot generated" value={formatDate(data.generatedAt)} hint={new Date(data.generatedAt).toLocaleTimeString()} />
          <MetricCard label="Current members" value={String(data.summary.currentConstituentCount)} />
          <MetricCard label="Dividend payers" value={String(data.summary.dividendPayers)} hint={`${data.summary.nonDividendPayers} non-payers`} />
          <MetricCard label="Candidate universe" value={String(data.summary.candidateUniverseCount)} hint="S&P 400 + S&P 600 + Nasdaq-100" />
        </div>
      </section>

      {!isAuthenticated && showLoginForm ? (
        <section className="panel login-panel">
          <div className="panel-header">
            <div>
              <h2>Sign in for predictions</h2>
              <p>Home stays public. Logging in unlocks the Prediction tab and the protected prediction data.</p>
            </div>
          </div>
          <form method="post" action="/__auth/login" className="login-form">
            <input type="hidden" name="redirect" value="/?view=prediction" />
            <label className="login-field">
              <span>Email</span>
              <input type="email" name="email" autoComplete="username" required />
            </label>
            <label className="login-field">
              <span>Password</span>
              <input type="password" name="password" autoComplete="current-password" required />
            </label>
            <button type="submit" className="submit-button">Unlock Prediction</button>
          </form>
        </section>
      ) : null}

      {activeView === 'home' ? (
        <>
          <SnapshotWatch
            nextSnapshotAt={data.schedule.nextSnapshotAt}
            joinedLast7Days={data.recentChanges.joinedLast7Days}
            leftLast7Days={data.recentChanges.leftLast7Days}
          />

          <MembershipTable rows={data.currentMembers} />

          <section className="panel methodology">
            <div className="panel-header">
              <div>
                <h2>Methodology and caveats</h2>
                <p>{data.methodology.disclaimer}</p>
              </div>
            </div>
            <div className="method-grid">
              <div>
                <h3>Possible fall outs</h3>
                <ul>{data.methodology.fallOutFactors.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div>
                <h3>Possible entrants</h3>
                <ul>{data.methodology.entryFactors.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div>
                <h3>Valuation screens</h3>
                <ul>{data.methodology.valuationFactors.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div>
                <h3>Data sources</h3>
                <ul>
                  {data.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="grid two-up prediction-grid">
          <RankedTable
            title="25 possible fall outs"
            description="Heuristic ranking based on low market cap, weak profitability, earnings pressure, balance-sheet strain, and reduced liquidity."
            rows={predictionData?.possibleFallOut ?? []}
            scoreKey="fallOutRisk"
            isOpen={openRankedPanels.fallOut}
            onToggle={() => toggleRankedPanel('fallOut')}
          />
          <RankedTable
            title="25 possible entrants"
            description="Heuristic ranking based on size, profitability, growth, and balance-sheet strength across S&P 400, S&P 600, and Nasdaq-100 candidates."
            rows={predictionData?.possibleEntrants ?? []}
            scoreKey="entryScore"
            isOpen={openRankedPanels.entrants}
            onToggle={() => toggleRankedPanel('entrants')}
          />
          <RankedTable
            title="25 most undervalued"
            description="Sector-relative heuristic using lower forward and trailing multiples, dividend support, and quality factors."
            rows={predictionData?.undervalued ?? []}
            scoreKey="undervaluedScore"
            isOpen={openRankedPanels.undervalued}
            onToggle={() => toggleRankedPanel('undervalued')}
          />
          <RankedTable
            title="25 most overvalued"
            description="Sector-relative heuristic using premium multiples plus weaker quality support to surface stretched names."
            rows={predictionData?.overvalued ?? []}
            scoreKey="overvaluedScore"
            isOpen={openRankedPanels.overvalued}
            onToggle={() => toggleRankedPanel('overvalued')}
          />
        </section>
      )}
    </main>
  );
}
