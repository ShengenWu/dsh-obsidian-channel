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
}
