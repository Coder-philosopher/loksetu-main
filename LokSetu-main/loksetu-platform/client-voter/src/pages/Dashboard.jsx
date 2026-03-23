import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Vote, Clock, CheckCircle, AlertCircle, Loader2, Shield, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [voter, setVoter] = useState(null);
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchElections = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');

        if (!token) {
          navigate('/');
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/v1/ballot/elections/active`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('token');
            navigate('/');
            return;
          }
          throw new Error('Failed to fetch elections');
        }

        const data = await response.json();
        setVoter(data.voter);
        setElections(data.elections);
        setError(null);
      } catch (err) {
        console.error('Election fetch error:', err);
        setError(err.message || 'Failed to load elections');
      } finally {
        setLoading(false);
      }
    };

    fetchElections();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('sessionStart');
    localStorage.removeItem('voteSessionDeadline');
    navigate('/');
  };

  const handleVoteNow = (electionId) => {
    navigate(`/vote/${electionId}`);
  };

  const getElectionTypeLabel = (type) => {
    const typeMap = {
      'VS': 'Vidhan Sabha',
      'LS': 'Lok Sabha',
      'MCD': 'Municipal Ward'
    };
    return typeMap[type] || type;
  };

  const getTimeRemaining = (endTime) => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end - now;

    if (diff <= 0) return 'Ended';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-700">{t('Loading elections', 'Loading elections...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">LokSetu Elections</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Voter Profile Card */}
        {voter && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-100 rounded-full p-4">
                  <User className="w-8 h-8 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{voter.name}</h2>
                  <p className="text-gray-600 mt-1">EPIC ID: <span className="font-mono font-semibold">{voter.epicId}</span></p>
                  <p className="text-gray-600">State: <span className="font-semibold">{voter.state}</span></p>
                </div>
              </div>
              <div className="flex gap-4">
                {voter.hasPassword && (
                  <div className="text-center px-3 py-2 bg-green-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                    <p className="text-xs text-green-800">Password Set</p>
                  </div>
                )}
                {voter.hasFaceSetToken && (
                  <div className="text-center px-3 py-2 bg-green-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                    <p className="text-xs text-green-800">Face Verified</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Elections Heading */}
        <div className="mb-6">
          <h3 className="text-3xl font-bold text-gray-900">Active Elections</h3>
          <p className="text-gray-600 mt-2">
            {elections.length === 0
              ? 'No active elections available at this time'
              : `${elections.filter(e => !e.hasVoted).length} election(s) available to vote`}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-red-900">Error</h4>
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Elections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {elections.map((election) => (
            <div
              key={election.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition overflow-hidden flex flex-col"
            >
              {/* Election Status Badge */}
              <div className="bg-gradient-to-r from-indigo-500 to-blue-600 p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-block px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-semibold">
                    {getElectionTypeLabel(election.election_type)}
                  </span>
                  {election.hasVoted ? (
                    <div className="flex items-center gap-1 px-3 py-1 bg-green-500 rounded-full text-sm">
                      <CheckCircle className="w-4 h-4" />
                      <span>Voted</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-3 py-1 bg-yellow-500 rounded-full text-sm">
                      <Clock className="w-4 h-4" />
                      <span>Open</span>
                    </div>
                  )}
                </div>
                <h4 className="text-lg font-bold">{election.name}</h4>
              </div>

              {/* Election Details */}
              <div className="p-5 flex-grow flex flex-col">
                {election.description && (
                  <p className="text-gray-600 text-sm mb-4">{election.description}</p>
                )}

                <div className="space-y-3 flex-grow">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <span className="text-gray-700">
                      <span className="font-semibold text-gray-900">{getTimeRemaining(election.end_time)}</span>
                    </span>
                  </div>

                  <div className="text-xs text-gray-500">
                    <p>
                      Opens: {new Date(election.start_time).toLocaleString()}
                    </p>
                    <p>
                      Closes: {new Date(election.end_time).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Vote Button */}
                <button
                  onClick={() => handleVoteNow(election.id)}
                  disabled={election.hasVoted}
                  className={`w-full mt-4 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
                    election.hasVoted
                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                  }`}
                >
                  <Vote className="w-5 h-5" />
                  {election.hasVoted ? 'Already Voted' : 'Vote Now'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {elections.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Elections</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              There are currently no active elections available. Check back later for voting opportunities.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
