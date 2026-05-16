import React, { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { StatsData, RecentGameStat } from '../types';
import EmptyState from '../components/common/EmptyState';
import Skeleton from '../components/common/Skeleton';
import GlassCard from '../components/common/GlassCard';
import StatCard from '../components/common/StatCard';
import GamePoster from '../components/common/GamePoster';
import { getFileUrl } from '../utils/fileUtils';
import {
  BarChart3, Clock, Gamepad2, Calendar, ChevronLeft,
  TrendingUp, Trophy, Zap, Target, Flame, BarChart2,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  AreaChart, Area, CartesianGrid, Cell,
} from 'recharts';

interface StatsProps { onBack: () => void; }

const fmtHours = (sec: number) => {
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const tooltipStyle = {
  background: '#0c0e12',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  fontSize: 12,
};

// ── KPI accent palette ─────────────────────────────────────────
const KPI_COLORS = {
  teal:   'var(--accent)',
  blue:   '#60a5fa',
  violet: '#a78bfa',
  amber:  '#fbbf24',
  rose:   '#f472b6',
  green:  '#4ade80',
};

// ── Chart section wrapper ──────────────────────────────────────
const ChartCard: React.FC<{
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <GlassCard style={{ padding: 28 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      {icon && (
        <div style={{
          width: 30, height: 30, borderRadius: 8, background: 'rgba(var(--accent-rgb),0.12)',
          border: '1px solid rgba(var(--accent-rgb),0.2)', display: 'grid', placeItems: 'center',
          color: 'var(--accent)', flexShrink: 0,
        }}>
          {icon}
        </div>
      )}
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.2px' }}>
        {title}
      </h3>
    </div>
    {children}
  </GlassCard>
);

// ── Insight pill ───────────────────────────────────────────────
const InsightPill: React.FC<{ icon: React.ReactNode; text: string; color: string }> = ({ icon, text, color }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '8px 16px', borderRadius: 999,
    background: `color-mix(in srgb, ${color} 10%, transparent)`,
    border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
    fontSize: 13, fontWeight: 600, color: '#fff', flexShrink: 0,
  }}>
    <span style={{ color }}>{icon}</span>
    {text}
  </div>
);

// ── Main page ──────────────────────────────────────────────────
const Stats: React.FC<StatsProps> = ({ onBack }) => {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stats = await invoke<StatsData>('get_stats_data');
        setData({
          ...stats,
          playtime_by_calendar_day: stats.playtime_by_calendar_day ?? [],
          weekly_playtime_trend:    stats.weekly_playtime_trend    ?? [],
          monthly_playtime_trend:   stats.monthly_playtime_trend   ?? [],
          top_genres:               stats.top_genres               ?? [],
          top_developers:           stats.top_developers           ?? [],
          recently_played:          stats.recently_played          ?? [],
        });
      } catch (e) { console.error('Failed to load stats', e); }
      finally { setLoading(false); }
    })();
  }, []);

  const heatmapData = useMemo(() =>
    (data?.playtime_by_calendar_day ?? []).slice(-120).map(d => ({
      ...d, label: d.date.slice(5), hours: d.seconds / 3600,
    })), [data]);

  const weeklyBars = useMemo(() =>
    (data?.weekly_playtime_trend ?? []).map(w => ({
      ...w, label: w.week_start, hours: w.seconds / 3600,
    })), [data]);

  const monthlyAreas = useMemo(() =>
    (data?.monthly_playtime_trend ?? []).map(m => ({ ...m, hours: m.seconds / 3600 })),
    [data]);

  const topGamesChart = useMemo(() =>
    (data?.top_games ?? []).slice(0, 8).map(g => ({
      name: g.title.length > 18 ? `${g.title.slice(0, 18)}…` : g.title,
      full: g.title,
      hours: g.playtime_seconds / 3600,
    })), [data]);

  // Auto-generated insights
  const insights = useMemo(() => {
    if (!data) return [];
    const list: { icon: React.ReactNode; text: string; color: string }[] = [];
    if (data.top_games?.[0])
      list.push({ icon: <Trophy size={14} />, text: `Top game: ${data.top_games[0].title.split(' ').slice(0, 3).join(' ')}`, color: KPI_COLORS.amber });
    if (data.top_genres?.[0])
      list.push({ icon: <Flame size={14} />, text: `Fav genre: ${data.top_genres[0].label}`, color: KPI_COLORS.rose });
    if (data.average_session_minutes >= 60)
      list.push({ icon: <Zap size={14} />, text: `Long sessions: avg ${Math.round(data.average_session_minutes / 60)}h`, color: KPI_COLORS.violet });
    else if (data.average_session_minutes > 0)
      list.push({ icon: <Zap size={14} />, text: `Avg session: ${data.average_session_minutes}m`, color: KPI_COLORS.violet });
    if (data.weekly_playtime_seconds > 0)
      list.push({ icon: <TrendingUp size={14} />, text: `This week: ${fmtHours(data.weekly_playtime_seconds)}`, color: KPI_COLORS.green });
    return list;
  }, [data]);

  const isEmpty = data &&
    data.total_playtime_seconds === 0 &&
    data.total_sessions === 0 &&
    (data.top_games?.length ?? 0) === 0;

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="premium-page">
        <AnalyticsHeader onBack={onBack} />
        <div className="premium-page-content stats-page-content">
          <div className="stats-kpi-grid">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="premium-card">
                <Skeleton width="40%" height={11} variant="text" style={{ marginBottom: 10 }} />
                <Skeleton width="65%" height={30} variant="text" />
              </div>
            ))}
          </div>
          <div className="stats-two-col">
            <Skeleton width="100%" height={300} variant="rect" style={{ borderRadius: 20 }} />
            <Skeleton width="100%" height={300} variant="rect" style={{ borderRadius: 20 }} />
          </div>
        </div>
      </div>
    );
  }

  if (!data || isEmpty) {
    return (
      <div className="premium-page">
        <AnalyticsHeader onBack={onBack} />
        <div className="premium-page-content stats-page-content">
          <GlassCard style={{ padding: '100px 20px', textAlign: 'center' }}>
            <EmptyState icon="📊" title="No stats yet" description="Play some games to unlock your analytics dashboard." />
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-page">
      <AnalyticsHeader onBack={onBack} />

      <div className="premium-page-content stats-page-content">

        {/* ── Page title + insights ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 16 }}>
            <h1 className="stats-page-title" style={{ margin: 0 }}>Analytics</h1>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', fontWeight: 600 }}>
              Playtime, sessions &amp; library insights
            </span>
          </div>
          {insights.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {insights.map((ins, i) => (
                <InsightPill key={i} {...ins} />
              ))}
            </div>
          )}
        </div>

        {/* ── KPI row ── */}
        <div className="stats-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(175px,1fr))' }}>
          <StatCard
            label="Total playtime"
            value={fmtHours(data.total_playtime_seconds)}
            icon={Clock}
            accentColor={KPI_COLORS.teal}
            sub={`${data.total_sessions} sessions total`}
          />
          <StatCard
            label="Total sessions"
            value={data.total_sessions}
            icon={Gamepad2}
            accentColor={KPI_COLORS.blue}
          />
          <StatCard
            label="Avg session"
            value={data.average_session_minutes >= 60
              ? `${(data.average_session_minutes / 60).toFixed(1)}h`
              : `${data.average_session_minutes}m`}
            icon={BarChart3}
            accentColor={KPI_COLORS.violet}
          />
          <StatCard
            label="This week"
            value={fmtHours(data.weekly_playtime_seconds)}
            icon={Calendar}
            accentColor={KPI_COLORS.amber}
          />
          <StatCard
            label="This month"
            value={fmtHours(data.monthly_playtime_seconds)}
            icon={TrendingUp}
            accentColor={KPI_COLORS.rose}
          />
          <StatCard
            label="Most played"
            value={data.top_games?.[0]?.title?.split(' ')[0] ?? '—'}
            icon={Trophy}
            accentColor={KPI_COLORS.green}
            sub={data.top_games?.[0] ? fmtHours(data.top_games[0].playtime_seconds) : undefined}
          />
        </div>

        {/* ── Sessions + Weekly trend ── */}
        <div className="stats-two-col">
          <ChartCard title="Sessions this week" icon={<BarChart3 size={14} />}>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.sessions_by_day}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} stroke="transparent"
                    tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} stroke="transparent" allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="session_count" radius={[6, 6, 0, 0]} name="Sessions" fill="var(--accent)"
                    style={{ filter: 'drop-shadow(0 0 6px rgba(var(--accent-rgb),0.4))' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Weekly playtime trend" icon={<TrendingUp size={14} />}>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 9 }} stroke="transparent"
                    interval={0} angle={-25} textAnchor="end" height={48} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} stroke="transparent" />
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={v => [`${Number(v).toFixed(1)}h`, 'Playtime']}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                    {weeklyBars.map((_, i) => (
                      <Cell key={i}
                        fill={i === weeklyBars.length - 1 ? '#60a5fa' : 'var(--accent)'}
                        style={{ filter: 'drop-shadow(0 0 4px rgba(var(--accent-rgb),0.3))' }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* ── Monthly + Heatmap ── */}
        <div className="stats-two-col">
          <ChartCard title="Monthly playtime" icon={<BarChart2 size={14} />}>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyAreas}>
                  <defs>
                    <linearGradient id="mplay" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="var(--accent)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} stroke="transparent" />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} stroke="transparent" />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => [`${Number(v).toFixed(1)}h`, 'Playtime']}
                    cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                  <Area type="monotone" dataKey="hours" stroke="var(--accent-hover, #2a7d72)"
                    fill="url(#mplay)" strokeWidth={2.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Daily heatmap — last 120 days" icon={<Target size={14} />}>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={heatmapData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 9 }} stroke="transparent" interval={6} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} stroke="transparent" />
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={v => [`${Number(v).toFixed(2)}h`, 'Playtime']}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="hours" fill="#4ade80" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        {/* ── Most played + Recent ── */}
        <div className="stats-two-col">
          <ChartCard title="Most played games" icon={<Trophy size={14} />}>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topGamesChart} layout="vertical" margin={{ left: 8, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} stroke="transparent" />
                  <YAxis type="category" dataKey="name" width={108}
                    tick={{ fill: '#e5e7eb', fontSize: 11 }} stroke="transparent" />
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={(v, _n, p) => [`${Number(v).toFixed(1)}h`, (p?.payload as { full?: string })?.full ?? 'Game']}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="hours" fill="var(--accent)" radius={[0, 6, 6, 0]}
                    style={{ filter: 'drop-shadow(0 0 4px rgba(var(--accent-rgb),0.35))' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Recently played" icon={<Flame size={14} />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(data.recently_played ?? []).slice(0, 6).map((g: RecentGameStat, i) => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(255,255,255,0.05)',
                    display: 'grid', placeItems: 'center',
                    fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.3)',
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 8, overflow: 'hidden' }}>
                    <GamePoster src={getFileUrl(g.cover_url)} title={g.title}
                      variant="thumbnail" style={{ borderRadius: 8, width: 44, height: 44 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: 13,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {g.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>
                      {fmtHours(g.seconds)}
                    </div>
                  </div>
                  {/* Relative bar */}
                  <div style={{ width: 60, flexShrink: 0 }}>
                    <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                      <div style={{
                        height: '100%', borderRadius: 2, background: 'var(--accent)',
                        width: `${Math.round((g.seconds / ((data.recently_played?.[0]?.seconds) || 1)) * 100)}%`,
                      }} />
                    </div>
                  </div>
                </div>
              ))}
              {(!data.recently_played || data.recently_played.length === 0) && (
                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 24, margin: 0 }}>
                  No recent plays recorded
                </p>
              )}
            </div>
          </ChartCard>
        </div>

        {/* ── Genres + Developers ── */}
        {((data.top_genres?.length ?? 0) > 0 || (data.top_developers?.length ?? 0) > 0) && (
          <div className="stats-two-col">
            {(data.top_genres?.length ?? 0) > 0 && (
              <ChartCard title="Top genres" icon={<BarChart3 size={14} />}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(data.top_genres ?? []).slice(0, 8).map(g => {
                    const max = Math.max(...(data.top_genres ?? []).map(x => x.seconds), 1);
                    const pct = Math.round((g.seconds / max) * 100);
                    return (
                      <div key={g.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{g.label}</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>{fmtHours(g.seconds)}</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`,
                            background: 'var(--accent)', transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ChartCard>
            )}
            {(data.top_developers?.length ?? 0) > 0 && (
              <ChartCard title="Top developers" icon={<Target size={14} />}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(data.top_developers ?? []).slice(0, 8).map(g => {
                    const max = Math.max(...(data.top_developers ?? []).map(x => x.seconds), 1);
                    const pct = Math.round((g.seconds / max) * 100);
                    return (
                      <div key={g.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{g.label}</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>{fmtHours(g.seconds)}</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`,
                            background: '#60a5fa', transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ChartCard>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

// ── Shared page header ─────────────────────────────────────────
const AnalyticsHeader: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="top-nav">
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: 32, gap: 14 }}>
      <button type="button" className="stats-back-btn" onClick={onBack}>
        <ChevronLeft size={16} /> Back
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: 'rgba(var(--accent-rgb),0.13)',
          border: '1px solid rgba(var(--accent-rgb),0.24)',
          display: 'grid', placeItems: 'center', color: 'var(--accent)',
        }}>
          <BarChart3 size={16} />
        </div>
        <span style={{ fontWeight: 800, fontSize: 15 }}>Analytics</span>
      </div>
    </div>
  </div>
);

export default Stats;
