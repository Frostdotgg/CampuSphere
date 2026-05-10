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
    description: 'CampusSphere — Navigate CSPC with ease. An interactive virtual campus map tour for Camarines Sur Polytechnic Colleges.'
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
    description: 'Learn about the CampusSphere team and the CSPC virtual map tour project.',
    activeTab: 'tabAbout'
  });
};

