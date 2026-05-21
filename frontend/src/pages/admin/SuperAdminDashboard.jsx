import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import AdminGrievancePanel from '../../components/AdminGrievancePanel';
import ReportSettings from '../../components/admin/ReportSettings';
import OfficialArchives from '../../components/admin/OfficialArchives';
import ConfirmModal from '../../components/ConfirmModal';
import NotificationPanel from '../../components/NotificationPanel';
import { useAuth } from '../../context/AuthContext';
import AddProgrammeModal from '../../components/admin/modals/AddProgrammeModal';
import AddCourseModal from '../../components/admin/modals/AddCourseModal';
import EditProgrammeModal from '../../components/admin/modals/EditProgrammeModal';
import EditCourseModal from '../../components/admin/modals/EditCourseModal';
import EditStudentModal from '../../components/admin/modals/EditStudentModal';
import EditRepModal from '../../components/admin/modals/EditRepModal';
import OnboardingTour from '../../components/admin/OnboardingTour';
import HelpGuidePage from '../../components/admin/HelpGuidePage';

const MENU_GROUPS = [
  {
    title: 'Dashboard',
    items: [
      { id: 'overview', label: 'Overview', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z' },
    ]
  },
  {
    title: 'Academic Structure',
    items: [
      { id: 'programmes', label: 'Programmes', icon: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z' },
      { id: 'classes', label: 'Classes Control', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
      { id: 'courses', label: 'Global Courses', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    ]
  },
  {
    title: 'User Management',
    items: [
      { id: 'reps', label: 'Class Reps', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
      { id: 'lecturers', label: 'Lecturer Allocations', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
      { id: 'grievances', label: 'Grievance Desk', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    ]
  },
  {
    title: 'System Archives & Settings',
    items: [
      { id: 'notifications', label: 'Notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
      { id: 'reports', label: 'Official Archives', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
      { id: 'settings', label: 'Thresholds & Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
      { id: 'report_settings', label: 'Report Settings', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { id: 'help', label: 'Help & Setup Guide', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    ]
  }
];

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { role, needsPasswordChange: authNeedsPasswordChange } = auth;
  
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Settings & Branding
  const [settings, setSettings] = useState({
    deptName: 'Ghana Communication Technology University',
    deptLogoUrl: '/logo.jfif',
    lateWindowMinutes: 15,
    qrExpirySeconds: 30,
    geofenceRadiusMeters: 100,
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');

  // Overview Stats
  const [stats, setStats] = useState({
    programmesCount: 0,
    classesCount: 0,
    studentsCount: 0,
    repsCount: 0,
    coursesCount: 0,
    activeSessionsCount: 0,
  });

  // Data lists
  const [programmes, setProgrammes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [reps, setReps] = useState([]);
  const [courses, setCourses] = useState([]);

  // Lecturer allocations
  const [lecturerAssignments, setLecturerAssignments] = useState([]);
  const [lecturerSearchQuery, setLecturerSearchQuery] = useState('');
  const [uploadingLecturers, setUploadingLecturers] = useState(false);
  const [lecturerUploadResults, setLecturerUploadResults] = useState(null);
  const [lecturerFile, setLecturerFile] = useState(null);

  // Modals state
  const [showProgModal, setShowProgModal] = useState(false);
  const [showEditProgModal, setShowEditProgModal] = useState(false);
  const [editingProgramme, setEditingProgramme] = useState(null);

  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showEditCourseModal, setShowEditCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);

  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);

  const [showClassModal, setShowClassModal] = useState(false);
  const [classStep, setClassStep] = useState(1);
  const [newClass, setNewClass] = useState({
    programmeId: '',
    level: '100',
    type: 'REGULAR',
    session: 'MORNING',
    groups: [],
  });

  const [showRepModal, setShowRepModal] = useState(false);
  const [newRep, setNewRep] = useState({
    fullName: '',
    username: '',
    indexNumber: '',
    password: '',
    confirmPassword: '',
  });

  const [showResetPwdModal, setShowResetPwdModal] = useState(false);
  const [resetPwdRepId, setResetPwdRepId] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const [showEditRepModal, setShowEditRepModal] = useState(false);
  const [editingRep, setEditingRep] = useState(null);

  // Class action modals
  const [selectedClassForRep, setSelectedClassForRep] = useState(null);
  const [showAssignRepModal, setShowAssignRepModal] = useState(false);
  const [repSearchQuery, setRepSearchQuery] = useState('');

  // Bulk upload reps state
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkUploadFile, setBulkUploadFile] = useState(null);
  const [bulkUploadLoading, setBulkUploadLoading] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState(null);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const [selectedClassForStudents, setSelectedClassForStudents] = useState(null);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [classStudents, setClassStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]); // For bulk delete
  const [studentAddTab, setStudentAddTab] = useState('manual'); // 'manual' or 'csv'
  const [manualStudents, setManualStudents] = useState([{ name: '', indexNumber: '', email: '' }]);
  const [csvPreview, setCsvPreview] = useState([]);

  const [selectedClassForCourses, setSelectedClassForCourses] = useState(null);
  const [showClassCoursesModal, setShowClassCoursesModal] = useState(false);
  const [classCourses, setClassCourses] = useState([]);

  // Filters for Classes
  const [classFilters, setClassFilters] = useState({
    programmeId: '',
    level: '',
    type: '',
    session: '',
    search: '',
  });

  // Force password change overlay
  const [needsPasswordChange, setNeedsPasswordChange] = useState(authNeedsPasswordChange);
  const [pwdChangeForm, setPwdChangeForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Logo input ref
  const logoInputRef = useRef(null);

  // Confirm modal state
  const [confirmState, setConfirmState] = useState({ open: false, message: '', onConfirm: null });

  // Onboarding tour state
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check if user is SUPERADMIN
    if (role !== 'SUPERADMIN') {
      navigate('/');
      return;
    }

    // Check if this is first login (show onboarding)
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }

    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function fetchInitialData() {
    setLoading(true);
    try {
      // Get settings
      const settingsRes = await api.get('/admin/settings').catch(() => null);
      if (settingsRes && settingsRes.data) {
        setSettings(settingsRes.data);
        if (settingsRes.data.deptLogoUrl) {
          setLogoPreview(settingsRes.data.deptLogoUrl);
        }
      }

      // Get stats
      const statsRes = await api.get('/admin/stats').catch(() => null);
      if (statsRes && statsRes.data) {
        setStats(statsRes.data);
      }

      // Get programmes
      const progRes = await api.get('/admin/programmes').catch(() => null);
      if (progRes && progRes.data) {
        setProgrammes(progRes.data);
      }

      // Get classes
      const classRes = await api.get('/admin/classes').catch(() => null);
      if (classRes && classRes.data) {
        setClasses(classRes.data);
      }

      // Get reps
      const repsRes = await api.get('/admin/reps').catch(() => null);
      if (repsRes && repsRes.data) {
        setReps(repsRes.data);
      }

      // Get global courses
      const courseRes = await api.get('/courses').catch(() => null);
      if (courseRes && courseRes.data) {
        setCourses(courseRes.data);
      }

      // Get lecturer assignments
      const lecturerRes = await api.get('/lecturer/assignments').catch(() => null);
      if (lecturerRes && lecturerRes.data) {
        setLecturerAssignments(lecturerRes.data);
      }
    } catch (err) {
      console.error(err);
      showNotification('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }

  const showNotification = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => {
      setMessage({ text: '', type: '' });
    }, 4000);
  };

  // 1. Force Password Change Handler
  const handleForcePasswordChange = async (e) => {
    e.preventDefault();
    if (pwdChangeForm.newPassword !== pwdChangeForm.confirmPassword) {
      showNotification('New passwords do not match', 'error');
      return;
    }
    if (pwdChangeForm.newPassword.length < 6) {
      showNotification('Password must be at least 6 characters long', 'error');
      return;
    }

    try {
      await api.patch('/auth/change-password', {
        currentPassword: pwdChangeForm.currentPassword,
        newPassword: pwdChangeForm.newPassword,
      });
      showNotification('Password changed successfully. Access granted.');
      localStorage.setItem('needsPasswordChange', 'false');
      setNeedsPasswordChange(false);
    } catch (err) {
      console.error(err);
      showNotification(err.response?.data?.error || 'Failed to change password. Ensure current password is correct.', 'error');
    }
  };

  // 2. Settings & Branding Handlers
  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.patch('/admin/settings', settings);
      showNotification('System thresholds updated successfully');
    } catch (err) {
      console.error(err);
      showNotification('Failed to update system thresholds', 'error');
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;
    const formData = new FormData();
    formData.append('logo', logoFile);

    try {
      const res = await api.post('/admin/settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showNotification('Branding logo uploaded successfully');
      setSettings(prev => ({ ...prev, deptLogoUrl: res.data.logoUrl }));
      setLogoPreview(res.data.logoUrl);
      setLogoFile(null);
    } catch (err) {
      console.error(err);
      showNotification('Failed to upload logo', 'error');
    }
  };

  // 3. Programmes Handlers
  const handleProgrammeSaved = (newProgramme) => {
    setProgrammes(prev => [...prev, newProgramme]);
    showNotification('Programme added successfully');
  };

  const handleProgrammeUpdated = (updatedProgramme) => {
    setProgrammes(prev => prev.map(p => p.id === updatedProgramme.id ? updatedProgramme : p));
    showNotification('Programme updated successfully');
  };

  const handleDeleteProgramme = (id) => {
    setConfirmState({
      open: true,
      message: 'Are you sure you want to delete this programme? This may affect associated classes.',
      onConfirm: async () => {
        setConfirmState({ open: false, message: '', onConfirm: null });
        try {
          await api.delete(`/admin/programmes/${id}`);
          setProgrammes(prev => prev.filter(p => p.id !== id));
          showNotification('Programme deleted successfully');
        } catch (err) {
          showNotification(err.response?.data?.error || 'Failed to delete programme', 'error');
        }
      }
    });
  };

  // 4. Multi-Step Class Creation Handlers
  const handleGroupToggle = (groupLetter) => {
    setNewClass(prev => {
      const exists = prev.groups.includes(groupLetter);
      const groups = exists
        ? prev.groups.filter(g => g !== groupLetter)
        : [...prev.groups, groupLetter].sort();
      return { ...prev, groups };
    });
  };

  const handleCreateClasses = async () => {
    if (!newClass.programmeId) {
      showNotification('Please select a programme', 'error');
      return;
    }
    if (newClass.groups.length === 0) {
      showNotification('Please select at least one group', 'error');
      return;
    }

    try {
      // Post class creation
      await api.post('/admin/classes', {
        programmeId: newClass.programmeId,
        level: newClass.level, // Keep as string, don't parse to int
        type: newClass.type,
        session: newClass.session,
        groups: newClass.groups,
      });

      setClassStep(3); // Success step
      showNotification(`${newClass.groups.length} class(es) created successfully`);
      // Refresh classes list
      const classRes = await api.get('/admin/classes');
      if (classRes && classRes.data) {
        setClasses(classRes.data);
      }
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to create classes', 'error');
    }
  };

  const resetClassModal = () => {
    setShowClassModal(false);
    setClassStep(1);
    setNewClass({
      programmeId: programmes[0]?.id || '',
      level: '100',
      type: 'REGULAR',
      session: 'MORNING',
      groups: [],
    });
  };

  // 5. Representative Handlers
  const handleCreateRep = async (e) => {
    e.preventDefault();
    if (newRep.password !== newRep.confirmPassword) {
      showNotification('Passwords do not match', 'error');
      return;
    }

    try {
      const res = await api.post('/admin/reps', {
        fullName: newRep.fullName,
        username: newRep.username,
        indexNumber: newRep.indexNumber,
        password: newRep.password,
      });
      setReps(prev => [...prev, res.data]);
      setShowRepModal(false);
      setNewRep({ fullName: '', username: '', indexNumber: '', password: '', confirmPassword: '' });
      showNotification('Representative account created successfully');
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to create representative', 'error');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword.trim()) return;

    try {
      await api.patch(`/admin/reps/${resetPwdRepId}/reset-password`, { password: newPassword });
      setShowResetPwdModal(false);
      setNewPassword('');
      showNotification('Representative password reset successfully');
    } catch (err) {
      showNotification('Failed to reset representative password', 'error');
    }
  };

  const handleToggleRepStatus = async (id, currentStatus) => {
    try {
      await api.patch(`/admin/reps/${id}/status`, { isActive: !currentStatus });
      setReps(prev => prev.map(r => r.id === id ? { ...r, isActive: !currentStatus } : r));
      showNotification(`Representative account ${!currentStatus ? 'activated' : 'deactivated'}`);
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to toggle status', 'error');
    }
  };

  const handleRepUpdated = (updatedRep) => {
    setReps(prev => prev.map(r => r.id === updatedRep.id ? { ...r, ...updatedRep } : r));
    showNotification('Representative updated successfully');
  };

  const handleBulkUploadReps = async (e) => {
    e.preventDefault();
    if (!bulkUploadFile) {
      showNotification('Please select a file to upload', 'error');
      return;
    }

    setBulkUploadLoading(true);
    setBulkUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', bulkUploadFile);

      const response = await api.post('/admin/reps/bulk-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setBulkUploadResult(response.data);
      showNotification(response.data.message || 'Bulk upload completed successfully');
      
      // Refresh reps list only
      const repsRes = await api.get('/admin/reps');
      if (repsRes && repsRes.data) {
        setReps(repsRes.data);
      }
      
      // Reset file input after a delay
      setTimeout(() => {
        setBulkUploadFile(null);
        setBulkUploadResult(null);
        setShowBulkUploadModal(false);
      }, 3000);
    } catch (err) {
      console.error('Bulk upload error:', err);
      showNotification(err.response?.data?.error || 'Failed to upload file', 'error');
    } finally {
      setBulkUploadLoading(false);
    }
  };

  // Notifications handlers
  const fetchNotifications = async () => {
    setNotificationsLoading(true);
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data || []);
    } catch (err) {
      console.error('Fetch notifications error:', err);
      showNotification('Failed to load notifications', 'error');
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
      await Promise.all(unreadIds.map(id => api.patch(`/notifications/${id}/read`)));
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      showNotification('All notifications marked as read');
    } catch (err) {
      console.error('Mark all read error:', err);
      showNotification('Failed to mark all as read', 'error');
    }
  };

  const handleClearAll = async () => {
    try {
      await api.delete('/notifications/clear');
      setNotifications([]);
      showNotification('All notifications cleared');
    } catch (err) {
      console.error('Clear notifications error:', err);
      showNotification('Failed to clear notifications', 'error');
    }
  };

  // Fetch notifications when tab changes to notifications
  useEffect(() => {
    if (activeTab === 'notifications') {
      fetchNotifications();
    }
  }, [activeTab]);

  const handleDeleteRep = (id) => {
    setConfirmState({
      open: true,
      message: 'Are you sure you want to delete this representative account? This action is permanent.',
      onConfirm: async () => {
        setConfirmState({ open: false, message: '', onConfirm: null });
        try {
          await api.delete(`/admin/reps/${id}`);
          setReps(prev => prev.filter(r => r.id !== id));
          showNotification('Representative deleted successfully');
        } catch (err) {
          showNotification('Failed to delete representative', 'error');
        }
      }
    });
  };

  // 6. Assign/Unassign Rep to Class
  const handleAssignRep = async (repId) => {
    if (!selectedClassForRep) return;
    try {
      await api.post(`/admin/classes/${selectedClassForRep.id}/assign-rep`, { repId });
      showNotification('Class representative assigned successfully');
      setShowAssignRepModal(false);
      setSelectedClassForRep(null);
      // Update classes state to reflect rep assignment
      const classRes = await api.get('/admin/classes');
      if (classRes && classRes.data) {
        setClasses(classRes.data);
      }
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to assign representative', 'error');
    }
  };

  const handleRemoveRepFromClass = (classId) => {
    setConfirmState({
      open: true,
      message: 'Are you sure you want to remove the representative from this class?',
      onConfirm: async () => {
        setConfirmState({ open: false, message: '', onConfirm: null });
        try {
          await api.post(`/admin/classes/${classId}/remove-rep`);
          showNotification('Representative unassigned from class');
          // Update classes state to reflect rep removal
          const classRes = await api.get('/admin/classes');
          if (classRes && classRes.data) {
            setClasses(classRes.data);
          }
        } catch (err) {
          showNotification('Failed to remove representative', 'error');
        }
      }
    });
  };

  // 7. Student Management for Classes
  const handleOpenStudentsModal = async (cls) => {
    setSelectedClassForStudents(cls);
    setShowStudentsModal(true);
    setSelectedStudentIds([]); // Reset selection
    setLoading(true);
    try {
      const res = await api.get(`/admin/classes/${cls.id}/students`);
      setClassStudents(res.data);
    } catch (err) {
      showNotification('Failed to load students for class', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddManualStudentRow = () => {
    setManualStudents(prev => [...prev, { name: '', indexNumber: '', email: '' }]);
  };

  const handleRemoveManualStudentRow = (idx) => {
    setManualStudents(prev => prev.filter((_, i) => i !== idx));
  };

  const handleManualStudentChange = (idx, field, value) => {
    setManualStudents(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleSaveManualStudents = async () => {
    const validStudents = manualStudents.filter(s => s.name.trim() && s.indexNumber.trim());
    if (validStudents.length === 0) {
      showNotification('Please enter at least one student name and index number', 'error');
      return;
    }

    try {
      await api.post(`/admin/classes/${selectedClassForStudents.id}/students`, {
        students: validStudents,
      });
      showNotification(`${validStudents.length} student(s) added successfully`);
      setManualStudents([{ name: '', indexNumber: '', email: '' }]);
      // reload student list
      handleOpenStudentsModal(selectedClassForStudents);
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to add students', 'error');
    }
  };

  const handleCsvFileDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (
      lowerName.endsWith('.csv') ||
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.pdf')
    ) {
      await parseFileOnBackend(file);
    } else {
      showNotification('Unsupported file type. Please upload a CSV, Excel (.xlsx, .xls) or PDF (.pdf) file.', 'error');
    }
  };

  const parseFileOnBackend = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      showNotification('Uploading and parsing document...', 'info');
      const res = await api.post('/admin/classes/parse-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCsvPreview(res.data.students || []);
      showNotification(`Successfully parsed ${res.data.students?.length || 0} student records.`, 'success');
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to parse file.', 'error');
      setCsvPreview([]);
    }
  };

  const handleImportCsv = async () => {
    if (csvPreview.length === 0) return;
    try {
      showNotification('Enrolling parsed student database...', 'info');
      await api.post(`/admin/classes/${selectedClassForStudents.id}/students`, {
        students: csvPreview
      });
      showNotification(`Successfully imported ${csvPreview.length} students into class.`);
      setCsvPreview([]);
      handleOpenStudentsModal(selectedClassForStudents);
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to import student list.', 'error');
    }
  };

  const handleRemoveStudentFromClass = (studentId) => {
    setConfirmState({
      open: true,
      message: 'Are you sure you want to remove this student from this class?',
      onConfirm: async () => {
        setConfirmState({ open: false, message: '', onConfirm: null });
        try {
          await api.delete(`/admin/classes/${selectedClassForStudents.id}/students/${studentId}`);
          showNotification('Student removed from class');
          handleOpenStudentsModal(selectedClassForStudents);
        } catch (err) {
          showNotification('Failed to remove student', 'error');
        }
      }
    });
  };

  const handleStudentUpdated = (updatedStudent) => {
    setClassStudents(prev => prev.map(s => s.id === updatedStudent.id ? { ...s, ...updatedStudent } : s));
    showNotification('Student information updated successfully');
  };

  // Bulk delete students
  const handleBulkDeleteStudents = () => {
    if (selectedStudentIds.length === 0) {
      showNotification('Please select students to delete', 'error');
      return;
    }

    setConfirmState({
      open: true,
      message: `Are you sure you want to remove ${selectedStudentIds.length} student(s) from this class? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmState({ open: false, message: '', onConfirm: null });
        try {
          await api.post(`/admin/classes/${selectedClassForStudents.id}/students/bulk-delete`, {
            studentIds: selectedStudentIds
          });
          showNotification(`${selectedStudentIds.length} student(s) removed from class`);
          setSelectedStudentIds([]);
          handleOpenStudentsModal(selectedClassForStudents);
        } catch (err) {
          showNotification('Failed to remove students', 'error');
        }
      }
    });
  };

  // Toggle individual student selection
  const handleToggleStudentSelection = (studentId) => {
    setSelectedStudentIds(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Toggle all students selection
  const handleToggleAllStudents = () => {
    const filteredStudents = classStudents.filter(s =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.indexNumber.includes(studentSearch)
    );

    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map(s => s.id));
    }
  };

  // 8. Class Courses Handlers
  const handleOpenCoursesModal = async (cls) => {
    setSelectedClassForCourses(cls);
    setShowClassCoursesModal(true);
    setLoading(true);
    try {
      const res = await api.get(`/admin/classes/${cls.id}/courses`);
      setClassCourses(res.data);
    } catch (err) {
      showNotification('Failed to load courses for class', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkCourseToClass = async (courseId) => {
    try {
      await api.post(`/admin/classes/${selectedClassForCourses.id}/courses`, { courseId });
      showNotification('Course linked to class successfully');
      handleOpenCoursesModal(selectedClassForCourses);
    } catch (err) {
      showNotification(err.response?.data?.error || 'Failed to link course', 'error');
    }
  };

  const handleUnlinkCourseFromClass = (courseId) => {
    setConfirmState({
      open: true,
      message: 'Are you sure you want to unlink this course from this class?',
      onConfirm: async () => {
        setConfirmState({ open: false, message: '', onConfirm: null });
        try {
          await api.delete(`/admin/classes/${selectedClassForCourses.id}/courses/${courseId}`);
          showNotification('Course unlinked from class');
          handleOpenCoursesModal(selectedClassForCourses);
        } catch (err) {
          showNotification('Failed to unlink course', 'error');
        }
      }
    });
  };

  // 9. Global Courses Handlers
  const handleCourseSaved = (newCourse) => {
    setCourses(prev => [...prev, newCourse]);
    showNotification('Course added to global database');
  };

  const handleCourseUpdated = (updatedCourse) => {
    setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
    showNotification('Course updated successfully');
  };

  const handleDeleteGlobalCourse = (id) => {
    setConfirmState({
      open: true,
      message: 'Are you sure you want to delete this course from the database? It cannot be linked or active.',
      onConfirm: async () => {
        setConfirmState({ open: false, message: '', onConfirm: null });
        try {
          await api.delete(`/courses/${id}`);
          setCourses(prev => prev.filter(c => c.id !== id));
          showNotification('Course deleted successfully');
        } catch (err) {
          showNotification(err.response?.data?.error || 'Failed to delete course', 'error');
        }
      }
    });
  };

  // 10. Lecturer Assignment Handlers
  const fetchLecturerAssignments = async () => {
    try {
      const res = await api.get('/lecturer/assignments');
      setLecturerAssignments(res.data || []);
    } catch (err) {
      console.error('Fetch lecturer assignments error:', err);
    }
  };

  const handleLecturerFileUpload = async (e) => {
    e.preventDefault();
    const file = e.target.files?.[0] || lecturerFile;
    if (!file) {
      showNotification('Please select a file to upload.', 'error');
      return;
    }

    setUploadingLecturers(true);
    setLecturerUploadResults(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      showNotification('Uploading and parsing allocations...', 'info');
      const res = await api.post('/lecturer/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showNotification(res.data.message || 'Spreadsheet uploaded successfully.');
      setLecturerUploadResults(res.data.results);
      setLecturerFile(null);
      fetchLecturerAssignments();
    } catch (err) {
      console.error(err);
      showNotification(err.response?.data?.error || 'Failed to upload spreadsheet.', 'error');
    } finally {
      setUploadingLecturers(false);
    }
  };

  const handleDeleteAssignment = (id) => {
    setConfirmState({
      open: true,
      message: 'Are you sure you want to remove this lecturer allocation?',
      onConfirm: async () => {
        setConfirmState({ open: false, message: '', onConfirm: null });
        try {
          await api.delete(`/lecturer/assignments/${id}`);
          showNotification('Lecturer allocation removed successfully');
          setLecturerAssignments(prev => prev.filter(a => a.id !== id));
        } catch (err) {
          console.error(err);
          showNotification('Failed to remove lecturer allocation', 'error');
        }
      }
    });
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    }
    auth.logout();
    navigate('/');
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
    showNotification('Welcome! You can restart this tour anytime from the help menu.');
  };

  const handleOnboardingSkip = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
  };

  // Filter Logic
  const getFilteredClasses = () => {
    return classes.filter(cls => {
      const matchesProg = !classFilters.programmeId || cls.programmeId === classFilters.programmeId;
      const matchesLevel = !classFilters.level || cls.level.toString() === classFilters.level;
      const matchesType = !classFilters.type || cls.type === classFilters.type;
      const matchesSession = !classFilters.session || cls.session === classFilters.session;
      const matchesSearch = !classFilters.search || cls.displayName.toLowerCase().includes(classFilters.search.toLowerCase());
      return matchesProg && matchesLevel && matchesType && matchesSession && matchesSearch;
    });
  };

  // Group classes by structural keys (Programme + Level + Type + Session)
  const getGroupedClasses = () => {
    const filtered = getFilteredClasses();
    const groups = {};

    filtered.forEach(cls => {
      const key = `${cls.programme?.name || 'Unknown'} - LEVEL ${cls.level} (${cls.type} / ${cls.session})`;
      if (!groups[key]) {
        groups[key] = {
          header: key,
          items: [],
        };
      }
      groups[key].items.push(cls);
    });

    // Sort classes within each group alphabetically by group letter (A, B, C, etc.)
    Object.values(groups).forEach(group => {
      group.items.sort((a, b) => {
        const groupA = a.group || '';
        const groupB = b.group || '';
        return groupA.localeCompare(groupB);
      });
    });

    return Object.values(groups);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex font-sans antialiased relative">
      {/* 0. FORCE PASSWORD CHANGE OVERLAY */}
      {needsPasswordChange && (
        <div className="fixed inset-0 bg-[#0f172a] z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] border border-red-500/30 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-fade-in">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="h-16 w-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Change Default Password</h2>
              <p className="text-slate-400 text-sm">
                For security reasons, you must change the default password (<code className="bg-[#0f172a] px-1.5 py-0.5 rounded text-red-400">admin123</code>) on your first login.
              </p>
            </div>

            <form onSubmit={handleForcePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Current Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter your current password"
                  value={pwdChangeForm.currentPassword}
                  onChange={(e) => setPwdChangeForm(p => ({ ...p, currentPassword: e.target.value }))}
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={pwdChangeForm.newPassword}
                  onChange={(e) => setPwdChangeForm(p => ({ ...p, newPassword: e.target.value }))}
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Repeat new password"
                  value={pwdChangeForm.confirmPassword}
                  onChange={(e) => setPwdChangeForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-red-600 to-indigo-600 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg hover:from-red-500 hover:to-indigo-500 active:scale-95 transition-transform"
              >
                Change Password & Access System
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Global alert notification */}
      {message.text && (
        <div className={`fixed top-6 right-6 z-[9999] px-5 py-3.5 rounded-xl shadow-2xl flex items-center space-x-3 border animate-fade-in backdrop-blur-sm ${
          message.type === 'error' ? 'bg-red-500/90 text-white border-red-600' : 
          message.type === 'info' ? 'bg-blue-500/90 text-white border-blue-600' :
          'bg-green-500/90 text-white border-green-600'
        }`}>
          <span className="font-medium text-sm">{message.text}</span>
        </div>
      )}

      {/* 1. LEFT SIDEBAR */}
      <aside className="w-[260px] bg-[#090d16] border-r border-slate-800 flex flex-col shrink-0 h-screen sticky top-0">
        {/* Header / Brand */}
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
          <img
            src={logoPreview || '/logo.jfif'}
            alt="Dept Logo"
            onError={(e) => { e.target.src = '/logo.jfif'; }}
            className="w-10 h-10 rounded-xl object-cover border border-slate-700 bg-[#1e293b]"
          />
          <div className="overflow-hidden">
            <h1 className="font-bold text-sm leading-tight text-white truncate">{settings.deptName}</h1>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Super Admin</span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          {MENU_GROUPS.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              <span className="px-3 text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                {group.title}
              </span>
              {group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center space-x-3.5 px-4 py-2.5 rounded-xl font-semibold text-[13px] transition-all duration-200 ${
                    activeTab === item.id
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/10'
                      : 'text-slate-400 hover:bg-[#111827] hover:text-white'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer info & Logout */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 bg-slate-800 rounded-full flex items-center justify-center text-indigo-400 font-bold border border-slate-700">
                SA
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">Administrator</p>
                <span className="text-[10px] text-slate-400">superadmin</span>
              </div>
            </div>
            <NotificationPanel />
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 active:scale-95 transition-all text-xs font-semibold"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0f172a]">
        {/* Header */}
        <header className="h-[76px] border-b border-slate-800 px-8 flex items-center justify-between shrink-0 bg-[#090d16]">
          <h2 className="text-lg font-bold text-white capitalize">{activeTab.replace('-', ' ')}</h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowOnboarding(true)}
              className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all border border-transparent hover:border-indigo-500/20"
              title="Show setup guide"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <span className="bg-[#1e293b] border border-slate-700 px-3 py-1 rounded-full text-xs text-indigo-400 font-semibold flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>System Live</span>
            </span>
          </div>
        </header>

        {/* Tab panels */}
        <div className="flex-1 p-8 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
            </div>
          )}

          {/* OVERVIEW PANEL */}
          {activeTab === 'overview' && !loading && (
            <div className="space-y-8 animate-fade-in">
              {/* Stats Row */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                {[
                  { label: 'Programmes', value: stats.programmesCount, bg: 'border-slate-800', text: 'text-white' },
                  { label: 'Classes', value: stats.classesCount, bg: 'border-slate-800', text: 'text-white' },
                  { label: 'Total Students', value: stats.studentsCount, bg: 'border-slate-800', text: 'text-white' },
                  { label: 'Class Reps', value: stats.repsCount, bg: 'border-slate-800', text: 'text-white' },
                  { label: 'Global Courses', value: stats.coursesCount, bg: 'border-slate-800', text: 'text-white' },
                  { label: 'Active Sessions', value: stats.activeSessionsCount, bg: 'border-indigo-500/20 bg-indigo-500/5', text: 'text-indigo-400' },
                ].map((stat, i) => (
                  <div key={i} className={`bg-[#1e293b] border rounded-2xl p-5 shadow-sm hover:scale-[1.02] transition-transform ${stat.bg}`}>
                    <span className="text-slate-400 text-xs font-semibold block mb-1">{stat.label}</span>
                    <span className={`text-2xl font-black ${stat.text}`}>{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* Main Overview Split */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Quick Actions */}
                <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6 space-y-4">
                  <h3 className="font-bold text-white text-base">Quick Actions</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <button
                      onClick={() => setShowProgModal(true)}
                      className="w-full flex items-center justify-between p-4 bg-[#0f172a] hover:bg-[#142035] border border-slate-800 rounded-xl text-left hover:border-indigo-500/30 transition-all group"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="h-9 w-9 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center font-bold">+</span>
                        <div>
                          <p className="text-xs font-bold text-white">Add Programme</p>
                          <p className="text-[10px] text-slate-400">Insert new academic course path</p>
                        </div>
                      </div>
                      <span className="text-slate-500 group-hover:text-indigo-400 transition-colors">→</span>
                    </button>

                    <button
                      onClick={() => setShowClassModal(true)}
                      className="w-full flex items-center justify-between p-4 bg-[#0f172a] hover:bg-[#142035] border border-slate-800 rounded-xl text-left hover:border-indigo-500/30 transition-all group"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="h-9 w-9 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center font-bold">🏫</span>
                        <div>
                          <p className="text-xs font-bold text-white">Create Classes</p>
                          <p className="text-[10px] text-slate-400">Initialize new course groups (A-K)</p>
                        </div>
                      </div>
                      <span className="text-slate-500 group-hover:text-emerald-400 transition-colors">→</span>
                    </button>

                    <button
                      onClick={() => setShowRepModal(true)}
                      className="w-full flex items-center justify-between p-4 bg-[#0f172a] hover:bg-[#142035] border border-slate-800 rounded-xl text-left hover:border-indigo-500/30 transition-all group"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="h-9 w-9 bg-rose-500/10 text-rose-400 rounded-lg flex items-center justify-center font-bold">👤</span>
                        <div>
                          <p className="text-xs font-bold text-white">Create Class Rep</p>
                          <p className="text-[10px] text-slate-400">Provision representative credentials</p>
                        </div>
                      </div>
                      <span className="text-slate-500 group-hover:text-rose-400 transition-colors">→</span>
                    </button>
                  </div>
                </div>

                {/* System Threshold Summary */}
                <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6 space-y-4">
                  <h3 className="font-bold text-white text-base">Threshold Settings</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                      <div>
                        <p className="text-xs font-bold text-white">Late Grace Period</p>
                        <p className="text-[10px] text-slate-400">Marker status thresholds</p>
                      </div>
                      <span className="bg-[#0f172a] text-amber-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-800">
                        {settings.lateWindowMinutes} Mins
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                      <div>
                        <p className="text-xs font-bold text-white">QR Expiry</p>
                        <p className="text-[10px] text-slate-400">Dynamic refresh frequency</p>
                      </div>
                      <span className="bg-[#0f172a] text-blue-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-800">
                        {settings.qrExpirySeconds} Secs
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-white">Geofence Boundary</p>
                        <p className="text-[10px] text-slate-400">Check-in location range</p>
                      </div>
                      <span className="bg-[#0f172a] text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-800">
                        {settings.geofenceRadiusMeters} Meters
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PROGRAMMES PANEL */}
          {activeTab === 'programmes' && !loading && (
            <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6 space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white text-base">Academic Programmes</h3>
                  <p className="text-xs text-slate-400">Manage course pipelines that drive student enrollment</p>
                </div>
                <button
                  onClick={() => setShowProgModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center space-x-2 transition"
                >
                  <span>+ Add Programme</span>
                </button>
              </div>

              {programmes.length === 0 ? (
                <div className="text-center py-12 text-slate-400 border border-dashed border-slate-800 rounded-xl">
                  No academic programmes configured. Click Add Programme to get started.
                </div>
              ) : (
                <div className="overflow-hidden border border-slate-800 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#0f172a] text-slate-400 text-xs font-bold border-b border-slate-800">
                        <th className="p-4">Name</th>
                        <th className="p-4">Class Count</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {programmes.map(prog => (
                        <tr key={prog.id} className="hover:bg-[#162238] transition-colors text-slate-200">
                          <td className="p-4 font-bold text-white text-sm">{prog.name}</td>
                          <td className="p-4 text-xs font-semibold">{prog._count?.classes || 0} Class(es)</td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setEditingProgramme(prog);
                                setShowEditProgModal(true);
                              }}
                              className="text-xs text-blue-400 hover:text-blue-300 font-bold hover:bg-blue-500/10 px-3 py-1.5 rounded-lg transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteProgramme(prog.id)}
                              className="text-xs text-red-400 hover:text-red-300 font-bold hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* CLASSES CONTROL PANEL */}
          {activeTab === 'classes' && !loading && (
            <div className="space-y-6 animate-fade-in">
              {/* Filter Bar */}
              <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-5 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-3 items-center">
                  <input
                    type="text"
                    placeholder="Search classes..."
                    value={classFilters.search}
                    onChange={(e) => setClassFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors w-48"
                  />

                  <select
                    value={classFilters.programmeId}
                    onChange={(e) => setClassFilters(prev => ({ ...prev, programmeId: e.target.value }))}
                    className="bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="">All Programmes</option>
                    {programmes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>

                  <select
                    value={classFilters.level}
                    onChange={(e) => setClassFilters(prev => ({ ...prev, level: e.target.value }))}
                    className="bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="">All Levels</option>
                    <option value="100">Level 100</option>
                    <option value="200">Level 200</option>
                    <option value="300">Level 300</option>
                    <option value="400">Level 400</option>
                  </select>

                  <select
                    value={classFilters.type}
                    onChange={(e) => setClassFilters(prev => ({ ...prev, type: e.target.value }))}
                    className="bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="">All Types</option>
                    <option value="REGULAR">Regular</option>
                    <option value="TOP-UP">Top-Up</option>
                  </select>

                  <select
                    value={classFilters.session}
                    onChange={(e) => setClassFilters(prev => ({ ...prev, session: e.target.value }))}
                    className="bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="">All Sessions</option>
                    <option value="MORNING">Morning</option>
                    <option value="EVENING">Evening</option>
                    <option value="WEEKEND">Weekend</option>
                  </select>
                </div>

                <button
                  onClick={() => setShowClassModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition"
                >
                  + Create Classes
                </button>
              </div>

              {classes.length === 0 ? (
                <div className="bg-[#1e293b] text-center py-16 text-slate-400 border border-slate-800 rounded-2xl">
                  No classes configured. Click Create Classes to initialize groups.
                </div>
              ) : (
                <div className="space-y-6">
                  {getGroupedClasses().map((grouped, groupIdx) => (
                    <div key={groupIdx} className="bg-[#1e293b] rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
                      {/* Section Header */}
                      <div className="bg-[#0f172a] px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                        <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest">{grouped.header}</h4>
                        <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2.5 py-1 rounded-full border border-slate-700">
                          {grouped.items.length} Group(s)
                        </span>
                      </div>

                      {/* Class Cards Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                        {grouped.items.map(cls => {
                          const hasRep = !!cls.rep;
                          const hasCourses = (cls._count?.courses || 0) > 0;
                          const hasStudents = (cls._count?.students || 0) > 0;
                          const readyCount = [hasRep, hasCourses, hasStudents].filter(Boolean).length;
                          const isReady = readyCount === 3;
                          const progressPct = Math.round((readyCount / 3) * 100);

                          return (
                            <div key={cls.id} className={`bg-[#0f172a] rounded-2xl border transition-all duration-200 overflow-hidden ${
                              isReady ? 'border-emerald-500/20 hover:border-emerald-500/40' : 'border-slate-800 hover:border-amber-500/30'
                            }`}>
                              {/* Card Header */}
                              <div className="flex items-start justify-between p-4 pb-3 border-b border-slate-800/60">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-black text-white">Group {cls.group}</span>
                                    {/* Overall status badge */}
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                      isReady
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                                    }`}>
                                      {isReady ? '✓ Ready' : `⚠ ${3 - readyCount} step${3 - readyCount > 1 ? 's' : ''} left`}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 font-mono leading-none">{cls.displayName}</p>
                                </div>
                              </div>

                              {/* Setup Progress Bar */}
                              <div className="px-4 pt-3 pb-2">
                                <div className="flex justify-between items-center mb-1.5">
                                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Setup Progress</span>
                                  <span className={`text-[9px] font-black ${isReady ? 'text-emerald-400' : 'text-amber-400'}`}>{readyCount}/3</span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${isReady ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                    style={{ width: `${progressPct}%` }}
                                  />
                                </div>
                              </div>

                              {/* Status Pills */}
                              <div className="px-4 py-3 grid grid-cols-3 gap-2">
                                {/* Rep Pill */}
                                <div className={`rounded-xl p-2.5 border text-center ${
                                  hasRep ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-800/60 border-slate-700'
                                }`}>
                                  <div className={`text-base mb-0.5 ${hasRep ? 'text-emerald-400' : 'text-slate-600'}`}>
                                    {hasRep ? '✓' : '✗'}
                                  </div>
                                  <div className={`text-[9px] font-black uppercase tracking-wide ${hasRep ? 'text-emerald-400' : 'text-slate-500'}`}>Rep</div>
                                  <div className={`text-[9px] mt-0.5 truncate ${hasRep ? 'text-emerald-300/70' : 'text-slate-600'}`}>
                                    {hasRep ? cls.rep.username : 'None'}
                                  </div>
                                </div>

                                {/* Courses Pill */}
                                <div className={`rounded-xl p-2.5 border text-center ${
                                  hasCourses ? 'bg-purple-500/5 border-purple-500/20' : 'bg-rose-500/5 border-rose-500/20'
                                }`}>
                                  <div className={`text-base mb-0.5 font-black font-mono ${hasCourses ? 'text-purple-400' : 'text-rose-400'}`}>
                                    {hasCourses ? cls._count.courses : '0'}
                                  </div>
                                  <div className={`text-[9px] font-black uppercase tracking-wide ${hasCourses ? 'text-purple-400' : 'text-rose-400'}`}>Courses</div>
                                  <div className={`text-[9px] mt-0.5 ${hasCourses ? 'text-purple-300/70' : 'text-rose-400/60'}`}>
                                    {hasCourses ? 'Linked' : 'None linked'}
                                  </div>
                                </div>

                                {/* Students Pill */}
                                <div className={`rounded-xl p-2.5 border text-center ${
                                  hasStudents ? 'bg-blue-500/5 border-blue-500/20' : 'bg-rose-500/5 border-rose-500/20'
                                }`}>
                                  <div className={`text-base mb-0.5 font-black font-mono ${hasStudents ? 'text-blue-400' : 'text-rose-400'}`}>
                                    {hasStudents ? cls._count.students : '0'}
                                  </div>
                                  <div className={`text-[9px] font-black uppercase tracking-wide ${hasStudents ? 'text-blue-400' : 'text-rose-400'}`}>Students</div>
                                  <div className={`text-[9px] mt-0.5 ${hasStudents ? 'text-blue-300/70' : 'text-rose-400/60'}`}>
                                    {hasStudents ? 'Enrolled' : 'Not uploaded'}
                                  </div>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="px-4 pb-4 pt-1 flex flex-wrap gap-2 border-t border-slate-800/60 mt-2 pt-3">
                                <button
                                  onClick={() => { setSelectedClassForRep(cls); setShowAssignRepModal(true); }}
                                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 px-2.5 py-1.5 rounded-lg border border-indigo-500/20 hover:border-indigo-500/40 transition-all"
                                >
                                  {hasRep ? '↻ Change Rep' : '+ Assign Rep'}
                                </button>
                                {hasRep && (
                                  <button
                                    onClick={() => handleRemoveRepFromClass(cls.id)}
                                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-rose-500/20 hover:border-rose-500/40 transition-all"
                                  >
                                    ✕ Remove Rep
                                  </button>
                                )}
                                <button
                                  onClick={() => handleOpenStudentsModal(cls)}
                                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2.5 py-1.5 rounded-lg border border-blue-500/20 hover:border-blue-500/40 transition-all"
                                >
                                  👥 Manage Students
                                </button>
                                <button
                                  onClick={() => handleOpenCoursesModal(cls)}
                                  className="text-[10px] font-bold text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 px-2.5 py-1.5 rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-all"
                                >
                                  📚 Manage Courses
                                </button>
                                <button
                                  onClick={() => {
                                    setConfirmState({
                                      open: true,
                                      message: 'Delete this class group? Enrollment records will be affected.',
                                      onConfirm: async () => {
                                        setConfirmState({ open: false, message: '', onConfirm: null });
                                        try {
                                          await api.delete(`/admin/classes/${cls.id}`);
                                          showNotification('Class deleted successfully');
                                          // Update classes state directly
                                          setClasses(prev => prev.filter(c => c.id !== cls.id));
                                        } catch (err) {
                                          showNotification('Failed to delete class', 'error');
                                        }
                                      }
                                    });
                                  }}
                                  className="text-[10px] font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-all ml-auto"
                                >
                                  🗑 Delete
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CLASS REPS PANEL */}
          {activeTab === 'reps' && !loading && (
            <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6 space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white text-base">Class Representative Accounts</h3>
                  <p className="text-xs text-slate-400">Provision and manage rep login credentials</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowBulkUploadModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Bulk Upload
                  </button>
                  <button
                    onClick={() => setShowRepModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition"
                  >
                    + Create Rep Account
                  </button>
                </div>
              </div>

              {reps.length === 0 ? (
                <div className="text-center py-12 text-slate-400 border border-dashed border-slate-800 rounded-xl">
                  No representative accounts configured. Click Create Rep Account.
                </div>
              ) : (
                <div className="overflow-hidden border border-slate-800 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#0f172a] text-slate-400 text-xs font-bold border-b border-slate-800">
                        <th className="p-4">Username</th>
                        <th className="p-4">Assigned Class</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {reps.map(rep => (
                        <tr key={rep.id} className="hover:bg-[#162238] transition-colors text-slate-200">
                          <td className="p-4">
                            <span className="font-bold text-white text-sm block">{rep.username}</span>
                          </td>
                          <td className="p-4 text-xs font-semibold">
                            {rep.assignedClass ? (
                              <span className="text-indigo-400 font-bold">{rep.assignedClass.displayName}</span>
                            ) : (
                              <span className="text-slate-500 italic">No assigned class</span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                              rep.isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {rep.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setEditingRep(rep);
                                setShowEditRepModal(true);
                              }}
                              className="text-xs text-blue-400 hover:text-blue-300 font-bold hover:bg-blue-500/10 px-2.5 py-1.5 rounded-lg transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setResetPwdRepId(rep.id);
                                setShowResetPwdModal(true);
                              }}
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold hover:bg-indigo-500/10 px-2.5 py-1.5 rounded-lg transition"
                            >
                              Reset Password
                            </button>
                            <button
                              onClick={() => handleToggleRepStatus(rep.id, rep.isActive)}
                              className={`text-xs font-bold hover:bg-slate-800 px-2.5 py-1.5 rounded-lg transition ${
                                rep.isActive ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'
                              }`}
                            >
                              {rep.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleDeleteRep(rep.id)}
                              className="text-xs text-red-400 hover:text-red-300 font-bold hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg transition"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* LECTURER ALLOCATIONS PANEL */}
          {activeTab === 'lecturers' && !loading && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-white text-base">Lecturer Course & Class Allocations</h3>
                  <p className="text-xs text-slate-400">Map lecturers to their specific course-class assignments using Excel sheets</p>
                </div>
                <button
                  onClick={() => {
                    const headers = ["Lecturer Name", "Course Code", "Course Name", "Programme", "Level", "Type", "Group", "Session"];
                    const sampleRow = ["Dr. Kofi Mensah", "BIT 102", "Software Engineering", "BIT", "100", "REGULAR", "A", "MORNING"];
                    const csvContent = "data:text/csv;charset=utf-8," 
                      + [headers.join(","), sampleRow.join(",")].join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "gctu_lecturer_allocations_template.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showNotification("Template CSV downloaded. Edit and re-upload.");
                  }}
                  className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-indigo-400 border border-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Allocation Template
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Side: Upload Panel */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6 space-y-6">
                    <h4 className="font-bold text-sm text-white">Upload Allocation Spreadsheets</h4>
                    
                    <form onSubmit={handleLecturerFileUpload} className="space-y-4">
                      {/* Drag & Drop zone */}
                      <div 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer?.files[0];
                          if (file) {
                            const name = file.name.toLowerCase();
                            if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
                              setLecturerFile(file);
                            } else {
                              showNotification("Unsupported file type. Please upload Excel or CSV.", "error");
                            }
                          }
                        }}
                        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[160px] ${
                          lecturerFile 
                            ? 'border-emerald-500 bg-emerald-500/5' 
                            : 'border-slate-700 hover:border-indigo-500 bg-slate-900/50'
                        }`}
                      >
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          id="lecturer-file-upload"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setLecturerFile(file);
                          }}
                        />
                        <label htmlFor="lecturer-file-upload" className="cursor-pointer w-full flex flex-col items-center justify-center">
                          <svg className={`w-10 h-10 mb-3 transition-colors ${lecturerFile ? 'text-emerald-400' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          </svg>
                          {lecturerFile ? (
                            <div>
                              <p className="text-xs font-bold text-emerald-400 break-all">{lecturerFile.name}</p>
                              <p className="text-[10px] text-slate-500 mt-1 font-mono">{(lecturerFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs font-bold text-slate-300">Drag & drop sheet here, or <span className="text-indigo-400 hover:underline">browse</span></p>
                              <p className="text-[10px] text-slate-500 mt-1.5">Supports Excel (.xlsx, .xls) and CSV files</p>
                            </div>
                          )}
                        </label>
                      </div>

                      <div className="flex gap-2">
                        {lecturerFile && (
                          <button
                            type="button"
                            onClick={() => setLecturerFile(null)}
                            className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-semibold px-3 py-2 rounded-xl transition"
                          >
                            Clear
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={uploadingLecturers || !lecturerFile}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 active:scale-95 text-white text-xs font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                        >
                          {uploadingLecturers ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Processing...
                            </>
                          ) : (
                            'Process Allocation Sheet'
                          )}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Guide Panel */}
                  <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6 space-y-4">
                    <h5 className="font-bold text-xs uppercase tracking-wider text-[#D4A017] flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Allocations Mapping Guide
                    </h5>
                    <p className="text-[11px] leading-relaxed text-slate-400">
                      When mapping sheets are uploaded, the GCTU Attendance System automates administrative registration:
                    </p>
                    <ul className="text-[10px] space-y-2 text-slate-300 list-disc list-inside">
                      <li>Matches and registers missing <span className="font-bold text-indigo-400">Courses</span> & <span className="font-bold text-indigo-400">Programmes</span>.</li>
                      <li>Ensures exact <span className="font-bold text-indigo-400">Classes</span> are constructed and linked.</li>
                      <li>Auto-creates <span className="font-bold text-[#D4A017]">Lecturer Accounts</span> using names as usernames (Role: <code className="text-indigo-400">LECTURER</code>).</li>
                      <li>Default temp password: <code className="bg-[#0f172a] px-1 py-0.5 rounded text-emerald-400 font-mono font-bold">gctuLecturer123!</code>.</li>
                      <li>Accounts can immediately log in and will see customized portals.</li>
                    </ul>
                  </div>

                  {/* Parse Results Log */}
                  {lecturerUploadResults && (
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6 space-y-4 animate-fade-in">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <h4 className="font-bold text-xs uppercase text-slate-400">Processing Summary</h4>
                        <button 
                          onClick={() => setLecturerUploadResults(null)}
                          className="text-[10px] text-slate-500 hover:text-slate-300 font-semibold"
                        >
                          Dismiss
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#0f172a] rounded-xl p-3 border border-emerald-500/10">
                          <p className="text-[10px] text-slate-500 font-bold uppercase">Linked Rows</p>
                          <p className="text-2xl font-black text-emerald-400">{lecturerUploadResults.successCount}</p>
                        </div>
                        <div className="bg-[#0f172a] rounded-xl p-3 border border-red-500/10">
                          <p className="text-[10px] text-slate-500 font-bold uppercase">Skipped Rows</p>
                          <p className="text-2xl font-black text-red-400">{lecturerUploadResults.failedCount}</p>
                        </div>
                      </div>
                      
                      {lecturerUploadResults.createdLecturers?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">Registered Lecturers ({lecturerUploadResults.createdLecturers.length})</p>
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto bg-[#0f172a] p-2 rounded-xl border border-slate-800">
                            {lecturerUploadResults.createdLecturers.map((name, i) => (
                              <span key={i} className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-bold">
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {lecturerUploadResults.errors?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-red-400 mb-1.5">Error Log</p>
                          <div className="bg-[#0f172a] p-2.5 rounded-xl border border-red-500/10 text-[9px] font-mono text-red-300 space-y-1 max-h-36 overflow-y-auto">
                            {lecturerUploadResults.errors.map((err, i) => (
                              <p key={i} className="leading-tight border-b border-red-500/5 pb-1">{err}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Side: Active Allocations Database Registry */}
                <div className="lg:col-span-8 space-y-6">
                  <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-sm text-white">Active Allocation Registry</h4>
                        <p className="text-xs text-slate-400">Search and prune lecturer distribution assignments</p>
                      </div>
                      
                      <div className="relative w-full sm:w-64">
                        <input
                          type="text"
                          placeholder="Search Lecturer or Course..."
                          value={lecturerSearchQuery}
                          onChange={(e) => setLecturerSearchQuery(e.target.value)}
                          className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all pl-9"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Filter Allocations */}
                    {(() => {
                      const filtered = lecturerAssignments.filter(a => {
                        const query = lecturerSearchQuery.toLowerCase();
                        return (
                          a.lecturerName.toLowerCase().includes(query) ||
                          a.courseName.toLowerCase().includes(query) ||
                          a.courseCode.toLowerCase().includes(query) ||
                          a.classDisplayName.toLowerCase().includes(query)
                        );
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-12 text-slate-400 border border-dashed border-slate-800 rounded-xl">
                            {lecturerSearchQuery ? 'No matching allocations found.' : 'No active lecturer allocations found. Parse spreadsheet to populate.'}
                          </div>
                        );
                      }

                      return (
                        <div className="overflow-hidden border border-slate-800 rounded-xl">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-[#0f172a] text-slate-400 text-[10px] uppercase font-bold border-b border-slate-800">
                                <th className="p-4">Lecturer</th>
                                <th className="p-4">Taught Course</th>
                                <th className="p-4">Assigned Class / Level</th>
                                <th className="p-4 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                              {filtered.map(assignment => (
                                <tr key={assignment.id} className="hover:bg-[#162238]/60 transition-colors text-slate-200 text-xs">
                                  <td className="p-4">
                                    <div className="flex items-center gap-2">
                                      <div className="h-6 w-6 rounded-full bg-indigo-500/10 text-indigo-400 font-bold text-[9px] flex items-center justify-center border border-indigo-500/20">
                                        {assignment.lecturerName.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="font-bold text-white text-sm block">{assignment.lecturerName}</span>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <span className="font-bold block text-slate-300">{assignment.courseName}</span>
                                    <span className="text-[9px] text-slate-500 font-mono mt-0.5 block">{assignment.courseCode}</span>
                                  </td>
                                  <td className="p-4">
                                    <span className="text-indigo-400 font-bold block">{assignment.classDisplayName}</span>
                                  </td>
                                  <td className="p-4 text-right">
                                    <button
                                      onClick={() => handleDeleteAssignment(assignment.id)}
                                      className="text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 font-bold px-3 py-1.5 rounded-lg border border-transparent hover:border-red-500/20 transition-all duration-200"
                                    >
                                      Remove Link
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* COURSES PANEL */}
          {activeTab === 'courses' && !loading && (
            <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6 space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white text-base">Global Courses Database</h3>
                  <p className="text-xs text-slate-400">Configure courses which can be linked to class sessions</p>
                </div>
                <button
                  onClick={() => setShowCourseModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition"
                >
                  + Add Course
                </button>
              </div>

              {courses.length === 0 ? (
                <div className="text-center py-12 text-slate-400 border border-dashed border-slate-800 rounded-xl">
                  No courses found in system. Click Add Course to register one.
                </div>
              ) : (
                <div className="overflow-hidden border border-slate-800 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#0f172a] text-slate-400 text-xs font-bold border-b border-slate-800">
                        <th className="p-4">Course Name</th>
                        <th className="p-4">Course Code</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {courses.map(course => (
                        <tr key={course.id} className="hover:bg-[#162238] transition-colors text-slate-200">
                          <td className="p-4 font-bold text-white text-sm">{course.name}</td>
                          <td className="p-4 font-mono text-xs text-indigo-300">{course.code}</td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                setEditingCourse(course);
                                setShowEditCourseModal(true);
                              }}
                              className="text-xs text-blue-400 hover:text-blue-300 font-bold hover:bg-blue-500/10 px-3 py-1.5 rounded-lg transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteGlobalCourse(course.id)}
                              className="text-xs text-red-400 hover:text-red-300 font-bold hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SETTINGS PANEL */}
          {activeTab === 'settings' && !loading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
              {/* Branding & Logo */}
              <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6 space-y-6">
                <div>
                  <h3 className="font-bold text-white text-base">Department Branding</h3>
                  <p className="text-xs text-slate-400">Customize the department name and banner logo</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Logo Preview</label>
                    <div className="flex items-center space-x-4">
                      <div className="h-24 w-24 bg-[#0f172a] rounded-2xl border border-slate-800 flex items-center justify-center overflow-hidden">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Dept Logo" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs text-slate-500 font-bold">No Logo</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <input
                          type="file"
                          ref={logoInputRef}
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              setLogoFile(file);
                              setLogoPreview(URL.createObjectURL(file));
                            }
                          }}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          onClick={() => logoInputRef.current.click()}
                          className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
                        >
                          Select Image File
                        </button>
                        {logoFile && (
                          <button
                            onClick={handleLogoUpload}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl ml-2 transition"
                          >
                            Save Upload
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Department Name</label>
                    <input
                      type="text"
                      value={settings.deptName}
                      onChange={(e) => setSettings(prev => ({ ...prev, deptName: e.target.value }))}
                      className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        await api.patch('/admin/settings', { deptName: settings.deptName });
                        showNotification('Department name branding updated');
                      } catch (err) {
                        showNotification('Failed to update brand name', 'error');
                      }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition"
                  >
                    Save Branding Text
                  </button>
                </div>
              </div>

              {/* Threshold Parameters */}
              <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6 space-y-6">
                <div>
                  <h3 className="font-bold text-white text-base">System Threshold Config</h3>
                  <p className="text-xs text-slate-400">Calibrate geofence range, late windows, and QR tokens</p>
                </div>

                <form onSubmit={handleSettingsSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Late Grace Period (Minutes)</label>
                    <input
                      type="number"
                      required
                      value={settings.lateWindowMinutes}
                      onChange={(e) => setSettings(prev => ({ ...prev, lateWindowMinutes: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">QR Expiry Span (Seconds)</label>
                    <input
                      type="number"
                      required
                      value={settings.qrExpirySeconds}
                      onChange={(e) => setSettings(prev => ({ ...prev, qrExpirySeconds: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Geofence Radius (Meters)</label>
                    <input
                      type="number"
                      required
                      value={settings.geofenceRadiusMeters}
                      onChange={(e) => setSettings(prev => ({ ...prev, geofenceRadiusMeters: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition"
                  >
                    Save Thresholds
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* GRIEVANCES PANEL */}
          {activeTab === 'grievances' && !loading && (
            <div className="animate-fade-in">
              <AdminGrievancePanel />
            </div>
          )}

          {/* ARCHIVES PANEL */}
          {activeTab === 'reports' && !loading && (
            <div className="animate-fade-in">
              <OfficialArchives />
            </div>
          )}

          {/* REPORT SETTINGS PANEL */}
          {activeTab === 'report_settings' && !loading && (
            <div className="animate-fade-in">
              <ReportSettings />
            </div>
          )}

          {/* HELP & SETUP GUIDE */}
          {activeTab === 'help' && !loading && (
            <div className="animate-fade-in">
              <HelpGuidePage />
            </div>
          )}

          {/* NOTIFICATIONS PANEL */}
          {activeTab === 'notifications' && (
            <div className="animate-fade-in space-y-6">
              <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-white text-lg">System Notifications</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {notifications.filter(n => !n.isRead).length} unread • {notifications.length} total
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {notifications.some(n => !n.isRead) && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Mark All Read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={handleClearAll}
                        className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {notificationsLoading ? (
                  <div className="flex justify-center items-center py-20">
                    <div className="w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-20 space-y-4">
                    <div className="inline-flex p-4 bg-slate-800/50 rounded-2xl">
                      <svg className="w-12 h-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0L12 17l-8-4" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-slate-400">All caught up!</p>
                    <p className="text-xs text-slate-500">No notifications to display</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notification) => {
                      const getIcon = (type) => {
                        switch (type) {
                          case 'SUCCESS':
                            return (
                              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            );
                          case 'WARNING':
                            return (
                              <div className="p-3 bg-[#D4A017]/10 text-[#D4A017] rounded-xl border border-[#D4A017]/20">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              </div>
                            );
                          case 'DANGER':
                            return (
                              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            );
                          default:
                            return (
                              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

                        return date.toLocaleDateString(undefined, { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric',
                          hour: '2-digit', 
                          minute: '2-digit' 
                        });
                      };

                      return (
                        <div
                          key={notification.id}
                          onClick={() => handleMarkAsRead(notification.id)}
                          className={`p-5 rounded-xl border transition-all cursor-pointer flex gap-4 relative ${
                            !notification.isRead 
                              ? 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10' 
                              : 'bg-slate-800/30 border-slate-800 hover:bg-slate-800/50'
                          }`}
                        >
                          {!notification.isRead && (
                            <span className="absolute top-5 right-5 h-2.5 w-2.5 rounded-full bg-[#D4A017] animate-pulse" />
                          )}
                          {getIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold mb-1 ${!notification.isRead ? 'text-white' : 'text-slate-300'}`}>
                              {notification.title}
                            </p>
                            <p className="text-sm text-slate-400 leading-relaxed mb-2">
                              {notification.message}
                            </p>
                            <span className="text-xs text-slate-500 font-medium">
                              {formatTime(notification.createdAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 3. MODALS BLOCK */}

      {/* ADD PROGRAMME MODAL */}
      {showProgModal && (
        <AddProgrammeModal
          onClose={() => setShowProgModal(false)}
          onSaved={handleProgrammeSaved}
        />
      )}

      {/* EDIT PROGRAMME MODAL */}
      {showEditProgModal && editingProgramme && (
        <EditProgrammeModal
          programme={editingProgramme}
          onClose={() => {
            setShowEditProgModal(false);
            setEditingProgramme(null);
          }}
          onSaved={handleProgrammeUpdated}
        />
      )}

      {/* ADD CLASS MODAL (MULTI-STEP) */}
      {showClassModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-up">
            {/* Steps indicator */}
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs font-bold text-slate-400">Step {classStep} of 3</span>
              <div className="flex space-x-1.5">
                {[1, 2, 3].map(s => (
                  <span key={s} className={`h-1.5 w-1.5 rounded-full ${classStep >= s ? 'bg-indigo-500' : 'bg-slate-800'}`}></span>
                ))}
              </div>
            </div>

            {/* Step 1: Details */}
            {classStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">Create Class Groups</h3>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Academic Programme</label>
                  <select
                    value={newClass.programmeId}
                    onChange={(e) => setNewClass(prev => ({ ...prev, programmeId: e.target.value }))}
                    className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="" disabled>Select Programme</option>
                    {programmes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Level</label>
                    <select
                      value={newClass.level}
                      onChange={(e) => setNewClass(prev => ({ ...prev, level: e.target.value }))}
                      className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-3 text-white focus:outline-none"
                    >
                      <option value="100">100</option>
                      <option value="200">200</option>
                      <option value="300">300</option>
                      <option value="400">400</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Type</label>
                    <select
                      value={newClass.type}
                      onChange={(e) => setNewClass(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-3 text-white focus:outline-none"
                    >
                      <option value="REGULAR">REGULAR</option>
                      <option value="TOP-UP">TOP-UP</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Session</label>
                    <select
                      value={newClass.session}
                      onChange={(e) => setNewClass(prev => ({ ...prev, session: e.target.value }))}
                      className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-3 text-white focus:outline-none"
                    >
                      <option value="MORNING">MORNING</option>
                      <option value="EVENING">EVENING</option>
                      <option value="WEEKEND">WEEKEND</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={resetClassModal}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!newClass.programmeId) {
                        showNotification('Please select a programme', 'error');
                        return;
                      }
                      setClassStep(2);
                    }}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white"
                  >
                    Next Step
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Choose Groups */}
            {classStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">Select Class Groups</h3>
                <p className="text-xs text-slate-400">Click to toggle groups you want to create simultaneously</p>

                {/* A-K Grid */}
                <div className="grid grid-cols-4 gap-2">
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].map(letter => {
                    const isSelected = newClass.groups.includes(letter);
                    return (
                      <button
                        key={letter}
                        onClick={() => handleGroupToggle(letter)}
                        className={`h-11 rounded-xl text-xs font-black border transition-all ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-md scale-95'
                            : 'bg-[#0f172a] text-slate-400 border-slate-800 hover:bg-slate-800/40'
                        }`}
                      >
                        Group {letter}
                      </button>
                    );
                  })}
                </div>

                {/* Preview text */}
                <div className="bg-[#0f172a] rounded-xl p-4 border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">Creation Summary</span>
                  {newClass.groups.length === 0 ? (
                    <span className="text-slate-500 italic text-xs">No groups selected yet</span>
                  ) : (
                    <p className="text-xs font-semibold text-slate-200">
                      You are about to create: <br />
                      <span className="text-indigo-400">
                        {newClass.groups.map(g => {
                          const prog = programmes.find(p => p.id === newClass.programmeId)?.name || '';
                          return `${prog} LVL ${newClass.level} ${newClass.type} GROUP ${g} (${newClass.session})`;
                        }).join(', ')}
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    onClick={() => setClassStep(1)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCreateClasses}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white"
                  >
                    Create All
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Success */}
            {classStep === 3 && (
              <div className="flex flex-col items-center text-center py-6 space-y-5">
                <div className="h-16 w-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/20 animate-bounce">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Classes Spawned Successfully</h3>
                  <p className="text-xs text-slate-400 mt-1">Associated group cards are now live on your classes deck.</p>
                </div>
                <div className="flex flex-col space-y-2 w-full pt-4">
                  <button
                    onClick={() => {
                      resetClassModal();
                      setActiveTab('reps');
                    }}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white transition-all"
                  >
                    Assign Representatives Now
                  </button>
                  <button
                    onClick={resetClassModal}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300"
                  >
                    Done / Return
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE REP MODAL */}
      {showRepModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-white mb-4">Create Class Rep</h3>
            <form onSubmit={handleCreateRep} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newRep.fullName}
                  onChange={(e) => setNewRep(prev => ({ ...prev, fullName: e.target.value }))}
                  className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Index Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 10912345"
                  value={newRep.indexNumber}
                  onChange={(e) => setNewRep(prev => ({ ...prev, indexNumber: e.target.value }))}
                  className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Username (Login ID)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. johndoe"
                  value={newRep.username}
                  onChange={(e) => setNewRep(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={newRep.password}
                  onChange={(e) => setNewRep(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  required
                  placeholder="Repeat password"
                  value={newRep.confirmPassword}
                  onChange={(e) => setNewRep(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRepModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK UPLOAD REPS MODAL */}
      {showBulkUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] border border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-white mb-4">Bulk Upload Class Reps</h3>
            
            <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-xs text-blue-400 font-semibold mb-2">📋 Excel/CSV Format Required:</p>
              <p className="text-xs text-slate-400 mb-2">Columns: <span className="font-mono text-blue-400">indexNumber, name, email, programme, level, type, group, session</span></p>
              <p className="text-xs text-slate-400">Example: <span className="font-mono text-slate-300">10912345, John Doe, john@gctu.edu.gh, BIT, 300, TOP-UP, B, EVENING</span></p>
              <p className="text-xs text-amber-400 mt-2">⚠️ Default password: <span className="font-mono font-bold">rep123</span></p>
            </div>

            <form onSubmit={handleBulkUploadReps} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Select File</label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setBulkUploadFile(e.target.files[0])}
                  className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer"
                />
                {bulkUploadFile && (
                  <p className="text-xs text-emerald-400 mt-2">✓ Selected: {bulkUploadFile.name}</p>
                )}
              </div>

              {bulkUploadResult && (
                <div className={`p-4 rounded-xl border ${
                  bulkUploadResult.createdCount > 0 
                    ? 'bg-emerald-500/10 border-emerald-500/20' 
                    : 'bg-amber-500/10 border-amber-500/20'
                }`}>
                  <p className="text-xs font-semibold text-white mb-2">Upload Results:</p>
                  <p className="text-xs text-slate-300">✓ Created: {bulkUploadResult.createdCount}</p>
                  <p className="text-xs text-slate-300">⊘ Skipped: {bulkUploadResult.skippedCount}</p>
                  {bulkUploadResult.errors && bulkUploadResult.errors.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      <p className="text-xs text-amber-400 font-semibold mb-1">Errors:</p>
                      {bulkUploadResult.errors.map((err, idx) => (
                        <p key={idx} className="text-xs text-slate-400">• {err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkUploadModal(false);
                    setBulkUploadFile(null);
                    setBulkUploadResult(null);
                  }}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!bulkUploadFile || bulkUploadLoading}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {bulkUploadLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Upload File
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetPwdModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-white mb-4">Reset Rep Password</h3>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowResetPwdModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD COURSE MODAL */}
      {showCourseModal && (
        <AddCourseModal
          onClose={() => setShowCourseModal(false)}
          onSaved={handleCourseSaved}
        />
      )}

      {/* EDIT COURSE MODAL */}
      {showEditCourseModal && editingCourse && (
        <EditCourseModal
          course={editingCourse}
          onClose={() => {
            setShowEditCourseModal(false);
            setEditingCourse(null);
          }}
          onSaved={handleCourseUpdated}
        />
      )}

      {/* EDIT STUDENT MODAL */}
      {showEditStudentModal && editingStudent && (
        <EditStudentModal
          student={editingStudent}
          onClose={() => {
            setShowEditStudentModal(false);
            setEditingStudent(null);
          }}
          onSaved={handleStudentUpdated}
        />
      )}

      {/* EDIT REP MODAL */}
      {showEditRepModal && editingRep && (
        <EditRepModal
          rep={editingRep}
          onClose={() => {
            setShowEditRepModal(false);
            setEditingRep(null);
          }}
          onSaved={handleRepUpdated}
        />
      )}

      {/* ASSIGN REPRESENTATIVE MODAL */}
      {showAssignRepModal && selectedClassForRep && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-up">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Assign Class Rep</h3>
                <span className="text-xs text-indigo-400 font-semibold">{selectedClassForRep.displayName}</span>
              </div>
              <button
                onClick={() => {
                  setShowAssignRepModal(false);
                  setSelectedClassForRep(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Search unassigned reps..."
                value={repSearchQuery}
                onChange={(e) => setRepSearchQuery(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />

              <div className="max-h-60 overflow-y-auto space-y-2">
                {reps
                  .filter(r => r.isActive && !r.assignedClass)
                  .filter(r => r.username.toLowerCase().includes(repSearchQuery.toLowerCase()))
                  .map(rep => (
                    <button
                      key={rep.id}
                      onClick={() => handleAssignRep(rep.id)}
                      className="w-full text-left p-3.5 bg-[#0f172a] hover:bg-[#142035] border border-slate-800 hover:border-indigo-500/30 rounded-xl flex items-center justify-between text-xs text-slate-200 transition"
                    >
                      <span className="font-bold text-white">{rep.username}</span>
                      <span className="text-indigo-400 font-bold">Assign →</span>
                    </button>
                  ))}

                {reps.filter(r => r.isActive && !r.assignedClass).length === 0 && (
                  <p className="text-center py-4 text-xs text-slate-500 italic">No unassigned active representatives found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW STUDENTS MODAL (MANUAL + BULK IMPORT) */}
      {showStudentsModal && selectedClassForStudents && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] border border-slate-800 rounded-2xl p-6 max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-scale-up">
            <div className="flex justify-between items-start mb-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Enrollment List</h3>
                <span className="text-xs text-indigo-400 font-semibold">{selectedClassForStudents.displayName}</span>
              </div>
              <button
                onClick={() => {
                  setShowStudentsModal(false);
                  setSelectedClassForStudents(null);
                  setManualStudents([{ name: '', indexNumber: '', email: '' }]);
                  setCsvPreview([]);
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Existing students list */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-white">Enrolled Students ({classStudents.length})</h4>
                  <div className="flex items-center gap-3">
                    {selectedStudentIds.length > 0 && (
                      <button
                        onClick={handleBulkDeleteStudents}
                        className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Selected ({selectedStudentIds.length})
                      </button>
                    )}
                    <input
                      type="text"
                      placeholder="Search enrolled..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="bg-[#0f172a] border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                {classStudents.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-6 text-center border border-dashed border-slate-800 rounded-xl">No students registered in this class group.</p>
                ) : (
                  <div className="overflow-hidden border border-slate-800 rounded-xl max-h-60 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#0f172a] text-slate-400 text-xs font-bold border-b border-slate-800 sticky top-0">
                          <th className="p-3 w-10">
                            <input
                              type="checkbox"
                              checked={
                                classStudents.filter(s =>
                                  s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                                  s.indexNumber.includes(studentSearch)
                                ).length > 0 &&
                                selectedStudentIds.length ===
                                classStudents.filter(s =>
                                  s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                                  s.indexNumber.includes(studentSearch)
                                ).length
                              }
                              onChange={handleToggleAllStudents}
                              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer"
                            />
                          </th>
                          <th className="p-3">Index Number</th>
                          <th className="p-3">Full Name</th>
                          <th className="p-3">Email Address</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {classStudents
                          .filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.indexNumber.includes(studentSearch))
                          .map(student => (
                            <tr key={student.id} className={`hover:bg-[#162238] transition-colors ${selectedStudentIds.includes(student.id) ? 'bg-indigo-500/10' : 'text-slate-200'}`}>
                              <td className="p-3">
                                <input
                                  type="checkbox"
                                  checked={selectedStudentIds.includes(student.id)}
                                  onChange={() => handleToggleStudentSelection(student.id)}
                                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer"
                                />
                              </td>
                              <td className="p-3 font-mono text-xs text-indigo-300 font-bold">{student.indexNumber}</td>
                              <td className="p-3 text-xs font-semibold">{student.name}</td>
                              <td className="p-3 text-xs font-semibold text-slate-400">{student.email || 'N/A'}</td>
                              <td className="p-3 text-right space-x-2">
                                <button
                                  onClick={() => {
                                    setEditingStudent(student);
                                    setShowEditStudentModal(true);
                                  }}
                                  className="text-xs text-blue-400 hover:text-blue-300 font-bold hover:bg-blue-500/10 px-2.5 py-1 rounded-md transition"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleRemoveStudentFromClass(student.id)}
                                  className="text-xs text-red-400 hover:text-red-300 font-bold hover:bg-red-500/10 px-2.5 py-1 rounded-md transition"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Add students section */}
              <div className="border-t border-slate-800 pt-6 space-y-4">
                <div className="flex border-b border-slate-850">
                  <button
                    onClick={() => setStudentAddTab('manual')}
                    className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
                      studentAddTab === 'manual' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    ✍️ Manual Entry
                  </button>
                  <button
                    onClick={() => setStudentAddTab('csv')}
                    className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
                      studentAddTab === 'csv' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    📂 Bulk Import (CSV/Excel/PDF)
                  </button>
                </div>

                {/* Manual entry tab */}
                {studentAddTab === 'manual' && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {manualStudents.map((s, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-3">
                            <input
                              type="text"
                              required
                              placeholder="Index Number"
                              value={s.indexNumber}
                              onChange={(e) => handleManualStudentChange(idx, 'indexNumber', e.target.value)}
                              className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>
                          <div className="col-span-4">
                            <input
                              type="text"
                              required
                              placeholder="Full Name"
                              value={s.name}
                              onChange={(e) => handleManualStudentChange(idx, 'name', e.target.value)}
                              className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>
                          <div className="col-span-4">
                            <input
                              type="email"
                              placeholder="Email (Optional)"
                              value={s.email}
                              onChange={(e) => handleManualStudentChange(idx, 'email', e.target.value)}
                              className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                            />
                          </div>
                          <div className="col-span-1 text-center">
                            {manualStudents.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveManualStudentRow(idx)}
                                className="text-red-400 hover:text-red-300 font-bold"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between pt-2">
                      <button
                        onClick={handleAddManualStudentRow}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-bold"
                      >
                        + Add Another Student Row
                      </button>
                      <button
                        onClick={handleSaveManualStudents}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
                      >
                        Enroll Selected Students
                      </button>
                    </div>
                  </div>
                )}

                {/* CSV upload tab */}
                {studentAddTab === 'csv' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>Import student database using CSV (.csv), Excel (.xlsx, .xls) or PDF (.pdf) files.</span>
                      <a
                        href="/students_template.csv"
                        download
                        className="text-indigo-400 hover:underline font-semibold"
                      >
                        Download CSV Template
                      </a>
                    </div>

                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleCsvFileDrop}
                      className="border-2 border-dashed border-slate-800 rounded-xl p-8 text-center bg-[#0f172a] hover:border-indigo-500/30 transition cursor-pointer"
                    >
                      <input
                        type="file"
                        onChange={handleCsvFileDrop}
                        accept=".csv,.xlsx,.xls,.pdf"
                        className="hidden"
                        id="csv-file-selector"
                      />
                      <label htmlFor="csv-file-selector" className="cursor-pointer">
                        <span className="block text-slate-300 font-bold text-sm">Drag and drop file here, or click to browse</span>
                        <span className="block text-[10px] text-slate-500 mt-1">Supports CSV, Excel sheets, and class registers in PDF format</span>
                      </label>
                    </div>

                    {csvPreview.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-emerald-400 font-bold">Previewing parsed records ({csvPreview.length} students):</span>
                          <button
                            onClick={handleImportCsv}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl"
                          >
                            Import Previewed Students
                          </button>
                        </div>
                        <div className="overflow-hidden border border-slate-800 rounded-xl max-h-40 overflow-y-auto">
                          <table className="w-full text-left border-collapse">
                            <tbody className="divide-y divide-slate-800 text-slate-300">
                              {csvPreview.slice(0, 10).map((row, i) => (
                                <tr key={i} className="text-xs bg-[#1a2335]/30">
                                  <td className="p-2 font-mono">{row.indexNumber}</td>
                                  <td className="p-2">{row.name}</td>
                                  <td className="p-2 text-slate-400">{row.email}</td>
                                </tr>
                              ))}
                              {csvPreview.length > 10 && (
                                <tr>
                                  <td colSpan="3" className="p-2 text-center text-slate-500 text-[10px] italic">...and {csvPreview.length - 10} more rows</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLASS COURSES MODAL */}
      {showClassCoursesModal && selectedClassForCourses && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-up">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Linked Class Courses</h3>
                <span className="text-xs text-indigo-400 font-semibold">{selectedClassForCourses.displayName}</span>
              </div>
              <button
                onClick={() => {
                  setShowClassCoursesModal(false);
                  setSelectedClassForCourses(null);
                  setClassCourses([]);
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Linked courses */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Currently Linked</span>
                {classCourses.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">No courses linked to this class group yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {classCourses.map(cc => (
                      <div key={cc.id} className="flex justify-between items-center p-2.5 bg-[#0f172a] rounded-lg border border-slate-800 text-xs">
                        <span className="text-slate-200 font-semibold">{cc.name} ({cc.code})</span>
                        <button
                          onClick={() => handleUnlinkCourseFromClass(cc.id)}
                          className="text-red-400 hover:text-red-300 font-bold text-[10px] uppercase"
                        >
                          Unlink
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Link new courses dropdown */}
              <div className="border-t border-slate-800 pt-4 space-y-2">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Link Available Course</span>
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {courses
                    .filter(c => !classCourses.some(cc => cc.courseId === c.id))
                    .map(course => (
                      <button
                        key={course.id}
                        onClick={() => handleLinkCourseToClass(course.id)}
                        className="w-full text-left p-3.5 bg-[#0f172a] hover:bg-[#142035] border border-slate-800 hover:border-indigo-500/30 rounded-xl flex items-center justify-between text-xs text-slate-200 transition"
                      >
                        <span className="font-bold text-white">{course.name} ({course.code})</span>
                        <span className="text-indigo-400 font-bold">Link +</span>
                      </button>
                    ))}

                  {courses.filter(c => !classCourses.some(cc => cc.courseId === c.id)).length === 0 && (
                    <p className="text-center py-2 text-xs text-slate-500 italic">All database courses are linked.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmState.open && (
        <ConfirmModal
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState({ open: false, message: '', onConfirm: null })}
        />
      )}

      {/* Onboarding Tour */}
      {showOnboarding && (
        <OnboardingTour
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}
    </div>
  );
}
