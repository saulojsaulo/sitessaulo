export interface Ga4Kpis {
  sessions: number;
  activeUsers: number;
  newUsers: number;
  screenPageViews: number;
  engagementRate: number;
  averageSessionDuration: number;
  bounceRate: number;
  eventCount: number;
}

export interface Ga4Named {
  name: string;
  sessions: number;
}

export interface Ga4Page {
  pagePath: string;
  title: string;
  views: number;
  users: number;
  avgDuration: number;
  engagementRate: number;
}

export interface Ga4Gainer {
  pagePath: string;
  title: string;
  views: number;
  prevViews: number;
  delta: number;
}

export interface Ga4PropertyReport {
  kpis: Ga4Kpis;
  prevKpis: Ga4Kpis;
  timeseries: { date: string; sessions: number; users: number; views: number }[];
  pages: Ga4Page[];
  landingPages: { pagePath: string; sessions: number; engagementRate: number }[];
  sources: Ga4Named[];
  channels: Ga4Named[];
  devices: Ga4Named[];
  countries: Ga4Named[];
  cities: Ga4Named[];
  hours: { hour: string; sessions: number }[];
  weekdays: { day: string; sessions: number }[];
  newVsReturning: Ga4Named[];
  gainers: Ga4Gainer[];
  decliners: Ga4Gainer[];
}

export interface Ga4Realtime {
  activeUsers: number;
  pages: { pagePath: string; activeUsers: number }[];
  countries: { name: string; activeUsers: number }[];
  devices: { name: string; activeUsers: number }[];
  minutes: { minutesAgo: number; activeUsers: number }[];
}

export interface Ga4BlogSummary {
  propertyId: string;
  ok: boolean;
  error?: string;
  kpis: Ga4Kpis;
  prevKpis: Ga4Kpis;
  activeNow: number;
  timeseries: { date: string; sessions: number }[];
  topPages: { pagePath: string; title: string; views: number }[];
}

export const ZERO_KPIS: Ga4Kpis = {
  sessions: 0,
  activeUsers: 0,
  newUsers: 0,
  screenPageViews: 0,
  engagementRate: 0,
  averageSessionDuration: 0,
  bounceRate: 0,
  eventCount: 0,
};

export const pctDelta = (curr: number, prev: number) =>
  prev > 0 ? (curr - prev) / prev : curr > 0 ? 1 : 0;
