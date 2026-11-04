#!/usr/bin/env node
// Bengaluru Sales CRM - production server (used by start-crm.command and `npm start`).
//
//  - Always serves the CRM on http://127.0.0.1:<port> for this Mac, exactly as before (no sign-in).
//  - When "Phone access" is switched on in Settings & Data, it also listens on this Mac's private
//    network addresses (Wi-Fi / Ethernet / Tailscale) so your phone can open the CRM. Phones must sign
//    in with the passcode or a one-time QR code. See server/gate.mjs for the security rules.
//  - Public internet addresses are never used.
//
// Port: CRM_PORT (environment or .env.local), default 3100.

import http from "node:http";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
process.chdir(APP_DIR);
process.env.NODE_ENV = "production";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(APP_DIR, false, { info() {}, error: console.error });

const PORT = Number.parseInt(process.env.CRM_PORT || "3100", 10);
// Secret that marks requests already checked by the phone gate; read by src/middleware.ts.
process.env.CRM_GATE_TOKEN = crypto.randomBytes(32).toString("hex");

const log = (...args) => console.log(new Date().toISOString(), ...args);
const { createGate } = await import("./server/gate.mjs");
const next = require("next");
const app = next({ dev: false, dir: APP_DIR, hostname: "localhost", port: PORT });
await app.prepare();
const nextHandler = app.getRequestHandler();

const gate = createGate({ dataDir: path.join(APP_DIR, "data"), port: PORT, gateToken: process.env.CRM_GATE_TOKEN, nextHandler, log });

function listen(server, host) {
  return new Promise((resolve, reject) => {
    const onError = (e) => {
      server.off("listening", onListening);
      reject(e);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve(server);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(PORT, host);
  });
}

// 1) This Mac.
const main = http.createServer((req, res) => gate.handleRequest(req, res, "loopback"));
try {
  await listen(main, "127.0.0.1");
} catch (e) {
  console.error(e.code === "EADDRINUSE" ? `Port ${PORT} is already in use. Set CRM_PORT=3200 in .env.local and start again.` : e);
  process.exit(1);
}
log(`Bengaluru Sales CRM is running at http://localhost:${PORT}`);

// 2) Phones: one listener per private address of this Mac, only while phone access is on.
const phoneServers = new Map(); // address -> http.Server
const reported = new Set();

async function syncPhoneListeners() {
  const wanted = new Set(gate.wantedAddresses());
  for (const [address, server] of phoneServers) {
    if (wanted.has(address)) continue;
    phoneServers.delete(address);
    server.close();
    server.closeAllConnections?.();
    log(`phone access: stopped listening on ${address}`);
  }
  for (const address of wanted) {
    if (phoneServers.has(address)) continue;
    const server = http.createServer((req, res) => gate.handleRequest(req, res, "lan"));
    phoneServers.set(address, server);
    try {
      await listen(server, address);
      reported.delete(address);
      log(`phone access: listening on http://${address}:${PORT}`);
    } catch (e) {
      phoneServers.delete(address);
      if (!reported.has(address)) log(`phone access: could not listen on ${address}:${PORT} (${e.code || e.message}); will retry`);
      reported.add(address);
    }
  }
}

gate.setListeningProvider(() => [...phoneServers.keys()]);
gate.onChange(() => void syncPhoneListeners());
setInterval(() => void syncPhoneListeners(), 10_000).unref();
await syncPhoneListeners();

function shutdown() {
  gate.flush();
  main.close();
  for (const s of phoneServers.values()) s.close();
  main.closeAllConnections?.();
  for (const s of phoneServers.values()) s.closeAllConnections?.();
  setTimeout(() => process.exit(0), 300).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
