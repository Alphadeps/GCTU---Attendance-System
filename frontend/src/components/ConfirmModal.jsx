import React from 'react';

const ConfirmModal = ({ 
  message, 
  confirmLabel = 'Confirm', 
  onConfirm, 
  onCancel 
}) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-[#001c44] border border-[#002a63] rounded-2xl p-6 max-w-md w-full shadow-2xl animate-[fadeIn_0.2s_ease-out]">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        {/* Message */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-bold text-white mb-2">Confirm Action</h3>
          <p className="text-sm text-slate-300 leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-3 px-4 rounded-xl transition-all text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-[#D4A017] hover:bg-[#b88a14] text-slate-950 font-bold py-3 px-4 rounded-xl transition-all text-sm shadow-lg shadow-[#D4A017]/20"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
