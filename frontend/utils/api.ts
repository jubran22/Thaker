import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

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

export async function apiGet<T = any>(path: string): Promise<T> {
  const r = await fetch(`${BASE}/api${path}`);
  if (!r.ok) throw new Error(`GET ${path} failed: ${r.status}`);
  return r.json();
}

export async function apiPost<T = any>(path: string, body: any): Promise<T> {
  const r = await fetch(`${BASE}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`POST ${path} failed: ${r.status}`);
  return r.json();
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  const r = await fetch(`${BASE}/api${path}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`DELETE ${path} failed: ${r.status}`);
  return r.json();
}

export function todayStr(): string {
  const d = new Date();
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
  // Aladhan returns e.g. "05:12 (AST)"
  const clean = hhmm.split(' ')[0];
  const [h, m] = clean.split(':').map((x) => parseInt(x, 10));
  if (isNaN(h) || isNaN(m)) return null;
  const d = new Date(forDate);
  d.setHours(h, m, 0, 0);
  return d;
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

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
