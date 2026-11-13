import { makeInn10, makeInn12, makeOgrn13, makeOgrn15 } from "../src/ids.js";

export function sampleForm(overrides = {}) {
  return {
    executorName: "Иванова Мария Сергеевна",
    executorInn: makeInn12("5001007322"),
    executorAddress: "г. Казань, ул. Примерная, д. 1",
    executorEmail: "maria@example.com",
    executorPhone: "",
    customerType: "company",
    customerName: "ООО «Северный свет»",
    customerInn: makeInn10("770708389"),
    customerKpp: "770701001",
    customerOgrn: makeOgrn13("102770013219"),
    customerAddress: "г. Москва, ул. Примерная, д. 2",
    customerSignatory: "Петров Пётр Петрович",
    customerPosition: "генерального директора",
    customerAuthority: "Устава",
    customerEmail: "buh@example.com",
    contractNumber: "",
    contractDate: "2026-11-01",
    serviceDescription: "Подготовить и передать макет одностраничного сайта: структура, тексты и файл.",
    dateStart: "2026-11-01",
    dateEnd: "2026-11-10",
    dealAmount: "15000",
    payDays: "5",
    city: "Казань",
    paymentDetails: "Реквизиты исполнитель отправит отдельно",
    resultConfirm: "yes",
    ...overrides,
  };
}

export function samplePersonForm() {
  return sampleForm({
    customerType: "person",
    customerName: "Сидоров Сидор Сидорович",
    customerInn: makeInn12("7720000000"),
    customerKpp: "",
    customerOgrn: "",
    customerSignatory: "",
    customerPosition: "",
  });
}

export function sampleIpForm() {
  return sampleForm({
    customerType: "ip",
    customerName: "Кузнецов Кузьма Кузьмич",
    customerInn: makeInn12("5400000000"),
    customerKpp: "",
    customerOgrn: makeOgrn15("30450011600015"),
    customerSignatory: "",
    customerPosition: "",
  });
}
