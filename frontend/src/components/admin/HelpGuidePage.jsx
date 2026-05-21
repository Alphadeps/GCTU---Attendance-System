import { useState } from 'react';

const HelpGuidePage = () => {
  const [selectedGuide, setSelectedGuide] = useState(null);

  const guides = [
    {
      id: 'programmes',
      title: 'Create Academic Programmes',
      icon: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z',
      color: 'indigo',
      description: 'Set up your academic programmes (BIT, BSc CS, etc.)',
      steps: [
        'Navigate to "Programmes" tab in the sidebar',
        'Click "+ Add Programme" button',
        'Enter the programme name (e.g., "Bachelor of Information Technology")',
        'Click "Save"',
        'You can edit or delete programmes later using the action buttons'
      ],
      tips: [
        'Use clear, full names for programmes',
        'Programme names must be unique',
        'You can see how many classes are linked to each programme'
      ]
    },
    {
      id: 'classes',
      title: 'Create Classes & Groups',
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      color: 'emerald',
      description: 'Set up classes for each level and group',
      steps: [
        'Go to "Classes Control" tab',
        'Click "+ Create Classes"',
        'Select the programme from dropdown',
        'Choose level (100, 200, 300, or 400)',
        'Select type (Regular or Top-Up)',
        'Choose session (Morning, Evening, or Weekend)',
        'Select one or more groups (A through K)',
        'Click "Create Classes"'
      ],
      tips: [
        'You can create multiple groups at once',
        'Class names are auto-generated (e.g., "BIT LEVEL 300 REGULAR GROUP B (MORNING)")',
        'Each class needs a rep, students, and courses to be fully operational'
      ]
    },
    {
      id: 'reps',
      title: 'Add Class Representatives',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      color: 'rose',
      description: 'Create rep accounts individually or in bulk',
      steps: [
        'Navigate to "Class Reps" tab',
        'Option 1 - Individual: Click "+ Create Class Rep"',
        'Fill in: Full Name, Index Number, Username, Password',
        'Option 2 - Bulk Upload: Click "Bulk Upload"',
        'Prepare Excel/CSV with columns: indexNumber, name, email, programme, level, type, group, session',
        'Upload the file - reps are auto-created with password "rep123"'
      ],
      tips: [
        'Index numbers are REQUIRED for reps to check in to their own sessions',
        'Bulk upload is faster for multiple reps',
        'Reps can login with username OR index number',
        'Default password for bulk upload: rep123'
      ]
    },
    {
      id: 'assign-reps',
      title: 'Assign Reps to Classes',
      icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
      color: 'blue',
      description: 'Link reps to their respective classes',
      steps: [
        'Go to "Classes Control" tab',
        'Find the class card you want to assign a rep to',
        'Click "👤 Assign Rep" button',
        'Search for the rep by name or username',
        'Select the rep from the list',
        'Click "Assign"'
      ],
      tips: [
        'When you assign a rep, they\'re automatically added as a student in that class',
        'Each class can only have one rep',
        'You can remove and reassign reps anytime',
        'Reps can see their assigned class immediately after login'
      ]
    },
    {
      id: 'students',
      title: 'Add Students to Classes',
      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      color: 'amber',
      description: 'Enroll students in classes',
      steps: [
        'In "Classes Control", click "👥 Manage Students" on a class card',
        'Choose your method:',
        '  • Manual: Add students one by one with name, index number, email',
        '  • CSV/Excel Import: Upload a file with student data (drag & drop supported)',
        '  • PDF Import: Extract student list from PDF documents',
        'Click "Save" or "Import"',
        'Students are now enrolled and can check in during sessions'
      ],
      tips: [
        'You can bulk delete students by selecting multiple and clicking "Delete Selected"',
        'Students can edit their own information after first login',
        'Index numbers must be unique across the system',
        'Email is optional but recommended for notifications'
      ]
    },
    {
      id: 'courses',
      title: 'Add Global Courses',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      color: 'purple',
      description: 'Create a database of all courses',
      steps: [
        'Navigate to "Global Courses" tab',
        'Click "+ Add Course"',
        'Enter course name (e.g., "Software Engineering")',
        'Enter course code (e.g., "BIT 301")',
        'Click "Save"',
        'Course is now available to link to classes'
      ],
      tips: [
        'Course codes must be unique across the system',
        'Use standard naming conventions for consistency',
        'You can edit course details anytime',
        'Courses can be linked to multiple classes'
      ]
    },
    {
      id: 'link-courses',
      title: 'Link Courses to Classes',
      icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
      color: 'teal',
      description: 'Connect courses to specific classes',
      steps: [
        'In "Classes Control", click "📚 Manage Courses" on a class card',
        'Select a course from the dropdown menu',
        'Click "Link Course"',
        'Repeat for all courses taught to that class',
        'Linked courses appear in the list below'
      ],
      tips: [
        'Once a class has a rep, students, and courses, it\'s ready for attendance sessions',
        'Reps can only create sessions for linked courses',
        'You can unlink courses anytime',
        'The same course can be linked to multiple classes'
      ]
    },
    {
      id: 'settings',
      title: 'Configure System Settings',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
      color: 'slate',
      description: 'Customize system behavior',
      steps: [
        'Go to "Thresholds & Settings" tab',
        'Adjust Late Grace Period (minutes after session start before marking as LATE)',
        'Set QR Code Expiry (how often QR codes refresh for security)',
        'Configure Geofence Radius (maximum distance from class location for check-in)',
        'Click "Save Settings"'
      ],
      tips: [
        'Default late window: 15 minutes',
        'Default QR expiry: 30 seconds',
        'Default geofence: 100 meters',
        'Changes apply immediately to new sessions'
      ]
    },
    {
      id: 'workflow',
      title: 'Attendance Workflow',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      color: 'green',
      description: 'How the attendance system works',
      steps: [
        '1. Rep logs in and creates an attendance session for a course',
        '2. Students scan QR code or check in via the student portal',
        '3. System marks attendance as PRESENT, LATE, or ABSENT based on time',
        '4. Rep closes the session when class ends',
        '5. Rep generates an attendance report',
        '6. Lecturer reviews and signs the report',
        '7. Signed report appears in Official Archives',
        '8. Admin can view all signed reports organized by programme/level/group'
      ],
      tips: [
        'Reps can check themselves in during their own sessions',
        'Students receive notifications when they check in',
        'Lecturers can approve sessions before signing reports',
        'All reports are archived permanently for record-keeping'
      ]
    }
  ];

  const colorClasses = {
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20'
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M0,0 L100,0 L100,100 Z" fill="white" />
          </svg>
        </div>
        <div className="relative">
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-4 bg-white/10 rounded-xl border border-white/20">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Help & Setup Guide</h1>
              <p className="text-indigo-200 mt-1">Complete guide to setting up and managing your attendance system</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Start */}
      <div className="bg-[#1e293b] border border-slate-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
          <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Quick Start Checklist</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { step: '1', text: 'Create Academic Programmes', done: true },
            { step: '2', text: 'Create Classes & Groups', done: true },
            { step: '3', text: 'Add Class Representatives', done: false },
            { step: '4', text: 'Assign Reps to Classes', done: false },
            { step: '5', text: 'Add Students to Classes', done: false },
            { step: '6', text: 'Add Global Courses', done: false },
            { step: '7', text: 'Link Courses to Classes', done: false },
            { step: '8', text: 'Configure System Settings', done: false }
          ].map((item, index) => (
            <div key={index} className="flex items-center space-x-3 p-3 bg-[#0f172a] rounded-xl border border-slate-800">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                item.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'
              }`}>
                {item.done ? '✓' : item.step}
              </div>
              <span className={item.done ? 'text-slate-400 line-through' : 'text-slate-300'}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {guides.map((guide) => (
          <button
            key={guide.id}
            onClick={() => setSelectedGuide(guide)}
            className="bg-[#1e293b] border border-slate-800 rounded-2xl p-6 text-left hover:border-indigo-500/30 transition-all hover:scale-[1.02] group"
          >
            <div className={`w-14 h-14 rounded-xl border flex items-center justify-center mb-4 ${colorClasses[guide.color]}`}>
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={guide.icon} />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-400 transition-colors">{guide.title}</h3>
            <p className="text-slate-400 text-sm">{guide.description}</p>
            <div className="mt-4 flex items-center text-indigo-400 text-sm font-semibold">
              <span>View Guide</span>
              <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Selected Guide Modal */}
      {selectedGuide && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedGuide(null)}>
          <div className="bg-[#1e293b] border border-slate-700 rounded-2xl max-w-3xl w-full shadow-2xl animate-scale-up overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className={`p-6 border-b border-slate-800 ${colorClasses[selectedGuide.color]} bg-opacity-5`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div className={`p-3 rounded-xl border ${colorClasses[selectedGuide.color]}`}>
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={selectedGuide.icon} />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedGuide.title}</h2>
                    <p className="text-slate-400 text-sm mt-1">{selectedGuide.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedGuide(null)}
                  className="text-slate-400 hover:text-white transition-colors p-2"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
              {/* Steps */}
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span>Step-by-Step Instructions</span>
                </h3>
                <div className="space-y-3">
                  {selectedGuide.steps.map((step, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-[#0f172a] rounded-xl border border-slate-800">
                      <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                  <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>Tips & Best Practices</span>
                </h3>
                <div className="space-y-2">
                  {selectedGuide.tips.map((tip, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-amber-500/5 rounded-xl border border-amber-500/20">
                      <span className="text-amber-400 text-lg shrink-0">💡</span>
                      <p className="text-slate-300 text-sm leading-relaxed">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#0f172a] border-t border-slate-800 p-4 flex justify-end">
              <button
                onClick={() => setSelectedGuide(null)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpGuidePage;
