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
  // два брошенных кубика — понятнее, чем один
  dice: '<g transform="rotate(-14 7.5 16.5)"><rect x="2.5" y="11.5" width="10" height="10" rx="2.4"/><circle cx="5.4" cy="14.4" r="1.05" fill="currentColor" stroke="none"/><circle cx="9.6" cy="18.6" r="1.05" fill="currentColor" stroke="none"/></g><g transform="rotate(16 16.5 7.5)"><rect x="11.5" y="2.5" width="10" height="10" rx="2.4"/><circle cx="14.2" cy="5.2" r="1.05" fill="currentColor" stroke="none"/><circle cx="16.5" cy="7.5" r="1.05" fill="currentColor" stroke="none"/><circle cx="18.8" cy="9.8" r="1.05" fill="currentColor" stroke="none"/></g>',
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
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none"/>',
  locate: '<path d="M20 4L4 11l7 2 2 7z"/>',
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
    backfillCoords();
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
window.addEventListener('hashchange', e => {
  // запоминаем, откуда открыли форму нового места, чтобы «Назад» вёл туда же
  const oldHash = (() => { try { return new URL(e.oldURL).hash; } catch { return ''; } })();
  if (/^#\/new/.test(location.hash) && !/^#\/new/.test(oldHash)) S.cameFrom = oldHash || '#/';
  render(); scrollTo(0, 0);
});

function render() {
  document.querySelectorAll('.overlay').forEach(o => o.remove());
  cleanupMaps();
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
  // на странице «Путешествия» — место добавляется в поездку, а не в первый город
  if (!S.ctxGroup && parseRoute().parts[0] === 'travel') {
    const ts = trips();
    if (!ts.length) { toast('Сначала создайте поездку'); return groupSheet(null, 'trip'); }
    if (ts.length === 1) return go('#/new?g=' + ts[0].id);
    const { el, close } = openSheet(`<div class="stack-xs"><h2 class="h2">Куда добавить место?</h2><span class="t-sub">Выберите поездку</span></div>
      <div class="stack-s">${ts.map(t => { const st = tripStatus(t); return `<button class="radio" data-t="${t.id}"><span class="dot"></span><span class="col"><span class="t-bold">${esc(t.name)}</span><span class="t-sub">${esc(st.text)}</span></span></button>`; }).join('')}</div>`);
    el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { close(); go('#/new?g=' + b.dataset.t); });
    return;
  }
  const gid = S.ctxGroup || cities()[0]?.id || S.groups[0]?.id;
  if (!gid) { toast('Сначала создайте группу'); return groupSheet(null, 'city'); }
  go('#/new?g=' + gid);
}
const navHTML = (active, fade = true) => `${fade ? '<div class="fade"></div>' : ''}<nav class="nav">
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
        <span class="t-sub">${ts.length
          ? `${ts.filter(t => t.trip_status !== 'done').length} в планах · ${ts.filter(t => t.trip_status === 'done').length} съездили` // как у городов: «хотим · были»
          : 'пока без поездок — можно помечтать'}</span></span></button>
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
  if (q.get('view') === 'map') return renderGroupMap(g, q);
  const tab = q.get('tab') === 'been' ? 'been' : 'want';
  const ps = placesIn(id);
  const want = ps.filter(isWant), been = ps.filter(isBeen).sort((a, b) => lastVisit(b).localeCompare(lastVisit(a)));
  const list = tab === 'want' ? want : been;
  // теги — только тех мест, что есть в открытой вкладке
  const tags = [...new Set(list.flatMap(p => p.tags || []))];
  if (S.gfilter.tag && !tags.includes(S.gfilter.tag)) S.gfilter.tag = null;
  const st = g.kind === 'trip' ? tripStatus(g) : null;
  app.innerHTML = `<div class="screen">
    ${groupHeadHTML(g)}
    ${st ? `<div class="chips"><span class="chip ${st.cls || ''}">${esc(st.text)}</span></div>` : ''}
    <div class="segmented"><button class="${tab === 'want' ? 'on' : ''}" data-go="#/g/${id}">Хотим · ${want.length}</button><button class="${tab === 'been' ? 'on' : ''}" data-go="#/g/${id}?tab=been">Были · ${been.length}</button></div>
    ${ps.length ? `<div class="row" style="gap:8px"><label class="input white grow">${icon('search', 20)}<input type="search" placeholder="Найти место" value="${esc(S.gfilter.q)}" data-search></label>
      <button class="round big" data-go="#/g/${id}?view=map${tab === 'been' ? '&tab=been' : ''}" aria-label="Показать на карте">${icon('map')}</button></div>
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
  bindGroupHead(g);
}
function groupHeadHTML(g) {
  return `<div class="head"><div class="title"><button class="round" data-go="${g.kind === 'trip' ? '#/travel' : '#/'}" aria-label="Назад">${icon('back')}</button><h1 class="h1">${esc(g.name)}</h1></div>
    <div class="acts"><button class="round peach" data-act="dice" aria-label="Случайное место">${icon('dice', 26)}</button><button class="round" data-act="more" aria-label="Ещё">${icon('more')}</button></div></div>`;
}
function bindGroupHead(g) {
  on('[data-act=dice]', 'click', () => {
    const ps = placesIn(g.id), want = ps.filter(isWant), pool = want.length ? want : ps;
    if (!pool.length) return toast('Пока не из чего выбирать');
    const p = pool[Math.floor(Math.random() * pool.length)];
    toast('Сходим сюда? 🎲'); go('#/p/' + p.id);
  });
  on('[data-act=more]', 'click', () => groupMenu(g));
}

// =========================================================
// Карта: Leaflet + OpenStreetMap (бесплатно, без ключа), поиск адресов — Nominatim
// =========================================================
const LEAFLET = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/';
const MCLUSTER = 'https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/';
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILES_ATTR = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const MINSK = { lat: 53.9006, lng: 27.5590 };
let leafletP = null;
function loadLeaflet() {
  if (window.L?.markerClusterGroup) return Promise.resolve(window.L);
  if (leafletP) return leafletP;
  const css = href => new Promise(r => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.onload = r; l.onerror = r; document.head.appendChild(l); });
  const js = src => new Promise((r, j) => { const s = document.createElement('script'); s.src = src; s.onload = r; s.onerror = () => j(new Error('map-load')); document.head.appendChild(s); });
  leafletP = Promise.all([css(LEAFLET + 'leaflet.css'), css(MCLUSTER + 'MarkerCluster.css')])
    .then(() => js(LEAFLET + 'leaflet.js')).then(() => js(MCLUSTER + 'leaflet.markercluster.js')).then(() => window.L)
    .catch(e => { leafletP = null; throw e; });
  return leafletP;
}
const liveMaps = new Set();
function cleanupMaps() { for (const m of liveMaps) { try { m.remove(); } catch { /* уже удалена */ } } liveMaps.clear(); }
function newMap(el, opts = {}) {
  const m = L.map(el, { zoomControl: false, ...opts });
  m.attributionControl.setPrefix(false);
  L.tileLayer(TILES, { maxZoom: 19, attribution: TILES_ATTR }).addTo(m);
  liveMaps.add(m);
  return m;
}
const pinHTML = (been, big) => `<svg width="${big ? 46 : 34}" height="${big ? 58 : 43}" viewBox="0 0 36 46" aria-hidden="true"><path d="M18 44S3 31 3 18.5A15 15 0 0 1 33 18.5C33 31 18 44 18 44Z" fill="${been ? '#8FAE82' : '#D9826B'}" stroke="#fff" stroke-width="3"/>${been ? '<path d="M12 18.5l4 4 8-8.5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' : '<circle cx="18" cy="18" r="5.5" fill="#fff"/>'}</svg>`;
const pinIcon = (been, big) => L.divIcon({ className: 'pin', html: pinHTML(been, big), iconSize: big ? [46, 58] : [34, 43], iconAnchor: big ? [23, 57] : [17, 42] });

// Nominatim: не чаще 1 запроса в секунду (правило сервиса)
let geoChain = Promise.resolve();
function nominatim(path) {
  const run = async () => {
    const r = await fetch('https://nominatim.openstreetmap.org/' + path, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('geo ' + r.status);
    return r.json();
  };
  const p = geoChain.then(run);
  geoChain = p.catch(() => {}).then(() => new Promise(r => setTimeout(r, 1100)));
  return p;
}
async function geocode(q) {
  if (S.demo || !q) return null;
  try { const j = await nominatim('search?format=jsonv2&limit=1&accept-language=ru&q=' + encodeURIComponent(q)); return j[0] ? { lat: +j[0].lat, lng: +j[0].lon } : null; }
  catch { return null; }
}
async function reverseGeocode(lat, lng) {
  if (S.demo) return null;
  try {
    const j = await nominatim(`reverse?format=jsonv2&zoom=18&accept-language=ru&lat=${lat}&lon=${lng}`);
    const a = j.address || {};
    const street = [a.road || a.pedestrian || a.footway || a.square || a.neighbourhood || a.suburb, a.house_number].filter(Boolean).join(', ');
    return [street, a.city || a.town || a.village].filter(Boolean).join(', ') || (j.display_name || '').split(',').slice(0, 2).join(',');
  } catch { return null; }
}
// координаты места: из ссылки на карту — сразу, из адреса — поиском (с названием города/страны группы)
async function coordsFor(address, gid) {
  if (!address) return null;
  if (isUrl(address)) return parseCoords(address);
  const g = groupById(gid);
  return geocode(address + (g ? ', ' + g.name : ''));
}
async function groupCenter(g) {
  const key = 'shodim-gc-' + g.name;
  try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c) return c; } catch { /* нет */ }
  const c = await geocode(g.name);
  if (c) localStorage.setItem(key, JSON.stringify(c));
  return c || MINSK;
}
// Один раз находим точки для мест, добавленных до появления карты
let backfillRunning = false;
async function backfillCoords() {
  if (S.demo || backfillRunning) return;
  backfillRunning = true;
  let tried = {};
  try { tried = JSON.parse(localStorage.getItem('shodim-geo-tried') || '{}'); } catch { /* нет */ }
  let changed = false;
  for (const p of S.places.filter(x => x.lat == null && x.address)) {
    const key = p.id + '|' + p.address;
    if (tried[key]) continue;
    tried[key] = 1; localStorage.setItem('shodim-geo-tried', JSON.stringify(tried));
    const c = await coordsFor(p.address, p.group_id);
    if (c) { try { await upd('places', p.id, { lat: c.lat, lng: c.lng }); changed = true; } catch (e) { console.warn(e); } }
  }
  backfillRunning = false;
  if (changed && /view=map/.test(location.hash) && !document.querySelector('.overlay')) render();
}

function renderGroupMap(g, q) {
  const id = g.id, tab = q.get('tab') === 'been' ? 'been' : 'want';
  const ps = placesIn(id);
  if (S.mapFilterGroup !== id) { S.mapFilter = 'all'; S.mapFilterGroup = id; }
  app.innerHTML = `<div class="mapwrap"><div class="map" data-map></div></div>
    <div class="map-top">${groupHeadHTML(g)}
      <div class="row" style="gap:8px"><label class="input white grow">${icon('search', 20)}<input type="search" placeholder="Найти место" value="${esc(S.gfilter.q)}" data-search></label>
        <button class="round big" data-go="#/g/${id}${tab === 'been' ? '?tab=been' : ''}" aria-label="Списком">${icon('list')}</button></div></div>
    <div class="chips map-filter" data-mf></div>
    <button class="round shadow map-me" data-me aria-label="Где я">${icon('locate')}</button>
    <div class="map-bottom" data-bottom></div>
    ${navHTML('p', false)}`;
  bindCommon(); bindGroupHead(g);
  const top = $('.map-top'), mf = $('[data-mf]');
  mf.style.top = (top.getBoundingClientRect().bottom + 12) + 'px';
  let map = null, cluster = null, sel = null, meMarker = null;
  const markers = new Map();
  const filtered = () => {
    const qq = S.gfilter.q.toLowerCase();
    return ps.filter(p => (S.mapFilter === 'all' || (S.mapFilter === 'want' ? isWant(p) : isBeen(p))) &&
      (!qq || [p.name, p.note, p.address, ...(p.tags || [])].join(' ').toLowerCase().includes(qq)));
  };
  const meta = p => { const vs = visitsOf(p.id); return [...(p.tags || []), vs.length ? `были ${vs.length} ${plural(vs.length, 'раз', 'раза', 'раз')}` : (isUrl(p.address) ? '' : p.address)].filter(Boolean).join(' · '); };
  const drawFilter = () => {
    const n = { all: ps.length, want: ps.filter(isWant).length, been: ps.filter(isBeen).length };
    mf.innerHTML = [['all', 'все'], ['want', 'хотим'], ['been', 'были']].map(([k, t]) => `<button class="chip ${S.mapFilter === k ? 'active' : ''}" data-k="${k}">${t} · ${n[k]}</button>`).join('');
    mf.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { S.mapFilter = b.dataset.k; sel = null; drawFilter(); drawPins(true); });
  };
  const drawBottom = () => {
    const box = $('[data-bottom]'), p = sel && placeById(sel);
    if (p) {
      box.innerHTML = `<button class="card map-card" data-go="#/p/${p.id}">${photo(placeImg(p), hashKey(p.id))}<span class="col grow"><span class="t-cards">${esc(p.name)}</span><span class="t-sub">${esc(meta(p))}</span></span>${icon('right', 22)}</button>`;
      bindCommon(box); return;
    }
    const noPt = filtered().filter(x => x.lat == null).length;
    box.innerHTML = noPt ? `<div class="map-hint">${noPt} ${plural(noPt, 'место', 'места', 'мест')} без точки на карте — откройте место и добавьте адрес или ссылку на карту</div>` : '';
  };
  const refreshIcon = pid => { const m = markers.get(pid), p = placeById(pid); if (m && p) { m.setIcon(pinIcon(isBeen(p), pid === sel)); m.setZIndexOffset(pid === sel ? 1000 : 0); } };
  const drawPins = async fit => {
    drawBottom();
    if (!map) return;
    cluster.clearLayers(); markers.clear();
    const pts = filtered().filter(p => p.lat != null);
    for (const p of pts) {
      const m = L.marker([p.lat, p.lng], { icon: pinIcon(isBeen(p), p.id === sel) });
      m.on('click', () => { const old = sel; sel = p.id; if (old) refreshIcon(old); refreshIcon(p.id); drawBottom(); });
      markers.set(p.id, m); cluster.addLayer(m);
    }
    if (!fit) return;
    const padTop = top.getBoundingClientRect().bottom + 70;
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])), { paddingTopLeft: [40, padTop], paddingBottomRight: [40, 200], maxZoom: 16 });
    else if (pts.length === 1) map.setView([pts[0].lat, pts[0].lng], 15);
    else { const c = await groupCenter(g); if (map) map.setView([c.lat, c.lng], g.kind === 'trip' ? 5 : 12); }
  };
  drawFilter(); drawBottom();
  $('[data-search]').addEventListener('input', e => { S.gfilter.q = e.target.value; sel = null; drawPins(false); });
  loadLeaflet().then(() => {
    const el = $('[data-map]'); if (!el) return; // уже ушли с экрана
    map = newMap(el);
    cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 44, iconCreateFunction: c => L.divIcon({ className: 'cluster', html: `<span>${c.getChildCount()}</span>`, iconSize: [44, 44] }) });
    map.addLayer(cluster);
    map.on('click', () => { if (sel) { const old = sel; sel = null; refreshIcon(old); drawBottom(); } });
    drawPins(true);
  }).catch(() => { const el = $('[data-map]'); if (el) el.innerHTML = '<p class="t-sub center" style="padding-top:260px">Карта не загрузилась — проверьте интернет</p>'; });
  on('[data-me]', 'click', () => {
    if (!navigator.geolocation) return toast('На этом устройстве геопозиция недоступна');
    navigator.geolocation.getCurrentPosition(pos => {
      if (!map) return;
      const ll = [pos.coords.latitude, pos.coords.longitude];
      if (meMarker) meMarker.setLatLng(ll);
      else meMarker = L.marker(ll, { icon: L.divIcon({ className: 'me-dot', html: '<span></span>', iconSize: [22, 22] }), interactive: false, zIndexOffset: 2000 }).addTo(map);
      map.flyTo(ll, 15);
    }, () => toast('Не получилось определить, где вы — разрешите доступ к геопозиции'), { enableHighAccuracy: true, timeout: 10000 });
  });
}

// Экран «Где это место?»: карта двигается, булавка стоит в центре
function pickPoint({ lat, lng, title = '', onDone }) {
  const ov = document.createElement('div');
  ov.className = 'overlay picker';
  ov.innerHTML = `<div class="picker-map" data-map></div><div class="picker-pin">${pinHTML(false, true)}</div>
    <div class="picker-top"><button class="round shadow" data-close aria-label="Назад">${icon('back')}</button>
      <div class="input white grow picker-addr">${icon('pin', 20)}<span class="grow" data-addr>Ищем адрес…</span></div></div>
    <div class="sheet picker-sheet"><div class="stack-xs"><h2 class="h2">Где это место?</h2>
      <span class="t-sub">${title ? esc(title) + ' — ' : ''}двигайте карту, булавка останется в центре</span></div>
      <button class="btn" data-ok>Готово</button></div>`;
  document.body.appendChild(ov);
  let m = null, label = null, t = null;
  const close = () => { try { m && m.remove(); } catch { /* нет */ } ov.remove(); setTimeout(tryRefresh, 50); };
  ov.querySelector('[data-close]').onclick = close;
  loadLeaflet().then(() => {
    m = L.map(ov.querySelector('[data-map]'), { zoomControl: false }).setView([lat, lng], 16);
    m.attributionControl.setPrefix(false);
    L.tileLayer(TILES, { maxZoom: 19, attribution: TILES_ATTR }).addTo(m);
    const findAddr = () => {
      clearTimeout(t); label = null;
      const el = ov.querySelector('[data-addr]'); if (el) el.textContent = 'Ищем адрес…';
      t = setTimeout(async () => {
        const c = m.getCenter(); label = await reverseGeocode(c.lat, c.lng);
        const e2 = ov.querySelector('[data-addr]'); if (e2) e2.textContent = label || 'Точка выбрана';
      }, 700);
    };
    m.on('movestart', () => { clearTimeout(t); });
    m.on('moveend', findAddr); findAddr();
  }).catch(() => { toast('Карта не загрузилась — проверьте интернет'); close(); });
  ov.querySelector('[data-ok]').onclick = () => {
    if (!m) return;
    const c = m.getCenter(); close();
    onDone({ lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6), label });
  };
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
      return `<button class="card trip" data-tid="${t.id}" data-go="#/g/${t.id}">${photo(url(t.cover_path), t.cover_color || hashKey(t.id), { inner: `<span class="status" style="${st.cls ? `background:var(--${st.cls})` : ''}">${esc(st.text)}</span>
          <span class="round shadow trip-more" role="button" tabindex="0" data-tmenu="${t.id}" aria-label="Изменить или удалить поездку">${icon('more')}</span>` })}
        <span class="row between" style="padding:0 8px"><span class="t-sec">${esc(t.name)}</span><span class="t-sub">${n} ${plural(n, 'место', 'места', 'мест')}</span></span></button>`;
    }).join('')}
    ${ts.length ? '' : `<p class="t-body muted center" style="margin:16px 0 0">Здесь будут поездки — и те, о которых пока мечтаем, и уже запланированные.</p>`}
    <button class="dashed" data-act="new-trip">${icon('plus', 20)}Новая поездка</button>
  </div>${navHTML('p')}`;
  bindCommon();
  on('[data-act=new-trip]', 'click', () => groupSheet(null, 'trip'));
  // меню поездки: кнопка «⋯» на обложке или долгое нажатие на карточку — как у групп на главной
  on('[data-tmenu]', 'click', (e, el) => { e.stopPropagation(); e.preventDefault(); groupMenu(groupById(el.dataset.tmenu)); });
  app.querySelectorAll('.trip[data-tid]').forEach(el => longPress(el, done => groupMenu(groupById(el.dataset.tid), done)));
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
      <div class="stack-s">
      <div class="row" style="gap:8px"><h2 class="t-sec">Наши визиты</h2>${vs.length ? `<span class="t-sec muted">${vs.length}</span>` : ''}</div>
      ${vs.length ? `<div class="col" style="gap:8px">${vs.map(v => `<button class="card visit" data-vid="${v.id}">${photo(visitImg(v), hashKey(v.id))}
        <span class="col grow"><span class="t-bold">${fmtDate(v.visited_on)}</span>${v.note ? `<span class="t-sub">${esc(v.note)}</span>` : ''}</span></button>`).join('')}</div>`
        : `<p class="t-sub" style="margin:0">Ещё не были. Когда сходите — нажмите кнопку внизу и добавьте дату и фото.</p>`}
      </div>
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
  on('[data-vid]', 'click', (e, el) => {
    if (el.dataset.lp === '1') { delete el.dataset.lp; return; } // это было долгое нажатие
    visitSheet(p, S.visits.find(v => v.id === el.dataset.vid));
  });
  app.querySelectorAll('[data-vid]').forEach(el => longPress(el, done => visitMenu(p, S.visits.find(v => v.id === el.dataset.vid), done)));
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
    lat: p?.lat ?? null, lng: p?.lng ?? null,
  };
  const suggestions =() => [...new Set([...allTags(), ...F.tags, ...(allTags().length ? [] : ['кафе', 'выставки', 'природа', 'на выходные'])])];
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
    <div class="field"><label>Адрес</label><label class="input">${icon('pin', 20)}<input data-f="address" placeholder="Улица, дом или ссылка на карту" value="${esc(F.address)}"></label><div data-mapprev></div></div>
    <div class="field"><label>Заметка</label><textarea class="input" data-f="note" rows="3" placeholder="Что там интересного, когда лучше идти…">${esc(F.note)}</textarea></div>
  </div><div class="fade"></div><button class="btn cta" data-act="save">${p ? 'Сохранить' : 'Добавить место'}</button>`;
  on('[data-f]', 'input', (e, el) => { F[el.dataset.f] = el.value; });
  on('[data-f]', 'change', (e, el) => { F[el.dataset.f] = el.value; });
  // «Назад»: из нового места — туда, откуда пришли (например, в «Путешествия»)
  on('[data-act=back]', 'click', () => {
    if (p) return go('#/p/' + p.id);
    if (S.cameFrom) return go(S.cameFrom);
    go('#/g/' + F.group_id);
  });
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
  // Точка на карте: превью, если координаты есть; иначе — найти по адресу или поставить вручную
  const drawMapPrev = () => {
    const box = $('[data-mapprev]'); if (!box) return;
    const textAddr = F.address.trim() && !isUrl(F.address);
    if (F.lat != null) {
      box.innerHTML = `<div class="map-prev"><div class="map-prev-map" data-pm></div><div class="map-prev-pin">${pinHTML(false, true)}</div>
        <button class="chip" data-adjust>уточнить на карте</button></div>`;
      loadLeaflet().then(() => {
        const el = box.querySelector('[data-pm]'); if (!el) return;
        newMap(el, { dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false }).setView([F.lat, F.lng], 16);
      }).catch(() => {});
    } else {
      box.innerHTML = `<div class="chips" style="padding-top:8px">${textAddr ? `<button class="chip" data-find>${icon('search', 16)}найти на карте</button>` : ''}
        <button class="chip" data-adjust>${icon('pin', 16)}поставить точку на карте</button></div>`;
    }
    box.querySelector('[data-adjust]').onclick = async e => {
      e.currentTarget.disabled = true;
      let c = F.lat != null ? { lat: F.lat, lng: F.lng } : null;
      if (!c && textAddr) c = await coordsFor(F.address.trim(), F.group_id);
      if (!c) { const g = groupById(F.group_id); c = g ? await groupCenter(g) : MINSK; }
      e.currentTarget.disabled = false;
      pickPoint({ ...c, title: F.name.trim(), onDone: ({ lat, lng, label }) => {
        F.lat = lat; F.lng = lng;
        if (!F.address.trim() && label) { F.address = label; $('[data-f=address]').value = label; }
        drawMapPrev();
      } });
    };
    box.querySelector('[data-find]')?.addEventListener('click', async e => {
      e.currentTarget.disabled = true; e.currentTarget.lastChild.textContent = 'ищем…';
      const c = await coordsFor(F.address.trim(), F.group_id);
      if (c) { F.lat = c.lat; F.lng = c.lng; } else toast('Не нашли такой адрес — поставьте точку вручную');
      drawMapPrev();
    });
  };
  // адрес поменяли: ссылку на карту разбираем сразу, обычный адрес ищем на карте
  on('[data-f=address]', 'change', async () => {
    const a = F.address.trim();
    F.lat = null; F.lng = null;
    if (a) { const c = await coordsFor(a, F.group_id); if (c && F.address.trim() === a) { F.lat = c.lat; F.lng = c.lng; } }
    drawMapPrev();
  });
  drawCover(); drawTags(); drawMapPrev();
  on('[data-act=save]', 'click', async (e, btn) => {
    if (!F.name.trim()) { toast('Напишите название места'); $('#f-name').focus(); return; }
    btn.disabled = true; btn.textContent = 'Сохраняем…';
    try {
      const row = { name: F.name.trim(), group_id: F.group_id, tags: F.tags, instagram: F.instagram.trim() || null, address: F.address.trim() || null, note: F.note.trim() || null };
      row.lat = F.lat; row.lng = F.lng;
      if (row.lat == null && row.address) { // точку ещё не нашли — пробуем по адресу (не дольше 6 секунд)
        const c = await Promise.race([coordsFor(row.address, row.group_id), new Promise(r => setTimeout(() => r(null), 6000))]);
        if (c) { row.lat = c.lat; row.lng = c.lng; }
      }
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
// Один полароид = одно фото. У всех фото одного визита — скотч одного цвета.
const shortName = name => name.match(/[«"]([^»"]+)[»"]/)?.[1] || name; // «Зерно» вместо «Кофейня «Зерно»»
function polaroidHTML({ v, src, tape, gi }, i) {
  const p = placeById(v.place_id);
  return `<button class="polaroid" data-ph="${gi}" style="transform:rotate(${TILT[i % 4]}deg)">
    <span class="tape" style="background:var(${TAPES[tape % TAPES.length]})"></span>
    ${photo(src, hashKey(v.id))}<span class="hand-s"><span class="nm">${esc(shortName(p?.name || ''))}</span>, ${fmtShort(v.visited_on)}</span></button>`;
}
function albumCards(visits) {
  return visits.flatMap((v, vi) => {
    const fs = photosOf(v.id);
    return fs.length ? fs.map(f => ({ v, src: url(f.path), tape: vi })) : [{ v, src: visitImg(v), tape: vi }];
  });
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
  // все карточки альбома по порядку — для листания в просмотре фото
  const list = [];
  for (const m of months) { m.cards = albumCards(m.items).map(c => { c.gi = list.length; c.tilt = TILT[list.length % 4]; list.push(c); return c; }); }
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
          <div class="board">${m.cards.map(polaroidHTML).join('')}</div></div>`).join('')}
  </div>${navHTML('a')}`;
  bindCommon();
  on('[data-ph]', 'click', (e, el) => openViewer(list, +el.dataset.ph));
}

// ----- Просмотр фото: полароид увеличивается, листается свайпом / стрелками
function openViewer(list, start) {
  if (!list.length) return;
  let i = start;
  const ov = document.createElement('div');
  ov.className = 'overlay viewer';
  ov.innerHTML = `<div class="viewer-top"><span class="chip viewer-count" data-count></span><button class="round shadow" data-x aria-label="Закрыть">${icon('close')}</button></div>
    <div class="viewer-stage" data-stage></div>
    <div class="viewer-bottom"><button class="round shadow" data-prev aria-label="Предыдущее">${icon('back')}</button>
      <button class="chip viewer-place" data-place>к месту ${icon('right', 16)}</button>
      <button class="round shadow" data-next aria-label="Следующее">${icon('right')}</button></div>`;
  document.body.appendChild(ov);
  const stage = ov.querySelector('[data-stage]');
  history.pushState({ viewer: 1 }, '');
  let closed = false;
  const finish = () => { if (closed) return; closed = true; window.removeEventListener('popstate', onPop); document.removeEventListener('keydown', onKey); ov.remove(); setTimeout(tryRefresh, 50); };
  const onPop = () => finish();
  const close = () => { if (history.state?.viewer) history.back(); else finish(); };
  window.addEventListener('popstate', onPop);
  const card = (c) => {
    const p = placeById(c.v.place_id);
    return `<div class="viewer-pol" style="--tilt:${c.tilt}deg"><span class="tape" style="background:var(${TAPES[c.tape % TAPES.length]})"></span>
      ${c.src ? `<img src="${esc(c.src)}" alt="" draggable="false">` : `<div class="ph viewer-ph">${art(hashKey(c.v.id))}</div>`}
      <div class="viewer-cap"><span class="hand-l">${esc(shortName(p?.name || ''))}</span><span class="t-sub">${fmtDate(c.v.visited_on)}</span>
      ${c.v.note ? `<span class="t-body viewer-note">${esc(c.v.note)}</span>` : ''}</div></div>`;
  };
  const draw = (dir = 0) => {
    const c = list[i];
    stage.innerHTML = card(c);
    const pol = stage.firstElementChild;
    if (dir) { pol.classList.add(dir > 0 ? 'from-right' : 'from-left'); requestAnimationFrame(() => requestAnimationFrame(() => pol.classList.remove('from-right', 'from-left'))); }
    ov.querySelector('[data-count]').textContent = `${i + 1} из ${list.length}`;
    ov.querySelector('[data-prev]').disabled = i === 0;
    ov.querySelector('[data-next]').disabled = i === list.length - 1;
    // подгружаем соседние фото заранее
    for (const j of [i - 1, i + 1]) if (list[j]?.src) { const im = new Image(); im.src = list[j].src; }
  };
  const step = d => { const j = i + d; if (j < 0 || j >= list.length) return false; i = j; draw(d); return true; };
  ov.querySelector('[data-x]').onclick = close;
  ov.querySelector('[data-prev]').onclick = () => step(-1);
  ov.querySelector('[data-next]').onclick = () => step(1);
  ov.querySelector('[data-place]').onclick = () => { const pid = list[i].v.place_id; finish(); history.replaceState(null, ''); go('#/p/' + pid); };
  ov.addEventListener('click', e => { if (e.target === ov || e.target === stage) close(); });
  const onKey = e => { if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  // свайп
  let x0 = null, dx = 0;
  stage.addEventListener('pointerdown', e => { x0 = e.clientX; dx = 0; stage.setPointerCapture(e.pointerId); const pol = stage.firstElementChild; if (pol) pol.style.transition = 'none'; });
  stage.addEventListener('pointermove', e => { if (x0 == null) return; dx = e.clientX - x0; const pol = stage.firstElementChild; if (pol) pol.style.transform = `translateX(${dx}px) rotate(calc(var(--tilt) + ${dx / 25}deg))`; });
  const end = () => {
    if (x0 == null) return; x0 = null;
    const pol = stage.firstElementChild; if (pol) { pol.style.transition = ''; pol.style.transform = ''; }
    if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
    else if (Math.abs(dx) < 6) { /* просто тап — ничего */ }
  };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
  draw(0);
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
      ${two ? '' : `<button class="link-btn" data-act="switch" style="font-size:15px">Перейти в другой список по коду</button>`}
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
  on('[data-act=switch]', 'click', () => switchSpaceSheet());
}

// Если случайно создали свой список вместо входа по коду — перейти в общий
function switchSpaceSheet() {
  const n = S.places.length;
  const { el, close } = openSheet(`<div class="stack-xs"><h2 class="h2">Перейти в другой список</h2>
      <p class="t-sub" style="margin:0">Введите код, который вам прислали. Текущий список вы покинете${n ? ` — его ${n} ${plural(n, 'место', 'места', 'мест')} не перенесутся` : ''}.</p></div>
    <input class="input" data-code placeholder="Например, ZRN-482" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:.1em">
    <button class="btn" data-go2>Перейти</button>`);
  const inp = el.querySelector('[data-code]'); inp.focus();
  el.querySelector('[data-go2]').onclick = async e => {
    const code = inp.value.trim();
    if (!code) return toast('Введите код');
    if (S.demo) return toast('В демо-режиме нельзя');
    const btn = e.currentTarget; btn.disabled = true;
    try {
      const oldId = S.space.id;
      const { data, error } = await sb.rpc('join_space', { p_code: code, p_display_name: localStorage.getItem('shodim-name') || null });
      if (error) throw error;
      if (data.id === oldId) { close(); return toast('Это код вашего же списка'); }
      const { error: e2 } = await sb.from('space_members').delete().eq('space_id', oldId).eq('user_id', S.user.id);
      if (e2) throw e2;
      S.space = data; S.urls.clear();
      await loadAll(); subscribe(); close(); go('/');
      toast('Вы в общем списке!');
    } catch (err) { handleErr(err); btn.disabled = false; }
  };
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
        ${G.status !== 'dream' ? `<div class="row">
            <button class="input grow" data-start style="text-align:left;padding:0 12px;gap:6px"><span class="t-sub">с</span><span class="grow">${G.start ? fmtDayMonth(G.start) + ' ' + G.start.slice(0, 4) : 'выбрать'}</span></button>
            <button class="input grow" data-end style="text-align:left;padding:0 12px;gap:6px"><span class="t-sub">по</span><span class="grow">${G.end ? fmtDayMonth(G.end) + ' ' + G.end.slice(0, 4) : 'выбрать'}</span></button></div>`
          : `<span class="t-sub">Даты можно добавить позже, когда поездка станет реальной.</span>`}</div>` : ''}
      <div class="field"><span class="label">Обложка</span><div class="swatches">
        <label class="swatch photo ${hasPhoto() ? 'on' : ''}">${hasPhoto() ? `<img src="${esc(G.coverUrl || url(g.cover_path))}" alt="">` : icon('camera')}<input type="file" accept="image/*" hidden data-file></label>
        ${Object.entries(SWATCH).map(([k, c]) => `<button class="swatch ${!hasPhoto() && G.color === k ? 'on' : ''}" data-color="${k}" style="background:${c}">${!hasPhoto() && G.color === k ? icon('check', 24) : ''}</button>`).join('')}</div>
        <span class="t-sub">Можно выбрать цвет или поставить ваше фото.</span></div>
      <button class="btn" data-save>${g ? 'Сохранить' : trip ? 'Создать поездку' : 'Создать группу'}</button>`;
    body.querySelector('[data-name]').addEventListener('input', e => { G.name = e.target.value; });
    body.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { G.kind = b.dataset.kind; if (!g && !G.coverFile) G.color = G.kind === 'trip' ? 'sky' : 'peach'; draw(); });
    body.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { G.status = b.dataset.st; draw(); });
    // даты поездки: будущее разрешено, быстрых «вчера/сегодня» нет
    body.querySelector('[data-start]')?.addEventListener('click', () => dateSheet({ value: G.start || todayISO(), title: 'Начало поездки', sub: G.name, max: null, quick: false,
      onPick: d => { G.start = d; if (G.end && G.end < d) G.end = ''; draw(); } }));
    body.querySelector('[data-end]')?.addEventListener('click', () => dateSheet({ value: G.end || G.start || todayISO(), title: 'Конец поездки', sub: G.name, max: null, quick: false, min: G.start || null,
      onPick: d => { G.end = d; draw(); } }));
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

// ----- Визит: меню по долгому нажатию и удаление
function visitMenu(p, v, done) {
  const n = photosOf(v.id).length;
  const { el, close } = openSheet(`<div class="stack-xs"><h2 class="h2">${fmtDate(v.visited_on)}</h2><span class="t-sub">${esc(p.name)}${n ? ` · ${n} ${plural(n, 'фото', 'фото', 'фото')}` : ''}</span></div>
    ${actionsHTML([['edit', 'pencil', 'Изменить визит'], ['del', 'trash', 'Удалить визит', true]])}`, { onClose: done });
  el.querySelector('[data-a=edit]').onclick = () => { close(); visitSheet(p, v); };
  el.querySelector('[data-a=del]').onclick = () => { close(); confirmDeleteVisit(p, v); };
}
async function confirmDeleteVisit(p, v) {
  const last = visitsOf(p.id).length === 1;
  const text = `${fmtDate(v.visited_on)} — вместе с фото этого визита.` + (last ? ' Это единственный визит, поэтому место вернётся в «Хотим».' : '');
  if (!(await confirmDialog('Удалить визит?', text))) return;
  try {
    await deleteVisit(v);
    toast(last ? 'Визит удалён — место вернулось в «Хотим»' : 'Визит удалён');
    render();
  } catch (err) { handleErr(err); }
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

// ----- Календарь (как в макете, экран 10) — вместо системного выбора даты
const MONTHS_CAP = MONTHS_NOM.map(m => m[0].toUpperCase() + m.slice(1));
const isoDate = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
function dateSheet({ value, title = 'Когда были?', sub = '', max = todayISO(), min = null, quick = true, onPick }) {
  let sel = value || todayISO();
  let [vy, vm] = sel.split('-').map(Number); vm -= 1;
  const { el, close } = openSheet('<div data-body class="stack-m" style="gap:20px"></div>');
  const body = el.querySelector('[data-body]');
  const draw = () => {
    const offset = (new Date(vy, vm, 1).getDay() + 6) % 7;           // понедельник — первый
    const days = new Date(vy, vm + 1, 0).getDate();
    const today = todayISO(), month = isoDate(vy, vm, 1).slice(0, 7);
    let cells = '<span></span>'.repeat(offset);
    for (let d = 1; d <= days; d++) {
      const k = isoDate(vy, vm, d), off = (max && k > max) || (min && k < min);
      cells += `<button class="cal-day ${k === sel ? 'on' : ''} ${k === today ? 'today' : ''}" data-d="${k}" ${off ? 'disabled' : ''}>${d}</button>`;
    }
    body.innerHTML = `<div class="stack-xs"><h2 class="h2">${esc(title)}</h2>${sub ? `<span class="t-sub">${esc(sub)}</span>` : ''}</div>
      ${quick ? `<div class="chips">${[[0, 'сегодня'], [-1, 'вчера'], [-2, 'позавчера']].map(([n, t]) => `<button class="chip ${sel === shiftDays(n) ? 'active' : 'paper'}" data-q="${n}">${t}</button>`).join('')}</div>` : ''}
      <div class="cal">
        <div class="cal-head"><button class="cal-nav" data-m="-1" aria-label="Предыдущий месяц" ${min && month <= min.slice(0, 7) ? 'disabled' : ''}>${icon('back', 20)}</button>
          <span class="t-cards">${MONTHS_CAP[vm]} ${vy}</span>
          <button class="cal-nav" data-m="1" aria-label="Следующий месяц" ${max && month >= max.slice(0, 7) ? 'disabled' : ''}>${icon('right', 20)}</button></div>
        <div class="cal-grid">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(w => `<span class="cal-wd">${w}</span>`).join('')}${cells}</div>
      </div>
      ${max ? `<span class="t-sub">Можно выбрать любую прошедшую дату — даже если карточку заполняете спустя время.</span>` : ''}
      <button class="btn" data-ok>Готово</button>`;
    body.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { sel = b.dataset.d; draw(); });
    body.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { sel = shiftDays(+b.dataset.q); [vy, vm] = sel.split('-').map(Number); vm -= 1; draw(); });
    body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { vm += +b.dataset.m; if (vm < 0) { vm = 11; vy--; } if (vm > 11) { vm = 0; vy++; } draw(); });
    body.querySelector('[data-ok]').onclick = () => { close(); onPick(sel); };
  };
  draw();
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
        <button class="input" data-pick style="text-align:left"><span style="color:var(--accent)">${icon('cal')}</span><span class="t-bold grow">${fmtDate(V.date)}</span>${icon('down', 20)}</button>
        <div class="chips">${[[0, 'сегодня'], [-1, 'вчера'], [-2, 'позавчера']].map(([d, t]) => `<button class="chip ${V.date === shiftDays(d) ? 'active' : 'paper'}" data-day="${d}">${t}</button>`).join('')}</div>
        <span class="t-sub">Можно выбрать любую прошедшую дату — даже если заполняете спустя время.</span></div>
      <div class="field"><span class="label">Фото</span><div class="thumbs">
        ${V.keep.map(f => `<div class="thumb">${photo(url(f.path), hashKey(f.id))}<button class="x" data-rm="${f.id}" aria-label="Убрать">${icon('close', 16)}</button></div>`).join('')}
        ${V.added.map((a, i) => `<div class="thumb">${photo(a.url, 'peach')}<button class="x" data-rmnew="${i}" aria-label="Убрать">${icon('close', 16)}</button></div>`).join('')}
        <label class="addtile">${icon('camera', 24)}добавить<input type="file" accept="image/*" multiple hidden data-file></label></div></div>
      <div class="field"><label>Пара слов</label><textarea class="input" data-note rows="3" placeholder="Как всё прошло?">${esc(V.note)}</textarea></div>
      <button class="row" data-want style="text-align:left"><span style="color:var(--accent)">${icon('heartF')}</span><span class="t-bold grow">Хотим сюда снова</span><span class="switch ${V.want ? 'on' : ''}"></span></button>
      <div class="col" style="gap:4px"><button class="btn" data-save>${v ? 'Сохранить' : 'Сохранить в альбом'}</button>
      ${v ? `<button class="link-btn danger" data-delete style="padding:8px">Удалить визит</button>` : ''}</div>`;
    body.querySelector('[data-pick]').onclick = () => dateSheet({ value: V.date, sub: p.name, onPick: d => { V.date = d; draw(); } });
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
    body.querySelector('[data-delete]')?.addEventListener('click', () => { close(); confirmDeleteVisit(p, v); });
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
    if (S.space) { await loadAll(); subscribe(); backfillCoords(); }
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
  // демо-координаты (у «Выставки керамики» точки нет — чтобы видеть подсказку на карте)
  const LL = { p1: [53.9071, 27.5529], p3: [53.9155, 27.6118], p4: [53.9102, 27.5482], p5: [52.0976, 23.6877], p6: [52.0939, 23.7012], p7: [41.8902, 12.4922], p8: [41.688, 44.8104] };
  for (const p of S.places) if (LL[p.id]) [p.lat, p.lng] = LL[p.id];
  const V = (id, pid, d, note) => ({ id, space_id: 'demo', place_id: pid, visited_on: d, note, created_at: '' });
  S.visits = [V('v1', 'p1', '2026-09-14', 'взяли фисташковый раф'), V('v2', 'p1', '2026-03-02', 'первый раз, сидели у окна'),
    V('v3', 'p3', '2026-11-09', null), V('v4', 'p5', '2026-10-26', 'булочки с корицей!'), V('v5', 'p4', '2026-10-03', null)];
  // демо-«фото»: цветные картинки, чтобы было видно несколько фото в одном визите
  const fake = (id, c1, c2) => {
    S.urls.set('demo/' + id, 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${c1}"/><circle cx="200" cy="230" r="110" fill="${c2}"/></svg>`));
    return 'demo/' + id;
  };
  const F = (id, vid, path, n) => ({ id, space_id: 'demo', visit_id: vid, path, sort_order: n });
  S.photos = [F('f1', 'v3', fake('a', '#CFE0C3', '#8FAE82'), 0), F('f2', 'v3', fake('b', '#E4EEDD', '#B5CBA8'), 1), F('f3', 'v3', fake('c', '#D3E0C9', '#6F8A64'), 2),
    F('f4', 'v4', fake('d', '#F8E4E5', '#DDAEB2'), 0), F('f5', 'v4', fake('e', '#FBF2D8', '#E5CF8E'), 1)];
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
      vmenu: () => { const v = S.visits.find(x => x.id === id); visitMenu(placeById(v.place_id), v); },
      addtravel: () => addPlace(), switch: () => switchSpaceSheet(), viewer: () => document.querySelector('[data-ph="1"]')?.click(),
      pick: () => pickPoint({ lat: 53.9071, lng: 27.5529, title: 'Кофейня «Зерно»', onDone: () => {} }),
      date: () => dateSheet({ value: '2026-09-14', sub: 'Кофейня «Зерно»', onPick: () => {} }), date2: () => dateSheet({ sub: 'Кофейня «Зерно»', onPick: () => {} }),
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
