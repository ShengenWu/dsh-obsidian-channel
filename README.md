# dsh-obsidian-channel

DeepSeek Harness (DSH) 插件：把 Obsidian vault 变成 agent 可安全写入的知识库。

M1：安全内核 + 写侧 + 回滚 —— 所有写操作有审批门、有变更日志
（journal）、可字节级回滚；冲突时永不静默覆盖。

M2：设置页 + 变更历史面板 —— Web 设置页（Settings → Obsidian）里配置 vault
与审批策略（写后即时生效，落盘重启不丢），变更历史面板逐笔看 before→after
diff、一键回滚（回滚本身也留痕，可再撤）。

## 能力（M1）

| 工具 | 作用 |
|---|---|
| obsidian_read | 读笔记：frontmatter/首 H1/标签/双链/正文 + version 令牌（供守卫更新） |
| obsidian_note_create | 新建笔记（目标已存在则冲突；支持 frontmatter） |
| obsidian_note_update | 整体替换或外科式 frontmatter 编辑（未提及的字节原样保留）；带 baseVersion 守卫 |
| obsidian_note_append | 末尾追加 / 按 section 锚点插入 |
| obsidian_note_delete | 删除=移入 .dsh-obsidian/trash（永不 unlink） |
| obsidian_batch | 顺序批量变更；dry-run 投影完整计划 |
| obsidian_history | 变更日志（opId/路径/动作/时间/会话） |
| obsidian_undo / obsidian_rollback / obsidian_restore | 字节级回滚与恢复（回滚本身也留痕，可再撤） |

## 安全模型（五层）

- L0 范围边界：路径 sanitize（拒绝 ../、绝对路径、隐藏、坏字符）、vault 外
  拒绝、符号链接拒绝、排除目录（.obsidian/.git/.dsh-obsidian/.trash + 可配）
- L1 永不静默覆盖：update 必须带 version 令牌（或最近一次 stat），文件
  变了 → conflict 报告，不写；删除永远走 trash
- L2 写入审批：走官方 ctx.approval 接缝（fail-closed）。
  策略 writePolicy：per-write（默认）/ per-turn / auto
- L3 journal：每次写操作前落 planned 条目（含 before 全文快照），成功后
  转 done；保留 30 天可配
- L4 回滚：undo/rollback 恢复 before 字节级快照；并发改动冲突时拒绝
  （绝不覆盖他人修改）；restore 从 trash 恢复

## 安装

    dsh plugin --profile web add <本仓库路径或 git 地址>

然后重启 dsh web。

**M2 图形设置**：打开 Settings → Obsidian 页，直接配置 Vault 根目录、
写入审批策略、排除目录、journal 保留天数（写后即时生效；完整配置表单
同时出现在 Settings → Plugins → dsh-obsidian-channel）。同一页面下方即
「变更历史」面板：按时间倒序列出每笔变更，点击展开 before→after diff，
一键回滚。

无图形界面时也可用 cordis 配置：

    - id: dsh-obsidian-channel
      config:
        vaultDir: /path/to/your/vault
        writePolicy: per-write   # per-write | per-turn | auto
        excludes: []
        journalRetentionDays: 30

## 开发与测试

    node --test tests/engine.test.mjs   # 21 个安全内核单测（内存 fs，无依赖）
    node tests/smoke.mjs               # 真实 rc.6 dsh-tools/schemastery 全链路冒烟
                                       # （含 M2 settings/RPC 接线断言；需先按
                                       #   scripts/link-runtime.sh 建立符号链接）
    npm run build                      # 构建 client 半（tsdown → lib/client.js）

client 半是官方 bundle client 通道（package.json 的 dsh.client +
exports["./client"]，产物 lib/client.js，运行时经 window.__ModuleLoader__
加载）；host 半纯 JS 零构建。

## 与 dsh-obsidian-export 的关系

上游插件提供读侧六件套 + 会话导出（本插件 peerDependency 声明，未来阶段
接管注册避免重复）。本插件 M1 只做写侧与回滚；obsidian_read 额外返回
version 令牌，是守卫写操作的前提。

## 路线图

- M1 ✅ 安全内核 + 写侧 + 回滚
- M2 ✅ 设置页 + 变更历史面板（Settings → Obsidian；diff + 一键回滚）
- M3 daily/模板/图侧（断链/孤儿/MOC）
- M4 composer 双链补全 + 知识工作流 skills

## 许可

MIT
