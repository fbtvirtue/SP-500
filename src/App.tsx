import { useEffect, useMemo, useState } from 'react';
import type { CompanyRecord, CurrentMembersData, MembershipChange, PredictionData, RankedCompany, SnapshotData } from './types';

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

type AuthStatusResponse = {
  authenticated?: boolean;
  supporter?: boolean;
  supporterEnabled?: boolean;
  canExport?: boolean;
  donateUrl?: string;
};

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

function downloadFile(filename: string, content: BlobPart, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function solveMemberChallenge(challengeToken: string, difficulty: number): Promise<string> {
  const targetPrefix = '0'.repeat(Math.max(1, difficulty));
  let nonce = 0;

  while (true) {
    const candidate = String(nonce);
    const digest = await sha256Hex(`${challengeToken}:${candidate}`);
    if (digest.startsWith(targetPrefix)) return candidate;

    nonce += 1;
    if (nonce % 200 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}

function buildMembershipExportRows(rows: CompanyRecord[], sectorMarketCaps: Map<string, number>): string[][] {
  return rows.map((row) => [
    row.ticker,
    row.security,
    row.sector,
    formatPercent(getSectorDominance(row, sectorMarketCaps)),
    formatDate(row.currentMemberSince),
    formatDate(row.lastLeftAt),
    row.dividend.hasDividend ? formatCurrency(row.dividend.dividendRate, row.dividend.currency || 'USD') : 'No dividend',
    formatPercent(row.dividend.dividendYield),
    formatCurrency(row.metrics.marketCap, row.metrics.currency || 'USD'),
    formatNumber(row.metrics.forwardPE, { maximumFractionDigits: 2 }),
    formatCurrency(row.metrics.price, row.metrics.currency || 'USD'),
  ]);
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
    <div className="hero-watch">
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
    </div>
  );
}

function PredictionMethodology({
  fallOutFactors,
  entryFactors,
  valuationFactors,
  disclaimer,
}: SnapshotData['methodology']) {
  return (
    <section className="panel stack-section methodology">
      <div className="panel-header">
        <div>
          <h2>Prediction methodology</h2>
          <p>{disclaimer}</p>
        </div>
      </div>
      <div className="method-grid">
        <div>
          <h3>Possible fall outs</h3>
          <ul>{fallOutFactors.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <h3>Possible entrants</h3>
          <ul>{entryFactors.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <h3>Valuation screens</h3>
          <ul>{valuationFactors.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
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

function MembershipTable({
  rows,
  canExport,
  donateUrl,
  supporterEnabled,
  onToggleSupporterUnlock,
}: {
  rows: CompanyRecord[];
  canExport: boolean;
  donateUrl: string;
  supporterEnabled: boolean;
  onToggleSupporterUnlock: () => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<MembershipSortState>(defaultMembershipSort);
  const [exportMessage, setExportMessage] = useState('');

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

  async function exportRowsAsXlsx() {
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('S&P 500 Members');

      worksheet.columns = membershipColumns.map((column, index) => ({
        header: column.label,
        key: column.key,
        width: [10, 28, 22, 14, 14, 14, 14, 10, 16, 12, 14][index],
      }));

      for (const row of buildMembershipExportRows(sorted, sectorMarketCaps)) {
        worksheet.addRow(row);
      }

      worksheet.getRow(1).font = { bold: true };
      const workbookBytes = await workbook.xlsx.writeBuffer();
      downloadFile(
        `sp500-members-${new Date().toISOString().slice(0, 10)}.xlsx`,
        workbookBytes,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      setExportMessage('XLSX export downloaded.');
    } catch {
      setExportMessage('Could not create the XLSX export in this browser.');
    }
  }

  async function copyRowsForGoogleSheets() {
    try {
      const lines = [
        membershipColumns.map((column) => column.label).join('\t'),
        ...buildMembershipExportRows(sorted, sectorMarketCaps).map((row) => row.join('\t')),
      ];

      await navigator.clipboard.writeText(`${lines.join('\n')}\n`);
      setExportMessage('Copied in Google Sheets format. Paste directly into Sheets.');
    } catch {
      setExportMessage('Clipboard access is blocked in this browser.');
    }
  }

  function blockLockedTableAction(event: React.SyntheticEvent<HTMLElement>) {
    if (canExport) return;
    event.preventDefault();
    setExportMessage('Donate to unlock copying, XLSX download, and Google Sheets export.');
  }

  function blockLockedShortcuts(event: React.KeyboardEvent<HTMLElement>) {
    if (canExport) return;

    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && ['a', 'c', 'x'].includes(key)) {
      event.preventDefault();
      setExportMessage('Manual copy is disabled until export access is unlocked.');
    }
  }

  return (
    <section className="panel stack-section membership-section">
      <div className="panel-header panel-header-stack">
        <div>
          <h2>Current S&amp;P 500 members</h2>
          {!canExport ? (
            <p>Donate to unlock XLSX download, Google Sheets copy, and member-table export access.</p>
          ) : null}
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
          {canExport ? (
            <>
              <button type="button" className="export-button" onClick={() => void exportRowsAsXlsx()}>
                Download XLSX
              </button>
              <button type="button" className="export-button export-button-secondary" onClick={() => void copyRowsForGoogleSheets()}>
                Copy for Google Sheets
              </button>
            </>
          ) : (
            <>
              <button type="button" className="export-button donate-button" onClick={() => {
                if (donateUrl) {
                  window.open(donateUrl, '_blank', 'noopener,noreferrer');
                }
              }} disabled={!donateUrl}>
                Donate to unlock export
              </button>
              {supporterEnabled ? (
                <button type="button" className="export-button export-button-secondary" onClick={onToggleSupporterUnlock}>
                  Already donated? Enter code
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
      {!canExport ? (
        <div className="export-callout">
          <div>
            <strong>Donate to download.</strong>
            <p>
              Supporters can unlock XLSX and Google Sheets export with a supporter code after donating.
            </p>
          </div>
          {donateUrl ? (
            <a className="donate-link" href={donateUrl} target="_blank" rel="noreferrer">
              Open donation page
            </a>
          ) : null}
        </div>
      ) : null}
      {exportMessage ? <p className="export-message">{exportMessage}</p> : null}
      <div
        className={`table-wrap tall${canExport ? '' : ' table-wrap-locked'}`}
        onCopy={blockLockedTableAction}
        onCut={blockLockedTableAction}
        onContextMenu={blockLockedTableAction}
        onDragStart={blockLockedTableAction}
        onKeyDownCapture={blockLockedShortcuts}
        tabIndex={0}
      >
        <table className={`membership-table${canExport ? '' : ' membership-table-locked'}`}>
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
  const [currentMembers, setCurrentMembers] = useState<CompanyRecord[] | null>(null);
  const [predictionData, setPredictionData] = useState<PredictionData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasSupporterAccess, setHasSupporterAccess] = useState(false);
  const [supporterEnabled, setSupporterEnabled] = useState(false);
  const [donateUrl, setDonateUrl] = useState('');
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showSupporterForm, setShowSupporterForm] = useState(false);
  const [supporterCode, setSupporterCode] = useState('');
  const [supporterError, setSupporterError] = useState('');
  const [supporterPending, setSupporterPending] = useState(false);
  const [error, setError] = useState('');
  const [membersError, setMembersError] = useState('');
  const [membersLoading, setMembersLoading] = useState(false);
  const [activeView, setActiveView] = useState<DashboardView>('home');
  const [openRankedPanels, setOpenRankedPanels] = useState<Record<RankedPanelKey, boolean>>({
    fallOut: false,
    entrants: false,
    undervalued: false,
    overvalued: false,
  });
  const isLocalHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const canLogout = typeof window !== 'undefined' && !isLocalHost;
  const canExport = isLocalHost || isAuthenticated || hasSupporterAccess;

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
        return await response.json() as AuthStatusResponse;
      })
      .then((payload) => {
        const authenticated = Boolean(payload.authenticated);
        setIsAuthenticated(authenticated);
        setHasSupporterAccess(Boolean(payload.supporter));
        setSupporterEnabled(Boolean(payload.supporterEnabled));
        setDonateUrl(typeof payload.donateUrl === 'string' ? payload.donateUrl : '');
        if (!authenticated) {
          setActiveView('home');
        } else if (new URLSearchParams(window.location.search).get('view') === 'prediction') {
          setActiveView('prediction');
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        setHasSupporterAccess(false);
      });
  }, []);

  useEffect(() => {
    if (!data || currentMembers !== null) return;

    let cancelled = false;

    async function loadCurrentMembers() {
      setMembersLoading(true);
      setMembersError('');

      try {
        let response = await fetch('/data/current-members.json', { cache: 'no-store' });

        if (response.status === 401) {
          const challengeResponse = await fetch('/__members/challenge', { cache: 'no-store' });
          if (!challengeResponse.ok) {
            throw new Error('Could not start the browser verification needed for the member table.');
          }

          const challengePayload = await challengeResponse.json() as { challengeToken?: string; difficulty?: number };
          const challengeToken = String(challengePayload.challengeToken ?? '');
          const difficulty = Number(challengePayload.difficulty ?? 3);

          if (!challengeToken) {
            throw new Error('Member-table challenge is unavailable right now.');
          }

          const solution = await solveMemberChallenge(challengeToken, difficulty);
          const verifyResponse = await fetch('/__members/verify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ challengeToken, solution }),
          });

          if (!verifyResponse.ok) {
            throw new Error('Could not complete browser verification for the member table.');
          }

          response = await fetch('/data/current-members.json', { cache: 'no-store' });
        }

        if (!response.ok) {
          throw new Error('Could not load the current S&P 500 member table.');
        }

        const payload = await response.json() as CurrentMembersData;
        if (!cancelled) {
          setCurrentMembers(Array.isArray(payload.currentMembers) ? payload.currentMembers : []);
        }
      } catch (err) {
        if (!cancelled) {
          setMembersError(err instanceof Error ? err.message : 'Could not load the current S&P 500 member table.');
        }
      } finally {
        if (!cancelled) {
          setMembersLoading(false);
        }
      }
    }

    void loadCurrentMembers();

    return () => {
      cancelled = true;
    };
  }, [currentMembers, data]);

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

  async function unlockSupporterExport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSupporterPending(true);
    setSupporterError('');

    try {
      const response = await fetch('/__supporter/access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: supporterCode }),
      });
      const payload = await response.json().catch(() => ({} as { error?: string }));

      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not unlock export access.');
      }

      setHasSupporterAccess(true);
      setShowSupporterForm(false);
      setSupporterCode('');
    } catch (err) {
      setSupporterError(err instanceof Error ? err.message : 'Could not unlock export access.');
    } finally {
      setSupporterPending(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="panel site-header">
        <div className="site-brand">
          <div className="site-kicker">S&amp;P 500 Monitor</div>
          <div className="site-title">Market structure dashboard</div>
        </div>
        <nav className="site-nav" aria-label="Primary">
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
          <a className="nav-link-button" href="/#data-sources">
            Data sources
          </a>
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
        </nav>
      </header>

      <section className="hero panel stack-section">
        <div className="hero-copy">
          <div className="eyebrow">Hourly market structure monitor</div>
          <h1>S&amp;P 500 membership, dividend, and valuation dashboard</h1>
          <p>
            Autogenerated from published index membership changes and market data snapshots. Built for monitoring and research,
            not financial advice.
          </p>
        </div>
        <div className="hero-meta">
          <MetricCard label="Snapshot generated" value={formatDate(data.generatedAt)} hint={new Date(data.generatedAt).toLocaleTimeString()} />
          <MetricCard label="Current members" value={String(data.summary.currentConstituentCount)} />
          <MetricCard label="Dividend payers" value={String(data.summary.dividendPayers)} hint={`${data.summary.nonDividendPayers} non-payers`} />
          <SnapshotWatch
            nextSnapshotAt={data.schedule.nextSnapshotAt}
            joinedLast7Days={data.recentChanges.joinedLast7Days}
            leftLast7Days={data.recentChanges.leftLast7Days}
          />
        </div>
      </section>

      {!isAuthenticated && showLoginForm ? (
        <section className="panel stack-section login-panel">
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
          {currentMembers ? (
            <MembershipTable
              rows={currentMembers}
              canExport={canExport}
              donateUrl={donateUrl}
              supporterEnabled={supporterEnabled}
              onToggleSupporterUnlock={() => {
                setShowSupporterForm((current) => !current);
                setSupporterError('');
                setShowLoginForm(false);
              }}
            />
          ) : (
            <section className="panel stack-section membership-section">
              <div className="panel-header">
                <div>
                  <h2>Current S&amp;P 500 members</h2>
                  <p>{membersError || (membersLoading ? 'Preparing the protected member table…' : 'Loading the current member table…')}</p>
                </div>
              </div>
            </section>
          )}

          {supporterEnabled && showSupporterForm && !canExport ? (
            <section className="panel stack-section supporter-panel">
              <div className="panel-header">
                <div>
                  <h2>Unlock export</h2>
                  <p>Enter the supporter code you received after donating to unlock the Excel export without the prediction login.</p>
                </div>
              </div>
              <form className="supporter-form" onSubmit={unlockSupporterExport}>
                <label className="login-field">
                  <span>Supporter code</span>
                  <input
                    type="password"
                    value={supporterCode}
                    onChange={(event) => setSupporterCode(event.target.value)}
                    autoComplete="one-time-code"
                    required
                  />
                </label>
                <button type="submit" className="submit-button" disabled={supporterPending}>
                  {supporterPending ? 'Unlocking…' : 'Unlock export'}
                </button>
              </form>
              {supporterError ? <p className="form-error">{supporterError}</p> : null}
            </section>
          ) : null}

          <section className="panel stack-section methodology" id="data-sources">
            <div className="panel-header">
              <div>
                <h2>About this site</h2>
                <p>
                  The public home view focuses on current S&amp;P 500 membership, dividend coverage, and recently published
                  membership changes. The data is autogenerated on a recurring schedule and should be treated as a monitoring
                  aid, not investment advice.
                </p>
              </div>
            </div>
            <div className="info-grid">
              <div>
                <h3>What you can verify here</h3>
                <ul>
                  <li>Current index members, sectors, market caps, yields, and current prices.</li>
                  <li>Recently published joins and removals from the S&amp;P 500 change log.</li>
                  <li>The latest generated snapshot time and the next scheduled refresh window.</li>
                </ul>
              </div>
              <div>
                <h3>Important caveats</h3>
                <ul>
                  <li>Market data can lag source websites and may briefly reflect stale or missing fields.</li>
                  <li>Published membership changes can appear after market hours and may update independently of prices.</li>
                  <li>This site is a monitoring layer over public sources and should not replace direct source verification.</li>
                </ul>
              </div>
              <div>
                <h3>Automation note</h3>
                <p>
                  This dashboard is generated automatically from source pages and cached fundamentals, then rebuilt for the live
                  site. Always verify critical numbers against the underlying publisher before acting on them.
                </p>
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
        <>
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
          <section className="panel stack-section prediction-note">
            <div className="panel-header">
              <div>
                <h2>Prediction view notice</h2>
                <p>Prediction screens are available only after sign-in and remain heuristic, not official S&amp;P decisions.</p>
              </div>
            </div>
          </section>
          <PredictionMethodology {...data.methodology} />
        </>
      )}
    </main>
  );
}
