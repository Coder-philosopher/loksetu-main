import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, CheckCircle, Loader2, Save,
  ScanFace, Search, User, IdCard, Building2, MapPin, Lock, ChevronRight,
} from 'lucide-react';
import FaceLivenessCam from '../components/FaceLivenessCam';
import { DELHI_ELECTORAL_DATA } from '../data/delhiElectoralData';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/* ─── Primitives ──────────────────────────────────────────── */
const Label = ({ children }) => (
  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[1.5px] mb-1.5">
    {children}
  </label>
);

const Field = ({ icon: Icon, error, readOnly, ...props }) => (
  <div>
    <div className="relative">
      {Icon && (
        <Icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      )}
      <input
        {...props}
        readOnly={readOnly}
        className={`w-full ${Icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 text-sm rounded-lg border transition-all
          bg-white text-slate-800 placeholder:text-slate-400
          ${readOnly ? 'cursor-default text-slate-500 border-slate-200 bg-slate-50' : ''}
          ${error ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'}
          focus:outline-none`}
      />
    </div>
    {error && <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1"><span>⚠</span> {error}</p>}
  </div>
);

const SuggestionDropdown = ({ items, onSelect, renderItem }) =>
  items.length === 0 ? null : (
    <div className="mt-1.5 border border-slate-200 rounded-xl bg-white shadow-lg max-h-44 overflow-auto z-40 relative">
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(item)}
          className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 text-slate-700 hover:text-slate-900 border-b border-slate-100 last:border-b-0 transition-colors flex items-center justify-between group"
        >
          {renderItem(item)}
          <ChevronRight size={12} className="text-slate-400 group-hover:text-amber-500 transition-colors flex-shrink-0" />
        </button>
      ))}
    </div>
  );

const StatusBar = ({ type, message }) => {
  const colors = {
    idle: 'border-slate-200 bg-slate-50 text-slate-500',
    loading: 'border-amber-200 bg-amber-50 text-amber-600',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-600',
    error: 'border-red-200 bg-red-50 text-red-600',
  };
  const Icon = type === 'success' ? CheckCircle : type === 'loading' ? Loader2 : ScanFace;
  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-semibold ${colors[type] || colors.idle}`}>
      <Icon size={14} className={type === 'loading' ? 'animate-spin' : ''} />
      {message}
    </div>
  );
};

/* ─── Section header ─────────────────────────────────────── */
const SectionHead = ({ label, title }) => (
  <div className="mb-5">
    <span className="font-['JetBrains_Mono',monospace] text-[9px] font-bold text-amber-600 uppercase tracking-[3px]">{label}</span>
    <h2 className="text-lg font-extrabold tracking-tight mt-0.5 text-slate-800">{title}</h2>
  </div>
);

/* ─── Main ───────────────────────────────────────────────── */
export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', epicId: '', password: '', confirmPassword: '',
    homeState: 'Delhi', vidhanSabha: '', lokSabha: '', mcdWard: '',
  });
  const [errors, setErrors] = useState({});
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: 'idle', message: 'Fill details and capture a live face photo.' });
  const [vidhanSearch, setVidhanSearch] = useState('');
  const [wardSearch, setWardSearch] = useState('');

  const set = (key) => (e) => setFormData(p => ({ ...p, [key]: e.target.value }));

  const vidhanOptions = DELHI_ELECTORAL_DATA.vidhan_sabha;
  const filteredVidhan = useMemo(() => {
    const q = vidhanSearch.trim().toLowerCase();
    return q ? vidhanOptions.filter(i => i.name.toLowerCase().includes(q)) : vidhanOptions;
  }, [vidhanSearch, vidhanOptions]);

  const selectedVidhan = useMemo(
    () => vidhanOptions.find(i => i.name === formData.vidhanSabha) || null,
    [vidhanOptions, formData.vidhanSabha]
  );

  const filteredWards = useMemo(() => {
    if (!selectedVidhan) return [];
    const q = wardSearch.trim().toLowerCase();
    return q ? selectedVidhan.mcd_wards.filter(w => w.toLowerCase().includes(q)) : selectedVidhan.mcd_wards;
  }, [selectedVidhan, wardSearch]);

  const vidhanSuggestions = useMemo(
    () => (vidhanSearch.trim() ? filteredVidhan.slice(0, 8) : []),
    [vidhanSearch, filteredVidhan]
  );
  const wardSuggestions = useMemo(
    () => (wardSearch.trim() && selectedVidhan ? filteredWards.slice(0, 8) : []),
    [wardSearch, filteredWards, selectedVidhan]
  );

  const validate = () => {
    const e = {};
    if (!formData.firstName.trim()) e.firstName = 'Required';
    if (!formData.lastName.trim()) e.lastName = 'Required';
    if (!/^[A-Z]{3}\d{6,7}$/i.test(formData.epicId.trim())) e.epicId = '3 letters + 6–7 digits';
    if (!formData.password || formData.password.length < 6) e.password = 'Min 6 characters';
    if (formData.password !== formData.confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (!formData.vidhanSabha) e.vidhanSabha = 'Required';
    if (!formData.lokSabha) e.lokSabha = 'Required';
    if (!formData.mcdWard) e.mcdWard = 'Required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const startCamera = () => { if (!validate()) return; setCameraActive(true); };

  const handleCapture = (img) => {
    if (!img) { setStatus({ type: 'error', message: 'Capture failed. Please retry.' }); return; }
    setCapturedImage(img);
    setCameraActive(false);
    setStatus({ type: 'success', message: 'Live biometric captured successfully.' });
  };

  const onSelectVidhan = (value) => {
    const sel = vidhanOptions.find(i => i.name === value);
    setFormData(p => ({ ...p, vidhanSabha: value, lokSabha: sel?.lok_sabha || '', mcdWard: '' }));
    setWardSearch('');
    setVidhanSearch(value);
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    if (!validate() || !capturedImage) {
      if (!capturedImage) setStatus({ type: 'error', message: 'Live face capture required.' });
      return;
    }
    setSubmitting(true);
    setStatus({ type: 'loading', message: 'Submitting registration request…' });
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/register-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName.trim(), lastName: formData.lastName.trim(),
          epicId: formData.epicId.trim().toUpperCase(), password: formData.password.trim(),
          homeState: 'Delhi', vidhanSabha: formData.vidhanSabha, lokSabha: formData.lokSabha,
          mcdWard: formData.mcdWard, base64Image: capturedImage,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', message: data.message || 'Registration submitted.' });
        setTimeout(() => navigate('/'), 1800);
      } else {
        setStatus({ type: 'error', message: data.message || 'Request failed.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: `Network error: ${err.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-['Sora',sans-serif] text-slate-800">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=Cormorant+Garamond:ital,wght@0,600;1,400;1,600&family=JetBrains+Mono:wght@400;700&display=swap');
        .font-serif-civic { font-family: 'Cormorant Garamond', serif; }
        .font-mono-civic { font-family: 'JetBrains Mono', monospace; }
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .anim-enter { animation: fadeSlideUp .45s ease both; }
        select option { background: white; color: #1e293b; }
      `}</style>

      {/* Tricolor stripe */}
      <div className="h-1 w-full flex fixed top-0 z-50">
        <div className="flex-1 bg-amber-500" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-emerald-600" />
      </div>

      {/* BG grid - light theme */}
      <div className="fixed inset-0 pointer-events-none opacity-30" style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.03) 1px,transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      <div className="fixed top-[-200px] right-[-100px] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)' }} />

      {/* Header */}
      <header className="relative z-20 border-b border-slate-200 bg-white/80 backdrop-blur-sm pt-1">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-[3px] w-4">
              <div className="h-[4px] rounded-sm bg-amber-500" />
              <div className="h-[4px] rounded-sm bg-slate-600" />
              <div className="h-[4px] rounded-sm bg-emerald-500" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-slate-800">LokSetu</span>
              <span className="font-mono-civic text-[9px] text-slate-500 block leading-none mt-0.5 uppercase tracking-[2px]">Voter Registration</span>
            </div>
          </div>
          <button onClick={() => navigate('/')}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 hover:border-slate-300 rounded-lg transition-all hover:bg-slate-50">
            <ArrowLeft size={13} /> Back to Login
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Title */}
        <div className="mb-6 anim-enter">
          <span className="font-mono-civic text-[10px] text-amber-600 font-bold uppercase tracking-[3px]">New Enrollment</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-slate-800">
            Voter <span className="text-amber-500 font-serif-civic">Registration</span> Request
          </h1>
          <p className="text-xs text-slate-500 mt-1">Delhi constituency mapping · Biometric enrollment required</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-slate-200 rounded-2xl overflow-hidden shadow-xl anim-enter" style={{ animationDelay: '.08s' }}>

          {/* ── LEFT: Form ── */}
          <div className="bg-white p-6 sm:p-8">
            <SectionHead label="01 — Identity" title="Registration Details" />

            <form onSubmit={submitRequest} className="flex flex-col gap-4" noValidate>
              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First Name</Label>
                  <Field icon={User} value={formData.firstName} onChange={set('firstName')} placeholder="First" error={errors.firstName} />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Field icon={User} value={formData.lastName} onChange={set('lastName')} placeholder="Last" error={errors.lastName} />
                </div>
              </div>

              {/* EPIC ID */}
              <div>
                <Label>EPIC ID</Label>
                <Field icon={IdCard} value={formData.epicId} onChange={set('epicId')}
                  placeholder="ABC1234567" className="uppercase tracking-wide" error={errors.epicId} />
              </div>

              {/* Passwords */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Password</Label>
                  <Field icon={Lock} type="password" value={formData.password} onChange={set('password')} placeholder="Min 6 chars" error={errors.password} />
                </div>
                <div>
                  <Label>Confirm</Label>
                  <Field icon={Lock} type="password" value={formData.confirmPassword} onChange={set('confirmPassword')} placeholder="Repeat" error={errors.confirmPassword} />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-100 pt-4">
                <span className="font-mono-civic text-[9px] font-bold text-amber-600 uppercase tracking-[3px]">02 — Constituency</span>
              </div>

              {/* State */}
              <div>
                <Label>State</Label>
                <div className="px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600 flex items-center gap-2">
                  <MapPin size={13} className="text-slate-400" /> Delhi
                  <span className="ml-auto font-mono-civic text-[9px] text-slate-400 uppercase">Auto-set</span>
                </div>
              </div>

              {/* Vidhan Sabha search */}
              <div>
                <Label>Vidhan Sabha Constituency</Label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input value={vidhanSearch} onChange={e => setVidhanSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                    placeholder="Search constituency…" />
                </div>
                <SuggestionDropdown items={vidhanSuggestions} onSelect={item => onSelectVidhan(item.name)}
                  renderItem={item => (
                    <div>
                      <span className="text-sm font-semibold">{item.name}</span>
                      <span className="ml-2 text-[10px] text-slate-500">{item.lok_sabha}</span>
                    </div>
                  )} />
                {!vidhanSuggestions.length && (
                  <select value={formData.vidhanSabha} onChange={e => onSelectVidhan(e.target.value)}
                    className="w-full mt-2 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all">
                    <option value="">Select Vidhan Sabha</option>
                    {filteredVidhan.map(i => <option key={i.name} value={i.name}>{i.name}</option>)}
                  </select>
                )}
                {errors.vidhanSabha && <p className="text-[10px] text-red-500 mt-1">⚠ {errors.vidhanSabha}</p>}
              </div>

              {/* Lok Sabha (auto) */}
              <div>
                <Label>Lok Sabha Constituency</Label>
                <Field icon={Building2} value={formData.lokSabha} readOnly placeholder="Auto-filled from Vidhan Sabha" error={errors.lokSabha} />
              </div>

              {/* MCD Ward */}
              <div>
                <Label>MCD Ward</Label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input value={wardSearch} onChange={e => setWardSearch(e.target.value)}
                    disabled={!selectedVidhan}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed transition-all"
                    placeholder={selectedVidhan ? 'Search ward…' : 'Select Vidhan Sabha first'} />
                </div>
                <SuggestionDropdown items={wardSuggestions} onSelect={ward => { setFormData(p => ({ ...p, mcdWard: ward })); setWardSearch(ward); }}
                  renderItem={ward => <span className="text-sm">{ward}</span>} />
                {!wardSuggestions.length && selectedVidhan && (
                  <select value={formData.mcdWard} onChange={e => setFormData(p => ({ ...p, mcdWard: e.target.value }))}
                    className="w-full mt-2 px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all">
                    <option value="">Select MCD Ward</option>
                    {filteredWards.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                )}
                {errors.mcdWard && <p className="text-[10px] text-red-500 mt-1">⚠ {errors.mcdWard}</p>}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={startCamera} disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-amber-300 text-sm font-semibold text-slate-600 hover:text-amber-600 bg-white hover:bg-amber-50 transition-all disabled:opacity-40">
                  <Camera size={15} />
                  {capturedImage ? 'Retake Photo' : 'Capture Photo'}
                </button>
                <button type="submit" disabled={submitting || !capturedImage}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all shadow-[0_4px_20px_rgba(245,158,11,0.25)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]">
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>

          {/* ── RIGHT: Camera + Status ── */}
          <div className="bg-white p-6 sm:p-8 flex flex-col gap-5">
            <SectionHead label="03 — Biometrics" title="Live Face Capture" />

            {/* Camera box */}
            <div className="relative w-full aspect-square max-w-sm mx-auto rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
              style={{ boxShadow: cameraActive ? '0 0 0 1px rgba(245,158,11,0.25), 0 16px 48px rgba(0,0,0,0.1)' : '0 16px 48px rgba(0,0,0,0.08)' }}>

              {/* Corner accents */}
              {['top-0 left-0 border-t-2 border-l-2','top-0 right-0 border-t-2 border-r-2',
                'bottom-0 left-0 border-b-2 border-l-2','bottom-0 right-0 border-b-2 border-r-2'].map((c, i) => (
                <div key={i} className={`absolute w-5 h-5 ${c} ${cameraActive ? 'border-amber-500' : capturedImage ? 'border-emerald-500' : 'border-slate-300'} z-20 transition-colors`} />
              ))}

              {capturedImage && !cameraActive ? (
                <>
                  <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                  <div className="absolute bottom-3 inset-x-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
                      <CheckCircle size={13} className="text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-700">Biometric captured</span>
                    </div>
                  </div>
                </>
              ) : cameraActive ? (
                <FaceLivenessCam onCapture={handleCapture} isProcessing={submitting} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                    <ScanFace size={26} className="text-slate-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-mono-civic text-[9px] font-bold text-slate-500 uppercase tracking-[2px]">Camera standby</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Complete form first</p>
                  </div>
                </div>
              )}

              {/* Recording indicator */}
              {cameraActive && (
                <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-mono-civic text-[9px] text-red-500 font-bold uppercase">Live</span>
                </div>
              )}
            </div>

            {/* Status bar */}
            <StatusBar type={status.type} message={status.message} />

            {/* Info pills - light theme */}
            <div className="grid grid-cols-2 gap-2 mt-auto">
              {[
                { icon: '🔒', label: 'E2E Encrypted', sub: 'AES-256' },
                { icon: '⛓', label: 'On-chain Record', sub: 'Hyperledger' },
                { icon: '👁', label: 'Liveness Check', sub: 'Anti-spoof' },
                { icon: '🗳', label: 'One Person', sub: 'One Vote' },
              ].map(({ icon, label, sub }) => (
                <div key={label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-base">{icon}</span>
                  <div>
                    <p className="text-[10px] font-bold text-slate-600">{label}</p>
                    <p className="font-mono-civic text-[9px] text-slate-400 uppercase tracking-wider">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-[10px] font-mono-civic text-slate-400 uppercase tracking-widest px-1">
          <span>© {new Date().getFullYear()} LokSetu · NIT Raipur</span>
          <span>Powered by Hyperledger Fabric</span>
        </div>
      </main>
    </div>
  );
}