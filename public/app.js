const STORAGE_KEYS = {
  image: "recycle-compass:image-history",
  text: "recycle-compass:text-history"
};
const MAX_HISTORY_ITEMS = 8;

const state = {
  imageDataUrl: "",
  stream: null
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

const commonItemsState = {
  items: [],
  activeCategory: "All",
  query: ""
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
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
  if (category === "Recyclable Waste") return "recyclable";
  if (category === "Hazardous Waste") return "hazardous";
  if (category === "Food Waste") return "food";
  return "residual";
}

function libraryCategoryClass(category) {
  if (
    category === "Paper" ||
    category === "Plastics" ||
    category === "Metals" ||
    category === "Glass" ||
    category === "Beverage Cartons"
  ) {
    return "recyclable";
  }

  if (category === "Special Recycling") {
    return "hazardous";
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
      const firstCategory = entry.items?.[0]?.category || "Needs Review";
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
              <span class="history-chip">${escapeHtml(`${entry.items?.length || 0} detected item(s)`)}</span>
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
            <span class="badge ${categoryClass(entry.category)}">${escapeHtml(entry.category || "Needs Review")}</span>
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
            category: item?.category || "Needs Review"
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
      category: data.category || "Needs Review",
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

function prefillTextQuestionFromQuery() {
  if (!textQuestion) return;

  const query = new URLSearchParams(window.location.search).get("q");
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
      ...(Array.isArray(item.keywords) ? item.keywords : [])
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
        <small>Try a different keyword or switch to another category filter</small>
      </div>
    `;
    return;
  }

  commonItemsGrid.innerHTML = filteredItems
    .map((item) => {
      const askQuery = encodeURIComponent(`How should I dispose of ${item.name} in Hong Kong?`);
      return `
        <article class="library-card">
          <div class="library-card-head">
            <div>
              <h3 class="library-card-title">${escapeHtml(item.name)}</h3>
            </div>
            <span class="badge ${libraryCategoryClass(item.category)}">${escapeHtml(item.category)}</span>
          </div>
          <div class="library-card-meta">
            <span class="library-route-chip">${escapeHtml(item.route)}</span>
          </div>
          <p class="library-card-summary">${escapeHtml(item.summary)}</p>
          ${formatList(item.steps, "library-steps")}
          <p class="library-card-note">${escapeHtml(item.note)}</p>
          <div class="library-card-actions">
            <a class="library-link-btn" href="/text.html?q=${askQuery}">Ask AI About This Item</a>
          </div>
        </article>
      `;
    })
    .join("");
}

async function initializeCommonItemsLibrary() {
  if (!hasCommonItemsUI) return;

  try {
    const response = await fetch("/common-items.json");
    if (!response.ok) {
      throw new Error("Failed to load the common items guide.");
    }

    const items = await response.json();
    commonItemsState.items = Array.isArray(items) ? items : [];
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

function renderImageResults(data) {
  if (!imageResult) return;
  const items = Array.isArray(data.items) ? data.items : [];

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
      ${items
        .map(
          (item) => `
            <article class="result-item">
              <div class="item-head">
                <div>
                  <h3>${escapeHtml(item.name || "Unnamed Item")}</h3>
                  <p>${escapeHtml(item.reason || "AI identified the item, but no detailed reason was returned.")}</p>
                </div>
                <div>
                  <span class="badge ${categoryClass(item.category)}">${escapeHtml(item.category || "Needs Review")}</span>
                  <div class="confidence">Confidence: ${escapeHtml(item.confidence || "Not provided")}</div>
                </div>
              </div>
              ${formatList(item.how_to_recycle, "guide-list")}
            </article>
          `
        )
        .join("")}
      <div class="summary-box">${escapeHtml(data.summary || "Analysis complete. Follow the guidance above for disposal.")}</div>
      <div class="note-box">${escapeHtml(data.note || "Detailed waste rules may vary slightly by city.")}</div>
    </div>
  `;
}

function renderTextResults(data) {
  if (!textResult) return;
  textResult.innerHTML = `
    <div class="qa-stack">
      <article class="qa-answer">
        <div class="answer-head">
          <div>
            <h3>${escapeHtml(data.reply_title || "Category Recommendation")}</h3>
            <p>${escapeHtml(data.reason || "AI returned a classification recommendation.")}</p>
          </div>
          <span class="badge ${categoryClass(data.category)}">${escapeHtml(data.category || "Needs Review")}</span>
        </div>
        ${formatList(data.how_to_recycle, "guide-list")}
        ${formatList(data.tips, "tips-list")}
      </article>
      <div class="note-box">${escapeHtml(data.note || "If local rules differ, follow your city’s official disposal guidance.")}</div>
    </div>
  `;
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed. Please try again shortly.");
  }

  return data;
}

async function analyzeImage() {
  if (!analyzeImageBtn || !imageResult) return;
  if (!state.imageDataUrl) return;

  analyzeImageBtn.disabled = true;
  renderLoading(imageResult, "AI is analyzing the waste image...");

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

async function askTextQuestion() {
  if (!textQuestion || !askTextBtn || !textResult) return;
  const question = textQuestion.value.trim();

  if (!question) {
    textQuestion.focus();
    return;
  }

  askTextBtn.disabled = true;
  renderLoading(textResult, "AI is preparing the waste classification guidance...");

  try {
    const data = await postJson("/api/ask-category", { question });
    renderTextResults(data);
    saveTextHistory(question, data);
  } catch (error) {
    textResult.innerHTML = `
      <div class="empty-state">
        <span>Request failed</span>
        <small>${escapeHtml(error.message)}</small>
      </div>
    `;
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
      statusLabel.textContent = "AI service is connected";
      statusCopy.textContent = "Photo recognition and text guidance are both ready to use.";
      modelName.textContent = `Model: ${data.model}`;
      return;
    }

    statusLabel.textContent = "OPENAI_API_KEY is missing";
    statusCopy.textContent =
      "Configure OPENAI_API_KEY before starting the service so the page can connect to AI.";
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
  initializeTextHistory();
  askTextBtn.addEventListener("click", askTextQuestion);
  textQuestion.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      askTextQuestion();
    }
  });
}

if (hasCommonItemsUI) {
  initializeCommonItemsLibrary();
}

checkStatus();
