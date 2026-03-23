import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  Activity, Users, Vote, TrendingUp, MapPin, RefreshCw, Clock
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const COLORS = ['#1e3a5f', '#3b82f6', '#16a34a', '#f59e0b', '#dc2626', '#6366f1', '#ec4899', '#14b8a6'];

const Analytics = () => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API}/api/v1/monitor/analytics`);
      if (res.ok) {
        setData(await res.json());
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.warn('Analytics fetch failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 20000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw size={28} className="animate-spin text-dash-primary" />
      </div>
    );
  }

  const stats = data?.voterStats;
  const constituencies = data?.constituencyBreakdown || [];
  const candidates = data?.candidateStats || [];

  const constituencyChartData = constituencies.map(c => ({
    name: c.constituency,
    totalVoters: parseInt(c.total_voters),
    votesCast: parseInt(c.votes_cast),
    state: c.state,
  }));

  const partyMap = {};
  candidates.forEach(c => {
    partyMap[c.party] = (partyMap[c.party] || 0) + parseInt(c.vote_count || 0);
  });
  const partyData = Object.entries(partyMap).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-5 animate-fade-in">

      {/* HEADER */}
      <div className="rounded-b-2xl bg-[#5B4DB1] px-6 py-5 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em]">ANALYTICS</p>
            <h2 className="text-2xl font-bold mt-2">{t('analytics.title')}</h2>
            <p className="text-sm text-white/80 mt-2">{t('analytics.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-white/80 flex items-center gap-1">
                <Clock size={12} /> {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchAnalytics}
              className="inline-flex items-center gap-2 rounded-md bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-200 transition"
            >
              <RefreshCw size={14} /> {t('analytics.refresh')}
            </button>
          </div>
        </div>
        <div className="mt-4 text-xs text-white/70">
          Dashboard / Analytics
        </div>
      </div>

      {/* OVERVIEW STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-blue-300 bg-blue-100 p-4">
          <div className="w-10 h-10 rounded-lg bg-blue-200 flex items-center justify-center text-blue-700 mb-3">
            <Users size={20} />
          </div>
          <p className="text-2xl font-bold text-dash-text">{stats?.totalVoters ?? 0}</p>
          <p className="text-xs font-medium text-dash-text-secondary mt-1">{t('analytics.registeredVoters')}</p>
        </div>

        <div className="rounded-xl border border-green-300 bg-green-100 p-4">
          <div className="w-10 h-10 rounded-lg bg-green-200 flex items-center justify-center text-green-700 mb-3">
            <Vote size={20} />
          </div>
          <p className="text-2xl font-bold text-dash-text">{stats?.votesCast ?? 0}</p>
          <p className="text-xs font-medium text-dash-text-secondary mt-1">{t('analytics.votesCast')}</p>
        </div>

        <div className="rounded-xl border border-yellow-300 bg-yellow-100 p-4">
          <div className="w-10 h-10 rounded-lg bg-yellow-200 flex items-center justify-center text-yellow-700 mb-3">
            <TrendingUp size={20} />
          </div>
          <p className="text-2xl font-bold text-dash-text">{stats?.turnoutPercentage ?? 0}%</p>
          <p className="text-xs font-medium text-dash-text-secondary mt-1">{t('analytics.turnout')}</p>
        </div>

        <div className="rounded-xl border border-red-300 bg-red-100 p-4">
          <div className="w-10 h-10 rounded-lg bg-red-200 flex items-center justify-center text-red-700 mb-3">
            <Activity size={20} />
          </div>
          <p className="text-2xl font-bold text-dash-text">{stats?.pendingVoters ?? 0}</p>
          <p className="text-xs font-medium text-dash-text-secondary mt-1">{t('analytics.pendingVoters')}</p>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="grid lg:grid-cols-2 gap-5">

        {/* Constituency Breakdown */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-blue-100">
            <MapPin size={18} className="text-dash-primary" />
            <h3 className="font-bold text-dash-text text-sm">{t('analytics.constituencyBreakdown')}</h3>
          </div>
          {constituencyChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={constituencyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                  <Bar dataKey="totalVoters" name={t('analytics.registered')} fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="votesCast" name={t('analytics.voted')} fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-dash-text-secondary py-8 text-center">{t('analytics.noConstituencyData')}</p>
          )}
        </div>

        {/* Party Vote Share */}
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-purple-100">
            <Vote size={18} className="text-dash-primary" />
            <h3 className="font-bold text-dash-text text-sm">{t('analytics.partyVoteShare')}</h3>
          </div>
          {partyData.length > 0 && partyData.some(p => p.value > 0) ? (
            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={partyData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                    {partyData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-dash-text-secondary py-8 text-center">{t('analytics.noVotesYet')}</p>
          )}
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4">
            {partyData.map((p, i) => (
              <span key={p.name} className="flex items-center gap-1.5 text-xs text-dash-text-secondary">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {p.name} ({p.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* CANDIDATE TABLE */}
      <div className="rounded-xl border border-green-200 bg-green-50 overflow-hidden">
        <div className="p-5 border-b border-green-200 bg-green-200">
          <h3 className="font-bold text-dash-text text-sm">{t('analytics.candidatePerformance')}</h3>
          <p className="text-xs text-dash-text-secondary mt-1">{t('analytics.candidateBreakdown')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-green-200 border-b border-green-200">
                <th className="text-left px-5 py-3 text-xs font-bold text-dash-text uppercase tracking-wider">{t('analytics.candidate')}</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-dash-text uppercase tracking-wider">{t('analytics.party')}</th>
                <th className="text-left px-5 py-3 text-xs font-bold text-dash-text uppercase tracking-wider">{t('analytics.constituency')}</th>
                <th className="text-right px-5 py-3 text-xs font-bold text-dash-text uppercase tracking-wider">{t('analytics.votes')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-green-200">
              {candidates.length > 0 ? candidates.map((c, i) => (
                <tr key={i} className={`${i % 2 === 0 ? 'bg-white/60' : ''} hover:bg-green-100 transition-colors`}>
                  <td className="px-5 py-3 font-semibold text-dash-text">{c.name}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                      c.party === 'BJP'
                        ? 'bg-orange-100 text-orange-700'
                        : c.party === 'AAP'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-white/60 text-slate-700'
                    }`}>
                      {c.party}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-dash-text-secondary">{c.constituency}</td>
                  <td className="px-5 py-3 text-right font-bold text-dash-text">{c.vote_count}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-dash-text-secondary">{t('analytics.noCandidateData')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* HOURLY VOTE TIMELINE */}
      {data?.hourlyVotes && data.hourlyVotes.some(h => h.votes > 0) && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-indigo-100">
            <Clock size={18} className="text-dash-primary" />
            <h3 className="font-bold text-dash-text text-sm">{t('analytics.votingTimeline')}</h3>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.hourlyVotes} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="voteGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                <Area type="monotone" dataKey="votes" stroke="#1e3a5f" fill="url(#voteGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
