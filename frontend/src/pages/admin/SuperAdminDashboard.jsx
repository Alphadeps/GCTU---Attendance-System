import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const PencilIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const FolderIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);
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
import SystemMonitoring from './SystemMonitoring';
import SecurityLogs from './SecurityLogs';
import PerformanceMetrics from './PerformanceMetrics';

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
      { id: 'monitoring', label: 'System Monitoring', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
      { id: 'performance', label: 'Performance', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
      { id: 'security_logs', label: 'Security Logs', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
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

  // Mobile sidebar toggle
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Confirm modal state
  const [confirmState, setConfirmState] = useState({ open: false, message: '', onConfirm: null });

  // Onboarding tour state
  const [showOnboarding, setShowOnboarding] = useState(false);

  const showNotification = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => {
      setMessage({ text: '', type: '' });
    }, 4000);
  };

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
    } catch (error) {
      console.error(error);
      showNotification('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }

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
    } catch (error) {
      console.error(error);
      showNotification(error.response?.data?.error || 'Failed to change password. Ensure current password is correct.', 'error');
    }
  };

  // 2. Settings & Branding Handlers
  const handleSettingsSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.patch('/admin/settings', settings);
      showNotification('System thresholds updated successfully');
    } catch (error) {
      console.error(error);
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
    } catch (error) {
      console.error(error);
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

  const handleCleanupDuplicateProgrammes = () => {
    setConfirmState({
      open: true,
      message: 'This will merge duplicate programme names into 3 official programmes (BIT, BNSA, DIT). All classes will be reassigned. This action cannot be undone. Continue?',
      onConfirm: async () => {
        setConfirmState({ open: false, message: '', onConfirm: null });
        setLoading(true);
        try {
          const response = await api.post('/admin/programmes/cleanup-duplicates');
          showNotification(response.data.message || 'Programme cleanup completed successfully');
          
          // Show detailed report
          if (response.data.report) {
            const report = response.data.report;
            console.log('Cleanup Report:', report);
            
            if (report.merged.length > 0) {
              showNotification(
                `Merged ${report.merged.length} duplicate(s): ${report.merged.map(m => m.from).join(', ')}`,
                'success'
              );
            }
            
            if (report.errors.length > 0) {
              showNotification(`${report.errors.length} error(s) occurred. Check console for details.`, 'error');
            }
          }
          
          // Refresh programmes list
          const progRes = await api.get('/admin/programmes');
          if (progRes && progRes.data) {
            setProgrammes(progRes.data);
          }
          
          // Refresh classes list to show updated names
          const classRes = await api.get('/admin/classes');
          if (classRes && classRes.data) {
            setClasses(classRes.data);
          }
        } catch (err) {
          console.error('Cleanup error:', err);
          showNotification(err.response?.data?.error || 'Failed to cleanup programmes', 'error');
        } finally {
          setLoading(false);
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
    } catch (_err) {
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
        } catch (_err) {
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
        } catch (_err) {
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
    } catch (_err) {
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
      
      // Reload student list with fresh data
      const res = await api.get(`/admin/classes/${selectedClassForStudents.id}/students`);
      setClassStudents(res.data);
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
      
      // Reload student list with fresh data
      const res = await api.get(`/admin/classes/${selectedClassForStudents.id}/students`);
      setClassStudents(res.data);
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
          
          // Update state directly by removing the student
          setClassStudents(prev => prev.filter(s => s.id !== studentId));
        } catch (_err) {
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
          
          // Update state directly by removing deleted students
          setClassStudents(prev => prev.filter(s => !selectedStudentIds.includes(s.id)));
          setSelectedStudentIds([]);
        } catch (_err) {
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
    } catch (_err) {
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
        } catch (_err) {
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
    } catch (error) {
      console.error(error);
      showNotification(error.response?.data?.error || 'Failed to upload spreadsheet.', 'error');
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

  // Group classes by Programme + Level + Type + Session
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

  // Active tab label for breadcrumb
  const getActiveTabLabel = () => {
    for (const group of MENU_GROUPS) {
      const item = group.items.find(i => i.id === activeTab);
      if (item) return item.label;
    }
    return activeTab;
  };

  const attendanceChartData = stats?.attendanceRates
    ? [
        stats.attendanceRates.lvl100 || 0,
        stats.attendanceRates.lvl200 || 0,
        stats.attendanceRates.lvl300 || 0,
        stats.attendanceRates.lvl400 || 0,
        stats.attendanceRates.topUp || 0,
        stats.attendanceRates.evening || 0
      ]
    : [0, 0, 0, 0, 0, 0];
  const attendanceChartLabels = ['Lvl 100', 'Lvl 200', 'Lvl 300', 'Lvl 400', 'Top-Up', 'Evening'];
  const rawMax = Math.max(...attendanceChartData);
  const maxBar = rawMax === 0 ? 100 : rawMax;

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#344767] flex font-sans antialiased relative">
      {/* 0. FORCE PASSWORD CHANGE OVERLAY */}
      {needsPasswordChange && (
        <div className="fixed inset-0 bg-white/95 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full animate-fade-in-up" style={{boxShadow:'0 25px 50px -12px rgba(0,0,0,.18)'}}>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="h-14 w-14 rounded-xl flex items-center justify-center mb-4" style={{background:'linear-gradient(135deg,#C59B27,#E5A93C)'}}>
                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-[#344767] mb-2">Change Default Password</h2>
              <p className="text-[#8392ab] text-sm leading-relaxed">
                For security, you must change the default password (<code className="bg-[#f8f9fa] px-1.5 py-0.5 rounded text-red-500 font-mono text-xs">admin123</code>) before continuing.
              </p>
            </div>
            <form onSubmit={handleForcePasswordChange} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8392ab] mb-1.5">Current Password</label>
                <input type="password" required placeholder="Enter current password" value={pwdChangeForm.currentPassword}
                  onChange={(e) => setPwdChangeForm(p => ({ ...p, currentPassword: e.target.value }))}
                  className="w-full bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-4 py-3 text-sm text-[#344767] focus:outline-none focus:border-[#344767] transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8392ab] mb-1.5">New Password</label>
                <input type="password" required placeholder="Minimum 6 characters" value={pwdChangeForm.newPassword}
                  onChange={(e) => setPwdChangeForm(p => ({ ...p, newPassword: e.target.value }))}
                  className="w-full bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-4 py-3 text-sm text-[#344767] focus:outline-none focus:border-[#344767] transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8392ab] mb-1.5">Confirm New Password</label>
                <input type="password" required placeholder="Repeat new password" value={pwdChangeForm.confirmPassword}
                  onChange={(e) => setPwdChangeForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  className="w-full bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-4 py-3 text-sm text-[#344767] focus:outline-none focus:border-[#344767] transition-colors" />
              </div>
              <button type="submit" className="sip-btn-dark">
                Change Password &amp; Access System
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Global alert notification */}
      {message.text && (
        <div className={`fixed top-5 right-5 z-[9999] px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in-down backdrop-blur-sm text-white text-sm font-semibold ${
          message.type === 'error' ? 'bg-red-500' :
          message.type === 'info' ? 'bg-blue-500' : 'bg-emerald-500'
        }`}>
          <span className="w-2 h-2 rounded-full bg-white/60 flex-shrink-0"></span>
          {message.text}
        </div>
      )}

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="sidebar-overlay lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* 1. LEFT SIDEBAR */}
      <aside className={`w-[260px] bg-white flex flex-col h-screen fixed left-0 top-0 z-50 transition-transform duration-300
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:sticky lg:top-0`}
        style={{boxShadow:'2px 0 20px rgba(0,0,0,.05)'}}>

        {/* Brand */}
        <div className="px-5 py-5 flex items-center gap-3 border-b border-[#f0f2f5]">
          <img
            src={logoPreview || '/logo.jfif'}
            alt="Logo"
            onError={(e) => { e.target.src = '/logo.jfif'; }}
            className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
          />
          <div className="min-w-0">
            <h1 className="font-bold leading-tight text-[#344767] truncate" style={{fontSize:13}}>GCTU Attendance</h1>
            <span className="text-[9px] text-[#adb5bd] font-bold uppercase tracking-widest">Super Admin Panel</span>
          </div>
          <button className="ml-auto lg:hidden text-[#adb5bd] hover:text-[#344767]" onClick={() => setMobileSidebarOpen(false)}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {MENU_GROUPS.map((group, groupIdx) => (
            <div key={groupIdx}>
              <span className="px-3 block mb-1.5" style={{fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#adb5bd'}}>
                {group.title}
              </span>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { setActiveTab(item.id); setMobileSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${
                      activeTab === item.id
                        ? 'text-white shadow-md'
                        : 'text-[#67748e] hover:bg-[#f8f9fa] hover:text-[#344767]'
                    }`}
                    style={activeTab === item.id ? {background:'linear-gradient(135deg, #0c2340, #1a3c6d)', boxShadow:'0 4px 12px rgba(12,35,64,.35)'} : {}}
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={item.icon} />
                    </svg>
                    <span style={{fontSize:12,fontWeight:600}}>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-[#f0f2f5] space-y-2">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{background:'linear-gradient(135deg, #0c2340, #1a3c6d)'}}>SA</div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#344767] truncate">Administrator</p>
              <span className="text-[10px] text-[#adb5bd]">superadmin</span>
            </div>
            <NotificationPanel />
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[#8392ab] hover:text-rose-600 hover:bg-rose-50 transition-all text-xs font-semibold"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Log Out
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#f8f9fa]">

        {/* Sticky Header */}
        <header className="sticky top-0 z-30 bg-white px-6 h-[68px] flex items-center justify-between shrink-0"
          style={{boxShadow:'0 2px 12px rgba(0,0,0,.06)'}}>
          <div className="flex items-center gap-3">
            {/* Hamburger - mobile only */}
            <button
              className="lg:hidden p-2 rounded-lg text-[#8392ab] hover:bg-[#f8f9fa] transition-colors"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <p className="text-[10px] text-[#adb5bd] font-medium">Dashboard &rsaquo; <span className="text-[#344767] font-semibold">{getActiveTabLabel()}</span></p>
              <h2 className="font-bold text-[#344767] leading-tight" style={{fontSize:15}}>{getActiveTabLabel()}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Visual search bar */}
            <div className="hidden md:flex items-center gap-2 bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-3 py-2 w-48">
              <svg className="w-4 h-4 text-[#adb5bd] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-xs text-[#adb5bd]">Search...</span>
            </div>

            {/* System status indicator */}
            <div className="flex items-center gap-2 bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
              <span className="text-xs font-semibold text-[#344767] hidden sm:block">Live</span>
            </div>

            {/* Help button */}
            <button
              onClick={() => setShowOnboarding(true)}
              className="p-2 rounded-xl text-[#8392ab] hover:bg-[#f8f9fa] hover:text-[#344767] transition-colors border border-transparent hover:border-[#e9ecef]"
              title="Show setup guide"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* User avatar */}
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 cursor-pointer"
              style={{background:'linear-gradient(135deg, #0c2340, #1a3c6d)'}}>SA</div>
          </div>
        </header>

        {/* Tab panels */}
        <div className="flex-1 p-5 md:p-7 overflow-y-auto">
          {loading && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-28 rounded-2xl" />
              ))}
            </div>
          )}

          {/* OVERVIEW PANEL */}
          {activeTab === 'overview' && !loading && (
            <div className="space-y-6 animate-fade-in-up">

              {/* TOP ROW - 4 Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1 - teal gradient */}
                <div className="stat-card-teal p-5 hover-lift animate-fade-in-up">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-4xl font-black text-white animate-number-pop">{stats.studentsCount}</p>
                  <p className="text-sm font-semibold text-white/90 mt-1">Total Students</p>
                  <p className="text-xs text-white/60 mt-0.5">Enrolled across all classes</p>
                </div>

                {/* Card 2 - white, pink accent */}
                <div className="sip-card p-5 hover-lift animate-fade-in-up delay-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg" style={{background:'rgba(229,169,60,.1)'}}>
                      <svg className="w-5 h-5" style={{color:'#E5A93C'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-4xl font-black text-[#344767] animate-number-pop delay-100">{stats.classesCount}</p>
                  <p className="text-sm font-semibold text-[#344767] mt-1">Active Classes</p>
                  <p className="text-xs text-[#8392ab] mt-0.5">{stats.programmesCount} programme{stats.programmesCount !== 1 ? 's' : ''}</p>
                </div>

                {/* Card 3 - white, green accent */}
                <div className="sip-card p-5 hover-lift animate-fade-in-up delay-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg" style={{background:'rgba(130,214,22,.1)'}}>
                      <svg className="w-5 h-5" style={{color:'#4a7c10'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-4xl font-black text-[#344767] animate-number-pop delay-200">{stats.repsCount}</p>
                  <p className="text-sm font-semibold text-[#344767] mt-1">Class Reps</p>
                  <p className="text-xs text-[#8392ab] mt-0.5">Managing attendance</p>
                </div>

                {/* Card 4 - white, amber accent + pulse if active */}
                <div className="sip-card p-5 hover-lift animate-fade-in-up delay-300">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg" style={{background:'rgba(251,207,51,.15)'}}>
                      <svg className="w-5 h-5" style={{color:'#9a6f00'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    {stats.activeSessionsCount > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Live
                      </span>
                    )}
                  </div>
                  <p className="text-4xl font-black text-[#344767] animate-number-pop delay-300">{stats.activeSessionsCount}</p>
                  <p className="text-sm font-semibold text-[#344767] mt-1">Live Sessions</p>
                  <p className="text-xs text-[#8392ab] mt-0.5">{stats.activeSessionsCount > 0 ? 'Sessions in progress' : 'No active sessions'}</p>
                </div>
              </div>

              {/* SECOND ROW */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Attendance Performance Chart (2/3 width) */}
                <div className="lg:col-span-2 sip-card p-6 animate-fade-in-up delay-200">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h3 className="font-bold text-[#344767]" style={{fontSize:14}}>Attendance Performance</h3>
                      <p className="text-xs text-[#8392ab] mt-0.5">Rate by level grouping</p>
                    </div>
                    <span className="badge badge-info">This Semester</span>
                  </div>

                  {/* CSS bar chart */}
                  <div className="flex items-end gap-3 h-36 overflow-x-auto pb-1">
                    {attendanceChartData.map((val, i) => (
                      <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-[36px]">
                        <span className="text-[10px] font-bold" style={{color: (val === maxBar && maxBar > 0) ? '#E5A93C' : '#344767'}}>{val}%</span>
                        <div className="w-full rounded-t-lg transition-all duration-700"
                          style={{
                            height: `${Math.round((val / maxBar) * 100)}%`,
                            background: (val === maxBar && maxBar > 0) ? 'linear-gradient(135deg,#C59B27,#E5A93C)' : 'linear-gradient(135deg,#0c2340,#1a3c6d)',
                            minHeight: 8,
                            animation: `growBar 0.8s calc(${i}*0.1s) ease both`,
                            '--bar-h': `${Math.round((val / maxBar) * 100)}%`,
                          }} />
                        <span className="text-[9px] text-[#8392ab] font-medium text-center whitespace-nowrap">{attendanceChartLabels[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Actions (1/3 width) */}
                <div className="sip-card p-5 animate-fade-in-up delay-300">
                  <h3 className="font-bold text-[#344767] mb-4" style={{fontSize:14}}>Quick Actions</h3>
                  <div className="divide-y divide-[#f0f2f5]">
                    {[
                      {
                        label: 'Add Programme', sub: 'New academic path',
                        icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6',
                        color: '#1a3c6d', bg: 'rgba(26,60,109,.1)',
                        action: () => setShowProgModal(true)
                      },
                      {
                        label: 'Create Classes', sub: 'Initialize groups A-K',
                        icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
                        color: '#82d616', bg: 'rgba(130,214,22,.1)',
                        action: () => setShowClassModal(true)
                      },
                      {
                        label: 'Create Rep', sub: 'Provision credentials',
                        icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
                        color: '#E5A93C', bg: 'rgba(229,169,60,.1)',
                        action: () => setShowRepModal(true)
                      },
                      {
                        label: 'Add Course', sub: 'Register global course',
                        icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
                        color: '#E5A93C', bg: 'rgba(229,169,60,.1)',
                        action: () => setShowCourseModal(true)
                      },
                    ].map((item, i) => (
                      <button key={i} onClick={item.action}
                        className="w-full flex items-center gap-3 py-3 hover:bg-[#f8f9fa] rounded-lg px-1 transition-colors group text-left">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:item.bg}}>
                          <svg className="w-4 h-4" style={{color:item.color}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[#344767]">{item.label}</p>
                          <p className="text-[10px] text-[#8392ab]">{item.sub}</p>
                        </div>
                        <svg className="w-4 h-4 text-[#adb5bd] group-hover:text-[#344767] transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* System thresholds summary row */}
              <div className="sip-card p-5 animate-fade-in-up delay-400">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-[#344767]" style={{fontSize:13}}>System Thresholds</h3>
                  <button onClick={() => setActiveTab('settings')} className="text-xs text-[#E5A93C] font-semibold hover:underline">Configure</button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    {label:'Late Grace Period', val:`${settings.lateWindowMinutes} min`, color:'#E5A93C'},
                    {label:'QR Expiry', val:`${settings.qrExpirySeconds} sec`, color:'#0c2340'},
                    {label:'Geofence Radius', val:`${settings.geofenceRadiusMeters} m`, color:'#82d616'},
                  ].map((t,i) => (
                    <div key={i} className="bg-[#f8f9fa] rounded-xl p-3.5">
                      <p className="text-[10px] text-[#8392ab] font-medium mb-1">{t.label}</p>
                      <p className="text-lg font-black" style={{color:t.color}}>{t.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PROGRAMMES PANEL */}
          {activeTab === 'programmes' && !loading && (
            <div className="sip-card p-6 space-y-5 animate-fade-in-up">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[#344767]" style={{fontSize:14}}>Academic Programmes</h3>
                  <p className="text-xs text-[#8392ab] mt-0.5">Manage course pipelines that drive student enrollment</p>
                </div>
                <div className="flex gap-2">
                  {programmes.length > 3 && (
                    <button
                      onClick={handleCleanupDuplicateProgrammes}
                      className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold px-4 py-2 rounded-xl hover:bg-amber-100 transition active:scale-95"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Cleanup Duplicates
                    </button>
                  )}
                  <button
                    onClick={() => setShowProgModal(true)}
                    className="sip-btn-dark !w-auto px-4 py-2 text-xs"
                  >
                    + Add Programme
                  </button>
                </div>
              </div>

              {programmes.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-[#e9ecef] rounded-xl">
                  <svg className="w-10 h-10 text-[#adb5bd] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  </svg>
                  <p className="text-sm font-semibold text-[#8392ab]">No programmes yet</p>
                  <p className="text-xs text-[#adb5bd] mt-1">Click Add Programme to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="sip-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Classes</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {programmes.map(prog => (
                        <tr key={prog.id}>
                          <td className="font-semibold text-[#344767]">{prog.name}</td>
                          <td>
                            <span className="badge badge-dark">{prog._count?.classes || 0} class{(prog._count?.classes || 0) !== 1 ? 'es' : ''}</span>
                          </td>
                          <td className="text-right space-x-1">
                            <button
                              onClick={() => { setEditingProgramme(prog); setShowEditProgModal(true); }}
                              className="text-xs text-[#E5A93C] hover:underline font-semibold px-2 py-1"
                            >Edit</button>
                            <button
                              onClick={() => handleDeleteProgramme(prog.id)}
                              className="text-xs text-red-400 hover:underline font-semibold px-2 py-1"
                            >Delete</button>
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
            <div className="space-y-5 animate-fade-in-up">
              {/* Filter bar */}
              <div className="sip-card p-4 flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search classes..."
                      value={classFilters.search}
                      onChange={(e) => setClassFilters(prev => ({ ...prev, search: e.target.value }))}
                      className="bg-[#f8f9fa] border border-[#e9ecef] rounded-xl pl-8 pr-3 py-2 text-xs text-[#344767] focus:outline-none focus:border-[#344767] transition-colors w-44"
                    />
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#adb5bd]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <select value={classFilters.programmeId} onChange={(e) => setClassFilters(prev => ({ ...prev, programmeId: e.target.value }))}
                    className="bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-3 py-2 text-xs text-[#344767] focus:outline-none">
                    <option value="">All Programmes</option>
                    {programmes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={classFilters.level} onChange={(e) => setClassFilters(prev => ({ ...prev, level: e.target.value }))}
                    className="bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-3 py-2 text-xs text-[#344767] focus:outline-none">
                    <option value="">All Levels</option>
                    <option value="100">Level 100</option>
                    <option value="200">Level 200</option>
                    <option value="300">Level 300</option>
                    <option value="400">Level 400</option>
                  </select>
                  <select value={classFilters.type} onChange={(e) => setClassFilters(prev => ({ ...prev, type: e.target.value }))}
                    className="bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-3 py-2 text-xs text-[#344767] focus:outline-none">
                    <option value="">All Types</option>
                    <option value="REGULAR">Regular</option>
                    <option value="TOP-UP">Top-Up</option>
                  </select>
                  <select value={classFilters.session} onChange={(e) => setClassFilters(prev => ({ ...prev, session: e.target.value }))}
                    className="bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-3 py-2 text-xs text-[#344767] focus:outline-none">
                    <option value="">All Sessions</option>
                    <option value="MORNING">Morning</option>
                    <option value="EVENING">Evening</option>
                    <option value="WEEKEND">Weekend</option>
                  </select>
                </div>
                <button onClick={() => setShowClassModal(true)} className="sip-btn-dark !w-auto px-4 py-2 text-xs">
                  + Create Classes
                </button>
              </div>

              {classes.length === 0 ? (
                <div className="sip-card text-center py-16">
                  <svg className="w-10 h-10 text-[#adb5bd] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <p className="text-sm font-semibold text-[#8392ab]">No classes yet</p>
                  <p className="text-xs text-[#adb5bd] mt-1">Click Create Classes to initialize groups</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {getGroupedClasses().map((grouped, groupIdx) => (
                    <div key={groupIdx} className="sip-card overflow-hidden">
                      <div className="bg-[#f8f9fa] px-5 py-3 border-b border-[#f0f2f5] flex justify-between items-center">
                        <h4 className="text-xs font-bold text-[#344767] uppercase tracking-wider">{grouped.header}</h4>
                        <span className="badge badge-dark">{grouped.items.length} group{grouped.items.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                        {grouped.items.map(cls => {
                          const hasRep = !!cls.rep;
                          const hasCourses = (cls._count?.courses || 0) > 0;
                          const hasStudents = (cls._count?.students || 0) > 0;
                          const readyCount = [hasRep, hasCourses, hasStudents].filter(Boolean).length;
                          const isReady = readyCount === 3;
                          const progressPct = Math.round((readyCount / 3) * 100);
                          return (
                            <div key={cls.id} className={`bg-[#f8f9fa] rounded-xl border transition-all overflow-hidden ${
                              isReady ? 'border-emerald-200' : 'border-[#e9ecef]'
                            }`}>
                              <div className="flex items-start justify-between p-4 pb-3">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-bold text-[#344767]">Group {cls.group}</span>
                                    <span className={`badge ${isReady ? 'badge-success' : 'badge-warning'}`}>
                                      {isReady ? 'Ready' : `${3-readyCount} step${3-readyCount>1?'s':''} left`}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-[#adb5bd] font-mono">{cls.displayName}</p>
                                </div>
                              </div>

                              {/* Thin progress bar */}
                              <div className="px-4 pb-3">
                                <div className="flex justify-between mb-1">
                                  <span className="text-[9px] text-[#adb5bd] font-bold uppercase tracking-wider">Setup</span>
                                  <span className="text-[9px] font-bold text-[#344767]">{readyCount}/3</span>
                                </div>
                                <div className="w-full bg-[#e9ecef] rounded-full h-1 overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-500 ${isReady ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                    style={{width:`${progressPct}%`}} />
                                </div>
                              </div>

                              {/* Status indicators as dots + text */}
                              <div className="px-4 pb-3 flex gap-4">
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hasRep ? 'bg-emerald-500' : 'bg-[#e9ecef]'}`}></span>
                                  <span className="text-[10px] text-[#8392ab]">{hasRep ? cls.rep.username : 'No rep'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hasCourses ? 'bg-blue-400' : 'bg-[#e9ecef]'}`}></span>
                                  <span className="text-[10px] text-[#8392ab]">{hasCourses ? `${cls._count.courses} course${cls._count.courses!==1?'s':''}` : 'No courses'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hasStudents ? 'bg-purple-400' : 'bg-[#e9ecef]'}`}></span>
                                  <span className="text-[10px] text-[#8392ab]">{hasStudents ? `${cls._count.students} student${cls._count.students!==1?'s':''}` : 'No students'}</span>
                                </div>
                              </div>

                              {/* Action links */}
                              <div className="px-4 pb-4 pt-1 flex flex-wrap gap-x-3 gap-y-1 border-t border-[#f0f2f5] mt-1 pt-3">
                                <button onClick={() => { setSelectedClassForRep(cls); setShowAssignRepModal(true); }}
                                  className="text-[11px] font-semibold text-[#E5A93C] hover:underline">
                                  {hasRep ? 'Change Rep' : 'Assign Rep'}
                                </button>
                                {hasRep && (
                                  <button onClick={() => handleRemoveRepFromClass(cls.id)}
                                    className="text-[11px] font-semibold text-red-400 hover:underline">Remove Rep</button>
                                )}
                                <button onClick={() => handleOpenStudentsModal(cls)}
                                  className="text-[11px] font-semibold text-[#344767] hover:underline">Students</button>
                                <button onClick={() => handleOpenCoursesModal(cls)}
                                  className="text-[11px] font-semibold text-[#8392ab] hover:text-[#344767] hover:underline">Courses</button>
                                <button onClick={() => {
                                  setConfirmState({
                                    open: true,
                                    message: 'Delete this class group? Enrollment records will be affected.',
                                    onConfirm: async () => {
                                      setConfirmState({ open: false, message: '', onConfirm: null });
                                      try {
                                        await api.delete(`/admin/classes/${cls.id}`);
                                        showNotification('Class deleted successfully');
                                        setClasses(prev => prev.filter(c => c.id !== cls.id));
                                      } catch (_err) {
                                        showNotification('Failed to delete class', 'error');
                                      }
                                    }
                                  });
                                }}
                                  className="text-[11px] font-semibold text-red-400 hover:underline ml-auto">Delete</button>
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
            <div className="sip-card p-6 space-y-5 animate-fade-in-up">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[#344767]" style={{fontSize:14}}>Class Representatives</h3>
                  <p className="text-xs text-[#8392ab] mt-0.5">Provision and manage rep login credentials</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowBulkUploadModal(true)}
                    className="flex items-center gap-2 border border-[#e9ecef] bg-[#f8f9fa] text-[#344767] text-xs font-bold px-4 py-2 rounded-xl hover:bg-white transition active:scale-95">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Bulk Upload
                  </button>
                  <button onClick={() => setShowRepModal(true)} className="sip-btn-dark !w-auto px-4 py-2 text-xs">
                    + Create Rep
                  </button>
                </div>
              </div>

              {reps.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-[#e9ecef] rounded-xl">
                  <svg className="w-10 h-10 text-[#adb5bd] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-sm font-semibold text-[#8392ab]">No rep accounts yet</p>
                  <p className="text-xs text-[#adb5bd] mt-1">Click Create Rep to provision credentials</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="sip-table">
                    <thead>
                      <tr>
                        <th>Representative</th>
                        <th>Assigned Class</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reps.map(rep => {
                        const initials = rep.username?.substring(0,2).toUpperCase() || 'R';
                        return (
                          <tr key={rep.id}>
                            <td>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                  style={{background:'linear-gradient(135deg,#0c2340,#1a3c6d)'}}>
                                  {initials}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-[#344767]">{rep.username}</p>
                                  {rep.fullName && <p className="text-[10px] text-[#8392ab]">{rep.fullName}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="text-xs">
                              {rep.assignedClass
                                ? <span className="font-medium text-[#344767]">{rep.assignedClass.displayName}</span>
                                : <span className="text-[#adb5bd] italic">Unassigned</span>}
                            </td>
                            <td>
                              <span className={`badge ${rep.isActive ? 'badge-success' : 'badge-danger'}`}>
                                {rep.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="text-right space-x-1">
                              <button onClick={() => { setEditingRep(rep); setShowEditRepModal(true); }}
                                className="text-xs text-[#E5A93C] font-semibold hover:underline px-2 py-1">Edit</button>
                              <button onClick={() => { setResetPwdRepId(rep.id); setShowResetPwdModal(true); }}
                                className="text-xs text-[#8392ab] font-semibold hover:underline px-2 py-1">Reset Pwd</button>
                              <button onClick={() => handleToggleRepStatus(rep.id, rep.isActive)}
                                className={`text-xs font-semibold hover:underline px-2 py-1 ${rep.isActive ? 'text-amber-500' : 'text-emerald-500'}`}>
                                {rep.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button onClick={() => handleDeleteRep(rep.id)}
                                className="text-xs text-red-400 font-semibold hover:underline px-2 py-1">Delete</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* LECTURER ALLOCATIONS PANEL */}
          {activeTab === 'lecturers' && !loading && (
            <div className="space-y-5 animate-fade-in-up">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[#344767]" style={{fontSize:14}}>Lecturer Course &amp; Class Allocations</h3>
                  <p className="text-xs text-[#8392ab] mt-0.5">Map lecturers to their course-class assignments via Excel sheets</p>
                </div>
                <button
                  onClick={() => {
                    const headers = ["Lecturer Name", "Course Code", "Course Name", "Programme", "Level", "Type", "Group", "Session"];
                    const sampleRow = ["Dr. Kofi Mensah", "BIT 102", "Software Engineering", "BIT", "100", "REGULAR", "A", "MORNING"];
                    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), sampleRow.join(",")].join("\n");
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "gctu_lecturer_allocations_template.csv");
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showNotification("Template CSV downloaded. Edit and re-upload.");
                  }}
                  className="flex items-center gap-2 border border-[#e9ecef] bg-[#f8f9fa] text-[#344767] text-xs font-semibold px-4 py-2 rounded-xl hover:bg-white transition active:scale-95"
                >
                  <svg className="w-4 h-4 text-[#8392ab]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Template
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left: Upload Panel */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="sip-card p-5 space-y-4">
                    <h4 className="font-bold text-sm text-[#344767]">Upload Allocation Sheet</h4>
                    <form onSubmit={handleLecturerFileUpload} className="space-y-3">
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
                        className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[140px] ${
                          lecturerFile ? 'border-emerald-400 bg-emerald-50' : 'border-[#e9ecef] hover:border-[#E5A93C] bg-[#f8f9fa]'
                        }`}
                      >
                        <input type="file" accept=".xlsx,.xls,.csv" id="lecturer-file-upload" className="hidden"
                          onChange={(e) => { const file = e.target.files?.[0]; if (file) setLecturerFile(file); }} />
                        <label htmlFor="lecturer-file-upload" className="cursor-pointer w-full flex flex-col items-center justify-center">
                          <svg className={`w-8 h-8 mb-2 ${lecturerFile ? 'text-emerald-500' : 'text-[#adb5bd]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                          </svg>
                          {lecturerFile ? (
                            <div>
                              <p className="text-xs font-bold text-emerald-600 break-all">{lecturerFile.name}</p>
                              <p className="text-[10px] text-[#8392ab] mt-1 font-mono">{(lecturerFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs font-semibold text-[#344767]">Drag &amp; drop or <span className="text-[#E5A93C]">browse</span></p>
                              <p className="text-[10px] text-[#adb5bd] mt-1">Excel (.xlsx, .xls) or CSV</p>
                            </div>
                          )}
                        </label>
                      </div>
                      <div className="flex gap-2">
                        {lecturerFile && (
                          <button type="button" onClick={() => setLecturerFile(null)}
                            className="border border-[#e9ecef] bg-[#f8f9fa] text-[#344767] text-xs font-semibold px-3 py-2 rounded-xl hover:bg-white transition">Clear</button>
                        )}
                        <button type="submit" disabled={uploadingLecturers || !lecturerFile}
                          className="sip-btn-dark flex-1 py-2.5 text-xs disabled:opacity-50">
                          {uploadingLecturers ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                              Processing...
                            </span>
                          ) : 'Process Sheet'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Guide */}
                  <div className="sip-card p-4 space-y-3">
                    <h5 className="text-xs font-bold text-[#344767] flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#E5A93C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Mapping Guide
                    </h5>
                    <ul className="text-[10px] space-y-1.5 text-[#8392ab] list-disc list-inside leading-relaxed">
                      <li>Auto-matches <span className="font-semibold text-[#344767]">Courses</span> &amp; <span className="font-semibold text-[#344767]">Programmes</span></li>
                      <li>Creates missing <span className="font-semibold text-[#344767]">Classes</span> automatically</li>
                      <li>Registers <span className="font-semibold text-[#344767]">Lecturer Accounts</span> (role: <code className="text-[#E5A93C]">LECTURER</code>)</li>
                      <li>Default password: <code className="bg-[#f8f9fa] px-1 rounded text-emerald-600 font-mono">gctuLecturer123!</code></li>
                    </ul>
                  </div>

                  {/* Upload results */}
                  {lecturerUploadResults && (
                    <div className="sip-card p-4 space-y-3 animate-fade-in-up">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-bold text-[#344767] uppercase tracking-wider">Processing Summary</h4>
                        <button onClick={() => setLecturerUploadResults(null)} className="text-[10px] text-[#adb5bd] hover:text-[#344767]">Dismiss</button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-50 rounded-xl p-3">
                          <p className="text-[9px] text-[#8392ab] font-bold uppercase">Linked</p>
                          <p className="text-2xl font-black text-emerald-600">{lecturerUploadResults.successCount}</p>
                        </div>
                        <div className="bg-red-50 rounded-xl p-3">
                          <p className="text-[9px] text-[#8392ab] font-bold uppercase">Skipped</p>
                          <p className="text-2xl font-black text-red-500">{lecturerUploadResults.failedCount}</p>
                        </div>
                      </div>
                      {lecturerUploadResults.createdLecturers?.length > 0 && (
                        <div>
                          <p className="text-[9px] font-bold uppercase text-[#8392ab] mb-1.5">Registered Lecturers ({lecturerUploadResults.createdLecturers.length})</p>
                          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto bg-[#f8f9fa] p-2 rounded-lg">
                            {lecturerUploadResults.createdLecturers.map((name, i) => (
                              <span key={i} className="badge badge-info text-[9px]">{name}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {lecturerUploadResults.errors?.length > 0 && (
                        <div>
                          <p className="text-[9px] font-bold uppercase text-red-500 mb-1.5">Error Log</p>
                          <div className="bg-red-50 p-2.5 rounded-lg text-[9px] font-mono text-red-500 space-y-1 max-h-32 overflow-y-auto">
                            {lecturerUploadResults.errors.map((err, i) => <p key={i}>{err}</p>)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Allocation Registry */}
                <div className="lg:col-span-8">
                  <div className="sip-card p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-sm text-[#344767]">Active Allocation Registry</h4>
                        <p className="text-xs text-[#8392ab] mt-0.5">Search and manage lecturer assignments</p>
                      </div>
                      <div className="relative w-full sm:w-56">
                        <input type="text" placeholder="Search lecturer or course..." value={lecturerSearchQuery}
                          onChange={(e) => setLecturerSearchQuery(e.target.value)}
                          className="w-full bg-[#f8f9fa] border border-[#e9ecef] rounded-xl pl-8 pr-3 py-2 text-xs text-[#344767] focus:outline-none focus:border-[#344767] transition-colors" />
                        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#adb5bd]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>

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
                          <div className="text-center py-12 border-2 border-dashed border-[#e9ecef] rounded-xl">
                            <p className="text-sm font-semibold text-[#8392ab]">{lecturerSearchQuery ? 'No matching allocations' : 'No allocations yet'}</p>
                            <p className="text-xs text-[#adb5bd] mt-1">{lecturerSearchQuery ? 'Try a different search term' : 'Upload a spreadsheet to populate this registry'}</p>
                          </div>
                        );
                      }

                      return (
                        <div className="overflow-x-auto">
                          <table className="sip-table">
                            <thead>
                              <tr>
                                <th>Lecturer</th>
                                <th>Course</th>
                                <th>Class</th>
                                <th className="text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.map(assignment => (
                                <tr key={assignment.id}>
                                  <td>
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                        style={{background:'linear-gradient(135deg,#0c2340,#1a3c6d)'}}>
                                        {assignment.lecturerName.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="font-semibold text-[#344767]">{assignment.lecturerName}</span>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="font-medium text-[#344767] block">{assignment.courseName}</span>
                                    <span className="text-[10px] text-[#adb5bd] font-mono">{assignment.courseCode}</span>
                                  </td>
                                  <td className="text-[#8392ab] font-medium">{assignment.classDisplayName}</td>
                                  <td className="text-right">
                                    <button onClick={() => handleDeleteAssignment(assignment.id)}
                                      className="text-xs text-red-400 font-semibold hover:underline px-2 py-1">Remove</button>
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
            <div className="sip-card p-6 space-y-5 animate-fade-in-up">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-[#344767]" style={{fontSize:14}}>Global Courses Database</h3>
                  <p className="text-xs text-[#8392ab] mt-0.5">Configure courses that can be linked to class sessions</p>
                </div>
                <button onClick={() => setShowCourseModal(true)} className="sip-btn-dark !w-auto px-4 py-2 text-xs">
                  + Add Course
                </button>
              </div>
              {courses.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-[#e9ecef] rounded-xl">
                  <svg className="w-10 h-10 text-[#adb5bd] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <p className="text-sm font-semibold text-[#8392ab]">No courses yet</p>
                  <p className="text-xs text-[#adb5bd] mt-1">Click Add Course to register one</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="sip-table">
                    <thead>
                      <tr>
                        <th>Course Name</th>
                        <th>Code</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map(course => (
                        <tr key={course.id}>
                          <td className="font-semibold text-[#344767]">{course.name}</td>
                          <td><span className="badge badge-info font-mono">{course.code}</span></td>
                          <td className="text-right space-x-1">
                            <button onClick={() => { setEditingCourse(course); setShowEditCourseModal(true); }}
                              className="text-xs text-[#E5A93C] font-semibold hover:underline px-2 py-1">Edit</button>
                            <button onClick={() => handleDeleteGlobalCourse(course.id)}
                              className="text-xs text-red-400 font-semibold hover:underline px-2 py-1">Delete</button>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-in-up">
              {/* Branding */}
              <div className="sip-card p-6 space-y-5">
                <div>
                  <h3 className="font-bold text-[#344767]" style={{fontSize:14}}>Department Branding</h3>
                  <p className="text-xs text-[#8392ab] mt-0.5">Customize department name and logo</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8392ab] mb-2">Logo</label>
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-20 bg-[#f8f9fa] rounded-xl border border-[#e9ecef] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {logoPreview
                          ? <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                          : <span className="text-xs text-[#adb5bd] font-semibold">No Logo</span>}
                      </div>
                      <div className="space-y-2">
                        <input type="file" ref={logoInputRef}
                          onChange={(e) => { const file = e.target.files[0]; if (file) { setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); } }}
                          accept="image/*" className="hidden" />
                        <button onClick={() => logoInputRef.current.click()}
                          className="border border-[#e9ecef] bg-[#f8f9fa] text-[#344767] text-xs font-semibold px-4 py-2 rounded-xl hover:bg-white transition">
                          Choose File
                        </button>
                        {logoFile && (
                          <button onClick={handleLogoUpload}
                            className="sip-btn-dark !w-auto px-4 py-2 text-xs ml-2">Upload</button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8392ab] mb-1.5">Department Name</label>
                    <input type="text" value={settings.deptName}
                      onChange={(e) => setSettings(prev => ({ ...prev, deptName: e.target.value }))}
                      className="w-full bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-4 py-3 text-sm text-[#344767] focus:outline-none focus:border-[#344767] transition-colors" />
                  </div>
                  <button onClick={async () => {
                    try {
                      await api.patch('/admin/settings', { deptName: settings.deptName });
                      showNotification('Department name updated');
                    } catch (_err) { showNotification('Failed to update name', 'error'); }
                  }} className="sip-btn-dark !w-auto px-5 py-2.5 text-xs">
                    Save Name
                  </button>
                </div>
              </div>

              {/* Thresholds */}
              <div className="sip-card p-6 space-y-5">
                <div>
                  <h3 className="font-bold text-[#344767]" style={{fontSize:14}}>System Thresholds</h3>
                  <p className="text-xs text-[#8392ab] mt-0.5">Calibrate geofence, late window, and QR token settings</p>
                </div>
                <form onSubmit={handleSettingsSubmit} className="space-y-4">
                  {[
                    {label:'Late Grace Period (Minutes)', field:'lateWindowMinutes', val:settings.lateWindowMinutes},
                    {label:'QR Expiry (Seconds)', field:'qrExpirySeconds', val:settings.qrExpirySeconds},
                    {label:'Geofence Radius (Meters)', field:'geofenceRadiusMeters', val:settings.geofenceRadiusMeters},
                  ].map(t => (
                    <div key={t.field}>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8392ab] mb-1.5">{t.label}</label>
                      <input type="number" required value={t.val}
                        onChange={(e) => setSettings(prev => ({ ...prev, [t.field]: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-4 py-3 text-sm text-[#344767] focus:outline-none focus:border-[#344767] transition-colors" />
                    </div>
                  ))}
                  <button type="submit" className="sip-btn-dark !w-auto px-5 py-2.5 text-xs">Save Thresholds</button>
                </form>
              </div>
            </div>
          )}

          {/* GRIEVANCES PANEL */}
          {activeTab === 'grievances' && !loading && (
            <div className="animate-fade-in-up">
              <AdminGrievancePanel />
            </div>
          )}

          {/* ARCHIVES PANEL */}
          {activeTab === 'reports' && !loading && (
            <div className="animate-fade-in-up">
              <OfficialArchives />
            </div>
          )}

          {/* REPORT SETTINGS PANEL */}
          {activeTab === 'report_settings' && !loading && (
            <div className="animate-fade-in-up">
              <ReportSettings />
            </div>
          )}

          {/* HELP & SETUP GUIDE */}
          {activeTab === 'help' && !loading && (
            <div className="animate-fade-in-up">
              <HelpGuidePage />
            </div>
          )}

          {/* SYSTEM MONITORING PANEL */}
          {activeTab === 'monitoring' && !loading && (
            <div className="animate-fade-in-up">
              <SystemMonitoring />
            </div>
          )}

          {/* PERFORMANCE METRICS PANEL */}
          {activeTab === 'performance' && !loading && (
            <div className="animate-fade-in-up">
              <PerformanceMetrics />
            </div>
          )}

          {/* SECURITY LOGS PANEL */}
          {activeTab === 'security_logs' && !loading && (
            <div className="animate-fade-in-up">
              <SecurityLogs />
            </div>
          )}

          {/* NOTIFICATIONS PANEL */}
          {activeTab === 'notifications' && (
            <div className="animate-fade-in-up">
              <div className="sip-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  <div>
                    <h3 className="font-bold text-[#344767]" style={{fontSize:14}}>System Notifications</h3>
                    <p className="text-xs text-[#8392ab] mt-0.5">
                      {notifications.filter(n => !n.isRead).length} unread &bull; {notifications.length} total
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {notifications.some(n => !n.isRead) && (
                      <button onClick={handleMarkAllAsRead}
                        className="flex items-center gap-2 border border-[#e9ecef] bg-[#f8f9fa] text-[#344767] text-xs font-semibold px-4 py-2 rounded-xl hover:bg-white transition">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Mark All Read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button onClick={handleClearAll}
                        className="flex items-center gap-2 border border-red-200 bg-red-50 text-red-600 text-xs font-semibold px-4 py-2 rounded-xl hover:bg-red-100 transition">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {notificationsLoading ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-[#e9ecef] rounded-xl">
                    <svg className="w-10 h-10 text-[#adb5bd] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <p className="text-sm font-semibold text-[#8392ab]">All caught up!</p>
                    <p className="text-xs text-[#adb5bd] mt-1">No notifications to display</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifications.map((notification) => {
                      const iconMap = {
                        SUCCESS: {bg:'bg-emerald-50', color:'text-emerald-600', path:'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'},
                        WARNING: {bg:'bg-amber-50', color:'text-amber-600', path:'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'},
                        DANGER: {bg:'bg-red-50', color:'text-red-600', path:'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'},
                      };
                      const icon = iconMap[notification.type] || {bg:'bg-blue-50', color:'text-blue-600', path:'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'};

                      const formatTime = (dateString) => {
                        const date = new Date(dateString);
                        const now = new Date();
                        const diffMins = Math.floor((now - date) / 60000);
                        if (diffMins < 1) return 'Just now';
                        if (diffMins < 60) return `${diffMins}m ago`;
                        const diffHours = Math.floor(diffMins / 60);
                        if (diffHours < 24) return `${diffHours}h ago`;
                        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                      };

                      return (
                        <div key={notification.id} onClick={() => handleMarkAsRead(notification.id)}
                          className={`p-4 rounded-xl border cursor-pointer flex gap-3 relative transition-all ${
                            !notification.isRead ? 'border-[#E5A93C]/20 bg-[#E5A93C]/5 hover:bg-[#E5A93C]/10' : 'border-[#f0f2f5] bg-[#f8f9fa] hover:bg-[#f0f2f5]'
                          }`}>
                          {!notification.isRead && (
                            <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#E5A93C] animate-pulse" />
                          )}
                          <div className={`p-2 rounded-lg flex-shrink-0 ${icon.bg}`}>
                            <svg className={`w-4 h-4 ${icon.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon.path} />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#344767] mb-0.5">{notification.title}</p>
                            <p className="text-xs text-[#8392ab] leading-relaxed">{notification.message}</p>
                            <span className="text-[10px] text-[#adb5bd] font-medium mt-1 block">{formatTime(notification.createdAt)}</span>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="sip-card p-6 max-w-md w-full animate-scale-up">
            {/* Steps indicator */}
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs font-bold text-[#8392ab]">Step {classStep} of 3</span>
              <div className="flex space-x-1.5">
                {[1, 2, 3].map(s => (
                  <span key={s} className={`h-1.5 w-1.5 rounded-full ${classStep >= s ? 'bg-[#0c2340]' : 'bg-gray-200'}`}></span>
                ))}
              </div>
            </div>

            {/* Step 1: Details */}
            {classStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#344767]">Create Class Groups</h3>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8392ab] mb-1.5">Academic Programme</label>
                  <select
                    value={newClass.programmeId}
                    onChange={(e) => setNewClass(prev => ({ ...prev, programmeId: e.target.value }))}
                    className="w-full bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-4 py-3 text-sm text-[#344767] focus:outline-none focus:border-[#344767] transition-colors"
                  >
                    <option value="" disabled>Select Programme</option>
                    {programmes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8392ab] mb-1.5">Level</label>
                    <select
                      value={newClass.level}
                      onChange={(e) => setNewClass(prev => ({ ...prev, level: e.target.value }))}
                      className="w-full bg-[#f0f2f5] border border-gray-200 rounded-xl px-3 py-3 text-[#344767] focus:outline-none"
                    >
                      <option value="100">100</option>
                      <option value="200">200</option>
                      <option value="300">300</option>
                      <option value="400">400</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8392ab] mb-1.5">Type</label>
                    <select
                      value={newClass.type}
                      onChange={(e) => setNewClass(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full bg-[#f0f2f5] border border-gray-200 rounded-xl px-3 py-3 text-[#344767] focus:outline-none"
                    >
                      <option value="REGULAR">REGULAR</option>
                      <option value="TOP-UP">TOP-UP</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8392ab] mb-1.5">Session</label>
                    <select
                      value={newClass.session}
                      onChange={(e) => setNewClass(prev => ({ ...prev, session: e.target.value }))}
                      className="w-full bg-[#f0f2f5] border border-gray-200 rounded-xl px-3 py-3 text-[#344767] focus:outline-none"
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
                    className="px-4 py-2.5 bg-[#f8f9fa] border border-[#e9ecef] hover:bg-white rounded-xl text-xs font-semibold text-[#344767] transition-colors"
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
                    className="sip-btn-dark !w-auto px-4 py-2.5 text-xs"
                  >
                    Next Step
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Choose Groups */}
            {classStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-[#344767]">Select Class Groups</h3>
                <p className="text-xs text-[#8392ab]">Click to toggle groups you want to create simultaneously</p>

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
                            : 'bg-[#f0f2f5] text-[#8392ab] border-gray-200 hover:bg-gray-200/40'
                        }`}
                      >
                        Group {letter}
                      </button>
                    );
                  })}
                </div>

                {/* Preview text */}
                <div className="bg-[#f0f2f5] rounded-xl p-4 border border-gray-200">
                  <span className="text-[10px] text-[#8392ab] font-bold block mb-1">Creation Summary</span>
                  {newClass.groups.length === 0 ? (
                    <span className="text-[#8392ab] italic text-xs">No groups selected yet</span>
                  ) : (
                    <p className="text-xs font-semibold text-[#344767]">
                      You are about to create: <br />
                      <span className="text-[#0c2340]">
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
                    className="px-4 py-2.5 bg-[#f8f9fa] border border-[#e9ecef] hover:bg-white rounded-xl text-xs font-semibold text-[#344767] transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCreateClasses}
                    className="sip-btn-dark !w-auto px-4 py-2.5 text-xs"
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
                  <h3 className="text-lg font-bold text-[#344767]">Classes Spawned Successfully</h3>
                  <p className="text-xs text-[#8392ab] mt-1">Associated group cards are now live on your classes deck.</p>
                </div>
                <div className="flex flex-col space-y-2 w-full pt-4">
                  <button
                    onClick={() => {
                      resetClassModal();
                      setActiveTab('reps');
                    }}
                    className="w-full py-2.5 bg-[#0c2340] hover:bg-[#113057] rounded-xl text-xs font-bold text-white transition-all"
                  >
                    Assign Representatives Now
                  </button>
                  <button
                    onClick={resetClassModal}
                    className="w-full py-2.5 bg-gray-200 hover:bg-gray-100 rounded-xl text-xs font-semibold text-[#344767]"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="sip-card p-6 max-w-sm w-full animate-scale-up">
            <h3 className="text-lg font-bold text-[#344767] mb-4">Create Class Rep</h3>
            <form onSubmit={handleCreateRep} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8392ab] mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newRep.fullName}
                  onChange={(e) => setNewRep(prev => ({ ...prev, fullName: e.target.value }))}
                  className="w-full bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-4 py-3 text-sm text-[#344767] focus:outline-none focus:border-[#344767] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8392ab] mb-1.5">Index Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 10912345"
                  value={newRep.indexNumber}
                  onChange={(e) => setNewRep(prev => ({ ...prev, indexNumber: e.target.value }))}
                  className="w-full bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-4 py-3 text-sm text-[#344767] focus:outline-none focus:border-[#344767] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8392ab] mb-1.5">Username (Login ID)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. johndoe"
                  value={newRep.username}
                  onChange={(e) => setNewRep(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-4 py-3 text-sm text-[#344767] focus:outline-none focus:border-[#344767] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8392ab] mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={newRep.password}
                  onChange={(e) => setNewRep(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-4 py-3 text-sm text-[#344767] focus:outline-none focus:border-[#344767] transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8392ab] mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  required
                  placeholder="Repeat password"
                  value={newRep.confirmPassword}
                  onChange={(e) => setNewRep(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-4 py-3 text-sm text-[#344767] focus:outline-none focus:border-[#344767] transition-colors"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRepModal(false)}
                  className="px-4 py-2.5 bg-[#f8f9fa] border border-[#e9ecef] hover:bg-white rounded-xl text-xs font-semibold text-[#344767] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sip-btn-dark !w-auto px-4 py-2.5 text-xs"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="sip-card p-6 max-w-lg w-full animate-scale-up">
            <h3 className="text-lg font-bold text-[#344767] mb-4">Bulk Upload Class Reps</h3>
            
            <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-xs text-blue-400 font-semibold mb-2">📋 Excel/CSV Format Required:</p>
              <p className="text-xs text-[#8392ab] mb-2">Columns: <span className="font-mono text-blue-400">indexNumber, name, email, programme, level, type, group, session</span></p>
              <p className="text-xs text-[#8392ab]">Example: <span className="font-mono text-[#344767]">10912345, John Doe, john@gctu.edu.gh, BIT, 300, TOP-UP, B, EVENING</span></p>
              <p className="text-xs text-amber-400 mt-2">⚠️ Default password: <span className="font-mono font-bold">rep123</span></p>
            </div>

            <form onSubmit={handleBulkUploadReps} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-[#8392ab] mb-2">Select File</label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setBulkUploadFile(e.target.files[0])}
                  className="w-full bg-[#f0f2f5] border border-gray-200 rounded-xl px-4 py-3 text-[#344767] text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#0c2340] file:text-white hover:file:bg-[#113057] file:cursor-pointer"
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
                  <p className="text-xs font-semibold text-[#344767] mb-2">Upload Results:</p>
                  <p className="text-xs text-[#344767]">✓ Created: {bulkUploadResult.createdCount}</p>
                  <p className="text-xs text-[#344767]">⊘ Skipped: {bulkUploadResult.skippedCount}</p>
                  {bulkUploadResult.errors && bulkUploadResult.errors.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      <p className="text-xs text-amber-400 font-semibold mb-1">Errors:</p>
                      {bulkUploadResult.errors.map((err, idx) => (
                        <p key={idx} className="text-xs text-[#8392ab]">• {err}</p>
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
                  className="px-4 py-2.5 bg-[#f8f9fa] border border-[#e9ecef] hover:bg-white rounded-xl text-xs font-semibold text-[#344767] transition-colors"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="sip-card p-6 max-w-sm w-full animate-scale-up">
            <h3 className="text-lg font-bold text-[#344767] mb-4">Reset Rep Password</h3>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-[#8392ab] mb-1.5">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#f8f9fa] border border-[#e9ecef] rounded-xl px-4 py-3 text-sm text-[#344767] focus:outline-none focus:border-[#344767] transition-colors"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowResetPwdModal(false)}
                  className="px-4 py-2.5 bg-[#f8f9fa] border border-[#e9ecef] hover:bg-white rounded-xl text-xs font-semibold text-[#344767] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sip-btn-dark !w-auto px-4 py-2.5 text-xs"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="sip-card p-6 max-w-sm w-full animate-scale-up">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#344767]">Assign Class Rep</h3>
                <span className="text-xs text-[#0c2340] font-bold">{selectedClassForRep.displayName}</span>
              </div>
              <button
                onClick={() => {
                  setShowAssignRepModal(false);
                  setSelectedClassForRep(null);
                }}
                className="text-[#8392ab] hover:text-[#344767]"
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
                className="w-full bg-[#f0f2f5] border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-[#344767] focus:outline-none focus:border-[#0c2340]"
              />

              <div className="max-h-60 overflow-y-auto space-y-2">
                {reps
                  .filter(r => r.isActive && !r.assignedClass)
                  .filter(r => r.username.toLowerCase().includes(repSearchQuery.toLowerCase()))
                  .map(rep => (
                    <button
                      key={rep.id}
                      onClick={() => handleAssignRep(rep.id)}
                      className="w-full text-left p-3.5 bg-[#f0f2f5] hover:bg-[#0c2340]/5 border border-gray-200 hover:border-[#E5A93C]/50 rounded-xl flex items-center justify-between text-xs text-[#344767] transition"
                    >
                      <span className="font-bold text-[#344767]">{rep.username}</span>
                      <span className="text-[#8392ab] font-bold">Assign →</span>
                    </button>
                  ))}

                {reps.filter(r => r.isActive && !r.assignedClass).length === 0 && (
                  <p className="text-center py-4 text-xs text-[#8392ab] italic">No unassigned active representatives found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW STUDENTS MODAL (MANUAL + BULK IMPORT) */}
      {showStudentsModal && selectedClassForStudents && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="sip-card p-6 max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-scale-up">
            <div className="flex justify-between items-start mb-4 border-b border-gray-200 pb-4">
              <div>
                <h3 className="text-lg font-bold text-[#344767]">Enrollment List</h3>
                <span className="text-xs text-[#0c2340] font-bold">{selectedClassForStudents.displayName}</span>
              </div>
              <button
                onClick={() => {
                  setShowStudentsModal(false);
                  setSelectedClassForStudents(null);
                  setManualStudents([{ name: '', indexNumber: '', email: '' }]);
                  setCsvPreview([]);
                }}
                className="text-[#8392ab] hover:text-[#344767]"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Existing students list */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-[#344767]">Enrolled Students ({classStudents.length})</h4>
                  <div className="flex items-center gap-3">
                    {selectedStudentIds.length > 0 && (
                      <button
                        onClick={handleBulkDeleteStudents}
                        className="bg-red-600 hover:bg-red-500 text-[#344767] text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-2"
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
                      className="bg-[#f0f2f5] border border-gray-200 rounded-xl px-4 py-2 text-xs text-[#344767] focus:outline-none"
                    />
                  </div>
                </div>

                {classStudents.length === 0 ? (
                  <p className="text-xs text-[#8392ab] italic py-6 text-center border border-dashed border-gray-200 rounded-xl">No students registered in this class group.</p>
                ) : (
                  <div className="overflow-hidden border border-gray-200 rounded-xl max-h-60 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#f0f2f5] text-[#8392ab] text-xs font-bold border-b border-gray-200 sticky top-0">
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
                              className="w-4 h-4 rounded border-slate-300 bg-white text-[#0c2340] focus:ring-[#0c2340] focus:ring-offset-white cursor-pointer"
                            />
                          </th>
                          <th className="p-3">Index Number</th>
                          <th className="p-3">Full Name</th>
                          <th className="p-3">Email Address</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {classStudents
                          .filter(s => s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.indexNumber.includes(studentSearch))
                          .map(student => (
                            <tr key={student.id} className={`hover:bg-gray-50 transition-colors ${selectedStudentIds.includes(student.id) ? 'bg-[#0c2340]/5' : 'text-[#344767]'}`}>
                              <td className="p-3">
                                <input
                                  type="checkbox"
                                  checked={selectedStudentIds.includes(student.id)}
                                  onChange={() => handleToggleStudentSelection(student.id)}
                                  className="w-4 h-4 rounded border-slate-300 bg-white text-[#0c2340] focus:ring-[#0c2340] focus:ring-offset-white cursor-pointer"
                                />
                              </td>
                              <td className="p-3 font-mono text-xs text-[#0c2340] font-bold">{student.indexNumber}</td>
                              <td className="p-3 text-xs font-semibold">{student.name}</td>
                              <td className="p-3 text-xs font-semibold text-[#8392ab]">{student.email || 'N/A'}</td>
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
              <div className="border-t border-gray-200 pt-6 space-y-4">
                <div className="flex border-b border-slate-850">
                  <button
                    onClick={() => setStudentAddTab('manual')}
                    className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
                      studentAddTab === 'manual' ? 'border-[#0c2340] text-[#0c2340]' : 'border-transparent text-[#8392ab] hover:text-[#0c2340]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <PencilIcon className="w-3.5 h-3.5" />
                      <span>Manual Entry</span>
                    </span>
                  </button>
                  <button
                    onClick={() => setStudentAddTab('csv')}
                    className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
                      studentAddTab === 'csv' ? 'border-[#0c2340] text-[#0c2340]' : 'border-transparent text-[#8392ab] hover:text-[#0c2340]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <FolderIcon className="w-3.5 h-3.5" />
                      <span>Bulk Import (CSV/Excel/PDF)</span>
                    </span>
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
                              className="w-full bg-[#f0f2f5] border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#344767]"
                            />
                          </div>
                          <div className="col-span-4">
                            <input
                              type="text"
                              required
                              placeholder="Full Name"
                              value={s.name}
                              onChange={(e) => handleManualStudentChange(idx, 'name', e.target.value)}
                              className="w-full bg-[#f0f2f5] border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#344767]"
                            />
                          </div>
                          <div className="col-span-4">
                            <input
                              type="email"
                              placeholder="Email (Optional)"
                              value={s.email}
                              onChange={(e) => handleManualStudentChange(idx, 'email', e.target.value)}
                              className="w-full bg-[#f0f2f5] border border-gray-200 rounded-xl px-3 py-2 text-xs text-[#344767]"
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
                        className="text-xs text-[#E5A93C] hover:text-[#c48e2c] font-bold"
                      >
                        + Add Another Student Row
                      </button>
                      <button
                        onClick={handleSaveManualStudents}
                        className="bg-[#0c2340] hover:bg-[#113057] text-white text-xs font-bold px-4 py-2 rounded-xl transition"
                      >
                        Enroll Selected Students
                      </button>
                    </div>
                  </div>
                )}

                {/* CSV upload tab */}
                {studentAddTab === 'csv' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs text-[#8392ab]">
                      <span>Import student database using CSV (.csv), Excel (.xlsx, .xls) or PDF (.pdf) files.</span>
                      <a
                        href="/students_template.csv"
                        download
                        className="text-[#E5A93C] hover:underline font-semibold"
                      >
                        Download CSV Template
                      </a>
                    </div>

                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleCsvFileDrop}
                      className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-[#f0f2f5] hover:border-[#E5A93C]/50 transition cursor-pointer"
                    >
                      <input
                        type="file"
                        onChange={handleCsvFileDrop}
                        accept=".csv,.xlsx,.xls,.pdf"
                        className="hidden"
                        id="csv-file-selector"
                      />
                      <label htmlFor="csv-file-selector" className="cursor-pointer">
                        <span className="block text-[#344767] font-bold text-sm">Drag and drop file here, or click to browse</span>
                        <span className="block text-[10px] text-[#8392ab] mt-1">Supports CSV, Excel sheets, and class registers in PDF format</span>
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
                        <div className="overflow-hidden border border-gray-200 rounded-xl max-h-40 overflow-y-auto">
                          <table className="w-full text-left border-collapse">
                            <tbody className="divide-y divide-gray-200 text-[#344767]">
                              {csvPreview.slice(0, 10).map((row, i) => (
                                <tr key={i} className="text-xs bg-[#f8f9fa]">
                                  <td className="p-2 font-mono">{row.indexNumber}</td>
                                  <td className="p-2">{row.name}</td>
                                  <td className="p-2 text-[#8392ab]">{row.email}</td>
                                </tr>
                              ))}
                              {csvPreview.length > 10 && (
                                <tr>
                                  <td colSpan="3" className="p-2 text-center text-[#8392ab] text-[10px] italic">...and {csvPreview.length - 10} more rows</td>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="sip-card p-6 max-w-md w-full animate-scale-up">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#344767]">Linked Class Courses</h3>
                <span className="text-xs text-[#0c2340] font-bold">{selectedClassForCourses.displayName}</span>
              </div>
              <button
                onClick={() => {
                  setShowClassCoursesModal(false);
                  setSelectedClassForCourses(null);
                  setClassCourses([]);
                }}
                className="text-[#8392ab] hover:text-[#344767]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Linked courses */}
              <div className="space-y-2">
                <span className="text-[10px] text-[#8392ab] font-bold block uppercase tracking-wider">Currently Linked</span>
                {classCourses.length === 0 ? (
                  <p className="text-xs text-[#8392ab] italic py-2">No courses linked to this class group yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {classCourses.map(cc => (
                      <div key={cc.id} className="flex justify-between items-center p-2.5 bg-[#f0f2f5] rounded-lg border border-gray-200 text-xs">
                        <span className="text-[#344767] font-semibold">{cc.name} ({cc.code})</span>
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
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <span className="text-[10px] text-[#8392ab] font-bold block uppercase tracking-wider">Link Available Course</span>
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {courses
                    .filter(c => !classCourses.some(cc => cc.courseId === c.id))
                    .map(course => (
                      <button
                        key={course.id}
                        onClick={() => handleLinkCourseToClass(course.id)}
                        className="w-full text-left p-3.5 bg-[#f0f2f5] hover:bg-[#0c2340]/5 border border-gray-200 hover:border-[#E5A93C]/50 rounded-xl flex items-center justify-between text-xs text-[#344767] transition"
                      >
                        <span className="font-bold text-[#344767]">{course.name} ({course.code})</span>
                        <span className="text-[#8392ab] font-bold">Link +</span>
                      </button>
                    ))}

                  {courses.filter(c => !classCourses.some(cc => cc.courseId === c.id)).length === 0 && (
                    <p className="text-center py-2 text-xs text-[#8392ab] italic">All database courses are linked.</p>
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
