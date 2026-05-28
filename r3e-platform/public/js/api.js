/* ════ api.js — All API calls to the Express backend ════ */

const API = {
  _base: '',

  async _req(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(this._base + path, opts);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Server error');
    return data;
  },
  get(path)        { return this._req('GET', path); },
  post(path, body) { return this._req('POST', path, body); },
  put(path, body)  { return this._req('PUT', path, body); },

  /* AUTH */
  login: (email, password) => API.post('/api/auth/login', { email, password }),

  /* USERS */
  getUsers:         ()          => API.get('/api/users'),
  createUser:       (data)      => API.post('/api/users', data),
  updateUser:       (id, data)  => API.put(`/api/users/${id}`, data),
  changePassword:   (id, cur, nw) => API.put(`/api/users/${id}/password`, { currentPassword: cur, newPassword: nw }),
  resetUserPwd:     (id, pwd, by) => API.put(`/api/users/${id}/reset-password`, { newPassword: pwd, resetBy: by }),

  /* LOCATIONS */
  getLocations:     ()         => API.get('/api/locations'),
  createLocation:   (data)     => API.post('/api/locations', data),
  updateLocation:   (id, data) => API.put(`/api/locations/${id}`, data),

  /* MERCHANTS */
  getMerchants:     (qs = '')       => API.get('/api/merchants' + (qs ? '?' + qs : '')),
  getMerchant:      (id)            => API.get(`/api/merchants/${id}`),
  createMerchant:   (data)          => API.post('/api/merchants', data),
  updateMerchant:   (id, data)      => API.put(`/api/merchants/${id}`, data),
  approveMerchant:  (id, by)        => API.put(`/api/merchants/${id}/approve`, { approvedBy: by }),
  rejectMerchant:   (id, by, reason) => API.put(`/api/merchants/${id}/reject`, { rejectedBy: by, reason: reason||'' }),
  toggleEngine:     (id, on, by)    => API.put(`/api/merchants/${id}/engine`, { engineOn: on, updatedBy: by }),
  resetMerchantPwd: (id, pwd, by)   => API.put(`/api/merchants/${id}/reset-password`, { newPassword: pwd, resetBy: by }),

  /* MANAGERS */
  getManagers:    (merchantId)      => API.get(`/api/managers/${merchantId}`),
  createManager:  (merchantId, data) => API.post(`/api/managers/${merchantId}`, data),
  updateManager:  (id, data)        => API.put(`/api/managers/${id}`, data),
  resetMgrPwd:    (id, pwd, by)     => API.put(`/api/managers/${id}/reset-password`, { newPassword: pwd, resetBy: by }),

  /* CUSTOMERS */
  getCustomers:   (merchantId, qs = '') => API.get(`/api/customers/${merchantId}` + (qs ? '?' + qs : '')),
  addCustomers:   (merchantId, data)    => API.post(`/api/customers/${merchantId}`, data),

  /* DISCOUNTS */
  getDiscounts:   (merchantId)       => API.get(`/api/discounts/${merchantId}`),
  saveDiscounts:  (merchantId, data) => API.put(`/api/discounts/${merchantId}`, data),

  /* HOURS */
  getHours:       (merchantId)       => API.get(`/api/hours/${merchantId}`),
  saveHours:      (merchantId, data) => API.put(`/api/hours/${merchantId}`, data),

  /* FLYERS */
  getFlyers:      (merchantId)       => API.get(`/api/flyers/${merchantId}`),
  saveFlyers:     (merchantId, data) => API.put(`/api/flyers/${merchantId}`, data),

  /* CAMPAIGNS */
  getCampaigns:   (merchantId = '')  => API.get('/api/campaigns' + (merchantId ? '?merchantId=' + merchantId : '')),

  /* LOGS */
  getLogs:        (limit = 100)      => API.get(`/api/logs?limit=${limit}`),
  addLog:         (action, user, target) => API.post('/api/logs', { action, user, target }),

  /* STATS */
  getSystemStats: ()   => API.get('/api/stats/system'),
  getMerchantStats:(id) => API.get(`/api/stats/merchant/${id}`),
};

/* FORGOT PASSWORD / OTP */
Object.assign(API, {
  forgotPassword: (email)              => API.post('/api/auth/forgot-password', { email }),
  verifyOTP:      (email, otp)         => API.post('/api/auth/verify-otp',      { email, otp }),
  resetPassword:  (email, token, pwd)  => API.post('/api/auth/reset-password',  { email, token, newPassword: pwd }),
});

/* ── Social Media ── */
Object.assign(API, {
  getSocialAccounts:    (mid)             => API.get(`/api/social/accounts/${mid}`),
  disconnectSocial:     (mid, platform)   => API.delete(`/api/social/disconnect/${mid}/${platform}`),
  publishFlyer:         (mid, body)       => API.post(`/api/social/publish/${mid}`, body),
});
