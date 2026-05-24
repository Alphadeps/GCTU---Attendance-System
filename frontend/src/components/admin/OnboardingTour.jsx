import { useState } from 'react';

const ClipboardListIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9h6m-6-4h6" />
  </svg>
);

const BulbIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364.364l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const AlertTriangleIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const PinIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v3a2 2 0 00.314 1.077l1.558 2.6A1 1 0 0120 15h-5.28l-.72 6.48a1 1 0 01-1.986.11l-.8-6.59H6a1 1 0 01-.894-1.447l1.58-2.6A2 2 0 007 8V5z" />
  </svg>
);

const CheckCircleIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SparklesIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const RocketIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 00-1 1v2a1 1 0 001 1h1.586a1 1 0 00.707-.293l5.414-5.414a1 1 0 00-.707-1.707H9.414a1 1 0 00-.707.293L5.586 15z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.414 4.586a2 2 0 112.828 2.828l-8.485 8.485a2 2 0 01-1.414.586H9.5a.5.5 0 01-.5-.5v-2.828a2 2 0 01.586-1.414l8.485-8.485z" />
  </svg>
);

const OnboardingTour = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Welcome to GCTU Attendance System!",
      content: (
        <div className="space-y-4">
          <p className="text-[#344767] leading-relaxed font-medium">
            Welcome, SuperAdmin! This system helps you manage class attendance efficiently. 
            Let's walk through the setup process to get your institution up and running.
          </p>
          <div className="bg-[#0c2340]/5 border border-[#0c2340]/10 rounded-xl p-4">
            <p className="text-[#0c2340] text-sm font-bold mb-2 flex items-center gap-1.5">
              <ClipboardListIcon className="w-4 h-4 text-[#0c2340] flex-shrink-0" /> What you'll learn:
            </p>
            <ul className="text-gray-700 text-sm space-y-1.5 ml-4">
              <li>• How to create academic programmes</li>
              <li>• Setting up classes and groups</li>
              <li>• Managing class representatives</li>
              <li>• Adding students and courses</li>
              <li>• Configuring system settings</li>
            </ul>
          </div>
          <p className="text-[#8392ab] text-xs italic">
            This tour takes about 5 minutes. You can skip it and access help anytime from the dashboard.
          </p>
        </div>
      ),
      icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
    },
    {
      title: "Step 1: Create Academic Programmes",
      content: (
        <div className="space-y-4">
          <p className="text-[#344767] leading-relaxed font-medium">
            Start by creating your academic programmes (e.g., BIT, BSc Computer Science, etc.). 
            These are the main degree programs your institution offers.
          </p>
          <div className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-emerald-800 text-sm font-bold">✓ How to create a programme:</p>
            <ol className="text-gray-700 text-sm space-y-2 ml-4">
              <li>1. Navigate to <span className="text-[#0c2340] font-bold">"Programmes"</span> tab in the sidebar</li>
              <li>2. Click <span className="text-[#0c2340] font-bold">"+ Add Programme"</span> button</li>
              <li>3. Enter the programme name (e.g., "Bachelor of Information Technology")</li>
              <li>4. Click <span className="text-[#0c2340] font-bold">"Save"</span></li>
            </ol>
          </div>
          <div className="bg-amber-50 border border-amber-250 rounded-xl p-3 flex items-start gap-2">
            <BulbIcon className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-amber-800 text-xs font-medium">
              <strong>Tip:</strong> Use clear, full names for programmes. You can edit them later if needed.
            </p>
          </div>
        </div>
      ),
      icon: "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
    },
    {
      title: "Step 2: Create Classes & Groups",
      content: (
        <div className="space-y-4">
          <p className="text-[#344767] leading-relaxed font-medium">
            After creating programmes, set up classes for each level (100, 200, 300, 400) and their groups (A-K).
          </p>
          <div className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-emerald-800 text-sm font-bold">✓ How to create classes:</p>
            <ol className="text-gray-700 text-sm space-y-2 ml-4">
              <li>1. Go to <span className="text-[#0c2340] font-bold">"Classes Control"</span> tab</li>
              <li>2. Click <span className="text-[#0c2340] font-bold">"+ Create Classes"</span></li>
              <li>3. Select the programme, level (100-400), type (Regular/Top-Up), and session (Morning/Evening/Weekend)</li>
              <li>4. Select groups (A, B, C, etc.) - you can select multiple at once</li>
              <li>5. Click <span className="text-[#0c2340] font-bold">"Create Classes"</span></li>
            </ol>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
            <PinIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-blue-800 text-xs font-medium">
              <strong>Example:</strong> "BIT LEVEL 300 REGULAR GROUP B (MORNING)" will be auto-generated
            </p>
          </div>
        </div>
      ),
      icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
    },
    {
      title: "Step 3: Add Class Representatives",
      content: (
        <div className="space-y-4">
          <p className="text-[#344767] leading-relaxed font-medium">
            Class reps manage attendance sessions for their assigned classes. You can create them individually or bulk upload.
          </p>
          <div className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-emerald-800 text-sm font-bold">✓ Option 1: Create Individual Rep</p>
            <ol className="text-gray-700 text-sm space-y-2 ml-4">
              <li>1. Navigate to <span className="text-[#0c2340] font-bold">"Class Reps"</span> tab</li>
              <li>2. Click <span className="text-[#0c2340] font-bold">"+ Create Class Rep"</span></li>
              <li>3. Fill in: Full Name, Index Number, Username, Password</li>
              <li>4. Click <span className="text-[#0c2340] font-bold">"Save Account"</span></li>
            </ol>
          </div>
          <div className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-emerald-800 text-sm font-bold">✓ Option 2: Bulk Upload (Recommended)</p>
            <ol className="text-gray-700 text-sm space-y-2 ml-4">
              <li>1. Click <span className="text-[#0c2340] font-bold">"Bulk Upload"</span> button</li>
              <li>2. Prepare Excel/CSV with columns: indexNumber, name, email, programme, level, type, group, session</li>
              <li>3. Upload the file</li>
              <li>4. Reps are auto-created with default password: <span className="text-amber-800 font-mono font-bold">rep123</span></li>
            </ol>
          </div>
          <div className="bg-amber-50 border border-amber-250 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangleIcon className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
            <p className="text-amber-800 text-xs font-medium">
              <strong>Important:</strong> Index numbers are required for reps to check in to their own sessions!
            </p>
          </div>
        </div>
      ),
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
    },
    {
      title: "Step 4: Assign Reps to Classes",
      content: (
        <div className="space-y-4">
          <p className="text-[#344767] leading-relaxed font-medium">
            After creating reps, assign them to their respective classes so they can manage attendance.
          </p>
          <div className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-emerald-800 text-sm font-bold">✓ How to assign a rep:</p>
            <ol className="text-gray-700 text-sm space-y-2 ml-4">
              <li>1. Go to <span className="text-[#0c2340] font-bold">"Classes Control"</span> tab</li>
              <li>2. Find the class card you want to assign a rep to</li>
              <li>3. Click <span className="text-[#0c2340] font-bold">"👤 Assign Rep"</span> button</li>
              <li>4. Search and select the rep from the list</li>
              <li>5. Click <span className="text-[#0c2340] font-bold">"Assign"</span></li>
            </ol>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
            <SparklesIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0 animate-pulse" />
            <p className="text-blue-800 text-xs font-medium">
              <strong>Auto-magic:</strong> When you assign a rep, they're automatically added as a student in that class!
            </p>
          </div>
        </div>
      ),
      icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
    },
    {
      title: "Step 5: Add Students to Classes",
      content: (
        <div className="space-y-4">
          <p className="text-[#344767] leading-relaxed font-medium">
            Add students to each class so they can check in during attendance sessions.
          </p>
          <div className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-emerald-800 text-sm font-bold">✓ How to add students:</p>
            <ol className="text-gray-700 text-sm space-y-2 ml-4">
              <li>1. In <span className="text-[#0c2340] font-bold">"Classes Control"</span>, click <span className="text-[#0c2340] font-bold">"👥 Manage Students"</span> on a class card</li>
              <li>2. Choose method:
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• <strong>Manual:</strong> Add students one by one</li>
                  <li>• <strong>Import CSV/Excel:</strong> Upload a student data list</li>
                  <li>• <strong>Import PDF:</strong> Extract student list from PDF registers</li>
                </ul>
              </li>
              <li>3. Click <span className="text-[#0c2340] font-bold">"Save"</span> or <span className="text-[#0c2340] font-bold">"Import"</span></li>
            </ol>
          </div>
          <div className="bg-amber-50 border border-amber-250 rounded-xl p-3 flex items-start gap-2">
            <BulbIcon className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-amber-800 text-xs font-medium">
              <strong>Tip:</strong> You can bulk delete students by selecting multiple and clicking "Delete Selected"
            </p>
          </div>
        </div>
      ),
      icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
    },
    {
      title: "Step 6: Add Global Courses",
      content: (
        <div className="space-y-4">
          <p className="text-[#344767] leading-relaxed font-medium">
            Create a database of all courses offered by your institution. These can then be linked to specific classes.
          </p>
          <div className="bg-[#f8f9fa] border border-gray-250 rounded-xl p-4 space-y-3">
            <p className="text-emerald-800 text-sm font-bold">✓ How to add courses:</p>
            <ol className="text-gray-700 text-sm space-y-2 ml-4">
              <li>1. Navigate to <span className="text-[#0c2340] font-bold">"Global Courses"</span> tab</li>
              <li>2. Click <span className="text-[#0c2340] font-bold">"+ Add Course"</span></li>
              <li>3. Enter course name (e.g., "Software Engineering") and code (e.g., "BIT 301")</li>
              <li>4. Click <span className="text-[#0c2340] font-bold">"Save"</span></li>
            </ol>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
            <PinIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-blue-800 text-xs font-medium">
              <strong>Note:</strong> Course codes must be unique across the system
            </p>
          </div>
        </div>
      ),
      icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
    },
    {
      title: "Step 7: Link Courses to Classes",
      content: (
        <div className="space-y-4">
          <p className="text-[#344767] leading-relaxed font-medium">
            After creating courses, link them to the appropriate classes so reps can create attendance sessions.
          </p>
          <div className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-emerald-800 text-sm font-bold">✓ How to link courses:</p>
            <ol className="text-gray-700 text-sm space-y-2 ml-4">
              <li>1. In <span className="text-[#0c2340] font-bold">"Classes Control"</span>, click <span className="text-[#0c2340] font-bold">"📚 Manage Courses"</span> on a class card</li>
              <li>2. Select courses from the dropdown menu</li>
              <li>3. Click <span className="text-[#0c2340] font-bold">"Link Course"</span></li>
              <li>4. Repeat for all courses taught to that class</li>
            </ol>
          </div>
          <div className="bg-emerald-50 border border-emerald-250 rounded-xl p-3 flex items-start gap-2">
            <CheckCircleIcon className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <p className="text-emerald-800 text-xs font-semibold">
              <strong>Ready to go:</strong> Once a class has a rep, students, and courses, it's ready for attendance sessions!
            </p>
          </div>
        </div>
      ),
      icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
    },
    {
      title: "Step 8: Configure System Settings",
      content: (
        <div className="space-y-4">
          <p className="text-[#344767] leading-relaxed font-medium">
            Customize system behavior to match your institution's attendance policies.
          </p>
          <div className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-emerald-800 text-sm font-bold">✓ Available settings:</p>
            <div className="text-gray-700 text-sm space-y-3 ml-4">
              <div>
                <p className="font-bold text-[#0c2340]">Late Grace Period</p>
                <p className="text-xs text-[#8392ab]">How many minutes after session start before marking as "LATE" (default: 15 mins)</p>
              </div>
              <div>
                <p className="font-bold text-[#0c2340]">QR Code Expiry</p>
                <p className="text-xs text-[#8392ab]">How often QR codes refresh for security (default: 30 seconds)</p>
              </div>
              <div>
                <p className="font-bold text-[#0c2340]">Geofence Radius</p>
                <p className="text-xs text-[#8392ab]">Maximum distance from class location for check-in (default: 100 meters)</p>
              </div>
            </div>
          </div>
          <div className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-4 space-y-2">
            <p className="text-emerald-800 text-sm font-bold">✓ How to configure:</p>
            <ol className="text-gray-700 text-sm space-y-1 ml-4">
              <li>1. Go to <span className="text-[#0c2340] font-bold">"Thresholds & Settings"</span> tab</li>
              <li>2. Adjust values as needed</li>
              <li>3. Click <span className="text-[#0c2340] font-bold">"Save Settings"</span></li>
            </ol>
          </div>
        </div>
      ),
      icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z"
    },
    {
      title: "You're All Set!",
      content: (
        <div className="space-y-4">
          <p className="text-[#344767] leading-relaxed font-medium">
            Congratulations! You've completed the system setup. Here's what happens next:
          </p>
          <div className="bg-[#f8f9fa] border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-emerald-800 text-sm font-bold flex items-center gap-1.5">
              <ClipboardListIcon className="w-4 h-4 text-emerald-800 flex-shrink-0" /> The Attendance Workflow:
            </p>
            <ol className="text-gray-700 text-sm space-y-2 ml-4">
              <li>1. <strong className="text-[#0c2340]">Rep</strong> logs in and creates an attendance session for a course</li>
              <li>2. <strong className="text-[#0c2340]">Students</strong> scan QR code or check in via portal</li>
              <li>3. <strong className="text-[#0c2340]">Rep</strong> closes session and generates attendance report</li>
              <li>4. <strong className="text-[#0c2340]">Lecturer</strong> reviews and signs the report</li>
              <li>5. <strong className="text-[#0c2340]">Admin</strong> views signed reports in Official Archives</li>
            </ol>
          </div>
          <div className="bg-[#0c2340]/5 border border-[#0c2340]/10 rounded-xl p-4 space-y-2">
            <p className="text-[#0c2340] text-sm font-bold flex items-center gap-1.5">
              <RocketIcon className="w-4 h-4 text-[#0c2340] flex-shrink-0" /> Quick Access:
            </p>
            <ul className="text-gray-700 text-sm space-y-1 ml-4">
              <li>• <strong>Overview:</strong> See system statistics at a glance</li>
              <li>• <strong>Grievance Desk:</strong> Handle student complaints and issues</li>
              <li>• <strong>Lecturer Allocations:</strong> Assign lecturers to courses</li>
              <li>• <strong>Official Archives:</strong> View all signed attendance reports</li>
              <li>• <strong>Notifications:</strong> Stay updated on system activities</li>
            </ul>
          </div>
          <div className="bg-emerald-50 border border-emerald-250 rounded-xl p-3 text-center flex items-center justify-center gap-2">
            <SparklesIcon className="w-4 h-4 text-emerald-800 animate-pulse flex-shrink-0" />
            <p className="text-emerald-800 text-sm font-bold">
              Need help? Click the "?" icon in the top-right corner anytime!
            </p>
          </div>
        </div>
      ),
      icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    }
  ];

  const currentStepData = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border border-gray-300 rounded-2xl max-w-3xl w-full shadow-2xl animate-scale-up overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0c2340] to-[#1a3c6d] p-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0,0 L100,0 L100,100 Z" fill="white" />
            </svg>
          </div>
          <div className="relative flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white/10 rounded-xl border border-white/20">
                <svg className="w-8 h-8 text-[#E5A93C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={currentStepData.icon} />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{currentStepData.title}</h2>
                <p className="text-[#E5A93C] font-semibold text-sm mt-1">
                  Step {currentStep + 1} of {steps.length}
                </p>
              </div>
            </div>
            <button
              onClick={onSkip}
              className="text-white/60 hover:text-white transition-colors p-2"
              title="Skip tour"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-gray-200">
          <div
            className="h-full bg-[#E5A93C] transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8 max-h-[60vh] overflow-y-auto">
          {currentStepData.content}
        </div>

        {/* Footer */}
        <div className="bg-[#f8f9fa] border-t border-gray-100 p-6 flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={isFirstStep}
            className="px-4 py-2 text-[#8392ab] hover:text-[#0c2340] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 font-bold"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Previous</span>
          </button>

          <div className="flex items-center space-x-2">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'w-8 bg-[#0c2340]'
                    : index < currentStep
                    ? 'w-2 bg-emerald-500'
                    : 'w-2 bg-gray-300'
                }`}
                title={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="px-6 py-2.5 bg-[#0c2340] hover:bg-[#113057] text-white font-bold rounded-xl transition-colors flex items-center space-x-2"
          >
            <span>{isLastStep ? 'Get Started' : 'Next'}</span>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isLastStep ? "M5 13l4 4L19 7" : "M9 5l7 7-7 7"} />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
