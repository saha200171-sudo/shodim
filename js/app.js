import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { KINDS, kindById, kindHints, ITEMS, itemById, SHOP, SHOP_TOTAL, SLOT_NAMES, CATS, ACHIEVEMENTS, achById,
  computeAchievements, cupsBalance, ownedSet, arrangement, windowState } from './room.js';

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
  room: { owned: [], placed: {} }, hasRoom: false, hasKinds: false, // комната (003_room.sql)
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
  // комната
  places: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  cup: '<path d="M6.5 9h11l-1.3 10.4a2 2 0 0 1-2 1.6H9.8a2 2 0 0 1-2-1.6z"/><path d="M5.5 9h13"/><path d="M12.5 9l1.6-5.5h2.4"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  plane: '<path d="M10.5 13.5L3 11l1.5-1.5 7 .5 4.5-5c1-1 2.5-1.2 3-.5s.5 2-.5 3l-5 4.5.5 7L12.5 20.5 10 13"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  home: '<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5"/><path d="M10 20v-5h4v5"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  box: '<path d="M4 8l8-4 8 4-8 4z"/><path d="M4 8v8l8 4 8-4V8"/><path d="M12 12v8"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8.5 20h7M10 17h4"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
};
for (const k of KINDS) I['kind-' + k.id] = k.icon;
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
  if (/signups? not allowed|signup.*disabled/i.test(m)) return toast('Регистрация закрыта — это приложение только для нас двоих. Войдите в свой аккаунт');
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
  await Promise.all([signUrls(), loadRoom()]);
}
// Комната и тип места появляются после 003_room.sql — до этого приложение просто работает без них
async function loadRoom() {
  if (S.demo || !S.space) return;
  const [r, k] = await Promise.all([
    sb.from('room').select('*').eq('space_id', S.space.id).maybeSingle(),
    sb.from('places').select('kinds').limit(1),
  ]);
  S.hasKinds = !k.error;
  if (r.error) { S.hasRoom = false; console.warn('room:', r.error.message); }
  else { S.hasRoom = true; S.room = { owned: r.data?.owned || [], placed: r.data?.placed || {} }; }
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
  for (const t of ['groups', 'places', 'visits', 'visit_photos', ...(S.hasRoom ? ['room'] : [])]) {
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
  renderInner();
  setTimeout(maybeCelebrate, 350);
}
function renderInner() {
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
  if (a === 'room') return renderRoomRoute(b, q);
  if (a === 'map') return renderAllMap(q);
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
  <button class="item ${active === 'p' ? 'on' : ''}" data-go="#/">${icon('places', 24)}Места</button>
  <button class="item ${active === 'm' ? 'on' : ''}" data-go="#/map">${icon('map', 24)}Карта</button>
  <button class="plus" data-act="add" aria-label="Добавить место">${icon('plus', 26)}</button>
  <button class="item ${active === 'r' ? 'on' : ''}" data-go="#/room">${icon('home', 24)}Комната</button>
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
// «пр. Независимости» → «проспект Независимости»: карта плохо понимает сокращения
const ABBR = [[/пр-к?т\.?/, 'проспект'], [/просп\./, 'проспект'], [/пр\./, 'проспект'], [/ул\./, 'улица'], [/пер\./, 'переулок'], [/б-р\.?/, 'бульвар'], [/бул\./, 'бульвар'],
  [/пл\./, 'площадь'], [/ш\./, 'шоссе'], [/наб\./, 'набережная'], [/мкр\.?/, 'микрорайон'], [/туп\./, 'тупик'], [/д\.\s*/, ''], [/г\.\s*/, '']];
const normAddr = a => ABBR.reduce((t, [re, to]) => t.replace(new RegExp('(?<=^|[\\s,(])' + re.source, 'gi'), to + (to ? ' ' : '')), a)
  .replace(/(\d)\s*корп?\.?\s*(\d)/gi, '$1к$2').replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim();
async function geocode(q) {
  if (S.demo || !q) return null;
  try { const j = await nominatim('search?format=jsonv2&limit=1&accept-language=ru&q=' + encodeURIComponent(q)); return j[0] ? { lat: +j[0].lat, lng: +j[0].lon } : null; }
  catch { return null; }
}
// Запасной поиск Photon (тоже OpenStreetMap, ищет и по названиям заведений) — рядом с центром города группы
async function photon(q, near, { limit = 5, city = true } = {}) {
  if (!q) return [];
  let u = `https://photon.komoot.io/api/?limit=${limit}&q=${encodeURIComponent(q)}`;
  if (near) {
    u += `&lat=${near.lat}&lon=${near.lng}`;
    if (city) u += `&bbox=${near.lng - 0.45},${near.lat - 0.3},${near.lng + 0.45},${near.lat + 0.3}`;
  }
  try {
    const r = await fetch(u); if (!r.ok) return [];
    const j = await r.json();
    return (j.features || []).map(f => {
      const pr = f.properties || {}, [lng, lat] = f.geometry.coordinates;
      const street = [pr.street, pr.housenumber].filter(Boolean).join(', ');
      return { lat, lng, name: pr.name && pr.name !== pr.street ? pr.name : '', sub: [street, pr.city || pr.county].filter(Boolean).join(', ') };
    });
  } catch { return []; }
}
// Поиск на экране карты: и адреса, и заведения. Nominatim + Photon, без повторов.
async function searchPlaces(q, near, kind) {
  const nq = normAddr(q);
  const vb = near ? `&viewbox=${near.lng - 0.45},${near.lat + 0.3},${near.lng + 0.45},${near.lat - 0.3}` : '';
  const [a, b] = await Promise.all([
    nominatim(`search?format=jsonv2&limit=5&accept-language=ru${vb}&q=${encodeURIComponent(nq)}`).catch(() => []),
    photon(q, near, { city: kind === 'city' }),
  ]);
  const out = [];
  const same = (o, r) => (Math.abs(o.lat - r.lat) < 0.0003 && Math.abs(o.lng - r.lng) < 0.0004) || (o.name && o.name === r.name && o.sub === r.sub);
  const add = r => { if (!out.some(o => same(o, r))) out.push(r); };
  for (const r of a || []) {
    const parts = (r.display_name || '').split(', '), named = r.name && !/^\d/.test(r.name);
    if (named) add({ lat: +r.lat, lng: +r.lon, name: r.name, sub: parts.slice(1, 4).join(', ') });
    else if (/^\d/.test(parts[0]) && parts[1]) add({ lat: +r.lat, lng: +r.lon, name: `${parts[1]}, ${parts[0]}`, sub: parts.slice(2, 4).join(', ') }); // «проспект Независимости, 18»
    else add({ lat: +r.lat, lng: +r.lon, name: parts[0], sub: parts.slice(1, 3).join(', ') });
  }
  for (const r of b) add(r);
  return out.slice(0, 6);
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
  const g = groupById(gid), city = g ? ', ' + g.name : '';
  // 1) как написали, 2) с расшифровкой сокращений, 3) запасной поиск рядом с городом группы
  let c = await geocode(address + city);
  const n = normAddr(address);
  if (!c && n !== address) c = await geocode(n + city);
  if (!c && g) { const near = await groupCenter(g); const r = await photon(n, near, { limit: 1, city: g.kind === 'city' }); if (r[0]) c = { lat: r[0].lat, lng: r[0].lng }; }
  return c;
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
  try { tried = JSON.parse(localStorage.getItem('shodim-geo-tried2') || '{}'); } catch { /* нет */ }
  let changed = false;
  for (const p of S.places.filter(x => x.lat == null && x.address)) {
    const key = p.id + '|' + p.address;
    if (tried[key]) continue;
    tried[key] = 1; localStorage.setItem('shodim-geo-tried2', JSON.stringify(tried));
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

// =========================================================
// Общая карта: все места сразу. Сначала — «домашние» города (где больше всего мест),
// путешествия не растягивают вид; чипы переключают группу, «Все» показывает всё.
// =========================================================
function renderAllMap(q) {
  S.ctxGroup = null;
  if (!S.allMap) S.allMap = { g: 'home', f: 'all' };
  const M = S.allMap;
  const chips = [['all', 'Все'], ...cities().filter(g => placesIn(g.id).length).map(g => [g.id, g.name]), ...(trips().some(t => placesIn(t.id).length) ? [['travel', 'Путешествия']] : [])];
  if (M.g !== 'home' && !chips.some(([k]) => k === M.g)) M.g = 'home';
  app.innerHTML = `<div class="mapwrap"><div class="map" data-map></div></div>
    <div class="map-top"><div class="head"><div class="col"><span class="hand-m accent">где мы бываем</span><h1 class="h1">Карта</h1></div></div>
      <div class="chips" data-g></div></div>
    <div class="chips map-filter" data-mf></div>
    <button class="round shadow map-me" data-me aria-label="Где я">${icon('locate')}</button>
    <div class="map-bottom" data-bottom></div>
    ${navHTML('m', false)}`;
  bindCommon();
  const top = $('.map-top'), mf = $('[data-mf]');
  let map = null, cluster = null, sel = null, meMarker = null;
  const markers = new Map();
  const inGroup = p => { const g = groupById(p.group_id); if (!g) return false;
    if (M.g === 'all' || M.g === 'home') return true; if (M.g === 'travel') return g.kind === 'trip'; return g.id === M.g; };
  const filtered = () => S.places.filter(p => inGroup(p) && (M.f === 'all' || (M.f === 'want' ? isWant(p) : isBeen(p))));
  const meta = p => { const g = groupById(p.group_id), vs = visitsOf(p.id); return [g?.name, vs.length ? `были ${vs.length} ${plural(vs.length, 'раз', 'раза', 'раз')}` : (p.tags || [])[0]].filter(Boolean).join(' · '); };
  const drawChips = () => {
    const box = $('[data-g]');
    box.innerHTML = chips.map(([k, n]) => `<button class="chip ${(M.g === k || (M.g === 'home' && k === 'all')) ? 'active' : ''}" data-k="${k}">${esc(n)}</button>`).join('');
    box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { M.g = b.dataset.k; sel = null; drawChips(); drawFilter(); drawPins(true); });
    mf.style.top = (top.getBoundingClientRect().bottom + 12) + 'px';
  };
  const drawFilter = () => {
    const ps = S.places.filter(inGroup);
    const n = { all: ps.length, want: ps.filter(isWant).length, been: ps.filter(isBeen).length };
    mf.innerHTML = [['all', 'все'], ['want', 'хотим'], ['been', 'были']].map(([k, t]) => `<button class="chip ${M.f === k ? 'active' : ''}" data-f="${k}">${t} · ${n[k]}</button>`).join('');
    mf.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { M.f = b.dataset.f; sel = null; drawFilter(); drawPins(false); });
  };
  // точки, которые сейчас не видно на экране (например, путешествия при «домашнем» виде)
  const drawBottom = () => {
    const box = $('[data-bottom]'), p = sel && placeById(sel);
    if (p) {
      box.innerHTML = `<button class="card map-card" data-go="#/p/${p.id}">${photo(placeImg(p), hashKey(p.id))}<span class="col grow"><span class="t-cards">${esc(p.name)}</span><span class="t-sub">${esc(meta(p))}</span></span>${icon('right', 22)}</button>`;
      bindCommon(box); return;
    }
    const pts = filtered().filter(x => x.lat != null);
    const out = map ? pts.filter(x => !map.getBounds().contains([x.lat, x.lng])) : [];
    const noPt = filtered().filter(x => x.lat == null).length;
    if (out.length) {
      const trip = out.every(x => groupById(x.group_id)?.kind === 'trip');
      box.innerHTML = `<button class="map-hint row" data-showall style="width:100%;text-align:left;color:var(--ink)">${icon('map', 18)}<span class="grow">Ещё ${out.length} ${plural(out.length, 'место', 'места', 'мест')} ${trip ? 'в путешествиях' : 'за краем карты'}</span><span class="accent t-bold">показать →</span></button>`;
      box.querySelector('[data-showall]').onclick = () => { M.g = trip && M.g === 'home' ? 'travel' : 'all'; drawChips(); drawFilter(); drawPins(true); };
    } else box.innerHTML = noPt ? `<div class="map-hint">${noPt} ${plural(noPt, 'место', 'места', 'мест')} без точки на карте — откройте место и добавьте адрес</div>` : '';
  };
  const refreshIcon = pid => { const m = markers.get(pid), p = placeById(pid); if (m && p) { m.setIcon(pinIcon(isBeen(p), pid === sel)); m.setZIndexOffset(pid === sel ? 1000 : 0); } };
  const fitTo = pts => {
    const padTop = mf.getBoundingClientRect().bottom + 30;
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])), { paddingTopLeft: [40, padTop], paddingBottomRight: [40, 200], maxZoom: 15 });
    else if (pts.length === 1) map.setView([pts[0].lat, pts[0].lng], 14);
    else map.setView([MINSK.lat, MINSK.lng], 11);
  };
  const drawPins = fit => {
    if (!map) return drawBottom();
    cluster.clearLayers(); markers.clear();
    const pts = filtered().filter(p => p.lat != null);
    for (const p of pts) {
      const m = L.marker([p.lat, p.lng], { icon: pinIcon(isBeen(p), p.id === sel) });
      m.on('click', () => { const old = sel; sel = p.id; if (old) refreshIcon(old); refreshIcon(p.id); drawBottom(); });
      markers.set(p.id, m); cluster.addLayer(m);
    }
    if (fit) {
      // «домашний» вид: только города; путешествия не растягивают карту на полмира
      let view = pts;
      if (M.g === 'home') { const home = pts.filter(p => groupById(p.group_id)?.kind === 'city'); if (home.length) view = home; }
      fitTo(view);
    }
    setTimeout(drawBottom, 400);
  };
  drawChips(); drawFilter(); drawBottom();
  loadLeaflet().then(() => {
    const el = $('[data-map]'); if (!el) return;
    map = newMap(el);
    cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 44, iconCreateFunction: c => L.divIcon({ className: 'cluster', html: `<span>${c.getChildCount()}</span>`, iconSize: [44, 44] }) });
    map.addLayer(cluster);
    map.on('click', () => { if (sel) { const old = sel; sel = null; refreshIcon(old); drawBottom(); } });
    map.on('moveend', () => { if (!sel) drawBottom(); });
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
function pickPoint({ lat, lng, title = '', query = '', kind = 'city', onDone }) {
  const ov = document.createElement('div');
  ov.className = 'overlay picker';
  ov.innerHTML = `<div class="picker-map" data-map></div><div class="picker-pin">${pinHTML(false, true)}</div>
    <div class="picker-top"><div class="row" style="gap:8px"><button class="round shadow" data-close aria-label="Назад">${icon('back')}</button>
      <label class="input white grow picker-addr">${icon('search', 20)}<input type="search" data-q placeholder="Найти адрес или место" value="${esc(query)}" enterkeyhint="search"></label></div>
      <div class="picker-res card" data-res hidden></div></div>
    <div class="sheet picker-sheet"><div class="stack-xs"><h2 class="h2">Где это место?</h2>
      <span class="t-sub">${title ? esc(title) + ' — ' : ''}найдите в поиске или двигайте карту, булавка останется в центре</span>
      <span class="row picker-here">${icon('pin', 18)}<span class="grow" data-addr>Ищем адрес…</span></span></div>
      <button class="btn" data-ok>Готово</button></div>`;
  document.body.appendChild(ov);
  // поиск: подсказки по мере ввода, нажали на вариант — карта переезжает туда
  const qi = ov.querySelector('[data-q]'), res = ov.querySelector('[data-res]');
  let st = null, seq = 0;
  const runSearch = async () => {
    const q = qi.value.trim(), my = ++seq;
    if (q.length < 3) { res.hidden = true; return; }
    res.hidden = false; res.innerHTML = `<p class="t-sub" style="margin:0;padding:12px 16px">Ищем…</p>`;
    const c = m ? m.getCenter() : { lat, lng };
    const list = await searchPlaces(q, { lat: c.lat, lng: c.lng }, kind);
    if (my !== seq) return;
    res.innerHTML = list.length ? list.map((r, i) => {
      const head = r.name || r.sub.split(', ')[0], rest = r.name ? r.sub : r.sub.split(', ').slice(1).join(', ');
      return `<button class="picker-item" data-i="${i}">${icon('pin', 18)}<span class="col grow"><span class="t-bold">${esc(head)}</span>${rest ? `<span class="t-sub">${esc(rest)}</span>` : ''}</span></button>`;
    }).join('') : `<p class="t-sub" style="margin:0;padding:12px 16px">Ничего не нашли — попробуйте иначе (улица и дом) или подвиньте карту вручную</p>`;
    res.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const r = list[+b.dataset.i]; res.hidden = true; qi.blur(); if (m) m.setView([r.lat, r.lng], 17); });
  };
  qi.addEventListener('input', () => { clearTimeout(st); st = setTimeout(runSearch, 650); });
  qi.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(st); runSearch(); } });
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
    m.on('click', () => { res.hidden = true; });
    if (query) runSearch();
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
  // все фото этого места со всех визитов (новые сверху) — для мини-галереи и просмотра
  const gallery = [];
  vs.forEach((v, vi) => photosOf(v.id).forEach(f => gallery.push({ v, src: url(f.path), tape: vi, tilt: TILT[gallery.length % 4], gi: gallery.length })));
  const MAXG = 6, shown = gallery.length > MAXG ? gallery.slice(0, MAXG - 1) : gallery, more = gallery.length - shown.length;
  app.innerHTML = `<div class="hero">${photo(placeImg(p), hashKey(p.id))}
      <div class="bar"><button class="round shadow" data-go="${backTo}" aria-label="Назад">${icon('back')}</button>
      <div class="acts"><button class="round shadow" data-act="heart" aria-label="Хотим снова" style="color:var(--accent)">${icon(p.want_again ? 'heartF' : 'heart')}</button>
      <button class="round shadow" data-act="more" aria-label="Ещё">${icon('more')}</button></div></div></div>
    <div class="sheetlike">
      <div class="chips">${(p.kinds || []).map(k => kindById(k)).filter(Boolean).map(k => `<span class="chip kind-chip">${icon('kind-' + k.id, 16)}${k.name}</span>`).join('')}${(p.tags || []).filter(t => !(p.kinds || []).some(k => kindById(k)?.name.toLowerCase() === t.toLowerCase())).map(t => `<span class="chip peach">${esc(t)}</span>`).join('')}${g ? `<span class="chip sage">${esc(g.name)}</span>` : ''}${vs.length ? `<span class="chip butter">были ${vs.length} ${plural(vs.length, 'раз', 'раза', 'раз')}</span>` : ''}</div>
      <h1 class="h2">${esc(p.name)}</h1>
      ${ig || p.address ? `<div class="card info">
        ${ig ? `<a class="irow" href="${esc(ig.href)}" target="_blank" rel="noopener"><span class="bubble" style="background:var(--rose)">${icon('insta', 20)}</span><span class="col grow"><span class="t-sub">Instagram</span><span class="t-bold">${esc(ig.label)}</span></span><span class="ext">${icon('ext', 20)}</span></a>` : ''}
        ${ig && p.address ? '<hr>' : ''}
        ${p.address ? `<a class="irow" href="${esc(mapHref(p))}" target="_blank" rel="noopener"><span class="bubble" style="background:var(--sage)">${icon('pin', 20)}</span><span class="col grow"><span class="t-sub">${isUrl(p.address) ? 'Карта' : 'Адрес'}</span><span class="t-bold">${esc(isUrl(p.address) ? mapLabel(p.address) : p.address)}</span></span><span class="ext">${icon('ext', 20)}</span></a>` : ''}
      </div>` : ''}
      ${p.note ? `<div class="note"><div class="hand-m">заметка</div><div class="t-body">${esc(p.note)}</div></div>` : ''}
      ${gallery.length ? `<div class="stack-s">
        <div class="row" style="gap:8px"><h2 class="t-sec">Наши фото</h2><span class="t-sec muted">${gallery.length}</span></div>
        <div class="mini-gal">${shown.map(c => `<button class="mini-pol" data-gph="${c.gi}" style="transform:rotate(${c.tilt}deg)"><span class="tape" style="background:var(${TAPES[c.tape % TAPES.length]})"></span><img src="${esc(c.src)}" alt="" loading="lazy"></button>`).join('')}
          ${more ? `<button class="mini-pol mini-more" data-gph="${shown.length}" style="transform:rotate(${TILT[shown.length % 4]}deg)"><span class="hand-m">ещё ${more}</span></button>` : ''}</div>
      </div>` : ''}
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
  on('[data-gph]', 'click', (e, el) => openViewer(gallery, +el.dataset.gph));
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
    tags: [...(p?.tags || [])], kinds: [...(p?.kinds || [])], instagram: p?.instagram || '', address: p?.address || '', note: p?.note || '',
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
    <div class="field"><span class="label">Что это за место? <span class="t-sub" style="font-weight:400">для достижений</span></span><div class="chips" data-kinds></div></div>
    <div data-kindhint></div>
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
    on('[data-tag]', 'click', (e, el) => { const t = el.dataset.tag; F.tags = F.tags.includes(t) ? F.tags.filter(x => x !== t) : [...F.tags, t]; drawTags(); drawKinds(); }, box);
    box.querySelector('[data-newtag]').addEventListener('click', e => {
      const inp = document.createElement('input');
      inp.className = 'chip'; inp.placeholder = 'тег'; inp.style.cssText = 'width:120px;border:0;outline:2px solid var(--peach)';
      e.currentTarget.replaceWith(inp); inp.focus();
      const add = () => { const t = inp.value.trim().toLowerCase(); if (t && !F.tags.includes(t)) F.tags.push(t); drawTags(); drawKinds(); };
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
      // после ожидания e.currentTarget уже пустой — поэтому раньше кнопка «ломалась»; держим саму кнопку
      const btn = e.currentTarget; btn.disabled = true;
      const g = groupById(F.group_id);
      let c = F.lat != null ? { lat: F.lat, lng: F.lng } : null, query = '';
      if (!c && textAddr) { c = await coordsFor(F.address.trim(), F.group_id); if (!c) query = F.address.trim(); }
      if (!c) c = g ? await groupCenter(g) : MINSK;
      btn.disabled = false;
      pickPoint({ ...c, title: F.name.trim(), query, kind: g?.kind || 'city', onDone: ({ lat, lng, label }) => {
        F.lat = lat; F.lng = lng;
        if (!F.address.trim() && label) { F.address = label; $('[data-f=address]').value = label; }
        drawMapPrev();
      } });
    };
    box.querySelector('[data-find]')?.addEventListener('click', async e => {
      const btn = e.currentTarget; btn.disabled = true; btn.lastChild.textContent = 'ищем…';
      const c = await coordsFor(F.address.trim(), F.group_id);
      drawMapPrev();
      if (c) { F.lat = c.lat; F.lng = c.lng; drawMapPrev(); return; }
      // сами не нашли — открываем карту с поиском по этому адресу
      const g = groupById(F.group_id), near = g ? await groupCenter(g) : MINSK;
      toast('Сами не нашли — выберите в поиске на карте');
      pickPoint({ ...near, title: F.name.trim(), query: F.address.trim(), kind: g?.kind || 'city', onDone: ({ lat, lng }) => { F.lat = lat; F.lng = lng; drawMapPrev(); } });
    });
  };
  // адрес поменяли: ссылку на карту разбираем сразу, обычный адрес ищем на карте
  on('[data-f=address]', 'change', async () => {
    const a = F.address.trim();
    F.lat = null; F.lng = null;
    if (a) { const c = await coordsFor(a, F.group_id); if (c && F.address.trim() === a) { F.lat = c.lat; F.lng = c.lng; } }
    drawMapPrev();
  });
  // «Что это за место?»: только эти отметки считаются в достижения. Свои теги лишь подсказывают (пунктир).
  const drawKinds = () => {
    const hints = kindHints(F.tags).filter(h => !F.kinds.includes(h.kind));
    const box = $('[data-kinds]');
    box.innerHTML = KINDS.map(k => `<button class="chip kind ${F.kinds.includes(k.id) ? 'on' : hints.some(h => h.kind === k.id) ? 'hint' : ''}" data-kind="${k.id}">${icon('kind-' + k.id, 18)}${k.name}</button>`).join('');
    on('[data-kind]', 'click', (e, el) => { const k = el.dataset.kind; F.kinds = F.kinds.includes(k) ? F.kinds.filter(x => x !== k) : [...F.kinds, k]; drawKinds(); }, box);
    const h = hints[0];
    $('[data-kindhint]').innerHTML = h ? `<button class="kind-hint" data-hintkind="${h.kind}">${icon('sparkle', 18)}<span>По тегу «${esc(h.tag)}» похоже на ${kindById(h.kind).acc} — нажмите, чтобы отметить</span></button>` : '';
    $('[data-hintkind]')?.addEventListener('click', e => { F.kinds = [...F.kinds, e.currentTarget.dataset.hintkind]; drawKinds(); });
    $('[data-kindhint]').style.display = h ? '' : 'none';
  };
  drawCover(); drawTags(); drawKinds(); drawMapPrev();
  on('[data-act=save]', 'click', async (e, btn) => {
    if (!F.name.trim()) { toast('Напишите название места'); $('#f-name').focus(); return; }
    btn.disabled = true; btn.textContent = 'Сохраняем…';
    try {
      const row = { name: F.name.trim(), group_id: F.group_id, tags: F.tags, instagram: F.instagram.trim() || null, address: F.address.trim() || null, note: F.note.trim() || null };
      row.lat = F.lat; row.lng = F.lng;
      if (S.hasKinds) row.kinds = F.kinds;
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
      ${c.src ? `<img src="${esc(c.src)}" alt="" draggable="false" onload="if(this.naturalHeight>this.naturalWidth*1.05)this.classList.add('tall')">` : `<div class="ph viewer-ph">${art(hashKey(c.v.id))}</div>`}
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
// Комната
// =========================================================
const cupsWord = n => plural(n, 'стаканчик', 'стаканчика', 'стаканчиков');
const cupsGen = n => plural(n, 'стаканчика', 'стаканчиков', 'стаканчиков'); // «не хватает 1 стаканчика»
const thingsWord = n => plural(n, 'вещь', 'вещи', 'вещей');
function roomCalc() {
  const { stats, got } = computeAchievements(S);
  const have = S.demo && /[?&]full/.test(location.search) ? new Set(ITEMS.map(i => i.id)) : ownedSet(S.room.owned, got);
  const bal = cupsBalance(stats, got, S.room.owned);
  return { stats, got, have, bal };
}
const cupsPill = n => `<button class="cups" data-go="#/room/shop" aria-label="Стаканчики">${'<span class="cup-dot">' + icon('cup', 16) + '</span>'}${n}</button>`;
const needRoomSQL = () => { toast('Нужно один раз запустить 003_room.sql в Supabase — тогда покупки будут сохраняться'); };

async function roomBuy(id) {
  if (S.demo) { S.room.owned = [...S.room.owned, id]; return; }
  if (!S.hasRoom) { needRoomSQL(); throw new Error('silent'); }
  const { data, error } = await sb.rpc('room_buy', { p_space: S.space.id, p_item: id });
  if (error) throw error;
  S.room = { owned: data.owned || [], placed: data.placed || {} };
}
async function roomPlace(slot, id) {
  if (S.demo) { S.room.placed = { ...S.room.placed, [slot]: id }; return; }
  if (!S.hasRoom) { needRoomSQL(); throw new Error('silent'); }
  const { data, error } = await sb.rpc('room_place', { p_space: S.space.id, p_slot: slot, p_item: id });
  if (error) throw error;
  S.room = { owned: data.owned || [], placed: data.placed || {} };
}

// ----- Сцена: слои из room/*.svg в координатах 720×330
const pct = (v, of) => (v / of * 100).toFixed(3) + '%';
const boxStyle = ([x, y, w, h]) => `left:${pct(x, 720)};top:${pct(y, 330)};width:${pct(w, 720)};height:${pct(h, 330)}`;
const BULBS = [[28, 32], [61, 41], [95, 44], [130, 43], [166, 37], [202, 27], [237, 21], [271, 18], [306, 18], [339, 22]]; // лампочки гирлянды
const LANTERNS = [[380, 46], [450, 64], [520, 42], [590, 58], [660, 48]];                                              // бумажные фонарики
const WIN_BOX = [110, 34, 140, 132];      // окно целиком (рама + вид + подоконник)
const SCREEN_BOX = [384, 68, 164, 98];    // экран проектора — есть всегда
const CUP_ON_FLOOR = [660, 244, 52, 60.3]; // золотой стаканчик без стеллажа стоит на полу
function itemBox(it, shown) {
  if (it.id === 'goldcup' && !shown.some(x => x.id === 'shelving')) return CUP_ON_FLOOR;
  return it.box;
}
// mode: 'room' — как сейчас; 'dream' — все вещи, которых нет, полупрозрачные с замочком
// в демо можно посмотреть другое время: ?demo&t=night&s=winter
const wsNow = () => { const q = new URLSearchParams(location.search), w = windowState(); return S.demo ? { season: q.get('s') || w.season, time: q.get('t') || w.time } : w; };
function sceneHTML({ have, placed, dream = false, ws = wsNow(), fresh = null }) {
  let shown = arrangement(have, placed);
  let ghosts = [];
  if (dream) {
    const slots = new Set(shown.map(i => i.slot));
    for (const it of ITEMS) if (!slots.has(it.slot)) { slots.add(it.slot); ghosts.push(it); }
  }
  const time = dream ? 'day' : ws.time;
  const all = [...shown.map(i => ({ it: i, ghost: false })), ...ghosts.map(i => ({ it: i, ghost: true }))]
    .filter(({ it }) => !(it.id === 'balloon' && time === 'night'))
    .sort((a, b) => a.it.z - b.it.z);
  const allShown = all.map(x => x.it);
  const layer = ({ it, ghost }) => `<img class="l ${it.id === 'balloon' ? 'bal' : ''} ${ghost ? 'ghost' : ''} ${it.id === fresh ? 'fresh' : ''} it-${it.id}" src="${it.art}" alt="" style="${boxStyle(itemBox(it, allShown))};z-index:${it.z}">`;
  const lit = id => allShown.some(i => i.id === id);
  const dot = ([x, y], r, cls, i) => `<span class="glow ${cls}" style="${boxStyle([x - r, y - r, r * 2, r * 2])};animation-delay:${-(i * 0.7) % 3.4}s"></span>`;
  const glows = time === 'day' ? '' : [
    lit('garland') && BULBS.map((b, i) => dot(b, 20, 'g-bulb', i)).join(''),
    lit('lanterns') && LANTERNS.map((b, i) => dot(b, 46, 'g-lantern', i)).join(''),
    // торшер: тёплый свет от абажура и мягкое пятно на полу
    lit('torch') && `${dot([306, 210], 52, 'g-lamp', 0)}<span class="glow g-pool" style="${boxStyle([252, 278, 108, 30])}"></span>`,
    lit('film') && `<span class="glow g-screen" style="${boxStyle([370, 56, 192, 122])}"></span>`,
    lit('goldcup') && `<span class="glow g-cup" style="${boxStyle(itemBox(itemById('goldcup'), allShown).map((v, i) => i < 2 ? v - 14 : v + 28))}"></span>`,
  ].filter(Boolean).join('');
  // замочки: по одному на вещь, близко стоящие не наслаиваем
  const lockAt = [];
  const locks = dream ? ghosts.map(it => {
    const [x, y, w, h] = itemBox(it, allShown); const cx = x + w / 2, cy = Math.min(y + h / 2, 300);
    if (lockAt.some(([a, b]) => Math.hypot(a - cx, b - cy) < 30)) return '';
    lockAt.push([cx, cy]);
    return `<span class="lockb" style="left:${pct(cx, 720)};top:${pct(cy, 330)}">${icon('lock', 12)}</span>`;
  }).join('') : '';
  return `<div class="scene t-${time}"><span class="snap" style="left:0"></span><span class="snap" style="left:50%"></span>
    <img class="l" src="room/bg.svg" alt="" style="${boxStyle([0, 0, 720, 330])};z-index:0">
    <img class="l win" src="room/win-${ws.season}-${time}.svg" alt="" style="${boxStyle(WIN_BOX)};z-index:10">
    <img class="l win" src="room/winf-${ws.season}-${time}.svg" alt="" style="${boxStyle(WIN_BOX)};z-index:12">
    <img class="l" src="room/screen.svg" alt="" style="${boxStyle(SCREEN_BOX)};z-index:22">
    ${all.map(layer).join('')}${glows}${locks}
  </div>`;
}
// ночной и вечерний свет — фильтры для слоёв (кроме окна, у него свои картинки)
const FILTERS_SVG = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <filter id="f-night"><feColorMatrix type="matrix" values="0.566 0 0 0 0  0 0.622 0 0 0  0 0 0.846 0 0  0 0 0 1 0"/></filter>
  <filter id="f-evening"><feColorMatrix type="matrix" values="1 0 0 0 0  0 0.92 0 0 0  0 0 0.82 0 0  0 0 0 1 0"/></filter></svg>`;

function renderRoomRoute(sub, q) {
  S.ctxGroup = null;
  if (sub === 'shop') return renderShop(q);
  if (sub === 'ach') return renderAchievements();
  if (sub === 'inv') return renderInventory();
  if (sub === 'dream') return renderDream();
  renderRoom();
}

function renderRoom() {
  const R = roomCalc();
  const empty = R.have.size === 0;
  app.innerHTML = `${FILTERS_SVG}<div class="screen">
    <div class="head"><button class="round" data-go="#/" aria-label="Назад">${icon('back')}</button>${cupsPill(R.bal.balance)}</div>
    <div class="col"><span class="hand-m accent">${empty ? 'пока пустовато' : 'уютно у нас'}</span><h1 class="h1">Наша комната</h1></div>
    <div class="stack-s">
      <div class="scene-vp" data-vp>${sceneHTML({ have: R.have, placed: S.room.placed })}<div class="scene-hot" data-hot></div></div>
      <div class="row between"><div class="row" style="gap:6px" data-dots><span class="dot on"></span><span class="dot"></span><span class="t-sub" style="margin-left:6px" data-hint>листайте →</span></div>
        <button class="pill-btn" data-go="#/room/dream">${icon('sparkle', 16)}Комната мечты</button></div>
    </div>
    ${empty ? `<div class="note"><div class="hand-m">как это работает</div><div class="t-body">За походы вместе — достижения и стаканчики: +1 за каждый визит и награды за достижения. На стаканчики покупаются вещи, и комната становится уютнее.</div></div>` : ''}
    ${!S.hasRoom && !S.demo ? `<div class="kind-hint" style="cursor:default">${icon('lock', 18)}<span>Чтобы покупки сохранялись, нужно один раз запустить <b>003_room.sql</b> в Supabase (SQL Editor).</span></div>` : ''}
    <div class="room-tiles">
      <button class="card rtile" data-go="#/room/inv"><span class="bub" style="background:var(--sage)">${icon('box')}</span><span class="t-cards">Инвентарь</span><span class="t-sub">${R.have.size ? `${R.have.size} ${thingsWord(R.have.size)}` : 'пусто'}</span></button>
      <button class="card rtile" data-go="#/room/shop"><span class="bub" style="background:var(--peach)">${icon('bag')}</span><span class="t-cards">Магазин</span><span class="t-sub">${SHOP.length} товаров</span></button>
      <button class="card rtile" data-go="#/room/ach"><span class="bub" style="background:var(--butter)">${icon('star')}</span><span class="t-cards">Достижения</span><span class="t-sub">${R.got.size} из ${ACHIEVEMENTS.length}</span></button>
    </div>
    <button class="link-btn" data-go="#/invite" style="align-self:center;font-size:15px">Участники и код приглашения</button>
  </div>${navHTML('r')}`;
  bindCommon();
  bindScene(R);
  checkStorageWarning();
}

// листание половинок, нажатие на экран проектора и на места с вещами
function bindScene(R) {
  const vp = $('[data-vp]'); if (!vp) return;
  const dots = $('[data-dots]');
  vp.addEventListener('scroll', () => {
    const right = vp.scrollLeft > vp.clientWidth / 2;
    dots.children[0].classList.toggle('on', !right); dots.children[1].classList.toggle('on', right);
    $('[data-hint]').textContent = right ? '← обратно' : 'листайте →';
  }, { passive: true });
  $('[data-hint]').onclick = () => vp.scrollTo({ left: vp.scrollLeft > 10 ? 0 : vp.scrollWidth, behavior: 'smooth' });
  // зоны нажатия: экран проектора — «Наша плёнка», вещи — что поставить на это место
  const hot = $('[data-hot]');
  const shown = arrangement(R.have, S.room.placed);
  const slots = new Set(ITEMS.filter(it => R.have.has(it.id)).map(it => it.slot));
  const zones = [...slots].map(slot => {
    const its = ITEMS.filter(i => i.slot === slot);
    const cur = shown.find(i => i.slot === slot) || its.find(i => R.have.has(i.id));
    return { slot, box: cur.box, z: cur.z };
  }).sort((a, b) => a.z - b.z);
  hot.innerHTML = `<button class="hz" data-screen aria-label="Экран проектора" style="${boxStyle(SCREEN_BOX)};z-index:21"></button>` +
    zones.map(zn => `<button class="hz" data-slot="${zn.slot}" aria-label="${esc(SLOT_NAMES[zn.slot])}" style="${boxStyle(zn.box)};z-index:${zn.z}"></button>`).join('');
  hot.querySelector('[data-screen]').onclick = () => screenPill(hot);
  hot.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => slotSheet(b.dataset.slot));
}
// нажали на экран — всплывает «Наша плёнка», нажали ещё раз — открывается
function screenPill(hot) {
  let pill = hot.querySelector('.film-pill');
  if (pill) { pill.remove(); return storageSheet(); }
  pill = document.createElement('button');
  pill.className = 'film-pill'; pill.innerHTML = `${icon('film', 16)}Наша плёнка`;
  pill.style.cssText = `left:${pct(466, 720)};top:${pct(117, 330)}`;
  pill.onclick = e => { e.stopPropagation(); pill.remove(); storageSheet(); };
  hot.appendChild(pill);
  setTimeout(() => pill.remove(), 4000);
}

// ----- 23 Выбор вещи для места
function slotSheet(slot) {
  const R = roomCalc();
  const its = ITEMS.filter(i => i.slot === slot);
  const cur = arrangement(R.have, S.room.placed).find(i => i.slot === slot);
  let sel = cur?.id || its.find(i => R.have.has(i.id))?.id;
  const { el, close } = openSheet('<div data-body class="stack-m" style="gap:20px"></div>');
  const body = el.querySelector('[data-body]');
  const draw = () => {
    body.innerHTML = `<div class="stack-xs"><h2 class="h2">${esc(SLOT_NAMES[slot])}</h2><span class="t-sub">${its.length > 1 ? 'Что поставим сюда?' : 'Эта вещь стоит здесь'}</span></div>
      <div class="pick-row">${its.map(it => {
        const own = R.have.has(it.id);
        const st = it.id === cur?.id ? 'стоит' : own ? 'в инвентаре' : it.price ? 'в магазине' : 'трофей';
        return `<button class="pick ${sel === it.id ? 'on' : ''} ${own ? '' : 'off'}" data-it="${it.id}"><span class="pick-img" style="background:var(--${it.tile})"><img src="${it.art}" alt=""></span>
          <span class="t-cap">${esc(it.name)}</span><span class="t-sub" style="font-size:13px">${st}</span></button>`;
      }).join('')}</div>
      <div class="col" style="gap:4px"><button class="btn" data-put ${!sel || sel === cur?.id || !R.have.has(sel) ? 'disabled' : ''}>Поставить</button>
      ${cur ? `<button class="link-btn danger" data-rm style="padding:8px">Убрать с этого места</button>` : ''}</div>`;
    body.querySelectorAll('[data-it]').forEach(b => b.onclick = () => {
      const it = itemById(b.dataset.it);
      if (!R.have.has(it.id)) { close(); return itemSheet(it); }
      sel = it.id; draw();
    });
    body.querySelector('[data-put]').onclick = async e => {
      e.currentTarget.disabled = true;
      try { await roomPlace(slot, sel); close(); render(); } catch (err) { if (err.message !== 'silent') handleErr(err); }
    };
    body.querySelector('[data-rm]')?.addEventListener('click', async () => {
      try { await roomPlace(slot, null); close(); render(); toast('Убрали в инвентарь'); } catch (err) { if (err.message !== 'silent') handleErr(err); }
    });
  };
  draw();
}

// ----- 24 Магазин
function renderShop(q) {
  const R = roomCalc();
  const cat = q.get('c') || 'all';
  const list = ITEMS.filter(it => cat === 'all' ? true : cat === 'trophy' ? !it.price : it.cat === cat && (it.price || cat !== 'all'));
  app.innerHTML = `<div class="screen">
    <div class="head"><div class="title"><button class="round" data-go="#/room" aria-label="Назад">${icon('back')}</button><h1 class="h1">Магазин</h1></div>${cupsPill(R.bal.balance)}</div>
    <div class="chips">${CATS.map(([k, n]) => `<button class="chip ${cat === k ? 'active' : ''}" data-go="#/room/shop${k === 'all' ? '' : '?c=' + k}">${n}</button>`).join('')}</div>
    <div class="grid2">${list.map(it => shopCardHTML(it, R)).join('')}</div>
    <p class="t-sub center" style="margin:0">Трофеи не продаются — только заслужить достижениями.</p>
  </div>${navHTML('r')}`;
  bindCommon();
  on('[data-item]', 'click', (e, el) => itemSheet(itemById(el.dataset.item)));
}
function priceTag(it, R) {
  if (R.have.has(it.id)) return `<span class="ptag own">${icon('check', 16)}есть</span>`;
  if (!it.price) return `<span class="ptag trophy">${icon('trophy', 16)}трофей</span>`;
  return `<span class="ptag ${R.bal.balance >= it.price ? '' : 'dim'}">${icon('cup', 16)}${it.price}</span>`;
}
function shopCardHTML(it, R) {
  return `<button class="card scard" data-item="${it.id}"><span class="scard-img" style="background:var(--${it.tile})"><img src="${it.art}" alt="" loading="lazy"></span>
    <span class="t-cards">${esc(it.name)}</span>${priceTag(it, R)}</button>`;
}
// Превью в магазине: кусочек нашей комнаты, приближенный к месту, куда встанет вещь
const PREV_RATIO = 16 / 9;
function previewCrop(it) {
  const [x, y, w, h] = it.box;
  let cw = Math.max(w * 2.4, h * 2 * PREV_RATIO, 330);
  cw = Math.min(cw, 330 * PREV_RATIO, 720);
  const ch = cw / PREV_RATIO;
  const cx = Math.min(Math.max(x + w / 2 - cw / 2, 0), 720 - cw), cy = Math.min(Math.max(y + h / 2 - ch / 2, 0), 330 - ch);
  return { cx, cy, cw, ch };
}
function previewHTML(it, R, withItem) {
  const have = new Set(R.have), placed = { ...S.room.placed };
  if (withItem) { have.add(it.id); placed[it.slot] = it.id; }
  const { cx, cy, cw, ch } = previewCrop(it);
  return `<div class="prev-scene" style="width:${(720 / cw * 100).toFixed(3)}%;left:${(-cx / cw * 100).toFixed(3)}%;top:${(-cy / ch * 100).toFixed(3)}%">${sceneHTML({ have, placed, fresh: withItem ? it.id : null })}</div>`;
}
function itemSheet(it) {
  const R = roomCalc();
  const occupant = arrangement(R.have, S.room.placed).find(x => x.slot === it.slot && x.id !== it.id);
  const own = R.have.has(it.id);
  const ach = it.price ? null : ACHIEVEMENTS.find(a => a.item === it.id);
  const lack = it.price ? it.price - R.bal.balance : 0;
  const placedNow = arrangement(R.have, S.room.placed).some(x => x.id === it.id);
  const showOcc = occupant && !placedNow;
  const cap = placedNow ? 'Уже стоит в вашей комнате'
    : showOcc ? `Встанет здесь, а «${occupant.name}» отправится в инвентарь`
    : ach && !own ? `Так будет, когда получите «${ach.name}»` : 'Так встанет в вашей комнате';
  const { el, close } = openSheet(`${FILTERS_SVG}<div class="stack-xs"><div class="item-prev" data-prev>${previewHTML(it, R, true)}</div>
      ${showOcc ? `<div class="segmented small" data-cmp><button data-v="0">сейчас</button><button class="on" data-v="1">с новой вещью</button></div>` : ''}
      <span class="t-sub center" data-cap>${esc(cap)}</span></div>
    <div class="stack-xs center" style="align-items:center"><h2 class="h2">${esc(it.name)}</h2><span class="t-sub">${esc([it.note, SLOT_NAMES[it.slot]].filter((v, i, arr) => v && !(i === 0 && arr[1] && arr[1].toLowerCase().includes(v.toLowerCase()))).join(' · '))}</span></div>
    ${ach ? `<div class="kind-hint" style="cursor:default">${icon('trophy', 18)}<span>Трофей за «${esc(ach.name)}»: ${esc(ach.text.toLowerCase())}. ${own ? 'Уже ваш!' : `Сейчас ${Math.min(ach.value(R.stats), ach.goal)} из ${ach.goal}.`}</span></div>` : ''}
    ${own ? `<button class="btn" data-place ${placedNow ? 'disabled' : ''}>${placedNow ? 'Уже стоит в комнате' : 'Поставить в комнату'}</button>`
      : it.price ? `<button class="btn" data-buy ${lack > 0 ? 'disabled' : ''}>${icon('cup')}${lack > 0 ? `Не хватает ${lack} ${cupsGen(lack)}` : `Купить за ${it.price}`}</button>
        <span class="t-sub center" style="margin-top:-8px">У вас ${R.bal.balance} ${cupsWord(R.bal.balance)}${lack > 0 ? ' — +1 за каждый визит и награды за достижения' : ''}</span>`
      : `<button class="btn ghost on-card" data-ach>К достижениям</button>`}`);
  // «сейчас / с вещью» — сравнить, если вещь займёт чьё-то место
  el.querySelectorAll('[data-cmp] [data-v]').forEach(b => b.onclick = () => {
    const v = b.dataset.v === '1';
    el.querySelectorAll('[data-cmp] [data-v]').forEach(x => x.classList.toggle('on', x === b));
    el.querySelector('[data-prev]').innerHTML = previewHTML(it, R, v);
    el.querySelector('[data-cap]').textContent = v ? cap : `Сейчас здесь «${occupant.name}»`;
  });
  el.querySelector('[data-buy]')?.addEventListener('click', async e => {
    const btn = e.currentTarget; btn.disabled = true;
    try {
      // что сейчас стоит на этом месте — новая вещь его не сдвигает, а ложится в инвентарь
      const before = arrangement(R.have, S.room.placed).find(x => x.slot === it.slot);
      await roomBuy(it.id);
      if (S.room.placed[it.slot] === null) await roomPlace(it.slot, it.id);          // место было пустым — ставим
      else if (before && !(it.slot in S.room.placed)) await roomPlace(it.slot, before.id);
      close(); render(); toast(before ? `Купили! «${it.name}» — в инвентаре` : `Купили! «${it.name}» уже в комнате 💛`);
    } catch (err) { if (err.message !== 'silent') handleErr(err); btn.disabled = false; }
  });
  el.querySelector('[data-place]')?.addEventListener('click', async () => {
    try { await roomPlace(it.slot, it.id); close(); go('#/room'); toast('Поставили'); } catch (err) { if (err.message !== 'silent') handleErr(err); }
  });
  el.querySelector('[data-ach]')?.addEventListener('click', () => { close(); go('#/room/ach'); });
}

// ----- Инвентарь: всё, что у нас есть
function renderInventory() {
  const R = roomCalc();
  const shown = new Set(arrangement(R.have, S.room.placed).map(i => i.id));
  const list = ITEMS.filter(it => R.have.has(it.id));
  app.innerHTML = `<div class="screen">
    <div class="head"><div class="title"><button class="round" data-go="#/room" aria-label="Назад">${icon('back')}</button><h1 class="h1">Инвентарь</h1></div>${cupsPill(R.bal.balance)}</div>
    ${list.length ? `<p class="t-sub" style="margin:0">Нажмите на вещь, чтобы поставить её или убрать. Ещё можно нажать прямо на вещь в комнате.</p>
      <div class="grid2">${list.map(it => `<button class="card scard" data-slot="${it.slot}"><span class="scard-img" style="background:var(--${it.tile})"><img src="${it.art}" alt="" loading="lazy"></span>
        <span class="t-cards">${esc(it.name)}</span><span class="ptag ${shown.has(it.id) ? 'own' : 'plain'}">${shown.has(it.id) ? icon('check', 16) + 'в комнате' : 'в инвентаре'}</span></button>`).join('')}</div>`
      : `<div class="empty"><div class="stack-xs"><h2 class="h2">Пока пусто</h2><p class="t-body muted" style="margin:0">Купите первую вещь в магазине — стаканчики дают за походы вместе.</p></div><button class="btn" data-go="#/room/shop">В магазин</button></div>`}
  </div>${navHTML('r')}`;
  bindCommon();
  on('[data-slot]', 'click', (e, el) => slotSheet(el.dataset.slot));
}

// ----- 25 Достижения
function achIconHTML(a, got) { return `<span class="ach-ic ${got ? 'got' : ''}">${icon(a.icon, 22)}</span>`; }
function rewardHTML(a) { return a.cups ? `<span class="ptag">${icon('cup', 16)}+${a.cups}</span>` : `<span class="ptag trophy">${icon('trophy', 16)}${esc(itemById(a.item).name)}</span>`; }
function renderAchievements() {
  const R = roomCalc();
  const done = ACHIEVEMENTS.filter(a => R.got.has(a.id)).sort((a, b) => R.got.get(b.id).localeCompare(R.got.get(a.id)));
  const todo = ACHIEVEMENTS.filter(a => !R.got.has(a.id)).sort((a, b) => (b.value(R.stats) / b.goal) - (a.value(R.stats) / a.goal));
  const card = a => {
    const g = R.got.has(a.id), v = Math.min(a.value(R.stats), a.goal);
    return `<button class="card ach ${g ? '' : 'todo'}" data-ach="${a.id}">${achIconHTML(a, g)}
      <span class="col grow" style="gap:2px"><span class="t-cards">${esc(a.name)}</span><span class="t-sub">${esc(a.text)}</span>
      ${g ? `<span class="t-cap accent">${fmtDate(R.got.get(a.id))}</span>` : `<span class="pbar"><span style="width:${(v / a.goal * 100).toFixed(1)}%"></span></span><span class="t-cap muted">${v}/${a.goal}</span>`}</span>
      ${rewardHTML(a)}</button>`;
  };
  app.innerHTML = `<div class="screen">
    <div class="head"><button class="round" data-go="#/room" aria-label="Назад">${icon('back')}</button><span class="cups static">${R.got.size} из ${ACHIEVEMENTS.length}</span></div>
    <div class="col"><span class="hand-m accent">за походы вместе</span><h1 class="h1">Достижения</h1></div>
    <div class="col ach-list" style="gap:10px">${done.map(card).join('')}${todo.map(card).join('')}</div>
  </div>${navHTML('r')}`;
  bindCommon();
  on('[data-ach]', 'click', (e, el) => achSheet(achById(el.dataset.ach)));
}
// 36 Достижение подробно: что считается и какие места уже засчитаны
function achSheet(a) {
  const R = roomCalc();
  const g = R.got.has(a.id), v = Math.min(a.value(R.stats), a.goal), left = a.goal - v;
  const k = a.kind ? kindById(a.kind) : null;
  const counted = k ? S.places.filter(p => (p.kinds || []).includes(k.id) && isBeen(p)) : [];
  openSheet(`<div class="row" style="gap:14px">${achIconHTML(a, true).replace('ach-ic', 'ach-ic big')}<div class="col grow" style="gap:2px"><h2 class="h2">${esc(a.name)}</h2>
      <span class="t-sub">${esc(a.text)} · ${a.cups ? `+${a.cups} ${cupsWord(a.cups)}` : `трофей «${esc(itemById(a.item).name)}»`}</span></div></div>
    <div class="stack-xs"><div class="row between"><span class="t-bold">${v} из ${a.goal}</span><span class="t-bold accent">${g ? `получено ${fmtDayMonth(R.got.get(a.id))}` : `ещё ${left}`}</span></div>
      <span class="pbar big"><span style="width:${(v / a.goal * 100).toFixed(1)}%"></span></span></div>
    ${k ? `<div class="card info" style="background:var(--paper)"><div class="row wrap" style="gap:8px"><span class="t-body">${a.visitsKind ? 'Считаются походы в места с отметкой' : 'Считаются разные места с отметкой'}</span><span class="chip kind on">${icon('kind-' + k.id, 18)}${k.name}</span></div>
      <span class="t-sub">${a.visitsKind ? 'Каждый визит засчитывается отдельно.' : 'Повторный визит в то же место не добавляет.'} Отметка ставится в карточке места: «Что это за место?».</span></div>
      ${counted.length ? `<div class="stack-xs"><span class="t-bold">Уже засчитаны</span><div class="chips">${counted.slice(0, 8).map(p => `<span class="chip paper">${esc(shortName(p.name))}</span>`).join('')}${counted.length > 8 ? `<span class="chip paper">+ ещё ${counted.length - 8}</span>` : ''}</div></div>` : ''}` : ''}`);
}

// ----- 26 Новое достижение
function maybeCelebrate() {
  if (!S.space || document.querySelector('.overlay') || isFormRoute() || (!S.session && !S.demo)) return;
  const R = roomCalc();
  const key = 'shodim-ach-' + S.space.id;
  let seen = null; try { seen = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* пусто */ }
  // первый запуск на этом телефоне: старые достижения не поздравляем по одному — одно общее окно
  if (!Array.isArray(seen)) {
    try { localStorage.setItem(key, JSON.stringify([...R.got.keys()])); } catch { /* нет места */ }
    if (R.got.size) welcomeModal(R);
    return;
  }
  const fresh = [...R.got.keys()].filter(id => !seen.includes(id));
  if (!fresh.length) return;
  seen.push(fresh[0]); try { localStorage.setItem(key, JSON.stringify(seen)); } catch { /* нет места */ }
  achModal(achById(fresh[0]), () => setTimeout(maybeCelebrate, 300));
}
function welcomeModal(R) {
  const n = R.got.size, cups = R.bal.balance;
  const list = ACHIEVEMENTS.filter(a => R.got.has(a.id)).sort((a, b) => R.got.get(a.id).localeCompare(R.got.get(b.id)));
  const conf = Array.from({ length: 14 }, (_, i) => `<i style="left:${(i * 37) % 100}%;top:${(i * 53) % 90}%;background:var(--${['peach', 'sage', 'butter', 'sky', 'rose'][i % 5]});transform:rotate(${i * 47}deg)"></i>`).join('');
  const { el, close } = openSheet(`<div class="confetti">${conf}</div>
    <div class="col center" style="align-items:center;gap:6px;position:relative">
      <span class="ach-ic big got" style="width:84px;height:84px">${icon('home', 36)}</span>
      <span class="hand-m accent" style="margin-top:8px">добро пожаловать в комнату!</span>
      <h2 class="h2">У нас уже ${n} ${plural(n, 'достижение', 'достижения', 'достижений')}</h2>
      <span class="t-sub">${cups > 0 ? `и ${cups} ${cupsWord(cups)} — можно что-нибудь купить для комнаты` : 'за походы вместе — дальше будет ещё больше'}</span>
      <div class="chips" style="justify-content:center;margin-top:8px">${list.slice(0, 6).map(a => `<span class="chip paper">${icon(a.icon, 16)}${esc(a.name)}</span>`).join('')}${n > 6 ? `<span class="chip paper">+ ещё ${n - 6}</span>` : ''}</div></div>
    <div class="col" style="gap:4px;position:relative"><button class="btn" data-go2>Посмотреть комнату</button><button class="link-btn" data-later>Позже</button></div>`, { center: true });
  el.querySelector('[data-go2]').onclick = () => { close(); go('#/room'); };
  el.querySelector('[data-later]').onclick = close;
}
function achModal(a, after) {
  const it = a.item ? itemById(a.item) : null;
  // новый трофей сам встаёт в комнату; то, что стояло на его месте, уходит в инвентарь
  let moved = null;
  if (it) {
    const R = roomCalc(), cur = arrangement(R.have, S.room.placed).find(x => x.slot === it.slot);
    if (cur && cur.id !== it.id) { moved = cur; if (S.demo || S.hasRoom) roomPlace(it.slot, it.id).catch(() => {}); }
  }
  const conf = Array.from({ length: 14 }, (_, i) => `<i style="left:${(i * 37) % 100}%;top:${(i * 53) % 90}%;background:var(--${['peach', 'sage', 'butter', 'sky', 'rose'][i % 5]});transform:rotate(${i * 47}deg)"></i>`).join('');
  const { el, close } = openSheet(`<div class="confetti">${conf}</div>
    <div class="col center" style="align-items:center;gap:6px;position:relative">
      <span class="ach-ic big got" style="width:84px;height:84px">${it ? `<img src="${it.art}" alt="" style="width:60px;height:60px;object-fit:contain">` : icon(a.icon, 34)}</span>
      <span class="hand-m accent" style="margin-top:8px">новое достижение!</span><h2 class="h2">${esc(a.name)}</h2><span class="t-sub">${esc(a.text)}</span>
      <span class="ptag" style="margin-top:8px;padding:8px 16px">${a.cups ? `${icon('cup', 18)}+${a.cups} ${cupsWord(a.cups)}` : `${icon('trophy', 18)}трофей: ${esc(it.name)}`}</span>
      ${moved ? `<span class="t-sub" style="margin-top:6px">«${esc(it.name)}» уже в комнате, а «${esc(moved.name)}» убрали в инвентарь — вернуть можно в любой момент.</span>` : ''}</div>
    <div class="col" style="gap:4px;position:relative"><button class="btn" data-ok>Ура!</button><button class="link-btn danger" data-more>${a.cups ? 'В магазин' : 'Посмотреть в комнате'}</button></div>`, { center: true, onClose: () => { if (moved && /^#\/room/.test(location.hash)) render(); after?.(); } });
  el.querySelector('[data-ok]').onclick = close;
  el.querySelector('[data-more]').onclick = () => { close(); go(a.cups ? '#/room/shop' : '#/room'); };
}

// ----- 33 Комната мечты: всё целиком, чего нет — с замочком
function renderDream() {
  const R = roomCalc();
  const total = ITEMS.length, n = ITEMS.filter(it => R.have.has(it.id)).length;
  const next = SHOP.filter(it => !R.have.has(it.id)).sort((a, b) => a.price - b.price)[0];
  const hint = next ? (R.bal.balance >= next.price ? `Уже хватает на «${next.name}» — загляните в магазин!` : `Ближайшее: ${next.name.toLowerCase()}, не хватает ${next.price - R.bal.balance} ${cupsGen(next.price - R.bal.balance)}.`) : 'Все вещи из магазина уже ваши!';
  const half = side => `<div class="scene-half ${side}">${sceneHTML({ have: R.have, placed: S.room.placed, dream: true })}</div>`;
  app.innerHTML = `${FILTERS_SVG}<div class="screen">
    <div class="head"><button class="round" data-go="#/room" aria-label="Назад">${icon('back')}</button><span class="pill-btn static" style="background:var(--butter)">${icon('sparkle', 16)}предпросмотр</span></div>
    <div class="col"><span class="hand-m accent">когда соберём всё</span><h1 class="h1">Комната мечты</h1></div>
    <div class="dream-halves">${half('left')}${half('right')}</div>
    <div class="card stack-xs" style="padding:14px 16px"><div class="row between"><span class="t-bold">Уже собрано ${n} из ${total} ${plural(total, 'вещи', 'вещей', 'вещей')}</span><span class="t-bold accent">${Math.round(n / total * 100)}%</span></div>
      <span class="pbar big"><span style="width:${(n / total * 100).toFixed(1)}%"></span></span>
      <span class="t-sub">С замочком — то, что ещё впереди. ${esc(hint)}</span></div>
    <button class="btn" data-go="#/room">Вернуться в нашу комнату</button>
  </div>`;
  bindCommon();
}

// ----- 30–32 «Наша плёнка»: сколько места занимают фото
const STORAGE_LIMIT = 1024 ** 3; // бесплатный Supabase — 1 ГБ
async function fetchUsage() {
  if (S.demo) return { bytes: 184 * 1024 ** 2, files: 540 };
  const { data, error } = await sb.rpc('storage_usage', { p_space: S.space.id });
  if (error) throw error;
  const r = Array.isArray(data) ? data[0] : data;
  return { bytes: Number(r?.bytes || 0), files: Number(r?.files || 0) };
}
const fmtMB = b => b >= 1024 ** 3 ? (b / 1024 ** 3).toFixed(2).replace('.', ',') + ' ГБ' : Math.round(b / 1024 ** 2) + ' МБ';
function filmStrip(p) {
  const N = 12, full = p * N;
  return `<div class="film-strip">${Array.from({ length: N }, (_, i) => `<span class="fr ${i < Math.floor(full) ? 'on c' + (i % 4) : ''}">${i === Math.floor(full) && full % 1 > .05 ? `<i style="height:${(full % 1 * 100).toFixed(0)}%"></i>` : ''}</span>`).join('')}</div>`;
}
async function storageSheet() {
  const { el, close } = openSheet(`<div class="stack-xs"><span class="hand-m accent">проектор рассказывает</span><h2 class="h2">Наша плёнка</h2><span class="t-sub">Место для фото в нашем облаке</span></div><div data-body><p class="t-sub">Считаем…</p></div>`);
  const body = el.querySelector('[data-body]');
  try {
    const u = await fetchUsage();
    const p = Math.min(1, u.bytes / STORAGE_LIMIT), avg = u.files ? u.bytes / u.files : 350 * 1024;
    const left = Math.max(0, Math.floor((STORAGE_LIMIT - u.bytes) / avg));
    body.className = 'stack-m';
    body.innerHTML = `${filmStrip(p)}
      <div class="row between" style="align-items:flex-end"><div class="col"><span class="h2">${fmtMB(u.bytes)}</span><span class="t-sub">занято из 1 ГБ · ${u.files} ${plural(u.files, 'файл', 'файла', 'файлов')}</span></div><span class="t-sec ${p >= .8 ? 'accent' : 'muted'}">${Math.round(p * 100)}%</span></div>
      <div class="note row" style="gap:12px;align-items:flex-start"><span class="round" style="width:40px;height:40px;color:var(--accent)">${icon('film', 20)}</span>
        <div class="col"><span class="t-bold">Хватит ещё примерно на ${left.toLocaleString('ru')} фото</span><span class="t-sub">Фото сжимаются при загрузке — в среднем ${Math.round(avg / 1024)} КБ</span></div></div>
      <button class="btn" data-ok>Понятно</button>`;
    body.querySelector('[data-ok]').onclick = close;
  } catch (err) {
    console.warn(err);
    body.innerHTML = `<p class="t-sub" style="margin:0">Не получилось посчитать. Если это первый запуск — нужно один раз выполнить 003_room.sql в Supabase.</p>`;
  }
}
// 32 Плёнка заканчивается — сами предупреждаем при 80%+, «Напомнить позже» = через неделю или +5%
async function checkStorageWarning() {
  if (S.storageChecked) return; S.storageChecked = true;
  if (S.demo && !/storagewarn/.test(location.search)) return;
  try {
    const u = S.demo ? { bytes: 860 * 1024 ** 2, files: 2500 } : await fetchUsage();
    const p = u.bytes / STORAGE_LIMIT;
    if (p < .8) return;
    let sn = null; try { sn = JSON.parse(localStorage.getItem('shodim-film-snooze') || 'null'); } catch { /* пусто */ }
    if (sn && Date.now() < sn.until && p < sn.p + .05) return;
    if (document.querySelector('.overlay')) return;
    const avg = u.files ? u.bytes / u.files : 350 * 1024, left = Math.max(0, Math.floor((STORAGE_LIMIT - u.bytes) / avg));
    const { el, close } = openSheet(`<div class="col center" style="align-items:center;gap:6px"><span class="ach-ic big got" style="background:var(--rose)">${icon('film', 30)}</span>
        <span class="hand-m accent" style="margin-top:6px">небольшое предупреждение</span><h2 class="h2">Плёнка заканчивается</h2>
        <span class="t-sub">Занято ${Math.round(p * 100)}% — места примерно на ${left.toLocaleString('ru')} фото. Можно удалить лишние фото или увеличить место в облаке.</span></div>
      ${filmStrip(Math.min(1, p))}
      <div class="col" style="gap:4px"><button class="btn" data-see>Посмотреть плёнку</button><button class="link-btn" data-later>Напомнить позже</button></div>`, { center: true });
    const later = () => { try { localStorage.setItem('shodim-film-snooze', JSON.stringify({ until: Date.now() + 7 * 864e5, p })); } catch { /* нет места */ } };
    el.querySelector('[data-see]').onclick = () => { later(); close(); storageSheet(); };
    el.querySelector('[data-later]').onclick = () => { later(); close(); };
  } catch (e) { console.warn(e); }
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
    P('p1', 'g1', 'Кофейня «Зерно»', ['кафе'], { kinds: ['cafe'], instagram: '@zerno.coffee', address: 'ул. Зыбицкая, 6', note: 'Говорят, тут лучшие круассаны в городе. Идти утром в выходные!', want_again: true }),
    P('p2', 'g1', 'Выставка керамики', ['выставки'], { kinds: ['art'], note: 'До 30 ноября' }),
    P('p3', 'g1', 'Ботанический сад', ['природа'], { kinds: ['nature'] }),
    P('p4', 'g1', 'Бар «Лампа»', ['на выходные'], { instagram: 'https://www.instagram.com/some.very.long.place.name.minsk/', address: 'https://yandex.by/maps/157/minsk/?ll=27.553463%2C53.897114&mode=poi&poi%5Bpoint%5D=27.553399%2C53.897201&poi%5Buri%5D=ymapsbm1%3A%2F%2Forg%3Foid%3D123', note: 'Оченьдлинноесловобезпробеловкотороенедолжновылезатьзакрайэкрана' }),
    P('p5', 'g2', 'Пекарня у вокзала', ['кафе'], { kinds: ['cafe'] }),
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
  S.hasRoom = S.hasKinds = true;
  S.room = { owned: ['armchair', 'monstera'], placed: {} };
  if (new URLSearchParams(location.search).has('full')) S.room.owned = SHOP.map(i => i.id);
  for (const o of new URLSearchParams(location.search).getAll('own')) S.room.owned.push(o);
  for (const pl of new URLSearchParams(location.search).getAll('place')) { const [sl, it] = pl.split(':'); S.room.placed[sl] = it; }
  try { localStorage.setItem('shodim-ach-demo', JSON.stringify(ACHIEVEMENTS.map(a => a.id))); } catch { /* нет места */ }
  S.photos = [F('f1', 'v3', fake('a', '#CFE0C3', '#8FAE82'), 0), F('f2', 'v3', fake('b', '#E4EEDD', '#B5CBA8'), 1), F('f3', 'v3', fake('c', '#D3E0C9', '#6F8A64'), 2),
    F('f4', 'v4', fake('d', '#F8E4E5', '#DDAEB2'), 0), F('f5', 'v4', fake('e', '#FBF2D8', '#E5CF8E'), 1), F('f6', 'v1', (S.urls.set('demo/tall', 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="540"><rect width="300" height="540" fill="#CFDDE6"/><circle cx="150" cy="170" r="60" fill="#F0CFD1"/><rect x="80" y="250" width="140" height="220" rx="40" fill="#8FB3CC"/></svg>')), 'demo/tall'), 0)];
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
      addtravel: () => addPlace(), switch: () => switchSpaceSheet(), viewer: () => document.querySelector('[data-ph="1"]')?.click(), viewer2: () => { const v = [...document.querySelectorAll('[data-ph]')]; v[v.length - 2]?.click(); },
      pick: () => pickPoint({ lat: 53.9071, lng: 27.5529, title: 'Кофейня «Зерно»', query: new URLSearchParams(location.search).get('pq') || '', onDone: () => {} }),
      ach: () => achModal(achById(id || 'regulars')), welcome: () => welcomeModal(roomCalc()), achd: () => achSheet(achById(id || 'gourmets')), slot: () => slotSheet(id || 'floorL'),
      item: () => itemSheet(itemById(id || 'sofa')), film: () => storageSheet(),
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
