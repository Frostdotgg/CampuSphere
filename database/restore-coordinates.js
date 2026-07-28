/* ========================================
   One-shot script: restore building lat/lng
   in the live MySQL database. Run with:
       node database/restore-coordinates.js
   Idempotent - safe to run multiple times.
   Only touches `lat` and `lng`; leaves
   category/description/details JSON alone.
   ======================================== */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const COORDINATES = [
    { name: 'College of Computer Studies (CCS)',                       lat: 13.40565, lng: 123.37710 },
    { name: 'College of Health Sciences (CHS)',                        lat: 13.40539, lng: 123.37750 },
    { name: 'Green Building',                                          lat: 13.40600, lng: 123.37652 },
    { name: 'Administration Building',                                 lat: 13.40613, lng: 123.37441 },
    { name: 'Library Building',                                        lat: 13.40630, lng: 123.37525 },
    { name: 'Gymnasium',                                               lat: 13.40585, lng: 123.37522 },
    { name: 'Canteen / Cafeteria',                                     lat: 13.40625, lng: 123.37515 },
    { name: 'Information and Communications Technology Unit (ICTU)',   lat: 13.40558, lng: 123.37471 },
    { name: 'Medical & Dental Clinic',                                 lat: 13.40616, lng: 123.37717 },
    { name: 'Auditorium',                                              lat: 13.40630, lng: 123.37560 }
];

async function run() {
    const conn = await mysql.createConnection({
        host:     process.env.DB_HOST || '127.0.0.1',
        user:     process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'campusphere_db'
    });

    console.log(`Restoring coordinates for ${COORDINATES.length} buildings...`);

    let updated = 0;
    let missing = 0;
    for (const b of COORDINATES) {
        const [result] = await conn.query(
            'UPDATE buildings SET lat = ?, lng = ? WHERE name = ?',
            [b.lat, b.lng, b.name]
        );
        if (result.affectedRows > 0) {
            console.log(`  OK   ${b.name} -> (${b.lat}, ${b.lng})`);
            updated++;
        } else {
            console.warn(`  SKIP ${b.name} - no matching row`);
            missing++;
        }
    }

    console.log(`Done. Updated: ${updated}, missing: ${missing}.`);
    await conn.end();
}

run().catch(err => {
    console.error('restore-coordinates failed:', err);
    process.exit(1);
});
