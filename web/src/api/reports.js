import { http, getRefreshToken, refreshSession } from './client';

export async function fetchReportSummary() {
  const { data } = await http.get('/reports/summary');
  return data.data;
}

export async function fetchReportDevices() {
  const { data } = await http.get('/reports/devices');
  return data.data;
}

const DOWNLOAD_PATHS = {
  devices: '/reports/export/devices.csv',
  users: '/reports/export/users.csv',
  telemetry: '/reports/export/telemetry.csv',
  telemetryWorkbook: '/reports/export/telemetry.xlsx',
};

async function envelopeFromBlob(blob) {
  try {
    const text = await blob.text();
    const json = JSON.parse(text);
    return json.error || {};
  } catch {
    return {};
  }
}

/** Download export file (uses axios + token refresh on 401). */
export async function downloadReportCsv(kind, query = {}) {
  const path = DOWNLOAD_PATHS[kind] || DOWNLOAD_PATHS.telemetryWorkbook;
  const params = {};
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params[key] = String(value);
  });

  const timeoutMs = kind === 'telemetryWorkbook' ? 120000 : 60000;

  if (getRefreshToken()) {
    try {
      await refreshSession();
    } catch {
      /* interceptor will retry once on 401 */
    }
  }

  let response;
  try {
    response = await http.get(path, { params, responseType: 'blob', timeout: timeoutMs });
  } catch (err) {
    const blob = err.response?.data;
    if (blob instanceof Blob) {
      const envelope = await envelopeFromBlob(blob);
      throw Object.assign(new Error(envelope.message || 'Download failed'), {
        code: envelope.code,
        status: err.response?.status,
      });
    }
    throw err;
  }

  const fallback =
    kind === 'users'
      ? 'smart-monitor-users.csv'
      : kind === 'telemetry'
        ? 'smart-monitor-telemetry.csv'
        : kind === 'telemetryWorkbook'
          ? 'Smart_Monitor_Telemetry_Dashboard.xlsx'
          : 'smart-monitor-devices.csv';
  const cd = response.headers['content-disposition'] || '';
  const match = /filename="([^"]+)"/i.exec(cd);
  const filename = match ? match[1] : fallback;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(response.data);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
