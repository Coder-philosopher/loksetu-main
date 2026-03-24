import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Vote, Clock, CheckCircle, AlertCircle, Loader2,
  Shield, User, ChevronRight, Activity, Lock, Zap, BarChart3,
  Calendar, MapPin, Fingerprint, RefreshCw
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/* ─── Tiny primitives ─────────────────────────────────────── */
const MonoLabel = ({ children, className = '' }) => (
  <span className={`font-['JetBrains_Mono',monospace] text-[9px] font-bold uppercase tracking-[2.5px] ${className}`}>
    {children}
  </span>
);

const Badge = ({ children, color = 'slate' }) => {
  const palette = {
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red:   'bg-red-50 text-red-700 border-red-200',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
    blue:  'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${palette[color]}`}>
      {children}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, accent = 'amber' }) => {
  const colors = {
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-500', val: 'text-amber-700' },
    green: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-500', val: 'text-emerald-700' },
    blue:  { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500', val: 'text-blue-700' },
    slate: { bg: 'bg-slate-100', border: 'border-slate-200', icon: 'text-slate-500', val: 'text-slate-700' },
  };
  const c = colors[accent];
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 flex items-center gap-4 shadow-sm`}>
      <div className={`w-10 h-10 rounded-lg ${c.bg} border ${c.border} flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className={c.icon} />
      </div>
      <div>
        <MonoLabel className="text-slate-500">{label}</MonoLabel>
        <p className={`text-xl font-extrabold ${c.val} leading-tight mt-0.5`}>{value}</p>
        {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

const ElectionTypeTag = ({ type }) => {
  const map = { VS: ['Vidhan Sabha', 'amber'], LS: ['Lok Sabha', 'blue'], MCD: ['Municipal Ward', 'green'] };
  const [label, color] = map[type] || [type, 'slate'];
  return <Badge color={color}>{label}</Badge>;
};

const TimeRemaining = ({ endTime }) => {
  const end = new Date(endTime);
  const diff = end - new Date();
  if (diff <= 0) return <span className="text-red-600 font-bold text-xs">Ended</span>;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const pct = Math.min(100, Math.max(0, (diff / (24 * 3600000)) * 100));
  const urgent = diff < 3600000;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-bold ${urgent ? 'text-red-600' : 'text-slate-600'}`}>
          {h > 0 ? `${h}h ${m}m` : `${m}m`} remaining
        </span>
        <span className="text-[10px] text-slate-500">{new Date(endTime).toLocaleDateString()}</span>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${urgent ? 'bg-red-500' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

/* ─── Main ───────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [voter, setVoter] = useState(null);
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchElections = async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) { navigate('/'); return; }
      const res = await fetch(`${API_BASE_URL}/api/v1/ballot/elections/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) { localStorage.removeItem('token'); navigate('/'); return; }
        throw new Error('Failed to fetch elections');
      }
      const data = await res.json();
      setVoter(data.voter);
      setElections(data.elections);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load elections');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchElections(); }, [navigate]);

  const handleLogout = () => {
    ['token', 'sessionStart', 'voteSessionDeadline'].forEach(k => localStorage.removeItem(k));
    navigate('/');
  };

  /* Loading */
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center gap-4 font-['Sora',sans-serif]">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=Cormorant+Garamond:ital,wght@0,600;1,400;1,600&family=JetBrains+Mono:wght@400;700&display=swap');`}</style>
      <div className="w-14 h-14 rounded-full border border-amber-200 bg-amber-50 flex items-center justify-center">
        <Loader2 size={24} className="text-amber-500 animate-spin" />
      </div>
      <div className="text-center">
        <p className="font-bold text-slate-800 text-sm">Loading elections</p>
        <MonoLabel className="text-slate-500">Fetching active ballots…</MonoLabel>
      </div>
    </div>
  );

  const pendingCount = elections.filter(e => !e.hasVoted).length;
  const votedCount = elections.filter(e => e.hasVoted).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-['Sora',sans-serif] text-slate-800">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=Cormorant+Garamond:ital,wght@0,600;1,400;1,600&family=JetBrains+Mono:wght@400;700&display=swap');
        .font-serif-civic { font-family: 'Cormorant Garamond', serif; }
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .anim-enter { animation: fadeSlideUp .5s ease both; }
        .card-hover { transition: transform .25s, box-shadow .25s; }
        .card-hover:hover { transform: translateY(-3px); box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
      `}</style>

      {/* Tricolor stripe */}
      <div className="h-1 w-full flex fixed top-0 z-50">
        <div className="flex-1 bg-amber-500" /><div className="flex-1 bg-white" /><div className="flex-1 bg-emerald-600" />
      </div>

      {/* BG texture - light theme */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.02) 1px,transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      <div className="fixed top-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)' }} />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)' }} />

      {/* ── Header ── */}
      <header className="relative z-20 border-b border-slate-200 bg-white/80 backdrop-blur-sm pt-1">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-[3px] w-4">
              <div className="h-[4px] rounded-sm bg-amber-500" />
              <div className="flex-1 bg-slate-600 h-[4px] rounded-sm" />
              <div className="h-[4px] rounded-sm bg-emerald-500" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-slate-800">LokSetu</span>
              <span className="font-['JetBrains_Mono',monospace] text-[9px] text-slate-500 block leading-none mt-0.5 uppercase tracking-[2px]">Elections Dashboard</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <MonoLabel className="text-emerald-600">System Online</MonoLabel>
            </div>
            <button onClick={() => fetchElections(true)}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-all">
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition-all">
              <LogOut size={13} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Voter profile ── */}
        {voter && (
          <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden ${mounted ? 'anim-enter' : 'opacity-0'}`}>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-0">
              {/* Left: identity */}
              <div className="p-6 flex items-center gap-5 border-b lg:border-b-0 lg:border-r border-slate-200">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                  <User size={24} className="text-amber-600" />
                </div>
                <div>
                  <MonoLabel className="text-amber-600">Authenticated Voter</MonoLabel>
                  <h2 className="text-xl font-extrabold tracking-tight mt-0.5 text-slate-800">{voter.name}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1">
                      <Fingerprint size={11} className="text-slate-500" />
                      <span className="font-['JetBrains_Mono',monospace] text-[10px] text-slate-600 font-bold">{voter.epicId}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1">
                      <MapPin size={11} className="text-slate-500" />
                      <span className="text-[10px] text-slate-600 font-semibold">{voter.state}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: auth flags */}
              <div className="p-6 flex items-center gap-4">
                {voter.hasPassword && (
                  <div className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <CheckCircle size={18} className="text-emerald-500" />
                    <MonoLabel className="text-emerald-600 text-center">Password<br/>Set</MonoLabel>
                  </div>
                )}
                {voter.hasFaceSetToken && (
                  <div className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
                    <Shield size={18} className="text-blue-500" />
                    <MonoLabel className="text-blue-600 text-center">Face<br/>Verified</MonoLabel>
                  </div>
                )}
                <div className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                  <Lock size={18} className="text-amber-500" />
                  <MonoLabel className="text-amber-600 text-center">E2E<br/>Encrypted</MonoLabel>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Stats row ── */}
        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${mounted ? 'anim-enter' : 'opacity-0'}`} style={{ animationDelay: '.08s' }}>
          <StatCard icon={Activity} label="Total Elections" value={elections.length} sub="Active now" accent="slate" />
          <StatCard icon={Vote} label="Pending Votes" value={pendingCount} sub="Awaiting your vote" accent="amber" />
          <StatCard icon={CheckCircle} label="Votes Cast" value={votedCount} sub="Recorded on chain" accent="green" />
          <StatCard icon={Zap} label="Blockchain" value="Live" sub="Hyperledger Fabric" accent="blue" />
        </div>

        {/* ── Section header ── */}
        <div className={`flex items-center justify-between ${mounted ? 'anim-enter' : 'opacity-0'}`} style={{ animationDelay: '.12s' }}>
          <div>
            <MonoLabel className="text-amber-600">02 — Active Ballots</MonoLabel>
            <h3 className="text-2xl font-extrabold tracking-tight mt-0.5 text-slate-800">Elections</h3>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">
              {pendingCount === 0 ? 'All votes cast' : `${pendingCount} awaiting your vote`}
            </p>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50">
            <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-700">Failed to load elections</p>
              <p className="text-xs text-red-600/80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* ── Elections grid ── */}
        {elections.length > 0 ? (
          <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 ${mounted ? 'anim-enter' : 'opacity-0'}`} style={{ animationDelay: '.16s' }}>
            {elections.map((election, idx) => (
              <div key={election.id}
                className="card-hover bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-sm"
                style={{ animationDelay: `${.16 + idx * 0.05}s` }}>

                {/* Card top banner */}
                <div className={`h-1.5 w-full ${election.hasVoted ? 'bg-emerald-500' : 'bg-amber-500'}`} />

                <div className="p-5 flex flex-col gap-4 flex-1">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <ElectionTypeTag type={election.election_type} />
                    {election.hasVoted ? (
                      <Badge color="green"><CheckCircle size={10} /> Voted</Badge>
                    ) : (
                      <Badge color="amber"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" /> Open</Badge>
                    )}
                  </div>

                  {/* Name */}
                  <div>
                    <h4 className="text-base font-extrabold tracking-tight leading-tight text-slate-800">{election.name}</h4>
                    {election.description && (
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{election.description}</p>
                    )}
                  </div>

                  {/* Time */}
                  <div className="pt-3 border-t border-slate-100">
                    <TimeRemaining endTime={election.end_time} />
                  </div>

                  {/* Dates */}
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <div className="flex items-center gap-1">
                      <Calendar size={10} />
                      <span>Opens {new Date(election.start_time).toLocaleDateString()}</span>
                    </div>
                    <span>·</span>
                    <div className="flex items-center gap-1">
                      <Clock size={10} />
                      <span>Closes {new Date(election.end_time).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => navigate(`/vote/${election.id}`)}
                    disabled={election.hasVoted}
                    className={`mt-auto w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                      election.hasVoted
                        ? 'bg-slate-100 text-slate-500 cursor-not-allowed border border-slate-200'
                        : 'bg-amber-500 hover:bg-amber-600 text-white shadow-[0_4px_20px_rgba(245,158,11,0.25)] hover:shadow-[0_4px_28px_rgba(245,158,11,0.35)] active:scale-[0.98]'
                    }`}
                  >
                    {election.hasVoted ? (
                      <><CheckCircle size={15} /> Already Voted</>
                    ) : (
                      <><Vote size={15} /> Vote Now <ChevronRight size={14} /></>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty state - light theme */
          <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-4">
              <Clock size={28} className="text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">No Active Elections</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              There are no active elections available. Check back later for voting opportunities.
            </p>
          </div>
        )}

        {/* ── Info strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {[
            { icon: Lock, label: 'Encrypted Ballots', sub: 'AES-256 + RSA hybrid encryption on every vote' },
            { icon: BarChart3, label: 'Real-time Tally', sub: 'Results tallied live on Hyperledger Fabric' },
            { icon: Shield, label: 'Zero Double Voting', sub: 'Blockchain prevents any duplicate submissions' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white shadow-sm">
              <Icon size={16} className="text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-700">{label}</p>
                <p className="text-[10px] text-slate-500 leading-relaxed">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] font-['JetBrains_Mono',monospace] text-slate-400 uppercase tracking-widest pt-2 border-t border-slate-200">
          <span>© {new Date().getFullYear()} LokSetu · NIT Raipur</span>
          <span>Hyperledger Fabric</span>
        </div>
      </main>
    </div>
  );
}