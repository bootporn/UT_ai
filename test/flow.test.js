import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { makeInn12 } from "../src/ids.js";
import { createApp } from "../src/server.js";
import { sampleForm } from "./fixture.js";

function listen(handler) {
  const server = http.createServer((req, res) => {
    handler(req, res).catch((error) => {
      res.statusCode = 500;
      res.end(error instanceof Error ? error.message : "error");
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function request(port, method, target, { form, json } = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${target}`, {
    method,
    redirect: "manual",
    headers: form
      ? { "content-type": "application/x-www-form-urlencoded" }
      : json
        ? { "content-type": "application/json" }
        : undefined,
    body: form ? new URLSearchParams(form) : json ? JSON.stringify(json) : undefined,
  });
  return { status: response.status, text: await response.text(), location: response.headers.get("location") };
}

function appInTemp(extra = {}, options = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "akt-"));
  const app = createApp({ DATA_DIR: dataDir, ...extra }, options);
  return { app, dataDir };
}

async function createDraft(port) {
  const created = await request(port, "POST", "/orders", { form: sampleForm() });
  assert.equal(created.status, 303);
  const id = created.location.split("/").pop();
  return id;
}

describe("test mode", () => {
  it("does not pretend that a payment happened", async () => {
    const { app, dataDir } = appInTemp();
    const server = await listen(app.handle);
    const port = server.address().port;
    try {
      const home = await request(port, "GET", "/");
      assert.equal(home.status, 200);
      assert.match(home.text, /Тестовый режим/);
      assert.match(home.text, /690/);
      assert.match(home.text, /не продажа/);

      const invalid = await request(port, "POST", "/orders", { form: { executorName: "А" } });
      assert.equal(invalid.status, 400);
      assert.match(invalid.text, /ИНН/);

      const id = await createDraft(port);
      const preview = await request(port, "GET", `/orders/${id}`);
      assert.match(preview.text, /НЕ ПОДПИСЫВАТЬ/);
      assert.match(preview.text, /К оплате сейчас/);
      assert.doesNotMatch(preview.text, /Оплата прошла/);

      const pay = await request(port, "POST", `/orders/${id}/pay`, { form: { immediateDelivery: "yes" } });
      assert.equal(pay.status, 200);
      assert.match(pay.text, /Платёж не создан/);
      assert.match(pay.text, /не продажа/);
      assert.equal(app.store.readOrder(id).status, "draft");
      assert.deepEqual(app.store.readLedger().entries, []);

      const webhook = await request(port, "POST", "/yookassa/webhook", {
        json: { event: "payment.succeeded", object: { id: "payment_fake_1234", status: "succeeded", paid: true, test: false } },
      });
      assert.equal(webhook.status, 404);
      assert.equal(app.store.readOrder(id).status, "draft");
      assert.match(await request(port, "GET", "/ledger").then((page) => page.text), /Боевых оплат нет/);
      assert.equal(fs.existsSync(path.join(dataDir, "launch.json")), false);
    } finally {
      server.close();
    }
  });
});

describe("live payment path", () => {
  function liveEnv(dataDir) {
    return {
      DATA_DIR: dataDir,
      YOOKASSA_SHOP_ID: "123456",
      YOOKASSA_SECRET_KEY: "test_secret_should_not_leak",
      YOOKASSA_LIVE: "yes",
      PUBLIC_BASE_URL: "https://pay.example.ru",
      OPERATOR_NAME: "Иванова Мария Сергеевна",
      OPERATOR_INN: makeInn12("5001007322"),
      OPERATOR_EMAIL: "owner@example.com",
      LEDGER_TOKEN: "ledger-token-16b",
      LAUNCHED_AT: "2026-11-13",
      YOOKASSA_API_URL: "https://payments.example/v3",
    };
  }

  it("records one real payment and ignores a test shop payment", async () => {
    const payments = new Map();
    let sequence = 0;
    const fetchImpl = async (url, options = {}) => {
      if (options.method === "POST") {
        const body = JSON.parse(options.body);
        sequence += 1;
        const payment = {
          id: sequence === 1 ? "payment_live_001" : "payment_test_002",
          status: "pending",
          paid: false,
          test: sequence !== 1,
          amount: body.amount,
          metadata: body.metadata,
          confirmation: { type: "redirect", confirmation_url: `https://yoomoney.ru/checkout/${sequence}` },
        };
        payments.set(payment.id, payment);
        return new Response(JSON.stringify(payment), { status: 200 });
      }
      const id = String(url).split("/").pop();
      const stored = payments.get(id);
      if (id === "payment_live_001") {
        return new Response(JSON.stringify({ ...stored, status: "succeeded", paid: true, test: false }), { status: 200 });
      }
      return new Response(JSON.stringify({ ...stored, status: "succeeded", paid: true, test: true }), { status: 200 });
    };

    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "akt-"));
    const fixedNow = new Date("2026-11-20T10:00:00Z");
    const app = createApp(liveEnv(dataDir), { fetchImpl, now: () => fixedNow });
    const server = await listen(app.handle);
    const port = server.address().port;
    try {
      const closed = await request(port, "GET", "/ledger");
      assert.equal(closed.status, 403);
      assert.doesNotMatch(closed.text, /632/);

      const first = await createDraft(port);
      const started = await request(port, "POST", `/orders/${first}/pay`, { form: { immediateDelivery: "yes" } });
      assert.equal(started.status, 303);
      assert.equal(started.location, "https://yoomoney.ru/checkout/1");
      assert.equal(app.store.readOrder(first).status, "pending");
      assert.equal(app.store.readLedger().entries.length, 0);

      const returned = await request(port, "GET", `/payment/return?order=${first}`);
      assert.equal(returned.status, 303);
      const page = await request(port, "GET", returned.location);
      assert.match(page.text, /Оплата прошла/);
      assert.match(page.text, /Экземпляр для печати/);
      assert.doesNotMatch(page.text, /НЕ ПОДПИСЫВАТЬ/);
      assert.doesNotMatch(page.text, /test_secret_should_not_leak/);

      const again = await request(port, "GET", `/payment/return?order=${first}`);
      assert.equal(again.status, 303);
      const entries = app.store.readLedger().entries;
      assert.equal(entries.length, 1);
      assert.equal(entries[0].grossKopecks, 69000);
      assert.equal(entries[0].feeKopecks, 2415);
      assert.equal(entries[0].feeVatKopecks, 531);
      assert.equal(entries[0].taxKopecks, 2760);
      assert.equal(entries[0].netKopecks, 63294);
      assert.equal(entries[0].real, true);

      const ledger = await request(port, "GET", "/ledger?token=ledger-token-16b");
      assert.match(ledger.text, /632,94/);
      assert.match(ledger.text, /42 дня/);
      assert.match(ledger.text, /100–150/);

      const second = await createDraft(port);
      const testPay = await request(port, "POST", `/orders/${second}/pay`, { form: { immediateDelivery: "yes" } });
      assert.equal(testPay.status, 303);
      payments.get("payment_test_002").status = "succeeded";
      payments.get("payment_test_002").paid = true;
      payments.get("payment_test_002").test = true;
      const testReturn = await request(port, "GET", `/payment/return?order=${second}`);
      assert.equal(testReturn.status, 303);
      const testPage = await request(port, "GET", testReturn.location);
      assert.match(testPage.text, /Это не продажа/);
      assert.match(testPage.text, /НЕ ПОДПИСЫВАТЬ/);
      assert.equal(app.store.readLedger().entries.length, 1);

      const lied = await request(port, "POST", "/yookassa/webhook", {
        json: { object: { id: "payment_live_001", status: "succeeded", paid: true, test: false, amount: { value: "1.00", currency: "RUB" } } },
      });
      assert.equal(lied.status, 200);
      assert.equal(app.store.readLedger().entries.length, 1);
    } finally {
      server.close();
    }
  });

  it("refuses a new checkout after 42 days without a sale", async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "akt-"));
    const fetchImpl = async () => new Response("no", { status: 500 });
    const app = createApp(liveEnv(dataDir), { fetchImpl, now: () => new Date("2026-12-25T08:00:00Z") });
    const server = await listen(app.handle);
    const port = server.address().port;
    try {
      const home = await request(port, "GET", "/");
      assert.match(home.text, /Приём оплаты остановлен/);
      const id = await createDraft(port);
      const pay = await request(port, "POST", `/orders/${id}/pay`, { form: { immediateDelivery: "yes" } });
      assert.equal(pay.status, 403);
      assert.equal(app.store.readOrder(id).status, "draft");
      assert.equal(app.store.readLedger().entries.length, 0);
    } finally {
      server.close();
    }
  });
});

describe("readme", () => {
  it("contains the kill rule in Russian", () => {
    const readme = fs.readFileSync(new URL("../README.md", import.meta.url), "utf8");
    assert.match(readme, /Правило остановки/);
    assert.match(readme, /42 дня/);
    assert.match(readme, /6 недель/);
    assert.match(readme, /15–20 тыс\. ₽/);
    assert.match(readme, /100–150 тыс\. ₽ не докладывать/);
    assert.match(readme, /рекламу не включать/i);
    assert.match(readme, /боевой оплаты/);
    assert.match(readme, /YOOKASSA_SHOP_ID/);
    assert.match(readme, /не обещает первую продажу/i);
  });
});
