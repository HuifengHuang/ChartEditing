# Chart Editing Workbench

This project is a Vite + Vue frontend with a lightweight Python proxy backend for LLM intent parsing.

## Frontend

```bash
npm install
npm run dev
```

Optional env vars (`.env` at project root):

```bash
VITE_INTENT_PROXY_ENDPOINT=/api/intent-parse
VITE_EXTRACTION_PROXY_ENDPOINT=/api/extract-bindings
VITE_INTENT_TIMEOUT_MS=30000
```

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy .env.example .env
```

Edit `backend/.env`:

```bash
YIZHAN_API_KEY=your_api_key_here
YIZHAN_API_URL=https://api.shunyu.tech/v1/chat/completions
YIZHAN_MODEL=qwen-vl-plus
INTENT_API_HOST=127.0.0.1
INTENT_API_PORT=8000
```

Start backend:

```bash
python intent_api.py
```

## Run together

1. Start backend on `http://127.0.0.1:8000`
2. Start frontend with `npm run dev`
3. Enter intent text in PromptBar and click `Run` (LLM first, fallback to rule parser on failure)
