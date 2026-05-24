import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service here
    console.error('[Resilience] Captured React render crash:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    // Reset state and reload the window
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Premium GCTU-branded Error State Fallback
      return (
        <div className="min-h-screen bg-[#00122c] text-slate-100 flex flex-col justify-center px-6 py-12 relative overflow-hidden font-sans">
          {/* Background watermark */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
            <img src="/logo2.png" alt="School Crest Watermark" className="w-[300px] h-[300px] object-contain filter grayscale" />
          </div>

          {/* Radial light glow */}
          <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[50%] rounded-full bg-[#D4A017]/5 blur-[120px] pointer-events-none"></div>

          <div className="max-w-[420px] w-full mx-auto space-y-6 relative z-10">
            <div className="text-center space-y-4">
              {/* Gold warning Shield */}
              <div className="w-16 h-16 bg-[#D4A017]/10 rounded-2xl flex items-center justify-center mx-auto border border-[#D4A017]/25 shadow-lg shadow-[#D4A017]/5 animate-pulse">
                <svg className="w-9 h-9 text-[#D4A017]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              
              <h2 className="text-xl font-black text-white tracking-tight">Something Went Wrong</h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                The portal encountered an unexpected display issue. Your session data remains safe.
              </p>
            </div>

            {/* Error Diagnostics Board */}
            <div className="bg-[#001c44]/70 backdrop-blur-md border border-[#002a63] p-5 rounded-2xl shadow-xl space-y-4 text-left">
              <div>
                <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Diagnostic Log</span>
                <div className="bg-slate-950/80 border border-[#002a63]/60 p-3.5 rounded-xl font-mono text-[10px] text-rose-400 overflow-x-auto max-h-[160px] scrollbar-thin">
                  {this.state.error && this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Suggested Actions</span>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4">
                  <li>Try reloading the page.</li>
                  <li>Clear browser cache if the issue persists.</li>
                  <li>Contact the IT Representative if you cannot check in.</li>
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={this.handleReload}
                className="w-full bg-[#D4A017] hover:bg-[#b88a14] active:scale-[0.98] text-slate-950 font-extrabold py-3.5 rounded-xl transition-all shadow-lg shadow-[#D4A017]/10 text-xs flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
                </svg>
                Reload Application Portal
              </button>

              <button
                onClick={() => {
                  localStorage.clear();
                  window.location.href = '/';
                }}
                className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all border border-slate-700"
              >
                Reset App Cache & Log Out
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
