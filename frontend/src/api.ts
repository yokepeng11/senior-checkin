const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return r.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return r.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return r.json();
}

const QUEUE_KEY = 'checkin_offline_queue';

interface QueuedCheckin {
  senior_id: string;
  timestamp: string;
}

function getQueue(): QueuedCheckin[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

async function flushQueue(): Promise<void> {
  const queue = getQueue();
  if (queue.length === 0) return;

  const remaining: QueuedCheckin[] = [];
  for (const item of queue) {
    try {
      await post('/checkin', { ...item, device_type: 'web', app_version: '1.0.0' });
    } catch {
      remaining.push(item);
    }
  }
  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
}

export const api = {
  async getSeniors() {
    return get<import('./types').Senior[]>('/seniors');
  },

  async getSenior(id: string) {
    return get<import('./types').Senior>(`/seniors/${id}`);
  },

  async updateSenior(id: string, data: Partial<import('./types').Senior>) {
    return put<import('./types').Senior>(`/seniors/${id}`, data);
  },

  async createSenior(data: Partial<import('./types').Senior>) {
    return post<import('./types').Senior>('/seniors', data);
  },

  async deleteSenior(id: string) {
    const r = await fetch(`${BASE}/seniors/${id}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`API error ${r.status}`);
    return r.json();
  },

  async subscribePush(senior_id: string, keys: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    return post('/push/subscribe', { senior_id, subscription: keys });
  },

  async unsubscribePush(endpoint: string) {
    return post('/push/unsubscribe', { endpoint });
  },

  async checkin(senior_id: string): Promise<{ status: string; message: string; confirmed_at: string; queued?: boolean }> {
    if (!navigator.onLine) {
      const queue = getQueue();
      const ts = new Date().toISOString();
      queue.push({ senior_id, timestamp: ts });
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      return { status: 'success', message: 'Saved offline — will sync when connected', confirmed_at: ts, queued: true };
    }

    await flushQueue();
    return post('/checkin', {
      senior_id,
      timestamp: new Date().toISOString(),
      device_type: 'web',
      app_version: '1.0.0',
    });
  },

  async getTodayStatus(senior_id: string) {
    return get<import('./types').DailyStatus>(`/checkin/today?senior_id=${senior_id}`);
  },

  async getHistory(senior_id: string, days = 30) {
    return get<import('./types').CheckinHistory[]>(`/history/${senior_id}?days=${days}`);
  },

  async getDashboard(phone?: string) {
    const path = phone ? `/dashboard?phone=${encodeURIComponent(phone)}` : '/dashboard';
    return get<import('./types').Dashboard>(path);
  },

  async getWeeklyReport(senior_id: string) {
    return get<import('./types').Report>(`/dashboard/reports/weekly/${senior_id}`);
  },

  async getMonthlyReport(senior_id: string) {
    return get<import('./types').Report>(`/dashboard/reports/monthly/${senior_id}`);
  },
};
