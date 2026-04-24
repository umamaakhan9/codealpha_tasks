const state = {
  token: localStorage.getItem('restaurantToken') || '',
  user: null,
  dashboard: null,
  menu: [],
  tables: [],
  reservations: [],
  reports: null,
};

const refs = {
  heroMetrics: document.getElementById('heroMetrics'),
  statsGrid: document.getElementById('statsGrid'),
  menuGrid: document.getElementById('menuGrid'),
  tablesGrid: document.getElementById('tablesGrid'),
  reservationsList: document.getElementById('reservationsList'),
  accountHeading: document.getElementById('accountHeading'),
  authSection: document.getElementById('authSection'),
  accountCard: document.getElementById('accountCard'),
  managerPanel: document.getElementById('managerPanel'),
  reportPanel: document.getElementById('reportPanel'),
  reportStats: document.getElementById('reportStats'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  menuForm: document.getElementById('menuForm'),
  tableForm: document.getElementById('tableForm'),
  reservationForm: document.getElementById('reservationForm'),
  orderForm: document.getElementById('orderForm'),
  fillDemoButton: document.getElementById('fillDemoButton'),
  toastWrap: document.getElementById('toastWrap'),
};

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'Request failed');
  return payload;
}

function toast(message) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  refs.toastWrap.appendChild(node);
  setTimeout(() => node.remove(), 2800);
}

function metric(label, value) {
  return `<div class="mini"><span>${label}</span><strong>${value}</strong></div>`;
}

function card(title, body, extra = '') {
  return `<article class="card"><h3>${title}</h3><p>${body}</p>${extra}</article>`;
}

function fillSelects() {
  const tableOptions = ['<option value="">Select table</option>']
    .concat(state.tables.map((table) => `<option value="${table.id}">${table.table_number} • ${table.seats} seats</option>`))
    .join('');
  refs.reservationForm.elements.table_id.innerHTML = tableOptions;
  refs.orderForm.elements.table_id.innerHTML = tableOptions;

  refs.orderForm.elements.menu_item_id.innerHTML = state.menu
    .map((item) => `<option value="${item.id}">${item.name} • $${Number(item.price).toFixed(2)}</option>`)
    .join('');
}

function render() {
  const dashboard = state.dashboard || {
    menuStats: { total_menu_items: 0, low_stock_items: 0, out_of_stock_items: 0 },
    tableStats: { total_tables: 0, available_tables: 0, busy_tables: 0 },
    orderStats: { total_orders: 0, active_orders: 0, completed_sales: 0 },
  };

  refs.heroMetrics.innerHTML = [
    metric('Menu Items', dashboard.menuStats.total_menu_items),
    metric('Available Tables', dashboard.tableStats.available_tables),
    metric('Completed Sales', `$${Number(dashboard.orderStats.completed_sales || 0).toFixed(2)}`),
  ].join('');

  refs.statsGrid.innerHTML = [
    metric('Low Stock', dashboard.menuStats.low_stock_items),
    metric('Out Of Stock', dashboard.menuStats.out_of_stock_items),
    metric('Busy Tables', dashboard.tableStats.busy_tables),
    metric('Active Orders', dashboard.orderStats.active_orders),
  ].join('');

  refs.menuGrid.innerHTML = state.menu
    .map((item) =>
      card(
        item.name,
        `${item.category} • $${Number(item.price).toFixed(2)} • Stock ${item.stock_quantity}`,
        `<span class="badge">${item.status}</span>`
      )
    )
    .join('');

  refs.tablesGrid.innerHTML = state.tables
    .map((table) => card(table.table_number, `${table.seats} seats • ${table.zone || 'Main Hall'}`, `<span class="badge">${table.status}</span>`))
    .join('');

  refs.reservationsList.innerHTML = state.user
    ? state.reservations.length
      ? state.reservations
          .map(
            (item) =>
              `<div class="list-item"><strong>${item.table_number}</strong><div>${new Date(item.reservation_time).toLocaleString()}</div><div>${item.guest_count} guests • ${item.status}</div></div>`
          )
          .join('')
      : 'No reservations yet.'
    : 'Login to manage reservations.';

  const isManager = ['manager', 'admin'].includes(state.user?.role);
  refs.managerPanel.classList.toggle('hidden', !isManager);
  refs.reportPanel.classList.toggle('hidden', !isManager);

  if (!state.user) {
    refs.authSection.classList.remove('hidden');
    refs.accountCard.classList.add('hidden');
    refs.accountHeading.textContent = 'Sign in to manage restaurant operations';
  } else {
    refs.authSection.classList.add('hidden');
    refs.accountCard.classList.remove('hidden');
    refs.accountHeading.textContent = 'Your service access is active';
    refs.accountCard.innerHTML = `<strong>${state.user.name}</strong><div>${state.user.email}</div><div>Role: ${state.user.role}</div>`;
  }

  if (state.reports && isManager) {
    refs.reportStats.innerHTML = [
      metric('Today Sales', `$${Number(state.reports.dailySales.sales || 0).toFixed(2)}`),
      metric('Stock Alerts', state.reports.stockAlerts.length),
    ]
      .concat(
        state.reports.stockAlerts.map((item) => `<div class="list-item"><strong>${item.name}</strong><div>${item.stock_quantity} left • ${item.status}</div></div>`)
      )
      .join('');
  }

  fillSelects();
}

async function loadAll() {
  const [dashboard, menu, tables] = await Promise.all([
    api('/api/restaurant/dashboard'),
    api('/api/restaurant/menu'),
    api('/api/restaurant/tables'),
  ]);

  state.dashboard = dashboard.data;
  state.menu = menu.data;
  state.tables = tables.data;

  if (state.token) {
    try {
      const [me, reservations] = await Promise.all([
        api('/api/auth/me'),
        api('/api/restaurant/reservations/me'),
      ]);
      state.user = me.data;
      state.reservations = reservations.data;

      if (['manager', 'admin'].includes(state.user.role)) {
        const reportPayload = await api('/api/restaurant/reports');
        state.reports = reportPayload.data;
      } else {
        state.reports = null;
      }
    } catch (error) {
      state.token = '';
      state.user = null;
      state.reservations = [];
      localStorage.removeItem('restaurantToken');
      toast(error.message);
    }
  }

  render();
}

document.querySelectorAll('[data-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach((tab) => tab.classList.toggle('active', tab === button));
    refs.loginForm.classList.toggle('hidden', button.dataset.tab !== 'login');
    refs.registerForm.classList.toggle('hidden', button.dataset.tab !== 'register');
  });
});

refs.fillDemoButton.addEventListener('click', () => {
  refs.loginForm.elements.email.value = 'admin@restaurant.com';
  refs.loginForm.elements.password.value = 'admin123';
  toast('Demo admin credentials filled.');
});

refs.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const payload = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
    });
    state.token = payload.token;
    localStorage.setItem('restaurantToken', payload.token);
    await loadAll();
    toast('Logged in successfully.');
  } catch (error) {
    toast(error.message);
  }
});

refs.registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
    });
    toast('Account created. Please login.');
  } catch (error) {
    toast(error.message);
  }
});

refs.menuForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/restaurant/menu', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
    });
    event.currentTarget.reset();
    await loadAll();
    toast('Menu item added.');
  } catch (error) {
    toast(error.message);
  }
});

refs.tableForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/restaurant/tables', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
    });
    event.currentTarget.reset();
    await loadAll();
    toast('Table added.');
  } catch (error) {
    toast(error.message);
  }
});

refs.reservationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/restaurant/reservations', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
    });
    event.currentTarget.reset();
    await loadAll();
    toast('Reservation confirmed.');
  } catch (error) {
    toast(error.message);
  }
});

refs.orderForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await api('/api/restaurant/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: values.table_id || null,
        items: [{ menu_item_id: Number(values.menu_item_id), quantity: Number(values.quantity) }],
      }),
    });
    event.currentTarget.reset();
    await loadAll();
    toast('Order placed successfully.');
  } catch (error) {
    toast(error.message);
  }
});

loadAll().catch((error) => toast(error.message));
