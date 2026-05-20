import React from 'react';

const AttendanceTable = ({ attendances }) => {
  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PRESENT':
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Present</span>;
      case 'LATE':
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Late</span>;
      case 'ABSENT':
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">Absent</span>;
      default:
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">{status}</span>;
    }
  };

  if (!attendances || attendances.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800/80">
        No attendance records found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md shadow-lg">
      <table className="w-full text-left border-collapse min-w-[600px]">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-300 text-sm font-semibold">
            <th className="p-4">Name</th>
            <th className="p-4">Index Number</th>
            <th className="p-4">Status</th>
            <th className="p-4">Check-in Time</th>
            <th className="p-4 hidden md:table-cell font-normal text-slate-500">Device</th>
          </tr>
        </thead>
        <tbody className="text-slate-300 divide-y divide-slate-800/60">
          {attendances.map((att) => (
            <tr key={att.id} className="hover:bg-slate-800/20 transition-colors text-sm">
              <td className="p-4 font-medium text-slate-200">
                {att.student?.name || 'Unknown Student'}
              </td>
              <td className="p-4 font-mono text-slate-400">
                {att.student?.indexNumber || 'N/A'}
              </td>
              <td className="p-4">
                {getStatusBadge(att.status)}
              </td>
              <td className="p-4 text-slate-400">
                {att.status === 'ABSENT' ? '-' : formatTime(att.checkInTime)}
              </td>
              <td className="p-4 text-slate-500 text-xs hidden md:table-cell truncate max-w-[150px]" title={att.deviceInfo}>
                {att.deviceInfo}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AttendanceTable;
