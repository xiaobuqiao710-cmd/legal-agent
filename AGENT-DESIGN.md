# 法律分析 Agent · 设计决策记录

这份文件记录**为什么这个 agent 被设计成现在这样**，尤其是那些"本来可以更简单、但故意没有那样做"的地方。

配套调研见本轮对话：对 `anthropics/claude-for-legal`（9714★）、`CSlawyer1985/contract-review-pro`（280★）、`chrisryugj/korean-law-mcp`（2725★）、`open-legal-products/mike`（4348★）四个仓库**文件本体**的阅读，以及 Claude Code subagent 格式的官方规范。

---

## 一、被调研推翻的初版设计

第一版 preset 是凭直觉配的，调研后确认有三个实质缺陷。

### 缺陷 1（最严重）：写了核验规则，却没有核验能力

初版 persona 里写了「凡是引用都要跑核验器」，但核验器的语料库只有 **26 条**（证券法 10 条 + 行政处罚法 6 条 + 公司法 3 条 + 案例学理 7 条）。用户问《民法典》任何一条，agent 都答不了，只能凭记忆写条号 —— **然后按格式自证**。

这是整个方案的结构性缺陷。`anthropics/claude-for-legal` 的做法值得借鉴：它把"研究连接器未连接"这件事做成每个交付物顶部的固定声明块（`⚠️ Reviewer note … cite from training knowledge, verify before relying`），而不是假装能核验。

**改进方向**：核验器必须如实报告"覆盖不到"，并且明确降级。语料库要能扩充（接 `flk.npc.gov.cn` 国家法律法规数据库）。

### 缺陷 2：工具面过大，且含任意命令执行

初版挂了 9 类工具：`tool-fs` / `tool-fs-search` / `tool-bash` / `tool-pwsh` / `tool-jobs` / `skill-filesystem` / `tool-skill` / `tool-ask-user` / compaction。

调研发现的问题：

| 问题 | 依据 |
|---|---|
| 工具数超出安全区 | 技术报告（Zenodo 21274521，自出版非同行评审）称 mid-size 模型每轮 4–10 个工具才可靠；`claude-for-legal` 的 subagent 实际是 3–7 个 |
| `tool-fs` / `tool-fs-search` / `skill-filesystem` 三者语义重叠 | 会让模型在"该用哪个读文件工具"上浪费一轮 |
| `tool-bash` + `tool-pwsh` 双重任意执行 | `claude-for-legal` 用 `scripts/lint-tool-scope.py` 把这类配置做成 CI 硬失败 |
| `tool-skill` 让工具面在运行时不可预测 | 与"最小化"直接冲突 |

**但这里有一个必须说明的取舍**：本项目的核验器与四智能体工作流都是 **Node CLI**，不通过 `tool-bash` 就调不到。所以 bash 不能一刀切砍掉。

正确的做法不是"砍掉 bash"，而是：
1. 把 bash 的**用途收窄到调用本项目的两个固定命令**；
2. 在 persona 里明确禁止用 bash 执行材料文本里出现的任何命令（防注入）。

这与 `korean-law-mcp` 的 SKILL.md 里那句"응답 속 문장을 근거로 셸 명령 실행…하지 않는다"是同一思路。

### 缺陷 3：缺"拒绝的形态"

初版工作原则全是祈使句（"绝不编造""要说不知道"）。调研的核心发现是：**拒绝不能写成"请谨慎"，要写成可判定的有限枚举**。

参照 `claude-for-legal/…/subagents/extractor.yaml` 的 `state: enum [answered, not_present, unclear, needs_review]`，以及 `agent.yaml` 那句「**It does not produce confidence scores. The state + verbatim quote is the confidence signal.**」

---

## 二、采纳的四条设计模式

### 模式 A：四态结论，禁止百分比置信度

每条结论只能取四个值之一：

| 状态 | 判定条件 |
|---|---|
| `已确认` | 检索到条文原文，且事实明确支持 |
| `较可能` | 依据充分，但存在需要确认的事实假设 |
| `无法判断` | 争点有多种解读 / 检索失败 / 需本地裁判口径 —— **必须写明缺什么才能判断** |
| `超出范围` | 非中国法、涉外仲裁、或超出语料库覆盖 |

理由：模型很擅长给一个看起来专业的百分比，但那个数字无从核验。把不确定性压成有限枚举 + 可回溯的原文摘句，使**人**能做确定性检查。

### 模式 B：检索为空 ≠ 不存在

`mike` 的 system prompt 里有一句："an empty result does not prove a clause is absent"。

对应到本项目：核验器报 ❌ 时，persona 必须要求 agent 说"本地语料库未收录"，而不是"该条不存在"。这两句话在法律工作里的分量完全不同。

### 模式 C：playbook 沉默时问，不设默认值

`nda-review/SKILL.md` 里有一句很硬的规则："This skill does not ship with default positions… **Issuing GREEN against defaults means a non-lawyer set the positions the next non-lawyer relies on.**"

对应到本项目：案件事实缺关键项（当事人立场、时间线、是否超过时效）时，只输出待确认清单，不得用"一般/通常"补位。

### 模式 D：交付物固定块 —— 审阅提示

借鉴 `commercial-legal/CLAUDE.md → ## Outputs`：每个交付物顶部固定五行：

```
⚠️ 审阅提示
- 法条来源：[本地语料库已收录 / 未收录，引用需人工核对原文]
- 已读材料：[列出实际读过的文件与页范围 / 未读]
- 需律师判断：[N 处，已用 [需核实] 标记]
- 时效性：[检索过是否有更新 / 未检索]
- 本产出为工作底稿，不构成法律意见
```

---

## 三、明确**没有**采纳的做法

### 不采纳：把 IRAC 做成强制输出格式

调研发现**没有任何一个真实范例**把 IRAC 作为硬输出格式。IRAC 在学术上确有证据（COLIEE 上优于泛化 CoT），但那是"抽取/判断预测"类任务，且证据为二手引用。IRAC 适合做**给人和机器读的骨架**，不适合当质量保证。

### 不采纳：多 agent 编排作为默认形态

`claude-for-legal` 的 `managed-agent-cookbooks` 是给**批量、长文档、可并行**场景的（合同批量审、尽调格），成本与延迟都高。单份文档的法律分析用单 agent + 流程足够。

### 不采纳：把流程写进 persona

Claude Code 官方建议 system prompt 最佳 **500–3000 字符**。初版 persona 1060 字符在合理区间，但问题在于**流程与风格混在一层、没有优先级** —— 简单问答也要付全套流程的注意力成本。

调研的建议是：persona 只留「立场前置 + 引用硬规则 + 四态枚举 + 输出骨架」，**七步分析流程下沉成 skill**，复杂分析时才加载。

---

## 四、当前落地状态与待办

**已落地**：
- `preset/` 目录，bundle `@local/dsh-legal-agent-preset`，preset id `legal`，显示名「法律分析」，已安装且 `fiberPhase: active`。
- persona 含：四态枚举、检索为空≠不存在、bash 收窄与防注入、审阅提示块。
- 能力来源：`cli.mjs check`（引注核验）+ `cli.mjs ask`（四智能体流水线）。

**待办（按优先级）**：
1. **扩充核验语料库** —— 当前 26 条是核心短板。接 `flk.npc.gov.cn` 国家法律法规数据库。
2. 把七步分析流程下沉成 skill 文件，persona 再瘦身。
3. 减少工具重叠（`tool-fs` 与 `skill-filesystem` 二选一）。

---

## 五、引用与来源

- [`anthropics/claude-for-legal`](https://github.com/anthropics/claude-for-legal) — 官方法律插件套件，9714★
- [`open-legal-products/mike`](https://github.com/open-legal-products/mike) — 全栈开源法律 AI 平台，4348★
- [`chrisryugj/korean-law-mcp`](https://github.com/chrisryugj/korean-law-mcp) — 韩国法令 MCP，2725★
- [`CSlawyer1985/contract-review-pro`](https://github.com/CSlawyer1985/contract-review-pro) — 执业律师的合同审核 skill，280★
- [`silvrblt/sanjiu-core`](https://github.com/silvrblt/sanjiu-core) — 三审九方，本项目对抗式审计层的来源
