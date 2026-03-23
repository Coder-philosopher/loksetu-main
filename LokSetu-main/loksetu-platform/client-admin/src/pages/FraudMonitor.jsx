import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import {
  Shield, AlertTriangle, AlertCircle, Activity, RefreshCw,
  Eye, Zap, Globe, Bot, Fingerprint, TrendingUp, Filter,
  Network, Brain, Radio, MapPin, Clock, User, Bell, BellOff, ChevronDown
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const severityConfig = {
  CRITICAL: { color: 'red', icon: AlertTriangle, bg: 'bg-red-500', badge: 'badge-red' },
  HIGH: { color: 'orange', icon: AlertCircle, bg: 'bg-orange-500', badge: 'badge-amber' },
  MEDIUM: { color: 'amber', icon: Eye, bg: 'bg-amber-500', badge: 'badge-amber' },
  LOW: { color: 'blue', icon: Activity, bg: 'bg-blue-500', badge: 'badge-blue' },
};

const typeConfig = {
  DUPLICATE_ATTEMPT: { icon: Fingerprint, label: 'Duplicate Attempt', color: 'text-red-600' },
  VELOCITY_ANOMALY: { icon: Zap, label: 'Velocity Anomaly', color: 'text-orange-600' },
  IP_CLUSTER: { icon: Globe, label: 'IP Cluster', color: 'text-purple-600' },
  BOT_SUSPECT: { icon: Bot, label: 'Bot Suspected', color: 'text-red-600' },
  DEVICE_ANOMALY: { icon: Fingerprint, label: 'Device Anomaly', color: 'text-amber-600' },
  GRAPH_NETWORK: { icon: Network, label: 'Graph Network', color: 'text-violet-600' },
  BEHAVIORAL_ANOMALY: { icon: Brain, label: 'Behavioral Anomaly', color: 'text-pink-600' },
};

const FraudMonitor = () => {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const [graphData, setGraphData] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [resolvedAlerts, setResolvedAlerts] = useState([]);
  const [expandedAlerts, setExpandedAlerts] = useState([]);
  const eventSourceRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [alertsRes, statsRes, graphRes] = await Promise.all([
        fetch(`${API}/api/v1/monitor/fraud/alerts?limit=100`),
        fetch(`${API}/api/v1/monitor/fraud/stats`),
        fetch(`${API}/api/v1/monitor/graph-network`),
      ]);
      if (alertsRes.ok) setAlerts((await alertsRes.json()).alerts);
      if (statsRes.ok) setStats(await statsRes.json());
      if (graphRes.ok) setGraphData(await graphRes.json());
    } catch (e) {
      console.warn('Fraud data fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoRefresh) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setSseConnected(false);
      }
      return;
    }

    const es = new EventSource(`${API}/api/v1/monitor/fraud/stream`);
    eventSourceRef.current = es;

    es.addEventListener('fraud-alert', (event) => {
      try {
        const alert = JSON.parse(event.data);
        setAlerts(prev => [alert, ...prev].slice(0, 200));
        fetch(`${API}/api/v1/monitor/fraud/stats`)
          .then(r => r.ok ? r.json() : null)
          .then(s => s && setStats(s))
          .catch(() => {});
      } catch {}
    });

    es.onopen = () => setSseConnected(true);
    es.onerror = () => setSseConnected(false);

    return () => {
      es.close();
      eventSourceRef.current = null;
      setSseConnected(false);
    };
  }, [autoRefresh]);

  useEffect(() => {
    fetchData();
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData, autoRefresh]);

  const filteredAlerts = filter === 'ALL' ? alerts : alerts.filter(a => a.severity === filter);

  const threatLevel = stats
    ? stats.total === 0 ? 'SECURE' : stats.bySeverity.CRITICAL > 0 ? 'CRITICAL' : stats.bySeverity.HIGH > 0 ? 'ELEVATED' : 'LOW'
    : 'LOADING';

  const threatColors = {
    SECURE: 'bg-dash-success',
    LOW: 'bg-dash-primary',
    ELEVATED: 'bg-dash-warning',
    CRITICAL: 'bg-dash-danger',
    LOADING: 'bg-slate-400',
  };

  // Extract IP-related alerts for IP monitoring section
  const ipAlerts = alerts.filter(a => a.type === 'IP_CLUSTER');
  const uniqueIPs = [...new Set(ipAlerts.map(a => a.details?.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/)?.[0]).filter(Boolean))];

  // Fraud activity timeline - group alerts by hour
  const fraudTimeline = useMemo(() => {
    const buckets = {};
    for (let i = 23; i >= 0; i--) {
      const d = new Date(Date.now() - i * 3600000);
      const label = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      buckets[label] = 0;
    }
    alerts.forEach(a => {
      const t = new Date(a.timestamp);
      const label = t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      if (buckets[label] !== undefined) buckets[label]++;
    });
    return Object.entries(buckets).map(([hour, count]) => ({ hour, alerts: count }));
  }, [alerts]);

  // Top suspicious IPs
  const topIPs = useMemo(() => {
    const ipMap = {};
    alerts.forEach(a => {
      const match = a.details?.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
      if (match) ipMap[match[1]] = (ipMap[match[1]] || 0) + 1;
    });
    return Object.entries(ipMap)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [alerts]);

  const toggleResolved = (id) => {
    setResolvedAlerts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleExpanded = (id) => {
    setExpandedAlerts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {/* HEADER */}
      <div className="rounded-b-2xl bg-[#5B4DB1] px-6 py-5 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em]">FRAUD MONITOR</p>
            <h2 className="text-2xl font-bold mt-2">FRAUD MONITOR</h2>
            <p className="text-sm text-white/80 mt-2">Real-time fraud detection and security monitoring</p>
          </div>
          <div className="flex gap-3 items-center">
            {autoRefresh && (
              <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${sseConnected ? 'bg-white/20 text-white' : 'bg-red-500/30 text-red-100'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                {sseConnected ? 'LIVE' : t('fraud.reconnecting')}
              </span>
            )}
            <button
              onClick={() => setAutoRefresh(a => !a)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${autoRefresh ? 'bg-white/20 hover:bg-white/30' : 'bg-white/10 hover:bg-white/20 opacity-60'}`}
            >
              <RefreshCw size={14} className={`inline mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? t('fraud.liveBtn') : t('fraud.pausedBtn')}
            </button>
            <button
              onClick={() => setSoundEnabled(v => !v)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${soundEnabled ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}
              aria-pressed={soundEnabled}
            >
              {soundEnabled ? <Bell size={14} className="inline mr-2" /> : <BellOff size={14} className="inline mr-2" />}
              {soundEnabled ? 'Sound On' : 'Sound Off'}
            </button>
          </div>
        </div>
        <div className="mt-4 text-xs text-white/70">Dashboard / Fraud Monitor</div>
      </div>

      {/* TOP ANALYTICS */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100 p-5 hover:shadow-sm transition">
            <div className="w-10 h-10 rounded-lg bg-red-200 text-red-700 flex items-center justify-center mb-3">
              <AlertTriangle size={20} />
            </div>
            <p className="text-3xl font-bold text-dash-text">{stats.total}</p>
            <p className="text-xs font-semibold text-dash-text-secondary mt-1">Total Alerts</p>
          </div>
          <div className="rounded-xl border border-red-300 bg-gradient-to-br from-red-100 to-red-200 p-5 hover:shadow-sm transition">
            <div className="w-10 h-10 rounded-lg bg-red-300 text-red-800 flex items-center justify-center mb-3">
              <AlertCircle size={20} />
            </div>
            <p className="text-3xl font-bold text-dash-text">{stats.bySeverity.CRITICAL}</p>
            <p className="text-xs font-semibold text-dash-text-secondary mt-1">Critical Alerts</p>
          </div>
          <div className="rounded-xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100 p-5 hover:shadow-sm transition">
            <div className="w-10 h-10 rounded-lg bg-yellow-200 text-yellow-700 flex items-center justify-center mb-3">
              <TrendingUp size={20} />
            </div>
            <p className="text-3xl font-bold text-dash-text">{stats.avgScore}</p>
            <p className="text-xs font-semibold text-dash-text-secondary mt-1">System Risk Score</p>
          </div>
        </div>
      )}

      {/* IP MONITORING & DETECTION ENGINES ROW */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* IP Address Monitoring */}
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-blue-100">
            <Globe size={18} className="text-purple-600" />
            <h3 className="font-bold text-dash-text text-sm">{t('fraud.ipMonitoring')}</h3>
            <span className="ml-auto text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{ipAlerts.length} {t('fraud.flagged')}</span>
          </div>
          {ipAlerts.length === 0 ? (
            <div className="text-center py-10">
              <Globe size={36} className="mx-auto text-blue-400 mb-2" />
              <p className="text-sm text-blue-700">No suspicious IPs detected</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {ipAlerts.slice(0, 10).map((alert, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-white/70 rounded-lg border border-blue-100">
                  <MapPin size={14} className="text-blue-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dash-text truncate">{alert.details}</p>
                    <p className="text-xs text-dash-text-secondary">{new Date(alert.timestamp).toLocaleString()}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    alert.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {alert.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detection Engines Status */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-md">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
            <Brain size={18} className="text-dash-primary" />
            <h3 className="font-bold text-dash-text text-sm">{t('fraud.detectionEngines')}</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(typeConfig).map(([key, cfg]) => {
              const Icon = cfg.icon;
              const count = alerts.filter(a => a.type === key).length;
              return (
                <div key={key} className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <Icon size={15} className={cfg.color} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-dash-text truncate">{cfg.label}</p>
                  </div>
                  <span className="text-xs font-bold text-dash-text">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FRAUD TIMELINE & TOP IPs CHARTS */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Fraud Activity Timeline */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-md">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
            <Clock size={18} className="text-dash-danger" />
            <h3 className="font-bold text-dash-text text-sm">{t('fraud.fraudTimeline')}</h3>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fraudTimeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fraudTimeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="alerts" stroke="#EF4444" fill="url(#fraudTimeGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Suspicious IPs */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-md">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
            <Globe size={18} className="text-purple-600" />
            <h3 className="font-bold text-dash-text text-sm">{t('fraud.topSuspiciousIPs')}</h3>
          </div>
          {topIPs.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topIPs} layout="vertical" margin={{ top: 5, right: 20, left: 70, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="ip" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#1e293b', fontWeight: 600 }} width={100} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="count" fill="#7c3aed" radius={[0, 4, 4, 0]} barSize={16} name="Alerts" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm text-dash-text-secondary">{t('fraud.noSuspiciousIPsYet')}</p>
            </div>
          )}
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 flex items-center gap-2 flex-wrap">
        <Filter size={16} className="text-purple-700" />
        <span className="text-sm font-semibold text-purple-700 mr-2">{t('fraud.filter')}:</span>
        {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              f === 'ALL'
                ? filter === f ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                : f === 'CRITICAL'
                  ? filter === f ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'
                  : f === 'HIGH'
                    ? filter === f ? 'bg-orange-600 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    : f === 'MEDIUM'
                      ? filter === f ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      : filter === f ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto text-xs text-dash-text-secondary font-medium">{filteredAlerts.length} {t('fraud.alerts')}</span>
      </div>

      {/* ALERTS LIST */}
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <RefreshCw size={24} className="mx-auto animate-spin text-slate-400 mb-3" />
            <p className="text-dash-text-secondary text-sm">{t('fraud.loadingAlerts')}</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-12 text-center">
            <Shield size={48} className="mx-auto text-emerald-500 mb-4" />
            <h3 className="text-lg font-bold text-dash-text mb-1">{t('fraud.allClear')}</h3>
            <p className="text-dash-text-secondary text-sm">{t('fraud.allClearDesc')}</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const typeCfg = typeConfig[alert.type] || typeConfig.DEVICE_ANOMALY;
            const TypeIcon = typeCfg.icon;
            const isResolved = resolvedAlerts.includes(alert.id);
            const isExpanded = expandedAlerts.includes(alert.id);

            return (
              <div key={alert.id} className={`bg-white border-l-4 rounded-xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition ${
                alert.severity === 'CRITICAL' ? 'border-l-[#EF4444]' :
                alert.severity === 'HIGH' ? 'border-l-[#F97316]' :
                alert.severity === 'MEDIUM' ? 'border-l-[#F59E0B]' :
                'border-l-[#3B82F6]'
              } ${isResolved ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                      <TypeIcon size={18} className={typeCfg.color} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          alert.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                          alert.severity === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                          alert.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {alert.severity}
                        </span>
                        <span className="text-xs font-semibold text-dash-text-secondary">{typeCfg.label}</span>
                        {isResolved && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Resolved</span>
                        )}
                      </div>
                      <p className="text-sm text-dash-text leading-relaxed">{alert.details}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-dash-text-secondary">{t('fraud.score')}: {alert.score}/100</span>
                    <p className="text-xs text-dash-text-secondary mt-2">{new Date(alert.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-dash-text-secondary">
                  <span>{t('fraud.voter')}: {alert.voterID}</span>
                  <span>{t('fraud.ipAddress')}: {alert.ip || '—'}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => toggleExpanded(alert.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Details <ChevronDown size={12} className={isExpanded ? 'rotate-180 transition' : 'transition'} />
                  </button>
                  <button
                    onClick={() => toggleResolved(alert.id)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 transition"
                  >
                    {isResolved ? 'Reopen' : 'Mark as Resolved'}
                  </button>
                </div>
                {isExpanded && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <span className="font-semibold text-slate-700">Type:</span> {alert.type}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700">Severity:</span> {alert.severity}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700">Score:</span> {alert.score}/100
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700">Timestamp:</span> {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FraudMonitor;
