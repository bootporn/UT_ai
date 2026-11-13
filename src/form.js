import { isValidInn, isValidOgrn } from "./ids.js";
import { parseRubToKopecks } from "./money.js";
import { cleanText, isIsoDate } from "./text.js";

const EMPLOYMENT_HINTS = [
  "должност",
  "оклад",
  "пятиднев",
  "трудовой распорядок",
  "полный рабочий день",
  "штатн",
  "подчиня",
  "ежемесячн",
  "с 9 до",
  "с 09:00",
];

function fieldName(value) {
  return /^[0-9A-Za-zА-Яа-яЁё«»"'.(),\-+–—\s]{3,300}$/.test(value);
}

export function contractNumberFor(form, orderId) {
  const custom = cleanText(form.contractNumber, 40);
  if (custom) return custom;
  const compact = (form.contractDate || "").replaceAll("-", "");
  return `АВ-${compact}-${orderId.slice(0, 4).toUpperCase()}`;
}

export function validateForm(input) {
  const errors = [];
  const reject = (field, message) => errors.push({ field, message });
  const form = {
    executorName: cleanText(input.executorName, 300),
    executorInn: cleanText(input.executorInn, 12),
    executorAddress: cleanText(input.executorAddress, 300),
    executorEmail: cleanText(input.executorEmail, 200).toLowerCase(),
    executorPhone: cleanText(input.executorPhone, 40),
    customerType: cleanText(input.customerType, 20),
    customerName: cleanText(input.customerName, 300),
    customerInn: cleanText(input.customerInn, 12),
    customerKpp: cleanText(input.customerKpp, 9),
    customerOgrn: cleanText(input.customerOgrn, 15),
    customerAddress: cleanText(input.customerAddress, 300),
    customerSignatory: cleanText(input.customerSignatory, 300),
    customerPosition: cleanText(input.customerPosition, 120),
    customerAuthority: cleanText(input.customerAuthority, 120) || "Устава",
    customerEmail: cleanText(input.customerEmail, 200).toLowerCase(),
    contractNumber: cleanText(input.contractNumber, 40),
    contractDate: cleanText(input.contractDate, 10),
    serviceDescription: cleanText(input.serviceDescription, 2000),
    dateStart: cleanText(input.dateStart, 10),
    dateEnd: cleanText(input.dateEnd, 10),
    dealAmount: cleanText(input.dealAmount, 20),
    payDays: cleanText(input.payDays, 3) || "5",
    city: cleanText(input.city, 80),
    paymentDetails: cleanText(input.paymentDetails, 500),
    resultConfirm: input.resultConfirm === "yes" ? "yes" : "",
  };

  if (!fieldName(form.executorName)) reject("executorName", "Укажите ФИО исполнителя.");
  if (!isValidInn(form.executorInn) || form.executorInn.length !== 12) {
    reject("executorInn", "ИНН исполнителя — 12 цифр с верной контрольной суммой.");
  }
  if (form.executorAddress.length < 8) reject("executorAddress", "Укажите адрес исполнителя для реквизитов.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.executorEmail)) {
    reject("executorEmail", "Укажите почту: на неё нужна ссылка на файлы.");
  }
  if (form.executorPhone) {
    const digits = form.executorPhone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) reject("executorPhone", "Телефон выглядит неполным.");
  }
  if (!["person", "ip", "company"].includes(form.customerType)) {
    reject("customerType", "Выберите, кто заказчик: человек, ИП или организация.");
  }
  if (form.customerType === "person") {
    form.customerOgrn = "";
    form.customerKpp = "";
  }
  if (!fieldName(form.customerName)) reject("customerName", "Укажите имя или название заказчика.");
  const expectedInn = form.customerType === "company" ? 10 : 12;
  if (!isValidInn(form.customerInn) || form.customerInn.length !== expectedInn) {
    reject(
      "customerInn",
      form.customerType === "company"
        ? "ИНН организации — 10 цифр с верной контрольной суммой."
        : "ИНН заказчика — 12 цифр с верной контрольной суммой.",
    );
  }
  if (form.customerType === "company") {
    if (!/^\d{9}$/.test(form.customerKpp) || form.customerKpp === "000000000") {
      reject("customerKpp", "КПП организации — 9 цифр.");
    }
    if (!form.customerSignatory || !form.customerPosition) {
      reject("customerSignatory", "Для организации нужны подписант и должность.");
    }
    if (!isValidOgrn(form.customerOgrn, "company")) {
      reject("customerOgrn", "ОГРН организации — 13 цифр с верной контрольной цифрой.");
    }
  } else if (form.customerType === "ip") {
    if (!isValidOgrn(form.customerOgrn, "ip")) {
      reject("customerOgrn", "ОГРНИП — 15 цифр с верной контрольной цифрой.");
    }
  }
  if (form.customerAddress.length < 8) reject("customerAddress", "Укажите адрес заказчика.");
  if (form.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) {
    reject("customerEmail", "Почта заказчика указана с ошибкой.");
  }
  if (form.contractNumber && !/^[0-9A-Za-zА-Яа-яЁё\-/]{1,40}$/.test(form.contractNumber)) {
    reject("contractNumber", "Номер договора: буквы, цифры и дефис, до 40 знаков.");
  }
  for (const [field, label] of [
    ["contractDate", "дату договора"],
    ["dateStart", "дату начала"],
    ["dateEnd", "дату окончания"],
  ]) {
    if (!isIsoDate(form[field])) reject(field, `Укажите ${label}.`);
  }
  if (isIsoDate(form.dateStart) && isIsoDate(form.dateEnd) && form.dateStart > form.dateEnd) {
    reject("dateEnd", "Окончание услуг раньше начала.");
  }
  if (isIsoDate(form.contractDate) && isIsoDate(form.dateEnd) && form.contractDate > form.dateEnd) {
    reject("contractDate", "Дата договора позже окончания услуг.");
  }
  if (form.serviceDescription.length < 20) {
    reject("serviceDescription", "Опишите результат услуги хотя бы в 20 знаках: что именно будет сдано.");
  }
  if (/[<>]/.test(form.serviceDescription) || /[<>]/.test(form.paymentDetails)) {
    reject("serviceDescription", "Уберите угловые скобки из текста. Они в документ не нужны.");
  }
  const lowered = form.serviceDescription.toLowerCase();
  if (EMPLOYMENT_HINTS.some((hint) => lowered.includes(hint))) {
    reject(
      "serviceDescription",
      "Описание похоже на штатную должность. Этот пакет только для разовой услуги с результатом. Напишите, что будет сдано заказчику.",
    );
  }
  const dealKopecks = parseRubToKopecks(form.dealAmount);
  if (dealKopecks == null) reject("dealAmount", "Сумма сделки — число больше нуля, в рублях.");
  if (dealKopecks != null && dealKopecks > 240_000_000) {
    reject("dealAmount", "Сумма выше годового лимита НПД 2,4 млн ₽. Такой доход режим не покрывает.");
  }
  if (!/^\d{1,2}$/.test(form.payDays) || Number(form.payDays) < 1 || Number(form.payDays) > 30) {
    reject("payDays", "Срок оплаты — от 1 до 30 рабочих дней.");
  }
  if (!/^[А-Яа-яЁё\-\s]{2,80}$/.test(form.city)) reject("city", "Укажите город договора русскими буквами.");
  if (/\d(?:[ -]?\d){12,}/.test(form.paymentDetails)) {
    reject("paymentDetails", "Не вставляйте полный номер карты. Укажите банк и счёт или напишите, что номер карты отправите отдельно.");
  }
  if (form.resultConfirm !== "yes") {
    reject("resultConfirm", "Подтвердите, что это разовая услуга с результатом, а не работа в штате.");
  }

  return errors.length ? { ok: false, errors, form } : { ok: true, errors: [], form, dealKopecks };
}
