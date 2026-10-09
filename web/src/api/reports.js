import { request, API_PREFIX, API_BASE, getAccessToken } from './client';

export async function fetchReportSummary() {
  const { data } = await request({ method: 'get', url: '/reports/summary' });
  return data;
}

export async function fetchReportDevices() {
  const { data } = await request({ method: 'get', url: '/reports/devices' });
  return data;
}

const CSV_PATHS = {
  devices: '/reports/export/devices.csv',
  users: '/reports/export/users.csv',
  telemetry: '/reports/export/telemetry.csv',
  telemetryWorkbook: '/reports/export/telemetry.xlsx',
};

/** Trigger CSV download in the browser (uses Bearer token). */
export async function downloadReportCsv(kind, query = {}) {
  const path = CSV_PATHS[kind] || CSV_PATHS.telemetryWorkbook;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  const base = API_BASE || '';
  const url = `${base}${API_PREFIX}${path}${qs ? `?${qs}` : ''}`;
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
  const fallback =
    kind === 'users'
      ? 'smart-monitor-users.csv'
      : kind === 'telemetry'
        ? 'smart-monitor-telemetry.csv'
        : kind === 'telemetryWorkbook'
          ? 'Smart_Monitor_Telemetry_Dashboard.xlsx'
          : 'smart-monitor-devices.csv';
  const cd = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/i.exec(cd);
  const filename = match ? match[1] : fallback;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
