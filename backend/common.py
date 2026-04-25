import json
from typing import Any, Dict, Union


def parse_output_to_panel_json(output: Union[str, Dict[str, Any]]) -> Dict[str, Any]:
    """将模型输出解析为前端可直接消费的 panel JSON 结构。"""

    # 允许输入是 JSON 字符串或字典对象。
    if isinstance(output, str):
        output = json.loads(output)

    structure = output.get("structure", {})

    # 优先使用 target 作为面板标题；缺失时回退到 intent。
    panel_label = structure.get("target") or structure.get("intent") or output.get("intent", "")

    panel_json = {
        "label": panel_label,
        "sub-panel": [],
        "affected-panel": []
    }

    # recommendationRequired 为 true 时，生成顶层预设控件配置。
    if output.get("recommendationRequired") is True:
        presets = output.get("presets", [])

        panel_json["top-panel"] = {
            "title": panel_label,
            "options": ["origin"] + [preset.get("label", "") for preset in presets]
        }

    # 解析 attributes，写入 sub-panel。
    for attr in structure.get("attributes", []):
        panel_json["sub-panel"].append({
            "title": attr.get("name", ""),
            "path": attr.get("path", ""),
            "type": attr.get("type", ""),
            "value": attr.get("value", "")
        })

    # 解析 affected，写入 affected-panel。
    for affected in structure.get("affected", []):
        panel_json["affected-panel"].append({
            "title": affected.get("name", ""),
            "path": affected.get("path", ""),
            "type": affected.get("type", ""),
            "value": affected.get("value", ""),
            "reason": affected.get("reason", "")
        })

    return panel_json
