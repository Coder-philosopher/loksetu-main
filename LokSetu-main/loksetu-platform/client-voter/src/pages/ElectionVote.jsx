import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, CheckCircle, AlertTriangle, LogOut, Vote, Loader2, Lock, Fingerprint, Clock, ArrowLeft } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const SESSION_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

const ElectionVote = () => {
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

  // Behavioral tracking refs
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

  // Behavioral tracking
  useEffect(() => {
    const b = behavioralRef.current;

    const onMouseMove = () => {
      b.mouseMovements++;
      lastActivityRef.current = Date.now();
    };
    const onClick = () => {
      b.clickCount++;
      lastActivityRef.current = Date.now();
    };
    const onKeyDown = () => {
      b.keystrokes++;
      lastActivityRef.current = Date.now();
    };
    const onScroll = () => {
      b.scrollEvents++;
      lastActivityRef.current = Date.now();
    };
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

  // Fetch ballot for specific election
  useEffect(() => {
    const fetchBallot = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');

        if (!token) {
          navigate('/');
          return;
        }

        // Fetch ballot (generic endpoint)
        const ballotResponse = await fetch(`${API_BASE_URL}/api/v1/ballot/?electionId=${encodeURIComponent(electionId)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!ballotResponse.ok) {
          if (ballotResponse.status === 401) {
            localStorage.removeItem('token');
            navigate('/');
            return;
          }
          throw new Error('Failed to fetch ballot');
        }

        const ballotData = await ballotResponse.json();

        // Fetch election info
        const electionResponse = await fetch(`${API_BASE_URL}/api/v1/admin/elections/${electionId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        let electionData = null;
        if (electionResponse.ok) {
          electionData = await electionResponse.json();
        }

        setBallot({
          ...ballotData,
          // Backend /ballot endpoint is already election-aware via electionId query.
          candidates: ballotData.candidates || []
        });
        setElectionInfo(electionData);
        setError(null);
      } catch (err) {
        console.error('Ballot fetch error:', err);
        setError(err.message || 'Failed to load ballot');
      } finally {
        setLoading(false);
      }
    };

    fetchBallot();
  }, [electionId, navigate]);

  // Session timer
  useEffect(() => {
    let deadline = Number(localStorage.getItem('voteSessionDeadline'));
    if (!deadline || Number.isNaN(deadline)) {
      deadline = Date.now() + SESSION_LIMIT_MS;
      localStorage.setItem('voteSessionDeadline', deadline);
    }

    const interval = setInterval(() => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        logout();
      } else {
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        setSessionTime(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [logout]);

  const castVote = async () => {
    if (!selectedCandidate) {
      setError('Please select a candidate');
      return;
    }

    try {
      setVoteStatus('submitting');
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_BASE_URL}/api/v1/ballot/cast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          candidate_id: selectedCandidate.id,
          election_id: electionId,
          sessionDuration: Date.now() - (Number(localStorage.getItem('sessionStart')) || Date.now()),
          behavioral: behavioralRef.current
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to cast vote');
      }

      setTxId(data.transactionId);
      setVoteStatus('success');

      // Redirect after delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    } catch (err) {
      console.error('Vote error:', err);
      setError(err.message);
      setVoteStatus('error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-700">Loading ballot...</p>
        </div>
      </div>
    );
  }

  if (voteStatus === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4 animate-bounce" />
          <h2 className="text-2xl font-bold text-green-900 mb-2">Vote Recorded!</h2>
          <p className="text-gray-600 mb-4">
            Your vote has been successfully recorded on the LokSetu Ledger.
          </p>
          {txId && (
            <div className="bg-gray-50 p-3 rounded-lg mb-4 text-left">
              <p className="text-xs text-gray-600">Transaction ID</p>
              <p className="font-mono text-sm text-gray-900 break-all">{txId}</p>
            </div>
          )}
          <p className="text-sm text-gray-600">
            Redirecting to dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 transition"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Secure Voting Booth</h1>
              {ballot && <p className="text-sm text-gray-600">{ballot.constituency}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-600">Session Time</p>
              <p className="font-mono text-lg font-bold text-red-600">{sessionTime}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Election Info Card */}
        {electionInfo && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8 border-l-4 border-indigo-600">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{electionInfo.name}</h2>
            <p className="text-gray-600">{electionInfo.description}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-red-900">Error</h4>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Candidates Grid */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-6">Select Your Candidate</h3>

          {ballot && ballot.candidates.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <AlertTriangle className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
              <h4 className="font-semibold text-yellow-900 mb-2">No Candidates Available</h4>
              <p className="text-yellow-800">
                No candidates found for your constituency in this election.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ballot && ballot.candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  onClick={() => setSelectedCandidate(candidate)}
                  className={`cursor-pointer rounded-lg border-2 p-6 transition transform hover:scale-105 ${
                    selectedCandidate?.id === candidate.id
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                      : 'border-gray-200 bg-white hover:border-indigo-300 shadow-md'
                  }`}
                >
                  {candidate.symbol_url && (
                    <div className="mb-4 flex justify-center">
                      <img
                        src={candidate.symbol_url}
                        alt={candidate.party}
                        className="w-16 h-16 object-contain"
                      />
                    </div>
                  )}

                  <h4 className="text-lg font-bold text-gray-900 text-center mb-2">
                    {candidate.name}
                  </h4>
                  <p className="text-center text-indigo-600 font-semibold mb-4">
                    {candidate.party}
                  </p>

                  {selectedCandidate?.id === candidate.id && (
                    <div className="flex justify-center">
                      <div className="bg-indigo-600 text-white px-4 py-2 rounded-full flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        <span>Selected</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Safety Notice */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6 flex items-start gap-4">
          <Shield className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">Secure & Anonymous Voting</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>✓ Your vote is encrypted and recorded on the blockchain</li>
              <li>✓ Complete anonymity is maintained</li>
              <li>✓ Each voter can vote only once per election</li>
              <li>✓ This session will expire in {sessionTime}</li>
            </ul>
          </div>
        </div>

        {/* Vote Button */}
        <div className="mt-8 flex gap-4 justify-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3 bg-gray-100 text-gray-900 rounded-lg font-semibold hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={castVote}
            disabled={!selectedCandidate || voteStatus === 'submitting'}
            className={`px-8 py-3 rounded-lg font-semibold flex items-center gap-2 transition ${
              !selectedCandidate || voteStatus === 'submitting'
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
            }`}
          >
            {voteStatus === 'submitting' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Recording Vote...
              </>
            ) : (
              <>
                <Vote className="w-5 h-5" />
                Confirm Vote
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
};

export default ElectionVote;
