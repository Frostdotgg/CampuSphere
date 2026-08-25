'use strict';

const repository = require('../repositories/roomScheduleDocumentRepository');
const scheduleDataSource = require('../config/scheduleDataSource');
const mapRuntime = require('../config/mapRuntime');
const V = require('../utils/adminValidation');
const { toPublicDocument } = require('../utils/roomScheduleDocument');
const { logServerError } = require('../utils/serverLog');
const BUILDING_PAGE_SIZE = 200;
const BUILDING_DOCUMENT_MAX = 2000;

function privateNoStore(res) {
  res.set('Cache-Control', 'private, no-store');
  res.set('Pragma', 'no-cache');
}

exports.listForBuilding = async (req, res) => {
  privateNoStore(res);
  if (scheduleDataSource.isSupabase() !== mapRuntime.isBuildingSupabase()) {
    return res.status(409).json({
      success: false,
      message: 'Room schedules are unavailable because the configured building and schedule sources differ.'
    });
  }
  const buildingId = V.parseRouteId(req.params.id);
  if (buildingId === null) return res.status(400).json({ success: false, message: 'Invalid building id.' });
  try {
    if (!(await repository.buildingExists(buildingId))) {
      return res.status(404).json({ success: false, message: 'Building not found.' });
    }
    const documents = [];
    let total = 0;
    while (documents.length < BUILDING_DOCUMENT_MAX) {
      const result = await repository.listDocuments({
        buildingId,
        limit: BUILDING_PAGE_SIZE,
        offset: documents.length
      });
      total = Number(result.total) || 0;
      if (total > BUILDING_DOCUMENT_MAX) {
        return res.status(422).json({
          success: false,
          message: 'This building has too many room schedules to display safely.'
        });
      }
      documents.push(...result.documents);
      if (result.documents.length < BUILDING_PAGE_SIZE || documents.length >= total) break;
    }
    if (documents.length !== total) throw new Error('Incomplete room schedule pagination result.');
    return res.json({ success: true, documents: documents.map(toPublicDocument), total });
  } catch (error) {
    logServerError('roomScheduleDocuments.listForBuilding', req);
    return res.status(500).json({ success: false, message: 'Unable to load room schedules.' });
  }
};

exports.getDocument = async (req, res) => {
  privateNoStore(res);
  const id = V.parseRouteId(req.params.id);
  if (id === null) return res.status(400).json({ success: false, message: 'Invalid schedule id.' });
  try {
    const document = await repository.findDocumentById(id);
    if (!document) return res.status(404).json({ success: false, message: 'Room schedule not found.' });
    return res.json({ success: true, document: toPublicDocument(document) });
  } catch (error) {
    logServerError('roomScheduleDocuments.get', req);
    return res.status(500).json({ success: false, message: 'Unable to load the room schedule.' });
  }
};
