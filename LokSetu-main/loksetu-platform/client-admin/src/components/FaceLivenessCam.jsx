import React, { useRef, useState, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { Eye, CheckCircle, Loader2, RefreshCw } from 'lucide-react';

// --- TUNED CONSTANTS (Based on your logs) ---
const BLINK_THRESHOLD = 0.26;  // Trigger blink when EAR drops below this
const EYE_OPEN_THRESHOLD = 0.29; // Verify blink when EAR goes back above this

const FaceLivenessCam = ({ onCapture, isProcessing }) => {
  const webcamRef = useRef(null);
  const timerRef = useRef(null);
  
  const [status, setStatus] = useState("loading"); // loading, idle, blinking, verified
  const [modelLoaded, setModelLoaded] = useState(false);
  const [debugEAR, setDebugEAR] = useState(0); 

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models'; 
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        ]);
        setModelLoaded(true);
        setStatus("idle");
      } catch (err) {
        console.error("Model Load Error:", err);
      }
    };
    loadModels();
  }, []);

  const getEAR = (eye) => {
    const dist = (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    const A = dist(eye[1], eye[5]);
    const B = dist(eye[2], eye[4]);
    const C = dist(eye[0], eye[3]);
    return (A + B) / (2.0 * C);
  };

  const captureScreenshot = useCallback((attempt = 0) => {
    if (webcamRef.current) {
      // Try the built-in getScreenshot first
      const image = webcamRef.current.getScreenshot();
      if (image) {
        onCapture(image);
        return;
      }
      // Fallback: capture directly from the video element via Canvas API
      const video = webcamRef.current.video;
      if (video && video.readyState === 4 && video.videoWidth > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        if (dataUrl && dataUrl !== 'data:,') {
          onCapture(dataUrl);
          return;
        }
      }
    }
    if (attempt < 6) {
      setTimeout(() => captureScreenshot(attempt + 1), 400);
      return;
    }
    console.warn('Screenshot capture failed after retries — webcam ref not ready');
    onCapture(null);
  }, [onCapture]);

  const checkLiveness = useCallback(async () => {
    if (!webcamRef.current || !webcamRef.current.video) return;
    if (status === 'verified') return;

    const video = webcamRef.current.video;
    if (video.readyState !== 4) return;

    try {
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
        const detection = await faceapi.detectSingleFace(video, options).withFaceLandmarks();

        if (detection) {
            const landmarks = detection.landmarks;
            const leftEAR = getEAR(landmarks.getLeftEye());
            const rightEAR = getEAR(landmarks.getRightEye());
            const avgEAR = (leftEAR + rightEAR) / 2;

            setDebugEAR(avgEAR.toFixed(3));
            console.log(`EAR: ${avgEAR.toFixed(3)} | Status: ${status}`);

            // 1. Detect Blink (Eyes Closed)
            if (avgEAR < BLINK_THRESHOLD) {
                if (status !== "blinking") setStatus("blinking");
            } 
            // 2. Detect Open (Blink Finished)
            else if (status === "blinking" && avgEAR > EYE_OPEN_THRESHOLD) {
                setStatus("verified");
                clearInterval(timerRef.current);
                setTimeout(captureScreenshot, 500);
            }
        }
    } catch (err) {
        console.error("AI Error:", err);
    }
  }, [status, captureScreenshot]);

  useEffect(() => {
    if (modelLoaded && status !== 'verified') {
      timerRef.current = setInterval(checkLiveness, 33);
    }
    return () => clearInterval(timerRef.current);
  }, [modelLoaded, status, checkLiveness]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-transparent">
      <Webcam
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        className="w-full h-full object-cover"
        videoConstraints={{ width: 480, height: 480, facingMode: "user" }}
        style={{ objectPosition: 'center center', transform: 'scaleX(-1)', display: 'block' }}
      />
      
      {/* DEBUG OVERLAY */}
      <div className="absolute top-4 left-0 right-0 text-center pointer-events-none z-20">
        <span className="bg-black/60 text-white text-[10px] px-2 py-1 rounded font-mono">
           EAR: {debugEAR} {status === 'blinking' ? '(Closed)' : '(Open)'}
        </span>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/10">
        {!modelLoaded && (
            <div className="text-blue-400 flex flex-col items-center animate-pulse">
                <Loader2 className="animate-spin mb-2" size={32} />
                <span className="text-xs font-mono">Loading AI...</span>
            </div>
        )}

        {modelLoaded && status === 'idle' && !isProcessing && (
            <div className="text-yellow-400 flex flex-col items-center animate-in zoom-in bg-black/40 p-4 rounded-xl backdrop-blur-sm">
                <Eye size={40} className="mb-2 animate-bounce" />
                <span className="text-sm font-bold">Blink to Verify</span>
            </div>
        )}

         {status === 'blinking' && (
            <div className="text-blue-400 flex flex-col items-center animate-in zoom-in bg-black/40 p-4 rounded-xl backdrop-blur-sm">
                <RefreshCw size={40} className="mb-2 animate-spin" />
                <span className="text-sm font-bold">Hold... Open Eyes</span>
            </div>
        )}

        {(status === 'verified' || isProcessing) && (
          <div className="text-green-400 flex flex-col items-center animate-in fade-in bg-black/60 p-6">
                <CheckCircle size={48} className="mb-2" />
                <span className="text-sm font-bold">Verified</span>
            </div>
        )}
      </div>
    </div>
  );
};

export default FaceLivenessCam;