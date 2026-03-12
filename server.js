const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 20);
const PUBLIC_DIR = path.join(__dirname, "public");
const rateLimitStore = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function setCommonHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "font-src 'self'",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'"
    ].join("; ")
  );
}

function sendJson(res, statusCode, payload) {
  setCommonHeaders(res);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, message) {
  setCommonHeaders(res);
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8"
  });
  res.end(message);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;

      if (raw.length > 12 * 1024 * 1024) {
        const error = new Error("Request body too large.");
        error.statusCode = 413;
        reject(error);
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        const parseError = new Error("Invalid JSON body.");
        parseError.statusCode = 400;
        reject(parseError);
      }
    });

    req.on("error", reject);
  });
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const texts = [];

  for (const output of payload?.output || []) {
    for (const content of output?.content || []) {
      if (content?.type === "output_text" && typeof content?.text === "string") {
        texts.push(content.text);
      }
    }
  }

  return texts.join("\n").trim();
}

function extractJson(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("Empty model response.");
  }

  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : rawText.trim();
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Model response did not contain JSON.");
  }

  return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  const realIp = req.headers["x-real-ip"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }

  return req.socket.remoteAddress || "unknown";
}

function cleanupRateLimit(now) {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

function checkRateLimit(req, res) {
  const now = Date.now();
  cleanupRateLimit(now);

  const ip = getClientIp(req);
  const key = `${ip}:${req.url}`;
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS
    });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(retryAfter));
    sendJson(res, 429, {
      error: "请求过于频繁，请稍后再试。"
    });
    return false;
  }

  entry.count += 1;
  return true;
}

async function callOpenAI(input) {
  if (!OPENAI_API_KEY) {
    const error = new Error("Missing OPENAI_API_KEY.");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input
    })
  });

  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message || "OpenAI request failed.";
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const rawText = extractResponseText(payload);
  return extractJson(rawText);
}

async function handleImageClassification(req, res) {
  const body = await readBody(req);
  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";

  if (!imageDataUrl.startsWith("data:image/")) {
    sendJson(res, 400, {
      error: "请上传或拍摄一张有效的图片。"
    });
    return;
  }

  const prompt = [
    "你是一个中文垃圾分类与回收指导助手。",
    "请识别图片中的主要垃圾物品，并按中国常见垃圾分类回答。",
    "分类只能使用：可回收物、有害垃圾、厨余垃圾、其他垃圾。",
    "如果图片中有多个物品，最多返回 3 个最主要的物品。",
    "如果无法可靠识别，要在 note 中明确说明不确定性。",
    "请严格返回 JSON，不要输出任何额外说明。",
    "JSON 结构如下：",
    "{",
    '  "items": [',
    "    {",
    '      "name": "物品名称",',
    '      "category": "分类名称",',
    '      "confidence": "高/中/低",',
    '      "reason": "为什么属于这个类别",',
    '      "how_to_recycle": ["步骤 1", "步骤 2"]',
    "    }",
    "  ],",
    '  "summary": "整体建议",',
    '  "note": "补充提醒，可提到不同城市规则可能略有差异"',
    "}"
  ].join("\n");

  const result = await callOpenAI([
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: prompt
        },
        {
          type: "input_image",
          image_url: imageDataUrl
        }
      ]
    }
  ]);

  sendJson(res, 200, result);
}

async function handleTextConsultation(req, res) {
  const body = await readBody(req);
  const question = typeof body.question === "string" ? body.question.trim() : "";

  if (!question) {
    sendJson(res, 400, {
      error: "请输入想咨询的垃圾名称或问题。"
    });
    return;
  }

  const prompt = [
    "你是一个中文垃圾分类与回收指导助手。",
    "用户会问某种垃圾属于什么类别，或者如何投放、回收、处理。",
    "请优先按中国常见垃圾分类回答。",
    "分类只能使用：可回收物、有害垃圾、厨余垃圾、其他垃圾。",
    "如果问题无法唯一确定，请在 note 中提醒用户补充材质、污染程度或所在城市。",
    "请严格返回 JSON，不要输出任何额外说明。",
    "JSON 结构如下：",
    "{",
    '  "reply_title": "一句简短标题",',
    '  "category": "分类名称或需进一步判断",',
    '  "reason": "分类原因",',
    '  "how_to_recycle": ["步骤 1", "步骤 2"],',
    '  "tips": ["补充提示 1", "补充提示 2"],',
    '  "note": "补充说明"',
    "}",
    "",
    `用户问题：${question}`
  ].join("\n");

  const result = await callOpenAI([
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: prompt
        }
      ]
    }
  ]);

  sendJson(res, 200, result);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendText(res, 404, "Not Found");
        return;
      }

      sendText(res, 500, "Internal Server Error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    setCommonHeaders(res);
    res.writeHead(200, {
      "Content-Type": contentType
    });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === "GET" && requestUrl.pathname === "/healthz") {
      sendJson(res, 200, {
        ok: true,
        ready: Boolean(OPENAI_API_KEY),
        model: OPENAI_MODEL,
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/status") {
      sendJson(res, 200, {
        ready: Boolean(OPENAI_API_KEY),
        model: OPENAI_MODEL
      });
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/classify-image") {
      if (!checkRateLimit(req, res)) {
        return;
      }

      await handleImageClassification(req, res);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/ask-category") {
      if (!checkRateLimit(req, res)) {
        return;
      }

      await handleTextConsultation(req, res);
      return;
    }

    if (req.method !== "GET") {
      sendText(res, 405, "Method Not Allowed");
      return;
    }

    let safePath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    safePath = path.normalize(safePath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(PUBLIC_DIR, safePath);

    if (!filePath.startsWith(PUBLIC_DIR)) {
      sendText(res, 403, "Forbidden");
      return;
    }

    serveFile(res, filePath);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    sendJson(res, statusCode, {
      error: error.message || "服务器出现异常，请稍后再试。"
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `AI recycling guide is running on http://${HOST}:${PORT} (model: ${OPENAI_MODEL})`
  );
});
