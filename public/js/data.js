/* ========================================
   CampuSphere — Data Module
   Role-based data for EJS-style templating
   ======================================== */

const CampuSphereData = {

  // ---- School Info ----
  school: {
    name: 'Camarines Sur Polytechnic Colleges',
    acronym: 'CSPC',
    address: 'Nabua, Camarines Sur, Philippines',
    founded: 1983,
    description: 'Camarines Sur Polytechnic Colleges is a state-funded institution of higher learning in Nabua, Camarines Sur providing quality education in engineering, technology, and other disciplines.'
  },

  // ---- Navigation Links per Role ----
  sidebarNav: {
    'student-cspc': [
      { id: 'overview', icon: 'home', label: 'Overview' },
      { id: 'profile', icon: 'user', label: 'Personal Info' },
      { id: 'news', icon: 'bell', label: 'News & Announcements' },
    ],
    'instructor': [
      { id: 'overview', icon: 'home', label: 'Overview' },
      { id: 'profile', icon: 'user', label: 'Profile' },
      { id: 'announcements', icon: 'megaphone', label: 'News & Announcements' },
    ],
    'admin': [
      { id: 'overview', icon: 'home', label: 'Overview' },
      { id: 'users', icon: 'users', label: 'User Management' },
      { id: 'map-data', icon: 'map', label: 'Map Data' },
      { id: 'news-editor', icon: 'edit', label: 'News / FAQ Editor' },
      { id: 'logs', icon: 'file', label: 'System Logs' },
    ],
    'guest': [
      { id: 'overview', icon: 'home', label: 'Overview' },
      { id: 'news-events', icon: 'bell', label: 'News & Announcements' },
    ]
  },

  // ---- Role display info ----
  roles: {
    'student-cspc': { label: 'Student (CSPC)', color: '#2563a8', badge: 'CSPC Verified' },
    'instructor': { label: 'Instructor', color: '#d4a843', sidebarBadge: 'Instructor', badge: 'Faculty' },
    'admin': { label: 'Administrator', color: '#dc2626', badge: 'Full Access' },
    'guest': { label: 'Guest', color: '#6b7280', badge: 'View Only' }
  },

  // ---- Sample student profile ----
  studentProfile: {
    name: 'Aaron V. Lasprillas',
    studentId: 'CSPC-2024-001234',
    email: 'aaron.lasprillas@cspc.edu.ph',
    course: 'Bachelor of Science in Information Technology',
    yearLevel: '3rd Year'
  },

  // ---- Instructor profile ----
  instructorProfile: {
    name: 'Dr. Maria Santos',
    email: 'maria.santos@cspc.edu.ph',
    status: 'Active'
  },

  // ---- News ----
  news: [
    { id: 1, title: 'Enrollment for 2nd Semester Now Open', date: 'March 5, 2026', category: 'Academic', excerpt: 'Online enrollment for the second semester of A.Y. 2025-2026 is now open. Students may access the enrollment portal.' },
    { id: 2, title: 'CSPC Foundation Day Celebration', date: 'March 12, 2026', category: 'Events', excerpt: 'Join us in celebrating the 43rd Foundation Anniversary of CSPC with various activities and programs.' },
    { id: 3, title: 'New CCS Building Facilities', date: 'March 8, 2026', category: 'Facilities', excerpt: 'The College of Computer Studies now has upgraded computer laboratories with new workstations.' },
    { id: 4, title: 'CS/IT Department Hackathon Registration Starts', date: 'March 15, 2026', category: 'Academic', excerpt: 'Register your teams for the upcoming 24-hour coding challenge. Great prizes await the top innovators.' },
  ],

  // ---- Admin Users ----
  adminUsers: [
    { name: 'Aaron V. Lasprillas', email: 'aaron@cspc.edu.ph', role: 'Student', status: 'Active' },
    { name: 'Carl Andrie Baldoza', email: 'carl@cspc.edu.ph', role: 'Student', status: 'Active' },
    { name: 'Dr. Maria Santos', email: 'maria.santos@cspc.edu.ph', role: 'Instructor', status: 'Active' },
    { name: 'John Guest', email: 'john@gmail.com', role: 'Guest', status: 'Active' },
    { name: 'Admin User', email: 'admin@cspc.edu.ph', role: 'Admin', status: 'Active' },
  ],

  // ---- System Logs ----
  logs: [
    { time: '19:30:05', action: 'User Login', user: 'aaron@cspc.edu.ph', detail: 'Logged in via Google OAuth' },
    { time: '19:28:12', action: 'Map Updated', user: 'admin@cspc.edu.ph', detail: 'Updated CCS Building info' },
    { time: '19:25:00', action: 'News Published', user: 'admin@cspc.edu.ph', detail: 'Foundation Day announcement' },
    { time: '19:20:33', action: 'User Login', user: 'maria.santos@cspc.edu.ph', detail: 'Logged in via Google OAuth' },
    { time: '19:15:10', action: 'Profile Updated', user: 'carl@cspc.edu.ph', detail: 'Updated contact info' },
  ],

  // ---- Contact Info ----
  contact: {
    address: 'San Miguel, Nabua, Camarines Sur 4434',
    phone: '(054) 473-1234',
    email: 'info@cspc.edu.ph',
    website: 'www.cspc.edu.ph',
    hours: 'Monday - Friday, 8:00 AM - 5:00 PM'
  },

  // ---- Campus Offices (for Non-CSPC / Freshmen) ----
  campusOffices: [
    { name: 'Registrar', location: 'Admin Building, Ground Floor', description: 'Handles student records, enrollment verification, and transcript requests.', hours: 'Mon-Fri 8:00 AM - 5:00 PM' },
    { name: 'Cashier', location: 'Admin Building, Ground Floor', description: 'Processes tuition payments, releases financial clearances and receipts.', hours: 'Mon-Fri 8:00 AM - 4:00 PM' },
    { name: 'ICTU (ICT Unit)', location: 'CCS Building, 2nd Floor', description: 'Manages student email accounts, LMS access, and campus Wi-Fi.', hours: 'Mon-Fri 8:00 AM - 5:00 PM' },
    { name: 'Gate 1 — Main Entrance', location: 'Front of Campus, San Miguel Road', description: 'Main entry/exit point. Guard booth with visitor sign-in.' },
    { name: 'Gate 2 — Back Gate', location: 'Rear of Campus, Barangay Road', description: 'Secondary entry/exit. Pedestrian and motorcycle access.' }
  ],

  // ---- Admission Info (for Non-CSPC) ----
  admissionInfo: {
    requirements: ['High School Report Card (Form 137 / SF10)', 'PSA Birth Certificate', '2x2 ID Photo (4 copies)', 'Certificate of Good Moral Character', 'CSPC Admission Test Results'],
    steps: ['1. Visit the Registrar or apply online at cspc.edu.ph', '2. Submit the required documents', '3. Take the CSPC Admission Test', '4. Wait for admission results via email', '5. Proceed to enrollment upon acceptance'],
    deadline: 'April 30, 2026',
    contactEmail: 'admissions@cspc.edu.ph'
  },

  // ---- Guest Building Corridors ----
  guestBuildings: [
    { name: 'CCS Building', description: 'College of Computer Studies — houses lecture rooms and computer labs.', floors: 3 },
    { name: 'Academic Building', description: 'General purpose academic building with classrooms and faculty offices.', floors: 3 },
    { name: 'Engineering Building', description: 'Engineering labs, lecture rooms, and workshop spaces.', floors: 2 },
    { name: 'Admin Building', description: 'Administrative offices including Registrar, Cashier, and HR.', floors: 2 },
    { name: 'Library', description: 'Main campus library with reading areas and digital resources.', floors: 2 },
    { name: 'Gymnasium', description: 'Indoor sports court and fitness facilities.', floors: 1 }
  ],

  // ---- Public Achievements ----
  achievements: [
    { title: 'Level IV Accreditation — BS Information Technology', year: '2025', detail: 'AACCUP granted Level IV status, the highest accreditation for the BSIT program.' },
    { title: 'National IT Skills Competition — Champion', year: '2025', detail: 'CSPC students won 1st place in the national collegiate IT skills competition.' },
    { title: 'ISO 9001:2015 Certified', year: '2024', detail: 'CSPC earned ISO certification for quality management systems.' },
    { title: 'Best State College in Bicol Region', year: '2024', detail: 'Recognized by CHED as the top-performing state college in the region.' }
  ],

  // ---- Map Buildings ----
  // Center is approx: 13.4059, 123.3736
  buildings: [
    {
      id: 1, name: 'College of Computer Studies (CCS)', category: 'Academic',
      desc: 'Houses the Bachelor of Science in Information Technology and Computer Science programs.',
      img: 'img/Camarines-sur-polytechnic-colleges.png',
      lat: 13.40565, lng: 123.37710
    },
    {
      id: 2, name: 'College of Health Sciences (CHS)', category: 'Academic',
      desc: 'Houses the Bachelor of Science in Nursing and other health-related programs.',
      img: 'img/Camarines-sur-polytechnic-colleges.png',
      lat: 13.40539, lng: 123.37750
    },
    {
      id: 3, name: 'Green Building', category: 'Academic',
      desc: 'Dedicated to engineering programs with drawing rooms, workshops, and labs.',
      img: 'img/Camarines-sur-polytechnic-colleges.png',
      lat: 13.40600, lng: 123.37652
    },
    {
      id: 4, name: 'Administration Building', category: 'Administrative',
      desc: 'Central administrative headquarters housing executive offices.',
      img: 'img/Camarines-sur-polytechnic-colleges.png',
      lat: 13.40613, lng: 123.37441
    },
    {
      id: 5, name: 'Library Building', category: 'Facilities',
      desc: 'A multi-floor library providing access to academic resources.',
      img: 'img/Camarines-sur-polytechnic-colleges.png',
      lat: 13.40630, lng: 123.37525
    },
    {
      id: 6, name: 'Gymnasium', category: 'Facilities',
      desc: 'Multi-purpose gymnasium for sports and institutional ceremonies.',
      img: 'img/Camarines-sur-polytechnic-colleges.png',
      lat: 13.40585, lng: 123.37522
    },
    {
      id: 7, name: 'Canteen / Cafeteria', category: 'Facilities',
      desc: 'The main campus dining facility offering affordable meals.',
      img: 'img/Camarines-sur-polytechnic-colleges.png',
      lat: 13.40625, lng: 123.37515
    },
    {
      id: 8, name: 'Information and Communications Technology Unit (ICTU)', category: 'Administrative',
      desc: 'administers the technical and systems development of institutional processes involving information systems, network, technical services, and web development.',
      img: 'img/Camarines-sur-polytechnic-colleges.png',
      lat: 13.40558, lng: 123.37471
    },
    {
      id: 9, name: 'Medical & Dental Clinic', category: 'Facilities',
      desc: 'Provides basic health and dental services to students.',
      img: 'img/Camarines-sur-polytechnic-colleges.png',
      lat: 13.40616, lng: 123.37717
    },
    {
      id: 10, name: 'Auditorium', category: 'Facilities',
      desc: 'Large venue for public events, seminars, and ceremonies.',
      img: 'img/Camarines-sur-polytechnic-colleges.png',
      lat: 13.40630, lng: 123.37560
    }
  ]
};

// Override default profiles with localStorage data if modified by user
if (typeof localStorage !== 'undefined') {
  const savedStudent = localStorage.getItem('campusphere-student');
  if (savedStudent) {
    const savedStudentData = JSON.parse(savedStudent) || {};
    // The server/session is the only identity source for participant names.
    // Preserve the legacy storage key for editable fields, but never let a
    // hand-edited `name` value replace the account identity.
    if (savedStudentData && typeof savedStudentData === 'object') delete savedStudentData.name;
    CampuSphereData.studentProfile = {
      ...CampuSphereData.studentProfile,
      ...savedStudentData
    };
  }

  const savedInstructor = localStorage.getItem('campusphere-instructor');
  if (savedInstructor) {
    const savedInstructorData = JSON.parse(savedInstructor) || {};
    CampuSphereData.instructorProfile = {
      ...CampuSphereData.instructorProfile,
      email: savedInstructorData.email || CampuSphereData.instructorProfile.email,
      profileImage: savedInstructorData.profileImage || '',
      profileImageSource: savedInstructorData.profileImageSource || '',
      status: savedInstructorData.status || CampuSphereData.instructorProfile.status
    };
  }
}
