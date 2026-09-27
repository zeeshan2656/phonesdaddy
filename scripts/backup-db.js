/**
 * PhonesDaddy - Pure Node.js Database Backup Utility
 * 
 * Creates a complete timestamped SQL backup in the backups/ directory.
 * Works on Windows, Linux, Hostinger, cPanel, and VPS without requiring mysqldump binary in PATH.
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../server/config/database');
require('dotenv').config();

async function backupDatabase() {
  const dbName = process.env.DB_NAME || 'phonesdaddy';
  console.log(`📦 Starting database backup for: \`${dbName}\`...`);

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const backupDir = path.join(__dirname, '../backups');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, `db-backup-${timestamp}.sql`);
  const writeStream = fs.createWriteStream(backupFile, { encoding: 'utf8' });

  writeStream.write(`-- ========================================================\n`);
  writeStream.write(`-- PhonesDaddy Database Backup\n`);
  writeStream.write(`-- Database: ${dbName}\n`);
  writeStream.write(`-- Date: ${now.toUTCString()}\n`);
  writeStream.write(`-- ========================================================\n\n`);
  writeStream.write(`SET FOREIGN_KEY_CHECKS = 0;\n\n`);

  try {
    const connection = await pool.getConnection();

    try {
      const [tables] = await connection.query(`SHOW TABLES`);
      const tableNames = tables.map(r => Object.values(r)[0]);

      for (const table of tableNames) {
        console.log(`  ⏳ Backing up table: ${table}...`);

        // 1. Get CREATE TABLE definition
        const [[createRes]] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
        const createSql = createRes['Create Table'];

        writeStream.write(`-- Table: ${table}\n`);
        writeStream.write(`DROP TABLE IF EXISTS \`${table}\`;\n`);
        writeStream.write(`${createSql};\n\n`);

        // 2. Dump Rows
        const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
        if (rows.length > 0) {
          writeStream.write(`-- Data for ${table} (${rows.length} rows)\n`);
          writeStream.write(`INSERT INTO \`${table}\` VALUES\n`);

          const valuesList = rows.map(row => {
            const cols = Object.values(row).map(val => {
              if (val === null || val === undefined) return 'NULL';
              if (typeof val === 'number') return val;
              if (typeof val === 'boolean') return val ? 1 : 0;
              if (val instanceof Date) {
                return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
              }
              const str = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
              return `'${str}'`;
            });
            return `(${cols.join(', ')})`;
          });

          writeStream.write(valuesList.join(',\n') + ';\n\n');
        }
      }

      writeStream.write(`SET FOREIGN_KEY_CHECKS = 1;\n`);
      writeStream.end();

      const stat = fs.statSync(backupFile);
      const sizeKb = (stat.size / 1024).toFixed(1);

      console.log('====================================================');
      console.log(`✅ Database Backup Completed Successfully!`);
      console.log(`📁 File: backups/db-backup-${timestamp}.sql (${sizeKb} KB)`);
      console.log('====================================================\n');
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ Backup failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  backupDatabase().then(() => {
    process.exit(0);
  });
}

module.exports = { backupDatabase };
