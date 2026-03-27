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
    statusCopy.textContent = "Configure OPENAI_API_KEY before starting the service so the page can connect to AI.";
    modelName.textContent = `Model: ${data.model || "Not configured"}`;
  } catch (error) {
    statusLabel.textContent = "Backend is not running";
    statusCopy.textContent = "Start the Node service first, then refresh this page.";
    modelName.textContent = "Model: unavailable";
  }
}

if (hasVisionUI) {
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
  askTextBtn.addEventListener("click", askTextQuestion);
  textQuestion.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      askTextQuestion();
    }
  });
}

checkStatus();
