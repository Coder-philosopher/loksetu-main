import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  MapPin, RefreshCw, CheckCircle, ScanFace, ShieldCheck, User, 
  Loader2, ChevronRight, Hash, Camera, AlertCircle, Activity as ActivityIcon 
} from 'lucide-react';
import FaceLivenessCam from '../components/FaceLivenessCam'; 

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const UpdateConstituency = () => {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(1); 
  const [cameraActive, setCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [formData, setFormData] = useState({
    voterId: '',
    currentLocation: 'Unknown', 
    newState: 'Delhi',
    constituencyId: '1'
  });
  
  const [logs, setLogs] = useState([
    { time: new Date().toLocaleTimeString(), msg: "Activate Camera Module to Start", type: "neutral" }
  ]);

  const addLog = (msg, type = "info") => {
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev]);
  };

  const CONSTITUENCY_LOOKUP = {
    'Delhi': { id: '1', region: 'Delhi' },
    'Mumbai': { id: '2', region: 'Mumbai' },
    'Bihar': { id: '3', region: 'Patna Sahib' }
  };

  const startCamera = () => {
    setCameraActive(true);
    setIsProcessing(false); 
    addLog("Camera module activated.", "info");
  };

  const handleFaceDetected = async (imgSrc) => {
    setCameraActive(false); 
    setIsProcessing(true); 
    addLog("Biometric Data Acquired. Verifying...", "loading");
    
    try {
      addLog("Querying Distributed Ledger...", "process");
      
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/search-voter-by-face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: imgSrc })
      });

      const data = await response.json();

      if (response.ok && data.voterId) {
        setFormData(prev => ({ ...prev, voterId: data.voterId }));
        addLog(`Identity Verified: ${data.voterId}`, "success");
        setIsProcessing(false);
        setActiveStep(2); 
      } else {
        throw new Error(data.error || "Identity not found in Global Ledger.");
      }

    } catch (error) {
      addLog(`Lookup Failed: ${error.message}`, "error");
      setIsProcessing(false); 
    } finally {
        if(activeStep === 1) setIsProcessing(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    addLog("Initiating Smart Contract Transaction...", "loading");
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/admin/update-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            voterId: formData.voterId, 
            newState: formData.newState, 
            newConstituencyId: formData.constituencyId
        })
      });

      const data = await response.json();

      if (response.ok) {
        addLog(`Block Mined Successfully. Update Complete.`, "success");
        setActiveStep(3); 
      } else {
        throw new Error(data.error || "Update Failed");
      }
    } catch (error) {
       addLog(`Transaction Reverted: ${error.message}`, "error");
    }
  };

  const handleStateChange = (e) => {
    const selectedState = e.target.value;
    const mapping = CONSTITUENCY_LOOKUP[selectedState];
    setFormData({ ...formData, newState: selectedState, constituencyId: mapping.id });
  };

  const resetSystem = () => {
    setActiveStep(1);
    setCameraActive(false);
    setIsProcessing(false);
    setFormData({ ...formData, voterId: '' });
    addLog("System reset. Ready for next applicant.", "neutral");
  };

  const currentLog = logs[0] || { msg: "System Ready", type: "neutral", time: "--:--" };

  const getLogIcon = (type) => {
    if (type === 'success') return <CheckCircle className="text-dash-success shrink-0" size={18} />;
    if (type === 'error') return <AlertCircle className="text-red-500 animate-pulse shrink-0" size={18} />;
    if (type === 'loading' || type === 'process') return <Loader2 className="text-dash-primary animate-spin shrink-0" size={18} />;
    if (type === 'info') return <ActivityIcon className="text-dash-text-secondary shrink-0" size={18} />;
    return <ScanFace className="text-dash-text-secondary shrink-0" size={18} />;
  };

  const getLogBarColor = (type) => {
    if (type === 'success') return 'bg-dash-success';
    if (type === 'error') return 'bg-red-500';
    if (type === 'loading' || type === 'process') return 'bg-dash-primary';
    return 'bg-gray-300';
  };

  const getLogTextColor = (type) => {
    if (type === 'success') return 'text-dash-success';
    if (type === 'error') return 'text-red-600';
    if (type === 'loading' || type === 'process') return 'text-dash-primary';
    return 'text-dash-text-secondary';
  };

  const steps = [
    { id: 1, label: t('updateConstituency.authenticate') },
    { id: 2, label: t('updateConstituency.update') },
    { id: 3, label: t('updateConstituency.complete') },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-b-2xl bg-[#5B4DB1] px-6 py-5 text-white">
        <div>
          <p className="text-xs font-semibold tracking-[0.3em]">UPDATE CONSTITUENCY</p>
          <h2 className="text-2xl font-bold mt-2">UPDATE CONSTITUENCY</h2>
          <p className="text-sm text-white/80 mt-2">Transfer voter to a new constituency securely</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-stretch">
        
        {/* LEFT: FORM STEPS */}
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 lg:p-8 flex flex-col">
          
          {/* Step indicator */}
          <div className="mb-8">
            <div className="flex items-center gap-3">
              {steps.map((step, idx) => {
                const isActive = activeStep === step.id;
                const isComplete = activeStep > step.id;
                return (
                  <div key={step.id} className="flex items-center gap-3 flex-1">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isComplete ? 'bg-emerald-500 text-white' : isActive ? 'bg-[#5B4DB1] text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {step.id}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold ${isActive ? 'text-[#5B4DB1]' : isComplete ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {step.label}
                      </p>
                    </div>
                    {idx < steps.length - 1 && (
                      <div className={`h-0.5 flex-1 ${activeStep > step.id ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex-grow flex flex-col justify-center">
            {/* STEP 1: INSTRUCTIONS */}
            {activeStep === 1 && (
              <div className="space-y-5 animate-fade-in rounded-xl border-l-4 border-blue-400 bg-blue-50 p-5">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                  <ScanFace size={13} /> {t('updateConstituency.biometricAuth')}
                </span>
                <div>
                  <h3 className="text-xl font-bold text-dash-text mb-3">{t('updateConstituency.voterAuth')}</h3>
                  <p className="text-dash-text-secondary text-sm leading-relaxed">
                    {t('updateConstituency.clickStartCamera')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-bold border transition-colors ${
                    isProcessing ? 'bg-blue-100 border-blue-200 text-blue-700' :
                    cameraActive ? 'bg-green-100 border-green-200 text-green-700' : 
                    'bg-gray-100 border-gray-200 text-gray-500'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      isProcessing ? 'bg-blue-500 animate-bounce' :
                      cameraActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                    }`} /> 
                    {isProcessing ? t('updateConstituency.processingStatus') : cameraActive ? t('updateConstituency.cameraActiveStatus') : t('updateConstituency.cameraStandbyStatus')}
                  </span>
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-[#5B4DB1] to-[#7C6AE6] hover:opacity-90 transition"
                  >
                    {t('updateConstituency.startCamera')}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: UPDATE FORM */}
            {activeStep === 2 && (
              <div className="rounded-xl border border-slate-200 bg-white shadow-md overflow-hidden animate-slide-up">
                <div className="px-5 py-4 border-b border-slate-200 bg-blue-50 flex justify-between items-center">
                  <h3 className="font-bold text-dash-text flex items-center gap-2 text-sm">
                    <MapPin className="text-blue-600" size={18} /> {t('updateConstituency.updateConstituency')}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    <CheckCircle size={12} /> {t('updateConstituency.verified')}
                  </span>
                </div>
                <div className="p-5 space-y-4">
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 shrink-0">
                      <Hash size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">{t('updateConstituency.voterId')}</p>
                      <p className="text-sm font-mono font-bold text-dash-text truncate">{formData.voterId}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="dash-label">{t('updateConstituency.newState')}</label>
                      <select 
                        className="dash-input border border-slate-300 rounded-md"
                        value={formData.newState} onChange={handleStateChange}
                      >
                        {Object.keys(CONSTITUENCY_LOOKUP).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="dash-label">{t('updateConstituency.code')}</label>
                      <input type="text" readOnly className="dash-input bg-slate-100 text-dash-text-secondary font-mono border border-slate-300 rounded-md"
                        value={formData.constituencyId} />
                    </div>
                  </div>
                  <button onClick={handleUpdate} className="w-full py-3 bg-gradient-to-r from-[#5B4DB1] to-[#7C6AE6] text-white font-bold rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2">
                    <RefreshCw size={18} /> {t('updateConstituency.confirmMigration')}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: SUCCESS */}
            {activeStep === 3 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center animate-fade-in">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5 text-emerald-600">
                  <CheckCircle size={40} />
                </div>
                <h3 className="text-xl font-bold text-dash-text">{t('updateConstituency.updateComplete')}</h3>
                <p className="text-dash-text-secondary mt-2 mb-6 text-sm">{t('updateConstituency.ledgerUpdated')}</p>
                <button onClick={resetSystem} className="bg-gradient-to-r from-[#5B4DB1] to-[#7C6AE6] text-white px-6 py-3 rounded-lg font-bold hover:opacity-90 transition flex items-center gap-2 mx-auto">
                  {t('updateConstituency.processNext')} <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>

          {/* LOG */}
          <div className="mt-6">
            <div className="bg-white/70 rounded-lg border border-slate-200 p-4 flex items-center gap-3 relative overflow-hidden shadow-sm">
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${getLogBarColor(currentLog.type)}`} />
              <div className="ml-2">{getLogIcon(currentLog.type)}</div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold leading-tight truncate ${getLogTextColor(currentLog.type)}`}>
                  {currentLog.msg}
                </p>
                <p className="text-[10px] font-mono text-dash-text-secondary mt-0.5">
                  {currentLog.time} - AES-256
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: CAMERA */}
        <div className="rounded-2xl bg-gradient-to-br from-indigo-900 to-blue-800 relative flex flex-col items-center justify-center p-6 overflow-hidden min-h-[560px]">
          <div className="absolute top-4 right-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-full ${
              cameraActive || isProcessing ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' : 'bg-red-500/20 text-red-200 border border-red-500/30'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cameraActive || isProcessing ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {cameraActive || isProcessing ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <div className="relative w-full max-w-[360px] aspect-[3/4] rounded-xl overflow-hidden bg-gray-900/80 shadow-xl ring-1 ring-white/10 grid place-items-center">
            <style>{`.uc-cam video { width:100%!important; height:100%!important; object-fit:cover!important; transform:scaleX(-1); }`}</style>

            <div className="col-start-1 row-start-1 w-full h-full z-0">
              <div className="uc-cam w-full h-full flex items-center justify-center">
                {activeStep === 1 && cameraActive && !isProcessing && (
                  <FaceLivenessCam onCapture={handleFaceDetected} isProcessing={!cameraActive} />
                )}
                {(activeStep !== 1 || !cameraActive) && (
                  <div className="w-full h-full bg-gray-900/80" />
                )}
              </div>
            </div>

            {/* Camera overlays */}
            <div className="col-start-1 row-start-1 w-full h-full z-10 pointer-events-none relative flex flex-col justify-between">
              <div className="w-full p-4 flex justify-between items-center bg-gradient-to-b from-black/70 to-transparent">
                <div className="flex items-center gap-2 text-white/70">
                  <ScanFace size={14} />
                  <span className="text-[10px] font-bold tracking-widest uppercase">Biometric Feed</span>
                </div>
                {activeStep === 1 && (
                  <span className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold rounded border ${
                    isProcessing ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
                    cameraActive ? 'bg-red-500/20 text-red-400 border-red-500/30' : 
                    'bg-gray-500/20 text-gray-400 border-gray-500/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      isProcessing ? 'bg-blue-400 animate-bounce' :
                      cameraActive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'
                    }`} /> 
                    {isProcessing ? 'FETCHING' : cameraActive ? 'LIVE' : 'OFFLINE'}
                  </span>
                )}
              </div>

              {activeStep === 1 && !cameraActive && !isProcessing && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
                  <button onClick={startCamera} className="group flex flex-col items-center gap-3">
                    <div className="w-18 h-18 rounded-full bg-gray-900/70 border-4 border-emerald-400/40 flex items-center justify-center hover:bg-emerald-500 hover:border-emerald-400 hover:scale-110 transition-all duration-300 shadow-xl p-4">
                      <Camera size={30} className="text-emerald-200 group-hover:text-white" />
                    </div>
                    <span className="text-white font-bold text-xs tracking-widest uppercase opacity-80">{t('updateConstituency.startCamera')}</span>
                  </button>
                </div>
              )}

              {activeStep === 1 && cameraActive && !isProcessing && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="w-60 h-60 rounded-full border border-white/20 relative">
                    <div className="absolute inset-[-2px] rounded-full border-t-2 border-dash-primary animate-spin opacity-80" />
                  </div>
                </div>
              )}

              {isProcessing && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                  <Loader2 size={40} className="text-dash-primary animate-spin mb-3" />
                  <p className="text-white font-bold text-sm tracking-wider">{t('updateConstituency.verifying')}</p>
                </div>
              )}

              {activeStep === 2 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/90 z-30">
                  <div className="text-center animate-fade-in">
                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-green-500/20">
                      <User size={32} className="text-green-400" />
                    </div>
                    <p className="text-base font-bold text-white">{t('updateConstituency.identityVerified')}</p>
                    <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">{t('updateConstituency.matchFound')}</p>
                  </div>
                </div>
              )}

              <div className="w-full p-4 flex justify-between items-center text-[10px] font-mono text-gray-300 bg-gradient-to-t from-black/70 to-transparent">
                <span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-emerald-300" /> AES-256</span>
                <span className="opacity-70">LokSetu v2.0</span>
              </div>
            </div>
          </div>

          <button
            onClick={startCamera}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition shadow-lg"
          >
            <Camera size={16} /> Start Camera
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateConstituency;
