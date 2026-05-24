import React from 'react';

const AttendanceTable = ({ attendances }) => {
  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getStatusBadge = (status) => {
    const map = {
      PRESENT: 'badge badge-success',
      LATE:    'badge badge-warning',
      ABSENT:  'badge badge-danger',
    };
    const labels = { PRESENT: 'Present', LATE: 'Late', ABSENT: 'Absent' };
    return (
      <span className={map[status] || 'badge badge-dark'}>
        {labels[status] || status}
      </span>
    );
  };

  if (!attendances || attendances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-[#f0f2f5] flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-[#8392ab]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-[#344767]">No records yet</p>
        <p className="text-xs text-[#8392ab] mt-1">Students will appear here as they check in</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto animate-fade-in-up">
      <table className="sip-table min-w-[560px]">
        <thead>
          <tr>
            <th style={{ paddingLeft: '16px' }}>#</th>
            <th>Student</th>
            <th>Index No.</th>
            <th>Status</th>
            <th>Check-in Time</th>
            <th className="hidden md:table-cell">Device</th>
          </tr>
        </thead>
        <tbody>
          {attendances.map((att, i) => (
            <tr key={att.id}>
              <td className="text-xs text-[#8392ab] pl-4">{i + 1}</td>
              <td>
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                    style={{ background: att.status === 'ABSENT' ? '#ea0606' : att.status === 'LATE' ? '#E5A93C' : 'linear-gradient(135deg,#0c2340,#1a3c6d)' }}
                  >
                    {(att.student?.name || 'S').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[13px] font-semibold text-[#344767]">{att.student?.name || 'Unknown'}</span>
                </div>
              </td>
              <td>
                <span className="font-mono text-[11px] text-[#8392ab] bg-[#f0f2f5] px-2 py-0.5 rounded">
                  {att.student?.indexNumber || 'N/A'}
                </span>
              </td>
              <td>{getStatusBadge(att.status)}</td>
              <td className="text-[12px] text-[#8392ab]">
                {att.status === 'ABSENT' ? '—' : formatTime(att.checkInTime)}
              </td>
              <td className="hidden md:table-cell text-[11px] text-[#8392ab] max-w-[140px] truncate" title={att.deviceInfo}>
                {att.deviceInfo || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AttendanceTable;
