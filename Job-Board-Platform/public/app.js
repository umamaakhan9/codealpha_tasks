const state = {
  token: localStorage.getItem('jobBoardToken') || '',
  user: null,
  dashboard: null,
  jobs: [],
  myApplications: [],
  employerApplications: [],
  filters: { q: '', location: '', jobType: '' },
};

const refs = {
  heroStats: document.getElementById('heroStats'),
  metricsGrid: document.getElementById('metricsGrid'),
  jobsGrid: document.getElementById('jobsGrid'),
  accountTitle: document.getElementById('accountTitle'),
  authBlock: document.getElementById('authBlock'),
  accountCard: document.getElementById('accountCard'),
  employerPanel: document.getElementById('employerPanel'),
  candidateApplications: document.getElementById('candidateApplications'),
  employerApplications: document.getElementById('employerApplications'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  searchForm: document.getElementById('searchForm'),
  jobForm: document.getElementById('jobForm'),
  fillEmployerDemo: document.getElementById('fillEmployerDemo'),
  fillCandidateDemo: document.getElementById('fillCandidateDemo'),
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
  return `<div class="metric-card"><span>${label}</span><strong>${value}</strong></div>`;
}

function render() {
  const dashboard = state.dashboard || {
    jobStats: { total_jobs: 0, open_jobs: 0, closed_jobs: 0 },
    applicationStats: { total_applications: 0, shortlisted: 0, hired: 0 },
  };

  refs.heroStats.innerHTML = [
    metric('Open Jobs', dashboard.jobStats.open_jobs),
    metric('Applications', dashboard.applicationStats.total_applications),
    metric('Hired', dashboard.applicationStats.hired),
  ].join('');

  refs.metricsGrid.innerHTML = [
    metric('Total Jobs', dashboard.jobStats.total_jobs),
    metric('Closed Roles', dashboard.jobStats.closed_jobs),
    metric('Shortlisted', dashboard.applicationStats.shortlisted),
  ].join('');

  refs.jobsGrid.innerHTML = state.jobs
    .map(
      (job) => `
        <article class="job-card">
          <div><span class="chip">${job.job_type || 'Flexible'}</span><span class="chip">${job.location || 'Remote'}</span></div>
          <h3>${job.title}</h3>
          <p>${job.description || 'Modern role with growth-focused team and collaborative culture.'}</p>
          <div><span class="chip">${job.company_name || job.employer_name || 'Employer'}</span><span class="chip">${job.salary_range || 'Salary on request'}</span></div>
          <div><span class="chip">${job.application_count} applicants</span><span class="chip">${job.status}</span></div>
          ${
            state.user?.role === 'candidate' || state.user?.role === 'admin'
              ? `<button class="primary" data-apply="${job.id}">Apply Now</button>`
              : ''
          }
          ${
            (state.user?.role === 'employer' || state.user?.role === 'admin') && String(job.employer_id) === String(state.user?.id)
              ? `<button class="secondary" data-close="${job.id}">Close Role</button>`
              : ''
          }
        </article>
      `
    )
    .join('');

  if (!state.user) {
    refs.authBlock.classList.remove('hidden');
    refs.accountCard.classList.add('hidden');
    refs.accountTitle.textContent = 'Login to unlock job board actions';
  } else {
    refs.authBlock.classList.add('hidden');
    refs.accountCard.classList.remove('hidden');
    refs.accountTitle.textContent = 'Your hiring workspace is active';
    refs.accountCard.innerHTML = `
      <strong>${state.user.name}</strong>
      <div>${state.user.email}</div>
      <div>Role: ${state.user.role}</div>
      <div>${state.user.company_name || state.user.resume_url || 'Ready to work with the platform'}</div>
    `;
  }

  refs.employerPanel.classList.toggle('hidden', !['employer', 'admin'].includes(state.user?.role));

  refs.candidateApplications.innerHTML =
    ['candidate', 'admin'].includes(state.user?.role) && state.myApplications.length
      ? state.myApplications
          .map(
            (app) =>
              `<div class="list-item"><strong>${app.title}</strong><div>${app.company_name || 'Company'} • ${app.location || 'Remote'}</div><div>Status: ${app.status}</div></div>`
          )
          .join('')
      : 'Login as candidate to view applications.';

  refs.employerApplications.innerHTML =
    ['employer', 'admin'].includes(state.user?.role) && state.employerApplications.length
      ? state.employerApplications
          .map(
            (app) => `
              <div class="list-item">
                <strong>${app.candidate_name}</strong>
                <div>${app.title}</div>
                <div>${app.candidate_email}</div>
                <div>Status: ${app.status}</div>
                <button class="secondary" data-shortlist="${app.id}">Shortlist</button>
              </div>
            `
          )
          .join('')
      : 'Login as employer to view applications.';
}

async function loadAll() {
  const dashboard = await api('/api/job-board/dashboard');
  state.dashboard = dashboard.data;

  const params = new URLSearchParams(state.filters).toString();
  const jobs = await api(`/api/job-board/jobs?${params}`);
  state.jobs = jobs.data;

  if (state.token) {
    try {
      const me = await api('/api/auth/me');
      state.user = me.data;

      if (['candidate', 'admin'].includes(state.user.role)) {
        const myApps = await api('/api/job-board/applications/me');
        state.myApplications = myApps.data;
      } else {
        state.myApplications = [];
      }

      if (['employer', 'admin'].includes(state.user.role)) {
        const employerApps = await api('/api/job-board/applications/employer');
        state.employerApplications = employerApps.data;
      } else {
        state.employerApplications = [];
      }
    } catch (error) {
      state.token = '';
      state.user = null;
      state.myApplications = [];
      state.employerApplications = [];
      localStorage.removeItem('jobBoardToken');
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

refs.fillEmployerDemo.addEventListener('click', () => {
  refs.loginForm.elements.email.value = 'employer@jobs.com';
  refs.loginForm.elements.password.value = 'admin123';
  toast('Employer demo credentials filled.');
});

refs.fillCandidateDemo.addEventListener('click', () => {
  refs.loginForm.elements.email.value = 'candidate@jobs.com';
  refs.loginForm.elements.password.value = 'admin123';
  toast('Candidate demo credentials filled.');
});

refs.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const payload = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
    });
    state.token = payload.token;
    localStorage.setItem('jobBoardToken', payload.token);
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
    toast('Account created successfully.');
  } catch (error) {
    toast(error.message);
  }
});

refs.searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  state.filters = Object.fromEntries(new FormData(event.currentTarget));
  await loadAll();
});

refs.jobForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/job-board/jobs', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
    });
    event.currentTarget.reset();
    await loadAll();
    toast('Job posted successfully.');
  } catch (error) {
    toast(error.message);
  }
});

refs.jobsGrid.addEventListener('click', async (event) => {
  const applyButton = event.target.closest('[data-apply]');
  const closeButton = event.target.closest('[data-close]');

  try {
    if (applyButton) {
      await api(`/api/job-board/jobs/${applyButton.dataset.apply}/apply`, {
        method: 'POST',
        body: JSON.stringify({ cover_letter: 'Excited to contribute to this opportunity.' }),
      });
      await loadAll();
      toast('Application submitted.');
    }

    if (closeButton) {
      await api(`/api/job-board/jobs/${closeButton.dataset.close}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'closed' }),
      });
      await loadAll();
      toast('Job status updated.');
    }
  } catch (error) {
    toast(error.message);
  }
});

refs.employerApplications.addEventListener('click', async (event) => {
  const shortlistButton = event.target.closest('[data-shortlist]');
  if (!shortlistButton) return;

  try {
    await api(`/api/job-board/applications/${shortlistButton.dataset.shortlist}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'shortlisted' }),
    });
    await loadAll();
    toast('Candidate shortlisted.');
  } catch (error) {
    toast(error.message);
  }
});

loadAll().catch((error) => toast(error.message));
