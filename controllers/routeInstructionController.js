'use strict';

const service = require('../services/routeInstructionService');
const rules = require('../utils/routeInstructions');
const auditService = require('../services/auditService');
function selection(req) {
  const id = rules.validId(req.params.destinationBuildingId);
  const { mode, direction } = req.query;
  return id && rules.isAdditionalList(mode, direction) && Object.keys(req.query).every(key => ['mode', 'direction'].includes(key))
    ? { id, mode, direction } : null;
}
exports.get = async (req, res) => {
  const selected = selection(req);
  if (!selected) return res.status(400).json({ success: false, message: 'Select a valid mode and direction. Vehicle destination steps use the existing route Steps editor.' });
  try {
    if (!await service.buildingExists(selected.id)) return res.status(404).json({ success: false, message: 'Unknown destination.' });
    const steps = await service.getList(selected.id, selected.mode, selected.direction);
    return res.json({ success: true, steps, mode: selected.mode, direction: selected.direction });
  } catch (_) { return res.status(503).json({ success: false, message: rules.UNAVAILABLE_MESSAGE }); }
};
exports.put = async (req, res) => {
  const selected = selection(req), validation = rules.validateSteps(req.body, { strictFields: true });
  if (!selected || !validation.ok) return res.status(400).json({ success: false, message: selected ? validation.message : 'Select a valid mode and direction.' });
  try {
    if (!await service.buildingExists(selected.id)) return res.status(404).json({ success: false, message: 'Unknown destination.' });
    await service.replaceList(selected.id, selected.mode, selected.direction, validation.value);
    const actor = req.session && req.session.user || {};
    auditService.record({ event_type: 'admin_mutation', action: 'admin.route.instructions.update', outcome: 'success',
      actor_user_id: actor.id, actor_role: actor.role, target_type: 'route_instructions', target_id: selected.id,
      message: 'Admin updated route instructions.' }).catch(() => {});
    return res.json({ success: true, steps: validation.value, mode: selected.mode, direction: selected.direction });
  } catch (_) { return res.status(503).json({ success: false, message: 'Route instructions could not be saved.' }); }
};
