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
    pass


DEFAULT_API_URL = "https://api.shunyu.tech/v1/chat/completions"
DEFAULT_MODEL = "qwen-vl-plus"


def get_api_config() -> Dict[str, str]:
    """读取一站 API 调用配置，并提供默认值回退。"""
    return {
        "api_key": os.getenv("YIZHAN_API_KEY", "").strip(),
        "api_url": os.getenv("YIZHAN_API_URL", DEFAULT_API_URL).strip() or DEFAULT_API_URL,
        "model": os.getenv("YIZHAN_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL,
    }


def build_content_items(prompt_text: str, image_base64: Optional[str]) -> List[Dict[str, Any]]:
    """构建 messages.content：文本必选，图片可选。"""
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
    """请求上游 chat/completions，返回原始 HTTP 响应对象。"""
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
    """创建 Flask 应用并挂载 `/api/intent-parse` 代理路由。"""
    app = Flask(__name__)
    if CORS is not None:
        CORS(app, resources={r"/api/*": {"origins": "*"}})
    else:
        print("[Warning] flask_cors is not installed, CORS support is disabled.")

    @app.post("/api/intent-parse")
    def intent_parse():
        """统一代理入口：接收前端 prompt/image，返回标准化 raw_text。"""
        body = request.get_json(silent=True) or {}
        prompt = str(body.get("prompt", "")).strip()
        prompt_text = str(body.get("promptText", "")).strip() or prompt
        print("大模型提示词\n" + prompt_text)
        image_base64 = body.get("imageBase64")

        if not prompt_text:
            return jsonify({"error": "prompt is required"}), 400

        config = get_api_config()
        # 配置缺失时直接返回可操作提示，避免继续请求上游。
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

        # 网络异常统一转为 502，便于前端识别“上游不可达”。
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

        # 上游必须返回 JSON，否则视为协议异常。
        try:
            response_json = response.json()
        except ValueError:
            return jsonify({"error": "Upstream response is not valid JSON"}), 502

        # 上游状态异常时透传核心错误信息。
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

        # 兼容 content 为字符串或多段数组两种形态。
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

        print("模型返回结果\n" + raw_text)
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
