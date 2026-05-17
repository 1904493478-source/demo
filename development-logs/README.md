# 开发日志

本目录记录项目日常开发事项。它和 `docs/codex-logs/` 不同：

- `docs/codex-logs/` 记录候选人与 Codex 的每轮对话。
- `development-logs/` 记录每天完成了哪些开发事项、还有哪些待办、当前风险和验证状态。

每日开发结束时运行：

```sh
pnpm devlog:update
```

脚本会创建或更新当天日志文件，例如：

```text
development-logs/2026-05-16.md
```

自动生成内容位于 `AUTO` 标记之间，可以反复刷新；手动补充内容写在标记外。
