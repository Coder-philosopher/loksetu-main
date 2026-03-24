import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { Eye, CheckCircle, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';

// ─── Tuned constants ───────────────────────────────────────
const BLINK_THRESHOLD = 0.26;
const EYE_OPEN_THRESHOLD = 0.29;

// ─── EAR helper ───────────────────────────────────────────
const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
const getEAR = (eye) => {
  const A = dist(eye[1], eye[5]);
  const B = dist(eye[2], eye[4]);
  const C = dist(eye[0], eye[3]);
  return (A + B) / (2.0 * C);
};

// ─── Scanning line ────────────────────────────────────────
const ScanLine = ({ active }) =>
  active ? (
    <div className="absolute inset-x-0 h-[2px] z-30 pointer-events-none overflow-hidden"
      style={{ animation: 'scanDown 2.5s linear infinite', top: 0 }}>
      <div className="w-full h-full bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
    </div>
  ) : null;

// ─── Face guide oval ──────────────────────────────────────
const FaceOval = ({ status }) => {
  const strokeColor =
    status === 'verified' ? '#10b981'
    : status === 'blinking' ? '#3b82f6'
    : status === 'idle' ? 'rgba(245,158,11,0.5)'
    : 'rgba(148,163,184,0.3)';

  const glowColor =
    status === 'verified' ? 'rgba(16,185,129,0.3)'
    : status === 'blinking' ? 'rgba(59,130,246,0.3)'
    : 'transparent';

  return (
    <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <ellipse cx="50" cy="48" rx="26" ry="34"
        fill="none"
        stroke={strokeColor}
        strokeWidth="0.8"
        filter={status !== 'idle' && status !== 'loading' ? 'url(#glow)' : ''}
        style={{ transition: 'stroke 0.4s ease' }}
      />
      {/* Darken outside oval - lighter for light theme */}
      <mask id="ovalMask">
        <rect width="100" height="100" fill="white" />
        <ellipse cx="50" cy="48" rx="26" ry="34" fill="black" />
      </mask>
      <rect width="100" height="100" fill={`rgba(248,250,252,0.65)`} mask="url(#ovalMask)" />
    </svg>
  );
};

// ─── Status overlay content ───────────────────────────────
const StatusOverlay = ({ status, t }) => {
  if (status === 'loading') return (
    <div className="absolute inset-0 z-40 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 rounded-full border border-amber-300 bg-amber-50 flex items-center justify-center">
        <Loader2 size={22} className="text-amber-500 animate-spin" />
      </div>
      <p className="font-['JetBrains_Mono',monospace] text-[10px] font-bold text-amber-600 uppercase tracking-[2px]">
        Loading AI Models
      </p>
      <div className="flex gap-1">
        {[0,1,2].map(i => (
          <div key={i} className="w-1 h-1 rounded-full bg-amber-400 animate-pulse"
            style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  );

  if (status === 'verifying') return (
    <div className="absolute inset-0 z-40 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
      <Loader2 size={36} className="text-amber-500 animate-spin" />
      <div className="text-center">
        <p className="text-sm font-bold text-slate-800">Verifying Identity</p>
        <p className="font-['JetBrains_Mono',monospace] text-[9px] text-slate-500 uppercase tracking-[2px] mt-0.5">
          Matching biometric data
        </p>
      </div>
    </div>
  );

  if (status === 'verified') return (
    <div className="absolute inset-0 z-40 bg-white/95 flex flex-col items-center justify-center gap-3">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" style={{ animationDuration: '1.2s' }} />
        <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center relative">
          <CheckCircle size={28} className="text-emerald-500" />
        </div>
      </div>
      <div className="text-center">
        <p className="font-bold text-sm text-slate-800">Liveness Verified</p>
        <p className="font-['JetBrains_Mono',monospace] text-[9px] text-emerald-600 uppercase tracking-[2px] mt-0.5">
          Processing capture…
        </p>
      </div>
    </div>
  );

  return null;
};

// ─── Bottom instruction bar ───────────────────────────────
const InstructionBar = ({ status }) => {
  const configs = {
    idle: {
      icon: <Eye size={13} className="text-amber-500 flex-shrink-0" />,
      text: 'Look at camera · Blink naturally to verify',
      bg: 'bg-white/90 border-slate-200 shadow-sm',
      textColor: 'text-slate-700',
    },
    blinking: {
      icon: <RefreshCw size={13} className="text-blue-500 animate-spin flex-shrink-0" />,
      text: 'Blink detected · Open your eyes',
      bg: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-700',
    },
  };
  const cfg = configs[status];
  if (!cfg) return null;
  return (
    <div className="absolute bottom-3 inset-x-3 z-30">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border backdrop-blur-sm ${cfg.bg}`}>
        {cfg.icon}
        <span className={`text-[10px] font-semibold ${cfg.textColor}`}>{cfg.text}</span>
      </div>
    </div>
  );
};

// ─── EAR debug pill ───────────────────────────────────────
const DebugPill = ({ ear, status }) => (
  <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5 bg-white/90 border border-slate-200 rounded-full px-2.5 py-1 backdrop-blur-sm shadow-sm">
    <div className={`w-1.5 h-1.5 rounded-full ${
      status === 'blinking' ? 'bg-blue-500' : status === 'verified' ? 'bg-emerald-500' : 'bg-amber-500'
    }`} />
    <span className="font-['JetBrains_Mono',monospace] text-[9px] text-slate-600">
      EAR {ear}
    </span>
  </div>
);

// ─── Main component ───────────────────────────────────────
const FaceLivenessCam = ({ onCapture, isProcessing }) => {
  const webcamRef = useRef(null);
  const timerRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [modelLoaded, setModelLoaded] = useState(false);
  const [debugEAR, setDebugEAR] = useState('—');

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        ]);
        setModelLoaded(true);
        setStatus('idle');
      } catch (err) {
        console.error('Model load error:', err);
        setStatus('error');
      }
    })();
  }, []);

  const captureScreenshot = useCallback((attempt = 0) => {
    if (webcamRef.current) {
      const img = webcamRef.current.getScreenshot();
      if (img) { onCapture(img); return; }
      const video = webcamRef.current.video;
      if (video?.readyState === 4 && video.videoWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        if (dataUrl && dataUrl !== 'data:,') { onCapture(dataUrl); return; }
      }
    }
    if (attempt < 6) { setTimeout(() => captureScreenshot(attempt + 1), 400); return; }
    onCapture(null);
  }, [onCapture]);

  const checkLiveness = useCallback(async () => {
    if (!webcamRef.current?.video || status === 'verified') return;
    const video = webcamRef.current.video;
    if (video.readyState !== 4) return;
    try {
      const det = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
        .withFaceLandmarks();
      if (det) {
        const lm = det.landmarks;
        const avg = (getEAR(lm.getLeftEye()) + getEAR(lm.getRightEye())) / 2;
        setDebugEAR(avg.toFixed(3));
        if (avg < BLINK_THRESHOLD) {
          if (status !== 'blinking') setStatus('blinking');
        } else if (status === 'blinking' && avg > EYE_OPEN_THRESHOLD) {
          setStatus('verified');
          clearInterval(timerRef.current);
          setTimeout(captureScreenshot, 500);
        }
      }
    } catch (e) { console.error('AI error:', e); }
  }, [status, captureScreenshot]);

  useEffect(() => {
    if (modelLoaded && status !== 'verified') {
      timerRef.current = setInterval(checkLiveness, 33);
    }
    return () => clearInterval(timerRef.current);
  }, [modelLoaded, status, checkLiveness]);

  const displayStatus = isProcessing && status !== 'verified' ? 'verifying' : status;

  return (
    <>
      <style>{`
        @keyframes scanDown {
          0% { top: 0%; }
          100% { top: 100%; }
        }
      `}</style>

      <div className="relative w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden">

        {/* Webcam */}
        <Webcam
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={{ width: 480, height: 480, facingMode: 'user' }}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)', display: 'block' }}
        />

        {/* Face oval guide */}
        {(displayStatus === 'idle' || displayStatus === 'blinking') && (
          <FaceOval status={displayStatus} />
        )}

        {/* Scan line (idle) */}
        <ScanLine active={displayStatus === 'idle'} />

        {/* Debug EAR */}
        {modelLoaded && displayStatus !== 'loading' && (
          <DebugPill ear={debugEAR} status={displayStatus} />
        )}

        {/* Instruction bar */}
        <InstructionBar status={displayStatus} />

        {/* Status overlays */}
        <StatusOverlay status={displayStatus} />

        {/* Grid texture overlay - light theme */}
        <div className="absolute inset-0 pointer-events-none z-[5]" style={{
          backgroundImage: 'linear-gradient(rgba(0,0,0,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.02) 1px,transparent 1px)',
          backgroundSize: '20px 20px',
        }} />
      </div>
    </>
  );
};

export default FaceLivenessCam;