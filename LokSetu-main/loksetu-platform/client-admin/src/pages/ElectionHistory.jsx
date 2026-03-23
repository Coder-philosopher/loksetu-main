import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, Eye, Calendar, Users, Vote, TrendingUp, Play } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const ElectionHistory = () => {
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchElections = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API}/api/v1/admin/elections`);
      const data = await response.json();
      if (response.ok && data.elections) {
        // Sort by created_at descending
        const sorted = (data.elections || []).sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        );
        setElections(sorted);
        if (sorted.length > 0 && !selectedElection) {
          setSelectedElection(sorted[0]);
        }
      } else {
        setError(data.message || 'Failed to fetch elections.');
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchElections();
  }, []);

  const handleElectionSelect = async (election) => {
    setSelectedElection(election);
    setError('');
  };

  const handleStatusChange = async (electionId, newStatus) => {
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API}/api/v1/admin/elections/${electionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update election status.');
      }

      setSuccess(`Election status updated to "${newStatus}".`);

      // Refresh elections list
      await fetchElections();
    } catch (err) {
      setError(err.message || 'Failed to update election.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'badge-amber';
      case 'active': return 'badge-green';
      case 'completed': return 'badge-blue';
      case 'cancelled': return 'badge-red';
      default: return 'badge-gray';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <Play size={12} />;
      case 'completed': return <CheckCircle2 size={12} />;
      default: return <Calendar size={12} />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="rounded-b-2xl bg-[#5B4DB1] px-6 py-5 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em]">ELECTION HISTORY</p>
            <h2 className="text-2xl font-bold mt-2">ELECTION HISTORY</h2>
            <p className="text-sm text-white/80 mt-2">View all elections and their results</p>
          </div>
          <button
            onClick={fetchElections}
            className="inline-flex items-center gap-2 rounded-md bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-200 transition"
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refresh
          </button>
        </div>
        <div className="mt-4 text-xs text-white/70">Dashboard / Election History</div>
      </div>

      {/* Messages */}
      {error && (
        <div className="dash-card p-4 border-l-4 border-l-red-500 flex gap-3">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="dash-card p-4 border-l-4 border-l-dash-success flex gap-3">
          <CheckCircle2 size={18} className="text-dash-success shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-dash-success">{success}</p>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="dash-card p-8 flex items-center justify-center gap-2 text-dash-text-secondary">
          <Loader2 size={18} className="animate-spin" />
          Loading elections...
        </div>
      ) : elections.length === 0 ? (
        // No Elections
        <div className="dash-card p-8 text-center">
          <Calendar size={28} className="mx-auto text-dash-text-secondary mb-3" />
          <p className="font-semibold text-dash-text">No elections yet</p>
          <p className="text-sm text-dash-text-secondary mt-1">Create an election from the Election Setup panel to get started.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6 items-stretch">
          {/* Elections List (Left) */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-slate-200 bg-white/80 p-4 space-y-2 max-h-96 overflow-y-auto">
              <h3 className="font-bold text-dash-text mb-3 text-sm">All Elections ({elections.length})</h3>
              {elections.map((election) => (
                <button
                  key={election.id}
                  onClick={() => handleElectionSelect(election)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    selectedElection?.id === election.id
                      ? 'border-[#5B4DB1] bg-purple-50'
                      : election.status === 'completed'
                        ? 'border-l-4 border-l-blue-400 border-slate-200 bg-white hover:shadow-md hover:-translate-y-0.5'
                        : election.status === 'cancelled'
                          ? 'border-l-4 border-l-red-400 border-slate-200 bg-white hover:shadow-md hover:-translate-y-0.5'
                          : 'border-l-4 border-l-blue-300 border-slate-200 bg-white hover:shadow-md hover:-translate-y-0.5'
                  } transition`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-dash-text truncate">{election.name}</p>
                      <p className="text-xs text-dash-text-secondary mt-1">
                        {election.election_type === 'LS' && election.lok_sabha_name}
                        {election.election_type === 'VS' && election.constituency_name}
                        {election.election_type === 'MCD' && election.mcd_ward}
                      </p>
                      <p className="text-xs text-dash-text-secondary">
                        {new Date(election.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1 ${
                      election.status === 'completed' ? 'bg-green-100 text-green-700' :
                      election.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      election.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {getStatusIcon(election.status)}
                      {election.status}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Election Details (Right) */}
          {selectedElection && (
            <div className="lg:col-span-2 space-y-4">
              {/* Header Card */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-dash-text">{selectedElection.name}</h3>
                    <p className="text-sm text-dash-text-secondary mt-2">
                      Type: <span className="font-semibold">{
                        selectedElection.election_type === 'LS' ? 'Lok Sabha' :
                        selectedElection.election_type === 'VS' ? 'Vidhan Sabha' : 'MCD Ward'
                      }</span>
                    </p>
                    <p className="text-sm text-dash-text-secondary">
                      Location: <span className="font-semibold">
                        {selectedElection.election_type === 'LS' && selectedElection.lok_sabha_name}
                        {selectedElection.election_type === 'VS' && selectedElection.constituency_name}
                        {selectedElection.election_type === 'MCD' && selectedElection.mcd_ward}
                      </span>
                    </p>
                  </div>
                  <div className={`px-3 py-2 rounded-full text-sm font-bold whitespace-nowrap flex items-center gap-2 ${
                    selectedElection.status === 'completed' ? 'bg-green-100 text-green-700' :
                    selectedElection.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    selectedElection.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {getStatusIcon(selectedElection.status)}
                    {selectedElection.status}
                  </div>
                </div>

                {/* Status Action Buttons */}
                {selectedElection.status === 'pending' && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
                    <button
                      onClick={() => handleStatusChange(selectedElection.id, 'active')}
                      disabled={actionLoading}
                      className="flex-1 btn-success text-sm px-3 py-2 font-bold flex items-center justify-center gap-2"
                    >
                      {actionLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Play size={14} />
                      )}
                      Conduct Election
                    </button>
                    <button
                      onClick={() => handleStatusChange(selectedElection.id, 'cancelled')}
                      disabled={actionLoading}
                      className="flex-1 btn-danger text-sm px-3 py-2 font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {selectedElection.status === 'active' && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
                    <button
                      onClick={() => handleStatusChange(selectedElection.id, 'completed')}
                      disabled={actionLoading}
                      className="flex-1 btn-success text-sm px-3 py-2 font-bold flex items-center justify-center gap-2"
                    >
                      {actionLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      Complete Election
                    </button>
                  </div>
                )}
              </div>

              {/* Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-lg bg-blue-200 flex items-center justify-center text-blue-700">
                      <Users size={20} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-dash-text">
                    {Number(selectedElection.total_registered_voters || 0).toLocaleString()}
                  </p>
                  <p className="text-xs font-medium text-dash-text-secondary mt-1">Registered Voters</p>
                </div>

                <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-lg bg-green-200 flex items-center justify-center text-green-700">
                      <Vote size={20} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-dash-text">
                    {Number(selectedElection.votes_cast || 0).toLocaleString()}
                  </p>
                  <p className="text-xs font-medium text-dash-text-secondary mt-1">Votes Cast</p>
                </div>

                <div className="rounded-xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 rounded-lg bg-yellow-200 flex items-center justify-center text-yellow-700">
                      <TrendingUp size={20} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-dash-text">
                    {Number(selectedElection.turnout_percentage || 0).toFixed(1)}%
                  </p>
                  <p className="text-xs font-medium text-dash-text-secondary mt-1">Turnout Rate</p>
                </div>
              </div>

              {/* Pending Votes Card */}
              <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
                    <RefreshCw size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-dash-text">Pending Votes</p>
                    <p className="text-xs text-dash-text-secondary">Votes awaiting processing</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-purple-700">
                  {Number(selectedElection.pending_votes || 0).toLocaleString()}
                </p>
              </div>

              {/* Description */}
              {selectedElection.description && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold text-dash-text-secondary mb-2">DESCRIPTION</p>
                  <p className="text-sm text-dash-text">{selectedElection.description}</p>
                </div>
              )}

              {/* Timestamps */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-dash-text-secondary">Created:</span>
                  <span className="font-semibold text-dash-text">{new Date(selectedElection.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dash-text-secondary">Updated:</span>
                  <span className="font-semibold text-dash-text">{new Date(selectedElection.updated_at).toLocaleString()}</span>
                </div>
                {selectedElection.scheduled_date && (
                  <div className="flex justify-between">
                    <span className="text-dash-text-secondary">Scheduled:</span>
                    <span className="font-semibold text-dash-text">{new Date(selectedElection.scheduled_date).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ElectionHistory;
