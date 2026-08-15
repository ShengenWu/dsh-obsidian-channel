# dsh-alter 会话交接文档

> 生成时间：2026-08-14
> 2026-08-14 更新：本地 checkout 已从 ~/code/dsh-obsidian 改名为
> ~/code/dsh-obsidian-channel（与 GitHub 仓库同名）；文中旧路径为历史记录，
> 重装/复现时请用新路径。
> 交接范围：本会话（dsh-alter）从「alert 插件需求核查」到「dsh-obsidian-channel M1 落盘」的全部探索、结论、资源与进度。
> 接收人：下一位开发者。

---

## 0. 名词澄清（已与交接发起人确认）

交接需求里提到的「GitHub Ripple」是口误，实际指「GitHub 仓库（repo）」。本会话
研究过的全部 GitHub 仓库都列在本文档第 4.3 节（clone/通读的插件仓库，7 个）与
第 4.4 节（Obsidian 联动竞品，12+ 个），另有第 4.1/4.2 节的官方仓库与生态索引。
不存在任何名为 Ripple 的项目，后续请勿再检索该名词。

---

## 1. 一页速览：本会话做了什么

1. **alert 插件需求核查**：确认「浏览器通知（agent 提问/审批/任务完成）插件」已被
   bill9109/dsh-web-ui-notify 完整实现 → 结论「不用新造」，并完成源码级验证与本机
   rc.6 兼容性验证，给出安装步骤。
2. **dsh 插件生态全景调研**（已完成的第 1 个目标）：抓取 GitHub dsh-plugin 主题
   1129+ 仓库（去重 1206）、npm 检索、4 个 awesome/雷达列表全文解析；对照成熟生态
   39 个能力品类；三轮定向探测验证空白候选 → 产出生态图 + 排序缺口清单。
3. **方向选择**：向用户展开 db-pack / k8s / 集成中心三个方向；用户是 Obsidian 深度
   用户，最终选定「Obsidian ↔ dsh 通道」。
4. **设计文档**：写入 ~/code/dsh-obsidian/DESIGN.md（含五层安全模型、与上游插件
   dsh-obsidian-export 的联动策略、分阶段计划 M1-M4）。
5. **Obsidian 联动竞品联网调研**：确认 MCP 生态拥挤但「dsh 原生通道」空白成立，
   采纳三条外部设计（round-trip 字节安全 / git 自动提交 / kepano skills 互操作），
   更新进 DESIGN.md 第 13 节。
6. **M1 落盘**（已完成的第 3 个目标）：安全内核 + 写侧工具 + 审批接入 + 回滚，
   20/20 单测全绿、真实 rc.6 冒烟通过，git 提交 5377fbf。

---

## 2. 当前进度（~/code/dsh-obsidian 项目状态）

### 已完成

| 项 | 状态 |
|---|---|
| DESIGN.md | 完整设计（含竞品分析第 13 节、kepano 互操作、round-trip 增强条款） |
| M1 安全内核 | src/engine.js（~700 行纯函数：边界/冲突/journal/回滚/trash/frontmatter 合并/批量 overlay/保留清理） |
| M1 工具层 | src/tools.js（10 个工具：read/create/update/append/delete/batch/history/undo/rollback/restore） |
| M1 装配 | src/index.js（cordis 插件：ctx.fs + ctx.approval + 三级写策略 per-write/per-turn/auto） |
| bundle 格式 | package.json（dsh.bundle.patch）+ cordis.patch.yml，可被 dsh plugin --profile web add 安装 |
| 单测 | tests/engine.test.mjs：20/20 全绿（连续 3 次运行稳定；内存 fs 无外部依赖） |
| 冒烟测试 | tests/smoke.mjs：链接本机 rc.6 真实 dsh-tools/schemastery，10 工具全注册 + 全链路（create→read→守卫更新→字节级 undo→history→越界拦截）通过 |
| git | 仓库已初始化，初始提交 5377fbf |

### 未完成（下一步）

- **安装实机验证**：执行 dsh plugin --profile web add /Users/shengen/code/dsh-obsidian
  后重启 dsh web（会中断当前会话，故未执行）。装完在对话里让 agent 调
  obsidian_read 即可验收。
- **M2 设置页 + 变更历史面板**（Web 端 diff + 一键回滚；需写 client half，参考
  dsh-navbar / dsh-web-ui-notify 的 tsdown + ModuleLoader 打包模式）。
- **M3 daily/模板/图侧**（断链/孤儿/MOC）。
- **M4 composer 双链补全 + 知识工作流 skills**。
- DESIGN.md 第 11 节三个开放问题：包名/仓库归属、审批实现 seam 验证（M1 已按官方
  ctx.approval 实现，尚缺真机审批卡 UI 验证）、alias 别名解析（建议 M4 后置）。

### 关键技术结论（给下一位开发者，省去重新踩坑）

1. **bundle 插件格式**（官方）：package.json 声明 dsh.bundle.patch 指向
   cordis.patch.yml（- insert: - id/name/inject/config）；host 半纯 JS ESM 零构建；
   client 半需要 tsdown 打包成 window.__ModuleLoader__.load(...) 包装（dsh-navbar
   是标准范例）。
2. **defineTool（rc.6 严格版）**：parameters 为 per-property spec
   （type/description/enum/required）；output.schema 中每个 object 类型必须显式
   additionalProperties: true/false，否则 JsonSchemaError（冒烟测试抓到）。
   execute(args, exec)：exec 有 callId/rootCallId/agent(含 session.id)/signal。
3. **审批接缝**：ctx.approval.request({agent, toolName, callId, reason, signal})
   → 'allowed-once'|'rejected'|'cancelled'|'unavailable'，fail-closed；必须在
   打开的 turn 内调用；会话审批策略 'ask'/'never'（'never' 下所有请求直接拒绝）。
   本会话自身的审批策略被用户改为 'never'，文件策略改为 danger-full-access
   （工具调用不再允许设置 sandbox_permissions 提权）。
4. **ctx.fs（rc.6 全新 target 型 API）**：resolve/processPath/lstat/stat/contains/
   readText/listDir/writeText；writeText 第二参 FsWriteIntent 支持
   createIfAbsent / replaceIfVersion(version)（FS_STALE_VERSION/FS_NOT_OBSERVED
   错误码）；没有 remove/move/mkdir——trash 移动用 host 侧 node:fs rename
   （本项目只在边界校验通过后使用），writeText 会自动创建父目录；version 是字符串
   （dev:ino:size:mtimeNs:ctimeNs），FsWriteOutcome 自带 before 全文（权威前像）。
5. **schemastery**：z.union(['a','b']).default('a') 数组字面量写法合法。
6. **journal 设计决策**：两阶段 planned→done；ts 必须单调递增（按 UUID 文件名排序
   会乱序——本会话实测 bug）；回滚=写回 before 快照并留 undo 条目（可再撤）；
   删除=移入 .dsh-obsidian/trash/<flat-path>.<opId>.md。
7. **版本漂移**：本机安装版 rc.6 与本地源码 checkout rc.5 不一致；以安装版为准
   （/Users/shengen/.nvm/versions/node/v24.13.0/lib/node_modules/@deepseek-ai/dsh）。
8. **写文件陷阱**：通过工具写代码文件时，内容里的反引号和 JS 模板插值语法（美元
   大括号）会破坏外层模板，裸的换行转义会被转成真实换行——全部改用字符串拼接、
   双反斜杠转义（本会话踩过多次）。

---

## 3. 已完成的三个目标与结论摘要

### 目标 1：alert 插件需求核查 → 结论：已被实现，不用新造

- bill9109/dsh-web-ui-notify（v0.1.2，BSD-3-Clause，2026-08-13 活跃）完整覆盖：
  提问/审批/plan-review 等待 + 每轮完成 + 后台会话整体完成 → 浏览器 Notification
  （requireInteraction 不自动消失）→ 点击跳回对应会话；去重；设置→通用授权开关。
- 本会话已逐行通读其源码并验证与本机 rc.6 的 API 兼容性（pendingInteraction/
  pending/turnEnds/openState/slots/locale 全部存在）。
- 安装：dsh plugin --profile web add github:bill9109/dsh-web-ui-notify，重启 web，
  设置→通用→桌面通知授权（macOS 还要在系统设置→通知允许浏览器）。
- 注意：标签页关闭后浏览器不弹通知（Notification API 通病）。
- 补充：omdsh-dev/dsh-notification 只做完成通知+关键词规则，可互补。

### 目标 2：生态全景调研 → 产出 dsh-ecosystem-gap-report.md

- 数据规模：1206 仓库 / 37 能力桶 / Adam 雷达 286 项（仅 40 兼容、190 待调研、
  9 需适配、12 占位）/ 4 个 awesome 列表 / npm 检索 / 39 个成熟生态品类对照 /
  三轮探测（40+ 关键词）。
- 三大结构性发现：兼容性断裂；dsh-external 组织公开仓库数为 0（半私有目录）；
  无 npm 分发文化。
- 确认空白（0 命中）：数据库工具集、kubectl/K8s、SaaS 连接器（Notion/Jira/Slack/
  Composio）、MCP 一键目录、JetBrains、共享 hooks 库、代码格式化、RSS、Maven、
  企业治理审计。已有但很薄：Langfuse 观测（0★）、邮件（2★）、日历、翻译、
  秘密扫描、webhook、金融行情、Android、音乐。
- 优先级建议：① dsh-db-pack ② dsh-k8s ③ 集成中心（SaaS 连接器 + MCP 目录）。

### 目标 3：dsh-obsidian-channel M1 → 已落盘提交（见第 2 节）

---

## 4. 全部资源清单

### 4.1 官方资源（dsh / cordis）

| 资源 | 链接 / 本地位置 |
|---|---|
| dsh 官方仓库 | github.com/deepseek-ai/deepseek-harness（本地 checkout：/Users/shengen/code/deepseek-harness，rc.5） |
| 本机安装版 dsh（rc.6，运行基准） | /Users/shengen/.nvm/versions/node/v24.13.0/lib/node_modules/@deepseek-ai/dsh |
| cordis 框架 | github.com/cordiverse/cordis（官方仓库）+ github.com/cordiverse/paper |
| 官方文档 | deepseek-harness.github.io/deepseek-harness/guide/quickstart；/develop/basic（config/tool/publish）；/develop/framework（events/service） |
| 本会话读过的官方源码 | packages/core/tools/src/schema.ts（defineTool）；packages/interaction/user-approval（审批接缝）；packages/fs/fs + dsh-fs-local（fs 接缝）；packages/mcp/mcp-client；packages/hooks（hook-protocol + claude/codex 桥）；packages/guard/compaction/context/goal/plan/preset/interaction/schedule/session-query/storage/credentials/api/attachment；packages/client/runtime、ui-slots、ui-settings、ui-user-questions、ui-permission-presets；apps/web；packages/bundle/web-app |

### 4.2 生态索引与目录

| 资源 | 链接 |
|---|---|
| libukai awesome（用户给的入口） | github.com/libukai/awesome-deepseek-harness |
| 0xsline awesome | github.com/0xsline/awesome-deepseek-harness |
| awesome-dsh-plugin（178 项精选） | github.com/awesome-dsh-plugin/awesome-dsh-plugin + 其 dsh-find-plugin |
| Adam 兼容性雷达（286 项 + 每日扫描） | github.com/AdamPlatin123/awesome-dsh-plugins（PLUGINS.md 为登记表，完整目录在 README 的 AUTO 区块） |
| 其他索引 | github.com/bruc3van/awesome-dsh-plugin；github.com/Alex-Yanggg/awesome-DSH-plugin；github.com/Dominic789654/awesome-deepseek-harness |
| GitHub 主题 | github.com/topics/dsh-plugin（1129+ 仓库，本会话抓取 1206 去重） |
| dsh-external 组织 | github.com/dsh-external（公开仓库数 0，大量目录链接实际私有/占位） |

### 4.3 研究过的具体插件仓库（本会话 clone/通读过的，clone 在 dsh-alter/research/）

| 仓库 | 看点 |
|---|---|
| vlln/dsh-navbar | 官方 bundle 双半（Node 空壳 + client ModuleLoader）标准范例 |
| Small-tailqwq/dsh-deep-whale | Web client bundle（maid-atelier 主题） |
| omdsh-dev/dsh-notification | 完成通知 + 关键词规则 + 设置页（settings.general.item 槽位范例） |
| bill9109/dsh-web-ui-notify | alert 需求的现成实现（详见第 3 节目标 1） |
| xiaomiba0904/dsh-obsidian-export | 上游插件：纯函数 engine.js + 读侧六件套 + 会话导出（本项目的依赖与复用对象） |
| yjh051108/dsh-super-injector | 运行时插件注入器（开发向基础设施） |
| zhaoscsc/dsh-wikilink | 输入框双链补全（M4 的参考/共存对象） |

### 4.4 Obsidian 联动生态（联网调研，全部已读 README/竞争文档）

| 类别 | 仓库 / 链接 | 要点 |
|---|---|---|
| MCP+skills（最接近本设计） | github.com/bettyguo/obsidian_mcp（+ docs/competitive.md 完整竞品表） | 22 工具 + 7 工作流 skills + round-trip 字节级安全协议 |
| 官方 skills | github.com/kepano/obsidian-skills（~17.7k★） | Obsidian CEO 发布；.md/.base/.canvas 格式原语；本项目互操作对象 |
| MCP+git 回滚 | github.com/t-rhex/obsidian-mcp-server（npm: mcp-obsidian-vault） | 27 工具 + 每次写自动 git commit + 任务编排/决策日志 |
| MCP 深度 convention | github.com/cyanheads/obsidian-mcp-server（~516★） | 14 工具，wiki/frontmatter/periodic notes |
| MCP 高星 | github.com/MarkusPfundstein/mcp-obsidian（~3.7k★，Local REST API） |
| MCP 文件直连 | github.com/StevenStavrakis/obsidian-mcp（~703★）；natestrong/obsidian-mcp（PyPI，SQLite 索引） |
| Obsidian 应用内 MCP | github.com/DoktorDaveJoos/cortex-mcp（HTTP :27182）；2233admin/obsidian-vault-bridge |
| Obsidian 应用内 AI（互补） | Smart Connections（~786k 装机）；Copilot（logancyang，~6k★）；Khoj；Text Generator；BMO |
| 其他 | es617/obsidian-sync-mcp；Shreg-ai/compiler；yuukiLike/zeromd（同步）；sunnybluesea/deepseek-obsidian-plugin（DeepSeek 模型入 Obsidian，与 dsh 无关） |

### 4.5 本地资源文件（工作区 /Users/shengen/code/dsh-alter）

| 文件 | 内容 |
|---|---|
| dsh-ecosystem-gap-report.md | 生态全景与空白分析总报告 |
| ai-agent-plugin-capability-list.md | 成熟生态 39 能力品类清单（子代理产出，22 次搜索） |
| research/ecosystem/all-repos.json | 1206 个仓库元数据（stars/pushed/描述/主题） |
| research/ecosystem/bucketized.json | 37 桶归类结果 |
| research/ecosystem/adam-catalog.json | Adam 286 项 + 兼容性状态 |
| research/ecosystem/oxsline-sections.json / awesome-sections.json | 两个精选列表解析 |
| research/ecosystem/npm-*.json（slim 版可读） | npm 三路检索原始数据 |
| research/ecosystem/topic-page1..10.json | GitHub 主题原始分页 |
| research/ecosystem/probe_gaps*.py + final_probe.py | 三轮空白探测脚本（可重跑） |
| research/dsh-navbar / dsh-deep-whale / dsh-notification / dsh-web-ui-notify / dsh-obsidian-export | 参考插件 clone |

### 4.6 项目文件（/Users/shengen/code/dsh-obsidian）

| 文件 | 说明 |
|---|---|
| HANDOVER.md | 本文档 |
| DESIGN.md | 设计文档（334+ 行，含第 13 节竞品分析） |
| README.md | 插件使用说明（安装/安全模型/开发测试） |
| src/engine.js / src/tools.js / src/index.js | M1 实现 |
| cordis.patch.yml / package.json | bundle 装配 |
| tests/engine.test.mjs（20/20）/ tests/smoke.mjs（rc.6 冒烟） | 测试 |
| scripts/link-runtime.sh | 建立 rc.6 运行时符号链接（跑冒烟前置） |

---

## 5. 给下一位的交接建议

1. 先读 DESIGN.md（特别是第 5 节安全模型与第 13 节竞品分析），再读 README 和
   三个 src 文件（engine → tools → index 的依赖顺序）。
2. 接手 M2 前，先实机装一次 M1（dsh plugin --profile web add + 重启 web），
   用真实 vault 验收 obsidian_read/create/undo，确认审批卡 UI 正常弹出
   （这是 M1 唯一未真机验证的点）。
3. 生态调研数据全在 dsh-alter/research/ecosystem/，可复现（探测脚本保留）；
   若要做 db-pack/k8s/集成中心，直接复用 dsh-ecosystem-gap-report.md 的证据。
4. 本会话总结的「关键技术结论」（第 2 节）是踩坑换来的，新同学先读这 8 条。
5. 未知事项：本会话未探索任何「GitHub Ripple」相关内容（见第 0 节），如确有所指
   请补充后再交接。
