/* =========================================================
 * Kitsune v2 — Gaming Chat Media
 * Local-first Discord-style client with the Kitsune theme.
 * ========================================================= */

(function() {
  'use strict';

  // ---------- Constants & helpers ----------
  const LS = {
    state: 'kitsune_v2_state',
    session: 'kitsune_v2_session',
    users: 'kitsune_v2_saved_users',
  };

  const COLORS = {
    pink: '#ff5fa2', online: '#3ad98c', idle: '#ffb000', dnd: '#ff5555'
  };

  const EMOJIS = ['🦊','🎮','🔥','❤️','👍','👎','😂','😮','😢','😡','✨','🌟','💀','⚡','🎯','🏆','🕹️','💎','🌙','🧠','🐱','🐺','🐉','🍕','🚀','🛸','🪐','🌌','🎧','🎤','📹','💻','🖥️','🎲','🃏','🎴','🌹','🍷','☕','🍵'];

  const AVATARS = [
    'https://api.dicebear.com/9.x/identicon/svg?seed=',
    'https://api.dicebear.com/9.x/bottts/svg?seed=',
    'https://api.dicebear.com/9.x/avataaars/svg?seed=',
    'https://api.dicebear.com/9.x/adventurer/svg?seed=',
    'https://api.dicebear.com/9.x/micah/svg?seed=',
  ];

  const STATUS_LABELS = { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline' };

  const SVG = {
    hash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    userPlus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>',
    gamepad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>',
    ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
  };

  function $id(id) { return document.getElementById(id); }
  function $one(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function randId(prefix) { return (prefix || 'k') + Math.random().toString(36).slice(2, 10); }
  function escapeHtml(s) { return (s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
  function avatarFor(name, variant) { return AVATARS[(variant || 0) % AVATARS.length] + encodeURIComponent(name || 'unknown') + '&backgroundColor=1a1018&radius=50'; }
  function timeStr(ts) { const d = new Date(ts); return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
  function dateStr(ts) { const d = new Date(ts); return d.toLocaleDateString(); }
  function isMobile() { return window.innerWidth <= 700; }

  async function api(path, options = {}) {
    const url = new URL(path, location.href).href;
    try {
      const response = await fetch(url, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
      });
      if (response.status === 204) return null;
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: response.status });
      return data;
    } catch (error) {
      if (error.name === 'TypeError') throw Object.assign(new Error('Cannot complete request — check the server URL and your connection.'), { original: error });
      throw error;
    }
  }

  // ---------- State ----------
  const state = {
    me: null,
    friends: [],
    blocked: [],
    servers: [],
    dms: [],
    current: { type: 'home' },
    messages: {},
    typing: {},
    settings: { compact: false, nsfw: false, gameMode: false, alwaysPreview: false, enterSend: true, theme: 'kitsune' },
    call: { active: false, type: null, targetId: null, roomId: null, mic: true, video: false, screen: false, start: 0, streams: {}, peers: {} },
    iceServers: [],
    ui: { inputMode: 'idle', replyTo: null, editing: null, attachments: [] },
  };

  const DEFAULT_CHANNELS = [
    { id: 'gen', name: 'general', type: 'text', topic: 'Talk freely.' },
    { id: 'lfg', name: 'looking-for-group', type: 'text', topic: 'Find a squad.' },
    { id: 'clips', name: 'clips', type: 'text', topic: 'Share your best plays.' },
    { id: 'voice-lounge', name: 'Lounge', type: 'voice' },
    { id: 'voice-ranked', name: 'Ranked Squad', type: 'voice' },
    { id: 'voice-queue', name: 'Queue Up', type: 'voice' },
  ];

  // ---------- Persistence ----------
  function load() {
    try {
      const raw = localStorage.getItem(LS.state);
      if (!raw) return seed();
      Object.assign(state, JSON.parse(raw));
      if (!state.friends) state.friends = [];
      if (!state.blocked) state.blocked = [];
      if (!state.servers) state.servers = [];
      if (!state.dms) state.dms = [];
      if (!state.messages) state.messages = {};
      if (!state.settings) state.settings = {};
      if (!state.typing) state.typing = {};
      if (!state.ui) state.ui = { inputMode: 'idle', replyTo: null, editing: null, attachments: [] };
      if (state.me && !state.me.role) state.me.role = 'Wanderer';
    if (state.me && state.me.avatarVariant === undefined) state.me.avatarVariant = 0;
    if (state.me && state.me.customAvatar === undefined) state.me.customAvatar = false;
    } catch (e) { seed(); }
    normalizeIds();
    if (state.servers.length === 0) seedServers();
  }

  function save() { try { localStorage.setItem(LS.state, JSON.stringify(state)); } catch (e) { console.warn('save failed', e); } }

  function seed() {
    state.friends = [];
    state.blocked = [];
    state.servers = [];
    state.dms = [];
    state.messages = {};
    state.typing = {};
    state.settings = { compact: false, nsfw: false, gameMode: false, alwaysPreview: false, enterSend: true, theme: 'kitsune' };
    seedServers();
  }

  function seedServers() {
    state.servers = [
      createServer('Kitsune Den', '🦊'),
      createServer('Ranked Grinders', '⚔️'),
      createServer('Casual Chat', '🍕'),
    ];
  }

  function createServer(name, icon) {
    return {
      id: randId('s'), name, icon,
      categories: [
        { id: randId('c'), name: 'Information', channels: [
          { id: randId('ch'), name: 'rules', type: 'text', topic: 'Read before you run.' },
          { id: randId('ch'), name: 'announcements', type: 'text', topic: 'Server updates.' },
        ]},
        { id: randId('c'), name: 'Community', channels: [
          { id: randId('ch'), name: 'general', type: 'text', topic: 'General chat.' },
          { id: randId('ch'), name: 'memes', type: 'text', topic: 'Drop the heat.' },
        ]},
        { id: randId('c'), name: 'Voice', channels: [
          { id: randId('ch'), name: 'Lounge', type: 'voice' },
          { id: randId('ch'), name: 'Squad 1', type: 'voice' },
        ]},
      ],
      members: [],
      banned: [],
    };
  }



  function normalizeIds() {
    state.servers.forEach(s => {
      if (!s.categories) s.categories = [];
      s.members = [];
      s.banned = [];
      s.categories.forEach(cat => {
        if (!cat.channels) cat.channels = [];
        cat.channels.forEach(ch => { if (!ch.id) ch.id = randId('ch'); if (!ch.type) ch.type = 'text'; });
      });
    });
  }

  // ---------- User / auth ----------
  function hash(str) { let h=2166136261; for (let i=0;i<str.length;i++) h^=str.charCodeAt(i), h*=16777619; return (h>>>0).toString(36); }
  async function hashV1(pass) {
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const buf = new TextEncoder().encode(pass);
        const b = await crypto.subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join('');
      }
    } catch (_) {}
    try { return btoa(pass).split('').reverse().join(''); } catch (_) {}
    return pass;
  }
  function amOwner() {
    if (!state.me) return false;
    const server = state.servers.find(s => s.id === state.current.serverId);
    return state.me.role === 'Tenko' || server?.members.find(m => m.id === state.me.id)?.role === 'Tenko';
  }
  function isAdmin(u) { return u && (u.role === 'Admin' || u.role === 'Tenko'); }
  function canModerate(u) { return amOwner() && u && u.id !== state.me.id; }

  function validateAuth(user, pass) {
    if (!user || user.length<2 || user.length>24) return 'Name must be 2-24 characters';
    if (!pass || pass.length<8 || pass.length>128) return 'Password must be 8-128 characters';
    if (!/^[a-zA-Z0-9_\-\s]+$/.test(user)) return 'Name can only contain letters, numbers, spaces, _ and -';
    return null;
  }

  function applyBootstrap(data) {
    state.me = data.me;
    state.friends = data.friends || [];
    state.blocked = data.blocked || [];
    state.servers = data.servers || [];
    state.dms = data.dms || [];
    state.iceServers = data.iceServers || [];
    const currentServer = state.servers.find(s => s.id === state.current.serverId);
    if (!currentServer) {
      const firstServer = state.servers[0];
      const firstChannel = firstServer?.categories.flatMap(c => c.channels).find(c => c.type === 'text');
      state.current = firstServer && firstChannel ? { type: 'channel', serverId: firstServer.id, channelId: firstChannel.id } : { type: 'home' };
    }
  }

  async function refreshBootstrap() {
    const data = await api('/api/bootstrap');
    applyBootstrap(data);
    save();
    return data;
  }

  async function handleAuth() {
    const mode = $one('.auth-tab.active').dataset.mode;
    const username = $id('authUser').value.trim();
    const password = $id('authPass').value;
    const pass2 = $id('authPass2').value;
    const err = $id('authError');
    let problem = validateAuth(username, password);
    if (mode === 'register' && password !== pass2) problem = 'Passwords do not match';
    if (problem) { err.textContent = problem; err.classList.remove('hidden'); return; }
    $id('authSubmit').disabled = true;
    try {
      const result = await api(`/api/auth/${mode}`, { method: 'POST', body: JSON.stringify({ username, password, remember: $id('authRemember').checked }) });
      if (mode === 'register' && result.recoveryCode) {
        $id('authForm').classList.add('hidden');
        $id('authTabs').classList.add('hidden');
        $id('recoveryCodeValue').textContent = result.recoveryCode;
        $id('recoveryCodeDisplay').classList.remove('hidden');
        $id('authSubmit').disabled = false;
        return;
      }
      state.me = result.user;
      if ($id('authRemember').checked) {
        const saved = getSavedUsers().filter(u => u.name.toLowerCase() !== username.toLowerCase());
        saved.push({ name: username, remember: true });
        setSavedUsers(saved);
      }
      await refreshBootstrap();
      enterApp();
    } catch (error) {
      err.textContent = error.message;
      err.classList.remove('hidden');
    } finally { $id('authSubmit').disabled = false; }
  }

  function showForgotForm() {
    $id('authForm').classList.add('hidden');
    $id('authTabs').classList.add('hidden');
    $id('forgotPasswordForm').classList.remove('hidden');
    $id('recoveryCodeDisplay').classList.add('hidden');
    $id('authError').classList.add('hidden');
  }

  function hideForgotForm() {
    $id('forgotPasswordForm').classList.add('hidden');
    $id('authForm').classList.remove('hidden');
    $id('authTabs').classList.remove('hidden');
    $id('authError').classList.add('hidden');
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    const username = $id('forgotUser').value.trim();
    const recoveryCode = $id('forgotCode').value.toUpperCase().replace(/\s+/g, '');
    const newPass = $id('forgotNewPass').value;
    const confirm = $id('forgotConfirmPass').value;
    const err = $id('authError');
    let problem = '';
    if (newPass.length < 8) problem = 'Password must be at least 8 characters.';
    if (newPass !== confirm) problem = 'Passwords do not match.';
    if (!recoveryCode) problem = 'Enter your recovery code.';
    if (problem) { err.textContent = problem; err.classList.remove('hidden'); return; }
    $id('forgotSubmit').disabled = true;
    try {
      await api('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ username, recoveryCode, newPassword: newPass }) });
      toast('Password reset. You can now log in.');
      $id('forgotUser').value = ''; $id('forgotCode').value = ''; $id('forgotNewPass').value = ''; $id('forgotConfirmPass').value = '';
      hideForgotForm();
    } catch (error) {
      err.textContent = error.message;
      err.classList.remove('hidden');
    } finally { $id('forgotSubmit').disabled = false; }
  }

  function getSavedUsers() { try { return JSON.parse(localStorage.getItem(LS.users) || '[]'); } catch (e) { return []; } }
  function setSavedUsers(u) { try { localStorage.setItem(LS.users, JSON.stringify(u)); } catch (e) {} }

  function exportFullData() {
    const data = { state, savedUsers: getSavedUsers(), version: 2 };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'kitsune-v2-backup.json';
    a.click(); URL.revokeObjectURL(url);
    toast('Full data exported');
  }

  async function importFullData(file) {
    const text = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsText(file); });
    try {
      const data = JSON.parse(text);
      if (!data.state) throw new Error('No state in file');
      if (data.savedUsers) setSavedUsers(data.savedUsers);
      Object.assign(state, data.state);
      save(); load(); renderAuthSaved();
      if (state.me) { enterApp(); } else { renderAuthSaved(); $id('authScreen').classList.remove('hidden'); }
      toast('Full data imported. Refresh if needed.');
    } catch (e) { toast('Failed to import: ' + e.message, 'error'); }
  }

  function exportSavedUsers() {
    const users = getSavedUsers();
    const data = JSON.stringify(users, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'kitsune-v2-saved-users.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Saved users exported');
  }

  function importSavedUsers(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!Array.isArray(imported)) throw new Error('Invalid file');
        const saved = getSavedUsers();
        const names = new Set(saved.map(u => u.name));
        let added = 0;
        imported.forEach(u => {
          if (u && u.name && !names.has(u.name)) { saved.push(u); names.add(u.name); added++; }
        });
        setSavedUsers(saved); renderAuthSaved();
        toast(added ? `Imported ${added} account(s)` : 'No new accounts to import');
      } catch (err) { toast('Failed to import: ' + err.message, 'error'); }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  function importLegacyCredentials() {
    try {
      const raw = localStorage.getItem('kitsune_accounts_v1');
      if (!raw) { toast('No Kitsune v1 credentials found on this device', 'error'); return; }
      const old = JSON.parse(raw);
      const saved = getSavedUsers();
      const names = new Set(saved.map(u => u.name));
      let added = 0;
      Object.values(old).forEach(acc => {
        if (acc && acc.name && !names.has(acc.name)) {
          saved.push({ name: acc.name, passHash: acc.hash, remember: false, role: acc.role || 'Wanderer' });
          added++;
        }
      });
      if (added) {
        setSavedUsers(saved); renderAuthSaved();
        toast(`Imported ${added} Kitsune v1 account(s)`);
      } else {
        toast('No new v1 accounts to import');
      }
    } catch (e) { toast('Legacy import failed', 'error'); console.warn('legacy import failed', e); }
  }

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) {}
    if (state.call.active) endCall();
    $id('app').classList.add('hidden');
    $id('authScreen').classList.remove('hidden');
    state.me = null;
    state.current = { type: 'home' };
    if (socket) { socket.close(); socket = null; }
    renderAuthSaved();
  }

  // ---------- Navigation ----------
  function switchTo(target) {
    state.current = target;
    state.ui.editing = null;
    state.ui.replyTo = null;
    state.ui.attachments = [];
    updateUrlView();
    renderSidebar();
    renderContent();
    renderMembers();
    loadConversationMessages(target);
    if (isMobile()) { $id('body').classList.remove('mobile-sidebar'); $id('body').classList.remove('mobile-members'); $id('mobileOverlay').classList.remove('show'); }
  }

  function getChannelById(sid, cid) {
    const s = state.servers.find(x => x.id === sid); if (!s) return null;
    for (const cat of s.categories) {
      for (const ch of cat.channels) if (ch.id === cid) return ch;
    }
    return null;
  }

  function getDmById(id) { return state.dms.find(x => x.id === id); }

  function updateUrlView() { /* no-op for static */ }

  // ---------- Message operations ----------
  function channelKey(sid, cid) { return `${sid}:${cid}`; }
  function dmKey(did) { return `dm:${did}`; }

  function messagesForCurrent() {
    if (state.current.type === 'channel') return state.messages[channelKey(state.current.serverId, state.current.channelId)] || [];
    if (state.current.type === 'dm') return state.messages[dmKey(state.current.dmId)] || [];
    return [];
  }

  async function loadConversationMessages(target = state.current) {
    try {
      if (target.type === 'channel') {
        const data = await api(`/api/channels/${encodeURIComponent(target.channelId)}/messages?limit=50`);
        state.messages[channelKey(target.serverId, target.channelId)] = data.messages;
      } else if (target.type === 'dm') {
        const dm = getDmById(target.dmId);
        if (!dm?.threadId) return;
        const data = await api(`/api/dms/${encodeURIComponent(dm.threadId)}/messages?limit=50`);
        state.messages[dmKey(target.dmId)] = data.messages;
      } else return;
      if (state.current.type === target.type && (target.type === 'channel' ? state.current.channelId === target.channelId : state.current.dmId === target.dmId)) renderMessages();
    } catch (error) { if (error.status !== 401) toast(error.message, 'error'); }
  }

  function addMessage(targetKey, msg) {
    if (!state.messages[targetKey]) state.messages[targetKey] = [];
    state.messages[targetKey].push(msg);
    if (state.messages[targetKey].length > 500) state.messages[targetKey].shift();
    save();
  }

  function addSystemMessage(targetKey, text) {
    addMessage(targetKey, { id: randId('m'), author: 'System', authorId: 'system', avatar: '', text, ts: Date.now(), system: true });
  }

  function simulateMemberJoin(sid) { return; }

  async function sendMessage() {
    const input = $id('msgInput');
    const text = input.value.trim();
    if (!text && state.ui.attachments.length === 0) return;
    if (!state.me) return;

    if (state.ui.editing) {
      const messageId = state.ui.editing;
      const endpoint = state.current.type === 'dm' ? `/api/dm-messages/${messageId}` : `/api/messages/${messageId}`;
      api(endpoint, { method: 'PATCH', body: JSON.stringify({ content: text }) }).catch(error => toast(error.message, 'error'));
      state.ui.editing = null; input.value = ''; updateComposerState(); return;
    }

    const targetKey = state.current.type === 'channel' ? channelKey(state.current.serverId, state.current.channelId) : state.current.type === 'dm' ? dmKey(state.current.dmId) : null;
    if (!targetKey) return;

    const msg = {
      id: randId('m'), author: state.me.name, authorId: state.me.id,
      avatar: state.me.avatar, text, ts: Date.now(),
      attachments: state.ui.attachments.slice(), reactions: [], system: false
    };

    if (text.startsWith('/')) { handleSlashCommand(text, targetKey); input.value = ''; updateComposerState(); return; }

    try {
      await sendMessageToServer(msg);
      state.ui.attachments = [];
      input.value = '';
      updateComposerState();
    } catch (error) { toast(error.message, 'error'); }
  }

  async function handleSlashCommand(text, targetKey) {
    const parts = text.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const rest = parts.slice(1).join(' ');
    switch (cmd) {
      case 'help':
        toast('Commands: /me, /shrug, /nick, /status, /clear, /ping');
        break;
      case 'me':
        await sendMessageToServer({ text: `*${rest || 'does something'}*`, attachments: [] });
        break;
      case 'shrug':
        await sendMessageToServer({ text: `¯\\_(ツ)_/¯ ${rest}`, attachments: [] });
        break;
      case 'nick':
        if (rest) {
          try { const result = await api('/api/users/me', { method: 'PATCH', body: JSON.stringify({ name: rest.slice(0, 24), bio: state.me.bio, avatar: state.me.avatar }) }); Object.assign(state.me, result.user); renderUserBar(); toast('Nickname updated'); }
          catch (error) { toast(error.message, 'error'); }
        }
        break;
      case 'status':
        if (rest) { state.me.activity = rest.slice(0, 128); wsSend({ type: 'status', status: state.me.status, activity: state.me.activity }); renderUserBar(); }
        break;
      case 'clear':
        if (amOwner() && state.current.type === 'channel') await clearServerHistory();
        else toast('Only Tenko can clear shrine history', 'error');
        break;
      case 'ping':
        toast(socket?.readyState === WebSocket.OPEN ? 'Kitsune realtime is connected' : 'Kitsune realtime is offline', socket?.readyState === WebSocket.OPEN ? 'info' : 'error');
        break;
      default:
        toast(`Unknown command: ${cmd}`, 'error');
    }
  }

  function maybeSimulateReply(targetKey) { return; }

  function currentMembers() {
    if (state.current.type === 'channel') {
      const s = state.servers.find(x => x.id === state.current.serverId);
      return s ? Array.from(new Map([...s.members, state.me].map(u => [u.id, u])).values()) : [state.me];
    }
    if (state.current.type === 'dm') {
      const dm = getDmById(state.current.dmId);
      return dm ? [state.me, dm] : [state.me];
    }
    return [state.me];
  }

  function findUser(userId) {
    if (userId === state.me?.id) return state.me;
    for (const server of state.servers) {
      const member = server.members.find(user => user.id === userId);
      if (member) return member;
    }
    return state.friends.find(user => user.id === userId)
      || state.blocked.find(user => user.id === userId)
      || state.dms.find(user => user.id === userId)
      || null;
  }

  async function deleteMessage(id) {
    const endpoint = state.current.type === 'dm' ? `/api/dm-messages/${id}` : `/api/messages/${id}`;
    try { await api(endpoint, { method: 'DELETE' }); }
    catch (error) { toast(error.message, 'error'); }
  }

  function startEdit(id) {
    const msgs = messagesForCurrent(); const msg = msgs.find(m => m.id === id); if (!msg) return;
    state.ui.editing = id;
    $id('msgInput').value = msg.text;
    $id('msgInput').focus();
    updateComposerState();
  }

  async function toggleReaction(id, emoji) {
    if (state.current.type !== 'channel') return toast('DM reactions are coming next', 'error');
    try { await api(`/api/messages/${id}/reaction`, { method: 'POST', body: JSON.stringify({ emoji }) }); }
    catch (error) { toast(error.message, 'error'); }
  }

  function openFileInput() { $id('fileInput').click(); }

  async function handleFileInput(e) {
    const files = Array.from(e.target.files || []);
    for (const file of files.slice(0, 4)) {
      try {
        if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 1000000) { toast('Use a PNG, JPEG, WebP, or GIF under 1 MB', 'error'); continue; }
        const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
        state.ui.attachments.push({ type: 'image', name: file.name, data: dataUrl });
      } catch (err) { toast('Could not attach file', 'error'); }
    }
    renderAttachmentTray();
    $id('fileInput').value = '';
  }

  function removeAttachment(idx) { state.ui.attachments.splice(idx, 1); renderAttachmentTray(); }

  // ---------- Friends ----------
  async function addFriend(name) {
    name = name.trim();
    if (!name || name.length < 2 || name.length > 24) { toast('Name must be 2-24 characters', 'error'); return false; }
    if (!/^[a-zA-Z0-9_\-\s]+$/.test(name)) { toast('Invalid username. Use letters, numbers, spaces, _ and - only.', 'error'); return false; }
    try {
      await api('/api/friends', { method: 'POST', body: JSON.stringify({ username: name }) });
      await refreshBootstrap();
      renderSidebar();
      toast('Friend request sent');
      return true;
    } catch (error) { toast(error.message, 'error'); return false; }
  }

  async function acceptFriend(id) {
    try { await api(`/api/friends/${encodeURIComponent(id)}/accept`, { method: 'POST' }); await refreshBootstrap(); if ($id('friendsList')) renderFriendsList('All'); toast('Friend request accepted'); return true; }
    catch (error) { toast(error.message, 'error'); return false; }
  }

  async function removeFriend(id) {
    const f = state.friends.find(x => x.id === id);
    if (!f || !confirm(`Remove ${f.name} from friends?`)) return;
    try { await api(`/api/friends/${encodeURIComponent(id)}`, { method: 'DELETE' }); await refreshBootstrap(); renderFriendsList($one('.friends-tab.active')?.dataset.tab || 'All'); toast(`${f.name} removed`); }
    catch (error) { toast(error.message, 'error'); }
  }

  async function blockFriend(id) {
    const f = state.friends.find(x => x.id === id);
    if (!f || !confirm(`Block ${f.name}? You can unblock them later.`)) return;
    try { await api(`/api/blocks/${encodeURIComponent(id)}`, { method: 'POST' }); await refreshBootstrap(); renderFriendsList($one('.friends-tab.active')?.dataset.tab || 'All'); toast(`${f.name} blocked`); }
    catch (error) { toast(error.message, 'error'); }
  }

  async function unblockFriend(id) {
    const b = state.blocked.find(x => x.id === id);
    if (!b) return;
    try { await api(`/api/blocks/${encodeURIComponent(id)}`, { method: 'DELETE' }); await refreshBootstrap(); renderFriendsList('Blocked'); toast(`${b.name} unblocked`); }
    catch (error) { toast(error.message, 'error'); }
  }

  async function openDmWith(user) {
    try {
      const result = await api('/api/dms', { method: 'POST', body: JSON.stringify({ userId: user.id }) });
      let dm = state.dms.find(d => d.id === user.id);
      if (!dm) { dm = { ...user, unread: false, threadId: result.threadId }; state.dms.push(dm); }
      else dm.threadId = result.threadId;
      save();
      switchTo({ type: 'dm', dmId: dm.id });
      return true;
    } catch (error) { toast(error.message, 'error'); return false; }
  }

  // ---------- Calls ----------
  function stopTracks(stream) { if (!stream) return; stream.getTracks().forEach(t => { try { t.stop(); } catch (_) {} }); }

  async function tuneVideoSender(sender, track, screen = false) {
    if (!sender || !track) return;
    track.contentHint = screen ? 'motion' : '';
    try {
      const parameters = sender.getParameters();
      if (!parameters.encodings?.length) parameters.encodings = [{}];
      parameters.encodings[0].maxBitrate = screen ? (isMobile() ? 5000000 : 9000000) : 3000000;
      parameters.encodings[0].maxFramerate = screen ? 60 : 30;
      parameters.degradationPreference = screen ? 'maintain-framerate' : 'balanced';
      await sender.setParameters(parameters);
    } catch (_) {}
  }

  function detectPlatform() {
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    const isChrome = /Chrome|CriOS/i.test(ua);
    const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
    const isWebView = window.AndroidWebView || /(wv)/.test(ua) || (isAndroid && !isChrome && !isSafari);
    const isElectron = Boolean(window.kitsuneDesktop);
    // Detect Android native app. The Capacitor bridge is NOT injected into external URLs
    // (known Capacitor bug #7454), so we also check window.kitsuneNative which is a
    // @JavascriptInterface that works on ALL pages including the remote server URL.
    const capPlatform = (() => { try { return window.Capacitor?.getPlatform?.(); } catch (_) { return null; } })();
    const isAndroidNative = Boolean(window.kitsuneNative?.isNativeApp?.()) || capPlatform === 'android' || Boolean(window.Capacitor?.Plugins?.KitsuneUpdater);
    const isIOSNative = capPlatform === 'ios' || Boolean(window.Capacitor && !isAndroidNative);
    const isWebPWA = !isElectron && !isAndroidNative && !isIOSNative;
    return { isAndroid, isIOS, isSafari, isChrome, isStandalone, isWebView, isElectron, isAndroidNative, isIOSNative, isWebPWA, isMobile: isMobile() };
  }

  async function captureDisplay() {
    const plat = detectPlatform();
    const md = navigator.mediaDevices;
    const haveGDM = typeof md?.getDisplayMedia === 'function';

    // ---- Path 1: Android native app ----
    // Uses native WebRTC with ScreenCapturerAndroid for full 30 FPS screen capture.
    // Falls back to canvas-based capture if native WebRTC is not available.
    if (plat.isAndroidNative) {
      // Try native WebRTC first (30 FPS, native encoding)
      if (window.kitsuneNative?.isNativeWebRTCScreenSupported?.()) {
        try {
          return await startNativeWebRTCScreenShare();
        } catch (e) {
          console.warn('Native WebRTC screen share failed, trying canvas fallback:', e.message);
          // Fall through to canvas-based capture
        }
      }
      // Canvas-based fallback (12 FPS, JPEG frames)
      if (window.kitsuneNative?.isScreenCaptureSupported?.()) {
        try {
          return await startNativeAndroidScreenCapture();
        } catch (e) {
          console.warn('Canvas screen capture failed:', e.message);
          // Fall through to camera fallback below
        }
      }
    }

    // ---- Path 2: Desktop browsers + Electron (getDisplayMedia works) ----
    if (haveGDM && !plat.isAndroid && !plat.isIOS) {
      const baseVideo = { frameRate: { ideal: 60, max: 60 }, width: { ideal: 1920, max: 2560 }, height: { ideal: 1080, max: 1920 } };
      const attempts = [
        { video: baseVideo, audio: true },
        { video: { frameRate: { ideal: 60 } }, audio: true },
        { video: { frameRate: 60 }, audio: false },
        { video: true, audio: true },
        { video: true, audio: false }
      ];
      let lastError = null;
      for (const constraints of attempts) {
        try {
          const stream = await md.getDisplayMedia(constraints);
          const track = stream.getVideoTracks()[0];
          if (!track) { stopTracks(stream); throw new Error('No screen video track was provided.'); }
          return stream;
        } catch (error) {
          lastError = error;
          if (error.name === 'NotAllowedError') throw error;
          if (error.name === 'NotFoundError') throw error;
        }
      }
      throw lastError || new Error('Screen capture failed on this device.');
    }

    // ---- Path 3: Android/iOS browser — try getDisplayMedia, fall back to camera ----
    // Chrome on Android does NOT support getDisplayMedia (MDN: "No support").
    // iOS Safari also does not support it. As a fallback, let the user share
    // their camera (front or back) as a "screen" stream so they can still
    // show something to the other call participants.
    if (plat.isAndroid || plat.isIOS) {
      // Try getDisplayMedia first (some Chrome versions / installed PWAs may support it)
      if (haveGDM) {
        try {
          const stream = await md.getDisplayMedia({ video: true, audio: false });
          const track = stream.getVideoTracks()[0];
          if (track) return stream;
          stopTracks(stream);
        } catch (_) { /* fall through to camera */ }
      }
      // Camera fallback: let user pick front or back camera
      return captureMobileCameraAsScreen();
    }

    // ---- Path 4: Any other browser — try getDisplayMedia, then camera fallback ----
    if (haveGDM) {
      try {
        const stream = await md.getDisplayMedia({ video: true, audio: false });
        const track = stream.getVideoTracks()[0];
        if (track) return stream;
        stopTracks(stream);
      } catch (error) {
        if (error.name === 'NotAllowedError') throw error;
      }
    }
    // Universal camera fallback — works on any browser with getUserMedia
    return captureMobileCameraAsScreen();
  }

  async function captureMobileCameraAsScreen() {
    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) throw Object.assign(new Error('Camera access is not available on this device.'), { code: 'NOT_SUPPORTED' });

    // Ask user which camera to share
    const choice = await showCameraChoiceDialog();
    if (!choice) throw Object.assign(new Error('Screen share cancelled.'), { code: 'CANCELLED' });

    const facingMode = choice === 'back' ? 'environment' : 'user';
    try {
      const stream = await md.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      const track = stream.getVideoTracks()[0];
      if (!track) { stopTracks(stream); throw new Error('No camera video track was provided.'); }
      // Tag the track so we know this is a camera-as-screen fallback
      track._kitsuneCameraFallback = true;
      return stream;
    } catch (error) {
      if (error.name === 'NotAllowedError') throw Object.assign(new Error('Camera permission was denied. Allow camera access to share.'), { code: 'DENIED' });
      throw error;
    }
  }

  function showCameraChoiceDialog() {
    return new Promise((resolve) => {
      const existing = $id('cameraChoiceModal');
      if (existing) existing.remove();
      const modal = document.createElement('div');
      modal.id = 'cameraChoiceModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-card" style="max-width:380px">
          <div class="modal-header"><span>SHARE CAMERA AS SCREEN</span></div>
          <div class="modal-body">
            <p style="color:var(--text-dim);margin-bottom:16px;font-size:13px">Screen capture isn't available in this browser. You can share your camera instead.</p>
            <div class="modal-actions" style="flex-direction:column;gap:8px">
              <button class="primary-btn" id="camBack" style="width:100%">Back Camera</button>
              <button class="primary-btn" id="camFront" style="width:100%">Front Camera</button>
              <button class="ghost-btn" id="camCancel" style="width:100%">Cancel</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.classList.remove('hidden');
      const close = (val) => { modal.remove(); resolve(val); };
      $id('camBack').onclick = () => close('back');
      $id('camFront').onclick = () => close('front');
      $id('camCancel').onclick = () => close(null);
      modal.addEventListener('click', (e) => { if (e.target === modal) close(null); });
    });
  }

  let nativeScreenListener = null;
  let nativeScreenStopListener = null;
  let nativeScreenErrorListener = null;

  // ---- Native WebRTC Screen Share (Android, full 30 FPS) ----
  // Uses native ScreenCapturerAndroid + native PeerConnection for Discord-quality screen sharing.
  // The native layer creates its own peer connections and we relay SDP/ICE through the WebSocket.
  let nativeScreenActive = false;

  async function startNativeWebRTCScreenShare() {
    const native = window.kitsuneNative;
    if (!native) throw Object.assign(new Error('Native bridge not available'), { code: 'NOT_SUPPORTED' });

    const call = state.call;
    // Peers may not be established yet — start capture anyway and add peers as they join
    const peerIds = Object.keys(call.peers);

    // Set up callbacks BEFORE starting
    native._onNativeScreenStarted = () => {
      nativeScreenActive = true;
      call.screen = true;
      call.streams.me.screen = true;
      call.streams.me.screenStream = { _nativeWebRTC: true, getVideoTracks: () => [{ _native: true, onended: null, getSettings: () => ({ frameRate: 30 }) }] };
      wsSend({ type: 'call-media-state', roomId: call.roomId, screen: true });
      renderCallStage();
      toast('Screen sharing at 30 FPS (native)', 'success');
    };

    native._onNativeScreenError = (msg) => {
      nativeScreenActive = false;
      toast(`Screen share error: ${msg}`, 'error', 6000);
    };

    native._onNativeScreenStopped = () => {
      nativeScreenActive = false;
      call.screen = false;
      call.streams.me.screen = false;
      call.streams.me.screenStream = null;
      call.screenSenders = {};
      wsSend({ type: 'call-media-state', roomId: call.roomId, screen: false });
      renderCallStage();
    };

    // Relay native SDP offers to the server
    native._onNativeScreenOffer = (peerId, sdp) => {
      wsSend({ type: 'rtc-offer', roomId: call.roomId, targetId: peerId, description: { type: 'offer', sdp }, screen: true, nativeScreen: true });
    };

    // Relay native ICE candidates to the server
    native._onNativeScreenIce = (peerId, sdp, sdpMid, sdpMLineIndex, serverUrl) => {
      const candidate = { candidate: sdp, sdpMid, sdpMLineIndex };
      if (serverUrl) candidate.candidate += ` url=${serverUrl}`;
      wsSend({ type: 'rtc-ice', roomId: call.roomId, targetId: peerId, candidate, screen: true, nativeScreen: true });
    };

    // Start native screen capture with ICE servers and peer IDs
    const iceServersJson = JSON.stringify(state.iceServers || []);
    const peerIdsJson = JSON.stringify(peerIds);
    const result = native.startNativeScreenShare(iceServersJson, peerIdsJson);
    try {
      const parsed = JSON.parse(result);
      if (!parsed.ok) throw new Error(parsed.error || 'Native screen share failed to start');
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error('Invalid response from native bridge');
      throw e;
    }

    // Wait for native capture to start (permission dialog)
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!nativeScreenActive) reject(new Error('Screen share permission timed out. Please tap "Start now" in the system dialog.'));
      }, 30000);

      const origStarted = native._onNativeScreenStarted;
      native._onNativeScreenStarted = () => {
        clearTimeout(timeout);
        origStarted && origStarted();
        resolve();
      };
      const origError = native._onNativeScreenError;
      native._onNativeScreenError = (msg) => {
        clearTimeout(timeout);
        reject(new Error(msg));
      };
    });

    // Return a dummy stream — the actual video goes through native peer connections
    // The caller (toggleScreen) expects a stream object with a video track
    const dummyStream = new MediaStream();
    const dummyTrack = { _native: true, kind: 'video', enabled: true, onended: null, getSettings: () => ({ frameRate: 30 }), stop: () => {} };
    dummyStream.getVideoTracks = () => [dummyTrack];
    dummyStream.getTracks = () => [dummyTrack];
    return dummyStream;
  }

  function stopNativeWebRTCScreenShare() {
    if (!nativeScreenActive) return;
    try { window.kitsuneNative?.stopNativeScreenShare?.(); } catch (_) {}
    nativeScreenActive = false;
  }

  // Relay answer from remote peer to native WebRTC
  function relayNativeScreenAnswer(data) {
    try {
      window.kitsuneNative?.nativeScreenReceiveAnswer?.(data.fromId, data.description.sdp);
    } catch (_) {}
  }

  // Relay ICE from remote peer to native WebRTC
  function relayNativeScreenIce(data) {
    try {
      const c = data.candidate || {};
      const sdp = c.candidate || '';
      const sdpMid = c.sdpMid || null;
      const sdpMLineIndex = c.sdpMLineIndex || 0;
      window.kitsuneNative?.nativeScreenReceiveIce?.(data.fromId, sdp, sdpMid, sdpMLineIndex, null);
    } catch (_) {}
  }

  // Add a new peer to native screen share when someone joins mid-call
  function addPeerToNativeScreenShare(userId) {
    if (!nativeScreenActive) return;
    try { window.kitsuneNative?.nativeScreenAddPeer?.(userId); } catch (_) {}
  }

  // ---- Legacy canvas-based screen capture (fallback) ----

  async function startNativeAndroidScreenCapture() {
    const native = window.kitsuneNative;
    if (!native || !native.isScreenCaptureSupported()) {
      throw Object.assign(new Error('Screen capture is not supported on this Android device.'), { code: 'NOT_SUPPORTED' });
    }

    // Set up callbacks BEFORE starting capture so we don't miss the first frame
    let onCaptureStarted, onCaptureError, onCaptureStopped, onFrameCallback;
    let captureStarted = false;
    let captureError = null;
    let pendingFrames = [];

    native._onCaptureStarted = (w, h) => { captureStarted = true; onCaptureStarted && onCaptureStarted(w, h); };
    native._onCaptureError = (msg) => { captureError = msg; onCaptureError && onCaptureError(msg); };
    native._onCaptureStopped = () => { onCaptureStopped && onCaptureStopped(); };
    native._onFrame = (b64, w, h) => { onFrameCallback && onFrameCallback(b64, w, h); };

    // Start native capture — user will see system screen-cast permission dialog
    const result = native.startScreenCapture();
    try { const parsed = JSON.parse(result); if (!parsed.ok) throw new Error(parsed.error || 'Screen capture failed'); }
    catch (e) { if (e instanceof SyntaxError) throw new Error('Invalid response from native bridge'); throw e; }

    // Wait for capture to start (permission dialog)
    const { width, height } = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!captureStarted) reject(new Error('Screen capture permission timed out. Please tap "Start now" in the system dialog.'));
      }, 30000);

      onCaptureStarted = (w, h) => { clearTimeout(timeout); resolve({ width: w || 1280, height: h || 720 }); };
      onCaptureError = (msg) => { clearTimeout(timeout); reject(new Error(msg)); };
    });

    // Create canvas for the video stream
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.display = 'none';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: false });

    // Draw initial black frame
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const fps = 12;
    const stream = canvas.captureStream(fps);
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error('Could not create a video track from the canvas.');

    if (track.requestFrame) track.requestFrame();

    // Wait for the first frame (with a generous timeout for the permission dialog)
    await new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        // Resolve anyway with black frame — frames will arrive shortly
        resolve();
      }, 15000);

      onFrameCallback = (b64) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        drawFrame(b64);
        resolve();
      };

      onCaptureError = (msg) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(msg));
      };
    });

    // Subscribe to ongoing frames
    onFrameCallback = (b64) => drawFrame(b64);
    onCaptureError = (msg) => {
      console.error('Native screen capture error:', msg);
      stopTracks(stream);
    };
    onCaptureStopped = () => {
      stopTracks(stream);
      try { canvas.remove(); } catch (_) {}
    };

    function drawFrame(b64) {
      if (!b64) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (track.requestFrame) track.requestFrame();
      };
      img.onerror = () => {};
      img.src = 'data:image/jpeg;base64,' + b64;
    }

    track.onended = () => {
      try { canvas.remove(); } catch (_) {}
      try { native.stopScreenCapture(); } catch (_) {}
      // Clean up callbacks
      native._onCaptureStarted = null;
      native._onCaptureError = null;
      native._onCaptureStopped = null;
      native._onFrame = null;
    };

    return stream;
  }

  async function fullscreenTile(tile) {
    if (!tile) return;
    const video = tile.querySelector('video');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (tile.requestFullscreen) await tile.requestFullscreen({ navigationUI: 'hide' });
      else if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
      else if (video?.requestFullscreen) await video.requestFullscreen();
      else throw new Error('Fullscreen is not supported by this browser.');
      if (screen.orientation?.lock) screen.orientation.lock('landscape').catch(() => {});
    } catch (error) { toast(error.message || 'Could not enter fullscreen', 'error'); }
  }

  async function startCall(type, options = {}) {
    if (!navigator.mediaDevices || typeof RTCPeerConnection === 'undefined') { toast('Calls require a secure HTTPS browser', 'error'); return false; }
    if (!socket || socket.readyState !== WebSocket.OPEN) { toast('Connect to Kitsune before calling', 'error'); return false; }
    if (state.call.active) endCall();
    const targetId = options.targetId || (state.current.type === 'dm' ? state.current.dmId : null);
    const call = state.call = { active: true, type, targetId, roomId: options.roomId || null, channelId: options.channelId || null, mic: true, video: type === 'video', screen: false, start: Date.now(), streams: {}, peers: {}, screenSenders: {}, mediaStates: {} };
    call.streams.me = { name: state.me.name, avatar: state.me.avatar, mic: true, video: call.video, screen: false };
    $id('callOverlay').classList.remove('hidden');
    $id('callBar').classList.remove('hidden');
    $id('callTitle').textContent = call.video ? 'VIDEO CALL' : 'VOICE CALL';
    startCallTimer();
    renderCallStage();
    try {
      const stream = await navigator.mediaDevices.getUserMedia(call.video
        ? { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } }
        : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      addLocalStream(stream, call.video ? 'video' : 'audio');
      if (options.incoming) wsSend({ type: 'call-accept', roomId: options.roomId });
      else if (options.channelId) wsSend({ type: 'voice-join', channelId: options.channelId });
      else if (targetId) wsSend({ type: 'call-invite', targetId, callType: type });
      else throw new Error('No call target selected');
      return true;
    } catch (error) {
      toast(error.name === 'NotAllowedError' ? 'Camera or microphone permission denied' : error.message, 'error');
      endCall(false);
      return false;
    }
  }

  function addLocalStream(stream, kind) {
    const me = state.call.streams.me;
    me.stream = stream; me.kind = kind; me.mic = true; me.video = kind === 'video';
    renderCallStage();
  }

  function peerFor(user, initiate = false) {
    const userId = typeof user === 'string' ? user : user.id;
    const existing = state.call.peers[userId];
    if (existing) {
      // If the existing peer connection is dead, remove it and create a new one.
      const dead = ['closed', 'failed'].includes(existing.pc.signalingState) || ['closed', 'failed'].includes(existing.pc.connectionState);
      if (dead) removePeer(userId);
      else return existing;
    }
    const profile = typeof user === 'string' ? findUser(user) || { id: user, name: 'Kitsune User', avatar: '' } : user;
    const pc = new RTCPeerConnection({ iceServers: state.iceServers || [] });
    const peer = state.call.peers[userId] = { pc, user: profile, stream: new MediaStream(), pendingIce: [], screen: Boolean(state.call.mediaStates?.[userId]), makingOffer: false, pendingNegotiation: false };
    const local = state.call.streams.me;
    for (const track of local?.stream?.getAudioTracks() || []) pc.addTrack(track, local.stream);
    const videoStream = state.call.screen && local?.screenStream ? local.screenStream : local?.stream;
    const videoTrack = videoStream?.getVideoTracks()[0];
    if (videoTrack) {
      const sender = pc.addTrack(videoTrack, videoStream);
      tuneVideoSender(sender, videoTrack, state.call.screen);
      if (state.call.screen) state.call.screenSenders[userId] = sender;
    }
    pc.onicecandidate = event => { if (event.candidate) wsSend({ type: 'rtc-ice', roomId: state.call.roomId, targetId: userId, candidate: event.candidate.toJSON() }); };
    pc.ontrack = event => {
      if (event.streams[0]) peer.stream = event.streams[0];
      else peer.stream.addTrack(event.track);
      renderCallStage();
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) {
        if (pc.connectionState === 'failed') {
          // Try an ICE restart before giving up, but only if the peer is still stable.
          try {
            if (peer.pc.signalingState === 'stable' && state.call.active) {
              setTimeout(() => createOffer(userId, { iceRestart: true }), 0);
              return;
            }
          } catch (_) {}
        }
        removePeer(userId);
      }
    };
    if (state.call.screen) setTimeout(() => wsSend({ type: 'call-media-state', roomId: state.call.roomId, screen: true }), 0);
    if (initiate) createOffer(userId);
    return peer;
  }

  async function createOffer(userId, options = {}) {
    const peer = state.call.peers[userId];
    if (!peer) return;
    if (peer.makingOffer || peer.pc.signalingState !== 'stable') { peer.pendingNegotiation = true; return; }
    peer.makingOffer = true;
    peer.pendingNegotiation = false;
    try {
      const offer = await peer.pc.createOffer(options);
      if (peer.pc.signalingState !== 'stable') { peer.pendingNegotiation = true; return; }
      await peer.pc.setLocalDescription(offer);
      wsSend({ type: 'rtc-offer', roomId: state.call.roomId, targetId: userId, description: peer.pc.localDescription, screen: Boolean(state.call.screen) });
    } finally { peer.makingOffer = false; }
  }

  async function receiveOffer(data) {
    // Native WebRTC screen share offer — create a separate peer connection
    if (data.nativeScreen) {
      return receiveNativeScreenOffer(data);
    }

    state.call.mediaStates ||= {};
    state.call.mediaStates[data.fromId] = Boolean(data.screen);
    const peer = peerFor(data.fromId);
    peer.screen = Boolean(data.screen);
    if (peer.pc.signalingState !== 'stable') {
      peer.pendingNegotiation = true;
      await peer.pc.setLocalDescription({ type: 'rollback' });
    }
    await peer.pc.setRemoteDescription(data.description);
    for (const candidate of peer.pendingIce.splice(0)) await peer.pc.addIceCandidate(candidate);
    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answer);
    wsSend({ type: 'rtc-answer', roomId: data.roomId, targetId: data.fromId, description: peer.pc.localDescription });
    if (peer.pendingNegotiation) await createOffer(data.fromId);
  }

  // ---- Native screen peer connections (receiver side) ----
  // When an Android native sender shares screen via native WebRTC, the receiver
  // creates a separate RTCPeerConnection to receive the screen video track.
  state.call.screenPeers = state.call.screenPeers || {};

  function screenPeerFor(userId) {
    if (state.call.screenPeers[userId]) return state.call.screenPeers[userId];
    const pc = new RTCPeerConnection({ iceServers: state.iceServers || [] });
    const peer = state.call.screenPeers[userId] = { pc, pendingIce: [], stream: new MediaStream() };
    pc.onicecandidate = event => {
      if (event.candidate) wsSend({ type: 'rtc-ice', roomId: state.call.roomId, targetId: userId, candidate: event.candidate.toJSON(), nativeScreen: true });
    };
    pc.ontrack = event => {
      if (event.streams[0]) peer.stream = event.streams[0];
      else peer.stream.addTrack(event.track);
      // Attach the screen stream to the call stage
      state.call.mediaStates ||= {};
      state.call.mediaStates[userId] = true;
      renderCallStage();
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) {
        try { pc.close(); } catch (_) {}
        delete state.call.screenPeers[userId];
        state.call.mediaStates[userId] = false;
        renderCallStage();
      }
    };
    return peer;
  }

  async function receiveNativeScreenOffer(data) {
    const peer = screenPeerFor(data.fromId);
    if (peer.pc.signalingState !== 'stable') {
      await peer.pc.setLocalDescription({ type: 'rollback' });
    }
    await peer.pc.setRemoteDescription(data.description);
    for (const candidate of peer.pendingIce.splice(0)) await peer.pc.addIceCandidate(candidate);
    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answer);
    wsSend({ type: 'rtc-answer', roomId: data.roomId, targetId: data.fromId, description: peer.pc.localDescription, nativeScreen: true });
  }

  async function receiveAnswer(data) {
    // Native WebRTC screen share answer — relay to native bridge
    if (data.nativeScreen) {
      relayNativeScreenAnswer(data);
      return;
    }

    const peer = state.call.peers[data.fromId];
    if (!peer || peer.pc.signalingState !== 'have-local-offer') return;
    await peer.pc.setRemoteDescription(data.description);
    for (const candidate of peer.pendingIce.splice(0)) await peer.pc.addIceCandidate(candidate);
    if (peer.pendingNegotiation) await createOffer(data.fromId);
  }

  async function receiveIce(data) {
    // Native WebRTC screen share ICE — relay to native bridge (sender) or screen peer (receiver)
    if (data.nativeScreen) {
      if (nativeScreenActive) {
        // We are the sender — relay to native
        relayNativeScreenIce(data);
      } else {
        // We are the receiver — add to screen peer
        const peer = state.call.screenPeers[data.fromId];
        if (peer) {
          const candidate = new RTCIceCandidate(data.candidate);
          if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(candidate);
          else peer.pendingIce.push(candidate);
        }
      }
      return;
    }

    const peer = peerFor(data.fromId);
    const candidate = new RTCIceCandidate(data.candidate);
    if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(candidate);
    else peer.pendingIce.push(candidate);
  }

  function removePeer(userId) {
    const peer = state.call.peers[userId];
    if (peer) {
      peer.pc.close();
      stopTracks(peer.stream);
      delete state.call.peers[userId];
    }
    // Clean up native screen peer connection
    const screenPeer = state.call.screenPeers?.[userId];
    if (screenPeer) {
      try { screenPeer.pc.close(); } catch (_) {}
      stopTracks(screenPeer.stream);
      delete state.call.screenPeers[userId];
    }
    // Notify native layer to remove this peer
    if (nativeScreenActive) {
      try { window.kitsuneNative?.nativeScreenRemovePeer?.(userId); } catch (_) {}
    }
    renderCallStage();
  }

  async function renegotiatePeers() {
    for (const userId of Object.keys(state.call.peers)) await createOffer(userId);
  }

  async function toggleVideo() {
    const call = state.call; const me = call.streams.me;
    if (call.video) {
      for (const track of me.stream?.getVideoTracks() || []) { for (const peer of Object.values(call.peers)) { const sender = peer.pc.getSenders().find(x => x.track === track); if (sender) peer.pc.removeTrack(sender); } track.stop(); me.stream.removeTrack(track); }
      call.video = false; me.video = false; await renegotiatePeers(); renderCallStage(); return;
    }
    try {
      const video = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } });
      const track = video.getVideoTracks()[0];
      me.stream.addTrack(track); call.video = true; me.video = true;
      if (!call.screen) {
        for (const peer of Object.values(call.peers)) {
          const sender = peer.pc.addTrack(track, me.stream);
          tuneVideoSender(sender, track, false);
        }
        await renegotiatePeers();
      }
      renderCallStage();
    } catch (_) { toast('Camera permission denied', 'error'); }
  }

  async function toggleScreen() {
    const call = state.call; const me = call.streams.me;
    if (call.screen) { await endScreenShare(); return; }
    try {
      const stream = await captureDisplay();
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('No screen video was provided by this device.');
      const isCameraFallback = track._kitsuneCameraFallback;
      const isNativeWebRTC = track._native;

      if (isNativeWebRTC) {
        // Native WebRTC screen share — the native layer handles its own peer connections.
        // We don't need to replace tracks on the WebView's peer connections.
        // The native layer will create offers and we relay them via WebSocket.
        // State was already set by startNativeWebRTCScreenShare callbacks.
        renderCallStage();
        // Toast is handled by the _onNativeScreenStarted callback
        return;
      }

      if (!isCameraFallback) await track.applyConstraints({ frameRate: { ideal: 60, max: 60 } }).catch(() => {});
      call.screen = true; me.screen = true; me.screenStream = stream;
      for (const [userId, peer] of Object.entries(call.peers)) {
        const sender = peer.pc.getSenders().find(x => x.track?.kind === 'video');
        if (sender) { call.screenSenders[userId] = sender; await sender.replaceTrack(track); await tuneVideoSender(sender, track, true); }
        else { call.screenSenders[userId] = peer.pc.addTrack(track, stream); await tuneVideoSender(call.screenSenders[userId], track, true); await createOffer(userId); }
      }
      wsSend({ type: 'call-media-state', roomId: call.roomId, screen: true });
      track.onended = () => endScreenShare();
      renderCallStage();
      if (isCameraFallback) {
        toast('Sharing camera as screen. Tap again to stop.', 'success');
      } else {
        toast(`Screen sharing at up to ${Math.round(track.getSettings().frameRate || 60)} FPS`, 'success');
      }
    } catch (error) {
      let message;
      if (error.code === 'CANCELLED') return; // user dismissed dialog — no error toast
      if (error.code === 'NOT_SUPPORTED') message = error.message;
      else if (error.code === 'DENIED') message = error.message;
      else if (error.name === 'NotAllowedError') message = 'Screen share permission was cancelled or denied.';
      else if (error.name === 'OverconstrainedError') message = 'This device cannot satisfy the requested screen capture settings. Try a lower resolution.';
      else message = `Screen share failed: ${error.message}`;
      toast(message, 'error', 6000);
    }
  }

  async function endScreenShare() {
    const call = state.call; const me = call.streams.me;
    if (!me) return;

    // Native WebRTC screen share — stop the native layer
    if (me.screenStream?._nativeWebRTC || nativeScreenActive) {
      stopNativeWebRTCScreenShare();
      call.screen = false; me.screen = false; me.screenStream = null;
      call.screenSenders = {};
      wsSend({ type: 'call-media-state', roomId: call.roomId, screen: false });
      renderCallStage();
      return;
    }

    const camera = me.stream?.getVideoTracks()[0] || null;
    call.screen = false; me.screen = false;
    stopTracks(me.screenStream); me.screenStream = null;
    for (const [userId, sender] of Object.entries(call.screenSenders || {})) {
      if (camera) { await sender.replaceTrack(camera); await tuneVideoSender(sender, camera, false); }
      else { state.call.peers[userId]?.pc.removeTrack(sender); await createOffer(userId); }
    }
    call.screenSenders = {};
    wsSend({ type: 'call-media-state', roomId: call.roomId, screen: false });
    renderCallStage();
  }

  function toggleMic() {
    const call = state.call; const me = call.streams.me;
    call.mic = !call.mic;
    me?.stream?.getAudioTracks().forEach(track => { track.enabled = call.mic; });
    if (me) me.mic = call.mic;
    renderCallStage();
  }

  function endCall(signal = true) {
    const call = state.call;
    if (signal && call.roomId) wsSend({ type: 'call-leave', roomId: call.roomId });
    for (const peer of Object.values(call.peers || {})) { peer.pc.close(); stopTracks(peer.stream); }
    // Clean up native screen peer connections
    for (const peer of Object.values(call.screenPeers || {})) { try { peer.pc.close(); } catch (_) {} stopTracks(peer.stream); }
    // Stop native WebRTC screen share if active
    if (nativeScreenActive) stopNativeWebRTCScreenShare();
    for (const stream of Object.values(call.streams || {})) { stopTracks(stream.stream); stopTracks(stream.screenStream); }
    state.call = { active: false, type: null, targetId: null, roomId: null, mic: true, video: false, screen: false, start: 0, streams: {}, peers: {}, screenPeers: {}, screenSenders: {}, mediaStates: {} };
    $id('callOverlay').classList.add('hidden');
    $id('callBar').classList.add('hidden');
    stopCallTimer();
  }

  function showIncomingCall(data) {
    let modal = $id('incomingCall');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'incomingCall'; modal.className = 'modal';
    modal.innerHTML = `<div class="modal-card"><div class="modal-header"><span>INCOMING ${data.callType === 'video' ? 'VIDEO' : 'VOICE'} CALL</span></div><div class="modal-body"><div class="friend-row"><img class="friend-avatar" src="${data.from.avatar}"><div class="friend-info"><div class="friend-name">${escapeHtml(data.from.name)}</div><div class="friend-status">Calling you…</div></div></div><div class="modal-actions"><button class="ghost-btn" id="declineIncoming">Decline</button><button class="primary-btn" id="acceptIncoming">Accept</button></div></div></div>`;
    document.body.appendChild(modal);
    $id('declineIncoming').onclick = () => { wsSend({ type: 'call-decline', roomId: data.roomId }); modal.remove(); };
    $id('acceptIncoming').onclick = async () => { modal.remove(); await startCall(data.callType, { incoming: true, roomId: data.roomId, targetId: data.from.id }); };
    wsNotify('Incoming Kitsune call', `${data.from.name} is calling`);
  }

  // ---------- WebSocket ----------
  let socket = null;
  let wsRetry = 1000;

  let callRejoinTimer = null;

  function connectWS() {
    if (socket || !state.me) return;
    if (typeof WebSocket === 'undefined') { console.warn('WebSocket not supported'); return; }
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${location.host}/ws`;
    try {
      socket = new WebSocket(wsUrl);
      socket.onopen = () => {
        wsRetry = 1000;
        toast('Connected to Kitsune', 'info');
        wsJoin();
        // If we were in a voice call when the socket dropped, rejoin the channel.
        if (state.call.active && state.call.channelId) {
          // Clean up dead peers before rejoining so we re-establish fresh connections.
          for (const userId of Object.keys(state.call.peers)) {
            const p = state.call.peers[userId];
            if (['closed', 'failed'].includes(p?.pc?.signalingState) || ['closed', 'failed'].includes(p?.pc?.connectionState)) removePeer(userId);
          }
          wsSend({ type: 'voice-join', channelId: state.call.channelId });
        } else if (state.call.active && !state.call.channelId) {
          // Direct/DM call rooms do not persist across socket reconnects.
          // End the local call and let the user call again.
          endCall(false);
        }
      };
      socket.onmessage = (e) => { onSocketMessage(JSON.parse(e.data)); };
      socket.onclose = () => { socket = null; if (callRejoinTimer) { clearTimeout(callRejoinTimer); callRejoinTimer = null; } toast('Disconnected from Kitsune', 'error'); setTimeout(connectWS, wsRetry); wsRetry = Math.min(wsRetry * 2, 30000); };
      socket.onerror = (e) => { toast('Connection error', 'error'); console.warn('ws error', e); };
    } catch (e) { toast('Could not connect', 'error'); console.warn('ws connect failed', e); }
  }

  function wsSend(obj) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(obj));
    return true;
  }

  function wsJoin() { wsSend({ type: 'heartbeat' }); }

  async function sendMessageToServer(msg) {
    if (state.current.type === 'channel') return api(`/api/channels/${state.current.channelId}/messages`, { method: 'POST', body: JSON.stringify({ content: msg.text, attachments: msg.attachments }) });
    if (state.current.type === 'dm') {
      const dm = getDmById(state.current.dmId);
      if (!dm?.threadId) throw new Error('Conversation is not ready');
      return api(`/api/dms/${dm.threadId}/messages`, { method: 'POST', body: JSON.stringify({ content: msg.text, attachments: msg.attachments }) });
    }
    throw new Error('Select a channel or conversation first');
  }

  function wsNotify(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, icon: state.me.avatar });
  }

  let lastTypingSent = 0;
  const typingTimers = new Map();
  function sendTyping() {
    if (Date.now() - lastTypingSent < 3000 || !$id('msgInput').value.trim()) return;
    lastTypingSent = Date.now();
    if (state.current.type === 'channel') wsSend({ type: 'typing', channelId: state.current.channelId });
    else if (state.current.type === 'dm') {
      const dm = getDmById(state.current.dmId);
      if (dm?.threadId) wsSend({ type: 'typing', threadId: dm.threadId });
    }
  }

  function showTyping(data) {
    const key = data.channelId || data.threadId;
    const visible = state.current.type === 'channel' ? state.current.channelId === data.channelId : getDmById(state.current.dmId)?.threadId === data.threadId;
    if (!visible) return;
    $id('typingBar').textContent = `${data.user.name} is typing…`;
    clearTimeout(typingTimers.get(key));
    typingTimers.set(key, setTimeout(() => { if ($id('typingBar')) $id('typingBar').textContent = ''; }, 5000));
  }

  async function onSocketMessage(data) {
    if (!data || !data.type) return;
    try {
      if (data.type === 'ready') {
        applyBootstrap(data);
        save(); renderServerRail(); renderSidebar(); renderContent(); renderMembers(); renderUserBar(); loadConversationMessages();
      } else if (data.type === 'message') {
        const key = channelKey(data.serverId, data.channelId);
        if (!state.messages[key]?.some(m => m.id === data.payload.id)) addMessage(key, data.payload);
        if (state.current.type === 'channel' && state.current.serverId === data.serverId && state.current.channelId === data.channelId) renderMessages();
        else if (data.payload.authorId !== state.me.id) wsNotify('Kitsune', `${data.payload.author}: ${data.payload.text}`);
      } else if (data.type === 'message-update') {
        const key = channelKey(data.guildId, data.channelId);
        const messages = state.messages[key] || [];
        const index = messages.findIndex(m => m.id === data.message.id);
        if (index >= 0) messages[index] = data.message;
        if (state.current.channelId === data.channelId) renderMessages();
      } else if (data.type === 'message-delete') {
        const key = channelKey(data.guildId, data.channelId);
        state.messages[key] = (state.messages[key] || []).filter(m => m.id !== data.messageId);
        if (state.current.channelId === data.channelId) renderMessages();
      } else if (data.type === 'reaction-update') {
        const key = channelKey(data.guildId, data.channelId);
        const message = (state.messages[key] || []).find(m => m.id === data.messageId);
        if (message) {
          let reaction = (message.reactions || []).find(r => r.emoji === data.emoji);
          if (!reaction && data.added) { reaction = { emoji: data.emoji, users: [] }; (message.reactions ||= []).push(reaction); }
          if (reaction) reaction.users = data.added ? Array.from(new Set([...reaction.users, data.userId])) : reaction.users.filter(id => id !== data.userId);
          message.reactions = (message.reactions || []).filter(r => r.users.length);
        }
        if (state.current.channelId === data.channelId) renderMessages();
      } else if (data.type === 'dm-message') {
        let dm = state.dms.find(x => x.threadId === data.threadId);
        if (!dm) { await refreshBootstrap(); dm = state.dms.find(x => x.threadId === data.threadId); }
        if (!dm) return;
        const key = dmKey(dm.id);
        if (!state.messages[key]?.some(m => m.id === data.message.id)) addMessage(key, data.message);
        if (state.current.type === 'dm' && state.current.dmId === dm.id) renderMessages();
        else if (data.message.authorId !== state.me.id) wsNotify('Direct message', `${data.message.author}: ${data.message.text}`);
      } else if (data.type === 'dm-message-update') {
        const dm = state.dms.find(x => x.threadId === data.threadId);
        const messages = dm ? state.messages[dmKey(dm.id)] || [] : [];
        const index = messages.findIndex(m => m.id === data.message.id);
        if (index >= 0) messages[index] = data.message;
        if (dm && state.current.dmId === dm.id) renderMessages();
      } else if (data.type === 'dm-message-delete') {
        const dm = state.dms.find(x => x.threadId === data.threadId);
        if (dm) state.messages[dmKey(dm.id)] = (state.messages[dmKey(dm.id)] || []).filter(m => m.id !== data.messageId);
        if (dm && state.current.dmId === dm.id) renderMessages();
      } else if (data.type === 'presence') {
        for (const server of state.servers) {
          const member = server.members.find(x => x.id === data.userId);
          if (member) { member.status = data.status; member.activity = data.activity; }
        }
        for (const list of [state.friends, state.dms]) {
          const user = list.find(x => x.id === data.userId);
          if (user) { user.status = data.status; user.activity = data.activity; }
        }
        renderMembers(); renderSidebar();
      } else if (data.type === 'friend-update') {
        await refreshBootstrap(); renderSidebar();
        if (state.current.type === 'friends') renderFriendsView();
        toast(data.action === 'request' ? `${data.user.name} sent a friend request` : 'Friends updated');
      } else if (data.type === 'typing') {
        showTyping(data);
      } else if (data.type === 'profile-update') {
        for (const server of state.servers) {
          const member = server.members.find(x => x.id === data.user.id);
          if (member) Object.assign(member, data.user);
        }
        for (const list of [state.friends, state.dms]) {
          const user = list.find(x => x.id === data.user.id);
          if (user) Object.assign(user, data.user);
        }
        renderMembers(); renderSidebar();
      } else if (data.type === 'guild-messages-cleared') {
        const server = state.servers.find(x => x.id === data.serverId);
        server?.categories.forEach(cat => cat.channels.forEach(ch => { delete state.messages[channelKey(server.id, ch.id)]; }));
        if (state.current.serverId === data.serverId) renderMessages();
      } else if (data.type === 'member-upsert') {
        const server = state.servers.find(x => x.id === data.serverId);
        if (server && data.user) {
          const member = server.members.find(x => x.id === data.user.id);
          if (member) Object.assign(member, data.user);
          else server.members.push(data.user);
          save();
        }
        renderMembers();
      } else if (data.type === 'member-update') {
        const server = state.servers.find(x => x.id === data.serverId);
        const member = server?.members.find(x => x.id === data.userId);
        if (member) member.role = data.role;
        renderMembers();
      } else if (data.type === 'member-remove') {
        const server = state.servers.find(x => x.id === data.serverId);
        if (server) server.members = server.members.filter(x => x.id !== data.userId);
        renderMembers();
      } else if (data.type === 'call-invite') {
        showIncomingCall(data);
      } else if (data.type === 'call-ringing') {
        state.call.roomId = data.roomId;
        toast('Ringing…');
      } else if (data.type === 'call-accepted') {
        state.call.roomId = data.roomId;
        peerFor(data.user, true);
        // If we're sharing screen via native WebRTC, add the new peer to native
        if (nativeScreenActive) addPeerToNativeScreenShare(data.user.id);
        toast(`${data.user.name} joined the call`);
      } else if (data.type === 'call-joined') {
        state.call.roomId = data.roomId;
        for (const participant of data.participants || []) {
          peerFor(participant, Boolean(data.channelId));
          // If we're sharing screen via native WebRTC, add each existing peer to native
          if (nativeScreenActive) addPeerToNativeScreenShare(participant.id);
        }
        renderCallStage();
      } else if (data.type === 'call-peer-joined') {
        peerFor(data.user, false);
        // If we're sharing screen via native WebRTC, add the new peer to native
        if (nativeScreenActive) addPeerToNativeScreenShare(data.user.id);
        renderCallStage();
      } else if (data.type === 'call-peer-left') {
        removePeer(data.userId);
      } else if (data.type === 'call-media-state') {
        state.call.mediaStates ||= {};
        state.call.mediaStates[data.userId] = Boolean(data.screen);
        const peer = state.call.peers[data.userId];
        if (peer) peer.screen = Boolean(data.screen);
        // If screen stopped, clean up native screen peer connection
        if (!data.screen && state.call.screenPeers?.[data.userId]) {
          const sp = state.call.screenPeers[data.userId];
          try { sp.pc.close(); } catch (_) {}
          stopTracks(sp.stream);
          delete state.call.screenPeers[data.userId];
        }
        renderCallStage();
      } else if (data.type === 'call-declined') {
        toast('Call declined', 'error'); endCall(false);
      } else if (data.type === 'rtc-offer') {
        await receiveOffer(data);
      } else if (data.type === 'rtc-answer') {
        await receiveAnswer(data);
      } else if (data.type === 'rtc-ice') {
        await receiveIce(data);
      } else if (data.type === 'error') {
        toast(data.message || 'Server operation failed', 'error');
      }
    } catch (error) { console.error('Realtime event failed', error); toast('Realtime update failed', 'error'); }
  }

  function upsertRemoteMember(s, u) {
    const id = u.id || u.userId;
    const existing = s.members.find(m => m.id === id);
    if (existing) { Object.assign(existing, u, { id }); return; }
    s.members.push({ ...u, id, role: u.role || 'Wanderer', roleColor: COLORS.pink });
  }

  let callTimerInterval = null;
  function startCallTimer() {
    stopCallTimer();
    callTimerInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - state.call.start) / 1000);
      const m = String(Math.floor(sec/60)).padStart(2,'0');
      const s = String(sec%60).padStart(2,'0');
      $id('callTimer').textContent = `${m}:${s}`;
    }, 1000);
  }
  function stopCallTimer() { if (callTimerInterval) clearInterval(callTimerInterval); callTimerInterval = null; }

  // ---------- Rendering ----------
  function renderAuthSaved() {
    const saved = getSavedUsers().filter(u => u.remember);
    const cont = $id('savedUsers');
    if (!saved.length) { cont.classList.add('hidden'); cont.innerHTML=''; return; }
    cont.classList.remove('hidden');
    cont.innerHTML = saved.map(u => `<div class="saved-user" data-name="${escapeHtml(u.name)}"><div><div class="saved-user-name">${escapeHtml(u.name)}</div></div><button class="saved-user-remove" data-name="${escapeHtml(u.name)}" title="Remove">×</button></div>`).join('');
    $all('.saved-user', cont).forEach(el => el.addEventListener('click', e => {
      if (e.target.classList.contains('saved-user-remove')) { e.stopPropagation(); removeSavedUser(el.dataset.name); return; }
      $id('authUser').value = el.dataset.name;
    }));
    $all('.saved-user-remove', cont).forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); removeSavedUser(btn.dataset.name); }));
  }

  function removeSavedUser(name) {
    const saved = getSavedUsers().filter(u => u.name !== name);
    setSavedUsers(saved);
    renderAuthSaved();
  }

  function enterApp() {
    $id('authScreen').classList.add('hidden');
    $id('app').classList.remove('hidden');
    renderSidebar();
    renderContent();
    renderMembers();
    renderUserBar();
    connectWS();
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(()=>{});
  }

  function renderSidebar() {
    const header = $id('sidebarHeader');
    const list = $id('channelList');

    if (state.current.type === 'friends') {
      header.innerHTML = `<div class="sh-name">Friends</div><div class="sh-sub">${state.friends.length} friends</div>`;
      list.innerHTML = `<div class="friends-view" id="friendsView"></div>`;
      renderFriendsView();
      return;
    }

    if (state.current.type === 'dm') {
      const dm = getDmById(state.current.dmId); if (!dm) return;
      header.innerHTML = `<div class="sh-name">Direct Messages</div><div class="sh-sub">with ${escapeHtml(dm.name)}</div>`;
      list.innerHTML = state.dms.map(d => {
        const active = d.id === dm.id;
        return `<div class="dm-item ${active?'active':''}" data-dm="${d.id}"><div class="dm-avatar-wrap"><img class="dm-avatar" src="${d.avatar}"><span class="status-dot ${d.status}"></span></div><div class="dm-info"><div class="dm-name">${escapeHtml(d.name)}</div><div class="dm-status-text">${d.activity}</div></div></div>`;
      }).join('');
      $all('.dm-item', list).forEach(el => el.addEventListener('click', () => switchTo({ type: 'dm', dmId: el.dataset.dm })));
      return;
    }

    if (state.current.type === 'home') {
      header.innerHTML = `<div class="sh-name">Direct Messages</div><div class="sh-sub">Chats</div>`;
      list.innerHTML = state.dms.length ? state.dms.map(d => `<div class="dm-item" data-dm="${d.id}"><div class="dm-avatar-wrap"><img class="dm-avatar" src="${d.avatar}"><span class="status-dot ${d.status}"></span></div><div class="dm-info"><div class="dm-name">${escapeHtml(d.name)}</div><div class="dm-status-text">${d.activity}</div></div></div>`).join('') : `<div class="empty-friends">No conversations yet.<br>Add friends and start a DM.</div>`;
      $all('.dm-item', list).forEach(el => el.addEventListener('click', () => switchTo({ type: 'dm', dmId: el.dataset.dm })));
      return;
    }

    // channel
    const s = state.servers.find(x => x.id === state.current.serverId); if (!s) return;
    header.innerHTML = `<div class="sh-name">${escapeHtml(s.name)}</div><div class="sh-sub">${s.categories.reduce((a,c)=>a+c.channels.length,0)} channels</div>`;
    list.innerHTML = s.categories.map(cat => {
      const chans = cat.channels.map(ch => {
        const active = state.current.type==='channel' && state.current.channelId===ch.id;
        return `<div class="channel-item ${active?'active':''} ${ch.type==='voice'?'voice':''}" data-cid="${ch.id}"><span class="ch-hash">${ch.type==='voice'?SVG.mic:SVG.hash}</span><span class="ch-name">${escapeHtml(ch.name)}</span></div>`;
      }).join('');
      return `<div class="channel-category">${escapeHtml(cat.name)}</div>${chans}`;
    }).join('');
    $all('.channel-item', list).forEach(el => el.addEventListener('click', () => {
      const cid = el.dataset.cid;
      const ch = getChannelById(s.id, cid);
      if (!ch) return;
      if (ch.type === 'voice') joinVoiceChannel(s.id, cid);
      else switchTo({ type: 'channel', serverId: s.id, channelId: cid });
    }));
  }

  function renderFriendsView() {
    const view = $id('friendsView'); if (!view) return;
    const tabs = ['Online','All','Pending','Blocked','Add'];
    view.innerHTML = `
      <div class="friends-header"><h3>Friends</h3><button class="primary-btn friends-add-btn" id="addFriendBtn">Add Friend</button></div>
      <div class="friends-tabs">${tabs.map(t=>`<button class="friends-tab ${t==='All'?'active':''}" data-tab="${t}">${t}</button>`).join('')}</div>
      <div id="friendsList" class="friends-list"></div>`;
    renderFriendsList('All');
    $one('#addFriendBtn').addEventListener('click', () => openModal('addFriendModal'));
    $all('.friends-tab', view).forEach(t => t.addEventListener('click', () => {
      $all('.friends-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      renderFriendsList(t.dataset.tab);
    }));
  }

  function renderFriendsList(tab) {
    const cont = $id('friendsList');
    if (tab === 'Add') { cont.innerHTML = `<div class="empty-friends">Use the Add Friend button above.</div>`; return; }
    let list = [];
    if (tab === 'Blocked') list = state.blocked.slice();
    else { list = state.friends.slice(); if (tab === 'Online') list = list.filter(f => f.status !== 'offline'); if (tab === 'Pending') list = list.filter(f => f.pending); }
    cont.innerHTML = list.length ? list.map(f => `
      <div class="friend-row" data-friend="${f.id}" data-tab="${tab}">
        <div class="friend-avatar-wrap"><img class="friend-avatar" src="${f.avatar}"><span class="status-dot ${f.status || 'offline'}"></span></div>
        <div class="friend-info"><div class="friend-name">${escapeHtml(f.name)}</div><div class="friend-status">${tab==='Blocked'?'Blocked':(STATUS_LABELS[f.status] + ' — ' + f.activity)}</div></div>
        <div class="friend-actions">
          ${tab==='Blocked'?'':f.pending?(f.incoming?`<button class="ub-btn accept-friend" title="Accept">${SVG.check}</button>`:''):`<button class="ub-btn dm-friend" title="Message">${SVG.hash}</button><button class="ub-btn call-friend" title="Voice call">${SVG.phone}</button>`}
          <button class="ub-btn remove-friend" title="Remove" style="color:var(--dnd)">${SVG.trash}</button>
          ${tab==='Blocked'?'<button class="ub-btn unblock-friend" title="Unblock" style="color:var(--online)">'+SVG.check+'</button>':'<button class="ub-btn block-friend" title="Block" style="color:var(--dnd)">'+SVG.ban+'</button>'}
        </div>
      </div>`).join('') : `<div class="empty-friends">No ${tab.toLowerCase()} users in this list.</div>`;
    $all('.friend-row').forEach(row => {
      const t = row.dataset.tab;
      const id = row.dataset.friend;
      $one('.friend-avatar', row).addEventListener('click', (e) => { e.stopPropagation(); showProfile(id); });
      $one('.friend-info', row).addEventListener('click', (e) => { e.stopPropagation(); showProfile(id); });
      if (t === 'Blocked') {
        const b = state.blocked.find(x => x.id === id);
        $one('.unblock-friend', row).addEventListener('click', () => unblockFriend(b.id));
      } else {
        const f = state.friends.find(x => x.id === id);
        $one('.accept-friend', row)?.addEventListener('click', () => acceptFriend(f.id));
        $one('.dm-friend', row)?.addEventListener('click', () => openDmWith(f));
        $one('.call-friend', row)?.addEventListener('click', async () => { if (await openDmWith(f)) startCall('voice'); });
        $one('.remove-friend', row).addEventListener('click', () => removeFriend(f.id));
        $one('.block-friend', row).addEventListener('click', () => blockFriend(f.id));
      }
    });
  }

  function renderContent() {
    const header = $id('contentHeader');
    const messages = $id('messages');
    const composer = $id('composer');

    if (state.current.type === 'friends') {
      header.innerHTML = `<div class="ch-title"><span class="ch-hash">@</span><span>Friends</span></div>`;
      messages.innerHTML = `<div class="welcome"><img src="./assets/kitsune-logo.png" class="welcome-logo" alt=""><h2>FRIENDS</h2><p>Manage your squad, add players, and start calls.</p></div>`;
      composer.classList.add('hidden');
      renderCrumb(['Friends']);
      return;
    }

    if (state.current.type === 'home') {
      header.innerHTML = `<div class="ch-title"><span class="ch-hash">@</span><span>Home</span></div>`;
      messages.innerHTML = `<div class="welcome"><img src="./assets/kitsune-logo.png" class="welcome-logo" alt=""><h2>WELCOME</h2><p>Select a Shrine from the rail, or open Direct Messages to start chatting.</p></div>`;
      composer.classList.add('hidden');
      renderCrumb(['Home']);
      return;
    }

    composer.classList.remove('hidden');

    if (state.current.type === 'dm') {
      const dm = getDmById(state.current.dmId); if (!dm) return;
      header.innerHTML = `<div class="ch-title" id="dmHeader" data-user="${dm.id}"><span class="ch-hash">@</span><span class="mention">${escapeHtml(dm.name)}</span></div><div class="ch-topic">${escapeHtml(dm.activity)}</div><div class="ch-actions"><button class="ch-btn" id="dmPhone" title="Voice call">${SVG.phone}</button><button class="ch-btn" id="dmVideo" title="Video call">${SVG.camera}</button></div>`;
      $id('dmHeader').addEventListener('click', () => showProfile(dm.id));
      $id('dmPhone').addEventListener('click', () => startCall('voice'));
      $id('dmVideo').addEventListener('click', () => startCall('video'));
      renderMessages();
      renderCrumb(['Direct Messages', dm.name]);
    } else if (state.current.type === 'channel') {
      const s = state.servers.find(x => x.id === state.current.serverId);
      const ch = getChannelById(state.current.serverId, state.current.channelId); if (!s || !ch) return;
      const clearBtn = amOwner() ? `<button class="ch-btn danger" id="clearHistoryBtn" title="Clear server chat history (Tenko)">${SVG.trash}</button>` : '';
      header.innerHTML = `<div class="ch-title"><span class="ch-hash">#</span><span>${escapeHtml(ch.name)}</span></div><div class="ch-topic">${escapeHtml(ch.topic || '')}</div><div class="ch-actions"><button class="ch-btn" id="chSearch" title="Search">${SVG.hash}</button>${clearBtn}</div>`;
      if (amOwner()) $id('clearHistoryBtn').addEventListener('click', () => { if (confirm('Clear all chat history in this shrine? Only Tenko can do this.')) clearServerHistory(); });
      renderMessages();
      renderCrumb([s.name, `#${ch.name}`]);
    }
  }

  function renderCrumb(parts) {
    const bar = $id('crumbBar');
    bar.innerHTML = parts.map((p, i) => i === parts.length-1 ? `<span class="crumb-current">${escapeHtml(p)}</span>` : `<span>${escapeHtml(p)}</span><span class="crumb-sep">/</span>`).join('');
  }

  function renderMessages() {
    const cont = $id('messages');
    const msgs = messagesForCurrent();
    if (!msgs.length) { cont.innerHTML = `<div class="welcome" style="padding-top:60px"><img src="./assets/kitsune-logo.png" class="welcome-logo" alt=""><h2>NO MESSAGES YET</h2><p>Be the first to drop a line.</p></div>`; return; }

    const today = new Date().toDateString();
    let lastAuthor = null, lastDate = null;
    cont.innerHTML = msgs.map((m, idx) => {
      if (m.system) return `<div class="msg-system" data-msg="${m.id}"><span class="sys-icon" style="background:var(--pink)"></span>${escapeHtml(m.text)}</div>`;
      const d = new Date(m.ts).toDateString();
      const showDivider = d !== lastDate;
      lastDate = d;
      const grouped = m.author === lastAuthor && (idx > 0 && (m.ts - msgs[idx-1].ts) < 60000);
      lastAuthor = m.author;
      const isMe = m.authorId === state.me.id;
      const dateLabel = showDivider ? `<div class="msg-system">${d===today?'Today':dateStr(m.ts)}</div>` : '';
      const bot = m.bot ? 'bot' : '';
      const meClass = isMe ? 'you' : '';
      const avatar = grouped ? '' : `<img class="msg-avatar" src="${m.avatar}" title="${escapeHtml(m.author)}">`;
      const header = grouped ? '' : `<div class="msg-head"><span class="msg-author ${bot} ${meClass}" data-author="${m.authorId}">${escapeHtml(m.author)}</span><span class="msg-time">${timeStr(m.ts)}</span>${m.edited?'<span class="msg-edited">(edited)</span>':''}</div>`;
      const padLeft = grouped ? 'padding-left:54px' : '';
      const text = formatMessageText(m.text);
      const attach = (m.attachments || []).map(a => a.type==='image' ? `<div class="msg-attachment"><img src="${a.data}" alt="${escapeHtml(a.name)}"></div>` : `<a class="file-pill" href="#">${SVG.file}<span>${escapeHtml(a.name)}</span></a>`).join('');
      const reactions = (m.reactions || []).length ? `<div class="msg-reactions">${m.reactions.map(r => `<div class="reaction ${r.users.includes(state.me.id)?'mine':''}" data-msg="${m.id}" data-emoji="${r.emoji}"><span class="r-emoji">${r.emoji}</span><span class="r-count">${r.users.length}</span></div>`).join('')}</div>` : '';
      const toolbar = isMe ? `<div class="msg-toolbar"><button data-edit="${m.id}" title="Edit">${SVG.edit}</button><button class="danger" data-del="${m.id}" title="Delete">${SVG.trash}</button></div>` : `<div class="msg-toolbar"><button data-reaction="${m.id}" title="React">${SVG.gamepad}</button></div>`;
      return `${dateLabel}<div class="msg-group" data-msg="${m.id}"><div class="msg-row" style="${padLeft}">${avatar}<div class="msg-body">${header}<div class="msg-content">${text}</div>${attach}${reactions}</div>${toolbar}</div></div>`;
    }).join('');

    $all('.msg-group').forEach(g => g.addEventListener('mouseenter', () => g.classList.add('hover')));
    $all('.msg-group').forEach(g => g.addEventListener('mouseleave', () => g.classList.remove('hover')));
    $all('.msg-author').forEach(el => el.addEventListener('click', () => showProfile(el.dataset.author)));
    $all('[data-del]', cont).forEach(b => b.addEventListener('click', () => deleteMessage(b.dataset.del)));
    $all('[data-edit]', cont).forEach(b => b.addEventListener('click', () => startEdit(b.dataset.edit)));
    $all('[data-reaction]', cont).forEach(b => b.addEventListener('click', () => showEmojiPicker(b.getBoundingClientRect(), b.dataset.reaction)));
    $all('.reaction').forEach(r => r.addEventListener('click', () => toggleReaction(r.dataset.msg, r.dataset.emoji)));
    $all('.spoiler').forEach(s => s.addEventListener('click', () => s.classList.add('revealed')));
    $all('.msg-attachment img', cont).forEach(img => img.addEventListener('click', () => window.open(img.src, '_blank')));

    cont.scrollTop = cont.scrollHeight;
  }

  function formatMessageText(text) {
    let out = escapeHtml(text);
    out = out.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    out = out.replace(/\*(.+?)\*/g, '<i>$1</i>');
    out = out.replace(/`(.+?)`/g, '<code>$1</code>');
    out = out.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    out = out.replace(/\|\|(.+?)\|\|/g, '<span class="spoiler">$1</span>');
    out = out.replace(/@(\w+)/g, '<span class="mention" data-user="$1">@$1</span>');
    out = out.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
    return out.replace(/\n/g, '<br>');
  }

  function renderMembers() {
    const ml = $id('memberList');
    renderOnlinePanel();
    if (state.current.type !== 'channel') { ml.innerHTML = ''; return; }
    const s = state.servers.find(x => x.id === state.current.serverId); if (!s) return;
    const cats = { online: [], offline: [] };
    const all = Array.from(new Map([...s.members, state.me].map(u => [u.id, u])).values()).filter(u => !s.banned.includes(u.id));
    all.forEach(u => (u.status==='offline'?cats.offline:cats.online).push(u));
    const mkMember = u => `<div class="member-item" data-user="${u.id}"><div class="member-avatar-wrap"><img class="member-avatar" src="${u.avatar}"><span class="status-dot ${u.status}"></span></div><div class="member-info"><div class="member-name ${u.status==='offline'?'offline':''}">${escapeHtml(u.name)} ${u.role!=='Wanderer'?'<span class="member-role-badge">'+escapeHtml(u.role)+'</span>':''}</div><div class="member-activity">${u.status==='offline'?'Offline':escapeHtml(u.activity)}</div></div><div class="member-role" style="background:${u.roleColor||COLORS.pink}"></div></div>`;
    ml.innerHTML = `<div class="member-category">Online — ${cats.online.length}</div>${cats.online.map(mkMember).join('')}<div class="member-category">Offline — ${cats.offline.length}</div>${cats.offline.map(mkMember).join('')}`;
    $all('.member-item', ml).forEach(el => {
      el.addEventListener('click', () => showProfile(el.dataset.user));
      el.addEventListener('contextmenu', e => showMemberContextMenu(e, el.dataset.user, s));
    });
  }

  function allKnownUsers() {
    const map = new Map();
    if (state.me) map.set(state.me.id, state.me);
    for (const s of state.servers) for (const u of s.members) if (!s.banned?.includes(u.id)) map.set(u.id, u);
    for (const u of state.friends) map.set(u.id, u);
    for (const u of state.dms) map.set(u.id, u);
    for (const u of state.blocked) map.set(u.id, u);
    return Array.from(map.values());
  }

  function renderOnlinePanel() {
    const body = $id('onlinePanelBody');
    const countEl = $id('onlinePanelCount');
    const toggleBtn = $id('mobileOnlineBtn');
    if (!body) return;
    const all = allKnownUsers();
    const online = all.filter(u => u.status && u.status !== 'offline');
    const offline = all.filter(u => !u.status || u.status === 'offline');
    if (countEl) countEl.textContent = online.length;
    if (toggleBtn) toggleBtn.classList.toggle('has-online', online.length > 0);
    if (!all.length) { body.innerHTML = '<div class="op-empty">No members yet. Join a shrine to see online users.</div>'; return; }
    const mkMember = u => `<div class="member-item" data-user="${u.id}"><div class="member-avatar-wrap"><img class="member-avatar" src="${u.avatar}"><span class="status-dot ${u.status||'offline'}"></span></div><div class="member-info"><div class="member-name ${(u.status||'offline')==='offline'?'offline':''}">${escapeHtml(u.name)} ${u.role && u.role!=='Wanderer'?'<span class="member-role-badge">'+escapeHtml(u.role)+'</span>':''}</div><div class="member-activity">${(u.status||'offline')==='offline'?'Offline':escapeHtml(u.activity||'Online')}</div></div><div class="member-role" style="background:${u.roleColor||COLORS.pink}"></div></div>`;
    const sortByName = (a, b) => a.name.localeCompare(b.name);
    online.sort(sortByName); offline.sort(sortByName);
    body.innerHTML = `<div class="member-category">Online — ${online.length}</div>${online.map(mkMember).join('')}${offline.length?`<div class="member-category">Offline — ${offline.length}</div>${offline.map(mkMember).join('')}`:''}`;
    $all('.member-item', body).forEach(el => {
      el.addEventListener('click', () => {
        showProfile(el.dataset.user);
        closeOnlinePanel();
      });
    });
  }

  function openOnlinePanel() {
    $id('onlinePanel').classList.add('open');
    $id('onlinePanel').setAttribute('aria-hidden', 'false');
    $id('mobileOverlay').classList.add('show');
    renderOnlinePanel();
  }
  function closeOnlinePanel() {
    $id('onlinePanel').classList.remove('open');
    $id('onlinePanel').setAttribute('aria-hidden', 'true');
    if (!$id('body').classList.contains('mobile-sidebar') && !$id('body').classList.contains('mobile-members')) $id('mobileOverlay').classList.remove('show');
  }
  function toggleOnlinePanel() {
    if ($id('onlinePanel').classList.contains('open')) closeOnlinePanel();
    else openOnlinePanel();
  }

  function renderUserBar() {
    const bar = $id('userBar');
    if (!state.me) return;
    const tenko = state.me.role === 'Tenko';
    bar.innerHTML = `
      <div class="ub-avatar-wrap"><img class="ub-avatar" src="${state.me.avatar}"><span class="status-dot ${state.me.status}"></span>${tenko?'<span class="ub-tenko">TENKO</span>':''}</div>
      <div class="ub-info" id="ubInfo"><div class="ub-name">${escapeHtml(state.me.name)} ${tenko?'<span class="role-badge">OWNER</span>':''}</div><div class="ub-status">${escapeHtml(state.me.activity)}</div></div>
      <div class="ub-actions"><button class="ub-btn" id="ubMic" title="Mic">${SVG.mic}</button><button class="ub-btn" id="ubSettings" title="Settings">${SVG.edit}</button></div>`;
    $id('ubSettings').addEventListener('click', () => openSettings());
    $id('ubMic').addEventListener('click', () => { toast('Mic status toggled'); });
    $id('ubInfo').addEventListener('click', () => showProfile(state.me.id));
  }

  function renderServerRail() {
    const list = $id('serverList');
    const activeId = state.current.type === 'channel' ? state.current.serverId : null;
    list.innerHTML = state.servers.map(s => `
      <button class="server-icon ${s.id===activeId?'active':''}" title="${escapeHtml(s.name)}" data-server="${s.id}">
        <span class="server-glyph">${s.icon}</span>
        <span class="server-tooltip">${escapeHtml(s.name)}</span>
      </button>`).join('');
    $all('#serverList .server-icon').forEach(btn => btn.addEventListener('click', () => {
      const s = state.servers.find(x => x.id === btn.dataset.server);
      const first = s.categories[0]?.channels.find(c => c.type === 'text');
      if (first) switchTo({ type: 'channel', serverId: s.id, channelId: first.id });
    }));
  }

  function renderAttachmentTray() {
    const tray = $id('attachmentTray');
    if (!state.ui.attachments.length) { tray.classList.add('hidden'); tray.innerHTML=''; return; }
    tray.classList.remove('hidden');
    tray.innerHTML = state.ui.attachments.map((a, i) => `<div class="attachment-chip">${a.type==='image'?`<img src="${a.data}">`:''}<span>${escapeHtml(a.name)}</span><button class="chip-remove" data-idx="${i}">×</button></div>`).join('');
    $all('.chip-remove', tray).forEach(b => b.addEventListener('click', () => removeAttachment(+b.dataset.idx)));
  }

  function renderCallStage() {
    const stage = $id('callStage');
    const me = state.call.streams.me || { name: state.me.name, avatar: state.me.avatar, mic: state.call.mic, video: state.call.video, screen: state.call.screen };
    let html = '';
    if (me.screen && me.screenStream) {
      const v = document.createElement('video'); v.srcObject = me.screenStream; v.autoplay = true; v.muted = true; v.playsInline = true;
      html += `<div class="call-tile screen" id="screenTile"><button class="tile-fullscreen" type="button" title="View fullscreen" aria-label="View your screen fullscreen">${SVG.expand}</button><div class="tile-label">Your screen</div><div class="tile-badge">SCREEN · 60 FPS</div></div>`;
      setTimeout(() => { const tile = $id('screenTile'); if (tile) { tile.insertBefore(v, tile.firstChild); v.play().catch(() => {}); } }, 0);
    }
    if (me.video && me.stream) {
      const v = document.createElement('video'); v.srcObject = me.stream; v.autoplay = true; v.muted = true; v.playsInline = true;
      html += `<div class="call-tile" id="camTile"><button class="tile-fullscreen" type="button" title="View fullscreen" aria-label="View your camera fullscreen">${SVG.expand}</button><div class="tile-label">${escapeHtml(me.name)}</div></div>`;
      setTimeout(() => { const tile = $id('camTile'); if (tile) { tile.insertBefore(v, tile.firstChild); v.play().catch(() => {}); } }, 0);
    } else {
      html += `<div class="call-tile empty"><img class="tile-avatar" src="${me.avatar}" alt=""><div class="tile-label">${escapeHtml(me.name)} ${me.mic?'':'<span class="tile-mic-off">🎙️</span>'}</div></div>`;
    }
    for (const peer of Object.values(state.call.peers || {})) {
      const hasVideo = peer.stream?.getVideoTracks().length > 0;
      html += `<div class="call-tile ${hasVideo?'':'empty'} ${peer.screen?'screen':''}" data-peer="${peer.user.id}">${hasVideo?`<button class="tile-fullscreen" type="button" title="View fullscreen" aria-label="View ${escapeHtml(peer.user.name)} fullscreen">${SVG.expand}</button>`:`<img class="tile-avatar" src="${peer.user.avatar}" alt="">`}<div class="tile-label">${escapeHtml(peer.user.name)}${peer.screen?' · Screen':''}</div>${peer.screen?'<div class="tile-badge">SCREEN · 60 FPS</div>':''}</div>`;
    }
    // Render native screen peer streams (from Android native senders)
    for (const [userId, peer] of Object.entries(state.call.screenPeers || {})) {
      const hasVideo = peer.stream?.getVideoTracks().length > 0;
      const profile = findUser(userId) || { id: userId, name: 'Kitsune User', avatar: '' };
      html += `<div class="call-tile ${hasVideo?'':'empty'} screen" data-screen-peer="${userId}">${hasVideo?`<button class="tile-fullscreen" type="button" title="View fullscreen" aria-label="View ${escapeHtml(profile.name)} screen fullscreen">${SVG.expand}</button>`:`<img class="tile-avatar" src="${profile.avatar}" alt="">`}<div class="tile-label">${escapeHtml(profile.name)} · Screen</div><div class="tile-badge">SCREEN · 30 FPS</div></div>`;
    }
    stage.innerHTML = html;
    for (const peer of Object.values(state.call.peers || {})) {
      if (!peer.stream?.getTracks().length) continue;
      const tile = stage.querySelector(`[data-peer="${peer.user.id}"]`);
      const media = document.createElement(peer.stream.getVideoTracks().length ? 'video' : 'audio');
      media.srcObject = peer.stream; media.autoplay = true; media.playsInline = true;
      if (media.tagName === 'AUDIO') media.style.display = 'none';
      tile?.prepend(media);
      media.play().catch(() => {});
    }
    // Attach native screen peer streams
    for (const [userId, peer] of Object.entries(state.call.screenPeers || {})) {
      if (!peer.stream?.getTracks().length) continue;
      const tile = stage.querySelector(`[data-screen-peer="${userId}"]`);
      const media = document.createElement('video');
      media.srcObject = peer.stream; media.autoplay = true; media.playsInline = true;
      tile?.prepend(media);
      media.play().catch(() => {});
    }
    $all('.tile-fullscreen', stage).forEach(button => button.addEventListener('click', event => { event.stopPropagation(); fullscreenTile(button.closest('.call-tile')); }));
    $all('.call-tile video', stage).forEach(video => video.addEventListener('dblclick', () => fullscreenTile(video.closest('.call-tile'))));
  }

  function updateComposerState() {
    const input = $id('msgInput');
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
  }

  // ---------- Emoji picker ----------
  function showEmojiPicker(rect, msgId) {
    const picker = $id('emojiPicker');
    picker.innerHTML = `<div class="ep-grid">${EMOJIS.map(e=>`<div class="ep-emoji" data-emoji="${e}">${e}</div>`).join('')}</div>`;
    picker.style.left = Math.min(rect.left, window.innerWidth - 310) + 'px';
    picker.style.top = Math.min(rect.top - 220, window.innerHeight - 240) + 'px';
    picker.classList.remove('hidden');
    picker.onclick = e => { if (e.target.dataset.emoji) { toggleReaction(msgId, e.target.dataset.emoji); picker.classList.add('hidden'); } };
    setTimeout(() => { const close = (ev) => { if (!picker.contains(ev.target)) picker.classList.add('hidden'); }; document.addEventListener('click', close, { once: true }); }, 10);
  }

  // ---------- Modals ----------
  function openModal(id) {
    $id(id).classList.remove('hidden');
    const input = $one(`${id} input`); if (input) setTimeout(() => input.focus(), 30);
  }
  function closeModal(id) { $id(id).classList.add('hidden'); }

  function openSettings() {
    openModal('settingsModal');
    const body = $id('settingsBody');
    const sections = [
      { id: 'account', label: 'Account' },
      { id: 'appearance', label: 'Appearance' },
      { id: 'voice', label: 'Voice & Video' },
      { id: 'app', label: 'App' },
      ...(state.me.role === 'Tenko' ? [{ id: 'backup', label: 'Backup' }] : []),
      { id: 'danger', label: 'Danger Zone' },
    ];
    body.innerHTML = `<div class="settings-nav">${sections.map(s => `<div class="settings-nav-item active" data-sec="${s.id}">${s.label}</div>`).join('')}</div><div class="settings-pane" id="settingsPane"></div>`;
    renderSettingsPane('account');
    $all('.settings-nav-item', body).forEach(el => el.addEventListener('click', () => {
      $all('.settings-nav-item').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      renderSettingsPane(el.dataset.sec);
    }));
  }

  function renderSettingsPane(sec) {
    const pane = $id('settingsPane');
    if (sec === 'account') {
      pane.innerHTML = `
        <div class="settings-section"><h4>Profile</h4><div class="sec-desc">Edit how you appear to others.</div>
          <div class="settings-row"><div style="display:flex;align-items:center;gap:14px;"><img id="avatarPreview" src="${state.me.avatar}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:1px solid var(--border)"><div style="display:flex;flex-direction:column;gap:8px;flex:1"><div class="sr-label">Avatar</div><select id="avatarStyle" style="background:var(--panel-deep);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;">${AVATARS.map((_,i)=>`<option value="${i}" ${(state.me.avatarVariant===i && !state.me.customAvatar)?'selected':''}>Style ${i+1}</option>`).join('')}</select><button class="ghost-btn small" id="uploadAvatar" style="text-align:left">Upload custom image</button><input type="file" id="avatarFile" accept="image/*" style="display:none"></div></div></div>
          <div class="settings-row"><div><div class="sr-label">Display name</div><div class="sr-desc">Your visible callsign.</div></div><input type="text" id="setName" value="${escapeHtml(state.me.name)}" maxlength="24"></div>
          <div class="settings-row"><div><div class="sr-label">Bio</div><div class="sr-desc">A short line about you.</div></div><textarea id="setBio">${escapeHtml(state.me.bio)}</textarea></div>
          <div class="settings-row"><div><div class="sr-label">Presence</div><div class="sr-desc">How others see your availability.</div></div><select id="setStatus"><option value="online" ${state.me.status==='online'?'selected':''}>Online</option><option value="idle" ${state.me.status==='idle'?'selected':''}>Idle</option><option value="dnd" ${state.me.status==='dnd'?'selected':''}>Do Not Disturb</option></select></div>
          <button class="primary-btn" id="saveProfile" style="margin-top:10px">Save Profile</button>
        </div>
        <div class="settings-section"><h4>Account Security</h4><div class="sec-desc">Your account, role, messages, friends, and server memberships are stored securely on the Kitsune server.</div>
          <div class="settings-row"><div><div class="sr-label">Server role</div><div class="sr-desc">Roles are controlled by server-side permissions and cannot be claimed from the browser.</div></div><b>${escapeHtml(state.me.role)}</b></div>
          <div class="settings-row"><div><div class="sr-label">Change password</div><div class="sr-desc">Update your account password.</div></div><button class="primary-btn small" id="openChangePassword">Change</button></div>
          <div id="changePasswordForm" class="hidden" style="margin-top:12px;display:flex;flex-direction:column;gap:10px;">
            <input type="password" id="currentPassword" placeholder="Current password" style="padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--panel-deep);color:var(--text);">
            <input type="password" id="newPassword" placeholder="New password" style="padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--panel-deep);color:var(--text);">
            <input type="password" id="confirmPassword" placeholder="Confirm new password" style="padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--panel-deep);color:var(--text);">
            <div style="display:flex;gap:10px;">
              <button class="primary-btn" id="savePassword">Update Password</button>
              <button class="ghost-btn" id="cancelChangePassword">Cancel</button>
            </div>
          </div>
          <div class="settings-row"><div><div class="sr-label">Recovery code</div><div class="sr-desc">Used to reset your password without email.</div></div><button class="primary-btn small" id="regenerateRecovery">Show / Regenerate</button></div>
          <div id="recoveryCodeBox" class="hidden" style="margin-top:12px;padding:12px;background:var(--panel-deep);border:1px solid var(--border);border-radius:6px;">
            <div class="sec-desc" style="margin-bottom:8px;">Save this code somewhere safe. Generating a new one replaces the old code.</div>
            <div id="recoveryCodeText" style="font-family:monospace;font-size:1.1em;word-break:break-all;margin-bottom:10px;"></div>
            <button class="ghost-btn small" id="copyRecoveryCodeSettings">Copy</button>
          </div>
        </div>`;
      $id('saveProfile').addEventListener('click', async () => {
        const name = $id('setName').value.trim() || state.me.name;
        const bio = $id('setBio').value;
        const avatar = state.me.customAvatar ? state.me.avatar : avatarFor(name, state.me.avatarVariant || 0);
        try {
          const result = await api('/api/users/me', { method: 'PATCH', body: JSON.stringify({ name, bio, avatar }) });
          Object.assign(state.me, result.user, { status: $id('setStatus').value });
          wsSend({ type: 'status', status: state.me.status, activity: state.me.activity });
          save(); renderUserBar(); renderContent(); renderMembers(); toast('Profile saved');
        } catch (error) { toast(error.message, 'error'); }
      });
      $id('avatarStyle').addEventListener('change', () => {
        const v = +$id('avatarStyle').value;
        state.me.avatarVariant = v; state.me.customAvatar = false;
        state.me.avatar = avatarFor(state.me.name, v);
        $id('avatarPreview').src = state.me.avatar;
      });
      $id('uploadAvatar').addEventListener('click', () => $id('avatarFile').click());
      $id('avatarFile').addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => { state.me.avatar = ev.target.result; state.me.customAvatar = true; $id('avatarPreview').src = state.me.avatar; };
        reader.readAsDataURL(file);
        e.target.value = '';
      });
      $id('openChangePassword').addEventListener('click', () => $id('changePasswordForm').classList.remove('hidden'));
      $id('cancelChangePassword').addEventListener('click', () => $id('changePasswordForm').classList.add('hidden'));
      $id('savePassword').addEventListener('click', async () => {
        const current = $id('currentPassword').value;
        const newPass = $id('newPassword').value;
        const confirm = $id('confirmPassword').value;
        if (newPass.length < 8) return toast('Password must be at least 8 characters.', 'error');
        if (newPass !== confirm) return toast('New passwords do not match.', 'error');
        try {
          await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: current, newPassword: newPass }) });
          $id('currentPassword').value = ''; $id('newPassword').value = ''; $id('confirmPassword').value = '';
          $id('changePasswordForm').classList.add('hidden');
          toast('Password updated');
        } catch (error) { toast(error.message, 'error'); }
      });
      $id('regenerateRecovery').addEventListener('click', async () => {
        try {
          const result = await api('/api/auth/regenerate-recovery', { method: 'POST' });
          $id('recoveryCodeText').textContent = result.recoveryCode;
          $id('recoveryCodeBox').classList.remove('hidden');
        } catch (error) { toast(error.message, 'error'); }
      });
      $id('copyRecoveryCodeSettings').addEventListener('click', () => {
        const code = $id('recoveryCodeText').textContent;
        navigator.clipboard.writeText(code).then(() => toast('Copied')).catch(() => toast('Could not copy', 'error'));
      });
    } else if (sec === 'appearance') {
      pane.innerHTML = `
        <div class="settings-section"><h4>Appearance</h4>
          <div class="settings-row"><div><div class="sr-label">Compact mode</div></div><div class="toggle ${state.settings.compact?'on':''}" id="tCompact"></div></div>
          <div class="settings-row"><div><div class="sr-label">Game mode</div><div class="sr-desc">High contrast and minimal chrome.</div></div><div class="toggle ${state.settings.gameMode?'on':''}" id="tGameMode"></div></div>
        </div>`;
      $id('tCompact').addEventListener('click', () => { state.settings.compact = !state.settings.compact; save(); renderSettingsPane('appearance'); document.body.classList.toggle('compact', state.settings.compact); });
      $id('tGameMode').addEventListener('click', () => { state.settings.gameMode = !state.settings.gameMode; save(); renderSettingsPane('appearance'); document.body.classList.toggle('game-mode', state.settings.gameMode); });
    } else if (sec === 'voice') {
      pane.innerHTML = `
        <div class="settings-section"><h4>Voice & Video</h4><div class="sec-desc">Local device settings apply. Browser permissions required.</div>
          <div class="settings-row"><div><div class="sr-label">Input device</div></div><select id="micSelect" style="background:var(--panel-deep);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;"><option>Default microphone</option></select></div>
          <div class="settings-row"><div><div class="sr-label">Output device</div></div><select id="outSelect" style="background:var(--panel-deep);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;"><option>Default speakers</option></select></div>
        </div>`;
    } else if (sec === 'app') {
      const plat = detectPlatform();
      let platformLabel = 'Web / PWA';
      if (plat.isElectron) platformLabel = 'Kitsune Desktop (Electron)';
      else if (plat.isAndroidNative) platformLabel = 'Kitsune Android (Native)';
      else if (plat.isIOSNative) platformLabel = 'Kitsune iOS (Native)';

      let updateRow = '';
      if (plat.isElectron) {
        updateRow = `
          <div class="settings-row"><div><div class="sr-label">Check for updates</div><div class="sr-desc">Manually check the server for a newer Kitsune version.</div></div><button class="primary-btn" id="checkUpdatesBtn">Check Now</button></div>
          <div class="settings-row" id="updateStatusRow" style="display:none"><div><div class="sr-label">Update status</div><div class="sr-desc" id="updateStatusText">Checking…</div></div></div>
          <div class="settings-row" id="installUpdateRow" style="display:none"><div><div class="sr-label">Update ready</div><div class="sr-desc">Restart Kitsune to apply the new version.</div></div><button class="primary-btn" id="installUpdateBtn">Restart & Install</button></div>
          <div class="settings-row"><div><div class="sr-label">Change server</div><div class="sr-desc">Switch to a different Kitsune backend.</div></div><button class="ghost-btn" id="changeServerBtn">Change Server</button></div>`;
      } else if (plat.isAndroidNative) {
        updateRow = `
          <div class="settings-row"><div><div class="sr-label">Check for updates</div><div class="sr-desc">Download the latest Kitsune APK from the server.</div></div><button class="primary-btn" id="checkUpdatesBtn">Check Now</button></div>
          <div class="settings-row" id="updateStatusRow" style="display:none"><div><div class="sr-label">Update status</div><div class="sr-desc" id="updateStatusText">Checking…</div></div></div>
          <div class="settings-row" id="installUpdateRow" style="display:none"><div><div class="sr-label">Update ready</div><div class="sr-desc">Install the new APK. Your account and data are preserved.</div></div><button class="primary-btn" id="installUpdateBtn">Install Now</button></div>`;
      } else {
        updateRow = `
          <div class="settings-row"><div><div class="sr-label">Check for updates</div><div class="sr-desc">See if a newer app version is available.</div></div><button class="primary-btn" id="checkUpdatesBtn">Check Now</button></div>
          <div class="settings-row" id="updateStatusRow" style="display:none"><div><div class="sr-label">Update status</div><div class="sr-desc" id="updateStatusText">Checking…</div></div></div>
          <div class="settings-row"><div><div class="sr-label">Download desktop app</div><div class="sr-desc">Windows 10/11 64-bit installer with auto-update.</div></div><a class="primary-btn" href="/downloads/windows" download style="text-decoration:none">Download PC</a></div>
          <div class="settings-row"><div><div class="sr-label">Download Android app</div><div class="sr-desc">Signed APK with auto-update. Android 7.0+.</div></div><a class="primary-btn" href="/downloads/android" download style="text-decoration:none">Download APK</a></div>`;
      }

      const screenCaptureRow = plat.isAndroidNative ? `
        <div class="settings-section"><h4>Screen Capture</h4><div class="sec-desc">Capture or record your device screen. Recordings are saved to the app's media folder.</div>
          <div class="settings-row"><div><div class="sr-label">Record screen</div><div class="sr-desc">Record an MP4 of your screen. You will get a system cast permission prompt.</div></div><button class="primary-btn" id="recordScreenBtn">Start Recording</button></div>
          <div class="settings-row" id="recordStatusRow" style="display:none"><div><div class="sr-label">Recording status</div><div class="sr-desc" id="recordStatusText">Preparing…</div></div></div>
          <div class="settings-row" id="stopRecordRow" style="display:none"><div><div class="sr-label">Recording in progress</div><div class="sr-desc">Tap stop to save the MP4 file.</div></div><button class="danger-btn" id="stopRecordBtn">Stop Recording</button></div>
        </div>` : '';

      pane.innerHTML = `
        <div class="settings-section"><h4>App Information</h4>
          <div class="settings-row"><div><div class="sr-label">App version</div></div><b>${CLIENT_VERSION}</b></div>
          <div class="settings-row"><div><div class="sr-label">Platform</div></div><b>${platformLabel}</b></div>
          <div class="settings-row"><div><div class="sr-label">Server</div><div class="sr-desc">${escapeHtml(location.origin)}</div></div></div>
        </div>
        <div class="settings-section"><h4>Updates</h4><div class="sec-desc">Kitsune checks for updates automatically every 30 minutes. You can also check manually below.</div>
          ${updateRow}
        </div>
        ${screenCaptureRow}`;

      const checkBtn = $id('checkUpdatesBtn');
      if (checkBtn) checkBtn.addEventListener('click', async () => {
        $id('updateStatusRow').style.display = '';
        $id('updateStatusText').textContent = 'Checking…';
        try {
          if (plat.isElectron) {
            if (window.kitsuneDesktop?.checkUpdates) window.kitsuneDesktop.checkUpdates();
            $id('updateStatusText').textContent = 'Checking in background…';
          } else if (plat.isAndroidNative) {
            const res = await api('/api/updates/android', { method: 'GET' });
            if (!res.available) { $id('updateStatusText').textContent = 'No update available.'; return; }
            if (compareVersions(res.version, CLIENT_VERSION) <= 0) { $id('updateStatusText').textContent = `You're on the latest version (${CLIENT_VERSION}).`; return; }
            $id('updateStatusText').textContent = `Version ${res.version} is available (${Math.round(res.size / 1048576)} MB).`;
            $id('installUpdateRow').style.display = '';
            $id('installUpdateBtn').onclick = () => {
              const downloadUrl = new URL(res.url, location.origin).href;
              downloadAndroidUpdate(downloadUrl, res.sha256);
            };
          } else {
            const res = await api('/api/updates/pc', { method: 'GET' });
            if (!res.available) { $id('updateStatusText').textContent = 'No update available.'; return; }
            if (compareVersions(res.version, CLIENT_VERSION) <= 0) { $id('updateStatusText').textContent = `You're on the latest version (${CLIENT_VERSION}).`; return; }
            $id('updateStatusText').textContent = `Version ${res.version} is available. Reload to update.`;
            $id('installUpdateRow').style.display = '';
            $id('installUpdateBtn').textContent = 'Reload';
            $id('installUpdateBtn').onclick = () => location.reload();
          }
        } catch (error) { $id('updateStatusText').textContent = `Error: ${error.message}`; }
      });

      const installBtn = $id('installUpdateBtn');
      if (installBtn && plat.isElectron) {
        installBtn.addEventListener('click', () => { if (window.kitsuneDesktop?.installUpdate) window.kitsuneDesktop.installUpdate(); });
      }

      const changeServerBtn = $id('changeServerBtn');
      if (changeServerBtn && plat.isElectron) {
        changeServerBtn.addEventListener('click', () => { if (window.kitsuneDesktop?.showSetup) { closeModal('settingsModal'); window.kitsuneDesktop.showSetup().catch(() => {}); } });
      }

      // Android native screen recording
      const recordBtn = $id('recordScreenBtn');
      const stopRecordBtn = $id('stopRecordBtn');
      if (recordBtn && plat.isAndroidNative) {
        recordBtn.addEventListener('click', () => {
          const native = window.kitsuneNative;
          if (!native || !native.isScreenCaptureSupported()) { toast('Screen recorder not available', 'error'); return; }
          $id('recordStatusRow').style.display = '';
          $id('recordStatusText').textContent = 'Requesting permission…';

          native._onRecordStarted = (path) => {
            $id('recordStatusText').textContent = 'Recording to: ' + path;
            $id('stopRecordRow').style.display = '';
            recordBtn.style.display = 'none';
            toast('Recording started');
          };
          native._onRecordFinished = (path) => {
            $id('recordStatusText').textContent = 'Recording saved: ' + path;
            $id('stopRecordRow').style.display = 'none';
            recordBtn.style.display = '';
            toast('Recording saved to device');
          };
          native._onRecordError = (msg) => {
            $id('recordStatusText').textContent = `Error: ${msg}`;
            $id('stopRecordRow').style.display = 'none';
            recordBtn.style.display = '';
            toast(msg, 'error');
          };

          try {
            const result = native.startScreenRecording();
            const parsed = JSON.parse(result);
            if (!parsed.ok) { $id('recordStatusText').textContent = `Error: ${parsed.error}`; toast(parsed.error, 'error'); }
          } catch (e) { $id('recordStatusText').textContent = `Error: ${e.message}`; toast(e.message, 'error'); }
        });
      }
      if (stopRecordBtn && plat.isAndroidNative) {
        stopRecordBtn.addEventListener('click', () => {
          const native = window.kitsuneNative;
          if (!native) return;
          $id('recordStatusText').textContent = 'Stopping…';
          try { native.stopScreenRecording(); } catch (e) { $id('recordStatusText').textContent = `Error: ${e.message}`; }
        });
      }

      // For Electron, listen for update status changes while settings is open
      if (plat.isElectron && window.kitsuneDesktop?.onUpdateStatus) {
        const removeListener = window.kitsuneDesktop.onUpdateStatus((data) => {
          const statusRow = $id('updateStatusRow');
          if (!statusRow || statusRow.style.display === 'none') return;
          if (data.event === 'available') $id('updateStatusText').textContent = 'Downloading update…';
          else if (data.event === 'progress') $id('updateStatusText').textContent = `Downloading… ${data.percent}%`;
          else if (data.event === 'downloaded') {
            $id('updateStatusText').textContent = 'Update downloaded and ready.';
            $id('installUpdateRow').style.display = '';
          } else if (data.event === 'not-available') $id('updateStatusText').textContent = `You're on the latest version (${CLIENT_VERSION}).`;
          else if (data.event === 'error') $id('updateStatusText').textContent = `Update error: ${data.message}`;
        });
        // Clean up when settings modal closes
        const closeBtn = $id('closeSettings');
        if (closeBtn) closeBtn.addEventListener('click', () => { if (removeListener) removeListener(); }, { once: true });
      }
    } else if (sec === 'backup') {
      pane.innerHTML = `
        <div class="settings-section"><h4>Backup & Restore</h4><div class="sec-desc">Download a full server backup or restore from one. Keep the file private — it contains password hashes.</div>
          <div class="settings-row"><div><div class="sr-label">Export backup</div><div class="sr-desc">Download all users, shrines, channels, messages, and friends as JSON.</div></div><button class="primary-btn" id="exportBackup">Export</button></div>
          <div class="settings-row"><div><div class="sr-label">Import backup</div><div class="sr-desc">Upload a JSON backup to restore data. This replaces the current in-memory database.</div></div><button class="primary-btn" id="importBackup">Import</button></div>
          <input type="file" id="backupFile" accept="application/json,.json" style="display:none">
        </div>`;
      $id('exportBackup').addEventListener('click', async () => {
        try {
          const data = await api('/api/admin/export');
          const text = JSON.stringify(data, null, 2);
          const blob = new Blob([text], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `kitsune-backup-${new Date().toISOString().slice(0,10)}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (error) { toast(error.message, 'error'); }
      });
      $id('importBackup').addEventListener('click', () => $id('backupFile').click());
      $id('backupFile').addEventListener('change', async (e) => {
        const file = e.target.files[0]; if (!file) return;
        if (!confirm('This will replace the current server data. Continue?')) { e.target.value = ''; return; }
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          await api('/api/admin/import', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
          toast('Backup imported. Refresh to load restored data.');
          await refreshBootstrap();
          renderServerRail(); renderContent();
        } catch (error) { toast(error.message, 'error'); }
        e.target.value = '';
      });
    } else if (sec === 'danger') {
      pane.innerHTML = `
        <div class="settings-section"><h4>Danger Zone</h4>
          <div class="settings-row"><div><div class="sr-label">Reset local data</div><div class="sr-desc">Clears messages, servers, friends.</div></div><button class="danger-btn" id="resetData">Reset</button></div>
          <div class="settings-row"><div><div class="sr-label">Log out</div></div><button class="danger-btn" id="logoutBtn">Log out</button></div>
        </div>`;
      $id('resetData').addEventListener('click', () => { if (confirm('Reset all local Kitsune data? This cannot be undone.')) { localStorage.removeItem(LS.state); localStorage.removeItem(LS.session); seed(); seedServers(); save(); renderSidebar(); renderContent(); renderMembers(); toast('Data reset'); } });
      $id('logoutBtn').addEventListener('click', () => { closeModal('settingsModal'); logout(); });
    }
    $all('.toggle').forEach(t => t.addEventListener('click', function() { this.classList.toggle('on'); }));
  }

  async function showProfile(userId) {
    let u = findUser(userId);
    if (!u) {
      try { await refreshBootstrap(); u = findUser(userId); }
      catch (_) {}
    }
    if (!u) { toast('This profile is not available on the current Kitsune server.', 'error'); return; }
    const card = $id('profileCard');
    const isMe = u.id === state.me.id;
    const friendship = state.friends.find(friend => friend.id === u.id);
    const blocked = state.blocked.some(user => user.id === u.id);
    const roleText = u.role === 'Tenko' ? 'Owner (Tenko)' : (u.role || 'Wanderer');
    let actions = '<button class="ghost-btn" id="profileEdit">Edit</button>';
    if (!isMe && blocked) actions = '<button class="ghost-btn" id="profileUnblock">Unblock</button>';
    else if (!isMe && friendship?.pending && friendship.incoming) actions = '<button class="primary-btn" id="profileAcceptFriend">Accept Friend</button>';
    else if (!isMe && friendship?.pending) actions = '<button class="ghost-btn" disabled>Request Sent</button>';
    else if (!isMe && friendship) actions = '<button class="primary-btn" id="profileDm">Message</button><button class="ghost-btn" id="profileCall">Call</button>';
    else if (!isMe) actions = '<button class="primary-btn" id="profileAddFriend">Add Friend</button>';
    card.innerHTML = `
      <div class="profile-card-inner"><div class="profile-banner"></div><img class="profile-avatar-big" src="${u.avatar}" alt="">
        <div class="profile-body">
          <div class="profile-name">${escapeHtml(u.name)}</div>
          <div class="profile-tag">@${escapeHtml(u.tag)} ${u.role==='Tenko'?'<span class="profile-role">OWNER</span>':''}</div>
          <div class="profile-role-label">${escapeHtml(roleText)}</div>
          <div class="profile-bio">${u.bio ? escapeHtml(u.bio) : 'No bio set.'}</div>
          <div class="profile-meta"><span>Status</span><span>${STATUS_LABELS[u.status]}</span><span>Activity</span><span>${escapeHtml(u.activity)}</span></div>
          <div class="profile-actions">${actions}</div>
        </div>
      </div>`;
    openModal('profileModal');
    $id('profileAddFriend')?.addEventListener('click', async () => { if (await addFriend(u.name)) showProfile(u.id); });
    $id('profileAcceptFriend')?.addEventListener('click', async () => { if (await acceptFriend(u.id)) showProfile(u.id); });
    $id('profileUnblock')?.addEventListener('click', async () => { await unblockFriend(u.id); showProfile(u.id); });
    $id('profileDm')?.addEventListener('click', () => { closeModal('profileModal'); openDmWith(u); });
    $id('profileCall')?.addEventListener('click', () => { closeModal('profileModal'); openDmWith(u); setTimeout(() => startCall('voice'), 50); });
  }

  // ---------- Quick switcher ----------
  function openQuickSwitcher() {
    const qs = $id('quickSwitch');
    qs.classList.remove('hidden');
    const input = $id('qsInput');
    input.value = '';
    input.focus();
    renderQuickResults(input.value);
    input.oninput = () => renderQuickResults(input.value);
    input.onkeydown = (e) => { if (e.key === 'Enter') selectQuickFirst(); if (e.key === 'Escape') closeQuickSwitcher(); };
  }
  function closeQuickSwitcher() { $id('quickSwitch').classList.add('hidden'); $id('qsInput').oninput = null; $id('qsInput').onkeydown = null; }
  function renderQuickResults(q) {
    const cont = $id('qsResults');
    const items = [];
    state.servers.forEach(s => s.categories.forEach(cat => cat.channels.forEach(ch => { if (!q || ch.name.toLowerCase().includes(q.toLowerCase())) items.push({ t: 'channel', s, ch, label: `#${ch.name}` }); })));
    state.dms.forEach(d => { if (!q || d.name.toLowerCase().includes(q.toLowerCase())) items.push({ t: 'dm', d, label: `@${d.name}` }); });
    if (!items.length) { cont.innerHTML = `<div class="qs-empty">No matches</div>`; return; }
    cont.innerHTML = items.map((it, i) => `<div class="qs-item ${i===0?'selected':''}" data-idx="${i}"><span class="qs-hash">${it.t==='channel'?SVG.hash:'@'}</span><span>${it.t==='channel'?escapeHtml(it.ch.name):escapeHtml(it.d.name)}</span><span style="margin-left:auto;color:var(--text-faint)">${it.t==='channel'?escapeHtml(it.s.name):'DM'}</span></div>`).join('');
    $all('.qs-item', cont).forEach(el => el.addEventListener('click', () => selectQuick(items[+el.dataset.idx])));
  }
  function selectQuickFirst() {
    const first = $one('#qsResults .qs-item.selected');
    if (first) first.click();
  }
  function selectQuick(it) {
    if (it.t === 'channel') switchTo({ type: 'channel', serverId: it.s.id, channelId: it.ch.id });
    else if (it.t === 'dm') switchTo({ type: 'dm', dmId: it.d.id });
    closeQuickSwitcher();
  }

  // ---------- Context menu ----------
  function showContextMenu(e, items) {
    e.preventDefault();
    const menu = $id('contextMenu');
    menu.innerHTML = items.map(item => item.sep ? '<div class="cm-sep"></div>' : `<div class="cm-item ${item.danger?'danger':''}" data-action="${item.action}">${item.icon?item.icon:''}<span>${escapeHtml(item.label)}</span></div>`).join('');
    menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 200) + 'px';
    menu.classList.remove('hidden');
    $all('.cm-item', menu).forEach(el => el.addEventListener('click', () => { if (el.dataset.action) items.find(i=>i.action===el.dataset.action)?.handler?.(); menu.classList.add('hidden'); }));
    setTimeout(() => document.addEventListener('click', () => menu.classList.add('hidden'), { once: true }), 10);
  }

  function showMemberContextMenu(e, userId, server) {
    const u = server.members.find(m => m.id === userId) || (userId === state.me.id ? state.me : null);
    if (!u) return;
    if (userId === state.me.id) {
      showContextMenu(e, [{ label: 'Profile', action: 'profile', handler: () => showProfile(u.id) }]);
      return;
    }
    if (!amOwner()) { showContextMenu(e, [{ label: 'Profile', action: 'profile', handler: () => showProfile(u.id) }]); return; }
    const items = [{ label: 'Profile', action: 'profile', handler: () => showProfile(u.id) }];
    if (u.role === 'Wanderer') items.push({ label: 'Promote to Admin', action: 'promote', handler: () => promoteMember(server, u.id) });
    else if (u.role === 'Admin') items.push({ label: 'Demote to Wanderer', action: 'demote', handler: () => demoteMember(server, u.id) });
    items.push({ sep: true });
    items.push({ label: 'Kick from shrine', action: 'kick', handler: () => kickMember(server, u.id) });
    items.push({ label: 'Ban from shrine', action: 'ban', danger: true, handler: () => banMember(server, u.id) });
    showContextMenu(e, items);
  }

  async function setMemberRole(s, uid, role) {
    const u = s.members.find(m => m.id === uid); if (!u) return;
    try { await api(`/api/guilds/${s.id}/members/${uid}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }); u.role = role; renderMembers(); toast(`${u.name} is now ${role}`); }
    catch (error) { toast(error.message, 'error'); }
  }
  function promoteMember(s, uid) { setMemberRole(s, uid, 'Admin'); }
  function demoteMember(s, uid) { setMemberRole(s, uid, 'Wanderer'); }
  async function kickMember(s, uid) {
    const u = s.members.find(m => m.id === uid); if (!u || !confirm(`Kick ${u.name} from this shrine?`)) return;
    try { await api(`/api/guilds/${s.id}/members/${uid}/kick`, { method: 'POST' }); s.members = s.members.filter(m => m.id !== uid); renderMembers(); toast(`${u.name} kicked`); }
    catch (error) { toast(error.message, 'error'); }
  }
  async function banMember(s, uid) {
    const u = s.members.find(m => m.id === uid); if (!u || !confirm(`Ban ${u.name} from this shrine?`)) return;
    try { await api(`/api/guilds/${s.id}/members/${uid}/ban`, { method: 'POST', body: JSON.stringify({ reason: '' }) }); s.members = s.members.filter(m => m.id !== uid); renderMembers(); toast(`${u.name} banned`); }
    catch (error) { toast(error.message, 'error'); }
  }

  async function clearServerHistory() {
    const s = state.servers.find(x => x.id === state.current.serverId);
    if (!s) return;
    try {
      const result = await api(`/api/guilds/${s.id}/messages`, { method: 'DELETE' });
      s.categories.forEach(cat => cat.channels.forEach(ch => { delete state.messages[channelKey(s.id, ch.id)]; }));
      renderMessages(); toast(`Cleared ${result.count} messages`);
    } catch (error) { toast(error.message, 'error'); }
  }

  // ---------- Toasts ----------
  function toast(text, type='info', duration=3500) {
    const cont = $id('toasts');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = text;
    cont.appendChild(t);
    setTimeout(() => t.remove(), duration);
  }

  function joinVoiceChannel(sid, cid) {
    startCall('voice', { channelId: cid });
  }

  // ---------- Event wiring ----------
  function wireEvents() {
    $id('tabLogin').addEventListener('click', () => { setAuthMode('login'); });
    $id('tabRegister').addEventListener('click', () => { setAuthMode('register'); });
    $id('authForm').addEventListener('submit', e => { e.preventDefault(); handleAuth(); });
    $id('forgotPasswordLink').addEventListener('click', (e) => { e.preventDefault(); showForgotForm(); });
    $id('forgotPasswordForm').addEventListener('submit', handleForgotPassword);
    $id('forgotCancel').addEventListener('click', () => { hideForgotForm(); });
    $id('copyRecoveryCode').addEventListener('click', () => {
      const code = $id('recoveryCodeValue').textContent;
      navigator.clipboard.writeText(code).then(() => toast('Recovery code copied')).catch(() => toast('Could not copy', 'error'));
    });
    $id('continueAfterRegister').addEventListener('click', () => {
      $id('recoveryCodeDisplay').classList.add('hidden');
      $id('authForm').classList.remove('hidden');
      $id('authTabs').classList.remove('hidden');
      setAuthMode('login');
    });

    $id('homeBtn').addEventListener('click', () => switchTo({ type: 'home' }));
    $id('friendsBtn').addEventListener('click', () => switchTo({ type: 'friends' }));
    $id('addServerBtn').addEventListener('click', () => openModal('createServerModal'));
    $id('exploreBtn').addEventListener('click', () => toast('Explore is in developer preview'));
    $id('confirmCreateServer').addEventListener('click', async () => {
      const n = $id('newServerName').value.trim();
      const i = $id('newServerIcon').value.trim() || 'K';
      if (!n) return toast('Name your shrine', 'error');
      try {
        await api('/api/guilds', { method: 'POST', body: JSON.stringify({ name: n, icon: i }) });
        await refreshBootstrap(); renderServerRail(); closeModal('createServerModal');
        $id('newServerName').value = ''; $id('newServerIcon').value = '';
        toast('Shrine created');
      } catch (error) { toast(error.message, 'error'); }
    });
    $id('cancelCreateServer').addEventListener('click', () => closeModal('createServerModal'));
    $id('closeCreateServer').addEventListener('click', () => closeModal('createServerModal'));

    $id('confirmAddFriend').addEventListener('click', () => { addFriend($id('newFriendName').value); closeModal('addFriendModal'); $id('newFriendName').value=''; });
    $id('cancelAddFriend').addEventListener('click', () => closeModal('addFriendModal'));
    $id('closeAddFriend').addEventListener('click', () => closeModal('addFriendModal'));

    $id('closeSettings').addEventListener('click', () => closeModal('settingsModal'));
    $id('profileModal').addEventListener('click', e => { if (e.target.id === 'profileModal') closeModal('profileModal'); });
    $id('settingsModal').addEventListener('click', e => { if (e.target.id === 'settingsModal') closeModal('settingsModal'); });
    $id('quickSwitch').addEventListener('click', e => { if (e.target.id === 'quickSwitch') closeQuickSwitcher(); });

    $id('msgInput').addEventListener('input', () => { updateComposerState(); sendTyping(); });
    $id('msgInput').addEventListener('keydown', e => {
      if (state.settings.enterSend && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
      if (e.key === 'Escape' && state.ui.editing) { state.ui.editing = null; $id('msgInput').value = ''; updateComposerState(); }
    });
    $id('sendBtn').addEventListener('click', sendMessage);
    $id('attachBtn').addEventListener('click', openFileInput);
    $id('fileInput').addEventListener('change', handleFileInput);
    $id('emojiBtn').addEventListener('click', e => showEmojiPicker(e.target.getBoundingClientRect(), null));

    $id('winMin').addEventListener('click', () => { if (window.api?.minimize) window.api.minimize(); });
    $id('winMax').addEventListener('click', () => { if (window.api?.maximize) window.api.maximize(); });
    $id('winClose').addEventListener('click', () => { if (window.api?.close) window.api.close(); else window.close(); });

    $id('callHangup').addEventListener('click', endCall);
    $id('cbHangup').addEventListener('click', endCall);
    $id('callMic').addEventListener('click', toggleMic);
    $id('callVideo').addEventListener('click', toggleVideo);
    $id('callScreen').addEventListener('click', toggleScreen);
    $id('cbVideo').addEventListener('click', toggleVideo);
    $id('cbScreen').addEventListener('click', toggleScreen);
    $id('callMinimize').addEventListener('click', () => $id('callOverlay').classList.add('hidden'));
    $id('callFullscreen').addEventListener('click', () => { const el = $id('callOverlay'); if (document.fullscreenElement) document.exitFullscreen(); else { const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen; if (fn) fn.call(el).catch(()=>{}); } });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && screen.orientation?.unlock) screen.orientation.unlock(); });

    $id('mobileMenuBtn').addEventListener('click', () => { closeOnlinePanel(); $id('body').classList.add('mobile-sidebar'); $id('mobileOverlay').classList.add('show'); });
    $id('mobileMemberBtn').addEventListener('click', () => { closeOnlinePanel(); $id('body').classList.add('mobile-members'); $id('mobileOverlay').classList.add('show'); });
    $id('mobileOnlineBtn').addEventListener('click', () => { $id('body').classList.remove('mobile-sidebar','mobile-members'); toggleOnlinePanel(); });
    $id('closeOnlinePanel').addEventListener('click', closeOnlinePanel);
    $id('mobileOverlay').addEventListener('click', () => { $id('body').classList.remove('mobile-sidebar','mobile-members'); $id('mobileOverlay').classList.remove('show'); closeOnlinePanel(); });

    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); openQuickSwitcher(); }
      if (e.ctrlKey && (e.key === 'p' || e.key === ',')) { e.preventDefault(); openSettings(); }
      if (e.key === 'Escape') { closeQuickSwitcher(); closeModal('settingsModal'); closeModal('profileModal'); }
    });

    document.addEventListener('click', e => {
      if (e.target.classList.contains('msg-author')) showProfile(e.target.dataset.author);
    });

    window.addEventListener('resize', () => {
      if (!isMobile()) { $id('body').classList.remove('mobile-sidebar','mobile-members'); $id('mobileOverlay').classList.remove('show'); }
    });
  }

  function setAuthMode(mode) {
    $id('tabLogin').classList.toggle('active', mode==='login');
    $id('tabRegister').classList.toggle('active', mode==='register');
    $id('authPass2').classList.toggle('hidden', mode==='login');
    $id('authPass2Label').classList.toggle('hidden', mode==='login');
    $id('authSubmit').textContent = mode==='login' ? 'Enter' : 'Create account';
    $id('authError').classList.add('hidden');
    $id('forgotPasswordLink').classList.toggle('hidden', mode !== 'login');
    $id('authForm').classList.remove('hidden');
    $id('forgotPasswordForm').classList.add('hidden');
    $id('recoveryCodeDisplay').classList.add('hidden');
  }

  // ---------- Auto-update ----------
  const CLIENT_VERSION = '2.2.0';
  let updateState = { available: false, info: null, downloaded: false, percent: 0 };

  function showUpdateBanner(text, actionLabel, onAction, type='info') {
    let banner = $id('updateBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'updateBanner';
      banner.className = 'update-banner';
      document.body.appendChild(banner);
    }
    banner.innerHTML = `<div class="ub-text">${escapeHtml(text)}</div>${actionLabel ? `<button class="ub-action">${escapeHtml(actionLabel)}</button>` : ''}<button class="ub-close" aria-label="Dismiss">&times;</button>`;
    banner.classList.add('show', type);
    const closeBtn = banner.querySelector('.ub-close');
    if (closeBtn) closeBtn.addEventListener('click', () => banner.classList.remove('show'));
    if (actionLabel && onAction) {
      const actionBtn = banner.querySelector('.ub-action');
      if (actionBtn) actionBtn.addEventListener('click', onAction);
    }
  }

  async function checkForUpdates() {
    const plat = detectPlatform();
    if (plat.isElectron) {
      // Electron uses electron-updater; the main process handles download + install.
      // We just listen for status events from the main process.
      if (window.kitsuneDesktop.onUpdateStatus) {
        window.kitsuneDesktop.onUpdateStatus((data) => {
          if (data.event === 'available') {
            updateState.available = true; updateState.info = data.info;
            showUpdateBanner('A new version of Kitsune is downloading…', null, null, 'info');
          } else if (data.event === 'progress') {
            updateState.percent = data.percent;
          } else if (data.event === 'downloaded') {
            updateState.downloaded = true;
            showUpdateBanner('Kitsune update ready — restart to apply.', 'Restart Now', () => {
              if (window.kitsuneDesktop?.installUpdate) window.kitsuneDesktop.installUpdate();
            }, 'success');
          } else if (data.event === 'error') {
            console.warn('Update error:', data.message);
          }
        });
      }
      if (window.kitsuneDesktop?.checkUpdates) window.kitsuneDesktop.checkUpdates();
      return;
    }

    if (plat.isAndroidNative) {
      try {
        const res = await api('/api/updates/android', { method: 'GET' });
        if (!res.available) return;
        if (compareVersions(res.version, CLIENT_VERSION) <= 0) return;
        updateState.available = true; updateState.info = res;
        const downloadUrl = new URL(res.url, location.origin).href;
        showUpdateBanner(`Kitsune ${res.version} is available. Tap to update.`, 'Update Now', () => downloadAndroidUpdate(downloadUrl, res.sha256), 'info');
      } catch (_) {}
      return;
    }

    // Web / PWA: just show a notification that a newer app version is available
    if (plat.isWebPWA) {
      try {
        const res = await api('/api/updates/pc', { method: 'GET' });
        if (!res.available) return;
        if (compareVersions(res.version, CLIENT_VERSION) <= 0) return;
        updateState.available = true; updateState.info = res;
        showUpdateBanner(`Kitsune ${res.version} is available. Refresh or reinstall the app for the latest features.`, 'Reload', () => location.reload(), 'info');
      } catch (_) {}
    }
  }

  function compareVersions(a, b) {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const da = pa[i] || 0, db = pb[i] || 0;
      if (da > db) return 1;
      if (da < db) return -1;
    }
    return 0;
  }

  async function downloadAndroidUpdate(url, expectedSha) {
    const plugin = window.Capacitor?.Plugins?.KitsuneUpdater;
    if (!plugin) { toast('Update plugin not available', 'error'); return; }
    showUpdateBanner('Downloading update… 0%', null, null, 'info');
    let progressListener = null;
    try {
      if (plugin.addListener) progressListener = await plugin.addListener('updateProgress', (data) => {
        const banner = $id('updateBanner');
        if (banner) { const text = banner.querySelector('.ub-text'); if (text) text.textContent = `Downloading update… ${data.percent}%`; }
      });
      const result = await plugin.downloadAndInstall({ url, sha256: expectedSha });
      showUpdateBanner('Update downloaded. Android will install it now.', null, null, 'success');
      // Android package installer takes over; the app will restart after install
    } catch (error) {
      showUpdateBanner(`Update failed: ${error.message || error}`, 'Retry', () => downloadAndroidUpdate(url, expectedSha), 'error');
    } finally {
      if (progressListener && progressListener.remove) progressListener.remove();
    }
  }

  // ---------- Boot ----------
  async function boot() {
    load();
    state.me = null;
    wireEvents();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
    try {
      await refreshBootstrap();
      enterApp();
      loadConversationMessages();
    } catch (_) {
      renderAuthSaved();
      $id('authScreen').classList.remove('hidden');
    }
    window.addEventListener('beforeunload', () => { if (state.call.active && state.call.roomId) wsSend({ type: 'call-leave', roomId: state.call.roomId }); save(); });
    setInterval(() => { save(); }, 30000);
    setupNativeScreenCaptureListeners();
    // Check for updates after app loads, then every 30 minutes
    setTimeout(() => checkForUpdates(), 5000);
    setInterval(() => checkForUpdates(), 30 * 60 * 1000);
  }

  function setupNativeScreenCaptureListeners() {
    // The native bridge (window.kitsuneNative) uses direct callbacks, not Capacitor events.
    // Recording callbacks are set up in the settings pane when the user clicks "Start Recording".
    // Nothing to do here at boot — the bridge is always available via @JavascriptInterface.
  }

  boot().catch(error => { console.error(error); toast('Kitsune failed to start', 'error'); });
})();
