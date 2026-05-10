/* ========================================
   CampuSphere — Map Controller
   Handles the Campus Map page
   ======================================== */

/**
 * GET /map — Interactive Campus Map
 */
exports.index = (req, res) => {
  res.render('map', {
    title: 'CampuSphere | Campus Map',
    description: 'Navigate the CSPC campus with our interactive map.',
    activeTab: 'tabMap'
  });
};
