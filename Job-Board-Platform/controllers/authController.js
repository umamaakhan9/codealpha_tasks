const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'job_board_secret';

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, company_name, resume_url } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const [existing] = await pool.execute(`SELECT id FROM users WHERE email = ?`, [email]);
    if (existing.length) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const safeRole = ['candidate', 'employer', 'admin'].includes(role) ? role : 'candidate';

    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password, role, company_name, resume_url) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, safeRole, company_name || null, resume_url || null]
    );

    res.status(201).json({ success: true, message: 'Account created', userId: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const [[user]] = await pool.execute(`SELECT * FROM users WHERE email = ?`, [email]);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company_name: user.company_name,
        resume_url: user.resume_url,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const [[user]] = await pool.execute(
      `SELECT id, name, email, role, company_name, resume_url, created_at FROM users WHERE id = ?`,
      [req.user.id]
    );
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
