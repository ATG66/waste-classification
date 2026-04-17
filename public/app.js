const STORAGE_KEYS = {
  image: "recycle-compass:image-history",
  text: "recycle-compass:text-history",
  reminders: "recycle-compass:reminders"
};
const MAX_HISTORY_ITEMS = 8;
const MAX_REMINDER_OVERVIEW_ITEMS = 3;
const REMINDER_DUE_WINDOW_MS = 24 * 60 * 60 * 1000;
const REMINDER_CHECK_INTERVAL_MS = 60 * 1000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const state = {
  imageDataUrl: "",
  stream: null,
  lastImageResult: null,
  lastTextResult: null,
  lastTextQuestion: ""
};

const imageUploadInput = document.getElementById("image-upload-input");
const cameraFallbackInput = document.getElementById("camera-fallback-input");
const imagePreview = document.getElementById("image-preview");
const imagePreviewFrame = document.getElementById("image-preview-frame");
const emptyPreview = document.getElementById("empty-preview");
const imageResult = document.getElementById("image-result");
const analyzeImageBtn = document.getElementById("analyze-image-btn");
const uploadImageBtn = document.getElementById("upload-image-btn");
const openCameraBtn = document.getElementById("open-camera-btn");
const cameraModal = document.getElementById("camera-modal");
const cameraVideo = document.getElementById("camera-video");
const closeCameraBtn = document.getElementById("close-camera-btn");
const captureBtn = document.getElementById("capture-btn");
const fallbackCameraBtn = document.getElementById("fallback-camera-btn");
const textQuestion = document.getElementById("text-question");
const askTextBtn = document.getElementById("ask-text-btn");
const textResult = document.getElementById("text-result");
const startVoiceBtn = document.getElementById("start-voice-btn");
const stopVoiceBtn = document.getElementById("stop-voice-btn");
const voiceLanguageSelect = document.getElementById("voice-language");
const voiceStatus = document.getElementById("voice-status");
const voiceAutoSubmit = document.getElementById("voice-auto-submit");
const voiceLiveIndicator = document.getElementById("voice-live-indicator");
const statusDot = document.getElementById("status-dot");
const statusLabel = document.getElementById("status-label");
const statusCopy = document.getElementById("status-copy");
const modelName = document.getElementById("model-name");
const imageHistory = document.getElementById("image-history");
const textHistory = document.getElementById("text-history");
const clearImageHistoryBtn = document.getElementById("clear-image-history-btn");
const clearTextHistoryBtn = document.getElementById("clear-text-history-btn");
const commonItemsPanel = document.getElementById("common-items-panel");
const commonItemsSearch = document.getElementById("common-items-search");
const commonItemsFilters = document.getElementById("common-items-filters");
const commonItemsGrid = document.getElementById("common-items-grid");
const commonItemsCount = document.getElementById("common-items-count");
const commonItemDetail = document.getElementById("common-item-detail");
const reminderOverviewTitle = document.getElementById("reminder-overview-title");
const reminderOverviewCopy = document.getElementById("reminder-overview-copy");
const reminderOverviewCount = document.getElementById("reminder-overview-count");
const reminderOverviewNext = document.getElementById("reminder-overview-next");
const reminderOverviewList = document.getElementById("reminder-overview-list");
const reminderPermissionChip = document.getElementById("reminder-permission-chip");
const reminderForm = document.getElementById("reminder-form");
const reminderTemplateSelect = document.getElementById("reminder-template");
const reminderTitleInput = document.getElementById("reminder-title");
const reminderSummaryInput = document.getElementById("reminder-summary");
const reminderFrequencySelect = document.getElementById("reminder-frequency");
const reminderWeekdayField = document.getElementById("reminder-weekday-field");
const reminderWeekdaySelect = document.getElementById("reminder-weekday");
const reminderMonthdayField = document.getElementById("reminder-monthday-field");
const reminderMonthdaySelect = document.getElementById("reminder-monthday");
const reminderTimeInput = document.getElementById("reminder-time");
const reminderFormStatus = document.getElementById("reminder-form-status");
const reminderResetBtn = document.getElementById("reset-reminder-form");
const reminderNotificationBtn = document.getElementById("reminder-notification-btn");
const reminderNotificationStatus = document.getElementById("reminder-notification-status");
const remindersList = document.getElementById("reminders-list");

const hasVisionUI =
  imageUploadInput &&
  cameraFallbackInput &&
  imagePreview &&
  imagePreviewFrame &&
  emptyPreview &&
  imageResult &&
  analyzeImageBtn &&
  uploadImageBtn &&
  openCameraBtn &&
  cameraModal &&
  cameraVideo &&
  closeCameraBtn &&
  captureBtn &&
  fallbackCameraBtn;

const hasTextUI = textQuestion && askTextBtn && textResult;
const hasStatusUI = statusDot && statusLabel && statusCopy && modelName;
const hasCommonItemsUI =
  commonItemsPanel &&
  commonItemsSearch &&
  commonItemsFilters &&
  commonItemsGrid &&
  commonItemsCount;
const hasCommonItemDetailUI = Boolean(commonItemDetail);
const hasReminderOverviewUI =
  reminderOverviewTitle &&
  reminderOverviewCopy &&
  reminderOverviewCount &&
  reminderOverviewNext &&
  reminderOverviewList &&
  reminderPermissionChip;
const hasRemindersPageUI =
  reminderForm &&
  reminderTemplateSelect &&
  reminderTitleInput &&
  reminderSummaryInput &&
  reminderFrequencySelect &&
  reminderWeekdayField &&
  reminderWeekdaySelect &&
  reminderMonthdayField &&
  reminderMonthdaySelect &&
  reminderTimeInput &&
  reminderFormStatus &&
  reminderResetBtn &&
  reminderNotificationBtn &&
  reminderNotificationStatus &&
  remindersList;

const commonItemsState = {
  items: [],
  activeCategory: "All",
  query: ""
};

const voiceState = {
  recognition: null,
  supported: false,
  listening: false,
  requestingPermission: false,
  permissionGranted: false,
  manualStop: false,
  baseText: "",
  finalTranscript: ""
};
let reminderIntervalId = null;

const REMINDER_TEMPLATES = [
  {
    id: "paper-cardboard",
    title: "Weekly Paper and Cardboard Check",
    summary:
      "Flatten clean paper boxes and cardboard, keep them dry, and set them aside for your next paper collection run.",
    frequency: "weekly",
    dayOfWeek: 6,
    dayOfMonth: 1,
    time: "19:00"
  },
  {
    id: "clean-plastics",
    title: "Clean Plastics Before Drop-off",
    summary:
      "Rinse drink bottles and rigid plastic containers, remove obvious leftovers, and keep recyclable plastics ready for collection.",
    frequency: "weekly",
    dayOfWeek: 3,
    dayOfMonth: 1,
    time: "20:00"
  },
  {
    id: "battery-dropoff",
    title: "Rechargeable Battery Drop-off",
    summary:
      "Gather rechargeable batteries in one safe spot, tape damaged terminals if needed, and bring them to a designated collection point.",
    frequency: "biweekly",
    dayOfWeek: 6,
    dayOfMonth: 1,
    time: "18:30"
  },
  {
    id: "glass-bottles",
    title: "Glass Bottle Collection Reminder",
    summary:
      "Empty glass bottles, give them a quick rinse, and check whether your building or nearby collection point accepts them this week.",
    frequency: "weekly",
    dayOfWeek: 0,
    dayOfMonth: 1,
    time: "16:00"
  },
  {
    id: "ewaste",
    title: "Monthly E-waste Sort-out",
    summary:
      "Check for old chargers, small appliances, lamps, or other electronics that need a special Hong Kong collection route.",
    frequency: "monthly",
    dayOfWeek: 6,
    dayOfMonth: 1,
    time: "11:00"
  },
  {
    id: "food-waste",
    title: "Food Waste Prep Reminder",
    summary:
      "Empty kitchen scraps regularly, keep them sealed, and follow your estate or nearby food waste arrangement before odour builds up.",
    frequency: "weekly",
    dayOfWeek: 2,
    dayOfMonth: 1,
    time: "21:00"
  }
];

const REMINDER_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];
const FEEDBACK_CATEGORY_OPTIONS = [
  "Paper",
  "Plastics",
  "Metals",
  "Glass Containers",
  "Beverage Cartons",
  "Rechargeable Batteries",
  "Lamps and Bulbs",
  "Small Electrical Appliances",
  "Regulated Electrical Equipment",
  "Food Waste",
  "General Waste"
];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return map[char];
  });
}

function renderLoading(container, label) {
  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner" aria-hidden="true"></div>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function categoryClass(category) {
  if (
    category === "Paper" ||
    category === "Plastics" ||
    category === "Metals" ||
    category === "Glass Containers" ||
    category === "Beverage Cartons"
  ) {
    return "recyclable";
  }

  if (category === "Rechargeable Batteries" || category === "Lamps and Bulbs") {
    return "hazardous";
  }

  if (
    category === "Small Electrical Appliances" ||
    category === "Regulated Electrical Equipment"
  ) {
    return "special";
  }

  if (category === "Food Waste") {
    return "food";
  }

  return "residual";
}

function formatList(items, className) {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }

  return `
    <ul class="${className}">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function readHistory(key) {
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return [];
  }

  const parsed = safeJsonParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeHistory(key, items) {
  window.localStorage.setItem(key, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function truncateText(value, maxLength) {
  const text = String(value || "");
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}...`;
}

function readQuestionFromQuery() {
  return new URLSearchParams(window.location.search).get("q") || "";
}

function readItemIdFromQuery() {
  return new URLSearchParams(window.location.search).get("id") || "";
}

function getArrayField(primary, fallback) {
  if (Array.isArray(primary)) {
    return primary;
  }

  if (Array.isArray(fallback)) {
    return fallback;
  }

  return [];
}

function getPreparationSteps(data) {
  return getArrayField(data.preparation_steps, data.how_to_recycle);
}

function getDropOffOptions(data) {
  return getArrayField(data.drop_off_options, []);
}

function getWarnings(data) {
  return getArrayField(data.warnings, data.tips);
}

function getImageHistoryTitle(entry) {
  const itemNames = Array.isArray(entry.items)
    ? entry.items
        .map((item) => item?.name)
        .filter(Boolean)
        .slice(0, 2)
    : [];

  if (itemNames.length > 0) {
    return itemNames.join(" + ");
  }

  return "Waste Scan";
}

function getTextHistoryTitle(entry) {
  return entry.replyTitle || "Classification Question";
}

function renderEmptyHistory(container, title, description) {
  container.innerHTML = `
    <div class="empty-state compact-empty">
      <span>${escapeHtml(title)}</span>
      <small>${escapeHtml(description)}</small>
    </div>
  `;
}

function renderImageHistory() {
  if (!imageHistory) return;

  const items = readHistory(STORAGE_KEYS.image);

  if (items.length === 0) {
    renderEmptyHistory(
      imageHistory,
      "No photo history yet",
      "Your recent image analysis results will appear here"
    );
    return;
  }

  imageHistory.innerHTML = items
    .map((entry) => {
      const firstCategory = entry.items?.[0]?.category || "General Waste";
      const route = entry.items?.[0]?.route || "Route not saved";
      const summary = entry.summary || entry.note || "No summary available.";
      const thumbnailMarkup = entry.thumbnail
        ? `<img class="history-thumb" src="${escapeHtml(entry.thumbnail)}" alt="Saved waste scan thumbnail" />`
        : `<div class="history-thumb history-thumb-empty">Saved locally</div>`;

      return `
        <article class="history-item">
          ${thumbnailMarkup}
          <div class="history-content">
            <div class="history-topline">
              <div>
                <h3 class="history-title">${escapeHtml(getImageHistoryTitle(entry))}</h3>
              </div>
              <span class="history-time">${escapeHtml(formatTimestamp(entry.createdAt))}</span>
            </div>
            <div class="history-actions">
              <span class="badge ${categoryClass(firstCategory)}">${escapeHtml(firstCategory)}</span>
              <span class="route-chip">${escapeHtml(route)}</span>
            </div>
            <p class="history-summary">${escapeHtml(truncateText(summary, 180))}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTextHistory() {
  if (!textHistory) return;

  const items = readHistory(STORAGE_KEYS.text);

  if (items.length === 0) {
    renderEmptyHistory(
      textHistory,
      "No text history yet",
      "Your recent waste classification questions will appear here"
    );
    return;
  }

  textHistory.innerHTML = items
    .map((entry) => `
      <article class="history-item">
        <div class="history-content history-content-full">
          <div class="history-topline">
            <div>
              <h3 class="history-title">${escapeHtml(getTextHistoryTitle(entry))}</h3>
            </div>
            <span class="history-time">${escapeHtml(formatTimestamp(entry.createdAt))}</span>
          </div>
          <div class="history-actions">
            <span class="badge ${categoryClass(entry.category)}">${escapeHtml(entry.category || "General Waste")}</span>
            <span class="route-chip">${escapeHtml(entry.route || "Route not saved")}</span>
          </div>
          <p class="history-question">${escapeHtml(truncateText(entry.question, 180))}</p>
          <p class="history-reason">${escapeHtml(truncateText(entry.reason || entry.note || "No details available.", 220))}</p>
        </div>
      </article>
    `)
    .join("");
}

async function createThumbnail(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxSide = 240;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        resolve("");
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    image.onerror = () => resolve("");
    image.src = dataUrl;
  });
}

async function saveImageHistory(data) {
  try {
    const entries = readHistory(STORAGE_KEYS.image);
    const thumbnail = await createThumbnail(state.imageDataUrl);
    const historyEntry = {
      createdAt: new Date().toISOString(),
      thumbnail,
      summary: data.summary || "",
      note: data.note || "",
      items: Array.isArray(data.items)
        ? data.items.slice(0, 3).map((item) => ({
            name: item?.name || "",
            category: item?.category || "General Waste",
            route: item?.route || ""
          }))
        : []
    };

    writeHistory(STORAGE_KEYS.image, [historyEntry, ...entries]);
    renderImageHistory();
  } catch (error) {
    console.warn("Failed to save image history:", error);
  }
}

function saveTextHistory(question, data) {
  try {
    const entries = readHistory(STORAGE_KEYS.text);
    const historyEntry = {
      createdAt: new Date().toISOString(),
      question,
      replyTitle: data.reply_title || "Classification Question",
      category: data.category || "General Waste",
      route: data.route || "",
      reason: data.reason || "",
      note: data.note || ""
    };

    writeHistory(STORAGE_KEYS.text, [historyEntry, ...entries]);
    renderTextHistory();
  } catch (error) {
    console.warn("Failed to save text history:", error);
  }
}

function clearHistory(key) {
  window.localStorage.removeItem(key);
}

function readReminders() {
  const raw = window.localStorage.getItem(STORAGE_KEYS.reminders);
  if (!raw) {
    return [];
  }

  const parsed = safeJsonParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeReminders(items) {
  window.localStorage.setItem(STORAGE_KEYS.reminders, JSON.stringify(items));
}

function parseTimeInput(timeString) {
  const [hoursText = "19", minutesText = "00"] = String(timeString || "19:00").split(":");
  return {
    hours: Math.max(0, Math.min(23, Number.parseInt(hoursText, 10) || 0)),
    minutes: Math.max(0, Math.min(59, Number.parseInt(minutesText, 10) || 0))
  };
}

function formatReminderTime(timeString) {
  const sample = new Date();
  const { hours, minutes } = parseTimeInput(timeString);
  sample.setHours(hours, minutes, 0, 0);

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit"
  }).format(sample);
}

function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function createMonthlyOccurrence(year, monthIndex, dayOfMonth, timeString) {
  const { hours, minutes } = parseTimeInput(timeString);
  const safeDay = Math.min(
    Math.max(1, Number.parseInt(String(dayOfMonth || 1), 10) || 1),
    getDaysInMonth(year, monthIndex)
  );

  return new Date(year, monthIndex, safeDay, hours, minutes, 0, 0);
}

function calculateInitialReminderStartAt(frequency, dayOfWeek, dayOfMonth, timeString) {
  const now = new Date();
  const { hours, minutes } = parseTimeInput(timeString);

  if (frequency === "monthly") {
    let candidate = createMonthlyOccurrence(now.getFullYear(), now.getMonth(), dayOfMonth, timeString);

    if (candidate <= now) {
      candidate = createMonthlyOccurrence(
        now.getFullYear(),
        now.getMonth() + 1,
        dayOfMonth,
        timeString
      );
    }

    return candidate;
  }

  const candidate = new Date(now);
  candidate.setHours(hours, minutes, 0, 0);
  const offset = (Number(dayOfWeek) - candidate.getDay() + 7) % 7;
  candidate.setDate(candidate.getDate() + offset);

  if (candidate <= now) {
    candidate.setDate(candidate.getDate() + 7);
  }

  return candidate;
}

function getReminderTiming(reminder, reference = new Date()) {
  const startAt = new Date(reminder?.startAt || "");
  if (Number.isNaN(startAt.getTime())) {
    return {
      currentOccurrence: null,
      nextDue: null
    };
  }

  if (startAt > reference) {
    return {
      currentOccurrence: null,
      nextDue: startAt
    };
  }

  if (reminder.frequency === "monthly") {
    let currentOccurrence = startAt;
    let nextDue = createMonthlyOccurrence(
      startAt.getFullYear(),
      startAt.getMonth() + 1,
      reminder.dayOfMonth,
      reminder.time
    );

    while (nextDue <= reference) {
      currentOccurrence = nextDue;
      nextDue = createMonthlyOccurrence(
        nextDue.getFullYear(),
        nextDue.getMonth() + 1,
        reminder.dayOfMonth,
        reminder.time
      );
    }

    return { currentOccurrence, nextDue };
  }

  const intervalMs = reminder.frequency === "biweekly" ? DAY_IN_MS * 14 : DAY_IN_MS * 7;
  let currentOccurrence = startAt;
  let nextDue = new Date(startAt.getTime() + intervalMs);

  while (nextDue <= reference) {
    currentOccurrence = nextDue;
    nextDue = new Date(nextDue.getTime() + intervalMs);
  }

  return { currentOccurrence, nextDue };
}

function isReminderDue(reminder, reference = new Date()) {
  if (!reminder?.active) {
    return false;
  }

  const { currentOccurrence } = getReminderTiming(reminder, reference);
  if (!currentOccurrence) {
    return false;
  }

  const difference = reference.getTime() - currentOccurrence.getTime();
  return difference >= 0 && difference <= REMINDER_DUE_WINDOW_MS;
}

function getReminderNotificationPermission() {
  if (!("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

function getReminderTemplate(templateId) {
  return REMINDER_TEMPLATES.find((template) => template.id === templateId) || REMINDER_TEMPLATES[0];
}

function formatReminderFrequency(frequency) {
  if (frequency === "biweekly") {
    return "Every 2 weeks";
  }

  if (frequency === "monthly") {
    return "Every month";
  }

  return "Every week";
}

function getReminderScheduleLabel(reminder) {
  if (reminder.frequency === "monthly") {
    return `${formatReminderFrequency(reminder.frequency)} · Day ${reminder.dayOfMonth} · ${formatReminderTime(reminder.time)}`;
  }

  return `${formatReminderFrequency(reminder.frequency)} · ${REMINDER_WEEKDAYS[Number(reminder.dayOfWeek) || 0]} · ${formatReminderTime(reminder.time)}`;
}

function getReminderPermissionLabel(permission = getReminderNotificationPermission()) {
  if (permission === "granted") {
    return "Alerts ready";
  }

  if (permission === "denied") {
    return "Alerts blocked";
  }

  if (permission === "unsupported") {
    return "Alerts unavailable";
  }

  return "Alerts optional";
}

function getReminderPermissionMessage(permission = getReminderNotificationPermission()) {
  if (permission === "granted") {
    return "Browser alerts are enabled. Recycle Compass can raise reminder notifications while this site stays open in a tab.";
  }

  if (permission === "denied") {
    return "Browser alerts are blocked for now. You can still use homepage reminders, or change the browser permission later.";
  }

  if (permission === "unsupported") {
    return "This browser does not support notification alerts here, so reminders will stay inside the site.";
  }

  return "You can enable browser alerts for gentle reminder pop-ups while this site stays open in a tab.";
}

function getSortedReminderEntries(reference = new Date()) {
  return readReminders()
    .map((reminder) => {
      const timing = getReminderTiming(reminder, reference);
      return {
        ...reminder,
        timing,
        dueNow: isReminderDue(reminder, reference)
      };
    })
    .sort((left, right) => {
      if (left.active !== right.active) {
        return left.active ? -1 : 1;
      }

      const leftTime = left.timing.nextDue?.getTime() || Number.MAX_SAFE_INTEGER;
      const rightTime = right.timing.nextDue?.getTime() || Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
}

function setReminderFormStatus(message, tone = "default") {
  if (!reminderFormStatus) return;

  reminderFormStatus.textContent = message;
  reminderFormStatus.classList.remove("is-success", "is-error");

  if (tone === "success") {
    reminderFormStatus.classList.add("is-success");
  }

  if (tone === "error") {
    reminderFormStatus.classList.add("is-error");
  }
}

function renderReminderPermissionState() {
  if (!hasRemindersPageUI) {
    return;
  }

  const permission = getReminderNotificationPermission();
  reminderNotificationStatus.textContent = getReminderPermissionMessage(permission);

  if (permission === "granted") {
    reminderNotificationBtn.textContent = "Browser Alerts Enabled";
    reminderNotificationBtn.disabled = true;
    return;
  }

  if (permission === "unsupported") {
    reminderNotificationBtn.textContent = "Notifications Not Supported";
    reminderNotificationBtn.disabled = true;
    return;
  }

  if (permission === "denied") {
    reminderNotificationBtn.textContent = "Change Alert Permission in Browser Settings";
    reminderNotificationBtn.disabled = true;
    return;
  }

  reminderNotificationBtn.disabled = false;
  reminderNotificationBtn.textContent = "Enable Browser Alerts";
}

function renderReminderOverview(reference = new Date()) {
  if (!hasReminderOverviewUI) {
    return;
  }

  const reminderEntries = getSortedReminderEntries(reference);
  const activeEntries = reminderEntries.filter((entry) => entry.active);
  const dueEntries = activeEntries.filter((entry) => entry.dueNow);
  const upcomingEntries = activeEntries.slice(0, MAX_REMINDER_OVERVIEW_ITEMS);
  const nextEntry = activeEntries[0] || null;
  const permission = getReminderNotificationPermission();

  reminderPermissionChip.textContent = getReminderPermissionLabel(permission);
  reminderOverviewCount.textContent = `${activeEntries.length} active reminder${activeEntries.length === 1 ? "" : "s"}`;

  if (activeEntries.length === 0) {
    const pausedEntries = reminderEntries.filter((entry) => !entry.active);
    const hasPausedEntries = pausedEntries.length > 0;

    reminderOverviewTitle.textContent = hasPausedEntries
      ? "No active reminders right now"
      : "No reminders set yet";
    reminderOverviewCopy.textContent = hasPausedEntries
      ? "You still have paused reminders saved in this browser, and you can resume them any time from the reminder page."
      : "Create a local reminder for paper, batteries, plastics, e-waste, or food waste prep so your homepage stays gently useful.";
    reminderOverviewNext.textContent = hasPausedEntries
      ? "Next reminder: paused"
      : "Next reminder: not scheduled";
    reminderOverviewList.innerHTML = hasPausedEntries
      ? pausedEntries
          .slice(0, MAX_REMINDER_OVERVIEW_ITEMS)
          .map((entry) => `
            <article class="reminder-mini-card">
              <div class="reminder-mini-head">
                <h3>${escapeHtml(entry.title)}</h3>
                <span class="history-chip">Paused</span>
              </div>
              <p>${escapeHtml(entry.summary)}</p>
              <div class="reminder-mini-meta">
                <span class="route-chip">${escapeHtml(getReminderScheduleLabel(entry))}</span>
              </div>
            </article>
          `)
          .join("")
      : `
          <div class="empty-state compact-empty reminder-empty">
            <span>No reminder routine yet</span>
            <small>Use the reminder page to set a schedule that stays only in this browser.</small>
          </div>
        `;
    return;
  }

  if (dueEntries.length > 0) {
    const firstDue = dueEntries[0];
    reminderOverviewTitle.textContent =
      dueEntries.length === 1 ? `Due now: ${firstDue.title}` : `${dueEntries.length} recycling reminders are due`;
    reminderOverviewCopy.textContent =
      "These reminders are currently within their due window, so this homepage is surfacing them first.";
    reminderOverviewNext.textContent = "Reminder window: today";
  } else if (nextEntry?.timing.nextDue) {
    reminderOverviewTitle.textContent = `Next up: ${nextEntry.title}`;
    reminderOverviewCopy.textContent =
      "Your homepage will keep showing the next scheduled reminder so you can stay on top of weekly and monthly routines.";
    reminderOverviewNext.textContent = `Next reminder: ${formatTimestamp(nextEntry.timing.nextDue.toISOString())}`;
  }

  reminderOverviewList.innerHTML = upcomingEntries
    .map((entry) => `
      <article class="reminder-mini-card">
        <div class="reminder-mini-head">
          <h3>${escapeHtml(entry.title)}</h3>
          <span class="history-chip">${escapeHtml(entry.dueNow ? "Due now" : formatReminderFrequency(entry.frequency))}</span>
        </div>
        <p>${escapeHtml(entry.summary)}</p>
        <div class="reminder-mini-meta">
          <span class="route-chip">${escapeHtml(getReminderScheduleLabel(entry))}</span>
          <span class="history-chip">${escapeHtml(
            entry.timing.nextDue
              ? `Next: ${formatTimestamp(entry.timing.nextDue.toISOString())}`
              : "Schedule pending"
          )}</span>
        </div>
      </article>
    `)
    .join("");
}

function renderRemindersList(reference = new Date()) {
  if (!hasRemindersPageUI) {
    return;
  }

  const reminderEntries = getSortedReminderEntries(reference);

  if (reminderEntries.length === 0) {
    remindersList.innerHTML = `
      <div class="empty-state compact-empty reminder-empty">
        <span>No reminders saved yet</span>
        <small>Choose a template above, tune the schedule, and save your first local reminder.</small>
      </div>
    `;
    return;
  }

  remindersList.innerHTML = reminderEntries
    .map((entry) => `
      <article class="reminder-item ${entry.active ? "" : "is-paused"}" data-reminder-id="${escapeHtml(entry.id)}">
        <div class="reminder-item-head">
          <div>
            <h3>${escapeHtml(entry.title)}</h3>
            <p>${escapeHtml(entry.summary)}</p>
          </div>
          <div class="reminder-item-actions">
            <button class="secondary-btn reminder-toggle-btn" type="button" data-reminder-id="${escapeHtml(entry.id)}">
              ${entry.active ? "Pause" : "Resume"}
            </button>
            <button class="secondary-btn reminder-delete-btn" type="button" data-reminder-id="${escapeHtml(entry.id)}">
              Delete
            </button>
          </div>
        </div>
        <div class="reminder-item-meta">
          <span class="badge ${entry.active ? "recyclable" : "residual"}">${escapeHtml(entry.active ? "Active" : "Paused")}</span>
          <span class="route-chip">${escapeHtml(getReminderScheduleLabel(entry))}</span>
          <span class="history-chip">${escapeHtml(
            entry.timing.nextDue
              ? `Next: ${formatTimestamp(entry.timing.nextDue.toISOString())}`
              : "No upcoming time"
          )}</span>
          ${entry.dueNow ? '<span class="history-chip">Due within 24 hours</span>' : ""}
        </div>
      </article>
    `)
    .join("");
}

function updateReminderFieldVisibility() {
  if (!hasRemindersPageUI) {
    return;
  }

  const isMonthly = reminderFrequencySelect.value === "monthly";
  reminderWeekdayField.classList.toggle("hidden", isMonthly);
  reminderMonthdayField.classList.toggle("hidden", !isMonthly);
}

function applyReminderTemplate(templateId) {
  if (!hasRemindersPageUI) {
    return;
  }

  const template = getReminderTemplate(templateId);
  reminderTitleInput.value = template.title;
  reminderSummaryInput.value = template.summary;
  reminderFrequencySelect.value = template.frequency;
  reminderWeekdaySelect.value = String(template.dayOfWeek);
  reminderMonthdaySelect.value = String(template.dayOfMonth);
  reminderTimeInput.value = template.time;
  updateReminderFieldVisibility();
  setReminderFormStatus("Template loaded. Adjust the title, message, or schedule before saving.");
}

function createReminderId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `reminder-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function buildReminderPayloadFromForm() {
  const title = reminderTitleInput.value.trim();
  const summary = reminderSummaryInput.value.trim();
  const frequency = reminderFrequencySelect.value;
  const templateId = reminderTemplateSelect.value;
  const time = reminderTimeInput.value || "19:00";
  const dayOfWeek = Number.parseInt(reminderWeekdaySelect.value, 10);
  const dayOfMonth = Number.parseInt(reminderMonthdaySelect.value, 10);

  if (!title) {
    throw new Error("Please give the reminder a short title.");
  }

  if (!summary) {
    throw new Error("Please add a short reminder note so future you knows what to do.");
  }

  const startAt = calculateInitialReminderStartAt(frequency, dayOfWeek, dayOfMonth, time);

  return {
    id: createReminderId(),
    templateId,
    title,
    summary,
    frequency,
    dayOfWeek,
    dayOfMonth,
    time,
    startAt: startAt.toISOString(),
    active: true,
    lastNotifiedAt: "",
    createdAt: new Date().toISOString()
  };
}

async function requestReminderNotifications() {
  if (!hasRemindersPageUI) {
    return;
  }

  if (!("Notification" in window)) {
    renderReminderPermissionState();
    return;
  }

  const permission = await Notification.requestPermission();
  renderReminderPermissionState();
  renderReminderOverview();

  if (permission === "granted") {
    setReminderFormStatus(
      "Browser alerts are enabled. Recycle Compass can now show reminder pop-ups while this site stays open in a tab.",
      "success"
    );
    maybeSendReminderNotifications();
    return;
  }

  if (permission === "denied") {
    setReminderFormStatus(
      "Browser alerts were blocked. The reminders still work on the homepage and reminders page.",
      "error"
    );
    return;
  }

  setReminderFormStatus("Notification permission was dismissed. You can try again later.");
}

function updateReminderFormOptions() {
  if (!hasRemindersPageUI) {
    return;
  }

  reminderTemplateSelect.innerHTML = REMINDER_TEMPLATES.map(
    (template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.title)}</option>`
  ).join("");

  reminderWeekdaySelect.innerHTML = REMINDER_WEEKDAYS.map(
    (label, index) => `<option value="${index}">${escapeHtml(label)}</option>`
  ).join("");

  reminderMonthdaySelect.innerHTML = Array.from({ length: 28 }, (_, index) => index + 1)
    .map((day) => `<option value="${day}">Day ${day}</option>`)
    .join("");
}

function saveReminderFromForm() {
  try {
    const reminder = buildReminderPayloadFromForm();
    const reminders = readReminders();
    writeReminders([reminder, ...reminders]);
    setReminderFormStatus(
      "Reminder saved. It now appears on the homepage and in your reminder list.",
      "success"
    );
    renderRemindersList();
    renderReminderOverview();
    maybeSendReminderNotifications();
  } catch (error) {
    setReminderFormStatus(error.message || "Reminder could not be saved.", "error");
  }
}

function toggleReminder(id) {
  const reminders = readReminders().map((reminder) =>
    reminder.id === id ? { ...reminder, active: !reminder.active } : reminder
  );
  writeReminders(reminders);
  renderRemindersList();
  renderReminderOverview();
}

function deleteReminder(id) {
  const reminders = readReminders().filter((reminder) => reminder.id !== id);
  writeReminders(reminders);
  renderRemindersList();
  renderReminderOverview();
}

function markRemindersNotified(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return;
  }

  const updates = new Map(
    entries
      .filter((entry) => entry.timing.currentOccurrence)
      .map((entry) => [entry.id, entry.timing.currentOccurrence.toISOString()])
  );

  if (updates.size === 0) {
    return;
  }

  const reminders = readReminders().map((reminder) =>
    updates.has(reminder.id)
      ? {
          ...reminder,
          lastNotifiedAt: updates.get(reminder.id)
        }
      : reminder
  );

  writeReminders(reminders);
}

function maybeSendReminderNotifications(reference = new Date()) {
  if (getReminderNotificationPermission() !== "granted") {
    return;
  }

  const dueEntries = getSortedReminderEntries(reference).filter((entry) => {
    if (!entry.dueNow || !entry.timing.currentOccurrence) {
      return false;
    }

    return entry.lastNotifiedAt !== entry.timing.currentOccurrence.toISOString();
  });

  if (dueEntries.length === 0) {
    return;
  }

  dueEntries.forEach((entry) => {
    try {
      const notification = new Notification(entry.title, {
        body: `${entry.summary} Next step: ${getReminderScheduleLabel(entry)}.`,
        tag: `recycle-reminder-${entry.id}-${entry.timing.currentOccurrence.toISOString()}`
      });

      notification.onclick = () => {
        window.focus();
      };
    } catch (error) {
      console.warn("Notification could not be shown:", error);
    }
  });

  markRemindersNotified(dueEntries);
  renderRemindersList(reference);
  renderReminderOverview(reference);
}

function initializeReminderOverview() {
  renderReminderOverview();
}

function initializeRemindersPage() {
  if (!hasRemindersPageUI) {
    return;
  }

  updateReminderFormOptions();
  applyReminderTemplate(REMINDER_TEMPLATES[0].id);
  renderReminderPermissionState();
  renderRemindersList();

  reminderTemplateSelect.addEventListener("change", (event) => {
    applyReminderTemplate(event.target.value);
  });

  reminderFrequencySelect.addEventListener("change", updateReminderFieldVisibility);
  reminderResetBtn.addEventListener("click", () => {
    applyReminderTemplate(reminderTemplateSelect.value);
  });
  reminderNotificationBtn.addEventListener("click", () => {
    requestReminderNotifications();
  });
  reminderForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveReminderFromForm();
  });

  remindersList.addEventListener("click", (event) => {
    const toggleButton = event.target.closest(".reminder-toggle-btn");
    if (toggleButton) {
      toggleReminder(toggleButton.dataset.reminderId || "");
      return;
    }

    const deleteButton = event.target.closest(".reminder-delete-btn");
    if (deleteButton) {
      deleteReminder(deleteButton.dataset.reminderId || "");
    }
  });
}

function startReminderWatcher() {
  if (reminderIntervalId) {
    window.clearInterval(reminderIntervalId);
  }

  maybeSendReminderNotifications();
  renderReminderOverview();
  renderRemindersList();

  reminderIntervalId = window.setInterval(() => {
    maybeSendReminderNotifications();
    renderReminderOverview();
    renderRemindersList();
  }, REMINDER_CHECK_INTERVAL_MS);
}

function setVoiceStatus(message, tone = "default") {
  if (!voiceStatus) return;

  voiceStatus.textContent = message;
  voiceStatus.classList.remove("is-recording", "is-error", "is-success");

  if (tone === "recording") {
    voiceStatus.classList.add("is-recording");
  }

  if (tone === "error") {
    voiceStatus.classList.add("is-error");
  }

  if (tone === "success") {
    voiceStatus.classList.add("is-success");
  }
}

function setVoiceIndicator(label, tone = "default") {
  if (!voiceLiveIndicator) return;

  voiceLiveIndicator.textContent = label;
  voiceLiveIndicator.classList.remove("is-live", "is-error", "is-ready");

  if (tone === "live") {
    voiceLiveIndicator.classList.add("is-live");
  }

  if (tone === "error") {
    voiceLiveIndicator.classList.add("is-error");
  }

  if (tone === "ready") {
    voiceLiveIndicator.classList.add("is-ready");
  }
}

function updateVoiceButtons() {
  if (!startVoiceBtn || !stopVoiceBtn || !voiceLanguageSelect) return;

  startVoiceBtn.disabled =
    !voiceState.supported || voiceState.listening || voiceState.requestingPermission;
  stopVoiceBtn.disabled = !voiceState.supported || !voiceState.listening;
  voiceLanguageSelect.disabled = voiceState.listening || voiceState.requestingPermission;
  if (voiceAutoSubmit) {
    voiceAutoSubmit.disabled = voiceState.listening || voiceState.requestingPermission;
  }
}

function applyTranscript(interimTranscript = "") {
  if (!textQuestion) return;

  const base = voiceState.baseText ? `${voiceState.baseText.trimEnd()} ` : "";
  const composed = `${base}${voiceState.finalTranscript}${interimTranscript}`.trim();
  textQuestion.value = composed;
}

function stopVoiceRecognition(forceAbort = false) {
  if (!voiceState.recognition) return;

  voiceState.manualStop = true;

  if (forceAbort) {
    voiceState.recognition.abort();
  } else {
    voiceState.recognition.stop();
  }
}

function stopSpeakingAnswer() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

function buildAnswerSpeechText(data) {
  const preparation = getPreparationSteps(data);
  const dropOff = getDropOffOptions(data);
  const warnings = getWarnings(data);

  return [
    data.reply_title || "Route recommendation",
    data.category ? `Category: ${data.category}.` : "",
    data.route ? `Route: ${data.route}.` : "",
    data.reason ? `Reason: ${data.reason}.` : "",
    preparation.length > 0 ? `Preparation: ${preparation.join(". ")}.` : "",
    dropOff.length > 0 ? `Drop-off options: ${dropOff.join(". ")}.` : "",
    warnings.length > 0 ? `Watch-outs: ${warnings.join(". ")}.` : "",
    data.note ? `Note: ${data.note}.` : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function attachReadAloudButton(data) {
  const button = document.getElementById("read-answer-btn");
  if (!button || !window.speechSynthesis) return;

  button.addEventListener("click", () => {
    if (button.dataset.state === "speaking") {
      stopSpeakingAnswer();
      button.dataset.state = "idle";
      button.textContent = "Read Answer Aloud";
      return;
    }

    stopSpeakingAnswer();
    const utterance = new SpeechSynthesisUtterance(buildAnswerSpeechText(data));
    utterance.lang = voiceLanguageSelect?.value || "en-HK";
    utterance.onend = () => {
      button.dataset.state = "idle";
      button.textContent = "Read Answer Aloud";
    };
    utterance.onerror = () => {
      button.dataset.state = "idle";
      button.textContent = "Read Answer Aloud";
    };

    button.dataset.state = "speaking";
    button.textContent = "Stop Reading";
    window.speechSynthesis.speak(utterance);
  });
}

async function ensureMicrophonePermission() {
  if (voiceState.permissionGranted) {
    return true;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setVoiceStatus(
      "This browser cannot request microphone access directly. Please type your question manually or switch to a newer browser.",
      "error"
    );
    setVoiceIndicator("Unavailable", "error");
    return false;
  }

  voiceState.requestingPermission = true;
  updateVoiceButtons();
  setVoiceStatus("Requesting microphone permission...", "recording");
  setVoiceIndicator("Requesting access", "live");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    });

    stream.getTracks().forEach((track) => track.stop());
    voiceState.permissionGranted = true;
    setVoiceIndicator("Ready", "ready");
    return true;
  } catch (error) {
    voiceState.permissionGranted = false;

    if (error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError") {
      setVoiceStatus(
        "Microphone permission was denied. Please allow microphone access for this site and try again.",
        "error"
      );
      setVoiceIndicator("Permission denied", "error");
      return false;
    }

    if (error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError") {
      setVoiceStatus(
        "No microphone was detected. Please connect a microphone and try again.",
        "error"
      );
      setVoiceIndicator("No microphone", "error");
      return false;
    }

    if (error?.name === "NotReadableError") {
      setVoiceStatus(
        "The microphone is busy or unavailable. Please close other apps using it and try again.",
        "error"
      );
      setVoiceIndicator("Device busy", "error");
      return false;
    }

    setVoiceStatus(
      "Microphone access could not be started. Please check your browser and system microphone settings.",
      "error"
    );
    setVoiceIndicator("Unavailable", "error");
    return false;
  } finally {
    voiceState.requestingPermission = false;
    updateVoiceButtons();
  }
}

function initializeVoiceInput() {
  if (
    !hasTextUI ||
    !startVoiceBtn ||
    !stopVoiceBtn ||
    !voiceLanguageSelect ||
    !voiceStatus ||
    !voiceLiveIndicator
  ) {
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    voiceState.supported = false;
    setVoiceStatus(
      "Voice input is not supported in this browser. You can still type your question manually.",
      "error"
    );
    setVoiceIndicator("Unsupported", "error");
    updateVoiceButtons();
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = voiceLanguageSelect.value || "en-HK";
  voiceState.recognition = recognition;
  voiceState.supported = true;
  setVoiceStatus(
    "Voice input is ready. Choose a language, start speaking, then review the transcript before asking AI."
  );
  setVoiceIndicator("Ready", "ready");
  updateVoiceButtons();

  recognition.onstart = () => {
    voiceState.listening = true;
    voiceState.manualStop = false;
    voiceState.baseText = textQuestion.value.trim();
    voiceState.finalTranscript = "";
    setVoiceStatus("Listening... speak clearly and pause when you are done.", "recording");
    setVoiceIndicator("Recording", "live");
    updateVoiceButtons();
  };

  recognition.onresult = (event) => {
    let finalTranscript = "";
    let interimTranscript = "";

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0]?.transcript || "";
      if (event.results[index].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript) {
      voiceState.finalTranscript = `${voiceState.finalTranscript}${finalTranscript}`.trim();
    }

    applyTranscript(interimTranscript);
  };

  recognition.onerror = (event) => {
    voiceState.listening = false;
    updateVoiceButtons();

    if (event.error === "aborted" && voiceState.manualStop) {
      setVoiceStatus("Voice input stopped. Review the transcript or start again.");
      setVoiceIndicator("Stopped", "ready");
      return;
    }

    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      setVoiceStatus(
        "Microphone permission was denied. Please allow microphone access and try again.",
        "error"
      );
      setVoiceIndicator("Permission denied", "error");
      return;
    }

    if (event.error === "no-speech") {
      setVoiceStatus(
        "No speech was detected. Please try again and speak a little closer to the microphone.",
        "error"
      );
      setVoiceIndicator("No speech", "error");
      return;
    }

    if (event.error === "audio-capture") {
      setVoiceStatus(
        "No microphone was detected. Please check your device audio input and try again.",
        "error"
      );
      setVoiceIndicator("No microphone", "error");
      return;
    }

    setVoiceStatus("Voice input stopped unexpectedly. Please try again.", "error");
    setVoiceIndicator("Unavailable", "error");
  };

  recognition.onend = async () => {
    const wasListening = voiceState.listening;
    const manualStop = voiceState.manualStop;
    voiceState.listening = false;
    voiceState.manualStop = false;
    updateVoiceButtons();

    if (!wasListening) {
      return;
    }

    if (voiceState.finalTranscript || textQuestion.value.trim()) {
      if (voiceAutoSubmit?.checked) {
        setVoiceStatus("Voice input finished. Sending your transcript to AI...", "success");
        setVoiceIndicator("Submitting", "live");
        await askTextQuestion({ source: "voice" });
        return;
      }

      setVoiceStatus("Voice input finished. Review the transcript and press Ask AI when ready.", "success");
      setVoiceIndicator(manualStop ? "Stopped" : "Ready", "ready");
      return;
    }

    setVoiceStatus("Voice input finished without a transcript. You can try again or type manually.", "error");
    setVoiceIndicator("No transcript", "error");
  };

  startVoiceBtn.addEventListener("click", async () => {
    if (!voiceState.recognition || voiceState.listening || voiceState.requestingPermission) return;

    const canUseMicrophone = await ensureMicrophonePermission();
    if (!canUseMicrophone) {
      return;
    }

    voiceState.recognition.lang = voiceLanguageSelect.value || "en-HK";
    try {
      voiceState.recognition.start();
    } catch (error) {
      setVoiceStatus("Voice input could not start right now. Please try again.", "error");
      setVoiceIndicator("Unavailable", "error");
    }
  });

  stopVoiceBtn.addEventListener("click", () => {
    if (!voiceState.recognition || !voiceState.listening) return;
    stopVoiceRecognition(false);
  });
}

function prefillTextQuestionFromQuery() {
  if (!textQuestion) return;

  const query = readQuestionFromQuery();
  if (!query) return;

  textQuestion.value = query;
}

function getCommonItemCategories(items) {
  return ["All", ...new Set(items.map((item) => item.category).filter(Boolean))];
}

function getFilteredCommonItems() {
  return commonItemsState.items.filter((item) => {
    const matchesCategory =
      commonItemsState.activeCategory === "All" || item.category === commonItemsState.activeCategory;

    if (!matchesCategory) {
      return false;
    }

    const query = commonItemsState.query.trim().toLowerCase();
    if (!query) {
      return true;
    }

    const searchableText = [
      item.name,
      item.category,
      item.summary,
      item.route,
      item.if_no_route,
      item.note,
      ...(Array.isArray(item.keywords) ? item.keywords : []),
      ...(Array.isArray(item.preparation_steps) ? item.preparation_steps : []),
      ...(Array.isArray(item.drop_off_options) ? item.drop_off_options : []),
      ...(Array.isArray(item.not_accepted) ? item.not_accepted : [])
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(query);
  });
}

function renderCommonItemsFilters() {
  if (!commonItemsFilters) return;

  const categories = getCommonItemCategories(commonItemsState.items);

  commonItemsFilters.innerHTML = categories
    .map(
      (category) => `
        <button
          class="filter-chip-btn ${category === commonItemsState.activeCategory ? "is-active" : ""}"
          type="button"
          data-category="${escapeHtml(category)}"
        >
          ${escapeHtml(category)}
        </button>
      `
    )
    .join("");

  commonItemsFilters.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      commonItemsState.activeCategory = button.getAttribute("data-category") || "All";
      renderCommonItemsFilters();
      renderCommonItemsGrid();
    });
  });
}

function renderCommonItemsGrid() {
  if (!commonItemsGrid || !commonItemsCount) return;

  const filteredItems = getFilteredCommonItems();
  const totalItems = commonItemsState.items.length;
  commonItemsCount.textContent = `${filteredItems.length} of ${totalItems} items`;

  if (filteredItems.length === 0) {
    commonItemsGrid.innerHTML = `
      <div class="empty-state compact-empty">
        <span>No common items matched</span>
        <small>Try a different keyword or switch to another route filter</small>
      </div>
    `;
    return;
  }

  commonItemsGrid.innerHTML = filteredItems
    .map((item) => {
      const detailUrl = `/common-item.html?id=${encodeURIComponent(item.id)}`;
      const askQuery = encodeURIComponent(
        item.askPrompt || `How should I dispose of ${item.name} in Hong Kong?`
      );
      return `
        <article class="library-card">
          <div class="library-card-head">
            <div>
              <h3 class="library-card-title">${escapeHtml(item.name)}</h3>
            </div>
            <span class="badge ${categoryClass(item.category)}">${escapeHtml(item.category)}</span>
          </div>
          <div class="library-card-meta">
            <span class="route-chip">${escapeHtml(item.route)}</span>
          </div>
          <p class="library-card-summary">${escapeHtml(item.summary)}</p>
          ${formatList(item.preparation_steps?.slice(0, 2), "library-steps")}
          <p class="library-card-note">${escapeHtml(item.note)}</p>
          <div class="library-card-actions">
            <a class="secondary-link-btn compact-link" href="${detailUrl}">View Details</a>
            <a class="library-link-btn" href="/text.html?q=${askQuery}">Ask AI About This Item</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderCommonItemDetail(item) {
  if (!commonItemDetail) return;

  if (!item) {
    commonItemDetail.innerHTML = `
      <div class="empty-state compact-empty">
        <span>Item not found</span>
        <small>Go back to the common items guide and choose another entry.</small>
      </div>
    `;
    return;
  }

  document.title = `${item.name} | Recycle Compass`;
  const askQuery = encodeURIComponent(
    item.askPrompt || `How should I dispose of ${item.name} in Hong Kong?`
  );

  commonItemDetail.innerHTML = `
    <div class="item-detail-shell">
      <div class="item-detail-hero">
        <div>
          <p class="panel-kicker">Common Item Detail</p>
          <h2>${escapeHtml(item.name)}</h2>
          <p class="item-detail-summary">${escapeHtml(item.summary)}</p>
        </div>
        <div class="item-detail-meta">
          <span class="badge ${categoryClass(item.category)}">${escapeHtml(item.category)}</span>
          <span class="route-chip">${escapeHtml(item.route)}</span>
        </div>
      </div>

      <div class="detail-grid">
        <article class="detail-card">
          <h3>Prepare It This Way</h3>
          ${formatList(item.preparation_steps, "guide-list")}
        </article>
        <article class="detail-card">
          <h3>Where To Take It</h3>
          ${formatList(item.drop_off_options, "guide-list")}
        </article>
        <article class="detail-card">
          <h3>Keep It Out Of</h3>
          ${formatList(item.not_accepted, "guide-list")}
        </article>
        <article class="detail-card">
          <h3>If No Route Is Available</h3>
          <p>${escapeHtml(item.if_no_route || "Follow the local ordinary refuse arrangement.")}</p>
        </article>
      </div>

      <div class="note-box">${escapeHtml(item.note)}</div>

      <div class="item-detail-links">
        <a class="secondary-link-btn compact-link" href="https://www.wastereduction.gov.hk/en-hk/green-community" target="_blank" rel="noreferrer">GREEN@COMMUNITY</a>
        <a class="secondary-link-btn compact-link" href="https://www.gov.hk/en/residents/environment/waste/reduction/wasteredrecyc.htm" target="_blank" rel="noreferrer">GovHK Recycling Info</a>
        <a class="library-link-btn" href="/text.html?q=${askQuery}">Ask AI About This Item</a>
      </div>
    </div>
  `;
}

async function loadCommonItems() {
  if (commonItemsState.items.length > 0) {
    return commonItemsState.items;
  }

  const response = await fetch("/common-items.json");
  if (!response.ok) {
    throw new Error("Failed to load the common items guide.");
  }

  const items = await response.json();
  commonItemsState.items = Array.isArray(items) ? items : [];
  return commonItemsState.items;
}

async function initializeCommonItemsLibrary() {
  if (!hasCommonItemsUI) return;

  try {
    await loadCommonItems();
    commonItemsState.activeCategory = "All";
    commonItemsState.query = "";
    renderCommonItemsFilters();
    renderCommonItemsGrid();

    commonItemsSearch.addEventListener("input", (event) => {
      commonItemsState.query = event.target.value || "";
      renderCommonItemsGrid();
    });
  } catch (error) {
    commonItemsCount.textContent = "Guide unavailable";
    commonItemsGrid.innerHTML = `
      <div class="empty-state compact-empty">
        <span>Common items could not be loaded</span>
        <small>${escapeHtml(error.message || "Please refresh the page and try again.")}</small>
      </div>
    `;
  }
}

async function initializeCommonItemDetailPage() {
  if (!hasCommonItemDetailUI) return;

  try {
    const items = await loadCommonItems();
    const itemId = readItemIdFromQuery();
    const item = items.find((candidate) => candidate.id === itemId);
    renderCommonItemDetail(item);
  } catch (error) {
    commonItemDetail.innerHTML = `
      <div class="empty-state compact-empty">
        <span>Detail page unavailable</span>
        <small>${escapeHtml(error.message || "Please refresh the page and try again.")}</small>
      </div>
    `;
  }
}

function renderDetailSections(preparationSteps, dropOffOptions, warnings) {
  return `
    <div class="detail-grid compact-detail-grid">
      <article class="detail-card">
        <h3>Prepare It</h3>
        ${formatList(preparationSteps, "guide-list")}
      </article>
      <article class="detail-card">
        <h3>Where It Usually Goes</h3>
        ${formatList(dropOffOptions, "guide-list")}
      </article>
      <article class="detail-card detail-card-wide">
        <h3>Watch-outs</h3>
        ${warnings.length > 0 ? formatList(warnings, "guide-list") : '<p>No major exceptions were returned.</p>'}
      </article>
    </div>
  `;
}

function renderTextChipList(items, emptyText = "No useful printed text was detected.") {
  if (!Array.isArray(items) || items.length === 0) {
    return `<p class="ocr-empty">${escapeHtml(emptyText)}</p>`;
  }

  return `
    <div class="ocr-chip-list">
      ${items.map((item) => `<span class="ocr-chip">${escapeHtml(item)}</span>`).join("")}
    </div>
  `;
}

function buildFeedbackCategoryOptions(selectedCategory) {
  return FEEDBACK_CATEGORY_OPTIONS.map(
    (category) => `
      <option value="${escapeHtml(category)}" ${category === selectedCategory ? "selected" : ""}>
        ${escapeHtml(category)}
      </option>
    `
  ).join("");
}

function renderFeedbackShell({ source, index, itemName, predictedCategory, predictedRoute }) {
  return `
    <div class="feedback-shell" data-feedback-source="${escapeHtml(source)}" data-feedback-index="${escapeHtml(index)}">
      <button class="secondary-btn feedback-toggle-btn" type="button">This looks wrong</button>
      <div class="feedback-panel hidden">
        <p class="feedback-copy">
          Tell us what should be corrected for ${escapeHtml(itemName || "this result")}.
        </p>
        <form class="feedback-form">
          <div class="feedback-grid">
            <label class="feedback-field">
              <span>Correct category</span>
              <select class="feedback-input feedback-category">
                ${buildFeedbackCategoryOptions(predictedCategory || "General Waste")}
              </select>
            </label>
            <label class="feedback-field">
              <span>Correct route</span>
              <input class="feedback-input feedback-route" type="text" value="${escapeHtml(predictedRoute || "")}" placeholder="Paper collection, General waste, Rechargeable battery collection..." />
            </label>
          </div>
          <label class="feedback-field">
            <span>What should change?</span>
            <textarea class="feedback-input feedback-note" rows="3" placeholder="Add any detail that would help review this answer, such as contamination, mixed materials, or the correct Hong Kong route."></textarea>
          </label>
          <div class="feedback-actions">
            <button class="primary-btn feedback-submit-btn" type="submit">Send Feedback</button>
            <button class="secondary-btn feedback-cancel-btn" type="button">Cancel</button>
          </div>
        </form>
        <div class="feedback-status-line" aria-live="polite"></div>
      </div>
    </div>
  `;
}

function setFeedbackStatus(shell, message, tone = "default") {
  const statusLine = shell.querySelector(".feedback-status-line");
  if (!statusLine) return;

  statusLine.textContent = message;
  statusLine.classList.remove("is-success", "is-error");

  if (tone === "success") {
    statusLine.classList.add("is-success");
  }

  if (tone === "error") {
    statusLine.classList.add("is-error");
  }
}

function getFeedbackContext(source, index) {
  if (source === "image") {
    const item = state.lastImageResult?.items?.[index] || {};
    return {
      source,
      itemName: item.name || "",
      predictedCategory: item.category || "General Waste",
      predictedRoute: item.route || "",
      confidence: item.confidence || "",
      summary: state.lastImageResult?.summary || "",
      note: state.lastImageResult?.note || ""
    };
  }

  return {
    source: "text",
    itemName: state.lastTextResult?.reply_title || "Text guidance result",
    predictedCategory: state.lastTextResult?.category || "General Waste",
    predictedRoute: state.lastTextResult?.route || "",
    confidence: "",
    question: state.lastTextQuestion || "",
    note: state.lastTextResult?.note || ""
  };
}

async function submitFeedbackForm(form) {
  const shell = form.closest(".feedback-shell");
  if (!shell) return;

  const source = shell.dataset.feedbackSource || "text";
  const index = Number(shell.dataset.feedbackIndex || "0");
  const context = getFeedbackContext(source, index);
  const correctedCategory = form.querySelector(".feedback-category")?.value?.trim() || "";
  const correctedRoute = form.querySelector(".feedback-route")?.value?.trim() || "";
  const note = form.querySelector(".feedback-note")?.value?.trim() || "";

  if (
    correctedCategory === context.predictedCategory &&
    correctedRoute === context.predictedRoute &&
    !note
  ) {
    setFeedbackStatus(
      shell,
      "Please change the category or route, or add a short note so we know what to review.",
      "error"
    );
    return;
  }

  const submitButton = form.querySelector(".feedback-submit-btn");
  const cancelButton = form.querySelector(".feedback-cancel-btn");
  if (submitButton) submitButton.disabled = true;
  if (cancelButton) cancelButton.disabled = true;
  setFeedbackStatus(shell, "Sending feedback...");

  try {
    const data = await postJson("/api/feedback", {
      source: context.source,
      itemName: context.itemName,
      question: context.question || "",
      predictedCategory: context.predictedCategory,
      predictedRoute: context.predictedRoute,
      correctedCategory,
      correctedRoute,
      confidence: context.confidence || "",
      summary: context.summary || "",
      note
    });

    setFeedbackStatus(
      shell,
      data.message || "Feedback saved. Thank you for helping us review this result.",
      "success"
    );
    const toggleButton = shell.querySelector(".feedback-toggle-btn");
    if (toggleButton) {
      toggleButton.textContent = "Feedback Saved";
      toggleButton.disabled = true;
    }
  } catch (error) {
    setFeedbackStatus(shell, error.message || "Feedback could not be saved.", "error");
    if (submitButton) submitButton.disabled = false;
    if (cancelButton) cancelButton.disabled = false;
  }
}

function attachFeedbackHandlers(container) {
  container.querySelectorAll(".feedback-shell").forEach((shell) => {
    const toggleButton = shell.querySelector(".feedback-toggle-btn");
    const panel = shell.querySelector(".feedback-panel");
    const form = shell.querySelector(".feedback-form");
    const cancelButton = shell.querySelector(".feedback-cancel-btn");

    if (toggleButton && panel) {
      toggleButton.addEventListener("click", () => {
        panel.classList.toggle("hidden");
        setFeedbackStatus(shell, "");
      });
    }

    if (cancelButton && panel) {
      cancelButton.addEventListener("click", () => {
        panel.classList.add("hidden");
        setFeedbackStatus(shell, "");
      });
    }

    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        await submitFeedbackForm(form);
      });
    }
  });
}

function renderImageResults(data) {
  if (!imageResult) return;
  state.lastImageResult = data;
  const items = Array.isArray(data.items) ? data.items : [];
  const visibleText = Array.isArray(data.visible_text) ? data.visible_text : [];
  const detectedCount =
    Number.isFinite(data.detected_item_count) && data.detected_item_count > 0
      ? data.detected_item_count
      : items.length;

  if (items.length === 0) {
    imageResult.innerHTML = `
      <div class="empty-state">
        <span>This image is still too unclear</span>
        <small>${escapeHtml(data.note || "Please try again with a sharper image and a clearer angle.")}</small>
      </div>
    `;
    return;
  }

  imageResult.innerHTML = `
    <div class="result-stack">
      <div class="result-overview">
        <span class="result-overview-count">${escapeHtml(String(detectedCount))}</span>
        <div>
          <strong>Separate item recognition is on</strong>
          <p>${escapeHtml(
            detectedCount > 1
              ? `The system split this photo into ${detectedCount} items or components so each one can get its own route.`
              : "The system found one main item in this photo."
          )}</p>
        </div>
      </div>
      <article class="detail-card ocr-overview-card">
        <h3>Visible Packaging Text</h3>
        <p class="ocr-copy">Useful printed words, labels, or material clues that AI could read from the image.</p>
        ${renderTextChipList(visibleText)}
      </article>
      ${items
        .map((item, index) => {
          const preparationSteps = getPreparationSteps(item);
          const dropOffOptions = getDropOffOptions(item);
          const warnings = getWarnings(item);
          const packagingText = Array.isArray(item.packaging_text) ? item.packaging_text : [];

          return `
            <article class="result-item">
              <div class="item-head">
                <div>
                  <h3>${escapeHtml(item.name || "Unnamed Item")}</h3>
                  <p>${escapeHtml(item.reason || "AI identified the item, but no detailed reason was returned.")}</p>
                </div>
                <div class="item-head-meta">
                  <span class="component-chip">${escapeHtml(item.component_role || "Separate item")}</span>
                  <span class="badge ${categoryClass(item.category)}">${escapeHtml(item.category || "General Waste")}</span>
                  <span class="route-chip">${escapeHtml(item.route || "Route unavailable")}</span>
                  <div class="confidence">Confidence: ${escapeHtml(item.confidence || "Not provided")}</div>
                </div>
              </div>
              <div class="detail-card detail-card-wide ocr-item-card">
                <h3>Text Read From This Item</h3>
                ${renderTextChipList(packagingText)}
              </div>
              ${renderDetailSections(preparationSteps, dropOffOptions, warnings)}
              ${renderFeedbackShell({
                source: "image",
                index,
                itemName: item.name || "this item",
                predictedCategory: item.category || "General Waste",
                predictedRoute: item.route || ""
              })}
            </article>
          `;
        })
        .join("")}
      <div class="summary-box">${escapeHtml(data.summary || "Analysis complete. Follow the route and preparation notes above.")}</div>
      <div class="note-box">${escapeHtml(data.note || "If your estate or building runs a different collection arrangement, follow that local instruction first.")}</div>
    </div>
  `;

  attachFeedbackHandlers(imageResult);
}

function renderTextResults(data) {
  if (!textResult) return;
  state.lastTextResult = data;

  const preparationSteps = getPreparationSteps(data);
  const dropOffOptions = getDropOffOptions(data);
  const warnings = getWarnings(data);
  const showReadAloud = Boolean(window.speechSynthesis);

  textResult.innerHTML = `
    <div class="qa-stack">
      <article class="qa-answer">
        <div class="answer-head">
          <div>
            <h3>${escapeHtml(data.reply_title || "Route Recommendation")}</h3>
            <p>${escapeHtml(data.reason || "AI returned a route recommendation.")}</p>
          </div>
          <div class="item-head-meta">
            <span class="badge ${categoryClass(data.category)}">${escapeHtml(data.category || "General Waste")}</span>
            <span class="route-chip">${escapeHtml(data.route || "Route unavailable")}</span>
          </div>
        </div>
        ${renderDetailSections(preparationSteps, dropOffOptions, warnings)}
        ${showReadAloud ? '<div class="answer-tools"><button class="secondary-btn" id="read-answer-btn" type="button" data-state="idle">Read Answer Aloud</button></div>' : ""}
        ${renderFeedbackShell({
          source: "text",
          index: 0,
          itemName: data.reply_title || "this answer",
          predictedCategory: data.category || "General Waste",
          predictedRoute: data.route || ""
        })}
      </article>
      <div class="note-box">${escapeHtml(data.note || "If your building or estate follows a more specific arrangement, follow that local instruction first.")}</div>
    </div>
  `;

  attachReadAloudButton(data);
  attachFeedbackHandlers(textResult);
}

function setSelectedImage(dataUrl, fileName) {
  if (!imagePreview || !imagePreviewFrame || !emptyPreview || !analyzeImageBtn) return;
  state.imageDataUrl = dataUrl;
  imagePreview.src = dataUrl;
  imagePreview.alt = fileName ? `${fileName} preview` : "Camera capture preview";
  imagePreviewFrame.classList.add("has-image");
  emptyPreview.classList.add("hidden");
  analyzeImageBtn.disabled = false;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read the image. Please try again."));
    reader.readAsDataURL(file);
  });
}

async function handleFileSelection(file) {
  if (!file) return;
  const dataUrl = await fileToDataUrl(file);
  setSelectedImage(dataUrl, file.name);
}

function stopCamera() {
  if (!cameraVideo || !cameraModal) return;
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }

  cameraVideo.srcObject = null;
  cameraModal.classList.add("hidden");
  cameraModal.setAttribute("aria-hidden", "true");
}

async function openCamera() {
  if (!cameraFallbackInput) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraFallbackInput.click();
    return;
  }

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" }
      },
      audio: false
    });

    cameraVideo.srcObject = state.stream;
    cameraModal.classList.remove("hidden");
    cameraModal.setAttribute("aria-hidden", "false");
  } catch (error) {
    cameraFallbackInput.click();
  }
}

function captureCurrentFrame() {
  if (!cameraVideo) return;
  if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = cameraVideo.videoWidth;
  canvas.height = cameraVideo.videoHeight;
  const context = canvas.getContext("2d");
  context.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  setSelectedImage(dataUrl, "camera-capture.jpg");
  stopCamera();
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  let data = {};

  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed. Please try again shortly.");
  }

  return data;
}

async function analyzeImage() {
  if (!analyzeImageBtn || !imageResult) return;
  if (!state.imageDataUrl) return;

  analyzeImageBtn.disabled = true;
  renderLoading(imageResult, "AI is analysing the waste image...");

  try {
    const data = await postJson("/api/classify-image", {
      imageDataUrl: state.imageDataUrl
    });
    renderImageResults(data);
    await saveImageHistory(data);
  } catch (error) {
    imageResult.innerHTML = `
      <div class="empty-state">
        <span>Recognition failed</span>
        <small>${escapeHtml(error.message)}</small>
      </div>
    `;
  } finally {
    analyzeImageBtn.disabled = false;
  }
}

async function askTextQuestion(options = {}) {
  if (!textQuestion || !askTextBtn || !textResult) return false;
  const question = textQuestion.value.trim();

  if (!question) {
    textQuestion.focus();
    return false;
  }

  askTextBtn.disabled = true;
  renderLoading(textResult, "AI is preparing the Hong Kong disposal guidance...");
  stopSpeakingAnswer();
  state.lastTextQuestion = question;

  try {
    const data = await postJson("/api/ask-category", { question });
    renderTextResults(data);
    saveTextHistory(question, data);

    if (options.source === "voice") {
      setVoiceStatus("Voice question submitted successfully. AI guidance is ready below.", "success");
      setVoiceIndicator("Ready", "ready");
    }

    return true;
  } catch (error) {
    textResult.innerHTML = `
      <div class="empty-state">
        <span>Request failed</span>
        <small>${escapeHtml(error.message)}</small>
      </div>
    `;

    if (options.source === "voice") {
      setVoiceStatus("Voice capture worked, but the AI request failed. Review the text and try again.", "error");
      setVoiceIndicator("Request failed", "error");
    }

    return false;
  } finally {
    askTextBtn.disabled = false;
  }
}

async function checkStatus() {
  if (!hasStatusUI) return;
  try {
    const response = await fetch("/api/status");
    const data = await response.json();

    if (data.ready) {
      statusDot.classList.add("ready");
      statusLabel.textContent = "Gemini service is connected";
      statusCopy.textContent = "Photo recognition and text guidance are both ready to use.";
      modelName.textContent = `Model: ${data.model}`;
      return;
    }

    statusLabel.textContent = "GEMINI_API_KEY is missing";
    statusCopy.textContent =
      "Configure GEMINI_API_KEY before starting the service so the page can connect to Gemini.";
    modelName.textContent = `Model: ${data.model || "Not configured"}`;
  } catch (error) {
    statusLabel.textContent = "Backend is not running";
    statusCopy.textContent = "Start the Node service first, then refresh this page.";
    modelName.textContent = "Model: unavailable";
  }
}

function initializeVisionHistory() {
  renderImageHistory();

  if (clearImageHistoryBtn) {
    clearImageHistoryBtn.addEventListener("click", () => {
      clearHistory(STORAGE_KEYS.image);
      renderImageHistory();
    });
  }
}

function initializeTextHistory() {
  renderTextHistory();

  if (clearTextHistoryBtn) {
    clearTextHistoryBtn.addEventListener("click", () => {
      clearHistory(STORAGE_KEYS.text);
      renderTextHistory();
    });
  }
}

if (hasVisionUI) {
  initializeVisionHistory();
  uploadImageBtn.addEventListener("click", () => imageUploadInput.click());
  openCameraBtn.addEventListener("click", openCamera);
  closeCameraBtn.addEventListener("click", stopCamera);
  captureBtn.addEventListener("click", captureCurrentFrame);
  fallbackCameraBtn.addEventListener("click", () => {
    stopCamera();
    cameraFallbackInput.click();
  });
  analyzeImageBtn.addEventListener("click", analyzeImage);
  imageUploadInput.addEventListener("change", async (event) => {
    await handleFileSelection(event.target.files?.[0]);
    event.target.value = "";
  });
  cameraFallbackInput.addEventListener("change", async (event) => {
    await handleFileSelection(event.target.files?.[0]);
    event.target.value = "";
  });
  cameraModal.addEventListener("click", (event) => {
    if (event.target === cameraModal) {
      stopCamera();
    }
  });
  window.addEventListener("beforeunload", stopCamera);
}

if (hasTextUI) {
  prefillTextQuestionFromQuery();
  initializeVoiceInput();
  initializeTextHistory();
  askTextBtn.addEventListener("click", () => {
    askTextQuestion();
  });
  textQuestion.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      askTextQuestion();
    }
  });
  window.addEventListener("beforeunload", () => {
    stopVoiceRecognition(true);
    stopSpeakingAnswer();
  });
}

if (hasCommonItemsUI) {
  initializeCommonItemsLibrary();
}

if (hasCommonItemDetailUI) {
  initializeCommonItemDetailPage();
}

if (hasReminderOverviewUI) {
  initializeReminderOverview();
}

if (hasRemindersPageUI) {
  initializeRemindersPage();
}

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEYS.reminders) {
    renderReminderOverview();
    renderRemindersList();
  }
});

startReminderWatcher();
checkStatus();
