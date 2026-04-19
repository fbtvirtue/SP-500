import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { CompanyRecord, CurrentMembersData, MembershipChange, SnapshotData } from './types';

type LocalHomeRoute = { kind: 'gallery' } | { kind: 'variant'; id: number };

type VariantLayout =
  | 'frontpage'
  | 'terminal'
  | 'mosaic'
  | 'pinboard'
  | 'metro'
  | 'dossier'
  | 'blueprint'
  | 'poster'
  | 'timeline'
  | 'zen';

type VariantTheme = {
  background: string;
  panel: string;
  panelStrong: string;
  text: string;
  muted: string;
  accent: string;
  accentStrong: string;
  border: string;
  shadow: string;
  displayFont: string;
  bodyFont: string;
};

type VariantDefinition = {
  id: number;
  kicker: string;
  title: string;
  label: string;
  description: string;
  layout: VariantLayout;
  theme: VariantTheme;
};

type SectorLeader = {
  sector: string;
  row: CompanyRecord;
};

type HomeDigest = {
  generatedDate: string;
  generatedTime: string;
  nextSnapshotDate: string;
  nextSnapshotTime: string;
  currentMembers: string;
  candidateUniverse: string;
  dividendPayers: string;
  joinedCount: string;
  leftCount: string;
  joinedRows: MembershipChange[];
  leftRows: MembershipChange[];
  methodology: string[];
  sources: SnapshotData['sources'];
  functions: Array<{ title: string; value: string; detail: string }>;
  topMarketCaps: CompanyRecord[];
  topYieldRows: CompanyRecord[];
  newestMembers: CompanyRecord[];
  oldestMembers: CompanyRecord[];
  sectorLeaders: SectorLeader[];
  watchRows: CompanyRecord[];
};

const variants: VariantDefinition[] = [
  {
    id: 1,
    kicker: 'Concept 01',
    title: 'Financial Frontpage',
    label: 'Newspaper spread with a live market leaderboard',
    description: 'A broadsheet homepage that reads like a front page and treats the member table like the lead market story.',
    layout: 'frontpage',
    theme: {
      background: 'linear-gradient(180deg, #efe6d5 0%, #f8f2e8 44%, #e8edf5 100%)',
      panel: 'rgba(255, 250, 243, 0.88)',
      panelStrong: '#fffdf7',
      text: '#281d15',
      muted: '#6d5a4b',
      accent: '#b24e2f',
      accentStrong: '#173e67',
      border: 'rgba(40, 29, 21, 0.12)',
      shadow: '0 30px 80px rgba(40, 29, 21, 0.12)',
      displayFont: 'Georgia, serif',
      bodyFont: '"Trebuchet MS", sans-serif',
    },
  },
  {
    id: 2,
    kicker: 'Concept 02',
    title: 'Command Terminal',
    label: 'Dark operator console with raw data blocks',
    description: 'A command-center homepage with dense data blocks, terminal treatment, and the table shown like a live machine feed.',
    layout: 'terminal',
    theme: {
      background: 'linear-gradient(180deg, #041218 0%, #081c25 55%, #122833 100%)',
      panel: 'rgba(8, 22, 29, 0.9)',
      panelStrong: '#0b1f27',
      text: '#e8faf0',
      muted: '#8fafac',
      accent: '#45e2a1',
      accentStrong: '#7ec7ff',
      border: 'rgba(69, 226, 161, 0.18)',
      shadow: '0 28px 90px rgba(0, 0, 0, 0.34)',
      displayFont: '"Courier New", monospace',
      bodyFont: '"Lucida Console", monospace',
    },
  },
  {
    id: 3,
    kicker: 'Concept 03',
    title: 'Gallery of Movers',
    label: 'Oversized visual cards instead of a hero-and-grid default',
    description: 'A visual-first homepage where the constituent table becomes a gallery of oversized company cards and ribbons.',
    layout: 'mosaic',
    theme: {
      background: 'linear-gradient(150deg, #fff4e7 0%, #f6efe8 24%, #e1efff 100%)',
      panel: 'rgba(255, 255, 255, 0.86)',
      panelStrong: '#fff8ef',
      text: '#251f33',
      muted: '#6b6176',
      accent: '#f26c3b',
      accentStrong: '#3065cf',
      border: 'rgba(37, 31, 51, 0.10)',
      shadow: '0 28px 78px rgba(48, 101, 207, 0.14)',
      displayFont: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
      bodyFont: '"Trebuchet MS", sans-serif',
    },
  },
  {
    id: 4,
    kicker: 'Concept 04',
    title: 'Analyst Pinboard',
    label: 'Sticky-note workspace with clipped member snapshots',
    description: 'A messy-on-purpose research board where the homepage feels like an active analyst desk covered in pinned findings.',
    layout: 'pinboard',
    theme: {
      background: 'linear-gradient(180deg, #f2d8a7 0%, #dba95a 14%, #8b5c27 14.5%, #694823 100%)',
      panel: 'rgba(255, 248, 231, 0.92)',
      panelStrong: '#fff7df',
      text: '#332111',
      muted: '#72573b',
      accent: '#d25730',
      accentStrong: '#1e5a99',
      border: 'rgba(51, 33, 17, 0.16)',
      shadow: '0 26px 70px rgba(25, 12, 3, 0.24)',
      displayFont: '"Comic Sans MS", "Trebuchet MS", sans-serif',
      bodyFont: 'Verdana, sans-serif',
    },
  },
  {
    id: 5,
    kicker: 'Concept 05',
    title: 'Metro Flow',
    label: 'Route map that turns the product into a guided transit system',
    description: 'A transport-map concept where users follow lines from snapshot to table to prediction to export while seeing member data along each stop.',
    layout: 'metro',
    theme: {
      background: 'linear-gradient(180deg, #f1fbff 0%, #e6f3ff 48%, #f9fbff 100%)',
      panel: 'rgba(255, 255, 255, 0.88)',
      panelStrong: '#ffffff',
      text: '#0e2848',
      muted: '#57728f',
      accent: '#ff6b35',
      accentStrong: '#047f7d',
      border: 'rgba(14, 40, 72, 0.10)',
      shadow: '0 24px 65px rgba(14, 40, 72, 0.10)',
      displayFont: '"Gill Sans", "Trebuchet MS", sans-serif',
      bodyFont: '"Segoe UI", sans-serif',
    },
  },
  {
    id: 6,
    kicker: 'Concept 06',
    title: 'Company Dossier',
    label: 'Large-profile explorer with a left-right data split',
    description: 'A research dossier where the homepage foregrounds one company profile and lets the table preview behave like an explorer sidebar.',
    layout: 'dossier',
    theme: {
      background: 'linear-gradient(180deg, #f8f6f2 0%, #efeee9 48%, #e6edf6 100%)',
      panel: 'rgba(255, 255, 255, 0.9)',
      panelStrong: '#ffffff',
      text: '#1d2430',
      muted: '#657082',
      accent: '#2f6cf0',
      accentStrong: '#1c8d71',
      border: 'rgba(29, 36, 48, 0.10)',
      shadow: '0 26px 65px rgba(29, 36, 48, 0.10)',
      displayFont: '"Palatino Linotype", Georgia, serif',
      bodyFont: 'Arial, sans-serif',
    },
  },
  {
    id: 7,
    kicker: 'Concept 07',
    title: 'System Blueprint',
    label: 'Engineering schematic with nodes, registers, and leader panels',
    description: 'A technical blueprint that makes the product feel like infrastructure rather than a generic investor landing page.',
    layout: 'blueprint',
    theme: {
      background: 'linear-gradient(180deg, #edf6ff 0%, #dfeefc 55%, #eff9f9 100%)',
      panel: 'rgba(244, 250, 255, 0.88)',
      panelStrong: '#fcfeff',
      text: '#0f2843',
      muted: '#577492',
      accent: '#2677e8',
      accentStrong: '#16837e',
      border: 'rgba(15, 40, 67, 0.12)',
      shadow: '0 24px 70px rgba(38, 119, 232, 0.12)',
      displayFont: '"Lucida Sans Unicode", "Segoe UI", sans-serif',
      bodyFont: '"Lucida Sans", sans-serif',
    },
  },
  {
    id: 8,
    kicker: 'Concept 08',
    title: 'Launch Poster',
    label: 'Campaign landing page with massive type and ticker ribbons',
    description: 'A poster-style design that is loud, theatrical, and product-marketing-forward while still embedding real constituent data.',
    layout: 'poster',
    theme: {
      background: 'linear-gradient(160deg, #15060f 0%, #361125 36%, #f05b32 36.4%, #f4c15d 100%)',
      panel: 'rgba(255, 247, 239, 0.92)',
      panelStrong: '#fff6ea',
      text: '#1d1217',
      muted: '#6c5561',
      accent: '#d22f27',
      accentStrong: '#1d2ec1',
      border: 'rgba(29, 18, 23, 0.10)',
      shadow: '0 28px 85px rgba(18, 6, 12, 0.25)',
      displayFont: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
      bodyFont: '"Arial Narrow", sans-serif',
    },
  },
  {
    id: 9,
    kicker: 'Concept 09',
    title: 'Membership Timeline',
    label: 'Chronology-led homepage with a vertical table story',
    description: 'A timeline-led composition where the table preview becomes a chronology of old members, new arrivals, and recent changes.',
    layout: 'timeline',
    theme: {
      background: 'linear-gradient(180deg, #faf5ef 0%, #f2ece4 48%, #eef3fb 100%)',
      panel: 'rgba(255, 255, 255, 0.88)',
      panelStrong: '#fffdf9',
      text: '#2a1f19',
      muted: '#75655b',
      accent: '#b45b38',
      accentStrong: '#2458ad',
      border: 'rgba(42, 31, 25, 0.10)',
      shadow: '0 24px 68px rgba(42, 31, 25, 0.10)',
      displayFont: 'Georgia, serif',
      bodyFont: '"Gill Sans", sans-serif',
    },
  },
  {
    id: 10,
    kicker: 'Concept 10',
    title: 'Zen Ledger',
    label: 'Quiet premium minimalism with a data-led spine',
    description: 'A sparse, calm layout where the homepage behaves like a premium ledger and the member table becomes a restrained focal strip.',
    layout: 'zen',
    theme: {
      background: 'linear-gradient(180deg, #fcfcfb 0%, #f4f5f6 55%, #ebf1f6 100%)',
      panel: 'rgba(255, 255, 255, 0.92)',
      panelStrong: '#ffffff',
      text: '#1f252c',
      muted: '#69717d',
      accent: '#2d68f2',
      accentStrong: '#15826f',
      border: 'rgba(31, 37, 44, 0.08)',
      shadow: '0 18px 45px rgba(31, 37, 44, 0.08)',
      displayFont: '"Palatino Linotype", Georgia, serif',
      bodyFont: 'Arial, sans-serif',
    },
  },
  {
    id: 11,
    kicker: 'Concept 11',
    title: 'Metro Flow / Poster Palette',
    label: 'Concept 5 structure with concept 8 color and type direction',
    description: 'The Metro Flow route-map layout, but recolored with the loud poster palette from concept 8 for a more theatrical version of the same information architecture.',
    layout: 'metro',
    theme: {
      background: 'linear-gradient(160deg, #15060f 0%, #361125 36%, #f05b32 36.4%, #f4c15d 100%)',
      panel: 'rgba(255, 247, 239, 0.92)',
      panelStrong: '#fff6ea',
      text: '#1d1217',
      muted: '#6c5561',
      accent: '#d22f27',
      accentStrong: '#1d2ec1',
      border: 'rgba(29, 18, 23, 0.10)',
      shadow: '0 28px 85px rgba(18, 6, 12, 0.25)',
      displayFont: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
      bodyFont: '"Arial Narrow", sans-serif',
    },
  },
  {
    id: 12,
    kicker: 'Concept 12',
    title: 'Metro Flow / Coastal Mint',
    label: 'Same Metro structure with a sea-glass mint palette',
    description: 'The same Metro Flow homepage structure, recolored with a pale coastal mint palette and cool teal accents.',
    layout: 'metro',
    theme: {
      background: 'linear-gradient(180deg, #e8fbf6 0%, #dff5f3 48%, #f7fdfc 100%)',
      panel: 'rgba(245, 255, 252, 0.92)',
      panelStrong: '#ffffff',
      text: '#153235',
      muted: '#587277',
      accent: '#1f9b8f',
      accentStrong: '#2d6fcb',
      border: 'rgba(21, 50, 53, 0.10)',
      shadow: '0 28px 80px rgba(31, 155, 143, 0.12)',
      displayFont: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
      bodyFont: '"Arial Narrow", sans-serif',
    },
  },
  {
    id: 13,
    kicker: 'Concept 13',
    title: 'Metro Flow / Civic Blue',
    label: 'Same Metro structure with a crisp civic blue palette',
    description: 'The same Metro Flow homepage structure, recolored with clear blues, pale stone panels, and restrained red contrast.',
    layout: 'metro',
    theme: {
      background: 'linear-gradient(180deg, #edf5ff 0%, #dfeafb 46%, #f8fbff 100%)',
      panel: 'rgba(248, 251, 255, 0.93)',
      panelStrong: '#ffffff',
      text: '#112742',
      muted: '#5d7288',
      accent: '#2f6fe4',
      accentStrong: '#0d8792',
      border: 'rgba(17, 39, 66, 0.10)',
      shadow: '0 28px 80px rgba(47, 111, 228, 0.12)',
      displayFont: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
      bodyFont: '"Arial Narrow", sans-serif',
    },
  },
  {
    id: 14,
    kicker: 'Concept 14',
    title: 'Metro Flow / Sandstone',
    label: 'Same Metro structure with a warm sandstone palette',
    description: 'The same Metro Flow homepage structure, recolored with warm sandstone panels, dark umber type, and dusty blue accents.',
    layout: 'metro',
    theme: {
      background: 'linear-gradient(180deg, #f7eee3 0%, #f0e5d8 50%, #fbf7f1 100%)',
      panel: 'rgba(255, 250, 244, 0.92)',
      panelStrong: '#fffdf8',
      text: '#2e1f18',
      muted: '#7b6457',
      accent: '#c46b34',
      accentStrong: '#486da8',
      border: 'rgba(46, 31, 24, 0.10)',
      shadow: '0 28px 80px rgba(108, 73, 45, 0.12)',
      displayFont: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
      bodyFont: '"Arial Narrow", sans-serif',
    },
  },
  {
    id: 15,
    kicker: 'Concept 15',
    title: 'Metro Flow / Signal Green',
    label: 'Same Metro structure with a transit-green palette',
    description: 'The same Metro Flow homepage structure, recolored with signal green, off-white panels, and dark forest typography.',
    layout: 'metro',
    theme: {
      background: 'linear-gradient(180deg, #edf8ef 0%, #e1f0e6 48%, #f8fcf8 100%)',
      panel: 'rgba(250, 255, 250, 0.93)',
      panelStrong: '#ffffff',
      text: '#1b2d1f',
      muted: '#647564',
      accent: '#2f8b57',
      accentStrong: '#2d66a8',
      border: 'rgba(27, 45, 31, 0.10)',
      shadow: '0 28px 80px rgba(47, 139, 87, 0.12)',
      displayFont: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
      bodyFont: '"Arial Narrow", sans-serif',
    },
  },
  {
    id: 16,
    kicker: 'Concept 16',
    title: 'Metro Flow / Night Rail',
    label: 'Same Metro structure with a dark navy-to-slate palette',
    description: 'The same Metro Flow homepage structure, recolored with deep night blues, pale slate panels, and a single coherent indigo accent family.',
    layout: 'metro',
    theme: {
      background: 'linear-gradient(180deg, #0f1623 0%, #1a2740 46%, #31486a 100%)',
      panel: 'rgba(243, 248, 255, 0.92)',
      panelStrong: '#fbfdff',
      text: '#182231',
      muted: '#637088',
      accent: '#3f67c8',
      accentStrong: '#6f8fda',
      border: 'rgba(24, 34, 49, 0.10)',
      shadow: '0 28px 88px rgba(9, 16, 31, 0.26)',
      displayFont: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
      bodyFont: '"Arial Narrow", sans-serif',
    },
  },
  {
    id: 17,
    kicker: 'Concept 17',
    title: 'Metro Flow / Cabernet',
    label: 'Same Metro structure with a wine-and-cream palette',
    description: 'The same Metro Flow homepage structure, recolored with cabernet reds, parchment panels, and ink-dark typography.',
    layout: 'metro',
    theme: {
      background: 'linear-gradient(180deg, #2a0f19 0%, #542032 42%, #f3ddd4 100%)',
      panel: 'rgba(255, 247, 241, 0.92)',
      panelStrong: '#fffaf5',
      text: '#23141a',
      muted: '#735763',
      accent: '#a52e4f',
      accentStrong: '#355cb1',
      border: 'rgba(35, 20, 26, 0.10)',
      shadow: '0 28px 88px rgba(42, 15, 25, 0.22)',
      displayFont: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
      bodyFont: '"Arial Narrow", sans-serif',
    },
  },
  {
    id: 18,
    kicker: 'Concept 18',
    title: 'Metro Flow / Brass Ledger',
    label: 'Same Metro structure with brass and ledger-paper tones',
    description: 'The same Metro Flow homepage structure, recolored with brass, parchment, and charcoal for a more editorial palette.',
    layout: 'metro',
    theme: {
      background: 'linear-gradient(180deg, #f4ead3 0%, #ebdfc4 48%, #fbf8f1 100%)',
      panel: 'rgba(255, 251, 242, 0.93)',
      panelStrong: '#fffdf8',
      text: '#2b241d',
      muted: '#736658',
      accent: '#b7872f',
      accentStrong: '#44698f',
      border: 'rgba(43, 36, 29, 0.10)',
      shadow: '0 28px 82px rgba(117, 91, 35, 0.12)',
      displayFont: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
      bodyFont: '"Arial Narrow", sans-serif',
    },
  },
  {
    id: 19,
    kicker: 'Concept 19',
    title: 'Metro Flow / Glacier',
    label: 'Same Metro structure with icy blue-gray tones',
    description: 'The same Metro Flow homepage structure, recolored with glacier blues, frosted panels, and dark steel typography.',
    layout: 'metro',
    theme: {
      background: 'linear-gradient(180deg, #eef7fb 0%, #ddebf3 50%, #f8fbfd 100%)',
      panel: 'rgba(249, 253, 255, 0.93)',
      panelStrong: '#ffffff',
      text: '#16242f',
      muted: '#62737f',
      accent: '#4a8bb3',
      accentStrong: '#2f63d4',
      border: 'rgba(22, 36, 47, 0.10)',
      shadow: '0 28px 82px rgba(74, 139, 179, 0.12)',
      displayFont: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
      bodyFont: '"Arial Narrow", sans-serif',
    },
  },
  {
    id: 20,
    kicker: 'Concept 20',
    title: 'Metro Flow / Coral Ink',
    label: 'Same Metro structure with coral and ink-navy contrast',
    description: 'The same Metro Flow homepage structure, recolored with coral warmth, navy contrast, and soft ivory panels.',
    layout: 'metro',
    theme: {
      background: 'linear-gradient(180deg, #fff0ea 0%, #fbe0d4 44%, #f7f8fc 100%)',
      panel: 'rgba(255, 250, 246, 0.93)',
      panelStrong: '#fffdfa',
      text: '#221a23',
      muted: '#766775',
      accent: '#e16d52',
      accentStrong: '#273d93',
      border: 'rgba(34, 26, 35, 0.10)',
      shadow: '0 28px 84px rgba(225, 109, 82, 0.12)',
      displayFont: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
      bodyFont: '"Arial Narrow", sans-serif',
    },
  },
  {
    id: 21,
    kicker: 'Concept 21',
    title: 'Metro Flow / Slate Gold',
    label: 'Same Metro structure with slate and muted gold tones',
    description: 'The same Metro Flow homepage structure, recolored with slate neutrals, muted gold accents, and pale stone panels.',
    layout: 'metro',
    theme: {
      background: 'linear-gradient(180deg, #e9ecef 0%, #dfe4e8 45%, #f7f7f5 100%)',
      panel: 'rgba(251, 251, 248, 0.94)',
      panelStrong: '#ffffff',
      text: '#24272c',
      muted: '#6d7178',
      accent: '#b38b43',
      accentStrong: '#4a6688',
      border: 'rgba(36, 39, 44, 0.10)',
      shadow: '0 28px 82px rgba(36, 39, 44, 0.10)',
      displayFont: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
      bodyFont: '"Arial Narrow", sans-serif',
    },
  },
];

const localHosts = new Set(['localhost', '127.0.0.1']);

export function getLocalHomeRoute(pathname: string, hostname: string): LocalHomeRoute | null {
  if (!localHosts.has(hostname)) return null;
  if (pathname === '/local-home-gallery') return { kind: 'gallery' };

  const match = pathname.match(/^\/local-home-(\d{1,2})$/);
  if (!match) return null;

  const id = Number(match[1]);
  if (!Number.isInteger(id) || id < 1 || id > variants.length) return null;
  return { kind: 'variant', id };
}

function formatDate(value: string | null): string {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
}

function formatTime(value: string | null): string {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(new Date(value));
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return 'N/A';
  return `${(value * 100).toFixed(2)}%`;
}

function formatCompactCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number | null, currency = 'USD'): string {
  if (value === null || Number.isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRatio(value: number | null): string {
  if (value === null || Number.isNaN(value)) return 'N/A';
  return value.toFixed(2);
}

function formatDominance(value: number | null): string {
  if (value === null || Number.isNaN(value)) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

function formatLastLeft(value: string | null): string {
  return value ? formatDate(value) : 'Never';
}

function summarizeChanges(rows: MembershipChange[]): string {
  if (!rows.length) return 'No published changes in the last 45 days.';
  return rows.slice(0, 3).map((row) => `${row.ticker} ${formatDate(row.date)}`).join(' • ');
}

function sortRows(rows: CompanyRecord[], selector: (row: CompanyRecord) => number | null, direction: 'asc' | 'desc' = 'desc'): CompanyRecord[] {
  return [...rows].sort((left, right) => {
    const leftValue = selector(left);
    const rightValue = selector(right);

    if (leftValue === null && rightValue === null) return left.ticker.localeCompare(right.ticker);
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;
    if (leftValue === rightValue) return left.ticker.localeCompare(right.ticker);

    return direction === 'desc' ? rightValue - leftValue : leftValue - rightValue;
  });
}

function buildDigest(data: SnapshotData, rows: CompanyRecord[]): HomeDigest {
  const joinedRecent = data.recentChanges.joinedLast45Days ?? data.recentChanges.joinedLast7Days;
  const leftRecent = data.recentChanges.leftLast45Days ?? data.recentChanges.leftLast7Days;
  const topMarketCaps = sortRows(rows, (row) => row.metrics.marketCap).slice(0, 8);
  const topYieldRows = sortRows(rows.filter((row) => row.dividend.hasDividend), (row) => row.dividend.dividendYield).slice(0, 8);
  const newestMembers = sortRows(rows, (row) => row.currentMemberSince ? Date.parse(row.currentMemberSince) : null).slice(0, 8);
  const oldestMembers = sortRows(rows, (row) => row.currentMemberSince ? Date.parse(row.currentMemberSince) : null, 'asc').slice(0, 8);
  const leadersBySector = new Map<string, CompanyRecord>();

  for (const row of rows) {
    const existing = leadersBySector.get(row.sector);
    const existingCap = existing?.metrics.marketCap ?? -1;
    const nextCap = row.metrics.marketCap ?? -1;
    if (!existing || nextCap > existingCap) {
      leadersBySector.set(row.sector, row);
    }
  }

  const sectorLeaders = [...leadersBySector.entries()]
    .map(([sector, row]) => ({ sector, row }))
    .sort((left, right) => (right.row.metrics.marketCap ?? 0) - (left.row.metrics.marketCap ?? 0))
    .slice(0, 8);

  return {
    generatedDate: formatDate(data.generatedAt),
    generatedTime: formatTime(data.generatedAt),
    nextSnapshotDate: formatDate(data.schedule.nextSnapshotAt),
    nextSnapshotTime: formatTime(data.schedule.nextSnapshotAt),
    currentMembers: String(data.summary.currentConstituentCount),
    candidateUniverse: String(data.summary.candidateUniverseCount),
    dividendPayers: `${data.summary.dividendPayers} dividend payers`,
    joinedCount: String(joinedRecent.length),
    leftCount: String(leftRecent.length),
    joinedRows: joinedRecent.slice(0, 5),
    leftRows: leftRecent.slice(0, 5),
    methodology: [
      ...data.methodology.fallOutFactors.slice(0, 2),
      ...data.methodology.entryFactors.slice(0, 2),
      ...data.methodology.valuationFactors.slice(0, 2),
    ],
    sources: data.sources.slice(0, 5),
    functions: [
      {
        title: 'Current leaders',
        value: 'Largest live constituents',
        detail: 'Lead with the companies currently driving the index instead of explaining implementation details to the visitor.',
      },
      {
        title: 'Dividend lens',
        value: 'Highest current yields',
        detail: 'Make the homepage useful on its own by surfacing a clear income-oriented cut of the current S&P 500 members.',
      },
      {
        title: 'Sector map',
        value: 'Largest name in each sector',
        detail: 'Give the visitor a fast mental model of market structure by showing the dominant company per sector.',
      },
      {
        title: 'Refresh cycle',
        value: `${formatDate(data.schedule.nextSnapshotAt)} ${formatTime(data.schedule.nextSnapshotAt)}`,
        detail: 'Tell users when the next snapshot lands so the page feels alive and self-contained.',
      },
    ],
    topMarketCaps,
    topYieldRows,
    newestMembers,
    oldestMembers,
    sectorLeaders,
    watchRows: topMarketCaps.slice(0, 5),
  };
}

function toThemeStyle(theme: VariantTheme): CSSProperties {
  return {
    '--local-bg': theme.background,
    '--local-panel': theme.panel,
    '--local-panel-strong': theme.panelStrong,
    '--local-text': theme.text,
    '--local-muted': theme.muted,
    '--local-accent': theme.accent,
    '--local-accent-strong': theme.accentStrong,
    '--local-border': theme.border,
    '--local-shadow': theme.shadow,
    '--local-display-font': theme.displayFont,
    '--local-body-font': theme.bodyFont,
  } as CSSProperties;
}

function OpenActions() {
  return null;
}

function summarizeChangeTickers(rows: MembershipChange[]): string {
  if (!rows.length) return 'Last 45 days: none';
  return `Last 45 days: ${rows.map((row) => row.ticker).join(', ')}`;
}

function MemberDirectory({ rows }: { rows: CompanyRecord[] }) {
  const pageSize = 16;
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const sectorMarketCaps = useMemo(() => rows.reduce((totals, row) => {
    const currentTotal = totals.get(row.sector) ?? 0;
    const marketCap = row.metrics.marketCap ?? 0;
    totals.set(row.sector, currentTotal + marketCap);
    return totals;
  }, new Map<string, number>()), [rows]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = !normalizedQuery
    ? rows
    : rows.filter((row) => [row.ticker, row.security, row.sector, row.subIndustry].join(' ').toLowerCase().includes(normalizedQuery));
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="local-card local-member-directory">
      <div className="local-member-directory-head">
        <div className="local-member-directory-title">
          <div className="local-overline">Member list</div>
          <h2>Current S&amp;P 500</h2>
        </div>
        <label className="local-search-field" aria-label="Search current S&P 500 members">
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search ticker, name, sector"
          />
        </label>
      </div>
      <div className="local-member-table-wrap">
        <table className="local-mini-table local-member-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Company</th>
              <th>Sector</th>
              <th>Dominance</th>
              <th>Member since</th>
              <th>Last left</th>
              <th>Dividend</th>
              <th>Yield</th>
              <th>Market cap</th>
              <th>Forward P/E</th>
              <th>Current price</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const sectorTotal = sectorMarketCaps.get(row.sector) ?? null;
              const dominance = row.metrics.marketCap !== null && sectorTotal && sectorTotal > 0
                ? row.metrics.marketCap / sectorTotal
                : null;
              const moneyCurrency = row.metrics.currency ?? row.dividend.currency ?? 'USD';

              return (
                <tr key={row.ticker}>
                  <td>{row.ticker}</td>
                  <td>{row.security}</td>
                  <td>{row.sector}</td>
                  <td>{formatDominance(dominance)}</td>
                  <td>{formatDate(row.currentMemberSince)}</td>
                  <td>{formatLastLeft(row.lastLeftAt)}</td>
                  <td>{row.dividend.hasDividend ? formatCurrency(row.dividend.dividendRate, row.dividend.currency ?? moneyCurrency) : 'None'}</td>
                  <td>{formatPercent(row.dividend.dividendYield)}</td>
                  <td>{formatCompactCurrency(row.metrics.marketCap)}</td>
                  <td>{formatRatio(row.metrics.forwardPE)}</td>
                  <td>{formatCurrency(row.metrics.price, moneyCurrency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="local-member-directory-footer">
        <p>{filteredRows.length} results • Page {currentPage} of {totalPages}</p>
        <div className="local-actions local-actions-compact">
          <button type="button" className="local-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1}>Previous</button>
          <button type="button" className="local-button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages}>Next</button>
          <button type="button" className="local-button local-button-primary">Unlock export</button>
        </div>
      </div>
    </section>
  );
}

function StatPill({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <article className="local-stat-pill">
      <div className="local-overline">{label}</div>
      <strong>{value}</strong>
      {note ? <p>{note}</p> : null}
    </article>
  );
}

function FunctionStrip({ digest }: { digest: HomeDigest }) {
  return (
    <section className="local-function-strip">
      {digest.functions.map((item) => (
        <article key={item.title} className="local-card">
          <div className="local-overline">{item.title}</div>
          <h3>{item.value}</h3>
          <p>{item.detail}</p>
        </article>
      ))}
    </section>
  );
}

function CompactTable({
  title,
  rows,
  metricLabel,
  metricValue,
}: {
  title: string;
  rows: CompanyRecord[];
  metricLabel: string;
  metricValue: (row: CompanyRecord) => string;
}) {
  return (
    <section className="local-card local-table-card">
      <div className="local-overline">{title}</div>
      <div className="local-compact-table-wrap">
        <table className="local-mini-table local-compact-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Company</th>
              <th>Sector</th>
              <th>{metricLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${title}-${row.ticker}`}>
                <td>{row.ticker}</td>
                <td>{row.security}</td>
                <td>{row.sector}</td>
                <td>{metricValue(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CompanyGallery({ title, rows }: { title: string; rows: CompanyRecord[] }) {
  return (
    <section className="local-card">
      <div className="local-overline">{title}</div>
      <div className="local-company-gallery">
        {rows.map((row) => (
          <article key={`${title}-${row.ticker}`} className="local-company-card">
            <div className="local-company-ticker">{row.ticker}</div>
            <h3>{row.security}</h3>
            <p>{row.sector}</p>
            <div className="local-company-meta">
              <span>{formatCompactCurrency(row.metrics.marketCap)}</span>
              <span>{formatPercent(row.dividend.dividendYield)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ChangesRail({ title, rows }: { title: string; rows: MembershipChange[] }) {
  return (
    <section className="local-card">
      <div className="local-overline">{title}</div>
      <p>{summarizeChanges(rows)}</p>
      <ul className="local-rail-list">
        {rows.length ? rows.map((row) => (
          <li key={`${title}-${row.ticker}-${row.date}`}>
            <strong>{row.ticker}</strong>
            <span>{row.security}</span>
            <time>{formatDate(row.date)}</time>
          </li>
        )) : <li>No recent changes.</li>}
      </ul>
    </section>
  );
}

function SectorLeaderBoard({ leaders }: { leaders: SectorLeader[] }) {
  return (
    <section className="local-card">
      <div className="local-overline">Sector leaders</div>
      <div className="local-sector-grid">
        {leaders.map(({ sector, row }) => (
          <article key={sector} className="local-sector-card">
            <span>{sector}</span>
            <strong>{row.ticker}</strong>
            <p>{row.security}</p>
            <small>{formatCompactCurrency(row.metrics.marketCap)}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function SourceList({ sources }: { sources: SnapshotData['sources'] }) {
  return (
    <section className="local-card">
      <div className="local-overline">Data sources</div>
      <ul className="local-link-list">
        {sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MethodTags({ digest }: { digest: HomeDigest }) {
  return (
    <section className="local-card">
      <div className="local-overline">Method cues</div>
      <div className="local-tag-cloud">
        {digest.methodology.map((item) => <span key={item}>{item}</span>)}
      </div>
    </section>
  );
}

function AsciiBoard({ rows }: { rows: CompanyRecord[] }) {
  const text = rows
    .map((row, index) => `${String(index + 1).padStart(2, '0')} ${row.ticker.padEnd(5, ' ')} ${formatCompactCurrency(row.metrics.marketCap).padStart(7, ' ')} ${formatPercent(row.dividend.dividendYield).padStart(8, ' ')}`)
    .join('\n');

  return (
    <section className="local-card local-ascii-card">
      <div className="local-overline">member_table.feed</div>
      <pre>{text}</pre>
    </section>
  );
}

function DossierPanel({ row }: { row: CompanyRecord }) {
  return (
    <section className="local-card local-dossier-panel">
      <div className="local-overline">Focused company</div>
      <div className="local-dossier-header">
        <div className="local-dossier-ticker">{row.ticker}</div>
        <div>
          <h2>{row.security}</h2>
          <p>{row.sector} / {row.subIndustry}</p>
        </div>
      </div>
      <div className="local-dossier-grid">
        <StatPill label="Market cap" value={formatCompactCurrency(row.metrics.marketCap)} />
        <StatPill label="Dividend yield" value={formatPercent(row.dividend.dividendYield)} />
        <StatPill label="Forward P/E" value={row.metrics.forwardPE?.toFixed(2) ?? 'N/A'} />
        <StatPill label="Member since" value={formatDate(row.currentMemberSince)} />
      </div>
    </section>
  );
}

function TimelineBoard({ title, rows }: { title: string; rows: CompanyRecord[] }) {
  return (
    <section className="local-card">
      <div className="local-overline">{title}</div>
      <div className="local-timeline-list">
        {rows.map((row) => (
          <article key={`${title}-${row.ticker}`} className="local-timeline-item">
            <time>{formatDate(row.currentMemberSince)}</time>
            <div>
              <strong>{row.ticker}</strong>
              <p>{row.security}</p>
              <small>{row.sector}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MetroHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navItems = [
    { href: '#metro-members', label: 'Members' },
    { href: '#metro-sectors', label: 'Sectors' },
    { href: '#metro-yields', label: 'Yields' },
    { href: '#metro-about', label: 'About this site' },
  ];

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1241px)');
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsMenuOpen(false);
      }
    };

    if (mediaQuery.matches) {
      setIsMenuOpen(false);
    }

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="local-metro-header local-card">
      <div className="local-metro-brand">
        <h1>Current S&amp;P 500</h1>
      </div>
      <div className="local-metro-header-right">
        <nav className="local-metro-nav" aria-label="Metro homepage sections">
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="local-actions local-actions-compact local-metro-actions">
          <button type="button" className="local-button">Log in</button>
        </div>
      </div>
      <button
        type="button"
        className="local-metro-menu-button"
        aria-expanded={isMenuOpen}
        aria-controls="local-metro-menu"
        aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        onClick={() => setIsMenuOpen((current) => !current)}
      >
        <span />
        <span />
        <span />
      </button>
      <div id="local-metro-menu" className={`local-metro-collapsible${isMenuOpen ? ' is-open' : ''}`}>
        <nav className="local-metro-nav local-metro-nav-panel" aria-label="Collapsed metro homepage sections">
          {navItems.map((item) => (
            <a key={`${item.href}-menu`} href={item.href} onClick={closeMenu}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="local-actions local-actions-compact local-metro-menu-actions">
          <button type="button" className="local-button" onClick={closeMenu}>Log in</button>
        </div>
      </div>
    </header>
  );
}

function MetroFooter({ sources }: { sources: SnapshotData['sources'] }) {
  return (
    <footer className="local-metro-footer">
      <section id="metro-about" className="local-card local-footer-stack">
        <div>
          <div className="local-overline">About this site</div>
          <p>
            The home view focuses on current S&amp;P 500 membership, dividend coverage, and recently published membership changes.
            It is a monitoring layer, not investment advice.
          </p>
        </div>
        <div>
          <div className="local-overline">What you can verify here</div>
          <ul className="local-info-list">
            <li>Current members, sectors, market caps, yields, and current prices.</li>
            <li>Recently published joins and removals from the S&amp;P 500 change log.</li>
            <li>The latest snapshot time and the next scheduled refresh window.</li>
          </ul>
        </div>
      </section>
      <section className="local-card local-footer-stack">
        <div>
          <div className="local-overline">Important caveats</div>
          <ul className="local-info-list">
            <li>Market data can lag and may briefly show stale or missing fields.</li>
            <li>Published membership changes can appear after market hours and update separately from prices.</li>
            <li>Always verify critical numbers against the underlying publisher.</li>
          </ul>
        </div>
        <div>
          <div className="local-overline">Automation note</div>
          <p>This dashboard is generated automatically from source pages and cached fundamentals, then rebuilt for the live site.</p>
        </div>
      </section>
      <section className="local-card local-metro-sources">
        <div className="local-overline">Data sources</div>
        <ul className="local-link-list">
          {sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
            </li>
          ))}
        </ul>
      </section>
    </footer>
  );
}

function HeaderBar({ variant }: { variant: VariantDefinition }) {
  return (
    <header className="local-home-header">
      <div>
        <div className="local-overline">Local-only complete redesigns</div>
        <h2>{variant.kicker}: {variant.title}</h2>
        <p>{variant.label}</p>
      </div>
      <div className="local-actions local-actions-compact">
        <a className="local-button" href="/local-home-gallery">All concepts</a>
        <span className="local-button">{variant.layout}</span>
      </div>
    </header>
  );
}

function VariantPage({ variant, digest, members }: { variant: VariantDefinition; digest: HomeDigest; members: CompanyRecord[] }) {
  const variantClassName = [
    'local-home-shell',
    `local-layout-${variant.layout}`,
    `local-variant-${variant.id}`,
    variant.layout === 'metro' && variant.id >= 11 ? 'local-metro-palette-variant' : '',
  ].filter(Boolean).join(' ');
  const leadRow = digest.topMarketCaps[0] ?? digest.watchRows[0];
  const statBand = (
    <section className="local-stat-band">
      <StatPill label="Snapshot generated" value={digest.generatedDate} note={digest.generatedTime} />
      <StatPill label="Current members" value={digest.currentMembers} note={`${digest.candidateUniverse} tracked candidates`} />
      <StatPill label="Dividend coverage" value={digest.dividendPayers} note={`${digest.leftCount} removals in 45 days`} />
      <StatPill label="Next refresh" value={digest.nextSnapshotDate} note={digest.nextSnapshotTime} />
    </section>
  );

  let body: ReactNode;

  switch (variant.layout) {
    case 'frontpage':
      body = (
        <div className="local-frontpage-layout">
          <section className="local-card local-lead-story">
            <div className="local-overline">Lead story</div>
            <h1>S&amp;P 500 structure, changes, and leader table on one front page.</h1>
            <p>This version behaves like a newspaper. The hero is an article, the table preview is the lead scoreboard, and the rest of the homepage reads like sections of the same story.</p>
            <OpenActions />
          </section>
          {statBand}
          <div className="local-frontpage-columns">
            <CompactTable title="Largest current members" rows={digest.topMarketCaps} metricLabel="Market cap" metricValue={(row) => formatCompactCurrency(row.metrics.marketCap)} />
            <div className="local-stack">
              <ChangesRail title="Joins in the last 45 days" rows={digest.joinedRows} />
              <ChangesRail title="Removals in the last 45 days" rows={digest.leftRows} />
            </div>
          </div>
          <div className="local-frontpage-columns">
            <FunctionStrip digest={digest} />
            <SourceList sources={digest.sources} />
          </div>
        </div>
      );
      break;
    case 'terminal':
      body = (
        <div className="local-terminal-layout">
          <section className="local-card local-terminal-hero">
            <div className="local-terminal-line">boot_status: market structure monitor online</div>
            <h1>Command-centered homepage with the member table as a raw feed.</h1>
            <p>The page is intentionally dense, tactical, and machine-like. It treats constituent data like a live operator console rather than a polished marketing page.</p>
            <OpenActions />
          </section>
          {statBand}
          <div className="local-terminal-grid">
            <AsciiBoard rows={digest.topMarketCaps} />
            <CompactTable title="Highest current dividend yields" rows={digest.topYieldRows} metricLabel="Yield" metricValue={(row) => formatPercent(row.dividend.dividendYield)} />
            <FunctionStrip digest={digest} />
            <MethodTags digest={digest} />
          </div>
        </div>
      );
      break;
    case 'mosaic':
      body = (
        <div className="local-mosaic-layout">
          <section className="local-card local-poster-hero">
            <div className="local-overline">Visual-first concept</div>
            <h1>The homepage becomes a gallery of constituents.</h1>
            <p>Instead of opening with a normal dashboard block, this concept turns the homepage into a visual wall of the companies themselves.</p>
            <OpenActions />
          </section>
          <CompanyGallery title="Largest members as hero cards" rows={digest.topMarketCaps} />
          <div className="local-split-layout">
            <SectorLeaderBoard leaders={digest.sectorLeaders} />
            <ChangesRail title="Fresh membership changes" rows={digest.joinedRows} />
          </div>
          {statBand}
        </div>
      );
      break;
    case 'pinboard':
      body = (
        <div className="local-pinboard-layout">
          <section className="local-card local-pinboard-hero">
            <div className="local-overline">Research desk</div>
            <h1>Everything is pinned, annotated, and slightly chaotic on purpose.</h1>
            <p>This is the opposite of a corporate dashboard. The homepage feels like a human analyst workspace with member rows turned into sticky findings.</p>
            <OpenActions />
          </section>
          <div className="local-pinboard-grid">
            {digest.topMarketCaps.slice(0, 6).map((row, index) => (
              <article key={row.ticker} className={`local-note-card local-note-tilt-${(index % 4) + 1}`}>
                <strong>{row.ticker}</strong>
                <h3>{row.security}</h3>
                <p>{row.sector}</p>
                <small>{formatCompactCurrency(row.metrics.marketCap)} / {formatPercent(row.dividend.dividendYield)}</small>
              </article>
            ))}
          </div>
          <div className="local-split-layout">
            <CompactTable title="Newest current members" rows={digest.newestMembers} metricLabel="Member since" metricValue={(row) => formatDate(row.currentMemberSince)} />
            <SourceList sources={digest.sources} />
          </div>
        </div>
      );
      break;
    case 'metro':
      body = (
        <div className="local-metro-layout">
          <MetroHeader />
          <section className="local-stat-band local-stat-band-metro">
            <StatPill label="Current members" value={digest.currentMembers} />
            <StatPill label="Dividend payers" value={digest.dividendPayers} />
            <StatPill label="Recent joins" value={digest.joinedCount} note={summarizeChangeTickers(digest.joinedRows)} />
            <StatPill label="Recent leavers" value={digest.leftCount} note={summarizeChangeTickers(digest.leftRows)} />
            <StatPill label="Snapshot generated" value={digest.generatedDate} note={digest.generatedTime} />
            <StatPill label="Next snapshot" value={digest.nextSnapshotDate} note={digest.nextSnapshotTime} />
          </section>
          <div className="local-metro-dashboard">
            <div id="metro-members">
              <MemberDirectory rows={members} />
            </div>
            <div className="local-metro-sidegrid">
              <div id="metro-sectors">
                <SectorLeaderBoard leaders={digest.sectorLeaders} />
              </div>
              <div id="metro-yields">
                <CompactTable title="Highest-yield current S&P 500 members" rows={digest.topYieldRows} metricLabel="Yield" metricValue={(row) => formatPercent(row.dividend.dividendYield)} />
              </div>
            </div>
          </div>
          <MetroFooter sources={digest.sources} />
        </div>
      );
      break;
    case 'dossier':
      body = leadRow ? (
        <div className="local-dossier-layout">
          <section className="local-card local-dossier-hero">
            <div className="local-overline">Research explorer</div>
            <h1>The homepage acts like a dossier with one primary company in focus.</h1>
            <p>Instead of a generic hero, the landing page immediately opens on a company profile while the preview list behaves like a table navigator.</p>
            <OpenActions />
          </section>
          {statBand}
          <div className="local-dossier-split">
            <DossierPanel row={leadRow} />
            <div className="local-stack">
              <CompactTable title="Table preview" rows={digest.topMarketCaps} metricLabel="Market cap" metricValue={(row) => formatCompactCurrency(row.metrics.marketCap)} />
              <ChangesRail title="Newest entries in focus" rows={digest.joinedRows} />
            </div>
          </div>
        </div>
      ) : null;
      break;
    case 'blueprint':
      body = (
        <div className="local-blueprint-layout">
          <section className="local-card local-blueprint-hero">
            <div className="local-overline">System drawing</div>
            <h1>The homepage is an engineering diagram, not a brochure.</h1>
            <p>This design makes the system itself the aesthetic. The table preview becomes a register, the features become labeled nodes, and the whole page feels infrastructural.</p>
            <OpenActions />
          </section>
          <div className="local-blueprint-grid">
            <FunctionStrip digest={digest} />
            <CompactTable title="Leader register" rows={digest.topMarketCaps} metricLabel="Market cap" metricValue={(row) => formatCompactCurrency(row.metrics.marketCap)} />
            <SectorLeaderBoard leaders={digest.sectorLeaders} />
            <MethodTags digest={digest} />
          </div>
        </div>
      );
      break;
    case 'poster':
      body = (
        <div className="local-poster-layout">
          <section className="local-card local-launch-hero">
            <div className="local-overline">Campaign mode</div>
            <h1>Track the index like a launch product, not a spreadsheet.</h1>
            <p>This one is intentionally loud. Giant typography, ribbon tickers, and poster-level contrast carry the first screen while still embedding real rows from the member table.</p>
            <OpenActions />
          </section>
          <div className="local-ribbon-wall">
            {digest.watchRows.map((row) => (
              <article key={row.ticker} className="local-ribbon-item">
                <strong>{row.ticker}</strong>
                <span>{row.security}</span>
                <small>{formatCompactCurrency(row.metrics.marketCap)}</small>
              </article>
            ))}
          </div>
          <div className="local-split-layout">
            <CompactTable title="Poster scoreboard" rows={digest.topMarketCaps} metricLabel="Market cap" metricValue={(row) => formatCompactCurrency(row.metrics.marketCap)} />
            <ChangesRail title="Headline changes" rows={digest.leftRows} />
          </div>
        </div>
      );
      break;
    case 'timeline':
      body = (
        <div className="local-timeline-layout">
          <section className="local-card local-timeline-hero">
            <div className="local-overline">Chronology first</div>
            <h1>The homepage becomes a history of who arrived, who stayed, and what moved recently.</h1>
            <p>The table preview is no longer just rows. It is a sequence: oldest members, newest members, and the last published membership changes.</p>
            <OpenActions />
          </section>
          {statBand}
          <div className="local-split-layout">
            <TimelineBoard title="Newest current members" rows={digest.newestMembers} />
            <TimelineBoard title="Oldest current members" rows={digest.oldestMembers} />
          </div>
          <div className="local-split-layout">
            <ChangesRail title="Recent joins" rows={digest.joinedRows} />
            <ChangesRail title="Recent removals" rows={digest.leftRows} />
          </div>
        </div>
      );
      break;
    case 'zen':
      body = (
        <div className="local-zen-layout">
          <section className="local-card local-zen-hero">
            <div className="local-overline">Quiet premium</div>
            <h1>A restrained ledger that lets the data breathe.</h1>
            <p>This concept strips the page almost all the way back. It uses space, rhythm, and a narrow table preview instead of visual noise.</p>
            <OpenActions />
          </section>
          {statBand}
          <CompactTable title="Essential member ledger" rows={digest.topMarketCaps.slice(0, 6)} metricLabel="Market cap" metricValue={(row) => formatCompactCurrency(row.metrics.marketCap)} />
          <div className="local-split-layout">
            <MethodTags digest={digest} />
            <SourceList sources={digest.sources} />
          </div>
        </div>
      );
      break;
    default:
      body = null;
  }

  return <main className={variantClassName} style={toThemeStyle(variant.theme)}>{body}</main>;
}

function GalleryCard({ variant }: { variant: VariantDefinition }) {
  return (
    <article className="local-gallery-card" style={toThemeStyle(variant.theme)}>
      <div className="local-overline">{variant.kicker}</div>
      <h2>{variant.title}</h2>
      <p>{variant.description}</p>
      <div className="local-gallery-meta">
        <span>{variant.label}</span>
        <a href={`/local-home-${String(variant.id).padStart(2, '0')}`}>Open concept</a>
      </div>
    </article>
  );
}

export function LocalHomeGalleryApp({ route }: { route: LocalHomeRoute }) {
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [members, setMembers] = useState<CompanyRecord[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      fetch('/data/latest.json', { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error('Could not load the latest snapshot for local concepts.');
        return await response.json() as SnapshotData;
      }),
      fetch('/data/current-members.json', { cache: 'no-store' }).then(async (response) => {
        if (!response.ok) throw new Error('Could not load the current members dataset for local concepts.');
        const payload = await response.json() as CurrentMembersData;
        return Array.isArray(payload.currentMembers) ? payload.currentMembers : [];
      }),
    ])
      .then(([snapshotPayload, memberRows]) => {
        if (cancelled) return;
        setSnapshot(snapshotPayload);
        setMembers(memberRows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load local concepts.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const digest = useMemo(() => {
    if (!snapshot || !members) return null;
    return buildDigest(snapshot, members);
  }, [snapshot, members]);

  if (error) {
    return (
      <main className="local-gallery-shell">
        <section className="local-gallery-hero">
          <div className="local-overline">Local-only complete redesigns</div>
          <h1>Could not load the redesign gallery</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!digest) {
    return (
      <main className="local-gallery-shell">
        <section className="local-gallery-hero">
          <div className="local-overline">Local-only complete redesigns</div>
          <h1>Loading the redesign gallery…</h1>
          <p>Pulling the latest snapshot plus the full local member list so every concept can show real table content in a different form.</p>
        </section>
      </main>
    );
  }

  if (route.kind === 'variant') {
    const variant = variants.find((item) => item.id === route.id);
    if (!variant) {
      return (
        <main className="local-gallery-shell">
          <section className="local-gallery-hero">
            <div className="local-overline">Local-only complete redesigns</div>
            <h1>Concept not found</h1>
          </section>
        </main>
      );
    }

    return <VariantPage variant={variant} digest={digest} members={members ?? []} />;
  }

  return (
    <main className="local-gallery-shell">
      <section className="local-gallery-hero">
        <div className="local-overline">Local-only complete redesigns</div>
        <h1>Eleven homepage directions that are structurally different, not just visually different.</h1>
        <p>Each concept now includes a real member-table preview in a different presentation: newspaper scoreboard, terminal feed, visual card gallery, pinboard notes, route map, dossier explorer, blueprint register, poster ribbons, chronology, minimal ledger, and a Metro-plus-Poster hybrid.</p>
        <OpenActions />
      </section>
      <section className="local-stat-band local-gallery-summary">
        <StatPill label="Snapshot generated" value={digest.generatedDate} note={digest.generatedTime} />
        <StatPill label="Current members" value={digest.currentMembers} note={`${digest.candidateUniverse} tracked candidates`} />
        <StatPill label="Dividend payers" value={digest.dividendPayers} note={`${digest.joinedCount} additions in 45 days`} />
        <StatPill label="Next refresh" value={digest.nextSnapshotDate} note={digest.nextSnapshotTime} />
      </section>
      <section className="local-gallery-grid">
        {variants.map((variant) => <GalleryCard key={variant.id} variant={variant} />)}
      </section>
    </main>
  );
}