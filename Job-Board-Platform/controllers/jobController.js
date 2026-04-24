const { pool } = require('../db');

exports.getDashboard = async (req, res) => {
  try {
    const [[jobStats]] = await pool.execute(`
      SELECT
        COUNT(*) AS total_jobs,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_jobs,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_jobs
      FROM jobs
    `);

    const [[applicationStats]] = await pool.execute(`
      SELECT
        COUNT(*) AS total_applications,
        SUM(CASE WHEN status = 'shortlisted' THEN 1 ELSE 0 END) AS shortlisted,
        SUM(CASE WHEN status = 'hired' THEN 1 ELSE 0 END) AS hired
      FROM applications
    `);

    res.json({ success: true, data: { jobStats, applicationStats } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getJobs = async (req, res) => {
  try {
    const { q = '', location = '', jobType = '' } = req.query;
    const search = `%${q}%`;
    const locationSearch = `%${location}%`;
    const typeSearch = `%${jobType}%`;

    const [jobs] = await pool.execute(
      `
        SELECT j.*, u.name AS employer_name, u.company_name,
          (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS application_count
        FROM jobs j
        JOIN users u ON j.employer_id = u.id
        WHERE j.title LIKE ? AND COALESCE(j.location, '') LIKE ? AND COALESCE(j.job_type, '') LIKE ?
        ORDER BY j.created_at DESC
      `,
      [search, locationSearch, typeSearch]
    );

    res.json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.postJob = async (req, res) => {
  try {
    const { title, location, job_type, salary_range, description, skills } = req.body;
    const [result] = await pool.execute(
      `
        INSERT INTO jobs (employer_id, title, location, job_type, salary_range, description, skills)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [req.user.id, title, location, job_type, salary_range, description, skills]
    );

    res.status(201).json({ success: true, message: 'Job posted successfully', jobId: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateJobStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await pool.execute(`UPDATE jobs SET status = ? WHERE id = ? AND employer_id = ?`, [status, id, req.user.id]);
    res.json({ success: true, message: 'Job status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.applyToJob = async (req, res) => {
  try {
    const { id: job_id } = req.params;
    const { cover_letter } = req.body;

    const [[job]] = await pool.execute(`SELECT * FROM jobs WHERE id = ? AND status = 'open'`, [job_id]);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found or closed' });
    }

    const [result] = await pool.execute(
      `INSERT INTO applications (job_id, candidate_id, cover_letter) VALUES (?, ?, ?)`,
      [job_id, req.user.id, cover_letter || null]
    );

    res.status(201).json({ success: true, message: 'Application submitted', applicationId: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'You already applied to this job' });
    }

    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyApplications = async (req, res) => {
  try {
    const [applications] = await pool.execute(
      `
        SELECT a.*, j.title, j.location, j.job_type, u.company_name
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        JOIN users u ON j.employer_id = u.id
        WHERE a.candidate_id = ?
        ORDER BY a.created_at DESC
      `,
      [req.user.id]
    );

    res.json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getEmployerApplications = async (req, res) => {
  try {
    const [applications] = await pool.execute(
      `
        SELECT a.*, j.title, c.name AS candidate_name, c.email AS candidate_email, c.resume_url
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        JOIN users c ON a.candidate_id = c.id
        WHERE j.employer_id = ?
        ORDER BY a.created_at DESC
      `,
      [req.user.id]
    );

    res.json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await pool.execute(
      `
        UPDATE applications a
        JOIN jobs j ON a.job_id = j.id
        SET a.status = ?
        WHERE a.id = ? AND j.employer_id = ?
      `,
      [status, id, req.user.id]
    );

    res.json({ success: true, message: 'Application status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
