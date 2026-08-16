window.__ModuleLoader__.load({
	id: "dsh-obsidian-channel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom_client = require("react-dom/client");
		//#region src/client/controller.ts
		var PanelController = class {
			panelOpen = false;
			listeners = /* @__PURE__ */ new Set();
			getSnapshot() {
				return { panelOpen: this.panelOpen };
			}
			subscribe(fn) {
				this.listeners.add(fn);
				return () => {
					this.listeners.delete(fn);
				};
			}
			open() {
				if (this.panelOpen) return;
				this.panelOpen = true;
				this.notify();
			}
			close() {
				if (!this.panelOpen) return;
				this.panelOpen = false;
				this.notify();
			}
			toggle() {
				if (this.panelOpen) this.close();
				else this.open();
			}
			notify() {
				for (const fn of [...this.listeners]) fn();
			}
		};
		//#endregion
		//#region src/client/styles.ts
		/**
		* Injected styles for the sidebar entry and the center-column Obsidian
		* surface. Attribute-scoped so nothing leaks; colors ride --dsw-* tokens.
		*/
		const STYLE_ID = "dsh-obsidian-ui-style";
		const CSS = [
			"[data-dsh-obsidian-entry]{display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 12px;border-radius:8px;background:transparent;border:none;color:var(--dsw-alias-label-secondary,inherit);cursor:pointer;font:inherit;font-size:13px;white-space:nowrap}",
			"[data-dsh-obsidian-entry]:hover{background:var(--dsw-specific-sidebar-nav-item-hover,rgba(128,128,140,.12));color:var(--dsw-alias-label-primary,inherit)}",
			"[data-dsh-obsidian-entry][data-active]{background:var(--dsw-specific-sidebar-nav-item-active,rgba(167,139,250,.18));color:var(--dsw-alias-label-primary,inherit);font-weight:600}",
			"[data-dsh-obsidian-entry] .entryIcon{display:inline-flex;align-items:center;justify-content:center;flex:none;color:var(--dsw-alias-text-accent,#a78bfa)}",
			"[data-dsh-obsidian-entry] .entryLabel{flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis}",
			"[data-dsh-frame][data-sidebar-collapsed] [data-dsh-obsidian-entry]{justify-content:center;padding:0}",
			"[data-dsh-frame][data-sidebar-collapsed] [data-dsh-obsidian-entry] .entryLabel{display:none}",
			"[data-pane=\"conversation\"],[class*=\"centerCol\"]{position:relative}",
			"[data-dsh-obsidian-view]{position:absolute;inset:0;display:none;z-index:61;background:var(--dsw-alias-bg-base,#111);color:var(--dsw-alias-label-primary,inherit)}",
			"html[data-dsh-obsidian-active] [data-dsh-obsidian-view]{display:block}",
			"html[data-dsh-obsidian-active] [data-pane=\"conversation\"]>:not([data-dsh-obsidian-view]),html[data-dsh-obsidian-active] [class*=\"centerCol\"]>:not([data-dsh-obsidian-view]){display:none!important}",
			"html[data-dsh-obsidian-active] [data-dsh-taskboard-view],html[data-dsh-obsidian-active] [data-dsh-ssh-view]{display:none!important}",
			"[data-dsh-obsidian-view] .ob-surface{display:flex;flex-direction:column;height:100%;min-height:0;padding:18px 22px 16px;gap:14px;box-sizing:border-box;font-family:var(--dsw-font-family,inherit)}",
			"[data-dsh-obsidian-view] .ob-kicker{margin:0 0 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-text-accent,#a78bfa);opacity:.9}",
			"[data-dsh-obsidian-view] .ob-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex:none}",
			"[data-dsh-obsidian-view] .ob-title{margin:0;font-size:22px;font-weight:700;letter-spacing:-.02em}",
			"[data-dsh-obsidian-view] .ob-sub{margin:4px 0 0;font-size:12px;opacity:.6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:52vw}",
			"[data-dsh-obsidian-view] .ob-actions{display:flex;gap:8px;flex:none}",
			"[data-dsh-obsidian-view] .ob-btn{padding:5px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,140,.4));background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:13px}",
			"[data-dsh-obsidian-view] .ob-btn:disabled{opacity:.5;cursor:default}",
			"[data-dsh-obsidian-view] .ob-btn.primary{border-color:var(--dsw-alias-text-accent,#a78bfa);color:var(--dsw-alias-text-accent,#a78bfa)}",
			"[data-dsh-obsidian-view] .ob-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;flex:none}",
			"[data-dsh-obsidian-view] .ob-stat{padding:10px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,140,.22));background:var(--dsw-alias-bg-layer-2,rgba(128,128,140,.06))}",
			"[data-dsh-obsidian-view] .ob-stat .n{display:block;font-size:16px;font-weight:700;line-height:1.2}",
			"[data-dsh-obsidian-view] .ob-stat .l{display:block;margin-top:2px;font-size:11px;opacity:.55}",
			"[data-dsh-obsidian-view] .ob-stat.warn .n{color:#f0b429}",
			"[data-dsh-obsidian-view] .ob-quick{display:flex;flex-wrap:wrap;gap:8px;align-items:center;flex:none}",
			"[data-dsh-obsidian-view] .ob-quick-label{font-size:12px;opacity:.55;margin-right:4px}",
			"[data-dsh-obsidian-view] .ob-chip{padding:6px 12px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,140,.35));background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:13px}",
			"[data-dsh-obsidian-view] .ob-chip:hover{border-color:var(--dsw-alias-text-accent,#a78bfa);color:var(--dsw-alias-text-accent,#a78bfa)}",
			"[data-dsh-obsidian-view] .ob-body{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);grid-auto-rows:auto;gap:12px;flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;align-content:start}",
			"[data-dsh-obsidian-view] .ob-card{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,140,.22));border-radius:12px;background:var(--dsw-alias-bg-layer-2,transparent);min-width:0}",
			"[data-dsh-obsidian-view] .ob-card.span2{grid-column:1/-1}",
			"[data-dsh-obsidian-view] .ob-card-h{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;font-weight:600;line-height:1.55;min-width:0}",
			"[data-dsh-obsidian-view] .ob-card-h>span:first-child{flex:none}",
			"[data-dsh-obsidian-view] .ob-count{font-weight:500;opacity:.65;font-size:12px;line-height:1.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
			"[data-dsh-obsidian-view] .ob-hint{font-size:12px;line-height:1.55;opacity:.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			"[data-dsh-obsidian-view] .ob-msg{font-size:12px}",
			"[data-dsh-obsidian-view] .ob-msg.err{color:#ff6b6b}",
			"[data-dsh-obsidian-view] .ob-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px;border-radius:8px;cursor:pointer;border:1px solid transparent;min-width:0}",
			"[data-dsh-obsidian-view] .ob-row:hover{background:rgba(128,128,140,.08);border-color:rgba(128,128,140,.18)}",
			"[data-dsh-obsidian-view] .ob-row .main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}",
			"[data-dsh-obsidian-view] .ob-row .path{font-size:13px;line-height:1.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}",
			"[data-dsh-obsidian-view] .ob-row .meta{font-size:11px;line-height:1.55;opacity:.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}",
			"[data-dsh-obsidian-view] .ob-stat{min-width:0}",
			"[data-dsh-obsidian-view] .ob-stat .n{line-height:1.45;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			"[data-dsh-obsidian-view] .ob-stat .l{line-height:1.45;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			"[data-dsh-obsidian-view] .ob-badge{flex:none;font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid rgba(128,128,140,.4)}",
			"[data-dsh-obsidian-view] .ob-link{flex:none;font-size:12px;opacity:.75;background:none;border:none;color:var(--dsw-alias-text-accent,#a78bfa);cursor:pointer;padding:0}",
			"[data-dsh-obsidian-view] .ob-input,[data-dsh-obsidian-view] .ob-area{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,140,.35));background:var(--dsw-specific-input-major,transparent);color:inherit;font:inherit;font-size:13px}",
			"[data-dsh-obsidian-view] .ob-composer{display:flex;gap:8px;align-items:flex-end;flex:none;padding-top:4px;border-top:1px solid var(--dsw-alias-border-l1,rgba(128,128,140,.18))}",
			"[data-dsh-obsidian-view] .ob-composer .ob-area{flex:1;min-height:52px;resize:vertical}",
			"@media (max-width:900px){[data-dsh-obsidian-view] .ob-stats{grid-template-columns:repeat(2,minmax(0,1fr))}[data-dsh-obsidian-view] .ob-body{grid-template-columns:1fr}}",
			"[data-dsh-obsidian-view] .ob-diff{display:flex;flex-direction:column;border:1px solid rgba(128,128,140,.22);border-radius:8px;overflow:hidden;max-height:240px}",
			"[data-dsh-obsidian-view] .ob-diff .pane{display:flex;overflow:auto}",
			"[data-dsh-obsidian-view] .ob-diff .col{flex:1;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.45;white-space:pre-wrap;word-break:break-all;padding:6px 10px}",
			"[data-dsh-obsidian-view] .ob-diff .col+.col{border-left:1px solid rgba(128,128,140,.2)}",
			"[data-dsh-obsidian-view] .ob-diff .pane-head{padding:6px 10px;font-size:11px;opacity:.65;border-bottom:1px solid rgba(128,128,140,.2)}",
			"[data-dsh-obsidian-view] .ob-diff .del{background:rgba(255,107,107,.12);color:#ff6b6b}",
			"[data-dsh-obsidian-view] .ob-diff .add{background:rgba(81,200,138,.12);color:#51c88a}"
		].join("\n");
		/** Seat the stylesheet once per page. */
		function seatStyles() {
			if (typeof document === "undefined") return;
			if (document.getElementById(STYLE_ID) !== null) return;
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = CSS;
			document.head.appendChild(style);
		}
		/** Inline icon (a flat Obsidian-style rhombus outline, matching the shell's 16px nav-icon look). */
		const ICON = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.5 14.5 8 8 14.5 1.5 8Z"/></svg>`;
		const LABEL = "Obsidian";
		/** Find the sidebar shell root element, or undefined while not yet mounted. */
		function sidebarRoot() {
			const column = document.querySelector("[data-pane=\"sidebar\"], [class*=\"sidebarCol\"]");
			if (column === null) return void 0;
			return column.querySelector("[class*=\"logoRow\"]")?.parentElement ?? column.firstElementChild;
		}
		/** The New Session button row (nested in the logo row on current shells). */
		function newSessionButton(root) {
			const nested = root.querySelector("button[class*=\"newSession\"]");
			if (nested !== null) return nested;
			for (const child of root.children) if (child.tagName === "BUTTON") return child;
		}
		/** The family block of plugin entries (ours + task-board + ssh). */
		function familyBlock(root) {
			return Array.from(root.children).filter((el) => el instanceof HTMLElement && el.matches("[data-dsh-taskboard-entry], [data-dsh-ssh-entry], [data-dsh-obsidian-entry]"));
		}
		/** Build the entry row (a detached button; insert once the shell is up). */
		function createEntry(onClick) {
			const entry = document.createElement("button");
			entry.type = "button";
			entry.dataset.dshObsidianEntry = "";
			entry.setAttribute("aria-label", LABEL);
			entry.innerHTML = `<span class="entryIcon">${ICON}</span><span class="entryLabel">${LABEL}</span>`;
			entry.addEventListener("click", onClick);
			return entry;
		}
		/** Insert the entry after the last family member (stable sibling order). */
		function placeEntry(root, entry) {
			const button = newSessionButton(root);
			if (button === void 0) return false;
			if (entry.parentElement !== root) {
				const row = button.closest("[class*=\"logoRow\"]");
				const base = row !== null && row.parentElement === root ? row : button;
				const family = familyBlock(root);
				const anchor = family.length > 0 ? family[family.length - 1]?.nextElementSibling ?? null : base.nextElementSibling;
				root.insertBefore(entry, anchor);
			}
			return true;
		}
		/**
		* Mount the Obsidian sidebar entry. Clicking toggles the center-column surface.
		*
		* @param controller - the panel controller the entry toggles.
		* @returns disposer removing the entry and its observers.
		*/
		function mountObsidianEntry(controller) {
			seatStyles();
			if (typeof document !== "undefined" && document.querySelector("[data-dsh-obsidian-entry]") !== null) return () => {};
			const entry = createEntry(() => {
				controller.toggle();
			});
			let root;
			let placed = false;
			let rootObserver;
			const tryPlace = () => {
				if (root !== void 0 && !root.isConnected) {
					rootObserver?.disconnect();
					root = void 0;
					placed = false;
				}
				if (placed) {
					if (document.body.contains(entry)) return;
					rootObserver?.disconnect();
					root = void 0;
					placed = false;
				}
				root ??= sidebarRoot();
				if (root === void 0) return;
				placed = placeEntry(root, entry);
				if (placed && rootObserver === void 0) {
					rootObserver = new MutationObserver(() => {
						if (root === void 0 || !root.isConnected) {
							placed = false;
							tryPlace();
							return;
						}
						if (!root.contains(entry)) placed = placeEntry(root, entry);
					});
					rootObserver.observe(root, {
						childList: true,
						subtree: true
					});
				}
			};
			const waitObserver = new MutationObserver(() => {
				tryPlace();
			});
			waitObserver.observe(document.body, {
				childList: true,
				subtree: true
			});
			const syncActive = () => {
				if (controller.getSnapshot().panelOpen) entry.dataset.active = "true";
				else delete entry.dataset.active;
			};
			const unsubscribe = controller.subscribe(syncActive);
			syncActive();
			tryPlace();
			return () => {
				waitObserver.disconnect();
				rootObserver?.disconnect();
				unsubscribe();
				entry.remove();
			};
		}
		//#endregion
		//#region src/client/locales.ts
		const NS = "dsh-obsidian-channel";
		const zh = {
			"nav.label": "Obsidian",
			"page.title": "Obsidian vault 通道",
			"page.subtitle": "配置 vault 与写入审批策略；下方是本插件的全部变更记录，可逐笔回滚（回滚本身也会留痕）。",
			"config.heading": "配置",
			"config.vaultDir": "Vault 根目录",
			"config.vaultDirHint": "绝对路径，例如 /Users/me/obsidian。留空时 agent 每次调用需显式传 vaultDir。",
			"config.writePolicy": "写入审批策略",
			"config.writePolicy.perWrite": "每次审批（默认，最安全）",
			"config.writePolicy.perTurn": "本任务内允许（同一任务同类写免重复审批）",
			"config.writePolicy.auto": "自动（不审批，不建议）",
			"config.excludes": "排除目录（每行一个）",
			"config.excludesHint": "额外禁止 agent 访问的目录名；内置名单 .obsidian / .git / .dsh-obsidian / .trash 始终生效。",
			"config.retention": "journal 保留天数",
			"config.testRead": "测试读取",
			"config.testRead.ok": "可读：{vault}（顶层 {n} 项）",
			"config.testRead.fail": "不可读：{error}",
			"config.unavailable": "配置通道不可用（连接未就绪或部署无 settings 服务）。",
			"config.loading": "配置加载中…",
			"history.heading": "变更历史",
			"history.refresh": "刷新",
			"history.empty": "暂无变更记录（先用 agent 做一次写入）。",
			"history.entryCount": "共 {n} 条记录",
			"history.rollback": "回滚此变更",
			"history.rollbackDone": "已回滚：{message}",
			"history.rollbackFailed": "回滚失败：{message}",
			"history.detailTitle": "变更详情",
			"history.before": "变更前",
			"history.after": "变更后",
			"history.created": "新建",
			"history.updated": "更新",
			"history.appended": "追加",
			"history.deleted": "删除",
			"history.undone": "撤销",
			"history.restored": "恢复",
			"history.rolledBack": "回滚",
			"history.loadFailed": "加载失败：{error}",
			"history.sessionLabel": "会话",
			"history.closeDetail": "关闭详情",
			"panel.title": "库首页",
			"panel.close": "回到对话",
			"panel.unbound": "还没有绑定 vault",
			"panel.bindHeading": "绑定你的库",
			"panel.bindHint": "填本地 Obsidian vault 的绝对路径。绑定后点侧边栏就会打开这个面，不会新建工作区。",
			"panel.bind": "绑定",
			"panel.today": "今日",
			"panel.todayMissing": "还没有今日笔记",
			"panel.todayMissingHint": "让 agent 按库里已有的日记习惯创建",
			"panel.dailyHabit": "日记：{folder} · {format}",
			"config.dailyFolder": "每日笔记目录（可选覆盖）",
			"config.dailyFolderHint": "留空则读取 .obsidian/daily-notes.json 的 folder。",
			"config.dailyFormat": "每日笔记日期格式（可选覆盖）",
			"config.dailyFormatHint": "Moment 记号，例如 MM-DD-YYYY。留空则读取 Obsidian 设置。",
			"config.dailyResolved": "当前生效：{path}（来源 {source}）",
			"panel.recent": "最近",
			"panel.recentEmpty": "库里还没有笔记",
			"panel.noteCount": "共 {n} 篇",
			"panel.changes": "本库变更",
			"panel.changeCount": "{n} 条",
			"panel.broken": "断链",
			"panel.brokenNone": "没有发现断链",
			"panel.ask": "问 agent",
			"panel.send": "发送",
			"panel.composerPlaceholder": "问问 agent 关于这个库…",
			"panel.prompt.read": "请阅读笔记 {path}，简要说明这篇在讲什么，然后等我的下一步。",
			"panel.prompt.todayMissing": "今天是 {date}。请创建或打开今日日记，路径必须是 {path}。",
			"panel.prompt.broken": "笔记 {from} 里有断链 [[{target}]]。请确认目标是否改名或移动，并给出修复建议。",
			"dash.kicker": "Obsidian",
			"dash.stat.notes": "{n} 篇笔记",
			"dash.stat.changes": "{n} 条变更",
			"dash.stat.broken": "{n} 条断链",
			"dash.stat.todayOn": "今日已有",
			"dash.stat.todayOff": "今日未建",
			"dash.actions": "快捷操作",
			"dash.action.daily": "写今日日记",
			"dash.action.weekly": "本周周报",
			"dash.action.broken": "修断链",
			"panel.prompt.dailyWork": "今天是 {date}。请把今天的工作内容摘要写入今日日记 {path}（没有就按这个路径创建）。写完告诉我路径。",
			"panel.prompt.weekly": "请读取最近 7 天的日记，按这个库已有的周报习惯生成本周周报并写入 vault。先给提纲，确认后再落盘。",
			"panel.prompt.brokenSweep": "请扫描本库断链，先给出报告（来源笔记、目标、是否像改名/移动），不要直接改。等我确认后再修。"
		};
		const en = {
			"nav.label": "Obsidian",
			"page.title": "Obsidian vault channel",
			"page.subtitle": "Configure the vault and write-approval policy. Below is the full change journal — every entry can be rolled back (rollbacks are themselves journaled).",
			"config.heading": "Configuration",
			"config.vaultDir": "Vault root directory",
			"config.vaultDirHint": "Absolute path, e.g. /Users/me/obsidian. When empty, the agent must pass vaultDir on every tool call.",
			"config.writePolicy": "Write approval policy",
			"config.writePolicy.perWrite": "Every write asks (default, safest)",
			"config.writePolicy.perTurn": "Allow for this task (same tool re-approved per task)",
			"config.writePolicy.auto": "Auto (no prompts, not recommended)",
			"config.excludes": "Excluded directories (one per line)",
			"config.excludesHint": "Extra directory names the agent may not touch; the built-in list .obsidian / .git / .dsh-obsidian / .trash always applies.",
			"config.retention": "Journal retention (days)",
			"config.testRead": "Test read",
			"config.testRead.ok": "Readable: {vault} ({n} top-level entries)",
			"config.testRead.fail": "Not readable: {error}",
			"config.unavailable": "Configuration channel unavailable (connection not ready or no settings service).",
			"config.loading": "Loading configuration…",
			"history.heading": "Change history",
			"history.refresh": "Refresh",
			"history.empty": "No changes yet (make a write with the agent first).",
			"history.entryCount": "{n} entries",
			"history.rollback": "Roll back this change",
			"history.rollbackDone": "Rolled back: {message}",
			"history.rollbackFailed": "Rollback failed: {message}",
			"history.detailTitle": "Change detail",
			"history.before": "Before",
			"history.after": "After",
			"history.created": "create",
			"history.updated": "update",
			"history.appended": "append",
			"history.deleted": "delete",
			"history.undone": "undo",
			"history.restored": "restore",
			"history.rolledBack": "rollback",
			"history.loadFailed": "Load failed: {error}",
			"history.sessionLabel": "Session",
			"history.closeDetail": "Close detail",
			"panel.title": "Vault home",
			"panel.close": "Back to chat",
			"panel.unbound": "No vault bound yet",
			"panel.bindHeading": "Bind your vault",
			"panel.bindHint": "Absolute path to the local Obsidian vault. The sidebar button opens this surface — it does not create a workspace.",
			"panel.bind": "Bind",
			"panel.today": "Today",
			"panel.todayMissing": "No daily note for today",
			"panel.todayMissingHint": "Ask the agent to create one using this vault’s daily habit",
			"panel.dailyHabit": "Daily: {folder} · {format}",
			"config.dailyFolder": "Daily-note folder (optional override)",
			"config.dailyFolderHint": "Leave empty to read folder from .obsidian/daily-notes.json.",
			"config.dailyFormat": "Daily-note date format (optional override)",
			"config.dailyFormatHint": "Moment tokens, e.g. MM-DD-YYYY. Leave empty to read Obsidian settings.",
			"config.dailyResolved": "Resolved: {path} (from {source})",
			"panel.recent": "Recent",
			"panel.recentEmpty": "No notes in the vault yet",
			"panel.noteCount": "{n} notes",
			"panel.changes": "Vault changes",
			"panel.changeCount": "{n}",
			"panel.broken": "Broken links",
			"panel.brokenNone": "No broken links found",
			"panel.ask": "Ask",
			"panel.send": "Send",
			"panel.composerPlaceholder": "Ask the agent about this vault…",
			"panel.prompt.read": "Read the note at {path}, summarize it, then wait.",
			"panel.prompt.todayMissing": "Today is {date}. Create or open the daily note at exactly {path}.",
			"panel.prompt.broken": "Note {from} has a broken wikilink [[{target}]]. Check whether the target was renamed or moved, and suggest a fix.",
			"dash.kicker": "Obsidian",
			"dash.stat.notes": "{n} notes",
			"dash.stat.changes": "{n} changes",
			"dash.stat.broken": "{n} broken",
			"dash.stat.todayOn": "Daily exists",
			"dash.stat.todayOff": "No daily yet",
			"dash.actions": "Quick actions",
			"dash.action.daily": "Write today",
			"dash.action.weekly": "Weekly review",
			"dash.action.broken": "Fix links",
			"panel.prompt.dailyWork": "Today is {date}. Write today’s work summary into the daily note at {path} (create that exact path if missing). Tell me the path when done.",
			"panel.prompt.weekly": "Read the last 7 daily notes and draft this week’s review in the vault’s existing weekly style. Outline first; write only after I confirm.",
			"panel.prompt.brokenSweep": "Scan this vault for broken wikilinks. Report sources and likely renames/moves first. Do not edit until I confirm."
		};
		//#endregion
		//#region src/client/ObsidianSection.tsx
		/**
		* settings.section component: Obsidian vault configuration + change-history
		* panel with per-entry diff and one-click rollback.
		*
		* Data channels:
		*   - config read/write: the /obsidian connection RPC channel the host mounts
		*     (config/get, config/set). Host persistence goes through the official
		*     settings.update seam. 【DSH 尚未适配】客户端不能走官方 settingsScope，
		*     因为 DSH host-apiproxy 的 settings.describe 白名单不暴露第三方 namespace；
		*     待 DSH 支持第三方 namespace 暴露后应改回 settingsScope。
		*   - journal read/rollback: the same /obsidian RPC (history/list,
		*     history/entry, history/rollback, vault/check). Panel rollback runs
		*     directly — the button click IS the authorization (ctx.approval requires
		*     an agent + open turn, which a UI click has not; every rollback is itself
		*     journaled and re-undoable).
		*/
		const DIFF_LINE_CAP$1 = 500;
		function diffLines$1(a, b) {
			const al = a.split("\n").slice(0, DIFF_LINE_CAP$1);
			const bl = b.split("\n").slice(0, DIFF_LINE_CAP$1);
			const n = al.length, m = bl.length;
			const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
			for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = al[i] === bl[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
			const rows = [];
			let i = 0, j = 0;
			while (i < n && j < m) if (al[i] === bl[j]) {
				rows.push({
					kind: "same",
					text: al[i]
				});
				i++;
				j++;
			} else if (dp[i + 1][j] >= dp[i][j + 1]) {
				rows.push({
					kind: "del",
					text: al[i]
				});
				i++;
			} else {
				rows.push({
					kind: "add",
					text: bl[j]
				});
				j++;
			}
			while (i < n) {
				rows.push({
					kind: "del",
					text: al[i]
				});
				i++;
			}
			while (j < m) {
				rows.push({
					kind: "add",
					text: bl[j]
				});
				j++;
			}
			return {
				rows,
				truncated: a.split("\n").length > DIFF_LINE_CAP$1 || b.split("\n").length > DIFF_LINE_CAP$1
			};
		}
		const KIND_KEYS$1 = {
			create: "history.created",
			update: "history.updated",
			append: "history.appended",
			delete: "history.deleted",
			undo: "history.undone",
			restore: "history.restored",
			rollback: "history.rolledBack"
		};
		function fmtTime$1(ts) {
			return new Date(ts).toLocaleString();
		}
		let styleSeated = false;
		function seatStyle() {
			if (styleSeated) return;
			styleSeated = true;
			const style = document.createElement("style");
			style.id = "dsh-obsidian-section-style";
			style.textContent = [
				".obs-section { display: flex; flex-direction: column; gap: 16px; }",
				".obs-block { display: flex; flex-direction: column; gap: 8px; }",
				".obs-field { display: flex; flex-direction: column; gap: 4px; }",
				".obs-label { font-size: 12px; opacity: .7; }",
				".obs-hint { font-size: 11px; opacity: .55; }",
				".obs-input { width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(128,128,140,.35); background: transparent; color: inherit; font: inherit; }",
				".obs-radio { display: flex; flex-direction: column; gap: 4px; }",
				".obs-radio label { display: flex; gap: 6px; align-items: center; font-size: 13px; }",
				".obs-btn { align-self: flex-start; padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(128,128,140,.4); background: transparent; color: inherit; cursor: pointer; font: inherit; }",
				".obs-btn:disabled { opacity: .5; cursor: default; }",
				".obs-btn.primary { border-color: var(--dsw-alias-text-accent, #4c9aff); color: var(--dsw-alias-text-accent, #4c9aff); }",
				".obs-msg { font-size: 12px; }",
				".obs-msg.err { color: #ff6b6b; }",
				".obs-msg.ok { color: #51c88a; }",
				".obs-row { display: flex; gap: 8px; align-items: center; justify-content: space-between; padding: 8px 10px; border: 1px solid rgba(128,128,140,.22); border-radius: 8px; cursor: pointer; }",
				".obs-row:hover { border-color: rgba(128,128,140,.5); }",
				".obs-row .main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }",
				".obs-row .path { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
				".obs-row .meta { font-size: 11px; opacity: .6; }",
				".obs-badge { flex: none; font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(128,128,140,.4); }",
				".obs-diff { display: flex; flex-direction: column; border: 1px solid rgba(128,128,140,.22); border-radius: 8px; overflow: hidden; }",
				".obs-diff .pane-head { padding: 6px 10px; font-size: 11px; opacity: .65; border-bottom: 1px solid rgba(128,128,140,.2); }",
				".obs-diff .pane { display: flex; }",
				".obs-diff .col { flex: 1; min-width: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; padding: 6px 10px; }",
				".obs-diff .col + .col { border-left: 1px solid rgba(128,128,140,.2); }",
				".obs-diff .del { background: rgba(255,107,107,.12); }",
				".obs-diff .add { background: rgba(81,200,138,.12); }",
				".obs-diff .line-del { color: #ff6b6b; }",
				".obs-diff .line-add { color: #51c88a; }",
				".obs-list { display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; }"
			].join("\n");
			document.head.appendChild(style);
		}
		function ObsidianSettingsSection({ t, close, rpc }) {
			seatStyle();
			const [cfg, setCfg] = (0, react.useState)(null);
			const [cfgStatus, setCfgStatus] = (0, react.useState)("loading");
			const loadConfig = (0, react.useCallback)(async () => {
				const res = await rpc("config/get");
				if (res.ok) {
					setCfg(res.value);
					setCfgStatus("ready");
				} else setCfgStatus("unavailable");
			}, [rpc]);
			(0, react.useEffect)(() => {
				loadConfig();
			}, [loadConfig]);
			const [entries, setEntries] = (0, react.useState)([]);
			const [selected, setSelected] = (0, react.useState)(null);
			const [listBusy, setListBusy] = (0, react.useState)(false);
			const [listError, setListError] = (0, react.useState)(null);
			const [detailBusy, setDetailBusy] = (0, react.useState)(false);
			const [rollbackBusy, setRollbackBusy] = (0, react.useState)(false);
			const [rollbackMsg, setRollbackMsg] = (0, react.useState)(null);
			const [testMsg, setTestMsg] = (0, react.useState)(null);
			const refresh = (0, react.useCallback)(async () => {
				setListBusy(true);
				setListError(null);
				const res = await rpc("history/list", { limit: 200 });
				setListBusy(false);
				if (res.ok) {
					const e = res.value.entries ?? [];
					setEntries(e);
				} else setListError(t("history.loadFailed", { error: res.error.message }));
			}, [rpc, t]);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			const openDetail = async (opId) => {
				setDetailBusy(true);
				setRollbackMsg(null);
				const res = await rpc("history/entry", { opId });
				setDetailBusy(false);
				if (res.ok) setSelected(res.value);
				else setRollbackMsg({
					kind: "err",
					text: t("history.loadFailed", { error: res.error.message })
				});
			};
			const doRollback = async () => {
				if (selected === null || rollbackBusy) return;
				if (!window.confirm(t("history.rollback") + " — " + selected.path + " (opId " + selected.opId + ")")) return;
				setRollbackBusy(true);
				setRollbackMsg(null);
				const res = await rpc("history/rollback", { opId: selected.opId });
				setRollbackBusy(false);
				if (res.ok) {
					const v = res.value;
					setRollbackMsg({
						kind: "ok",
						text: t("history.rollbackDone", { message: v.message ?? "" })
					});
					setSelected(null);
					refresh();
				} else setRollbackMsg({
					kind: "err",
					text: t("history.rollbackFailed", { message: res.error.message })
				});
			};
			const doTestRead = async () => {
				setTestMsg(null);
				const res = await rpc("vault/check", {});
				if (res.ok) {
					const v = res.value;
					setTestMsg({
						kind: "ok",
						text: t("config.testRead.ok", {
							vault: v.vault ?? "",
							n: String(v.topLevel ?? "?")
						})
					});
				} else setTestMsg({
					kind: "err",
					text: t("config.testRead.fail", { error: res.error.message })
				});
			};
			const setField = (field, value) => {
				rpc("config/set", {
					field,
					value
				}).then((res) => {
					if (res.ok) setCfg(res.value);
					else setRollbackMsg({
						kind: "err",
						text: res.error.message
					});
				});
			};
			const snapshotValue = cfg;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "obs-section",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 15,
							fontWeight: 600
						},
						children: t("page.title")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "obs-hint",
						children: t("page.subtitle")
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "obs-block",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									fontSize: 13,
									fontWeight: 600
								},
								children: t("config.heading")
							}),
							cfgStatus === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "obs-hint",
								children: t("config.loading")
							}),
							cfgStatus === "unavailable" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "obs-msg err",
								children: t("config.unavailable")
							}),
							cfgStatus === "ready" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "obs-field",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "obs-label",
											children: t("config.vaultDir")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "obs-input",
											value: snapshotValue?.vaultDir ?? "",
											placeholder: "/Users/me/obsidian",
											onChange: (ev) => setField("vaultDir", ev.target.value)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "obs-hint",
											children: t("config.vaultDirHint")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: {
												display: "flex",
												gap: 8,
												alignItems: "center",
												marginTop: 4
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "obs-btn",
												onClick: () => {
													doTestRead();
												},
												children: t("config.testRead")
											}), testMsg !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: testMsg.kind === "ok" ? "obs-msg ok" : "obs-msg err",
												children: testMsg.text
											})]
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "obs-field",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "obs-label",
										children: t("config.writePolicy")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "obs-radio",
										children: [
											"per-write",
											"per-turn",
											"auto"
										].map((policy) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: "dsh-obsidian-write-policy",
											checked: (snapshotValue?.writePolicy ?? "per-write") === policy,
											onChange: () => setField("writePolicy", policy)
										}), t("config.writePolicy." + (policy === "per-write" ? "perWrite" : policy === "per-turn" ? "perTurn" : "auto"))] }, policy))
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "obs-field",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "obs-label",
											children: t("config.excludes")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
											className: "obs-input",
											rows: 3,
											value: (snapshotValue?.excludes ?? []).join("\n"),
											onChange: (ev) => setField("excludes", ev.target.value.split("\n").map((s) => s.trim()).filter((s) => s !== ""))
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "obs-hint",
											children: t("config.excludesHint")
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "obs-field",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "obs-label",
											children: t("config.dailyFolder")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "obs-input",
											value: snapshotValue?.dailyFolder ?? "",
											placeholder: "Daily",
											onChange: (ev) => setField("dailyFolder", ev.target.value)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "obs-hint",
											children: t("config.dailyFolderHint")
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "obs-field",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "obs-label",
											children: t("config.dailyFormat")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "obs-input",
											value: snapshotValue?.dailyFormat ?? "",
											placeholder: "MM-DD-YYYY",
											onChange: (ev) => setField("dailyFormat", ev.target.value)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "obs-hint",
											children: t("config.dailyFormatHint")
										}),
										snapshotValue?.daily != null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "obs-hint",
											children: t("config.dailyResolved", {
												path: snapshotValue.daily.todayRel,
												source: snapshotValue.daily.source
											})
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "obs-field",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "obs-label",
										children: t("config.retention")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "obs-input",
										type: "number",
										min: 1,
										value: snapshotValue?.journalRetentionDays ?? 30,
										onChange: (ev) => setField("journalRetentionDays", Number(ev.target.value) || 30)
									})]
								})
							] })
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "obs-block",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between"
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: {
										fontSize: 13,
										fontWeight: 600
									},
									children: [
										t("history.heading"),
										" · ",
										t("history.entryCount", { n: String(entries.length) })
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "obs-btn",
									disabled: listBusy,
									onClick: () => {
										refresh();
									},
									children: t("history.refresh")
								})]
							}),
							listError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "obs-msg err",
								children: listError
							}),
							entries.length === 0 && !listBusy && listError === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "obs-hint",
								children: t("history.empty")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "obs-list",
								children: entries.map((e) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "obs-row",
									onClick: () => {
										openDetail(e.opId);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "main",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "path",
											children: e.path
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "meta",
											children: [
												fmtTime$1(e.ts),
												" · ",
												e.tool,
												" · ",
												t("history.sessionLabel"),
												" ",
												shortSession(e.sessionId)
											]
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "obs-badge",
										children: t(KIND_KEYS$1[e.kind] ?? "history." + e.kind)
									})]
								}, e.opId))
							})
						]
					}),
					(selected !== null || detailBusy) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "obs-block",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between"
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: {
										fontSize: 13,
										fontWeight: 600
									},
									children: [t("history.detailTitle"), selected !== null ? " — " + selected.path : ""]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "obs-btn",
									onClick: () => setSelected(null),
									children: t("history.closeDetail")
								})]
							}),
							detailBusy && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "obs-hint",
								children: t("config.loading")
							}),
							selected !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EntryDetail, {
								entry: selected,
								t
							}),
							selected !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									gap: 8,
									alignItems: "center"
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "obs-btn primary",
									disabled: rollbackBusy,
									onClick: () => {
										doRollback();
									},
									children: t("history.rollback")
								}), rollbackMsg !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: rollbackMsg.kind === "ok" ? "obs-msg ok" : "obs-msg err",
									children: rollbackMsg.text
								})]
							})
						]
					})
				]
			});
		}
		function shortSession(sessionId) {
			if (sessionId === null || sessionId === void 0) return "—";
			const s = String(sessionId);
			return s.length > 12 ? s.slice(0, 12) : s;
		}
		function EntryDetail({ entry, t }) {
			const before = entry.before;
			const after = entry.after;
			const diff = (0, react.useMemo)(() => diffLines$1(before ?? "", after ?? ""), [before, after]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "obs-diff",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "pane",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "col",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "pane-head",
							children: [t("history.before"), before === null ? " — " + t("history.created") : ""]
						}), before === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "obs-hint",
							children: "（无）"
						}) : diff.rows.map((r, i) => r.kind === "del" || r.kind === "same" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: r.kind === "del" ? "del line-del" : void 0,
							children: r.text || " "
						}, i) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "del",
							style: { opacity: 0 },
							children: " "
						}, i))]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "col",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "pane-head",
							children: t("history.after")
						}), after === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "obs-hint",
							children: "（无）"
						}) : diff.rows.map((r, i) => r.kind === "add" || r.kind === "same" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: r.kind === "add" ? "add line-add" : void 0,
							children: r.text || " "
						}, i) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "add",
							style: { opacity: 0 },
							children: " "
						}, i))]
					})]
				}), diff.truncated && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "obs-hint",
					children: [
						"（前 ",
						DIFF_LINE_CAP$1,
						" 行）"
					]
				})]
			});
		}
		//#endregion
		//#region src/client/ObsidianPanel.tsx
		/**
		* Center-column Obsidian surface: today / recent / journalled changes /
		* broken-link sample / a composer that hands off to the vault's own session.
		*/
		const KIND_KEYS = {
			create: "history.created",
			update: "history.updated",
			append: "history.appended",
			delete: "history.deleted",
			undo: "history.undone",
			restore: "history.restored",
			rollback: "history.rolledBack"
		};
		const DIFF_LINE_CAP = 200;
		function diffLines(a, b) {
			const al = a.split("\n").slice(0, DIFF_LINE_CAP);
			const bl = b.split("\n").slice(0, DIFF_LINE_CAP);
			const n = al.length;
			const m = bl.length;
			const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
			for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = al[i] === bl[j] ? (dp[i + 1]?.[j + 1] ?? 0) + 1 : Math.max(dp[i + 1]?.[j] ?? 0, dp[i]?.[j + 1] ?? 0);
			const rows = [];
			let i = 0;
			let j = 0;
			while (i < n && j < m) if (al[i] === bl[j]) {
				rows.push({
					kind: "same",
					text: al[i] ?? ""
				});
				i++;
				j++;
			} else if ((dp[i + 1]?.[j] ?? 0) >= (dp[i]?.[j + 1] ?? 0)) {
				rows.push({
					kind: "del",
					text: al[i] ?? ""
				});
				i++;
			} else {
				rows.push({
					kind: "add",
					text: bl[j] ?? ""
				});
				j++;
			}
			while (i < n) {
				rows.push({
					kind: "del",
					text: al[i] ?? ""
				});
				i++;
			}
			while (j < m) {
				rows.push({
					kind: "add",
					text: bl[j] ?? ""
				});
				j++;
			}
			return rows;
		}
		function fmtTime(ts) {
			return new Date(ts).toLocaleString();
		}
		function ObsidianPanel({ controller, rpc, t, onTalk }) {
			const [open, setOpen] = (0, react.useState)(controller.getSnapshot().panelOpen);
			(0, react.useEffect)(() => controller.subscribe(() => setOpen(controller.getSnapshot().panelOpen)), [controller]);
			const [vaultDir, setVaultDir] = (0, react.useState)("");
			const [bindDraft, setBindDraft] = (0, react.useState)("");
			const [needBind, setNeedBind] = (0, react.useState)(false);
			const [overview, setOverview] = (0, react.useState)(null);
			const [status, setStatus] = (0, react.useState)("idle");
			const [error, setError] = (0, react.useState)(null);
			const [draft, setDraft] = (0, react.useState)("");
			const [talkBusy, setTalkBusy] = (0, react.useState)(false);
			const [talkError, setTalkError] = (0, react.useState)(null);
			const [selected, setSelected] = (0, react.useState)(null);
			const [rollbackBusy, setRollbackBusy] = (0, react.useState)(false);
			const [rollbackMsg, setRollbackMsg] = (0, react.useState)(null);
			const load = (0, react.useCallback)(async () => {
				setStatus("loading");
				setError(null);
				setSelected(null);
				setRollbackMsg(null);
				const cfg = await rpc("config/get");
				if (!cfg.ok) {
					setStatus("error");
					setError(cfg.error.message);
					return;
				}
				const dir = String(cfg.value.vaultDir ?? "").trim();
				setVaultDir(dir);
				if (dir === "") {
					setNeedBind(true);
					setOverview(null);
					setStatus("ready");
					return;
				}
				setNeedBind(false);
				const res = await rpc("surface/overview");
				if (!res.ok) {
					setStatus("error");
					setError(res.error.message);
					return;
				}
				setOverview(res.value);
				setStatus("ready");
			}, [rpc]);
			(0, react.useEffect)(() => {
				if (open) load();
			}, [open, load]);
			const bind = async () => {
				const path = bindDraft.trim();
				if (path === "") return;
				const res = await rpc("config/set", {
					field: "vaultDir",
					value: path
				});
				if (!res.ok) {
					setError(res.error.message);
					return;
				}
				setBindDraft("");
				await load();
			};
			const talk = async (text) => {
				const prompt = text.trim();
				if (prompt === "") return;
				setTalkBusy(true);
				setTalkError(null);
				const err = await onTalk(prompt, vaultDir || void 0);
				setTalkBusy(false);
				if (err !== void 0) {
					setTalkError(err);
					return;
				}
				setDraft("");
				controller.close();
			};
			const openChange = async (opId) => {
				const res = await rpc("history/entry", { opId });
				if (res.ok) setSelected(res.value);
				else setRollbackMsg(res.error.message);
			};
			const rollback = async () => {
				if (selected === null || rollbackBusy) return;
				if (!window.confirm(t("history.rollback") + " — " + selected.path)) return;
				setRollbackBusy(true);
				setRollbackMsg(null);
				const res = await rpc("history/rollback", { opId: selected.opId });
				setRollbackBusy(false);
				if (!res.ok) {
					setRollbackMsg(res.error.message);
					return;
				}
				setSelected(null);
				await load();
			};
			if (!open) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ob-surface",
				"data-dsh-obsidian-board": "",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: "ob-head",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "ob-kicker",
								children: t("dash.kicker")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
								className: "ob-title",
								children: t("panel.title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "ob-sub",
								children: needBind ? t("panel.unbound") : overview?.vault ?? vaultDir
							})
						] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ob-actions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "ob-btn",
								onClick: () => {
									load();
								},
								disabled: status === "loading",
								children: t("history.refresh")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "ob-btn",
								onClick: () => controller.close(),
								children: t("panel.close")
							})]
						})]
					}),
					overview !== null && !needBind && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ob-stats",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: overview.today === null ? "ob-stat warn" : "ob-stat",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "n",
									children: overview.today === null ? t("dash.stat.todayOff") : t("dash.stat.todayOn")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "l",
									children: overview.todayDate
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "ob-stat",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "n",
									children: overview.noteCount
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "l",
									children: t("dash.stat.notes", { n: String(overview.noteCount) })
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "ob-stat",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "n",
									children: overview.changes.length
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "l",
									children: t("dash.stat.changes", { n: String(overview.changes.length) })
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: overview.brokenCount > 0 ? "ob-stat warn" : "ob-stat",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "n",
									children: overview.brokenCount
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "l",
									children: t("dash.stat.broken", { n: String(overview.brokenCount) })
								})]
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ob-quick",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ob-quick-label",
								children: t("dash.actions")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "ob-chip",
								onClick: () => {
									talk(t("panel.prompt.dailyWork", {
										date: overview.todayDate,
										path: overview.todayRel ?? overview.todayDate
									}));
								},
								children: t("dash.action.daily")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "ob-chip",
								onClick: () => {
									talk(t("panel.prompt.weekly"));
								},
								children: t("dash.action.weekly")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "ob-chip",
								onClick: () => {
									talk(t("panel.prompt.brokenSweep"));
								},
								children: t("dash.action.broken")
							})
						]
					})] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ob-body",
						children: [
							status === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "ob-hint",
								children: t("config.loading")
							}),
							error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "ob-msg err",
								children: error
							}),
							needBind && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								className: "ob-card span2",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "ob-card-h",
										children: t("panel.bindHeading")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "ob-hint",
										children: t("panel.bindHint")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: "ob-input",
										value: bindDraft,
										placeholder: "/Users/me/obsidian",
										onChange: (ev) => setBindDraft(ev.target.value),
										onKeyDown: (ev) => {
											if (ev.key === "Enter") bind();
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "ob-btn primary",
										onClick: () => {
											bind();
										},
										children: t("panel.bind")
									})
								]
							}),
							overview !== null && !needBind && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
									className: "ob-card",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "ob-card-h",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("panel.today") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "ob-count",
												children: overview.todayRel ?? overview.todayDate
											})]
										}),
										overview.daily !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "ob-hint",
											children: t("panel.dailyHabit", {
												folder: overview.daily.folder || "/",
												format: overview.daily.format
											})
										}),
										overview.today === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "ob-row",
											onClick: () => {
												talk(t("panel.prompt.todayMissing", {
													date: overview.todayDate,
													path: overview.todayRel ?? overview.todayDate
												}));
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "main",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "path",
													children: t("panel.todayMissing")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "meta",
													children: overview.todayRel ?? t("panel.todayMissingHint")
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "ob-link",
												children: t("panel.ask")
											})]
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NoteRow, {
											note: overview.today,
											askLabel: t("panel.ask"),
											onAsk: () => {
												talk(t("panel.prompt.read", { path: overview.today.path }));
											}
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
									className: "ob-card",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "ob-card-h",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("panel.broken") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "ob-count",
												children: overview.brokenCount
											})]
										}),
										overview.brokenCount === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "ob-hint",
											children: t("panel.brokenNone")
										}),
										overview.broken.map((link, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "ob-row",
											onClick: () => {
												talk(t("panel.prompt.broken", {
													from: link.from,
													target: link.target
												}));
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "main",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: "path",
													children: [
														"[[",
														link.target,
														"]]"
													]
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "meta",
													children: link.from
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "ob-link",
												children: t("panel.ask")
											})]
										}, link.from + "->" + link.target + i))
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
									className: "ob-card",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "ob-card-h",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("panel.recent") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "ob-count",
												children: t("panel.noteCount", { n: String(overview.noteCount) })
											})]
										}),
										overview.recent.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "ob-hint",
											children: t("panel.recentEmpty")
										}),
										overview.recent.map((note) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NoteRow, {
											note,
											askLabel: t("panel.ask"),
											onAsk: () => {
												talk(t("panel.prompt.read", { path: note.path }));
											}
										}, note.path))
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
									className: "ob-card",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "ob-card-h",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("panel.changes") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "ob-count",
												children: t("panel.changeCount", { n: String(overview.changes.length) })
											})]
										}),
										overview.changes.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "ob-hint",
											children: t("history.empty")
										}),
										overview.changes.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "ob-row",
											onClick: () => {
												openChange(entry.opId);
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "main",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "path",
													children: entry.path
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "meta",
													children: fmtTime(entry.ts)
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "ob-badge",
												children: t(KIND_KEYS[entry.kind] ?? "history." + entry.kind)
											})]
										}, entry.opId)),
										selected !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChangeDetail, {
											entry: selected,
											t
										}),
										selected !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: {
												display: "flex",
												gap: 8,
												alignItems: "center"
											},
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "ob-btn primary",
													disabled: rollbackBusy,
													onClick: () => {
														rollback();
													},
													children: t("history.rollback")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "ob-btn",
													onClick: () => setSelected(null),
													children: t("history.closeDetail")
												}),
												rollbackMsg !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "ob-msg err",
													children: rollbackMsg
												})
											]
										})
									]
								})
							] })
						]
					}),
					!needBind && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
						className: "ob-composer",
						onSubmit: (ev) => {
							ev.preventDefault();
							talk(draft);
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
							className: "ob-area",
							rows: 2,
							value: draft,
							placeholder: t("panel.composerPlaceholder"),
							onChange: (ev) => setDraft(ev.target.value),
							onKeyDown: (ev) => {
								if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) {
									ev.preventDefault();
									talk(draft);
								}
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "submit",
							className: "ob-btn primary",
							disabled: talkBusy || draft.trim() === "",
							children: t("panel.send")
						})]
					}),
					talkError !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ob-msg err",
						children: talkError
					})
				]
			});
		}
		function NoteRow({ note, askLabel, onAsk }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ob-row",
				onClick: onAsk,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "main",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "path",
						children: note.title ?? note.path
					}), note.title !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "meta",
						children: note.path
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ob-link",
					onClick: (ev) => {
						ev.stopPropagation();
						onAsk();
					},
					children: askLabel
				})]
			});
		}
		function ChangeDetail({ entry, t }) {
			const rows = (0, react.useMemo)(() => diffLines(entry.before ?? "", entry.after ?? ""), [entry.before, entry.after]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "ob-diff",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "pane",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "col",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "pane-head",
							children: t("history.before")
						}), rows.map((row, i) => row.kind !== "add" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: row.kind === "del" ? "del" : void 0,
							children: row.text || " "
						}, i) : null)]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "col",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "pane-head",
							children: t("history.after")
						}), rows.map((row, i) => row.kind !== "del" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: row.kind === "add" ? "add" : void 0,
							children: row.text || " "
						}, i) : null)]
					})]
				})
			});
		}
		//#endregion
		//#region src/client/panel-mount.tsx
		/**
		* Mount the Obsidian surface into the center column.
		*
		* The conversation slot is single-occupant, so the surface is an extra
		* trailing child React never manages. A html[data-dsh-obsidian-active]
		* stylesheet hides the conversation (and sibling plugin panels) while this
		* surface is open; the conversation subtree stays mounted.
		*/
		const CONVERSATION_COLUMN_SELECTOR = "[data-pane=\"conversation\"], [class*=\"centerCol\"]";
		const ACTIVE_ATTR = "data-dsh-obsidian-active";
		const SIBLING_ATTRS = ["data-dsh-taskboard-active", "data-dsh-ssh-active"];
		const ACTIVATE_EVENT = "dsh-panel-activate";
		const PANEL_NAME = "obsidian";
		const SIDEBAR_ROW_SELECTOR = "[class*=\"sessionRow\"], [class*=\"projectRow\"], [class*=\"searchResultRow\"], [class*=\"searchResultWorkspace\"], [class*=\"newSession\"]";
		function conversationColumn() {
			return document.querySelector(CONVERSATION_COLUMN_SELECTOR) ?? void 0;
		}
		function mountObsidianPanel(opts) {
			seatStyles();
			const { controller } = opts;
			let root;
			let container;
			const ensure = () => {
				if (container !== void 0) {
					if (container.isConnected) return;
					root?.unmount();
					root = void 0;
					container.remove();
					container = void 0;
				}
				const column = conversationColumn();
				if (column === void 0) return;
				container = document.createElement("div");
				container.dataset.dshObsidianView = "";
				column.appendChild(container);
				root = (0, react_dom_client.createRoot)(container);
				root.render(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ObsidianPanel, {
					controller,
					rpc: opts.rpc,
					t: opts.t,
					onTalk: opts.onTalk
				}));
			};
			const waitObserver = new MutationObserver(() => {
				ensure();
			});
			waitObserver.observe(document.body, {
				childList: true,
				subtree: true
			});
			const applyActive = () => {
				if (controller.getSnapshot().panelOpen) {
					for (const attr of SIBLING_ATTRS) document.documentElement.removeAttribute(attr);
					document.documentElement.setAttribute(ACTIVE_ATTR, "");
					document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: PANEL_NAME }));
				} else document.documentElement.removeAttribute(ACTIVE_ATTR);
			};
			const onOtherActivate = (event) => {
				const name = event.detail;
				if ((name === "taskboard" || name === "ssh") && controller.getSnapshot().panelOpen) controller.close();
			};
			const onClickSidebarRow = (event) => {
				if (!controller.getSnapshot().panelOpen) return;
				const target = event.target;
				if (target === null) return;
				if (target.closest("[data-dsh-obsidian-entry]") !== null) return;
				if (target.closest(SIDEBAR_ROW_SELECTOR) !== null) controller.close();
			};
			document.addEventListener("click", onClickSidebarRow, true);
			document.addEventListener(ACTIVATE_EVENT, onOtherActivate);
			const unsubscribe = controller.subscribe(applyActive);
			applyActive();
			ensure();
			return () => {
				document.removeEventListener("click", onClickSidebarRow, true);
				document.removeEventListener(ACTIVATE_EVENT, onOtherActivate);
				waitObserver.disconnect();
				unsubscribe();
				document.documentElement.removeAttribute(ACTIVE_ATTR);
				root?.unmount();
				root = void 0;
				container?.remove();
				container = void 0;
			};
		}
		//#endregion
		//#region src/client/talk.ts
		function samePath(a, b) {
			if (!a || !b) return false;
			const norm = (p) => p.replace(/\/+$/, "");
			return norm(a) === norm(b);
		}
		function workspaceIdForVault(snap, vaultDir) {
			return (snap.items ?? []).find((row) => samePath(row.path, vaultDir))?.workspaceId;
		}
		function sessionIdsOf(snap, workspaceId) {
			return (snap.items ?? []).find((item) => item.workspaceId === workspaceId)?.sessionIds ?? [];
		}
		function sessionIdFrom(value) {
			if (typeof value === "string" && value !== "") return value;
			if (typeof value !== "object" || value === null) return void 0;
			const rec = value;
			if (typeof rec.sessionId === "string") return rec.sessionId;
			if (rec.value !== void 0) return sessionIdFrom(rec.value);
			if (rec.result !== void 0) return sessionIdFrom(rec.result);
		}
		async function fillComposerDraft(sessions, conversation, sessionId, text) {
			const input = conversation?.input;
			if (input === void 0 || typeof sessions.scope !== "function") return false;
			const deadline = Date.now() + 4e3;
			while (Date.now() < deadline) {
				const actx = sessions.scope(sessionId);
				if (actx !== void 0) try {
					const shell = input.for(actx);
					if (typeof shell?.setDraft === "function") {
						shell.setDraft(text);
						return true;
					}
				} catch {}
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
			return false;
		}
		function fillComposerDom(text) {
			const area = document.querySelector("[data-pane=\"conversation\"], [class*=\"centerCol\"]")?.querySelector("textarea");
			if (area === null || area === void 0) return false;
			Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(area, text);
			area.dispatchEvent(new Event("input", { bubbles: true }));
			area.dispatchEvent(new Event("change", { bubbles: true }));
			area.focus();
			return true;
		}
		async function resolveVaultWorkspace(workspaces, vaultDir) {
			const existing = workspaceIdForVault(workspaces.list?.getSnapshot?.() ?? {}, vaultDir);
			if (existing !== void 0) return existing;
			if (typeof workspaces.create !== "function") return void 0;
			const created = await workspaces.create({ path: vaultDir });
			return created?.workspaceId ?? created?.workspace?.workspaceId;
		}
		async function createVaultSession(workspaces, sessions, connection, workspaceId) {
			const before = new Set(sessionIdsOf(workspaces.list?.getSnapshot?.() ?? {}, workspaceId));
			const apiCreate = connection?.api?.sessions?.create;
			if (typeof apiCreate === "function") {
				const created = sessionIdFrom(await apiCreate({
					workspaceId,
					agentPreset: "obsidian"
				}));
				if (created !== void 0 && !before.has(created)) return created;
				if (created !== void 0) return created;
			}
			if (typeof sessions.create === "function") {
				const created = sessionIdFrom(await sessions.create({
					workspaceId,
					agentPreset: "obsidian"
				}));
				if (created !== void 0 && !before.has(created)) return created;
				if (created !== void 0) return created;
			}
			if (typeof workspaces.startSession !== "function") return void 0;
			workspaces.startSession(workspaceId);
			const deadline = Date.now() + 4e3;
			while (Date.now() < deadline) {
				const fresh = sessionIdsOf(workspaces.list?.getSnapshot?.() ?? {}, workspaceId).find((id) => !before.has(id));
				if (fresh !== void 0) return fresh;
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
		}
		/**
		* Open a new vault session and put `text` in the composer. Does not send.
		* Returns an error message on failure (never throws).
		*/
		async function handoffToAgent(ctx, text, vaultDir) {
			const trimmed = text.trim();
			if (trimmed === "") return "empty prompt";
			const dir = vaultDir?.trim() ?? "";
			if (dir === "") return "no vault bound";
			const sessions = ctx.sessions;
			const workspaces = ctx.workspaces;
			const connection = ctx.connection;
			const conversation = ctx.conversation;
			if (sessions === void 0 || workspaces === void 0) return "sessions/workspaces unavailable";
			let workspaceId;
			try {
				const resolved = await resolveVaultWorkspace(workspaces, dir);
				if (resolved === void 0) return "could not open the vault workspace";
				workspaceId = resolved;
			} catch (error) {
				return error instanceof Error ? error.message : String(error);
			}
			let sessionId;
			try {
				const opened = await createVaultSession(workspaces, sessions, connection, workspaceId);
				if (opened === void 0) return "could not open a new Obsidian session";
				sessionId = opened;
			} catch (error) {
				return error instanceof Error ? error.message : String(error);
			}
			if (typeof sessions.open === "function") sessions.open(sessionId);
			if (!await fillComposerDraft(sessions, conversation, sessionId, trimmed)) window.setTimeout(() => {
				fillComposerDraft(sessions, conversation, sessionId, trimmed).then((ok) => {
					if (!ok) fillComposerDom(trimmed);
				});
			}, 50);
		}
		//#endregion
		//#region src/client/index.tsx
		/** Required client services: slots, workspaces/sessions (talk handoff), locale, connection RPC. */
		const inject = [
			"slots",
			"workspaces",
			"sessions",
			"locale",
			"connection",
			"conversation"
		];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-obsidian: dictionaries");
			const t = ctx.locale.bind(NS);
			const controller = new PanelController();
			const rpc = (endpoint, payload) => ctx.connection.rpc.call("/obsidian", endpoint, payload ?? null);
			ctx.effect(() => {
				const disposers = [];
				try {
					disposers.push(mountObsidianEntry(controller));
					disposers.push(mountObsidianPanel({
						controller,
						rpc,
						t,
						onTalk: (text, vaultDir) => handoffToAgent(ctx, text, vaultDir)
					}));
				} catch (error) {
					console.error("[dsh-obsidian-channel] mount failed:", error);
				}
				return () => {
					for (const dispose of disposers.splice(0)) dispose();
				};
			}, "dsh-obsidian: sidebar + surface");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-obsidian-channel",
				order: 100,
				label: () => t("nav.label"),
				locale: NS,
				inject: () => ({ rpc })
			}, ObsidianSettingsSection));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
