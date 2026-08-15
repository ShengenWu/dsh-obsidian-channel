# dsh-obsidian-channel 项目交接文档

> 版本：第 3 版（覆盖 M1 + M2 实机验收 + M2.5 侧边栏入口/沙箱升级/fs 写守卫/设置页绕过）
> 生成时间：2026-08-15
> 接手人：下一位开发者。本文档取代第 2 版（git 历史 723997f）。
> 第 2 版及其之前的生态调研/验收记录仍保留在 git 历史与 DESIGN.md §13/§14/§15。

---

## 0. 项目身份与环境（本机）

| 项 | 值 |
|---|---|
| 包名 / 插件 id / namespace / client bundle id | `dsh-obsidian-channel` |
| GitHub 仓库 | https://github.com/ShengenWu/dsh-obsidian-channel （分支 main） |
| 本地 checkout | `/Users/shanewu/Code_Project/dsh-obsidian-channel` |
| 真实验收 vault | `/Users/shanewu/obsidian`（已含 `.obsidian`，可读可写） |
| DSH 运行时 | rc.6，`/Users/shanewu/.nvm/versions/node/v24.12.0/lib/node_modules/@deepseek-ai/dsh` |
| Node | v24.12.0 |
| `$DSH_HOME` | `/Users/shanewu/.dsh` |
| Web 入口 | http://127.0.0.1:3080 |

> 注意：第 2 版交接是上一任开发者（`shengen` / Node v24.13.0 / vault `/Users/shengen/obsidian`）。
> 本机接手时已把 checkout 与 vault 路径全部换成 `shanewu`；仓库 git 仍是 ShengenWu 的远端。

## 1. 一页速览：当前状态

| 里程碑 | 状态 |
|---|---|
| M1 安全内核 + 写侧 + 回滚 | ✅ 完成并实机验证 |
| M2 设置页 + 变更历史面板 | ✅ 实机验收通过（设置页 `unavailable` 已定位并绕过） |
| M2.5 侧边栏 📓 Obsidian 入口 | ✅ 完成（DOM 注入 + vault 变 workspace + 一键开会话），待复验 |
| 沙箱升级（`sandbox_permissions`） | ✅ 完成 + 冒烟回归 |
| fs 写守卫（原生 write/edit 拦截） | ✅ 完成 + 冒烟回归 |
| system prompt 注入（vault 会话引导） | ⬜ 未做（写守卫已强制 write/edit；bash 为已知缺口） |

- **测试**：engine 单测 21/21；smoke 全绿（含 settings 默认、batch dry-run、沙箱升级、fs 写守卫、config RPC 五类回归）。
- **未提交**：当前工作区相对 `723997f` 有 ~584 行改动（见 §3 文件地图），**全部尚未 commit**。接手后先跑通验收再决定是否提交/推送。

## 2. 一句话定位

把 Obsidian vault 变成 agent 可**安全写入、可字节级回滚**的知识库；安全层（审批门 + journal + 回滚）是**水下的**，对用户只呈现「点 📓 Obsidian → 和 agent 对话改 vault」这种原生体验。

## 3. 文件地图（本轮改动）

| 文件 | 说明 |
|---|---|
| `src/index.js` | host 半：工具注册 + settings 命名空间内联注册（捕获 scope）+ `/obsidian` RPC（config/get·set、history·list·entry·rollback、vault/check）+ **沙箱 controller** + **fs 写守卫** |
| `src/tools.js` | 10 个 defineTool 工具；写工具接入 `sandbox_permissions`/`justification` 升级参数 + 策略解析 + `FS_SANDBOX_DENIED` 映射 |
| `src/engine.js` | 安全内核；`batchMutate` 补 `action:'batch'`；`sandboxPolicy` 穿透到所有 `fs.writeText` |
| `src/client/index.tsx` | client 半入口：locale + settings.section 注册 + **挂载侧边栏入口**（inject 加 `workspaces`） |
| `src/client/entry.ts` | **新增**：📓 Obsidian 侧边栏入口 DOM 注入（自愈 + 与 task-board/SSH 互斥 + 点击开 vault 会话） |
| `src/client/ObsidianSection.tsx` | 设置页组件：配置表单改用 `/obsidian` RPC（config/get·set），历史面板 diff + 回滚 |
| `src/client/locales.ts` | zh/en 词典 |
| `lib/client.js` | client 半构建产物（32KB，已含入口与 config RPC；改 client 源码后必须 `npm run build`） |
| `package.json` | devDeps 补齐 rc.6 运行时包（dsh-tools/dsh-settings/schemastery/dsh-sandbox）；peerDeps 加 dsh-sandbox |
| `package-lock.json` | **新增**（npm install 生成，可复现） |
| `cordis.patch.yml` | bundle patch（inject: [tools, fs, approval]） |
| `scripts/link-runtime.sh` | **已删除**（被 npm install devDeps 取代，见 §8.1） |
| `tests/smoke.mjs` | 冒烟：settings 默认、batch dry-run、沙箱升级、fs 写守卫、config RPC 回归 |
| `tests/engine.test.mjs` | 21 个安全内核单测 |

## 4. 架构速览

### 4.1 五层安全模型（不变，M1 已全量实现）

L0 边界（路径 sanitize/逃逸/symlink/排除目录）→ L1 永不静默覆盖（version 守卫 + conflict）→ L2 写入审批（ctx.approval，per-write/per-turn/auto）→ L3 journal（planned→done，含 before 全文快照，30 天保留）→ L4 回滚（undo/rollback/restore 字节级恢复，回滚本身也留痕）。

### 4.2 本轮新增的三个「水下」机制

1. **沙箱升级（sandbox escalation）**：vault 若在 DSH 沙箱 workspaceRoot 之外，`ctx.fs` 写会被拒。写工具接入官方 `sandbox_permissions` 升级通道（与内置 write/edit/bash 同一机制）——被拒后模型带 `sandbox_permissions=danger-full-access` + `justification` 重试，走 `ctx.approval` 弹卡批准，用更宽 policy 重写。
2. **fs 写守卫**：`fs/write-intent` / `fs/edit-intent` 瀑布监听（`prepend`），命中 vault 就 `throw`，拒绝原生 write/edit 直接改 vault（这些工具不落 journal），强制 agent 用 `obsidian_*` 工具。
3. **设置页绕过**：DSH 的 `settings.describe` 只暴露硬编码白名单 namespace（见 §8.2），第三方插件的 `settingsScope` 不可用；本插件改走自己的 `/obsidian` RPC（`config/get`/`config/set`）读写配置，持久化仍走官方 `settings.update`。代码里已用 `【DSH 尚未适配】` 注释标记，待 DSH 支持后改回 `settingsScope`。

### 4.3 侧边栏入口（M2.5）

DSH sidebar shell 不给外部插件开 slot，task-board/SSH 用「DOM 注入 + 互认家族」约定。本插件照抄该约定但**不 import web-ui**：

- 入口是纯 DOM `<button data-dsh-obsidian-entry>`，插在「新会话」与「工作区浏览器」之间；`MutationObserver` 自愈。
- 定位时把 `[data-dsh-taskboard-entry], [data-dsh-ssh-entry]` 一起当「家族块」稳定排序。
- 点击：读 `config/get` → 未配置 `window.prompt` 引导 → `config/set` → `workspaces.create({path})` + `workspaces.startSession(workspaceId)`。
- 开面板前移除 `data-dsh-taskboard-active` / `data-dsh-ssh-active` 并派发 `dsh-panel-activate`(detail='obsidian')，互斥不打架。

## 5. 本地开发环境

```bash
cd /Users/shanewu/Code_Project/dsh-obsidian-channel
npm install                          # 装 devDeps（tsdown + rc.6 运行时包，均来自 npm）
node --test tests/engine.test.mjs    # 21/21
node tests/smoke.mjs                 # 全链路冒烟（含 5 类回归）
npm run build                        # 改 client 源码后必须执行（tsdown → lib/client.js）
```

- Node 24 下 `node --test tests/`（目录参数）会异常报 fail，用显式文件路径。
- 权威运行时是安装版 rc.6（上表路径），本地 checkout 若存在版本差异以安装版为准。

## 6. 安装与配置

```bash
# 开发（link 模式，本地改动即时生效，重启后加载）：
dsh plugin --profile web add /Users/shanewu/Code_Project/dsh-obsidian-channel
# 然后重启 dsh web
```

- `settings.yaml` 已预置（`$DSH_HOME/settings.yaml`）：
  `dsh-obsidian-channel: { vaultDir: /Users/shanewu/obsidian }`
- 图形配置：Settings → Obsidian（走 `/obsidian` RPC）；完整配置同样可在 cordis.patch.yml 里写。

## 7. 实机验收状态

已通过：10 工具注册、读/写/批/回滚链路、settings 默认 vaultDir、设置页配置读写（绕过后）、fail-closed（审批 never 时写入零触碰）、沙箱升级、fs 写守卫。

**待复验（本轮最后两个修复后需重启重测）**：
1. 点 📓 Obsidian → 会话应在「Obsidian/vault」这个 workspace 下（`workspaceId` 修复后），而非当前工作区。
2. 图标应是紫色**菱形**（非盒子）。

**已知缺口**：
- `bash` 子进程不走 fs 写守卫，仍能直接改 vault（不留 journal）。见 §9。
- 设置页「历史面板一键回滚」走 RPC、无 agent/callId，对「工作区外的 vault」仍会被沙箱挡（升级机制只对模型工具开放）。

## 8. 关键技术结论（踩坑，新同学先读）

### 8.1 依赖与构建

1. `@deepseek-ai/*` 运行时包**都在 npm 上**，但 rc.6 挂在 `next` dist-tag（`latest` 还是旧的 `0.0.1-rc.1`）。devDeps 必须显式写 `^0.1.0-rc.6`（或 `^3.18.1`/`^4.0.1`），否则 `npm install` 装错版本。
2. 因此**删掉了 `scripts/link-runtime.sh`**（它硬编码上上任机器的 Node 路径）。现在 `npm install` 从 npm 拉齐运行时依赖，可移植。
3. `dsh-obsidian-export`（可选 peerDep）在 npm 上 404，且本插件代码并未 import 它——M4 接线前建议先移除该 peerDep。
4. git 安装（`dsh plugin add github:...`）装的是源码、不跑 build；公开分发建议加 `prepare` 脚本或发布 npm/tarball。

### 8.2 设置通道

1. **根因（重要）**：DSH `dsh-host-apiproxy` 里 `settings.describe` 只返回硬编码 `WEB_SETTINGS_NAMESPACES` 白名单 + model provider + `ui-onboarding`/`agent-presets` 的 namespace；其余（含所有第三方）被 `filter` 掉，写入也报 `settings-not-exposed`。源码注释明说「Moving that declaration to settings.register() … is deferred work」。**所以第三方插件目前无法用官方 `settingsScope`。**
2. 绕过：配置走插件自己的 `/obsidian` RPC（`ctx.connection.rpc.handle`，`authority:'loopback'`），持久化仍用官方 `settings.update`。代码已标 `【DSH 尚未适配】`，待上游支持后改回。
3. `installSettingsSection()` 内部用异步 `ctx.inject(['settings'], cb)`；若用 `let currentConfig` 直接赋 `setSource`，工具在 `apply` 时按值捕获了旧函数，live settings 永远进不来。**必须用「稳定 thunk 读可变 source」**（见 src/index.js）。

### 8.3 沙箱

1. 沙箱 workspaceRoot = `session.header.cwd ?? process.cwd()`。vault 不在 cwd 下时 `ctx.fs` 写被拒（`FS_SANDBOX_DENIED`）。
2. 官方升级通道：写工具声明 `sandbox_permissions` + `justification`，被拒后走 `approveEscalation`（`@deepseek-ai/dsh-sandbox`）→ `ctx.approval` 弹卡 → 更宽 mode 重写。`ctx.fs.writeText` 第 5 参是 `sandboxPolicy`，必须穿透到引擎。
3. 审批门（ctx.approval）和沙箱是两层，独立。会话 cwd=vault 时沙箱天然放行 vault 写，无需升级。

### 8.4 工具/schema

1. `defineTool` 的 `output.schema` 顶层对象必须 `additionalProperties:false` 且声明全部字段；`required` 字段缺失会运行时报错。smoke 的 `conform()` 现在**会查 `required`**（早期漏查导致 batch bug 溜过）。
2. `batchMutate` 返回值必须带 `action`（已修 `action:'batch'`）。
3. `fs/write-intent`/`fs/edit-intent` 是 waterfall（`(target, exec, next)`），监听器 `prepend` + 命中即 `throw` 可拒绝；内置 `fs-observation-policy` 也用它。

### 8.5 客户端

1. 静态 bundle 改代码必须重启 `dsh web`（无 HMR）；改 client 源码后必须 `npm run build` 并提交 `lib/client.js`。
2. 已装插件是符号链接指向本仓库（`link:`），本地改动即安装内容，重启即生效。
3. `WorkspaceView` 的字段是 **`workspaceId`（不是 `id`）**；`startSession(workspaceId)` 传 undefined 会回退到当前工作区——这就是「会话建错工作区」的坑。
4. 侧边栏入口是纯 DOM（非 React 树），MutationObserver 自愈；家族块互认只读 sibling 的 DOM 属性，不 import。
5. `@deepseek-ai/dsh-api-remotes/client` 等 type-only import 会被 tsdown 擦除，无需 external；运行时包（`@deepseek-ai/dsh-client-*`/react）已 external。

### 8.6 冒烟测试

`tests/smoke.mjs` 的 fake `ctx.inject` 必须**异步**（`queueMicrotask`）模拟真实 Cordis，否则时序 bug（如 settings 默认）会被同步 stub 掩盖。

## 9. 下一步（接手建议）

1. **先提交当前工作区**（或至少打个 tag），再继续。
2. **复验 §7 两项待复验**（workspaceId 修复 + 图标）。
3. **bash 缺口**（三选一，见之前讨论）：
   - A：文档声明 bash 可直接改 vault（不落 journal）为已知限制；
   - B：vault 会话注入 system prompt「改 vault 请用 obsidian_*」；
   - C：vault 会话沙箱 `read-only`，obsidian 工具走升级放行（每次写可能弹卡，较重）。
   当前建议 A+B；真正的路径级沙箱等 DSH 上游。
4. **设置页绕过回迁**：等 DSH 支持第三方 namespace 暴露后，把 `config/get·set` 换回 `settingsScope`（代码里 `【DSH 尚未适配】` 标注处）。
5. **system prompt 注入**：本版未做，可做「vault 会话上下文」引导（注意 systemPrompt 的 scope 需按 session 维度注册）。
6. M3：vault 文件树 + 双链看板（可在 Obsidian 会话右侧/侧边面板，数据源为 vault 的双链/断链图）；daily/模板/周报仍走工具层。
7. 公开化前：`prepare` 脚本、收紧 peerDeps 版本（去掉 `*`）、README 贡献说明。

## 10. 历史资源

- DESIGN.md §13 竞品 / §14 M1 验收 / §15 M2 实现（含 3 个真机 bug 详情）。
- 第 2 版交接全文：git 历史 `723997f`；生态调研资产在上一任机器 `/Users/shengen/code/dsh-alter/research/`（本机无）。
- 参考实现（本机 profile 内）：`@linxin666/dsh-client-ui-task-board`（侧边栏 DOM 注入 + 家族块互认 + 中央列面板），`@linxin666/dsh-ssh` 同源。
