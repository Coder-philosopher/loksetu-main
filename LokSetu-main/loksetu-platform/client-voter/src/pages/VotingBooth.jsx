import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Shield, CheckCircle, AlertTriangle, LogOut, Vote, Loader2, Lock, Fingerprint, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const SESSION_LIMIT_MS = 2 * 60 * 1000;

const VotingBooth = () => {
  const navigate = useNavigate();
  const [ballot, setBallot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voteStatus, setVoteStatus] = useState('idle'); 
  const [txId, setTxId] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [sessionTime, setSessionTime] = useState('02:00');

  // Behavioral tracking refs (avoid re-renders)
  const behavioralRef = useRef({
    mouseMovements: 0,
    clickCount: 0,
    keystrokes: 0,
    scrollEvents: 0,
    idleTime: 0,
    pageVisibility: 0,
  });
  const lastActivityRef = useRef(Date.now());
  const idleCheckRef = useRef(null);
  const visibilityStartRef = useRef(document.hidden ? 0 : Date.now());

  // Set up behavioral tracking
  useEffect(() => {
    const b = behavioralRef.current;
    
    const onMouseMove = () => { b.mouseMovements++; lastActivityRef.current = Date.now(); };
    const onClick = () => { b.clickCount++; lastActivityRef.current = Date.now(); };
    const onKeyDown = () => { b.keystrokes++; lastActivityRef.current = Date.now(); };
    const onScroll = () => { b.scrollEvents++; lastActivityRef.current = Date.now(); };
    const onVisibilityChange = () => {
      if (document.hidden) {
        b.pageVisibility += Date.now() - visibilityStartRef.current;
      } else {
        visibilityStartRef.current = Date.now();
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Idle time tracking: check every 2s if user has been idle > 5s
    idleCheckRef.current = setInterval(() => {
      if (Date.now() - lastActivityRef.current > 5000) {
        b.idleTime += 2000;
      }
    }, 2000);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(idleCheckRef.current);
    };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('sessionStart');
    localStorage.removeItem('voteSessionDeadline');
    navigate('/');
  }, [navigate]);

  // Session countdown timer (2 minutes)
  useEffect(() => {
    let deadline = Number(localStorage.getItem('voteSessionDeadline'));
    if (!deadline || Number.isNaN(deadline)) {
      deadline = Date.now() + SESSION_LIMIT_MS;
      localStorage.setItem('voteSessionDeadline', String(deadline));
    }

    const tick = () => {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        setSessionTime('00:00');
        alert('Session timed out after 2 minutes. Please login again.');
        logout();
        return;
      }

      const remainingSec = Math.floor(remainingMs / 1000);
      const m = String(Math.floor(remainingSec / 60)).padStart(2, '0');
      const s = String(remainingSec % 60).padStart(2, '0');
      setSessionTime(`${m}:${s}`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [logout]);

  useEffect(() => {
    const fetchBallot = async () => {
      const token = localStorage.getItem('token');
      if (!token) return navigate("/");

      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/ballot`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true' 
          }
        });

        if (res.status === 403 || res.status === 401) {
          alert("Session expired. Please login again.");
          return navigate("/");
        }

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Invalid server response.");
        }

        setBallot(await res.json());
      } catch (error) {
        console.error("Ballot Fetch Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBallot();
  }, [navigate]);

  const castVote = async (candidateId) => {
    if (!window.confirm("Confirm your vote? This action is permanent and recorded on the blockchain.")) return;

    setVoteStatus('casting');
    const token = localStorage.getItem('token');
    
    // Calculate session duration for behavioral analysis
    const sessionStart = localStorage.getItem('sessionStart');
    const sessionDuration = sessionStart ? Date.now() - parseInt(sessionStart) : undefined;

    // Finalize visibility tracking
    if (!document.hidden) {
      behavioralRef.current.pageVisibility += Date.now() - visibilityStartRef.current;
    }

    const behavioral = {
      mouseMovements: behavioralRef.current.mouseMovements,
      clickCount: behavioralRef.current.clickCount,
      keystrokes: behavioralRef.current.keystrokes,
      scrollEvents: behavioralRef.current.scrollEvents,
      idleTime: behavioralRef.current.idleTime,
      pageVisibility: behavioralRef.current.pageVisibility,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      touchCapable: 'ontouchstart' in window,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/ballot/cast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true' 
        },
        body: JSON.stringify({ candidate_id: candidateId, sessionDuration, behavioral })
      });

      const data = await res.json();

      if (res.ok) {
        setVoteStatus('success');
        setTxId(data.transactionId);
        localStorage.removeItem('sessionStart');
        localStorage.removeItem('voteSessionDeadline');
      } else {
        alert("Vote Failed: " + (data.message || "Unknown error"));
        setVoteStatus('error');
      }
    } catch (error) {
      console.error("Casting Error:", error);
      setVoteStatus('error');
    }
  };

  // Loading State
  if (loading) return (
    <div className="min-h-screen bg-gov-grey flex flex-col items-center justify-center gap-4 font-gov">
      <Loader2 size={28} className="animate-spin text-gov-blue" />
      <p className="text-gov-text-light font-medium text-sm">Loading your ballot...</p>
    </div>
  );

  // Success State
  if (voteStatus === 'success') {
    return (
      <div className="min-h-screen bg-gov-blue flex flex-col items-center justify-center p-8 text-center animate-fade-in font-gov">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse-ring" />
          <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center">
            <CheckCircle size={56} className="text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-extrabold text-white mb-2">Vote Recorded</h1>
        <p className="text-blue-200 mb-8 max-w-md">
          Your vote has been cryptographically signed and committed to the LokSetu blockchain. It cannot be altered.
        </p>
        <div className="bg-black/20 p-5 rounded font-mono text-xs text-blue-200 break-all max-w-lg border border-white/20 mb-6">
          <p className="text-[10px] text-blue-300/60 uppercase tracking-wider mb-2 font-sans font-bold">Transaction ID</p>
          {txId}
        </div>
        <button 
          onClick={logout}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded transition border border-white/20"
        >
          Return to Login
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gov-grey font-gov animate-fade-in">
      
      {/* Tricolor Band */}
      <div className="flex h-1.5">
        <div className="flex-1 bg-gov-saffron" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-gov-green" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-gov-blue border-b border-gov-blue-dark">
        <div className="max-w-6xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">LokSetu Digital Ballot</h1>
              <p className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">Blockchain Secured</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-blue-200">Constituency</p>
              <p className="text-sm font-bold text-white">{ballot?.constituency || "Loading..."}</p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded text-xs font-bold text-blue-200 border border-white/10">
              <Clock size={12} /> {sessionTime}
            </div>
            <button 
              onClick={logout}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10 rounded transition border border-white/20"
            >
              <LogOut size={14} /> End Session
            </button>
          </div>
        </div>
      </header>

      {/* Ballot Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        
        {/* Ballot Security Banner */}
        <div className="flex items-center gap-3 px-5 py-3 bg-gov-green-light border border-green-200 rounded mb-6">
          <Lock size={16} className="text-gov-green shrink-0" />
          <p className="text-xs text-gov-text font-medium">
            This ballot is encrypted end-to-end. Your vote is anonymous and tamper-proof on the blockchain.
          </p>
        </div>

        {/* Candidates Grid */}
        {ballot?.candidates?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ballot.candidates.map((candidate) => {
              const isSelected = selectedCandidate === candidate.id;
              return (
                <div 
                  key={candidate.id} 
                  className={`group bg-white rounded border-2 overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer ${
                    isSelected 
                      ? 'border-gov-blue shadow-md' 
                      : 'border-gov-border hover:border-gov-blue-light'
                  }`}
                  onClick={() => setSelectedCandidate(candidate.id)}
                >
                  {/* Symbol */}
                  <div className="h-28 bg-gray-50 flex items-center justify-center p-5 border-b border-gov-border relative overflow-hidden">
                    <img 
                      src={candidate.symbol_url} 
                      alt={candidate.party} 
                      className="h-18 w-18 object-contain group-hover:scale-105 transition-transform duration-200 relative z-10"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if(e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div style={{ display: 'none' }} className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 rounded bg-blue-50 text-gov-blue flex items-center justify-center text-xl font-extrabold">
                        {candidate.party?.charAt(0)}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gov-blue flex items-center justify-center animate-fade-in">
                        <CheckCircle size={14} className="text-white" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 text-center">
                    <h2 className="text-base font-bold text-gov-text tracking-tight mb-1">
                      {candidate.name}
                    </h2>
                    <p className="text-xs font-bold text-gov-blue uppercase tracking-wider mb-4">
                      {candidate.party}
                    </p>

                    <button 
                      onClick={(e) => { e.stopPropagation(); castVote(candidate.id); }}
                      disabled={voteStatus === 'casting'}
                      className={`w-full py-3 rounded font-bold text-sm transition-all ${
                        isSelected
                          ? 'bg-gov-blue text-white hover:bg-gov-blue-light'
                          : 'bg-gray-100 text-gov-text-light hover:bg-blue-50 hover:text-gov-blue'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {voteStatus === 'casting' ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 size={16} className="animate-spin" /> Committing...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <Vote size={16} /> Cast Vote
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded border-2 border-dashed border-gov-border">
            <AlertTriangle className="mx-auto mb-4 text-gov-text-light" size={40} />
            <h3 className="text-base font-bold text-gov-text">No Candidates Found</h3>
            <p className="text-gov-text-light text-sm mt-2">
              No active candidates for <span className="font-bold">{ballot?.constituency || "this region"}</span>.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gov-blue text-white mt-8">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-blue-200">
          <span>LokSetu Secure Voting System &copy; {new Date().getFullYear()}</span>
          <span>Powered by Hyperledger Fabric</span>
        </div>
      </footer>
    </div>
  );
};

export default VotingBooth;