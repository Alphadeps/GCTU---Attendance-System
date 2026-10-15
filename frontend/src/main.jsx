import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ToastProvider } from './components/ToastProvider.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './lib/installPrompt.js'

// Installable app: register our service worker (public/sw.js) and drop any older ones
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        const script = registration.active?.scriptURL || '';
        if (!script.endsWith('/sw.js')) registration.unregister();
      }
    });
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker registration failed:', err));
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)

