import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
const app = document.getElementById('app');

// =========================================================
// Состояние
// =========================================================
const S = {
  demo: new URLSearchParams(location.search).has('demo'),
  session: null, user: null,
  space: null, members: [],
  groups: [], places: [], visits: [], photos: [],
  urls: new Map(),
  login: { step: 'login', email: '' },
  onboard: { mode: 'create' },
  gfilter: { q: '', tag: null },
  ctxGroup: null,
  dirty: false,
};
const KEY = { groups: 'groups', places: 'places', visits: 'visits', visit_photos: 'photos' };

// =========================================================
// Утилиты
// =========================================================
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const todayISO = () => new Date().toLocaleDateString('sv-SE');
const shiftDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDate = s => { const d = parseISO(s); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`; };
const fmtDayMonth = s => { const d = parseISO(s); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; };
const fmtShort = s => { const d = parseISO(s); return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`; };
const fmtMonth = key => { const [y, m] = key.split('-').map(Number); return `${MONTHS_NOM[m - 1]} ${y}`; };
const initial = name => ((name || '?').trim()[0] || '?').toUpperCase();

const I = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  more: '<circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.2" fill="currentColor" stroke="none"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  heartF: '<path fill="currentColor" d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  map: '<path d="M4 7l5-2.5 6 2.5 5-2.5v12.5l-5 2.5-6-2.5-5 2.5z"/><path d="M9 4.5v12.5M15 7v12.5"/>',
  album: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9.5" cy="9.5" r="1.8"/><path d="M20 15l-4.5-4.5L7 19"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  insta: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  cal: '<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8L10 4h4l1.7 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  image: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9.5" cy="9.5" r="1.8"/><path d="M20 15l-4.5-4.5L7 19"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/><path d="M10.5 11v5M13.5 11v5"/>',
  move: '<path d="M4 8h12M12 4l4 4-4 4M20 16H8M12 12l-4 4 4 4"/>',
  close: '<path d="M7 7l10 10M17 7L7 17"/>',
  share: '<path d="M12 4v11M8 8l4-4 4 4M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/>',
};
const icon = (k, size = 22) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;

// Пастельные «холмики» вместо фото
const PALETTES = {
  peach: ['#FCE3D3', '#F6D3BF', '#E8B9A0', '#F0C9B4'],
  sage: ['#E4EEDD', '#D3E0C9', '#B5CBA8', '#C6D8BA'],
  rose: ['#F8E4E5', '#F0CFD1', '#DDAEB2', '#F5E6B8'],
  butter: ['#FBF2D8', '#F5E6B8', '#E5CF8E', '#D3E0C9'],
  sky: ['#E3ECF2', '#CFDDE6', '#B4C9D6', '#F0CFD1'],
  lav: ['#ECE7F3', '#DCD3EA', '#C2B6D8', '#CFDDE6'],
};
const PAL_KEYS = Object.keys(PALETTES);
const SWATCH = { peach: '#F6D3BF', sage: '#D3E0C9', rose: '#F0CFD1', butter: '#F5E6B8', sky: '#CFDDE6' };
let artN = 0;
function art(key) {
  const p = PALETTES[key] || PALETTES.peach, id = 'g' + (artN++);
  // фон и холмы тянутся под любую форму, солнце — отдельный круг (не искажается)
  return `<svg class="art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient></defs><rect width="100" height="100" fill="url(#${id})"/><ellipse cx="17" cy="100" rx="58" ry="38" fill="${p[2]}"/><ellipse cx="82" cy="106" rx="50" ry="34" fill="${p[3]}" fill-opacity=".85"/></svg><span class="sun"></span>`;
}
const hashKey = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0; return PAL_KEYS[Math.abs(h) % PAL_KEYS.length]; };
const photo = (src, key, { cls = '', style = '', inner = '' } = {}) =>
  `<div class="ph ${cls}" style="${style}">${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : art(key)}${inner}</div>`;

function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
function handleErr(e) {
  console.error(e);
  const m = e instanceof Event ? 'photo-unreadable' : String(e?.message || e);
  if (/photo-unreadable/.test(m)) return toast('Это фото не открывается — возможно, формат HEIC. Попробуйте другое фото или скриншот этого');
  if (/mime type|not supported|payload too large|exceeded the maximum/i.test(m)) return toast('Фото не подошло по формату или размеру — попробуйте другое');
  if (/rate limit|security purposes/i.test(m)) return toast('Слишком часто. Подождите минуту и попробуйте снова');
  if (/invite code not found/i.test(m)) return toast('Такой код не найден — проверьте буквы и цифры');
  if (/space is full/i.test(m)) return toast('В этом списке уже двое — третьему туда нельзя');
  if (/invalid login credentials/i.test(m)) return toast('Неверная почта или пароль');
  if (/already registered|already exists/i.test(m)) return toast('Такая почта уже есть — нажмите «Войти»');
  if (/password should be|at least 6/i.test(m)) return toast('Пароль — минимум 6 символов');
  if (/email not confirmed|confirm-required/i.test(m)) return toast('Нужно выключить «Confirm email» в настройках Supabase');
  if (/invalid.*email|email.*invalid/i.test(m)) return toast('Проверьте адрес почты');
  if (/Failed to fetch|NetworkError/i.test(m)) return toast('Нет связи с интернетом');
  toast('Не получилось: ' + m);
}

// Сжатие фото перед загрузкой: до 1600 px по длинной стороне, JPEG ~80%
// Если браузер не может прочитать фото (например, HEIC) — понятная ошибка;
// если прочитать может, но сжать не вышло — загружаем оригинал (JPEG/PNG/WebP до 10 МБ).
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
async function compress(file, max = 1600, q = 0.82) {
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    try {
      src = await new Promise((res, rej) => {
        const im = new Image(); im.onload = () => res(im);
        im.onerror = () => rej(new Error('photo-unreadable')); im.src = URL.createObjectURL(file);
      });
    } catch (e) {
      if (OK_TYPES.includes(file.type) && file.size <= 10 * 1024 * 1024) return file;
      throw e;
    }
  }
  try {
    const k = Math.min(1, max / Math.max(src.width, src.height));
    const c = document.createElement('canvas');
    c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', q));
    if (blob) return blob;
  } catch { /* не хватило памяти и т.п. */ }
  if (OK_TYPES.includes(file.type) && file.size <= 10 * 1024 * 1024) return file;
  throw new Error('photo-unreadable');
}

// =========================================================
// Данные
// =========================================================
const url = path => (path ? S.urls.get(path) || null : null);
const groupById = id => S.groups.find(g => g.id === id);
const placeById = id => S.places.find(p => p.id === id);
const cities = () => S.groups.filter(g => g.kind === 'city');
const trips = () => S.groups.filter(g => g.kind === 'trip');
const placesIn = gid => S.places.filter(p => p.group_id === gid);
const visitsOf = pid => S.visits.filter(v => v.place_id === pid)
  .sort((a, b) => b.visited_on.localeCompare(a.visited_on) || String(b.created_at).localeCompare(String(a.created_at)));
const photosOf = vid => S.photos.filter(f => f.visit_id === vid).sort((a, b) => a.sort_order - b.sort_order);
const isBeen = p => S.visits.some(v => v.place_id === p.id);
const isWant = p => !isBeen(p) || p.want_again;
const lastVisit = p => visitsOf(p.id)[0]?.visited_on || '';
function placeImg(p) {
  if (p.cover_path) return url(p.cover_path);
  for (const v of visitsOf(p.id)) { const f = photosOf(v.id)[0]; if (f) return url(f.path); }
  return null;
}
function visitImg(v) {
  const f = photosOf(v.id)[0];
  if (f) return url(f.path);
  const p = placeById(v.place_id);
  return p ? placeImg(p) : null;
}
const counts = gid => { const ps = placesIn(gid); return { want: ps.filter(isWant).length, been: ps.filter(isBeen).length }; };
const allTags = () => [...new Set(S.places.flatMap(p => p.tags || []))];

async function signUrls() {
  if (S.demo) return;
  const need = new Set();
  S.groups.forEach(g => g.cover_path && need.add(g.cover_path));
  S.places.forEach(p => p.cover_path && need.add(p.cover_path));
  S.photos.forEach(f => need.add(f.path));
  const paths = [...need].filter(p => !S.urls.has(p));
  for (let i = 0; i < paths.length; i += 100) {
    const { data, error } = await sb.storage.from('photos').createSignedUrls(paths.slice(i, i + 100), 60 * 60 * 24 * 7);
    if (error) { console.warn(error); continue; }
    data.forEach(d => { if (d.signedUrl) S.urls.set(d.path, d.signedUrl); });
  }
}

async function loadSpace() {
  const { data, error } = await sb.from('space_members').select('space_id, joined_at').eq('user_id', S.user.id).order('joined_at');
  if (error) throw error;
  if (!data.length) { S.space = null; return; }
  const { data: sp, error: e2 } = await sb.from('spaces').select('*').eq('id', data[0].space_id).single();
  if (e2) throw e2;
  S.space = sp;
}

async function loadAll() {
  if (S.demo || !S.space) return;
  const id = S.space.id;
  const res = await Promise.all([
    sb.from('space_members').select('user_id, display_name, joined_at').eq('space_id', id).order('joined_at'),
    sb.from('groups').select('*').eq('space_id', id).order('sort_order').order('created_at'),
    sb.from('places').select('*').eq('space_id', id).order('created_at', { ascending: false }),
    sb.from('visits').select('*').eq('space_id', id),
    sb.from('visit_photos').select('*').eq('space_id', id).order('sort_order'),
  ]);
  for (const r of res) if (r.error) throw r.error;
  [S.members, S.groups, S.places, S.visits, S.photos] = res.map(r => r.data);
  await signUrls();
}

// Запись: в демо-режиме — только в памяти
async function ins(table, row) {
  row = { space_id: S.space.id, ...row };
  let rec;
  if (S.demo) rec = { id: uid(), created_at: new Date().toISOString(), tags: [], ...row };
  else {
    const { data, error } = await sb.from(table).insert(row).select().single();
    if (error) throw error;
    rec = data;
  }
  S[KEY[table]].push(rec);
  return rec;
}
async function upd(table, id, patch) {
  if (!S.demo) { const { error } = await sb.from(table).update(patch).eq('id', id); if (error) throw error; }
  const r = S[KEY[table]].find(x => x.id === id);
  if (r) Object.assign(r, patch);
}
async function del(table, id) {
  if (!S.demo) { const { error } = await sb.from(table).delete().eq('id', id); if (error) throw error; }
  const arr = S[KEY[table]], i = arr.findIndex(x => x.id === id);
  if (i >= 0) arr.splice(i, 1);
}
async function uploadPhoto(file) {
  const blob = await compress(file);
  if (S.demo) { const path = 'demo/' + uid(); S.urls.set(path, URL.createObjectURL(blob)); return path; }
  const path = `${S.space.id}/${uid()}.jpg`;
  const { error } = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;
  return path;
}
async function removeFiles(paths) {
  paths = paths.filter(Boolean);
  if (!paths.length || S.demo) return;
  const { error } = await sb.storage.from('photos').remove(paths);
  if (error) console.warn(error);
}
async function deleteVisit(v) {
  const paths = photosOf(v.id).map(f => f.path);
  await del('visits', v.id);
  S.photos = S.photos.filter(f => f.visit_id !== v.id);
  await removeFiles(paths);
}
async function deletePlace(p) {
  const vids = visitsOf(p.id).map(v => v.id);
  const paths = [p.cover_path, ...S.photos.filter(f => vids.includes(f.visit_id)).map(f => f.path)];
  await del('places', p.id);
  S.visits = S.visits.filter(v => v.place_id !== p.id);
  S.photos = S.photos.filter(f => !vids.includes(f.visit_id));
  await removeFiles(paths);
}
async function deleteGroup(g, moveTo) {
  const ps = placesIn(g.id);
  if (moveTo) { for (const p of ps) await upd('places', p.id, { group_id: moveTo }); }
  const paths = [g.cover_path];
  if (!moveTo) for (const p of ps) {
    const vids = visitsOf(p.id).map(v => v.id);
    paths.push(p.cover_path, ...S.photos.filter(f => vids.includes(f.visit_id)).map(f => f.path));
    S.visits = S.visits.filter(v => v.place_id !== p.id);
    S.photos = S.photos.filter(f => !vids.includes(f.visit_id));
  }
  await del('groups', g.id);
  if (!moveTo) S.places = S.places.filter(p => p.group_id !== g.id);
  await removeFiles(paths);
}

// =========================================================
// Живое обновление
// =========================================================
let channel = null, refreshTimer = null;
const isFormRoute = () => /^#\/(new|p\/[^/]+\/edit)/.test(location.hash);
function subscribe() {
  if (S.demo || !S.space) return;
  if (channel) sb.removeChannel(channel);
  channel = sb.channel('space-' + S.space.id);
  for (const t of ['groups', 'places', 'visits', 'visit_photos']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `space_id=eq.${S.space.id}` }, scheduleRefresh);
  }
  channel.subscribe();
}
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => { S.dirty = true; tryRefresh(); }, 600);
}
async function tryRefresh() {
  if (!S.dirty || S.demo || !S.space) return;
  if (document.querySelector('.overlay') || isFormRoute()) return; // не мешаем, пока что-то заполняют
  S.dirty = false;
  try {
    await loadAll();
    const y = scrollY; render(); scrollTo(0, y);
  } catch (e) { console.warn(e); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.space && !S.demo) scheduleRefresh(); });

// =========================================================
// Навигация
// =========================================================
function parseRoute() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') };
}
const go = h => { const t = h.startsWith('#') ? h : '#' + h; if (location.hash === t) render(); else location.hash = t; };
window.addEventListener('hashchange', () => { render(); scrollTo(0, 0); });

function render() {
  document.querySelectorAll('.overlay').forEach(o => o.remove());
  const { parts, q } = parseRoute();
  const [a, b, c] = parts;
  if (a === 'join' && b) { localStorage.setItem('shodim-join', b); }
  if (!S.session && !S.demo) return renderLogin();
  if (!S.space) return renderOnboarding();
  if (a === 'join') return go('/');
  if (a === 'g' && b) return renderGroup(b, q);
  if (a === 'p' && b && c === 'edit') return renderForm(b, q);
  if (a === 'p' && b) return renderPlace(b);
  if (a === 'new') return renderForm(null, q);
  if (a === 'album') return renderAlbum(q);
  if (a === 'travel') return renderTravel();
  if (a === 'invite') return renderInvite();
  renderHome();
}

const $ = sel => app.querySelector(sel);
const on = (sel, ev, fn, root = app) => root.querySelectorAll(sel).forEach(el => el.addEventListener(ev, e => fn(e, el)));
function bindCommon(root = app) {
  on('[data-go]', 'click', (e, el) => {
    if (el.dataset.lp === '1') { delete el.dataset.lp; e.preventDefault(); return; }
    go(el.dataset.go);
  }, root);
  on('[data-act=add]', 'click', () => addPlace(), root);
}
function longPress(el, fn) {
  let t = null, x = 0, y = 0;
  const clear = () => { clearTimeout(t); t = null; };
  el.addEventListener('pointerdown', e => {
    x = e.clientX; y = e.clientY;
    t = setTimeout(() => {
      el.dataset.lp = '1'; el.classList.add('pressed'); navigator.vibrate?.(15);
      setTimeout(() => { delete el.dataset.lp; }, 900);
      fn(() => el.classList.remove('pressed'));
    }, 480);
  });
  el.addEventListener('pointermove', e => { if (Math.abs(e.clientX - x) + Math.abs(e.clientY - y) > 10) clear(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, clear));
  el.addEventListener('contextmenu', e => e.preventDefault());
}
function addPlace() {
  const gid = S.ctxGroup || cities()[0]?.id || S.groups[0]?.id;
  if (!gid) { toast('Сначала создайте группу'); return groupSheet(null, 'city'); }
  go('#/new?g=' + gid);
}
const navHTML = active => `<div class="fade"></div><nav class="nav">
  <button class="item ${active === 'p' ? 'on' : ''}" data-go="#/">${icon('map', 24)}Места</button>
  <button class="plus" data-act="add" aria-label="Добавить место">${icon('plus', 26)}</button>
  <button class="item ${active === 'a' ? 'on' : ''}" data-go="#/album">${icon('album', 24)}Альбом</button></nav>`;

// =========================================================
// Вход и первый запуск
// =========================================================
const hillsSVG = `<svg class="hills" viewBox="0 0 360 140" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="30" cy="150" rx="210" ry="100" fill="#D3E0C9" fill-opacity=".7"/><ellipse cx="340" cy="160" rx="190" ry="90" fill="#F6D3BF" fill-opacity=".7"/></svg>`;

function renderLogin() {
  const L = S.login;
  app.innerHTML = `<div class="welcome compact">
    <div class="stack-m center">
      <img class="appicon" src="icons/icon-512.png" alt="">
      <div class="col" style="gap:4px;padding-top:8px"><span class="hand-m accent">привет!</span><h1 class="h1">Сходим?</h1>
      <p class="t-body muted" style="margin:4px 0 0">Общий список мест, куда хотим сходить вдвоём, и альбом тех, где уже были.</p></div>
    </div>
    <form class="stack-s" data-form>
      <input class="input white" type="email" name="email" placeholder="Почта" autocomplete="email" required value="${esc(L.email)}">
      <label class="input white" style="padding-right:8px">
        <input type="password" name="password" placeholder="${L.step === 'signup' ? 'Придумайте пароль (от 6 символов)' : 'Пароль'}" minlength="6" required
          autocomplete="${L.step === 'signup' ? 'new-password' : 'current-password'}">
        <button type="button" class="eye" data-eye aria-label="Показать пароль">${icon('eye')}</button></label>
      <button class="btn" type="submit">${L.step === 'signup' ? 'Создать аккаунт' : 'Войти'}</button>
      <button class="link-btn" type="button" data-other>${L.step === 'signup' ? 'Уже есть аккаунт? Войти' : 'Впервые здесь? Создать аккаунт'}</button>
    </form>${hillsSVG}</div>`;
  const form = $('[data-form]');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('.btn'); btn.disabled = true;
    L.email = form.email.value.trim();
    const creds = { email: L.email, password: form.password.value };
    try {
      const { data, error } = L.step === 'signup' ? await sb.auth.signUp(creds) : await sb.auth.signInWithPassword(creds);
      if (error) throw error;
      if (!data.session) throw new Error('confirm-required');
      await setSession(data.session);
    } catch (err) { handleErr(err); btn.disabled = false; }
  });
  form.querySelector('[data-eye]').addEventListener('click', e => {
    const b = e.currentTarget, inp = form.password, show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    b.innerHTML = icon(show ? 'eyeOff' : 'eye');
    b.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
  });
  form.querySelector('[data-other]').addEventListener('click', () => {
    L.email = form.email.value.trim();
    L.step = L.step === 'signup' ? 'login' : 'signup'; renderLogin();
  });
}

function renderOnboarding() {
  const O = S.onboard;
  const pending = localStorage.getItem('shodim-join');
  if (pending && O.mode === 'create' && !O.touched) O.mode = 'join';
  const name = localStorage.getItem('shodim-name') || '';
  app.innerHTML = `<div class="welcome compact">
    <div class="stack-m center">
      <img class="appicon" src="icons/icon-512.png" alt="">
      <div class="col" style="gap:4px;padding-top:8px"><span class="hand-m accent">${O.mode === 'join' ? 'вас уже ждут' : 'добро пожаловать'}</span>
      <h1 class="h2">${O.mode === 'join' ? 'Присоединиться к списку' : 'Давайте начнём'}</h1></div>
    </div>
    <form class="stack-m" data-form>
      <div class="field"><label>Как тебя зовут?</label><input class="input white" name="name" placeholder="Имя" required value="${esc(name)}" autocomplete="given-name"></div>
      ${O.mode === 'join' ? `<div class="field"><label>Код приглашения</label><input class="input white" name="code" placeholder="Например, ZRN-482" required value="${esc(pending || '')}" style="text-transform:uppercase;letter-spacing:.1em"></div>
        <button class="btn" type="submit">Присоединиться</button>
        <button class="link-btn" type="button" data-switch>Создать свой список</button>`
      : `<button class="btn" type="submit">Создать наш список</button>
        <button class="btn ghost" type="button" data-switch>У меня есть код приглашения</button>`}
      <button class="link-btn" type="button" data-logout>Выйти</button>
    </form>${hillsSVG}</div>`;
  const form = $('[data-form]');
  form.querySelector('[data-switch]').addEventListener('click', () => { O.touched = true; O.mode = O.mode === 'join' ? 'create' : 'join'; renderOnboarding(); });
  form.querySelector('[data-logout]').addEventListener('click', () => sb.auth.signOut());
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('.btn'); btn.disabled = true;
    const nm = form.name.value.trim();
    localStorage.setItem('shodim-name', nm);
    try {
      if (O.mode === 'join') {
        const { data, error } = await sb.rpc('join_space', { p_code: form.code.value, p_display_name: nm });
        if (error) throw error;
        localStorage.removeItem('shodim-join');
        S.space = data; await loadAll(); subscribe(); go('/');
        toast('Вы в общем списке!');
      } else {
        const { data, error } = await sb.rpc('create_space', { p_name: 'Наш список', p_display_name: nm });
        if (error) throw error;
        S.space = data;
        await ins('groups', { name: 'Минск', kind: 'city', cover_color: 'peach', sort_order: 0 });
        await ins('groups', { name: 'Брест', kind: 'city', cover_color: 'sage', sort_order: 1 });
        await loadAll(); subscribe(); go('#/invite');
      }
    } catch (err) { handleErr(err); btn.disabled = false; }
  });
}

// =========================================================
// Главная
// =========================================================
const AV_COLORS = ['peach', 'sage', 'rose', 'sky'];
function avatarsHTML() {
  const list = S.members.map((m, i) => `<span class="avatar" style="background:var(--${AV_COLORS[i % 4]})">${esc(initial(m.display_name))}</span>`);
  if (S.members.length < 2) list.push(`<span class="avatar add">+</span>`);
  return list.join('');
}
function groupCardHTML(g) {
  const c = counts(g.id);
  return `<button class="card gcard" data-gid="${g.id}" data-go="#/g/${g.id}">
    ${photo(url(g.cover_path), g.cover_color || hashKey(g.id))}
    <span class="cap"><span class="t-card">${esc(g.name)}</span><span class="t-sub">${c.want} хотим · ${c.been} были</span></span></button>`;
}
function renderHome() {
  S.ctxGroup = null;
  const been = S.places.filter(isBeen).length, want = S.places.filter(p => !isBeen(p)).length;
  const ts = trips();
  app.innerHTML = `<div class="screen">
    <div class="head"><div class="col"><span class="hand-m accent">привет, это мы</span><h1 class="h1">Сходим?</h1></div>
      <button class="avatars" data-go="#/invite" aria-label="Участники">${avatarsHTML()}</button></div>
    <div class="card counter"><div class="num">${been}</div><div class="col grow">
      <span class="t-bold">${plural(been, 'место', 'места', 'мест')}, где мы уже были вместе</span>
      <span class="t-sub">${want ? `и ещё ${want} ${plural(want, 'ждёт', 'ждут', 'ждут')} нас в планах` : 'добавьте места, куда хотите сходить'}</span></div></div>
    <div class="row between"><h2 class="t-sec">Наши группы</h2><button class="t-bold accent" data-act="new-group">+ новая</button></div>
    <div class="stack-s">
      ${cities().length ? `<div class="grid2">${cities().map(groupCardHTML).join('')}</div>` : ''}
      <button class="card gcard wide" data-go="#/travel">
        ${photo(ts[0] ? url(ts[0].cover_path) : null, ts[0]?.cover_color || 'sky')}
        <span class="cap"><span class="t-card">Путешествия</span>
        <span class="t-sub">${ts.length ? `${ts.length} ${plural(ts.length, 'поездка', 'поездки', 'поездок')}` : 'пока без поездок — можно помечтать'}</span>
        ${ts.length ? `<span class="chips" style="padding-top:8px">${ts.slice(0, 3).map(t => `<span class="chip paper">${esc(t.name)}</span>`).join('')}</span>` : ''}</span></button>
    </div></div>${navHTML('p')}`;
  bindCommon();
  on('[data-act=new-group]', 'click', () => groupSheet(null, 'city'));
  app.querySelectorAll('.gcard[data-gid]').forEach(el => longPress(el, done => groupMenu(groupById(el.dataset.gid), done)));
}

// =========================================================
// Группа
// =========================================================
function tripStatus(g) {
  if (g.trip_status === 'done') return { text: 'съездили', cls: 'butter' };
  if (g.trip_start) {
    const d = parseISO(g.trip_start);
    return { text: `${MONTHS_NOM[d.getMonth()]} ${d.getFullYear()}`, cls: 'sage' };
  }
  if (g.trip_status === 'planned') return { text: 'в планах', cls: 'sage' };
  return { text: 'мечтаем', cls: '' };
}
function placeCardHTML(p, tab) {
  const vs = visitsOf(p.id);
  const meta = tab === 'been' && vs.length
    ? `${vs.length} ${plural(vs.length, 'раз', 'раза', 'раз')} · ${fmtDayMonth(vs[0].visited_on)}`
    : ((p.tags || []).join(' · ') || (isUrl(p.address) ? '' : p.address) || '');
  const badge = p.want_again && vs.length ? `<span class="badge">${icon('heartF', 14)}снова</span>` : '';
  return `<button class="pcard" data-pid="${p.id}" data-go="#/p/${p.id}">${photo(placeImg(p), hashKey(p.id), { inner: badge })}
    <span class="col"><span class="t-cards">${esc(p.name)}</span>${meta ? `<span class="t-sub">${esc(meta)}</span>` : ''}</span></button>`;
}
function emptyGroupHTML() {
  return `<div class="empty"><div class="frame">
    <svg width="48" height="60" viewBox="0 0 36 46" aria-hidden="true"><path d="M18 44S3 31 3 18.5A15 15 0 0 1 33 18.5C33 31 18 44 18 44Z" fill="#D9826B"/><circle cx="18" cy="18" r="5.5" fill="#fff"/></svg>
    <span class="hand-s muted">тут будет первое место</span></div>
    <div class="stack-xs"><h2 class="h2">Пока пусто</h2><p class="t-body muted" style="margin:0">Добавьте место, куда хотите сходить: ссылку из инсты, адрес или просто название.</p></div>
    <button class="btn" data-act="add">Добавить место</button></div>`;
}
function renderGroup(id, q) {
  const g = groupById(id);
  if (!g) return go('/');
  if (S.ctxGroup !== id) S.gfilter = { q: '', tag: null };
  S.ctxGroup = id;
  const tab = q.get('tab') === 'been' ? 'been' : 'want';
  const ps = placesIn(id);
  const want = ps.filter(isWant), been = ps.filter(isBeen).sort((a, b) => lastVisit(b).localeCompare(lastVisit(a)));
  const list = tab === 'want' ? want : been;
  // теги — только тех мест, что есть в открытой вкладке
  const tags = [...new Set(list.flatMap(p => p.tags || []))];
  if (S.gfilter.tag && !tags.includes(S.gfilter.tag)) S.gfilter.tag = null;
  const st = g.kind === 'trip' ? tripStatus(g) : null;
  app.innerHTML = `<div class="screen">
    <div class="head"><div class="title"><button class="round" data-go="${g.kind === 'trip' ? '#/travel' : '#/'}" aria-label="Назад">${icon('back')}</button><h1 class="h1">${esc(g.name)}</h1></div>
      <div class="acts"><button class="round peach" data-act="dice" aria-label="Случайное место">${icon('dice')}</button><button class="round" data-act="more" aria-label="Ещё">${icon('more')}</button></div></div>
    ${st ? `<div class="chips"><span class="chip ${st.cls || ''}">${esc(st.text)}</span></div>` : ''}
    <div class="segmented"><button class="${tab === 'want' ? 'on' : ''}" data-go="#/g/${id}">Хотим · ${want.length}</button><button class="${tab === 'been' ? 'on' : ''}" data-go="#/g/${id}?tab=been">Были · ${been.length}</button></div>
    ${ps.length ? `<label class="input white">${icon('search', 20)}<input type="search" placeholder="Найти место" value="${esc(S.gfilter.q)}" data-search></label>
      ${tags.length ? `<div class="chips" data-tags></div>` : ''}` : ''}
    <div data-list></div></div>${navHTML('p')}`;
  bindCommon();
  const drawTags = () => {
    const box = $('[data-tags]'); if (!box) return;
    box.innerHTML = [`<button class="chip ${!S.gfilter.tag ? 'active' : ''}" data-tag="">Все</button>`, ...tags.map(t => `<button class="chip ${S.gfilter.tag === t ? 'active' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`)].join('');
    on('[data-tag]', 'click', (e, el) => { S.gfilter.tag = el.dataset.tag || null; drawTags(); drawList(); }, box);
  };
  const drawList = () => {
    const box = $('[data-list]');
    if (!ps.length) { box.innerHTML = emptyGroupHTML(); bindCommon(box); return; }
    const qq = S.gfilter.q.toLowerCase();
    const items = list.filter(p => (!S.gfilter.tag || (p.tags || []).includes(S.gfilter.tag)) &&
      (!qq || [p.name, p.note, p.address, ...(p.tags || [])].join(' ').toLowerCase().includes(qq)));
    if (!items.length) {
      const msg = qq || S.gfilter.tag ? 'Ничего не нашлось' : tab === 'want' ? 'Все места отсюда уже посещены — можно добавить новые' : 'Здесь вы ещё нигде не были — самое время сходить!';
      box.innerHTML = `<p class="t-sub center" style="margin:24px 0">${msg}</p>`; return;
    }
    box.innerHTML = `<div class="grid2">${items.map(p => placeCardHTML(p, tab)).join('')}</div>`;
    bindCommon(box);
    box.querySelectorAll('.pcard').forEach(el => longPress(el, done => placeMenu(placeById(el.dataset.pid), done)));
  };
  drawTags(); drawList();
  $('[data-search]')?.addEventListener('input', e => { S.gfilter.q = e.target.value; drawList(); });
  on('[data-act=dice]', 'click', () => {
    const pool = want.length ? want : ps;
    if (!pool.length) return toast('Пока не из чего выбирать');
    const p = pool[Math.floor(Math.random() * pool.length)];
    toast('Сходим сюда? 🎲'); go('#/p/' + p.id);
  });
  on('[data-act=more]', 'click', () => groupMenu(g));
}

// =========================================================
// Путешествия
// =========================================================
function renderTravel() {
  S.ctxGroup = null;
  const ts = trips();
  app.innerHTML = `<div class="screen">
    <div class="head"><div class="title"><button class="round" data-go="#/" aria-label="Назад">${icon('back')}</button>
      <div class="col"><h1 class="h1">Путешествия</h1><span class="hand-m accent" style="font-size:22px;line-height:24px">мечтаем и планируем</span></div></div></div>
    ${ts.map(t => {
      const st = tripStatus(t), n = placesIn(t.id).length;
      return `<button class="card trip" data-go="#/g/${t.id}">${photo(url(t.cover_path), t.cover_color || hashKey(t.id), { inner: `<span class="status" style="${st.cls ? `background:var(--${st.cls})` : ''}">${esc(st.text)}</span>` })}
        <span class="row between" style="padding:0 8px"><span class="t-sec">${esc(t.name)}</span><span class="t-sub">${n} ${plural(n, 'место', 'места', 'мест')}</span></span></button>`;
    }).join('')}
    ${ts.length ? '' : `<p class="t-body muted center" style="margin:16px 0 0">Здесь будут поездки — и те, о которых пока мечтаем, и уже запланированные.</p>`}
    <button class="dashed" data-act="new-trip">${icon('plus', 20)}Новая поездка</button>
  </div>${navHTML('p')}`;
  bindCommon();
  on('[data-act=new-trip]', 'click', () => groupSheet(null, 'trip'));
}

// =========================================================
// Карточка места
// =========================================================
function instaInfo(raw) {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s)) {
    const m = s.match(/instagram\.com\/([^/?#]+)/i);
    const h = m && !['p', 'reel', 'reels', 'stories', 'explore'].includes(m[1]) ? m[1] : null;
    return { href: s, label: h ? '@' + h : 'открыть в Instagram' };
  }
  const h = s.replace(/^@/, '');
  return { href: 'https://instagram.com/' + encodeURIComponent(h), label: '@' + h };
}
// В поле «Адрес» могут вставить ссылку на карту — тогда показываем её коротко и открываем как есть
const isUrl = s => /^https?:\/\//i.test((s || '').trim());
function mapLabel(s) {
  let h = ''; try { h = new URL(s.trim()).hostname; } catch { /* не ссылка */ }
  if (/yandex|ya\.ru/.test(h)) return 'Яндекс Карты';
  if (/google|goo\.gl/.test(h)) return 'Google Карты';
  if (/2gis/.test(h)) return '2ГИС';
  return 'Открыть на карте';
}
// Координаты из ссылки Яндекс/Google Карт — пригодятся для карты мест
function parseCoords(s) {
  try {
    const u = new URL(s.trim());
    const pt = u.searchParams.get('poi[point]') || u.searchParams.get('pt') || u.searchParams.get('ll'); // Яндекс: «долгота,широта»
    if (pt) { const [lng, lat] = pt.split(',').map(Number); if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }; }
    const m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&](?:q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/); // Google: «широта,долгота»
    if (m) return { lat: +m[1], lng: +m[2] };
  } catch { /* не ссылка */ }
  return null;
}
function mapHref(p) {
  if (isUrl(p.address)) return p.address.trim();
  if (p.lat != null && p.lng != null) return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
  const g = groupById(p.group_id);
  const qtxt = p.address + (g && g.kind === 'city' ? ', ' + g.name : '');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(qtxt);
}
function renderPlace(id) {
  const p = placeById(id);
  if (!p) return go('/');
  S.ctxGroup = p.group_id;
  const g = groupById(p.group_id), vs = visitsOf(p.id);
  const ig = p.instagram ? instaInfo(p.instagram) : null;
  const backTo = `#/g/${p.group_id}${vs.length && !p.want_again ? '?tab=been' : ''}`;
  app.innerHTML = `<div class="hero">${photo(placeImg(p), hashKey(p.id))}
      <div class="bar"><button class="round shadow" data-go="${backTo}" aria-label="Назад">${icon('back')}</button>
      <div class="acts"><button class="round shadow" data-act="heart" aria-label="Хотим снова" style="color:var(--accent)">${icon(p.want_again ? 'heartF' : 'heart')}</button>
      <button class="round shadow" data-act="more" aria-label="Ещё">${icon('more')}</button></div></div></div>
    <div class="sheetlike">
      <div class="chips">${(p.tags || []).map(t => `<span class="chip peach">${esc(t)}</span>`).join('')}${g ? `<span class="chip sage">${esc(g.name)}</span>` : ''}${vs.length ? `<span class="chip butter">были ${vs.length} ${plural(vs.length, 'раз', 'раза', 'раз')}</span>` : ''}</div>
      <h1 class="h2">${esc(p.name)}</h1>
      ${ig || p.address ? `<div class="card info">
        ${ig ? `<a class="irow" href="${esc(ig.href)}" target="_blank" rel="noopener"><span class="bubble" style="background:var(--rose)">${icon('insta', 20)}</span><span class="col grow"><span class="t-sub">Instagram</span><span class="t-bold">${esc(ig.label)}</span></span><span class="ext">${icon('ext', 20)}</span></a>` : ''}
        ${ig && p.address ? '<hr>' : ''}
        ${p.address ? `<a class="irow" href="${esc(mapHref(p))}" target="_blank" rel="noopener"><span class="bubble" style="background:var(--sage)">${icon('pin', 20)}</span><span class="col grow"><span class="t-sub">${isUrl(p.address) ? 'Карта' : 'Адрес'}</span><span class="t-bold">${esc(isUrl(p.address) ? mapLabel(p.address) : p.address)}</span></span><span class="ext">${icon('ext', 20)}</span></a>` : ''}
      </div>` : ''}
      ${p.note ? `<div class="note"><div class="hand-m">заметка</div><div class="t-body">${esc(p.note)}</div></div>` : ''}
      <div class="row" style="gap:8px"><h2 class="t-sec">Наши визиты</h2>${vs.length ? `<span class="t-sec muted">${vs.length}</span>` : ''}</div>
      ${vs.length ? vs.map(v => `<button class="card visit" data-vid="${v.id}">${photo(visitImg(v), hashKey(v.id))}
        <span class="col grow"><span class="t-bold">${fmtDate(v.visited_on)}</span>${v.note ? `<span class="t-sub">${esc(v.note)}</span>` : ''}</span></button>`).join('')
        : `<p class="t-sub" style="margin:0">Ещё не были. Когда сходите — нажмите кнопку внизу и добавьте дату и фото.</p>`}
    </div>
    <div class="fade"></div>
    <button class="btn cta" data-act="visit">${icon('check')}Мы тут были!</button>`;
  bindCommon();
  on('[data-act=heart]', 'click', async () => {
    try { await upd('places', p.id, { want_again: !p.want_again }); toast(p.want_again ? 'Отметили: хотим сюда снова' : 'Убрали из «хотим снова»'); renderPlace(id); }
    catch (e) { handleErr(e); }
  });
  on('[data-act=more]', 'click', () => placeMenu(p));
  on('[data-act=visit]', 'click', () => visitSheet(p, null));
  on('[data-vid]', 'click', (e, el) => visitSheet(p, S.visits.find(v => v.id === el.dataset.vid)));
}

// =========================================================
// Форма места (новое / изменить)
// =========================================================
function renderForm(id, q) {
  const p = id ? placeById(id) : null;
  if (id && !p) return go('/');
  if (!S.groups.length) { toast('Сначала создайте группу'); return go('/'); }
  const F = {
    name: p?.name || '', group_id: p?.group_id || q.get('g') || cities()[0]?.id || S.groups[0].id,
    tags: [...(p?.tags || [])], instagram: p?.instagram || '', address: p?.address || '', note: p?.note || '',
    coverFile: null, coverUrl: null, coverRemoved: false,
  };
  const suggestions = () => [...new Set([...allTags(), ...F.tags, ...(allTags().length ? [] : ['кафе', 'выставки', 'природа', 'на выходные'])])];
  const coverSrc = () => F.coverUrl || (!F.coverRemoved && p?.cover_path ? url(p.cover_path) : null);
  const groupOptions = () => {
    const opt = g => `<option value="${g.id}" ${g.id === F.group_id ? 'selected' : ''}>${esc(g.name)}</option>`;
    return `${cities().length ? `<optgroup label="Города">${cities().map(opt).join('')}</optgroup>` : ''}${trips().length ? `<optgroup label="Путешествия">${trips().map(opt).join('')}</optgroup>` : ''}`;
  };
  app.innerHTML = `<div class="screen page">
    <div class="head"><div class="title"><button class="round" data-act="back" aria-label="Назад">${icon('back')}</button><h1 class="h2">${p ? 'Изменить место' : 'Новое место'}</h1></div></div>
    <div class="field"><span class="label">Фото</span><div data-cover></div></div>
    <div class="field"><label for="f-name">Название</label><input id="f-name" class="input" data-f="name" placeholder="Например, кофейня «Зерно»" value="${esc(F.name)}"></div>
    <div class="field"><label>Группа</label><label class="input"><select data-f="group_id">${groupOptions()}</select>${icon('down', 20)}</label></div>
    <div class="field"><span class="label">Теги</span><div class="chips" data-tags></div></div>
    <div class="field"><label>Instagram</label><label class="input">${icon('insta', 20)}<input data-f="instagram" placeholder="@place или ссылка" value="${esc(F.instagram)}" autocapitalize="off"></label></div>
    <div class="field"><label>Адрес</label><label class="input">${icon('pin', 20)}<input data-f="address" placeholder="Улица, дом или ссылка на карту" value="${esc(F.address)}"></label></div>
    <div class="field"><label>Заметка</label><textarea class="input" data-f="note" rows="3" placeholder="Что там интересного, когда лучше идти…">${esc(F.note)}</textarea></div>
  </div><div class="fade"></div><button class="btn cta" data-act="save">${p ? 'Сохранить' : 'Добавить место'}</button>`;
  on('[data-f]', 'input', (e, el) => { F[el.dataset.f] = el.value; });
  on('[data-f]', 'change', (e, el) => { F[el.dataset.f] = el.value; });
  on('[data-act=back]', 'click', () => go(p ? '#/p/' + p.id : '#/g/' + F.group_id));
  const drawCover = () => {
    const box = $('[data-cover]'), src = coverSrc();
    box.innerHTML = photo(src, hashKey(p?.id || 'new'), { style: 'height:150px', inner: `<div class="row" style="position:absolute;right:10px;bottom:10px;gap:8px;z-index:1">
      ${src ? `<button class="chip" data-rm style="box-shadow:var(--shadow)">убрать</button>` : ''}
      <label class="chip" style="box-shadow:var(--shadow);cursor:pointer">${src ? 'сменить фото' : 'добавить фото'}<input type="file" accept="image/*" hidden data-file></label></div>` });
    box.querySelector('[data-file]').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      F.coverFile = f; F.coverUrl = URL.createObjectURL(f); drawCover();
    });
    box.querySelector('[data-rm]')?.addEventListener('click', () => { F.coverFile = null; F.coverUrl = null; F.coverRemoved = true; drawCover(); });
  };
  const drawTags = () => {
    const box = $('[data-tags]');
    box.innerHTML = suggestions().map(t => `<button class="chip ${F.tags.includes(t) ? 'active' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')
      + `<button class="chip" data-newtag>+ новый тег</button>`;
    on('[data-tag]', 'click', (e, el) => { const t = el.dataset.tag; F.tags = F.tags.includes(t) ? F.tags.filter(x => x !== t) : [...F.tags, t]; drawTags(); }, box);
    box.querySelector('[data-newtag]').addEventListener('click', e => {
      const inp = document.createElement('input');
      inp.className = 'chip'; inp.placeholder = 'тег'; inp.style.cssText = 'width:120px;border:0;outline:2px solid var(--peach)';
      e.currentTarget.replaceWith(inp); inp.focus();
      const add = () => { const t = inp.value.trim().toLowerCase(); if (t && !F.tags.includes(t)) F.tags.push(t); drawTags(); };
      inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); add(); } });
      inp.addEventListener('blur', add);
    });
  };
  drawCover(); drawTags();
  on('[data-act=save]', 'click', async (e, btn) => {
    if (!F.name.trim()) { toast('Напишите название места'); $('#f-name').focus(); return; }
    btn.disabled = true; btn.textContent = 'Сохраняем…';
    try {
      const row = { name: F.name.trim(), group_id: F.group_id, tags: F.tags, instagram: F.instagram.trim() || null, address: F.address.trim() || null, note: F.note.trim() || null };
      if (!p || row.address !== (p.address || null)) { const c = isUrl(row.address) ? parseCoords(row.address) : null; row.lat = c?.lat ?? null; row.lng = c?.lng ?? null; }
      const oldCover = p?.cover_path;
      if (F.coverFile) row.cover_path = await uploadPhoto(F.coverFile);
      else if (F.coverRemoved) row.cover_path = null;
      let saved;
      if (p) { await upd('places', p.id, row); saved = p; } else saved = await ins('places', row);
      if ((F.coverFile || F.coverRemoved) && oldCover) await removeFiles([oldCover]);
      await signUrls();
      toast(p ? 'Сохранено' : 'Место добавлено');
      go('#/p/' + saved.id);
    } catch (err) { handleErr(err); btn.disabled = false; btn.textContent = p ? 'Сохранить' : 'Добавить место'; }
  });
}

// =========================================================
// Альбом
// =========================================================
const TAPES = ['--butter', '--rose', '--sage', '--sky'];
const TILT = [-3, 2.5, -2, 3.5];
function polaroidHTML(v, i) {
  const p = placeById(v.place_id);
  const name = p?.name || '';
  const short = name.match(/[«"]([^»"]+)[»"]/)?.[1] || name; // «Зерно» вместо «Кофейня «Зерно»»
  return `<button class="polaroid" data-go="#/p/${v.place_id}" style="transform:rotate(${TILT[i % 4]}deg)">
    <span class="tape" style="background:var(${TAPES[i % 4]})"></span>
    ${photo(visitImg(v), hashKey(v.id))}<span class="hand-s"><span class="nm">${esc(short)}</span>, ${fmtShort(v.visited_on)}</span></button>`;
}
function renderAlbum(q) {
  S.ctxGroup = null;
  const f = q.get('f') || 'all';
  const inFilter = v => {
    if (f === 'all') return true;
    const g = groupById(placeById(v.place_id)?.group_id);
    if (!g) return false;
    return f === 'travel' ? g.kind === 'trip' : g.id === f;
  };
  const all = [...S.visits].sort((a, b) => b.visited_on.localeCompare(a.visited_on));
  const vs = all.filter(inFilter);
  const months = [];
  for (const v of vs) { const k = v.visited_on.slice(0, 7); let m = months.find(x => x.k === k); if (!m) months.push(m = { k, items: [] }); m.items.push(v); }
  const chips = [['all', 'Все'], ...cities().map(g => [g.id, g.name]), ...(trips().length ? [['travel', 'Путешествия']] : [])];
  app.innerHTML = `<div class="screen">
    <div class="col"><span class="hand-m accent">наши воспоминания</span><h1 class="h1">Альбом</h1></div>
    ${all.length ? `<div class="chips">${chips.map(([k, n]) => `<button class="chip ${f === k ? 'active' : ''}" data-go="#/album${k === 'all' ? '' : '?f=' + k}">${esc(n)}</button>`).join('')}</div>` : ''}
    ${!all.length ? `<div class="empty">
        <div class="polaroid" style="width:160px;transform:rotate(-4deg)"><span class="tape" style="background:var(--butter)"></span>
          <div class="ph" style="background:var(--paper);border:1.5px dashed var(--dash)"></div><span class="hand-s">скоро здесь…</span></div>
        <div class="stack-xs"><h2 class="h2">Здесь будут воспоминания</h2><p class="t-body muted" style="margin:0">Отметьте место, где были вместе, — фото и дата сразу появятся в альбоме.</p></div>
        <button class="btn" data-go="#/">К нашим местам</button></div>`
      : !vs.length ? `<p class="t-sub center" style="margin:24px 0">Здесь пока нет визитов</p>`
      : months.map(m => `<div class="month"><div class="mh"><span class="hand-l">${fmtMonth(m.k)}</span><span class="t-sub">${m.items.length} ${plural(m.items.length, 'визит', 'визита', 'визитов')}</span></div>
          <div class="board">${m.items.map(polaroidHTML).join('')}</div></div>`).join('')}
  </div>${navHTML('a')}`;
  bindCommon();
}

// =========================================================
// Приглашение
// =========================================================
function renderInvite() {
  const code = S.space.invite_code || '';
  const pretty = code.length === 6 ? code.slice(0, 3) + '-' + code.slice(3) : code;
  const link = `${location.origin}${location.pathname}#/join/${code}`;
  const two = S.members.length >= 2;
  app.innerHTML = `<div class="welcome" style="padding-top:var(--top)">
    <div class="stack-m">
      <div class="head"><button class="round" data-go="#/" aria-label="Назад">${icon('back')}</button></div>
      <div class="row" style="justify-content:center;gap:10px">${S.members.map((m, i) => `<span class="avatar" style="width:72px;height:72px;font-size:20px;background:var(--${AV_COLORS[i % 4]})">${esc(initial(m.display_name))}</span>`).join('<span class="t-sec accent">···</span>')}
        ${two ? '' : `<span class="t-sec accent">···</span><span class="avatar add" style="width:72px;height:72px;font-size:24px">+</span>`}</div>
      <div class="col center" style="gap:4px"><span class="hand-m accent">${two ? 'нас уже двое' : 'почти готово'}</span>
        <h1 class="h2">${two ? S.members.map(m => esc(m.display_name || '?')).join(' и ') : 'Кого берём с собой?'}</h1>
        <p class="t-body muted" style="margin:4px 0 0">${two ? 'Код пригодится, если войдёте с нового телефона.' : 'Отправьте ссылку — после входа у вас будет один общий список мест и альбом.'}</p></div>
      <div class="card stack-xs center" style="padding:20px;align-items:center"><span class="t-sub">${two ? 'код вашего списка' : 'или продиктуйте код'}</span><span class="code">${esc(pretty)}</span>
        <button class="chip paper" data-act="copy">скопировать</button></div>
    </div>
    <div class="stack-s">
      ${two ? `<button class="btn" data-go="#/">К нашим местам</button>` : `<button class="btn" data-act="share">${icon('share')}Отправить ссылку</button><button class="link-btn" data-go="#/">Пропустить пока</button>`}
      <button class="link-btn" data-act="logout" style="font-size:15px">Выйти из аккаунта</button>
    </div>${hillsSVG}</div>`;
  bindCommon();
  const copy = async text => { try { await navigator.clipboard.writeText(text); toast('Скопировано'); } catch { toast(text); } };
  on('[data-act=copy]', 'click', () => copy(pretty));
  on('[data-act=share]', 'click', async () => {
    const text = `Присоединяйся к нашему списку мест «Сходим?» 💛 Код: ${pretty}`;
    if (navigator.share) { try { await navigator.share({ title: 'Сходим?', text, url: link }); } catch { /* отменили */ } }
    else copy(text + '\n' + link);
  });
  on('[data-act=logout]', 'click', async () => {
    if (S.demo) return toast('В демо-режиме выйти нельзя');
    if (await confirmDialog('Выйти из аккаунта?', 'Список и фото останутся — просто войдите снова по почте.', 'Выйти')) sb.auth.signOut();
  });
}

// =========================================================
// Шторки и диалоги
// =========================================================
function openSheet(html, { center = false, onClose } = {}) {
  const ov = document.createElement('div');
  ov.className = 'overlay' + (center ? ' mid' : '');
  ov.innerHTML = center ? `<div class="dialog">${html}</div>` : `<div class="sheet"><div class="handle"></div>${html}</div>`;
  document.body.appendChild(ov);
  const box = ov.firstElementChild;
  let closed = false;
  const close = () => { if (closed) return; closed = true; ov.remove(); onClose?.(); setTimeout(tryRefresh, 50); };
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  return { el: box, close };
}
function confirmDialog(title, text, okText = 'Удалить') {
  return new Promise(res => {
    let result = false;
    const { el, close } = openSheet(`<div class="stack-xs"><h2 class="h2">${esc(title)}</h2>${text ? `<p class="t-sub" style="margin:0">${esc(text)}</p>` : ''}</div>
      <div class="row"><button class="btn ghost on-card" data-no>Отмена</button><button class="btn" data-yes>${esc(okText)}</button></div>`, { center: true, onClose: () => res(result) });
    el.querySelector('[data-no]').onclick = () => close();
    el.querySelector('[data-yes]').onclick = () => { result = true; close(); };
  });
}
function actionsHTML(items) {
  return `<div class="actions">${items.map(([k, ic, t, danger]) => `<button class="action ${danger ? 'danger' : ''}" data-a="${k}"><span class="bubble">${icon(ic)}</span>${esc(t)}</button>`).join('')}</div>`;
}

// ----- Меню группы
function groupMenu(g, done) {
  const c = counts(g.id);
  const { el, close } = openSheet(`<div class="stack-xs"><h2 class="h2">${esc(g.name)}</h2><span class="t-sub">${c.want} хотим · ${c.been} были</span></div>
    ${actionsHTML([['edit', 'pencil', g.kind === 'trip' ? 'Изменить поездку' : 'Переименовать'], ['cover', 'image', 'Сменить обложку'], ['del', 'trash', g.kind === 'trip' ? 'Удалить поездку' : 'Удалить группу', true]])}`, { onClose: done });
  el.querySelector('[data-a=edit]').onclick = () => { close(); groupSheet(g); };
  el.querySelector('[data-a=cover]').onclick = () => { close(); groupSheet(g); };
  el.querySelector('[data-a=del]').onclick = () => { close(); deleteGroupDialog(g); };
}

// ----- Создание / изменение группы или поездки
function groupSheet(g, kind = 'city') {
  const G = {
    kind: g?.kind || kind, name: g?.name || '', color: g?.cover_color || (kind === 'trip' ? 'sky' : 'peach'),
    coverFile: null, coverUrl: null, coverRemoved: false,
    status: g?.trip_status || 'dream', start: g?.trip_start || '', end: g?.trip_end || '',
  };
  const { el, close } = openSheet('<div data-body class="stack-m" style="gap:20px"></div>');
  const body = el.querySelector('[data-body]');
  const hasPhoto = () => G.coverUrl || (!G.coverRemoved && g?.cover_path);
  const draw = () => {
    const trip = G.kind === 'trip';
    body.innerHTML = `<div class="stack-xs"><h2 class="h2">${g ? (trip ? 'Изменить поездку' : 'Изменить группу') : (trip ? 'Новая поездка' : 'Новая группа')}</h2>
        ${trip ? `<span class="t-sub">появится в «Путешествиях»</span>` : ''}</div>
      ${g ? '' : `<div class="segmented"><button class="${!trip ? 'on' : ''}" data-kind="city">Город</button><button class="${trip ? 'on' : ''}" data-kind="trip">Поездка</button></div>`}
      <div class="field"><label>Название</label><input class="input" data-name placeholder="${trip ? 'Например, Италия' : 'Например, Гродно'}" value="${esc(G.name)}"></div>
      ${trip ? `<div class="field"><span class="label">Когда</span><div class="chips">
          <button class="chip ${G.status === 'dream' ? 'active' : 'paper'}" data-st="dream">мечтаем</button>
          <button class="chip ${G.status === 'planned' ? 'active' : 'paper'}" data-st="planned">выбрать даты</button>
          <button class="chip ${G.status === 'done' ? 'active' : 'paper'}" data-st="done">съездили</button></div>
        ${G.status !== 'dream' ? `<div class="row"><label class="input grow"><span class="t-sub">с</span><input type="date" data-start value="${G.start}"></label><label class="input grow"><span class="t-sub">по</span><input type="date" data-end value="${G.end}"></label></div>` : `<span class="t-sub">Даты можно добавить позже, когда поездка станет реальной.</span>`}</div>` : ''}
      <div class="field"><span class="label">Обложка</span><div class="swatches">
        <label class="swatch photo ${hasPhoto() ? 'on' : ''}">${hasPhoto() ? `<img src="${esc(G.coverUrl || url(g.cover_path))}" alt="">` : icon('camera')}<input type="file" accept="image/*" hidden data-file></label>
        ${Object.entries(SWATCH).map(([k, c]) => `<button class="swatch ${!hasPhoto() && G.color === k ? 'on' : ''}" data-color="${k}" style="background:${c}">${!hasPhoto() && G.color === k ? icon('check', 24) : ''}</button>`).join('')}</div>
        <span class="t-sub">Можно выбрать цвет или поставить ваше фото.</span></div>
      <button class="btn" data-save>${g ? 'Сохранить' : trip ? 'Создать поездку' : 'Создать группу'}</button>`;
    body.querySelector('[data-name]').addEventListener('input', e => { G.name = e.target.value; });
    body.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { G.kind = b.dataset.kind; if (!g && !G.coverFile) G.color = G.kind === 'trip' ? 'sky' : 'peach'; draw(); });
    body.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { G.status = b.dataset.st; draw(); });
    body.querySelector('[data-start]')?.addEventListener('change', e => { G.start = e.target.value; });
    body.querySelector('[data-end]')?.addEventListener('change', e => { G.end = e.target.value; });
    body.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { G.color = b.dataset.color; G.coverFile = null; G.coverUrl = null; if (g?.cover_path) G.coverRemoved = true; draw(); });
    body.querySelector('[data-file]').addEventListener('change', e => { const f = e.target.files[0]; if (!f) return; G.coverFile = f; G.coverUrl = URL.createObjectURL(f); draw(); });
    body.querySelector('[data-save]').onclick = async e => {
      const btn = e.currentTarget;
      if (!G.name.trim()) return toast('Напишите название');
      btn.disabled = true;
      try {
        const row = { name: G.name.trim(), kind: G.kind, cover_color: G.color };
        if (G.kind === 'trip') Object.assign(row, { trip_status: G.status, trip_start: G.status === 'dream' ? null : (G.start || null), trip_end: G.status === 'dream' ? null : (G.end || null) });
        else Object.assign(row, { trip_status: null, trip_start: null, trip_end: null });
        const old = g?.cover_path;
        if (G.coverFile) row.cover_path = await uploadPhoto(G.coverFile);
        else if (G.coverRemoved) row.cover_path = null;
        if (g) await upd('groups', g.id, row);
        else await ins('groups', { ...row, sort_order: Math.max(0, ...S.groups.map(x => x.sort_order || 0)) + 1 });
        if ((G.coverFile || G.coverRemoved) && old) await removeFiles([old]);
        await signUrls();
        close(); render(); toast(g ? 'Сохранено' : G.kind === 'trip' ? 'Поездка создана' : 'Группа создана');
      } catch (err) { handleErr(err); btn.disabled = false; }
    };
  };
  draw();
}

// ----- Удаление группы
function deleteGroupDialog(g) {
  const n = placesIn(g.id).length;
  const others = S.groups.filter(x => x.id !== g.id);
  const D = { mode: n && others.length ? 'move' : 'delete', target: others[0]?.id };
  const { el, close } = openSheet('<div data-body class="stack-m" style="gap:20px"></div>', { center: true });
  const body = el.querySelector('[data-body]');
  const draw = () => {
    body.innerHTML = `<div class="stack-xs"><h2 class="h2">Удалить «${esc(g.name)}»?</h2>
      <p class="t-sub" style="margin:0">${n ? `В ${g.kind === 'trip' ? 'поездке' : 'группе'} ${n} ${plural(n, 'место', 'места', 'мест')}. Что с ними сделать?` : 'Внутри пока нет мест.'}</p></div>
      ${n ? `<div class="stack-m">
        ${others.length ? `<div class="radio ${D.mode === 'move' ? 'on' : ''}" role="button" tabindex="0" data-mode="move"><span class="dot"></span><span class="col grow" style="gap:8px"><span class="t-bold">Перенести в другую группу</span>
          ${D.mode === 'move' ? `<label class="input" style="height:48px"><select data-target>${others.map(o => `<option value="${o.id}" ${o.id === D.target ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>${icon('down', 20)}</label>` : ''}</span></div>` : ''}
        <div class="radio ${D.mode === 'delete' ? 'on' : ''}" role="button" tabindex="0" data-mode="delete"><span class="dot"></span><span class="col"><span class="t-bold">Удалить вместе с местами</span><span class="t-sub">и с их фото — вернуть не получится</span></span></div>
      </div>` : ''}
      <div class="row"><button class="btn ghost on-card" data-no>Отмена</button><button class="btn" data-yes>Удалить</button></div>`;
    body.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', e => { if (e.target.closest('label.input')) return; if (D.mode !== b.dataset.mode) { D.mode = b.dataset.mode; draw(); } }));
    body.querySelector('[data-target]')?.addEventListener('change', e => { D.target = e.target.value; });
    body.querySelector('[data-target]')?.addEventListener('click', e => e.stopPropagation());
    body.querySelector('[data-no]').onclick = close;
    body.querySelector('[data-yes]').onclick = async e => {
      e.currentTarget.disabled = true;
      try {
        await deleteGroup(g, n && D.mode === 'move' ? D.target : null);
        close(); toast('Удалено');
        go(g.kind === 'trip' ? '#/travel' : '#/');
      } catch (err) { handleErr(err); e.currentTarget.disabled = false; }
    };
  };
  draw();
}

// ----- Меню места
function placeMenu(p, done) {
  const g = groupById(p.group_id);
  const { el, close } = openSheet(`<div class="stack-xs"><h2 class="h2">${esc(p.name)}</h2><span class="t-sub">${esc([g?.name, ...(p.tags || [])].filter(Boolean).join(' · '))}</span></div>
    ${actionsHTML([['edit', 'pencil', 'Редактировать'], ['move', 'move', 'Переместить в другую группу'], ['del', 'trash', 'Удалить место', true]])}`, { onClose: done });
  el.querySelector('[data-a=edit]').onclick = () => { close(); go(`#/p/${p.id}/edit`); };
  el.querySelector('[data-a=move]').onclick = () => { close(); moveSheet(p); };
  el.querySelector('[data-a=del]').onclick = async () => {
    close();
    const n = visitsOf(p.id).length;
    if (!(await confirmDialog(`Удалить «${p.name}»?`, n ? `Вместе с ${n} ${plural(n, 'визитом', 'визитами', 'визитами')} и их фото. Вернуть не получится.` : 'Вернуть не получится.'))) return;
    try { const gid = p.group_id; await deletePlace(p); toast('Место удалено'); go('#/g/' + gid); } catch (e) { handleErr(e); }
  };
}
function moveSheet(p) {
  const { el, close } = openSheet(`<div class="stack-xs"><h2 class="h2">Куда перенести?</h2><span class="t-sub">${esc(p.name)}</span></div>
    <div class="stack-s">${S.groups.map(g => `<button class="radio ${g.id === p.group_id ? 'on' : ''}" data-g="${g.id}"><span class="dot"></span><span class="col"><span class="t-bold">${esc(g.name)}</span><span class="t-sub">${g.kind === 'trip' ? 'поездка' : 'город'}</span></span></button>`).join('')}</div>`);
  el.querySelectorAll('[data-g]').forEach(b => b.onclick = async () => {
    if (b.dataset.g === p.group_id) return close();
    try { await upd('places', p.id, { group_id: b.dataset.g }); close(); toast('Перенесли в «' + groupById(b.dataset.g).name + '»'); render(); }
    catch (e) { handleErr(e); }
  });
}

// ----- Визит: отметить / изменить
function visitSheet(p, v) {
  const V = {
    date: v?.visited_on || todayISO(), note: v?.note || '', want: !!p.want_again,
    keep: v ? photosOf(v.id).slice() : [], removed: [], added: [],
  };
  const { el, close } = openSheet('<div data-body class="stack-m" style="gap:20px"></div>');
  const body = el.querySelector('[data-body]');
  const draw = () => {
    body.innerHTML = `<div class="stack-xs"><h2 class="h2">${v ? 'Изменить визит' : 'Мы тут были!'}</h2><span class="t-sub">${esc(p.name)}${v ? '' : ` · визит №${visitsOf(p.id).length + 1}`}</span></div>
      <div class="field"><span class="label">Когда</span>
        <label class="input" style="position:relative"><span style="color:var(--accent)">${icon('cal')}</span><span class="t-bold grow">${fmtDate(V.date)}</span>${icon('down', 20)}
          <input type="date" data-date max="${todayISO()}" value="${V.date}" style="position:absolute;inset:0;opacity:0;width:100%"></label>
        <div class="chips">${[[0, 'сегодня'], [-1, 'вчера'], [-2, 'позавчера']].map(([d, t]) => `<button class="chip ${V.date === shiftDays(d) ? 'active' : 'paper'}" data-day="${d}">${t}</button>`).join('')}</div>
        <span class="t-sub">Можно выбрать любую прошедшую дату — даже если заполняете спустя время.</span></div>
      <div class="field"><span class="label">Фото</span><div class="thumbs">
        ${V.keep.map(f => `<div class="thumb">${photo(url(f.path), hashKey(f.id))}<button class="x" data-rm="${f.id}" aria-label="Убрать">${icon('close', 16)}</button></div>`).join('')}
        ${V.added.map((a, i) => `<div class="thumb">${photo(a.url, 'peach')}<button class="x" data-rmnew="${i}" aria-label="Убрать">${icon('close', 16)}</button></div>`).join('')}
        <label class="addtile">${icon('camera', 24)}добавить<input type="file" accept="image/*" multiple hidden data-file></label></div></div>
      <div class="field"><label>Пара слов</label><textarea class="input" data-note rows="3" placeholder="Как всё прошло?">${esc(V.note)}</textarea></div>
      <button class="row" data-want style="text-align:left"><span style="color:var(--accent)">${icon('heartF')}</span><span class="t-bold grow">Хотим сюда снова</span><span class="switch ${V.want ? 'on' : ''}"></span></button>
      <button class="btn" data-save>${v ? 'Сохранить' : 'Сохранить в альбом'}</button>
      ${v ? `<button class="link-btn danger" data-delete>Удалить визит</button>` : ''}`;
    const dateInp = body.querySelector('[data-date]');
    dateInp.addEventListener('change', e => { if (e.target.value) { V.date = e.target.value > todayISO() ? todayISO() : e.target.value; draw(); } });
    dateInp.addEventListener('click', () => { try { dateInp.showPicker(); } catch { /* старые браузеры */ } });
    body.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { V.date = shiftDays(+b.dataset.day); draw(); });
    body.querySelector('[data-note]').addEventListener('input', e => { V.note = e.target.value; });
    body.querySelector('[data-want]').onclick = () => { V.want = !V.want; draw(); };
    body.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { const f = V.keep.find(x => x.id === b.dataset.rm); V.keep = V.keep.filter(x => x !== f); V.removed.push(f); draw(); });
    body.querySelectorAll('[data-rmnew]').forEach(b => b.onclick = () => {
      const [a] = V.added.splice(+b.dataset.rmnew, 1);
      if (a?.row) V.removed.push(a.row); else if (a?.path) removeFiles([a.path]); // уже сохранённое после частичной ошибки — тоже убрать
      draw();
    });
    body.querySelector('[data-file]').addEventListener('change', e => { for (const f of e.target.files) V.added.push({ file: f, url: URL.createObjectURL(f) }); draw(); });
    body.querySelector('[data-save]').onclick = async e => {
      const btn = e.currentTarget; btn.disabled = true; btn.textContent = V.added.length ? 'Загружаем фото…' : 'Сохраняем…';
      try {
        // 1) сначала загружаем новые фото — если не вышло, визит не создаётся
        for (const a of V.added) if (!a.path) a.path = await uploadPhoto(a.file);
        // 2) визит: при повторном нажатии после ошибки — обновляем уже созданный, а не плодим новые
        let visit = v || V.created;
        const fields = { visited_on: V.date, note: V.note.trim() || null };
        if (visit) await upd('visits', visit.id, fields);
        else visit = V.created = await ins('visits', { place_id: p.id, ...fields });
        // 3) убранные и новые фото
        for (const f of V.removed) await del('visit_photos', f.id);
        await removeFiles(V.removed.map(f => f.path)); V.removed = [];
        let order = V.keep.length;
        for (const a of V.added) {
          if (!a.row) a.row = await ins('visit_photos', { visit_id: visit.id, path: a.path, sort_order: order });
          order++;
        }
        if (V.want !== !!p.want_again) await upd('places', p.id, { want_again: V.want });
        await signUrls();
        close(); render(); toast(v ? 'Сохранено' : 'Визит в альбоме 💛');
      } catch (err) { handleErr(err); btn.disabled = false; btn.textContent = 'Сохранить'; }
    };
    body.querySelector('[data-delete]')?.addEventListener('click', async () => {
      close();
      if (!(await confirmDialog('Удалить визит?', `${fmtDate(v.visited_on)} — вместе с фото этого визита.`))) return;
      try { await deleteVisit(v); toast('Визит удалён'); render(); } catch (err) { handleErr(err); }
    });
  };
  draw();
}

// =========================================================
// Запуск
// =========================================================
async function setSession(session) {
  S.session = session; S.user = session?.user || null;
  if (!session) { S.space = null; return render(); }
  app.innerHTML = '<div class="boot">Сходим?</div>';
  try {
    await loadSpace();
    if (S.space) { await loadAll(); subscribe(); }
  } catch (e) { handleErr(e); }
  render();
}

function seedDemo() {
  S.space = { id: 'demo', name: 'Наш список', invite_code: 'ZRN482' };
  S.members = [{ display_name: 'Я' }, { display_name: 'Ты' }];
  const G = (id, name, kind, color, extra = {}) => ({ id, space_id: 'demo', name, kind, cover_color: color, sort_order: 0, created_at: '', ...extra });
  S.groups = [G('g1', 'Минск', 'city', 'peach'), G('g2', 'Брест', 'city', 'sage'),
    G('g3', 'Италия', 'trip', 'sky', { trip_status: 'dream' }), G('g4', 'Грузия', 'trip', 'butter', { trip_status: 'planned', trip_start: '2027-05-10' })];
  const P = (id, gid, name, tags, extra = {}) => ({ id, space_id: 'demo', group_id: gid, name, tags, want_again: false, created_at: '', ...extra });
  S.places = [
    P('p1', 'g1', 'Кофейня «Зерно»', ['кафе'], { instagram: '@zerno.coffee', address: 'ул. Зыбицкая, 6', note: 'Говорят, тут лучшие круассаны в городе. Идти утром в выходные!', want_again: true }),
    P('p2', 'g1', 'Выставка керамики', ['выставки'], { note: 'До 30 ноября' }),
    P('p3', 'g1', 'Ботанический сад', ['природа']),
    P('p4', 'g1', 'Бар «Лампа»', ['на выходные'], { instagram: 'https://www.instagram.com/some.very.long.place.name.minsk/', address: 'https://yandex.by/maps/157/minsk/?ll=27.553463%2C53.897114&mode=poi&poi%5Bpoint%5D=27.553399%2C53.897201&poi%5Buri%5D=ymapsbm1%3A%2F%2Forg%3Foid%3D123', note: 'Оченьдлинноесловобезпробеловкотороенедолжновылезатьзакрайэкрана' }),
    P('p5', 'g2', 'Пекарня у вокзала', ['кафе']),
    P('p6', 'g2', 'Крыша на закате', ['природа']),
    P('p7', 'g3', 'Колизей', ['музеи']),
    P('p8', 'g4', 'Серные бани', ['на выходные']),
  ];
  const V = (id, pid, d, note) => ({ id, space_id: 'demo', place_id: pid, visited_on: d, note, created_at: '' });
  S.visits = [V('v1', 'p1', '2026-09-14', 'взяли фисташковый раф'), V('v2', 'p1', '2026-03-02', 'первый раз, сидели у окна'),
    V('v3', 'p3', '2026-11-09', null), V('v4', 'p5', '2026-10-26', 'булочки с корицей!'), V('v5', 'p4', '2026-10-03', null)];
  S.photos = [];
}

(async function init() {
  if (S.demo) {
    seedDemo(); render();
    // для проверки шторок: ?demo&open=visit:p1 | newgroup | newtrip | gmenu:g1 | pmenu:p1 | delgroup:g1 | editvisit:v1
    const [what, id] = (new URLSearchParams(location.search).get('open') || '').split(':');
    const open = {
      visit: () => visitSheet(placeById(id), null), editvisit: () => { const v = S.visits.find(x => x.id === id); visitSheet(placeById(v.place_id), v); },
      newgroup: () => groupSheet(null, 'city'), newtrip: () => groupSheet(null, 'trip'), gmenu: () => groupMenu(groupById(id)),
      pmenu: () => placeMenu(placeById(id)), delgroup: () => deleteGroupDialog(groupById(id)),
    }[what];
    open?.();
    return;
  }
  sb.auth.onAuthStateChange((event, session) => {
    // вызов Supabase внутри колбэка нельзя ждать — откладываем
    if (event === 'SIGNED_IN' && !S.session) setTimeout(() => setSession(session), 0);
    if (event === 'SIGNED_OUT') setTimeout(() => setSession(null), 0);
  });
  const { data: { session } } = await sb.auth.getSession();
  await setSession(session);
})();
