import { contractNumberFor } from "./form.js";
import { amountInWords, formatRub } from "./money.js";
import { escapeHtml, formatDateRu } from "./text.js";

function row(label, value) {
  return `<p><span class="req-label">${escapeHtml(label)}</span><br>${escapeHtml(value)}</p>`;
}

function customerPreamble(form) {
  if (form.customerType === "company") {
    return `${form.customerName}, ИНН ${form.customerInn}, КПП ${form.customerKpp}, ОГРН ${form.customerOgrn}, в лице ${form.customerPosition} ${form.customerSignatory}, действующего на основании ${form.customerAuthority}, далее — «Заказчик»`;
  }
  if (form.customerType === "ip") {
    return `Индивидуальный предприниматель ${form.customerName}, ИНН ${form.customerInn}, ОГРНИП ${form.customerOgrn}, далее — «Заказчик»`;
  }
  return `${form.customerName}, ИНН ${form.customerInn}, далее — «Заказчик»`;
}

function stamp(paid) {
  if (paid) return `<p class="stamp paid">Экземпляр для печати</p>`;
  return `<p class="stamp sample">ОБРАЗЕЦ. НЕ ПОДПИСЫВАТЬ. ОПЛАТА НЕ ПОДТВЕРЖДЕНА.</p>`;
}

function footer() {
  return `<p class="doc-note">Форма собрана сервисом «Акт за вечер» из данных, которые ввели стороны. Это не юридическая консультация и не проверка юристом. Перед подписанием стороны читают текст и сверяют его со сделкой. Подписи на бланк сервис не ставит.</p>`;
}

export function renderDocuments(order, { paid }) {
  const form = order.form;
  const number = contractNumberFor(form, order.id);
  const price = formatRub(form.dealKopecks);
  const words = amountInWords(form.dealKopecks);
  const date = formatDateRu(form.contractDate);
  const start = formatDateRu(form.dateStart);
  const end = formatDateRu(form.dateEnd);
  const klass = paid ? "sheet" : "sheet sample";
  const customer = customerPreamble(form);
  const payDays = Number(form.payDays);

  const contract = `<article class="${klass}">
    ${stamp(paid)}
    <h1>Договор<br>возмездного оказания услуг</h1>
    <p class="doc-num">№ ${escapeHtml(number)}</p>
    <div class="doc-place">
      <span>г. ${escapeHtml(form.city)}</span>
      <span>${escapeHtml(date)}</span>
    </div>
    <p>${escapeHtml(customer)}, с одной стороны, и ${escapeHtml(form.executorName)}, ИНН ${escapeHtml(form.executorInn)}, плательщик налога на профессиональный доход, далее — «Исполнитель», с другой стороны, вместе — «Стороны», заключили договор о нижеследующем.</p>
    <h2>1. Предмет</h2>
    <p>1.1. Исполнитель обязуется по заданию Заказчика оказать услуги, а Заказчик обязуется принять результат и оплатить его. Услуги оказываются по статье 779 Гражданского кодекса Российской Федерации.</p>
    <p>1.2. Результат услуг: ${escapeHtml(form.serviceDescription)}</p>
    <p>1.3. Срок оказания услуг: с ${escapeHtml(start)} по ${escapeHtml(end)}.</p>
    <p>1.4. Договор не является трудовым. Исполнитель не занимает должность у Заказчика, не подчиняется правилам внутреннего трудового распорядка, сам выбирает время и способ работы и сдаёт результат, а не процесс присутствия.</p>
    <h2>2. Цена и расчёты</h2>
    <p>2.1. Цена услуг — ${escapeHtml(price)} (${escapeHtml(words)}). НДС не облагается: Исполнитель применяет налог на профессиональный доход и не предъявляет его Заказчику. Если Исполнитель является индивидуальным предпринимателем, освобождение от НДС, кроме налога при ввозе товаров, следует из части 9 статьи 2 Федерального закона от 27.11.2018 № 422-ФЗ. К этой сделке ввоз не относится.</p>
    <p>2.2. Заказчик оплачивает цену в течение ${payDays} рабочих дней после подписания акта обеими сторонами. Оплата идёт по реквизитам Исполнителя. Назначение платежа: «Оплата по договору № ${escapeHtml(number)} от ${escapeHtml(date)}. НДС не облагается».</p>
    <p>2.3. Налог на профессиональный доход исчисляет и платит Исполнитель. НДФЛ с этой выплаты Заказчик не удерживает, если на момент расчёта Исполнитель применяет этот режим и передал чек. Если Исполнитель — физическое лицо без статуса индивидуального предпринимателя, выплата при наличии такого чека не является объектом обложения страховыми взносами.</p>
    <p>2.4. Исполнитель формирует чек в сервисе «Мой налог» и передаёт его Заказчику в порядке статьи 14 Федерального закона № 422-ФЗ. При безналичной оплате чек передаётся не позднее 9-го числа месяца, следующего за месяцем расчёта. Для учёта расходов Заказчика-организации или ИП чек обязателен: части 8–10 статьи 15 того же закона. Акт чек не заменяет.</p>
    <h2>3. Сдача и приёмка</h2>
    <p>3.1. По окончании услуг Исполнитель передаёт акт сдачи-приёмки.</p>
    <p>3.2. Заказчик в течение 5 рабочих дней подписывает акт или направляет письменный мотивированный отказ.</p>
    <p>3.3. Если в этот срок мотивированный отказ не направлен, услуги считаются принятыми, а акт — подписанным Заказчиком.</p>
    <h2>4. Права на результат</h2>
    <p>4.1. Если при оказании услуг создаётся результат интеллектуальной деятельности, исключительное право на него переходит к Заказчику с момента полной оплаты цены. До оплаты Исполнитель сохраняет это право, а Заказчик использует результат только чтобы оценить качество.</p>
    <h2>5. Отказ и ответственность</h2>
    <p>5.1. Заказчик вправе отказаться от договора, оплатив оказанные к этому моменту услуги и понесённые Исполнителем расходы. Исполнитель вправе отказаться, возместив Заказчику убытки. Это правило статьи 782 Гражданского кодекса Российской Федерации.</p>
    <p>5.2. Сторона, которая не исполнила обязательство, отвечает по гражданскому законодательству. Исполнитель не отвечает за то, как Заказчик использует результат, если услуги оказаны в согласованном объёме.</p>
    <p>5.3. Сторона освобождается от ответственности, если обязательству помешало обстоятельство, которое она не могла предотвратить. Она сообщает о нём другой стороне в течение 3 рабочих дней.</p>
    <h2>6. Прочие условия</h2>
    <p>6.1. Договор вступает в силу с даты подписания и действует до исполнения обязательств.</p>
    <p>6.2. Условия сделки и переданные материалы стороны не раскрывают третьим лицам, кроме случаев, когда это нужно для исполнения, учёта или по закону.</p>
    <p>6.3. Сообщения по электронной почте, указанной в реквизитах, считаются полученными на следующий рабочий день. Сканы подписанных экземпляров имеют силу до обмена бумажными подлинниками, на основании статей 160 и 434 Гражданского кодекса Российской Федерации.</p>
    <p>6.4. Споры стороны решают по законодательству Российской Федерации: сначала письменная претензия, затем суд.</p>
    <h2>7. Реквизиты</h2>
    <div class="req-grid">
      <div>
        <h3>Исполнитель</h3>
        ${row("ФИО", form.executorName)}
        ${row("ИНН", form.executorInn)}
        ${row("Статус", "налог на профессиональный доход")}
        ${row("Адрес", form.executorAddress)}
        ${row("Почта", form.executorEmail)}
        ${form.executorPhone ? row("Телефон", form.executorPhone) : ""}
        ${form.paymentDetails ? row("Куда платить", form.paymentDetails) : row("Куда платить", "реквизиты Исполнитель сообщает отдельно")}
      </div>
      <div>
        <h3>Заказчик</h3>
        ${row("Наименование", form.customerName)}
        ${row("ИНН", form.customerInn)}
        ${form.customerType === "company" ? row("КПП", form.customerKpp) : ""}
        ${form.customerOgrn ? row(form.customerType === "ip" ? "ОГРНИП" : "ОГРН", form.customerOgrn) : ""}
        ${row("Адрес", form.customerAddress)}
        ${form.customerEmail ? row("Почта", form.customerEmail) : ""}
        ${form.customerType === "company" ? row("Подписант", `${form.customerPosition} ${form.customerSignatory}`) : ""}
      </div>
    </div>
    <div class="sign-grid">
      <p>Исполнитель<br><br>________________ / ${escapeHtml(form.executorName)} /</p>
      <p>Заказчик<br><br>________________ / ${escapeHtml(form.customerType === "company" ? form.customerSignatory : form.customerName)} /</p>
    </div>
    ${footer()}
  </article>`;

  const act = `<article class="${klass}">
    ${stamp(paid)}
    <h1>Акт сдачи-приёмки оказанных услуг</h1>
    <p class="doc-num">к договору № ${escapeHtml(number)} от ${escapeHtml(date)}</p>
    <div class="doc-place">
      <span>г. ${escapeHtml(form.city)}</span>
      <span>${escapeHtml(end)}</span>
    </div>
    <p>${escapeHtml(customer)}, и ${escapeHtml(form.executorName)}, ИНН ${escapeHtml(form.executorInn)}, плательщик налога на профессиональный доход, составили акт о нижеследующем.</p>
    <table>
      <thead>
        <tr><th>Содержание факта</th><th>Ед.</th><th>Кол-во</th><th>Сумма</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(form.serviceDescription)}</td>
          <td>услуга</td>
          <td>1</td>
          <td>${escapeHtml(price)}</td>
        </tr>
      </tbody>
    </table>
    <p>Срок оказания: с ${escapeHtml(start)} по ${escapeHtml(end)}. Итого ${escapeHtml(price)} (${escapeHtml(words)}). НДС не облагается.</p>
    <p>Услуги оказаны полностью и в срок. Заказчик претензий по объёму, качеству и сроку не имеет. Настоящий акт — документ о приёмке. Он не заменяет чек сервиса «Мой налог».</p>
    <div class="sign-grid">
      <p>Исполнитель<br><br>________________ / ${escapeHtml(form.executorName)} /</p>
      <p>Заказчик<br><br>________________ / ${escapeHtml(form.customerType === "company" ? form.customerSignatory : form.customerName)} /</p>
    </div>
    ${footer()}
  </article>`;

  const invoice = `<article class="${klass}">
    ${stamp(paid)}
    <h1>Счёт на оплату</h1>
    <p class="doc-num">№ ${escapeHtml(number)} от ${escapeHtml(date)}</p>
    <p>Этот документ не является счётом-фактурой и не является кассовым или налоговым чеком. Чек по налогу на профессиональный доход формирует Исполнитель в «Мой налог».</p>
    ${row("Получатель", `${form.executorName}, ИНН ${form.executorInn}, НПД`)}
    ${row("Адрес", form.executorAddress)}
    ${form.paymentDetails ? row("Реквизиты", form.paymentDetails) : ""}
    ${row("Плательщик", form.customerName)}
    ${row("ИНН плательщика", form.customerInn)}
    <table>
      <thead>
        <tr><th>Наименование</th><th>Сумма</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>Услуги по договору № ${escapeHtml(number)} от ${escapeHtml(date)}: ${escapeHtml(form.serviceDescription)}</td>
          <td>${escapeHtml(price)}</td>
        </tr>
      </tbody>
    </table>
    <p>Всего к оплате ${escapeHtml(price)} (${escapeHtml(words)}). НДС не облагается.</p>
    <p>Назначение платежа: оплата по договору № ${escapeHtml(number)} от ${escapeHtml(date)}. НДС не облагается.</p>
    <p>Срок оплаты: ${payDays} рабочих дней после подписания акта.</p>
    ${footer()}
  </article>`;

  return `${contract}${act}${invoice}`;
}
