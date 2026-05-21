import { useState } from 'react';

const OnboardingTour = ({ onComplete, onSkip }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Welcome to GCTU Attendance System! 🎓",
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 leading-relaxed">
            Welcome, SuperAdmin! This system helps you manage class attendance efficiently. 
            Let's walk through the setup process to get your institution up and running.
          </p>
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
            <p className="text-indigo-400 text-sm font-semibold mb-2">📋 What you'll learn:</p>
            <ul className="text-slate-400 text-sm space-y-1.5 ml-4">
              <li>• How to create academic programmes</li>
              <li>• Setting up classes and groups</li>
              <li>• Managing class representatives</li>
              <li>• Adding students and courses</li>
              <li>• Configuring system settings</li>
            </ul>
          </div>
          <p className="text-slate-500 text-xs italic">
            This tour takes about 5 minutes. You can skip it and access help anytime from the dashboard.
          </p>
        </div>
      ),
      icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
    },
    {
      title: "Step 1: Create Academic Programmes 📚",
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 leading-relaxed">
            Start by creating your academic programmes (e.g., BIT, BSc Computer Science, etc.). 
            These are the main degree programs your institution offers.
          </p>
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-4 space-y-3">
            <p className="text-emerald-400 text-sm font-bold">✓ How to create a programme:</p>
            <ol className="text-slate-400 text-sm space-y-2 ml-4">
              <li>1. Navigate to <span className="text-indigo-400 font-semibold">"Programmes"</span> tab in the sidebar</li>
              <li>2. Click <span className="text-indigo-400 font-semibold">"+ Add Programme"</span> button</li>
              <li>3. Enter the programme name (e.g., "Bachelor of Information Technology")</li>
              <li>4. Click <span className="text-indigo-400 font-semibold">"Save"</span></li>
            </ol>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <p className="text-amber-400 text-xs">
              💡 <strong>Tip:</strong> Use clear, full names for programmes. You can edit them later if needed.
            </p>
          </div>
        </div>
      ),
      icon: "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
    },
    {
      title: "Step 2: Create Classes & Groups 🏫",
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 leading-relaxed">
            After creating programmes, set up classes for each level (100, 200, 300, 400) and their groups (A-K).
          </p>
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-4 space-y-3">
            <p className="text-emerald-400 text-sm font-bold">✓ How to create classes:</p>
            <ol className="text-slate-400 text-sm space-y-2 ml-4">
              <li>1. Go to <span className="text-indigo-400 font-semibold">"Classes Control"</span> tab</li>
              <li>2. Click <span className="text-indigo-400 font-semibold">"+ Create Classes"</span></li>
              <li>3. Select the programme, level (100-400), type (Regular/Top-Up), and session (Morning/Evening/Weekend)</li>
              <li>4. Select groups (A, B, C, etc.) - you can select multiple at once</li>
              <li>5. Click <span className="text-indigo-400 font-semibold">"Create Classes"</span></li>
            </ol>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
            <p className="text-blue-400 text-xs">
              📌 <strong>Example:</strong> "BIT LEVEL 300 REGULAR GROUP B (MORNING)" will be auto-generated
            </p>
          </div>
        </div>
      ),
      icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
    },
    {
      title: "Step 3: Add Class Representatives 👥",
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 leading-relaxed">
            Class reps manage attendance sessions for their assigned classes. You can create them individually or bulk upload.
          </p>
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-4 space-y-3">
            <p className="text-emerald-400 text-sm font-bold">✓ Option 1: Create Individual Rep</p>
            <ol className="text-slate-400 text-sm space-y-2 ml-4">
              <li>1. Navigate to <span className="text-indigo-400 font-semibold">"Class Reps"</span> tab</li>
              <li>2. Click <span className="text-indigo-400 font-semibold">"+ Create Class Rep"</span></li>
              <li>3. Fill in: Full Name, Index Number, Username, Password</li>
              <li>4. Click <span className="text-indigo-400 font-semibold">"Save Account"</span></li>
            </ol>
          </div>
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-4 space-y-3">
            <p className="text-emerald-400 text-sm font-bold">✓ Option 2: Bulk Upload (Recommended)</p>
            <ol className="text-slate-400 text-sm space-y-2 ml-4">
              <li>1. Click <span className="text-indigo-400 font-semibold">"Bulk Upload"</span> button</li>
              <li>2. Prepare Excel/CSV with columns: indexNumber, name, email, programme, level, type, group, session</li>
              <li>3. Upload the file</li>
              <li>4. Reps are auto-created with default password: <span className="text-amber-400 font-mono">rep123</span></li>
            </ol>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <p className="text-amber-400 text-xs">
              ⚠️ <strong>Important:</strong> Index numbers are required for reps to check in to their own sessions!
            </p>
          </div>
        </div>
      ),
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
    },
    {
      title: "Step 4: Assign Reps to Classes 🔗",
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 leading-relaxed">
            After creating reps, assign them to their respective classes so they can manage attendance.
          </p>
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-4 space-y-3">
            <p className="text-emerald-400 text-sm font-bold">✓ How to assign a rep:</p>
            <ol className="text-slate-400 text-sm space-y-2 ml-4">
              <li>1. Go to <span className="text-indigo-400 font-semibold">"Classes Control"</span> tab</li>
              <li>2. Find the class card you want to assign a rep to</li>
              <li>3. Click <span className="text-indigo-400 font-semibold">"👤 Assign Rep"</span> button</li>
              <li>4. Search and select the rep from the list</li>
              <li>5. Click <span className="text-indigo-400 font-semibold">"Assign"</span></li>
            </ol>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
            <p className="text-blue-400 text-xs">
              ✨ <strong>Auto-magic:</strong> When you assign a rep, they're automatically added as a student in that class!
            </p>
          </div>
        </div>
      ),
      icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
    },
    {
      title: "Step 5: Add Students to Classes 📝",
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 leading-relaxed">
            Add students to each class so they can check in during attendance sessions.
          </p>
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-4 space-y-3">
            <p className="text-emerald-400 text-sm font-bold">✓ How to add students:</p>
            <ol className="text-slate-400 text-sm space-y-2 ml-4">
              <li>1. In <span className="text-indigo-400 font-semibold">"Classes Control"</span>, click <span className="text-indigo-400 font-semibold">"👥 Manage Students"</span> on a class card</li>
              <li>2. Choose method:
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• <strong>Manual:</strong> Add students one by one with name, index number, email</li>
                  <li>• <strong>Import CSV/Excel:</strong> Upload a file with student data (drag & drop supported)</li>
                  <li>• <strong>Import PDF:</strong> Extract student list from PDF documents</li>
                </ul>
              </li>
              <li>3. Click <span className="text-indigo-400 font-semibold">"Save"</span> or <span className="text-indigo-400 font-semibold">"Import"</span></li>
            </ol>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <p className="text-amber-400 text-xs">
              💡 <strong>Tip:</strong> You can bulk delete students by selecting multiple and clicking "Delete Selected"
            </p>
          </div>
        </div>
      ),
      icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
    },
    {
      title: "Step 6: Add Global Courses 📖",
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 leading-relaxed">
            Create a database of all courses offered by your institution. These can then be linked to specific classes.
          </p>
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-4 space-y-3">
            <p className="text-emerald-400 text-sm font-bold">✓ How to add courses:</p>
            <ol className="text-slate-400 text-sm space-y-2 ml-4">
              <li>1. Navigate to <span className="text-indigo-400 font-semibold">"Global Courses"</span> tab</li>
              <li>2. Click <span className="text-indigo-400 font-semibold">"+ Add Course"</span></li>
              <li>3. Enter course name (e.g., "Software Engineering") and code (e.g., "BIT 301")</li>
              <li>4. Click <span className="text-indigo-400 font-semibold">"Save"</span></li>
            </ol>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
            <p className="text-blue-400 text-xs">
              📌 <strong>Note:</strong> Course codes must be unique across the system
            </p>
          </div>
        </div>
      ),
      icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
    },
    {
      title: "Step 7: Link Courses to Classes 🔗",
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 leading-relaxed">
            After creating courses, link them to the appropriate classes so reps can create attendance sessions.
          </p>
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-4 space-y-3">
            <p className="text-emerald-400 text-sm font-bold">✓ How to link courses:</p>
            <ol className="text-slate-400 text-sm space-y-2 ml-4">
              <li>1. In <span className="text-indigo-400 font-semibold">"Classes Control"</span>, click <span className="text-indigo-400 font-semibold">"📚 Manage Courses"</span> on a class card</li>
              <li>2. Select courses from the dropdown menu</li>
              <li>3. Click <span className="text-indigo-400 font-semibold">"Link Course"</span></li>
              <li>4. Repeat for all courses taught to that class</li>
            </ol>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
            <p className="text-emerald-400 text-xs">
              ✅ <strong>Ready to go:</strong> Once a class has a rep, students, and courses, it's ready for attendance sessions!
            </p>
          </div>
        </div>
      ),
      icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
    },
    {
      title: "Step 8: Configure System Settings ⚙️",
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 leading-relaxed">
            Customize system behavior to match your institution's attendance policies.
          </p>
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-4 space-y-3">
            <p className="text-emerald-400 text-sm font-bold">✓ Available settings:</p>
            <div className="text-slate-400 text-sm space-y-3 ml-4">
              <div>
                <p className="font-semibold text-white">Late Grace Period</p>
                <p className="text-xs">How many minutes after session start before marking as "LATE" (default: 15 mins)</p>
              </div>
              <div>
                <p className="font-semibold text-white">QR Code Expiry</p>
                <p className="text-xs">How often QR codes refresh for security (default: 30 seconds)</p>
              </div>
              <div>
                <p className="font-semibold text-white">Geofence Radius</p>
                <p className="text-xs">Maximum distance from class location for check-in (default: 100 meters)</p>
              </div>
            </div>
          </div>
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-4 space-y-2">
            <p className="text-emerald-400 text-sm font-bold">✓ How to configure:</p>
            <ol className="text-slate-400 text-sm space-y-1 ml-4">
              <li>1. Go to <span className="text-indigo-400 font-semibold">"Thresholds & Settings"</span> tab</li>
              <li>2. Adjust values as needed</li>
              <li>3. Click <span className="text-indigo-400 font-semibold">"Save Settings"</span></li>
            </ol>
          </div>
        </div>
      ),
      icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z"
    },
    {
      title: "You're All Set! 🎉",
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 leading-relaxed">
            Congratulations! You've completed the system setup. Here's what happens next:
          </p>
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-4 space-y-3">
            <p className="text-emerald-400 text-sm font-bold">📋 The Attendance Workflow:</p>
            <ol className="text-slate-400 text-sm space-y-2 ml-4">
              <li>1. <strong className="text-white">Rep</strong> logs in and creates an attendance session for a course</li>
              <li>2. <strong className="text-white">Students</strong> scan QR code or check in via portal</li>
              <li>3. <strong className="text-white">Rep</strong> closes session and generates attendance report</li>
              <li>4. <strong className="text-white">Lecturer</strong> reviews and signs the report</li>
              <li>5. <strong className="text-white">Admin</strong> views signed reports in Official Archives</li>
            </ol>
          </div>
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 space-y-2">
            <p className="text-indigo-400 text-sm font-bold">🚀 Quick Access:</p>
            <ul className="text-slate-400 text-sm space-y-1 ml-4">
              <li>• <strong>Overview:</strong> See system statistics at a glance</li>
              <li>• <strong>Grievance Desk:</strong> Handle student complaints and issues</li>
              <li>• <strong>Lecturer Allocations:</strong> Assign lecturers to courses</li>
              <li>• <strong>Official Archives:</strong> View all signed attendance reports</li>
              <li>• <strong>Notifications:</strong> Stay updated on system activities</li>
            </ul>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
            <p className="text-emerald-400 text-sm font-bold">
              ✨ Need help? Click the "?" icon in the top-right corner anytime!
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#1e293b] border border-slate-700 rounded-2xl max-w-3xl w-full shadow-2xl animate-scale-up overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0,0 L100,0 L100,100 Z" fill="white" />
            </svg>
          </div>
          <div className="relative flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white/10 rounded-xl border border-white/20">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={currentStepData.icon} />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{currentStepData.title}</h2>
                <p className="text-indigo-200 text-sm mt-1">
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
        <div className="h-2 bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8 max-h-[60vh] overflow-y-auto">
          {currentStepData.content}
        </div>

        {/* Footer */}
        <div className="bg-[#0f172a] border-t border-slate-800 p-6 flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={isFirstStep}
            className="px-4 py-2 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
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
                    ? 'w-8 bg-indigo-500'
                    : index < currentStep
                    ? 'w-2 bg-emerald-500'
                    : 'w-2 bg-slate-700'
                }`}
                title={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors flex items-center space-x-2"
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
