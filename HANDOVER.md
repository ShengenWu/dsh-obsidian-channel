# dsh-obsidian-channel 项目交接文档

> 生成时间：2026-08-14（第 2 版，覆盖 M1 实机验收 + M2 交付，供新接手人通读）
> 接收人：下一位开发者。上一版交接（dsh-alter 会话的生态调研与 M1 落盘记录）
> 在 git 历史中（7adc2f9 与更早版本），需要调研背景时翻 git log 或第 10 节。

---

## 0. 项目身份

- 包名 / 插件 id / settings namespace / client bundle id：`dsh-obsidian-channel`
- GitHub 仓库：https://github.com/ShengenWu/dsh-obsidian-channel （分支 main）
- 本地 checkout：`/Users/shengen/code/dsh-obsidian-channel`（2026-08-14 由
  `~/code/dsh-obsidian` 改名而来；已安装插件是符号链接指向此目录）
- 真实验收 vault：`/Users/shengen/obsidian`
- 一句话定位：DeepSeek Harness（dsh）插件——把 Obsidian vault 变成 agent 可
  **安全写入**的知识库（审批门 + journal + 字节级回滚 + Web 设置页/历史面板）。

## 1. 一页速览：项目当前状态

| 里程碑 | 状态 | 提交 |
|---|---|---|
| M1 安全内核 + 写侧 + 回滚 | ✅ 完成并实机验证（3 个真机 bug 已修） | 5377fbf / 0b45eb9 |
| M2 设置页 + 变更历史面板 | ✅ 代码完成、测试全绿，**实机验收待 web 重启后执行** | b7cf841 |
| 文档 | DESIGN.md §13 竞品 / §14 M1 验收 / §15 M2 实现；README；本文档 | 2712483 / 4cb7665 |
| 发布 | GitHub main 已推送全部 7 个提交，本地=远端 | a24b418 / 7331e60 |

- **测试**：单测 21/21 全绿；冒烟（真实 rc.6 dsh-tools/schemastery + M2 接线断言）全绿。
- **实机状态**：插件已安装在 web profile（符号链接模式）。截至最后一次探测（2026-08-14），
  dsh web **尚未重启**——运行中的还是旧代码：错误路径仍会触发已修复的 schema bug。
  **接手第一件事：重启 dsh web，然后按第 7 节清单做验收。**

## 2. 仓库与 git

```bash
git clone git@github.com:ShengenWu/dsh-obsidian-channel.git
# 或 https://github.com/ShengenWu/dsh-obsidian-channel.git
cd dsh-obsidian-channel
git remote -v   # origin -> git@github.com:ShengenWu/dsh-obsidian-channel.git
```

- 分支 `main`；发布 = `git push origin main`（本机 git 有 insteadOf 规则，HTTPS 自动走
  SSH agent，无需代理；GitHub 直连可用，备用代理 `http://127.0.0.1:7897`）。
- 7 个提交（老到新）：5377fbf M1 → 0b45eb9 真机修复 → 2712483 验收记录 → b7cf841 M2
  → 4cb7665 M2 设计记录 → a24b418 仓库发布 → 7331e60 目录改名。

## 3. 文件地图

| 文件 | 说明 |
|---|---|
| DESIGN.md | 设计总文档：§5 五层安全模型、§6 设置页 UX、§9 分阶段、§13 竞品、§14 M1 验收、§15 M2 实现 |
| src/engine.js | 安全内核（~750 行纯函数）：边界/冲突/journal/回滚/trash/frontmatter 合并/批量 overlay/保留清理 |
| src/tools.js | 10 个 defineTool 工具（read/create/update/append/delete/batch/history/undo/rollback/restore）+ cleanNulls 边界 |
| src/index.js | host 半装配：工具注册 + installSettingsSection + /obsidian connection RPC 通道 |
| src/client/index.tsx | client 半入口：locale + settings.section 注册 |
| src/client/ObsidianSection.tsx | 设置页组件：配置字段 + 变更历史面板（LCS diff + 一键回滚） |
| src/client/locales.ts | zh/en 词典 |
| lib/client.js | client 半构建产物（tsdown，25KB，已提交；改 client 源码后必须重跑 build 并提交） |
| tsdown.config.mjs | client 打包配置（ModuleLoader 契约 banner/footer/intro） |
| cordis.patch.yml / package.json | bundle 装配：insert(id/inject/config) + dsh.client + exports[./client] |
| tests/engine.test.mjs | 21 个安全内核单测（内存 fs，零外部依赖） |
| tests/smoke.mjs | rc.6 全链路冒烟：工具注册 + 全管线 + schema conformance + M2 settings/RPC 断言 |
| scripts/link-runtime.sh | 把已安装 rc.6 运行时包链接进本仓库 node_modules（跑冒烟前置） |

## 4. 架构速览

### 4.1 五层安全模型（DESIGN §5，M1 已全部实现）

L0 边界（路径 sanitize/逃逸拒绝/symlink 拒绝/排除目录）→ L1 永不静默覆盖
（version 守卫 + conflict 报告；删除永远走 trash）→ L2 写入审批（ctx.approval，
writePolicy per-write/per-turn/auto）→ L3 journal（先落 planned 再 done，含 before
全文快照，30 天保留）→ L4 回滚（undo/rollback 字节级恢复，回滚本身也留痕可再撤）。

### 4.2 host 半（纯 JS ESM，零构建）

- 服务注入：tools / fs / approval；settings 与 connection 均为可选接线
  （ctx.inject(['settings'], cb) / ctx.inject(['connection'], cb)，无则优雅降级）。
- **settings 通道**：installSettingsSection(ctx, ns, Config, 组合 entry, hooks)，
  hooks.setSource 把 live source thunk 交给全部工具与 RPC——配置写入即时生效。
  注意：apply(ctx, config) 的 config 是装载时静态值，必须经 scope 读 live 值。
- **RPC 通道**：ctx.connection.rpc.handle('/obsidian', handler, { authority: 'loopback' })，
  端点 history/list、history/entry（before/after 全文）、history/rollback、vault/check。
  错误返回 { ok: false, error: { code: 'internal', message, details: {} } }。
- 面板回滚**不走 ctx.approval**（该 seam 要求 agent + 打开的 turn，UI 点击两者皆无）；
  按钮点击即用户授权；回滚自身 journal 留痕。

### 4.3 client 半（TSX，tsdown 构建）

- 服务注入：slots / settingsScope / locale / connection。
- 注册 `settings.section`（Settings → Obsidian 页）：4 个配置字段经
  ctx.settingsScope.bind({namespace}) 读写（落盘 $DSH_HOME/settings.yaml，热发布）；
  变更历史面板经 rpc 拉取 journal、LCS 行级 diff、一键回滚。
- 打包契约：CJS + window.__ModuleLoader__.load 包装，react/jsx-runtime 全部 external
  （shell 提供）；dsh.client + exports[./client] 被 dsh-client-modules 发现。

## 5. 本地开发环境

```bash
cd /Users/shengen/code/dsh-obsidian-channel
npm install              # 安装 tsdown 等 devDeps
sh scripts/link-runtime.sh   # 链接已安装 rc.6 运行时包（dsh-tools/dsh-settings/schemastery）
npm test                 # node --test tests/engine.test.mjs（21/21）
node tests/smoke.mjs     # 真实 rc.6 全链路冒烟
npm run build            # tsdown -> lib/client.js（改 client 源码后必须执行并提交产物）
```

- 注意 Node 24 的 `node --test tests/`（目录参数）会异常报 fail，用显式文件路径。
- rc.6 权威运行时：/Users/shengen/.nvm/versions/node/v24.13.0/lib/node_modules/@deepseek-ai/dsh
  （本地源码 checkout 是 rc.5，一切以安装版为准）。

## 6. 安装与配置

```bash
dsh plugin --profile web add github:ShengenWu/dsh-obsidian-channel
# 或本地路径（开发）：dsh plugin --profile web add /Users/shengen/code/dsh-obsidian-channel
# 然后重启 dsh web
```

- 本机现状：web profile 已装（符号链接 -> ~/code/dsh-obsidian-channel），无需重装，
  重启即可加载全部修复与 M2。
- settings.yaml 已预置（~/dsh 配置文件 $HOME/.dsh/settings.yaml）：
  `dsh-obsidian-channel: { vaultDir: /Users/shengen/obsidian }`，重启后 agent 免传 vaultDir。
- 若目录改名/移动：`dsh plugin --profile web add <新绝对路径>` 即可重建符号链接
  （会同步更新 profile package.json 与 pnpm-lock）。
- 图形配置：Settings → Obsidian（vault/策略/排除/保留天数，写后即时生效）；
  完整配置表单同时出现在 Settings → Plugins → dsh-obsidian-channel。

## 7. 实机验收状态与清单

### 7.1 已实机验证 ✅（旧代码下）

- 10 工具注册、真实 vault 读取、dryRun 全链路（真实 vault、不触发审批）。
- 写入 + 会话审批策略 'never' + writePolicy per-write → denied/rejected，**vault 零触碰**
  （审批门在 journal/写入之前，fail-closed 路径实锤）。
- 路径越界拦截（冒烟覆盖）。

### 7.2 重启 web 后的验收清单（接手人第一件事）

1. boot manifest 出现本插件条目（curl http://127.0.0.1:3080/ 的 window.__DSH_BOOT__），
   且 /plugins/dsh-obsidian-channel/client.js 返回 200。
2. agent 侧：obsidian_read 读不存在的笔记 → 返回干净的 {ok:false, code:'NOT_FOUND', message}
   （重启前会报 output schema 校验错，是旧代码复现）。
3. obsidian_read 读无 H1/无 frontmatter 的笔记（如 Daily/08-13-2026.md）→ 正常返回，
   title/frontmatter 键省略而非 null。
4. 不传 vaultDir 直接读 → 应命中 settings 预置默认。
5. 浏览器走查：Settings → Obsidian 页可见；改一个配置值 → 落盘 settings.yaml；
   历史面板可见既有 journal（或让 agent 写一笔再看）；展开 diff、回滚一笔真实变更。
6. （可选）把会话审批策略从 'never' 改回 'ask'，让 agent 做一笔写入 → 审批卡 UI 弹出；
   这是 M1 唯一未真机验证的点。

## 8. 关键技术结论（踩坑换来的，新同学先读这节）

### 8.1 M1 组（schema/引擎）

1. rc.6 harness 在工具调用层对返回结果做 output.schema 运行时校验；smoke 直接调编译后
   execute 会绕过这层——本仓库已在 smoke 里内置 conform() 检查器镜像该校验。
2. 所有 output.schema 顶层对象必须显式 additionalProperties:false 并声明全部字段；
   可选字段缺失即可，返回 null 会违反类型约束（cleanNulls 在工具边界剥离）。
3. computeNextText 的 changed 必须字节比较，不能硬编码 true（同字节更新会假提交）。
4. ctx.fs 是 target 型 API（resolve/processPath/stat/readText/writeText/listDir）；无
   remove/move/mkdir——trash 移动用 host 侧 node:fs rename（仅在边界校验后）。
5. journal 两阶段 planned→done；ts 单调递增（UUID 文件名排序会乱序）；删除=移入
   .dsh-obsidian/trash/<flat-path>.<opId>.md。

### 8.2 M2 组（settings/RPC/client bundle）

1. settings：host 用 installSettingsSection（可选接线，无需写进 inject）；client 用
   ctx.settingsScope.bind({namespace}) → getSnapshot/subscribe/set(field,value)。
2. 数据通道：RpcMethodMap（/api 域）封闭不可扩展；但 ctx.connection.rpc.handle 是通用
   逻辑通道 seam（自带 loopback 信任栅与信封校验），/api 频道本身即建于其上；备选
   方案是 ctx.webServer 裸 HTTP 路由。harness.handle/host.call 只属于「模型定义的动态包」，
   与静态 bundle 无关，别混淆。
3. 回滚不走 ctx.approval（需要 agent + open turn），UI 点击即授权。
4. client bundle：package.json dsh.client {platform:'web', inject:[4 个 client 包边]} +
   exports[./client]；tsdown banner/footer/intro 三段式 ModuleLoader CJS 契约；
   external 必须含 react/react-dom/react/jsx-runtime/@deepseek-ai/dsh-client-*；
   module id = 包名；产物被服务在 /plugins/<id>/client.js。
5. slots：settings.section 注册 {name,id,order,label(可为 thunk),locale,inject}；
   inject 工厂返回对象的键成为组件顶层 props；ctx.slots.inject('slot', cb) 声明感知等待；
   生命周期 disposer 走 ctx.effect。
6. 应用无 CSP（实测无 header/meta），内联 <style> 注入安全。

### 8.3 通用坑

1. 静态 bundle 改代码必须重启 dsh web（无 HMR）；插件集合变更同理。
2. 已安装插件是符号链接指向本仓库——本地改动即安装内容，但需重启才生效。
3. 通过工具写代码文件时，内容里的反引号/模板插值会破坏外层模板：改用字符串拼接或
   字符串数组 join（本会话踩过多次）。
4. 会话审批策略 'never' 会让所有 ctx.approval.request 直接拒绝——正好可用于验证
   fail-closed，但验证审批卡 UI 必须改回 'ask'。

## 9. 下一步（接手建议）

1. **重启 + 第 7.2 节验收**（最高优先级）。
2. M3 daily/模板/图侧：daily 按模板建卡、周报、断链/孤儿/MOC（引擎已有索引缓存预留）。
3. M4 composer 双链补全 + 知识工作流 skills：参考 zhaoscsc/dsh-wikilink（双链补全，
   已 clone）与 kepano/obsidian-skills（格式原语，互操作对象）。
4. 可选 M2.5：变更历史面板加 sidebar.footer.action 触发器 + shell.overlay 浮层
   （现面板在设置页内，DESIGN §6 原案）。
5. 开放问题：alias 别名解析（建议 M4 后置）；审批卡 UI 真机验证（见 7.2）；
   与上游 dsh-obsidian-export 的注册接管（peerDependency 已声明）。

## 10. 历史资源（上一会话 dsh-alter 的调研资产）

- 生态调研数据：/Users/shengen/code/dsh-alter/research/ecosystem/（all-repos.json 1206
  仓库、bucketized.json、adam-catalog.json、探测脚本可重跑）。
- 生态空白报告：/Users/shengen/code/dsh-alter/dsh-ecosystem-gap-report.md
  （db-pack/k8s/集成中心三个方向论证，若转向可复用）。
- 参考插件 clone：/Users/shengen/code/dsh-alter/research/ 下 dsh-navbar（client 打包范例）、
  dsh-web-ui-notify（settings 行 + 通知）、dsh-notification、dsh-deep-whale、
  dsh-obsidian-export（上游读侧）、dsh-super-injector、dsh-wikilink。
- 旧版交接文档全文：git 历史 7adc2f9（含竞品调研表格、官方仓库清单、rc.6 API 笔记）。
- 本会话的验收/实现记录：DESIGN.md §14（M1 实机验收 + 3 个 bug 详情）、§15（M2 接线全景）。
