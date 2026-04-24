const { pool } = require('../db');

async function refreshMenuItemStatus(menuItemId) {
  await pool.execute(
    `
      UPDATE menu_items
      SET status = CASE
        WHEN stock_quantity <= 0 THEN 'out_of_stock'
        WHEN stock_quantity <= 5 THEN 'low_stock'
        ELSE 'available'
      END
      WHERE id = ?
    `,
    [menuItemId]
  );
}

exports.getDashboard = async (req, res) => {
  try {
    const [[menuStats]] = await pool.execute(`
      SELECT
        COUNT(*) AS total_menu_items,
        SUM(CASE WHEN status = 'low_stock' THEN 1 ELSE 0 END) AS low_stock_items,
        SUM(CASE WHEN status = 'out_of_stock' THEN 1 ELSE 0 END) AS out_of_stock_items
      FROM menu_items
    `);

    const [[tableStats]] = await pool.execute(`
      SELECT
        COUNT(*) AS total_tables,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available_tables,
        SUM(CASE WHEN status IN ('reserved', 'occupied') THEN 1 ELSE 0 END) AS busy_tables
      FROM restaurant_tables
    `);

    const [[orderStats]] = await pool.execute(`
      SELECT
        COUNT(*) AS total_orders,
        SUM(CASE WHEN status IN ('pending', 'preparing') THEN 1 ELSE 0 END) AS active_orders,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) AS completed_sales
      FROM orders
    `);

    res.json({
      success: true,
      data: { menuStats, tableStats, orderStats },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMenu = async (req, res) => {
  try {
    const [items] = await pool.execute(`SELECT * FROM menu_items ORDER BY category, name`);
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createMenuItem = async (req, res) => {
  try {
    const { name, category, description, price, stock_quantity } = req.body;

    const [result] = await pool.execute(
      `INSERT INTO menu_items (name, category, description, price, stock_quantity) VALUES (?, ?, ?, ?, ?)`,
      [name, category, description, price, stock_quantity]
    );

    await refreshMenuItemStatus(result.insertId);
    res.status(201).json({ success: true, message: 'Menu item created', menuItemId: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock_quantity } = req.body;

    await pool.execute(`UPDATE menu_items SET stock_quantity = ? WHERE id = ?`, [stock_quantity, id]);
    await refreshMenuItemStatus(id);
    res.json({ success: true, message: 'Inventory updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTables = async (req, res) => {
  try {
    const [tables] = await pool.execute(`SELECT * FROM restaurant_tables ORDER BY table_number`);
    res.json({ success: true, data: tables });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTable = async (req, res) => {
  try {
    const { table_number, seats, zone } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO restaurant_tables (table_number, seats, zone) VALUES (?, ?, ?)`,
      [table_number, seats, zone]
    );

    res.status(201).json({ success: true, message: 'Table added', tableId: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createReservation = async (req, res) => {
  try {
    const { table_id, guest_count, reservation_time, notes } = req.body;

    const [[table]] = await pool.execute(`SELECT * FROM restaurant_tables WHERE id = ?`, [table_id]);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Table not found' });
    }

    if (table.status !== 'available') {
      return res.status(400).json({ success: false, message: 'Table is not available right now' });
    }

    if (Number(guest_count) > Number(table.seats)) {
      return res.status(400).json({ success: false, message: 'Guest count exceeds table capacity' });
    }

    const [result] = await pool.execute(
      `
        INSERT INTO reservations (user_id, table_id, guest_count, reservation_time, notes)
        VALUES (?, ?, ?, ?, ?)
      `,
      [req.user.id, table_id, guest_count, reservation_time, notes]
    );

    await pool.execute(`UPDATE restaurant_tables SET status = 'reserved' WHERE id = ?`, [table_id]);
    res.status(201).json({ success: true, message: 'Reservation confirmed', reservationId: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyReservations = async (req, res) => {
  try {
    const [reservations] = await pool.execute(
      `
        SELECT r.*, t.table_number, t.zone, t.seats
        FROM reservations r
        JOIN restaurant_tables t ON r.table_id = t.id
        WHERE r.user_id = ?
        ORDER BY r.reservation_time DESC
      `,
      [req.user.id]
    );

    res.json({ success: true, data: reservations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const [[reservation]] = await pool.execute(`SELECT * FROM reservations WHERE id = ? AND user_id = ?`, [
      id,
      req.user.id,
    ]);

    if (!reservation) {
      return res.status(404).json({ success: false, message: 'Reservation not found' });
    }

    await pool.execute(`UPDATE reservations SET status = 'cancelled' WHERE id = ?`, [id]);
    await pool.execute(`UPDATE restaurant_tables SET status = 'available' WHERE id = ?`, [reservation.table_id]);
    res.json({ success: true, message: 'Reservation cancelled' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.placeOrder = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { table_id, items } = req.body;

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: 'At least one order item is required' });
    }

    await connection.beginTransaction();
    const [orderResult] = await connection.execute(`INSERT INTO orders (user_id, table_id) VALUES (?, ?)`, [
      req.user.id,
      table_id || null,
    ]);

    let totalAmount = 0;

    for (const item of items) {
      const [[menuItem]] = await connection.execute(`SELECT * FROM menu_items WHERE id = ?`, [item.menu_item_id]);

      if (!menuItem) {
        throw new Error('Menu item not found');
      }

      if (Number(menuItem.stock_quantity) < Number(item.quantity)) {
        throw new Error(`Insufficient stock for ${menuItem.name}`);
      }

      totalAmount += Number(menuItem.price) * Number(item.quantity);

      await connection.execute(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES (?, ?, ?, ?)`,
        [orderResult.insertId, menuItem.id, item.quantity, menuItem.price]
      );

      await connection.execute(`UPDATE menu_items SET stock_quantity = stock_quantity - ? WHERE id = ?`, [
        item.quantity,
        menuItem.id,
      ]);
    }

    await connection.execute(`UPDATE orders SET total_amount = ? WHERE id = ?`, [totalAmount, orderResult.insertId]);

    if (table_id) {
      await connection.execute(`UPDATE restaurant_tables SET status = 'occupied' WHERE id = ?`, [table_id]);
    }

    await connection.commit();

    for (const item of items) {
      await refreshMenuItemStatus(item.menu_item_id);
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      orderId: orderResult.insertId,
      totalAmount,
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};

exports.getOrders = async (req, res) => {
  try {
    const [orders] = await pool.execute(`
      SELECT o.*, u.name AS customer_name, t.table_number
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN restaurant_tables t ON o.table_id = t.id
      ORDER BY o.created_at DESC
    `);

    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await pool.execute(`UPDATE orders SET status = ? WHERE id = ?`, [status, id]);

    if (status === 'completed' || status === 'cancelled') {
      const [[order]] = await pool.execute(`SELECT table_id FROM orders WHERE id = ?`, [id]);
      if (order?.table_id) {
        await pool.execute(`UPDATE restaurant_tables SET status = 'available' WHERE id = ?`, [order.table_id]);
      }
    }

    res.json({ success: true, message: 'Order status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getReports = async (req, res) => {
  try {
    const [[dailySales]] = await pool.execute(`
      SELECT COALESCE(SUM(total_amount), 0) AS sales
      FROM orders
      WHERE DATE(created_at) = CURDATE() AND status = 'completed'
    `);

    const [stockAlerts] = await pool.execute(`
      SELECT id, name, stock_quantity, status
      FROM menu_items
      WHERE stock_quantity <= 5
      ORDER BY stock_quantity ASC
    `);

    res.json({ success: true, data: { dailySales, stockAlerts } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
