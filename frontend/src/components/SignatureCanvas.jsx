import React, { useRef, useState, useEffect } from 'react';

const SignatureCanvas = ({ onSave }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set drawing stroke properties
    ctx.strokeStyle = '#22c55e'; // Green stroke matching our theme
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Clear canvas with white background
    clearCanvas();
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Check if touch event
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setHasDrawn(true);
    e.preventDefault();
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    e.preventDefault();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    // Auto-save when drawing stops
    saveSignature();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a'; // Match card background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Border design/helper line
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(20, canvas.height - 40);
    ctx.lineTo(canvas.width - 20, canvas.height - 40);
    ctx.stroke();
    
    // Re-set drawing options
    ctx.setLineDash([]);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    
    setHasDrawn(false);
    onSave(''); // Clear parent signature
  };

  const saveSignature = () => {
    if (!hasDrawn) return;
    const canvas = canvasRef.current;
    // Export signature as PNG base64 URL
    const signatureBase64 = canvas.toDataURL('image/png');
    onSave(signatureBase64);
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-semibold text-slate-300">Lecturer Signature Pad</label>
        <button
          type="button"
          onClick={clearCanvas}
          className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20"
        >
          Clear
        </button>
      </div>
      <div className="relative border border-slate-700/60 rounded-lg overflow-hidden bg-slate-900 shadow-inner">
        <canvas
          ref={canvasRef}
          width={500}
          height={180}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full cursor-crosshair touch-none"
        />
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-500 text-sm">
            Sign here using mouse or touch screen
          </div>
        )}
      </div>
    </div>
  );
};

export default SignatureCanvas;
