import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

const typeMap = {
  SUCCESS: { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', cls: 'badge-success', color: '#2dce89' },
  WARNING: { icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', cls: 'badge-warning', color: '#fbcf33' },
  DANGER:  { icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z', cls: 'badge-danger', color: '#ea0606' },
  INFO:    { icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', cls: 'badge-info', color: '#17c1e8' },
};

const formatTime = (dateString) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const NotificationPanel = ({ studentIndex }) => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const url = studentIndex ? `/notifications?studentIndex=${studentIndex}` : '/notifications';
        const res = await api.get(url);
        setNotifications(res.data || []);
      } catch (err) {
        console.error('Fetch notifications error:', err);
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [studentIndex]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const handleClearAll = async () => {
    try {
      const url = studentIndex ? `/notifications/clear?studentIndex=${studentIndex}` : '/notifications/clear';
      await api.delete(url);
      setNotifications([]);
    } catch (err) {
      console.error('Clear notifications error:', err);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl text-[#8392ab] hover:text-[#344767] hover:bg-[#f0f2f5] transition-all"
        title="Notifications"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#cb0c9f] text-white text-[9px] font-black flex items-center justify-center ring-1 ring-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-[340px] bg-white rounded-2xl shadow-2xl z-50 overflow-hidden animate-slide-down border border-gray-100">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#344767]">Notifications</span>
              {unreadCount > 0 && (
                <span className="badge badge-primary text-[9px] px-1.5 py-0.5">{unreadCount} new</span>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-[10px] font-semibold text-[#8392ab] hover:text-rose-500 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-[#f0f2f5] flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-[#8392ab]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-[#344767]">All caught up!</p>
                <p className="text-[11px] text-[#8392ab] mt-0.5">No new notifications</p>
              </div>
            ) : (
              notifications.map((n) => {
                const t = typeMap[n.type] || typeMap.INFO;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleMarkAsRead(n.id)}
                    className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 last:border-0 relative ${
                      !n.isRead ? 'bg-blue-50/50' : 'hover:bg-[#f8f9fa]'
                    }`}
                  >
                    {/* Type dot */}
                    <div
                      className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center"
                      style={{ background: t.color + '18' }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={t.color} strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#344767] truncate">{n.title}</p>
                      <p className="text-[11px] text-[#8392ab] mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                      <span className="text-[10px] text-[#8392ab] mt-1 block">{formatTime(n.createdAt)}</span>
                    </div>
                    {!n.isRead && (
                      <span className="w-2 h-2 bg-[#cb0c9f] rounded-full shrink-0 mt-1" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
