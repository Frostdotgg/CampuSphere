/* ========================================
   CampuSphere — Page Controller
   Handles Landing, Home, and About pages
   ======================================== */



/**
 * GET / — Landing Page
 */
exports.landing = (req, res) => {
  res.render('landing', {
    title: 'CampuSphere | CSPC Virtual Map Tour',
    description: 'CampuSphere — Navigate CSPC with ease. An interactive virtual campus map tour for Camarines Sur Polytechnic Colleges.'
  });
};

/**
 * GET /privacy — Pilot privacy notice (M12.P1-R8).
 *
 * Deliberately ANONYMOUS: a privacy notice that only signed-in users can read
 * is useless to someone deciding whether to sign in at all. It renders no
 * session data and performs no database access.
 */
exports.privacy = (req, res) => {
  res.render('privacy', {
    title: 'CampuSphere | Privacy Notice',
    description: 'How the CampuSphere pilot at Camarines Sur Polytechnic Colleges collects and uses personal information.'
  });
};

/**
 * GET /home — Home Dashboard
 */
exports.home = (req, res) => {
  res.render('home', {
    title: 'CampuSphere | Home Dashboard',
    description: 'CampuSphere Dashboard — Explore the CSPC campus interactively with maps, buildings, events, and more.',
    activeTab: 'tabHome'
  });
};

/**
 * GET /about — About Us
 */
exports.about = (req, res) => {
  res.render('about', {
    title: 'CampuSphere | About Us',
    description: 'Learn about the CampuSphere team and the CSPC virtual map tour project.',
    activeTab: 'tabAbout'
  });
};

