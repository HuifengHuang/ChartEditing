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
FIXED_MODEL = "gpt-5.3-codex"


def get_api_config() -> Dict[str, str]:
    """读取 API 配置：密钥、地址、模型名称。"""
    return {
        "api_key": os.getenv("YIZHAN_API_KEY", "").strip(),
        "api_url": os.getenv("YIZHAN_API_URL", DEFAULT_API_URL).strip() or DEFAULT_API_URL,
        "model": FIXED_MODEL,
    }


def build_content_items(prompt_text: str, image_base64: Optional[str]) -> List[Dict[str, Any]]:
    """构造多模态 content 列表；有图则附加 image_url。"""
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
    """调用上游 chat/completions 接口并返回原始 HTTP 响应。"""
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


def create_app() -> Flask:
    """创建 Flask 应用并注册 /api/intent-parse 接口。"""
    app = Flask(__name__)
    if CORS is not None:
        CORS(app, resources={r"/api/*": {"origins": "*"}})
    else:
        print("[Warning] flask_cors is not installed, CORS support is disabled.")

    @app.post("/api/intent-parse")
    def intent_parse():
        """接收前端 prompt + 图片，转发给大模型并返回 raw_text。"""
        body = request.get_json(silent=True) or {}
        prompt = str(body.get("prompt", "")).strip()
        prompt_text = str(body.get("promptText", "")).strip() or prompt
        image_base64 = body.get("imageBase64")

        if not prompt_text:
            return jsonify({"error": "prompt is required"}), 400

        config = get_api_config()
        if not config["api_key"]:
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

        try:
            response = call_yizhan_chat_completions(
                api_key=config["api_key"],
                api_url=config["api_url"],
                model=config["model"],
                prompt_text=prompt_text,
                image_base64=image_base64,
            )
        except requests.RequestException as exc:
            return jsonify({"error": f"Request to Yizhan API failed: {exc}"}), 502

        try:
            response_json = response.json()
        except ValueError:
            return jsonify({"error": "Upstream response is not valid JSON"}), 502

        if response.status_code >= 400:
            return (
                jsonify(
                    {
                        "error": "Yizhan API returned error",
                        "status_code": response.status_code,
                        "upstream": response_json,
                    }
                ),
                502,
            )

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
