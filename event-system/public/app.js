const state = {
  token: localStorage.getItem('eventSystemToken') || '',
  user: null,
  events: [],
  registrations: [],
  editingEventId: null,
};

const refs = {
  authHeading: document.getElementById('authHeading'),
  authView: document.getElementById('authView'),
  accountView: document.getElementById('accountView'),
  logoutButton: document.getElementById('logoutButton'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  eventForm: document.getElementById('eventForm'),
  eventSubmitButton: document.getElementById('eventSubmitButton'),
  eventResetButton: document.getElementById('eventResetButton'),
  demoFillButton: document.getElementById('demoFillButton'),
  statsGrid: document.getElementById('statsGrid'),
  eventsGrid: document.getElementById('eventsGrid'),
  registrationsList: document.getElementById('registrationsList'),
  adminPanel: document.getElementById('adminPanel'),
  profileName: document.getElementById('profileName'),
  profileRole: document.getElementById('profileRole'),
  profileEmail: document.getElementById('profileEmail'),
  profileMeta: document.getElementById('profileMeta'),
  profileInitials: document.getElementById('profileInitials'),
  heroEvents: document.getElementById('heroEvents'),
  heroSpots: document.getElementById('heroSpots'),
  heroRegistrations: document.getElementById('heroRegistrations'),
  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  detailModal: document.getElementById('detailModal'),
  modalContent: document.getElementById('modalContent'),
  closeModalButton: document.getElementById('closeModalButton'),
  toastContainer: document.getElementById('toastContainer'),
};

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
  }

  return payload;
}

function showToast(message, variant = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<strong>${variant === 'error' ? 'Error' : 'Notice'}</strong><div>${message}</div>`;
  refs.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function formatDate(value) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function getRegistrationMap() {
  return new Map(state.registrations.map((item) => [String(item.event_id), item]));
}

function calculateStats() {
  return [
    { label: 'Upcoming Events', value: state.events.length },
    {
      label: 'Available Spots',
      value: state.events.reduce((sum, event) => sum + Math.max(Number(event.spots_left || 0), 0), 0),
    },
    {
      label: 'My Confirmed Seats',
      value: state.registrations.filter((item) => item.status === 'confirmed').length,
    },
    {
      label: 'Limited Availability',
      value: state.events.filter((event) => Number(event.spots_left) <= 10).length,
    },
  ];
}

function renderStats() {
  const stats = calculateStats();
  refs.statsGrid.innerHTML = stats
    .map(
      (stat) => `
        <div class="stat-card">
          <span>${stat.label}</span>
          <strong>${stat.value}</strong>
        </div>
      `
    )
    .join('');

  refs.heroEvents.textContent = stats[0].value;
  refs.heroSpots.textContent = stats[1].value;
  refs.heroRegistrations.textContent = stats[2].value;
}

function eventAvailability(event) {
  const spots = Number(event.spots_left || 0);
  if (spots <= 0) return { label: 'Fully Booked', className: 'danger' };
  if (spots <= 10) return { label: `Only ${spots} spots left`, className: 'warn' };
  return { label: `${spots} spots available`, className: 'success' };
}

function matchesFilters(event) {
  const query = refs.searchInput.value.trim().toLowerCase();
  const filter = refs.statusFilter.value;
  const haystack = `${event.title} ${event.location || ''}`.toLowerCase();
  const spots = Number(event.spots_left || 0);

  if (query && !haystack.includes(query)) return false;
  if (filter === 'open' && spots <= 0) return false;
  if (filter === 'limited' && (spots > 10 || spots <= 0)) return false;
  return true;
}

function renderEvents() {
  const registrationMap = getRegistrationMap();
  const filteredEvents = state.events.filter(matchesFilters);

  if (!filteredEvents.length) {
    refs.eventsGrid.innerHTML = `<div class="card empty-state">No events matched your current search.</div>`;
    return;
  }

  refs.eventsGrid.innerHTML = filteredEvents
    .map((event) => {
      const availability = eventAvailability(event);
      const registration = registrationMap.get(String(event.id));
      const isConfirmed = registration?.status === 'confirmed';
      const canRegister = state.user && !isConfirmed && Number(event.spots_left) > 0;
      const isAdmin = state.user?.role === 'admin';

      return `
        <article class="event-card reveal">
          <div class="event-topline">
            <span class="chip ${availability.className}">${availability.label}</span>
            <span class="chip">${formatDate(event.event_date)}</span>
          </div>
          <h3>${event.title}</h3>
          <p class="event-description">${event.description || 'An immersive event experience designed to bring people together.'}</p>
          <div class="meta-row">
            <span class="chip">${event.location || 'Location TBA'}</span>
            <span class="chip">${event.organizer_name || 'Organizer'}</span>
            <span class="chip">${event.registered_count} registered</span>
          </div>
          <div class="event-actions">
            <button class="ghost-button" data-action="details" data-id="${event.id}">Details</button>
            ${canRegister ? `<button class="primary-button" data-action="register" data-id="${event.id}">Register</button>` : ''}
            ${isConfirmed ? `<button class="ghost-button" data-action="cancel" data-id="${event.id}">Cancel Seat</button>` : ''}
            ${isAdmin ? `<button class="ghost-button" data-action="edit" data-id="${event.id}">Edit</button>` : ''}
            ${isAdmin ? `<button class="ghost-button" data-action="attendees" data-id="${event.id}">Attendees</button>` : ''}
          </div>
        </article>
      `;
    })
    .join('');
}

function renderRegistrations() {
  if (!state.user) {
    refs.registrationsList.className = 'stack-list empty-state';
    refs.registrationsList.textContent = 'Login to see your confirmed and cancelled registrations.';
    return;
  }

  if (!state.registrations.length) {
    refs.registrationsList.className = 'stack-list empty-state';
    refs.registrationsList.textContent = 'No registrations yet. Pick an event to reserve your seat.';
    return;
  }

  refs.registrationsList.className = 'stack-list';
  refs.registrationsList.innerHTML = state.registrations
    .map(
      (item) => `
        <div class="timeline-item">
          <strong>${item.title}</strong>
          <span>${formatDate(item.event_date)} at ${item.location || 'TBA'}</span>
          <span>Status: ${item.status}</span>
        </div>
      `
    )
    .join('');
}

function renderAccount() {
  const loggedIn = Boolean(state.user);
  refs.authView.classList.toggle('hidden', loggedIn);
  refs.accountView.classList.toggle('hidden', !loggedIn);
  refs.logoutButton.classList.toggle('hidden', !loggedIn);
  refs.adminPanel.classList.toggle('hidden', state.user?.role !== 'admin');

  if (!loggedIn) {
    refs.authHeading.textContent = 'Sign in to register instantly';
    return;
  }

  refs.authHeading.textContent = 'Your account is ready';
  refs.profileName.textContent = state.user.name;
  refs.profileRole.textContent = state.user.role;
  refs.profileEmail.textContent = state.user.email;
  refs.profileMeta.textContent =
    state.user.role === 'admin'
      ? 'Organizer controls unlocked for event creation and attendee management.'
      : 'You can now reserve seats and manage your registrations.';
  refs.profileInitials.textContent = state.user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function populateEventForm(event) {
  state.editingEventId = event.id;
  refs.eventForm.elements.id.value = event.id;
  refs.eventForm.elements.title.value = event.title || '';
  refs.eventForm.elements.location.value = event.location || '';
  refs.eventForm.elements.description.value = event.description || '';
  refs.eventForm.elements.capacity.value = event.capacity || 100;
  refs.eventForm.elements.status.value = event.status || 'active';
  refs.eventForm.elements.event_date.value = new Date(event.event_date).toISOString().slice(0, 16);
  refs.eventSubmitButton.textContent = 'Update Event';
  refs.eventForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetEventForm() {
  state.editingEventId = null;
  refs.eventForm.reset();
  refs.eventForm.elements.capacity.value = 100;
  refs.eventForm.elements.status.value = 'active';
  refs.eventSubmitButton.textContent = 'Create Event';
}

async function loadUserData() {
  if (!state.token) {
    state.user = null;
    state.registrations = [];
    return;
  }

  try {
    const me = await api('/api/auth/me');
    state.user = me.data;
    const registrationResponse = await api('/api/events/my-registrations');
    state.registrations = registrationResponse.data || [];
  } catch (error) {
    state.token = '';
    state.user = null;
    state.registrations = [];
    localStorage.removeItem('eventSystemToken');
    showToast(error.message, 'error');
  }
}

async function loadEvents() {
  const payload = await api('/api/events');
  state.events = payload.data || [];
}

function openModal(html) {
  refs.modalContent.innerHTML = html;
  refs.detailModal.classList.remove('hidden');
}

function closeModal() {
  refs.detailModal.classList.add('hidden');
  refs.modalContent.innerHTML = '';
}

async function showEventDetails(eventId) {
  const payload = await api(`/api/events/${eventId}`);
  const event = payload.data;
  const availability = eventAvailability(event);

  openModal(`
    <div class="detail-copy">
      <p class="eyebrow">Event Details</p>
      <h2>${event.title}</h2>
      <p>${event.description || 'No description available for this event yet.'}</p>
      <div class="detail-grid">
        <span class="chip">${formatDate(event.event_date)}</span>
        <span class="chip">${event.location || 'Location TBA'}</span>
        <span class="chip">${event.organizer_name || 'Organizer'}</span>
        <span class="chip ${availability.className}">${availability.label}</span>
        <span class="chip">${event.registered_count} attendees</span>
      </div>
    </div>
  `);
}

async function showAttendees(eventId) {
  const payload = await api(`/api/events/${eventId}/attendees`);
  const attendees = payload.data || [];

  openModal(`
    <div class="detail-copy">
      <p class="eyebrow">Attendee List</p>
      <h2>Registered attendees</h2>
      ${
        attendees.length
          ? attendees
              .map(
                (person) => `
                  <div class="timeline-item">
                    <strong>${person.name}</strong>
                    <span>${person.email}</span>
                    <span>${person.status} on ${formatDate(person.registered_at)}</span>
                  </div>
                `
              )
              .join('')
          : '<p>No attendees found for this event.</p>'
      }
    </div>
  `);
}

async function refreshUI() {
  await Promise.all([loadEvents(), loadUserData()]);
  renderAccount();
  renderStats();
  renderEvents();
  renderRegistrations();
}

document.querySelectorAll('[data-auth-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-auth-tab]').forEach((tabButton) => {
      tabButton.classList.toggle('active', tabButton === button);
    });
    refs.loginForm.classList.toggle('hidden', button.dataset.authTab !== 'login');
    refs.registerForm.classList.toggle('hidden', button.dataset.authTab !== 'register');
  });
});

refs.demoFillButton.addEventListener('click', () => {
  refs.loginForm.elements.email.value = 'admin@events.com';
  refs.loginForm.elements.password.value = 'admin123';
  showToast('Demo admin credentials filled. Click login to continue.');
});

refs.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);

  try {
    const payload = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    state.token = payload.token;
    localStorage.setItem('eventSystemToken', state.token);
    await refreshUI();
    showToast('Login successful.');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

refs.registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);

  try {
    await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    showToast('Account created successfully. Please login now.');
    document.querySelector('[data-auth-tab="login"]').click();
    refs.loginForm.elements.email.value = event.currentTarget.elements.email.value;
  } catch (error) {
    showToast(error.message, 'error');
  }
});

refs.logoutButton.addEventListener('click', async () => {
  state.token = '';
  state.user = null;
  state.registrations = [];
  localStorage.removeItem('eventSystemToken');
  resetEventForm();
  await refreshUI();
  showToast('Logged out successfully.');
});

refs.searchInput.addEventListener('input', renderEvents);
refs.statusFilter.addEventListener('change', renderEvents);

refs.eventsGrid.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const { action, id } = button.dataset;
  const selectedEvent = state.events.find((item) => String(item.id) === String(id));

  try {
    if (action === 'details') await showEventDetails(id);
    if (action === 'register') {
      await api(`/api/events/${id}/register`, { method: 'POST' });
      await refreshUI();
      showToast(`Registered for ${selectedEvent.title}.`);
    }
    if (action === 'cancel') {
      await api(`/api/events/${id}/register`, { method: 'DELETE' });
      await refreshUI();
      showToast(`Registration cancelled for ${selectedEvent.title}.`);
    }
    if (action === 'edit' && selectedEvent) {
      populateEventForm(selectedEvent);
    }
    if (action === 'attendees') {
      await showAttendees(id);
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
});

refs.eventForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const values = Object.fromEntries(formData);
  const isEditing = Boolean(state.editingEventId);
  const endpoint = isEditing ? `/api/events/${state.editingEventId}` : '/api/events';

  try {
    await api(endpoint, {
      method: isEditing ? 'PUT' : 'POST',
      body: JSON.stringify({
        ...values,
        capacity: Number(values.capacity),
      }),
    });
    resetEventForm();
    await refreshUI();
    showToast(isEditing ? 'Event updated successfully.' : 'Event created successfully.');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

refs.eventResetButton.addEventListener('click', resetEventForm);
refs.closeModalButton.addEventListener('click', closeModal);
refs.detailModal.addEventListener('click', (event) => {
  if (event.target === refs.detailModal) closeModal();
});

window.addEventListener('DOMContentLoaded', async () => {
  resetEventForm();
  try {
    await refreshUI();
  } catch (error) {
    showToast(error.message, 'error');
  }
});
