-- ReUseHub database schema (MySQL 8+).
-- "npm run setup" creates the database named in .env and then runs the table
-- statements below. Demo students/listings are inserted by scripts/setup.js
-- (they need bcrypt password hashes, which SQL cannot generate).

CREATE DATABASE IF NOT EXISTS reusehub CHARACTER SET utf8mb4;
USE reusehub;

-- Users: students and administrators. Role is NEVER set from user input.
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  department    VARCHAR(100) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,            -- bcrypt hash, never the plain password
  role          ENUM('student','admin') NOT NULL DEFAULT 'student',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,    -- admin can deactivate an account
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- Items listed by students.
CREATE TABLE IF NOT EXISTS items (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id       INT UNSIGNED NOT NULL,
  name           VARCHAR(120) NOT NULL,
  category       ENUM('Books','Stationery','Lab Essentials','Other') NOT NULL,
  description    TEXT NOT NULL,
  item_condition ENUM('New','Like New','Good','Fair') NOT NULL,
  listing_type   ENUM('Give Away','Exchange','Sell') NOT NULL,
  price          DECIMAL(8,2) NULL,                -- only used when listing_type = 'Sell'
  image_url      VARCHAR(500) NULL,
  is_available   TINYINT(1) NOT NULL DEFAULT 1,    -- becomes 0 when an exchange is completed
  status         ENUM('active','removed') NOT NULL DEFAULT 'active',  -- 'removed' = soft delete
  is_sample      TINYINT(1) NOT NULL DEFAULT 0,    -- 1 = demo data, not a real listing
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_items_browse (status, is_available, category),
  KEY idx_items_owner (owner_id),
  CONSTRAINT fk_items_owner FOREIGN KEY (owner_id) REFERENCES users(id),
  CONSTRAINT chk_items_price CHECK (price IS NULL OR (price >= 0 AND price <= 100000)),
  CONSTRAINT chk_items_price_type CHECK (price IS NULL OR listing_type = 'Sell')
) ENGINE=InnoDB;

-- Requests/enquiries from a student for someone else's item.
CREATE TABLE IF NOT EXISTS exchange_requests (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id       INT UNSIGNED NOT NULL,
  requester_id  INT UNSIGNED NOT NULL,
  message       VARCHAR(500) NOT NULL,
  offered_item  VARCHAR(150) NULL,                 -- what the requester offers (for Exchange listings)
  status        ENUM('Pending','Accepted','Rejected','Cancelled','Completed') NOT NULL DEFAULT 'Pending',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_requests_item (item_id, status),
  KEY idx_requests_requester (requester_id),
  CONSTRAINT fk_requests_item FOREIGN KEY (item_id) REFERENCES items(id),
  CONSTRAINT fk_requests_requester FOREIGN KEY (requester_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- Chat messages between the item owner and the requester (one thread per request).
CREATE TABLE IF NOT EXISTS messages (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id  INT UNSIGNED NOT NULL,
  sender_id   INT UNSIGNED NOT NULL,
  body        VARCHAR(500) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_messages_request (request_id, id),
  CONSTRAINT fk_messages_request FOREIGN KEY (request_id) REFERENCES exchange_requests(id),
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- Reports of inappropriate listings, reviewed by the admin.
CREATE TABLE IF NOT EXISTS reports (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id      INT UNSIGNED NOT NULL,
  reporter_id  INT UNSIGNED NOT NULL,
  reason       VARCHAR(500) NOT NULL,
  status       ENUM('Open','Resolved','Dismissed') NOT NULL DEFAULT 'Open',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reports_status (status),
  CONSTRAINT fk_reports_item FOREIGN KEY (item_id) REFERENCES items(id),
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id)
) ENGINE=InnoDB;
