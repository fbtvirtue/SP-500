import { useEffect, useMemo, useRef, useState } from 'react';
import type { CompanyRecord, CurrentMembersData, MembersTableResponse, MembershipChange, PredictionData, RankedCompany, SnapshotData } from './types';

type RankedPanelKey = 'fallOut' | 'entrants' | 'undervalued' | 'overvalued';
type DashboardView = 'home' | 'prediction';
type ExportFormat = 'xlsx' | 'csv';
type DecimalSeparator = '.' | ',';

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
const defaultMembersPageSize = 50;

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
  supporterExportTtlSeconds?: number | null;
};

type MembershipExportDocument = {
  metadataRows: string[][];
  headerRow: string[];
  dataRows: string[][];
};

const exportDataSources = [
  'Wikipedia current S&P 500 constituents and change history',
  'Wikipedia S&P 400, S&P 600, and Nasdaq-100 constituent lists',
  'Finviz quote pages for market cap, valuation, and dividend fields',
];

const exportWarningText = 'This file is generated automatically from public data sources and is intended for monitoring and research only. It is not financial advice.';

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

function formatTime(value: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString();
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

function getExportLocale(decimalSeparator: DecimalSeparator): string {
  return decimalSeparator === ',' ? 'de-DE' : 'en-US';
}

function formatLocalizedNumber(value: number | null, locale: string, options?: Intl.NumberFormatOptions): string {
  if (value === null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat(locale, options).format(value);
}

function formatLocalizedCurrency(value: number | null, locale: string, currency = 'USD'): string {
  if (value === null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

function formatLocalizedPercent(value: number | null, locale: string): string {
  if (value === null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatExportDateTime(value: string | null): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

function formatTimestampForFilename(value: string | null): string {
  const fallback = new Date().toISOString();
  const date = value ? new Date(value) : new Date(fallback);
  const safeValue = Number.isNaN(date.getTime()) ? fallback : date.toISOString();
  return safeValue.replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
}

function buildExportFilename(format: ExportFormat, generatedAt: string): string {
  return `sp500-members-${formatTimestampForFilename(generatedAt)}.${format}`;
}

function buildDelimitedText(rows: string[][], delimiter: string): string {
  return rows.map((row) => row.map((value) => {
    const normalized = String(value ?? '');
    if (normalized.includes('"') || normalized.includes('\n') || normalized.includes(delimiter)) {
      return `"${normalized.replace(/"/g, '""')}"`;
    }

    return normalized;
  }).join(delimiter)).join('\n');
}

function formatSupporterAccessDuration(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null;

  if (seconds % (60 * 60 * 24) === 0) {
    const days = seconds / (60 * 60 * 24);
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  if (seconds % (60 * 60) === 0) {
    const hours = seconds / (60 * 60);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
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

function getDownloadFilename(contentDisposition: string | null, fallbackFilename: string): string {
  if (!contentDisposition) return fallbackFilename;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const basicMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return basicMatch?.[1] || fallbackFilename;
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

function buildMembershipExportDocument(
  rows: CompanyRecord[],
  sectorMarketCaps: Map<string, number>,
  {
    generatedAt,
    decimalSeparator,
  }: {
    generatedAt: string;
    decimalSeparator: DecimalSeparator;
  },
): MembershipExportDocument {
  const locale = getExportLocale(decimalSeparator);

  return {
    metadataRows: [
      ['Warning', exportWarningText],
      ['Data sources', exportDataSources.join(' | ')],
      ['Snapshot generated', formatExportDateTime(generatedAt)],
      [],
    ],
    headerRow: membershipColumns.map((column) => column.label),
    dataRows: rows.map((row) => [
      row.ticker,
      row.security,
      row.sector,
      formatLocalizedPercent(getSectorDominance(row, sectorMarketCaps), locale),
      formatDate(row.currentMemberSince),
      formatDate(row.lastLeftAt),
      row.dividend.hasDividend
        ? formatLocalizedCurrency(row.dividend.dividendRate, locale, row.dividend.currency || 'USD')
        : 'No dividend',
      formatLocalizedPercent(row.dividend.dividendYield, locale),
      formatLocalizedCurrency(row.metrics.marketCap, locale, row.metrics.currency || 'USD'),
      formatLocalizedNumber(row.metrics.forwardPE, locale, { maximumFractionDigits: 2 }),
      formatLocalizedCurrency(row.metrics.price, locale, row.metrics.currency || 'USD'),
    ]),
  };
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
        <MetricCard label="Next snapshot" value={formatDate(nextSnapshotAt)} hint={formatTime(nextSnapshotAt)} />
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
  query,
  sort,
  page,
  pageSize,
  totalCount,
  totalPages,
  tableLoading,
  sectorMarketCaps,
  canExport,
  supporterEnabled,
  supporterPending,
  supporterError,
  snapshotGeneratedAt,
  supporterAccessDuration,
  siteHeaderOffset,
  onQueryChange,
  onSortChange,
  onResetSort,
  onPageChange,
  onStartSupporterCheckout,
}: {
  rows: CompanyRecord[];
  query: string;
  sort: MembershipSortState;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  tableLoading: boolean;
  sectorMarketCaps: Map<string, number>;
  canExport: boolean;
  supporterEnabled: boolean;
  supporterPending: boolean;
  supporterError: string;
  snapshotGeneratedAt: string;
  supporterAccessDuration: string | null;
  siteHeaderOffset: number;
  onQueryChange: (value: string) => void;
  onSortChange: (key: MembershipSortKey) => void;
  onResetSort: () => void;
  onPageChange: (page: number) => void;
  onStartSupporterCheckout: () => void;
}) {
  const [exportMessage, setExportMessage] = useState('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [decimalSeparator, setDecimalSeparator] = useState<DecimalSeparator>('.');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportPending, setExportPending] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [stickyColumnOffset, setStickyColumnOffset] = useState(0);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const stickyHeaderCellRefs = useRef<Array<HTMLTableCellElement | null>>([]);
  const isLocalHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

  useEffect(() => {
    setSelectedTicker(null);
  }, [page, query, sort.direction, sort.key]);

  useEffect(() => {
    const updateStickyColumnOffset = () => {
      const tickerHeaderCell = stickyHeaderCellRefs.current[0];
      setStickyColumnOffset(Math.round(tickerHeaderCell?.getBoundingClientRect().width ?? 0));
    };

    updateStickyColumnOffset();

    const observer = new ResizeObserver(() => updateStickyColumnOffset());
    stickyHeaderCellRefs.current.slice(0, 2).forEach((cell) => {
      if (cell) observer.observe(cell);
    });
    window.addEventListener('resize', updateStickyColumnOffset);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateStickyColumnOffset);
    };
  }, [rows.length]);

  useEffect(() => {
    if (!isExportMenuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (exportMenuRef.current?.contains(target)) return;
      setIsExportMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExportMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isExportMenuOpen]);

  const visibleRowStart = totalCount ? (page - 1) * pageSize + 1 : 0;
  const visibleRowEnd = totalCount ? visibleRowStart + rows.length - 1 : 0;

  async function loadFullRowsForExport(): Promise<{ rows: CompanyRecord[]; sectorTotals: Map<string, number> }> {
    const response = await fetch('/data/current-members.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Could not load the full member dataset for export.');
    }

    const payload = await response.json() as CurrentMembersData;
    const exportRows = Array.isArray(payload.currentMembers) ? payload.currentMembers : [];
    const exportSectorTotals = new Map<string, number>();

    for (const row of exportRows) {
      const marketCap = row.metrics.marketCap;
      if (marketCap === null || Number.isNaN(marketCap)) continue;
      exportSectorTotals.set(row.sector, (exportSectorTotals.get(row.sector) ?? 0) + marketCap);
    }

    const normalizedQuery = query.trim().toLowerCase();
    const filteredRows = !normalizedQuery
      ? exportRows
      : exportRows.filter((row) => [row.ticker, row.security, row.sector, row.subIndustry].join(' ').toLowerCase().includes(normalizedQuery));

    const sortedRows = [...filteredRows].sort((left, right) => {
      const comparison = compareMembershipValues(
        getMembershipSortValue(left, sort.key, exportSectorTotals),
        getMembershipSortValue(right, sort.key, exportSectorTotals),
        sort.direction,
      );

      if (comparison !== 0) return comparison;
      return left.ticker.localeCompare(right.ticker, undefined, { sensitivity: 'base' });
    });

    return { rows: sortedRows, sectorTotals: exportSectorTotals };
  }

  async function exportRowsAsXlsx() {
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('S&P 500 Members');
      const { rows: exportRows, sectorTotals } = await loadFullRowsForExport();
      const exportDocument = buildMembershipExportDocument(exportRows, sectorTotals, {
        generatedAt: snapshotGeneratedAt,
        decimalSeparator,
      });

      worksheet.columns = membershipColumns.map((column, index) => ({
        key: column.key,
        width: [10, 28, 22, 14, 14, 14, 14, 10, 16, 12, 14][index],
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

      for (const row of exportDocument.dataRows) {
        worksheet.addRow(row);
      }

      const workbookBytes = await workbook.xlsx.writeBuffer();
      downloadFile(
        buildExportFilename('xlsx', snapshotGeneratedAt),
        workbookBytes,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      setExportMessage(`XLSX export downloaded with ${decimalSeparator === ',' ? 'comma' : 'dot'} decimals.`);
    } catch {
      setExportMessage('Could not create the XLSX export in this browser.');
    }
  }

  function exportRowsAsCsv() {
    void loadFullRowsForExport()
      .then(({ rows: exportRows, sectorTotals }) => {
        const exportDocument = buildMembershipExportDocument(exportRows, sectorTotals, {
          generatedAt: snapshotGeneratedAt,
          decimalSeparator,
        });
        const delimiter = decimalSeparator === ',' ? ';' : ',';
        const fileText = buildDelimitedText(
          [...exportDocument.metadataRows, exportDocument.headerRow, ...exportDocument.dataRows],
          delimiter,
        );

        downloadFile(buildExportFilename('csv', snapshotGeneratedAt), `\uFEFF${fileText}\n`, 'text/csv;charset=utf-8');
        setExportMessage(`CSV export downloaded using ${delimiter === ';' ? 'semicolon' : 'comma'} columns and ${decimalSeparator === ',' ? 'comma' : 'dot'} decimals.`);
      })
      .catch(() => {
        setExportMessage('Could not create the CSV export in this browser.');
      });
  }

  async function downloadServerGeneratedExport() {
    const exportUrl = new URL('/__members/export', window.location.origin);
    exportUrl.searchParams.set('format', exportFormat);
    exportUrl.searchParams.set('decimal', decimalSeparator);
    exportUrl.searchParams.set('sort', sort.key);
    exportUrl.searchParams.set('direction', sort.direction);
    if (query.trim()) {
      exportUrl.searchParams.set('query', query.trim());
    }

    setExportPending(true);

    try {
      const response = await fetch(exportUrl.toString(), { cache: 'no-store' });
      if (!response.ok) {
        const details = await response.text();
        throw new Error(details || 'Could not generate the export file.');
      }

      const mimeType = response.headers.get('content-type') || (exportFormat === 'csv'
        ? 'text/csv;charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const fileBlob = await response.blob();
      const filename = getDownloadFilename(response.headers.get('content-disposition'), buildExportFilename(exportFormat, snapshotGeneratedAt));
      downloadFile(filename, fileBlob, mimeType);
      setExportMessage(`${exportFormat.toUpperCase()} export downloaded.`);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : 'Could not generate the export file.');
    } finally {
      setExportPending(false);
    }
  }

  function downloadSelectedExport() {
    if (!isLocalHost) {
      void downloadServerGeneratedExport();
      return;
    }

    if (exportFormat === 'csv') {
      exportRowsAsCsv();
      return;
    }

    void exportRowsAsXlsx();
  }

  function blockLockedTableAction(event: React.SyntheticEvent<HTMLElement>) {
    event.preventDefault();
    setExportMessage(canExport
      ? 'Manual table copy is disabled. Use CSV or XLSX export instead.'
      : 'Donate to unlock CSV and XLSX export.');
  }

  function blockLockedShortcuts(event: React.KeyboardEvent<HTMLElement>) {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && ['a', 'c', 'x'].includes(key)) {
      event.preventDefault();
      setExportMessage(canExport
        ? 'Manual table copy is disabled. Use CSV or XLSX export instead.'
        : 'Manual copy is disabled until export access is unlocked.');
    }
  }

  function toggleSelectedTicker(ticker: string) {
    setSelectedTicker((current) => current === ticker ? null : ticker);
  }

  return (
    <section
      id="members-table"
      className="panel stack-section membership-section"
      style={{
        '--site-header-offset': `${siteHeaderOffset}px`,
        '--membership-sticky-col-2-left': `${stickyColumnOffset}px`,
      } as React.CSSProperties}
    >
      <div className="panel-header panel-header-stack membership-sticky-header">
        <div>
          <h2>Current S&amp;P 500 members</h2>
        </div>
        <div className="membership-toolbar">
          <label className="search-wrap" aria-label="Search companies">
            <span className="search-icon" aria-hidden="true">/</span>
            <input
              className="search search-compact"
              placeholder="Search company, ticker, or sector"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="reset-button reset-button-subtle"
            onClick={onResetSort}
            disabled={sort.key === defaultMembershipSort.key && sort.direction === defaultMembershipSort.direction}
          >
            Reset sort
          </button>
          {canExport ? (
            <>
              <div ref={exportMenuRef} className="export-menu">
                <button
                  type="button"
                  className="export-button export-button-secondary export-menu-trigger"
                  aria-expanded={isExportMenuOpen}
                  onClick={() => setIsExportMenuOpen((current) => !current)}
                >
                  Export options
                </button>
                {isExportMenuOpen ? <div className="export-menu-panel">
                  <div className="export-menu-header">
                    <strong>Export options</strong>
                    <button
                      type="button"
                      className="export-menu-close"
                      aria-label="Close export options"
                      onClick={() => setIsExportMenuOpen(false)}
                    >
                      x
                    </button>
                  </div>
                  <div className="export-menu-grid">
                    <label className="toolbar-select-field">
                      <span>Format</span>
                      <select
                        className="toolbar-select"
                        value={exportFormat}
                        onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
                      >
                        <option value="xlsx">XLSX</option>
                        <option value="csv">CSV</option>
                      </select>
                    </label>
                    <label className="toolbar-select-field">
                      <span>Decimal</span>
                      <select
                        className="toolbar-select"
                        value={decimalSeparator}
                        onChange={(event) => setDecimalSeparator(event.target.value as DecimalSeparator)}
                      >
                        <option value=".">Dot (.)</option>
                        <option value=",">Comma (,)</option>
                      </select>
                    </label>
                  </div>
                  <div className="export-menu-actions">
                    <button type="button" className="export-button" disabled={exportPending} onClick={() => { downloadSelectedExport(); setIsExportMenuOpen(false); }}>
                      {exportPending ? 'Preparing…' : `Download ${exportFormat.toUpperCase()}`}
                    </button>
                  </div>
                </div> : null}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                className="export-button donate-button"
                onClick={onStartSupporterCheckout}
                disabled={!supporterEnabled || supporterPending}
              >
                {supporterPending ? 'Opening checkout…' : 'Unlock export'}
              </button>
            </>
          )}
        </div>
        {!canExport && supporterAccessDuration ? (
          <p className="export-note export-note-sticky"><strong>Unlock export access for {supporterAccessDuration} in this browser.</strong></p>
        ) : null}
      </div>
      {!canExport && supporterError ? <p className="form-error">{supporterError}</p> : null}
      {exportMessage ? <p className="export-message">{exportMessage}</p> : null}
      <div
        className={`table-wrap tall${canExport ? '' : ' table-wrap-locked'}`}
        onCopy={blockLockedTableAction}
        onCut={blockLockedTableAction}
        onContextMenu={blockLockedTableAction}
        onDragStart={blockLockedTableAction}
        onKeyDownCapture={blockLockedShortcuts}
        onSelectStart={blockLockedTableAction}
        tabIndex={0}
      >
        <table className={`membership-table${canExport ? '' : ' membership-table-locked'}`}>
          <thead>
            <tr>
              {membershipColumns.map((column) => {
                const isActive = sort.key === column.key;
                const ariaSort = isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
                const columnIndex = membershipColumns.indexOf(column);

                return (
                  <th
                    key={column.key}
                    ref={(element) => {
                      stickyHeaderCellRefs.current[columnIndex] = element;
                    }}
                    className={column.className}
                    aria-sort={ariaSort}
                  >
                    <button
                      type="button"
                      className={`sort-button${isActive ? ' active' : ''}`}
                      onClick={() => onSortChange(column.key)}
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
            {!rows.length && !tableLoading ? <tr>
              <td colSpan={membershipColumns.length}>No companies matched the current search.</td>
            </tr> : null}
            {rows.map((row) => (
              <tr
                key={row.ticker}
                className={selectedTicker === row.ticker ? 'selected' : ''}
                onClick={() => toggleSelectedTicker(row.ticker)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleSelectedTicker(row.ticker);
                  }
                }}
                tabIndex={0}
              >
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
      <div className="members-table-footer">
        <p className="members-table-meta">
          {tableLoading ? 'Refreshing table…' : totalCount ? `Showing ${visibleRowStart}-${visibleRowEnd} of ${formatNumber(totalCount)} companies.` : 'No companies to show.'}
        </p>
        <div className="members-pagination">
          <button type="button" className="reset-button reset-button-subtle" onClick={() => onPageChange(page - 1)} disabled={page <= 1 || tableLoading}>
            Previous
          </button>
          <span className="members-pagination-label">Page {page} of {totalPages}</span>
          <button type="button" className="reset-button reset-button-subtle" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages || tableLoading}>
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [currentMembers, setCurrentMembers] = useState<CompanyRecord[] | null>(null);
  const [membersSectorMarketCaps, setMembersSectorMarketCaps] = useState<Map<string, number>>(new Map());
  const [membersQuery, setMembersQuery] = useState('');
  const [debouncedMembersQuery, setDebouncedMembersQuery] = useState('');
  const [membersSort, setMembersSort] = useState<MembershipSortState>(defaultMembershipSort);
  const [membersPage, setMembersPage] = useState(1);
  const [membersTotalCount, setMembersTotalCount] = useState(0);
  const [membersTotalPages, setMembersTotalPages] = useState(1);
  const [predictionData, setPredictionData] = useState<PredictionData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasSupporterAccess, setHasSupporterAccess] = useState(false);
  const [supporterEnabled, setSupporterEnabled] = useState(false);
  const [supporterExportTtlSeconds, setSupporterExportTtlSeconds] = useState<number | null>(null);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [supporterError, setSupporterError] = useState('');
  const [supporterPending, setSupporterPending] = useState(false);
  const [error, setError] = useState('');
  const [membersError, setMembersError] = useState('');
  const [membersLoading, setMembersLoading] = useState(false);
  const [activeView, setActiveView] = useState<DashboardView>('home');
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const [openRankedPanels, setOpenRankedPanels] = useState<Record<RankedPanelKey, boolean>>({
    fallOut: false,
    entrants: false,
    undervalued: false,
    overvalued: false,
  });
  const isLocalHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const canLogout = typeof window !== 'undefined' && !isLocalHost;
  const canExport = isLocalHost || isAuthenticated || hasSupporterAccess;
  const membersPageSize = defaultMembersPageSize;
  const [siteHeaderOffset, setSiteHeaderOffset] = useState(0);
  const siteHeaderRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = siteHeaderRef.current;
    if (!element) return;

    const updateOffset = () => {
      setSiteHeaderOffset(Math.ceil(element.getBoundingClientRect().height));
    };

    updateOffset();

    const observer = new ResizeObserver(() => updateOffset());
    observer.observe(element);
    window.addEventListener('resize', updateOffset);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateOffset);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedMembersQuery(membersQuery.trim());
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [membersQuery]);

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
        setSupporterExportTtlSeconds(
          typeof payload.supporterExportTtlSeconds === 'number' && Number.isFinite(payload.supporterExportTtlSeconds)
            ? payload.supporterExportTtlSeconds
            : null,
        );
        if (!authenticated) {
          setActiveView('home');
        } else if (new URLSearchParams(window.location.search).get('view') === 'prediction') {
          setActiveView('prediction');
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        setHasSupporterAccess(false);
        setSupporterEnabled(false);
        setSupporterExportTtlSeconds(null);
      });
  }, []);

  useEffect(() => {
    if (!data) return;

    let cancelled = false;

    async function loadCurrentMembers() {
      setMembersLoading(true);
      setMembersError('');

      try {
        if (isLocalHost) {
          const response = await fetch('/data/current-members.json', { cache: 'no-store' });
          if (!response.ok) {
            throw new Error('Could not load the current S&P 500 member table.');
          }

          const payload = await response.json() as CurrentMembersData;
          const allRows = Array.isArray(payload.currentMembers) ? payload.currentMembers : [];
          const sectorTotals = new Map<string, number>();

          for (const row of allRows) {
            const marketCap = row.metrics.marketCap;
            if (marketCap === null || Number.isNaN(marketCap)) continue;
            sectorTotals.set(row.sector, (sectorTotals.get(row.sector) ?? 0) + marketCap);
          }

          const normalizedQuery = debouncedMembersQuery.toLowerCase();
          const filteredRows = !normalizedQuery
            ? allRows
            : allRows.filter((row) => [row.ticker, row.security, row.sector, row.subIndustry].join(' ').toLowerCase().includes(normalizedQuery));

          const sortedRows = [...filteredRows].sort((left, right) => {
            const comparison = compareMembershipValues(
              getMembershipSortValue(left, membersSort.key, sectorTotals),
              getMembershipSortValue(right, membersSort.key, sectorTotals),
              membersSort.direction,
            );

            if (comparison !== 0) return comparison;
            return left.ticker.localeCompare(right.ticker, undefined, { sensitivity: 'base' });
          });

          const totalCount = sortedRows.length;
          const totalPages = Math.max(1, Math.ceil(totalCount / membersPageSize));
          const page = Math.min(membersPage, totalPages);
          const startIndex = (page - 1) * membersPageSize;

          if (!cancelled) {
            setCurrentMembers(sortedRows.slice(startIndex, startIndex + membersPageSize));
            setMembersSectorMarketCaps(sectorTotals);
            setMembersTotalCount(totalCount);
            setMembersTotalPages(totalPages);
            setMembersPage(page);
          }

          return;
        }

        const params = new URLSearchParams({
          page: String(membersPage),
          pageSize: String(membersPageSize),
          sort: membersSort.key,
          direction: membersSort.direction,
        });

        if (debouncedMembersQuery) {
          params.set('query', debouncedMembersQuery);
        }

        let response = await fetch(`/__members/table?${params.toString()}`, { cache: 'no-store' });

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

          response = await fetch(`/__members/table?${params.toString()}`, { cache: 'no-store' });
        }

        if (!response.ok) {
          throw new Error('Could not load the current S&P 500 member table.');
        }

        const payload = await response.json() as MembersTableResponse;
        if (!cancelled) {
          setCurrentMembers(Array.isArray(payload.currentMembers) ? payload.currentMembers : []);
          setMembersSectorMarketCaps(new Map(Object.entries(payload.sectorMarketCaps ?? {}).map(([sector, value]) => [sector, Number(value)])));
          setMembersTotalCount(typeof payload.totalCount === 'number' ? payload.totalCount : 0);
          setMembersTotalPages(typeof payload.totalPages === 'number' ? Math.max(1, payload.totalPages) : 1);
          setMembersPage(typeof payload.page === 'number' ? Math.max(1, payload.page) : 1);
        }
      } catch (err) {
        if (!cancelled) {
          setMembersError(err instanceof Error ? err.message : 'Could not load the current S&P 500 member table.');
          setCurrentMembers([]);
          setMembersSectorMarketCaps(new Map());
          setMembersTotalCount(0);
          setMembersTotalPages(1);
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
  }, [data, debouncedMembersQuery, membersPage, membersPageSize, membersSort.direction, membersSort.key]);

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

  const supporterAccessDuration = formatSupporterAccessDuration(supporterExportTtlSeconds);

  function showHomeSection(sectionId?: string) {
    setActiveView('home');
    setShowLoginForm(false);
    setIsNavMenuOpen(false);

    if (typeof window === 'undefined') return;

    window.requestAnimationFrame(() => {
      if (sectionId) {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function handleMembersQueryChange(value: string) {
    setMembersQuery(value);
    setMembersPage(1);
  }

  function handleMembersSortChange(key: MembershipSortKey) {
    setMembersPage(1);
    setMembersSort((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }

      return { key, direction: getInitialMembershipSortDirection(key) };
    });
  }

  function handleMembersPageChange(nextPage: number) {
    setMembersPage((current) => Math.max(1, nextPage === current ? current : nextPage));
  }

  function handleResetMembersSort() {
    setMembersPage(1);
    setMembersSort(defaultMembershipSort);
  }

  async function startSupporterCheckout() {
    setSupporterPending(true);
    setSupporterError('');

    try {
      const response = await fetch('/__supporter/checkout', { method: 'POST' });
      const payload = await response.json().catch(() => ({} as { error?: string }));

      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not start the Lemon Squeezy checkout.');
      }

      if (typeof (payload as { url?: string }).url !== 'string' || !(payload as { url?: string }).url) {
        throw new Error('Lemon Squeezy checkout URL was missing.');
      }

      window.location.href = (payload as { url: string }).url;
    } catch (err) {
      setSupporterError(err instanceof Error ? err.message : 'Could not start the Lemon Squeezy checkout.');
    } finally {
      setSupporterPending(false);
    }
  }

  return (
    <main className="app-shell">
      <header ref={siteHeaderRef} className="panel site-header">
        <button type="button" className="site-brand-button" onClick={() => showHomeSection()}>
          <div className="site-brand">
            <div className="site-kicker">S&amp;P 500 Monitor</div>
            <div className="site-title">Market structure dashboard</div>
          </div>
        </button>
        <div className="site-nav-wrap">
          <button
            type="button"
            className={`nav-menu-button${isNavMenuOpen ? ' active' : ''}`}
            aria-expanded={isNavMenuOpen}
            aria-label="Toggle navigation"
            onClick={() => setIsNavMenuOpen((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>
          <nav className={`site-nav${isNavMenuOpen ? ' open' : ''}`} aria-label="Primary">
            <button type="button" className="nav-link-button" onClick={() => showHomeSection('members-table')}>
              Table
            </button>
            <button type="button" className="nav-link-button" onClick={() => showHomeSection('data-sources')}>
              Data sources
            </button>
            {isAuthenticated ? (
              <button
                type="button"
                className={`view-button${activeView === 'prediction' ? ' active' : ''}`}
                onClick={() => {
                  setActiveView('prediction');
                  setShowLoginForm(false);
                  setIsNavMenuOpen(false);
                }}
              >
                Prediction
              </button>
            ) : (
              <button
                type="button"
                className={`view-button${showLoginForm ? ' active' : ''}`}
                onClick={() => {
                  setShowLoginForm((current) => !current);
                  setActiveView('home');
                  setIsNavMenuOpen(false);
                }}
              >
                Log in
              </button>
            )}
            {canLogout && isAuthenticated ? <a className="logout-button" href="/__auth/logout" onClick={() => setIsNavMenuOpen(false)}>Log out</a> : null}
          </nav>
        </div>
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
              query={membersQuery}
              sort={membersSort}
              page={membersPage}
              pageSize={membersPageSize}
              totalCount={membersTotalCount}
              totalPages={membersTotalPages}
              tableLoading={membersLoading}
              sectorMarketCaps={membersSectorMarketCaps}
              canExport={canExport}
              supporterEnabled={supporterEnabled}
              supporterPending={supporterPending}
              supporterError={supporterError}
              snapshotGeneratedAt={data.generatedAt}
              supporterAccessDuration={supporterAccessDuration}
              siteHeaderOffset={siteHeaderOffset}
              onQueryChange={handleMembersQueryChange}
              onSortChange={handleMembersSortChange}
              onResetSort={handleResetMembersSort}
              onPageChange={handleMembersPageChange}
              onStartSupporterCheckout={() => void startSupporterCheckout()}
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
