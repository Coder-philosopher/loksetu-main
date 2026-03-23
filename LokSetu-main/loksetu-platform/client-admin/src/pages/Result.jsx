import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Activity,
  AlertCircle,
  BarChart3,
  ChevronRight,
  Home,
  Map as MapIcon,
  RefreshCw,
  Trophy,
  Vote,
} from 'lucide-react';

import loksabhaMap from '../assets/maps/loksabha_map.svg?raw';
import vidhansabhaMap from '../assets/maps/vidhansabha_map.svg?raw';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const PARTY_BASE_COLORS = {
  BJP: '#FF9933',
  AAP: '#1E90FF',
};

const STATUS_META = {
  active: { label: 'Active', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  completed: { label: 'Completed', className: 'bg-slate-100 text-slate-800 border-slate-200' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800 border-red-200' },
};

const FALLBACK_CHART_COLORS = ['#FF9933', '#1E90FF', '#22C55E', '#A855F7', '#EF4444', '#0EA5E9', '#F59E0B'];
const MAP_MARKUP_BY_TYPE = {
  VS: vidhansabhaMap,
  LS: loksabhaMap,
};

function normalizeId(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toChartColor(party, index) {
  const normalizedParty = String(party || '').toUpperCase();
  return PARTY_BASE_COLORS[normalizedParty] || FALLBACK_CHART_COLORS[index % FALLBACK_CHART_COLORS.length];
}

function toMapColor(party) {
  const normalizedParty = String(party || '').toUpperCase();
  if (normalizedParty === 'BJP') return '#FF9933';
  if (normalizedParty === 'AAP') return '#1E90FF';
  return '#FFFFFF';
}

function formatElectionType(type) {
  if (type === 'LS') return 'Lok Sabha';
  if (type === 'VS') return 'Vidhan Sabha';
  if (type === 'MCD') return 'MCD';
  return type || 'Unknown';
}

function formatDate(value) {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString();
}

function MetricCard({ label, value, helper, accent }) {
  return (
    <div className="dash-card p-4 border border-dash-border">
      <p className="text-xs font-semibold tracking-wide uppercase text-dash-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-dash-text">{value}</p>
      {helper && (
        <p className={`mt-1 text-xs font-medium ${accent || 'text-dash-text-secondary'}`}>{helper}</p>
      )}
    </div>
  );
}

function SeatMap({ electionType, seats }) {
  const mapRef = useRef(null);

  useEffect(() => {
    const markup = MAP_MARKUP_BY_TYPE[electionType];
    if (!mapRef.current || !markup) {
      if (mapRef.current) mapRef.current.innerHTML = '';
      return;
    }

    mapRef.current.innerHTML = markup;
    const mapRoot = mapRef.current.querySelector('svg') || mapRef.current;

    const selectors = [
      'g#constituencies polygon, g#constituencies path',
      'g[id] polygon, g[id] path',
      'polygon, path',
    ];

    let regions = [];
    for (const selector of selectors) {
      const nodes = Array.from(mapRoot.querySelectorAll(selector));
      if (nodes.length > 0) {
        regions = nodes;
        break;
      }
    }

    if (regions.length === 0) return;

    const seatLookup = new Map();
    seats.forEach((seat) => {
      seatLookup.set(normalizeId(seat.seatName), seat);
    });

    let matchedByName = 0;

    regions.forEach((node) => {
      const regionId = normalizeId(node.getAttribute('id') || node.getAttribute('data-name') || '');
      const seat = seatLookup.get(regionId);
      const fill = seat ? toMapColor(seat.winner?.party) : '#FFFFFF';
      if (seat) matchedByName += 1;

      node.setAttribute('fill', fill);
      node.setAttribute('stroke', '#475569');
      node.setAttribute('stroke-width', '0.6');
      node.setAttribute('vector-effect', 'non-scaling-stroke');
      if (seat) node.setAttribute('title', `${seat.seatName}: ${seat.winner?.party || 'No winner'}`);
    });

    // If SVG paths are unnamed, paint in seat order.
    if (matchedByName === 0) {
      regions.forEach((node, index) => {
        const seat = seats[index];
        const fill = seat ? toMapColor(seat.winner?.party) : '#FFFFFF';
        node.setAttribute('fill', fill);
        node.setAttribute('stroke', '#475569');
        node.setAttribute('stroke-width', '0.6');
        node.setAttribute('vector-effect', 'non-scaling-stroke');
      });
    }
  }, [electionType, seats]);

  if (!MAP_MARKUP_BY_TYPE[electionType]) return null;

  return (
    <div className="dash-card p-4 border border-dash-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-dash-text">Seat Map</h3>
        <div className="flex items-center gap-3 text-xs text-dash-text-secondary">
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#FF9933' }} /> BJP</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#1E90FF' }} /> AAP</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border border-slate-400" style={{ backgroundColor: '#FFFFFF' }} /> Others</span>
        </div>
      </div>
      <div ref={mapRef} className="w-full overflow-auto" />
    </div>
  );
}

function ResultsLanding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [elections, setElections] = useState([]);

  const fetchElections = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/v1/results/elections`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed with status ${res.status}`);
      }
      const payload = await res.json();
      setElections(Array.isArray(payload?.elections) ? payload.elections : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch elections');
      setElections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchElections();
  }, []);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="dash-card p-5 border border-dash-border flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-dash-text">Election Results</h1>
          <p className="text-sm text-dash-text-secondary mt-1">Select an election to view real-time and final vote outcomes.</p>
        </div>
        <button
          onClick={fetchElections}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dash-border text-sm font-semibold text-dash-text hover:bg-orange-50"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading && (
        <div className="dash-card p-8 text-center text-dash-text-secondary text-sm">Loading elections...</div>
      )}

      {!loading && error && (
        <div className="dash-card p-5 border border-red-300 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5" />
          <div>
            <p className="font-bold">Unable to load election results list.</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && elections.length === 0 && (
        <div className="dash-card p-8 text-center text-dash-text-secondary text-sm">No elections found.</div>
      )}

      {!loading && !error && elections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {elections.map((election) => {
            const statusMeta = STATUS_META[election.status] || STATUS_META.pending;
            return (
              <div key={election.id} className="dash-card p-5 border border-dash-border flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-bold text-dash-text leading-snug">{election.title}</h2>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${statusMeta.className}`}>
                    {statusMeta.label}
                  </span>
                </div>

                <div className="text-sm space-y-1.5 text-dash-text-secondary">
                  <p><span className="font-semibold text-dash-text">Type:</span> {formatElectionType(election.electionType)}</p>
                  <p><span className="font-semibold text-dash-text">Constituency:</span> {election.constituency || 'Delhi'}</p>
                  <p><span className="font-semibold text-dash-text">Votes Cast:</span> {Number(election.votesCast || 0).toLocaleString()}</p>
                </div>

                <button
                  onClick={() => navigate(`/results/${election.id}`)}
                  className="mt-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-dash-primary text-white text-sm font-semibold hover:opacity-95"
                >
                  View Results
                  <ChevronRight size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ElectionResultDetail() {
  const navigate = useNavigate();
  const { election_id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resultData, setResultData] = useState(null);
  const [selectedWard, setSelectedWard] = useState('');

  const fetchResultDetail = useCallback(async () => {
    if (!election_id) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API}/api/v1/results/elections/${election_id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed with status ${res.status}`);
      }

      const payload = await res.json();
      setResultData(payload);

      const electionType = payload?.election?.electionType;
      const seats = Array.isArray(payload?.seats) ? payload.seats : [];
      if (electionType === 'MCD') {
        setSelectedWard(seats[0]?.seatName || '');
      } else {
        setSelectedWard('');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch election result details');
      setResultData(null);
    } finally {
      setLoading(false);
    }
  }, [election_id]);

  useEffect(() => {
    fetchResultDetail();
  }, [fetchResultDetail]);

  const election = resultData?.election;
  const metrics = resultData?.metrics;
  const seats = useMemo(() => (Array.isArray(resultData?.seats) ? resultData.seats : []), [resultData?.seats]);
  const allCandidates = useMemo(
    () => (Array.isArray(resultData?.candidates) ? resultData.candidates : []),
    [resultData?.candidates]
  );
  const partyVoteShare = useMemo(
    () => (Array.isArray(resultData?.partyVoteShare) ? resultData.partyVoteShare : []),
    [resultData?.partyVoteShare]
  );

  const selectedSeat = useMemo(() => {
    if (election?.electionType !== 'MCD') return null;
    return seats.find((seat) => seat.seatName === selectedWard) || null;
  }, [election?.electionType, seats, selectedWard]);

  const barChartData = useMemo(() => {
    const source = selectedSeat?.candidates || allCandidates;
    return source.map((item, index) => ({
      name: item.name,
      votes: Number(item.votes || 0),
      party: item.party,
      color: toChartColor(item.party, index),
    }));
  }, [selectedSeat, allCandidates]);

  const pieChartData = useMemo(() => {
    if (selectedSeat?.candidates?.length) {
      const partyMap = new Map();
      selectedSeat.candidates.forEach((candidate) => {
        partyMap.set(candidate.party, (partyMap.get(candidate.party) || 0) + Number(candidate.votes || 0));
      });
      const totalSeatVotes = Array.from(partyMap.values()).reduce((sum, value) => sum + value, 0);
      return Array.from(partyMap.entries()).map(([party, votes], index) => ({
        party,
        votes,
        voteShare: totalSeatVotes > 0 ? Number(((votes / totalSeatVotes) * 100).toFixed(2)) : 0,
        color: toChartColor(party, index),
      }));
    }

    return partyVoteShare.map((item, index) => ({
      ...item,
      color: item.color || toChartColor(item.party, index),
    }));
  }, [selectedSeat, partyVoteShare]);

  if (loading) {
    return <div className="dash-card p-8 text-center text-dash-text-secondary text-sm">Loading result details...</div>;
  }

  if (error) {
    return (
      <div className="dash-card p-5 border border-red-300 text-red-700 text-sm flex items-start gap-2">
        <AlertCircle size={16} className="mt-0.5" />
        <div>
          <p className="font-bold">Unable to load election result details.</p>
          <p>{error}</p>
          <button
            onClick={() => navigate('/results')}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-dash-primary hover:underline"
          >
            <Home size={14} /> Back to Election List
          </button>
        </div>
      </div>
    );
  }

  if (!resultData || !election || !metrics) {
    return <div className="dash-card p-8 text-center text-dash-text-secondary text-sm">No result data available.</div>;
  }

  const statusMeta = STATUS_META[election.status] || STATUS_META.pending;
  const isNoVotes = Boolean(resultData.noVotes);
  const isLive = Boolean(metrics.isLive);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="dash-card p-5 border border-dash-border space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-dash-text-secondary">Election Results</p>
            <h1 className="text-xl font-extrabold text-dash-text mt-1">{election.title}</h1>
            <p className="text-sm text-dash-text-secondary mt-1">
              {formatElectionType(election.electionType)} • {election.constituency || 'Delhi'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isLive && (
              <span className="text-xs px-2.5 py-1 rounded-full border bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold inline-flex items-center gap-1">
                <Activity size={12} /> Live Results
              </span>
            )}
            <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
            <button
              onClick={fetchResultDetail}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dash-border text-xs font-semibold text-dash-text hover:bg-orange-50"
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <Link to="/results" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dash-border text-xs font-semibold text-dash-text hover:bg-orange-50">
              <Home size={13} /> Elections
            </Link>
          </div>
        </div>

        <div className="text-xs text-dash-text-secondary grid grid-cols-1 md:grid-cols-3 gap-2">
          <p><span className="font-semibold text-dash-text">Start:</span> {formatDate(election.startTime || election.scheduledDate)}</p>
          <p><span className="font-semibold text-dash-text">End:</span> {formatDate(election.endTime)}</p>
          <p><span className="font-semibold text-dash-text">Leading Party:</span> {metrics.leadingParty || 'N/A'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard label="Total Votes" value={Number(metrics.totalVotes || 0).toLocaleString()} helper={isNoVotes ? 'No votes cast yet' : undefined} accent={isNoVotes ? 'text-amber-700' : undefined} />
        <MetricCard label="Total Seats" value={Number(metrics.totalSeats || 0).toLocaleString()} helper={formatElectionType(election.electionType)} />
        <MetricCard label="Candidates" value={Number(metrics.totalCandidates || 0).toLocaleString()} helper={`Registered: ${Number(metrics.totalRegisteredVoters || 0).toLocaleString()} voters`} />
        <MetricCard label="Turnout" value={`${Number(metrics.turnoutPercentage || 0).toFixed(2)}%`} helper={`Pending Votes: ${Number(metrics.pendingVotes || 0).toLocaleString()}`} />
      </div>

      {isNoVotes && (
        <div className="dash-card p-4 border border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold inline-flex items-center gap-2">
          <AlertCircle size={16} /> No votes cast yet
        </div>
      )}

      {election.electionType === 'MCD' ? (
        <div className="dash-card p-4 border border-dash-border">
          <div className="flex items-center gap-2 mb-3">
            <MapIcon size={16} className="text-dash-text-secondary" />
            <h3 className="text-sm font-bold text-dash-text">Ward Leaders</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {seats.map((seat) => {
              const isSelected = selectedWard === seat.seatName;
              return (
                <button
                  key={seat.seatName}
                  onClick={() => setSelectedWard(seat.seatName)}
                  className={`text-left rounded-lg border p-3 transition ${isSelected ? 'border-dash-primary bg-orange-50' : 'border-dash-border bg-white hover:bg-slate-50'}`}
                >
                  <p className="text-sm font-bold text-dash-text">{seat.seatName}</p>
                  <p className="text-xs text-dash-text-secondary mt-1">Leading: {seat.winner?.name || 'N/A'}</p>
                  <p className="text-xs text-dash-text-secondary mt-1 inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full border border-slate-300" style={{ backgroundColor: toMapColor(seat.winner?.party) }} />
                    {seat.winner?.party || 'No votes'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <SeatMap electionType={election.electionType} seats={seats} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="dash-card p-4 border border-dash-border">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={16} className="text-dash-text-secondary" />
            <h3 className="text-sm font-bold text-dash-text">Candidate vs Votes</h3>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 8, right: 18, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" angle={-22} textAnchor="end" interval={0} height={72} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
                  {barChartData.map((entry) => (
                    <Cell key={`${entry.name}-${entry.party}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dash-card p-4 border border-dash-border">
          <div className="flex items-center gap-2 mb-3">
            <Vote size={16} className="text-dash-text-secondary" />
            <h3 className="text-sm font-bold text-dash-text">Party Vote Share</h3>
          </div>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieChartData} dataKey="votes" nameKey="party" innerRadius={58} outerRadius={104} paddingAngle={2}>
                  {pieChartData.map((entry) => (
                    <Cell key={`pie-${entry.party}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name, props) => [`${Number(value).toLocaleString()} votes`, `${name} (${props?.payload?.voteShare || 0}%)`]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="dash-card p-4 border border-dash-border">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={16} className="text-dash-text-secondary" />
          <h3 className="text-sm font-bold text-dash-text">
            {election.electionType === 'MCD' ? 'Ward Result Detail' : 'Seat Winners'}
          </h3>
        </div>

        {election.electionType === 'MCD' && selectedSeat ? (
          <div className="space-y-2">
            <p className="text-sm font-bold text-dash-text">{selectedSeat.seatName}</p>
            {selectedSeat.candidates.map((candidate, index) => (
              <div key={candidate.id} className="flex items-center justify-between border border-dash-border rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: toChartColor(candidate.party, index) }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-dash-text truncate">{candidate.name}</p>
                    <p className="text-xs text-dash-text-secondary">{candidate.party}</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-dash-text">{Number(candidate.votes || 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {seats.map((seat) => (
              <div key={seat.seatName} className="flex items-center justify-between border border-dash-border rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-dash-text">{seat.seatName}</p>
                  <p className="text-xs text-dash-text-secondary">
                    {seat.winner?.name || 'No winner yet'} • {seat.winner?.party || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-dash-text">{Number(seat.winner?.votes || 0).toLocaleString()}</p>
                  <p className="text-xs text-dash-text-secondary">Margin: {Number(seat.winner?.margin || 0).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const Result = () => {
  const { election_id } = useParams();
  if (!election_id) return <ResultsLanding />;
  return <ElectionResultDetail />;
};

export default Result;
