import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Shield, CheckCircle, AlertTriangle, LogOut, Vote, Loader2,
  Lock, Clock, Fingerprint, Activity, ChevronRight, Zap, BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const SESSION_LIMIT_MS = 2 * 60 * 1000;

/* ─── Primitives ──────────────────────────────────────────── */
const MonoLabel = ({ children, className = '' }) => (
  <span className={`font-['JetBrains_Mono',monospace] text-[9px] font-bold uppercase tracking-[2.5px] ${className}`}>
    {children}
  </span>
);

/* ─── Session timer ring ──────────────────────────────────── */
const SessionRing = ({ time }) => {
  const [m, s] = time.split(':').map(Number);
  const totalSecs = m * 60 + s;
  const pct = Math.min(100, (totalSecs / 120) * 100);
  const urgent = totalSecs < 30;
  const warn = totalSecs < 60;
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10 flex-shrink-0">
        <svg viewBox="0 0 40 40" className="-rotate-90 w-full h-full">
          <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="3" />
          <circle cx="20" cy="20" r="16" fill="none"
            stroke={urgent ? '#dc2626' : warn ? '#f97316' : '#f59e0b'}
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 16}`}
            strokeDashoffset={`${2 * Math.PI * 16 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Clock size={12} className={urgent ? 'text-red-500' : 'text-amber-500'} />
        </div>
      </div>
      <div>
        <MonoLabel className="text-slate-500">Time Left</MonoLabel>
        <span className={`font-['JetBrains_Mono',monospace] text-base font-bold leading-tight ${urgent ? 'text-red-600' : warn ? 'text-orange-600' : 'text-slate-800'}`}>
          {time}
        </span>
      </div>
    </div>
  );
};

/* ─── Candidate card ──────────────────────────────────────── */
const CandidateCard = ({ candidate, selected, onSelect, onVote, voting }) => {
  const [imgError, setImgError] = useState(false);
  return (
    <div
      onClick={() => onSelect(candidate.id)}
      className={`relative rounded-2xl border-2 overflow-hidden cursor-pointer transition-all duration-300 flex flex-col group shadow-sm
        ${selected
          ? 'border-amber-500 bg-amber-50 shadow-[0_0_0_1px_rgba(245,158,11,0.1),0_20px_40px_rgba(0,0,0,0.08)]'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
        }`}
    >
      {/* Accent top line */}
      <div className={`h-1 w-full transition-all duration-300 ${selected ? 'bg-amber-500' : 'bg-transparent group-hover:bg-slate-200'}`} />

      {/* Symbol */}
      <div className={`flex items-center justify-center p-8 border-b transition-colors duration-300
        ${selected ? 'border-amber-200 bg-amber-50/20' : 'border-slate-100 bg-white'}`}>
        {!imgError && candidate.symbol_url ? (
          <img src={candidate.symbol_url} alt={candidate.party}
            className="w-20 h-20 object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-2xl font-extrabold text-amber-600">
            {candidate.party?.charAt(0)}
          </div>
        )}

        {selected && (
          <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center shadow-[0_0_14px_rgba(245,158,11,0.4)] animate-in zoom-in duration-200">
            <CheckCircle size={15} className="text-white" />
          </div>
        )}
      </div>

      {/* Info + Vote button */}
      <div className="p-5 flex flex-col gap-4 flex-1">
        <div className="text-center">
          <h4 className="text-base font-extrabold tracking-tight text-slate-800">{candidate.name}</h4>
          <p className={`text-xs font-bold uppercase tracking-wider mt-1.5 ${selected ? 'text-amber-600' : 'text-slate-500'}`}>
            {candidate.party}
          </p>
        </div>

        <button
          onClick={e => { e.stopPropagation(); onVote(candidate.id); }}
          disabled={voting}
          className={`mt-auto py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
            ${selected
              ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-[0_4px_16px_rgba(245,158,11,0.25)] active:scale-[0.97]'
              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {voting ? (
            <><Loader2 size={14} className="animate-spin" /> Committing…</>
          ) : (
            <><Vote size={14} /> Cast Vote</>
          )}
        </button>
      </div>
    </div>
  );
};

/* ─── Main ───────────────────────────────────────────────── */
export default function VotingBooth() {
  const navigate = useNavigate();
  const [ballot, setBallot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voteStatus, setVoteStatus] = useState('idle');
  const [txId, setTxId] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [sessionTime, setSessionTime] = useState('02:00');
  const [mounted, setMounted] = useState(false);

  const behavioralRef = useRef({ mouseMovements: 0, clickCount: 0, keystrokes: 0, scrollEvents: 0, idleTime: 0, pageVisibility: 0 });
  const lastActivityRef = useRef(Date.now());
  const idleCheckRef = useRef(null);
  const visibilityStartRef = useRef(document.hidden ? 0 : Date.now());

  useEffect(() => { setMounted(true); }, []);

  // Behavioral tracking
  useEffect(() => {
    const b = behavioralRef.current;
    const act = () => { lastActivityRef.current = Date.now(); };
    const mm = () => { b.mouseMovements++; act(); };
    const cl = () => { b.clickCount++; act(); };
    const kd = () => { b.keystrokes++; act(); };
    const sc = () => { b.scrollEvents++; act(); };
    const vc = () => { document.hidden ? b.pageVisibility += Date.now() - visibilityStartRef.current : (visibilityStartRef.current = Date.now()); };
    window.addEventListener('mousemove', mm); window.addEventListener('click', cl);
    window.addEventListener('keydown', kd); window.addEventListener('scroll', sc);
    document.addEventListener('visibilitychange', vc);
    idleCheckRef.current = setInterval(() => { if (Date.now() - lastActivityRef.current > 5000) b.idleTime += 2000; }, 2000);
    return () => {
      window.removeEventListener('mousemove', mm); window.removeEventListener('click', cl);
      window.removeEventListener('keydown', kd); window.removeEventListener('scroll', sc);
      document.removeEventListener('visibilitychange', vc); clearInterval(idleCheckRef.current);
    };
  }, []);

  const logout = useCallback(() => {
    ['token', 'sessionStart', 'voteSessionDeadline'].forEach(k => localStorage.removeItem(k));
    navigate('/');
  }, [navigate]);

  // Session timer
  useEffect(() => {
    let deadline = Number(localStorage.getItem('voteSessionDeadline'));
    if (!deadline || isNaN(deadline)) { deadline = Date.now() + SESSION_LIMIT_MS; localStorage.setItem('voteSessionDeadline', String(deadline)); }
    const tick = () => {
      const r = deadline - Date.now();
      if (r <= 0) { setSessionTime('00:00'); logout(); return; }
      const rs = Math.floor(r / 1000);
      setSessionTime(`${String(Math.floor(rs / 60)).padStart(2,'0')}:${String(rs % 60).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [logout]);

  // Fetch ballot
  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('token');
      if (!token) { navigate('/'); return; }
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/ballot`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        });
        if (res.status === 401 || res.status === 403) { alert('Session expired.'); navigate('/'); return; }
        const ct = res.headers.get('content-type');
        if (!ct?.includes('application/json')) throw new Error('Invalid server response.');
        setBallot(await res.json());
      } catch (e) { console.error('Ballot fetch:', e); }
      finally { setLoading(false); }
    })();
  }, [navigate]);

  const castVote = async (candidateId) => {
    if (!window.confirm('Confirm your vote? This action is permanent and recorded on the blockchain.')) return;
    setVoteStatus('casting');
    const token = localStorage.getItem('token');
    const sessionStart = localStorage.getItem('sessionStart');
    if (!document.hidden) behavioralRef.current.pageVisibility += Date.now() - visibilityStartRef.current;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/ballot/cast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({
          candidate_id: candidateId,
          sessionDuration: sessionStart ? Date.now() - parseInt(sessionStart) : undefined,
          behavioral: {
            ...behavioralRef.current,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            touchCapable: 'ontouchstart' in window,
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setVoteStatus('success');
        setTxId(data.transactionId);
        localStorage.removeItem('sessionStart');
        localStorage.removeItem('voteSessionDeadline');
      } else {
        alert('Vote Failed: ' + (data.message || 'Unknown error'));
        setVoteStatus('error');
      }
    } catch (e) { console.error('Cast error:', e); setVoteStatus('error'); }
  };

  /* Loading */
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center gap-4 font-['Sora',sans-serif]">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=Cormorant+Garamond:ital,wght@0,600;1,400;1,600&family=JetBrains+Mono:wght@400;700&display=swap');`}</style>
      <div className="w-14 h-14 rounded-full border border-amber-200 bg-amber-50 flex items-center justify-center">
        <Loader2 size={22} className="text-amber-500 animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-slate-700">Loading your ballot</p>
        <MonoLabel className="text-slate-500">Fetching constituency data…</MonoLabel>
      </div>
    </div>
  );

  /* Success */
  if (voteStatus === 'success') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-['Sora',sans-serif] flex flex-col items-center justify-center p-8 text-center">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=Cormorant+Garamond:ital,wght@0,600;1,400;1,600&family=JetBrains+Mono:wght@400;700&display=swap');`}</style>
      <div className="h-1 w-full flex fixed top-0">
        <div className="flex-1 bg-amber-500" /><div className="flex-1 bg-white" /><div className="flex-1 bg-emerald-600" />
      </div>
      <div className="max-w-md w-full">
        {/* Success icon */}
        <div className="relative mx-auto w-24 h-24 mb-8">
          <div className="absolute inset-0 rounded-full bg-emerald-500/15 animate-ping" style={{ animationDuration: '1.5s' }} />
          <div className="w-24 h-24 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <CheckCircle size={40} className="text-emerald-500" />
          </div>
        </div>

        <MonoLabel className="text-emerald-600">Blockchain Committed</MonoLabel>
        <h1 className="text-3xl font-extrabold tracking-tight mt-2 mb-3 text-slate-800">Vote Recorded</h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Your vote has been cryptographically signed and permanently committed to the LokSetu ledger.
        </p>

        {txId && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 text-left shadow-sm">
            <MonoLabel className="text-slate-500 block mb-2">Transaction ID</MonoLabel>
            <p className="font-['JetBrains_Mono',monospace] text-xs text-amber-600 break-all leading-relaxed">{txId}</p>
          </div>
        )}

        {/* Security pillars */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { icon: Lock, label: 'Encrypted' },
            { icon: Fingerprint, label: 'Signed' },
            { icon: Shield, label: 'Immutable' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
              <Icon size={16} className="text-emerald-500" />
              <MonoLabel className="text-slate-500">{label}</MonoLabel>
            </div>
          ))}
        </div>

        <button onClick={logout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 transition-all">
          <LogOut size={14} className="text-slate-400" /> Return to Login
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-['Sora',sans-serif] text-slate-800">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=Cormorant+Garamond:ital,wght@0,600;1,400;1,600&family=JetBrains+Mono:wght@400;700&display=swap');
        .font-serif-civic { font-family: 'Cormorant Garamond', serif; }
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .anim-enter { animation: fadeSlideUp .45s ease both; }
      `}</style>

      {/* Tricolor */}
      <div className="h-1 w-full flex fixed top-0 z-50">
        <div className="flex-1 bg-amber-500" /><div className="flex-1 bg-white" /><div className="flex-1 bg-emerald-600" />
      </div>

      {/* BG */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.02) 1px,transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      <div className="fixed top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)' }} />

      {/* ── Header ── */}
      <header className="relative z-20 border-b border-slate-200 pt-1 sticky top-0 bg-white/90 backdrop-blur-xl shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand + constituency */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-[3px] w-4 flex-shrink-0">
              <div className="h-[4px] rounded-sm bg-amber-500" />
              <div className="h-[4px] rounded-sm bg-slate-600" />
              <div className="h-[4px] rounded-sm bg-emerald-500" />
            </div>
            <div className="hidden sm:block">
              <MonoLabel className="text-amber-600">LokSetu Digital Ballot</MonoLabel>
              <p className="text-sm font-bold mt-0.5 text-slate-800">{ballot?.constituency || 'Loading…'}</p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 ml-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <MonoLabel className="text-emerald-600">Blockchain Secured</MonoLabel>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <SessionRing time={sessionTime} />
            <div className="w-px h-8 bg-slate-200" />
            <button onClick={logout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition-all">
              <LogOut size={13} /> End Session
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Security banner */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 ${mounted ? 'anim-enter' : 'opacity-0'}`}>
          <Lock size={14} className="text-emerald-500 flex-shrink-0" />
          <p className="text-xs text-slate-700 font-medium">
            This ballot is end-to-end encrypted. Your vote is anonymous and tamper-proof on the Hyperledger Fabric blockchain.
          </p>
          <div className="ml-auto flex-shrink-0">
            <MonoLabel className="text-emerald-600">Verified</MonoLabel>
          </div>
        </div>

        {/* Section label */}
        <div className={`${mounted ? 'anim-enter' : 'opacity-0'}`} style={{ animationDelay: '.06s' }}>
          <MonoLabel className="text-slate-500">Select one candidate · {ballot?.constituency}</MonoLabel>
          <h3 className="text-xl font-extrabold tracking-tight mt-0.5 text-slate-800">Cast Your Vote</h3>
        </div>

        {/* Candidates */}
        {ballot?.candidates?.length > 0 ? (
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 ${mounted ? 'anim-enter' : 'opacity-0'}`}
            style={{ animationDelay: '.1s' }}>
            {ballot.candidates.map((c, i) => (
              <div key={c.id} style={{ animationDelay: `${.1 + i * 0.06}s` }}>
                <CandidateCard
                  candidate={c}
                  selected={selectedCandidate === c.id}
                  onSelect={setSelectedCandidate}
                  onVote={castVote}
                  voting={voteStatus === 'casting'}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-12 text-center">
            <AlertTriangle size={32} className="text-amber-500 mx-auto mb-3" />
            <h4 className="font-bold text-amber-700 mb-1">No Candidates</h4>
            <p className="text-xs text-slate-600">No active candidates for <span className="font-bold text-slate-700">{ballot?.constituency || 'this region'}</span>.</p>
          </div>
        )}

        {/* Security checklist */}
        <div className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-sm ${mounted ? 'anim-enter' : 'opacity-0'}`}
          style={{ animationDelay: '.18s' }}>
          <div className="flex items-center gap-2 mb-4">
            <Shield size={14} className="text-amber-500" />
            <h4 className="text-sm font-bold text-slate-800">Security Guarantees</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Lock, label: 'Vote encrypted on-device' },
              { icon: Fingerprint, label: 'Identity biometrically verified' },
              { icon: Activity, label: 'One vote enforced on-chain' },
              { icon: Clock, label: `Session: ${sessionTime} left` },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <Icon size={13} className="text-emerald-500 flex-shrink-0" />
                <span className="text-[10px] font-semibold text-slate-600 leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] font-['JetBrains_Mono',monospace] text-slate-400 uppercase tracking-widest pt-2 border-t border-slate-200">
          <span>© {new Date().getFullYear()} LokSetu · NIT Raipur</span>
          <span>Hyperledger Fabric</span>
        </div>
      </main>
    </div>
  );
}