CREATE DATABASE IF NOT EXISTS job_board_platform;
USE job_board_platform;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('candidate', 'employer', 'admin') DEFAULT 'candidate',
  company_name VARCHAR(160),
  resume_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employer_id INT NOT NULL,
  title VARCHAR(180) NOT NULL,
  location VARCHAR(150),
  job_type VARCHAR(80),
  salary_range VARCHAR(120),
  description TEXT,
  skills TEXT,
  status ENUM('open', 'closed') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT NOT NULL,
  candidate_id INT NOT NULL,
  cover_letter TEXT,
  status ENUM('applied', 'reviewing', 'shortlisted', 'rejected', 'hired') DEFAULT 'applied',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_application (job_id, candidate_id),
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO users (name, email, password, role, company_name, resume_url) VALUES
('Admin Recruiter', 'admin@jobs.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin', 'Talent Forge', NULL),
('Hiring Lead', 'employer@jobs.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'employer', 'Scale Labs', NULL),
('Candidate Demo', 'candidate@jobs.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'candidate', NULL, 'https://example.com/resume.pdf')
ON DUPLICATE KEY UPDATE email = VALUES(email);

INSERT INTO jobs (employer_id, title, location, job_type, salary_range, description, skills, status) VALUES
(2, 'Frontend Engineer', 'Remote', 'Full-time', '$1800-$2500', 'Build modern interfaces and collaboration tools.', 'React, TypeScript, UX', 'open'),
(2, 'Backend API Developer', 'Lahore', 'Hybrid', '$2000-$3000', 'Design scalable APIs and data services.', 'Node.js, MySQL, REST', 'open'),
(2, 'Product Designer', 'Karachi', 'Contract', '$1500-$2200', 'Shape product flows, wireframes, and design systems.', 'Figma, Research, Design Systems', 'open');
