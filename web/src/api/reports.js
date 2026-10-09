import { request, API_PREFIX, API_BASE, getAccessToken } from './client';

export async function fetchReportSummary() {
  const { data } = await request({ method: 'get', url: '/reports/summary' });
  return data;
}

export async function fetchReportDevices() {
  const { data } = await request({ method: 'get', url: '/reports/devices' });
  return data;
}

/** Trigger CSV download in the browser (uses Bearer token). */
export async function downloadReportCsv(kind) {
  const path = kind === 'users' ? '/reports/export/users.csv' : '/reports/export/devices.csv';
  const base = API_BASE || '';
  const url = `${base}${API_PREFIX}${path}`;
  const token = getAccessToken();
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const envelope = body.error || {};
    throw Object.assign(new Error(envelope.message || 'Download failed'), {
      code: envelope.code,
      status: response.status,
    });
  }
  const blob = await response.blob();
  const filename = kind === 'users' ? 'smart-monitor-users.csv' : 'smart-monitor-devices.csv';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
