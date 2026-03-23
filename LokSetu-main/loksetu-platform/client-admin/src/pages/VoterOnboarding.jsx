import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Save, UserPlus, CheckCircle, Camera, Citrus, AlertCircle, 
  Calculator, ScanFace, MapPin, Loader2, ShieldCheck
} from 'lucide-react';
import FaceLivenessCam from '../components/FaceLivenessCam'; 

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const VoterOnboarding = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState('idle');
  const [imgSrc, setImgSrc] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [logState, setLogState] = useState({ message: t('voterOnboarding.activateCamera'), type: "neutral" });
  const [errors, setErrors] = useState({});
  
  const [formData, setFormData] = useState({
    fullName: '',
    epicId: '',
    homeState: 'Delhi',
    constituencyId: '1'
  });

  const CONSTITUENCY_LOOKUP = {
    'Delhi': { id: '1', region: 'North Delhi Central' },
    'Mumbai': { id: '2', region: 'Mumbai South' },
    'Bihar': { id: '3', region: 'Patna Sahib' }
  };

  const validate = () => {
    const e = {};
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) e.fullName = t('voterOnboarding.errorFullName');
    if (!/^[A-Z]{3}\d{6,7}$/i.test(formData.epicId.trim())) e.epicId = t('voterOnboarding.errorEpicId');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const startCamera = () => {
    if (!validate()) return;
    setCameraActive(true);
    setLogState({ message: t('voterOnboarding.cameraActivated'), type: "loading" });
  };

  const handleLivenessVerified = (imageSrc) => {
    if (!imageSrc) {
      setLogState({ message: t('voterOnboarding.captureFailed'), type: "error" });
      return;
    }
    setImgSrc(imageSrc);
    setMode('captured');
    setCameraActive(false); 
    setLogState({ message: t('voterOnboarding.biometricAcquired'), type: "success" });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (mode !== 'captured' || !imgSrc || submitting) return;
    if (!validate()) return;

    setSubmitting(true);
    setLogState({ message: t('voterOnboarding.encrypting'), type: "loading" });

    try {
      const payload = {
        fullName: formData.fullName.trim(),
        epicId: formData.epicId.trim().toUpperCase(),
        homeState: formData.homeState,
        constituencyId: formData.constituencyId,
        base64Image: imgSrc 
      };

      const headers = { 'Content-Type': 'application/json' };
      const adminToken = localStorage.getItem('adminToken');
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;

      const response = await fetch(`${API_BASE_URL}/api/v1/admin/register-voter`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setLogState({ 
          message: `Voter Registered Successfully! ID: ${String(data.voterId).substring(0, 12)}...`, 
          type: "success" 
        });
      } else {
        const msgs = {
          409: `Duplicate Entity: ${data.message}`,
          403: `Liveness Rejected: ${data.message || 'Image rejected. Please retake with live camera.'}`,
          400: `Invalid Input: ${data.message || 'Bad request.'}`,
          401: `Authentication Required. Please login as admin.`,
          413: `Image Too Large. Backend Rejected Payload.`,
          500: `Server Error: ${data.message || data.detail || 'Registration failed. Check Backend Console.'}`,
        };
        setLogState({ message: msgs[response.status] || data.message || "Registration Failed", type: "error" });
        if ([403, 400].includes(response.status) && ['INVALID_IMAGE_FORMAT','INVALID_IMAGE'].includes(data.error)) reset();
        if (response.status === 403) reset();
      }
    } catch (error) {
      setLogState({ message: `Network/API Error: ${error.message}`, type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStateChange = (e) => {
    const selectedState = e.target.value;
    const mapping = CONSTITUENCY_LOOKUP[selectedState];
    setFormData({ ...formData, homeState: selectedState, constituencyId: mapping.id });
  };

  const reset = () => {
    setImgSrc(null);
    setMode('idle');
    setCameraActive(false); 
    setLogState({ message: t('voterOnboarding.resetComplete'), type: "neutral" });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* HEADER */}
      <div>
        <h2 className="section-title">{t('voterOnboarding.title')}</h2>
        <p className="text-sm text-dash-text-secondary mt-2">
          {t('voterOnboarding.subtitle')} <span className="text-red-500">*</span> {t('voterOnboarding.mandatory')}.
        </p>
      </div>

      {/* MAIN CARD */}
      <div className="dash-card overflow-hidden flex flex-col lg:flex-row min-h-[580px]">
        
        {/* LEFT: FORM */}
        <div className="w-full lg:w-5/12 p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-dash-border relative flex flex-col justify-center">
            <div className="absolute top-0 left-0 w-full h-1 bg-dash-accent"></div>

            <div className="mb-6 pb-4 border-b border-dash-border">
              <h3 className="text-base font-bold text-dash-text">{t('voterOnboarding.applicantDetails')}</h3>
              <p className="text-xs text-dash-text-secondary mt-1">{t('voterOnboarding.enterInfo')}</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-5 w-full">
              
              {/* Full Name */}
              <div className="group">
                <label className="dash-label">
                  {t('voterOnboarding.fullName')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <UserPlus className="absolute left-3.5 top-3.5 text-gray-400 group-focus-within:text-dash-primary transition-colors" size={16} />
                  <input required type="text" 
                    className={`dash-input pl-11 ${errors.fullName ? 'border-red-400 focus:ring-red-200 focus:border-red-400' : ''}`}
                    placeholder={t('voterOnboarding.namePlaceholder')}
                    value={formData.fullName} onChange={e => { setFormData({...formData, fullName: e.target.value}); if(errors.fullName) setErrors(p => ({...p, fullName: undefined})); }} 
                  />
                </div>
                {errors.fullName && <p className="text-xs text-red-500 mt-1 font-medium">{errors.fullName}</p>}
              </div>

              {/* EPIC ID */}
              <div className="group">
                <label className="dash-label">
                  {t('voterOnboarding.epicId')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calculator className="absolute left-3.5 top-3.5 text-gray-400 group-focus-within:text-dash-primary transition-colors" size={16} />
                  <input required type="text" 
                    className={`dash-input pl-11 font-mono uppercase tracking-wide ${errors.epicId ? 'border-red-400 focus:ring-red-200 focus:border-red-400' : ''}`}
                    placeholder="ABC676767"
                    value={formData.epicId} onChange={e => { setFormData({...formData, epicId: e.target.value}); if(errors.epicId) setErrors(p => ({...p, epicId: undefined})); }} 
                  />
                </div>
                {errors.epicId && <p className="text-xs text-red-500 mt-1 font-medium">{errors.epicId}</p>}
              </div>
              
              {/* State & Zone */}
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="dash-label">{t('voterOnboarding.stateRegion')}</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3.5 text-gray-400 pointer-events-none" size={16} />
                      <select className="dash-input pl-10 appearance-none cursor-pointer"
                        value={formData.homeState} onChange={handleStateChange}>
                        {Object.keys(CONSTITUENCY_LOOKUP).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                 </div>
                 <div>
                    <label className="dash-label">{t('voterOnboarding.zoneCode')}</label>
                    <div className="w-full py-3 bg-gray-100 border border-dash-border rounded text-dash-text-secondary font-mono text-center font-bold">
                      {formData.constituencyId}
                    </div>
                 </div>
              </div>

              {/* Action Button */}
              <div className="pt-3 border-t border-dash-border">
                <button 
                  type="submit"
                  disabled={mode !== 'captured' || submitting}
                  className={`w-full py-3 rounded font-semibold text-sm uppercase flex items-center justify-center gap-2 transition-all duration-200 ${
                      mode === 'captured' && !submitting
                      ? 'bg-dash-primary text-white hover:bg-dash-primary-light shadow-sm' 
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-dash-border'
                  }`}
                >
                  {submitting ? <><Loader2 size={16} className="animate-spin" /> {t('voterOnboarding.processing')}</> : mode === 'captured' ? <><Save size={16}/> {t('voterOnboarding.submitRegistration')}</> : <><ScanFace size={16}/> {t('voterOnboarding.scanFace')}</>}
                </button>
                <p className="text-center text-[10px] text-dash-text-secondary font-medium mt-2 tracking-wide uppercase flex items-center justify-center gap-1">
                  <ShieldCheck size={10} /> {t('voterOnboarding.securedByBlockchain')}
                </p>
              </div>
            </form>
        </div>

        {/* RIGHT: CAMERA & BIOMETRICS */}
        <div className="w-full lg:w-7/12 bg-gray-50 p-6 flex flex-col items-center justify-between relative">
            
            {/* Status Badge */}
            <div className={`px-4 py-2 rounded text-xs font-semibold flex items-center gap-2 border transition-all duration-300 ${
                mode === 'captured' 
                ? 'bg-green-50 text-dash-success border-green-200' 
                : cameraActive
                  ? 'bg-blue-50 text-dash-primary border-blue-200 animate-pulse'
                  : 'bg-white text-dash-text-secondary border-dash-border'
            }`}>
                <Citrus size={14} className={cameraActive ? 'animate-spin' : ''} />
                {mode === 'captured' ? t('voterOnboarding.biometricComplete') : cameraActive ? t('voterOnboarding.livenessActive') : t('voterOnboarding.cameraStandby')}
            </div>

            {/* CAMERA FRAME */}
            <div className="relative group z-0 flex-grow flex items-center justify-center w-full max-w-[400px] my-4">
                <div className={`absolute top-2 left-2 w-6 h-6 border-t-[3px] border-l-[3px] transition-colors z-10 ${mode==='captured'?'border-dash-success':'border-dash-primary'}`} />
                <div className={`absolute top-2 right-2 w-6 h-6 border-t-[3px] border-r-[3px] transition-colors z-10 ${mode==='captured'?'border-dash-success':'border-dash-primary'}`} />
                <div className={`absolute bottom-2 left-2 w-6 h-6 border-b-[3px] border-l-[3px] transition-colors z-10 ${mode==='captured'?'border-dash-success':'border-dash-primary'}`} />
                <div className={`absolute bottom-2 right-2 w-6 h-6 border-b-[3px] border-r-[3px] transition-colors z-10 ${mode==='captured'?'border-dash-success':'border-dash-primary'}`} />

                <div className="w-full aspect-square bg-gray-900 rounded-md overflow-hidden shadow-lg relative flex items-center justify-center">
                    {imgSrc ? (
                        <>
                            <img src={imgSrc} className="w-full h-full object-cover" alt="Captured" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button onClick={reset} className="bg-white text-dash-text px-5 py-2 rounded font-semibold text-sm hover:bg-gray-100 transition flex items-center gap-2">
                                  <Camera size={16} /> {t('voterOnboarding.retakePhoto')}
                                </button>
                            </div>
                            <div className="absolute bottom-3 bg-dash-success text-white px-4 py-1.5 rounded text-xs font-semibold flex items-center gap-2 shadow">
                                <CheckCircle size={14} /> {t('voterOnboarding.livenessVerified')}
                            </div>
                        </>
                    ) : (
                        <div className="w-full h-full relative flex items-center justify-center bg-gray-900">
                            {cameraActive ? (
                                <div className="absolute inset-0 z-0">
                                    <div className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover">
                                      <FaceLivenessCam onCapture={handleLivenessVerified} />
                                    </div>
                                </div>
                            ) : (
                              <div className="absolute left-1/2 top-1/2 z-20 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                                <div className="pointer-events-auto text-center flex flex-col items-center gap-3">
                                  <button 
                                    onClick={startCamera}
                                    className="w-16 h-16 rounded-full bg-dash-primary flex items-center justify-center hover:bg-dash-primary-light hover:scale-105 transition-all duration-300 shadow-lg"
                                  >
                                    <Camera size={28} className="text-white" />
                                  </button>
                                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{t('voterOnboarding.startCamera')}</p>
                                </div>
                              </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* SYSTEM LOG */}
            <div className="w-full max-w-[400px]">
                <div className="bg-white rounded border border-dash-border p-4 shadow-sm min-h-[56px] flex items-center relative overflow-hidden">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                        logState.type === 'error' ? 'bg-red-500' : 
                        logState.type === 'success' ? 'bg-dash-success' : 
                        logState.type === 'loading' ? 'bg-dash-primary' : 'bg-gray-300'
                    }`} />
                    <div className="pl-3 flex items-start gap-3 w-full">
                        {logState.type === 'error' ? <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" /> : 
                         logState.type === 'success' ? <CheckCircle size={16} className="text-dash-success mt-0.5 shrink-0" /> :
                         logState.type === 'loading' ? <Loader2 size={16} className="text-dash-primary mt-0.5 shrink-0 animate-spin" /> :
                         <ScanFace size={16} className="text-gray-400 mt-0.5 shrink-0" />}
                        <div className="min-w-0">
                           <p className={`text-sm font-semibold leading-tight truncate ${
                                logState.type === 'error' ? 'text-red-600' : 
                                logState.type === 'success' ? 'text-dash-success' : 
                                'text-dash-text'
                            }`}>{logState.message}</p>
                            <p className="text-[10px] text-dash-text-secondary font-mono mt-0.5">
                                {new Date().toLocaleTimeString()} â€¢ AES-256 Encrypted
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default VoterOnboarding;
