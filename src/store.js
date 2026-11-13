import fs from "node:fs";
import path from "node:path";
import { earlierDate } from "./kill.js";

function writeJson(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
  fs.renameSync(temporary, file);
}

export function createStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const ordersDir = path.join(dir, "orders");
  fs.mkdirSync(ordersDir, { recursive: true });
  const ledgerFile = path.join(dir, "ledger.json");
  const launchFile = path.join(dir, "launch.json");
  let chain = Promise.resolve();

  function lock(fn) {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  function orderPath(id) {
    if (!/^[a-f0-9]{32}$/.test(id)) return null;
    return path.join(ordersDir, `${id}.json`);
  }

  function readOrderSync(id) {
    const file = orderPath(id);
    if (!file || !fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }

  function readLedgerSync() {
    if (!fs.existsSync(ledgerFile)) return { entries: [] };
    return JSON.parse(fs.readFileSync(ledgerFile, "utf8"));
  }

  function readLaunchSync() {
    if (!fs.existsSync(launchFile)) return null;
    const payload = JSON.parse(fs.readFileSync(launchFile, "utf8"));
    return payload.launchedAt || null;
  }

  return {
    lock,
    readOrder: readOrderSync,
    readLedger: readLedgerSync,
    readLaunch: readLaunchSync,
    async saveOrder(order) {
      return lock(() => {
        const file = orderPath(order.id);
        if (!file) throw new Error("bad id");
        writeJson(file, order);
        return order;
      });
    },
    async update(fn) {
      return lock(() => fn({ readOrder: readOrderSync, readLedger: readLedgerSync, readLaunch: readLaunchSync, writeJson, orderPath, ledgerFile, launchFile }));
    },
    rememberLaunch(candidate) {
      return lock(() => {
        const current = readLaunchSync();
        const next = earlierDate(current, candidate);
        if (next && next !== current) writeJson(launchFile, { launchedAt: next });
        return next;
      });
    },
  };
}
