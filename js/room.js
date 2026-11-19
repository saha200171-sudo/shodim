// =========================================================
// Комната: вещи, достижения, стаканчики. Только данные и подсчёты — без интерфейса.
// Координаты вещей — в системе сцены 720×330 (как «Комната · широкая» в Figma).
// =========================================================

export const SCENE_W = 720, SCENE_H = 330;

// Типы мест для достижений (строка «Что это за место?» в форме)
export const KINDS = [
  { id: 'cafe', name: 'Кафе', acc: 'кафе', icon: '<path d="M4 8h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 9h2a2.5 2.5 0 0 1 0 5h-2"/><path d="M8 2.5c0 1 .8 1.2.8 2.2S8 6 8 6M12 2.5c0 1 .8 1.2.8 2.2S12 6 12 6"/>',
    words: ['кафе', 'кофе', 'кофейня', 'кофейни', 'бар', 'ресторан', 'рестораны', 'пекарня', 'завтрак', 'завтраки', 'бранч', 'чайная', 'кондитерская', 'десерты', 'еда', 'бистро', 'пиццерия', 'суши', 'бургеры', 'ужин', 'обед', 'вино', 'паб', 'coffee', 'cafe', 'bar'] },
  { id: 'kino', name: 'Кино', acc: 'кино', icon: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M3 8l2.5-4.5L21 6"/><path d="M8.5 4.5L10 7.5M14 5l1.5 3"/>',
    words: ['кино', 'кинотеатр', 'фильм', 'фильмы', 'сеанс', 'премьера', 'мультик', 'мультфильм', 'cinema', 'movie'] },
  { id: 'art', name: 'Выставка', acc: 'выставку', icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    words: ['выставка', 'выставки', 'музей', 'музеи', 'галерея', 'галереи', 'искусство', 'арт', 'экспозиция', 'театр', 'спектакль', 'опера', 'балет', 'art', 'museum', 'gallery'] },
  { id: 'nature', name: 'Природа', acc: 'природу', icon: '<path d="M5 20c0-8 5-14 15-15-1 10-7 15-15 15z"/><path d="M5 20l8-8"/>',
    words: ['природа', 'парк', 'парки', 'лес', 'озеро', 'река', 'море', 'пляж', 'горы', 'сад', 'ботанический', 'прогулка', 'пикник', 'закат', 'рассвет', 'поход', 'заповедник', 'nature', 'park'] },
  { id: 'extreme', name: 'Экстрим', acc: 'экстрим', icon: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    words: ['экстрим', 'картинг', 'батут', 'батуты', 'скалодром', 'роллердром', 'каток', 'квадроциклы', 'прыжок', 'парашют', 'сапы', 'сап', 'серф', 'вейк', 'зиплайн', 'тарзанка', 'веревочный', 'пейнтбол', 'лазертаг', 'квест', 'аттракционы', 'сноуборд', 'лыжи', 'extreme'] },
];
export const kindById = id => KINDS.find(k => k.id === id);
// какие типы подходят по своим тегам и по какому именно тегу (для подсказки)
export function kindHints(tags) {
  const out = [];
  for (const k of KINDS) {
    const t = (tags || []).find(t => String(t).toLowerCase().split(/[^a-zа-яё]+/i).some(w => k.words.includes(w)));
    if (t) out.push({ kind: k.id, tag: t });
  }
  return out;
}
// Подсказка по своим тегам: «кофейня» → Кафе
export function kindsFromTags(tags) {
  const out = new Set();
  for (const t of tags || []) {
    const words = String(t).toLowerCase().split(/[^a-zа-яё]+/i).filter(Boolean);
    for (const k of KINDS) if (words.some(w => k.words.includes(w))) out.add(k.id);
  }
  return [...out];
}

// ---------- Вещи ----------
// slot — место в комнате. На одно место можно поставить одну из вещей (кресло / диванчик / пуфик).
// art — файл в room/, box — [x, y, w, h] в сцене, z — порядок слоёв (больше — ближе).
// price — цена в стаканчиках (у трофеев нет — их только заслужить).
const I = (id, name, slot, box, z, extra) => ({ id, name, slot, box, z, art: `room/${id}.svg`, ...extra });
export const ITEMS = [
  // --- потолок
  I('garland', 'Гирлянда', 'ceil', [7.7, 7.9, 344.4, 44.2], 30, { price: 6, cat: 'ceil', tile: 'butter', note: 'лампочки на проводе над окном' }),
  I('lanterns', 'Бумажные фонарики', 'ceil2', [365, 0, 309, 77], 31, { price: 8, cat: 'ceil', tile: 'rose', note: 'над кинозоной' }),
  // --- стены
  I('photowall', 'Фотостена', 'wallL', [23.3, 52.1, 89, 111], 20, { price: 5, cat: 'walls', tile: 'peach', note: 'полароиды на скотче' }),
  I('clock', 'Часы', 'wallL', [36, 66, 60, 60], 20, { price: 3, cat: 'walls', tile: 'lav' }),
  I('bookshelf', 'Полка с книгами', 'wallR', [252, 80, 88, 47.5], 21, { price: 6, cat: 'walls', tile: 'sage', note: 'книги и цветочек' }),
  I('painting', 'Картина', 'wallR', [258, 66, 76, 62], 21, { trophy: 'art5', cat: 'walls', tile: 'butter' }),
  // --- окно
  I('curtains', 'Шторы', 'curtains', [104, 34, 152, 130], 12, { price: 4, cat: 'window', tile: 'rose', note: 'розовые' }),
  I('globe', 'Глобус', 'sill', [190.9, 115, 26.9, 32.5], 14, { trophy: 'trip1', cat: 'window', tile: 'sky' }),
  I('cactus', 'Кактус', 'sill', [191.5, 114, 26, 34], 14, { price: 3, cat: 'window', tile: 'sage', note: 'на подоконник' }),
  I('balloon', 'Воздушный шар', 'balloon', [141.5, 63, 29, 47], 11, { trophy: 'extreme5', cat: 'window', tile: 'sky', note: 'летает за окном' }),
  // --- уютный угол (левая половина)
  I('armchair', 'Кресло', 'floorL', [18, 178, 118, 104], 50, { price: 5, cat: 'floor', tile: 'sage', note: 'мятное, с подушкой' }),
  I('sofa', 'Диванчик', 'floorL', [14, 203, 124, 77.5], 50, { price: 8, cat: 'floor', tile: 'sky', note: 'вместо кресла' }),
  I('pouf', 'Пуфик', 'floorL', [46, 230, 60, 51], 50, { price: 3, cat: 'floor', tile: 'rose' }),
  I('rug', 'Круглый ковёр', 'rugL', [98, 286, 164, 36], 40, { price: 4, cat: 'floor', tile: 'peach', note: 'розовый' }),
  I('table', 'Столик', 'table', [140, 228.7, 80, 69.3], 52, { price: 5, cat: 'floor', tile: 'butter', note: 'с двумя айс-латте' }),
  I('monstera', 'Монстера', 'floorR', [260.8, 173, 88.5, 123], 51, { price: 4, cat: 'floor', tile: 'butter' }),
  I('torch', 'Торшер', 'floorR', [268, 176, 76, 119], 51, { price: 4, cat: 'floor', tile: 'sky' }),
  I('cat', 'Кот', 'pet', [232, 258, 43.2, 49], 60, { trophy: 'fifty', cat: 'floor', tile: 'lav', note: 'живёт в комнате' }),
  // --- кинозона (правая половина)
  I('film', 'Проектор', 'film', [398, 80, 136, 74], 23, { trophy: 'cinema10', cat: 'cinema', tile: 'peach', note: 'включает плёнку на экране' }),
  I('bluerug', 'Синий ковёр', 'rugR', [352, 292, 236, 26], 41, { price: 4, cat: 'cinema', tile: 'sky', note: 'под креслами-мешками' }),
  I('beanbags', 'Кресла-мешки', 'bags', [362.1, 230.7, 215.4, 69.3], 55, { price: 10, cat: 'cinema', tile: 'rose', note: 'розовое и жёлтое' }),
  I('popcorn', 'Попкорн', 'popcorn', [453.5, 248.5, 33, 53.6], 56, { trophy: 'cinema20', cat: 'cinema', tile: 'butter' }),
  I('skate', 'Скейт и шлем', 'skate', [554.4, 74, 106.4, 115.3], 24, { trophy: 'adrenaline', cat: 'cinema', tile: 'sky' }),
  I('shelving', 'Стеллаж', 'shelving', [654, 150, 60, 150], 45, { price: 12, cat: 'cinema', tile: 'peach', note: 'полки для трофеев' }),
  I('goldcup', 'Золотой стаканчик', 'goldcup', [660, 97.7, 44, 52.3], 46, { trophy: 'coffee50', cat: 'cinema', tile: 'butter', note: 'на стеллаже' }),
  I('cart', 'Кофейная тележка', 'cart', [598, 196, 46, 104], 47, { trophy: 'coffee30', cat: 'cinema', tile: 'sage', note: 'у стеллажа' }),
];
export const itemById = id => ITEMS.find(i => i.id === id);
export const SHOP = ITEMS.filter(i => i.price);
export const SHOP_TOTAL = SHOP.reduce((s, i) => s + i.price, 0); // 94
export const SLOT_NAMES = {
  ceil: 'Потолок', ceil2: 'Потолок над кинозоной', wallL: 'Стена слева', wallR: 'Стена справа', curtains: 'Окно', sill: 'Подоконник', balloon: 'За окном',
  floorL: 'Пол слева', rugL: 'Ковёр', table: 'Столик', floorR: 'Пол справа', pet: 'Питомец', film: 'Экран', rugR: 'Ковёр в кинозоне', bags: 'Кресла',
  popcorn: 'Попкорн', skate: 'Крючки на стене', shelving: 'Стеллаж', goldcup: 'Верх стеллажа', cart: 'Тележка',
};
export const CATS = [['all', 'Все'], ['walls', 'Стены'], ['window', 'Окно'], ['floor', 'Пол'], ['ceil', 'Потолок'], ['cinema', 'Кинозона'], ['trophy', 'Трофеи']];

// ---------- Достижения ----------
// value(st) — текущее значение, goal — сколько нужно. cups — награда, item — трофей вместо стаканчиков.
const A = (id, name, text, goal, value, extra) => ({ id, name, text, goal, value, ...extra });
export const ACHIEVEMENTS = [
  A('first', 'Первый шаг', 'Первый визит вместе', 1, s => s.visits, { cups: 2, icon: 'star' }),
  A('photo1', 'Первый кадр', 'Первое фото в альбоме', 1, s => s.photos, { cups: 2, icon: 'camera' }),
  A('five', 'Пятёрка', '5 разных мест', 5, s => s.places, { cups: 2, icon: 'pin' }),
  A('horizons', 'Новые горизонты', 'Места в двух разных группах', 2, s => s.groups, { cups: 2, icon: 'map' }),
  A('regulars', 'Завсегдатаи', '5 раз в одном месте', 5, s => s.maxSame, { cups: 3, icon: 'heart' }),
  A('comeback', 'Возвращение', 'Снова в месте спустя 3 месяца', 1, s => s.comeback, { cups: 2, icon: 'move' }),
  A('month5', 'Активный месяц', '5 визитов за один месяц', 5, s => s.monthMax, { cups: 3, icon: 'cal' }),
  A('gourmets', 'Гурманы', '10 разных кафе', 10, s => s.kind.cafe, { cups: 3, icon: 'kind-cafe', kind: 'cafe' }),
  A('nature5', 'На природе', '5 мест с природой', 5, s => s.kind.nature, { cups: 3, icon: 'kind-nature', kind: 'nature' }),
  A('chronicle', 'Летопись', '20 фото в альбоме', 20, s => s.photos, { cups: 3, icon: 'album' }),
  A('dreams', 'Мечты сбываются', '10 мест из «Хотим» стали «Были»', 10, s => s.dreams, { cups: 4, icon: 'heartF' }),
  A('seasons', 'Четыре сезона', 'Визиты зимой, весной, летом и осенью', 4, s => s.seasons, { cups: 4, icon: 'sun' }),
  A('twenty', 'Двадцатка', '20 разных мест', 20, s => s.places, { cups: 5, icon: 'pin' }),
  A('travelers', 'Путешественницы', 'Места в трёх поездках', 3, s => s.trips, { cups: 5, icon: 'plane' }),
  A('album100', 'Фотоальбом', '100 фото в альбоме', 100, s => s.photos, { cups: 5, icon: 'album' }),
  A('year', 'Год вместе', 'Визиты 12 месяцев подряд', 12, s => s.streak, { cups: 8, icon: 'cal' }),
  A('hundred', 'Сотня', '100 разных мест', 100, s => s.places, { cups: 10, icon: 'star' }),
  // трофеи
  A('trip1', 'Первая поездка', 'Место в путешествии', 1, s => s.trips, { item: 'globe', icon: 'plane' }),
  A('adrenaline', 'Адреналин', 'Первое место с экстримом', 1, s => s.kind.extreme, { item: 'skate', icon: 'kind-extreme', kind: 'extreme' }),
  A('cinema10', 'Киноманы', '10 походов в кино', 10, s => s.kinoVisits, { item: 'film', icon: 'kind-kino', kind: 'kino', visitsKind: true }),
  A('cinema20', 'Кинозал', '20 походов в кино', 20, s => s.kinoVisits, { item: 'popcorn', icon: 'kind-kino', kind: 'kino', visitsKind: true }),
  A('art5', 'Ценители', '5 разных выставок', 5, s => s.kind.art, { item: 'painting', icon: 'kind-art', kind: 'art' }),
  A('extreme5', 'Без тормозов', '5 экстремальных мест', 5, s => s.kind.extreme, { item: 'balloon', icon: 'kind-extreme', kind: 'extreme' }),
  A('coffee30', 'Кофеманы', '30 разных кафе', 30, s => s.kind.cafe, { item: 'cart', icon: 'kind-cafe', kind: 'cafe' }),
  A('coffee50', 'Кофейная легенда', '50 разных кафе', 50, s => s.kind.cafe, { item: 'goldcup', icon: 'kind-cafe', kind: 'cafe' }),
  A('fifty', 'Полсотни', '50 разных мест', 50, s => s.places, { item: 'cat', icon: 'star' }),
];
export const achById = id => ACHIEVEMENTS.find(a => a.id === id);

const season = m => (m === 11 || m <= 1 ? 0 : m <= 4 ? 1 : m <= 7 ? 2 : 3); // 0 зима … 3 осень
const monthIdx = iso => { const [y, m] = iso.split('-').map(Number); return y * 12 + (m - 1); };
const daysBetween = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;

// Проходим визиты по датам и запоминаем, когда какое достижение получено.
// data: { places, groups, visits, photos }
export function computeAchievements({ places, groups, visits, photos }) {
  const placeById = new Map(places.map(p => [p.id, p]));
  const groupById = new Map(groups.map(g => [g.id, g]));
  const photosPerVisit = new Map();
  for (const f of photos) photosPerVisit.set(f.visit_id, (photosPerVisit.get(f.visit_id) || 0) + 1);
  const vs = visits.filter(v => placeById.has(v.place_id))
    .sort((a, b) => a.visited_on.localeCompare(b.visited_on) || String(a.created_at).localeCompare(String(b.created_at)));
  const st = { visits: 0, photos: 0, places: 0, groups: 0, trips: 0, maxSame: 0, comeback: 0, monthMax: 0, dreams: 0, seasons: 0, streak: 0, kinoVisits: 0,
    kind: { cafe: 0, kino: 0, art: 0, nature: 0, extreme: 0 } };
  const perPlace = new Map(), lastAt = new Map(), groupSet = new Set(), tripSet = new Set(), months = new Map(), seasonSet = new Set();
  const kindSets = Object.fromEntries(KINDS.map(k => [k.id, new Set()]));
  const got = new Map(); // id → дата получения
  const check = date => { for (const a of ACHIEVEMENTS) if (!got.has(a.id) && a.value(st) >= a.goal) got.set(a.id, date); };
  for (const v of vs) {
    const p = placeById.get(v.place_id), g = groupById.get(p.group_id), d = v.visited_on;
    st.visits++;
    st.photos += photosPerVisit.get(v.id) || 0;
    const n = (perPlace.get(p.id) || 0) + 1; perPlace.set(p.id, n);
    if (n === 1) {
      st.places++;
      // место было в «Хотим» раньше, чем туда сходили
      if (p.created_at && String(p.created_at).slice(0, 10) < d) st.dreams++;
      for (const k of p.kinds || []) if (kindSets[k]) { kindSets[k].add(p.id); st.kind[k] = kindSets[k].size; }
    }
    if ((p.kinds || []).includes('kino')) st.kinoVisits++;
    st.maxSame = Math.max(st.maxSame, n);
    if (lastAt.has(p.id) && daysBetween(lastAt.get(p.id), d) >= 90) st.comeback = 1;
    lastAt.set(p.id, d);
    if (g) { if (g.kind === 'trip') tripSet.add(g.id); groupSet.add(g.id); }
    st.groups = groupSet.size; st.trips = tripSet.size;
    const mi = monthIdx(d); months.set(mi, (months.get(mi) || 0) + 1);
    st.monthMax = Math.max(st.monthMax, months.get(mi));
    seasonSet.add(season(+d.slice(5, 7) - 1)); st.seasons = seasonSet.size;
    let run = 1; while (months.has(mi - run)) run++; // подряд идущие месяцы, заканчивая этим
    st.streak = Math.max(st.streak, run);
    check(d);
  }
  return { stats: st, got };
}

// Стаканчики: +1 за каждый визит + награды за достижения − потрачено в магазине
export function cupsBalance(stats, got, owned) {
  const earned = stats.visits + ACHIEVEMENTS.reduce((s, a) => s + (got.has(a.id) ? a.cups || 0 : 0), 0);
  const spent = (owned || []).reduce((s, id) => s + (itemById(id)?.price || 0), 0);
  return { earned, spent, balance: earned - spent };
}

// Что у нас есть: купленное + трофеи за полученные достижения
export function ownedSet(owned, got) {
  const s = new Set((owned || []).filter(id => itemById(id)?.price));
  for (const a of ACHIEVEMENTS) if (a.item && got.has(a.id)) s.add(a.item);
  return s;
}

// Что стоит в комнате: явный выбор (placed[slot]) или первая имеющаяся вещь для этого места
export function arrangement(have, placed = {}) {
  const out = new Map();
  for (const it of ITEMS) {
    if (!have.has(it.id)) continue;
    const slot = it.slot;
    if (slot in placed) { if (placed[slot] === it.id) out.set(slot, it); continue; }
    if (!out.has(slot)) out.set(slot, it);
  }
  return [...out.values()];
}

// Сезон и время суток для окна
export function windowState(now = new Date()) {
  const m = now.getMonth(), h = now.getHours();
  const s = ['winter', 'spring', 'summer', 'autumn'][season(m)];
  const t = h >= 8 && h < 18 ? 'day' : h >= 18 && h < 22 ? 'evening' : 'night';
  return { season: s, time: t };
}
