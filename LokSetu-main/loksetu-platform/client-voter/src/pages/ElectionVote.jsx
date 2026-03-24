import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Shield, CheckCircle, AlertTriangle, LogOut, Vote, Loader2,
  Clock, ArrowLeft, Lock, Fingerprint, ChevronRight, BarChart3,
  Activity, Zap
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const SESSION_LIMIT_MS = 5 * 60 * 1000;

/* ─── Primitives ──────────────────────────────────────────── */
const MonoLabel = ({ children, className = '' }) => (
  <span className={`font-['JetBrains_Mono',monospace] text-[9px] font-bold uppercase tracking-[2.5px] ${className}`}>
    {children}
  </span>
);

const SessionTimer = ({ time }) => {
  const [mins, secs] = time.split(':').map(Number);
  const totalSecs = mins * 60 + secs;
  const urgent = totalSecs < 60;
  const pct = Math.min(100, (totalSecs / 300) * 100);
  return (
    <div className="flex items-center gap-3">
      <div>
        <MonoLabel className="text-slate-500">Session</MonoLabel>
        <div className={`font-['JetBrains_Mono',monospace] text-lg font-bold leading-tight ${urgent ? 'text-red-600' : 'text-slate-800'}`}>
          {time}
        </div>
      </div>
      <div className="w-8 h-8 relative flex-shrink-0">
        <svg viewBox="0 0 32 32" className="-rotate-90 w-full h-full">
          <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="3" />
          <circle cx="16" cy="16" r="13" fill="none"
            stroke={urgent ? '#dc2626' : '#f59e0b'}
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 13}`}
            strokeDashoffset={`${2 * Math.PI * 13 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
      </div>
    </div>
  );
};

/* ─── Candidate card ──────────────────────────────────────── */
const CandidateCard = ({ candidate, selected, onSelect, onVote, voting }) => (
  <div
    onClick={() => onSelect(candidate)}
    className={`relative rounded-2xl border-2 overflow-hidden cursor-pointer transition-all duration-300 flex flex-col group shadow-sm
      ${selected
        ? 'border-amber-500 bg-amber-50 shadow-[0_0_0_1px_rgba(245,158,11,0.15),0_20px_40px_rgba(0,0,0,0.08)]'
        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
  >
    {/* Top accent line */}
    <div className={`h-1 w-full transition-all ${selected ? 'bg-amber-500' : 'bg-transparent group-hover:bg-slate-200'}`} />

    {/* Symbol area */}
    <div className={`relative flex items-center justify-center p-8 border-b transition-colors
      ${selected ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100 bg-white'}`}>
      {candidate.symbol_url ? (
        <img src={candidate.symbol_url} alt={candidate.party}
          className="w-20 h-20 object-contain drop-shadow group-hover:scale-105 transition-transform duration-300"
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
        />
      ) : null}
      <div className="hidden w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 items-center justify-center text-2xl font-extrabold text-amber-600">
        {candidate.party?.charAt(0)}
      </div>

      {/* Selected check */}
      {selected && (
        <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.4)]">
          <CheckCircle size={15} className="text-white" />
        </div>
      )}
    </div>

    {/* Info */}
    <div className="p-5 flex flex-col gap-3 flex-1">
      <div className="text-center">
        <h4 className="text-base font-extrabold tracking-tight text-slate-800">{candidate.name}</h4>
        <p className={`text-xs font-bold uppercase tracking-wider mt-1 ${selected ? 'text-amber-600' : 'text-slate-500'}`}>
          {candidate.party}
        </p>
      </div>

      <button
        onClick={e => { e.stopPropagation(); onVote(candidate.id); }}
        disabled={voting || !selected}
        className={`mt-auto py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
          ${selected
            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-[0_4px_16px_rgba(245,158,11,0.25)] active:scale-[0.97]'
            : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
          } disabled:opacity-60`}
      >
        {voting && selected ? (
          <><Loader2 size={14} className="animate-spin" /> Recording…</>
        ) : (
          <><Vote size={14} /> Cast Vote</>
        )}
      </button>
    </div>
  </div>
);

/* ─── Main ───────────────────────────────────────────────── */
export default function ElectionVote() {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const [ballot, setBallot] = useState(null);
  const [electionInfo, setElectionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voteStatus, setVoteStatus] = useState('idle');
  const [txId, setTxId] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [sessionTime, setSessionTime] = useState('05:00');
  const [error, setError] = useState(null);
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
    window.addEventListener('mousemove', mm);
    window.addEventListener('click', cl);
    window.addEventListener('keydown', kd);
    window.addEventListener('scroll', sc);
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

  // Fetch ballot
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/'); return; }
        const [br, er] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/ballot/?electionId=${encodeURIComponent(electionId)}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/v1/admin/elections/${electionId}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!br.ok) { if (br.status === 401) { localStorage.removeItem('token'); navigate('/'); return; } throw new Error('Failed to fetch ballot'); }
        const [bd, ed] = await Promise.all([br.json(), er.ok ? er.json() : null]);
        setBallot({ ...bd, candidates: bd.candidates || [] });
        setElectionInfo(ed);
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    })();
  }, [electionId, navigate]);

  // Session timer
  useEffect(() => {
    let deadline = Number(localStorage.getItem('voteSessionDeadline'));
    if (!deadline || isNaN(deadline)) { deadline = Date.now() + SESSION_LIMIT_MS; localStorage.setItem('voteSessionDeadline', deadline); }
    const iv = setInterval(() => {
      const r = deadline - Date.now();
      if (r <= 0) { logout(); return; }
      const m = Math.floor(r / 60000), s = Math.floor((r % 60000) / 1000);
      setSessionTime(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(iv);
  }, [logout]);

  const castVote = async (candidateId) => {
    if (!selectedCandidate) return;
    setVoteStatus('submitting');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/api/v1/ballot/cast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          candidate_id: candidateId, election_id: electionId,
          sessionDuration: Date.now() - (Number(localStorage.getItem('sessionStart')) || Date.now()),
          behavioral: behavioralRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to cast vote');
      setTxId(data.transactionId);
      setVoteStatus('success');
      setTimeout(() => navigate('/dashboard'), 4000);
    } catch (err) { setError(err.message); setVoteStatus('error'); }
  };

  /* Loading */
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center gap-4 font-['Sora',sans-serif]">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=Cormorant+Garamond:ital,wght@0,600;1,400;1,600&family=JetBrains+Mono:wght@400;700&display=swap');`}</style>
      <div className="w-14 h-14 rounded-full border border-amber-200 bg-amber-50 flex items-center justify-center">
        <Loader2 size={22} className="text-amber-500 animate-spin" />
      </div>
      <p className="text-sm font-bold text-slate-700">Loading ballot…</p>
    </div>
  );

  /* Success */
  if (voteStatus === 'success') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-8 font-['Sora',sans-serif]">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=Cormorant+Garamond:ital,wght@0,600;1,400;1,600&family=JetBrains+Mono:wght@400;700&display=swap');`}</style>
      <div className="h-1 w-full flex fixed top-0"><div className="flex-1 bg-amber-500"/><div className="flex-1 bg-white"/><div className="flex-1 bg-emerald-600"/></div>
      <div className="max-w-md w-full text-center">
        <div className="relative mx-auto w-20 h-20 mb-6">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '1.5s' }} />
          <div className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center relative">
            <CheckCircle size={36} className="text-emerald-500" />
          </div>
        </div>
        <MonoLabel className="text-emerald-600">Vote Recorded</MonoLabel>
        <h2 className="text-3xl font-extrabold tracking-tight mt-2 mb-3 text-slate-800">Ballot Committed</h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Your vote has been cryptographically signed and committed to the LokSetu blockchain. It cannot be altered.
        </p>
        {txId && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 text-left shadow-sm">
            <MonoLabel className="text-slate-500 block mb-1.5">Transaction ID</MonoLabel>
            <p className="font-['JetBrains_Mono',monospace] text-xs text-amber-600 break-all">{txId}</p>
          </div>
        )}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
          <Loader2 size={12} className="animate-spin text-slate-400" />
          Redirecting to dashboard…
        </div>
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

      {/* Tricolor stripe */}
      <div className="h-1 w-full flex fixed top-0 z-50">
        <div className="flex-1 bg-amber-500" /><div className="flex-1 bg-white" /><div className="flex-1 bg-emerald-600" />
      </div>

      {/* BG */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.02) 1px,transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      <div className="fixed top-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)' }} />

      {/* ── Header ── */}
      <header className="relative z-20 border-b border-slate-200 pt-1 sticky top-0 bg-white/90 backdrop-blur-xl shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-2 transition-all hover:bg-slate-50">
              <ArrowLeft size={13} /> Dashboard
            </button>
            <div className="hidden sm:block w-px h-6 bg-slate-200" />
            <div className="hidden sm:block">
              <MonoLabel className="text-amber-600">Secure Voting Booth</MonoLabel>
              <p className="text-sm font-bold mt-0.5 text-slate-800">{ballot?.constituency || 'Loading…'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <SessionTimer time={sessionTime} />
            <div className="w-px h-8 bg-slate-200" />
            <button onClick={logout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition-all">
              <LogOut size={13} /> Exit
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Election info card */}
        {electionInfo && (
          <div className={`rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-4 shadow-sm ${mounted ? 'anim-enter' : 'opacity-0'}`}>
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
              <Vote size={18} className="text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <MonoLabel className="text-amber-600">Active Election</MonoLabel>
              <h2 className="text-lg font-extrabold tracking-tight mt-0.5 truncate text-slate-800">{electionInfo.name}</h2>
              {electionInfo.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{electionInfo.description}</p>}
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full border border-emerald-200 bg-emerald-50 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <MonoLabel className="text-emerald-600">Polls Open</MonoLabel>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-red-200 bg-red-50">
            <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs font-semibold text-red-700">{error}</p>
          </div>
        )}

        {/* Section header */}
        <div className={`${mounted ? 'anim-enter' : 'opacity-0'}`} style={{ animationDelay: '.08s' }}>
          <MonoLabel className="text-slate-500">Select one candidate</MonoLabel>
          <h3 className="text-xl font-extrabold tracking-tight mt-0.5 text-slate-800">Cast Your Vote</h3>
        </div>

        {/* Candidates */}
        {ballot?.candidates?.length > 0 ? (
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 ${mounted ? 'anim-enter' : 'opacity-0'}`}
            style={{ animationDelay: '.12s' }}>
            {ballot.candidates.map((c, i) => (
              <div key={c.id} style={{ animationDelay: `${.12 + i * 0.06}s` }}>
                <CandidateCard
                  candidate={c}
                  selected={selectedCandidate?.id === c.id}
                  onSelect={setSelectedCandidate}
                  onVote={castVote}
                  voting={voteStatus === 'submitting'}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center">
            <AlertTriangle size={32} className="text-amber-500 mx-auto mb-3" />
            <h4 className="font-bold text-amber-700 mb-1">No Candidates Available</h4>
            <p className="text-xs text-slate-600">No candidates found for your constituency in this election.</p>
          </div>
        )}

        {/* Security strip */}
        <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${mounted ? 'anim-enter' : 'opacity-0'}`}
          style={{ animationDelay: '.2s' }}>
          <div className="flex items-center gap-2 mb-4">
            <Shield size={15} className="text-amber-500" />
            <h4 className="text-sm font-bold text-slate-800">Secure & Anonymous Voting</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Lock, text: 'End-to-end encrypted ballot' },
              { icon: Fingerprint, text: 'Biometric identity verified' },
              { icon: Activity, text: 'One vote per election enforced' },
              { icon: Clock, text: `Session expires: ${sessionTime}` },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <Icon size={13} className="text-emerald-500 flex-shrink-0" />
                <span className="text-[10px] font-semibold text-slate-600 leading-tight">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between gap-4">
          <button onClick={() => navigate('/dashboard')}
            className="px-5 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-all hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={() => castVote(selectedCandidate?.id)}
            disabled={!selectedCandidate || voteStatus === 'submitting'}
            className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-white shadow-[0_4px_20px_rgba(245,158,11,0.25)] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]">
            {voteStatus === 'submitting' ? (
              <><Loader2 size={15} className="animate-spin" /> Recording Vote…</>
            ) : (
              <><Vote size={15} /> Confirm Vote <ChevronRight size={14} /></>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between text-[10px] font-['JetBrains_Mono',monospace] text-slate-400 uppercase tracking-widest pt-2 border-t border-slate-200">
          <span>© {new Date().getFullYear()} LokSetu · NIT Raipur</span>
          <span>Hyperledger Fabric</span>
        </div>
      </main>
    </div>
  );
}