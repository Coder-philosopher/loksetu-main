import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n/index.js';
import {
  ShieldCheck, ScanFace, CheckCircle, XCircle, Loader2,
  Lock, Camera, Power, Fingerprint, Eye, Globe, ChevronDown, ArrowRight
} from 'lucide-react';
import FaceLivenessCam from '../components/FaceLivenessCam';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

/* ─── tiny reusable primitives ─────────────────────────────── */
const InputField = ({ icon: Icon, error, className = "", ...props }) => (
  <div>
    <div className="relative">
      {Icon && (
        <Icon
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
        />
      )}
      <input
        {...props}
        className={`w-full ${Icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 bg-white border ${
          error ? 'border-red-400' : 'border-slate-200'
        } rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all ${className}`}
      />
    </div>
    {error && (
      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
        <span>⚠</span>{error}
      </p>
    )}
  </div>
);

const Label = ({ children }) => (
  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[1.5px] mb-1.5">{children}</label>
);

const StepBadge = ({ n, active, done }) => (
  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border flex-shrink-0 transition-all duration-300 ${
    done ? 'bg-emerald-500 border-emerald-500 text-white'
    : active ? 'bg-amber-500 border-amber-500 text-white shadow-[0_0_12px_rgba(245,158,11,0.3)]'
    : 'bg-slate-100 border-slate-200 text-slate-400'
  }`}>
    {done ? <CheckCircle size={14} /> : n}
  </div>
);

export default function Login() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState('idle');
  const [userData, setUserData] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [epicId, setEpicId] = useState('');
  const [password, setPassword] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [langOpen, setLangOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const isSubmittingRef = useRef(false);
  const loginStartRef = useRef(null);
  const langRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const h = (e) => { if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false); };
    if (langOpen) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [langOpen]);

  const validate = () => {
    const e = {};
    if (!epicId.trim()) e.epicId = 'EPIC ID is required';
    if (!password) e.password = 'Password is required';
    setFormErrors(e);
    return !Object.keys(e).length;
  };

  const handleStartAuthentication = () => {
    if (!validate()) return;
    setIsCameraOn(true);
    setStatus('idle');
    isSubmittingRef.current = false;
    loginStartRef.current = Date.now();
  };

  const togglePower = () => {
    setIsCameraOn(false);
    setStatus('idle');
    isSubmittingRef.current = false;
  };

  const handleCapture = async (imageSrc) => {
    if (!imageSrc || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setStatus('verifying');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epicId: epicId.trim().toUpperCase(), password: password.trim(), imageBase64: imageSrc }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setUserData(data.user || { name: 'Voter' });
        localStorage.setItem('token', data.token);
        if (loginStartRef.current) localStorage.setItem('sessionStart', loginStartRef.current.toString());
        setTimeout(() => navigate('/dashboard'), 2000);
      } else {
        setStatus('error');
        setTimeout(() => { setStatus('idle'); isSubmittingRef.current = false; setIsCameraOn(false); }, 3000);
      }
    } catch {
      setStatus('error');
      setTimeout(() => { setStatus('idle'); isSubmittingRef.current = false; setIsCameraOn(false); }, 3000);
    }
  };

  const steps = [
    { label: 'Enter credentials', done: !!(epicId && password) },
    { label: 'Face liveness', done: status === 'success' },
    { label: 'Access granted', done: status === 'success' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 font-['Sora',sans-serif] text-slate-800 overflow-hidden">

      {/* Google font injection */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=Cormorant+Garamond:ital,wght@0,600;1,400;1,600&family=JetBrains+Mono:wght@400;700&display=swap');
        .font-serif-civic { font-family: 'Cormorant Garamond', serif; }
        .font-mono-civic { font-family: 'JetBrains Mono', monospace; }
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0%,100% { opacity:.6; } 50% { opacity:1; } }
        @keyframes scanline { 0% { transform:translateY(-100%); } 100% { transform:translateY(400%); } }
        .anim-enter { animation: fadeSlideUp .5s ease both; }
        .shimmer { animation: shimmer 2s ease infinite; }
        .camera-circle video { width:100%!important; height:100%!important; object-fit:cover!important; transform:scaleX(-1); display:block; }
      `}</style>

      {/* ── Tricolor top stripe ── */}
      <div className="h-1 w-full flex">
        <div className="flex-1 bg-amber-500" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-emerald-600" />
      </div>

      {/* ── Background grid texture ── */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.03) 1px,transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      {/* Glow orbs - light theme version */}
      <div className="fixed top-[-200px] left-[-200px] w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)' }} />
      <div className="fixed bottom-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)' }} />

      {/* ── Header ── */}
      <header className="relative z-20 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-[3px] w-4">
              <div className="h-[4px] rounded-sm bg-amber-500" />
              <div className="h-[4px] rounded-sm bg-slate-600" />
              <div className="h-[4px] rounded-sm bg-emerald-500" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-slate-800">LokSetu</span>
              <span className="font-mono-civic text-[9px] text-slate-500 block leading-none mt-0.5 uppercase tracking-[2px]">
                Voter Portal
              </span>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            {/* System badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono-civic text-[9px] text-emerald-600 font-bold uppercase tracking-widest">System Online</span>
            </div>

            {/* Language */}
            <div className="relative" ref={langRef}>
              <button onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-all">
                <Globe size={13} />
                <span className="hidden sm:inline">{(LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0]).nativeLabel}</span>
                <ChevronDown size={11} className={`transition-transform ${langOpen ? 'rotate-180' : ''}`} />
              </button>
              {langOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <p className="font-mono-civic text-[9px] font-bold text-slate-500 uppercase tracking-widest">Language / भाषा</p>
                  </div>
                  {LANGUAGES.map(lang => (
                    <button key={lang.code}
                      onClick={() => { i18n.changeLanguage(lang.code); localStorage.setItem('loksetu-lang', lang.code); setLangOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors ${
                        i18n.language === lang.code ? 'text-amber-600 bg-amber-50' : 'text-slate-700'
                      }`}>
                      <span>{lang.nativeLabel}</span>
                      <span className="text-[10px] text-slate-400">{lang.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Page title row */}
        <div className={`mb-8 ${mounted ? 'anim-enter' : 'opacity-0'}`} style={{ animationDelay: '0.05s' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono-civic text-[10px] text-amber-600 font-bold uppercase tracking-[3px]">
              Secure Authentication
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800">
            Voter Identity <span className="text-amber-500">Verification</span>
          </h1>
        </div>

        {/* 3-col card */}
        <div className={`grid grid-cols-1 lg:grid-cols-[300px_1fr_280px] gap-px bg-slate-200 rounded-2xl overflow-hidden shadow-xl ${mounted ? 'anim-enter' : 'opacity-0'}`}
          style={{ animationDelay: '0.1s' }}>

          {/* ── COL 1: Info + Steps ── */}
          <div className="bg-white p-6 flex flex-col gap-6">
            {/* Blockchain badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 w-fit">
              <ShieldCheck size={13} className="text-blue-600" />
              <span className="font-mono-civic text-[9px] font-bold text-blue-600 uppercase tracking-widest">
                Blockchain Secured
              </span>
            </div>

            <div>
              <h2 className="text-xl font-extrabold tracking-tight leading-tight mb-2 text-slate-800">
                {t('login.voterLabel', 'Voter')}<br />
                <span className="text-amber-500 font-serif-civic">{t('login.identityPortal', 'Identity Portal')}</span>
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">{t('login.instruction')}</p>
            </div>

            {/* Step tracker */}
            <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
              <p className="font-mono-civic text-[9px] font-bold text-slate-400 uppercase tracking-widest">Auth Flow</p>
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <StepBadge n={i + 1} active={i === 0 && !s.done} done={s.done} />
                  <span className={`text-xs font-semibold transition-colors ${s.done ? 'text-emerald-600' : i === 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Register CTA */}
            <div className="mt-auto pt-4 border-t border-slate-100">
              <button onClick={() => navigate('/register')}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-all group">
                <span>New voter? Register</span>
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>

          {/* ── COL 2: Form ── */}
          <div className="bg-slate-50 p-6 sm:p-8">
            {!isCameraOn ? (
              <div className="max-w-sm">
                <div className="flex items-center gap-2 mb-6">
                  <Fingerprint size={18} className="text-amber-500" />
                  <h3 className="text-base font-bold text-slate-800">Multi-Factor Authentication</h3>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <Label>EPIC ID</Label>
                    <InputField icon={Lock} value={epicId} onChange={e => setEpicId(e.target.value)}
                      placeholder="ABC1234567" className="uppercase" error={formErrors.epicId} />
                  </div>

                  <div>
                    <Label>Password</Label>
                    <InputField icon={Lock} type="password" value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password" error={formErrors.password} />
                  </div>

                  {/* OTP Toggle */}
                  <div className="rounded-lg border border-slate-200 p-3 bg-white">
                    <button onClick={() => setShowOtp(!showOtp)}
                      className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors w-full">
                      <div className={`w-7 h-4 rounded-full border flex-shrink-0 transition-all relative ${
                        showOtp ? 'bg-amber-500 border-amber-500' : 'bg-slate-200 border-slate-300'
                      }`}>
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${showOtp ? 'left-3.5' : 'left-0.5'}`} />
                      </div>
                      Enable OTP Verification
                      <span className="ml-auto font-mono-civic text-[9px] text-slate-400 uppercase tracking-widest">By Phone</span>
                    </button>
                    {showOtp && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <Label>Phone Number</Label>
                        <InputField value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                          type="tel" placeholder="+91 XXXXX XXXXX" />
                      </div>
                    )}
                  </div>

                  <button onClick={handleStartAuthentication}
                    disabled={!epicId.trim() || !password}
                    className="mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_4px_20px_rgba(245,158,11,0.3)] hover:shadow-[0_4px_28px_rgba(245,158,11,0.4)] active:scale-[0.98]">
                    <ScanFace size={16} />
                    Start Face Verification
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[240px] gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <Fingerprint size={24} className="text-amber-500 animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm text-slate-800 mb-1">Biometric verification active</p>
                  <p className="text-xs text-slate-500">Position your face in the camera frame on the right</p>
                </div>
                <div className="flex gap-1.5">
                  {[0,1,2,3].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── COL 3: Camera ── */}
          <div className="bg-white p-6 flex flex-col items-center justify-between gap-4">

            {/* Camera viewport */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono-civic text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  Biometric Scan
                </p>
                {isCameraOn && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-mono-civic text-[9px] text-red-500 font-bold">REC</span>
                  </div>
                )}
              </div>

              <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 camera-circle"
                style={{ boxShadow: isCameraOn ? '0 0 0 1px rgba(245,158,11,0.3), 0 8px 32px rgba(0,0,0,0.1)' : '0 8px 32px rgba(0,0,0,0.08)' }}>

                {/* Corner accents */}
                {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2',
                  'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'].map((cls, i) => (
                  <div key={i} className={`absolute w-5 h-5 ${cls} ${isCameraOn ? 'border-amber-500' : 'border-slate-300'} z-20 transition-colors`} />
                ))}

                {isCameraOn && (
                  <div className="absolute inset-0 w-full h-full z-0">
                    <FaceLivenessCam onCapture={handleCapture} isProcessing={status !== 'idle'} />
                  </div>
                )}

                {/* Overlays */}
                <div className="absolute inset-0 z-10 pointer-events-none">
                  {isCameraOn && status === 'idle' && (
                    <div className="absolute bottom-3 inset-x-3">
                      <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center gap-2 border border-slate-200 shadow-sm">
                        <Eye size={12} className="text-amber-500 flex-shrink-0" />
                        <span className="text-[10px] font-semibold text-slate-700">{t('login.blinkToVerify', 'Blink to verify')}</span>
                      </div>
                    </div>
                  )}

                  {status === 'verifying' && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                      <Loader2 size={32} className="text-amber-500 animate-spin" />
                      <div className="text-center">
                        <p className="text-sm font-bold text-slate-800">{t('login.verifying', 'Verifying…')}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{t('login.matchingBiometric', 'Matching biometric data')}</p>
                      </div>
                    </div>
                  )}

                  {status === 'success' && (
                    <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center gap-3">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                        <CheckCircle size={44} className="text-emerald-500 relative" />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-sm text-slate-800">{t('login.verified', 'Identity Verified')}</p>
                        <p className="text-emerald-600 text-[10px] font-bold uppercase tracking-widest mt-0.5 font-serif-civic">
                          {t('login.welcome', { name: userData?.name })}
                        </p>
                      </div>
                    </div>
                  )}

                  {status === 'error' && (
                    <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center gap-3 p-4">
                      <XCircle size={44} className="text-red-500" />
                      <div className="text-center">
                        <p className="font-bold text-sm text-slate-800">{t('login.notRecognized', 'Not Recognized')}</p>
                        <p className="text-slate-500 text-[10px] mt-1 text-center">{t('login.notFoundMessage', 'Face not found in records')}</p>
                      </div>
                    </div>
                  )}

                  {!isCameraOn && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-30 gap-4">
                      <button onClick={handleStartAuthentication}
                        className="flex flex-col items-center gap-2.5 group">
                        <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center group-hover:bg-amber-50 group-hover:border-amber-300 transition-all duration-300 shadow-sm">
                          <Camera size={24} className="text-slate-400 group-hover:text-amber-500 transition-colors" />
                        </div>
                        <span className="font-mono-civic text-[9px] font-bold text-slate-500 group-hover:text-slate-600 uppercase tracking-[2px] transition-colors">
                          {t('login.startCamera', 'Activate Camera')}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Power toggle */}
            {isCameraOn && (
              <button onClick={togglePower}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold transition-all">
                <Power size={13} />
                Disable Camera
              </button>
            )}

            {/* How it works */}
            <div className="w-full pt-3 border-t border-slate-100">
              <p className="font-mono-civic text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                {t('login.howItWorks', 'How it works')}
              </p>
              <div className="flex flex-col gap-2.5">
                {[
                  { n: '1', title: t('login.step1Title'), desc: t('login.step1Desc') },
                  { n: '2', title: t('login.step2Title'), desc: t('login.step2Desc') },
                  { n: '3', title: t('login.step3Title'), desc: t('login.step3Desc') },
                ].map(({ n, title, desc }) => (
                  <div key={n} className="flex gap-2.5 items-start">
                    <div className="w-5 h-5 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-amber-500 flex-shrink-0 font-mono-civic">
                      {n}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{title}</p>
                      <p className="text-[10px] text-slate-500 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer strip */}
        <div className="mt-4 flex items-center justify-between text-[10px] font-mono-civic text-slate-400 uppercase tracking-widest px-1">
          <span>© {new Date().getFullYear()} LokSetu · NIT Raipur</span>
          <span>Powered by Hyperledger Fabric</span>
        </div>
      </main>
    </div>
  );
}