'use strict';

/**
 * FR-E4 / §21: realtime authorization and delivery.
 *
 * The critical assertion: a socket may only receive live data for a device it
 * owns - the room join is authorized server-side, never trusted from the client.
 */

const http = require('http');
const { io: ioClient } = require('socket.io-client');

const h = require('./helpers/harness');
const createApp = require('../src/app');
const { createSocketServer } = require('../src/socket');

let server;
let ioServer;
let baseUrl;
/** Sockets opened by the current test, closed automatically afterwards. */
let openSockets = [];

beforeAll(async () => {
  await h.connectDb();

  server = http.createServer(createApp());
  ioServer = createSocketServer(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  // Leaving sockets open would keep the HTTP server alive and hang afterAll.
  openSockets.forEach((socket) => socket.close());
  openSockets = [];
  await h.resetDb();
});

afterAll(async () => {
  await h.closeDb();
  await new Promise((resolve) => ioServer.close(resolve));
});

/** Connect a socket and resolve once it is ready. */
function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(`${baseUrl}/realtime`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    socket.once('connect', () => {
      openSockets.push(socket);
      resolve(socket);
    });
    socket.once('connect_error', reject);
  });
}

/** Wait for one event, or reject after a timeout. */
function once(socket, event, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** A claimed device owned by a fresh user. */
async function ownedDevice() {
  const owner = await h.registerUser();
  const provisioned = await h.provisionDevice({ capabilities: ['temperature'] });
  const device = await h.claimDevice(
    owner.accessToken,
    provisioned.deviceId,
    provisioned.claimCode
  );
  return { owner, provisioned, device };
}

function push(provisioned, sampleId, value) {
  return h.signedAgentRequest({
    deviceId: provisioned.deviceId,
    secret: provisioned.deviceSecret,
    path: '/api/v1/telemetry',
    body: { samples: [h.makeSample(sampleId, { temperature: { value } })] },
  });
}

describe('handshake', () => {
  it('rejects a connection without a token', async () => {
    await expect(connect(undefined)).rejects.toThrow(/AUTH_REQUIRED/);
  });

  it('rejects a connection with a bogus token', async () => {
    await expect(connect('not-a-real-token')).rejects.toThrow(/AUTH_INVALID/);
  });

  it('accepts a connection with a valid access token', async () => {
    const { owner } = await ownedDevice();
    const socket = await connect(owner.accessToken);
    expect(socket.connected).toBe(true);
  });
});

describe('device subscription authorization', () => {
  it('lets the owner subscribe', async () => {
    const { owner, device } = await ownedDevice();
    const socket = await connect(owner.accessToken);

    socket.emit('device:subscribe', { deviceId: device.deviceId });
    const ack = await once(socket, 'device:subscribed');

    expect(ack.deviceId).toBe(device.deviceId);
  });

  it('refuses a subscriber that does not own the device', async () => {
    const { device } = await ownedDevice();
    const stranger = await h.registerUser();
    const socket = await connect(stranger.accessToken);

    socket.emit('device:subscribe', { deviceId: device.deviceId });
    const error = await once(socket, 'error');

    expect(error.code).toBe('SUBSCRIBE_FORBIDDEN');
  });
});

describe('live telemetry', () => {
  it('delivers telemetry:new to the owner', async () => {
    const { owner, provisioned, device } = await ownedDevice();
    const socket = await connect(owner.accessToken);

    socket.emit('device:subscribe', { deviceId: device.deviceId });
    await once(socket, 'device:subscribed');

    const received = once(socket, 'telemetry:new');
    await push(provisioned, 'S-1', 23.5);
    const payload = await received;

    expect(payload.deviceId).toBe(device.deviceId);
    expect(payload.capabilities.temperature.value).toBe(23.5);
  });

  it('delivers telemetry:new through the user room without an explicit subscribe', async () => {
    // Connecting joins `user:<id>`, so an owner socket receives their own
    // devices' data even before subscribing to a specific device.
    const { owner, provisioned, device } = await ownedDevice();
    const socket = await connect(owner.accessToken);

    const received = once(socket, 'telemetry:new');
    await push(provisioned, 'S-1', 24.5);
    const payload = await received;

    expect(payload.deviceId).toBe(device.deviceId);
  });

  it('never leaks telemetry to another user', async () => {
    const { provisioned } = await ownedDevice();
    const stranger = await h.registerUser();
    const socket = await connect(stranger.accessToken);

    const leaked = once(socket, 'telemetry:new', 800).then(
      () => true,
      () => false
    );

    await push(provisioned, 'S-1', 23.5);

    expect(await leaked).toBe(false);
  });
});

describe('live device lifecycle', () => {
  /** A second owner socket watching the SAME device from another tab. */
  async function secondTab(owner) {
    return connect(owner.accessToken);
  }

  it('broadcasts device:status on heartbeat', async () => {
    const { owner, provisioned, device } = await ownedDevice();
    const socket = await connect(owner.accessToken);

    const status = once(socket, 'device:status');
    await h.signedAgentRequest({
      deviceId: provisioned.deviceId,
      secret: provisioned.deviceSecret,
      path: '/api/v1/provisioning/heartbeat',
      body: { firmwareVersion: '1.0.0', rssi: -58, backlog: 0 },
    });
    const payload = await status;

    expect(payload.deviceId).toBe(device.deviceId);
    expect(payload.online).toBe(true);
    expect(payload.rssi).toBe(-58);
    expect(new Date(payload.lastSeenAt).getTime()).toBeGreaterThan(Date.now() - 10_000);
  });

  it('notifies every watching tab when the device is renamed', async () => {
    const { owner, device } = await ownedDevice();
    const tabA = await connect(owner.accessToken);
    const tabB = await secondTab(owner);

    // Only tabA subscribes explicitly; tabB relies on the owner room.
    tabA.emit('device:subscribe', { deviceId: device.deviceId });
    await once(tabA, 'device:subscribed');

    const updateA = once(tabA, 'device:updated');
    const updateB = once(tabB, 'device:updated');

    await h
      .agent()
      .patch(`/api/v1/devices/${device.deviceId}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ displayName: 'Roof station v2' })
      .expect(200);

    const [payloadA, payloadB] = await Promise.all([updateA, updateB]);
    expect(payloadA.displayName).toBe('Roof station v2');
    expect(payloadB.displayName).toBe('Roof station v2');
  });

  it('broadcasts device:revoked and device:deleted to watchers', async () => {
    const { owner, provisioned, device } = await ownedDevice();
    const socket = await connect(owner.accessToken);

    socket.emit('device:subscribe', { deviceId: device.deviceId });
    await once(socket, 'device:subscribed');

    const revoked = once(socket, 'device:revoked');
    await h
      .agent()
      .post(`/api/v1/devices/${device.deviceId}/revoke`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    const revokedPayload = await revoked;
    expect(revokedPayload.status).toBe('revoked');

    // A revoked device's credential is dead: the next heartbeat is rejected,
    // so the board learns the revocation through the socket, not a 200.
    await h
      .signedAgentRequest({
        deviceId: provisioned.deviceId,
        secret: provisioned.deviceSecret,
        path: '/api/v1/provisioning/heartbeat',
        body: {},
      })
      .expect(403);

    // Deleting a second device while subscribed still notifies the watcher.
    const owner2 = await h.registerUser();
    const provisioned2 = await h.provisionDevice({ capabilities: ['temperature'] });
    const device2 = await h.claimDevice(owner2.accessToken, provisioned2.deviceId, provisioned2.claimCode);
    const socket2 = await connect(owner2.accessToken);
    socket2.emit('device:subscribe', { deviceId: device2.deviceId });
    await once(socket2, 'device:subscribed');

    const deleted = once(socket2, 'device:deleted');
    await h
      .agent()
      .delete(`/api/v1/devices/${device2.deviceId}`)
      .set('Authorization', `Bearer ${owner2.accessToken}`)
      .expect(204);
    expect((await deleted).deviceId).toBe(device2.deviceId);
  });
});
