/* ========================================
   CampuSphere — Data Model
   Server-side data module for EJS templates
   ======================================== */

const CampuSphereData = {

  // ---- School Info ----
  school: {
    name: 'Camarines Sur Polytechnic Colleges',
    acronym: 'CSPC',
    address: 'Nabua, Camarines Sur, Philippines',
    founded: 2026,
    description: 'Camarines Sur Polytechnic Colleges is a state-funded institution of higher learning in Nabua, Camarines Sur providing quality education in engineering, technology, and other disciplines.'
  },

  // ---- Navigation Links per Role ----
  sidebarNav: {
    'student-cspc': [
      { id: 'overview', icon: 'home', label: 'Overview' },
      { id: 'profile', icon: 'user', label: 'Personal Info' },
      { id: 'news', icon: 'bell', label: 'News & Announcements' },
      { id: 'buildings', icon: 'door', label: 'Navigate Buildings' },
    ],
    'instructor': [
      { id: 'overview', icon: 'home', label: 'Overview' },
      { id: 'profile', icon: 'user', label: 'Profile' },
      { id: 'all-rooms', icon: 'door', label: 'All Rooms' },
      { id: 'rooms', icon: 'door', label: 'Assigned Rooms' },
      { id: 'schedule', icon: 'calendar', label: 'Teaching Schedule' },
      { id: 'buildings', icon: 'door', label: 'Navigate Buildings' },
      { id: 'announcements', icon: 'megaphone', label: 'Instructor News' },
      { id: 'status', icon: 'check', label: 'Status' },
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
      { id: 'offices', icon: 'door', label: 'Campus Offices' },
      { id: 'admission', icon: 'book', label: 'Admission Info' },
      { id: 'corridors', icon: 'door', label: 'Building Corridors' },
      { id: 'news-events', icon: 'bell', label: 'News & Events' },
      { id: 'achievements', icon: 'check', label: 'Achievements' },
      { id: 'map', icon: 'map', label: 'Campus Map' },
    ]
  },

  // ---- Role display info ----
  roles: {
    'student-cspc': { label: 'Student (CSPC)', color: '#2563a8', badge: 'CSPC Verified' },
    'instructor': { label: 'Instructor', color: '#d4a843', badge: 'Faculty' },
    'admin': { label: 'Administrator', color: '#dc2626', badge: 'Full Access' },
    'guest': { label: 'Guest', color: '#6b7280', badge: 'View Only' }
  },

  // ---- Sample student profile ----
  studentProfile: {
    name: 'Aaron V. Lasprillas',
    studentId: 'CSPC-2024-001234',
    email: 'aaron.lasprillas@cspc.edu.ph',
    course: 'BS Information Technology',
    yearLevel: '3rd Year',
    enrollmentStatus: 'Enrolled',
    semester: '2nd Semester, A.Y. 2025-2026'
  },

  // ---- News ----
  news: [
    { id: 1, title: 'Enrollment for 2nd Semester Now Open', date: 'March 5, 2026', category: 'Academic', excerpt: 'Online enrollment for the second semester of A.Y. 2025-2026 is now open.' },
    { id: 2, title: 'CSPC Foundation Day Celebration', date: 'March 12, 2026', category: 'Events', excerpt: 'Join us in celebrating the 43rd Foundation Anniversary of CSPC.' },
    { id: 3, title: 'New CCS Building Facilities', date: 'March 8, 2026', category: 'Facilities', excerpt: 'The College of Computer Studies now has upgraded computer laboratories.' },
    { id: 4, title: 'Scholarship Application Deadline', date: 'March 15, 2026', category: 'Academic', excerpt: 'Deadline for scholarship applications for the upcoming semester.' },
  ],

  // ---- Buildings ----
  buildings: [
    { id: 1, name: 'College of Computer Studies (CCS)', category: 'Academic', desc: 'Houses IT and CS programs.', lat: 13.4060, lng: 123.3735 },
    { id: 2, name: 'Main Academic Building', category: 'Academic', desc: 'Central academic hub.', lat: 13.4058, lng: 123.3737 },
    { id: 3, name: 'Engineering Building', category: 'Academic', desc: 'Engineering programs.', lat: 13.4056, lng: 123.3734 },
    { id: 4, name: 'Administration Building', category: 'Administrative', desc: 'Central administrative HQ.', lat: 13.4062, lng: 123.3738 },
    { id: 5, name: 'Library Building', category: 'Facilities', desc: 'Academic library.', lat: 13.4061, lng: 123.3733 },
    { id: 6, name: 'Gymnasium', category: 'Facilities', desc: 'Multi-purpose gymnasium.', lat: 13.4054, lng: 123.3740 },
  ],

  // ---- Contact Info ----
  contact: {
    address: 'San Miguel, Nabua, Camarines Sur 4434',
    phone: '(054) 473-1234',
    email: 'info@cspc.edu.ph',
    website: 'www.cspc.edu.ph',
    hours: 'Monday - Friday, 8:00 AM - 5:00 PM'
  }
};

module.exports = CampuSphereData;
