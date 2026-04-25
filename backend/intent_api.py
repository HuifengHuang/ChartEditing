import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

import requests
from flask import Flask, jsonify, request
from common import parse_output_to_panel_json

try:
    from flask_cors import CORS
except ModuleNotFoundError:
    CORS = None

BASE_DIR = Path(__file__).resolve().parent
DOTENV_PATH = BASE_DIR / ".env"
MODEL_LOG_READABLE_PATH = BASE_DIR / "logs" / "model_calls_readable.log"

try:
    from dotenv import load_dotenv

    load_dotenv(DOTENV_PATH)
except Exception:
    pass


DEFAULT_API_URL = "https://api.shunyu.tech/v1/chat/completions"
FIXED_MODEL = "gpt-5.3-codex"


def now_iso_utc() -> str:
    """返回 UTC ISO 时间字符串，统一日志时间格式。"""
    return datetime.utcnow().isoformat(timespec="milliseconds") + "Z"


def append_model_log(entry: Dict[str, Any]) -> None:
    """将单条模型调用日志写入可读日志文件。"""
    append_model_log_readable(entry)


def _pretty_json(value: Any) -> str:
    """将对象格式化为便于阅读的 JSON 文本。"""
    try:
        return json.dumps(value, ensure_ascii=False, indent=2)
    except Exception:
        return str(value)


def _normalize_multiline_text(value: Any) -> str:
    """将文本中的转义换行符还原为真实换行，便于日志直观阅读。"""
    text = str(value or "")
    return (
        text.replace("\r\n", "\n")
        .replace("\r", "\n")
        .replace("\\r\\n", "\n")
        .replace("\\n", "\n")
        .replace("\\t", "\t")
    )


def append_model_log_readable(entry: Dict[str, Any]) -> None:
    """将日志以多行文本格式写入，便于人工查看 prompt/返回内容。"""
    try:
        MODEL_LOG_READABLE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with MODEL_LOG_READABLE_PATH.open("a", encoding="utf-8") as log_file:
            log_file.write("\n" + "=" * 90 + "\n")
            log_file.write(f"time: {entry.get('timestamp', '')}\n")
            log_file.write(f"event: {entry.get('event', '')}\n")
            log_file.write(f"request_id: {entry.get('request_id', '')}\n")
            if "model" in entry:
                log_file.write(f"model: {entry.get('model', '')}\n")
            if "status_code" in entry:
                log_file.write(f"status_code: {entry.get('status_code', '')}\n")
            if "duration_ms" in entry:
                log_file.write(f"duration_ms: {entry.get('duration_ms', '')}\n")

            content = entry.get("content")
            if isinstance(content, str):
                log_file.write("\n[content]\n")
                log_file.write(_normalize_multiline_text(content).rstrip() + "\n")

            if "error" in entry:
                log_file.write("\n[error]\n")
                log_file.write(str(entry.get("error", "")).rstrip() + "\n")

            if "panel_parse_input" in entry:
                log_file.write("\n[panel_parse_input]\n")
                panel_parse_input = entry.get("panel_parse_input")
                if isinstance(panel_parse_input, str):
                    log_file.write(_normalize_multiline_text(panel_parse_input).rstrip() + "\n")
                else:
                    log_file.write(_pretty_json(panel_parse_input) + "\n")

            if "panel_parse_output" in entry:
                log_file.write("\n[panel_parse_output]\n")
                panel_parse_output = entry.get("panel_parse_output")
                if isinstance(panel_parse_output, str):
                    log_file.write(_normalize_multiline_text(panel_parse_output).rstrip() + "\n")
                else:
                    log_file.write(_pretty_json(panel_parse_output) + "\n")

    except Exception:
        # 可读日志写入失败不影响主流程。
        pass


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
        started_at = time.time()
        request_id = f"intent_{uuid4().hex}"

        body = request.get_json(silent=True) or {}
        prompt = str(body.get("prompt", "")).strip()
        prompt_text = str(body.get("promptText", "")).strip() or prompt
        image_base64 = body.get("imageBase64")
        provider = str(body.get("provider", "intent_decompose")).strip() or "intent_decompose"
        request_event = f"{provider}_request"
        error_event = f"{provider}_error"
        response_event = f"{provider}_response"

        request_log: Dict[str, Any] = {
            "event": request_event,
            "request_id": request_id,
            "timestamp": now_iso_utc(),
            "has_image": bool(image_base64),
        }
        append_model_log(request_log)

        if not prompt_text:
            append_model_log(
                {
                    "event": error_event,
                    "request_id": request_id,
                    "timestamp": now_iso_utc(),
                    "error": "prompt is required",
                }
            )
            return jsonify({"error": "prompt is required", "request_id": request_id}), 400

        config = get_api_config()
        if not config["api_key"]:
            append_model_log(
                {
                    "event": error_event,
                    "request_id": request_id,
                    "timestamp": now_iso_utc(),
                    "model": config["model"],
                    "error": "YIZHAN_API_KEY is not set",
                }
            )
            return (
                jsonify(
                    {
                        "error": "YIZHAN_API_KEY is not set",
                        "hint": "Set env var YIZHAN_API_KEY or create backend/.env based on backend/.env.example",
                        "dotenv_path": str(DOTENV_PATH),
                        "request_id": request_id,
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
            append_model_log(
                {
                    "event": error_event,
                    "request_id": request_id,
                    "timestamp": now_iso_utc(),
                    "model": config["model"],
                    "error": f"Request to Yizhan API failed: {exc}",
                    "duration_ms": int((time.time() - started_at) * 1000),
                }
            )
            return jsonify({"error": f"Request to Yizhan API failed: {exc}", "request_id": request_id}), 502

        try:
            response_json = response.json()
        except ValueError:
            append_model_log(
                {
                    "event": error_event,
                    "request_id": request_id,
                    "timestamp": now_iso_utc(),
                    "model": config["model"],
                    "status_code": response.status_code,
                    "error": "Upstream response is not valid JSON",
                    "response_text": response.text,
                    "duration_ms": int((time.time() - started_at) * 1000),
                }
            )
            return jsonify({"error": "Upstream response is not valid JSON", "request_id": request_id}), 502

        if response.status_code >= 400:
            append_model_log(
                {
                    "event": error_event,
                    "request_id": request_id,
                    "timestamp": now_iso_utc(),
                    "model": config["model"],
                    "status_code": response.status_code,
                    "error": "Yizhan API returned error",
                    "upstream": response_json,
                    "duration_ms": int((time.time() - started_at) * 1000),
                }
            )
            return (
                jsonify(
                    {
                        "error": "Yizhan API returned error",
                        "status_code": response.status_code,
                        "upstream": response_json,
                        "request_id": request_id,
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

        recommendation_json: Optional[Dict[str, Any]] = None
        panel_json: Optional[Dict[str, Any]] = None
        if provider == "recommendation":
            try:
                recommendation_json = json.loads(raw_text)
            except Exception as exc:
                append_model_log(
                    {
                        "event": error_event,
                        "request_id": request_id,
                        "timestamp": now_iso_utc(),
                        "model": config["model"],
                        "error": f"Recommendation response is not valid JSON: {exc}",
                        "content": raw_text,
                        "duration_ms": int((time.time() - started_at) * 1000),
                    }
                )
                return (
                    jsonify(
                        {
                            "error": "Recommendation response is not valid JSON",
                            "request_id": request_id,
                        }
                    ),
                    502,
                )

            try:
                panel_json = parse_output_to_panel_json(recommendation_json)
            except Exception as exc:
                append_model_log(
                    {
                        "event": error_event,
                        "request_id": request_id,
                        "timestamp": now_iso_utc(),
                        "model": config["model"],
                        "error": f"Failed to parse recommendation output to panel JSON: {exc}",
                        "panel_parse_input": recommendation_json,
                        "duration_ms": int((time.time() - started_at) * 1000),
                    }
                )
                return (
                    jsonify(
                        {
                            "error": "Failed to parse recommendation output to panel JSON",
                            "request_id": request_id,
                        }
                    ),
                    502,
                )

            append_model_log(
                {
                    "event": f"{provider}_panel_transform",
                    "request_id": request_id,
                    "timestamp": now_iso_utc(),
                    "model": config["model"],
                    "panel_parse_input": recommendation_json,
                    "panel_parse_output": panel_json,
                    "duration_ms": int((time.time() - started_at) * 1000),
                }
            )

        append_model_log(
            {
                "event": response_event,
                "request_id": request_id,
                "timestamp": now_iso_utc(),
                "model": config["model"],
                "content": raw_text,
                "duration_ms": int((time.time() - started_at) * 1000),
            }
        )

        response_payload: Dict[str, Any] = {
            "ok": True,
            "raw_text": raw_text,
            "model": config["model"],
            "upstream": response_json,
            "request_id": request_id,
        }
        if recommendation_json is not None:
            response_payload["recommendation_json"] = recommendation_json
        if panel_json is not None:
            response_payload["panel_json"] = panel_json

        return jsonify(response_payload)

    return app


if __name__ == "__main__":
    flask_app = create_app()
    host = os.getenv("INTENT_API_HOST", "127.0.0.1")
    port = int(os.getenv("INTENT_API_PORT", "8000"))
    flask_app.run(host=host, port=port, debug=True)
