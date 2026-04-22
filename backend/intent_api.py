import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from flask import Flask, jsonify, request
try:
    from flask_cors import CORS
except ModuleNotFoundError:
    CORS = None

try:
    from dotenv import load_dotenv

    BASE_DIR = Path(__file__).resolve().parent
    DOTENV_PATH = BASE_DIR / ".env"
    load_dotenv(DOTENV_PATH)
except Exception:
    DOTENV_PATH = Path(__file__).resolve().parent / ".env"

DEFAULT_API_URL = "https://api.shunyu.tech/v1/chat/completions"
DEFAULT_MODEL = "qwen-vl-plus"


def get_api_config() -> Dict[str, str]:
    return {
        "api_key": os.getenv("YIZHAN_API_KEY", "").strip(),
        "api_url": os.getenv("YIZHAN_API_URL", DEFAULT_API_URL).strip() or DEFAULT_API_URL,
        "model": os.getenv("YIZHAN_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL,
    }


def build_content_items(prompt_text: str, image_base64: Optional[str]) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = [{"type": "text", "text": prompt_text}]
    if image_base64:
        image_url = f"data:image/png;base64,{image_base64}"
        items.append({"type": "image_url", "image_url": {"url": image_url}})
    return items


def call_yizhan_chat_completions(
    *,
    api_key: str,
    api_url: str,
    model: str,
    prompt_text: str,
    image_base64: Optional[str],
) -> requests.Response:
    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": build_content_items(prompt_text, image_base64),
            }
        ],
        "stream": False,
    }

    return requests.post(
        api_url,
        headers=headers,
        data=json.dumps(payload),
        timeout=180,
    )


def extract_raw_text(response_json: Dict[str, Any]) -> str:
    raw_text = ""
    try:
        raw_content = response_json["choices"][0]["message"]["content"]
        if isinstance(raw_content, list):
            chunks: List[str] = []
            for item in raw_content:
                if isinstance(item, dict) and item.get("type") == "text":
                    chunks.append(str(item.get("text", "")))
                else:
                    chunks.append(str(item))
            raw_text = "\n".join(chunks).strip()
        else:
            raw_text = str(raw_content)
    except Exception:
        raw_text = ""
    return raw_text


def ensure_prompt_text(body: Dict[str, Any], fallback_key: str = "prompt") -> str:
    prompt = str(body.get(fallback_key, "")).strip()
    prompt_text = str(body.get("promptText", "")).strip()
    return prompt_text or prompt


def validate_api_key(config: Dict[str, str]):
    if config["api_key"]:
        return None
    return (
        jsonify(
            {
                "error": "YIZHAN_API_KEY is not set",
                "hint": "Set env var YIZHAN_API_KEY or create backend/.env based on backend/.env.example",
                "dotenv_path": str(DOTENV_PATH),
            }
        ),
        500,
    )


def call_model_or_error(*, prompt_text: str, image_base64: Optional[str]):
    config = get_api_config()
    config_error = validate_api_key(config)
    if config_error:
        return None, None, config_error

    try:
        response = call_yizhan_chat_completions(
            api_key=config["api_key"],
            api_url=config["api_url"],
            model=config["model"],
            prompt_text=prompt_text,
            image_base64=image_base64,
        )
    except requests.RequestException as exc:
        return None, None, (jsonify({"error": f"Request to Yizhan API failed: {exc}"}), 502)

    try:
        response_json = response.json()
    except ValueError:
        return None, None, (jsonify({"error": "Upstream response is not valid JSON"}), 502)

    if response.status_code >= 400:
        return (
            None,
            None,
            (
                jsonify(
                    {
                        "error": "Yizhan API returned error",
                        "status_code": response.status_code,
                        "upstream": response_json,
                    }
                ),
                502,
            ),
        )

    raw_text = extract_raw_text(response_json)
    return config, response_json, raw_text


def create_app() -> Flask:
    app = Flask(__name__)
    if CORS is not None:
        CORS(app, resources={r"/api/*": {"origins": "*"}})
    else:
        print("[Warning] flask_cors is not installed, CORS support is disabled.")

    @app.post("/api/intent-parse")
    def intent_parse():
        body = request.get_json(silent=True) or {}
        prompt_text = ensure_prompt_text(body, fallback_key="prompt")
        image_base64 = body.get("imageBase64")

        print("提示词：" + prompt_text)

        if not prompt_text:
            return jsonify({"error": "prompt is required"}), 400

        config, response_json, model_result = call_model_or_error(
            prompt_text=prompt_text,
            image_base64=image_base64,
        )
        if isinstance(model_result, tuple):
            return model_result

        raw_text = model_result
        print("模型结果：" + raw_text)
        return jsonify(
            {
                "ok": True,
                "raw_text": raw_text,
                "model": config["model"],
                "upstream": response_json,
            }
        )

    @app.post("/api/extract-bindings")
    def extract_bindings():
        body = request.get_json(silent=True) or {}
        prompt_text = ensure_prompt_text(body, fallback_key="prompt")
        print("\n[Extraction] Prompt Input:\n" + prompt_text + "\n")

        if not prompt_text:
            return jsonify({"error": "promptText is required"}), 400

        config, response_json, model_result = call_model_or_error(
            prompt_text=prompt_text,
            image_base64=None,
        )
        if isinstance(model_result, tuple):
            return model_result

        raw_text = model_result
        print("[Extraction] Model Output:\n" + raw_text + "\n")
        return jsonify(
            {
                "ok": True,
                "raw_text": raw_text,
                "model": config["model"],
                "upstream": response_json,
            }
        )

    return app


if __name__ == "__main__":
    flask_app = create_app()
    host = os.getenv("INTENT_API_HOST", "127.0.0.1")
    port = int(os.getenv("INTENT_API_PORT", "8000"))
    flask_app.run(host=host, port=port, debug=True)
