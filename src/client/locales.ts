export type ObsidianKey =
  | 'nav.label'
  | 'page.title'
  | 'page.subtitle'
  | 'config.heading'
  | 'config.vaultDir'
  | 'config.vaultDirHint'
  | 'config.writePolicy'
  | 'config.writePolicy.perWrite'
  | 'config.writePolicy.perTurn'
  | 'config.writePolicy.auto'
  | 'config.excludes'
  | 'config.excludesHint'
  | 'config.retention'
  | 'config.testRead'
  | 'config.testRead.ok'
  | 'config.testRead.fail'
  | 'config.unavailable'
  | 'config.loading'
  | 'history.heading'
  | 'history.refresh'
  | 'history.empty'
  | 'history.entryCount'
  | 'history.rollback'
  | 'history.rollbackDone'
  | 'history.rollbackFailed'
  | 'history.detailTitle'
  | 'history.before'
  | 'history.after'
  | 'history.created'
  | 'history.updated'
  | 'history.appended'
  | 'history.deleted'
  | 'history.undone'
  | 'history.restored'
  | 'history.rolledBack'
  | 'history.loadFailed'
  | 'history.sessionLabel'
  | 'history.closeDetail'
  | 'panel.title'
  | 'panel.close'
  | 'panel.unbound'
  | 'panel.bindHeading'
  | 'panel.bindHint'
  | 'panel.bind'
  | 'panel.today'
  | 'panel.todayMissing'
  | 'panel.todayMissingHint'
  | 'panel.dailyHabit'
  | 'config.dailyFolder'
  | 'config.dailyFolderHint'
  | 'config.dailyFormat'
  | 'config.dailyFormatHint'
  | 'config.dailyResolved'
  | 'panel.recent'
  | 'panel.recentEmpty'
  | 'panel.noteCount'
  | 'panel.changes'
  | 'panel.changeCount'
  | 'panel.broken'
  | 'panel.brokenNone'
  | 'panel.ask'
  | 'panel.send'
  | 'panel.composerPlaceholder'
  | 'panel.prompt.read'
  | 'panel.prompt.todayMissing'
  | 'panel.prompt.broken'
  | 'dash.kicker'
  | 'dash.stat.notes'
  | 'dash.stat.changes'
  | 'dash.stat.broken'
  | 'dash.stat.todayOn'
  | 'dash.stat.todayOff'
  | 'dash.actions'
  | 'dash.action.daily'
  | 'dash.action.weekly'
  | 'dash.action.broken'
  | 'panel.prompt.dailyWork'
  | 'panel.prompt.weekly'
  | 'panel.prompt.brokenSweep'

export const NS = 'dsh-obsidian-channel'

export const zh: Record<ObsidianKey, string> = {
  'nav.label': 'Obsidian',
  'page.title': 'Obsidian vault 通道',
  'page.subtitle': '配置 vault 与写入审批策略；下方是本插件的全部变更记录，可逐笔回滚（回滚本身也会留痕）。',
  'config.heading': '配置',
  'config.vaultDir': 'Vault 根目录',
  'config.vaultDirHint': '绝对路径，例如 /Users/me/obsidian。留空时 agent 每次调用需显式传 vaultDir。',
  'config.writePolicy': '写入审批策略',
  'config.writePolicy.perWrite': '每次审批（默认，最安全）',
  'config.writePolicy.perTurn': '本任务内允许（同一任务同类写免重复审批）',
  'config.writePolicy.auto': '自动（不审批，不建议）',
  'config.excludes': '排除目录（每行一个）',
  'config.excludesHint': '额外禁止 agent 访问的目录名；内置名单 .obsidian / .git / .dsh-obsidian / .trash 始终生效。',
  'config.retention': 'journal 保留天数',
  'config.testRead': '测试读取',
  'config.testRead.ok': '可读：{vault}（顶层 {n} 项）',
  'config.testRead.fail': '不可读：{error}',
  'config.unavailable': '配置通道不可用（连接未就绪或部署无 settings 服务）。',
  'config.loading': '配置加载中…',
  'history.heading': '变更历史',
  'history.refresh': '刷新',
  'history.empty': '暂无变更记录（先用 agent 做一次写入）。',
  'history.entryCount': '共 {n} 条记录',
  'history.rollback': '回滚此变更',
  'history.rollbackDone': '已回滚：{message}',
  'history.rollbackFailed': '回滚失败：{message}',
  'history.detailTitle': '变更详情',
  'history.before': '变更前',
  'history.after': '变更后',
  'history.created': '新建',
  'history.updated': '更新',
  'history.appended': '追加',
  'history.deleted': '删除',
  'history.undone': '撤销',
  'history.restored': '恢复',
  'history.rolledBack': '回滚',
  'history.loadFailed': '加载失败：{error}',
  'history.sessionLabel': '会话',
  'history.closeDetail': '关闭详情',
  'panel.title': '库首页',
  'panel.close': '回到对话',
  'panel.unbound': '还没有绑定 vault',
  'panel.bindHeading': '绑定你的库',
  'panel.bindHint': '填本地 Obsidian vault 的绝对路径。绑定后点侧边栏就会打开这个面，不会新建工作区。',
  'panel.bind': '绑定',
  'panel.today': '今日',
  'panel.todayMissing': '还没有今日笔记',
  'panel.todayMissingHint': '让 agent 按库里已有的日记习惯创建',
  'panel.dailyHabit': '日记：{folder} · {format}',
  'config.dailyFolder': '每日笔记目录（可选覆盖）',
  'config.dailyFolderHint': '留空则读取 .obsidian/daily-notes.json 的 folder。',
  'config.dailyFormat': '每日笔记日期格式（可选覆盖）',
  'config.dailyFormatHint': 'Moment 记号，例如 MM-DD-YYYY。留空则读取 Obsidian 设置。',
  'config.dailyResolved': '当前生效：{path}（来源 {source}）',
  'panel.recent': '最近',
  'panel.recentEmpty': '库里还没有笔记',
  'panel.noteCount': '共 {n} 篇',
  'panel.changes': '本库变更',
  'panel.changeCount': '{n} 条',
  'panel.broken': '断链',
  'panel.brokenNone': '没有发现断链',
  'panel.ask': '问 agent',
  'panel.send': '发送',
  'panel.composerPlaceholder': '问问 agent 关于这个库…',
  'panel.prompt.read': '请阅读笔记 {path}，简要说明这篇在讲什么，然后等我的下一步。',
  'panel.prompt.todayMissing': '今天是 {date}。请创建或打开今日日记，路径必须是 {path}。',
  'panel.prompt.broken': '笔记 {from} 里有断链 [[{target}]]。请确认目标是否改名或移动，并给出修复建议。',
  'dash.kicker': 'Obsidian',
  'dash.stat.notes': '{n} 篇笔记',
  'dash.stat.changes': '{n} 条变更',
  'dash.stat.broken': '{n} 条断链',
  'dash.stat.todayOn': '今日已有',
  'dash.stat.todayOff': '今日未建',
  'dash.actions': '快捷操作',
  'dash.action.daily': '写今日日记',
  'dash.action.weekly': '本周周报',
  'dash.action.broken': '修断链',
  'panel.prompt.dailyWork': '今天是 {date}。请把今天的工作内容摘要写入今日日记 {path}（没有就按这个路径创建）。写完告诉我路径。',
  'panel.prompt.weekly': '请读取最近 7 天的日记，按这个库已有的周报习惯生成本周周报并写入 vault。先给提纲，确认后再落盘。',
  'panel.prompt.brokenSweep': '请扫描本库断链，先给出报告（来源笔记、目标、是否像改名/移动），不要直接改。等我确认后再修。',
}

export const en: Record<ObsidianKey, string> = {
  'nav.label': 'Obsidian',
  'page.title': 'Obsidian vault channel',
  'page.subtitle': 'Configure the vault and write-approval policy. Below is the full change journal — every entry can be rolled back (rollbacks are themselves journaled).',
  'config.heading': 'Configuration',
  'config.vaultDir': 'Vault root directory',
  'config.vaultDirHint': 'Absolute path, e.g. /Users/me/obsidian. When empty, the agent must pass vaultDir on every tool call.',
  'config.writePolicy': 'Write approval policy',
  'config.writePolicy.perWrite': 'Every write asks (default, safest)',
  'config.writePolicy.perTurn': 'Allow for this task (same tool re-approved per task)',
  'config.writePolicy.auto': 'Auto (no prompts, not recommended)',
  'config.excludes': 'Excluded directories (one per line)',
  'config.excludesHint': 'Extra directory names the agent may not touch; the built-in list .obsidian / .git / .dsh-obsidian / .trash always applies.',
  'config.retention': 'Journal retention (days)',
  'config.testRead': 'Test read',
  'config.testRead.ok': 'Readable: {vault} ({n} top-level entries)',
  'config.testRead.fail': 'Not readable: {error}',
  'config.unavailable': 'Configuration channel unavailable (connection not ready or no settings service).',
  'config.loading': 'Loading configuration…',
  'history.heading': 'Change history',
  'history.refresh': 'Refresh',
  'history.empty': 'No changes yet (make a write with the agent first).',
  'history.entryCount': '{n} entries',
  'history.rollback': 'Roll back this change',
  'history.rollbackDone': 'Rolled back: {message}',
  'history.rollbackFailed': 'Rollback failed: {message}',
  'history.detailTitle': 'Change detail',
  'history.before': 'Before',
  'history.after': 'After',
  'history.created': 'create',
  'history.updated': 'update',
  'history.appended': 'append',
  'history.deleted': 'delete',
  'history.undone': 'undo',
  'history.restored': 'restore',
  'history.rolledBack': 'rollback',
  'history.loadFailed': 'Load failed: {error}',
  'history.sessionLabel': 'Session',
  'history.closeDetail': 'Close detail',
  'panel.title': 'Vault home',
  'panel.close': 'Back to chat',
  'panel.unbound': 'No vault bound yet',
  'panel.bindHeading': 'Bind your vault',
  'panel.bindHint': 'Absolute path to the local Obsidian vault. The sidebar button opens this surface — it does not create a workspace.',
  'panel.bind': 'Bind',
  'panel.today': 'Today',
  'panel.todayMissing': 'No daily note for today',
  'panel.todayMissingHint': 'Ask the agent to create one using this vault’s daily habit',
  'panel.dailyHabit': 'Daily: {folder} · {format}',
  'config.dailyFolder': 'Daily-note folder (optional override)',
  'config.dailyFolderHint': 'Leave empty to read folder from .obsidian/daily-notes.json.',
  'config.dailyFormat': 'Daily-note date format (optional override)',
  'config.dailyFormatHint': 'Moment tokens, e.g. MM-DD-YYYY. Leave empty to read Obsidian settings.',
  'config.dailyResolved': 'Resolved: {path} (from {source})',
  'panel.recent': 'Recent',
  'panel.recentEmpty': 'No notes in the vault yet',
  'panel.noteCount': '{n} notes',
  'panel.changes': 'Vault changes',
  'panel.changeCount': '{n}',
  'panel.broken': 'Broken links',
  'panel.brokenNone': 'No broken links found',
  'panel.ask': 'Ask',
  'panel.send': 'Send',
  'panel.composerPlaceholder': 'Ask the agent about this vault…',
  'panel.prompt.read': 'Read the note at {path}, summarize it, then wait.',
  'panel.prompt.todayMissing': 'Today is {date}. Create or open the daily note at exactly {path}.',
  'panel.prompt.broken': 'Note {from} has a broken wikilink [[{target}]]. Check whether the target was renamed or moved, and suggest a fix.',
  'dash.kicker': 'Obsidian',
  'dash.stat.notes': '{n} notes',
  'dash.stat.changes': '{n} changes',
  'dash.stat.broken': '{n} broken',
  'dash.stat.todayOn': 'Daily exists',
  'dash.stat.todayOff': 'No daily yet',
  'dash.actions': 'Quick actions',
  'dash.action.daily': 'Write today',
  'dash.action.weekly': 'Weekly review',
  'dash.action.broken': 'Fix links',
  'panel.prompt.dailyWork': 'Today is {date}. Write today’s work summary into the daily note at {path} (create that exact path if missing). Tell me the path when done.',
  'panel.prompt.weekly': 'Read the last 7 daily notes and draft this week’s review in the vault’s existing weekly style. Outline first; write only after I confirm.',
  'panel.prompt.brokenSweep': 'Scan this vault for broken wikilinks. Report sources and likely renames/moves first. Do not edit until I confirm.',
}
