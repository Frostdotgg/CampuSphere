/* ========================================
   CampuSphere — Friendly Building Additional-Details Editor (M12.P1-D5)

   ONE dependency-free module that replaces the raw "Additional Details
   (JSON)" textarea in the admin Building modal with structured controls,
   while preserving the EXACT existing `details` storage contract:

     - details is submitted as a canonical JSON string or null;
     - blank new details serialize to null;
     - supported keys are walkTime, entrances, landmarks, floors, info;
     - rooms are {room,name,use}; legacy {num,use} rooms keep their original
       identifier key on an untouched or edited round trip;
     - info items are strings or {office,floor} objects; a blanked optional
       floor removes only the floor key while retaining the object shape;
     - img, guestAccess, routes, every unknown valid top-level key, unknown
       nested keys, and item ordering are preserved verbatim;
     - a supported key with a valid but unsupported shape is shown as a
       read-only "Legacy data preserved" section and serialized unchanged;
     - unsupported items inside mixed arrays are preserved read-only in
       their original positions;
     - malformed JSON / a non-object root fails closed: saving is blocked
       with one fixed actionable message, and the stored value is NEVER
       replaced with {}, null, or empty fields.

   Prototype safety: parsed input is only ever traversed with own-property
   checks, and every output object is assembled key-by-key with
   Object.defineProperty, so __proto__ / constructor / prototype keys are
   plain DATA and can never mutate Object.prototype or the output's
   prototype chain.

   Layers:
     - PURE (Node-testable, no DOM): parseDetails(raw) -> model,
       serializeModel(model) -> canonical string/null, with the same bounds
       the server enforces (utils/adminValidation.validateDetails).
     - DOM (browser): createEditor({ root, statusRegion }) mounts the
       structured controls and exposes load / clear / reset / serialize /
       focusFirstError / isBlocked. All stored/user values reach the DOM
       through createElement / setAttribute / textContent — never innerHTML.

   Loadable as CommonJS (probes) and as exactly one browser global:
   window.CampuSphereBuildingDetailsEditor. No build step, no dependency.
   ======================================== */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (root) {
        root.CampuSphereBuildingDetailsEditor = api;
    }
}(typeof window !== 'undefined' ? window : null, function () {
    'use strict';

    // Server bounds mirrored from utils/adminValidation.js (validateDetails).
    var LIMITS = {
        MAX_SERIALIZED: 10000,
        MAX_DEPTH: 8,
        MAX_NODES: 500,
        MAX_KEY_LEN: 100,
        MAX_STRING_LEN: 5000
    };

    // The supported editable keys, in canonical append order for sections the
    // admin adds to a details object that never carried them.
    var SUPPORTED_KEYS = ['walkTime', 'entrances', 'landmarks', 'floors', 'info'];

    var MESSAGES = {
        // The ONE fixed actionable parse-failure message (blocks saving).
        PARSE_BLOCKED: 'The stored additional details could not be read as JSON. ' +
            'Saving is disabled so the existing stored value is never overwritten. ' +
            'Correct the stored details data first, then reopen this building.',
        // Bounds messages mirror the server's fixed texts exactly.
        TOO_DEEP: 'Details JSON is nested too deeply.',
        TOO_MANY: 'Details JSON has too many fields.',
        KEY_TOO_LONG: 'A details field name is too long.',
        STRING_TOO_LONG: 'A details value is too long.',
        TOO_LARGE: 'Details JSON is too large.',
        // Field-level validation.
        BLANK_ENTRANCE: 'Entrance text cannot be blank. Remove the entrance instead.',
        BLANK_LANDMARK: 'Landmark text cannot be blank. Remove the landmark instead.',
        BLANK_FLOOR_LABEL: 'Floor label cannot be blank. Remove the floor instead.',
        BLANK_ROOM_ID: 'Room number/code cannot be blank.',
        BLANK_ROOM_NAME: 'Room name cannot be blank.',
        BLANK_ROOM_USE: 'Room use cannot be blank.',
        BLANK_INFO_TEXT: 'Information text cannot be blank. Remove the item instead.',
        BLANK_INFO_OFFICE: 'Information text cannot be blank. Remove the item instead.'
    };

    /* ================= prototype-safe primitives ================= */

    function hasOwn(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
    }

    function isPlainObject(v) {
        return v !== null && typeof v === 'object' && !Array.isArray(v);
    }

    // Own-key list. Object.keys returns own enumerable keys only, which
    // includes an own '__proto__' DATA property created by JSON.parse.
    function ownKeys(obj) {
        return Object.keys(obj);
    }

    // Assemble an object from ordered [key, value] pairs without ever
    // triggering the '__proto__' setter path.
    function buildObject(pairs) {
        var out = {};
        for (var i = 0; i < pairs.length; i++) {
            Object.defineProperty(out, pairs[i][0], {
                value: pairs[i][1],
                enumerable: true,
                writable: true,
                configurable: true
            });
        }
        return out;
    }

    // Detached deep clone through the JSON round trip (JSON.parse creates
    // own data properties only — never a live prototype link).
    function cloneJson(value) {
        return JSON.parse(JSON.stringify(value));
    }

    /* ================= pure model construction ================= */

    function emptyModel() {
        return {
            blocked: false,
            originalOrder: [],
            passthrough: [],       // [key, rawValue] pairs for unknown top-level keys
            walkTime: { present: false, legacy: false, originalRaw: null, original: '', value: '' },
            entrances: emptyListSection(),
            landmarks: emptyListSection(),
            floors: { present: false, legacy: false, originalRaw: null, items: [] },
            info: { present: false, legacy: false, originalRaw: null, items: [] }
        };
    }

    function emptyListSection() {
        return { present: false, legacy: false, originalRaw: null, items: [] };
    }

    function textItem(original) {
        return { kind: 'text', added: original === null, original: original, value: original === null ? '' : original };
    }

    function preservedItem(raw) {
        return { kind: 'preserved', raw: raw };
    }

    function classifyListSection(raw) {
        var section = emptyListSection();
        section.present = true;
        section.originalRaw = raw;
        if (!Array.isArray(raw)) {
            section.legacy = true;
            return section;
        }
        for (var i = 0; i < raw.length; i++) {
            if (typeof raw[i] === 'string') section.items.push(textItem(raw[i]));
            else section.items.push(preservedItem(raw[i]));
        }
        return section;
    }

    function classifyRoom(raw) {
        if (!isPlainObject(raw)) return preservedItem(raw);
        var keys = ownKeys(raw);
        var hasRoom = hasOwn(raw, 'room');
        var hasNum = hasOwn(raw, 'num');
        if (!hasRoom && !hasNum) return preservedItem(raw);
        if (hasRoom && typeof raw.room !== 'string') return preservedItem(raw);
        if (hasNum && typeof raw.num !== 'string') return preservedItem(raw);
        // Both identifier keys with CONFLICTING values is an ambiguous legacy
        // shape: preserve it read-only rather than guessing which value wins.
        if (hasRoom && hasNum && raw.room !== raw.num) return preservedItem(raw);
        if (hasOwn(raw, 'name') && typeof raw.name !== 'string') return preservedItem(raw);
        if (hasOwn(raw, 'use') && typeof raw.use !== 'string') return preservedItem(raw);

        var idKeys = hasRoom && hasNum ? ['room', 'num'] : (hasRoom ? ['room'] : ['num']);
        var extras = [];
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (k === 'room' || k === 'num' || k === 'name' || k === 'use') continue;
            extras.push([k, raw[k]]);
        }
        var idOriginal = hasRoom ? raw.room : raw.num;
        return {
            kind: 'room',
            added: false,
            idKeys: idKeys,
            keyOrder: keys.slice(),
            idOriginal: idOriginal,
            id: idOriginal,
            namePresent: hasOwn(raw, 'name'),
            nameOriginal: hasOwn(raw, 'name') ? raw.name : null,
            name: hasOwn(raw, 'name') ? raw.name : '',
            usePresent: hasOwn(raw, 'use'),
            useOriginal: hasOwn(raw, 'use') ? raw.use : null,
            use: hasOwn(raw, 'use') ? raw.use : '',
            extras: extras
        };
    }

    function newRoom() {
        return {
            kind: 'room', added: true, idKeys: ['room'], keyOrder: ['room', 'name', 'use'],
            idOriginal: null, id: '',
            namePresent: true, nameOriginal: null, name: '',
            usePresent: true, useOriginal: null, use: '',
            extras: []
        };
    }

    function classifyFloor(raw) {
        if (!isPlainObject(raw)) return preservedItem(raw);
        if (!hasOwn(raw, 'label') || typeof raw.label !== 'string') return preservedItem(raw);
        if (hasOwn(raw, 'rooms') && !Array.isArray(raw.rooms)) return preservedItem(raw);
        var keys = ownKeys(raw);
        var extras = [];
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (k === 'label' || k === 'rooms') continue;
            extras.push([k, raw[k]]);
        }
        var rooms = [];
        var rawRooms = hasOwn(raw, 'rooms') ? raw.rooms : [];
        for (var r = 0; r < rawRooms.length; r++) rooms.push(classifyRoom(rawRooms[r]));
        return {
            kind: 'floor',
            added: false,
            keyOrder: keys.slice(),
            roomsPresent: hasOwn(raw, 'rooms'),
            labelOriginal: raw.label,
            label: raw.label,
            extras: extras,
            rooms: rooms
        };
    }

    function newFloor() {
        return {
            kind: 'floor', added: true, keyOrder: ['label', 'rooms'], roomsPresent: true,
            labelOriginal: null, label: '', extras: [], rooms: []
        };
    }

    function classifyInfoItem(raw) {
        if (typeof raw === 'string') return textItem(raw);
        if (!isPlainObject(raw)) return preservedItem(raw);
        if (!hasOwn(raw, 'office') || typeof raw.office !== 'string') return preservedItem(raw);
        if (hasOwn(raw, 'floor') && typeof raw.floor !== 'string') return preservedItem(raw);
        var keys = ownKeys(raw);
        var extras = [];
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (k === 'office' || k === 'floor') continue;
            extras.push([k, raw[k]]);
        }
        return {
            kind: 'office',
            added: false,
            keyOrder: keys.slice(),
            officeOriginal: raw.office,
            office: raw.office,
            floorPresent: hasOwn(raw, 'floor'),
            floorOriginal: hasOwn(raw, 'floor') ? raw.floor : null,
            floor: hasOwn(raw, 'floor') ? raw.floor : '',
            extras: extras
        };
    }

    // A NEW info entry: plain text with an OPTIONAL location/floor. A filled
    // location produces the existing {office,floor} object shape; a blank one
    // produces a plain string, so info strings remain strings.
    function newInfoItem() {
        return {
            kind: 'new-info', added: true,
            text: '', floor: ''
        };
    }

    /**
     * Parse a stored details value (canonical JSON string, parsed jsonb
     * object, null, or blank) into the editable model.
     * @returns {{ok:true, model:object}|{ok:false, message:string}}
     */
    function parseDetails(raw) {
        var model = emptyModel();
        if (raw === undefined || raw === null) return { ok: true, model: model };

        var parsed;
        if (typeof raw === 'string') {
            var trimmed = raw.trim();
            if (trimmed === '') return { ok: true, model: model };
            try { parsed = JSON.parse(trimmed); }
            catch (e) { return { ok: false, message: MESSAGES.PARSE_BLOCKED }; }
        } else if (typeof raw === 'object') {
            try { parsed = cloneJson(raw); }
            catch (e) { return { ok: false, message: MESSAGES.PARSE_BLOCKED }; }
        } else {
            return { ok: false, message: MESSAGES.PARSE_BLOCKED };
        }

        if (!isPlainObject(parsed)) return { ok: false, message: MESSAGES.PARSE_BLOCKED };

        var keys = ownKeys(parsed);
        model.originalOrder = keys.slice();
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value = parsed[key];
            if (key === 'walkTime') {
                model.walkTime.present = true;
                model.walkTime.originalRaw = value;
                if (typeof value === 'string') {
                    model.walkTime.original = value;
                    model.walkTime.value = value;
                } else {
                    model.walkTime.legacy = true;
                }
            } else if (key === 'entrances') {
                model.entrances = classifyListSection(value);
            } else if (key === 'landmarks') {
                model.landmarks = classifyListSection(value);
            } else if (key === 'floors') {
                model.floors.present = true;
                model.floors.originalRaw = value;
                if (Array.isArray(value)) {
                    for (var f = 0; f < value.length; f++) model.floors.items.push(classifyFloor(value[f]));
                } else {
                    model.floors.legacy = true;
                }
            } else if (key === 'info') {
                model.info.present = true;
                model.info.originalRaw = value;
                if (Array.isArray(value)) {
                    for (var n = 0; n < value.length; n++) model.info.items.push(classifyInfoItem(value[n]));
                } else {
                    model.info.legacy = true;
                }
            } else {
                // img, guestAccess, routes, and every other top-level key —
                // including __proto__/constructor/prototype as plain data —
                // pass through verbatim.
                model.passthrough.push([key, value]);
            }
        }
        return { ok: true, model: model };
    }

    /* ================= pure serialization ================= */

    // Untouched values round-trip byte-for-byte; edited values are trimmed.
    function effectiveText(current, original) {
        if (original !== null && current === original) return original;
        return String(current === undefined || current === null ? '' : current).trim();
    }

    function err(message, path) {
        return { ok: false, message: message, path: path };
    }

    function serializeListSection(section, sectionName, blankMessage) {
        if (section.legacy) return { ok: true, present: section.present, value: section.originalRaw };
        var out = [];
        for (var i = 0; i < section.items.length; i++) {
            var item = section.items[i];
            if (item.kind === 'preserved') { out.push(item.raw); continue; }
            var v = effectiveText(item.value, item.original);
            if (v === '') return err(blankMessage, [sectionName, i, 'text']);
            out.push(v);
        }
        return { ok: true, present: section.present, value: out };
    }

    function serializeRoom(item, fi, ri) {
        if (item.kind === 'preserved') return { ok: true, value: item.raw };
        var id = effectiveText(item.id, item.idOriginal);
        if (id === '') return err(MESSAGES.BLANK_ROOM_ID, ['floors', fi, 'rooms', ri, 'id']);
        var name = effectiveText(item.name, item.nameOriginal);
        var use = effectiveText(item.use, item.useOriginal);
        // Existing values are never silently discarded; a NEW room requires
        // the full {room,name,use} shape.
        if ((item.namePresent || item.added) && name === '') {
            return err(MESSAGES.BLANK_ROOM_NAME, ['floors', fi, 'rooms', ri, 'name']);
        }
        if ((item.usePresent || item.added) && use === '') {
            return err(MESSAGES.BLANK_ROOM_USE, ['floors', fi, 'rooms', ri, 'use']);
        }

        var pairs = [];
        var emitted = {};
        for (var k = 0; k < item.keyOrder.length; k++) {
            var key = item.keyOrder[k];
            if (hasOwn(emitted, key)) continue;
            if (key === 'room' || key === 'num') {
                if (item.idKeys.indexOf(key) !== -1) { pairs.push([key, id]); Object.defineProperty(emitted, key, { value: true, enumerable: true, writable: true, configurable: true }); }
            } else if (key === 'name') {
                if (item.namePresent || name !== '') { pairs.push(['name', name]); Object.defineProperty(emitted, 'name', { value: true, enumerable: true, writable: true, configurable: true }); }
            } else if (key === 'use') {
                if (item.usePresent || use !== '') { pairs.push(['use', use]); Object.defineProperty(emitted, 'use', { value: true, enumerable: true, writable: true, configurable: true }); }
            } else {
                for (var x = 0; x < item.extras.length; x++) {
                    if (item.extras[x][0] === key) { pairs.push([key, item.extras[x][1]]); break; }
                }
            }
        }
        // Keys the original shape lacked but the admin filled in (a legacy
        // {num,use} room gaining a name) append in room -> name -> use order.
        if (!hasOwn(emitted, 'name') && !item.namePresent && name !== '') pairs.push(['name', name]);
        if (!hasOwn(emitted, 'use') && !item.usePresent && use !== '') pairs.push(['use', use]);
        return { ok: true, value: buildObject(pairs) };
    }

    function serializeFloors(section) {
        if (section.legacy) return { ok: true, present: section.present, value: section.originalRaw };
        var out = [];
        for (var i = 0; i < section.items.length; i++) {
            var item = section.items[i];
            if (item.kind === 'preserved') { out.push(item.raw); continue; }
            var label = effectiveText(item.label, item.labelOriginal);
            if (label === '') return err(MESSAGES.BLANK_FLOOR_LABEL, ['floors', i, 'label']);
            var rooms = [];
            for (var r = 0; r < item.rooms.length; r++) {
                var res = serializeRoom(item.rooms[r], i, r);
                if (!res.ok) return res;
                rooms.push(res.value);
            }
            var pairs = [];
            var wroteLabel = false;
            var wroteRooms = false;
            for (var k = 0; k < item.keyOrder.length; k++) {
                var key = item.keyOrder[k];
                if (key === 'label') { if (!wroteLabel) { pairs.push(['label', label]); wroteLabel = true; } }
                else if (key === 'rooms') { if (!wroteRooms) { pairs.push(['rooms', rooms]); wroteRooms = true; } }
                else {
                    for (var x = 0; x < item.extras.length; x++) {
                        if (item.extras[x][0] === key) { pairs.push([key, item.extras[x][1]]); break; }
                    }
                }
            }
            if (!wroteLabel) pairs.push(['label', label]);
            if (!wroteRooms && (item.roomsPresent || rooms.length > 0)) pairs.push(['rooms', rooms]);
            out.push(buildObject(pairs));
        }
        return { ok: true, present: section.present, value: out };
    }

    function serializeInfo(section) {
        if (section.legacy) return { ok: true, present: section.present, value: section.originalRaw };
        var out = [];
        for (var i = 0; i < section.items.length; i++) {
            var item = section.items[i];
            if (item.kind === 'preserved') { out.push(item.raw); continue; }
            if (item.kind === 'text') {
                var v = effectiveText(item.value, item.original);
                if (v === '') return err(MESSAGES.BLANK_INFO_TEXT, ['info', i, 'text']);
                out.push(v);
            } else if (item.kind === 'new-info') {
                var text = String(item.text === undefined || item.text === null ? '' : item.text).trim();
                var loc = String(item.floor === undefined || item.floor === null ? '' : item.floor).trim();
                if (text === '') return err(MESSAGES.BLANK_INFO_TEXT, ['info', i, 'text']);
                if (loc === '') out.push(text);
                else out.push(buildObject([['office', text], ['floor', loc]]));
            } else { // 'office'
                var office = effectiveText(item.office, item.officeOriginal);
                if (office === '') return err(MESSAGES.BLANK_INFO_OFFICE, ['info', i, 'office']);
                var floorVal = effectiveText(item.floor, item.floorOriginal);
                var pairs = [];
                var wroteOffice = false;
                var wroteFloor = false;
                for (var k = 0; k < item.keyOrder.length; k++) {
                    var key = item.keyOrder[k];
                    if (key === 'office') { if (!wroteOffice) { pairs.push(['office', office]); wroteOffice = true; } }
                    else if (key === 'floor') {
                        // Blanking the optional floor removes ONLY the floor
                        // key; the item keeps its object shape.
                        if (!wroteFloor && floorVal !== '') { pairs.push(['floor', floorVal]); }
                        wroteFloor = true;
                    } else {
                        for (var x = 0; x < item.extras.length; x++) {
                            if (item.extras[x][0] === key) { pairs.push([key, item.extras[x][1]]); break; }
                        }
                    }
                }
                if (!wroteOffice) pairs.push(['office', office]);
                if (!wroteFloor && floorVal !== '') pairs.push(['floor', floorVal]);
                out.push(buildObject(pairs));
            }
        }
        return { ok: true, present: section.present, value: out };
    }

    // Mirror of the server's bounds walk (utils/adminValidation.validateDetails).
    function checkBounds(parsed) {
        var nodes = 0;
        function walk(node, depth) {
            if (depth > LIMITS.MAX_DEPTH) return MESSAGES.TOO_DEEP;
            if (++nodes > LIMITS.MAX_NODES) return MESSAGES.TOO_MANY;
            if (typeof node === 'string') {
                if (node.length > LIMITS.MAX_STRING_LEN) return MESSAGES.STRING_TOO_LONG;
                return null;
            }
            if (node === null || typeof node === 'number' || typeof node === 'boolean') return null;
            if (Array.isArray(node)) {
                for (var i = 0; i < node.length; i++) {
                    var e = walk(node[i], depth + 1);
                    if (e) return e;
                }
                return null;
            }
            if (typeof node === 'object') {
                var keys = ownKeys(node);
                for (var k = 0; k < keys.length; k++) {
                    if (keys[k].length > LIMITS.MAX_KEY_LEN) return MESSAGES.KEY_TOO_LONG;
                    var e2 = walk(node[keys[k]], depth + 1);
                    if (e2) return e2;
                }
                return null;
            }
            return MESSAGES.TOO_LARGE;
        }
        return walk(parsed, 1);
    }

    /**
     * Serialize the model back to the storage contract: a canonical JSON
     * string, or null when the result carries no keys at all.
     * @returns {{ok:true, value:(string|null)}|{ok:false, message, path}}
     */
    function serializeModel(model) {
        if (!model || model.blocked) return { ok: false, message: MESSAGES.PARSE_BLOCKED, path: null };

        // Validate + assemble each supported section first (render order),
        // so the first visible invalid field is the one reported.
        var walkTimeOut = null;
        if (model.walkTime.legacy) walkTimeOut = { present: true, value: model.walkTime.originalRaw };
        else {
            var wt = effectiveText(model.walkTime.value, model.walkTime.present ? model.walkTime.original : null);
            walkTimeOut = { present: model.walkTime.present, value: wt === '' ? undefined : wt };
        }
        var entrancesRes = serializeListSection(model.entrances, 'entrances', MESSAGES.BLANK_ENTRANCE);
        if (!entrancesRes.ok) return entrancesRes;
        var landmarksRes = serializeListSection(model.landmarks, 'landmarks', MESSAGES.BLANK_LANDMARK);
        if (!landmarksRes.ok) return landmarksRes;
        var floorsRes = serializeFloors(model.floors);
        if (!floorsRes.ok) return floorsRes;
        var infoRes = serializeInfo(model.info);
        if (!infoRes.ok) return infoRes;

        function sectionValue(key) {
            if (key === 'walkTime') return walkTimeOut.value;
            if (key === 'entrances') return entrancesRes.value;
            if (key === 'landmarks') return landmarksRes.value;
            if (key === 'floors') return floorsRes.value;
            if (key === 'info') return infoRes.value;
            return undefined;
        }
        function sectionHasContent(key) {
            var v = sectionValue(key);
            if (v === undefined) return false;
            if (Array.isArray(v)) return v.length > 0;
            return true;
        }

        // Original top-level order first; unknown keys verbatim.
        var pairs = [];
        var passIndex = 0;
        for (var i = 0; i < model.originalOrder.length; i++) {
            var key = model.originalOrder[i];
            if (SUPPORTED_KEYS.indexOf(key) !== -1) {
                var v = sectionValue(key);
                // A blanked walkTime removes the key; an emptied list keeps
                // its explicit [] (the key existed and the admin removed the
                // items, not the section).
                if (v !== undefined) pairs.push([key, v]);
            } else {
                // Passthrough entries were captured in original order.
                if (passIndex < model.passthrough.length && model.passthrough[passIndex][0] === key) {
                    pairs.push([key, model.passthrough[passIndex][1]]);
                    passIndex++;
                }
            }
        }
        // Any remaining passthrough (defensive; order capture is 1:1).
        for (; passIndex < model.passthrough.length; passIndex++) pairs.push(model.passthrough[passIndex]);
        // Newly added supported sections append in canonical order.
        for (var s = 0; s < SUPPORTED_KEYS.length; s++) {
            var sk = SUPPORTED_KEYS[s];
            if (model.originalOrder.indexOf(sk) !== -1) continue;
            if (sectionHasContent(sk)) pairs.push([sk, sectionValue(sk)]);
        }

        if (pairs.length === 0) return { ok: true, value: null };

        var outObj = buildObject(pairs);
        var boundsErr = checkBounds(outObj);
        if (boundsErr) return { ok: false, message: boundsErr, path: null };
        var serialized = JSON.stringify(outObj);
        if (serialized.length > LIMITS.MAX_SERIALIZED) {
            return { ok: false, message: MESSAGES.TOO_LARGE, path: null };
        }
        return { ok: true, value: serialized };
    }

    /* ================= DOM layer ================= */

    function createEditor(opts) {
        var rootEl = opts && opts.root ? opts.root : null;
        var statusEl = opts && opts.statusRegion ? opts.statusRegion : null;
        if (!rootEl || typeof document === 'undefined') {
            throw new Error('CampuSphereBuildingDetailsEditor.createEditor requires a root element.');
        }

        var model = emptyModel();
        var lastLoadedRaw = null;
        var fieldSeq = 0;

        function announce(text) {
            if (statusEl) statusEl.textContent = text;
        }

        function el(tag, className, text) {
            var node = document.createElement(tag);
            if (className) node.className = className;
            if (text !== undefined) node.textContent = text;
            return node;
        }

        function clearErrors() {
            var errs = rootEl.querySelectorAll('.bde-field-error');
            for (var i = 0; i < errs.length; i++) {
                errs[i].textContent = '';
                errs[i].hidden = true;
            }
            var bad = rootEl.querySelectorAll('[aria-invalid="true"]');
            for (var b = 0; b < bad.length; b++) bad[b].removeAttribute('aria-invalid');
        }

        function markInvalid(input, message) {
            if (!input) return;
            input.setAttribute('aria-invalid', 'true');
            var errNode = input._bdeError;
            if (errNode) {
                errNode.textContent = message;
                errNode.hidden = false;
            }
        }

        // Labelled input + inline error node, all references kept on the
        // element (never in HTML). `bind` receives the input so the model
        // item can store a live reference for focus/serialize. When
        // `requiredMessage` is set, blur validates the field immediately;
        // serialize() remains the authoritative validator either way.
        function field(labelText, value, bind, placeholder, requiredMessage) {
            var wrap = el('div', 'bde-field');
            var id = 'bde-f-' + (++fieldSeq);
            var label = el('label', 'bde-label', labelText);
            label.setAttribute('for', id);
            var input = document.createElement('input');
            input.type = 'text';
            input.id = id;
            input.className = 'ui-input bde-input';
            input.value = value === undefined || value === null ? '' : value;
            if (placeholder) input.setAttribute('placeholder', placeholder);
            var errNode = el('p', 'bde-field-error');
            errNode.id = id + '-err';
            errNode.hidden = true;
            input.setAttribute('aria-describedby', errNode.id);
            input._bdeError = errNode;
            input.addEventListener('input', function () {
                input.removeAttribute('aria-invalid');
                errNode.textContent = '';
                errNode.hidden = true;
            });
            input.addEventListener('blur', function () {
                // Validate-on-blur: tidy whitespace-only edits and surface a
                // blank required field immediately, beside the control.
                if (input.value.trim() === '' && input.value !== '') input.value = '';
                if (requiredMessage && input.value.trim() === '') {
                    markInvalid(input, requiredMessage);
                }
            });
            bind(input);
            wrap.appendChild(label);
            wrap.appendChild(input);
            wrap.appendChild(errNode);
            return wrap;
        }

        function removeButton(labelText, onClick) {
            var b = el('button', 'ui-button ui-button-outline ui-button-size-sm bde-remove', labelText);
            b.type = 'button';
            b.addEventListener('click', onClick);
            return b;
        }

        function addButton(labelText, onClick) {
            var b = el('button', 'ui-button ui-button-outline ui-button-size-sm bde-add', labelText);
            b.type = 'button';
            b.addEventListener('click', onClick);
            return b;
        }

        function preservedRow(raw, noun) {
            var row = el('div', 'bde-preserved');
            row.appendChild(el('span', 'bde-preserved__tag', 'Legacy ' + noun + ' preserved (not editable here)'));
            var code = el('code', 'bde-preserved__value');
            try { code.textContent = JSON.stringify(raw); } catch (e) { code.textContent = String(raw); }
            row.appendChild(code);
            return row;
        }

        function legacySection(fieldsetEl) {
            fieldsetEl.classList.add('bde-legacy');
            var note = el('p', 'bde-legacy-note', 'Legacy data preserved — this section has an older format and cannot be edited here. It is saved unchanged.');
            fieldsetEl.appendChild(note);
        }

        function focusFirstInput(container) {
            var input = container.querySelector('input');
            if (input && typeof input.focus === 'function') input.focus();
        }

        /* ---- section renderers ---- */

        function renderWalkTime() {
            var fs = el('fieldset', 'bde-section');
            fs.appendChild(el('legend', 'bde-legend', 'Walking time'));
            if (model.walkTime.legacy) { legacySection(fs); return fs; }
            fs.appendChild(field('Walking time from the Main Gate (optional)', model.walkTime.value, function (input) {
                model.walkTime._el = input;
                input.addEventListener('input', function () { model.walkTime.value = input.value; });
            }, 'e.g. 5-7 minutes from Main Gate'));
            return fs;
        }

        function renderTextList(section, legendText, noun, addLabel, blankMessage) {
            var fs = el('fieldset', 'bde-section');
            fs.appendChild(el('legend', 'bde-legend', legendText));
            if (section.legacy) { legacySection(fs); return fs; }
            var list = el('div', 'bde-list');
            var add = addButton(addLabel, function () {
                var item = textItem(null);
                section.items.push(item);
                section.present = true;
                var row = textRow(item);
                list.appendChild(row);
                announce(noun + ' added.');
                focusFirstInput(row);
            });

            function textRow(item) {
                var row = el('div', 'bde-row bde-row--single');
                row.appendChild(field(noun, item.value, function (input) {
                    item._el = input;
                    input.addEventListener('input', function () { item.value = input.value; });
                }, '', blankMessage));
                row.appendChild(removeButton('Remove ' + noun.toLowerCase(), function () {
                    var idx = section.items.indexOf(item);
                    if (idx !== -1) section.items.splice(idx, 1);
                    row.remove();
                    announce(noun + ' removed.');
                    add.focus();
                }));
                return row;
            }

            for (var i = 0; i < section.items.length; i++) {
                var item = section.items[i];
                if (item.kind === 'preserved') list.appendChild(preservedRow(item.raw, noun.toLowerCase() + ' item'));
                else list.appendChild(textRow(item));
            }
            fs.appendChild(list);
            fs.appendChild(add);
            void blankMessage; // message is applied at serialize time
            return fs;
        }

        function renderRoomRow(roomsList, floorItem, room, addRoomBtn) {
            if (room.kind === 'preserved') {
                var pr = preservedRow(room.raw, 'room');
                roomsList.appendChild(pr);
                return pr;
            }
            var row = el('div', 'bde-row bde-row--room');
            row.appendChild(field('Room number/code', room.id, function (input) {
                room._elId = input;
                input.addEventListener('input', function () { room.id = input.value; });
            }, 'e.g. GF-101', MESSAGES.BLANK_ROOM_ID));
            row.appendChild(field('Room name' + (room.namePresent || room.added ? '' : ' (optional)'), room.name, function (input) {
                room._elName = input;
                input.addEventListener('input', function () { room.name = input.value; });
            }, 'e.g. Programming Lab 1', (room.namePresent || room.added) ? MESSAGES.BLANK_ROOM_NAME : undefined));
            row.appendChild(field('Room use' + (room.usePresent || room.added ? '' : ' (optional)'), room.use, function (input) {
                room._elUse = input;
                input.addEventListener('input', function () { room.use = input.value; });
            }, 'e.g. Computer Lab', (room.usePresent || room.added) ? MESSAGES.BLANK_ROOM_USE : undefined));
            row.appendChild(removeButton('Remove room', function () {
                var idx = floorItem.rooms.indexOf(room);
                if (idx !== -1) floorItem.rooms.splice(idx, 1);
                row.remove();
                announce('Room removed.');
                addRoomBtn.focus();
            }));
            roomsList.appendChild(row);
            return row;
        }

        function renderFloorBlock(floorsList, section, item) {
            if (item.kind === 'preserved') {
                var pr = preservedRow(item.raw, 'floor');
                floorsList.appendChild(pr);
                return pr;
            }
            var block = el('fieldset', 'bde-floor');
            block.appendChild(el('legend', 'bde-legend bde-legend--sub', 'Floor'));
            block.appendChild(field('Floor label', item.label, function (input) {
                item._el = input;
                input.addEventListener('input', function () { item.label = input.value; });
            }, 'e.g. Ground Floor', MESSAGES.BLANK_FLOOR_LABEL));

            var roomsList = el('div', 'bde-list');
            var addRoomBtn = addButton('Add room', function () {
                var room = newRoom();
                item.rooms.push(room);
                var row = renderRoomRow(roomsList, item, room, addRoomBtn);
                announce('Room added.');
                focusFirstInput(row);
            });
            for (var r = 0; r < item.rooms.length; r++) renderRoomRow(roomsList, item, item.rooms[r], addRoomBtn);
            block.appendChild(roomsList);
            block.appendChild(addRoomBtn);
            block.appendChild(removeButton('Remove floor', function () {
                var idx = section.items.indexOf(item);
                if (idx !== -1) section.items.splice(idx, 1);
                block.remove();
                announce('Floor removed.');
                var addFloor = rootEl.querySelector('.bde-add--floor');
                if (addFloor) addFloor.focus();
            }));
            floorsList.appendChild(block);
            return block;
        }

        function renderFloors() {
            var fs = el('fieldset', 'bde-section');
            fs.appendChild(el('legend', 'bde-legend', 'Floors and rooms'));
            if (model.floors.legacy) { legacySection(fs); return fs; }
            var floorsList = el('div', 'bde-list');
            var add = addButton('Add floor', function () {
                var item = newFloor();
                model.floors.items.push(item);
                model.floors.present = true;
                var block = renderFloorBlock(floorsList, model.floors, item);
                announce('Floor added.');
                focusFirstInput(block);
            });
            add.classList.add('bde-add--floor');
            for (var i = 0; i < model.floors.items.length; i++) renderFloorBlock(floorsList, model.floors, model.floors.items[i]);
            fs.appendChild(floorsList);
            fs.appendChild(add);
            return fs;
        }

        function renderInfo() {
            var fs = el('fieldset', 'bde-section');
            fs.appendChild(el('legend', 'bde-legend', 'Additional information'));
            if (model.info.legacy) { legacySection(fs); return fs; }
            var list = el('div', 'bde-list');
            var add = addButton('Add information', function () {
                var item = newInfoItem();
                model.info.items.push(item);
                model.info.present = true;
                var row = newInfoRow(item);
                list.appendChild(row);
                announce('Information item added.');
                focusFirstInput(row);
            });

            function removeInfo(item, row) {
                var idx = model.info.items.indexOf(item);
                if (idx !== -1) model.info.items.splice(idx, 1);
                row.remove();
                announce('Information item removed.');
                add.focus();
            }

            function newInfoRow(item) {
                var row = el('div', 'bde-row bde-row--info');
                row.appendChild(field('Information text', item.text, function (input) {
                    item._el = input;
                    input.addEventListener('input', function () { item.text = input.value; });
                }, 'e.g. Wi-Fi available throughout the building', MESSAGES.BLANK_INFO_TEXT));
                row.appendChild(field('Location / floor (optional)', item.floor, function (input) {
                    item._elFloor = input;
                    input.addEventListener('input', function () { item.floor = input.value; });
                }, 'e.g. 2nd Floor'));
                row.appendChild(removeButton('Remove item', function () { removeInfo(item, row); }));
                return row;
            }

            function existingInfoRow(item) {
                var row;
                if (item.kind === 'text') {
                    row = el('div', 'bde-row bde-row--single');
                    row.appendChild(field('Information text', item.value, function (input) {
                        item._el = input;
                        input.addEventListener('input', function () { item.value = input.value; });
                    }, '', MESSAGES.BLANK_INFO_TEXT));
                } else { // 'office'
                    row = el('div', 'bde-row bde-row--info');
                    row.appendChild(field('Information text', item.office, function (input) {
                        item._el = input;
                        input.addEventListener('input', function () { item.office = input.value; });
                    }, '', MESSAGES.BLANK_INFO_OFFICE));
                    row.appendChild(field('Location / floor (optional)', item.floor, function (input) {
                        item._elFloor = input;
                        input.addEventListener('input', function () { item.floor = input.value; });
                    }));
                }
                row.appendChild(removeButton('Remove item', function () { removeInfo(item, row); }));
                return row;
            }

            for (var i = 0; i < model.info.items.length; i++) {
                var item = model.info.items[i];
                if (item.kind === 'preserved') { list.appendChild(preservedRow(item.raw, 'information item')); continue; }
                list.appendChild(existingInfoRow(item));
            }
            fs.appendChild(list);
            fs.appendChild(add);
            return fs;
        }

        function renderBlocked() {
            var box = el('div', 'bde-blocked');
            box.setAttribute('role', 'alert');
            box.appendChild(el('p', 'bde-blocked__msg', MESSAGES.PARSE_BLOCKED));
            rootEl.appendChild(box);
        }

        function render() {
            while (rootEl.firstChild) rootEl.removeChild(rootEl.firstChild);
            clearErrorsSafe();
            if (model.blocked) { renderBlocked(); return; }
            rootEl.appendChild(renderWalkTime());
            rootEl.appendChild(renderTextList(model.entrances, 'Entrances', 'Entrance', 'Add entrance', MESSAGES.BLANK_ENTRANCE));
            rootEl.appendChild(renderTextList(model.landmarks, 'Landmarks', 'Landmark', 'Add landmark', MESSAGES.BLANK_LANDMARK));
            rootEl.appendChild(renderFloors());
            rootEl.appendChild(renderInfo());
            var passCount = model.passthrough.length;
            if (passCount > 0) {
                rootEl.appendChild(el('p', 'bde-passthrough-note',
                    passCount + ' additional stored ' + (passCount === 1 ? 'field is' : 'fields are') + ' preserved unchanged (for example image or route metadata).'));
            }
        }

        function clearErrorsSafe() {
            try { clearErrors(); } catch (e) { /* detached root */ }
        }

        // Resolve the input element for a serialize-error path.
        function inputForPath(path) {
            if (!path) return null;
            var sect = path[0];
            if (sect === 'entrances' || sect === 'landmarks') {
                var it = model[sect].items[path[1]];
                return it ? it._el : null;
            }
            if (sect === 'info') {
                var inf = model.info.items[path[1]];
                if (!inf) return null;
                if (path[2] === 'office' || path[2] === 'text') return inf._el || null;
                return inf._elFloor || inf._el || null;
            }
            if (sect === 'floors') {
                var fl = model.floors.items[path[1]];
                if (!fl) return null;
                if (path[2] === 'label') return fl._el || null;
                if (path[2] === 'rooms') {
                    var room = fl.rooms[path[3]];
                    if (!room) return null;
                    if (path[4] === 'id') return room._elId || null;
                    if (path[4] === 'name') return room._elName || null;
                    if (path[4] === 'use') return room._elUse || null;
                }
            }
            return null;
        }

        var lastErrorInput = null;

        var editor = {
            load: function (rawDetails) {
                lastLoadedRaw = rawDetails === undefined ? null : rawDetails;
                var parsedRes = parseDetails(lastLoadedRaw);
                if (parsedRes.ok) {
                    model = parsedRes.model;
                } else {
                    model = emptyModel();
                    model.blocked = true;
                }
                lastErrorInput = null;
                render();
                if (model.blocked) announce(MESSAGES.PARSE_BLOCKED);
                else announce('');
                return !model.blocked;
            },
            clear: function () {
                lastLoadedRaw = null;
                model = emptyModel();
                lastErrorInput = null;
                render();
                announce('');
            },
            reset: function () {
                return editor.load(lastLoadedRaw);
            },
            isBlocked: function () {
                return model.blocked === true;
            },
            serialize: function () {
                clearErrorsSafe();
                lastErrorInput = null;
                var result = serializeModel(model);
                if (!result.ok) {
                    lastErrorInput = inputForPath(result.path);
                    if (lastErrorInput) markInvalid(lastErrorInput, result.message);
                    announce(result.message);
                }
                return result;
            },
            focusFirstError: function () {
                if (lastErrorInput && typeof lastErrorInput.focus === 'function') {
                    lastErrorInput.focus();
                    return true;
                }
                return false;
            },
            getModel: function () { return model; }
        };

        render();
        return editor;
    }

    return {
        LIMITS: LIMITS,
        SUPPORTED_KEYS: SUPPORTED_KEYS,
        MESSAGES: MESSAGES,
        parseDetails: parseDetails,
        serializeModel: serializeModel,
        createEditor: createEditor,
        // Item constructors for programmatic model edits (probes and the DOM
        // layer share these, so tests exercise the exact production shapes).
        newItems: {
            text: function () { return textItem(null); },
            room: newRoom,
            floor: newFloor,
            info: newInfoItem
        }
    };
}));
