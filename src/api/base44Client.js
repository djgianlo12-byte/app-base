/**
 * LocalStorage-based client that mimics the Base44 SDK API.
 * All data is stored in the browser's localStorage.
 */

const STORAGE_PREFIX = 'wb_';
const subscribers = {};

function getStore(name) {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PREFIX + name) || '[]');
  } catch { return []; }
}

function setStore(name, data) {
  localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(data));
  // Notify subscribers
  if (subscribers[name]) {
    subscribers[name].forEach(fn => fn());
  }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// ---- Auth ----
const DEFAULT_USERS = [
  { id: 'admin1', email: 'admin@test.nl', full_name: 'Admin', role: 'admin', telefoon: '', thuisadres: '' },
  { id: 'kantoor1', email: 'kantoor@test.nl', full_name: 'Kantoor', role: 'kantoor', telefoon: '', thuisadres: '' },
  { id: 'buiten1', email: 'buitendienst@test.nl', full_name: 'Buitendienst', role: 'buitendienst', telefoon: '', thuisadres: '' },
  { id: 'tekenaar1', email: 'tekenaar@test.nl', full_name: 'Tekenaar', role: 'tekenaar', telefoon: '', thuisadres: '' },
  { id: 'verkoper1', email: 'verkoper@test.nl', full_name: 'Verkoper', role: 'verkoper', telefoon: '', thuisadres: '' },
];

function getUsers() {
  const stored = localStorage.getItem(STORAGE_PREFIX + 'users');
  if (!stored) {
    localStorage.setItem(STORAGE_PREFIX + 'users', JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
  }
  return JSON.parse(stored);
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_PREFIX + 'users', JSON.stringify(users));
}

const auth = {
  async me() {
    const currentUser = localStorage.getItem(STORAGE_PREFIX + 'currentUser');
    if (!currentUser) throw new Error('Not authenticated');
    const user = JSON.parse(currentUser);
    // Refresh from store
    const users = getUsers();
    const fresh = users.find(u => u.id === user.id);
    if (fresh) {
      localStorage.setItem(STORAGE_PREFIX + 'currentUser', JSON.stringify(fresh));
      return fresh;
    }
    throw new Error('User not found');
  },

  async login(email) {
    const users = getUsers();
    const user = users.find(u => u.email === email);
    if (!user) throw new Error('User not found');
    localStorage.setItem(STORAGE_PREFIX + 'currentUser', JSON.stringify(user));
    return user;
  },

  async updateMe(data) {
    const currentUser = localStorage.getItem(STORAGE_PREFIX + 'currentUser');
    if (!currentUser) throw new Error('Not authenticated');
    const user = JSON.parse(currentUser);
    const users = getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx === -1) throw new Error('User not found');
    users[idx] = { ...users[idx], ...data };
    saveUsers(users);
    localStorage.setItem(STORAGE_PREFIX + 'currentUser', JSON.stringify(users[idx]));
    return users[idx];
  },

  logout(redirectUrl) {
    localStorage.removeItem(STORAGE_PREFIX + 'currentUser');
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  },

  redirectToLogin(currentUrl) {
    if (currentUrl) {
      window.location.href = '/dev-login?redirect=' + encodeURIComponent(currentUrl);
    } else {
      window.location.href = '/dev-login';
    }
  }
};

// ---- Entity CRUD ----
function createEntityAPI(name) {
  return {
    async list(sort, limit) {
      let items = getStore(name);
      if (sort) {
        const desc = sort.startsWith('-');
        const field = desc ? sort.slice(1) : sort;
        items.sort((a, b) => {
          const va = a[field] || '';
          const vb = b[field] || '';
          const cmp = va < vb ? -1 : va > vb ? 1 : 0;
          return desc ? -cmp : cmp;
        });
      }
      return limit ? items.slice(0, limit) : items;
    },

    async filter(filterFnOrObj, sort, limit) {
      let items = getStore(name);
      // Support both function and object filters
      if (typeof filterFnOrObj === 'function') {
        items = items.filter(filterFnOrObj);
      } else if (typeof filterFnOrObj === 'object' && filterFnOrObj !== null) {
        items = items.filter(item => {
          return Object.entries(filterFnOrObj).every(([key, val]) => item[key] === val);
        });
      }
      if (sort) {
        const desc = sort.startsWith('-');
        const field = desc ? sort.slice(1) : sort;
        items.sort((a, b) => {
          const va = a[field] || '';
          const vb = b[field] || '';
          const cmp = va < vb ? -1 : va > vb ? 1 : 0;
          return desc ? -cmp : cmp;
        });
      }
      return limit ? items.slice(0, limit) : items;
    },

    async create(data) {
      const items = getStore(name);
      const newItem = { ...data, id: genId(), created_date: new Date().toISOString(), updated_date: new Date().toISOString() };
      items.push(newItem);
      setStore(name, items);
      return newItem;
    },

    async update(id, data) {
      const items = getStore(name);
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) throw new Error('Item not found');
      items[idx] = { ...items[idx], ...data, updated_date: new Date().toISOString() };
      setStore(name, items);
      return items[idx];
    },

    async delete(id) {
      const items = getStore(name);
      const filtered = items.filter(i => i.id !== id);
      if (filtered.length === items.length) throw new Error('Item not found');
      setStore(name, filtered);
      return { success: true };
    },

    subscribe(fn) {
      if (!subscribers[name]) subscribers[name] = [];
      subscribers[name].push(fn);
      return () => {
        subscribers[name] = subscribers[name].filter(f => f !== fn);
      };
    }
  };
}

// ---- Integrations ----
const integrations = {
  Core: {
    async UploadFile({ file }) {
      // Convert file to base64 data URL for local storage
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const file_url = reader.result;
          resolve({ file_url });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
  }
};

// ---- Functions ----
const functions = {
  async invoke(name, params) {
    if (name === 'logWerkbonAction') {
      // Log directly to WerkbonLog entity
      const logs = getStore('WerkbonLog');
      logs.push({
        ...params,
        id: genId(),
        created_date: new Date().toISOString()
      });
      setStore('WerkbonLog', logs);
      return { data: { success: true } };
    }
    if (name === 'reistijdProxy') {
      // Mock reistijd - use simple estimation
      return { data: { minuten: 30, coords: [52.0, 5.0] } };
    }
    if (name === 'createTestAccounts') {
      return { data: { success: true } };
    }
    return { data: null };
  }
};

export const base44 = {
  auth,
  entities: {
    Werkbon: createEntityAPI('Werkbon'),
    Urenregistratie: createEntityAPI('Urenregistratie'),
    WerkbonLog: createEntityAPI('WerkbonLog'),
    TekeningOpdracht: createEntityAPI('TekeningOpdracht'),
    WerkbonBericht: createEntityAPI('WerkbonBericht'),
    User: createEntityAPI('User'),
  },
  integrations,
  functions,
};
