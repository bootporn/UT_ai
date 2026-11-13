import { kopecksToYooValue, yooValueToKopecks } from "./money.js";

const PAYMENT_ID = /^[A-Za-z0-9_-]{8,64}$/;

export function createYooClient({ shopId, secretKey, apiBase, fetchImpl }) {
  const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");

  async function request(path, { method, body, idempotenceKey }) {
    const headers = {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    };
    if (idempotenceKey) headers["Idempotence-Key"] = idempotenceKey;
    const response = await fetchImpl(`${apiBase}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const description = typeof payload?.description === "string" ? payload.description : "ЮKassa не приняла запрос.";
      const error = new Error(description);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  return {
    createPayment(body, idempotenceKey) {
      return request("/payments", { method: "POST", body, idempotenceKey });
    },
    getPayment(id) {
      if (!PAYMENT_ID.test(id || "")) throw new Error("Некорректный идентификатор платежа.");
      return request(`/payments/${id}`, { method: "GET" });
    },
  };
}

export function buildPaymentBody({ order, returnUrl }) {
  return {
    amount: { value: kopecksToYooValue(order.priceKopecks), currency: "RUB" },
    capture: true,
    confirmation: { type: "redirect", return_url: returnUrl },
    description: "Акт за вечер: договор, акт и счёт по одной сделке",
    metadata: { order_id: order.id },
  };
}

export function judgePayment(payment, order) {
  if (!payment || typeof payment !== "object") return { outcome: "ignore" };
  if (payment.metadata?.order_id !== order.id) return { outcome: "reject", reason: "order" };
  const amount = yooValueToKopecks(payment.amount?.value);
  if (amount == null || amount !== order.priceKopecks || payment.amount?.currency !== "RUB") {
    return { outcome: "reject", reason: "amount" };
  }
  if (payment.status === "canceled") return { outcome: "canceled" };
  if (payment.status === "pending" || payment.status === "waiting_for_capture") return { outcome: "pending" };
  if (payment.status === "succeeded" && payment.paid === true) {
    if (payment.test === false) return { outcome: "paid" };
    if (payment.test === true) return { outcome: "yookassa_test" };
    return { outcome: "reject", reason: "test-flag" };
  }
  return { outcome: "ignore" };
}

export function isPaymentId(value) {
  return PAYMENT_ID.test(value || "");
}
