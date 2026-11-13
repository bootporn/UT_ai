import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadConfig } from "./config.js";
import { validateForm } from "./form.js";
import { assessKill } from "./kill.js";
import { settle } from "./money.js";
import * as pages from "./pages.js";
import { createStore } from "./store.js";
import { moscowToday } from "./text.js";
import { buildPaymentBody, createYooClient, isPaymentId, judgePayment } from "./yookassa.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function send(res, status, body, type = "text/html; charset=utf-8") {
  res.statusCode = status;
  res.setHeader("Content-Type", type);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'",
  );
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

function redirect(res, location) {
  res.statusCode = 303;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end();
}

function readBody(req, limit = 100_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("Слишком большой запрос."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseForm(text) {
  return Object.fromEntries(new URLSearchParams(text));
}

function tokenMatches(provided, expected) {
  const left = Buffer.from(provided || "");
  const right = Buffer.from(expected || "");
  if (left.length === 0 || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function createApp(env = process.env, options = {}) {
  const config = loadConfig(env);
  const store = createStore(config.dataDir);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const now = () => options.now?.() || new Date();
  const yoo =
    config.shopId && config.secretKey && config.mode !== "misconfigured"
      ? createYooClient({
          shopId: config.shopId,
          secretKey: config.secretKey,
          apiBase: config.apiBase,
          fetchImpl,
        })
      : null;

  function readKill() {
    const realCount = store.readLedger().entries.filter((entry) => entry.real === true).length;
    return assessKill({ launchedAt: store.readLaunch(), realCount, now: now() });
  }

  async function currentKill() {
    const ledger = store.readLedger();
    const real = ledger.entries.filter((entry) => entry.real === true);
    let launchedAt = store.readLaunch();
    if (config.mode === "live") {
      launchedAt = await store.rememberLaunch(config.launchedAt || launchedAt || moscowToday(now()));
    }
    if (real.length) {
      const first = real.map((entry) => entry.moscowDate).sort()[0];
      launchedAt = await store.rememberLaunch(first);
    }
    return assessKill({ launchedAt: store.readLaunch() || launchedAt, realCount: real.length, now: now() });
  }

  function realEntries() {
    return store.readLedger().entries.filter((entry) => entry.real === true);
  }

  async function commitPayment(orderId, payment) {
    const result = await store.update(({ readOrder, readLedger, writeJson, orderPath, ledgerFile }) => {
      const order = readOrder(orderId);
      if (!order) return { missing: true };
      const judgement = judgePayment(payment, order);
      if (judgement.outcome === "paid" && order.status !== "paid") {
        const ledger = readLedger();
        if (!ledger.entries.some((entry) => entry.paymentId === payment.id)) {
          const money = settle(order.priceKopecks, config.rates);
          ledger.entries.push({
            id: crypto.randomBytes(8).toString("hex"),
            orderId: order.id,
            paymentId: payment.id,
            recordedAt: now().toISOString(),
            moscowDate: moscowToday(now()),
            ...money,
            real: true,
            payer: "individual",
            feeNote: "оценка для банковской карты: комиссия и НДС на комиссию",
            taxNote: "4% НПД с полной цены, оплата от физического лица",
          });
          writeJson(ledgerFile, ledger);
        }
        order.status = "paid";
        order.paidAt = now().toISOString();
        order.paymentId = payment.id;
        writeJson(orderPath(order.id), order);
      } else if (judgement.outcome === "yookassa_test" && order.status !== "paid" && order.status !== "yookassa_test") {
        order.status = "yookassa_test";
        order.paymentId = payment.id;
        order.attempt = (order.attempt || 1) + 1;
        writeJson(orderPath(order.id), order);
      } else if (judgement.outcome === "canceled" && order.status !== "paid" && order.status !== "canceled") {
        order.status = "canceled";
        order.paymentId = payment.id;
        order.attempt = (order.attempt || 1) + 1;
        writeJson(orderPath(order.id), order);
      } else if (judgement.outcome === "pending" && order.status !== "paid") {
        order.status = "pending";
        order.paymentId = payment.id;
        if (payment.confirmation?.confirmation_url) order.confirmationUrl = payment.confirmation.confirmation_url;
        writeJson(orderPath(order.id), order);
      }
      return { order, judgement };
    });
    if (result?.judgement?.outcome === "paid") {
      const entry = realEntries().find((item) => item.paymentId === payment.id);
      if (entry) await store.rememberLaunch(entry.moscowDate);
    }
    return result;
  }

  async function syncOrder(order) {
    if (!yoo || !order?.paymentId) return { order, judgement: { outcome: "ignore" } };
    const payment = await yoo.getPayment(order.paymentId);
    return commitPayment(order.id, payment);
  }

  async function handle(req, res) {
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = decodeURIComponent(url.pathname);

    if (req.method === "GET" && pathname === "/styles.css") {
      return send(res, 200, fs.readFileSync(path.join(here, "styles.css")), "text/css; charset=utf-8");
    }
    if (req.method === "GET" && pathname === "/print.js") {
      return send(res, 200, fs.readFileSync(path.join(here, "print.js")), "text/javascript; charset=utf-8");
    }
    if (req.method === "GET" && pathname === "/favicon.svg") {
      return send(res, 200, fs.readFileSync(path.join(here, "favicon.svg")), "image/svg+xml");
    }
    if (req.method === "GET" && pathname === "/health") {
      const healthKill = readKill();
      return send(
        res,
        200,
        JSON.stringify({
          ok: true,
          mode: config.mode,
          priceRub: config.priceRub,
          sales: healthKill.shouldStop ? "stopped" : "open",
        }),
        "application/json; charset=utf-8",
      );
    }

    const kill = await currentKill();
    if (req.method === "GET" && pathname === "/") {
      return send(res, 200, pages.renderHome({ config, kill }));
    }
    if (req.method === "GET" && pathname === "/privacy") {
      return send(res, 200, pages.renderPrivacy({ config, kill }));
    }
    if (req.method === "GET" && pathname === "/new") {
      return send(res, 200, pages.renderFormPage({ config, kill, form: null, errors: [], action: "/orders" }));
    }
    if (req.method === "GET" && pathname === "/ledger") {
      if (config.mode !== "test" && !tokenMatches(url.searchParams.get("token"), config.ledgerToken)) {
        return send(res, 403, pages.renderForbidden({ config, kill }));
      }
      return send(res, 200, pages.renderLedger({ config, kill, ledger: store.readLedger() }));
    }

    const orderMatch = pathname.match(/^\/orders\/([a-f0-9]{32})(\/edit|\/pay)?$/);
    if (req.method === "POST" && pathname === "/orders") {
      const result = validateForm(parseForm(await readBody(req)));
      if (!result.ok) {
        return send(res, 400, pages.renderFormPage({ config, kill, form: result.form, errors: result.errors, action: "/orders" }));
      }
      const id = crypto.randomBytes(16).toString("hex");
      await store.saveOrder({
        id,
        createdAt: now().toISOString(),
        status: "draft",
        priceKopecks: config.priceKopecks,
        attempt: 1,
        paymentId: null,
        form: { ...result.form, dealKopecks: result.dealKopecks },
      });
      return redirect(res, `/orders/${id}`);
    }

    if (orderMatch && req.method === "GET" && !orderMatch[2]) {
      const order = store.readOrder(orderMatch[1]);
      if (!order) return send(res, 404, pages.renderNotFound({ config, kill }));
      return send(res, 200, pages.renderOrderPage({ config, kill, order }));
    }
    if (orderMatch && req.method === "GET" && orderMatch[2] === "/edit") {
      const order = store.readOrder(orderMatch[1]);
      if (!order) return send(res, 404, pages.renderNotFound({ config, kill }));
      if (order.status === "paid") return redirect(res, `/orders/${order.id}`);
      return send(
        res,
        200,
        pages.renderFormPage({ config, kill, form: order.form, errors: [], action: `/orders/${order.id}` }),
      );
    }
    if (orderMatch && req.method === "POST" && !orderMatch[2]) {
      const order = store.readOrder(orderMatch[1]);
      if (!order) return send(res, 404, pages.renderNotFound({ config, kill }));
      if (order.status === "paid") return redirect(res, `/orders/${order.id}`);
      const result = validateForm(parseForm(await readBody(req)));
      if (!result.ok) {
        return send(
          res,
          400,
          pages.renderFormPage({ config, kill, form: result.form, errors: result.errors, action: `/orders/${order.id}` }),
        );
      }
      order.form = { ...result.form, dealKopecks: result.dealKopecks };
      await store.saveOrder(order);
      return redirect(res, `/orders/${order.id}`);
    }
    if (orderMatch && req.method === "POST" && orderMatch[2] === "/pay") {
      const order = store.readOrder(orderMatch[1]);
      if (!order) return send(res, 404, pages.renderNotFound({ config, kill }));
      if (order.status === "paid") return redirect(res, `/orders/${order.id}`);
      const posted = parseForm(await readBody(req));
      if (posted.immediateDelivery !== "yes") {
        return send(
          res,
          400,
          pages.renderOrderPage({
            config,
            kill,
            order,
            errors: [{ message: "Нужно согласие выдать файлы сразу после оплаты." }],
          }),
        );
      }
      if (config.mode === "test" || config.mode === "misconfigured" || !yoo) {
        return send(res, 200, pages.renderNoPayment({ config, kill, order }));
      }
      if (kill.shouldStop && order.status !== "pending") {
        return send(res, 403, pages.renderOrderPage({ config, kill, order }));
      }
      try {
        let current = order;
        if (current.paymentId && current.status !== "draft") {
          const synced = await syncOrder(current);
          current = synced.order;
          if (synced.judgement.outcome === "paid") {
            return redirect(res, `/orders/${current.id}`);
          }
          if (synced.judgement.outcome === "pending" && current.confirmationUrl) {
            return redirect(res, current.confirmationUrl);
          }
        }
        const created = await yoo.createPayment(
          buildPaymentBody({
            order: current,
            returnUrl: `${config.publicBaseUrl}/payment/return?order=${current.id}`,
          }),
          `${current.id}-${current.attempt || 1}`,
        );
        const annotated = {
          ...created,
          metadata: created?.metadata?.order_id ? created.metadata : { order_id: current.id },
        };
        const saved = await commitPayment(current.id, annotated);
        if (!created?.id || saved?.judgement?.outcome === "reject" || saved?.judgement?.outcome === "ignore") {
          return send(
            res,
            502,
            pages.renderProviderError({
              config,
              kill,
              message: "ЮKassa не подтвердила заказ. Деньги не отмечены как полученные.",
            }),
          );
        }
        if (saved.judgement.outcome === "paid" || saved.judgement.outcome === "yookassa_test") {
          return redirect(res, `/orders/${current.id}`);
        }
        if (!created.confirmation?.confirmation_url) {
          return send(
            res,
            502,
            pages.renderProviderError({
              config,
              kill,
              message: "ЮKassa не вернула ссылку на оплату. Деньги не отмечены как полученные.",
            }),
          );
        }
        return redirect(res, created.confirmation.confirmation_url);
      } catch (error) {
        return send(
          res,
          502,
          pages.renderProviderError({
            config,
            kill,
            message: error instanceof Error ? error.message : "ЮKassa не ответила. Оплата не записана.",
          }),
        );
      }
    }

    if (req.method === "GET" && pathname === "/payment/return") {
      const order = store.readOrder(url.searchParams.get("order") || "");
      if (!order) return send(res, 404, pages.renderNotFound({ config, kill }));
      if (!yoo || !order.paymentId) return send(res, 200, pages.renderNoPayment({ config, kill, order }));
      try {
        const synced = await syncOrder(order);
        if (synced.judgement.outcome === "paid" || synced.judgement.outcome === "yookassa_test") {
          return redirect(res, `/orders/${order.id}`);
        }
        if (synced.judgement.outcome === "pending") return send(res, 200, pages.renderPending({ config, kill }));
        return send(res, 200, pages.renderRejected({ config, kill }));
      } catch (error) {
        return send(
          res,
          502,
          pages.renderProviderError({
            config,
            kill,
            message: error instanceof Error ? error.message : "Не удалось проверить платёж. Он не записан как оплата.",
          }),
        );
      }
    }

    if (req.method === "POST" && pathname === "/yookassa/webhook") {
      if (!yoo) return send(res, 404, "Приём уведомлений выключен: ключей нет. Оплата не записана.", "text/plain; charset=utf-8");
      let payload;
      try {
        payload = JSON.parse(await readBody(req));
      } catch {
        return send(res, 400, "Некорректное уведомление.", "text/plain; charset=utf-8");
      }
      const paymentId = payload?.object?.id;
      if (!isPaymentId(paymentId)) return send(res, 400, "Нет идентификатора платежа.", "text/plain; charset=utf-8");
      try {
        const payment = await yoo.getPayment(paymentId);
        const orderId = payment?.metadata?.order_id;
        if (orderId && store.readOrder(orderId)) await commitPayment(orderId, payment);
      } catch {
        return send(res, 500, "Не удалось проверить платёж. Он не записан.", "text/plain; charset=utf-8");
      }
      return send(res, 200, "ok", "text/plain; charset=utf-8");
    }

    return send(res, 404, pages.renderNotFound({ config, kill }));
  }

  return { handle, config, store, currentKill };
}

export function start(env = process.env) {
  const app = createApp(env);
  const server = http.createServer((req, res) => {
    app.handle(req, res).catch((error) => {
      console.error(error);
      if (!res.headersSent) send(res, 500, "Ошибка сервера. Оплата не отмечена.");
    });
  });
  server.listen(app.config.port, app.config.host, () => {
    console.log(`Акт за вечер: http://${app.config.host}:${app.config.port} (${app.config.mode})`);
  });
  return server;
}

const invokedDirectly =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) start();
