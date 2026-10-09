#!/usr/bin/env node
'use strict';

/**
 * ESP32 simulator - runs the board's FULL first-boot + data flow against a
 * local API, so end-to-end data can be verified without physical hardware.
 *
 * What a real board does (and this script mirrors, in the same order):
 *   1. POST /provisioning/register   (hwId + capabilities -> claimCode, token)
 *   2. POST /provisioning/exchange   (token -> deviceId + deviceSecret, once)
 *   3. Dashboard: POST /devices/claim (owner pastes the claim code)
 *   4. POST /telemetry               (HMAC-signed batch, like net/HmacSigner)
 *   5. POST /provisioning/heartbeat  (liveness: rssi, backlog, firmware ...)
 *   6. GET  /telemetry/:deviceId/latest (what the dashboard would render)
 *
 * Usage:
 *   node scripts/esp32-sim.js                    # one sample, keep identity
 *   node scripts/esp32-sim.js --samples 5        # five samples, ~2 s apart
 *   node scripts/esp32-sim.js --reset            # factory-reset: new hwId
 *   node scripts/esp32-sim.js --base http://192.168.1.222:5000
 *
 * Requires an owner account (defaults to the seeded demo account, override with
 * --email/--password - the password stays on the command line, never in a file):
 *   node scripts/esp32-sim.js --email owner@example.com --password 'New!Pass'
 * Identity is kept in scripts/.esp32-sim.json (like ESP32 NVS) so re-runs
 * reuse the same deviceId instead of minting a new station every time.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATE_FILE = path.resolve(__dirname, '.esp32-sim.json');

function parseArgs(argv) {
  const out = { base: 'http://localhost:5000', samples: 1, reset: false, email: '', password: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--base') out.base = argv[++i];
    else if (a === '--samples') out.samples = Math.max(1, Number(argv[++i]) || 1);
    else if (a === '--reset') out.reset = true;
    else if (a === '--email') out.email = argv[++i];
    else if (a === '--password') out.password = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const API = `${args.base.replace(/\/+$/, '')}/api/v1`;

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function call(method, urlPath, { token, body } = {}) {
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    throw new Error(`${method} ${urlPath} -> ${res.status} ${text.slice(0, 300)}`);
  }
  return json.data;
}

/** Signed device request, identical contract to firmware net/HmacSigner. */
async function signedCall({ deviceId, secret, method, path, body }) {
  const bodyString = JSON.stringify(body);
  const bodyHash = crypto.createHash('sha256').update(bodyString).digest('hex');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();

  const canonical = [method.toUpperCase(), `/api/v1${path}`, timestamp, nonce, bodyHash].join('\n');
  const signature = crypto.createHmac('sha256', secret).update(canonical).digest('hex');

  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': deviceId,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Body-SHA256': bodyHash,
      'X-Signature': signature,
    },
    body: bodyString,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  }
  return JSON.parse(text).data;
}


/** One realistic V1 sample (matches firmware services/Sampler output). */
function buildSample(deviceId, seq, jitter) {
  const r = (base, swing) => Number((base + (jitter() - 0.5) * swing).toFixed(2));
  return {
    sampleId: `${deviceId}-${String(seq).padStart(10, '0')}`,
    ts: new Date().toISOString(),
    timeQuality: 'ntp',
    capabilities: {
      temperature: { value: r(21.4, 1.2), unit: 'C', quality: 'ok', source: 'dht11' },
      humidity: { value: r(47, 4), unit: '%', quality: 'ok', source: 'dht11' },
      pressure: { value: Math.round(r(99812, 120)), unit: 'Pa', quality: 'ok', source: 'bmp180' },
      illuminance: { value: Math.max(0, Math.round(r(134, 60))), unit: 'lx', quality: 'ok', source: 'bh1750' },
      eco2: { value: Math.round(r(612, 90)), unit: 'ppm', quality: 'calibrating', source: 'ccs811' },
      tvoc: { value: Math.round(r(88, 26)), unit: 'ppb', quality: 'ok', source: 'ccs811' },
      wind_rpm: { value: r(96.5, 18), unit: 'rpm', quality: 'ok', source: 'a3144' },
      wind_speed: { value: Math.max(0, r(3.1, 1.1)), unit: 'm/s', quality: 'uncalibrated', source: 'a3144' },
    },
  };
}


/** mulberry32: deterministic PRNG so --samples runs are reproducible. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log(`ESP32 simulator -> ${API}\n`);

  // ---- 0. owner session (the human who will claim the station) ------------
  const session = await call('POST', '/auth/login', {
    body: {
      email: args.email || 'owner@example.com',
      password: args.password || 'Str0ng!Passw0rd',
    },
  });
  console.log(`owner login ok (${session.user.email})`);

  // ---- 1+2. register + exchange (first boot) -------------------------------
  let state = args.reset ? {} : loadState();
  if (!state.hwId || !state.deviceSecret) {
    state.hwId = `SIM-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    console.log(`\nfirst boot: hwId=${state.hwId}`);

    const registered = await call('POST', '/provisioning/register', {
      body: {
        hwId: state.hwId,
        model: 'smart_monitor_v1',
        hardwareRevision: '1.0',
        firmwareVersion: '1.0.0',
        capabilities: [
          'temperature', 'humidity', 'pressure', 'illuminance',
          'eco2', 'tvoc', 'wind_rpm', 'wind_speed',
        ],
      },
    });
    console.log(`  registered:  deviceId=${registered.deviceId}`);
    console.log(`  claim code:  ${registered.claimCode}`);

    const exchanged = await call('POST', '/provisioning/exchange', {
      body: { provisioningToken: registered.provisioningToken, hwId: state.hwId },
    });
    state.deviceId = exchanged.deviceId;
    state.deviceSecret = exchanged.deviceSecret;
    state.claimCode = registered.claimCode;
    saveState(state);
    console.log('  exchanged:   deviceSecret stored (like NVS)');
  } else {
    console.log(`\nreboot: identity from NVS (deviceId=${state.deviceId})`);
  }

  // ---- 3. claim (what the owner does in the dashboard) ---------------------
  const { deviceId, deviceSecret } = state;
  if (state.claimCode) {
    try {
      const claimed = await call('POST', '/devices/claim', {
        token: session.accessToken,
        body: { deviceId, claimCode: state.claimCode },
      });
      console.log(`\nclaimed: ${claimed.deviceId} (attached to this owner)`);
      delete state.claimCode;
      saveState(state);
    } catch (err) {
      console.log(`\nclaim skipped: ${(err.message.split(' -> ')[1] || err.message).slice(0, 160)}`);
    }
  } else {
    console.log('\nalready claimed (no claim code left in NVS)');
  }

  // ---- 4+5. heartbeat + telemetry loop -------------------------------------
  const jitter = mulberry32(Date.now() % 100000);
  let seq = Number(state.seq || 0);

  for (let i = 0; i < args.samples; i += 1) {
    seq += 1;

    const hb = await signedCall({
      deviceId,
      secret: deviceSecret,
      method: 'POST',
      path: '/provisioning/heartbeat',
      body: {
        firmwareVersion: '1.0.0',
        rssi: -61 + Math.round((jitter() - 0.5) * 8),
        uptimeS: i * 60,
        timeQuality: 'ntp',
        backlog: args.samples - i - 1,
      },
    });
    console.log(`\n[${i + 1}/${args.samples}] heartbeat ok (serverTime=${hb.serverTime || 'n/a'})`);

    const accepted = await signedCall({
      deviceId,
      secret: deviceSecret,
      method: 'POST',
      path: '/telemetry',
      body: {
        firmwareVersion: '1.0.0',
        hardwareRevision: '1.0',
        backlog: args.samples - i - 1,
        samples: [buildSample(deviceId, seq, jitter)],
      },
    });
    console.log(
      `  telemetry 202: accepted=${accepted.accepted} duplicates=${accepted.duplicates} rejected=${accepted.rejected}`
    );

    if (i < args.samples - 1) await sleep(2000);
  }

  state.seq = seq;
  saveState(state);

  // ---- 6. latest snapshot (what the dashboard renders) ---------------------
  const latest = await call('GET', `/telemetry/${deviceId}/latest`, { token: session.accessToken });
  console.log('\nlatest snapshot as the dashboard sees it:');
  for (const [name, reading] of Object.entries(latest.capabilities || {})) {
    console.log(`  ${name.padEnd(12)} ${reading.value} ${reading.unit || ''}  (${reading.quality})`);
  }

  const device = await call('GET', `/devices/${deviceId}`, { token: session.accessToken });
  console.log(`\ndevice status=${device.status} lastSeenAt=${device.lastSeenAt}`);
  console.log('\nOpen the dashboard (Devices -> this station) to see it live.');
}

main().catch((err) => {
  console.error(`\nsimulator failed: ${err.message}`);
  console.error('Is the API up? `cd server && node src/server.js` (or npm run dev).');
  process.exit(1);
});
