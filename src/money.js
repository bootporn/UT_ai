const ONES_M = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const ONES_F = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = [
  "десять",
  "одиннадцать",
  "двенадцать",
  "тринадцать",
  "четырнадцать",
  "пятнадцать",
  "шестнадцать",
  "семнадцать",
  "восемнадцать",
  "девятнадцать",
];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

export function roundMul(amount, numerator, denominator) {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error("Сумма для расчёта должна быть целым числом копеек.");
  }
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator <= 0 || numerator < 0) {
    throw new Error("Ставка задана неверно.");
  }
  return Math.floor((amount * numerator + Math.floor(denominator / 2)) / denominator);
}

export function parseRate(value, fallback) {
  if (value == null || String(value).trim() === "") return fallback;
  const source = String(value).trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(source)) {
    throw new Error(`Ставка «${source}» не распознана.`);
  }
  const [whole, fraction = ""] = source.split(".");
  return {
    numerator: Number(whole + fraction),
    denominator: 10 ** fraction.length || 1,
  };
}

function triplet(value, feminine) {
  if (value === 0) return "";
  const ones = feminine ? ONES_F : ONES_M;
  const parts = [HUNDREDS[Math.floor(value / 100)]];
  const rest = value % 100;
  if (rest >= 10 && rest <= 19) {
    parts.push(TEENS[rest - 10]);
  } else {
    parts.push(TENS[Math.floor(rest / 10)]);
    parts.push(ones[rest % 10]);
  }
  return parts.filter(Boolean).join(" ");
}

function plural(value, one, few, many) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function amountInWords(kopecks) {
  if (!Number.isInteger(kopecks) || kopecks < 0 || kopecks > 99_999_999_99) {
    throw new Error("Сумма вне допустимого диапазона.");
  }
  const rubles = Math.floor(kopecks / 100);
  const kopeckPart = kopecks % 100;
  const millions = Math.floor(rubles / 1_000_000);
  const thousands = Math.floor((rubles % 1_000_000) / 1000);
  const rest = rubles % 1000;
  const parts = [];
  if (millions) {
    parts.push(triplet(millions, false), plural(millions, "миллион", "миллиона", "миллионов"));
  }
  if (thousands) {
    parts.push(triplet(thousands, true), plural(thousands, "тысяча", "тысячи", "тысяч"));
  }
  if (rest || rubles === 0) {
    parts.push(rubles === 0 ? "ноль" : triplet(rest, false));
  }
  parts.push(plural(rubles, "рубль", "рубля", "рублей"));
  parts.push(String(kopeckPart).padStart(2, "0"), plural(kopeckPart, "копейка", "копейки", "копеек"));
  return parts.filter(Boolean).join(" ");
}

export function formatRub(kopecks, { withKopecks = true } = {}) {
  const sign = kopecks < 0 ? "−" : "";
  const absolute = Math.abs(kopecks);
  const rubles = Math.floor(absolute / 100);
  const kop = absolute % 100;
  const grouped = String(rubles).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  if (!withKopecks && kop === 0) return `${sign}${grouped}\u00a0₽`;
  return `${sign}${grouped},${String(kop).padStart(2, "0")}\u00a0₽`;
}

export function kopecksToYooValue(kopecks) {
  const rubles = Math.floor(kopecks / 100);
  const kop = kopecks % 100;
  return `${rubles}.${String(kop).padStart(2, "0")}`;
}

export function yooValueToKopecks(value) {
  const match = /^(\d+)\.(\d{2})$/.exec(value || "");
  if (!match) return null;
  return Number(match[1]) * 100 + Number(match[2]);
}

export function parseRubToKopecks(input) {
  const source = String(input ?? "")
    .trim()
    .replace(/\s|\u00a0/g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(source)) return null;
  const [rubles, fraction = ""] = source.split(".");
  if (rubles.length > 8) return null;
  const kopecks = Number(rubles) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(kopecks) || kopecks <= 0) return null;
  return kopecks;
}

export function settle(grossKopecks, rates) {
  const feeKopecks = roundMul(grossKopecks, rates.fee.numerator, rates.fee.denominator);
  const feeVatKopecks = roundMul(feeKopecks, rates.feeVat.numerator, rates.feeVat.denominator);
  const taxKopecks = roundMul(grossKopecks, rates.tax.numerator, rates.tax.denominator);
  const netKopecks = grossKopecks - feeKopecks - feeVatKopecks - taxKopecks;
  return { grossKopecks, feeKopecks, feeVatKopecks, taxKopecks, netKopecks };
}
