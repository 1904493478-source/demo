# 项目开发文档索引

本目录用于沉淀“安排”模块后续开发的需求、技术、设计和执行标准。这里的文档服务于真实开发推进，不替代 `AGENTS.md` 和 `docs/candidate-rules.md` 中的候选人答题与记录规范。

## 文档结构

- `roadmap-arrangements.md`：从 V0.1 到 V0.5 的版本节奏和边界。
- `requirements-arrangements.md`：“安排”模块的产品需求整理。
- `design-standards-arrangements.md`：视觉、交互、动效和“不焦虑”体验标准。
- `technical-standards.md`：工程边界、数据模型、测试和验证标准。
- `v0.1-implementation-plan.md`：V0.1 的可执行开发步骤。
- `v0.2-ai-arrangements-plan.md`：V0.2 AI 候选安排识别计划和收尾状态。
- `v0.3-ai-arrangements-plan.md`：V0.3 群聊安排识别、AI 精修、候选归集和阶段收尾状态。
- `v0.4-intelligent-completion-plan.md`：V0.4 智能完成最小闭环、无 @ 群聊低置信候选和当前收尾状态。
- `v0.5-ai-execution-plan.md`：V0.5 AI 执行能力分层、模型辅助智能完成匹配和自动执行安全边界。

## 开发原则

1. 每次只推进一个能被验证的小版本，不把 AI 识别、群聊、归集合并一次性塞进 V0.1。
2. V0.1 先证明手动创建、完成、列表/日历、“以后再说”的基础体验成立。
3. 前端实现必须优先照顾移动端真实使用感，避免模板化卡片堆叠。
4. 任何业务改动完成前必须运行 `pnpm verify:answer`。
5. 每日开发结束时运行 `pnpm devlog:update`，让 `development-logs/` 中的当天日志保持最新。
