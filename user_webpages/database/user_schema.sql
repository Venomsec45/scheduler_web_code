-- =========================================================
-- Scheduler user app — database tables (MySQL / MariaDB)
-- Run once:  mysql -u <user> -p <database> < user_schema.sql
-- The `support` table is only created if you don't have it yet;
-- an existing `support` table is left untouched.
-- =========================================================

USE schedule_tracker_db;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL DEFAULT '',
  email         VARCHAR(190) NOT NULL UNIQUE,
  phone         VARCHAR(30)  NOT NULL DEFAULT '',
  country       CHAR(2)      NOT NULL DEFAULT '',
  timezone      VARCHAR(64)  NOT NULL DEFAULT 'UTC',
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id       INT PRIMARY KEY,
  settings_json MEDIUMTEXT NOT NULL,
  CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Password reset codes
CREATE TABLE IF NOT EXISTS email_otps (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  email        VARCHAR(190) NOT NULL,
  purpose      VARCHAR(20)  NOT NULL,          -- 'reset' (password reset)
  code_hash    CHAR(64)     NOT NULL,          -- SHA-256 of the code, never the code itself
  payload_json TEXT,
  attempts     INT          NOT NULL DEFAULT 0,
  expires_at   DATETIME     NOT NULL,
  created_at   DATETIME     NOT NULL,
  INDEX idx_otp_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS schedules (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT          NOT NULL,
  label           VARCHAR(80)  NOT NULL,
  description     TEXT,
  schedule_date   DATE         NOT NULL,
  color           VARCHAR(20)  NOT NULL DEFAULT '#FFDE59',
  background_json MEDIUMTEXT,                  -- {"type": "none|pattern|color|image", "value": "..."}
  pinned          TINYINT(1)   NOT NULL DEFAULT 0,
  deleted_at      DATETIME     NULL,           -- set when moved to the trash (UTC)
  activity_json   TEXT,
  created_at      DATETIME     NOT NULL,
  updated_at      DATETIME     NOT NULL,
  INDEX idx_sched_user_date (user_id, schedule_date),
  INDEX idx_sched_deleted (deleted_at),
  CONSTRAINT fk_sched_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tasks (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id   INT          NOT NULL,
  user_id       INT          NOT NULL,
  start_time    CHAR(5)      NOT NULL,         -- 'HH:MM' in the user's local time
  end_time      CHAR(5)      NOT NULL,
  label         VARCHAR(80)  NOT NULL,
  description   TEXT,
  urgency       ENUM('optional','normal','medium','high','urgent') NOT NULL DEFAULT 'normal',
  status        ENUM('pending','finished','cancelled')             NOT NULL DEFAULT 'pending',
  completed_at  DATETIME     NULL,
  notified_near TINYINT(1)   NOT NULL DEFAULT 0, -- "deadline coming up" email sent
  notified_over TINYINT(1)   NOT NULL DEFAULT 0, -- "not finished" email sent
  created_at    DATETIME     NOT NULL,
  INDEX idx_task_schedule (schedule_id),
  INDEX idx_task_user_status (user_id, status),
  CONSTRAINT fk_task_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reminders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT          NOT NULL,
  label         VARCHAR(80)  NOT NULL,
  description   TEXT,
  deadline      DATETIME     NOT NULL,         -- user's local time
  done          TINYINT(1)   NOT NULL DEFAULT 0,
  deleted_at    DATETIME     NULL,
  notified_near TINYINT(1)   NOT NULL DEFAULT 0,
  notified_over TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    DATETIME     NOT NULL,
  INDEX idx_rem_user (user_id, deadline),
  CONSTRAINT fk_rem_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  kind       VARCHAR(20)  NOT NULL,            -- near | overdue | early | reminder | recommendation | system
  title      VARCHAR(160) NOT NULL,
  body       TEXT         NOT NULL,
  ref_type   VARCHAR(20)  NULL,                -- schedule | reminder | day
  ref_id     INT          NULL,
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  emailed    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at DATETIME     NOT NULL,
  INDEX idx_notif_user (user_id, created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Used by your existing POST /support/v1 route and the new /api/user/support route
CREATE TABLE IF NOT EXISTS support (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  topic          VARCHAR(30)  NOT NULL,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(190) NOT NULL,
  contact_number VARCHAR(30)  NOT NULL,
  message        TEXT         NOT NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
