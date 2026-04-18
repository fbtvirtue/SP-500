import { useEffect, useMemo, useState } from 'react';
import type { CompanyRecord, RankedCompany, SnapshotData } from './types';

function formatDate(value: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date);
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
}: {
  title: string;
  description: string;
  rows: RankedCompany[];
  scoreKey: keyof RankedCompany['scores'];
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="table-wrap">
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
      </div>
    </section>
  );
}

function MembershipTable({ rows }: { rows: CompanyRecord[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) => [row.ticker, row.security, row.sector, row.subIndustry].join(' ').toLowerCase().includes(normalized));
  }, [query, rows]);

  return (
    <section className="panel">
      <div className="panel-header panel-header-stack">
        <div>
          <h2>Current S&amp;P 500 members</h2>
          <p>Includes current member since date, last known exit date, dividend status, and dividend amount.</p>
        </div>
        <input
          className="search"
          placeholder="Search company, ticker, or sector"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="table-wrap tall">
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Company</th>
              <th>Sector</th>
              <th>Member since</th>
              <th>Last left</th>
              <th>Dividend</th>
              <th>Yield</th>
              <th>Market cap</th>
              <th>Forward P/E</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.ticker}>
                <td>{row.ticker}</td>
                <td>{row.security}</td>
                <td>{row.sector}</td>
                <td>{formatDate(row.currentMemberSince)}</td>
                <td>{formatDate(row.lastLeftAt)}</td>
                <td>{row.dividend.hasDividend ? formatCurrency(row.dividend.dividendRate, row.dividend.currency || 'USD') : 'No dividend'}</td>
                <td>{formatPercent(row.dividend.dividendYield)}</td>
                <td>{formatCurrency(row.metrics.marketCap, row.metrics.currency || 'USD')}</td>
                <td>{formatNumber(row.metrics.forwardPE, { maximumFractionDigits: 2 })}</td>
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
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch('/data/latest.json', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load generated S&P 500 data. Run npm run update:data first.');
        return await response.json() as SnapshotData;
      })
      .then((payload) => setData(payload))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load snapshot.'));
  }, []);

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

  return (
    <main className="app-shell">
      <section className="hero panel">
        <div className="hero-copy">
          <div className="eyebrow">Hourly market structure monitor</div>
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

      <section className="grid two-up">
        <RankedTable
          title="25 possible fall outs"
          description="Heuristic ranking based on low market cap, weak profitability, earnings pressure, balance-sheet strain, and reduced liquidity."
          rows={data.possibleFallOut}
          scoreKey="fallOutRisk"
        />
        <RankedTable
          title="25 possible entrants"
          description="Heuristic ranking based on size, profitability, growth, and balance-sheet strength across S&P 400, S&P 600, and Nasdaq-100 candidates."
          rows={data.possibleEntrants}
          scoreKey="entryScore"
        />
      </section>

      <section className="grid two-up">
        <RankedTable
          title="25 most undervalued"
          description="Sector-relative heuristic using lower forward and trailing multiples, dividend support, and quality factors."
          rows={data.undervalued}
          scoreKey="undervaluedScore"
        />
        <RankedTable
          title="25 most overvalued"
          description="Sector-relative heuristic using premium multiples plus weaker quality support to surface stretched names."
          rows={data.overvalued}
          scoreKey="overvaluedScore"
        />
      </section>

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
    </main>
  );
}
