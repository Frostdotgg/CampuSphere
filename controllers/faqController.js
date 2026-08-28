/* ========================================
   CampuSphere - Public FAQ Controller
   ======================================== */

const db = require('../config/db');
const contentDataSource = require('../config/contentDataSource');
const siteContentRepository = require('../repositories/siteContentRepository');
const { logServerError } = require('../utils/serverLog');

const FAQ_SELECT = 'SELECT id, question, answer, category, display_order FROM faqs ORDER BY display_order ASC, id ASC';

function normalizeFaqRows(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => {
        const category = row && row.category != null ? String(row.category).trim() : '';
        return {
            id: row && row.id,
            question: row && row.question != null ? String(row.question) : '',
            answer: row && row.answer != null ? String(row.answer) : '',
            category,
            displayCategory: category || 'General',
            displayOrder: row && row.display_order
        };
    });
}

async function listFaqContent() {
    let rows;
    if (contentDataSource.isSupabase()) {
        rows = await siteContentRepository.listFaqs();
    } else {
        const result = await db.query(FAQ_SELECT);
        rows = result[0];
    }

    const faqs = normalizeFaqRows(rows);
    const categories = Array.from(new Set(faqs.map((faq) => faq.displayCategory)));
    return { faqs, categories };
}

/**
 * GET /faq - public FAQ page.
 *
 * The page is intentionally anonymous and SSR-only. The same read path is
 * used for both content backends, and no request/session data is passed to a
 * repository or interpolated into SQL.
 */
exports.index = async (req, res) => {
    try {
        const { faqs, categories } = await listFaqContent();

        res.set('Cache-Control', 'no-store');
        return res.render('faq', {
            title: 'CampuSphere | Frequently Asked Questions',
            description: 'Answers to common questions about using CampuSphere at Camarines Sur Polytechnic Colleges.',
            activeTab: 'tabFaq',
            activePublicPage: 'faq',
            faqs,
            categories,
            loadFailed: false
        });
    } catch (error) {
        logServerError('faq.index', req);
        res.set('Cache-Control', 'no-store');
        return res.status(503).render('faq', {
            title: 'CampuSphere | Frequently Asked Questions',
            description: 'Answers to common questions about using CampuSphere at Camarines Sur Polytechnic Colleges.',
            activeTab: 'tabFaq',
            activePublicPage: 'faq',
            faqs: [],
            categories: [],
            loadFailed: true
        });
    }
};

module.exports = exports;
