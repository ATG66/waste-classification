const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 20);
const PUBLIC_DIR = path.join(__dirname, "public");
const rateLimitStore = new Map();
const CATEGORY_VALUES = [
  "Recyclable Waste",
  "Hazardous Waste",
  "Food Waste",
  "Residual Waste"
];

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
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
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
  const texts = [];

  for (const candidate of payload?.candidates || []) {
    for (const part of candidate?.content?.parts || []) {
      if (typeof part?.text === "string" && part.text.trim()) {
        texts.push(part.text);
      }
    }
  }

  if (texts.length === 0 && payload?.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the request: ${payload.promptFeedback.blockReason}.`);
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
      error: "Too many requests. Please try again shortly."
    });
    return false;
  }

  entry.count += 1;
  return true;
}

function parseDataUrlImage(dataUrl) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);

  if (!match) {
    const error = new Error("Please upload or capture a valid image.");
    error.statusCode = 400;
    throw error;
  }

  return {
    mimeType: match[1],
    data: match[2]
  };
}

function buildImageSchema() {
  return {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Short item name found in the image." },
            category: {
              type: "string",
              description: `One of: ${CATEGORY_VALUES.join(", ")}.`
            },
            confidence: {
              type: "string",
              description: "High, Medium, or Low confidence."
            },
            reason: { type: "string", description: "Why the item belongs to that category." },
            how_to_recycle: {
              type: "array",
              items: { type: "string" },
              description: "Practical disposal or recycling steps."
            }
          },
          required: ["name", "category", "confidence", "reason", "how_to_recycle"]
        }
      },
      summary: { type: "string", description: "Overall guidance for the image." },
      note: { type: "string", description: "Extra reminder or uncertainty note." }
    },
    required: ["items", "summary", "note"]
  };
}

function buildTextSchema() {
  return {
    type: "object",
    properties: {
      reply_title: { type: "string", description: "A short answer title." },
      category: {
        type: "string",
        description: `One of: ${CATEGORY_VALUES.join(", ")}.`
      },
      reason: { type: "string", description: "Why this category fits the item." },
      how_to_recycle: {
        type: "array",
        items: { type: "string" },
        description: "Practical disposal or recycling steps."
      },
      tips: {
        type: "array",
        items: { type: "string" },
        description: "Helpful extra tips."
      },
      note: { type: "string", description: "Additional explanation or uncertainty note." }
    },
    required: ["reply_title", "category", "reason", "how_to_recycle", "tips", "note"]
  };
}

async function callGemini(parts, responseSchema) {
  if (!GEMINI_API_KEY) {
    const error = new Error("Missing GEMINI_API_KEY.");
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: responseSchema
      }
    })
    }
  );

  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message || "Gemini request failed.";
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
      error: "Please upload or capture a valid image."
    });
    return;
  }

  const image = parseDataUrlImage(imageDataUrl);

  const prompt = [
    "You are an English waste classification and recycling guidance assistant.",
    "Identify the main waste item or items in the image and classify them using the common four-bin system used in China.",
    `The only allowed category values are: ${CATEGORY_VALUES.join(", ")}.`,
    "If the image contains multiple items, return at most 3 main items.",
    "If recognition is uncertain, clearly explain that uncertainty in note.",
    "Respond in English only.",
    "Return concise, helpful results that follow the provided JSON schema."
  ].join("\n");

  const result = await callGemini(
    [
      { text: prompt },
      {
        inlineData: {
          mimeType: image.mimeType,
          data: image.data
        }
      }
    ],
    buildImageSchema()
  );

  sendJson(res, 200, result);
}

async function handleTextConsultation(req, res) {
  const body = await readBody(req);
  const question = typeof body.question === "string" ? body.question.trim() : "";

  if (!question) {
    sendJson(res, 400, {
      error: "Please enter a waste item or disposal question."
    });
    return;
  }

  const prompt = [
    "You are an English waste classification and recycling guidance assistant.",
    "The user will ask which category an item belongs to, or how it should be disposed of or recycled.",
    "Classify items using the common four-bin system used in China.",
    `The only allowed category values are: ${CATEGORY_VALUES.join(", ")}.`,
    "If the question cannot be answered uniquely, use note to ask for material, contamination level, or city-specific context.",
    "Respond in English only.",
    "Return concise, helpful results that follow the provided JSON schema.",
    `User question: ${question}`
  ].join("\n");

  const result = await callGemini([{ text: prompt }], buildTextSchema());

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
        ready: Boolean(GEMINI_API_KEY),
        model: GEMINI_MODEL,
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/status") {
      sendJson(res, 200, {
        ready: Boolean(GEMINI_API_KEY),
        model: GEMINI_MODEL
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
      error: error.message || "The server encountered an error. Please try again later."
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `AI recycling guide is running on http://${HOST}:${PORT} (model: ${GEMINI_MODEL})`
  );
});
