import React, { useEffect, useState, useMemo, useRef } from 'react';
import { CheckCircle2, Loader2, RefreshCw, XCircle, UserCheck, MapPin, IdCard, Search, X, Clock, AlertCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const RegistrationRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const listRef = useRef(null);

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API}/api/v1/admin/registration-requests?status=pending`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Could not load registration requests.');
        setRequests([]);
      } else {
        setRequests(data.requests || []);
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Filter requests based on search query
  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests;
    
    const query = searchQuery.toLowerCase();
    return requests.filter(request => 
      request.full_name.toLowerCase().includes(query) ||
      request.epic_id.toLowerCase().includes(query) ||
      request.constituency_name.toLowerCase().includes(query) ||
      request.lok_sabha_name.toLowerCase().includes(query) ||
      request.mcd_ward.toLowerCase().includes(query)
    );
  }, [requests, searchQuery]);

  const reviewRequest = async (id, action) => {
    setBusyId(id);
    setError('');
    try {
      const response = await fetch(`${API}/api/v1/admin/registration-requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: action === 'approve' ? 'Approved by admin panel' : 'Rejected by admin panel' }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message || `Could not ${action} request.`);
      } else {
        setRequests((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setBusyId('');
    }
  };

  const pendingCount = requests.length;
  const approvedTodayCount = 0;
  const rejectedCount = 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header and Controls */}
      <div className="rounded-b-2xl bg-[#5B4DB1] px-6 py-5 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.3em]">REGISTRATION REQUESTS</p>
            <h2 className="text-2xl font-bold mt-2">Registration Requests</h2>
            <p className="text-sm text-white/80 mt-2">
              Review and approve pending voter enrollment requests. {filteredRequests.length > 0 && `(${filteredRequests.length} found)`}
            </p>
          </div>
          <button
            onClick={fetchRequests}
            className="inline-flex items-center gap-2 rounded-md bg-purple-100 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-200 transition"
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refresh
          </button>
        </div>
        <div className="mt-4 text-xs text-white/70">Dashboard / Registration Requests</div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-[#e0e0ff] bg-white focus-within:border-purple-500 focus-within:shadow-md transition">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by name, EPIC ID, constituency, or ward..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-dash-text placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-slate-400 hover:text-slate-600 transition"
              aria-label="Clear search"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <button
          onClick={() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="text-left rounded-xl border border-blue-100 bg-blue-50 p-4 hover:-translate-y-0.5 hover:shadow-sm transition"
        >
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
            <Clock size={16} />
          </div>
          <p className="mt-3 text-xs uppercase tracking-wider text-blue-700 font-semibold">Pending Requests</p>
          <p className="text-2xl font-bold text-dash-text mt-1">{pendingCount}</p>
        </button>
        <div className="rounded-xl border border-green-100 bg-green-50 p-4 hover:-translate-y-0.5 hover:shadow-sm transition">
          <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
            <CheckCircle2 size={16} />
          </div>
          <p className="mt-3 text-xs uppercase tracking-wider text-green-700 font-semibold">Approved Today</p>
          <p className="text-2xl font-bold text-dash-text mt-1">{approvedTodayCount}</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 hover:-translate-y-0.5 hover:shadow-sm transition">
          <div className="w-9 h-9 rounded-full bg-red-100 text-red-700 flex items-center justify-center">
            <AlertCircle size={16} />
          </div>
          <p className="mt-3 text-xs uppercase tracking-wider text-red-700 font-semibold">Rejected Requests</p>
          <p className="text-2xl font-bold text-dash-text mt-1">{rejectedCount}</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="dash-card p-4 border-l-4 border-l-red-500">
          <p className="text-sm font-semibold text-red-600">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="dash-card p-8 flex items-center justify-center gap-2 text-dash-text-secondary">
          <Loader2 size={18} className="animate-spin" />
          Loading requests...
        </div>
      ) : requests.length === 0 ? (
        // No Requests State
        <div className="rounded-xl border border-emerald-100 bg-gradient-to-r from-green-50 to-blue-50 p-10 text-center hover:shadow-sm transition">
          <UserCheck size={36} className="mx-auto text-emerald-600 mb-3" />
          <p className="font-semibold text-dash-text text-lg">No Pending Requests</p>
          <p className="text-sm text-dash-text-secondary mt-1">All voter registration requests are already reviewed.</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        // No Search Results
        <div className="rounded-xl border border-purple-100 bg-purple-50 p-8 text-center">
          <Search size={28} className="mx-auto text-purple-400 mb-3" />
          <p className="font-semibold text-dash-text">No results found</p>
          <p className="text-sm text-dash-text-secondary mt-1">Try adjusting your search criteria.</p>
        </div>
      ) : (
        // Requests Grid with Improved Cards
        <div ref={listRef} className="grid md:grid-cols-2 gap-5">
          {filteredRequests.map((request) => (
            <div 
              key={request.id} 
              className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md hover:-translate-y-0.5 transition"
            >
              {/* Card Header - Name and Badge */}
              <div className="flex items-start justify-between gap-3 mb-4 pb-4 border-b border-slate-200">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-dash-text">{request.full_name}</h3>
                  <p className="text-xs text-dash-text-secondary mt-1">
                    Submitted {new Date(request.submitted_at).toLocaleDateString()} at {new Date(request.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className="text-xs font-semibold whitespace-nowrap bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Pending</span>
              </div>

              {/* Card Body - Voter Details */}
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-100 bg-blue-50/60">
                  <IdCard size={16} className="text-blue-700 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-dash-text-secondary font-medium">EPIC ID</p>
                    <p className="text-sm font-bold text-dash-text break-all">{request.epic_id}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-purple-100 bg-purple-50/60">
                  <MapPin size={16} className="text-purple-700 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-dash-text-secondary font-medium">Address Details</p>
                    <p className="text-sm font-semibold text-dash-text">Vidhan Sabha: {request.constituency_name}</p>
                    <p className="text-sm text-dash-text-secondary">Lok Sabha: {request.lok_sabha_name}</p>
                    <p className="text-sm text-dash-text-secondary">MCD Ward: {request.mcd_ward}</p>
                  </div>
                </div>
              </div>

              {/* Card Footer - Action Buttons */}
              <div className="flex items-center gap-2 pt-4 border-t border-slate-200">
                <button
                  onClick={() => reviewRequest(request.id, 'approve')}
                  disabled={busyId === request.id}
                  className="flex-1 btn-success text-sm px-3 py-2.5 font-medium flex items-center justify-center gap-2"
                  aria-label={`Approve registration for ${request.full_name}`}
                >
                  {busyId === request.id ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  <span>Accept</span>
                </button>
                <button
                  onClick={() => reviewRequest(request.id, 'reject')}
                  disabled={busyId === request.id}
                  className="flex-1 btn-danger text-sm px-3 py-2.5 font-medium flex items-center justify-center gap-2"
                  aria-label={`Reject registration for ${request.full_name}`}
                >
                  {busyId === request.id ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <XCircle size={15} />
                  )}
                  <span>Reject</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RegistrationRequests;
