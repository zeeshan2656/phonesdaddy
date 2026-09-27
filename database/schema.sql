-- PhonesDaddy Database Schema
CREATE DATABASE IF NOT EXISTS `phonesdaddy` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `phonesdaddy`;

-- 1. Brands Table
CREATE TABLE IF NOT EXISTS `brands` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `logo` VARCHAR(255) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_brands_slug` (`slug`),
  INDEX `idx_brands_status` (`status`),
  INDEX `idx_brands_status_name` (`status`, `name`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Phones Table
CREATE TABLE IF NOT EXISTS `phones` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `brand_id` INT NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `slug` VARCHAR(150) NOT NULL UNIQUE,
  `short_description` TEXT DEFAULT NULL,
  `image` VARCHAR(255) DEFAULT NULL,
  `images` TEXT DEFAULT NULL,
  `affiliate_links` LONGTEXT DEFAULT NULL,
  `video_url` VARCHAR(500) DEFAULT NULL,
  `release_date` VARCHAR(50) DEFAULT NULL,
  `status` ENUM('Available', 'Rumored', 'Upcoming', 'Discontinued') DEFAULT 'Available',
  `price` DECIMAL(12,2) DEFAULT 0.00,
  `featured` BOOLEAN DEFAULT FALSE,
  `popular` BOOLEAN DEFAULT FALSE,
  `views` INT DEFAULT 0,
  `meta_title` VARCHAR(255) DEFAULT NULL,
  `meta_description` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE CASCADE,
  INDEX `idx_phones_slug` (`slug`),
  INDEX `idx_phones_brand_id` (`brand_id`),
  INDEX `idx_phones_name` (`name`),
  INDEX `idx_phones_status` (`status`),
  INDEX `idx_phones_featured` (`featured`),
  INDEX `idx_phones_popular` (`popular`),
  INDEX `idx_phones_created_at` (`created_at`),
  INDEX `idx_phones_brand_status_id` (`brand_id`, `status`, `id`),
  INDEX `idx_phones_status_id` (`status`, `id`),
  INDEX `idx_phones_popular_views` (`popular`, `views`),
  INDEX `idx_phones_featured_id` (`featured`, `id`),
  INDEX `idx_phones_price` (`price`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Phone Specifications Table (Flexible EAV-like section model)
CREATE TABLE IF NOT EXISTS `phone_specs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `phone_id` INT NOT NULL,
  `section` VARCHAR(100) NOT NULL,
  `spec_key` VARCHAR(100) NOT NULL,
  `spec_value` TEXT NOT NULL,
  `sort_order` INT DEFAULT 0,
  FOREIGN KEY (`phone_id`) REFERENCES `phones`(`id`) ON DELETE CASCADE,
  INDEX `idx_phone_specs_phone_id` (`phone_id`),
  INDEX `idx_phone_specs_section` (`section`),
  INDEX `idx_phone_specs_key` (`spec_key`),
  INDEX `idx_phone_specs_phone_sec_key` (`phone_id`, `section`, `spec_key`),
  INDEX `idx_phone_specs_sec_key_phone` (`section`, `spec_key`, `phone_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Multi-country Phone Prices Table
CREATE TABLE IF NOT EXISTS `phone_prices` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `phone_id` INT NOT NULL,
  `country` VARCHAR(50) NOT NULL,
  `currency` VARCHAR(10) NOT NULL,
  `amount` VARCHAR(50) NOT NULL,
  FOREIGN KEY (`phone_id`) REFERENCES `phones`(`id`) ON DELETE CASCADE,
  INDEX `idx_phone_prices_phone_id` (`phone_id`),
  INDEX `idx_phone_prices_country` (`country`),
  INDEX `idx_phone_prices_phone_country` (`phone_id`, `country`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Admins Table
CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `name` VARCHAR(100) DEFAULT 'Admin',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. News & Blog Table
CREATE TABLE IF NOT EXISTS `news` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL UNIQUE,
  `summary` VARCHAR(500) DEFAULT NULL,
  `author` VARCHAR(100) DEFAULT 'Admin',
  `category` VARCHAR(100) DEFAULT 'Hot News',
  `is_hot` BOOLEAN DEFAULT FALSE,
  `status` ENUM('published', 'draft') DEFAULT 'published',
  `content` LONGTEXT DEFAULT NULL,
  `image` VARCHAR(255) DEFAULT NULL,
  `views` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_news_slug` (`slug`),
  INDEX `idx_news_category` (`category`),
  INDEX `idx_news_status` (`status`),
  INDEX `idx_news_is_hot` (`is_hot`),
  INDEX `idx_news_created_at` (`created_at`),
  INDEX `idx_news_status_hot_date` (`status`, `is_hot`, `created_at`),
  INDEX `idx_news_status_date` (`status`, `created_at`),
  INDEX `idx_news_category_status` (`category`, `status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Site Settings Table (AdSense, Analytics, Adsterra, Head/Body snippets)
CREATE TABLE IF NOT EXISTS `site_settings` (
  `setting_key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `setting_value` LONGTEXT DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. News Categories Table
CREATE TABLE IF NOT EXISTS `news_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `description` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Custom Pages Table (About Us, Contact Us, Privacy Policy, Disclaimer, etc.)
CREATE TABLE IF NOT EXISTS `pages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL UNIQUE,
  `content` LONGTEXT DEFAULT NULL,
  `meta_title` VARCHAR(255) DEFAULT NULL,
  `meta_description` VARCHAR(500) DEFAULT NULL,
  `status` ENUM('published', 'draft') DEFAULT 'published',
  `show_in_footer` BOOLEAN DEFAULT TRUE,
  `views` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_pages_slug` (`slug`),
  INDEX `idx_pages_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Reviews & Comments Table
CREATE TABLE IF NOT EXISTS `reviews_comments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `entity_type` ENUM('phone', 'news') NOT NULL,
  `entity_id` INT NOT NULL,
  `parent_id` INT DEFAULT NULL,
  `user_name` VARCHAR(100) NOT NULL,
  `user_email_phone` VARCHAR(150) NOT NULL,
  `user_website` VARCHAR(255) DEFAULT NULL,
  `rating` TINYINT DEFAULT NULL,
  `message` LONGTEXT NOT NULL,
  `status` ENUM('approved', 'rejected') NOT NULL DEFAULT 'approved',
  `is_admin` BOOLEAN DEFAULT FALSE,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_entity` (`entity_type`, `entity_id`, `status`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created` (`created_at`),
  INDEX `idx_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

