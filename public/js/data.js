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
      { id: 'buildings', icon: 'door', label: 'Navigate Buildings' },
    ],
    'instructor': [
      { id: 'overview', icon: 'home', label: 'Overview' },
      { id: 'profile', icon: 'user', label: 'Profile' },
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
    yearLevel: '3rd Year'
  },

  // ---- Instructor profile ----
  instructorProfile: {
    name: 'Dr. Maria Santos',
    employeeId: 'CSPC-FAC-0087',
    email: 'maria.santos@cspc.edu.ph',
    department: 'College of Computer Studies',
    position: 'Associate Professor',
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

  // ---- Instructor Buildings (for Navigate Buildings) ----
  instructorBuildings: [
    {
      id: 1, name: 'College of Computer Studies (CCS)', category: 'Academic', floors: 3,
      desc: 'Houses IT and CS programs with modern computer laboratories.',
      floorData: [
        { label: 'Ground Floor', rooms: [{ num: 'Room 101', use: 'Lecture Room', capacity: 45 }, { num: 'Room 102', use: 'Lecture Room', capacity: 45 }, { num: 'CompLab 1', use: 'Computer Lab', capacity: 40 }, { num: 'CompLab 2', use: 'Computer Lab', capacity: 40 }, { num: 'Faculty Room', use: 'Faculty Office', capacity: 10 }] },
        { label: '2nd Floor', rooms: [{ num: 'Room 201', use: 'Lecture Room', capacity: 45 }, { num: 'Room 202', use: 'Lecture Room', capacity: 45 }, { num: 'CompLab 3', use: 'Computer Lab', capacity: 40 }, { num: 'Server Room', use: 'IT Infra', capacity: 5 }] },
        { label: '3rd Floor', rooms: [{ num: 'Room 301', use: 'Lecture Room', capacity: 45 }, { num: 'Room 302', use: 'Research Lab', capacity: 30 }, { num: 'Capstone Lab', use: 'Project Lab', capacity: 30 }, { num: 'Dean\'s Office', use: 'Admin', capacity: 5 }] }
      ]
    },
    {
      id: 2, name: 'Main Academic Building', category: 'Academic', floors: 3,
      desc: 'Central academic hub with general education departments and registrar.',
      floorData: [
        { label: 'Ground Floor', rooms: [{ num: 'Room 101', use: 'Lecture Room', capacity: 50 }, { num: 'Room 102', use: 'Lecture Room', capacity: 50 }, { num: 'Registrar', use: 'Administrative', capacity: 15 }, { num: 'Cashier', use: 'Finance', capacity: 10 }, { num: 'OSAS Office', use: 'Student Affairs', capacity: 10 }] },
        { label: '2nd Floor', rooms: [{ num: 'Room 201', use: 'Lecture Room', capacity: 40 }, { num: 'Room 202', use: 'Lecture Room', capacity: 40 }, { num: 'Room 203', use: 'Lecture Room', capacity: 40 }, { num: 'Room 205', use: 'Lecture Room', capacity: 40 }, { num: 'Faculty Lounge', use: 'Faculty', capacity: 20 }] },
        { label: '3rd Floor', rooms: [{ num: 'Room 301', use: 'Lecture Room', capacity: 50 }, { num: 'Room 302', use: 'Lecture Room', capacity: 50 }, { num: 'Function Hall', use: 'Events', capacity: 200 }] }
      ]
    },
    {
      id: 3, name: 'Engineering Building', category: 'Academic', floors: 2,
      desc: 'Engineering programs with workshops and laboratories.',
      floorData: [
        { label: 'Ground Floor', rooms: [{ num: 'Workshop A', use: 'Mechanical Lab', capacity: 30 }, { num: 'Workshop B', use: 'Civil Lab', capacity: 30 }, { num: 'Drawing Room 1', use: 'AutoCAD Room', capacity: 35 }, { num: 'Tool Room', use: 'Equipment Storage', capacity: 5 }] },
        { label: '2nd Floor', rooms: [{ num: 'ENG-101', use: 'Lecture Room', capacity: 45 }, { num: 'ENG-102', use: 'Lecture Room', capacity: 45 }, { num: 'Electrical Lab', use: 'Electrical Eng.', capacity: 30 }, { num: 'Faculty Office', use: 'Faculty', capacity: 8 }] }
      ]
    },
    {
      id: 4, name: 'Administration Building', category: 'Administrative', floors: 2,
      desc: 'Central admin HQ with executive offices and HR.',
      floorData: [
        { label: 'Ground Floor', rooms: [{ num: 'Reception', use: 'Front Desk', capacity: 5 }, { num: 'HR Office', use: 'Human Resources', capacity: 10 }, { num: 'Finance Office', use: 'Accounting', capacity: 10 }] },
        { label: '2nd Floor', rooms: [{ num: 'President\'s Office', use: 'Executive', capacity: 5 }, { num: 'VP Academic', use: 'VP Office', capacity: 5 }, { num: 'VP Admin', use: 'VP Office', capacity: 5 }, { num: 'Board Room', use: 'Conference', capacity: 25 }] }
      ]
    },
    {
      id: 5, name: 'Library Building', category: 'Facilities', floors: 2,
      desc: 'Academic library with books, journals, and digital resources.',
      floorData: [
        { label: 'Ground Floor', rooms: [{ num: 'Circulation Desk', use: 'Check-in/out', capacity: 5 }, { num: 'Filipiniana', use: 'Filipino Books', capacity: 30 }, { num: 'General Ref.', use: 'Reference', capacity: 30 }, { num: 'Periodicals', use: 'Journals', capacity: 20 }] },
        { label: '2nd Floor', rooms: [{ num: 'Study Area A', use: 'Quiet Zone', capacity: 40 }, { num: 'Study Area B', use: 'Group Study', capacity: 30 }, { num: 'Digital Library', use: 'Computer Terminals', capacity: 25 }, { num: 'Archives', use: 'Special Collections', capacity: 10 }] }
      ]
    },
    {
      id: 6, name: 'Gymnasium', category: 'Facilities', floors: 1,
      desc: 'Multi-purpose gym for sports and institutional events.',
      floorData: [
        { label: 'Main Court', rooms: [{ num: 'Basketball Court', use: 'Main Court', capacity: 500 }, { num: 'Bleachers', use: 'Seating', capacity: 1000 }, { num: 'Stage Area', use: 'Events Stage', capacity: 50 }, { num: 'Equipment Room', use: 'Storage', capacity: 10 }] }
      ]
    },
    {
      id: 7, name: 'Auditorium', category: 'Facilities', floors: 2,
      desc: 'Large venue for seminars, conferences, and graduation ceremonies.',
      floorData: [
        { label: 'Main Hall', rooms: [{ num: 'Stage', use: 'Performance Area', capacity: 30 }, { num: 'Audience Seating', use: 'Main Seating', capacity: 500 }, { num: 'Sound Booth', use: 'Audio/Visual', capacity: 3 }, { num: 'Lobby', use: 'Reception', capacity: 80 }] },
        { label: 'Balcony', rooms: [{ num: 'Upper Seating', use: 'Balcony Seats', capacity: 200 }, { num: 'Lighting Booth', use: 'Lighting Control', capacity: 3 }, { num: 'Projection Room', use: 'AV Equipment', capacity: 3 }] }
      ]
    }
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
    CampuSphereData.studentProfile = {
      ...CampuSphereData.studentProfile,
      ...JSON.parse(savedStudent)
    };
  }

  const savedInstructor = localStorage.getItem('campusphere-instructor');
  if (savedInstructor) {
    CampuSphereData.instructorProfile = {
      ...CampuSphereData.instructorProfile,
      ...JSON.parse(savedInstructor)
    };
  }
}
