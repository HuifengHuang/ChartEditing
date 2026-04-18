# Current System Workflow

本文档描述当前 Chart Editing Workbench 的实际工作流（基于当前代码实现），用于开发和排查时快速对齐。

## 1. 总体架构

系统是一个前后端协同的意图驱动编辑器：

1. 前端 Vue 接收自然语言意图（Prompt）。
2. 前端优先调用 LLM 解析意图；失败时回退规则解析。
3. 将 `IntentSpec` 转换为 `UpdatePlan`。
4. 应用 `UpdatePlan` 更新：
   - 图表数据模型 `parts.source_data`
   - 右侧面板定义 `panelSpec`
5. 左侧代码与中间预览自动响应更新。

## 2. 前端主流程（App.vue）

入口文件：`src/App.vue`

1. 初始化状态：
   - `parts`：来自 `createSampleChartPartsMirroredMood()`
   - `panelSpec`：基于 `samplePanelSpecMirroredMood`，启动时清空 `sections`
2. 用户在 `PromptBar` 提交文本后，触发 `handlePromptSubmit(payload)`。
3. `resolveIntent(prompt)` 执行“LLM 优先 + 规则回退”：
   - 先调用 `parseIntentWithLLM(...)`
   - 若异常，则调用 `parseIntentByRule(prompt)`
4. 将解析结果转换为计划：
   - `intentToUpdatePlan(intent, parts, panelSpec)`
5. 应用计划：
   - `applyUpdatePlan(parts, panelSpec, updatePlan)`
6. 写回响应式状态：
   - `parts.value = nextState.parts`
   - `panelSpec.value = nextState.panelSpec`
7. 由 `computed` 自动驱动：
   - 左侧 `sourceDataCode`（source_data 文本）
   - 中间 `htmlContent`（iframe 预览）
   - 右侧 `ControlPanel`（动态控件）

## 3. Prompt 输入层

组件：`src/components/PromptBar.vue`

1. 输入框 + `Run` 按钮 + 示例语句按钮。
2. 提交事件统一发出：`emit("submit-prompt", value)`。
3. `busy` 时禁用输入与按钮，防止重复提交。

注意：当前前端已移除 `Model/Provider` 选择，不再显示相关控件。

## 4. LLM 解析链路

### 4.1 前端 LLM 模块

文件：`src/llm/intentParserLLM.js`

1. 构造提示词：`buildIntentPrompt({ prompt, context })`
2. 调用代理接口：`POST llmConfig.endpoint`（默认 `/api/intent-parse`）
3. 请求体包含：
   - `prompt`
   - `promptText`（完整提示词）
   - `context`
   - `imageBase64`（当前可为空）
   - `provider: "yizhan"`（固定）
4. 响应处理：
   - 读取 `raw_text`
   - `parseIntentResponse(raw_text)` 提取 JSON
   - `validateIntentSpec(...)` 校验并兜底

配置文件：`src/config/llmConfig.js`

- `endpoint`：`VITE_INTENT_PROXY_ENDPOINT`（默认 `/api/intent-parse`）
- `timeoutMs`：`VITE_INTENT_TIMEOUT_MS`（默认 `30000`）

### 4.2 后端代理

文件：`backend/intent_api.py`

1. 暴露接口：`POST /api/intent-parse`
2. 读取 `.env`：
   - `YIZHAN_API_KEY`
   - `YIZHAN_API_URL`
   - `YIZHAN_MODEL`
3. 将前端 `promptText` 转发到一站式 Chat Completions。
4. 从上游响应中提取 `choices[0].message.content`，整理为 `raw_text` 返回前端。
5. 错误处理：
   - 缺少 Key -> 500
   - 上游请求失败 -> 502
   - 上游非 JSON -> 502
   - 上游状态码错误 -> 502（带 upstream 信息）

## 5. 规则回退解析

文件：`src/utils/parseIntent.js`

当 LLM 失败时使用规则解析，识别关键词并生成 `IntentSpec`，覆盖任务：

1. `aspect_ratio`
2. `color_theme`
3. `add_element`
4. `remove_element`
5. `legend_edit`
6. `expand_controls`

默认返回可用的兜底意图，保证后续流程不中断。

## 6. Intent -> UpdatePlan

文件：`src/utils/intentToUpdatePlan.js`

输出结构：

1. `sourceDataUpdates`：更新图表数据（`set/add/remove/patch`）
2. `panelUpdates`：更新右侧控件面板（创建 section、高亮、展开、补齐控件等）

核心策略：

1. 先根据任务确保 primary section 存在（不存在就创建）。
2. 再按任务追加数据更新：
   - 比例任务：更新 width/height 等布局参数
   - 主题任务：批量 patch 颜色
   - 增删数据：操作 `source_data.data`
   - 图例任务：更新方向、字号等
3. 按需触发 detail section 展开（如 `layout_detail`、`theme_detail`、`legend_detail`）。

## 7. UpdatePlan 执行

文件：`src/utils/applyUpdatePlan.js`

1. 先 `safeClone(parts)`，优先 `structuredClone`，失败回退 `JSON` clone。
2. 按顺序执行 `sourceDataUpdates`：
   - `set` -> `setValueByPath`
   - `patch` -> 多路径 set
   - `add/remove` -> 集合操作工具
3. 调用 `updatePanelSpec(panelSpec, panelUpdates)` 生成新面板定义。
4. 返回 `{ parts, panelSpec }` 供 `App.vue` 回写状态。

## 8. 动态控件生成机制（右侧）

相关文件：

1. `src/specs/taskControlRegistry.js`
2. `src/utils/updatePanelSpec.js`
3. `src/components/ControlPanel.vue`
4. `src/components/ControlRenderer.vue`

机制说明：

1. `taskControlRegistry` 维护“任务 -> section/controls”映射。
2. `updatePanelSpec` 根据 `panelUpdates` 执行：
   - 创建/确保任务控件
   - section 高亮
   - section 展开
   - 插入受影响控件（affected bindings）
3. `ControlPanel` 根据 `panelSpec` 渲染可见 section。
4. `ControlRenderer` 根据控件类型渲染输入器（number/select/toggle/table 等），并将用户操作实时写回 `parts`。

结论：即使初始 `panelSpec.sections = []`，只要收到有效意图，也会通过 `create-section-with-controls / ensure-task-controls` 动态生成右侧控件。

## 9. 页面联动结果

1. 左侧 `CodePanel`：展示最新 `source_data` 和 `render_code`（只读）。
2. 中间 `ChartPreview`：通过 `iframe + srcdoc` 实时渲染。
3. 右侧 `ControlPanel`：显示与当前任务相关的最小必要控件，并可继续细调。

## 10. 简化时序图

```text
PromptBar.submit
  -> App.handlePromptSubmit
    -> resolveIntent
      -> parseIntentWithLLM
        -> backend /api/intent-parse
        -> Yizhan API
      -> (fallback) parseIntentByRule
    -> intentToUpdatePlan
    -> applyUpdatePlan
      -> updatePanelSpec
    -> parts/panelSpec reactive update
      -> CodePanel / ChartPreview / ControlPanel rerender
```

