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
    {
      id: 1,
      name: 'College of Computer Studies (CCS)',
      category: 'Academic',
      desc: 'Home of the BSIT and BSCS programs, with computer labs and faculty offices.',
      lat: 13.40565,
      lng: 123.37710,
      img: '/img/Camarines-sur-polytechnic-colleges.png',
      guestAccess: false,
      walkTime: '6-8 minutes from Main Gate',
      routes: [],
      info: [
        { office: 'Dean of CCS', floor: '2nd Floor' },
        { office: 'IT Faculty Room', floor: '2nd Floor' },
        { office: 'Programming Laboratory', floor: 'Ground Floor' },
        'Wi-Fi available throughout the building',
        'Student lounge near the rear staircase'
      ],
      floors: [
        {
          label: 'Ground Floor',
          rooms: [
            { room: 'GF-101', name: 'Programming Lab 1', use: 'Computer Lab' },
            { room: 'GF-102', name: 'Programming Lab 2', use: 'Computer Lab' },
            { room: 'GF-103', name: 'Networking Lab', use: 'Computer Lab' },
            { room: 'GF-104', name: 'Lecture Room', use: 'Classroom' }
          ]
        },
        {
          label: '2nd Floor',
          rooms: [
            { room: '201', name: "Dean's Office", use: 'Administrative' },
            { room: '202', name: 'IT Faculty Room', use: 'Faculty' },
            { room: '203', name: 'Multimedia Lab', use: 'Computer Lab' },
            { room: '204', name: 'Lecture Hall', use: 'Classroom' }
          ]
        }
      ],
      entrances: [
        'Main entrance (front, facing the quadrangle)',
        'Side entrance (left of building)',
        'Rear emergency exit'
      ],
      landmarks: [
        'Beside the Main Academic Building',
        'Across from the campus canteen',
        'Near the Flagpole Quadrangle'
      ]
    },
    {
      id: 2,
      name: 'Main Academic Building',
      category: 'Academic',
      desc: 'Central academic hub with general-education classrooms and faculty offices.',
      lat: 13.4058,
      lng: 123.3737,
      img: '/img/Camarines-sur-polytechnic-colleges.png',
      guestAccess: false,
      walkTime: '4-6 minutes from Main Gate',
      routes: [],
      info: [
        { office: 'General Education Department', floor: '1st Floor' },
        { office: 'Faculty Lounge', floor: '2nd Floor' },
        'Lecture halls on every floor',
        'Public restrooms each floor'
      ],
      floors: [
        {
          label: '1st Floor',
          rooms: [
            { room: '101', name: 'Lecture Hall A', use: 'Classroom' },
            { room: '102', name: 'GE Department Office', use: 'Administrative' },
            { room: '103', name: 'Classroom', use: 'Classroom' }
          ]
        },
        {
          label: '2nd Floor',
          rooms: [
            { room: '201', name: 'Faculty Lounge', use: 'Faculty' },
            { room: '202', name: 'Classroom', use: 'Classroom' },
            { room: '203', name: 'Classroom', use: 'Classroom' }
          ]
        },
        {
          label: '3rd Floor',
          rooms: [
            { room: '301', name: 'Lecture Hall B', use: 'Classroom' },
            { room: '302', name: 'Seminar Room', use: 'Meeting' }
          ]
        }
      ],
      entrances: [
        'Front entrance (quadrangle side)',
        'Side entrance (next to the bulletin board)'
      ],
      landmarks: [
        'Central campus pathway',
        'Adjacent to the CCS Building',
        'Near the Administration Building'
      ]
    },
    {
      id: 3,
      name: 'Engineering Building',
      category: 'Academic',
      desc: 'Houses Civil, Mechanical, and Electronics Engineering programs with labs and workshops.',
      lat: 13.4056,
      lng: 123.3734,
      img: '/img/Camarines-sur-polytechnic-colleges.png',
      guestAccess: false,
      walkTime: '7-9 minutes from Main Gate',
      routes: [],
      info: [
        { office: 'Dean of Engineering', floor: '2nd Floor' },
        { office: 'Civil Engineering Workshop', floor: 'Ground Floor' },
        { office: 'Electronics Lab', floor: '2nd Floor' },
        'Heavy-equipment storage at the rear yard'
      ],
      floors: [
        {
          label: 'Ground Floor',
          rooms: [
            { room: 'EG-01', name: 'Civil Engineering Workshop', use: 'Workshop' },
            { room: 'EG-02', name: 'Materials Testing Lab', use: 'Laboratory' },
            { room: 'EG-03', name: 'Lecture Room', use: 'Classroom' }
          ]
        },
        {
          label: '2nd Floor',
          rooms: [
            { room: 'E-201', name: "Dean's Office", use: 'Administrative' },
            { room: 'E-202', name: 'Electronics Lab', use: 'Laboratory' },
            { room: 'E-203', name: 'Lecture Hall', use: 'Classroom' }
          ]
        }
      ],
      entrances: [
        'Main entrance (front)',
        'Workshop bay entrance (rear)',
        'Emergency exit (side)'
      ],
      landmarks: [
        'Near the campus motor pool',
        'Adjacent to the parking area',
        'Across from the Gymnasium'
      ]
    },
    {
      id: 4,
      name: 'Administration Building',
      category: 'Administrative',
      desc: 'Central administrative headquarters housing the Registrar, Cashier, and Office of the President.',
      lat: 13.40613,
      lng: 123.37441,
      img: '/img/Camarines-sur-polytechnic-colleges.png',
      guestAccess: true,
      walkTime: '5-7 minutes from Main Gate',
      routes: [],
      info: [
        { office: "Registrar's Office", floor: 'Ground Floor' },
        { office: 'Cashier', floor: 'Ground Floor' },
        { office: 'Admissions Office', floor: 'Ground Floor' },
        { office: 'Office of the President', floor: '2nd Floor' },
        { office: 'VP for Academic Affairs', floor: '2nd Floor' },
        { office: 'Human Resources', floor: '2nd Floor' },
        'Public-facing service counters on the ground floor'
      ],
      floors: [
        {
          label: 'Ground Floor',
          rooms: [
            { room: 'A-101', name: "Registrar's Office", use: 'Student Services' },
            { room: 'A-102', name: 'Cashier', use: 'Payments' },
            { room: 'A-103', name: 'Admissions Office', use: 'Student Services' },
            { room: 'A-104', name: 'Information Desk', use: 'Reception' }
          ]
        },
        {
          label: '2nd Floor',
          rooms: [
            { room: 'A-201', name: 'Office of the President', use: 'Executive' },
            { room: 'A-202', name: 'VP for Academic Affairs', use: 'Executive' },
            { room: 'A-203', name: 'Human Resources', use: 'Administrative' },
            { room: 'A-204', name: 'Conference Room', use: 'Meeting' }
          ]
        }
      ],
      entrances: [
        'Main lobby entrance (front)',
        'Side entrance (Registrar queue line)',
        'Staff-only entrance (rear)'
      ],
      landmarks: [
        'Across from the Flagpole Quadrangle',
        'Near the central bulletin board',
        'Adjacent to the Library Building'
      ]
    },
    {
      id: 5,
      name: 'Library Building',
      category: 'Facilities',
      desc: 'Academic library with reading rooms, OPAC stations, and reference collections.',
      lat: 13.40630,
      lng: 123.37525,
      img: '/img/Camarines-sur-polytechnic-colleges.png',
      guestAccess: true,
      walkTime: '5-7 minutes from Main Gate',
      routes: [],
      info: [
        { office: 'Library Information Desk', floor: 'Ground Floor' },
        { office: 'Reference Section', floor: 'Ground Floor' },
        { office: 'Periodicals & Thesis Section', floor: '2nd Floor' },
        'Quiet-study areas on the 2nd floor',
        'Open Mon-Fri 8:00 AM - 5:00 PM'
      ],
      floors: [
        {
          label: 'Ground Floor',
          rooms: [
            { room: 'L-101', name: 'Information Desk', use: 'Reception' },
            { room: 'L-102', name: 'Reference Section', use: 'Reading Room' },
            { room: 'L-103', name: 'Circulation Section', use: 'Book Loans' },
            { room: 'L-104', name: 'OPAC Workstations', use: 'Computer Access' }
          ]
        },
        {
          label: '2nd Floor',
          rooms: [
            { room: 'L-201', name: 'Periodicals Section', use: 'Reading Room' },
            { room: 'L-202', name: 'Thesis & Special Collections', use: 'Archive' },
            { room: 'L-203', name: 'Quiet Study Room', use: 'Reading Room' }
          ]
        }
      ],
      entrances: [
        'Main entrance (security check)',
        'Emergency exit (rear)'
      ],
      landmarks: [
        'Adjacent to the Administration Building',
        'Near the central pathway split',
        'Facing the Flagpole Quadrangle'
      ]
    },
    {
      id: 6,
      name: 'Gymnasium',
      category: 'Facilities',
      desc: 'Multi-purpose gymnasium hosting sports events, assemblies, and large gatherings.',
      lat: 13.40585,
      lng: 123.37522,
      img: '/img/Camarines-sur-polytechnic-colleges.png',
      guestAccess: true,
      walkTime: '7-10 minutes from Main Gate',
      routes: [],
      info: [
        { office: 'Sports Office', floor: 'Ground Floor' },
        { office: 'Equipment Room', floor: 'Ground Floor' },
        'Basketball / volleyball courts',
        'Bleacher seating on both sides',
        'Open courts for intramurals and ceremonies'
      ],
      floors: [
        {
          label: 'Ground Floor',
          rooms: [
            { room: 'G-01', name: 'Main Court', use: 'Sports / Events' },
            { room: 'G-02', name: 'Sports Office', use: 'Administrative' },
            { room: 'G-03', name: 'Equipment Storage', use: 'Storage' },
            { room: 'G-04', name: 'Locker Rooms', use: 'Athlete Facilities' }
          ]
        }
      ],
      entrances: [
        'Main double-door entrance (front)',
        'Side entrance (athlete entry)',
        'Emergency exits (rear and sides)'
      ],
      landmarks: [
        'At the end of the main pathway',
        'Across from the Engineering Building',
        'Near the track and field oval'
      ]
    },

    // --- Promoted admin-added buildings (Milestone 3 seed reconciliation) ---
    // Captured from live MySQL so switching /buildings and /map to Supabase
    // does not drop real campus buildings. These were created through the admin
    // building form and carry sparse details (image only); that is faithful to
    // their current stored data, not a placeholder. database/seed.js assembles
    // `details` from these fields, so only `img` is set here -> {"img":"..."}.
    {
      id: 7,
      name: 'Canteen / Cafeteria',
      category: 'Facilities',
      desc: 'The main campus dining facility offering affordable meals.',
      lat: 13.40625,
      lng: 123.37515,
      img: '/img/Camarines-sur-polytechnic-colleges.png'
    },
    {
      id: 8,
      name: 'College of Health Sciences (CHS)',
      category: 'Academic',
      desc: 'Houses the Bachelor of Science in Nursing and other health-related programs.',
      lat: 13.40539,
      lng: 123.37750,
      img: '/img/Camarines-sur-polytechnic-colleges.png'
    },
    {
      id: 9,
      name: 'Green Building',
      category: 'Academic',
      desc: 'Dedicated to engineering programs with drawing rooms, workshops, and labs.',
      lat: 13.40600,
      lng: 123.37652,
      img: '/img/Camarines-sur-polytechnic-colleges.png'
    },
    {
      id: 10,
      name: 'Information and Communications Technology Unit (ICTU)',
      category: 'Administrative',
      desc: 'Administers the technical and systems development of institutional processes involving information systems, network, technical services, and web development.',
      lat: 13.40558,
      lng: 123.37471,
      img: '/img/Camarines-sur-polytechnic-colleges.png'
    },
    {
      id: 11,
      name: 'Medical & Dental Clinic',
      category: 'Facilities',
      desc: 'Provides basic health and dental services to students.',
      lat: 13.40616,
      lng: 123.37717,
      img: '/img/Camarines-sur-polytechnic-colleges.png'
    },
    {
      id: 12,
      name: 'Auditorium',
      category: 'Facilities',
      desc: 'Large venue for public events, seminars, and ceremonies.',
      lat: 13.40630,
      lng: 123.37560,
      img: '/img/Camarines-sur-polytechnic-colleges.png'
    },
    // BE.2: thirteenth canonical building. The College of Arts and Sciences was
    // originally created through the admin UI, so it never existed in this
    // static roster — a fresh seed produced 12 buildings and left the `cas`
    // route node with building_id NULL (unroutable). It is now canonical here,
    // so the seeded dataset reproduces the verified 13-destination baseline.
    //
    // OWNER-CONFIRMED MINIMUM ONLY. Every unknown field below is deliberately
    // EMPTY: no verified entrance, floor, room, landmark, walk time, or media
    // exists yet and BE.2 must not invent any. `img` stays null so the seed's
    // details.img -> buildings.image_url backfill leaves image_url NULL and no
    // Cloudinary media is assigned. Populate these only from owner-approved data.
    {
      id: 13,
      name: 'College of Arts and Sciences',
      category: 'Academic',
      desc: 'College of Arts and Sciences (CAS)',
      lat: 13.40594916,
      lng: 123.37704274,
      img: null,
      guestAccess: null,
      walkTime: null,
      routes: [],
      info: [],
      floors: [],
      entrances: [],
      landmarks: []
    }
  ],

  // ---- Contact Info ----
  contact: {
    address: 'San Miguel, Nabua, Camarines Sur 4434',
    phone: '(054) 288 4421 to 23',
    email: 'mail@cspc.edu.ph',
    website: 'https://cspc.edu.ph',
    hours: 'Monday - Friday, 8:00 AM - 5:00 PM'
  }
};

module.exports = CampuSphereData;
