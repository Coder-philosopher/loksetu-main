import React, { useEffect, useState } from 'react';
import { Plus, Loader2, AlertCircle, CheckCircle2, Calendar, Type, Users, FileText, MapPin } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const ELECTION_SCOPE = {
  LS: { label: 'All 7 Lok Sabha seats in Delhi', unitCount: 7 },
  VS: { label: 'All 70 Vidhan Sabha seats in Delhi', unitCount: 70 },
  MCD: { label: 'All 250 MCD wards in Delhi', unitCount: 250 },
};

const ElectionSetup = () => {
  const [formData, setFormData] = useState({
    name: '',
    election_type: 'LS',
    description: '',
    scheduled_date: '',
  });

  const [constituencies, setConstituencies] = useState([]);
  const [voterCount, setVoterCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch constituencies with voter counts
  useEffect(() => {
    const fetchConstituencies = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API}/api/v1/admin/constituencies/voter-count`);
        const data = await response.json();
        if (response.ok && data.constituencies) {
          setConstituencies(data.constituencies);
        }
      } catch (err) {
        console.warn('Failed to fetch constituencies:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchConstituencies();
  }, []);

  // Update voter count based on selection
  useEffect(() => {
    const count = constituencies.reduce((sum, c) => sum + Number(c.voter_count || 0), 0);
    setVoterCount(count);
  }, [constituencies, formData.election_type]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleCreateElection = async (conductImmediately = false) => {
    // Validate form
    if (!formData.name.trim()) {
      setError('Election name is required.');
      return;
    }

    if (!formData.election_type) {
      setError('Election type is required.');
      return;
    }

    setCreating(true);
    setError('');
    setSuccess('');

    try {
      const scheduledDate = formData.scheduled_date ? new Date(formData.scheduled_date) : null;
      const derivedStart = scheduledDate && !Number.isNaN(scheduledDate.getTime())
        ? scheduledDate.toISOString()
        : null;
      const derivedEnd = scheduledDate && !Number.isNaN(scheduledDate.getTime())
        ? new Date(scheduledDate.getTime() + (8 * 60 * 60 * 1000)).toISOString()
        : null;

      const payload = {
        name: formData.name,
        election_type: formData.election_type,
        state_id: 1, // Delhi
        description: formData.description || null,
        scheduled_date: formData.scheduled_date || null,
        start_time: derivedStart,
        end_time: derivedEnd,
      };

      const response = await fetch(`${API}/api/v1/admin/elections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create election.');
      }

      setSuccess(`Election "${formData.name}" created successfully!`);

      // If conducting immediately, update status to active
      if (conductImmediately) {
        const updateResponse = await fetch(`${API}/api/v1/admin/elections/${data.electionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
        });

        if (updateResponse.ok) {
          setSuccess(`Election "${formData.name}" created and activated!`);
        }
      }

      // Reset form
      setFormData({
        name: '',
        election_type: 'LS',
        description: '',
        scheduled_date: '',
      });
    } catch (err) {
      setError(err.message || 'Failed to create election.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="section-title">Election Setup</h2>
        <p className="text-sm text-dash-text-secondary mt-2">
          Create and configure new elections. Choose election type only; coverage is applied to all Delhi seats/wards for that type.
        </p>
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

      {/* Sectioned Form */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* BASIC DETAILS */}
        <div className="dash-card p-5 bg-[#E3F2FD] border border-blue-200 hover:shadow-sm hover:-translate-y-0.5 transition">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Basic Details</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-dash-text mb-2">Election Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Delhi LS Elections 2024"
                className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-dash-text outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-dash-text mb-2">Description (Optional)</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Add any notes or details about this election..."
                rows={3}
                className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-dash-text outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition resize-none"
              />
            </div>
          </div>
        </div>

        {/* ELECTION TYPE */}
        <div className="dash-card p-5 bg-[#E8F5E9] border border-emerald-200 hover:shadow-sm hover:-translate-y-0.5 transition">
          <div className="flex items-center gap-2 mb-4">
            <Type size={16} className="text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Election Type</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {['LS', 'VS', 'MCD'].map(type => (
              <button
                key={type}
                onClick={() => handleChange({ target: { name: 'election_type', value: type } })}
                className={`px-4 py-3 rounded-full font-bold text-sm border transition ${
                  formData.election_type === type
                    ? 'bg-[#1e3a5f] text-white border-[#1e3a5f] shadow-sm'
                    : 'bg-white text-slate-700 border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                {type === 'LS' ? 'Lok Sabha' : type === 'VS' ? 'Vidhan Sabha' : 'MCD Ward'}
              </button>
            ))}
          </div>
        </div>

        {/* COVERAGE */}
        <div className="dash-card p-5 bg-[#FFF3E0] border border-amber-200 hover:shadow-sm hover:-translate-y-0.5 transition">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={16} className="text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">Coverage</h3>
          </div>
          <div className="p-4 border border-amber-100 rounded-lg">
            <p className="text-xs font-bold text-dash-text-secondary mb-1">Coverage Scope</p>
            <p className="text-sm font-semibold text-dash-text">{ELECTION_SCOPE[formData.election_type].label}</p>
          </div>
        </div>

        {/* VOTER SUMMARY */}
        <div className="dash-card p-5 bg-[#E3F2FD] border border-blue-200 hover:shadow-sm hover:-translate-y-0.5 transition">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Voter Summary</h3>
          </div>
          {voterCount !== null && (
            <div className="p-4 bg-white/30 rounded-lg border border-blue-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
                <Users size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-dash-text">Registered Voters</p>
                <p className="text-3xl font-bold text-dash-primary">{voterCount.toLocaleString()}</p>
                <p className="text-xs text-dash-text-secondary mt-1">
                  Scope: {ELECTION_SCOPE[formData.election_type].unitCount} units for {formData.election_type} election type
                </p>
              </div>
            </div>
          )}
        </div>

        {/* SCHEDULING */}
        <div className="dash-card p-5 bg-[#F3E5F5] border border-purple-200 hover:shadow-sm hover:-translate-y-0.5 transition">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">Scheduling</h3>
          </div>
          <div>
            <label className="block text-sm font-bold text-dash-text mb-2">Scheduled Date (Optional)</label>
            <input
              type="datetime-local"
              name="scheduled_date"
              value={formData.scheduled_date}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-dash-text outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="dash-card p-5 border border-slate-200 bg-white flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => handleCreateElection(false)}
          disabled={creating || loading}
          className="flex-1 btn-secondary text-sm px-4 py-3 font-bold flex items-center justify-center gap-2"
        >
          {creating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Plus size={16} />
          )}
          {creating ? 'Creating...' : 'Create Election (Pending)'}
        </button>
        <button
          onClick={() => handleCreateElection(true)}
          disabled={creating || loading}
          className="flex-1 btn-success text-sm px-4 py-3 font-bold flex items-center justify-center gap-2"
        >
          {creating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <CheckCircle2 size={16} />
          )}
          {creating ? 'Creating...' : 'Create & Conduct'}
        </button>
      </div>

      {/* Info Box */}
      <div className="dash-card p-4 bg-amber-50 border-l-4 border-l-dash-warning">
        <p className="text-sm text-dash-text-secondary">
          <strong className="text-dash-warning">ℹ️ Note:</strong> Elections start in "Pending" status. Use Create & Conduct to immediately activate the election, or create it and activate later from the history panel.
        </p>
      </div>
    </div>
  );
};

export default ElectionSetup;
