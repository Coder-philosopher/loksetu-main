import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  UserPlus, MapPin, Shield, Server,
  ArrowRight, Users, Vote, AlertTriangle,
  Database, Radio, Globe, Clock, BarChart3,
  ShieldCheck, Brain, Eye, CheckCircle2, FileText
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const voterTurnoutData = [
  { name: 'Voted', value: 65.8, color: '#1e3a5f' },
  { name: 'Missing', value: 34.2, color: '#e2e8f0' },
];

const fraudTrendData = [
  { time: '00:00', alerts: 2 }, { time: '04:00', alerts: 1 },
  { time: '08:00', alerts: 5 }, { time: '12:00', alerts: 8 },
  { time: '16:00', alerts: 12 }, { time: '20:00', alerts: 6 },
  { time: '23:59', alerts: 3 },
];

const Dashboard = () => {
  const { t } = useTranslation();
  const [liveStats, setLiveStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [fraudStats, setFraudStats] = useState(null);
  const [auditLog, setAuditLog] = useState(null);
  const [fraudTrend, setFraudTrend] = useState(fraudTrendData);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [analyticsRes, healthRes, fraudRes, auditRes, trendRes] = await Promise.all([
          fetch(`${API}/api/v1/monitor/analytics`),
          fetch(`${API}/api/v1/monitor/health`),
          fetch(`${API}/api/v1/monitor/fraud/stats`),
          fetch(`${API}/api/v1/monitor/audit-log`),
          fetch(`${API}/api/v1/monitor/fraud/trend`),
        ]);
        if (analyticsRes.ok) setLiveStats(await analyticsRes.json());
        if (healthRes.ok) setHealth(await healthRes.json());
        if (fraudRes.ok) setFraudStats(await fraudRes.json());
        if (auditRes.ok) setAuditLog(await auditRes.json());
        if (trendRes.ok) {
          const trendData = await trendRes.json();
          if (trendData.trend?.length > 0) setFraudTrend(trendData.trend);
        }
      } catch (e) {
        console.warn('Dashboard stats fetch failed:', e);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  const stats = liveStats?.voterStats;
  const turnoutValue = typeof stats?.turnoutRate === 'number'
    ? `${stats.turnoutRate.toFixed(1)}%`
    : (stats?.turnoutRate ?? liveStats?.turnoutRate ?? '—');
  const lastUpdatedLabel = liveStats?.timestamp
    ? new Date(liveStats.timestamp).toLocaleTimeString()
    : health?.timestamp
      ? new Date(health.timestamp).toLocaleTimeString()
      : fraudStats?.timestamp
        ? new Date(fraudStats.timestamp).toLocaleTimeString()
        : '—';
  const activityFeed = auditLog?.activityFeed ?? [];
  const recentActivity = auditLog?.recentActivity ?? [];
  const compactActivityFeed = useMemo(() => {
    if (!activityFeed.length) return [];
    const groups = [];
    const map = new Map();
    activityFeed.forEach((item) => {
      const key = `${item.type || 'event'}-${item.label || ''}`;
      if (!map.has(key)) {
        const entry = { ...item, count: 1 };
        map.set(key, entry);
        groups.push(entry);
      } else {
        map.get(key).count += 1;
      }
    });
    return groups.slice(0, 5);
  }, [activityFeed]);
  const recentRegistrations24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const sources = [
      ...(auditLog?.activityFeed ?? []),
      ...(auditLog?.recentActivity ?? []),
    ];
    return sources.filter((item) => {
      const type = item?.type || item?.event || '';
      const isRegistration = type === 'voter_registered' || type === 'registration';
      if (!isRegistration) return false;
      const timestamp = item?.created_at || item?.createdAt || item?.timestamp || item?.time;
      const parsed = Date.parse(timestamp);
      return Number.isFinite(parsed) && parsed >= cutoff;
    }).length;
  }, [auditLog]);

  // Build constituency chart data from live analytics
  const constituencyChartData = useMemo(() => {
    if (!liveStats?.constituencyBreakdown) return [];
    return liveStats.constituencyBreakdown.slice(0, 8).map((c) => ({
      name: c.constituency?.length > 12 ? c.constituency.slice(0, 12) + '…' : c.constituency,
      voters: parseInt(c.total_voters) || 0,
      voted: parseInt(c.votes_cast) || 0,
    }));
  }, [liveStats]);


  // Service icon mapping
  const serviceIcons = { database: Database, gateway: Globe, kafka: Radio, fraudEngine: Brain, faceVerification: ShieldCheck };
  const statusColor = (s) => s === 'healthy' ? 'text-dash-success' : s === 'degraded' ? 'text-dash-warning' : s === 'offline' ? 'text-slate-400' : 'text-dash-danger';
  const statusBg = (s) => s === 'healthy' ? 'bg-[#E6F7EF] border-emerald-200' : s === 'degraded' ? 'bg-[#FFF7E6] border-amber-200' : s === 'offline' ? 'bg-[#F3F0FF] border-purple-200' : 'bg-[#FFECEC] border-red-200';
  const statusDot = (s) => s === 'healthy' ? 'bg-dash-success' : s === 'degraded' ? 'bg-dash-warning' : s === 'offline' ? 'bg-slate-400' : 'bg-dash-danger';

  return (
    <div className="space-y-6 animate-fade-in bg-[#F3F0FF] text-[#1e3a5f] font-sans">
      {/* SUMMARY */}
      <div className="hero bg-[#F3F0FF] border border-[#E6DFFB] rounded-xl shadow-sm overflow-hidden">
        <div className="bg-[#5B4DB1] px-5 py-4 text-white rounded-b-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-wider">GOVERNMENT ELECTION PORTAL</p>
          <p className="text-xs text-white/80 mt-1">Secure Digital Voting Platform</p>
        </div>
        <div className="p-5 max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#1e3a5f]">
            {t('dashboard.welcome', 'Welcome to LokSetu Admin')}
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            {t('dashboard.welcomeDesc', 'Manage voter registration, monitor election integrity, and track real-time analytics — all secured by blockchain.')}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/registration-requests" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition">
              <UserPlus size={16} /> Registration Requests
            </Link>
            <Link to="/election-setup" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition">
              <CheckCircle2 size={16} /> Election Setup
            </Link>
            <Link to="/fraud" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition">
              <Shield size={16} /> Fraud Monitor
            </Link>
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Users, label: t('dashboard.totalVoters'), value: stats?.totalVoters ?? '—', valueColor: 'text-[#1e3a5f]', cardBg: 'bg-[#E6F0FF]', iconBg: 'bg-[#D9E8FF]' },
              { icon: UserPlus, label: t('dashboard.recentRegistrations', 'Recent Registrations (24h)'), value: recentRegistrations24h, valueColor: 'text-emerald-700', cardBg: 'bg-[#E6F7EF]', iconBg: 'bg-[#D5F1E3]' },
              { icon: AlertTriangle, label: t('dashboard.fraudAlerts'), value: fraudStats?.total ?? liveStats?.fraudStats?.total ?? '—', valueColor: 'text-red-700', cardBg: 'bg-[#FFECEC]', iconBg: 'bg-[#FFDCDC]' },
              { icon: Vote, label: t('dashboard.turnout', 'Turnout %'), value: turnoutValue, valueColor: 'text-[#5B4DB1]', cardBg: 'bg-[#F3F0FF]', iconBg: 'bg-[#E6DFFB]' },
            ].map(({ icon: Icon, label, value, valueColor, cardBg, iconBg }) => (
              <div key={label} className={`stats-card px-4 py-4 flex items-center gap-3 border border-slate-200 rounded-xl ${cardBg} shadow-sm transition`}>
                <div className={`w-9 h-9 rounded-full ${iconBg} border border-slate-200 text-slate-700 flex items-center justify-center`}>
                  <Icon size={18} />
                </div>
                <div>
                  <div className={`text-lg font-bold ${valueColor}`}>{value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

        {/* BLOCKCHAIN RECORDS */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-900">{t('dashboard.blockchainTx', 'Blockchain Records')}</h2>
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] font-semibold text-slate-500">{stats?.votesCast ?? 0} {t('dashboard.recorded')}</span>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-none">
            <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Name</th>
                    <th className="text-left px-3 py-2 font-semibold">Constituency</th>
                    <th className="text-left px-3 py-2 font-semibold">ID</th>
                    <th className="text-left px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.filter((v) => v.has_voted).slice(0, 10).map((tx, i) => (
                    <tr key={i} className="border-t border-slate-200 hover:bg-slate-50 transition">
                      <td className="px-3 py-2 font-semibold text-slate-900 truncate">{tx.full_name}</td>
                      <td className="px-3 py-2 text-slate-600 truncate">{tx.constituency}</td>
                      <td className="px-3 py-2 text-slate-500">{tx.epic_id}</td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">{t('dashboard.onChain')}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!recentActivity.filter((v) => v.has_voted).length && (
                <div className="py-6 text-center text-slate-500 text-xs">{t('dashboard.noBlockchainTx')}</div>
              )}
            </div>
          </div>
        </div>

      {/* ECI STYLE BLOCKS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="updates updates-card bg-[#E6F7EF] border border-emerald-200 rounded-xl p-5 shadow-sm transition">
          <h2 className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Updates</h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <CheckCircle2 size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800">Election Conduction</div>
                <div className="text-[11px] text-slate-600">Manage and monitor election processes and schedules.</div>
                <Link to="/election-setup" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 mt-2">
                  Go to Election Setup <ArrowRight size={12} />
                </Link>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <BarChart3 size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800">Live Results</div>
                <div className="text-[11px] text-slate-600">View real-time election results and constituency data.</div>
                <Link to="/live-results" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 mt-2">
                  View Results <ArrowRight size={12} />
                </Link>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <FileText size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800">View Report</div>
                <div className="text-[11px] text-slate-600">Access election reports and analytics insights.</div>
                <Link to="/analytics" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 mt-2">
                  View Report <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="about about-card bg-[#F3F0FF] border border-purple-200 rounded-xl p-5 shadow-sm transition">
          <h2 className="text-xs font-semibold text-[#5B4DB1] uppercase tracking-wider">About LokSetu</h2>
          <p className="text-sm text-gray-600 mt-3">
            LokSetu is a secure digital election platform designed to manage voter registration, ensure election transparency, and provide real-time analytics using blockchain technology.
          </p>
          <ul className="mt-3 space-y-1 text-[11px] text-gray-600">
            <li>Secure voter identity verification</li>
            <li>Transparent election monitoring</li>
            <li>Fraud detection using AI</li>
            <li>Real-time result tracking</li>
          </ul>
          <Link to="/about" className="inline-flex items-center gap-1 text-xs font-semibold text-[#5B4DB1] mt-3">
            Learn More <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* SYSTEM HEALTH */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-900">{t('dashboard.systemHealth', 'System Health')}</h2>
          <div className="h-px flex-1 bg-slate-200" />
          {health && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${health.status === 'healthy' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {health.status === 'healthy' ? t('dashboard.allOnline', 'All Systems Online') : t('dashboard.degraded', 'Partial Degradation')}
            </span>
          )}
        </div>
        {health && (
          <div className="bg-[#E6F7EF] border border-emerald-200 rounded-xl p-5 shadow-sm">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(health.services).map(([name, info]) => {
                const SvcIcon = serviceIcons[name] || Server;
                const displayName = name === 'fraudEngine' ? t('dashboard.aiFraudEngine') : name === 'faceVerification' ? t('dashboard.faceVerify') : name;
                return (
                  <div key={name} className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${statusBg(info.status)}`}>
                    <div className="relative">
                      <SvcIcon size={18} className={statusColor(info.status)} />
                      <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${statusDot(info.status)} ring-2 ring-white`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 capitalize">{displayName}</p>
                      <p className="text-[10px] text-slate-600">
                        {info.latencyMs > 0 ? `${info.latencyMs}ms` : info.engines ? `${info.engines} engines active` : info.status === 'offline' ? t('dashboard.optional') : info.status}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-emerald-200 flex items-center gap-2 text-[10px] text-slate-600">
              <Clock size={12} />
              <span>{t('dashboard.uptime')}: {typeof health.uptime === 'number' ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m` : health.uptime}</span>
            </div>
          </div>
        )}
      </div>

      {/* ANALYTICS OVERVIEW */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-slate-900">{t('dashboard.analyticsOverview', 'Analytics Overview')}</h2>
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Real-time constituency data</span>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-none">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={16} className="text-red-600" />
              <h3 className="text-sm font-bold text-slate-900">{t('dashboard.fraudActivity', 'Fraud Activity (24h)')}</h3>
              {fraudStats && (
                <span className="ml-auto text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">{fraudStats.total} total</span>
              )}
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fraudTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fraudGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                  <Area type="monotone" dataKey="alerts" stroke="#dc2626" fill="url(#fraudGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-none">
            <div className="flex items-center gap-2 mb-3">
              <Vote size={16} className="text-slate-700" />
              <h3 className="text-sm font-bold text-slate-900">{t('dashboard.voterGap', 'Voter Turnout')}</h3>
            </div>
            <div className="h-56 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={voterTurnoutData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                    {voterTurnoutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <span className="block text-2xl font-bold text-slate-900">65.8%</span>
                  <span className="text-[10px] uppercase text-slate-500 font-semibold">{t('dashboard.turnout')}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-slate-600"><span className="w-2 h-2 rounded-full bg-dash-primary" /> {t('dashboard.voted')}</span>
              <span className="flex items-center gap-1.5 text-xs text-slate-600"><span className="w-2 h-2 rounded-full bg-slate-200" /> {t('dashboard.missing')}</span>
            </div>
          </div>

        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-none">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={16} className="text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">{t('dashboard.constituencyTurnout', 'Voter Turnout by Constituency')}</h3>
            <span className="ml-auto text-[10px] text-slate-500">{constituencyChartData.length} {t('dashboard.constituencies')}</span>
          </div>
          {constituencyChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={constituencyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} angle={-20} textAnchor="end" height={50} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                  <Bar dataKey="voters" name={t('dashboard.totalVotersChart')} fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="voted" name={t('dashboard.votesCastChart')} fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-16">{t('common.noData', 'No constituency data available')}</p>
          )}
          <div className="flex justify-center gap-6 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-600"><span className="w-2 h-2 rounded-full bg-slate-300" /> {t('dashboard.registered')}</span>
            <span className="flex items-center gap-1.5 text-xs text-slate-600"><span className="w-2 h-2 rounded-full bg-dash-primary" /> {t('dashboard.voted')}</span>
          </div>
        </div>
      </div>

      {/* ACTIVITY FEED */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-slate-900">{t('dashboard.activityFeed', 'Election Activity')}</h2>
          <div className="h-px flex-1 bg-slate-200" />
          <Link to="/system-logs" className="text-xs font-semibold text-slate-700 border border-slate-200 px-2 py-1 rounded hover:bg-slate-50">
            View All
          </Link>
        </div>
        <div className="bg-[#F3F0FF] border border-purple-200 rounded-xl p-4 shadow-sm">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {compactActivityFeed.length > 0 ? compactActivityFeed.map((item, i) => {
              const type = item.type || item.event || '';
              const iconColor = type === 'fraud_alert' ? 'text-red-600' : type === 'vote_cast' ? 'text-emerald-600' : 'text-slate-500';
              const Icon = type === 'fraud_alert' ? Shield : type === 'vote_cast' ? Vote : AlertTriangle;
              const countLabel = item.count > 1 ? ` (x${item.count})` : '';
              return (
                <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-[#E6DFFB] transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-8 h-8 rounded-full bg-[#E6DFFB] flex items-center justify-center ${iconColor}`}>
                      <Icon size={14} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">
                        {(item.label || item.detail || 'Activity') + countLabel}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{item.detail || item.label || type}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 whitespace-nowrap">
                    {item.time || item.timestamp || item.created_at || '—'}
                  </div>
                </div>
              );
            }) : (
              <div className="text-xs text-slate-500 text-center py-6">{t('dashboard.noRecentActivity')}</div>
            )}
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-bold text-white uppercase bg-[#5B4DB1] px-3 py-1 rounded">Services</h2>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { to: '/registration-requests', icon: UserPlus, label: t('dashboard.registrationRequests', 'Registration Requests'), desc: 'Review and approve voter requests', bg: 'bg-[#E6F0FF]', iconBg: 'bg-[#D9E8FF]' },
            { to: '/election-setup', icon: CheckCircle2, label: t('dashboard.electionSetup', 'Election Setup'), desc: 'Configure elections and constituencies', bg: 'bg-[#E6F7EF]', iconBg: 'bg-[#D5F1E3]' },
            { to: '/fraud', icon: Shield, label: t('dashboard.quickFraudMonitor', 'Fraud Monitor'), desc: 'Investigate security alerts', bg: 'bg-[#FFF7E6]', iconBg: 'bg-[#FFE8BF]' },
          ].map(({ to, icon: Icon, label, desc, bg, iconBg }) => (
            <Link key={to} to={to} className={`flex items-center gap-3 p-4 rounded-xl border border-slate-200 ${bg} hover:shadow-sm hover:scale-[1.02] transition`}>
              <div className={`w-10 h-10 rounded-full ${iconBg} border border-slate-200 flex items-center justify-center text-[#5B4DB1]`}>
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800">{label}</div>
                <div className="text-[11px] text-gray-600 truncate">{desc}</div>
              </div>
              <ArrowRight size={14} className="ml-auto text-slate-400" />
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;