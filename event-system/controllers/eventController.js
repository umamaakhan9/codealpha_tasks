const { pool } = require('../db');

exports.getAllEvents = async (req, res) => {
  try {
    const [events] = await pool.execute(`
      SELECT
        e.*,
        u.name AS organizer_name,
        COUNT(r.id) AS registered_count,
        (e.capacity - COUNT(r.id)) AS spots_left
      FROM events e
      LEFT JOIN users u ON e.organizer_id = u.id
      LEFT JOIN registrations r ON e.id = r.event_id AND r.status = 'confirmed'
      WHERE e.status = 'active'
      GROUP BY e.id
      ORDER BY e.event_date ASC
    `);

    res.json({ success: true, data: events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const [[event]] = await pool.execute(
      `
        SELECT
          e.*,
          u.name AS organizer_name,
          u.email AS organizer_email,
          COUNT(r.id) AS registered_count,
          (e.capacity - COUNT(r.id)) AS spots_left
        FROM events e
        LEFT JOIN users u ON e.organizer_id = u.id
        LEFT JOIN registrations r ON e.id = r.event_id AND r.status = 'confirmed'
        WHERE e.id = ?
        GROUP BY e.id
      `,
      [id]
    );

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    res.json({ success: true, data: event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const { title, description, location, event_date, capacity } = req.body;
    const organizer_id = req.user.id;

    if (!title || !event_date) {
      return res.status(400).json({ success: false, message: 'Title and event_date are required' });
    }

    const [result] = await pool.execute(
      `
        INSERT INTO events (title, description, location, event_date, capacity, organizer_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [title, description, location, event_date, capacity || 100, organizer_id]
    );

    res.status(201).json({ success: true, message: 'Event created', eventId: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, location, event_date, capacity, status } = req.body;

    const [result] = await pool.execute(
      `
        UPDATE events
        SET title = ?, description = ?, location = ?, event_date = ?, capacity = ?, status = ?
        WHERE id = ?
      `,
      [title, description, location, event_date, capacity, status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    res.json({ success: true, message: 'Event updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute(`UPDATE events SET status = 'cancelled' WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Event cancelled' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.registerForEvent = async (req, res) => {
  try {
    const { id: event_id } = req.params;
    const user_id = req.user.id;

    const [[event]] = await pool.execute(
      `
        SELECT e.*, COUNT(r.id) AS registered_count
        FROM events e
        LEFT JOIN registrations r ON e.id = r.event_id AND r.status = 'confirmed'
        WHERE e.id = ? AND e.status = 'active'
        GROUP BY e.id
      `,
      [event_id]
    );

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found or not active' });
    }

    if (event.registered_count >= event.capacity) {
      return res.status(400).json({ success: false, message: 'Event is fully booked' });
    }

    const [[existingRegistration]] = await pool.execute(
      `SELECT id, status FROM registrations WHERE user_id = ? AND event_id = ?`,
      [user_id, event_id]
    );

    if (existingRegistration?.status === 'confirmed') {
      return res.status(400).json({ success: false, message: 'Already registered for this event' });
    }

    if (existingRegistration?.status === 'cancelled') {
      await pool.execute(
        `UPDATE registrations SET status = 'confirmed', registered_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [existingRegistration.id]
      );
    } else {
      await pool.execute(`INSERT INTO registrations (user_id, event_id) VALUES (?, ?)`, [user_id, event_id]);
    }

    res.status(201).json({ success: true, message: 'Successfully registered for event' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.cancelRegistration = async (req, res) => {
  try {
    const { id: event_id } = req.params;
    const user_id = req.user.id;

    const [result] = await pool.execute(
      `
        UPDATE registrations
        SET status = 'cancelled'
        WHERE user_id = ? AND event_id = ? AND status = 'confirmed'
      `,
      [user_id, event_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    res.json({ success: true, message: 'Registration cancelled' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyRegistrations = async (req, res) => {
  try {
    const user_id = req.user.id;
    const [registrations] = await pool.execute(
      `
        SELECT
          r.id,
          r.status,
          r.registered_at,
          e.id AS event_id,
          e.title,
          e.location,
          e.event_date,
          e.status AS event_status
        FROM registrations r
        JOIN events e ON r.event_id = e.id
        WHERE r.user_id = ?
        ORDER BY r.registered_at DESC
      `,
      [user_id]
    );

    res.json({ success: true, data: registrations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getEventAttendees = async (req, res) => {
  try {
    const { id } = req.params;
    const [attendees] = await pool.execute(
      `
        SELECT u.id, u.name, u.email, r.registered_at, r.status
        FROM registrations r
        JOIN users u ON r.user_id = u.id
        WHERE r.event_id = ?
        ORDER BY r.registered_at ASC
      `,
      [id]
    );

    res.json({ success: true, data: attendees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
