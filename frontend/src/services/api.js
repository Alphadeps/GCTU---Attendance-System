import axios from 'axios';

// Use environment variable or fallback to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Export the base URL without /api for file uploads and direct URLs
export const BASE_URL = API_BASE_URL.replace('/api', '');

// Download the Excel attendance register for a class + course (reps: classId is ignored)
export const downloadAttendanceExcel = async ({ courseId, classId, fallbackName = 'attendance' }) => {
  const res = await api.get('/reports/export', {
    params: { courseId, ...(classId ? { classId } : {}) },
    responseType: 'blob'
  });
  const match = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '');
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = match ? match[1] : `${fallbackName}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Turn an error from a blob request (e.g. the Excel download) back into its JSON message
export const blobErrorMessage = async (err, fallback) => {
  try {
    const text = await err.response?.data?.text?.();
    return (text && JSON.parse(text).error) || fallback;
  } catch {
    return fallback;
  }
};

// Files stored by the backend (e.g. "/api/files/<id>/logo.png") live on the API server,
// not on this frontend's domain. Other paths (blob:, /logo.jfif, https://...) pass through.
export const assetUrl = (path) =>
  typeof path === 'string' && (path.startsWith('/api/') || path.startsWith('/uploads/')) ? `${BASE_URL}${path}` : path;

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle transparent token refresh on token expiry
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Temporary password still in use: send the user to set their own
    if (error.response?.status === 403 && error.response.data?.code === 'PASSWORD_CHANGE_REQUIRED') {
      localStorage.setItem('needsPasswordChange', 'true');
      if (window.location.pathname !== '/change-password') {
        window.location.assign('/change-password');
      }
      return Promise.reject(error);
    }

    // Check if error response is 401 Unauthorized and not already retried
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      // Do not try to refresh if the failed request was the login or refresh route itself
      if (
        originalRequest.url.includes('/auth/login') ||
        originalRequest.url.includes('/auth/refresh') ||
        originalRequest.url.includes('/student-auth/login')
      ) {
        return Promise.reject(error);
      }

      // Check if the error is specifically a token expiration
      const isTokenExpired = error.response?.data?.code === 'TOKEN_EXPIRED' || 
                            error.response?.data?.error?.includes('expired');

      if (!isTokenExpired) {
        // If it's not a token expiration, don't try to refresh
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        console.log('Token expired, attempting refresh...');
        // Attempt to request a new access token using the HTTP-only refresh token cookie
        const res = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { 
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        if (res.status === 200 && res.data.token) {
          const newToken = res.data.token;
          localStorage.setItem('token', newToken);
          
          // Update role and username if provided
          if (res.data.role) {
            localStorage.setItem('role', res.data.role);
          }
          if (res.data.username) {
            localStorage.setItem('username', res.data.username);
          }
          
          console.log('Token refreshed successfully');

          // Process queued requests
          processQueue(null, newToken);

          // Retry the original request with the new access token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshErr) {
        console.error('Token refresh failed:', refreshErr.response?.data || refreshErr.message);
        processQueue(refreshErr, null);
        
        // Clear authentication items and redirect to login page
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Only redirect if we're not already on the login page
        if (!window.location.pathname.includes('/login') && window.location.pathname !== '/') {
          console.log('Session expired. Redirecting to login.');
          window.location.href = '/';
        }
        
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
