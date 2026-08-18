export type ObsidianKey =
  | 'nav.label'
  | 'page.title'
  | 'page.subtitle'
  | 'config.heading'
  | 'config.heading.library'
  | 'config.heading.libraryLead'
  | 'config.heading.write'
  | 'config.heading.writeLead'
  | 'config.heading.daily'
  | 'config.heading.dailyLead'
  | 'config.heading.home'
  | 'config.heading.homeLead'
  | 'config.vaultDir'
  | 'config.vaultDirHint'
  | 'config.vaultDirEmpty'
  | 'config.vaultPick'
  | 'config.vaultPickFailed'
  | 'config.retentionUnit'
  | 'config.writePolicy'
  | 'config.writePolicyHint'
  | 'config.writePolicy.perWrite'
  | 'config.writePolicy.perWriteHint'
  | 'config.writePolicy.perTurn'
  | 'config.writePolicy.perTurnHint'
  | 'config.writePolicy.auto'
  | 'config.writePolicy.autoHint'
  | 'config.excludes'
  | 'config.excludesHint'
  | 'config.retention'
  | 'config.retentionHint'
  | 'config.dailySource.obsidian'
  | 'config.dailySource.override'
  | 'config.dailySource.none'
  | 'config.testRead'
  | 'config.testRead.ok'
  | 'config.testRead.fail'
  | 'config.unavailable'
  | 'config.loading'
  | 'history.heading'
  | 'history.lead'
  | 'history.refresh'
  | 'history.empty'
  | 'history.entryCount'
  | 'history.rollback'
  | 'history.rollbackConfirm'
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
  | 'history.moved'
  | 'history.loadFailed'
  | 'history.sessionLabel'
  | 'history.closeDetail'
  | 'history.none'
  | 'history.truncated'
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
  | 'config.dailyFolderNeedVault'
  | 'config.dailyFolderOutside'
  | 'config.dailyFolderClear'
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
  | 'home.widgets'
  | 'home.widgetsHint'
  | 'home.widget.continue'
  | 'home.widget.continueHint'
  | 'home.widget.changes'
  | 'home.widget.changesHint'
  | 'home.widget.daily'
  | 'home.widget.dailyHint'
  | 'home.widget.search'
  | 'home.widget.searchHint'
  | 'home.widget.structure'
  | 'home.widget.structureHint'
  | 'home.widget.inbox'
  | 'home.widget.inboxHint'
  | 'home.widget.links'
  | 'home.widget.linksHint'
  | 'home.widget.actions'
  | 'home.widget.actionsHint'
  | 'home.size.s'
  | 'home.size.m'
  | 'home.size.l'
  | 'home.tile.menu'
  | 'home.arrange'
  | 'home.reserved'
  | 'home.actionsEmpty'
  | 'home.dailyNone'
  | 'home.dailyMissing'
  | 'home.daily.ask'
  | 'home.preview'
  | 'home.previewClose'
  | 'home.previewTruncated'
  | 'home.editorSave'
  | 'home.editorSaved'
  | 'home.editorSource'
  | 'home.editorRender'
  | 'home.editorDirty'
  | 'home.editorDiscard'
  | 'home.wikilinks'
  | 'home.tags'
  | 'home.linksHint'
  | 'home.searchPlaceholder'
  | 'home.searchEmpty'
  | 'home.searchNone'
  | 'home.searchRun'
  | 'home.orphans'
  | 'home.folders'
  | 'home.inboxEmpty'
  | 'home.detect'
  | 'home.detectNone'
  | 'home.detectHint'
  | 'home.detectOpen'
  | 'home.action.structure'
  | 'home.action.search'

export const NS = 'dsh-obsidian-channel'

export const zh: Record<ObsidianKey, string> = {
  'nav.label': 'Obsidian',
  'page.title': '知识库',
  'page.subtitle': '把Agent接到你的 Obsidian 库。在这里选择库在哪、改笔记前要不要问你，以及首页上显示哪些内容。',
  'config.heading': '基本设置',
  'config.heading.library': '绑定知识库',
  'config.heading.libraryLead': '告诉Agent你的笔记在哪。绑定后，Agent只会在这个库里读写。',
  'config.heading.write': '改笔记时',
  'config.heading.writeLead': 'Agent要改你的笔记时，要不要先停下来等你同意。',
  'config.heading.daily': '日记',
  'config.heading.dailyLead': '如果你用 Obsidian 写日记，可以在这里指定位置。没有这个习惯就留空。',
  'config.heading.home': '首页展示模块',
  'config.heading.homeLead': '勾选的板块会出现在库首页。页面顶部的标题和底部的提问框始终保留。',
  'config.vaultDir': '库的位置',
  'config.vaultDirHint': '填写本机 Obsidian 库的文件夹路径。也可以点「从本机查找」，从 Obsidian 已登记的库里选一个。',
  'config.vaultDirEmpty': '未选择',
  'config.vaultPick': '选择文件夹',
  'config.vaultPickFailed': '无法打开文件夹选择器：{error}',
  'config.retentionUnit': '天',
  'config.writePolicy': '改之前是否询问',
  'config.writePolicyHint': '选得越严，越不容易被改错；选得越松，Agent动手越快。',
  'config.writePolicy.perWrite': '每次都询问',
  'config.writePolicy.perWriteHint': 'Agent每改一篇笔记，都会先停下来等你同意。',
  'config.writePolicy.perTurn': '每个会话只询问一次',
  'config.writePolicy.perTurnHint': '你发一条消息后，Agent动手前问一次；同一条消息里改多篇不再重复问。',
  'config.writePolicy.auto': '不询问始终放行',
  'config.writePolicy.autoHint': 'Agent改完再告诉你。还不熟悉它时不建议选这项。',
  'config.excludes': 'Agent 不能进入的文件夹',
  'config.excludesHint': '留空则只排除回收站、Obsidian 配置和本插件记录。每行一个文件夹名。',
  'config.retention': '记录保留天数',
  'config.retentionHint': '过期后无法再撤回。',
  'config.dailySource.obsidian': 'Obsidian 里的日记设置',
  'config.dailySource.override': '本页填写的位置',
  'config.dailySource.none': '尚未指定',
  'config.testRead': '检查能否读取',
  'config.testRead.ok': '可以读取「{vault}」，顶层有 {n} 项',
  'config.testRead.fail': '现在读不到这个位置：{error}',
  'config.unavailable': '暂时读不到设置，请稍后再试。',
  'config.loading': '正在载入…',
  'history.heading': '修改记录',
  'history.lead': 'Agent改过的每一处都会记在这里。点开可以对比改前改后，也可以撤回。',
  'history.refresh': '刷新',
  'history.empty': '还没有修改记录。',
  'history.entryCount': '{n} 条记录',
  'history.rollback': '撤回这次修改',
  'history.rollbackConfirm': '撤回对「{path}」的这次修改？笔记会回到修改前的内容。',
  'history.rollbackDone': '已撤回：{message}',
  'history.rollbackFailed': '没能撤回：{message}',
  'history.detailTitle': '这次改了什么',
  'history.before': '修改前',
  'history.after': '修改后',
  'history.created': '新建',
  'history.updated': '更新',
  'history.appended': '追加',
  'history.deleted': '删除',
  'history.undone': '撤销',
  'history.restored': '恢复',
  'history.rolledBack': '撤回',
  'history.moved': '移动',
  'history.loadFailed': '现在读不到记录：{error}',
  'history.sessionLabel': '对话',
  'history.closeDetail': '关闭',
  'history.none': '没有内容',
  'history.truncated': '只显示开头部分',
  'panel.title': '库首页',
  'panel.close': '返回对话',
  'panel.unbound': '还没有绑定知识库',
  'panel.bindHeading': '绑定知识库',
  'panel.bindHint': '选择本机 Obsidian 库。',
  'panel.bind': '绑定',
  'panel.today': '今日日记',
  'panel.todayMissing': '今天的日记还不存在',
  'panel.todayMissingHint': '可按这个库已有的日记习惯创建',
  'panel.dailyHabit': '放在 {folder}，文件名按 {format}',
  'config.dailyFolder': '日记所在文件夹',
  'config.dailyFolderHint': '留空则沿用 Obsidian 的日记位置。',
  'config.dailyFolderNeedVault': '请先选择知识库。',
  'config.dailyFolderOutside': '请选择知识库内的文件夹。',
  'config.dailyFolderClear': '清除',
  'config.dailyFormat': '日记文件名的日期格式',
  'config.dailyFormatHint': '留空则沿用 Obsidian 的格式。',
  'config.dailyResolved': '按{source}，今天的日记是 {path}。',
  'panel.recent': '最近笔记',
  'panel.recentEmpty': '这个库里还没有笔记',
  'panel.noteCount': '{n} 篇',
  'panel.changes': '修改记录',
  'panel.changeCount': '{n} 条',
  'panel.broken': '失效链接',
  'panel.brokenNone': '没有发现失效链接',
  'panel.ask': '询问 Agent',
  'panel.send': '发送',
  'panel.composerPlaceholder': '说说你想对这个库做什么',
  'panel.prompt.read': '请阅读笔记 {path}，简要说明这篇在讲什么，然后等我的下一步。',
  'panel.prompt.todayMissing': '今天是 {date}。请创建或打开今日日记，路径必须是 {path}。',
  'panel.prompt.broken': '笔记 {from} 里有失效链接 [[{target}]]。请确认目标是否改名或移动，并给出修复建议。',
  'dash.kicker': 'Obsidian',
  'dash.stat.notes': '{n} 篇笔记',
  'dash.stat.changes': '{n} 条修改',
  'dash.stat.broken': '{n} 条失效链接',
  'dash.stat.todayOn': '今日已有',
  'dash.stat.todayOff': '今日未建',
  'dash.actions': '快捷指令',
  'dash.action.daily': '写今日日记',
  'dash.action.weekly': '本周回顾',
  'dash.action.broken': '检查失效链接',
  'panel.prompt.dailyWork': '今天是 {date}。请把今天的工作摘要写入今日日记 {path}。若该路径不存在则创建。完成后告诉我路径。',
  'panel.prompt.weekly': '请读取最近 7 天的日记，按这个库已有的周报习惯生成本周回顾。先给出提纲，确认后再写入。',
  'panel.prompt.brokenSweep': '请扫描本库的失效链接，先给出报告：来源笔记、目标、是否像改名或移动。不要直接修改，等我确认后再修。',
  'home.widgets': '要显示的板块',
  'home.widgetsHint': '关掉的板块不会出现在首页。随时可以再打开。',
  'home.widget.continue': '最近笔记',
  'home.widget.continueHint': '你最近改过的笔记，点开可以预览。',
  'home.widget.changes': '修改记录',
  'home.widget.changesHint': 'Agent 改过的笔记，可以撤回。',
  'home.widget.daily': '今日日记',
  'home.widget.dailyHint': '今天的日记。没有写日记的习惯就不用开。',
  'home.widget.search': '搜索',
  'home.widget.searchHint': '按关键词查找笔记。',
  'home.widget.structure': '文件夹与标签',
  'home.widget.structureHint': '库是怎么组织的，以及没有被任何笔记引用的篇目。',
  'home.widget.inbox': '待整理',
  'home.widget.inboxHint': '还堆在库根目录、没放进文件夹的笔记。',
  'home.widget.links': '失效链接',
  'home.widget.linksHint': '指向已经不存在的笔记的链接。附件引用有时会被误判。',
  'home.widget.actions': '快捷指令',
  'home.widget.actionsHint': '点一下，把常用任务填进底部提问框。不会自动发送。',
  'home.size.s': '小',
  'home.size.m': '中',
  'home.size.l': '大',
  'home.tile.menu': '设置',
  'home.arrange': '整理',
  'home.reserved': '这个板块暂时没有内容。',
  'home.actionsEmpty': '点一下填入提问框，不会发送。',
  'home.dailyNone': '未设置日记位置。',
  'home.dailyMissing': '今天的日记还不存在',
  'home.daily.ask': 'Agent',
  'home.preview': '预览',
  'home.previewClose': '关闭',
  'home.previewTruncated': '只显示开头部分',
  'home.editorSave': '保存',
  'home.editorSaved': '已保存',
  'home.editorSource': '源码',
  'home.editorRender': '预览',
  'home.editorDirty': '未保存',
  'home.editorDiscard': '有未保存的修改，关闭将丢弃。',
  'home.wikilinks': '指向',
  'home.tags': '标签',
  'home.linksHint': '附件引用可能被误判。',
  'home.searchPlaceholder': '按标题或正文查找',
  'home.searchEmpty': '输入关键词后查找。',
  'home.searchNone': '没有找到匹配的笔记',
  'home.searchRun': '查找',
  'home.orphans': '没有被引用',
  'home.folders': '文件夹',
  'home.inboxEmpty': '根目录没有未归档的笔记',
  'home.detect': '从本机查找',
  'home.detectNone': '本机 Obsidian 里没有找到已登记的库',
  'home.detectHint': '点选即可绑定。',
  'home.detectOpen': 'Obsidian 正在打开',
  'home.action.structure': '请概述这个库的结构',
  'home.action.search': '请在库中查找：',
}

export const en: Record<ObsidianKey, string> = {
  'nav.label': 'Obsidian',
  'page.title': 'Knowledge base',
  'page.subtitle': 'Connect the Agent to your Obsidian vault. Choose where the vault is, whether it must ask before editing, and what appears on the home page.',
  'config.heading': 'Settings',
  'config.heading.library': 'Connect a vault',
  'config.heading.libraryLead': 'Tell the Agent where your notes live. After you connect it, the Agent only reads and writes in this vault.',
  'config.heading.write': 'When notes change',
  'config.heading.writeLead': 'When the Agent wants to change a note, should it stop and wait for you first?',
  'config.heading.daily': 'Daily notes',
  'config.heading.dailyLead': 'If you keep a daily note in Obsidian, set its location here. Leave this empty if you do not.',
  'config.heading.home': 'Home modules',
  'config.heading.homeLead': 'Checked modules appear on the vault home. The title at the top and the question box at the bottom always stay.',
  'config.vaultDir': 'Vault location',
  'config.vaultDirHint': 'The folder of your Obsidian vault on this computer. Or choose one from the vaults Obsidian already knows.',
  'config.vaultDirEmpty': 'Not selected',
  'config.vaultPick': 'Choose folder',
  'config.vaultPickFailed': 'Could not open the folder picker: {error}',
  'config.retentionUnit': 'days',
  'config.writePolicy': 'Ask before changing notes',
  'config.writePolicyHint': 'Stricter choices are safer. Looser choices let the Agent move faster.',
  'config.writePolicy.perWrite': 'Ask every time',
  'config.writePolicy.perWriteHint': 'The Agent pauses for your OK before each note it changes.',
  'config.writePolicy.perTurn': 'Ask once per session',
  'config.writePolicy.perTurnHint': 'After you send one message, the Agent asks once, then may change several notes without asking again.',
  'config.writePolicy.auto': 'Never ask; always allow',
  'config.writePolicy.autoHint': 'The Agent changes notes, then tells you. Avoid this until you trust it.',
  'config.excludes': 'Folders the Agent must not enter',
  'config.excludesHint': 'Leave empty to exclude only Trash, Obsidian’s config, and this plugin’s records. One folder name per line.',
  'config.retention': 'Keep records for',
  'config.retentionHint': 'After this, those changes can no longer be undone.',
  'config.dailySource.obsidian': 'Obsidian’s daily-note setting',
  'config.dailySource.override': 'the location set on this page',
  'config.dailySource.none': 'not set',
  'config.testRead': 'Check that it can be read',
  'config.testRead.ok': 'Readable: “{vault}”, {n} items at the top level',
  'config.testRead.fail': 'Cannot read this location: {error}',
  'config.unavailable': 'Settings could not be loaded. Try again in a moment.',
  'config.loading': 'Loading…',
  'history.heading': 'Change records',
  'history.lead': 'Every change the Agent makes is listed here. Open one to compare before and after, or undo it.',
  'history.refresh': 'Refresh',
  'history.empty': 'No change records yet.',
  'history.entryCount': '{n} records',
  'history.rollback': 'Undo this change',
  'history.rollbackConfirm': 'Undo the change to “{path}”? The note will go back to how it was before.',
  'history.rollbackDone': 'Undone: {message}',
  'history.rollbackFailed': 'Could not undo: {message}',
  'history.detailTitle': 'What changed',
  'history.before': 'Before',
  'history.after': 'After',
  'history.created': 'created',
  'history.updated': 'updated',
  'history.appended': 'appended',
  'history.deleted': 'deleted',
  'history.undone': 'undone',
  'history.restored': 'restored',
  'history.rolledBack': 'undone',
  'history.moved': 'moved',
  'history.loadFailed': 'Could not load records: {error}',
  'history.sessionLabel': 'Conversation',
  'history.closeDetail': 'Close',
  'history.none': 'Nothing here',
  'history.truncated': 'Showing the beginning only',
  'panel.title': 'Vault home',
  'panel.close': 'Back to chat',
  'panel.unbound': 'No vault is connected yet',
  'panel.bindHeading': 'Connect a vault',
  'panel.bindHint': 'The folder of your Obsidian vault on this computer.',
  'panel.bind': 'Connect',
  'panel.today': 'Today’s note',
  'panel.todayMissing': 'Today’s note is not there yet',
  'panel.todayMissingHint': 'Create it using this vault’s daily-note habit',
  'panel.dailyHabit': 'In {folder}, filename uses {format}',
  'config.dailyFolder': 'Folder for daily notes',
  'config.dailyFolderHint': 'Leave empty to follow Obsidian’s daily-note location.',
  'config.dailyFolderNeedVault': 'Choose a vault first.',
  'config.dailyFolderOutside': 'Choose a folder inside the vault.',
  'config.dailyFolderClear': 'Clear',
  'config.dailyFormat': 'Date format in the daily-note filename',
  'config.dailyFormatHint': 'Leave empty to follow Obsidian’s format.',
  'config.dailyResolved': 'Today’s note is {path}, using {source}.',
  'panel.recent': 'Recent notes',
  'panel.recentEmpty': 'This vault has no notes yet',
  'panel.noteCount': '{n} notes',
  'panel.changes': 'Change records',
  'panel.changeCount': '{n}',
  'panel.broken': 'Broken links',
  'panel.brokenNone': 'No broken links found',
  'panel.ask': 'Ask',
  'panel.send': 'Send',
  'panel.composerPlaceholder': 'Describe what you want to do in this vault',
  'panel.prompt.read': 'Read the note at {path}, summarize it, then wait.',
  'panel.prompt.todayMissing': 'Today is {date}. Create or open the daily note at exactly {path}.',
  'panel.prompt.broken': 'Note {from} has a broken wikilink [[{target}]]. Check whether the target was renamed or moved, and suggest a fix.',
  'dash.kicker': 'Obsidian',
  'dash.stat.notes': '{n} notes',
  'dash.stat.changes': '{n} changes',
  'dash.stat.broken': '{n} broken',
  'dash.stat.todayOn': 'Daily exists',
  'dash.stat.todayOff': 'No daily yet',
  'dash.actions': 'Shortcuts',
  'dash.action.daily': 'Write today’s note',
  'dash.action.weekly': 'Weekly review',
  'dash.action.broken': 'Check broken links',
  'panel.prompt.dailyWork': 'Today is {date}. Write today’s work summary into the daily note at {path}. Create that path if it is missing. Tell me the path when done.',
  'panel.prompt.weekly': 'Read the last 7 daily notes and draft this week’s review in the vault’s existing weekly style. Outline first; write only after I confirm.',
  'panel.prompt.brokenSweep': 'Scan this vault for broken wikilinks. Report sources, targets, and likely renames or moves first. Do not edit until I confirm.',
  'home.widgets': 'Modules to show',
  'home.widgetsHint': 'Unchecked modules stay off the home page. You can turn them back on at any time.',
  'home.widget.continue': 'Recent notes',
  'home.widget.continueHint': 'Notes you changed recently. Open one to preview it.',
  'home.widget.changes': 'Change records',
  'home.widget.changesHint': 'Notes the Agent changed; you can undo them.',
  'home.widget.daily': 'Today’s note',
  'home.widget.dailyHint': 'Your daily note. Leave this off if you do not keep one.',
  'home.widget.search': 'Search',
  'home.widget.searchHint': 'Find notes by keyword.',
  'home.widget.structure': 'Folders and tags',
  'home.widget.structureHint': 'How the vault is organized, plus notes that nothing else links to.',
  'home.widget.inbox': 'Unfiled',
  'home.widget.inboxHint': 'Notes still sitting at the vault root, not in a folder.',
  'home.widget.links': 'Broken links',
  'home.widget.linksHint': 'Links that point to notes that are gone. Attachment references are sometimes counted by mistake.',
  'home.widget.actions': 'Shortcuts',
  'home.widget.actionsHint': 'Fills the question box at the bottom. Nothing is sent until you send it.',
  'home.size.s': 'S',
  'home.size.m': 'M',
  'home.size.l': 'L',
  'home.tile.menu': 'Settings',
  'home.arrange': 'Tidy',
  'home.reserved': 'This module has no content yet.',
  'home.actionsEmpty': 'A click fills the box below; nothing is sent.',
  'home.dailyNone': 'No daily-note location is set.',
  'home.dailyMissing': 'Today’s note is not there yet',
  'home.daily.ask': 'Agent',
  'home.preview': 'Preview',
  'home.previewClose': 'Close',
  'home.previewTruncated': 'Showing the beginning only',
  'home.editorSave': 'Save',
  'home.editorSaved': 'Saved',
  'home.editorSource': 'Source',
  'home.editorRender': 'Preview',
  'home.editorDirty': 'Unsaved',
  'home.editorDiscard': 'There are unsaved changes. Close and discard them?',
  'home.wikilinks': 'Links to',
  'home.tags': 'Tags',
  'home.linksHint': 'Attachment references may be counted by mistake.',
  'home.searchPlaceholder': 'Search titles or body',
  'home.searchEmpty': 'Enter a keyword to search.',
  'home.searchNone': 'No matching notes',
  'home.searchRun': 'Search',
  'home.orphans': 'Not linked',
  'home.folders': 'Folders',
  'home.inboxEmpty': 'No unfiled notes at the vault root',
  'home.detect': 'Find on this computer',
  'home.detectNone': 'No vaults were found in Obsidian on this computer',
  'home.detectHint': 'Select one to connect it.',
  'home.detectOpen': 'Open in Obsidian',
  'home.action.structure': 'Summarize the structure of this vault',
  'home.action.search': 'Search the vault for: ',
}
