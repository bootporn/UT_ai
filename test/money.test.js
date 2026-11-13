import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { amountInWords, formatRub, kopecksToYooValue, parseRubToKopecks, roundMul, settle, yooValueToKopecks } from "../src/money.js";

describe("money", () => {
  it("says ruble amounts in Russian", () => {
    assert.equal(amountInWords(0), "ноль рублей 00 копеек");
    assert.equal(amountInWords(100), "один рубль 00 копеек");
    assert.equal(amountInWords(200), "два рубля 00 копеек");
    assert.equal(amountInWords(500), "пять рублей 00 копеек");
    assert.equal(amountInWords(1100), "одиннадцать рублей 00 копеек");
    assert.equal(amountInWords(2100), "двадцать один рубль 00 копеек");
    assert.equal(amountInWords(10100), "сто один рубль 00 копеек");
    assert.equal(amountInWords(11100), "сто одиннадцать рублей 00 копеек");
    assert.equal(amountInWords(12100), "сто двадцать один рубль 00 копеек");
    assert.equal(amountInWords(69000), "шестьсот девяносто рублей 00 копеек");
    assert.equal(amountInWords(100000), "одна тысяча рублей 00 копеек");
    assert.equal(amountInWords(200000), "две тысячи рублей 00 копеек");
    assert.equal(amountInWords(500000), "пять тысяч рублей 00 копеек");
    assert.equal(amountInWords(1500000), "пятнадцать тысяч рублей 00 копеек");
    assert.equal(amountInWords(2100000), "двадцать одна тысяча рублей 00 копеек");
    assert.equal(amountInWords(2200000), "двадцать две тысячи рублей 00 копеек");
    assert.equal(amountInWords(100000000), "один миллион рублей 00 копеек");
    assert.equal(amountInWords(101), "один рубль 01 копейка");
    assert.equal(amountInWords(102), "один рубль 02 копейки");
  });

  it("settles a 690 ruble card payment", () => {
    const rates = {
      fee: { numerator: 35, denominator: 1000 },
      feeVat: { numerator: 22, denominator: 100 },
      tax: { numerator: 4, denominator: 100 },
    };
    const result = settle(69000, rates);
    assert.equal(result.feeKopecks, 2415);
    assert.equal(result.feeVatKopecks, 531);
    assert.equal(result.taxKopecks, 2760);
    assert.equal(result.netKopecks, 63294);
    assert.equal(formatRub(result.netKopecks), "632,94\u00a0₽");
    assert.equal(roundMul(1000, 35, 1000), 35);
  });

  it("parses rubles and YooKassa amounts", () => {
    assert.equal(parseRubToKopecks("15 000,50"), 1500050);
    assert.equal(parseRubToKopecks("690"), 69000);
    assert.equal(parseRubToKopecks("0"), null);
    assert.equal(parseRubToKopecks("-5"), null);
    assert.equal(kopecksToYooValue(69000), "690.00");
    assert.equal(yooValueToKopecks("690.00"), 69000);
    assert.equal(yooValueToKopecks("690"), null);
  });
});
