# AI Recycling Guide

This project is a lightweight public-facing recycling assistant website powered by the Gemini API.

## Features

- Image-based waste recognition
- Text-based recycling and disposal guidance
- Voice input on the text page
- Local history saved in the browser
- Common items guide for Hong Kong users

## Environment Variables

Create your environment variables based on `.env.example`:

```text
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
HOST=0.0.0.0
PORT=3000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=20
```

## Local Run

In PowerShell:

```powershell
$env:GEMINI_API_KEY="your_real_gemini_api_key"
npm start
```

Then open:

```text
http://localhost:3000
```

## Render Deployment

This repo includes `render.yaml` for deployment on Render.

In Render, make sure you set:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` if you want to override the default

After saving the environment variable, redeploy the service.

## Notes

- Do not put API keys in frontend files.
- Public camera and microphone features work best over HTTPS.
- AI usage and quota depend on your Gemini account and billing setup.
