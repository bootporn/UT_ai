import path from "node:path";
import { isValidInn } from "./ids.js";
import { parseRate } from "./money.js";

const DEFAULT_FEE = { numerator: 35, denominator: 1000 };
const DEFAULT_FEE_VAT = { numerator: 22, denominator: 100 };
const DEFAULT_TAX = { numerator: 4, denominator: 100 };

function trimmed(env, name) {
  return String(env[name] ?? "").trim();
}

function isPublicHttps(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
    return true;
  } catch {
    return false;
  }
}

export function loadConfig(env = process.env) {
  const shopId = trimmed(env, "YOOKASSA_SHOP_ID");
  const secretKey = trimmed(env, "YOOKASSA_SECRET_KEY");
  const liveFlag = trimmed(env, "YOOKASSA_LIVE").toLowerCase() === "yes";
  const problems = [];
  if ((shopId && !secretKey) || (!shopId && secretKey)) {
    problems.push("Нужны оба ключа ЮKassa: shopId и секретный ключ. Либо оба пустые.");
  }
  if (!shopId && !secretKey && liveFlag) {
    problems.push("Боевой режим включён, а ключей ЮKassa нет.");
  }

  const priceRub = env.PRICE_RUB == null || env.PRICE_RUB === "" ? 690 : Number(env.PRICE_RUB);
  if (!Number.isInteger(priceRub) || priceRub < 100 || priceRub > 10000) {
    throw new Error("PRICE_RUB должен быть целым числом от 100 до 10000.");
  }

  const publicBaseUrl = (trimmed(env, "PUBLIC_BASE_URL") || "http://localhost:3000").replace(/\/$/, "");
  const operatorName = trimmed(env, "OPERATOR_NAME");
  const operatorInn = trimmed(env, "OPERATOR_INN");
  const operatorEmail = trimmed(env, "OPERATOR_EMAIL");
  const ledgerToken = trimmed(env, "LEDGER_TOKEN");
  const launchedAt = trimmed(env, "LAUNCHED_AT");
  if (launchedAt && !/^\d{4}-\d{2}-\d{2}$/.test(launchedAt)) {
    throw new Error("LAUNCHED_AT записывается как ГГГГ-ММ-ДД.");
  }

  const keysReady = Boolean(shopId && secretKey);
  if (keysReady) {
    if (!isPublicHttps(publicBaseUrl)) {
      problems.push("PUBLIC_BASE_URL для оплаты — публичный адрес с https, без localhost.");
    }
    if (operatorName.length < 5) problems.push("Задайте OPERATOR_NAME: ФИО получателя денег.");
    if (!isValidInn(operatorInn) || operatorInn.length !== 12) {
      problems.push("OPERATOR_INN — 12 цифр ИНН самозанятого с верной контрольной суммой.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(operatorEmail)) {
      problems.push("Задайте OPERATOR_EMAIL: почту видно покупателю.");
    }
    if (ledgerToken.length < 16) problems.push("LEDGER_TOKEN — случайная строка от 16 знаков. Ей открывается журнал.");
  }

  let mode = "test";
  if (problems.length && (keysReady || liveFlag)) mode = "misconfigured";
  else if (keysReady && liveFlag) mode = "live";
  else if (keysReady) mode = "rehearsal";

  const port = env.PORT == null || env.PORT === "" ? 3000 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT задан неверно.");

  return {
    mode,
    problems,
    shopId,
    secretKey,
    liveFlag,
    publicBaseUrl,
    operatorName,
    operatorInn,
    operatorEmail,
    ledgerToken,
    launchedAt: launchedAt || null,
    priceRub,
    priceKopecks: priceRub * 100,
    port,
    host: trimmed(env, "HOST") || "0.0.0.0",
    dataDir: path.resolve(trimmed(env, "DATA_DIR") || "data"),
    apiBase: (trimmed(env, "YOOKASSA_API_URL") || "https://api.yookassa.ru/v3").replace(/\/$/, ""),
    rates: {
      fee: parseRate(env.YOOKASSA_FEE_RATE, DEFAULT_FEE),
      feeVat: parseRate(env.YOOKASSA_FEE_VAT_RATE, DEFAULT_FEE_VAT),
      tax: parseRate(env.NPD_TAX_RATE, DEFAULT_TAX),
    },
  };
}
