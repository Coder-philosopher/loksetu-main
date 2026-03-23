import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText, RefreshCw, Clock, AlertTriangle, Info, CheckCircle,
  Database, Shield, Globe, Filter, ChevronDown, Lock, Activity
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const levelConfig = {
  ERROR: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: AlertTriangle, dot: 'bg-red-500' },
  WARN: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: AlertTriangle, dot: 'bg-amber-500' },
  INFO: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: Info, dot: 'bg-blue-500' },
  SUCCESS: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: CheckCircle, dot: 'bg-emerald-500' },
};

const SystemLogs = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [ipData, setIpData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('logs');
  const [filterLevel, setFilterLevel] = useState('ALL');

  const fetchData = useCallback(async () => {
    try {
      const [logsRes, txRes, ipRes] = await Promise.all([
        fetch(`${API}/api/v1/system/logs?limit=100`),
        fetch(`${API}/api/v1/system/transactions?limit=50`),
        fetch(`${API}/api/v1/system/ip-tracking?limit=50`),
      ]);
      if (logsRes.ok) setLogs((await logsRes.json()).logs || []);
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.dbTransactions || []);
      }
      if (ipRes.ok) setIpData((await ipRes.json()).data || []);
    } catch (e) {
      console.warn('System data fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredLogs = filterLevel === 'ALL' ? logs : logs.filter(l => l.level === filterLevel);

  const tabs = [
    { key: 'logs', label: t('systemLogs.systemLogs'), icon: FileText },
    { key: 'transactions', label: t('systemLogs.voteTransactions'), icon: Lock },
    { key: 'ip', label: t('systemLogs.ipTracking'), icon: Globe },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="rounded-b-2xl bg-[#5B4DB1] px-6 py-5 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em]">SYSTEM LOGS</p>
            <h2 className="text-2xl font-bold mt-2">{t('systemLogs.title')}</h2>
            <p className="text-sm text-white/80 mt-2">{t('systemLogs.subtitle')}</p>
          </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-md bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-200 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {t('systemLogs.refresh')}
          </button>
        </div>
        <div className="mt-4 text-xs text-white/70">Dashboard / System Logs</div>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-3">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              activeTab === t.key
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* System Logs Tab */}
      {activeTab === 'logs' && (
        <>
          {/* Filter */}
          <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 flex items-center gap-2 flex-wrap">
            <Filter size={16} className="text-purple-700" />
            <span className="text-sm font-semibold text-purple-700 mr-2">{t('systemLogs.level')}:</span>
            {['ALL', 'ERROR', 'WARN', 'INFO'].map(f => (
              <button
                key={f}
                onClick={() => setFilterLevel(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  f === 'ALL'
                    ? filterLevel === f ? 'bg-blue-200 text-blue-800' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : f === 'ERROR'
                      ? filterLevel === f ? 'bg-red-200 text-red-800' : 'bg-red-100 text-red-700 hover:bg-red-200'
                      : f === 'WARN'
                        ? filterLevel === f ? 'bg-yellow-200 text-yellow-800' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : filterLevel === f ? 'bg-green-200 text-green-800' : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {f}
              </button>
            ))}
            <span className="ml-auto text-xs text-dash-text-secondary">{filteredLogs.length} {t('systemLogs.entries')}</span>
          </div>

          {/* Logs List */}
          {filteredLogs.length === 0 ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-12 text-center">
              <FileText size={36} className="mx-auto text-blue-400 mb-3" />
              <p className="text-blue-700 text-sm">{t('systemLogs.noLogs')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log, i) => {
                const cfg = levelConfig[log.level] || levelConfig.INFO;
                const LogIcon = cfg.icon;
                return (
                  <div key={i} className={`rounded-xl p-4 ${cfg.bg} border ${cfg.border} hover:shadow-sm transition`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className={`w-8 h-8 rounded-full bg-white/70 border ${cfg.border} flex items-center justify-center`}> 
                          <LogIcon size={14} className={`${cfg.text} shrink-0`} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold ${cfg.text}`}>{log.level}</span>
                            <span className="text-xs text-dash-text-secondary font-medium">{log.source}</span>
                          </div>
                          <p className="text-sm text-dash-text break-words">{log.message}</p>
                        </div>
                      </div>
                      <span className="text-xs text-dash-muted whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Vote Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="dash-card overflow-hidden">
          <div className="p-5 border-b border-dash-border bg-slate-50 flex items-center gap-3">
            <Lock size={18} className="text-dash-primary" />
            <div>
              <h3 className="font-bold text-dash-text text-sm">{t('systemLogs.blockchainVoteTx')}</h3>
              <p className="text-xs text-dash-text-secondary">{t('systemLogs.blockchainVoteTxDesc')}</p>
            </div>
            <span className="ml-auto badge-blue">{transactions.length} {t('systemLogs.records')}</span>
          </div>
          {transactions.length === 0 ? (
            <div className="p-12 text-center">
              <Database size={36} className="mx-auto text-dash-muted mb-3" />
              <p className="text-dash-text-secondary text-sm">{t('systemLogs.noVoteTx')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-dash-border">
                    <th className="text-left px-5 py-3 text-xs font-bold text-dash-text-secondary uppercase">{t('systemLogs.voterEpic')}</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-dash-text-secondary uppercase">{t('analytics.candidate')}</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-dash-text-secondary uppercase">{t('systemLogs.txHash')}</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-dash-text-secondary uppercase">{t('systemLogs.booth')}</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-dash-text-secondary uppercase">{t('systemLogs.timestamp')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border">
                  {transactions.map((tx, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-mono font-semibold text-dash-text">{tx.voter_epic_id}</td>
                      <td className="px-5 py-3">
                        <span className="font-medium text-dash-text">{tx.candidate_name || '-'}</span>
                        {tx.party && <span className="text-xs text-dash-text-secondary ml-2">({tx.party})</span>}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-dash-accent">
                        {tx.tx_hash ? tx.tx_hash.substring(0, 16) + '...' : '-'}
                      </td>
                      <td className="px-5 py-3 text-dash-text-secondary">{tx.booth_location || '-'}</td>
                      <td className="px-5 py-3 text-xs text-dash-text-secondary">
                        {tx.created_at ? new Date(tx.created_at).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* IP Tracking Tab */}
      {activeTab === 'ip' && (
        <div className="dash-card overflow-hidden">
          <div className="p-5 border-b border-dash-border bg-slate-50 flex items-center gap-3">
            <Globe size={18} className="text-purple-600" />
            <div>
              <h3 className="font-bold text-dash-text text-sm">{t('systemLogs.ipAddressTracking')}</h3>
              <p className="text-xs text-dash-text-secondary">{t('systemLogs.ipTrackingDesc')}</p>
            </div>
            <span className="ml-auto badge-blue">{ipData.length} {t('systemLogs.uniqueIPs')}</span>
          </div>
          {ipData.length === 0 ? (
            <div className="p-12 text-center">
              <Globe size={36} className="mx-auto text-dash-muted mb-3" />
              <p className="text-dash-text-secondary text-sm">{t('systemLogs.noIPData')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-dash-border">
                    <th className="text-left px-5 py-3 text-xs font-bold text-dash-text-secondary uppercase">{t('systemLogs.ipAddress')}</th>
                    <th className="text-right px-5 py-3 text-xs font-bold text-dash-text-secondary uppercase">{t('systemLogs.requestCount')}</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-dash-text-secondary uppercase">{t('systemLogs.lastSeen')}</th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-dash-text-secondary uppercase">{t('systemLogs.riskLevel')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border">
                  {ipData.map((ip, i) => {
                    const count = parseInt(ip.request_count);
                    const risk = count > 100 ? 'HIGH' : count > 30 ? 'MEDIUM' : 'LOW';
                    const riskBadge = risk === 'HIGH' ? 'badge-red' : risk === 'MEDIUM' ? 'badge-amber' : 'badge-green';
                    return (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-mono font-semibold text-dash-text">{ip.ip_address}</td>
                        <td className="px-5 py-3 text-right font-bold text-dash-text">{ip.request_count}</td>
                        <td className="px-5 py-3 text-xs text-dash-text-secondary">
                          {ip.last_seen ? new Date(ip.last_seen).toLocaleString() : '-'}
                        </td>
                        <td className="px-5 py-3">
                          <span className={riskBadge}>{risk}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SystemLogs;
