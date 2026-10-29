import { useState } from 'react';
import api from '../../services/api';
import ClassPicker from './ClassPicker';
import { EMPTY_CLASS } from './classDefaults';

// Shown to a rep who has no class yet (e.g. their account was made with the admin's "Create Rep").
const SetupClassCard = ({ onClassReady }) => {
  const [cls, setCls] = useState(EMPTY_CLASS);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSaving(true);
    try {
      const res = await api.post('/admin/rep/my-class', cls);
      onClassReady(res.data.assignedClass, res.data.message);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Could not set up your class. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,.08)] max-w-xl space-y-4">
      <div>
        <p className="text-[14px] font-bold text-[#344767]">Set up your class</p>
        <p className="text-[12px] text-[#67748e] mt-1">
          Your account isn&apos;t linked to a class yet. Choose your class below to start adding courses and classmates.
        </p>
      </div>
      <ClassPicker value={cls} onChange={setCls} idPrefix="setup" />
      {errorMsg && <div className="sip-alert sip-alert-error">{errorMsg}</div>}
      <button type="submit" className="sip-btn-dark" disabled={saving || !cls.programmeId}>
        {saving ? 'Setting up…' : 'Set up my class'}
      </button>
    </form>
  );
};

export default SetupClassCard;
