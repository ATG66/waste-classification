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
  if (category === "可回收物") return "recyclable";
  if (category === "有害垃圾") return "hazardous";
  if (category === "厨余垃圾") return "food";
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
  const items = Array.isArray(data.items) ? data.items : [];

  if (items.length === 0) {
    imageResult.innerHTML = `
      <div class="empty-state">
        <span>这张图还不够清晰</span>
        <small>${escapeHtml(data.note || "请换一张更清晰、角度更明确的照片再试一次。")}</small>
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
                  <h3>${escapeHtml(item.name || "未命名物品")}</h3>
                  <p>${escapeHtml(item.reason || "AI 已识别，但没有返回详细原因。")}</p>
                </div>
                <div>
                  <span class="badge ${categoryClass(item.category)}">${escapeHtml(item.category || "待判断")}</span>
                  <div class="confidence">置信度：${escapeHtml(item.confidence || "未说明")}</div>
                </div>
              </div>
              ${formatList(item.how_to_recycle, "guide-list")}
            </article>
          `
        )
        .join("")}
      <div class="summary-box">${escapeHtml(data.summary || "已完成识别，请按上方建议进行分类投放。")}</div>
      <div class="note-box">${escapeHtml(data.note || "不同城市的精细化投放规则可能略有差异。")}</div>
    </div>
  `;
}

function renderTextResults(data) {
  textResult.innerHTML = `
    <div class="qa-stack">
      <article class="qa-answer">
        <div class="answer-head">
          <div>
            <h3>${escapeHtml(data.reply_title || "分类建议")}</h3>
            <p>${escapeHtml(data.reason || "AI 已返回分类建议。")}</p>
          </div>
          <span class="badge ${categoryClass(data.category)}">${escapeHtml(data.category || "待判断")}</span>
        </div>
        ${formatList(data.how_to_recycle, "guide-list")}
        ${formatList(data.tips, "tips-list")}
      </article>
      <div class="note-box">${escapeHtml(data.note || "如遇本地规则差异，请以当地投放标准为准。")}</div>
    </div>
  `;
}

function setSelectedImage(dataUrl, fileName) {
  state.imageDataUrl = dataUrl;
  imagePreview.src = dataUrl;
  imagePreview.alt = fileName ? `${fileName} 预览` : "相机拍摄预览";
  imagePreviewFrame.classList.add("has-image");
  emptyPreview.classList.add("hidden");
  analyzeImageBtn.disabled = false;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("读取图片失败，请重试。"));
    reader.readAsDataURL(file);
  });
}

async function handleFileSelection(file) {
  if (!file) return;
  const dataUrl = await fileToDataUrl(file);
  setSelectedImage(dataUrl, file.name);
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }

  cameraVideo.srcObject = null;
  cameraModal.classList.add("hidden");
  cameraModal.setAttribute("aria-hidden", "true");
}

async function openCamera() {
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
    throw new Error(data.error || "请求失败，请稍后重试。");
  }

  return data;
}

async function analyzeImage() {
  if (!state.imageDataUrl) return;

  analyzeImageBtn.disabled = true;
  renderLoading(imageResult, "AI 正在识别图片中的垃圾...");

  try {
    const data = await postJson("/api/classify-image", {
      imageDataUrl: state.imageDataUrl
    });
    renderImageResults(data);
  } catch (error) {
    imageResult.innerHTML = `
      <div class="empty-state">
        <span>识别失败</span>
        <small>${escapeHtml(error.message)}</small>
      </div>
    `;
  } finally {
    analyzeImageBtn.disabled = false;
  }
}

async function askTextQuestion() {
  const question = textQuestion.value.trim();

  if (!question) {
    textQuestion.focus();
    return;
  }

  askTextBtn.disabled = true;
  renderLoading(textResult, "AI 正在整理垃圾分类建议...");

  try {
    const data = await postJson("/api/ask-category", { question });
    renderTextResults(data);
  } catch (error) {
    textResult.innerHTML = `
      <div class="empty-state">
        <span>咨询失败</span>
        <small>${escapeHtml(error.message)}</small>
      </div>
    `;
  } finally {
    askTextBtn.disabled = false;
  }
}

async function checkStatus() {
  try {
    const response = await fetch("/api/status");
    const data = await response.json();

    if (data.ready) {
      statusDot.classList.add("ready");
      statusLabel.textContent = "AI 服务已连接";
      statusCopy.textContent = "图片识别和文字咨询都可以直接使用。";
      modelName.textContent = `模型：${data.model}`;
      return;
    }

    statusLabel.textContent = "缺少 OPENAI_API_KEY";
    statusCopy.textContent = "请先在启动服务前配置 OPENAI_API_KEY，之后页面即可连接 AI。";
    modelName.textContent = `模型：${data.model || "未配置"}`;
  } catch (error) {
    statusLabel.textContent = "后端暂未启动";
    statusCopy.textContent = "请先运行本地 Node 服务，然后再打开这个页面。";
    modelName.textContent = "模型：不可用";
  }
}

uploadImageBtn.addEventListener("click", () => imageUploadInput.click());
openCameraBtn.addEventListener("click", openCamera);
closeCameraBtn.addEventListener("click", stopCamera);
captureBtn.addEventListener("click", captureCurrentFrame);
fallbackCameraBtn.addEventListener("click", () => {
  stopCamera();
  cameraFallbackInput.click();
});
analyzeImageBtn.addEventListener("click", analyzeImage);
askTextBtn.addEventListener("click", askTextQuestion);
textQuestion.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    askTextQuestion();
  }
});
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

checkStatus();
