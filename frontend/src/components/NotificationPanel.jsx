import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

const NotificationPanel = ({ studentIndex }) => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        let url = '/notifications';
        if (studentIndex) {
          url += `?studentIndex=${studentIndex}`;
        }
        const response = await api.get(url);
        setNotifications(response.data || []);
      } catch (err) {
        console.error('Fetch notifications error:', err);
      }
    };

    fetchNotifications();
    // Poll for new notifications every 60 seconds to prevent hitting the 429 rate limit
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [studentIndex]);

  // Close panel on clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      // Update state locally
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const handleClearAll = async () => {
    try {
      let url = '/notifications/clear';
      if (studentIndex) {
        url += `?studentIndex=${studentIndex}`;
      }
      await api.delete(url);
      setNotifications([]);
    } catch (err) {
      console.error('Clear notifications error:', err);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'SUCCESS':
        return (
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'WARNING':
        return (
          <div className="p-2 bg-[#344767]/10 text-[#344767] rounded-xl border border-[#344767]/20">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        );
      case 'DANGER':
        return (
          <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="p-2 bg-[#344767]/10 text-[#344767] rounded-xl border border-[#003B8E]/30">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Icon Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-[#344767] hover:text-[#344767] bg-white hover:bg-gray-100 border border-gray-200/60 rounded-xl transition-all shadow-inner focus:outline-none"
        title="Notifications"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#14172B] to-[#3A416F] text-[10px] font-bold text-[#000a18] ring-2 ring-[#00122c] animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Drawer/Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in origin-top-right">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-[#001432]/80">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-[#344767]">System Notifications</h3>
              <span className="text-[10px] bg-[#344767] text-[#344767] px-2 py-0.5 rounded-full font-mono font-semibold">
                {notifications.length} Total
              </span>
            </div>
            {notifications.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-[10px] font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2 py-1 rounded-lg transition-all"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-200/40">
            {notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-2xl text-[#8392ab]">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0L12 17l-8-4" />
                  </svg>
                </div>
                <p className="text-xs text-[#8392ab] font-medium">All caught up! No notifications.</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleMarkAsRead(notification.id)}
                  className={`p-4 transition-all hover:bg-gray-100 cursor-pointer flex gap-3.5 relative ${
                    !notification.isRead ? 'bg-[#344767]/10' : ''
                  }`}
                >
                  {!notification.isRead && (
                    <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-gradient-to-br from-[#14172B] to-[#3A416F]" />
                  )}
                  {getIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${!notification.isRead ? 'text-[#344767]' : 'text-[#344767]'}`}>
                      {notification.title}
                    </p>
                    <p className="text-[11px] text-[#8392ab] mt-1 leading-relaxed">
                      {notification.message}
                    </p>
                    <span className="text-[9px] text-[#8392ab] font-medium mt-1.5 block">
                      {formatTime(notification.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
