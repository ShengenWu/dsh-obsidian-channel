# dsh-obsidian-channel 设计文档

> 状态：草案 v0.1（待评审）
> 日期：2026-08-14
> 作者：dsh-alter 会话
> 定位：把 DeepSeek Harness（dsh）变成 Obsidian 的原生知识管理协作者——读、写、维护你的 vault，且任何让你不满意的操作都能一键回滚。

---

## 1. 目标与定位

### 一句话

装上这个插件后，你可以在 dsh 对话里对本地 Obsidian vault 做「读 / 搜 / 写 / 维护」：
从「查某篇笔记」「按模板建卡片」「整理每日笔记周报」到「全库断链修复」，
全部通过模型工具完成；所有写操作有审批门、有变更日志、可回滚。

### 非目标（明确不做）

- 不做 Obsidian 同步（zeromd 已有，30★，不是本插件职责）
- 不做 Obsidian 应用内插件（本插件跑在 dsh 里，vault 只是本地 markdown 文件夹）
- 不做通用笔记应用集成（Notion/Jira 是另一个项目「集成中心」的范畴）
- 不依赖 Obsidian Local REST API：文件直连更简单、无需 Obsidian 运行、无端口安全面

### 目标用户

- Obsidian 深度使用者（本人即目标用户）：笔记量大、双链多、有 daily/模板习惯
- 希望 agent 参与知识管理但不希望 agent 搞乱 vault 的人

---

## 2. 与 dsh-obsidian-export 的联动关系

现有插件 dsh-obsidian-export（v0.1.0，2026-08-13 活跃，MIT）已实现：

| 已有能力 | 说明 |
|---|---|
| obsidian_export | 会话导出到 vault，manifest 去重（create/skip/update/overwrite/dry-run） |
| vault_discover | 扫描目录自动发现 vault（含共享缓存 setSharedVault/getSharedVault） |
| obsidian_read | 读笔记：frontmatter + 首 H1 + 双链 + 标签 |
| obsidian_search | 按文件名/全文/标签搜索 |
| obsidian_list | 递归列笔记与文件夹 |
| obsidian_tags | 全库标签聚合 |
| obsidian_backlinks | 单跳反向链接 |
| engine.js | 纯函数导出引擎（fs 注入式，零框架依赖，exports 出 ./engine） |

其实现质量高（会话本已通读源码），关键 API：

- 工具定义用 @deepseek-ai/dsh-tools 的 defineTool + @deepseek-ai/schemastery 的 z
- 文件访问全部走 ctx.fs seam（不直接碰 node:fs）
- bundle 形式：cordis.patch.yml insert 一行，inject: [tools, sessionPersistence]
- 缺点：纯 Node 半、无写侧（除 export）、无 Web 设置页、无回滚、无 composer 集成

### 联动策略：依赖 + 复用 + 补全（不重造、不 fork）

1. 依赖关系：本插件 peerDependency 声明 dsh-obsidian-export，
   直接 import 其 engine.js 的纯函数（parseSessionJsonl/contentHash/planExport/applyExport），
   导出能力原样继承，不复制代码。
2. 读侧工具：沿用其 6 个工具的行为语义与参数（避免模型面对两套 obsidian_read），
   由本插件统一注册；若检测到 dsh-obsidian-export 也启用，
   patch 层自动禁用其工具注册（写 disabled 行），保证不重复注册。
3. 写侧、图侧、daily/模板、回滚：本插件新增，全部是它的空白。
4. 升级路径：如果作者愿意，最终形态可合并回上游；本插件保持 engine 边界干净，
   未来上游升级只需跟 peerDependency 版本。

---

## 3. 架构

    ┌────────────────────────── dsh web ──────────────────────────┐
    │  浏览器（client half，官方 bundle client 通道）              │
    │  ┌─────────────┐ ┌──────────────┐ ┌────────────────────┐    │
    │  │ 设置页      │ │ 变更历史面板   │ │ 输入框 [[ 补全      │    │
    │  │ vault/策略  │ │ diff+一键回滚 │ │ + 引用注入          │    │
    │  └──────┬──────┘ └──────┬───────┘ └─────────┬──────────┘    │
    └─────────┼───────────────┼───────────────────┼───────────────┘
              │ settings       │ history/undo      │ index(文件名/标题)
              ▼                ▼                    ▼
    ┌──────────────────── host half（cordis 插件）────────────────┐
    │  ┌──────────────────────────────────────────────────────┐   │
    │  │ 工具注册（defineTool）：读/搜/图/写/daily/模板/回滚    │   │
    │  └───────────────┬──────────────────────────────────────┘   │
    │                  │                                           │
    │  ┌───────────────▼───────────────┐  ┌────────────────────┐  │
    │  │ 安全内核：                    │  │ 复用上游：          │  │
    │  │ 边界校验→冲突检测→审批→journal │  │ dsh-obsidian-export │  │
    │  │ →原子写→回滚引擎               │  │ engine.js（导出）   │  │
    │  └───────────────┬───────────────┘  └────────────────────┘  │
    │                  │ ctx.fs（走 dsh 官方文件 seam）            │
    └──────────────────┼──────────────────────────────────────────┘
                       ▼
              本地 Obsidian vault（markdown 文件夹）
              + .dsh-obsidian/（manifest / journal / cache / trash）

### 关键决策

- 所有文件操作走 ctx.fs（与上游一致），工具运行在宿主上下文——
  因此「审批门 + journal + 回滚」就是安全主体，而不是依赖 agent 沙箱。
- 引擎层（journal、冲突检测、frontmatter 合并、路径边界）全部纯函数、
  fs 注入式，与上游 engine.js 风格一致，便于单测与复用。
- client half 用官方 bundle client 通道（本会话已通读 dsh-navbar /
  dsh-web-ui-notify 的 tsdown + ModuleLoader 打包方式，照搬即可）。

---

## 4. 工具集设计

命名沿用上游 obsidian_ 前缀；写工具全部返回统一结构
{ ok, action, path, beforeHash, afterHash, opId, dryRun, message }。

### 4.1 读侧（沿用上游语义 + 两处小扩展）

| 工具 | 参数 | 行为 | 扩展点 |
|---|---|---|---|
| vault_discover | discoverRoots | 扫描 .obsidian 目录定位 vault | 不变 |
| obsidian_read | vaultDir, path | 返回 frontmatter/首H1/双链/标签/正文 | 增加返回 baseHash（供写侧冲突检测） |
| obsidian_search | vaultDir, field, q, tags | 文件名/全文/标签搜索 | 增加按 frontmatter 字段过滤 |
| obsidian_list | vaultDir, subpath | 递归列 .md 与目录 | 不变 |
| obsidian_tags | vaultDir | 标签聚合计数 | 不变 |
| obsidian_backlinks | vaultDir, target | 单跳反链 | 不变 |

### 4.2 图侧（新增）

| 工具 | 参数 | 行为 |
|---|---|---|
| obsidian_graph | vaultDir, what=orphans|broken|stats | orphans：无入链无出链笔记；broken：指向不存在笔记的链接清单（含来源行号）；stats：笔记数/链接数/平均度数/最大 hub |
| obsidian_moc | vaultDir, topic, scope | 生成地图笔记（MOC）骨架：列出相关笔记链接分组，默认 dry-run 返回内容，确认后才写 |

### 4.3 写侧（新增，安全内核全量介入）

| 工具 | 参数 | 行为 |
|---|---|---|
| obsidian_note_create | vaultDir, path, content, frontmatter?, dryRun | 目标不存在才建；默认 dry-run 返回完整预览，确认后落盘 |
| obsidian_note_update | vaultDir, path, content, frontmatter?, baseHash, dryRun | baseHash 必须等于当前文件哈希，否则返回 conflict + diff；frontmatter 按合并策略处理 |
| obsidian_note_append | vaultDir, path, section?, content | 追加（无前置条件）；section 支持「## 标题」锚点定位插入 |
| obsidian_note_delete | vaultDir, path | 永不真删：移动到 .dsh-obsidian/trash/ 并记 journal |
| obsidian_batch | vaultDir, ops[] | 批量操作：先整体 dry-run 出变更清单，再逐条执行（每条独立快照） |

### 4.4 每日笔记与模板（新增）

| 工具 | 参数 | 行为 |
|---|---|---|
| obsidian_daily | vaultDir, date?, mode=open|create|append, content? | 按配置的 daily 目录 + 日期格式定位今日笔记；create 套用 daily 模板 |
| obsidian_templates | vaultDir, action=list|apply, name?, target? | 列出模板目录；套用模板（变量替换：{{title}} {{date}} {{tags}}）到目标路径 |

### 4.5 回滚（新增，安全内核核心）

| 工具 | 参数 | 行为 |
|---|---|---|
| obsidian_history | vaultDir, path?, limit | 列 journal 中的变更记录（时间/工具/会话/动作） |
| obsidian_undo | vaultDir, path | 回滚该路径最近一次变更（幂等：无记录则 no-op 报告） |
| obsidian_rollback | vaultDir, opId | 按操作 id 精确回滚（含批量操作中任意一条） |
| obsidian_restore | vaultDir, path | 从 trash 恢复删除的笔记 |

回滚语义：undo/rollback 自身也写 journal（opType=undo），可再 undo，形成完整操作历史。

---

## 5. 安全设计与回滚（本设计核心）

### 5.1 威胁模型：哪些情况会「让用户不满意」

1. agent 写错内容 / 写错路径 / 一次批量操作误伤多篇
2. 用户正在 Obsidian 里编辑笔记，插件覆盖了未保存（或已保存）的新修改
3. 模型被输入诱导（prompt injection）写 vault 之外的文件、或删 vault 文件
4. frontmatter 被破坏（丢失自定义字段、破坏 YAML）
5. 大 vault 被一次遍历打爆（性能 DoS）

### 5.2 五层防线

    L0 范围边界（默认拒绝一切出界）
    L1 永不静默覆盖（冲突检测 + 删除即回收站）
    L2 写入审批（默认每次写都要人点头；可配任务内允许）
    L3 变更日志 journal（每笔写操作留 before 快照）
    L4 回滚与审计（undo/rollback/restore + Web 历史面板）

#### L0 范围边界

- 所有路径经 resolve 后必须位于 vault 根之内；符号链接逃逸检测
  （readlink 展开后仍须在 vault 内）
- 排除目录默认：.obsidian/ .git/ .dsh-obsidian/ .trash/（可配置追加）
- 文件名 sanitize：去路径分隔符、长度上限、拒绝以 . 开头的隐藏写入
- 单次操作体积上限：读 5MB/笔记、写 2MB/笔记、搜索返回 200 条、遍历 4000 文件
- journal/trash/cache 目录只由插件管理，模型工具无法直接写它们

#### L1 永不静默覆盖

- obsidian_note_update 强制携带 baseHash（上次读到的哈希）；
  与磁盘当前哈希不一致 → 不写，返回 conflict 报告（含新旧差异摘要），
  让模型与用户决定下一步（重新读/放弃/merge）
- obsidian_note_create 目标已存在 → 报错并建议 update
- obsidian_note_delete 一律移动 trash（保留原路径信息），不 unlink
- export 类能力沿用上游 manifest 语义（contentHash 不变则 skip）

#### L2 写入审批

- 默认策略：所有写工具（create/update/append/delete/batch/moc 落盘）
  走 dsh 审批卡（复用官方 permission seam，与现有工具审批 UI 一致），
  审批卡显示：工具名、目标路径、动作摘要、影响预览（dry-run 输出）
- 可配置三档（设置页）：
  - 每次审批（默认，最安全）
  - 本任务内允许（同一会话本轮任务中同类写操作免重复审批，任务结束失效——
    对齐官方「Allow for this task」语义）
  - 自动（不建议：仅适合全自动流水线场景，需显式确认开启）
- 读工具永不审批；dry-run 永不审批
- 回滚工具（undo/rollback/restore）视为写操作但审批从轻：
  默认直接执行（因为它在撤销，且自身也留痕可再撤）

#### L3 变更日志 journal

- 每次写操作执行前，先写 journal 条目到 .dsh-obsidian/journal/YYYY-MM-DD/opId.json：
  { opId, ts, sessionId, tool, args, path, kind: create|update|append|delete|undo|restore,
    beforeHash, before: <全文快照 | null>, afterHash }
- 写入顺序：先落 journal（tmp + rename 原子写）→ 再执行变更 → 再补 after 信息
- 回滚时按 before 快照原样恢复（含字节级），因此任何变更可逆
- 保留策略：默认 30 天或 2000 条（可配）；trash 同理
- journal 损坏容错：单条坏记录跳过并告警，不阻断工具

#### L4 回滚与审计

- 模型侧：obsidian_history / undo / rollback / restore（见 4.5）
- 用户侧：Web 设置页「变更历史」面板——按时间倒序列出每笔变更
  （工具/路径/动作/会话），展开看 before→after diff，一键回滚；
  用户不依赖模型即可亲手撤销任何一笔
- 审计：每条 journal 记录带 sessionId，可追溯是哪个会话哪次对话干的

### 5.3 并发与 Obsidian 应用并行使用

- 写入前哈希对比天然处理「用户在 Obsidian 里改了我不知道」的情形
- append 语义无前置条件，天然并发安全
- 不抢锁、不监听文件：简单可靠，冲突交给 L1 显式报告

### 5.4 frontmatter 保护

- 合并策略（默认 merge）：保留所有未知键，只更新显式传入的键；
  删除键必须显式传 null 列表
- YAML 解析失败时不写，报错提示手工处理

### 5.5 性能防护

- vault 索引（文件名/首 H1/标签）懒构建 + 时间戳缓存，
  存 .dsh-obsidian/cache/；写操作后增量更新
- 搜索先走缓存索引，命中后按需读文件；全文搜索限制文件数上限

---

## 6. 设置页 UX（client half）

设置 → Obsidian（沿用 dsh-mcp-manager 类设置页形式）：

- Vault：路径（自动发现列表 + 手动填写）＋ 测试读取
- 每日笔记：目录（默认 Daily）、日期格式（默认 YYYY-MM-DD）、daily 模板
- 模板目录（默认 Templates）
- 排除目录（可追加）
- 写策略：每次审批 / 本任务允许 / 自动（三档，默认每次审批）
- Journal 保留：天数 / 条数
- 变更历史面板：列表 + diff 预览 + 一键回滚（见 L4）

无外部 OAuth（纯本地文件），权限模型只依赖 dsh 本机文件权限。

---

## 7. Composer 集成（client half）

- 输入框输入 [[ 触发补全：模糊搜笔记标题（走 vault 索引），
  选中后插入 [[笔记名]] 文本
- 发送时若消息含双链，注入对应笔记的标题+首段作为引用上下文
  （可关闭；与官方 @file 类机制并存）
- 与现有 dsh-wikilink（2★）的关系：同类功能，但本插件的补全基于
  通道自身的索引且带引用注入；设计上声明共存（用户二选一），
  后续可与作者协商合并

---

## 8. Skills（随包分发，官方 skill seam）

> 2026-08 联网调研补充：Obsidian CEO（kepano）已发布官方 skills 包
> kepano/obsidian-skills（~17.7k★），覆盖 .md/.base/.canvas 的文件格式原语。
> 本插件的 skill 层与其**互操作而非重复**：若 vault/.claude/skills 已装
> kepano skills，本插件直接复用其格式原语；本插件只补 kepano 不做的
> 工作流层（见下）。

- daily 周报：读 7 篇 daily → 生成周报（模板+回链）
- 笔记原子化：长笔记拆分卡片 + 更新索引 + 断链检查
- MOC 维护：为主题生成/更新地图笔记
- 断链/孤儿治理：全库扫描 → 报告 → 修复（每步可审批）
- 文献卡片：读论文笔记 → 提炼卡片 → 双链到概念页

---

## 9. 分阶段计划

| 阶段 | 内容 | 验收标准 |
|---|---|---|
| M1 安全内核 + 写侧（本设计核心） | journal/回滚引擎、note_create/update/append/delete/batch、undo/history/rollback/restore、审批接入 | 任意写操作可 undo；冲突不覆盖；逃逸路径被拒（全部有单测） |
| M2 设置页 + 历史面板 | vault/策略配置、变更历史+一键回滚 UI | 浏览器里能配好 vault 并回滚一笔真实变更 |
| （M2 已实现，2026-08-14 提交 b7cf841；实机验收待 web 重启后执行） | settings.section 页（settingsScope 配置 + /obsidian RPC 历史面板） | 同左 |
| M3 daily/模板/图侧 | daily、templates、graph、moc | 按模板建卡、生成周报、断链报告可用 |
| M4 composer + skills + 文档 | [[ 补全、引用注入、5 个 skill、README/zh | 输入框补全可用；skill 走查通过 |

每阶段产物都是可安装 bundle（dsh plugin --profile web add 本地路径），
可在 127.0.0.1:3080 实际验收。

---

## 10. 测试策略

- 引擎单测（vitest，临时 vault fixture）：journal 原子性、回滚幂等、
  冲突检测、frontmatter 合并、路径逃逸（symlink）、批量 dry-run
- 集成：真实 dsh checkout 挂载插件跑工具调用（参考上游 tests 结构）
- 手动验收清单（安装到 web profile）：
  建/改/删/回滚各一遍、审批卡出现、历史面板可用、
  与 Obsidian 同时打开时改文件再让插件写（应冲突）

---

## 11. 风险与开放问题

| 风险 | 应对 |
|---|---|
| 与 dsh-obsidian-export 工具重复注册 | 依赖+接管注册+自动禁用旧行（见第 2 节） |
| dsh 版本漂移（官方几乎日更） | peerDeps 范围声明；跟 Adam 雷达兼容性检查 |
| 审批 UX 过重（每笔写都点头） | 三档策略 + 任务内允许；batch 一次审批整批 |
| 大 vault 性能 | 索引缓存 + 上限（见 5.5） |
| Obsidian 端重命名/移动笔记后双链失效 | 图工具暴露 broken 报告；未来可加别名表（alias 解析） |
| 官方未来原生支持 Obsidian | 本插件保持薄依赖上游 engine，被官方化则平滑退役 |
| vault 在同步盘（iCloud/坚果云）的文件竞态 | L1 哈希检查已覆盖大部分场景 |

开放问题（2026-08-14 更新）：
1. ✅ 包名/仓库归属已定：包名 dsh-obsidian-channel，仓库
   https://github.com/ShengenWu/dsh-obsidian-channel（本地 checkout 已从
   ~/code/dsh-obsidian 改名为 ~/code/dsh-obsidian-channel，2026-08-14；
   重装插件命令见 README）
2. ✅ 审批走官方 permission seam（ctx.approval）：M1 已实机验证 fail-closed
   路径（'never' 策略拒绝且 vault 零触碰）；审批卡 UI 待 'ask' 策略下真机复验
3. 是否需要 alias（Obsidian 别名）解析支持？（建议 M4 后置）

---

## 13. 竞品与生态参考（2026-08-14 联网调研）

### 13.1 市场全景（Obsidian ↔ AI agent 联动已很拥挤，但形态与我们不同）

| 阵营 | 代表项目 | 形态 | 与我们的关系 |
|---|---|---|---|
| MCP server（外部 agent 直连） | MarkusPfundstein/mcp-obsidian ~3.7k★（走 Local REST API）；StevenStavrakis/obsidian-mcp ~703★；cyanheads/obsidian-mcp-server ~516★（14 工具，wiki/frontmatter/daily 深度覆盖）；natestrong/obsidian-mcp（文件直连 + SQLite 索引，2025 年中后活动不明） | 独立进程 MCP server，配 Claude/Cursor/Codex | 可通过 dsh 官方 MCP client 使用，但无审批门/无回滚 UI/要自己管进程 |
| MCP + skills 组合 | bettyguo/obsidian_mcp（22 工具 + 7 个工作流 skills + 「round-trip 字节级安全」协议） | pipx 安装的 MCP + Claude Skills | 与我们的设计最接近，验证了工作流 skills 与 round-trip 安全的差异化价值 |
| MCP + git 回滚 | t-rhex/obsidian-mcp-server（npm: mcp-obsidian-vault，27 工具 + 每次写自动 git commit/push + 任务编排/决策日志） | 独立进程 MCP，git 同步做安全网 | git 自动提交是可借鉴的回滚补充方案（我们选 journal 为主，git 为可选增强） |
| Obsidian 应用内 MCP | cortex-mcp（HTTP :27182）、2233admin/obsidian-vault-bridge（WebSocket RPC） | 在 Obsidian 里跑 MCP server | 依赖 Obsidian 运行，与我们的「无 Obsidian 依赖」路线互补 |
| 官方 skills（非 MCP） | kepano/obsidian-skills ~17.7k★ | 文件格式原语 SKILL.md，文件直连 | 互操作对象（见第 8 节），不重复造 |
| Obsidian 应用内 AI | Smart Connections ~786k 装机、Copilot ~6k★、Khoj、Text Generator、BMO | 把 LLM 嵌进 Obsidian UI | 互补不竞争：他们管「在笔记里聊」，我们管「让 agent 干笔记的活」 |
| DeepSeek 模型 × Obsidian | sunnybluesea/deepseek-obsidian-plugin 等 | DeepSeek API 嵌进 Obsidian 侧边栏 | 与 dsh 无关的另一类产品 |

### 13.2 对本设计的影响（三条采纳、一条坚持）

1. **采纳 round-trip 字节级安全**（bettyguo 验证过的差异化）：frontmatter/正文
   编辑必须 parse → mutate → re-serialize → 与原文 diff 校验，未改动的字节
   不得变化；做不到就拒绝写。这是 L1 的增强条款。
2. **采纳 git 自动提交作为可选增强**（t-rhex 模式）：M4+ 提供「每次写操作后
   自动 git commit（可关）」选项，作为 journal 之外的第二种回滚网络。
3. **采纳 kepano interop 策略**：skill 层复用 kepano/obsidian-skills 的格式
   原语，本插件只做工作流层（见第 8 节新增段落）。
4. **坚持我们的差异化**：以上竞品全部是「MCP 进程」形态，都需要用户自己
   配置和管进程；dsh 原生 bundle 的审批门（每次审批/任务内允许）、
   journal+Web 历史面板一键回滚、设置页免配置、中文生态分发，
   在 dsh 生态内依然无人提供。

### 13.3 结论

- 「Obsidian 联动」本身是成熟战场（10+ MCP server + 官方 skills），
  但「dsh 原生通道」仍是空白（dsh-plugin 主题下只有 7 个相关仓库，
  均为导出/补全/同步等单点，无写侧+审批+回滚）。
- 上游验证过的东西我们直接学（round-trip 安全、git 安全网、workflow
  skills），上游没做的东西（审批门、Web 回滚面板、bundle 免配置）
  是我们真正的差异化。

---

## 12. 交付物清单

- 可安装 bundle 包（host + client + patch + skills）
- 设计文档（本文档）
- 测试套件 + 手动验收清单
- README（中英）+ 安装/使用/安全说明

---

## 14. M1 实机验收记录（2026-08-14，rc.6 + 真实 vault）

实机安装（dsh plugin --profile web add 本地路径，node_modules 为符号链接直指
仓库，改代码后仅需重启 web 即生效）。验收 vault：/Users/shengen/obsidian。

### 14.1 已通过项

| 项 | 结果 |
|---|---|
| 10 个工具注册（本轮会话工具列表可见 obsidian_* 全家） | ✅ |
| 真实 vault 读取（fs seam 直连真库，frontmatter 解析成功） | ✅ |
| dryRun plan 预览：真实 vault、不触发审批、schema 校验通过 | ✅ |
| 真实写入 + 会话审批策略 'never' + writePolicy 'per-write' | ✅ fail-closed：返回 denied/rejected，vault 零触碰（无 journal、无 trash） |
| 路径越界拦截（../ 逃逸） | ✅（冒烟测试覆盖） |

### 14.2 发现并已修复的三个真机 bug（提交 0b45eb9）

教训：rc.6 harness 在工具调用层对返回结果做 output schema 运行时校验
（additionalProperties:false + 类型约束），而 stub-fs 冒烟测试直接调用编译后
的 execute，绕过了这一层——本机唯一能抓到这类 bug 的是实机调用。

1. **errTurn 的 code 字段未在 schema 声明** → 全部 10 个工具的错误路径都因
   `value.code is not a declared property` 被 harness 拒绝。修复：7 处 output
   schema 声明 `code: string`。
2. **可选字段返回 null**（read 无 H1/frontmatter 时 title/frontmatter=null；
   skip 的 opId=null；create 的 beforeHash=null；delete 的 afterHash=null）→
   `must be a string/object` 违规。修复：工具边界 cleanNulls() 剥离 null/undefined
   （journal 保留完整前像，不影响回滚）。
3. **computeNextText 的 update 分支硬编码 changed=true** → 字节相同的 update
   也会走审批并留一笔假 commit。修复：nextText !== current 比较。

测试加固：smoke.mjs 新增 output schema conformance 检查器（镜像 harness 校验
器），覆盖错误/拒绝/noop/null/skip 路径；engine.test.mjs 新增 changed 回归用例
（21/21 绿）。

### 14.3 待重启 web 后复验

- 错误路径返回干净的 {ok:false, code, message}（重启前仍是旧代码，会复现 bug）。
- 无 H1/无 frontmatter 的笔记读取（cleanNulls 后 title/frontmatter 省略）。
- 审批卡 UI：需用户把会话审批策略从 'never' 改回 'ask'（'never' 下所有请求
  直接拒绝——恰好已验证 fail-closed 路径）。
- 默认 vaultDir 配置持久化：随 M2 设置页交付；在此之前 agent 调用需显式传
  vaultDir（或由用户在 profile cordis.patch.yml 里写 id 覆盖）。

---

## 15. M2 实现记录（2026-08-14，提交 b7cf841）

### 15.1 接线全景（全部官方 seam，无 fork）

| 能力 | 机制 |
|---|---|
| 配置表单（host） | installSettingsSection：Config 注册为 'dsh-obsidian-channel' settings namespace，组合 entry 作 base 层；工具/审批适配器经 source thunk 按调用读取 → 设置页写入即时生效 |
| 配置读写（client） | ctx.settingsScope.bind → getSnapshot/subscribe/set（settings.mutate RPC 落盘 settings.yaml） |
| 历史面板数据通道 | ctx.connection.rpc.handle('/obsidian')（host，authority loopback）↔ ctx.connection.rpc.call（client）；端点 history/list · history/entry（before/after 全文）· history/rollback · vault/check |
| 面板回滚语义 | 直接执行不审批：ctx.approval 要求 agent + open turn，UI 点击两者皆无；按钮点击即用户授权，且回滚自身留痕可再撤 |
| 页面注册 | settings.section slot（id dsh-obsidian-channel，label 为 locale thunk）；zh/en 词典经 ctx.locale.register |
| client 打包 | tsdown → lib/client.js（CJS + window.__ModuleLoader__.load 契约；react/jsx-runtime external）；dsh.client {platform web} + exports[\"./client\"] 被发现 |

### 15.2 关键裁决（对照子代理调研）

- 数据通道选 ctx.connection.rpc.handle 而非 ctx.webServer 裸路由：前者是
  transport 级通用逻辑通道 seam（/api 频道本身即建于其上），自带 loopback
  信任栅与信封校验，代码更少。RpcMethodMap 封闭只影响 /api 域，不影响自建
  通道。
- rollback 不走 ctx.approval（见上）；writePolicy 只约束 agent 工具路径。
- 面板先落在设置页内（DESIGN §6 原案）；sidebar.footer.action 触发器留作后续。
