import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { API_BASE, getAccessToken } from '../api/client';
import { useAuthStore } from '../stores/authStore';
import { useUiStore } from '../stores/uiStore';
import { useDeviceStore } from '../stores/deviceStore';
/**
 * Realtime connection (§10.3, §21).
 *
 * One socket per browser tab, owned by this module - components only attach
 * listeners. The registries below are module-level and exist BEFORE the
 * socket does, which matters: React runs child effects before parent effects,
 * so a page can register a listener while `useSocket()` in the layout has not
 * connected yet. Nothing is lost, because dispatch reads the registry at
 * event time rather than capturing it at subscribe time.
 */

const GLOBAL_LISTENERS = new Set();
/** deviceId -> set of handlers; re-joined after every reconnect. */
const DEVICE_SUBSCRIPTIONS = new Map();

let socket = null;
let socketToken = null;

/** Fan an event out to every registered consumer. */
function dispatch(event, payload) {
  for (const listener of GLOBAL_LISTENERS) {
    try {
      listener(event, payload);
    } catch {
      /* one broken listener must not break the socket */
    }
  }
  for (const handlers of DEVICE_SUBSCRIPTIONS.values()) {
    for (const handler of handlers) {
      try {
        handler(event, payload);
      } catch {
        /* ditto */
      }
    }
  }
}

/**
 * Listen to every realtime event (`telemetry:new`, `alert:raised`, ...).
 * Safe to call before the socket exists. Returns an unsubscribe function.
 */
export function addRealtimeListener(listener) {
  GLOBAL_LISTENERS.add(listener);
  return () => GLOBAL_LISTENERS.delete(listener);
}

/**
 * Ask the server to watch one device room. The server re-checks ownership, so
 * a forged deviceId can never widen access (threat T8).
 */
export function subscribeDevice(deviceId, handler) {
  if (!DEVICE_SUBSCRIPTIONS.has(deviceId)) DEVICE_SUBSCRIPTIONS.set(deviceId, new Set());
  DEVICE_SUBSCRIPTIONS.get(deviceId).add(handler);

  if (socket && socket.connected) socket.emit('device:subscribe', { deviceId });

  return () => {
    const handlers = DEVICE_SUBSCRIPTIONS.get(deviceId);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) {
      DEVICE_SUBSCRIPTIONS.delete(deviceId);
      if (socket && socket.connected) socket.emit('device:unsubscribe', { deviceId });
    }
  };
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
  useUiStore.getState().setSocketState('idle');
}

/**
 * Keep a socket alive for as long as the user is signed in.
 * Call this once, from the authenticated layout.
 * @returns {'idle'|'connecting'|'online'|'offline'} connection state for the UI badge
 */
export function useSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const socketState = useUiStore((s) => s.socketState);

  useEffect(() => {
    if (!accessToken) {
      disconnectSocket();
      return undefined;
    }

    // Same token and still connected -> nothing to do.
    if (socket && socketToken === accessToken) return undefined;

    // Token changed (login, rotation): rebuild so the handshake is fresh.
    if (socket) disconnectSocket();

    socketToken = accessToken;
    useUiStore.getState().setSocketState('connecting');

    // Same-origin proxy locally (API_BASE=''), absolute Render URL in prod.
    const ioSocket = io(`${API_BASE}/realtime`, {
      path: '/socket.io',
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 8000,
    });
    socket = ioSocket;

    ioSocket.on('connect', () => {
      useUiStore.getState().setSocketState('online');
      // Re-join every room the UI was watching before the drop.
      for (const deviceId of DEVICE_SUBSCRIPTIONS.keys()) {
        ioSocket.emit('device:subscribe', { deviceId });
      }
    });

    ioSocket.on('disconnect', () => useUiStore.getState().setSocketState('offline'));
    ioSocket.on('connect_error', () => useUiStore.getState().setSocketState('offline'));

    // Global side effects: keep the device list's "last seen" honest.
    // `device:status` arrives after every telemetry batch and every heartbeat,
    // so the online badge and "last seen" age move in lockstep with the data
    // the tiles already render - no REST polling anywhere.
    ioSocket.on('device:status', (payload = {}) => {
      if (payload.deviceId) {
        const fields = {
          lastSeenAt: payload.lastSeenAt || new Date().toISOString(),
          status: payload.online ? 'active' : 'offline',
        };
        if (payload.rssi !== undefined || payload.firmwareVersion !== undefined) {
          fields.meta = {
            ...(useDeviceStore.getState().devices.find((d) => d.deviceId === payload.deviceId)?.meta || {}),
            ...(payload.rssi !== undefined ? { rssi: payload.rssi } : {}),
          };
        }
        if (payload.firmwareVersion) fields.firmwareVersion = payload.firmwareVersion;
        useDeviceStore.getState().merge(payload.deviceId, fields);
      }
      dispatch('device:status', payload);
    });

    ioSocket.on('device:updated', (payload = {}) => {
      if (payload.deviceId) {
        const fields = {};
        if (payload.displayName !== undefined) fields.displayName = payload.displayName;
        if (payload.locationName !== undefined) fields.locationName = payload.locationName;
        if (payload.config !== undefined) fields.config = payload.config;
        if (payload.owner !== undefined) fields.owner = payload.owner;
        if (payload.status !== undefined) fields.status = payload.status;
        if (Object.keys(fields).length) useDeviceStore.getState().merge(payload.deviceId, fields);
      }
      dispatch('device:updated', payload);
    });

    // A revoked station loses its credential: surface the state wherever the
    // device row is visible, without another round trip.
    ioSocket.on('device:revoked', (payload = {}) => {
      if (payload.deviceId) {
        useDeviceStore.getState().merge(payload.deviceId, {
          status: 'revoked',
          revokedAt: payload.revokedAt,
        });
      }
      dispatch('device:revoked', payload);
    });

    // Delete: drop the row from the inventory immediately, and let pages
    // navigate away. The document is already gone server-side, so a refetch
    // would only produce a 404.
    ioSocket.on('device:deleted', (payload = {}) => {
      if (payload.deviceId) useDeviceStore.getState().remove(payload.deviceId);
      dispatch('device:deleted', payload);
    });

    ['telemetry:new', 'alert:raised', 'alert:resolved', 'device:claimed', 'error'].forEach((event) => {
      ioSocket.on(event, (payload) => dispatch(event, payload));
    });

    return () => {
      disconnectSocket();
      socketToken = null;
    };
  }, [accessToken]);

  return socketState;
}

/** Re-exported for callers that only need the raw access token (rare). */
export { getAccessToken };

