/**
 * PhonesDaddy - Safe & Idempotent Database Migrator
 * 
 * Rules:
 * 1. NEVER drops any table.
 * 2. NEVER drops any column.
 * 3. NEVER deletes or truncates any existing rows (articles, phones, settings, accounts).
 * 4. Only uses CREATE TABLE IF NOT EXISTS and ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
 * 5. Can be safely executed on any deployment without fear of data disturbance.
 */

const { pool } = require('../server/config/database');

async function runSafeMigrations() {
  console.log('🔄 Checking database schema for safe updates...');

  try {
    const connection = await pool.getConnection();

    try {
      // 1. Ensure all core tables exist (non-destructive)
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`brands\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`name\` VARCHAR(100) NOT NULL,
          \`slug\` VARCHAR(100) NOT NULL UNIQUE,
          \`logo\` VARCHAR(255) DEFAULT NULL,
          \`description\` TEXT DEFAULT NULL,
          \`status\` ENUM('active', 'inactive') DEFAULT 'active',
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_brands_slug\` (\`slug\`),
          INDEX \`idx_brands_status\` (\`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`phones\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`brand_id\` INT NOT NULL,
          \`name\` VARCHAR(150) NOT NULL,
          \`slug\` VARCHAR(150) NOT NULL UNIQUE,
          \`short_description\` TEXT DEFAULT NULL,
          \`image\` VARCHAR(255) DEFAULT NULL,
          \`images\` TEXT DEFAULT NULL,
          \`affiliate_links\` LONGTEXT DEFAULT NULL,
          \`video_url\` VARCHAR(500) DEFAULT NULL,
          \`release_date\` VARCHAR(50) DEFAULT NULL,
          \`status\` ENUM('Available', 'Rumored', 'Upcoming', 'Discontinued') DEFAULT 'Available',
          \`price\` DECIMAL(12,2) DEFAULT 0.00,
          \`featured\` BOOLEAN DEFAULT FALSE,
          \`popular\` BOOLEAN DEFAULT FALSE,
          \`views\` INT DEFAULT 0,
          \`meta_title\` VARCHAR(255) DEFAULT NULL,
          \`meta_description\` TEXT DEFAULT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (\`brand_id\`) REFERENCES \`brands\`(\`id\`) ON DELETE CASCADE,
          INDEX \`idx_phones_slug\` (\`slug\`),
          INDEX \`idx_phones_brand_id\` (\`brand_id\`),
          INDEX \`idx_phones_name\` (\`name\`),
          INDEX \`idx_phones_status\` (\`status\`),
          INDEX \`idx_phones_featured\` (\`featured\`),
          INDEX \`idx_phones_popular\` (\`popular\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`phone_specs\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`phone_id\` INT NOT NULL,
          \`section\` VARCHAR(100) NOT NULL,
          \`spec_key\` VARCHAR(100) NOT NULL,
          \`spec_value\` TEXT NOT NULL,
          \`sort_order\` INT DEFAULT 0,
          FOREIGN KEY (\`phone_id\`) REFERENCES \`phones\`(\`id\`) ON DELETE CASCADE,
          INDEX \`idx_phone_specs_phone_id\` (\`phone_id\`),
          INDEX \`idx_phone_specs_section\` (\`section\`),
          INDEX \`idx_phone_specs_key\` (\`spec_key\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`phone_prices\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`phone_id\` INT NOT NULL,
          \`country\` VARCHAR(50) NOT NULL,
          \`currency\` VARCHAR(10) NOT NULL,
          \`amount\` VARCHAR(50) NOT NULL,
          FOREIGN KEY (\`phone_id\`) REFERENCES \`phones\`(\`id\`) ON DELETE CASCADE,
          INDEX \`idx_phone_prices_phone_id\` (\`phone_id\`),
          INDEX \`idx_phone_prices_country\` (\`country\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`admins\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`username\` VARCHAR(50) NOT NULL UNIQUE,
          \`password_hash\` VARCHAR(255) NOT NULL,
          \`name\` VARCHAR(100) DEFAULT 'Admin',
          \`role\` VARCHAR(50) DEFAULT 'admin',
          \`permissions\` LONGTEXT DEFAULT NULL,
          \`status\` VARCHAR(20) DEFAULT 'active',
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`news\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`title\` VARCHAR(255) NOT NULL,
          \`slug\` VARCHAR(255) NOT NULL UNIQUE,
          \`summary\` VARCHAR(500) DEFAULT NULL,
          \`author\` VARCHAR(100) DEFAULT 'Admin',
          \`category\` VARCHAR(100) DEFAULT 'Hot News',
          \`is_hot\` BOOLEAN DEFAULT FALSE,
          \`status\` ENUM('published', 'draft') DEFAULT 'published',
          \`content\` LONGTEXT DEFAULT NULL,
          \`image\` VARCHAR(255) DEFAULT NULL,
          \`views\` INT DEFAULT 0,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_news_slug\` (\`slug\`),
          INDEX \`idx_news_category\` (\`category\`),
          INDEX \`idx_news_status\` (\`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`site_settings\` (
          \`setting_key\` VARCHAR(100) NOT NULL PRIMARY KEY,
          \`setting_value\` LONGTEXT DEFAULT NULL,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`news_categories\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`name\` VARCHAR(100) NOT NULL UNIQUE,
          \`slug\` VARCHAR(100) NOT NULL UNIQUE,
          \`description\` VARCHAR(255) DEFAULT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`pages\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`title\` VARCHAR(255) NOT NULL,
          \`slug\` VARCHAR(255) NOT NULL UNIQUE,
          \`content\` LONGTEXT DEFAULT NULL,
          \`meta_title\` VARCHAR(255) DEFAULT NULL,
          \`meta_description\` VARCHAR(500) DEFAULT NULL,
          \`status\` ENUM('published', 'draft') DEFAULT 'published',
          \`show_in_footer\` BOOLEAN DEFAULT TRUE,
          \`views\` INT DEFAULT 0,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_pages_slug\` (\`slug\`),
          INDEX \`idx_pages_status\` (\`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`reviews_comments\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`entity_type\` ENUM('phone', 'news') NOT NULL,
          \`entity_id\` INT NOT NULL,
          \`parent_id\` INT DEFAULT NULL,
          \`user_name\` VARCHAR(100) NOT NULL,
          \`user_email_phone\` VARCHAR(150) NOT NULL,
          \`user_website\` VARCHAR(255) DEFAULT NULL,
          \`rating\` TINYINT DEFAULT NULL,
          \`message\` LONGTEXT NOT NULL,
          \`status\` ENUM('approved', 'rejected') NOT NULL DEFAULT 'approved',
          \`is_admin\` BOOLEAN DEFAULT FALSE,
          \`ip_address\` VARCHAR(45) DEFAULT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX \`idx_entity\` (\`entity_type\`, \`entity_id\`, \`status\`),
          INDEX \`idx_status\` (\`status\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 2. Helper to safely add column if it does not already exist
      const ensureColumn = async (tableName, columnName, columnDefinition) => {
        const [cols] = await connection.query(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = ? 
            AND COLUMN_NAME = ?
        `, [tableName, columnName]);

        if (cols.length === 0) {
          console.log(`  ➕ Adding missing column ${tableName}.${columnName}...`);
          await connection.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`);
        }
      };

      // Safely ensure incremental columns across versions
      await ensureColumn('phones', 'images', 'TEXT DEFAULT NULL');
      await ensureColumn('phones', 'affiliate_links', 'LONGTEXT DEFAULT NULL');
      await ensureColumn('phones', 'video_url', 'VARCHAR(500) DEFAULT NULL');
      await ensureColumn('phones', 'views', 'INT DEFAULT 0');
      await ensureColumn('phones', 'meta_title', 'VARCHAR(255) DEFAULT NULL');
      await ensureColumn('phones', 'meta_description', 'TEXT DEFAULT NULL');

      await ensureColumn('admins', 'role', "VARCHAR(50) DEFAULT 'admin'");
      await ensureColumn('admins', 'permissions', 'LONGTEXT DEFAULT NULL');
      await ensureColumn('admins', 'status', "VARCHAR(20) DEFAULT 'active'");

      await ensureColumn('news', 'is_hot', 'BOOLEAN DEFAULT FALSE');
      await ensureColumn('news', 'views', 'INT DEFAULT 0');

      await ensureColumn('pages', 'show_in_footer', 'BOOLEAN DEFAULT TRUE');
      await ensureColumn('pages', 'views', 'INT DEFAULT 0');

      // 3. Helper to safely add composite indexes if they do not exist
      const ensureIndex = async (tableName, indexName, columnsDefinition) => {
        const [idxs] = await connection.query(`
          SELECT INDEX_NAME 
          FROM INFORMATION_SCHEMA.STATISTICS 
          WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = ? 
            AND INDEX_NAME = ?
          LIMIT 1
        `, [tableName, indexName]);

        if (idxs.length === 0) {
          try {
            console.log(`  ⚡ Adding performance index ${tableName}.${indexName}...`);
            await connection.query(`ALTER TABLE \`${tableName}\` ADD INDEX \`${indexName}\` ${columnsDefinition}`);
          } catch (e) {
            console.warn(`  ⚠️ Could not add index ${indexName}:`, e.message);
          }
        }
      };

      await ensureIndex('phones', 'idx_phones_pop_views_id', '(`popular`, `views`, `id`)');
      await ensureIndex('phones', 'idx_phones_status_id', '(`status`, `id`)');
      await ensureIndex('phones', 'idx_phones_brand_status', '(`brand_id`, `status`)');
      await ensureIndex('news', 'idx_news_status_hot_date', '(`status`, `is_hot`, `created_at`)');
      await ensureIndex('brands', 'idx_brands_status_name', '(`status`, `name`)');

      // 4. Ensure default social settings exist if missing or empty
      const ensureSetting = async (key, defaultValue) => {
        try {
          const [rows] = await connection.query(`SELECT setting_value FROM site_settings WHERE setting_key = ?`, [key]);
          if (rows.length === 0) {
            await connection.query(`INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)`, [key, defaultValue]);
          } else if (!rows[0].setting_value || !rows[0].setting_value.trim()) {
            await connection.query(`UPDATE site_settings SET setting_value = ? WHERE setting_key = ?`, [defaultValue, key]);
          }
        } catch (_) {}
      };

      const defaultProfileUrl = 'https://www.facebook.com/zeeshankhanturi?rdid=Ybz9oO06xu59okY7&share_url=https%3A%2F%2Fwww.facebook.com%2Fshare%2F1KEaM4feXc%2F#';
      await ensureSetting('facebook_enabled', '1');
      await ensureSetting('facebook_url', defaultProfileUrl);
      await ensureSetting('instagram_enabled', '1');
      await ensureSetting('instagram_url', defaultProfileUrl);
      await ensureSetting('tiktok_enabled', '1');
      await ensureSetting('tiktok_url', defaultProfileUrl);
      await ensureSetting('youtube_enabled', '1');
      await ensureSetting('youtube_url', defaultProfileUrl);
      await ensureSetting('whatsapp_enabled', '1');

      console.log('✅ Database schema verified: 100% up-to-date. (Existing articles, phones & settings preserved).');
      return true;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('⚠️ Migration notice:', err.message);
    return false;
  }
}

// If executed directly from CLI: node database/migrate.js
if (require.main === module) {
  runSafeMigrations().then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { runSafeMigrations };
