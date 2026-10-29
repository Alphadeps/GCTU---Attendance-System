import { useEffect, useState } from 'react';
import api from '../services/api';

const BADGE = { WARNING: 'badge-warning', 'AT RISK': 'badge-danger' };
const SHOW_FIRST = 8;

// Students below the minimum attendance. Reps see their own class; admins see every class.
const LowAttendanceCard = ({ showClass = false, refreshKey }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/reports/low-attendance')
      .then(res => { if (!cancelled) { setData(res.data); setError(''); } })
      .catch(err => { if (!cancelled) setError(err.response?.data?.error || 'Could not load attendance warnings'); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (error) return null;
  if (!data) return null;

  const { minAttendancePercent: min, students } = data;
  const visible = showAll ? students : students.slice(0, SHOW_FIRST);

  return (
    <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,.08)] overflow-hidden animate-fade-in-up">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <div>
          <p className="text-[13px] font-bold text-[#344767]">Low attendance</p>
          <p className="text-[11px] text-[#67748e] mt-0.5">
            Students below the {min}% minimum. They get an alert automatically when a session closes.
          </p>
        </div>
        <span className={`badge ${students.length ? 'badge-danger' : 'badge-success'} shrink-0`}>
          {students.length ? `${students.length} below ${min}%` : 'All clear'}
        </span>
      </div>

      {students.length === 0 ? (
        <p className="px-5 py-6 text-[12px] text-[#67748e] text-center">
          Everyone is at or above {min}% in every course so far.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {visible.map(s => (
            <li key={`${s.classId}:${s.courseId}:${s.indexNumber}`} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#344767] truncate">{s.name}</p>
                <p className="text-[10px] text-[#67748e] font-mono truncate">
                  {s.indexNumber} · {s.courseCode}{showClass ? ` · ${s.className}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className={`badge ${BADGE[s.status] || 'badge-danger'}`}>{s.attendanceRate}%</span>
                <p className="text-[10px] text-[#67748e] font-mono mt-1">{s.presentCount} / {s.totalConcluded} classes</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {students.length > SHOW_FIRST && (
        <button
          type="button"
          onClick={() => setShowAll(v => !v)}
          className="w-full py-3 text-[11px] font-bold text-[#344767] border-t border-gray-100 hover:bg-gray-50"
        >
          {showAll ? 'Show fewer' : `Show all ${students.length}`}
        </button>
      )}
    </div>
  );
};

export default LowAttendanceCard;
