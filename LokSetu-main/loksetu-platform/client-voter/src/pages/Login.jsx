import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n/index.js';
import { 
  ShieldCheck, ScanFace, CheckCircle, XCircle, Loader2, 
  Lock, Camera, Info, Power, Fingerprint, Eye, Globe
} from 'lucide-react';
import FaceLivenessCam from '../components/FaceLivenessCam'; 

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const Login = () => {
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
  const isSubmittingRef = useRef(false);
  const loginStartRef = useRef(null);
  const capturedImageRef = useRef(null);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false); };
    if (langOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [langOpen]);

  const validateCredentials = () => {
    const errors = {};
    if (!epicId.trim()) errors.epicId = 'EPIC ID is required';
    if (!password) errors.password = 'Password is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStartAuthentication = async () => {
    if (!validateCredentials()) return;
    
    // Start camera for face verification
    setIsCameraOn(true);
    setStatus('idle');
    isSubmittingRef.current = false;
    loginStartRef.current = Date.now();
  };

  const togglePower = () => {
    setIsCameraOn(prev => !prev);
    setStatus('idle');
    isSubmittingRef.current = false;
  };

  const handleCapture = async (imageSrc) => {
    if (!imageSrc || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    capturedImageRef.current = imageSrc;
    setStatus('verifying');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          epicId: epicId.trim().toUpperCase(),
          password: password.trim(),
          imageBase64: imageSrc 
        })
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setUserData(data.user || { name: "Voter" });
        localStorage.setItem('token', data.token);
        if (loginStartRef.current) {
          localStorage.setItem('sessionStart', loginStartRef.current.toString());
        }
        
        // Show the appropriate authentication route message
        const msgPrefix = data.authRoute === 'route-1' ? 'Face verified - ' : 'Password verified - ';
        console.log(msgPrefix + data.message);
        
        setTimeout(() => navigate("/dashboard"), 2000); 
      } else {
        setStatus('error');
        setTimeout(() => {
          setStatus('idle');
          isSubmittingRef.current = false; 
          setIsCameraOn(false);
        }, 3000);
      }
    } catch (e) {
      console.error('Login error:', e);
      setStatus('error');
      setTimeout(() => {
        setStatus('idle');
        isSubmittingRef.current = false;
        setIsCameraOn(false);
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gov-grey font-gov text-gov-text">
      
      <style>{`
        .camera-circle {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .camera-circle video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          object-position: center center !important;
          transform: scaleX(-1);
          border-radius: 0 !important;
          display: block;
        }
      `}</style>

      {/* Tricolor Band */}
      <div className="h-1.5 bg-gradient-to-r from-gov-saffron via-white to-gov-green" />

      {/* Header */}
      <header className="bg-gov-blue text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded bg-white/10 flex items-center justify-center overflow-hidden">
              <img src="/loksetu-logo.svg" alt="LokSetu" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">{t('login.title')}</h1>
              <p className="text-xs text-blue-200 font-medium">{t('login.tagline')}</p>
            </div>
          </div>
          {/* Language Selector */}
          <div className="relative" ref={langRef}>
            <button onClick={() => setLangOpen(!langOpen)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-200 hover:text-white hover:bg-white/10 transition-colors border border-white/20" aria-label="Select language">
              <Globe size={14} />
              <span className="hidden sm:inline">{(LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0]).nativeLabel}</span>
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden max-h-80 overflow-y-auto">
                <div className="px-3 py-2 bg-slate-50 border-b border-gray-200">
                  <p className="text-xs font-bold text-gray-500">Select Language / भाषा चुनें</p>
                </div>
                {LANGUAGES.map(lang => (
                  <button key={lang.code} onClick={() => { i18n.changeLanguage(lang.code); localStorage.setItem('loksetu-lang', lang.code); setLangOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-orange-50 transition-colors ${i18n.language === lang.code ? 'bg-blue-50 text-gov-blue font-bold' : 'text-gray-700'}`}>
                    <span>{lang.nativeLabel}</span>
                    <span className="text-xs text-gray-400">{lang.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="gov-card overflow-hidden animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-0">
        
            {/* LEFT: Branding (1 col) */}
            <div className="p-8 lg:p-10 border-b lg:border-b-0 lg:border-r border-gov-border flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 text-gov-blue text-[10px] font-bold rounded uppercase tracking-wider mb-5 w-fit">
                <Lock size={12} /> {t('login.blockchainSecured')}
              </div>
              
              <h2 className="text-3xl lg:text-4xl font-extrabold text-gov-text tracking-tight leading-tight mb-4">
                {t('login.voterLabel', 'Voter')}<br/>
                <span className="text-gov-blue">{t('login.identityPortal', 'Identity Portal')}</span>
              </h2>
              
              <p className="text-gov-text-light text-sm leading-relaxed mb-5">
                {t('login.instruction')}
              </p>

              <div className="flex items-center gap-2 px-3 py-2 bg-gov-green-light border border-green-200 rounded text-xs font-bold text-gov-green w-fit">
                <span className="w-2 h-2 bg-gov-green rounded-full animate-pulse" aria-hidden="true" />
                {t('login.secureConnection')}
              </div>

              <button
                onClick={() => navigate('/register')}
                className="mt-4 gov-btn-secondary text-xs"
              >
                New voter? Submit Registration Request
              </button>
            </div>

            {/* CENTER: Login Form (2 cols on lg) */}
            <div className="p-8 flex flex-col justify-center bg-gray-50 border-b lg:border-b-0 lg:border-r border-gov-border lg:col-span-2">
              {!isCameraOn ? (
                <>
                  <h3 className="text-lg font-bold mb-6 text-gov-text">Multi-Factor Authentication</h3>
                  
                  <div className="space-y-4">
                    {/* EPIC ID Field */}
                    <div>
                      <label className="text-xs font-bold text-gov-text-light uppercase tracking-wide">EPIC ID</label>
                      <div className="relative mt-1">
                        <Lock size={14} className="absolute left-3 top-3 text-gov-text-light" />
                        <input
                          type="text"
                          value={epicId}
                          onChange={(e) => setEpicId(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 border border-gov-border rounded text-sm uppercase"
                          placeholder="ABC1234567"
                          disabled={isCameraOn}
                        />
                      </div>
                      {formErrors.epicId && <p className="text-xs text-red-600 mt-1">{formErrors.epicId}</p>}
                    </div>

                    {/* Password Field */}
                    <div>
                      <label className="text-xs font-bold text-gov-text-light uppercase tracking-wide">Password</label>
                      <div className="relative mt-1">
                        <Lock size={14} className="absolute left-3 top-3 text-gov-text-light" />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 border border-gov-border rounded text-sm"
                          placeholder="Enter your password"
                          disabled={isCameraOn}
                        />
                      </div>
                      {formErrors.password && <p className="text-xs text-red-600 mt-1">{formErrors.password}</p>}
                    </div>

                    {/* OTP Toggle (Dummy Feature) */}
                    <div className="pt-2 border-t border-gov-border">
                      <button
                        onClick={() => setShowOtp(!showOtp)}
                        className="flex items-center gap-2 text-xs font-bold text-gov-blue hover:text-gov-blue-light mb-3"
                      >
                        <input type="checkbox" checked={showOtp} onChange={() => setShowOtp(!showOtp)} className="cursor-pointer" />
                        Enable OTP Verification (Optional - Demo Only)
                      </button>

                      {showOtp && (
                        <div className="space-y-3 p-3 bg-blue-50 rounded border border-blue-200">
                          <div>
                            <label className="text-xs font-bold text-gov-text-light uppercase tracking-wide">Phone Number</label>
                            <input
                              type="tel"
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              className="w-full mt-1 px-3 py-2 border border-gov-border rounded text-sm"
                              placeholder="+91 XXXXX XXXXX"
                              disabled={isCameraOn}
                            />
                          </div>
                          <p className="text-xs text-gov-text-light italic">OTP feature is for demo purposes only</p>
                        </div>
                      )}
                    </div>

                    {/* Login Button */}
                    <button
                      onClick={handleStartAuthentication}
                      disabled={isCameraOn || !epicId.trim() || !password}
                      className="w-full mt-6 gov-btn-primary text-sm font-bold"
                    >
                      <Fingerprint size={16} className="inline mr-2" />
                      Start Face Verification
                    </button>

                    <button
                      onClick={() => navigate('/register')}
                      className="w-full gov-btn-secondary text-xs"
                    >
                      New voter? Submit Registration Request
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <Fingerprint size={48} className="text-gov-blue mb-4 animate-pulse" />
                  <p className="text-sm font-bold text-gov-text mb-2">Verifying your face...</p>
                  <p className="text-xs text-gov-text-light">Position your face in the center on the right</p>
                </div>
              )}
            </div>

            {/* RIGHT: Camera */}
            <div className="p-8 flex flex-col items-center justify-center bg-gray-50">
              {/* Camera viewport */}
              <div className="relative w-64 h-64 lg:w-72 lg:h-72 rounded overflow-hidden shadow-lg border-2 border-gov-border bg-gray-900 camera-circle">
                
                {isCameraOn && (
                  <>
                    {(status === 'idle' || status === 'verifying') && (
                      <div className="absolute inset-0 w-full h-full">
                        <FaceLivenessCam onCapture={handleCapture} isProcessing={status !== 'idle'} />
                      </div>
                    )}

                    <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                      {status === 'idle' && (
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="w-44 h-44 border-2 border-dashed border-white/30 rounded flex items-center justify-center">
                            <ScanFace size={44} className="text-white/40" />
                          </div>
                          <span className="absolute bottom-4 bg-black/60 text-white text-xs font-bold px-4 py-1.5 rounded border border-white/10">
                            <Eye size={12} className="inline mr-1.5" /> {t('login.blinkToVerify')}
                          </span>
                        </div>
                      )}

                      {status === 'verifying' && (
                        <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center">
                          <Loader2 size={44} className="text-gov-blue animate-spin mb-3" />
                          <span className="text-gov-blue font-bold text-sm">{t('login.verifying')}</span>
                          <span className="text-gov-text-light text-xs mt-1">{t('login.matchingBiometric')}</span>
                        </div>
                      )}

                      {status === 'success' && (
                        <div className="absolute inset-0 bg-white flex flex-col items-center justify-center animate-fade-in">
                          <div className="relative">
                            <div className="absolute inset-0 bg-green-200 rounded-full animate-pulse-ring" />
                            <CheckCircle size={56} className="text-gov-green relative z-10" />
                          </div>
                          <h3 className="text-lg font-extrabold text-gov-text mt-4">{t('login.verified')}</h3>
                          <p className="text-gov-green font-bold text-xs uppercase tracking-wider mt-1">{t('login.welcome', { name: userData?.name })}</p>
                        </div>
                      )}

                      {status === 'error' && (
                        <div className="absolute inset-0 bg-white flex flex-col items-center justify-center animate-fade-in p-6">
                          <XCircle size={56} className="text-red-500 mb-3" />
                          <h3 className="text-lg font-extrabold text-gov-text">{t('login.notRecognized')}</h3>
                          <p className="text-gov-text-light text-xs mt-1 text-center">{t('login.notFoundMessage')}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {!isCameraOn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-30">
                    <button onClick={handleStartAuthentication} className="group flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded bg-gov-blue flex items-center justify-center group-hover:bg-gov-blue-light group-hover:scale-105 transition-all duration-300 shadow-lg">
                        <Camera size={28} className="text-white" />
                      </div>
                      <span className="text-white/80 font-bold text-xs tracking-widest uppercase group-hover:text-white transition-colors">
                        {t('login.startCamera')}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Power toggle */}
              {isCameraOn && (
                <button 
                  onClick={togglePower}
                  className="mt-5 p-2.5 bg-white hover:bg-red-50 text-gov-text-light hover:text-red-500 rounded transition-all border border-gov-border"
                  title="Turn off camera"
                >
                  <Power size={18} />
                </button>
              )}
            </div>

            {/* RIGHT: Instructions */}
            <div className="p-8">
              <h3 className="font-bold text-gov-text flex items-center gap-2 mb-6 text-base">
                <Fingerprint size={20} className="text-gov-blue" /> {t('login.howItWorks')}
              </h3>

              <div className="space-y-5">
                {[
                  { step: '1', title: t('login.step1Title'), desc: t('login.step1Desc') },
                  { step: '2', title: t('login.step2Title'), desc: t('login.step2Desc') },
                  { step: '3', title: t('login.step3Title'), desc: t('login.step3Desc') },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex gap-3 items-start">
                    <div className="shrink-0 w-8 h-8 bg-blue-50 rounded flex items-center justify-center text-sm font-bold text-gov-blue border border-blue-100">
                      {step}
                    </div>
                    <div>
                      <h4 className="font-bold text-gov-text text-sm">{title}</h4>
                      <p className="text-xs text-gov-text-light mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-4 border-t border-gov-border">
                <div className="flex justify-between items-center text-[10px] font-bold text-gov-text-light uppercase tracking-wider">
                  <span>{t('login.systemStatus', 'System Status')}</span>
                  <span className="flex items-center gap-2 text-gov-green">
                    <span className="w-2 h-2 bg-gov-green rounded-full animate-pulse" aria-hidden="true" />
                    {t('login.online', 'Online')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gov-blue text-white mt-8">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-blue-200">
          <span>{t('login.footerCopyright', 'LokSetu Secure Voting System')} &copy; {new Date().getFullYear()}</span>
          <span>{t('login.footerPowered', 'Powered by Hyperledger Fabric')}</span>
        </div>
      </footer>
    </div>
  );
};

export default Login;