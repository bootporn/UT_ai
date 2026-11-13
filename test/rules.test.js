import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderDocuments } from "../src/documents.js";
import { validateForm } from "../src/form.js";
import { assessKill } from "../src/kill.js";
import { judgePayment } from "../src/yookassa.js";
import { sampleForm } from "./fixture.js";

function order() {
  const result = validateForm(sampleForm());
  return {
    id: "ab".repeat(16),
    priceKopecks: 69000,
    form: { ...result.form, dealKopecks: result.dealKopecks },
  };
}

describe("documents", () => {
  it("keeps the sample stamp until a real payment and escapes text", () => {
    const draft = order();
    draft.form.serviceDescription = "Передать макет <script>alert(1)</script> и файл.";
    const sample = renderDocuments(draft, { paid: false });
    const clean = renderDocuments(draft, { paid: true });
    assert.match(sample, /НЕ ПОДПИСЫВАТЬ/);
    assert.match(sample, /422-ФЗ/);
    assert.match(sample, /не является трудовым/);
    assert.match(sample, /НДС не облагается/);
    assert.match(sample, /пятнадцать тысяч рублей/);
    assert.match(sample, /Акт сдачи-приёмки/);
    assert.match(sample, /Счёт на оплату/);
    assert.match(sample, /не является счётом-фактурой/);
    assert.match(sample, /&lt;script&gt;/);
    assert.doesNotMatch(sample, /<script>alert/);
    assert.match(clean, /Экземпляр для печати/);
    assert.doesNotMatch(clean, /НЕ ПОДПИСЫВАТЬ/);
  });
});

describe("payment judgement", () => {
  const base = order();
  const payment = {
    status: "succeeded",
    paid: true,
    test: false,
    amount: { value: "690.00", currency: "RUB" },
    metadata: { order_id: base.id },
  };

  it("accepts only a matching live payment", () => {
    assert.equal(judgePayment(payment, base).outcome, "paid");
    assert.equal(judgePayment({ ...payment, test: true }, base).outcome, "yookassa_test");
    assert.equal(judgePayment({ ...payment, test: undefined }, base).outcome, "reject");
    assert.equal(judgePayment({ ...payment, amount: { value: "1.00", currency: "RUB" } }, base).outcome, "reject");
    assert.equal(judgePayment({ ...payment, metadata: { order_id: "other" } }, base).outcome, "reject");
    assert.equal(judgePayment({ ...payment, status: "canceled", paid: false }, base).outcome, "canceled");
    assert.equal(judgePayment({ ...payment, status: "pending", paid: false }, base).outcome, "pending");
  });
});

describe("kill rule", () => {
  it("stops on the morning of day 42 without a payment", () => {
    const quiet = assessKill({ launchedAt: "2026-11-13", realCount: 0, now: new Date("2026-12-24T21:30:00Z") });
    assert.equal(quiet.today, "2026-12-25");
    assert.equal(quiet.deadline, "2026-12-25");
    assert.equal(quiet.shouldStop, true);
    const stillOpen = assessKill({ launchedAt: "2026-11-13", realCount: 0, now: new Date("2026-12-24T20:30:00Z") });
    assert.equal(stillOpen.today, "2026-12-24");
    assert.equal(stillOpen.shouldStop, false);
    const paid = assessKill({ launchedAt: "2026-11-13", realCount: 1, now: new Date("2026-12-25T00:00:00Z") });
    assert.equal(paid.shouldStop, false);
    const notStarted = assessKill({ launchedAt: null, realCount: 0, now: new Date("2026-12-25T00:00:00Z") });
    assert.equal(notStarted.clockStarted, false);
    assert.equal(notStarted.shouldStop, false);
  });
});
