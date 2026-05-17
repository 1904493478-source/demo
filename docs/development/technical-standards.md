# 技术与执行标准

## 工程边界

V0.1 不继续扩张 `src/pages/Home.tsx`。安排模块应以独立目录承载：

```text
src/features/arrangements/
  components/
  data/
  lib/
  types.ts
```

首页只负责接入入口和页面切换，安排模块内部负责列表、日历、详情、表单和状态变更。

## 数据策略

V0.1 使用本地 Demo 数据和 localStorage。所有数据读写集中在 `src/features/arrangements/data/arrangementStore.ts`，组件不直接访问 localStorage。

状态变化必须通过纯函数实现，放在 `src/features/arrangements/lib/arrangementState.ts`：

- 创建安排。
- 更新安排。
- 完成安排。
- 以后再说。
- 从时间字段推导展示状态。

这样后续 V0.2 接 AI 识别时，可以复用同一套状态逻辑。

## 测试策略

新增业务逻辑必须先写测试。V0.1 最少覆盖：

- 截止时间已过时进入 `timePassed`。
- 无时间安排不进入逾期逻辑。
- “以后再说”会保留 previousTime 并清空当前时间。
- 完成安排会写入 `completedAt`。
- 日历数据只接收有时间的安排。

如果项目尚未配置测试框架，V0.1 的第一步是补齐 Vitest 与 Testing Library，再写失败测试。

## 前端实现标准

1. 移动端优先，至少检查 320px、390px、768px。
2. 组件超过 200 行时拆分。
3. 列表项、日历格、表单字段、底部面板分别独立组件。
4. 使用现有 Tailwind 和 token，不引入新的 UI 框架。
5. 不使用 `transition-all`。
6. 不用红色表示逾期。
7. 所有空状态、错误状态、无数据状态都要有文案。

## 验证命令

每个可提交开发切片必须运行：

```sh
pnpm lint
pnpm build
pnpm verify:answer
```

如果引入测试框架，必须新增：

```sh
pnpm test
```

并把 `pnpm test` 纳入 `pnpm verify:answer` 或在最终说明中单独列出。
