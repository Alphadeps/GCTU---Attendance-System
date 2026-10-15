import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

const LEVELS = ['100', '200', '300', '400'];
const GROUPS = 'ABCDEFGHIJK'.split('');
const SESSIONS = [
  { value: 'MORNING', label: 'Morning' },
  { value: 'EVENING', label: 'Evening' },
  { value: 'WEEKEND', label: 'Weekend' }
];

// Programme (from the admin's list), level, type, group and session — used by the rep sign-up
// page and by the "Set up your class" card for reps who don't have a class yet.
const ClassPicker = ({ value, onChange, idPrefix = 'cp' }) => {
  const [programmes, setProgrammes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    api.get('/auth/programmes')
      .then(res => setProgrammes(res.data || []))
      .catch(() => setLoadError('Could not load programmes. Check your connection and refresh.'))
      .finally(() => setLoading(false));
  }, []);

  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  const selectStyle = { appearance: 'auto' };

  const preview = useMemo(() => {
    const programme = programmes.find(p => p.id === value.programmeId);
    return programme ? `${programme.name} LEVEL ${value.level} ${value.type} GROUP ${value.group} (${value.session})` : '';
  }, [programmes, value]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label className="sip-label" htmlFor={`${idPrefix}-programme`}>Programme</label>
        <select id={`${idPrefix}-programme`} className="sip-input" style={selectStyle} value={value.programmeId} onChange={set('programmeId')} required disabled={loading}>
          <option value="">{loading ? 'Loading…' : programmes.length ? 'Choose your programme' : 'No programmes yet — ask the administrator'}</option>
          {programmes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {loadError && <p style={{ fontSize: 12, color: '#c00', marginTop: 6 }}>{loadError}</p>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label className="sip-label" htmlFor={`${idPrefix}-level`}>Level</label>
          <select id={`${idPrefix}-level`} className="sip-input" style={selectStyle} value={value.level} onChange={set('level')}>
            {LEVELS.map(l => <option key={l} value={l}>Level {l}</option>)}
          </select>
        </div>
        <div>
          <label className="sip-label" htmlFor={`${idPrefix}-type`}>Type</label>
          <select id={`${idPrefix}-type`} className="sip-input" style={selectStyle} value={value.type} onChange={set('type')}>
            <option value="REGULAR">Regular</option>
            <option value="TOP-UP">Top-Up</option>
          </select>
        </div>
        <div>
          <label className="sip-label" htmlFor={`${idPrefix}-group`}>Group</label>
          <select id={`${idPrefix}-group`} className="sip-input" style={selectStyle} value={value.group} onChange={set('group')}>
            {GROUPS.map(g => <option key={g} value={g}>Group {g}</option>)}
          </select>
        </div>
        <div>
          <label className="sip-label" htmlFor={`${idPrefix}-session`}>Session</label>
          <select id={`${idPrefix}-session`} className="sip-input" style={selectStyle} value={value.session} onChange={set('session')}>
            {SESSIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      {preview && <p style={{ fontSize: 12, color: '#15803d', fontWeight: 600, margin: 0 }}>Your class: {preview}</p>}
    </div>
  );
};

export default ClassPicker;
