// Simple localStorage wrapper for jobs and user
const STORAGE_KEYS = {
  jobs: 'jobs',
  user: 'user',
  account: 'account',
  currentUser: 'currentUser',
  saved: 'savedJobs',
};

function readJson(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse storage for', key, e);
    return defaultValue;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Jobs APIs
function storageGetJobs() {
  return readJson(STORAGE_KEYS.jobs, []);
}

function storageAddJob(job) {
  const jobs = storageGetJobs();
  const id = Date.now().toString();
  const next = { id, ...job };
  jobs.push(next);
  writeJson(STORAGE_KEYS.jobs, jobs);
  return next;
}

function storageUpdateJob(id, partial) {
  const jobs = storageGetJobs();
  const idx = jobs.findIndex(j => j.id === id);
  if (idx === -1) return null;
  jobs[idx] = { ...jobs[idx], ...partial };
  writeJson(STORAGE_KEYS.jobs, jobs);
  return jobs[idx];
}

function storageGetJob(id) {
  return storageGetJobs().find(j => j.id === id) || null;
}

// Saved jobs per user (by email)
function storageGetSaved(userId) {
  const map = readJson(STORAGE_KEYS.saved, {});
  return map[userId || 'guest'] || [];
}

function storageSaveJob(userId, jobId) {
  const key = userId || 'guest';
  const map = readJson(STORAGE_KEYS.saved, {});
  const list = new Set(map[key] || []);
  list.add(jobId);
  map[key] = Array.from(list);
  writeJson(STORAGE_KEYS.saved, map);
  return map[key];
}

function storageUnsaveJob(userId, jobId) {
  const key = userId || 'guest';
  const map = readJson(STORAGE_KEYS.saved, {});
  const list = new Set(map[key] || []);
  list.delete(jobId);
  map[key] = Array.from(list);
  writeJson(STORAGE_KEYS.saved, map);
  return map[key];
}

// User APIs
function storageGetUser() {
  return readJson(STORAGE_KEYS.user, { name: '', email: '', phone: '' });
}

function storageSaveUser(user) {
  writeJson(STORAGE_KEYS.user, user);
  return user;
}

// Auth (single account mock)
function storageSignup({ id, name, email, phone, password }) {
  const account = { id, name, email, phone, password };
  writeJson(STORAGE_KEYS.account, account);
  writeJson(STORAGE_KEYS.currentUser, { id, name });
  return account;
}

function storageLogin({ id, password }) {
  const account = readJson(STORAGE_KEYS.account, null);
  if (account && account.id === id && account.password === password) {
    writeJson(STORAGE_KEYS.currentUser, { id: account.id, name: account.name });
    return { ok: true, user: { id: account.id, name: account.name } };
  }
  return { ok: false };
}

function storageLogout() {
  writeJson(STORAGE_KEYS.currentUser, null);
}

function storageCurrentUser() {
  return readJson(STORAGE_KEYS.currentUser, null);
}

// Expose to window for simple usage
window.StorageAPI = {
  getJobs: storageGetJobs,
  addJob: storageAddJob,
  updateJob: storageUpdateJob,
  getJob: storageGetJob,
  getSaved: storageGetSaved,
  saveJob: storageSaveJob,
  unsaveJob: storageUnsaveJob,
  getUser: storageGetUser,
  saveUser: storageSaveUser,
  signup: storageSignup,
  login: storageLogin,
  logout: storageLogout,
  currentUser: storageCurrentUser,
};


