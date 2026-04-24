import json
from typing import Any, Dict, Union


def parse_output_to_panel_json(output: Union[str, Dict[str, Any]]) -> Dict[str, Any]:
    """
    将模型返回的 output json 解析为前端 panel 所需结构。

    参数:
        output: 可以是 dict，也可以是 json 字符串

    返回:
        panel_json: dict
    """

    # 如果输入是 json 字符串，先转成 dict
    if isinstance(output, str):
        output = json.loads(output)

    structure = output.get("structure", {})

    # 优先使用 target 作为面板标题；如果没有 target，则使用 intent
    panel_label = structure.get("target") or structure.get("intent") or output.get("intent", "")

    panel_json = {
        "label": panel_label,
        "sub-panel": [],
        "affected-panel": []
    }

    # recommendationRequired 为 true 时，生成顶级预设控件
    if output.get("recommendationRequired") is True:
        presets = output.get("presets", [])

        panel_json["top-panel"] = {
            "title": panel_label,
            "options": ["origin"] + [preset.get("label", "") for preset in presets]
        }

    # 解析 attributes，生成 sub-panel
    for attr in structure.get("attributes", []):
        panel_json["sub-panel"].append({
            "title": attr.get("name", ""),
            "path": attr.get("path", ""),
            "type": attr.get("type", ""),
            "value": attr.get("value", "")
        })

    # 解析 affected，生成 affected-panel
    for affected in structure.get("affected", []):
        panel_json["affected-panel"].append({
            "title": affected.get("name", ""),
            "path": affected.get("path", ""),
            "type": affected.get("type", ""),
            "value": affected.get("value", ""),
            "reason": affected.get("reason", "")
        })

    return panel_json