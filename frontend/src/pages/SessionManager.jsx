import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import AttendanceTable from '../components/AttendanceTable';
import SignatureCanvas from '../components/SignatureCanvas';

// Report Generation Imports
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

const SessionManager = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [qrImage, setQrImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(25);
  const [activePanelTab, setActivePanelTab] = useState('logs'); // 'logs' | 'security'
  
  // Custom Branding
  const deptName = localStorage.getItem('dept_name') || 'Class Attendance System';
  const deptLogo = localStorage.getItem('dept_logo') || '/logo.svg';

  // Signature state
  const [signature, setSignature] = useState('');
  const [approving, setApproving] = useState(false);

  // Poll timers
  const pollTimerRef = useRef(null);

  useEffect(() => {
    fetchSessionDetails();
    
    // Start polling every 10 seconds for attendance logs
    pollTimerRef.current = setInterval(fetchSessionDetails, 10000);

    return () => {
      clearInterval(pollTimerRef.current);
    };
  }, [id]);

  useEffect(() => {
    let interval = null;
    if (session && session.status === 'OPEN') {
      interval = setInterval(() => {
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
      if (interval) clearInterval(interval);
    };
  }, [session]);

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
      setErrorMsg('Failed to load session details');
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

  const handleUpdateStatus = async (attendanceId, newStatus) => {
    try {
      await api.patch(`/attendance/${attendanceId}/status`, { status: newStatus });
      fetchSessionDetails();
    } catch (err) {
      console.error('Update status error:', err);
      alert(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleCloseSession = async () => {
    if (!window.confirm('Are you sure you want to close this attendance session? This will lock check-ins and auto-mark absent students.')) {
      return;
    }

    try {
      await api.patch(`/sessions/${id}/close`);
      fetchSessionDetails();
    } catch (err) {
      console.error('Close session error:', err);
      alert(err.response?.data?.error || 'Failed to close session');
    }
  };

  const handleApproveSession = async () => {
    if (!signature) {
      alert('Please provide your signature on the pad before approving.');
      return;
    }

    setApproving(true);
    try {
      await api.patch(`/sessions/${id}/approve`, {
        lecturerSignature: signature
      });
      alert('Session approved successfully!');
      fetchSessionDetails();
    } catch (err) {
      console.error('Approve session error:', err);
      alert(err.response?.data?.error || 'Failed to approve session');
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
      } catch (e) {}
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

    doc.autoTable({
      startY: 84,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [0, 18, 44], textColor: [255, 255, 255] },
      styles: { fontSize: 8.5 }
    });

    let finalY = doc.previousAutoTable.finalY + 15;

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
      <div className="min-h-screen bg-[#00122c] text-slate-100 flex justify-center items-center">
        <div className="w-8 h-8 border-2 border-[#D4A017] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (errorMsg || !session) {
    return (
      <div className="min-h-screen bg-[#00122c] text-slate-100 flex flex-col justify-center items-center p-6 text-center">
        <div className="bg-[#001c44]/60 border border-[#002a63] p-6 rounded-2xl max-w-sm">
          <p className="text-rose-400 mb-4">{errorMsg || 'Session not found'}</p>
          <button onClick={() => navigate('/rep/dashboard')} className="bg-[#D4A017] text-slate-950 font-bold px-4 py-2 rounded-lg">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#00122c] text-slate-100 p-6 relative overflow-hidden">
      {/* Background logo watermark */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none flex items-center justify-center">
        <img src="/logo.jfif" alt="GCTU Crest Watermark" className="w-[450px] h-[450px] object-contain filter grayscale" />
      </div>

      <div className="absolute top-[-30%] left-[-10%] w-[70%] h-[70%] rounded-full bg-[#D4A017]/5 blur-[150px] pointer-events-none"></div>

      {/* Header */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8 pb-4 border-b border-[#002a63] relative z-10">
        <div className="flex items-center gap-3">
          <img src={deptLogo} alt="Logo" className="w-12 h-12 object-contain bg-[#000a18]/40 rounded-xl p-1 border border-[#002a63]" />
          <div>
            <button
              onClick={() => navigate('/rep/dashboard')}
              className="text-xs text-[#D4A017] hover:text-[#b88a14] font-semibold mb-1.5 inline-flex items-center gap-1.5 transition-colors"
            >
              ← Back to {deptName}
            </button>
            <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2.5">
              {session.course.name} ({session.course.code})
              <span className={`text-xs px-2.5 py-0.5 rounded-full border uppercase ${
                session.status === 'OPEN' ? 'bg-[#D4A017]/10 text-[#D4A017] border-[#D4A017]/20 animate-pulse' :
                session.status === 'CLOSED' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                'bg-blue-500/10 text-blue-400 border-blue-500/20'
              }`}>
                {session.status}
              </span>
            </h1>
          </div>
        </div>
        
        <div className="flex gap-3">
          {(session.status === 'CLOSED' || session.status === 'APPROVED') && (
            <>
              <button
                onClick={handleGenerateReport}
                className="bg-[#003B8E] hover:bg-[#002a63] text-white font-bold px-4 py-2.5 rounded-xl border border-[#002a63] transition-all text-xs flex items-center gap-1.5 shadow-lg shadow-[#003b8e]/10"
              >
                <svg className="w-4 h-4 text-[#D4A017]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PDF Report
              </button>
              <button
                onClick={generateGctuExcel}
                className="bg-[#D4A017] hover:bg-[#b88a14] text-slate-950 font-bold px-4 py-2.5 rounded-xl transition-all text-xs flex items-center gap-1.5 shadow-lg shadow-[#D4A017]/10"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel Sheet
              </button>
            </>
          )}

          {session.status === 'OPEN' && (
            <button
              onClick={handleCloseSession}
              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold px-5 py-2.5 rounded-xl border border-rose-500/20 transition-all text-sm"
            >
              Close Session
            </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        {/* Left Side: Live QR and Session Stats */}
        <div className="lg:col-span-1 space-y-6">
          {session.status === 'OPEN' && (
            <div className="bg-[#001c44]/60 backdrop-blur-xl border border-[#002a63] p-6 rounded-2xl shadow-xl text-center">
              <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wide">Live Check-in QR Code</h3>
              
              <div className="bg-white p-4 rounded-xl inline-block shadow-inner mb-4 relative group">
                {qrImage ? (
                  <img src={qrImage} alt="Live QR Code" className="w-56 h-56 object-contain" />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center bg-slate-100 rounded-lg">
                    <div className="w-6 h-6 border-2 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>

              {/* Dynamic countdown badge */}
              <div className="flex items-center justify-center gap-2 mb-3 bg-[#001432]/60 border border-[#002a63] py-2 px-4 rounded-xl w-fit mx-auto shadow-inner">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4A017] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4A017]"></span>
                </span>
                <span className="text-xs font-bold text-slate-200">
                  Auto-rotating in <span className="text-[#D4A017] font-mono">{countdown}s</span>
                </span>
              </div>
              
              <p className="text-xs text-slate-400 px-4">
                This QR Code secures attendance by refreshing every 25 seconds. Screenshots will fail checks.
              </p>
            </div>
          )}

          {/* Quick Stats Grid */}
          <div className="bg-[#001c44]/60 backdrop-blur-xl border border-[#002a63] p-6 rounded-2xl shadow-xl">
            <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wide">Session Statistics</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-[#000a18]/40 border border-[#002a63]/80 rounded-xl">
                <span className="block text-xl font-bold text-[#D4A017] font-mono">{presentCount}</span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Present</span>
              </div>
              <div className="p-3 bg-[#000a18]/40 border border-[#002a63]/80 rounded-xl">
                <span className="block text-xl font-bold text-amber-400 font-mono">{lateCount}</span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Late</span>
              </div>
              <div className="p-3 bg-[#000a18]/40 border border-[#002a63]/80 rounded-xl">
                <span className="block text-xl font-bold text-rose-400 font-mono">{absentCount}</span>
                <span className="text-[10px] text-slate-500 font-semibold uppercase">Absent</span>
              </div>
            </div>

            <div className="border-t border-[#002a63] mt-6 pt-4 space-y-2 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Session Type:</span>
                <span className="font-semibold text-slate-200 uppercase">{session.sessionType}</span>
              </div>
              <div className="flex justify-between">
                <span>Start Time:</span>
                <span className="font-semibold text-slate-200">
                  {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {session.networkSSID && (
                <div className="flex justify-between">
                  <span>Target Wi-Fi SSID:</span>
                  <span className="font-semibold text-[#D4A017]">{session.networkSSID}</span>
                </div>
              )}
            </div>
          </div>

          {/* LECTURER SIGN-OFF AND APPROVAL */}
          {session.status === 'CLOSED' && (
            <div className="bg-[#001c44]/60 backdrop-blur-xl border border-[#002a63] p-6 rounded-2xl shadow-xl space-y-6">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Lecturer Approval Required</h3>
              
              <SignatureCanvas onSave={setSignature} />

              <button
                onClick={handleApproveSession}
                disabled={approving || !signature}
                className="w-full bg-[#D4A017] hover:bg-[#b88a14] disabled:bg-[#000a18] disabled:text-slate-500 active:scale-[0.98] text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
              >
                {approving ? (
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Approve & Sign Class'
                )}
              </button>
            </div>
          )}

          {session.status === 'APPROVED' && (
            <div className="bg-[#001c44]/60 backdrop-blur-xl border border-emerald-500/20 p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold uppercase tracking-wide">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Approved by Lecturer
              </div>
              {session.lecturerSignature && (
                <div className="border border-slate-800 rounded-lg p-2 bg-slate-950/40">
                  <img src={session.lecturerSignature} alt="Lecturer Signature" className="h-16 object-contain mx-auto" />
                </div>
              )}
              <div className="text-xs text-slate-400">
                Approved At: {new Date(session.approvedAt).toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Real-time Attendance List */}
        <div className="lg:col-span-2">
          <div className="bg-[#001c44]/60 backdrop-blur-xl border border-[#002a63] p-6 rounded-2xl shadow-xl min-h-[400px] flex flex-col">
            
            {/* Header Tabs */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-[#002a63]/40 mb-6">
              <div className="flex gap-2">
                <button
                  onClick={() => setActivePanelTab('logs')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    activePanelTab === 'logs'
                      ? 'bg-[#003B8E] text-[#D4A017] border border-[#003B8E]'
                      : 'bg-transparent text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  Attendance Register ({attendances.length})
                </button>
                <button
                  onClick={() => setActivePanelTab('security')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 relative ${
                    activePanelTab === 'security'
                      ? 'bg-[#003B8E] text-rose-400 border border-[#003B8E]'
                      : 'bg-transparent text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Anti-Cheat Shield
                  {securityAlerts.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full ring-2 ring-[#001c44] animate-pulse">
                      {securityAlerts.length}
                    </span>
                  )}
                </button>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                Session Status: <span className="text-slate-300 font-bold">{session.status}</span>
              </span>
            </div>

            {/* Tab 1: Standard Logs */}
            {activePanelTab === 'logs' && (
              <div className="flex-1">
                <AttendanceTable attendances={attendances} />
              </div>
            )}

            {/* Tab 2: Security Shield */}
            {activePanelTab === 'security' && (
              <div className="space-y-6 flex-1">
                <div className="bg-[#001432]/60 border border-[#002a63] p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Proxy & Fraud Detection Engine</h4>
                      <p className="text-xs text-slate-400">Comparing IP signatures, GPS outliers, and device fingerprint tokens.</p>
                    </div>
                  </div>
                  <div className="text-xs font-mono bg-rose-500/10 border border-rose-500/20 text-rose-400 px-3.5 py-1.5 rounded-lg font-bold">
                    {securityAlerts.length} Flagged Check-Ins
                  </div>
                </div>

                {securityAlerts.length === 0 ? (
                  <div className="text-center py-16 flex flex-col items-center">
                    <div className="p-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl mb-4">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-bold text-slate-200">No security issues detected</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">Every active check-in meets unique IP, device token, and geofencing criteria.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[#002a63]/40 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#001c44]/80 text-[10px] font-extrabold uppercase text-slate-400 border-b border-[#002a63]">
                          <th className="p-4">Student Info</th>
                          <th className="p-4">Flag Reason</th>
                          <th className="p-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#002a63]/20">
                        {securityAlerts.map(({ attendance, alerts }) => (
                          <tr key={attendance.id} className="hover:bg-[#002a63]/10 text-xs transition-colors">
                            <td className="p-4">
                              <div className="font-bold text-white">{attendance.student?.name || 'N/A'}</div>
                              <div className="text-[10px] text-[#D4A017] font-mono mt-0.5">{attendance.student?.indexNumber || 'N/A'}</div>
                            </td>
                            <td className="p-4 space-y-1.5 max-w-[280px]">
                              {alerts.map((alert, idx) => (
                                <div key={idx} className="flex items-start gap-1.5">
                                  <span className={`inline-block mt-1 h-1.5 w-1.5 rounded-full ${alert.severity === 'HIGH' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                                  <span className="text-[11px] leading-relaxed text-slate-300">
                                    {alert.message}
                                  </span>
                                </div>
                              ))}
                            </td>
                            <td className="p-4 text-center">
                              {attendance.status !== 'ABSENT' ? (
                                <button
                                  onClick={() => handleUpdateStatus(attendance.id, 'ABSENT')}
                                  className="px-3 py-1.5 text-[10px] font-bold border border-rose-500/30 hover:border-rose-500 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                                  title="Invalidate check-in and mark as absent"
                                >
                                  Mark Absent
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleUpdateStatus(attendance.id, 'PRESENT')}
                                  className="px-3 py-1.5 text-[10px] font-bold border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                                  title="Restore student status to Present"
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
  );
};

export default SessionManager;
