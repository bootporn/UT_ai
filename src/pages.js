import { renderDocuments } from "./documents.js";
import { contractNumberFor } from "./form.js";
import { formatRub } from "./money.js";
import { escapeHtml, formatDateRu } from "./text.js";

function priceLabel(config) {
  return formatRub(config.priceKopecks, { withKopecks: false });
}

function banner(config, kill) {
  if (kill?.shouldStop) {
    return `<div class="banner stop">Приём оплаты остановлен: за 42 дня с запуска не было ни одной боевой оплаты. Капитал не добавляем.</div>`;
  }
  if (config.mode === "test") {
    return `<div class="banner test">Тестовый режим. Оплата не подключена. Это не платёж и не продажа: деньги не списываются, заказ не становится оплаченным.</div>`;
  }
  if (config.mode === "misconfigured") {
    const items = config.problems.map((problem) => `<li>${escapeHtml(problem)}</li>`).join("");
    return `<div class="banner bad"><p>Оплата не включена: настройка не закончена. Платёж не создаётся.</p><ul>${items}</ul></div>`;
  }
  if (config.mode === "rehearsal") {
    return `<div class="banner rehearsal">Пробное подключение ЮKassa. Платёж тестового магазина продажей не считается. Срок в 6 недель включится, когда YOOKASSA_LIVE=yes.</div>`;
  }
  return "";
}

function layout({ title, config, kill, body, noindex = false }) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="Договор, акт и счёт по одной сделке самозанятого. Пакет ${escapeHtml(priceLabel(config))}.">
  ${noindex ? `<meta name="robots" content="noindex">` : ""}
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  ${banner(config, kill)}
  <header class="site-head no-print">
    <a class="mark" href="/">Акт за вечер</a>
    <span class="head-price">${escapeHtml(priceLabel(config))} за сделку</span>
  </header>
  <main>${body}</main>
  <footer class="site-foot no-print">
    <a href="/privacy">Данные</a>
    <span>Не юридическая фирма. Чек «Мой налог» сайт не создаёт.</span>
  </footer>
</body>
</html>`;
}

function field(name, label, form, errors, options = {}) {
  const messages = errors.filter((error) => error.field === name);
  const value = form?.[name] ?? options.value ?? "";
  const type = options.type || "text";
  const hint = options.hint ? `<small>${options.hint}</small>` : "";
  const required = options.required ? "required" : "";
  const input =
    options.kind === "textarea"
      ? `<textarea name="${name}" id="${name}" rows="${options.rows || 5}" ${required}>${escapeHtml(value)}</textarea>`
      : `<input name="${name}" id="${name}" type="${type}" value="${escapeHtml(value)}" ${required} ${options.attrs || ""}>`;
  return `<label class="${messages.length ? "bad-field" : ""}" for="${name}">
    <span>${label}</span>
    ${input}
    ${hint}
    ${messages.map((error) => `<em>${escapeHtml(error.message)}</em>`).join("")}
  </label>`;
}

export function renderHome({ config, kill }) {
  const price = priceLabel(config);
  const stopped = kill.shouldStop;
  const action = stopped
    ? `<p class="stop-note">Новые оплаты не принимаются. Файлы по уже прошедшим боевым оплатам остаются по своим ссылкам.</p>`
    : `<a class="button" href="/new">Заполнить сделку</a>`;
  const body = `<section class="hero">
    <p class="eyebrow">Один пакет на одну сделку</p>
    <h1>Договор, акт и счёт — в тот же вечер.</h1>
    <p class="lead">Для самозанятого, которому заказчик не переводит деньги без документов. Вы вписываете условия разовой услуги. После оплаты ${escapeHtml(price)} открываются три файла для печати, без водяного знака.</p>
    <p class="price-row"><strong>${escapeHtml(price)}</strong><span>разово, без подписки</span></p>
    ${action}
  </section>
  <section>
    <h2>Что внутри</h2>
    <ol class="plain">
      <li>Договор возмездного оказания услуг. В нём прямо сказано, что это не работа в штате.</li>
      <li>Акт сдачи-приёмки с суммой, сроком и формулировкой «НДС не облагается».</li>
      <li>Счёт на оплату. Это не счёт-фактура и не чек.</li>
    </ol>
  </section>
  <section>
    <h2>Почему за это уже платят</h2>
    <p>Бухгалтерия заказчика часто ждёт договор и акт, хотя для налога ей нужен ещё и чек из «Мой налог». Пустой комплект форм продаётся за 1&nbsp;490–1&nbsp;990&nbsp;₽. Разовый пакет, который юрист собирает по переписке, стоит от 1&nbsp;490&nbsp;₽. Здесь ${escapeHtml(price)} за уже заполненную сделку и без переписки. Юрист текст не читает: перед подписью его читаете вы.</p>
  </section>
  <section>
    <h2>Как это проходит</h2>
    <ol class="plain">
      <li>Вносите стороны, результат и цену сделки. Цена сделки в договор, с карты она не списывается.</li>
      <li>Смотрите бланки с водяным знаком и проверяете имена и сумму.</li>
      <li>Платите ${escapeHtml(price)} картой физического лица через ЮKassa, на магазин самозанятого.</li>
      <li>Сохраняете PDF и отправляете заказчику сами. Чек в «Мой налог» по вашей сделке формируете вы, не этот сайт.</li>
    </ol>
  </section>
  <section class="note">
    <h2>Чего здесь нет</h2>
    <p>Это не консультация юриста и не проверка статуса на сайте налоговой. Статус НПД смотрите сами на npd.nalog.ru. Описание штатной должности сервис не примет. Оплата от организации через магазин самозанятого в ЮKassa не проходит: платит физическое лицо.</p>
  </section>`;
  return layout({ title: "Акт за вечер — договор, акт и счёт", config, kill, body });
}

export function renderFormPage({ config, kill, form, errors = [], action }) {
  const values = form || { payDays: "5", customerAuthority: "Устава" };
  const summary = errors?.length
    ? `<div class="form-errors"><p>Поправьте поля, документ ещё не собран.</p><ul>${errors.map((error) => `<li>${escapeHtml(error.message)}</li>`).join("")}</ul></div>`
    : "";
  const body = `<h1>Условия одной сделки</h1>
    <p>Сейчас ничего не списывается. На следующем шаге будет образец. Сумма ниже — это цена вашей сделки с заказчиком, а не цена пакета.</p>
    ${summary}
    <form method="post" action="${escapeHtml(action)}" class="deal-form">
      <fieldset>
        <legend>Исполнитель, самозанятый</legend>
        ${field("executorName", "ФИО", values, errors, { required: true, attrs: 'autocomplete="name"' })}
        ${field("executorInn", "ИНН, 12 цифр", values, errors, { required: true, attrs: 'inputmode="numeric" autocomplete="off"' })}
        ${field("executorAddress", "Адрес для реквизитов", values, errors, { required: true })}
        ${field("executorEmail", "Почта для ссылки на файлы", values, errors, { type: "email", required: true, attrs: 'autocomplete="email"' })}
        ${field("executorPhone", "Телефон, если нужен в договоре", values, errors, { type: "tel" })}
        ${field("paymentDetails", "Куда заказчик переведёт деньги", values, errors, { hint: "Банк и счёт или фраза, что номер карты отправите отдельно. Полный номер карты не вставляйте." })}
      </fieldset>
      <fieldset>
        <legend>Заказчик</legend>
        <div class="choices">
          ${["person", "Человек", "ip", "ИП", "company", "Организация"].map((item, index, list) => {
            if (index % 2) return "";
            const value = list[index];
            const label = list[index + 1];
            const checked = values.customerType === value ? "checked" : "";
            return `<label class="choice"><input type="radio" name="customerType" value="${value}" ${checked} required><span>${label}</span></label>`;
          }).join("")}
        </div>
        ${errors.filter((error) => error.field === "customerType").map((error) => `<em>${escapeHtml(error.message)}</em>`).join("")}
        ${field("customerName", "ФИО или название", values, errors, { required: true })}
        ${field("customerInn", "ИНН", values, errors, { required: true, attrs: 'inputmode="numeric"' })}
        ${field("customerKpp", "КПП, для организации", values, errors, { attrs: 'inputmode="numeric"' })}
        ${field("customerOgrn", "ОГРН или ОГРНИП", values, errors, { hint: "Для организации 13 цифр, для ИП 15. Для человека оставьте пустым.", attrs: 'inputmode="numeric"' })}
        ${field("customerAddress", "Адрес", values, errors, { required: true })}
        ${field("customerPosition", "Должность подписанта, для организации", values, errors, { hint: "Например: генерального директора" })}
        ${field("customerSignatory", "ФИО подписанта, для организации", values, errors)}
        ${field("customerAuthority", "Действует на основании", values, errors, { value: values.customerAuthority || "Устава" })}
        ${field("customerEmail", "Почта заказчика, если есть", values, errors, { type: "email" })}
      </fieldset>
      <fieldset>
        <legend>Сделка</legend>
        ${field("city", "Город договора", values, errors, { required: true })}
        ${field("contractNumber", "Номер договора", values, errors, { hint: "Можно пустым: номер соберётся сам." })}
        ${field("contractDate", "Дата договора", values, errors, { type: "date", required: true })}
        ${field("dateStart", "Начало услуг", values, errors, { type: "date", required: true })}
        ${field("dateEnd", "Окончание услуг", values, errors, { type: "date", required: true })}
        ${field("serviceDescription", "Какой результат будет сдан", values, errors, { kind: "textarea", required: true, hint: "Конкретный результат, не должность и не график присутствия." })}
        ${field("dealAmount", "Цена сделки, ₽", values, errors, { required: true, attrs: 'inputmode="decimal"', hint: "Попадёт в договор. С вашей карты за пакет спишется отдельно, фиксированная цена сервиса." })}
        ${field("payDays", "Оплата после акта, рабочих дней", values, errors, { type: "number", attrs: 'min="1" max="30"', value: values.payDays || "5" })}
      </fieldset>
      <label class="check ${errors.some((error) => error.field === "resultConfirm") ? "bad-field" : ""}">
        <input type="checkbox" name="resultConfirm" value="yes" ${values.resultConfirm === "yes" ? "checked" : ""} required>
        <span>Это разовая услуга с результатом, а не работа в штате.</span>
      </label>
      <button type="submit">Собрать образец</button>
    </form>`;
  return layout({
    title: "Условия сделки — Акт за вечер",
    config,
    kill,
    noindex: true,
    body,
  });
}

export function renderOrderPage({ config, kill, order, errors = [] }) {
  const paid = order.status === "paid";
  const price = priceLabel(config);
  const deal = formatRub(order.form.dealKopecks);
  const number = contractNumberFor(order.form, order.id);
  let payBlock = "";
  if (paid) {
    const link = `${config.publicBaseUrl}/orders/${order.id}`;
    const mail = `mailto:${encodeURIComponent(order.form.executorEmail)}?subject=${encodeURIComponent("Документы по сделке")}&body=${encodeURIComponent("Ссылка на файлы: " + link)}`;
    payBlock = `<section class="pay-box paid-box no-print">
      <h2>Оплата прошла</h2>
      <p>Ниже три файла без водяного знака. Сохраните PDF через печать браузера. Письмо само не уходит.</p>
      <p><a href="${escapeHtml(mail)}">Открыть черновик письма себе со ссылкой</a></p>
      <button type="button" data-print>Печать или PDF</button>
      <script src="/print.js"></script>
    </section>`;
  } else if (kill.shouldStop) {
    payBlock = `<section class="pay-box no-print"><h2>Оплата закрыта</h2><p>Срок в 6 недель вышел без боевой оплаты. Этот образец можно читать, чистые файлы не выдаются, деньги не принимаются.</p></section>`;
  } else if (order.status === "yookassa_test") {
    payBlock = `<section class="pay-box no-print" id="pay"><h2>Это не продажа</h2><p>ЮKassa вернула тестовый платёж. Деньги не поступали. Заказ не оплачен. На бланках остаётся пометка образца.</p></section>`;
  } else {
    const button =
      config.mode === "test" || config.mode === "misconfigured"
        ? "Продолжить: почему оплаты нет"
        : `Перейти к оплате ${price}`;
    const extra = errors.map((error) => `<em>${escapeHtml(error.message)}</em>`).join("");
    payBlock = `<section class="pay-box no-print" id="pay">
      <p class="price-call">К оплате сейчас <strong>${escapeHtml(price)}</strong> за пакет. Сумма сделки ${escapeHtml(deal)} в договор попадёт, с карты за неё здесь не спишется.</p>
      ${extra}
      <form method="post" action="/orders/${order.id}/pay">
        <label class="check">
          <input type="checkbox" name="immediateDelivery" value="yes" required>
          <span>Прошу выдать файлы сразу после оплаты и понимаю, что с этого момента пакет считается переданным.</span>
        </label>
        <button type="submit">${escapeHtml(button)}</button>
      </form>
      <p><a href="/orders/${order.id}/edit">Изменить данные</a></p>
    </section>`;
  }
  const lead = paid
    ? ""
    : `<p class="no-print">Ниже бланки с пометкой образца. Чистые файлы откроются только после боевой оплаты, не в тестовом режиме.</p>`;
  const body = `<p class="eyebrow no-print">Договор № ${escapeHtml(number)}</p>
    <h1 class="no-print">${paid ? "Файлы для печати" : "Образец перед оплатой"}</h1>
    ${paid ? payBlock : lead}
    ${renderDocuments(order, { paid })}
    ${paid ? "" : payBlock}`;
  return layout({
    title: paid ? "Файлы сделки — Акт за вечер" : "Образец — Акт за вечер",
    config,
    kill,
    noindex: true,
    body,
  });
}

export function renderNoPayment({ config, kill, order }) {
  const body = `<h1>Оплаты нет</h1>
    <p>Платёж не создан. ${config.mode === "misconfigured" ? "Настройка ЮKassa не закончена." : "Ключи ЮKassa не заданы."} Деньги не списаны и не будут списаны этой кнопкой. Заказ не оплачен. Чистые файлы не открыты.</p>
    <p>Это проверка экрана, а не продажа.</p>
    <p><a href="/orders/${order.id}">Вернуться к образцу</a></p>`;
  return layout({ title: "Оплаты нет — Акт за вечер", config, kill, noindex: true, body });
}

export function renderPending({ config, kill }) {
  const body = `<h1>Оплата не завершена</h1>
    <p>ЮKassa ещё не подтвердила платёж. Деньги не отмечены как полученные, файлы остаются образцом. Если вы уже платили, откройте ссылку заказа позже или напишите на ${config.operatorEmail ? escapeHtml(config.operatorEmail) : "почту получателя"} и не платите второй раз, пока статус не ясен.</p>`;
  return layout({ title: "Оплата не завершена — Акт за вечер", config, kill, noindex: true, body });
}

export function renderRejected({ config, kill }) {
  const mail = config.operatorEmail ? ` Напишите на ${escapeHtml(config.operatorEmail)}.` : "";
  const body = `<h1>Оплата не подтверждена</h1>
    <p>Платёж не совпал с заказом или не отмечен как боевой. Чистые файлы не открыты. Если деньги списались, не платите второй раз.${mail}</p>`;
  return layout({ title: "Оплата не подтверждена — Акт за вечер", config, kill, noindex: true, body });
}

export function renderProviderError({ config, kill, message }) {
  const body = `<h1>Платёж не создан</h1>
    <p>${escapeHtml(message)}</p>
    <p>Заказ не оплачен. Повторите позже или проверьте ключи магазина.</p>`;
  return layout({ title: "Платёж не создан — Акт за вечер", config, kill, noindex: true, body });
}

function rub(kopecks) {
  return formatRub(kopecks);
}

export function renderLedger({ config, kill, ledger }) {
  const real = ledger.entries.filter((entry) => entry.real === true);
  const sum = (key) => real.reduce((total, entry) => total + entry[key], 0);
  const rows = real.length
    ? real
        .map(
          (entry) => `<tr>
            <td>${escapeHtml(formatDateRu(entry.moscowDate))}</td>
            <td>${escapeHtml(rub(entry.grossKopecks))}</td>
            <td>${escapeHtml(rub(entry.feeKopecks))}</td>
            <td>${escapeHtml(rub(entry.feeVatKopecks))}</td>
            <td>${escapeHtml(rub(entry.taxKopecks))}</td>
            <td>${escapeHtml(rub(entry.netKopecks))}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td colspan="6">Боевых оплат нет. Тестовый режим и тестовые платежи ЮKassa в журнал не пишутся.</td></tr>`;
  const clock = kill.clockStarted
    ? `Дата запуска ${escapeHtml(formatDateRu(kill.launchedAt))}. Срок правила — ${escapeHtml(formatDateRu(kill.deadline))}, часовой пояс Москвы. Боевых оплат: ${kill.realCount}.`
    : "Часы шести недель не запущены. Нужны боевые ключи, публичный https и YOOKASSA_LIVE=yes. Пока этого нет, тестовые заходы срок не начинают.";
  const body = `<h1>Журнал</h1>
    <p>${clock}</p>
    <p>${kill.shouldStop ? "Правило сработало: новых оплат нет, капитал не добавляем, рекламу не включаем." : "Пока правило не сработало."}</p>
    <div class="scroll-table"><table class="ledger">
      <thead>
        <tr><th>Дата</th><th>Выручка</th><th>Комиссия</th><th>НДС на комиссию</th><th>Налог НПД</th><th>Чистыми</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <th>Итого</th>
          <td>${escapeHtml(rub(sum("grossKopecks")))}</td>
          <td>${escapeHtml(rub(sum("feeKopecks")))}</td>
          <td>${escapeHtml(rub(sum("feeVatKopecks")))}</td>
          <td>${escapeHtml(rub(sum("taxKopecks")))}</td>
          <td>${escapeHtml(rub(sum("netKopecks")))}</td>
        </tr>
      </tfoot>
    </table></div>
    <section class="note">
      <h2>Как посчитано</h2>
      <p>Выручка — полная цена, которую заплатил покупатель. Комиссия — оценка ${escapeHtml(String(config.rates.fee.numerator))}/${escapeHtml(String(config.rates.fee.denominator))} для банковской карты. НДС ${escapeHtml(String(config.rates.feeVat.numerator))}% считается с комиссии, не с выручки: так с 1 января 2026 года устроены карты и SberPay. Для ЮMoney и T-Pay этого НДС нет, фактическая комиссия меньше. Точная цифра — в реестре ЮKassa.</p>
      <p>Налог — ${escapeHtml(String(config.rates.tax.numerator))}% с полной выручки, потому что магазин самозанятого принимает оплату от физического лица. Комиссия базу НПД не уменьшает. К уплате та сумма, которую начислит «Мой налог»: журнал — оценка до чека.</p>
      <p>Чистыми = выручка − комиссия − НДС на комиссию − налог.</p>
      <h2>Правило остановки</h2>
      <p>Шесть недель — это 42 дня с даты запуска, день запуска нулевой. В календарный день наступления срока по Москве при нуле боевых оплат приём денег останавливается. Рекламу не включать. Лимит запуска 15–20 тыс. ₽ не тратить. Капитал 100–150 тыс. ₽ не докладывать. Боевая оплата внутри срока правило не включает. Полный текст — в README репозитория.</p>
    </section>`;
  return layout({ title: "Журнал — Акт за вечер", config, kill, noindex: true, body });
}

export function renderPrivacy({ config, kill }) {
  const operator = config.operatorName
    ? `${escapeHtml(config.operatorName)}, ИНН ${escapeHtml(config.operatorInn)}, ${escapeHtml(config.operatorEmail)}`
    : "получатель ещё не указан: идёт тестовый режим, платёжный сервис данные не получает";
  const body = `<h1>Какие данные здесь лежат</h1>
    <p>Оператор: ${operator}.</p>
    <p>В форму попадают имена, ИНН, адреса, описание услуги, почта и при желании телефон. Они нужны, чтобы собрать договор, акт и счёт и чтобы открыть оплаченный заказ по ссылке.</p>
    <p>Файлы заказа хранятся на сервере, где запущен сайт, в каталоге data. Этот каталог не предназначен для публикации. Данные не продаются.</p>
    <p>В тестовом режиме запрос в ЮKassa не уходит. В боевом режиме платёж принимает ЮKassa по своим правилам, номер карты на этот сайт не попадает.</p>
    <p>Чтобы удалить заказ, напишите оператору с той почты, которая указана в форме. Пока оператор не указан, удалить локальные файлы можно вместе с каталогом data на машине, где запущен сайт.</p>`;
  return layout({ title: "Данные — Акт за вечер", config, kill, body });
}

export function renderNotFound({ config, kill }) {
  return layout({
    title: "Не найдено — Акт за вечер",
    config,
    kill,
    noindex: true,
    body: `<h1>Такой страницы нет</h1><p><a href="/">На главную</a></p>`,
  });
}

export function renderForbidden({ config, kill }) {
  return layout({
    title: "Журнал закрыт — Акт за вечер",
    config,
    kill,
    noindex: true,
    body: `<h1>Журнал закрыт</h1><p>Для просмотра выручки нужен верный ключ в адресе. Суммы здесь не показаны.</p>`,
  });
}
