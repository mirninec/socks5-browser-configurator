const DEFAULT_BYPASS_DOMAINS = [
    "*.ru"
];

const BASE_BYPASS_LIST = [
    "10.0.0.0/8",
    "127.0.0.0/8",
    "169.254.0.0/16",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "224.0.0.0/4",
    "::/127",
    "<local>",
    "<localhost>",
    "*.local"
];

const saveButton = document.querySelector("#save");
const loadingButton = document.querySelector("#ing");

const socks5Switch = document.querySelector("#socks5switch");
const socks5HostInput = document.querySelector("#socks5host");
const socks5PortInput = document.querySelector("#socks5port");

const socks5Status = document.querySelector("#socks5status");

const bypassSwitch = document.querySelector("#bypassswitch");
const bypassStatus = document.querySelector("#bypassstatus");
const bypassHint = document.querySelector("#bypasshint");

const newDomainInput = document.querySelector("#newdomain");
const addDomainButton = document.querySelector("#adddomain");
const bypassListElement = document.querySelector("#bypasslist");
const messageStack = document.querySelector("#messageStack");
const DEFAULT_SOCKS5_HOST = "localhost";
const DEFAULT_SOCKS5_PORT = "1080";
const BYPASS_HINT_ACTIVE =
    "Домены из этого списка открываются напрямую, без SOCKS5-прокси.";
const BYPASS_HINT_INACTIVE =
    "Домены из этого списка будут открываться напрямую, без SOCKS5-прокси " +
    "(при включённой кнопке Bypass List).";

let bypassDomains = [];
let isDirty = false;
let savedState = null;

loadingButton.style.display = "none";

init();

async function init() {
    const data = await chrome.storage.local.get([
        "socks5switch",
        "socks5host",
        "socks5port",
        "bypassswitch",
        "bypassdomain"
    ]);

    socks5Switch.checked = (data.socks5switch || "off") === "on";
    socks5HostInput.value = data.socks5host || DEFAULT_SOCKS5_HOST;
    socks5PortInput.value = data.socks5port || DEFAULT_SOCKS5_PORT;

    bypassSwitch.checked = (data.bypassswitch || "on") === "on";

    bypassDomains = parseStoredDomains(
        data.bypassdomain || DEFAULT_BYPASS_DOMAINS.join("\n")
    );

    renderBypassList();

    // Отрисовываем статусные бейджи и текст подсказки согласно состоянию.
    updateSocks5Status();
    updateBypassStatus();

    addDomainButton.addEventListener("click", handleAddDomain);
    newDomainInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleAddDomain();
        }
    });

    saveButton.addEventListener("click", handleSave);

    trackFormChanges();

    captureSavedState();

    setupUnloadGuard();
}

function setupUnloadGuard() {
    // Нативный диалог браузера при закрытии вкладки/окна.
    // Кастомный текст современные браузеры игнорируют — показывается
    // стандартное сообщение "Покинуть страницу?".
    window.addEventListener("beforeunload", event => {
        if (isDirty) {
            event.preventDefault();
            // Для совместимости со старыми браузерами.
            event.returnValue = "";
            return "";
        }
    });
}

function getCurrentState() {
    return {
        socks5switch: socks5Switch.checked,
        socks5host: socks5HostInput.value.trim(),
        socks5port: socks5PortInput.value.trim(),
        bypassswitch: bypassSwitch.checked,
        bypassdomain: bypassDomains.join("\n")
    };
}

/*
  Сохраняет текущее состояние как эталонное
  (при загрузке и после успешного сохранения).
*/
function captureSavedState() {
    savedState = getCurrentState();
    setDirty(false);
}

function recomputeDirty() {
    if (!savedState) {
        setDirty(false);
        return;
    }

    const current = getCurrentState();

    const changed =
        current.socks5switch !== savedState.socks5switch ||
        current.socks5host !== savedState.socks5host ||
        current.socks5port !== savedState.socks5port ||
        current.bypassswitch !== savedState.bypassswitch ||
        current.bypassdomain !== savedState.bypassdomain;

    setDirty(changed);
}

function setDirty(value) {
    isDirty = value;
    saveButton.disabled = !isDirty;
}

function trackFormChanges() {
    socks5Switch.addEventListener("change", () => {
        updateSocks5Status();
        recomputeDirty();
    });

    socks5HostInput.addEventListener("input", recomputeDirty);
    socks5PortInput.addEventListener("input", recomputeDirty);

    bypassSwitch.addEventListener("change", () => {
        updateBypassStatus();
        recomputeDirty();
    });
}

function parseStoredDomains(value) {
    return value
        .split("\n")
        .map(normalizeDomain)
        .filter(Boolean)
        .filter(uniqueOnly);
}

function uniqueOnly(value, index, array) {
    return array.indexOf(value) === index;
}

function normalizeDomain(value) {
    let domain = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//i, "")
        .replace(/\/.*$/, "")
        .replace(/\.$/, "");

    if (!domain) {
        return "";
    }

    const isWildcard = domain.startsWith("*.");

    if (isWildcard) {
        domain = domain.slice(2);
    }

    domain = domain
        .trim()
        .replace(/\.$/, "");

    if (!domain) {
        return "";
    }

    return isWildcard ? `*.${domain}` : domain;
}


function renderBypassList() {
    bypassListElement.innerHTML = "";

    if (bypassDomains.length === 0) {
        const empty = document.createElement("li");
        empty.className = "empty-list";
        empty.textContent = "Список пуст";
        bypassListElement.appendChild(empty);
        return;
    }

    const fragment = document.createDocumentFragment();

    bypassDomains.forEach((domain, index) => {
        const item = document.createElement("li");
        item.className = "bypass-item";
        item.dataset.domain = domain;

        const text = document.createElement("span");
        text.className = "bypass-domain";
        text.textContent = domain;
        text.title = domain;

        const remove = document.createElement("button");
        remove.className = "remove-domain";
        remove.type = "button";
        remove.title = "Удалить домен";
        remove.setAttribute("aria-label", `Удалить ${domain}`);
        remove.textContent = "×";

        remove.addEventListener("click", () => {
            const removedDomain = bypassDomains[index];
            const removedIndex = index;

            bypassDomains.splice(index, 1);
            renderBypassList();
            recomputeDirty();

            showPopupSuccess({
                title: "Домен удалён",
                messageNode: buildDomainMessage(
                    "Домен ",
                    removedDomain,
                    " удалён из списка обхода."
                ),
                actions: [
                    {
                        label: "Отменить",
                        onClick: () => {
                            if (bypassDomains.includes(removedDomain)) {
                                highlightDomain(removedDomain);
                                return;
                            }

                            const insertAt = Math.min(removedIndex, bypassDomains.length);
                            bypassDomains.splice(insertAt, 0, removedDomain);

                            renderBypassList();
                            recomputeDirty();
                            highlightDomain(removedDomain);
                        }
                    }
                ]
            });
        });

        item.appendChild(text);
        item.appendChild(remove);
        fragment.appendChild(item);
    });

    bypassListElement.appendChild(fragment);
}

function handleAddDomain() {
    const domain = normalizeDomain(newDomainInput.value);

    if (!domain) {
        showPopupError({
            title: "Домен не указан",
            message: "Введите домен, который нужно добавить в список обхода."
        });
        return;
    }

    if (!isValidBypassDomain(domain)) {
        showPopupError({
            title: "Некорректный домен",
            message: "Используйте формат example.com, *.example.com, пример.рф или *.рф."
        });
        return;
    }

    const conflict = findDomainConflict(domain);

    if (conflict) {
        showPopupError({
            title: conflict.title,
            message: conflict.message
        });

        // Конфликтующий домен подсвечиваем временно (авто-снятие).
        highlightDomain(conflict.domain);
        return;
    }

    bypassDomains.push(domain);
    bypassDomains.sort(compareDomains);

    newDomainInput.value = "";
    renderBypassList();
    recomputeDirty();

    // Постоянная подсветка добавленного домена — снимется при закрытии попапа.
    highlightDomain(domain, { persist: true });

    showPopupSuccess({
        title: "Домен добавлен",
        messageNode: buildDomainMessage(
            "Домен ",
            domain,
            " добавлен в список обхода."
        ),
        // Домен, подсветку которого нужно снять при закрытии этого попапа.
        highlightedDomain: domain,
        actions: [
            {
                label: "Отменить",
                onClick: () => {
                    const indexToRemove = bypassDomains.indexOf(domain);

                    if (indexToRemove === -1) {
                        return;
                    }

                    bypassDomains.splice(indexToRemove, 1);
                    renderBypassList();
                    recomputeDirty();
                }
            }
        ]
    });
}

function isValidBypassDomain(domain) {
    if (!domain || domain === "*") {
        return false;
    }

    if (domain.startsWith("*.")) {
        return isValidPlainDomain(domain.slice(2));
    }

    return isValidPlainDomain(domain);
}

function isValidPlainDomain(domain) {
    if (!domain) {
        return false;
    }

    if (domain.includes("..")) {
        return false;
    }

    if (domain.startsWith(".") || domain.endsWith(".")) {
        return false;
    }

    const labels = domain.split(".");

    if (labels.some(label => !label)) {
        return false;
    }

    try {
        /*
          Проверяем домен через URL.
          URL умеет IDN-домены и преобразует Unicode в punycode.
          Например:
          рф -> xn--p1ai
          пример.рф -> xn--e1afmkfd.xn--p1ai
        */
        const url = new URL(`http://${domain}`);
        const asciiHost = url.hostname;

        if (!asciiHost) {
            return false;
        }

        if (asciiHost.includes("..")) {
            return false;
        }

        const asciiLabels = asciiHost.split(".");

        return asciiLabels.every(label => {
            return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label);
        });
    } catch {
        return false;
    }
}

function findDomainConflict(domain) {
    if (bypassDomains.includes(domain)) {
        return {
            type: "duplicate",
            domain,
            title: "Домен уже добавлен",
            message: `Домен ${domain} уже есть в списке обхода.`
        };
    }

    const coveringWildcard = findCoveringWildcard(domain);

    if (coveringWildcard) {
        return {
            type: "covered-by-wildcard",
            domain: coveringWildcard,
            title: "Домен уже покрыт правилом",
            message: `Домен ${domain} уже покрыт расширенным правилом ${coveringWildcard}. Отдельно добавлять его не нужно.`
        };
    }

    return null;
}

function findCoveringWildcard(domain) {
    if (domain.startsWith("*.")) {
        return null;
    }

    for (const existing of bypassDomains) {
        if (!existing.startsWith("*.")) {
            continue;
        }

        const suffix = existing.slice(2);

        if (domain === suffix || domain.endsWith("." + suffix)) {
            return existing;
        }
    }

    return null;
}

function compareDomains(a, b) {
    return a.localeCompare(b, "en");
}

function showPopupMessage({
    type = "error",
    title = "Сообщение",
    message,
    messageNode = null,
    actions = [],
    highlightedDomain = null
}) {
    const popup = document.createElement("div");

    popup.className = `popup-message ${type}`;
    popup.setAttribute("role", type === "error" ? "alert" : "status");

    const closePopup = () => {
        // При закрытии снимаем постоянную подсветку связанного домена.
        if (highlightedDomain) {
            clearDomainHighlight(highlightedDomain);
        }
        popup.remove();
    };

    const xButton = document.createElement("button");
    xButton.className = "popup-message-x";
    xButton.type = "button";
    xButton.title = "Закрыть";
    xButton.setAttribute("aria-label", "Закрыть сообщение");
    xButton.textContent = "×";
    xButton.addEventListener("click", closePopup);

    const titleElement = document.createElement("p");
    titleElement.className = "popup-message-title";
    titleElement.textContent = title;

    const messageElement = document.createElement("p");
    messageElement.className = "popup-message-text";

    if (messageNode) {
        messageElement.appendChild(messageNode);
    } else {
        messageElement.textContent = message;
    }

    const actionsElement = document.createElement("div");
    actionsElement.className = "popup-message-actions";

    actions.forEach(action => {
        const actionButton = document.createElement("button");
        actionButton.className = "popup-message-action-button";
        actionButton.type = "button";
        actionButton.textContent = action.label;

        actionButton.addEventListener("click", () => {
            if (actionButton.disabled) {
                return;
            }
            actionButton.disabled = true;

            action.onClick();
            closePopup();
        });

        actionsElement.appendChild(actionButton);
    });

    const closeButton = document.createElement("button");
    closeButton.className = "popup-message-close-button";
    closeButton.type = "button";
    closeButton.textContent = "Закрыть";
    closeButton.addEventListener("click", closePopup);

    actionsElement.appendChild(closeButton);

    popup.appendChild(xButton);
    popup.appendChild(titleElement);
    popup.appendChild(messageElement);
    popup.appendChild(actionsElement);

    messageStack.appendChild(popup);
}

function showPopupError({ title = "Ошибка", message }) {
    showPopupMessage({
        type: "error",
        title,
        message
    });
}

function showPopupSuccess({
    title = "Готово",
    message,
    messageNode = null,
    actions = [],
    highlightedDomain = null
}) {
    showPopupMessage({
        type: "success",
        title,
        message,
        messageNode,
        actions,
        highlightedDomain
    });
}

/*
  Собирает текст сообщения, где имя домена визуально выделено
  отдельным элементом (класс .popup-domain-name).

  Пример: buildDomainMessage("Домен ", "example.com", " удалён.")
*/
function buildDomainMessage(before, domain, after) {
    const fragment = document.createDocumentFragment();

    fragment.appendChild(document.createTextNode(before));

    const domainElement = document.createElement("span");
    domainElement.className = "popup-domain-name";
    domainElement.textContent = domain;
    fragment.appendChild(domainElement);

    fragment.appendChild(document.createTextNode(after));

    return fragment;
}

/*
  Подсвечивает домен в списке.
  По умолчанию подсветка временная (снимается после анимации).
  При options.persist === true подсветка остаётся, пока её не снимут
  явно через clearDomainHighlight (например, при закрытии попапа).
*/
function highlightDomain(domain, options = {}) {
    const { persist = false } = options;

    if (!domain) {
        return;
    }

    const item = bypassListElement.querySelector(
        `.bypass-item[data-domain="${cssEscape(domain)}"]`
    );

    if (!item) {
        return;
    }

    scrollDomainIntoView(item);

    item.classList.remove("highlight-conflict", "highlight-persist");

    // Перезапускаем CSS-анимацию, если пользователь повторил действие.
    void item.offsetWidth;

    if (persist) {
        // Постоянная подсветка: анимация проигрывается, но фон остаётся.
        item.classList.add("highlight-persist");
        return;
    }

    item.classList.add("highlight-conflict");

    item.addEventListener(
        "animationend",
        () => {
            item.classList.remove("highlight-conflict");
        },
        {
            once: true
        }
    );
}

/*
  Снимает постоянную подсветку с домена.
  Вызывается при закрытии связанного попапа.
*/
function clearDomainHighlight(domain) {
    if (!domain) {
        return;
    }

    const item = bypassListElement.querySelector(
        `.bypass-item[data-domain="${cssEscape(domain)}"]`
    );

    if (item) {
        item.classList.remove("highlight-persist", "highlight-conflict");
    }
}

function scrollDomainIntoView(item) {
    const listWrap = item.closest(".bypass-list-wrap");

    if (!listWrap) {
        item.scrollIntoView({
            block: "center",
            behavior: "smooth"
        });
        return;
    }

    const wrapRect = listWrap.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    const isAbove = itemRect.top < wrapRect.top;
    const isBelow = itemRect.bottom > wrapRect.bottom;

    if (!isAbove && !isBelow) {
        return;
    }

    const targetScrollTop =
        listWrap.scrollTop +
        itemRect.top -
        wrapRect.top -
        listWrap.clientHeight / 2 +
        item.clientHeight / 2;

    listWrap.scrollTo({
        top: targetScrollTop,
        behavior: "smooth"
    });
}

function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
        return window.CSS.escape(value);
    }

    return String(value).replace(/["\\]/g, "\\$&");
}

async function handleSave() {
    const socks5Enabled = socks5Switch.checked;
    const socks5Host = socks5HostInput.value.trim();
    const socks5Port = socks5PortInput.value.trim();
    const bypassEnabled = bypassSwitch.checked;

    if (socks5Enabled && !isValidHost(socks5Host)) {
        showPopupError({
            title: "Некорректный хост",
            message: "Укажите корректный хост, например: localhost, 127.0.0.1 или [::1]."
        });
        return;
    }

    if (socks5Enabled && !isValidPort(socks5Port)) {
        showPopupError({
            title: "Некорректный порт",
            message: "Порт должен быть числом от 1 до 65535 (например, 1080)."
        });
        return;
    }

    setLoading(true);

    try {
        await chrome.storage.local.set({
            socks5switch: socks5Enabled ? "on" : "off",
            socks5host: socks5Host,
            socks5port: socks5Port,
            bypassswitch: bypassEnabled ? "on" : "off",
            bypassdomain: bypassDomains.join("\n")
        });

        if (!socks5Enabled) {
            await chrome.proxy.settings.set({
                value: {
                    mode: "system"
                }
            });
        } else {
            await chrome.proxy.settings.set({
                value: {
                    mode: "fixed_servers",
                    rules: {
                        singleProxy: {
                            scheme: "socks5",
                            host: socks5Host,
                            port: parseInt(socks5Port, 10)
                        },
                        bypassList: buildBypassList(bypassEnabled)
                    }
                }
            });
        }

        await delay(700);

        captureSavedState();
    } catch (e) {
        showPopupError({
            title: "Ошибка сохранения",
            message: String(e)
        });
    } finally {
        setLoading(false);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function setLoading(isLoading) {
    saveButton.style.display = isLoading ? "none" : "inline-flex";
    loadingButton.style.display = isLoading ? "inline-flex" : "none";

    if (isLoading) {
        saveButton.disabled = true;
    } else {
        saveButton.disabled = !isDirty;
    }
}

/*
  Проверяет, что host — это либо валидный IPv4,
  либо валидный hostname/домен, либо IPv6-литерал
  (для случая [::1] host здесь приходит уже без скобок).
*/
function isValidHost(host) {
    if (!host) {
        return false;
    }

    // IPv6: содержит двоеточие (приходит из [::1]:port уже распакованным).
    if (host.includes(":")) {
        return isValidIpv6(host);
    }

    if (isValidIpv4(host)) {
        return true;
    }

    return isValidHostname(host);
}

function isValidIpv4(host) {
    const parts = host.split(".");

    if (parts.length !== 4) {
        return false;
    }

    return parts.every(part => {
        if (!/^\d{1,3}$/.test(part)) {
            return false;
        }
        const num = Number(part);
        return num >= 0 && num <= 255;
    });
}

function isValidIpv6(host) {
    // Базовая проверка синтаксиса IPv6 через встроенный парсер URL.
    // URL корректно принимает [::1], [2001:db8::1] и т.п.
    try {
        const url = new URL(`http://[${host}]`);
        // hostname будет вида "[::1]" — достаточно факта успешного разбора.
        return url.hostname.startsWith("[") && url.hostname.endsWith("]");
    } catch {
        return false;
    }
}

function isValidHostname(host) {
    if (host.length > 253) {
        return false;
    }

    if (host.startsWith(".") || host.endsWith(".") || host.includes("..")) {
        return false;
    }

    try {
        // URL нормализует IDN-домены (Unicode -> punycode).
        const url = new URL(`http://${host}`);
        const asciiHost = url.hostname;

        if (!asciiHost || asciiHost.includes("..")) {
            return false;
        }

        // "localhost" и одиночные метки допустимы для прокси-хоста.
        return asciiHost.split(".").every(label => {
            return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label);
        });
    } catch {
        return false;
    }
}

function buildBypassList(bypassEnabled) {
    const list = [...BASE_BYPASS_LIST];

    if (!bypassEnabled) {
        return list;
    }

    bypassDomains.forEach(domain => {
        // Chrome требует ASCII-only в bypassList.
        const asciiDomain = domainToAscii(domain);

        if (asciiDomain.startsWith("*.")) {
            list.push(asciiDomain);
            return;
        }

        list.push(asciiDomain);
        list.push(`*.${asciiDomain}`);
    });

    return list;
}

/*
  Показывает модальное окно с выбором действия при попытке
  выхода с несохранёнными изменениями.
  Возвращает Promise<"save" | "discard" | "cancel">.
*/
function confirmUnsavedChanges() {
    return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";

        const modal = document.createElement("div");
        modal.className = "modal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("aria-labelledby", "modal-title");

        const modalTitle = document.createElement("h2");
        modalTitle.id = "modal-title";
        modalTitle.className = "modal-title";
        modalTitle.textContent = "Есть несохранённые изменения";

        const modalText = document.createElement("p");
        modalText.className = "modal-text";
        modalText.textContent =
            "Вы внесли изменения, но не сохранили их. Что сделать?";

        const modalActions = document.createElement("div");
        modalActions.className = "modal-actions";

        const finish = result => {
            overlay.remove();
            document.removeEventListener("keydown", onKeyDown);
            resolve(result);
        };

        const saveBtn = document.createElement("button");
        saveBtn.className = "button";
        saveBtn.type = "button";
        saveBtn.textContent = "Сохранить изменения";
        saveBtn.addEventListener("click", () => finish("save"));

        const discardBtn = document.createElement("button");
        discardBtn.className = "button secondary-button";
        discardBtn.type = "button";
        discardBtn.textContent = "Выйти без сохранения изменений";
        discardBtn.addEventListener("click", () => finish("discard"));

        const cancelBtn = document.createElement("button");
        cancelBtn.className = "button secondary-button";
        cancelBtn.type = "button";
        cancelBtn.textContent = "Отмена";
        cancelBtn.addEventListener("click", () => finish("cancel"));

        // Esc — отмена, клик по фону — отмена.
        const onKeyDown = event => {
            if (event.key === "Escape") {
                finish("cancel");
            }
        };
        document.addEventListener("keydown", onKeyDown);

        overlay.addEventListener("click", event => {
            if (event.target === overlay) {
                finish("cancel");
            }
        });

        modalActions.appendChild(saveBtn);
        modalActions.appendChild(discardBtn);
        modalActions.appendChild(cancelBtn);

        modal.appendChild(modalTitle);
        modal.appendChild(modalText);
        modal.appendChild(modalActions);
        overlay.appendChild(modal);

        document.body.appendChild(overlay);

        saveBtn.focus();
    });
}

/*
  Конвертирует домен (возможно IDN) в ASCII/Punycode-представление.
  Использует встроенный URL-парсер, который автоматически
  преобразует Unicode → Punycode.
  
  Примеры:
    "рф"           → "xn--p1ai"
    "*.рф"         → "*.xn--p1ai"
    "пример.рф"    → "xn--e1afmkfd.xn--p1ai"
    "example.com"  → "example.com" (без изменений)
*/
function domainToAscii(domain) {
    if (!domain) {
        return domain;
    }

    const isWildcard = domain.startsWith("*.");
    const bare = isWildcard ? domain.slice(2) : domain;

    try {
        const url = new URL(`http://${bare}`);
        const ascii = url.hostname;
        return isWildcard ? `*.${ascii}` : ascii;
    } catch {
        // Если не удалось распарсить — возвращаем как есть.
        // Валидация уже пропустила домен, значит он корректен,
        // но на всякий случай не ломаем список.
        return domain;
    }
}

/*
  Обновляет бейдж статуса SOCKS5 Proxy.
  Включено — яркий "Активно", выключено — бледный "Не активно".
*/
function updateSocks5Status() {
    const enabled = socks5Switch.checked;

    socks5Status.textContent = enabled ? "Активно" : "Не активно";
    socks5Status.classList.toggle("is-active", enabled);
    socks5Status.classList.toggle("is-inactive", !enabled);
}

/*
  Обновляет бейдж статуса и текст подсказки Bypass List.
  Включено — яркий "Активно" и утвердительный текст подсказки.
  Выключено — бледный "Не активно" и уточняющий текст подсказки.
*/
function updateBypassStatus() {
    const enabled = bypassSwitch.checked;

    bypassStatus.textContent = enabled ? "Активно" : "Не активно";
    bypassStatus.classList.toggle("is-active", enabled);
    bypassStatus.classList.toggle("is-inactive", !enabled);

    bypassHint.textContent = enabled ? BYPASS_HINT_ACTIVE : BYPASS_HINT_INACTIVE;
}

function isValidPort(port) {
    if (!/^\d+$/.test(port)) {
        return false;
    }

    const num = Number(port);

    return Number.isInteger(num) && num > 0 && num <= 65535;
}
