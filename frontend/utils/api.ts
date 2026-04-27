import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// معرّف الجهاز
// ============================================================
export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem('device_id');
  if (!id) {
    id =
      'dev_' +
      Math.random().toString(36).slice(2, 10) +
      Date.now().toString(36);
    await AsyncStorage.setItem('device_id', id);
  }
  return id;
}

// ============================================================
// مفاتيح التخزين المحلي
// ============================================================
const KEY_DAY = (deviceId: string, date: string) => `day_${deviceId}_${date}`;
const KEY_WIRDS = (deviceId: string) => `wirds_${deviceId}`;

// ============================================================
// بنية بيانات اليوم
// ============================================================
export interface DayDoc {
  device_id: string;
  date: string;
  prayers: Record<string, boolean>;
  sunnah: Record<string, { before: boolean; after: boolean }>;
  adhkar: Record<string, boolean>;
  tasbih_count: number;
  quran_pages: number;
  wird_progress: Record<string, number>;
}

function defaultDayDoc(deviceId: string, date: string): DayDoc {
  return {
    device_id: deviceId,
    date,
    prayers: { fajr: false, dhuhr: false, asr: false, maghrib: false, isha: false },
    sunnah: {
      fajr: { before: false, after: false },
      dhuhr: { before: false, after: false },
      asr: { before: false, after: false },
      maghrib: { before: false, after: false },
      isha: { before: false, after: false },
    },
    adhkar: { morning: false, evening: false, after_prayer: false, sleep: false },
    tasbih_count: 0,
    quran_pages: 0,
    wird_progress: {},
  };
}

// ============================================================
// قراءة وحفظ بيانات اليوم
// ============================================================
export async function getDay(deviceId: string, date: string): Promise<DayDoc> {
  try {
    const raw = await AsyncStorage.getItem(KEY_DAY(deviceId, date));
    if (raw) {
      const parsed = JSON.parse(raw);
      const def = defaultDayDoc(deviceId, date);
      return { ...def, ...parsed };
    }
  } catch {}
  return defaultDayDoc(deviceId, date);
}

export async function saveDay(doc: DayDoc): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_DAY(doc.device_id, doc.date), JSON.stringify(doc));
  } catch {}
}

// ============================================================
// تبديل حالة الصلاة
// ============================================================
export async function togglePrayer(
  deviceId: string,
  date: string,
  prayer: string,
  completed: boolean
): Promise<DayDoc> {
  const doc = await getDay(deviceId, date);
  doc.prayers[prayer] = completed;
  await saveDay(doc);
  return doc;
}

// ============================================================
// تبديل حالة السنة الراتبة
// ============================================================
export async function toggleSunnah(
  deviceId: string,
  date: string,
  prayer: string,
  kind: 'before' | 'after',
  completed: boolean
): Promise<DayDoc> {
  const doc = await getDay(deviceId, date);
  if (!doc.sunnah[prayer]) doc.sunnah[prayer] = { before: false, after: false };
  doc.sunnah[prayer][kind] = completed;
  await saveDay(doc);
  return doc;
}

// ============================================================
// تسجيل الأذكار
// ============================================================
export async function toggleAdhkar(
  deviceId: string,
  date: string,
  adhkarType: string,
  completed: boolean
): Promise<DayDoc> {
  const doc = await getDay(deviceId, date);
  doc.adhkar[adhkarType] = completed;
  await saveDay(doc);
  return doc;
}

// ============================================================
// إضافة تسبيح
// ============================================================
export async function addTasbih(
  deviceId: string,
  date: string,
  count: number
): Promise<DayDoc> {
  const doc = await getDay(deviceId, date);
  doc.tasbih_count = (doc.tasbih_count || 0) + count;
  await saveDay(doc);
  return doc;
}

// ============================================================
// تحديث صفحات القرآن
// ============================================================
export async function setQuranPages(
  deviceId: string,
  date: string,
  pages: number
): Promise<DayDoc> {
  const doc = await getDay(deviceId, date);
  doc.quran_pages = Math.max(0, pages);
  await saveDay(doc);
  return doc;
}

// ============================================================
// الأوراد المخصصة
// ============================================================
export interface Wird {
  id: string;
  device_id: string;
  title: string;
  target: number;
}

export async function getWirds(deviceId: string): Promise<Wird[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_WIRDS(deviceId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export async function addWird(deviceId: string, title: string, target: number): Promise<Wird> {
  const wirds = await getWirds(deviceId);
  const newWird: Wird = {
    id: 'wird_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
    device_id: deviceId,
    title,
    target,
  };
  wirds.push(newWird);
  await AsyncStorage.setItem(KEY_WIRDS(deviceId), JSON.stringify(wirds));
  return newWird;
}

export async function deleteWird(deviceId: string, wirdId: string): Promise<void> {
  const wirds = await getWirds(deviceId);
  const filtered = wirds.filter((w) => w.id !== wirdId);
  await AsyncStorage.setItem(KEY_WIRDS(deviceId), JSON.stringify(filtered));
}

export async function incrementWird(
  deviceId: string,
  date: string,
  wirdId: string
): Promise<DayDoc> {
  const doc = await getDay(deviceId, date);
  if (!doc.wird_progress) doc.wird_progress = {};
  doc.wird_progress[wirdId] = (doc.wird_progress[wirdId] || 0) + 1;
  await saveDay(doc);
  return doc;
}

// ============================================================
// الإحصائيات
// ============================================================
export interface DayScore {
  prayers_done: number;
  adhkar_done: number;
  tasbih_count: number;
  quran_pages: number;
}

function scoreDoc(doc: DayDoc): DayScore {
  const prayers_done = Object.values(doc.prayers || {}).filter(Boolean).length;
  const adhkar_done = Object.values(doc.adhkar || {}).filter(Boolean).length;
  return {
    prayers_done,
    adhkar_done,
    tasbih_count: doc.tasbih_count || 0,
    quran_pages: doc.quran_pages || 0,
  };
}

export async function getStatsSummary(deviceId: string) {
  const today = todayStr();
  const todayDoc = await getDay(deviceId, today);
  const todayScore = scoreDoc(todayDoc);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const monthTotals = await rangeTotals(deviceId, dateStr(monthStart), today);
  const yearTotals = await rangeTotals(deviceId, dateStr(yearStart), today);

  // حساب سلسلة المداومة
  let streak = 0;
  const cur = new Date();
  for (let i = 0; i < 400; i++) {
    const ds = dateStr(cur);
    const doc = await getDay(deviceId, ds);
    if (scoreDoc(doc).prayers_done >= 1) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    today: todayScore,
    month: monthTotals,
    year: yearTotals,
    streak_days: streak,
  };
}

export async function getStatsRange(deviceId: string, start: string, end: string) {
  const per_day: any[] = [];
  const totals = {
    prayers_done: 0,
    adhkar_done: 0,
    tasbih_count: 0,
    quran_pages: 0,
    days_tracked: 0,
    days_full_prayers: 0,
  };

  const startDate = new Date(start);
  const endDate = new Date(end);
  const cur = new Date(startDate);

  while (cur <= endDate) {
    const ds = dateStr(cur);
    const doc = await getDay(deviceId, ds);
    const score = scoreDoc(doc);
    const hasData =
      score.prayers_done > 0 ||
      score.adhkar_done > 0 ||
      score.tasbih_count > 0 ||
      score.quran_pages > 0;

    if (hasData) {
      per_day.push({ date: ds, ...score });
      totals.prayers_done += score.prayers_done;
      totals.adhkar_done += score.adhkar_done;
      totals.tasbih_count += score.tasbih_count;
      totals.quran_pages += score.quran_pages;
      totals.days_tracked++;
      if (score.prayers_done === 5) totals.days_full_prayers++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  per_day.sort((a, b) => a.date.localeCompare(b.date));
  return { per_day, totals };
}

async function rangeTotals(deviceId: string, start: string, end: string) {
  const tot = { prayers_done: 0, adhkar_done: 0, tasbih_count: 0, quran_pages: 0 };
  const startDate = new Date(start);
  const endDate = new Date(end);
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const ds = dateStr(cur);
    const doc = await getDay(deviceId, ds);
    const score = scoreDoc(doc);
    tot.prayers_done += score.prayers_done;
    tot.adhkar_done += score.adhkar_done;
    tot.tasbih_count += score.tasbih_count;
    tot.quran_pages += score.quran_pages;
    cur.setDate(cur.getDate() + 1);
  }
  return tot;
}

// ============================================================
// أوقات الصلاة - مباشرة من Aladhan API
// ============================================================
export interface PrayerTimes {
  timings: Record<string, string>;
  date: {
    hijri: { date: string; month: { ar: string }; year: string };
    gregorian: { date: string };
  };
  meta: { timezone: string };
}

export async function fetchPrayerTimes(
  lat: number,
  lng: number,
  date?: string
): Promise<PrayerTimes> {
  const d = date || aladhanDateStr();
  const url = `https://api.aladhan.com/v1/timings/${d}?latitude=${lat}&longitude=${lng}&method=4`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`فشل جلب أوقات الصلاة: ${response.status}`);
    const json = await response.json();
    if (json.code !== 200) throw new Error('استجابة غير صحيحة من API الأذان');
    return json.data as PrayerTimes;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// ============================================================
// دوال مساعدة للتاريخ والوقت
// ============================================================
export function todayStr(): string {
  return dateStr(new Date());
}

export function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function aladhanDateStr(d: Date = new Date()): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export function parseTime(hhmm: string | undefined, forDate: Date = new Date()): Date | null {
  if (!hhmm) return null;
  const clean = hhmm.split(' ')[0];
  const [h, m] = clean.split(':').map((x) => parseInt(x, 10));
  if (isNaN(h) || isNaN(m)) return null;
  const result = new Date(forDate);
  result.setHours(h, m, 0, 0);
  return result;
}

export function formatTime12(hhmm: string | undefined): string {
  if (!hhmm) return '--:--';
  const clean = hhmm.split(' ')[0];
  const [h, m] = clean.split(':').map((x) => parseInt(x, 10));
  if (isNaN(h) || isNaN(m)) return '--:--';
  const suffix = h >= 12 ? 'م' : 'ص';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, '0')} ${suffix}`;
}

// alias لتوافق settings.tsx
export const fetchPrayerTimesFromAladhan = fetchPrayerTimes;

// ============================================================
// علامة مرجعية القرآن
// ============================================================
const KEY_QURAN_BM = (deviceId: string) => `quran_bookmark_${deviceId}`;

export async function getQuranBookmark(deviceId: string): Promise<{ page: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_QURAN_BM(deviceId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export async function saveQuranBookmark(deviceId: string, page: number): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_QURAN_BM(deviceId), JSON.stringify({ page }));
  } catch {}
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
