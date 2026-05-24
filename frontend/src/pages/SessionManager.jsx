import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import AttendanceTable from '../components/AttendanceTable';
import SignatureCanvas from '../components/SignatureCanvas';
import { useToast } from '../components/ToastProvider';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';

// Report Generation Imports
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const SessionManager = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const { deptName, deptLogo } = auth;

  const [session, setSession] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [qrImage, setQrImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(25);
  const [activePanelTab, setActivePanelTab] = useState('logs'); // 'logs' | 'security'
  
  // Confirm modal state
  const [confirmState, setConfirmState] = useState({ open: false, message: '', onConfirm: null });

  // Signature state
  const [signature, setSignature] = useState('');
  const [approving, setApproving] = useState(false);

  // Poll timers
  const pollTimerRef = useRef(null);
  // Countdown interval ref — holds the single interval ID to prevent stacking
  const countdownRef = useRef(null);

  const fetchSessionDetails = async () => {
    try {
      const response = await api.get(`/sessions/${id}`);
      setSession(response.data);
      setAttendances(response.data.attendances || []);
      
      if (response.data.qrCodeImage && !qrImage) {
        setQrImage(response.data.qrCodeImage);
      }
    } catch (err) {
      console.error('Fetch session details error:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to load session details');
    } finally {
      setLoading(false);
    }
  };

  const refreshQR = async () => {
    try {
      const response = await api.post(`/sessions/${id}/refresh-qr`);
      setQrImage(response.data.qrCodeImage);
      setCountdown(25);
    } catch (err) {
      console.error('Refresh QR error:', err);
    }
  };

  useEffect(() => {
    fetchSessionDetails();
    
    // Start polling every 10 seconds for attendance logs
    pollTimerRef.current = setInterval(fetchSessionDetails, 10000);

    return () => {
      clearInterval(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    // Clear any existing countdown interval
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    // Only start countdown when session is OPEN
    if (session?.status === 'OPEN') {
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            refreshQR();
            return 25;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, session?.id]);

  const handleUpdateStatus = async (attendanceId, newStatus) => {
    try {
      await api.patch(`/attendance/${attendanceId}/status`, { status: newStatus });
      fetchSessionDetails();
    } catch (err) {
      console.error('Update status error:', err);
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleCloseSession = () => {
    setConfirmState({
      open: true,
      message: 'Are you sure you want to close this attendance session? This will lock check-ins and auto-mark absent students.',
      onConfirm: async () => {
        setConfirmState({ open: false, message: '', onConfirm: null });
        try {
          await api.patch(`/sessions/${id}/close`);
          toast.info('Session closed. All absent students have been marked.', 'Session Closed');
          fetchSessionDetails();
        } catch (err) {
          console.error('Close session error:', err);
          toast.error(err.response?.data?.error || 'Failed to close session');
        }
      }
    });
  };

  const handleApproveSession = async () => {
    if (!signature) {
      toast.warning('Please provide your signature on the pad before approving.', 'Signature Required');
      return;
    }

    setApproving(true);
    try {
      await api.patch(`/sessions/${id}/approve`, {
        lecturerSignature: signature
      });
      toast.success('Session approved and signed successfully!', 'Approved!');
      fetchSessionDetails();
    } catch (err) {
      console.error('Approve session error:', err);
      toast.error(err.response?.data?.error || 'Failed to approve session');
    } finally {
      setApproving(false);
    }
  };

  // Stats Count Helper
  const presentCount = attendances.filter(a => a.status === 'PRESENT').length;
  const lateCount = attendances.filter(a => a.status === 'LATE').length;
  const absentCount = attendances.filter(a => a.status === 'ABSENT').length;

  // Anti-Cheat & Proxy Calculations
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLambda / 2) *
        Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const ipCounts = {};
  const fpCounts = {};

  attendances.forEach((att) => {
    if (att.status !== 'ABSENT') {
      if (att.ipAddress) {
        ipCounts[att.ipAddress] = (ipCounts[att.ipAddress] || 0) + 1;
      }
      if (att.student?.deviceFingerprint) {
        const fp = att.student.deviceFingerprint;
        fpCounts[fp] = (fpCounts[fp] || 0) + 1;
      }
    }
  });

  const securityAlerts = [];
  attendances.forEach((att) => {
    if (att.status === 'ABSENT') return;

    const alerts = [];
    
    // IP Duplication check
    if (att.ipAddress && ipCounts[att.ipAddress] > 1) {
      alerts.push({
        type: 'IP',
        message: `Shared IP Address: ${att.ipAddress} (${ipCounts[att.ipAddress]} students)`,
        severity: 'MEDIUM'
      });
    }

    // Fingerprint Duplication check
    const fp = att.student?.deviceFingerprint;
    if (fp && fpCounts[fp] > 1) {
      alerts.push({
        type: 'FINGERPRINT',
        message: `Device canvas profile matches other students (Potential Proxy)`,
        severity: 'HIGH'
      });
    }

    // Location / Geofencing Check
    if (session?.latitude !== null && session?.longitude !== null && att.locationData) {
      try {
        const coords = JSON.parse(att.locationData);
        if (coords.latitude && coords.longitude) {
          const dist = getDistance(session.latitude, session.longitude, coords.latitude, coords.longitude);
          if (dist > 100) {
            alerts.push({
              type: 'LOCATION',
              message: `Distance Outlier: Checked in ${Math.round(dist)}m away (Limit: 100m)`,
              severity: 'HIGH',
              meta: { distance: dist }
            });
          }
        }
      } catch (err) {
        console.warn('GPS location parsing error:', err);
      }
    }

    if (alerts.length > 0) {
      securityAlerts.push({
        attendance: att,
        alerts
      });
    }
  });

  // REPORT GENERATION & EXPORT LOGIC
  const handleGenerateReport = () => {
    if (!session) return;

    // Check if custom template exists
    const templateBase64 = localStorage.getItem('report_template');
    const templateName = localStorage.getItem('report_template_name');
    const templateType = localStorage.getItem('report_template_type');

    if (templateBase64 && templateType) {
      try {
        if (templateType === 'csv') {
          generateCSVFromTemplate(templateBase64);
        } else if (templateType === 'xlsx') {
          generateXLSXFromTemplate(templateBase64);
        } else if (templateType === 'docx' || templateType === 'pdf') {
          // Generate PDF report mirroring layout with a tag
          generateDefaultPDF(true, templateName);
        } else {
          generateDefaultPDF(false);
        }
      } catch (err) {
        console.error('Error generating report with template, falling back to default:', err);
        generateDefaultPDF(false);
      }
    } else {
      generateDefaultPDF(false);
    }
  };

  const generateCSVFromTemplate = (templateBase64) => {
    const csvContent = atob(templateBase64.split(',')[1]);
    const headers = csvContent.split('\n')[0].split(',');
    
    // Map data to match template headers
    const rowData = attendances.map(att => {
      return headers.map(h => {
        const headerLower = h.toLowerCase().trim();
        if (headerLower.includes('name')) return att.student?.name || 'N/A';
        if (headerLower.includes('index') || headerLower.includes('number')) return att.student?.indexNumber || 'N/A';
        if (headerLower.includes('status')) return att.status;
        if (headerLower.includes('time') || headerLower.includes('date')) return att.status === 'ABSENT' ? '-' : new Date(att.checkInTime).toLocaleTimeString();
        return '';
      }).join(',');
    });

    const finalCSV = [headers.join(','), ...rowData].join('\n');
    const blob = new Blob([finalCSV], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Attendance_Report_${session.course.code}_Template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateXLSXFromTemplate = (templateBase64) => {
    const workbook = XLSX.read(templateBase64.split(',')[1], { type: 'base64' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const headers = json[0] || ["Name", "Index Number", "Status", "Check-in Time"];

    const newRows = attendances.map(att => {
      const row = {};
      headers.forEach(h => {
        const headerLower = String(h).toLowerCase().trim();
        if (headerLower.includes('name')) row[h] = att.student?.name || 'N/A';
        else if (headerLower.includes('index') || headerLower.includes('number')) row[h] = att.student?.indexNumber || 'N/A';
        else if (headerLower.includes('status')) row[h] = att.status;
        else if (headerLower.includes('time') || headerLower.includes('date')) row[h] = att.status === 'ABSENT' ? '-' : new Date(att.checkInTime).toLocaleTimeString();
        else row[h] = '';
      });
      return row;
    });

    const newSheet = XLSX.utils.json_to_sheet(newRows, { header: headers });
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Attendance");
    XLSX.writeFile(newWorkbook, `Attendance_Report_${session.course.code}_Template.xlsx`);
  };

  const generateDefaultPDF = (hasTemplate = false, templateRefName = '') => {
    const doc = new jsPDF();
    
    // Draw Top Header Banner
    doc.setFillColor(0, 18, 44); // GCTU Navy Blue
    doc.rect(0, 0, 220, 35, 'F');
    
    // Gold Accent Line
    doc.setFillColor(212, 160, 23); // GCTU Gold
    doc.rect(0, 35, 220, 2, 'F');

    // Header Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("GHANA COMMUNICATION TECHNOLOGY UNIVERSITY", 14, 18);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(212, 160, 23);
    doc.text("OFFICIAL ATTENDANCE REGISTER SHEET", 14, 26);
    
    // Session Info Metadata
    doc.setFontSize(9);
    doc.setTextColor(50);
    
    doc.setFont('helvetica', 'bold');
    doc.text(`Course:`, 14, 48);
    doc.setFont('helvetica', 'normal');
    doc.text(`${session.course.name} (${session.course.code})`, 32, 48);

    doc.setFont('helvetica', 'bold');
    doc.text(`Type:`, 14, 54);
    doc.setFont('helvetica', 'normal');
    doc.text(`${session.sessionType}`, 32, 54);

    doc.setFont('helvetica', 'bold');
    doc.text(`Date/Time:`, 110, 48);
    doc.setFont('helvetica', 'normal');
    doc.text(`${new Date(session.startTime).toLocaleDateString()} ${new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 132, 48);

    doc.setFont('helvetica', 'bold');
    doc.text(`Status:`, 110, 54);
    doc.setFont('helvetica', 'normal');
    doc.text(`${session.status}`, 132, 54);

    // Stats Grid border box
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 62, 182, 14, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.rect(14, 62, 182, 14);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(`Present:`, 20, 71);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(34, 197, 94); // green-500
    doc.text(`${presentCount}`, 38, 71);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Late:`, 80, 71);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(245, 158, 11); // amber-500
    doc.text(`${lateCount}`, 92, 71);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Absent:`, 140, 71);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(239, 68, 68); // red-500
    doc.text(`${absentCount}`, 155, 71);

    // Table Data
    const tableColumn = ["Student Name", "Index Number", "Status", "Check-in Time", "Verification Signature"];
    const tableRows = attendances.map(att => [
      att.student?.name || 'N/A',
      att.student?.indexNumber || 'N/A',
      att.status,
      att.status === 'ABSENT' ? '-' : new Date(att.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      att.status === 'ABSENT' ? '-' : `Verified IP: ${att.ipAddress || '127.0.0.1'}`
    ]);

    autoTable(doc, {
      startY: 84,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [0, 18, 44], textColor: [255, 255, 255] },
      styles: { fontSize: 8.5 }
    });

    let finalY = doc.lastAutoTable.finalY + 15;

    // Signature Pad Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("Lecturer Approval & Digital Sign-off", 14, finalY);

    if (session.lecturerSignature) {
      try {
        doc.addImage(session.lecturerSignature, 'PNG', 14, finalY + 4, 50, 16);
      } catch (e) {
        console.error('PDF Sig add error:', e);
      }
    } else {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(14, finalY + 18, 64, finalY + 18);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("Pending Signature", 14, finalY + 10);
    }

    // Approved Stamp
    if (session.status === 'APPROVED') {
      doc.setDrawColor(34, 197, 94);
      doc.setLineWidth(1.5);
      doc.rect(130, finalY + 2, 50, 18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 197, 94);
      doc.setFontSize(13);
      doc.text("APPROVED", 142, finalY + 14);
    }

    if (hasTemplate) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Generated using your department template (Reference: ${templateRefName})`, 14, finalY + 28);
    }

    doc.save(`GCTU_Register_${session.course.code}_${session.id.substring(0, 6)}.pdf`);
  };

  const generateGctuExcel = () => {
    const headers = [
      ["GHANA COMMUNICATION TECHNOLOGY UNIVERSITY (GCTU)"],
      ["OFFICIAL CLASS ATTENDANCE REGISTER"],
      [`Course: ${session.course.name} (${session.course.code})`],
      [`Date: ${new Date(session.startTime).toLocaleDateString()} ${new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`],
      [`Session Type: ${session.sessionType}`],
      [],
      ["Index Number", "Full Name", "Email", "Status", "Check-in Time", "Verification Signature (IP Address)"]
    ];
    
    const rows = attendances.map(att => [
      att.student?.indexNumber || 'N/A',
      att.student?.name || 'N/A',
      att.student?.email || 'N/A',
      att.status,
      att.status === 'ABSENT' ? '-' : new Date(att.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      att.status === 'ABSENT' ? '-' : `Verified IP: ${att.ipAddress || '127.0.0.1'}`
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([...headers, ...rows]);
    
    // Auto-fit column widths
    const maxNameLen = Math.max(...rows.map(r => r[1].length), 15);
    worksheet['!cols'] = [
      { wch: 15 }, // Index Number
      { wch: maxNameLen }, // Full Name
      { wch: 25 }, // Email
      { wch: 12 }, // Status
      { wch: 15 }, // Check-in Time
      { wch: 30 }  // Verification Signature
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "GCTU Register");
    XLSX.writeFile(workbook, `GCTU_Attendance_${session.course.code}_${new Date(session.startTime).toISOString().slice(0, 10)}.xlsx`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col justify-center items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-[#E5A93C] border-t-transparent animate-spin" />
        <p className="text-sm text-[#8392ab] font-semibold">Loading session…</p>
      </div>
    );
  }

  if (errorMsg || !session) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col justify-center items-center p-6 text-center">
        <div className="sip-card p-8 max-w-sm w-full animate-scale-up">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-[#344767] mb-1">Session Error</h3>
          <p className="text-sm text-[#8392ab] mb-5">{errorMsg || 'Session not found'}</p>
          <button onClick={() => navigate('/rep/dashboard')} className="sip-btn-dark">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const totalCheckedIn = presentCount + lateCount;
  const totalStudents = attendances.length || 1;
  const attendanceRate = Math.round((totalCheckedIn / totalStudents) * 100);

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#344767]">
      {/* ── Top Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => navigate('/rep/dashboard')}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#8392ab] hover:text-[#E5A93C] transition-colors shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Dashboard
            </button>
            <span className="text-[#e9ecef]">/</span>
            <span className="text-xs font-bold text-[#344767] truncate">
              {session.course.code} — {session.course.name}
            </span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`badge ${
              session.status === 'OPEN'     ? 'badge-success' :
              session.status === 'APPROVED' ? 'badge-info' :
              'badge-warning'
            } ${session.status === 'OPEN' ? 'animate-pulse' : ''}`}>
              {session.status}
            </span>

            {(session.status === 'CLOSED' || session.status === 'APPROVED') && (
              <>
                <button
                  onClick={handleGenerateReport}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-[#344767] hover:bg-[#f8f9fa] transition-all"
                >
                  <svg className="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  PDF
                </button>
                <button
                  onClick={generateGctuExcel}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-[#344767] hover:bg-[#f8f9fa] transition-all"
                >
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Excel
                </button>
              </>
            )}

            {session.status === 'OPEN' && (
              <button
                onClick={handleCloseSession}
                className="px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-semibold text-xs transition-all"
              >
                Close Session
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Present', value: presentCount, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'Late',    value: lateCount,    color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
            { label: 'Absent',  value: absentCount,  color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-100' },
            { label: 'Rate',    value: `${attendanceRate}%`, color: 'text-[#0c2340]', bg: 'bg-slate-50', border: 'border-slate-200' },
          ].map((s, i) => (
            <div
              key={i}
              className={`${s.bg} ${s.border} border rounded-2xl p-4 text-center animate-fade-in-up`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className={`block text-2xl font-black ${s.color}`}>{s.value}</span>
              <span className="text-[11px] font-semibold text-[#8392ab] uppercase tracking-wider mt-0.5 block">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left Panel ───────────────────────────────────────────── */}
          <div className="space-y-5">
            {/* Live QR */}
            {session.status === 'OPEN' && (
              <div className="sip-card p-5 text-center animate-fade-in-up">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-[#344767] uppercase tracking-wider">Live QR Code</h3>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    LIVE
                  </span>
                </div>

                <div className="bg-[#f8f9fa] p-3 rounded-xl inline-block mb-3">
                  {qrImage ? (
                    <img src={qrImage} alt="Live QR Code" className="w-52 h-52 object-contain" />
                  ) : (
                    <div className="w-52 h-52 flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-[#E5A93C] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Countdown ring */}
                <div className="flex items-center justify-center gap-2 bg-[#f0f2f5] rounded-xl py-2 px-4 w-fit mx-auto mb-3">
                  <svg className="w-4 h-4 text-[#E5A93C] -rotate-90 animate-spin-slow" viewBox="0 0 36 36" fill="none">
                    <circle cx="18" cy="18" r="15" stroke="#e9ecef" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15" stroke="#E5A93C" strokeWidth="3" strokeDasharray="94" strokeDashoffset={94 - (94 * countdown / 25)} strokeLinecap="round" />
                  </svg>
                  <span className="text-xs font-bold text-[#344767]">
                    Rotates in <span className="font-mono text-[#E5A93C]">{countdown}s</span>
                  </span>
                </div>

                <p className="text-[11px] text-[#8392ab] leading-relaxed">
                  QR refreshes every 25 s. Screenshots will fail validation.
                </p>
              </div>
            )}

            {/* Session Info */}
            <div className="sip-card p-5 animate-fade-in-up delay-100">
              <h3 className="text-xs font-bold text-[#344767] uppercase tracking-wider mb-4">Session Details</h3>
              <div className="space-y-3">
                {[
                  { label: 'Course',       value: `${session.course.name} (${session.course.code})` },
                  { label: 'Type',         value: session.sessionType },
                  { label: 'Start Time',   value: new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
                  { label: 'Date',         value: new Date(session.startTime).toLocaleDateString() },
                  ...(session.networkSSID ? [{ label: 'Wi-Fi SSID', value: session.networkSSID }] : []),
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-start gap-2">
                    <span className="text-[11px] text-[#8392ab] shrink-0">{item.label}</span>
                    <span className="text-[12px] font-semibold text-[#344767] text-right">{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Attendance progress bar */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-[#8392ab] font-bold uppercase tracking-wider">Attendance Rate</span>
                  <span className="text-xs font-black text-[#E5A93C]">{attendanceRate}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#f0f2f5] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${attendanceRate}%`, background: 'linear-gradient(90deg,#0c2340,#1a3c6d)' }}
                  />
                </div>
              </div>
            </div>

            {/* Lecturer Approval */}
            {session.status === 'CLOSED' && (
              <div className="sip-card p-5 animate-fade-in-up delay-200">
                <h3 className="text-xs font-bold text-[#344767] uppercase tracking-wider mb-4">Approval Required</h3>
                <SignatureCanvas onSave={setSignature} label="Class Rep Sign-off" />
                <button
                  onClick={handleApproveSession}
                  disabled={approving || !signature}
                  className="sip-btn-dark mt-4 flex items-center justify-center gap-2"
                >
                  {approving ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Approve & Sign Class
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Approved badge */}
            {session.status === 'APPROVED' && (
              <div className="sip-card p-5 border border-emerald-100 animate-scale-up">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-600">Approved by Lecturer</p>
                    <p className="text-[10px] text-[#8392ab]">{new Date(session.approvedAt).toLocaleString()}</p>
                  </div>
                </div>
                {session.lecturerSignature && (
                  <div className="bg-[#f8f9fa] rounded-xl p-3 border border-gray-100">
                    <img src={session.lecturerSignature} alt="Signature" className="h-14 object-contain mx-auto" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Right Panel: Attendance List ─────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="sip-card p-5 min-h-[400px] flex flex-col animate-fade-in-up delay-100">
              {/* Tabs */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
                <div className="flex gap-1">
                  <button
                    onClick={() => setActivePanelTab('logs')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                      activePanelTab === 'logs'
                        ? 'bg-[#344767] text-white shadow-sm'
                        : 'text-[#8392ab] hover:text-[#344767] hover:bg-[#f0f2f5]'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Register ({attendances.length})
                  </button>
                  <button
                    onClick={() => setActivePanelTab('security')}
                    className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                      activePanelTab === 'security'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-[#8392ab] hover:text-[#344767] hover:bg-[#f0f2f5]'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Anti-Cheat
                    {securityAlerts.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
                        {securityAlerts.length}
                      </span>
                    )}
                  </button>
                </div>
                <span className="text-[11px] text-[#8392ab]">
                  Auto-refreshes every 10s
                </span>
              </div>

              {/* Attendance Register */}
              {activePanelTab === 'logs' && (
                <div className="flex-1 overflow-auto">
                  <AttendanceTable attendances={attendances} />
                </div>
              )}

              {/* Anti-Cheat Shield */}
              {activePanelTab === 'security' && (
                <div className="space-y-4 flex-1">
                  <div className="flex items-center justify-between p-3.5 bg-rose-50 border border-rose-100 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-rose-100 text-rose-500 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#344767]">Proxy & Fraud Detection</p>
                        <p className="text-[10px] text-[#8392ab]">IP, GPS, device fingerprint analysis</p>
                      </div>
                    </div>
                    <span className="badge badge-danger">{securityAlerts.length} Flagged</span>
                  </div>

                  {securityAlerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-[#344767]">All Clear</p>
                      <p className="text-xs text-[#8392ab] mt-1 max-w-xs">Every check-in meets unique IP, device token, and geofencing criteria</p>
                    </div>
                  ) : (
                    <div className="overflow-auto rounded-xl">
                      <table className="sip-table">
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Flag Reason</th>
                            <th className="text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {securityAlerts.map(({ attendance, alerts }) => (
                            <tr key={attendance.id}>
                              <td>
                                <p className="font-semibold text-[#344767] text-[12px]">{attendance.student?.name || 'N/A'}</p>
                                <p className="font-mono text-[10px] text-[#8392ab]">{attendance.student?.indexNumber || 'N/A'}</p>
                              </td>
                              <td className="space-y-1 max-w-[240px]">
                                {alerts.map((alert, idx) => (
                                  <div key={idx} className="flex items-start gap-1.5">
                                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${alert.severity === 'HIGH' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                                    <span className="text-[11px] text-[#8392ab]">{alert.message}</span>
                                  </div>
                                ))}
                              </td>
                              <td className="text-center">
                                {attendance.status !== 'ABSENT' ? (
                                  <button
                                    onClick={() => handleUpdateStatus(attendance.id, 'ABSENT')}
                                    className="px-2.5 py-1 text-[10px] font-bold badge badge-danger cursor-pointer hover:opacity-80 transition-opacity"
                                  >
                                    Mark Absent
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleUpdateStatus(attendance.id, 'PRESENT')}
                                    className="px-2.5 py-1 text-[10px] font-bold badge badge-success cursor-pointer hover:opacity-80 transition-opacity"
                                  >
                                    Mark Present
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {confirmState.open && (
        <ConfirmModal
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState({ open: false, message: '', onConfirm: null })}
        />
      )}
    </div>
  );
};

export default SessionManager;
