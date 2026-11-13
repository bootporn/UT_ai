import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateForm } from "../src/form.js";
import { isValidInn, isValidOgrn, makeInn10, makeInn12 } from "../src/ids.js";
import { sampleForm, sampleIpForm, samplePersonForm } from "./fixture.js";

describe("identifiers", () => {
  it("checks generated INN and OGRN", () => {
    const form = sampleForm();
    assert.equal(isValidInn(form.executorInn), true);
    assert.equal(isValidInn(form.customerInn), true);
    assert.equal(isValidInn(makeInn12("5001007322").slice(0, -1) + "0"), false);
    assert.equal(isValidOgrn(form.customerOgrn, "company"), true);
    assert.equal(isValidOgrn(sampleIpForm().customerOgrn, "ip"), true);
    assert.equal(isValidInn(makeInn10("770708389")), true);
  });
});

describe("form", () => {
  it("accepts a company, a person and an IP", () => {
    assert.equal(validateForm(sampleForm()).ok, true);
    assert.equal(validateForm(samplePersonForm()).ok, true);
    assert.equal(validateForm(sampleIpForm()).ok, true);
  });

  it("rejects a job description and a card number", () => {
    const job = validateForm(sampleForm({ serviceDescription: "Работа в должности менеджера с окладом каждый месяц." }));
    assert.equal(job.ok, false);
    const card = validateForm(sampleForm({ paymentDetails: "карта 4242 4242 4242 4242" }));
    assert.equal(card.ok, false);
  });

  it("rejects a bad INN and a missing confirmation", () => {
    const bad = validateForm(sampleForm({ executorInn: "123456789012", resultConfirm: "" }));
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.some((error) => error.field === "executorInn"));
    assert.ok(bad.errors.some((error) => error.field === "resultConfirm"));
  });
});
