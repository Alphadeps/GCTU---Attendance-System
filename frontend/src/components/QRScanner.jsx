import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

const QRScanner = ({ onScan }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setErrorMsg('');
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Prefer back camera
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
        videoRef.current.play();
        animationFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setErrorMsg('Unable to access camera. Please ensure permissions are granted.');
      setScanning(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      
      // Draw video frame to hidden canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code) {
        // Scanned successfully!
        onScan(code.data);
        stopCamera();
        return;
      }
    }

    if (streamRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-900 rounded-xl border border-slate-800 shadow-xl max-w-sm w-full mx-auto">
      <div className="relative w-full aspect-square rounded-lg overflow-hidden border-2 border-slate-800 bg-slate-950 flex items-center justify-center">
        {scanning && (
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        
        {/* Helper layout grid/scanning frame */}
        {scanning && (
          <div className="absolute inset-0 border-[35px] border-slate-950/65 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-2 border-emerald-500 rounded relative">
              {/* Laser scanner line effect */}
              <div className="absolute left-0 right-0 h-[2px] bg-emerald-500/80 shadow-[0_0_8px_#10b981] animate-pulse top-1/2"></div>
            </div>
          </div>
        )}

        {!scanning && !errorMsg && (
          <div className="text-slate-400 text-sm flex flex-col items-center gap-3">
            <span>Camera loading...</span>
          </div>
        )}

        {errorMsg && (
          <div className="text-rose-400 text-center p-4 text-sm flex flex-col items-center gap-3">
            <svg className="w-8 h-8 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{errorMsg}</span>
            <button
              onClick={startCamera}
              className="mt-2 text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold px-3 py-1.5 rounded border border-slate-700 transition-all"
            >
              Retry Camera
            </button>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {scanning && (
        <button
          onClick={stopCamera}
          className="mt-4 w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-sm font-semibold rounded-lg border border-rose-500/20 transition-all"
        >
          Cancel Scan
        </button>
      )}
    </div>
  );
};

export default QRScanner;
