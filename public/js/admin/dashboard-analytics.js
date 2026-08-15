/* ========================================
   CampuSphere — Admin Dashboard Analytics Charts
   M12.P1-D6.

   Progressive enhancement ONLY. Every number this file draws is read back out
   of the semantic tables the server already rendered (#additionsTable and
   #roleTable), so:

     - Nothing is interpolated into executable script. There is no inline JSON
       payload, no data attribute holding a serialized object, no eval, no
       document.write, no innerHTML, and no Function constructor. The only DOM
       writes are createElement / createElementNS / setAttribute / textContent
       and canvas 2D calls.
     - The tables are the authoritative rendering, not a fallback. If this file
       fails to load, is blocked, or JavaScript is disabled, the complete
       figures are still on the page and still readable by a screen reader.
     - This file invents nothing. It cannot: it has no data of its own. A cell
       whose data-value is absent, blank, or not a digit-only nonnegative
       integer makes its whole series unavailable here too, and the chart is
       simply not drawn.

   It reads no cookie, session, storage, or network resource, and sends nothing.

   Redraw contract:
     - the additions chart redraws when its container changes size
       (ResizeObserver, falling back to window resize);
     - both charts redraw when document.documentElement's data-theme changes
       (MutationObserver on that attribute).

   Colour and non-colour encoding
   ------------------------------
   ANALYTICS_PALETTE holds the light and dark data colours. The same values are
   declared as the `--analytics-*` custom properties in the dashboard view, and
   `paletteFor()` prefers the computed CSS token when one is available, so the
   EJS legend and this renderer draw from ONE set of tokens rather than two
   drifting copies of the same hex strings.

   Colour is never the only carrier of meaning:
     - the two monthly series differ by line style (solid vs dashed) AND by
       point marker (circle vs square);
     - the four donut roles differ by FILL PATTERN — solid, diagonal stripe,
       crosshatch, dots — and the legend swatches carry the same four patterns;
     - the semantic role-count table remains the authoritative alternative for
       screen readers and for a page with JavaScript disabled.
   ======================================== */

(function () {
    'use strict';

    var ADDITIONS_CANVAS_ID = 'additionsChart';
    var ADDITIONS_TABLE_ID = 'additionsTable';
    var ROLE_SVG_ID = 'roleChart';
    var ROLE_TABLE_ID = 'roleTable';
    var SVG_NS = 'http://www.w3.org/2000/svg';

    /* Verified data colours. Contrast against their own surface:
         light on #ffffff : 11.28, 6.12, 5.93, 7.56
         dark  on #0b1220 :  8.88, 12.66, 11.16, 12.71
       All are far above the 3:1 minimum for graphical objects. */
    var ANALYTICS_PALETTE = {
        light: {
            surface: '#ffffff',
            users: '#1a3a6b',
            buildings: '#8a5a00',
            roles: ['#1a3a6b', '#2563a8', '#8a5a00', '#4b5563']
        },
        dark: {
            surface: '#0b1220',
            users: '#8ab4f8',
            buildings: '#f2c14e',
            roles: ['#8ab4f8', '#5eead4', '#f2c14e', '#d1d5db']
        }
    };

    /* The four non-colour encodings, in role order. Kept as data so the legend
       contract can be checked against the same list the renderer uses. */
    var ROLE_PATTERNS = ['solid', 'diagonal', 'crosshatch', 'dots'];
    var ROLE_PATTERN_PREFIX = 'analytics-pattern-role-';

    var EMPTY_ADDITIONS_TEXT = 'No accounts or buildings were created in this period.';
    var EMPTY_ROLES_TEXT = 'No accounts recorded.';

    /* ---------------------------------------------------------------------
       Reading the server-rendered tables
       ------------------------------------------------------------------- */

    /**
     * PURE: parse one cell's `data-value`.
     *
     * Accepts ONLY a digit-only nonnegative integer within Number.MAX_SAFE_INTEGER
     * — the exact shape the server emits for a real count. Everything else,
     * including the empty attribute the server writes for an unavailable
     * series, returns null. It never returns 0 as a stand-in.
     */
    function cellValue(cell) {
        if (!cell || typeof cell.getAttribute !== 'function') return null;
        var raw = cell.getAttribute('data-value');
        if (typeof raw !== 'string') return null;
        if (!/^[0-9]+$/.test(raw)) return null;
        var value = Number(raw);
        return Number.isSafeInteger(value) ? value : null;
    }

    /** Find the first descendant cell of `row` whose data-series matches. */
    function seriesCell(row, series) {
        if (!row || typeof row.getElementsByTagName !== 'function') return null;
        var cells = row.getElementsByTagName('td');
        for (var i = 0; i < cells.length; i++) {
            if (cells[i].getAttribute('data-series') === series) return cells[i];
        }
        return null;
    }

    /** The row's header label, trimmed. */
    function rowLabel(row) {
        if (!row || typeof row.getElementsByTagName !== 'function') return '';
        var heads = row.getElementsByTagName('th');
        if (!heads.length) return '';
        return String(heads[0].textContent || '').trim();
    }

    /** Rows of `table` carrying `attribute`, in document order. */
    function keyedRows(table, attribute) {
        if (!table || typeof table.getElementsByTagName !== 'function') return [];
        var all = table.getElementsByTagName('tr');
        var rows = [];
        for (var i = 0; i < all.length; i++) {
            var key = all[i].getAttribute(attribute);
            if (key !== null && key !== undefined && String(key) !== '') rows.push(all[i]);
        }
        return rows;
    }

    /**
     * Read the monthly additions model out of the rendered table.
     * A series is `ready` only when EVERY month carries a real value.
     */
    function readAdditionsModel(doc) {
        var table = doc && doc.getElementById ? doc.getElementById(ADDITIONS_TABLE_ID) : null;
        if (!table) return null;

        var rows = keyedRows(table, 'data-month-key');
        var months = [];
        var usersReady = rows.length > 0;
        var buildingsReady = rows.length > 0;

        for (var i = 0; i < rows.length; i++) {
            var users = cellValue(seriesCell(rows[i], 'users'));
            var buildings = cellValue(seriesCell(rows[i], 'buildings'));
            if (users === null) usersReady = false;
            if (buildings === null) buildingsReady = false;
            months.push({
                key: String(rows[i].getAttribute('data-month-key')),
                label: rowLabel(rows[i]),
                users: users,
                buildings: buildings
            });
        }
        return { months: months, usersReady: usersReady, buildingsReady: buildingsReady };
    }

    /** Read the role-distribution model out of the rendered table. */
    function readRoleModel(doc) {
        var table = doc && doc.getElementById ? doc.getElementById(ROLE_TABLE_ID) : null;
        if (!table) return null;

        var rows = keyedRows(table, 'data-role-key');
        var roles = [];
        var ready = rows.length > 0;
        var total = 0;

        for (var i = 0; i < rows.length; i++) {
            var count = cellValue(seriesCell(rows[i], 'role'));
            if (count === null) ready = false; else total += count;
            roles.push({
                key: String(rows[i].getAttribute('data-role-key')),
                label: rowLabel(rows[i]),
                count: count
            });
        }
        return { roles: roles, ready: ready, total: ready ? total : null };
    }

    /* ---------------------------------------------------------------------
       Theme and palette
       ------------------------------------------------------------------- */

    function isDarkTheme(doc) {
        var root = doc && doc.documentElement;
        if (!root || typeof root.getAttribute !== 'function') return false;
        return root.getAttribute('data-theme') === 'dark';
    }

    /** PURE: is a string a usable `#rrggbb` colour token? */
    function isHexColor(value) {
        return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim());
    }

    /**
     * The active palette: the built-in values for the current theme, with any
     * `--analytics-*` custom property the page actually defines taking
     * precedence. That makes the view's CSS tokens and this renderer one shared
     * source rather than two copies, while keeping the renderer correct when
     * computed styles are unavailable.
     */
    function paletteFor(doc) {
        var base = isDarkTheme(doc) ? ANALYTICS_PALETTE.dark : ANALYTICS_PALETTE.light;
        var palette = {
            surface: base.surface,
            users: base.users,
            buildings: base.buildings,
            roles: base.roles.slice()
        };

        var view = doc && doc.defaultView;
        if (!view || typeof view.getComputedStyle !== 'function' || !doc.documentElement) {
            return palette;
        }
        var style;
        try { style = view.getComputedStyle(doc.documentElement); } catch (e) { return palette; }
        if (!style || typeof style.getPropertyValue !== 'function') return palette;

        var token = function (name) {
            var value = String(style.getPropertyValue(name) || '').trim();
            return isHexColor(value) ? value : null;
        };
        palette.surface = token('--analytics-surface') || palette.surface;
        palette.users = token('--analytics-users') || palette.users;
        palette.buildings = token('--analytics-buildings') || palette.buildings;
        for (var i = 0; i < palette.roles.length; i++) {
            palette.roles[i] = token('--analytics-role-' + (i + 1)) || palette.roles[i];
        }
        return palette;
    }

    /** Axis/grid/label colours, which are chrome rather than data. */
    function chrome(dark) {
        return {
            grid: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
            axisText: dark ? '#c3cad6' : '#4b5563',
            emptyText: dark ? '#c3cad6' : '#4b5563'
        };
    }

    /* ---------------------------------------------------------------------
       Additions chart (canvas)
       ------------------------------------------------------------------- */

    /** PURE: the axis maximum. Never 0, so no scale division can divide by zero. */
    function axisMax(model) {
        var max = 0;
        for (var i = 0; i < model.months.length; i++) {
            if (model.usersReady && model.months[i].users > max) max = model.months[i].users;
            if (model.buildingsReady && model.months[i].buildings > max) max = model.months[i].buildings;
        }
        return max > 0 ? max : 1;
    }

    /** PURE: is every drawable value exactly zero? */
    function additionsAreAllZero(model) {
        for (var i = 0; i < model.months.length; i++) {
            if (model.usersReady && model.months[i].users !== 0) return false;
            if (model.buildingsReady && model.months[i].buildings !== 0) return false;
        }
        return true;
    }

    /** PURE: 'Sep 2025' -> 'Sep'. Keeps the axis readable at any width. */
    function shortMonthLabel(label) {
        return String(label || '').split(' ')[0];
    }

    function drawSeries(ctx, model, key, geometry, color, dashed) {
        var points = [];
        var i;
        for (i = 0; i < model.months.length; i++) {
            points.push({ x: geometry.xPos(i), y: geometry.yPos(model.months[i][key]) });
        }
        if (!points.length) return;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        if (typeof ctx.setLineDash === 'function') ctx.setLineDash(dashed ? [6, 4] : []);
        ctx.stroke();
        if (typeof ctx.setLineDash === 'function') ctx.setLineDash([]);

        // Distinct marker per series so the two lines stay separable without
        // relying on colour or on the dash pattern alone.
        ctx.fillStyle = color;
        for (i = 0; i < points.length; i++) {
            if (dashed) {
                ctx.fillRect(points[i].x - 3, points[i].y - 3, 6, 6);
            } else {
                ctx.beginPath();
                ctx.arc(points[i].x, points[i].y, 3.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    /**
     * Draw the 12-month additions chart.
     * @returns {boolean} true when it drew, false when it could not.
     */
    function drawAdditionsChart(canvas, model, options) {
        if (!canvas || !model || !model.months.length) return false;
        if (!model.usersReady && !model.buildingsReady) return false;
        if (typeof canvas.getContext !== 'function') return false;
        var ctx = canvas.getContext('2d');
        if (!ctx) return false;

        var settings = options || {};
        var dark = settings.dark === true;
        var palette = settings.palette || (dark ? ANALYTICS_PALETTE.dark : ANALYTICS_PALETTE.light);
        var colors = chrome(dark);
        var ratio = settings.devicePixelRatio > 0 ? settings.devicePixelRatio : 1;
        var width = settings.width > 0 ? settings.width : 640;
        var height = settings.height > 0 ? settings.height : 300;

        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        if (typeof ctx.setTransform === 'function') ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        if (typeof ctx.clearRect === 'function') ctx.clearRect(0, 0, width, height);

        var pad = { top: 20, right: 20, bottom: 34, left: 56 };
        var plotWidth = Math.max(1, width - pad.left - pad.right);
        var plotHeight = Math.max(1, height - pad.top - pad.bottom);
        var max = axisMax(model);
        var steps = model.months.length > 1 ? model.months.length - 1 : 1;
        var xStep = plotWidth / steps;

        var geometry = {
            xPos: function (i) { return pad.left + i * xStep; },
            yPos: function (v) { return pad.top + plotHeight - (v / max) * plotHeight; }
        };

        var i;
        ctx.strokeStyle = colors.grid;
        ctx.lineWidth = 1;
        for (i = 0; i <= 5; i++) {
            var gridY = pad.top + (plotHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(pad.left, gridY);
            ctx.lineTo(width - pad.right, gridY);
            ctx.stroke();
        }

        ctx.fillStyle = colors.axisText;
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        for (i = 0; i <= 5; i++) {
            var value = Math.round((max / 5) * (5 - i));
            ctx.fillText(String(value), pad.left - 8, pad.top + (plotHeight / 5) * i + 4);
        }

        ctx.textAlign = 'center';
        // Thin the month labels on narrow containers instead of overlapping them.
        var labelEvery = xStep < 34 ? 2 : 1;
        for (i = 0; i < model.months.length; i++) {
            if (i % labelEvery !== 0 && i !== model.months.length - 1) continue;
            ctx.fillText(shortMonthLabel(model.months[i].label), geometry.xPos(i), height - 10);
        }

        if (model.buildingsReady) drawSeries(ctx, model, 'buildings', geometry, palette.buildings, true);
        if (model.usersReady) drawSeries(ctx, model, 'users', geometry, palette.users, false);

        // A genuine all-zero period draws real axes and a real flat baseline,
        // plus an explicit statement — never a blank or invisible graphic.
        if (additionsAreAllZero(model)) {
            ctx.fillStyle = colors.emptyText;
            ctx.textAlign = 'center';
            ctx.font = '13px Inter, system-ui, sans-serif';
            ctx.fillText(EMPTY_ADDITIONS_TEXT, pad.left + plotWidth / 2, pad.top + plotHeight / 2);
        }
        return true;
    }

    /* ---------------------------------------------------------------------
       Role donut (SVG)
       ------------------------------------------------------------------- */

    /** PURE: the SVG arc path for one donut segment. */
    function donutSegmentPath(startAngle, endAngle, cx, cy, outerR, innerR) {
        var x1o = cx + outerR * Math.cos(startAngle);
        var y1o = cy + outerR * Math.sin(startAngle);
        var x2o = cx + outerR * Math.cos(endAngle);
        var y2o = cy + outerR * Math.sin(endAngle);
        var x2i = cx + innerR * Math.cos(endAngle);
        var y2i = cy + innerR * Math.sin(endAngle);
        var x1i = cx + innerR * Math.cos(startAngle);
        var y1i = cy + innerR * Math.sin(startAngle);
        var large = (endAngle - startAngle) > Math.PI ? 1 : 0;
        return 'M ' + x1o + ' ' + y1o +
            ' A ' + outerR + ' ' + outerR + ' 0 ' + large + ' 1 ' + x2o + ' ' + y2o +
            ' L ' + x2i + ' ' + y2i +
            ' A ' + innerR + ' ' + innerR + ' 0 ' + large + ' 0 ' + x1i + ' ' + y1i + ' Z';
    }

    function clearElement(element) {
        while (element.firstChild) element.removeChild(element.firstChild);
    }

    /** PURE: the canonical element id for one role's fill pattern. */
    function rolePatternId(index) {
        return ROLE_PATTERN_PREFIX + (index + 1);
    }

    /**
     * Build one `<pattern>` whose tile is the role's DATA COLOUR overlaid with
     * surface-coloured texture. Keeping the data colour as the tile background
     * preserves the measured data-to-surface contrast while the texture carries
     * the non-colour distinction.
     */
    function buildRolePattern(doc, index, color, surface) {
        var pattern = doc.createElementNS(SVG_NS, 'pattern');
        pattern.setAttribute('id', rolePatternId(index));
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        pattern.setAttribute('width', '8');
        pattern.setAttribute('height', '8');

        var base = doc.createElementNS(SVG_NS, 'rect');
        base.setAttribute('width', '8');
        base.setAttribute('height', '8');
        base.setAttribute('fill', color);
        pattern.appendChild(base);

        var kind = ROLE_PATTERNS[index];
        var add = function (tag, attributes) {
            var node = doc.createElementNS(SVG_NS, tag);
            for (var name in attributes) {
                if (Object.prototype.hasOwnProperty.call(attributes, name)) {
                    node.setAttribute(name, String(attributes[name]));
                }
            }
            pattern.appendChild(node);
            return node;
        };

        if (kind === 'diagonal') {
            add('path', { d: 'M0,8 L8,0', stroke: surface, 'stroke-width': '2' });
            add('path', { d: 'M-2,2 L2,-2', stroke: surface, 'stroke-width': '2' });
            add('path', { d: 'M6,10 L10,6', stroke: surface, 'stroke-width': '2' });
        } else if (kind === 'crosshatch') {
            add('path', { d: 'M4,0 L4,8', stroke: surface, 'stroke-width': '1.6' });
            add('path', { d: 'M0,4 L8,4', stroke: surface, 'stroke-width': '1.6' });
        } else if (kind === 'dots') {
            add('circle', { cx: '2', cy: '2', r: '1.4', fill: surface });
            add('circle', { cx: '6', cy: '6', r: '1.4', fill: surface });
        }
        // 'solid' adds nothing beyond the base rect — it is still a real
        // pattern, so every segment references one and the contract is uniform.
        pattern.setAttribute('data-pattern-kind', kind);
        return pattern;
    }

    /**
     * Draw the four-role donut.
     * @returns {boolean} true when it drew, false when it could not.
     */
    function drawRoleChart(svg, model, options) {
        if (!svg || !model || !model.ready || !model.roles.length) return false;
        var doc = svg.ownerDocument;
        if (!doc || typeof doc.createElementNS !== 'function') return false;

        var settings = options || {};
        var dark = settings.dark === true;
        var palette = settings.palette || (dark ? ANALYTICS_PALETTE.dark : ANALYTICS_PALETTE.light);
        var colors = chrome(dark);
        var cx = 100, cy = 100, outerR = 80, innerR = 50;

        clearElement(svg);

        // total is 0 only when every role is genuinely 0. Drawing a neutral
        // full ring keeps the graphic visible and avoids dividing by zero.
        if (!model.total) {
            var ring = doc.createElementNS(SVG_NS, 'circle');
            ring.setAttribute('cx', String(cx));
            ring.setAttribute('cy', String(cy));
            ring.setAttribute('r', String((outerR + innerR) / 2));
            ring.setAttribute('fill', 'none');
            ring.setAttribute('stroke', colors.grid);
            ring.setAttribute('stroke-width', String(outerR - innerR));
            svg.appendChild(ring);

            var empty = doc.createElementNS(SVG_NS, 'text');
            empty.setAttribute('x', String(cx));
            empty.setAttribute('y', String(cy + 4));
            empty.setAttribute('text-anchor', 'middle');
            empty.setAttribute('font-size', '11');
            empty.setAttribute('fill', colors.emptyText);
            empty.textContent = EMPTY_ROLES_TEXT;
            svg.appendChild(empty);
            return true;
        }

        // One <defs> carrying all four patterns, so a segment can never
        // reference a pattern that does not exist.
        var defs = doc.createElementNS(SVG_NS, 'defs');
        for (var p = 0; p < ROLE_PATTERNS.length; p++) {
            defs.appendChild(buildRolePattern(
                doc, p, palette.roles[p % palette.roles.length], palette.surface));
        }
        svg.appendChild(defs);

        var startAngle = -Math.PI / 2;
        var gapAngle = 2 / outerR;
        for (var i = 0; i < model.roles.length; i++) {
            var slice = (model.roles[i].count / model.total) * Math.PI * 2;
            if (slice > 0) {
                var a1 = startAngle + gapAngle / 2;
                var a2 = startAngle + slice - gapAngle / 2;
                if (a2 > a1) {
                    var path = doc.createElementNS(SVG_NS, 'path');
                    path.setAttribute('d', donutSegmentPath(a1, a2, cx, cy, outerR, innerR));
                    // Pattern fill, not a flat colour: the segment is identifiable
                    // without perceiving its hue.
                    path.setAttribute('fill', 'url(#' + rolePatternId(i) + ')');
                    path.setAttribute('data-role-index', String(i + 1));
                    // A visible separator keeps adjacent segments distinguishable.
                    path.setAttribute('stroke', palette.surface);
                    path.setAttribute('stroke-width', '1');
                    svg.appendChild(path);
                }
            }
            startAngle += slice;
        }
        return true;
    }

    /* ---------------------------------------------------------------------
       Wiring
       ------------------------------------------------------------------- */

    /**
     * Read both tables and (re)draw both charts.
     * @returns {{additions:boolean, roles:boolean}} what actually drew
     */
    function renderAdminAnalytics(doc) {
        var dark = isDarkTheme(doc);
        var palette = paletteFor(doc);
        var result = { additions: false, roles: false };

        var canvas = doc.getElementById(ADDITIONS_CANVAS_ID);
        if (canvas) {
            var additionsModel = readAdditionsModel(doc);
            var box = typeof canvas.getBoundingClientRect === 'function'
                ? canvas.getBoundingClientRect() : null;
            var view = doc.defaultView;
            result.additions = drawAdditionsChart(canvas, additionsModel, {
                dark: dark,
                palette: palette,
                width: box && box.width > 0 ? box.width : 640,
                height: 300,
                devicePixelRatio: view && view.devicePixelRatio > 0 ? view.devicePixelRatio : 1
            });
        }

        var svg = doc.getElementById(ROLE_SVG_ID);
        if (svg) {
            result.roles = drawRoleChart(svg, readRoleModel(doc), { dark: dark, palette: palette });
        }
        return result;
    }

    /**
     * Initialise the dashboard charts and their redraw observers.
     * @returns {boolean} true when at least one chart surface was found.
     */
    function initAdminAnalytics(doc) {
        if (!doc || typeof doc.getElementById !== 'function') return false;
        var canvas = doc.getElementById(ADDITIONS_CANVAS_ID);
        var svg = doc.getElementById(ROLE_SVG_ID);
        if (!canvas && !svg) return false;

        renderAdminAnalytics(doc);

        var view = doc.defaultView;
        var scheduled = false;
        var redraw = function () {
            if (scheduled) return;
            scheduled = true;
            var run = function () { scheduled = false; renderAdminAnalytics(doc); };
            if (view && typeof view.requestAnimationFrame === 'function') {
                view.requestAnimationFrame(run);
            } else {
                run();
            }
        };

        // Container resize -> redraw. ResizeObserver where available, window
        // resize as the fallback, so the contract holds either way.
        var container = canvas && canvas.parentNode;
        if (view && typeof view.ResizeObserver === 'function' && container) {
            new view.ResizeObserver(redraw).observe(container);
        } else if (view && typeof view.addEventListener === 'function') {
            view.addEventListener('resize', redraw);
        }

        // data-theme change -> redraw, so the palette, axis, grid and label
        // colours follow the admin theme toggle without a page reload.
        if (view && typeof view.MutationObserver === 'function' && doc.documentElement) {
            new view.MutationObserver(redraw).observe(doc.documentElement, {
                attributes: true,
                attributeFilter: ['data-theme']
            });
        }
        return true;
    }

    if (typeof document !== 'undefined') {
        initAdminAnalytics(document);
    }
    // CommonJS-only export for the Node regression probe; no browser global.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            ANALYTICS_PALETTE: ANALYTICS_PALETTE,
            ROLE_PATTERNS: ROLE_PATTERNS,
            ROLE_PATTERN_PREFIX: ROLE_PATTERN_PREFIX,
            EMPTY_ADDITIONS_TEXT: EMPTY_ADDITIONS_TEXT,
            EMPTY_ROLES_TEXT: EMPTY_ROLES_TEXT,
            cellValue: cellValue,
            isHexColor: isHexColor,
            paletteFor: paletteFor,
            rolePatternId: rolePatternId,
            readAdditionsModel: readAdditionsModel,
            readRoleModel: readRoleModel,
            axisMax: axisMax,
            additionsAreAllZero: additionsAreAllZero,
            shortMonthLabel: shortMonthLabel,
            donutSegmentPath: donutSegmentPath,
            buildRolePattern: buildRolePattern,
            drawAdditionsChart: drawAdditionsChart,
            drawRoleChart: drawRoleChart,
            renderAdminAnalytics: renderAdminAnalytics,
            initAdminAnalytics: initAdminAnalytics
        };
    }
})();
