window.__ModuleLoader__.load({
	id: "dsh-obsidian-channel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom_client = require("react-dom/client");
		let react_dom = require("react-dom");
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
		//#region src/client/dom-mount.ts
		/**
		* Find a host node, then stop watching the whole document.
		* A document-wide subtree observer during dsh boot (50+ plugins hydrating)
		* taxes every React mutation; only keep it until the first successful mount.
		*/
		function watchUntilFound(find, onFound) {
			let armed;
			let scheduled = false;
			const stop = () => {
				armed?.disconnect();
				armed = void 0;
			};
			const tick = () => {
				const el = find();
				if (el === void 0) return false;
				stop();
				onFound(el);
				return true;
			};
			if (tick()) return stop;
			armed = new MutationObserver(() => {
				if (scheduled) return;
				scheduled = true;
				requestAnimationFrame(() => {
					scheduled = false;
					tick();
				});
			});
			armed.observe(document.documentElement, {
				childList: true,
				subtree: true
			});
			return stop;
		}
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
			"[data-dsh-obsidian-host]{position:relative}",
			"[data-dsh-obsidian-view]{position:absolute;inset:0;display:none;z-index:61;background:var(--dsw-alias-bg-base,#111);color:var(--dsw-alias-label-primary,inherit)}",
			"html[data-dsh-obsidian-active] [data-dsh-obsidian-view]{display:block}",
			"html[data-dsh-obsidian-active] [data-dsh-obsidian-host]>:not([data-dsh-obsidian-view]){display:none!important}",
			"html[data-dsh-obsidian-active] [data-dsh-taskboard-view],html[data-dsh-obsidian-active] [data-dsh-ssh-view]{display:none!important}",
			"[data-dsh-obsidian-view] .ob-surface{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;padding:18px 22px 16px;gap:14px;box-sizing:border-box;font-family:var(--dsw-font-family,inherit)}",
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
			"[data-dsh-obsidian-view] .ob-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:14px}",
			"[data-dsh-obsidian-view] .ob-board-wrap{display:flex;flex-direction:column;gap:8px;flex:none}",
			"[data-dsh-obsidian-view] .ob-board-bar{display:flex;justify-content:flex-end}",
			"[data-dsh-obsidian-view] .ob-board{position:relative;width:100%}",
			"[data-dsh-obsidian-view] .ob-tile{position:absolute;min-width:0;min-height:0;overflow:visible;box-sizing:border-box;border-radius:16px;border:1px solid rgba(167,139,250,.38);box-shadow:0 1px 2px rgba(0,0,0,.04),0 2px 6px rgba(0,0,0,.05)}",
			"[data-dsh-obsidian-view] .ob-tile.dragging,[data-dsh-obsidian-view] .ob-tile.menu-open{z-index:40;user-select:none}",
			"[data-dsh-obsidian-view] .ob-tile.dragging{box-shadow:0 1px 3px rgba(0,0,0,.05),0 6px 16px rgba(0,0,0,.08)}",
			"[data-dsh-obsidian-view] .ob-drag{position:absolute;top:0;left:0;right:88px;height:38px;cursor:grab;z-index:2}",
			"[data-dsh-obsidian-view] .ob-tile.dragging .ob-drag{cursor:grabbing}",
			"[data-dsh-obsidian-view] .ob-tile-gear{position:absolute;top:8px;right:8px;z-index:3}",
			"[data-dsh-obsidian-view] .ob-tile-more{display:flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:none;border-radius:8px;background:transparent;color:inherit;opacity:.42;cursor:pointer}",
			"[data-dsh-obsidian-view] .ob-tile-more:hover,[data-dsh-obsidian-view] .ob-tile-more.on{opacity:1;background:rgba(167,139,250,.14)}",
			"[data-dsh-obsidian-view] .ob-tile-menu{position:absolute;top:30px;right:0;min-width:92px;padding:4px;border-radius:10px;border:1px solid rgba(167,139,250,.28);background:var(--dsw-alias-bg-base,#fff);box-shadow:0 4px 18px rgba(0,0,0,.1);display:flex;flex-direction:column;gap:1px}",
			"[data-dsh-obsidian-view] .ob-tile-menu-item{display:block;width:100%;text-align:left;padding:6px 10px;border:none;border-radius:7px;background:transparent;color:inherit;font:inherit;font-size:13px;line-height:1.4;cursor:pointer}",
			"[data-dsh-obsidian-view] .ob-tile-menu-item:hover{background:rgba(167,139,250,.1)}",
			"[data-dsh-obsidian-view] .ob-tile-menu-item.on{background:rgba(167,139,250,.16);color:var(--dsw-alias-text-accent,#a78bfa)}",
			"[data-dsh-obsidian-view] .ob-card{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border:1px solid rgba(0,0,0,.06);border-radius:16px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.92));box-shadow:none;min-width:0;overflow:hidden;isolation:isolate;box-sizing:border-box}",
			"[data-dsh-obsidian-view] .ob-tile .ob-card{height:100%;max-height:100%;border:none;border-radius:15px}",
			"[data-dsh-obsidian-view] .ob-tile.dragging .ob-card{outline:none}",
			"[data-dsh-obsidian-view] .ob-card.span2{width:100%}",
			"[data-dsh-obsidian-view] .ob-card-h{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 36px 8px 0;margin-bottom:2px;border-bottom:1px solid rgba(150,150,165,.28);font-size:13px;font-weight:650;line-height:1.55;min-width:0;flex:none}",
			"[data-dsh-obsidian-view] .ob-card.has-agent .ob-card-h{padding-right:88px}",
			"[data-dsh-obsidian-view] .ob-card-h>span:first-child{flex:none}",
			"[data-dsh-obsidian-view] .ob-card-h-right{display:flex;align-items:center;gap:6px;min-width:0}",
			"[data-dsh-obsidian-view] .ob-tile .ob-card-agent{position:absolute;top:8px;right:38px;z-index:3;padding:4px 8px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-text-accent,#a78bfa);font:inherit;font-size:12px;line-height:1.3;cursor:pointer}",
			"[data-dsh-obsidian-view] .ob-tile .ob-card-agent:hover{background:rgba(167,139,250,.14)}",
			"[data-dsh-obsidian-view] .ob-tile .ob-card-agent:disabled{opacity:.5;cursor:default}",
			"[data-dsh-obsidian-view] .ob-daily-hit{display:flex;flex-direction:column;align-items:flex-start;gap:6px;width:100%;margin:0;padding:0;border:none;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;min-width:0;min-height:0;flex:1}",
			"[data-dsh-obsidian-view] .ob-daily-date{font-size:20px;font-weight:700;letter-spacing:-.03em;line-height:1.2}",
			"[data-dsh-obsidian-view] .ob-card-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:8px}",
			"[data-dsh-obsidian-view] .ob-count{font-weight:500;opacity:.65;font-size:12px;line-height:1.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
			"[data-dsh-obsidian-view] .ob-hint{font-size:12px;line-height:1.55;opacity:.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			"[data-dsh-obsidian-view] .ob-hint.wrap{white-space:normal;overflow:visible}",
			"[data-dsh-obsidian-view] .ob-search{display:flex;gap:8px;align-items:center;flex:none}",
			"[data-dsh-obsidian-view] .ob-search .ob-input{flex:1}",
			"[data-dsh-obsidian-view] .ob-msg{font-size:12px}",
			"[data-dsh-obsidian-view] .ob-msg.err{color:#ff6b6b}",
			"[data-dsh-obsidian-view] .ob-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px;border-radius:8px;cursor:pointer;border:1px solid transparent;min-width:0}",
			"[data-dsh-obsidian-view] .ob-row:hover{background:rgba(128,128,140,.08);border-color:rgba(128,128,140,.18)}",
			"[data-dsh-obsidian-view] .ob-row.on{border-color:var(--dsw-alias-text-accent,#a78bfa);background:rgba(167,139,250,.08)}",
			"[data-dsh-obsidian-view] .ob-row.static{cursor:default}",
			"[data-dsh-obsidian-view] .ob-preview{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,140,.22));border-radius:8px;min-width:0}",
			"[data-dsh-obsidian-view] .ob-preview-h{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:600}",
			"[data-dsh-obsidian-view] .ob-preview-body{margin:0;white-space:pre-wrap;word-break:break-word;font:inherit;font-size:12px;line-height:1.55;opacity:.88}",
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
			"@media (max-width:900px){[data-dsh-obsidian-view] .ob-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}",
			"[data-dsh-obsidian-view] .ob-diff{display:flex;flex-direction:column;border:1px solid rgba(128,128,140,.22);border-radius:8px;overflow:hidden;max-height:240px}",
			"[data-dsh-obsidian-view] .ob-diff .pane{display:flex;overflow:auto}",
			"[data-dsh-obsidian-view] .ob-diff .col{flex:1;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.45;white-space:pre-wrap;word-break:break-all;padding:6px 10px}",
			"[data-dsh-obsidian-view] .ob-diff .col+.col{border-left:1px solid rgba(128,128,140,.2)}",
			"[data-dsh-obsidian-view] .ob-diff .pane-head{padding:6px 10px;font-size:11px;opacity:.65;border-bottom:1px solid rgba(128,128,140,.2)}",
			"[data-dsh-obsidian-view] .ob-diff .del{background:rgba(255,107,107,.12);color:#ff6b6b}",
			"[data-dsh-obsidian-view] .ob-diff .add{background:rgba(81,200,138,.12);color:#51c88a}",
			"[data-dsh-obsidian-editor].ob-overlay{position:fixed;inset:0;z-index:240;display:flex;align-items:stretch;justify-content:center;color:var(--dsw-alias-label-primary,inherit);font-family:var(--dsw-font-family,inherit)}",
			"[data-dsh-obsidian-editor] .ob-overlay-back{position:absolute;inset:0;border:none;padding:0;margin:0;background:rgba(0,0,0,.5);cursor:pointer}",
			"[data-dsh-obsidian-editor] .ob-overlay-sheet{position:relative;z-index:1;display:flex;flex-direction:column;gap:10px;width:min(1120px,92vw);height:min(860px,86vh);margin:auto;padding:16px 18px 14px;box-sizing:border-box;border-radius:14px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,140,.28));background:var(--dsw-alias-bg-base,#161616);box-shadow:0 24px 80px rgba(0,0,0,.45)}",
			"[data-dsh-obsidian-editor] .ob-modal-h{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex:none}",
			"[data-dsh-obsidian-editor] .ob-modal-title{min-width:0}",
			"[data-dsh-obsidian-editor] .ob-modal-title .name{font-size:16px;font-weight:700;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			"[data-dsh-obsidian-editor] .ob-modal-title .meta{margin-top:3px;font-size:12px;opacity:.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			"[data-dsh-obsidian-editor] .ob-actions{display:flex;gap:8px;flex:none}",
			"[data-dsh-obsidian-editor] .ob-btn{padding:5px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,140,.4));background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:13px}",
			"[data-dsh-obsidian-editor] .ob-btn:disabled{opacity:.5;cursor:default}",
			"[data-dsh-obsidian-editor] .ob-btn.primary{border-color:var(--dsw-alias-text-accent,#a78bfa);color:var(--dsw-alias-text-accent,#a78bfa)}",
			"[data-dsh-obsidian-editor] .ob-hint{font-size:12px;line-height:1.55;opacity:.55}",
			"[data-dsh-obsidian-editor] .ob-hint.wrap{white-space:normal}",
			"[data-dsh-obsidian-editor] .ob-msg.err{font-size:12px;color:#ff6b6b}",
			"[data-dsh-obsidian-editor] .ob-editor{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;flex:1;min-height:0}",
			"[data-dsh-obsidian-editor] .ob-editor-pane{display:flex;flex-direction:column;min-width:0;min-height:0;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,140,.22));border-radius:10px;overflow:hidden}",
			"[data-dsh-obsidian-editor] .ob-editor-label{flex:none;padding:6px 10px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;opacity:.55;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(128,128,140,.18))}",
			"[data-dsh-obsidian-editor] .ob-editor-src{flex:1;min-height:0;width:100%;box-sizing:border-box;resize:none;border:none;outline:none;padding:12px;background:transparent;color:inherit;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.55}",
			"[data-dsh-obsidian-editor] .ob-md{flex:1;min-height:0;overflow:auto;padding:14px 16px 20px;font-size:14px;line-height:1.65}",
			"[data-dsh-obsidian-editor] .ob-md h1,[data-dsh-obsidian-editor] .ob-md h2,[data-dsh-obsidian-editor] .ob-md h3,[data-dsh-obsidian-editor] .ob-md h4{margin:1.1em 0 .4em;line-height:1.3;letter-spacing:-.02em}",
			"[data-dsh-obsidian-editor] .ob-md h1{font-size:1.55em}",
			"[data-dsh-obsidian-editor] .ob-md h2{font-size:1.28em}",
			"[data-dsh-obsidian-editor] .ob-md h3{font-size:1.1em}",
			"[data-dsh-obsidian-editor] .ob-md p{margin:.55em 0}",
			"[data-dsh-obsidian-editor] .ob-md ul,[data-dsh-obsidian-editor] .ob-md ol{margin:.45em 0;padding-left:1.4em}",
			"[data-dsh-obsidian-editor] .ob-md blockquote{margin:.6em 0;padding:.2em 0 .2em 12px;border-left:3px solid rgba(167,139,250,.45);opacity:.88}",
			"[data-dsh-obsidian-editor] .ob-md hr{border:none;border-top:1px solid rgba(128,128,140,.28);margin:1em 0}",
			"[data-dsh-obsidian-editor] .ob-md code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;padding:.1em .35em;border-radius:4px;background:rgba(128,128,140,.14)}",
			"[data-dsh-obsidian-editor] .ob-md pre{margin:.7em 0;padding:10px 12px;border-radius:8px;overflow:auto;background:rgba(128,128,140,.1)}",
			"[data-dsh-obsidian-editor] .ob-md pre code{padding:0;background:none}",
			"[data-dsh-obsidian-editor] .ob-md pre.fm{font-size:12px;opacity:.7}",
			"[data-dsh-obsidian-editor] .ob-md a{color:var(--dsw-alias-text-accent,#a78bfa)}",
			"[data-dsh-obsidian-editor] .ob-md .wiki{color:var(--dsw-alias-text-accent,#a78bfa)}",
			"[data-dsh-obsidian-editor] .ob-md .tag{opacity:.7}",
			"[data-dsh-obsidian-editor] .ob-md img{max-width:100%;border-radius:6px}",
			"@media (max-width:900px){[data-dsh-obsidian-editor] .ob-editor{grid-template-columns:1fr}[data-dsh-obsidian-editor] .ob-overlay-sheet{width:96vw;height:92vh}}"
		].join("\n");
		/** Seat the stylesheet; replace text if a previous bundle already injected it. */
		function seatStyles() {
			if (typeof document === "undefined") return;
			let style = document.getElementById(STYLE_ID);
			if (style === null) {
				style = document.createElement("style");
				style.id = STYLE_ID;
				document.head.appendChild(style);
			}
			style.textContent = CSS;
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
			let rootObserver;
			let stopWait;
			const watchRoot = (host) => {
				rootObserver?.disconnect();
				root = host;
				placeEntry(host, entry);
				rootObserver = new MutationObserver(() => {
					if (root === void 0 || !root.isConnected) {
						rootObserver?.disconnect();
						rootObserver = void 0;
						root = void 0;
						stopWait?.();
						stopWait = watchUntilFound(sidebarRoot, watchRoot);
						return;
					}
					if (entry.parentElement !== root) queueMicrotask(() => {
						if (root !== void 0 && root.isConnected && entry.parentElement !== root) placeEntry(root, entry);
					});
				});
				rootObserver.observe(host, { childList: true });
			};
			stopWait = watchUntilFound(sidebarRoot, watchRoot);
			const syncActive = () => {
				if (controller.getSnapshot().panelOpen) entry.dataset.active = "true";
				else delete entry.dataset.active;
			};
			const unsubscribe = controller.subscribe(syncActive);
			syncActive();
			return () => {
				stopWait?.();
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
			"page.title": "知识库",
			"page.subtitle": "把Agent接到你的 Obsidian 库。在这里选择库在哪、改笔记前要不要问你，以及首页上显示哪些内容。",
			"config.heading": "基本设置",
			"config.heading.library": "绑定知识库",
			"config.heading.libraryLead": "告诉Agent你的笔记在哪。绑定后，Agent只会在这个库里读写。",
			"config.heading.write": "改笔记时",
			"config.heading.writeLead": "Agent要改你的笔记时，要不要先停下来等你同意。",
			"config.heading.daily": "日记",
			"config.heading.dailyLead": "如果你用 Obsidian 写日记，可以在这里指定位置。没有这个习惯就留空。",
			"config.heading.home": "首页展示模块",
			"config.heading.homeLead": "勾选的板块会出现在库首页。页面顶部的标题和底部的提问框始终保留。",
			"config.vaultDir": "库的位置",
			"config.vaultDirHint": "填写本机 Obsidian 库的文件夹路径。也可以点「从本机查找」，从 Obsidian 已登记的库里选一个。",
			"config.vaultDirEmpty": "未选择",
			"config.vaultPick": "选择文件夹",
			"config.vaultPickFailed": "无法打开文件夹选择器：{error}",
			"config.retentionUnit": "天",
			"config.writePolicy": "改之前是否询问",
			"config.writePolicyHint": "选得越严，越不容易被改错；选得越松，Agent动手越快。",
			"config.writePolicy.perWrite": "每次都询问",
			"config.writePolicy.perWriteHint": "Agent每改一篇笔记，都会先停下来等你同意。",
			"config.writePolicy.perTurn": "每个会话只询问一次",
			"config.writePolicy.perTurnHint": "你发一条消息后，Agent动手前问一次；同一条消息里改多篇不再重复问。",
			"config.writePolicy.auto": "不询问始终放行",
			"config.writePolicy.autoHint": "Agent改完再告诉你。还不熟悉它时不建议选这项。",
			"config.excludes": "Agent 不能进入的文件夹",
			"config.excludesHint": "留空则只排除回收站、Obsidian 配置和本插件记录。每行一个文件夹名。",
			"config.retention": "记录保留天数",
			"config.retentionHint": "过期后无法再撤回。",
			"config.dailySource.obsidian": "Obsidian 里的日记设置",
			"config.dailySource.override": "本页填写的位置",
			"config.dailySource.none": "尚未指定",
			"config.testRead": "检查能否读取",
			"config.testRead.ok": "可以读取「{vault}」，顶层有 {n} 项",
			"config.testRead.fail": "现在读不到这个位置：{error}",
			"config.unavailable": "暂时读不到设置，请稍后再试。",
			"config.loading": "正在载入…",
			"history.heading": "修改记录",
			"history.lead": "Agent改过的每一处都会记在这里。点开可以对比改前改后，也可以撤回。",
			"history.refresh": "刷新",
			"history.empty": "还没有修改记录。",
			"history.entryCount": "{n} 条记录",
			"history.rollback": "撤回这次修改",
			"history.rollbackConfirm": "撤回对「{path}」的这次修改？笔记会回到修改前的内容。",
			"history.rollbackDone": "已撤回：{message}",
			"history.rollbackFailed": "没能撤回：{message}",
			"history.detailTitle": "这次改了什么",
			"history.before": "修改前",
			"history.after": "修改后",
			"history.created": "新建",
			"history.updated": "更新",
			"history.appended": "追加",
			"history.deleted": "删除",
			"history.undone": "撤销",
			"history.restored": "恢复",
			"history.rolledBack": "撤回",
			"history.moved": "移动",
			"history.loadFailed": "现在读不到记录：{error}",
			"history.sessionLabel": "对话",
			"history.closeDetail": "关闭",
			"history.none": "没有内容",
			"history.truncated": "只显示开头部分",
			"panel.title": "库首页",
			"panel.close": "返回对话",
			"panel.unbound": "还没有绑定知识库",
			"panel.bindHeading": "绑定知识库",
			"panel.bindHint": "选择本机 Obsidian 库。",
			"panel.bind": "绑定",
			"panel.today": "今日日记",
			"panel.todayMissing": "今天的日记还不存在",
			"panel.todayMissingHint": "可按这个库已有的日记习惯创建",
			"panel.dailyHabit": "放在 {folder}，文件名按 {format}",
			"config.dailyFolder": "日记所在文件夹",
			"config.dailyFolderHint": "留空则沿用 Obsidian 的日记位置。",
			"config.dailyFolderNeedVault": "请先选择知识库。",
			"config.dailyFolderOutside": "请选择知识库内的文件夹。",
			"config.dailyFolderClear": "清除",
			"config.dailyFormat": "日记文件名的日期格式",
			"config.dailyFormatHint": "留空则沿用 Obsidian 的格式。",
			"config.dailyResolved": "按{source}，今天的日记是 {path}。",
			"panel.recent": "最近笔记",
			"panel.recentEmpty": "这个库里还没有笔记",
			"panel.noteCount": "{n} 篇",
			"panel.changes": "修改记录",
			"panel.changeCount": "{n} 条",
			"panel.broken": "失效链接",
			"panel.brokenNone": "没有发现失效链接",
			"panel.ask": "询问 Agent",
			"panel.send": "发送",
			"panel.composerPlaceholder": "说说你想对这个库做什么",
			"panel.prompt.read": "请阅读笔记 {path}，简要说明这篇在讲什么，然后等我的下一步。",
			"panel.prompt.todayMissing": "今天是 {date}。请创建或打开今日日记，路径必须是 {path}。",
			"panel.prompt.broken": "笔记 {from} 里有失效链接 [[{target}]]。请确认目标是否改名或移动，并给出修复建议。",
			"dash.kicker": "Obsidian",
			"dash.stat.notes": "{n} 篇笔记",
			"dash.stat.changes": "{n} 条修改",
			"dash.stat.broken": "{n} 条失效链接",
			"dash.stat.todayOn": "今日已有",
			"dash.stat.todayOff": "今日未建",
			"dash.actions": "快捷指令",
			"dash.action.daily": "写今日日记",
			"dash.action.weekly": "本周回顾",
			"dash.action.broken": "检查失效链接",
			"panel.prompt.dailyWork": "今天是 {date}。请把今天的工作摘要写入今日日记 {path}。若该路径不存在则创建。完成后告诉我路径。",
			"panel.prompt.weekly": "请读取最近 7 天的日记，按这个库已有的周报习惯生成本周回顾。先给出提纲，确认后再写入。",
			"panel.prompt.brokenSweep": "请扫描本库的失效链接，先给出报告：来源笔记、目标、是否像改名或移动。不要直接修改，等我确认后再修。",
			"home.widgets": "要显示的板块",
			"home.widgetsHint": "关掉的板块不会出现在首页。随时可以再打开。",
			"home.widget.continue": "最近笔记",
			"home.widget.continueHint": "你最近改过的笔记，点开可以预览。",
			"home.widget.changes": "修改记录",
			"home.widget.changesHint": "Agent 改过的笔记，可以撤回。",
			"home.widget.daily": "今日日记",
			"home.widget.dailyHint": "今天的日记。没有写日记的习惯就不用开。",
			"home.widget.search": "搜索",
			"home.widget.searchHint": "按关键词查找笔记。",
			"home.widget.structure": "文件夹与标签",
			"home.widget.structureHint": "库是怎么组织的，以及没有被任何笔记引用的篇目。",
			"home.widget.inbox": "待整理",
			"home.widget.inboxHint": "还堆在库根目录、没放进文件夹的笔记。",
			"home.widget.links": "失效链接",
			"home.widget.linksHint": "指向已经不存在的笔记的链接。附件引用有时会被误判。",
			"home.widget.actions": "快捷指令",
			"home.widget.actionsHint": "点一下，把常用任务填进底部提问框。不会自动发送。",
			"home.size.s": "小",
			"home.size.m": "中",
			"home.size.l": "大",
			"home.tile.menu": "设置",
			"home.arrange": "整理",
			"home.reserved": "这个板块暂时没有内容。",
			"home.actionsEmpty": "点一下填入提问框，不会发送。",
			"home.dailyNone": "未设置日记位置。",
			"home.dailyMissing": "今天的日记还不存在",
			"home.daily.ask": "Agent",
			"home.preview": "预览",
			"home.previewClose": "关闭",
			"home.previewTruncated": "只显示开头部分",
			"home.editorSave": "保存",
			"home.editorSaved": "已保存",
			"home.editorSource": "源码",
			"home.editorRender": "预览",
			"home.editorDirty": "未保存",
			"home.editorDiscard": "有未保存的修改，关闭将丢弃。",
			"home.wikilinks": "指向",
			"home.tags": "标签",
			"home.linksHint": "附件引用可能被误判。",
			"home.searchPlaceholder": "按标题或正文查找",
			"home.searchEmpty": "输入关键词后查找。",
			"home.searchNone": "没有找到匹配的笔记",
			"home.searchRun": "查找",
			"home.orphans": "没有被引用",
			"home.folders": "文件夹",
			"home.inboxEmpty": "根目录没有未归档的笔记",
			"home.detect": "从本机查找",
			"home.detectNone": "本机 Obsidian 里没有找到已登记的库",
			"home.detectHint": "点选即可绑定。",
			"home.detectOpen": "Obsidian 正在打开",
			"home.action.structure": "请概述这个库的结构",
			"home.action.search": "请在库中查找："
		};
		const en = {
			"nav.label": "Obsidian",
			"page.title": "Knowledge base",
			"page.subtitle": "Connect the Agent to your Obsidian vault. Choose where the vault is, whether it must ask before editing, and what appears on the home page.",
			"config.heading": "Settings",
			"config.heading.library": "Connect a vault",
			"config.heading.libraryLead": "Tell the Agent where your notes live. After you connect it, the Agent only reads and writes in this vault.",
			"config.heading.write": "When notes change",
			"config.heading.writeLead": "When the Agent wants to change a note, should it stop and wait for you first?",
			"config.heading.daily": "Daily notes",
			"config.heading.dailyLead": "If you keep a daily note in Obsidian, set its location here. Leave this empty if you do not.",
			"config.heading.home": "Home modules",
			"config.heading.homeLead": "Checked modules appear on the vault home. The title at the top and the question box at the bottom always stay.",
			"config.vaultDir": "Vault location",
			"config.vaultDirHint": "The folder of your Obsidian vault on this computer. Or choose one from the vaults Obsidian already knows.",
			"config.vaultDirEmpty": "Not selected",
			"config.vaultPick": "Choose folder",
			"config.vaultPickFailed": "Could not open the folder picker: {error}",
			"config.retentionUnit": "days",
			"config.writePolicy": "Ask before changing notes",
			"config.writePolicyHint": "Stricter choices are safer. Looser choices let the Agent move faster.",
			"config.writePolicy.perWrite": "Ask every time",
			"config.writePolicy.perWriteHint": "The Agent pauses for your OK before each note it changes.",
			"config.writePolicy.perTurn": "Ask once per session",
			"config.writePolicy.perTurnHint": "After you send one message, the Agent asks once, then may change several notes without asking again.",
			"config.writePolicy.auto": "Never ask; always allow",
			"config.writePolicy.autoHint": "The Agent changes notes, then tells you. Avoid this until you trust it.",
			"config.excludes": "Folders the Agent must not enter",
			"config.excludesHint": "Leave empty to exclude only Trash, Obsidian’s config, and this plugin’s records. One folder name per line.",
			"config.retention": "Keep records for",
			"config.retentionHint": "After this, those changes can no longer be undone.",
			"config.dailySource.obsidian": "Obsidian’s daily-note setting",
			"config.dailySource.override": "the location set on this page",
			"config.dailySource.none": "not set",
			"config.testRead": "Check that it can be read",
			"config.testRead.ok": "Readable: “{vault}”, {n} items at the top level",
			"config.testRead.fail": "Cannot read this location: {error}",
			"config.unavailable": "Settings could not be loaded. Try again in a moment.",
			"config.loading": "Loading…",
			"history.heading": "Change records",
			"history.lead": "Every change the Agent makes is listed here. Open one to compare before and after, or undo it.",
			"history.refresh": "Refresh",
			"history.empty": "No change records yet.",
			"history.entryCount": "{n} records",
			"history.rollback": "Undo this change",
			"history.rollbackConfirm": "Undo the change to “{path}”? The note will go back to how it was before.",
			"history.rollbackDone": "Undone: {message}",
			"history.rollbackFailed": "Could not undo: {message}",
			"history.detailTitle": "What changed",
			"history.before": "Before",
			"history.after": "After",
			"history.created": "created",
			"history.updated": "updated",
			"history.appended": "appended",
			"history.deleted": "deleted",
			"history.undone": "undone",
			"history.restored": "restored",
			"history.rolledBack": "undone",
			"history.moved": "moved",
			"history.loadFailed": "Could not load records: {error}",
			"history.sessionLabel": "Conversation",
			"history.closeDetail": "Close",
			"history.none": "Nothing here",
			"history.truncated": "Showing the beginning only",
			"panel.title": "Vault home",
			"panel.close": "Back to chat",
			"panel.unbound": "No vault is connected yet",
			"panel.bindHeading": "Connect a vault",
			"panel.bindHint": "The folder of your Obsidian vault on this computer.",
			"panel.bind": "Connect",
			"panel.today": "Today’s note",
			"panel.todayMissing": "Today’s note is not there yet",
			"panel.todayMissingHint": "Create it using this vault’s daily-note habit",
			"panel.dailyHabit": "In {folder}, filename uses {format}",
			"config.dailyFolder": "Folder for daily notes",
			"config.dailyFolderHint": "Leave empty to follow Obsidian’s daily-note location.",
			"config.dailyFolderNeedVault": "Choose a vault first.",
			"config.dailyFolderOutside": "Choose a folder inside the vault.",
			"config.dailyFolderClear": "Clear",
			"config.dailyFormat": "Date format in the daily-note filename",
			"config.dailyFormatHint": "Leave empty to follow Obsidian’s format.",
			"config.dailyResolved": "Today’s note is {path}, using {source}.",
			"panel.recent": "Recent notes",
			"panel.recentEmpty": "This vault has no notes yet",
			"panel.noteCount": "{n} notes",
			"panel.changes": "Change records",
			"panel.changeCount": "{n}",
			"panel.broken": "Broken links",
			"panel.brokenNone": "No broken links found",
			"panel.ask": "Ask",
			"panel.send": "Send",
			"panel.composerPlaceholder": "Describe what you want to do in this vault",
			"panel.prompt.read": "Read the note at {path}, summarize it, then wait.",
			"panel.prompt.todayMissing": "Today is {date}. Create or open the daily note at exactly {path}.",
			"panel.prompt.broken": "Note {from} has a broken wikilink [[{target}]]. Check whether the target was renamed or moved, and suggest a fix.",
			"dash.kicker": "Obsidian",
			"dash.stat.notes": "{n} notes",
			"dash.stat.changes": "{n} changes",
			"dash.stat.broken": "{n} broken",
			"dash.stat.todayOn": "Daily exists",
			"dash.stat.todayOff": "No daily yet",
			"dash.actions": "Shortcuts",
			"dash.action.daily": "Write today’s note",
			"dash.action.weekly": "Weekly review",
			"dash.action.broken": "Check broken links",
			"panel.prompt.dailyWork": "Today is {date}. Write today’s work summary into the daily note at {path}. Create that path if it is missing. Tell me the path when done.",
			"panel.prompt.weekly": "Read the last 7 daily notes and draft this week’s review in the vault’s existing weekly style. Outline first; write only after I confirm.",
			"panel.prompt.brokenSweep": "Scan this vault for broken wikilinks. Report sources, targets, and likely renames or moves first. Do not edit until I confirm.",
			"home.widgets": "Modules to show",
			"home.widgetsHint": "Unchecked modules stay off the home page. You can turn them back on at any time.",
			"home.widget.continue": "Recent notes",
			"home.widget.continueHint": "Notes you changed recently. Open one to preview it.",
			"home.widget.changes": "Change records",
			"home.widget.changesHint": "Notes the Agent changed; you can undo them.",
			"home.widget.daily": "Today’s note",
			"home.widget.dailyHint": "Your daily note. Leave this off if you do not keep one.",
			"home.widget.search": "Search",
			"home.widget.searchHint": "Find notes by keyword.",
			"home.widget.structure": "Folders and tags",
			"home.widget.structureHint": "How the vault is organized, plus notes that nothing else links to.",
			"home.widget.inbox": "Unfiled",
			"home.widget.inboxHint": "Notes still sitting at the vault root, not in a folder.",
			"home.widget.links": "Broken links",
			"home.widget.linksHint": "Links that point to notes that are gone. Attachment references are sometimes counted by mistake.",
			"home.widget.actions": "Shortcuts",
			"home.widget.actionsHint": "Fills the question box at the bottom. Nothing is sent until you send it.",
			"home.size.s": "S",
			"home.size.m": "M",
			"home.size.l": "L",
			"home.tile.menu": "Settings",
			"home.arrange": "Tidy",
			"home.reserved": "This module has no content yet.",
			"home.actionsEmpty": "A click fills the box below; nothing is sent.",
			"home.dailyNone": "No daily-note location is set.",
			"home.dailyMissing": "Today’s note is not there yet",
			"home.daily.ask": "Agent",
			"home.preview": "Preview",
			"home.previewClose": "Close",
			"home.previewTruncated": "Showing the beginning only",
			"home.editorSave": "Save",
			"home.editorSaved": "Saved",
			"home.editorSource": "Source",
			"home.editorRender": "Preview",
			"home.editorDirty": "Unsaved",
			"home.editorDiscard": "There are unsaved changes. Close and discard them?",
			"home.wikilinks": "Links to",
			"home.tags": "Tags",
			"home.linksHint": "Attachment references may be counted by mistake.",
			"home.searchPlaceholder": "Search titles or body",
			"home.searchEmpty": "Enter a keyword to search.",
			"home.searchNone": "No matching notes",
			"home.searchRun": "Search",
			"home.orphans": "Not linked",
			"home.folders": "Folders",
			"home.inboxEmpty": "No unfiled notes at the vault root",
			"home.detect": "Find on this computer",
			"home.detectNone": "No vaults were found in Obsidian on this computer",
			"home.detectHint": "Select one to connect it.",
			"home.detectOpen": "Open in Obsidian",
			"home.action.structure": "Summarize the structure of this vault",
			"home.action.search": "Search the vault for: "
		};
		//#endregion
		//#region src/client/rpc.ts
		const TIMEOUT_MS = 8e3;
		const PICK_TIMEOUT_MS = 600 * 1e3;
		function timeoutMs(endpoint) {
			return endpoint === "vault/pick" ? PICK_TIMEOUT_MS : TIMEOUT_MS;
		}
		function asResult(value, fallback) {
			if (value !== null && typeof value === "object" && "ok" in value) {
				const rec = value;
				if (rec.ok === true) return {
					ok: true,
					value: rec.value
				};
				return {
					ok: false,
					error: {
						code: rec.error?.code ?? "error",
						message: rec.error?.message ?? fallback
					}
				};
			}
			return {
				ok: false,
				error: {
					code: "error",
					message: fallback
				}
			};
		}
		async function fetchObsidian(endpoint, payload, signal) {
			const rpcId = crypto.randomUUID();
			const response = await fetch(new URL("/obsidian/" + endpoint, globalThis.location.origin), {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					type: "client-request",
					rpcId,
					method: endpoint,
					payload: payload ?? null
				}),
				signal
			});
			if (!response.ok) return {
				ok: false,
				error: {
					code: "http",
					message: "HTTP " + String(response.status)
				}
			};
			return asResult((await response.json()).result, "empty rpc result");
		}
		function createObsidianRpc(connection) {
			return async (endpoint, payload) => {
				const signal = AbortSignal.timeout(timeoutMs(endpoint));
				try {
					if (connection?.rpc !== void 0 && typeof connection.rpc.call === "function") return asResult(await connection.rpc.call("/obsidian", endpoint, payload ?? null, signal), "invalid rpc result");
					return await fetchObsidian(endpoint, payload, signal);
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					try {
						return await fetchObsidian(endpoint, payload, AbortSignal.timeout(timeoutMs(endpoint)));
					} catch {
						return {
							ok: false,
							error: {
								code: "transport",
								message
							}
						};
					}
				}
			};
		}
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
		const WIDGET_LABEL = {
			continue: "home.widget.continue",
			changes: "home.widget.changes",
			daily: "home.widget.daily",
			search: "home.widget.search",
			structure: "home.widget.structure",
			inbox: "home.widget.inbox",
			links: "home.widget.links",
			actions: "home.widget.actions"
		};
		const WRITE_POLICY = [
			{
				id: "per-write",
				title: "config.writePolicy.perWrite"
			},
			{
				id: "per-turn",
				title: "config.writePolicy.perTurn"
			},
			{
				id: "auto",
				title: "config.writePolicy.auto"
			}
		];
		const KIND_KEYS$1 = {
			create: "history.created",
			update: "history.updated",
			append: "history.appended",
			delete: "history.deleted",
			undo: "history.undone",
			restore: "history.restored",
			rollback: "history.rolledBack",
			move: "history.moved"
		};
		function fmtTime$1(ts) {
			return new Date(ts).toLocaleString();
		}
		function snapshotSourceKey(source) {
			if (source === "obsidian") return "config.dailySource.obsidian";
			if (source === "override") return "config.dailySource.override";
			return "config.dailySource.none";
		}
		let styleSeated = false;
		function seatStyle() {
			if (styleSeated) return;
			styleSeated = true;
			const style = document.createElement("style");
			style.id = "dsh-obsidian-section-style";
			style.textContent = [
				".obs-section { display: flex; flex-direction: column; gap: 28px; }",
				".obs-hero { display: flex; flex-direction: column; gap: 6px; }",
				".obs-title { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -.02em; line-height: 1.3; }",
				".obs-lead { margin: 0; font-size: 13px; line-height: 1.55; opacity: .68; }",
				".obs-block { display: flex; flex-direction: column; gap: 14px; padding-top: 18px; border-top: 1px solid rgba(128,128,140,.2); }",
				".obs-h { margin: 0; font-size: 15px; font-weight: 650; letter-spacing: -.01em; }",
				".obs-block .obs-lead { font-size: 12px; }",
				".obs-field { display: flex; flex-direction: column; gap: 6px; }",
				".obs-label { font-size: 13px; font-weight: 600; opacity: .92; }",
				".obs-hint { font-size: 12px; line-height: 1.5; opacity: .55; }",
				".obs-input { width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(128,128,140,.35); background: transparent; color: inherit; font: inherit; }",
				".obs-path-row { display: flex; gap: 8px; align-items: center; }",
				".obs-path-row .obs-path { flex: 1; min-width: 0; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(128,128,140,.35); }",
				".obs-path-row .obs-path.empty { opacity: .45; }",
				".obs-unit { display: flex; align-items: center; gap: 8px; }",
				".obs-unit .obs-input { width: 96px; }",
				".obs-unit .unit { font-size: 13px; opacity: .7; }",
				".obs-radio { display: flex; flex-direction: column; gap: 6px; }",
				".obs-radio label { display: flex; gap: 6px; align-items: center; font-size: 13px; }",
				".obs-check { display: flex; flex-direction: column; gap: 6px; }",
				".obs-check label { display: flex; gap: 8px; align-items: center; font-size: 13px; }",
				".obs-choice { display: flex; flex-direction: column; gap: 2px; min-width: 0; }",
				".obs-choice .name { font-weight: 600; }",
				".obs-choice .hint { font-size: 12px; line-height: 1.45; opacity: .55; }",
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
		var SettingsErrorBoundary = class extends react.Component {
			state = { err: null };
			static getDerivedStateFromError(error) {
				return { err: error instanceof Error ? error.message : String(error) };
			}
			componentDidCatch(error, info) {
				console.error("[dsh-obsidian-channel] settings section crashed:", error, info.componentStack);
			}
			render() {
				if (this.state.err !== null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "obs-msg err",
					children: this.state.err
				});
				return this.props.children;
			}
		};
		function ObsidianSettingsSection(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SettingsErrorBoundary, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ObsidianSettingsBody, { ...props }) });
		}
		function ObsidianSettingsBody({ t, rpc }) {
			seatStyle();
			const call = typeof rpc === "function" ? rpc : createObsidianRpc();
			const [cfg, setCfg] = (0, react.useState)(null);
			const [cfgStatus, setCfgStatus] = (0, react.useState)("loading");
			const loadConfig = (0, react.useCallback)(async () => {
				try {
					const res = await call("config/get");
					if (res.ok) {
						setCfg(res.value);
						setCfgStatus("ready");
					} else {
						setCfgStatus("unavailable");
						setRollbackMsg({
							kind: "err",
							text: res.error.message
						});
					}
				} catch (error) {
					setCfgStatus("unavailable");
					setRollbackMsg({
						kind: "err",
						text: error instanceof Error ? error.message : String(error)
					});
				}
			}, [call]);
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
			const [dailyMsg, setDailyMsg] = (0, react.useState)(null);
			const [detected, setDetected] = (0, react.useState)([]);
			const refresh = (0, react.useCallback)(async () => {
				setListBusy(true);
				setListError(null);
				try {
					const res = await call("history/list", { limit: 200 });
					if (res.ok) {
						const e = res.value.entries ?? [];
						setEntries(e);
					} else setListError(t("history.loadFailed", { error: res.error.message }));
				} catch (error) {
					setListError(t("history.loadFailed", { error: error instanceof Error ? error.message : String(error) }));
				}
				setListBusy(false);
			}, [call, t]);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			const openDetail = async (opId) => {
				setDetailBusy(true);
				setRollbackMsg(null);
				const res = await call("history/entry", { opId });
				setDetailBusy(false);
				if (res.ok) setSelected(res.value);
				else setRollbackMsg({
					kind: "err",
					text: t("history.loadFailed", { error: res.error.message })
				});
			};
			const doRollback = async () => {
				if (selected === null || rollbackBusy) return;
				if (!window.confirm(t("history.rollbackConfirm", { path: selected.path }))) return;
				setRollbackBusy(true);
				setRollbackMsg(null);
				const res = await call("history/rollback", { opId: selected.opId });
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
				const res = await call("vault/check", {});
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
			const doPickVault = async () => {
				setTestMsg(null);
				const res = await call("vault/pick");
				if (!res.ok) {
					setTestMsg({
						kind: "err",
						text: t("config.vaultPickFailed", { error: res.error.message })
					});
					return;
				}
				const path = String(res.value.path ?? "").trim();
				if (path === "") return;
				setField("vaultDir", path);
			};
			const doPickDaily = async () => {
				setDailyMsg(null);
				const res = await call("vault/pick", { kind: "daily" });
				if (!res.ok) {
					const code = res.error.code;
					const text = code === "vault-required" ? t("config.dailyFolderNeedVault") : code === "outside-vault" ? t("config.dailyFolderOutside") : t("config.vaultPickFailed", { error: res.error.message });
					setDailyMsg({
						kind: "err",
						text
					});
					return;
				}
				if (res.value.cancelled === true) return;
				const path = String(res.value.path ?? "").trim();
				setField("dailyFolder", path);
			};
			const doDetect = async () => {
				const res = await call("vault/detect");
				if (!res.ok) {
					setTestMsg({
						kind: "err",
						text: res.error.message
					});
					return;
				}
				const vaults = res.value.vaults ?? [];
				setDetected(vaults);
				if (vaults.length === 0) setTestMsg({
					kind: "err",
					text: t("home.detectNone")
				});
			};
			const setField = (field, value) => {
				call("config/set", {
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
			const dailySourceKey = snapshotSourceKey(snapshotValue?.daily?.source);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "obs-section",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("header", {
						className: "obs-hero",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							className: "obs-title",
							children: t("page.title")
						})
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
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: "obs-block",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "obs-h",
								children: t("config.heading.library")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "obs-field",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "obs-label",
										children: t("config.vaultDir")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "obs-path-row",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "obs-path" + ((snapshotValue?.vaultDir ?? "") === "" ? " empty" : ""),
											children: (snapshotValue?.vaultDir ?? "") === "" ? t("config.vaultDirEmpty") : snapshotValue?.vaultDir
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "obs-btn",
											onClick: () => {
												doPickVault();
											},
											children: t("config.vaultPick")
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: {
											display: "flex",
											gap: 8,
											alignItems: "center",
											marginTop: 4,
											flexWrap: "wrap"
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "obs-btn",
												onClick: () => {
													doTestRead();
												},
												children: t("config.testRead")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "obs-btn",
												onClick: () => {
													doDetect();
												},
												children: t("home.detect")
											}),
											testMsg !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: testMsg.kind === "ok" ? "obs-msg ok" : "obs-msg err",
												children: testMsg.text
											})
										]
									}),
									detected.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "obs-list",
										style: {
											maxHeight: 160,
											marginTop: 6
										},
										children: detected.map((vault) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "obs-row",
											onClick: () => setField("vaultDir", vault.path),
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "main",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "path",
													children: vault.path
												}), vault.open === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "meta",
													children: t("home.detectOpen")
												})]
											})
										}, vault.path))
									})
								]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: "obs-block",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									className: "obs-h",
									children: t("config.heading.write")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "obs-field",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "obs-label",
										children: t("config.writePolicy")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "obs-radio",
										children: WRITE_POLICY.map((policy) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: "dsh-obsidian-write-policy",
											checked: (snapshotValue?.writePolicy ?? "per-write") === policy.id,
											onChange: () => setField("writePolicy", policy.id)
										}), t(policy.title)] }, policy.id))
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
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: "obs-block",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									className: "obs-h",
									children: t("config.heading.daily")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "obs-field",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "obs-label",
											children: t("config.dailyFolder")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "obs-path-row",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "obs-path" + ((snapshotValue?.dailyFolder ?? "") === "" ? " empty" : ""),
													children: (snapshotValue?.dailyFolder ?? "") === "" ? t("config.vaultDirEmpty") : snapshotValue?.dailyFolder
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "obs-btn",
													onClick: () => {
														doPickDaily();
													},
													children: t("config.vaultPick")
												}),
												(snapshotValue?.dailyFolder ?? "") !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "obs-btn",
													onClick: () => setField("dailyFolder", ""),
													children: t("config.dailyFolderClear")
												})
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "obs-hint",
											children: t("config.dailyFolderHint")
										}),
										dailyMsg !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: dailyMsg.kind === "ok" ? "obs-msg ok" : "obs-msg err",
											children: dailyMsg.text
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
										snapshotValue?.daily != null && snapshotValue.daily.todayRel != null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "obs-hint",
											children: t("config.dailyResolved", {
												path: snapshotValue.daily.todayRel,
												source: t(dailySourceKey)
											})
										})
									]
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: "obs-block",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
								className: "obs-h",
								children: t("config.heading.home")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "obs-check",
								children: (snapshotValue?.homeWidgets ?? []).map((row) => {
									const label = WIDGET_LABEL[row.id];
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: row.enabled,
										onChange: () => {
											const next = (snapshotValue?.homeWidgets ?? []).map((item) => item.id === row.id ? {
												...item,
												enabled: !item.enabled
											} : item);
											setField("homeWidgets", next);
										}
									}), label !== void 0 ? t(label) : row.id] }, row.id);
								})
							})]
						})
					] }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "obs-block",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: 8
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									className: "obs-h",
									children: t("history.heading")
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
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "obs-field",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "obs-label",
										children: t("config.retention")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "obs-unit",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											className: "obs-input",
											type: "number",
											min: 1,
											value: snapshotValue?.journalRetentionDays ?? 30,
											onChange: (ev) => setField("journalRetentionDays", Number(ev.target.value) || 30)
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "unit",
											children: t("config.retentionUnit")
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "obs-hint",
										children: t("config.retentionHint")
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "obs-hint",
								children: t("history.entryCount", { n: String(entries.length) })
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
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "meta",
											children: fmtTime$1(e.ts)
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "obs-badge",
										children: t(KIND_KEYS$1[e.kind] ?? "history." + e.kind)
									})]
								}, e.opId))
							})
						]
					}),
					(selected !== null || detailBusy) && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "obs-block",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: 8
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", {
									className: "obs-h",
									children: [t("history.detailTitle"), selected !== null ? " · " + selected.path : ""]
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
							children: t("history.none")
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
							children: t("history.none")
						}) : diff.rows.map((r, i) => r.kind === "add" || r.kind === "same" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: r.kind === "add" ? "add line-add" : void 0,
							children: r.text || " "
						}, i) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "add",
							style: { opacity: 0 },
							children: " "
						}, i))]
					})]
				}), diff.truncated && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "obs-hint",
					children: t("history.truncated")
				})]
			});
		}
		//#endregion
		//#region src/home-catalog.js
		/**
		* Homepage widget catalog.
		*
		* The surface is a host: chrome (header / bind / composer) is fixed, everything
		* else is a named widget the user can toggle. Built-ins register here with a
		* default enabled flag. Unknown saved ids are ignored so later modules can be
		* added without breaking old config.
		*
		* Future third-party widgets are expected to use the same { id, enabled }
		* record and the client slot name `obsidian.home.widget`.
		*/
		const HOME_WIDGETS = [
			{
				id: "continue",
				enabled: true
			},
			{
				id: "changes",
				enabled: true
			},
			{
				id: "daily",
				enabled: false
			},
			{
				id: "search",
				enabled: false
			},
			{
				id: "structure",
				enabled: false
			},
			{
				id: "inbox",
				enabled: false
			},
			{
				id: "links",
				enabled: false
			},
			{
				id: "actions",
				enabled: false
			}
		];
		const HOME_WIDGET_IDS = HOME_WIDGETS.map((item) => item.id);
		const KNOWN = new Set(HOME_WIDGET_IDS);
		function mergeHomeWidgets(saved) {
			const byId = /* @__PURE__ */ new Map();
			if (Array.isArray(saved)) for (const row of saved) {
				if (row === null || typeof row !== "object") continue;
				const id = typeof row.id === "string" ? row.id : "";
				if (!KNOWN.has(id)) continue;
				byId.set(id, row.enabled === true);
			}
			return HOME_WIDGETS.map((item) => ({
				id: item.id,
				enabled: byId.has(item.id) ? byId.get(item.id) : item.enabled
			}));
		}
		function enabledWidgetIds(saved) {
			return mergeHomeWidgets(saved).filter((item) => item.enabled).map((item) => item.id);
		}
		const SIZES = {
			s: {
				w: 1,
				h: 1
			},
			m: {
				w: 2,
				h: 1
			},
			l: {
				w: 4,
				h: 2
			}
		};
		const DEFAULT_SIZE = {
			continue: "m",
			changes: "m",
			daily: "m",
			search: "m",
			structure: "m",
			inbox: "m",
			links: "m",
			actions: "m"
		};
		function coerceSize(value) {
			if (value === "s" || value === "m" || value === "l") return value;
			return "s";
		}
		function inferSize(row) {
			if (row && (row.size === "s" || row.size === "m" || row.size === "l")) return row.size;
			const w = Number(row?.w);
			if (Number.isFinite(w) && w > 4) return DEFAULT_SIZE[row?.id] ?? "m";
			const h = Number(row?.h);
			if (Number.isFinite(w) && Number.isFinite(h)) {
				if (w >= 4 && h >= 2) return "l";
				if (w >= 2 && h >= 2) return "l";
				if (w >= 2 || h >= 2) return "m";
			}
			return DEFAULT_SIZE[row?.id] ?? "m";
		}
		function looksLegacy(saved) {
			if (!Array.isArray(saved) || saved.length === 0) return false;
			return saved.some((row) => {
				if (row === null || typeof row !== "object") return false;
				const w = Number(row.w);
				const y = Number(row.y);
				if (Number.isFinite(w) && w > 4) return true;
				if (row.size !== "s" && row.size !== "m" && row.size !== "l" && Number.isFinite(w)) return true;
				if (Number.isFinite(y) && y > 8) return true;
				return false;
			});
		}
		/** Saved rows from the 2-column board have no cols:4 stamp. */
		function looksTwoCol(saved) {
			if (!Array.isArray(saved) || saved.length === 0) return false;
			return saved.some((row) => {
				if (row === null || typeof row !== "object") return false;
				if (DEFAULT_SIZE[row.id] === void 0) return false;
				return row.cols !== 4;
			});
		}
		function clampX(x, w) {
			const width = Math.max(1, Number(w) || 1);
			const xi = Number.isFinite(Number(x)) ? Math.round(Number(x)) : 0;
			return Math.max(0, Math.min(4 - width, xi));
		}
		/** Map a 2-column slot onto the 4-column board: old small → medium. */
		function fromTwoCol(row) {
			const id = typeof row?.id === "string" ? row.id : "";
			const old = inferSize({
				...row,
				id
			});
			const y = Math.max(0, Number(row?.y) || 0);
			if (old === "s") return {
				id,
				size: "m",
				x: row?.x === 1 ? 2 : 0,
				y
			};
			if (old === "l") return {
				id,
				size: "l",
				x: 0,
				y
			};
			return {
				id,
				size: "m",
				x: 0,
				y
			};
		}
		function shiftUp(items) {
			if (!Array.isArray(items) || items.length === 0) return items;
			let minY = Infinity;
			for (const item of items) minY = Math.min(minY, Math.max(0, Number(item.y) || 0));
			if (!Number.isFinite(minY) || minY <= 0) return items;
			return items.map((item) => ({
				...item,
				y: Math.max(0, (Number(item.y) || 0) - minY)
			}));
		}
		function dimOf(size) {
			return SIZES[coerceSize(size)] ?? SIZES.s;
		}
		function footprint(item) {
			const dim = dimOf(item.size);
			const x = clampX(item.x, dim.w);
			const y = Math.max(0, Number(item.y) || 0);
			return {
				id: item.id,
				x,
				y,
				w: dim.w,
				h: dim.h,
				size: coerceSize(item.size),
				cols: 4
			};
		}
		function overlaps(a, b) {
			return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
		}
		function fitsFree(rect, others) {
			return others.every((item) => item.id === rect.id || !overlaps(rect, item));
		}
		function firstFit(size, occupied, startY = 0) {
			const dim = dimOf(size);
			const maxX = 4 - dim.w;
			for (let y = Math.max(0, startY); y < 80; y++) for (let x = 0; x <= maxX; x++) if (fitsFree({
				id: "_",
				x,
				y,
				w: dim.w,
				h: dim.h
			}, occupied)) return {
				x,
				y
			};
			return {
				x: 0,
				y: 0
			};
		}
		function placedSlot(id, size, x, y) {
			const dim = dimOf(size);
			return {
				id,
				size,
				x,
				y,
				w: dim.w,
				h: dim.h,
				cols: 4
			};
		}
		function packItems(items) {
			const placed = [];
			for (const item of items) {
				const size = coerceSize(item.size);
				const wish = footprint({
					...item,
					size
				});
				const pos = fitsFree(wish, placed) ? {
					x: wish.x,
					y: wish.y
				} : firstFit(size, placed, wish.y);
				placed.push(placedSlot(item.id, size, pos.x, pos.y));
			}
			return placed;
		}
		function compactItems(items) {
			const ordered = [...items].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0) || String(a.id).localeCompare(String(b.id)));
			const placed = [];
			for (const item of ordered) {
				const size = coerceSize(item.size);
				const pos = firstFit(size, placed, 0);
				placed.push(placedSlot(item.id, size, pos.x, pos.y));
			}
			return placed;
		}
		function moveItem(items, id, x, y) {
			const current = items.find((row) => row.id === id);
			if (current === void 0) return items;
			const size = coerceSize(current.size);
			const moved = placedSlot(id, size, clampX(x, dimOf(size).w), Math.max(0, Math.round(Number(y) || 0)));
			const rest = items.filter((row) => row.id !== id).sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
			const placed = [moved];
			for (const item of rest) {
				const nextSize = coerceSize(item.size);
				const wish = footprint(item);
				const pos = fitsFree(wish, placed) ? {
					x: wish.x,
					y: wish.y
				} : firstFit(nextSize, placed, wish.y);
				placed.push(placedSlot(item.id, nextSize, pos.x, pos.y));
			}
			return placed;
		}
		function resizeItem(items, id, size) {
			const nextSize = coerceSize(size);
			const current = items.find((row) => row.id === id);
			if (current === void 0) return items;
			const dim = dimOf(nextSize);
			const wish = footprint({
				...current,
				size: nextSize,
				x: dim.w === 2 ? 0 : current.x
			});
			const others = items.filter((row) => row.id !== id).map(footprint);
			const pos = fitsFree(wish, others) ? {
				x: wish.x,
				y: wish.y
			} : firstFit(nextSize, others, wish.y);
			const resized = {
				id,
				size: nextSize,
				x: pos.x,
				y: pos.y,
				w: dim.w,
				h: dim.h
			};
			return moveItem(items.map((row) => row.id === id ? resized : row), id, resized.x, resized.y);
		}
		function spanOf(items) {
			let max = 0;
			for (const item of items) max = Math.max(max, (item.y ?? 0) + dimOf(item.size).h);
			return max;
		}
		function mergeHomeLayout(saved, ids) {
			const wanted = Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && DEFAULT_SIZE[id] !== void 0) : Object.keys(DEFAULT_SIZE);
			const twoCol = looksTwoCol(saved);
			const byId = /* @__PURE__ */ new Map();
			if (Array.isArray(saved)) for (const row of saved) {
				if (row === null || typeof row !== "object") continue;
				const id = typeof row.id === "string" ? row.id : "";
				if (DEFAULT_SIZE[id] === void 0) continue;
				if (twoCol) {
					byId.set(id, fromTwoCol({
						...row,
						id
					}));
					continue;
				}
				const size = inferSize({
					...row,
					id
				});
				byId.set(id, {
					id,
					size,
					x: clampX(row.x, dimOf(size).w),
					y: Math.max(0, Number(row.y) || 0)
				});
			}
			const rows = wanted.map((id) => byId.get(id) ?? {
				id,
				size: DEFAULT_SIZE[id] ?? "m",
				x: 0,
				y: 99
			});
			const placed = rows.filter((row) => row.y < 99);
			const savedHasHidden = Array.isArray(saved) && saved.some((row) => row && DEFAULT_SIZE[row.id] && !wanted.includes(row.id));
			const floated = placed.length > 0 && placed.every((row) => row.y >= 1);
			if (twoCol || looksLegacy(saved) || floated || savedHasHidden && spanOf(placed) > spanOf(compactItems(placed))) return compactItems(rows);
			rows.sort((a, b) => a.y - b.y || a.x - b.x);
			return packItems(shiftUp(rows));
		}
		function upsertHomeLayout(prev, next) {
			const byId = /* @__PURE__ */ new Map();
			for (const row of mergeHomeLayout(prev)) byId.set(row.id, row);
			if (Array.isArray(next)) for (const row of next) {
				if (row === null || typeof row !== "object" || DEFAULT_SIZE[row.id] === void 0) continue;
				byId.set(row.id, footprint({
					id: row.id,
					size: inferSize(row),
					x: row.x,
					y: row.y
				}));
			}
			return packItems([...byId.values()]);
		}
		function layoutBoardHeight(rects) {
			let max = 0;
			for (const rect of rects) {
				const dim = dimOf(rect.size);
				max = Math.max(max, (rect.y ?? 0) + dim.h);
			}
			if (max === 0) return 0;
			return max * 210 + (max - 1) * 16;
		}
		function tileStyle(item, colW, z) {
			const dim = dimOf(item.size);
			const x = clampX(item.x, dim.w);
			const y = item.y ?? 0;
			return {
				left: x * (colW + 16),
				top: y * 226,
				width: dim.w * colW + (dim.w - 1) * 16,
				height: dim.h * 210 + (dim.h - 1) * 16,
				zIndex: z ?? 20 - y
			};
		}
		//#endregion
		//#region src/client/HomeBoard.tsx
		const DRAG_THRESHOLD = 6;
		function HomeBoard({ ids, saved, onCommit, renderTile, t }) {
			const boardRef = (0, react.useRef)(null);
			const dragRef = (0, react.useRef)(null);
			const commitRef = (0, react.useRef)(onCommit);
			commitRef.current = onCommit;
			const colWRef = (0, react.useRef)(160);
			const [colW, setColW] = (0, react.useState)(160);
			const [slots, setSlots] = (0, react.useState)(() => mergeHomeLayout(saved, ids));
			const [dragId, setDragId] = (0, react.useState)(null);
			const [menuId, setMenuId] = (0, react.useState)(null);
			colWRef.current = colW;
			(0, react.useEffect)(() => {
				if (dragRef.current !== null) return;
				setSlots(mergeHomeLayout(saved, ids));
			}, [ids.join("|"), saved]);
			(0, react.useEffect)(() => {
				const el = boardRef.current;
				if (el === null) return;
				const measure = () => {
					const width = el.clientWidth;
					setColW(Math.max(80, (width - 48) / 4));
				};
				measure();
				const ro = new ResizeObserver(measure);
				ro.observe(el);
				return () => ro.disconnect();
			}, []);
			const cellAt = (clientX, clientY, grabX, grabY) => {
				const board = boardRef.current;
				if (board === null) return {
					x: 0,
					y: 0
				};
				const box = board.getBoundingClientRect();
				const left = clientX - box.left - grabX;
				const top = clientY - box.top - grabY;
				const stepX = colWRef.current + 16;
				return {
					x: Math.max(0, Math.min(3, Math.round(left / stepX))),
					y: Math.max(0, Math.round(top / 226))
				};
			};
			const endDrag = () => {
				if (dragRef.current === null) return;
				const wasArmed = dragRef.current.armed;
				dragRef.current = null;
				setDragId(null);
				if (wasArmed) setSlots((prev) => {
					commitRef.current(prev);
					return prev;
				});
			};
			(0, react.useEffect)(() => {
				const onMove = (ev) => {
					const drag = dragRef.current;
					if (drag === null || ev.pointerId !== drag.pointerId) return;
					const dist = Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY);
					if (!drag.armed) {
						if (dist < DRAG_THRESHOLD) return;
						drag.armed = true;
						setDragId(drag.id);
						setMenuId(null);
					}
					const cell = cellAt(ev.clientX, ev.clientY, drag.grabX, drag.grabY);
					setSlots((prev) => moveItem(prev, drag.id, cell.x, cell.y));
				};
				const onUp = (ev) => {
					const drag = dragRef.current;
					if (drag === null || ev.pointerId !== drag.pointerId) return;
					endDrag();
				};
				window.addEventListener("pointermove", onMove);
				window.addEventListener("pointerup", onUp);
				window.addEventListener("pointercancel", onUp);
				window.addEventListener("blur", endDrag);
				return () => {
					window.removeEventListener("pointermove", onMove);
					window.removeEventListener("pointerup", onUp);
					window.removeEventListener("pointercancel", onUp);
					window.removeEventListener("blur", endDrag);
				};
			}, []);
			(0, react.useEffect)(() => {
				if (menuId === null) return;
				const onDown = (ev) => {
					if (ev.target?.closest("[data-ob-tile-menu]") !== null) return;
					setMenuId(null);
				};
				const onKey = (ev) => {
					if (ev.key === "Escape") setMenuId(null);
				};
				window.addEventListener("pointerdown", onDown, true);
				window.addEventListener("keydown", onKey);
				return () => {
					window.removeEventListener("pointerdown", onDown, true);
					window.removeEventListener("keydown", onKey);
				};
			}, [menuId]);
			const byId = (0, react.useMemo)(() => {
				const map = /* @__PURE__ */ new Map();
				for (const slot of slots) map.set(slot.id, slot);
				return map;
			}, [slots]);
			const commit = (next) => {
				setSlots(next);
				onCommit(next);
			};
			const startDrag = (id, ev) => {
				if (ev.button !== 0) return;
				if (ev.target?.closest("button") !== null) return;
				const tile = ev.currentTarget.parentElement;
				if (tile === null) return;
				const box = tile.getBoundingClientRect();
				dragRef.current = {
					id,
					pointerId: ev.pointerId,
					grabX: ev.clientX - box.left,
					grabY: ev.clientY - box.top,
					startX: ev.clientX,
					startY: ev.clientY,
					armed: false
				};
			};
			const height = layoutBoardHeight(slots);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ob-board-wrap",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "ob-board-bar",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ob-btn",
						onClick: () => commit(compactItems(slots)),
						children: t("home.arrange")
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					ref: boardRef,
					className: "ob-board",
					style: { height },
					children: ids.map((id) => {
						const slot = byId.get(id);
						if (slot === void 0) return null;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ob-tile" + (dragId === id ? " dragging" : "") + (menuId === id ? " menu-open" : ""),
							"data-size": slot.size,
							style: tileStyle(slot, colW, dragId === id || menuId === id ? 40 : void 0),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "ob-drag",
									onPointerDown: (ev) => startDrag(id, ev)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "ob-tile-gear",
									"data-ob-tile-menu": true,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "ob-tile-more" + (menuId === id ? " on" : ""),
										"aria-label": t("home.tile.menu"),
										"aria-haspopup": "menu",
										"aria-expanded": menuId === id,
										onClick: () => setMenuId((cur) => cur === id ? null : id),
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
											width: "14",
											height: "14",
											viewBox: "0 0 14 14",
											"aria-hidden": "true",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
													cx: "3",
													cy: "7",
													r: "1.25",
													fill: "currentColor"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
													cx: "7",
													cy: "7",
													r: "1.25",
													fill: "currentColor"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
													cx: "11",
													cy: "7",
													r: "1.25",
													fill: "currentColor"
												})
											]
										})
									}), menuId === id && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "ob-tile-menu",
										role: "menu",
										children: [
											"s",
											"m",
											"l"
										].map((size) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											role: "menuitemradio",
											"aria-checked": slot.size === size,
											className: "ob-tile-menu-item" + (slot.size === size ? " on" : ""),
											onClick: () => {
												commit(resizeItem(slots, id, size));
												setMenuId(null);
											},
											children: t("home.size." + size)
										}, size))
									})]
								}),
								renderTile(id)
							]
						}, id);
					})
				})]
			});
		}
		//#endregion
		//#region src/client/markdown.ts
		/** Small, escaped Markdown renderer for the in-app note preview. */
		function escapeHtml(value) {
			return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
		}
		function safeHref(raw) {
			const href = raw.trim();
			if (/^https?:\/\//i.test(href) || href.startsWith("/") || href.startsWith("#")) return href;
			return null;
		}
		function inline(text) {
			let out = escapeHtml(text);
			const codes = [];
			out = out.replace(/`([^`]+)`/g, (_, code) => {
				codes.push("<code>" + code + "</code>");
				return "\0C" + String(codes.length - 1) + "\0";
			});
			out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, href) => {
				const safe = safeHref(href);
				if (safe === null) return escapeHtml(alt || href);
				return "<img alt=\"" + alt + "\" src=\"" + escapeHtml(safe) + "\">";
			});
			out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
				const safe = safeHref(href);
				if (safe === null) return label;
				return "<a href=\"" + escapeHtml(safe) + "\" target=\"_blank\" rel=\"noreferrer\">" + label + "</a>";
			});
			out = out.replace(/\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => {
				return "<span class=\"wiki\">" + (alias || target) + "</span>";
			});
			out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
			out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
			out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
			out = out.replace(/_([^_]+)_/g, "<em>$1</em>");
			out = out.replace(/(^|[\s(])#([A-Za-z0-9_\u4e00-\u9fff/-]+)/g, "$1<span class=\"tag\">#$2</span>");
			return out.replace(/\u0000C(\d+)\u0000/g, (_, i) => codes[Number(i)] ?? "");
		}
		function splitFrontmatter(source) {
			const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
			if (match === null) return {
				fm: null,
				body: source
			};
			return {
				fm: match[1] ?? "",
				body: source.slice(match[0].length)
			};
		}
		function flushParagraph(buf, html) {
			const text = buf.join("\n").trim();
			if (text !== "") html.push("<p>" + inline(text).replace(/\n/g, "<br>") + "</p>");
			buf.length = 0;
		}
		function renderMarkdown(source) {
			const { fm, body } = splitFrontmatter(source);
			const html = [];
			if (fm !== null && fm.trim() !== "") html.push("<pre class=\"fm\">" + escapeHtml(fm) + "</pre>");
			const lines = body.replace(/\r\n/g, "\n").split("\n");
			const para = [];
			let i = 0;
			while (i < lines.length) {
				const line = lines[i] ?? "";
				if (line.startsWith("```")) {
					flushParagraph(para, html);
					const lang = escapeHtml(line.slice(3).trim());
					const chunk = [];
					i += 1;
					while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
						chunk.push(lines[i] ?? "");
						i += 1;
					}
					html.push("<pre><code" + (lang !== "" ? " data-lang=\"" + lang + "\"" : "") + ">" + escapeHtml(chunk.join("\n")) + "</code></pre>");
					i += 1;
					continue;
				}
				const heading = /^(#{1,6})[ \t]+(.+)$/.exec(line);
				if (heading !== null) {
					flushParagraph(para, html);
					const level = heading[1]?.length ?? 1;
					html.push("<h" + String(level) + ">" + inline(heading[2] ?? "") + "</h" + String(level) + ">");
					i += 1;
					continue;
				}
				if (/^([-*_])\1{2,}\s*$/.test(line)) {
					flushParagraph(para, html);
					html.push("<hr>");
					i += 1;
					continue;
				}
				if (/^>[ \t]?/.test(line)) {
					flushParagraph(para, html);
					const quote = [];
					while (i < lines.length && /^>[ \t]?/.test(lines[i] ?? "")) {
						quote.push((lines[i] ?? "").replace(/^>[ \t]?/, ""));
						i += 1;
					}
					html.push("<blockquote>" + renderMarkdown(quote.join("\n")) + "</blockquote>");
					continue;
				}
				if (/^\s*[-*][ \t]+/.test(line) || /^\s*\d+\.[ \t]+/.test(line)) {
					flushParagraph(para, html);
					const ordered = /^\s*\d+\.[ \t]+/.test(line);
					const items = [];
					while (i < lines.length && (ordered ? /^\s*\d+\.[ \t]+/ : /^\s*[-*][ \t]+/).test(lines[i] ?? "")) {
						items.push((lines[i] ?? "").replace(ordered ? /^\s*\d+\.[ \t]+/ : /^\s*[-*][ \t]+/, ""));
						i += 1;
					}
					const tag = ordered ? "ol" : "ul";
					html.push("<" + tag + ">" + items.map((item) => "<li>" + inline(item) + "</li>").join("") + "</" + tag + ">");
					continue;
				}
				if (line.trim() === "") {
					flushParagraph(para, html);
					i += 1;
					continue;
				}
				para.push(line);
				i += 1;
			}
			flushParagraph(para, html);
			return html.join("");
		}
		//#endregion
		//#region src/client/NoteEditor.tsx
		function NoteEditor({ path, rpc, t, onClose, onSaved, createIfMissing = false, seed = "" }) {
			const [doc, setDoc] = (0, react.useState)(null);
			const [draft, setDraft] = (0, react.useState)("");
			const [status, setStatus] = (0, react.useState)("loading");
			const [error, setError] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [savedFlash, setSavedFlash] = (0, react.useState)(false);
			const load = async (target) => {
				setStatus("loading");
				setError(null);
				const res = await rpc("surface/preview", {
					path: target,
					allowMissing: createIfMissing
				});
				if (!res.ok) {
					setStatus("error");
					setError(res.error.message);
					return;
				}
				const value = res.value;
				const source = typeof value.source === "string" ? value.source : String(value.body ?? "");
				const nextSource = value.missing === true ? "" : source;
				setDoc({
					path: value.path,
					title: value.title,
					source: nextSource,
					version: value.version
				});
				setDraft(value.missing === true ? seed : nextSource);
				setStatus("ready");
			};
			(0, react.useEffect)(() => {
				load(path);
			}, [
				path,
				createIfMissing,
				seed
			]);
			const dirty = doc !== null && draft !== doc.source;
			const html = (0, react.useMemo)(() => renderMarkdown(draft), [draft]);
			const close = () => {
				if (dirty && !window.confirm(t("home.editorDiscard"))) return;
				onClose();
			};
			const save = async () => {
				if (doc === null || busy || !dirty) return;
				setBusy(true);
				setError(null);
				const res = await rpc("surface/save", {
					path: doc.path,
					content: draft,
					version: doc.version
				});
				setBusy(false);
				if (!res.ok) {
					setError(res.error.message);
					return;
				}
				const value = res.value;
				const source = typeof value.source === "string" ? value.source : draft;
				setDoc({
					path: value.path ?? doc.path,
					title: value.title ?? doc.title,
					source,
					version: value.version ?? doc.version
				});
				setDraft(source);
				setSavedFlash(true);
				window.setTimeout(() => setSavedFlash(false), 1600);
				onSaved();
			};
			(0, react.useEffect)(() => {
				const onKey = (ev) => {
					if (ev.key === "Escape") {
						ev.preventDefault();
						close();
					}
					if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "s") {
						ev.preventDefault();
						save();
					}
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			});
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ob-overlay",
				"data-dsh-obsidian-editor": "",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ob-overlay-back",
					"aria-label": t("home.previewClose"),
					onClick: close
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ob-overlay-sheet",
					role: "dialog",
					"aria-modal": "true",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: "ob-modal-h",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "ob-modal-title",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "name",
									children: doc?.title ?? path
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "meta",
									children: [doc?.path ?? path, dirty ? " · " + t("home.editorDirty") : savedFlash ? " · " + t("home.editorSaved") : ""]
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "ob-actions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "ob-btn primary",
									disabled: !dirty || busy || status !== "ready",
									onClick: () => {
										save();
									},
									children: t("home.editorSave")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "ob-btn",
									onClick: close,
									children: t("home.previewClose")
								})]
							})]
						}),
						status === "loading" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "ob-hint wrap",
							children: t("config.loading")
						}),
						error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "ob-msg err",
							children: error
						}),
						status === "ready" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ob-editor",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								className: "ob-editor-pane",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "ob-editor-label",
									children: t("home.editorSource")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									className: "ob-editor-src",
									value: draft,
									spellCheck: false,
									onChange: (ev) => setDraft(ev.target.value)
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								className: "ob-editor-pane",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "ob-editor-label",
									children: t("home.editorRender")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "ob-md",
									dangerouslySetInnerHTML: { __html: html || " " }
								})]
							})]
						})
					]
				})]
			}), document.body);
		}
		//#endregion
		//#region src/client/ObsidianPanel.tsx
		/**
		* Center-column Obsidian surface: chrome + a widget host.
		*
		* Chrome (header / bind / composer) is fixed. Everything else is a named
		* widget from home-catalog, toggled in Settings. Built-ins render here;
		* the reserved slot name for later injectors is `obsidian.home.widget`.
		*/
		const KIND_KEYS = {
			create: "history.created",
			update: "history.updated",
			append: "history.appended",
			delete: "history.deleted",
			undo: "history.undone",
			restore: "history.restored",
			rollback: "history.rolledBack",
			move: "history.moved"
		};
		const DIFF_LINE_CAP = 200;
		const WIDGET_TITLE = {
			continue: "home.widget.continue",
			changes: "home.widget.changes",
			daily: "home.widget.daily",
			search: "home.widget.search",
			structure: "home.widget.structure",
			inbox: "home.widget.inbox",
			links: "home.widget.links",
			actions: "home.widget.actions"
		};
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
		function orderedHomeWidgets(rows) {
			const on = rows.filter((row) => row.enabled);
			const lead = ["continue", "changes"];
			const head = lead.flatMap((id) => on.filter((row) => row.id === id));
			const rest = on.filter((row) => !lead.includes(row.id));
			return [...head, ...rest];
		}
		function fileStem(path) {
			return (path.split("/").pop() ?? path).replace(/\.md$/i, "");
		}
		function NoteLine({ path, title }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "main",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "path",
					children: title !== null && title.trim() !== "" ? title : fileStem(path)
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "meta",
					children: path
				})]
			});
		}
		function ObsidianPanel({ controller, rpc, t, onTalk }) {
			const [open, setOpen] = (0, react.useState)(controller.getSnapshot().panelOpen);
			(0, react.useEffect)(() => controller.subscribe(() => setOpen(controller.getSnapshot().panelOpen)), [controller]);
			const [vaultDir, setVaultDir] = (0, react.useState)("");
			const [needBind, setNeedBind] = (0, react.useState)(false);
			const [homeWidgets, setHomeWidgets] = (0, react.useState)(HOME_WIDGETS);
			const [overview, setOverview] = (0, react.useState)(null);
			const [status, setStatus] = (0, react.useState)("idle");
			const [error, setError] = (0, react.useState)(null);
			const [draft, setDraft] = (0, react.useState)("");
			const [talkBusy, setTalkBusy] = (0, react.useState)(false);
			const [talkError, setTalkError] = (0, react.useState)(null);
			const [detected, setDetected] = (0, react.useState)([]);
			const [openNote, setOpenNote] = (0, react.useState)(null);
			const [homeLayout, setHomeLayout] = (0, react.useState)(() => mergeHomeLayout([]));
			const load = (0, react.useCallback)(async () => {
				setStatus("loading");
				setError(null);
				const cfg = await rpc("config/get");
				if (!cfg.ok) {
					setStatus("error");
					setError(cfg.error.message);
					return;
				}
				const value = cfg.value;
				const dir = String(value.vaultDir ?? "").trim();
				const widgets = Array.isArray(value.homeWidgets) ? value.homeWidgets : HOME_WIDGETS;
				setVaultDir(dir);
				setHomeWidgets(widgets);
				setHomeLayout(mergeHomeLayout(value.homeLayout));
				if (dir === "") {
					setNeedBind(true);
					setOverview(null);
					setStatus("ready");
					const found = await rpc("vault/detect");
					if (found.ok) setDetected(found.value.vaults ?? []);
					return;
				}
				setNeedBind(false);
				const res = await rpc("surface/overview", { widgets: enabledWidgetIds(widgets) });
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
			const bind = async (path) => {
				const dir = path.trim();
				if (dir === "") return;
				const res = await rpc("config/set", {
					field: "vaultDir",
					value: dir
				});
				if (!res.ok) {
					setError(res.error.message);
					return;
				}
				await load();
			};
			const pickVault = async () => {
				setError(null);
				const res = await rpc("vault/pick");
				if (!res.ok) {
					setError(t("config.vaultPickFailed", { error: res.error.message }));
					return;
				}
				const path = String(res.value.path ?? "").trim();
				if (path !== "") await bind(path);
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
			const enabled = orderedHomeWidgets(homeWidgets);
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
							needBind && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card, {
								span2: true,
								title: t("panel.bindHeading"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "ob-btn primary",
									onClick: () => {
										pickVault();
									},
									children: t("config.vaultPick")
								}), detected.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "ob-hint wrap",
									children: t("home.detectHint")
								}), detected.map((vault) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "ob-row",
									onClick: () => {
										bind(vault.path);
									},
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "main",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "path",
											children: vault.path
										}), vault.open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "meta",
											children: t("home.detectOpen")
										})]
									})
								}, vault.id))] })]
							}),
							overview !== null && !needBind && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HomeBoard, {
								ids: enabled.map((row) => row.id),
								saved: homeLayout,
								t,
								onCommit: (next) => {
									const full = upsertHomeLayout(homeLayout, next);
									setHomeLayout(full);
									rpc("config/set", {
										field: "homeLayout",
										value: full
									});
								},
								renderTile: (id) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WidgetCard, {
									id,
									overview,
									rpc,
									t,
									enabledIds: enabled.map((item) => item.id),
									onRefresh: () => {
										load();
									},
									onFill: (text) => setDraft(text),
									onOpenNote: (path, opts) => setOpenNote({
										path,
										...opts
									}),
									onAskAgent: (text) => {
										talk(text);
									},
									askBusy: talkBusy
								})
							})
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
					}),
					openNote !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NoteEditor, {
						path: openNote.path,
						createIfMissing: openNote.createIfMissing === true,
						seed: openNote.seed,
						rpc,
						t,
						onClose: () => setOpenNote(null),
						onSaved: () => {
							load();
						}
					})
				]
			});
		}
		function Card({ id, title, count, span2, action, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "ob-card" + (span2 ? " span2" : "") + (action !== void 0 ? " has-agent" : ""),
				"data-home-widget": id,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ob-card-h",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: title }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ob-card-h-right",
						children: [count !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "ob-count",
							children: count
						}), action]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "ob-card-body",
					children
				})]
			});
		}
		function WidgetCard({ id, overview, rpc, t, enabledIds, onRefresh, onFill, onOpenNote, onAskAgent, askBusy }) {
			const titleKey = WIDGET_TITLE[id];
			const title = titleKey !== void 0 ? t(titleKey) : id;
			if (id === "continue") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContinueWidget, {
				overview,
				t,
				title,
				onOpenNote
			});
			if (id === "changes") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChangesWidget, {
				overview,
				rpc,
				t,
				title,
				onRefresh
			});
			if (id === "daily") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DailyWidget, {
				overview,
				t,
				title,
				onOpenNote,
				onAskAgent,
				askBusy
			});
			if (id === "links") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LinksWidget, {
				overview,
				t,
				title,
				onOpenNote
			});
			if (id === "search") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SearchWidget, {
				rpc,
				t,
				title,
				onOpenNote
			});
			if (id === "structure") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StructureWidget, {
				overview,
				t,
				title,
				onOpenNote
			});
			if (id === "inbox") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(InboxWidget, {
				overview,
				t,
				title,
				onOpenNote
			});
			if (id === "actions") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ActionsWidget, {
				enabledIds,
				overview,
				t,
				title,
				onFill
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Card, {
				id,
				title,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "ob-hint wrap",
					children: t("home.reserved")
				})
			});
		}
		function ContinueWidget({ overview, t, title, onOpenNote }) {
			const recent = overview.recent ?? [];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card, {
				id: "continue",
				title,
				count: t("panel.noteCount", { n: String(overview.noteCount ?? recent.length) }),
				children: [recent.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "ob-hint wrap",
					children: t("panel.recentEmpty")
				}), recent.map((note) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "ob-row",
					onClick: () => onOpenNote(note.path),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NoteLine, {
						path: note.path,
						title: note.title
					})
				}, note.path))]
			});
		}
		function DailyWidget({ overview, t, title, onOpenNote, onAskAgent, askBusy }) {
			const daily = overview.daily;
			if (daily === void 0 || daily.source === "none" || daily.todayRel === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Card, {
				id: "daily",
				title,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "ob-hint wrap",
					children: t("home.dailyNone")
				})
			});
			const path = daily.todayRel;
			const missing = overview.today === null;
			const prompt = missing ? t("panel.prompt.todayMissing", {
				date: overview.todayDate ?? daily.stamp,
				path
			}) : t("panel.prompt.dailyWork", {
				date: overview.todayDate ?? daily.stamp,
				path
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Card, {
				id: "daily",
				title,
				action: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ob-card-agent",
					disabled: askBusy,
					"aria-label": t("home.daily.ask"),
					onClick: () => onAskAgent(prompt),
					children: t("home.daily.ask")
				}),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ob-daily-hit",
					onClick: () => onOpenNote(path, {
						createIfMissing: missing,
						seed: missing ? "# " + (daily.stamp ?? "") + "\n\n" : void 0
					}),
					children: missing ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "ob-daily-date",
						children: daily.stamp
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "ob-hint wrap",
						children: path
					})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(NoteLine, {
						path: overview.today.path,
						title: overview.today.title
					}), overview.today?.excerpt !== void 0 && overview.today.excerpt !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "ob-hint wrap",
						children: overview.today.excerpt
					})] })
				})
			});
		}
		function ChangesWidget({ overview, rpc, t, title, onRefresh }) {
			const changes = overview.changes ?? [];
			const [selected, setSelected] = (0, react.useState)(null);
			const [rollbackBusy, setRollbackBusy] = (0, react.useState)(false);
			const [rollbackMsg, setRollbackMsg] = (0, react.useState)(null);
			const openChange = async (opId) => {
				const res = await rpc("history/entry", { opId });
				if (res.ok) setSelected(res.value);
				else setRollbackMsg(res.error.message);
			};
			const rollback = async () => {
				if (selected === null || rollbackBusy) return;
				if (!window.confirm(t("history.rollbackConfirm", { path: selected.path }))) return;
				setRollbackBusy(true);
				setRollbackMsg(null);
				const res = await rpc("history/rollback", { opId: selected.opId });
				setRollbackBusy(false);
				if (!res.ok) {
					setRollbackMsg(res.error.message);
					return;
				}
				setSelected(null);
				onRefresh();
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card, {
				id: "changes",
				title,
				count: t("panel.changeCount", { n: String(changes.length) }),
				children: [
					changes.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ob-hint wrap",
						children: t("history.empty")
					}),
					changes.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
							alignItems: "center",
							flexWrap: "wrap"
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
			});
		}
		function LinksWidget({ overview, t, title, onOpenNote }) {
			const broken = overview.broken ?? [];
			const count = overview.brokenCount ?? broken.length;
			const orphans = overview.orphans ?? [];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card, {
				id: "links",
				title,
				count: String(count),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ob-hint wrap",
						children: t("home.linksHint")
					}),
					count === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ob-hint wrap",
						children: t("panel.brokenNone")
					}),
					broken.map((link, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ob-row",
						onClick: () => onOpenNote(link.from),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
						})
					}, link.from + "->" + link.target + i)),
					orphans.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ob-hint wrap",
						children: [
							t("home.orphans"),
							" · ",
							overview.orphanCount ?? orphans.length
						]
					}), orphans.map((path) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ob-row",
						onClick: () => onOpenNote(path),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "main",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "path",
								children: path
							})
						})
					}, path))] })
				]
			});
		}
		function SearchWidget({ rpc, t, title, onOpenNote }) {
			const [query, setQuery] = (0, react.useState)("");
			const [hits, setHits] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const run = async () => {
				const q = query.trim();
				if (q === "") {
					setHits(null);
					return;
				}
				setBusy(true);
				const res = await rpc("surface/search", {
					query: q,
					limit: 20
				});
				setBusy(false);
				if (res.ok) setHits(res.value.matches ?? []);
				else setHits([]);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card, {
				id: "search",
				title,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ob-search",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "ob-input",
							value: query,
							placeholder: t("home.searchPlaceholder"),
							onChange: (ev) => setQuery(ev.target.value),
							onKeyDown: (ev) => {
								if (ev.key === "Enter") {
									ev.preventDefault();
									run();
								}
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ob-btn",
							disabled: busy,
							onClick: () => {
								run();
							},
							children: t("home.searchRun")
						})]
					}),
					hits === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ob-hint wrap",
						children: t("home.searchEmpty")
					}),
					hits !== null && hits.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ob-hint wrap",
						children: t("home.searchNone")
					}),
					(hits ?? []).map((hit) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ob-row",
						onClick: () => onOpenNote(hit.path),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "main",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "path",
								children: hit.title || fileStem(hit.path)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "meta",
								children: hit.snippet || hit.path
							})]
						})
					}, hit.path))
				]
			});
		}
		function StructureWidget({ overview, t, title, onOpenNote }) {
			const folders = overview.folders ?? [];
			const tags = overview.tags ?? [];
			const orphans = overview.orphans ?? [];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card, {
				id: "structure",
				title,
				count: t("panel.noteCount", { n: String(overview.noteCount ?? 0) }),
				children: [
					folders.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ob-hint wrap",
						children: t("home.folders")
					}), folders.map((folder) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ob-row static",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "main",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "path",
								children: folder.name
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "ob-badge",
							children: folder.count
						})]
					}, folder.name))] }),
					tags.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ob-hint wrap",
						children: t("home.tags")
					}), tags.map((tag) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ob-row static",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "main",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "path",
								children: ["#", tag.name]
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "ob-badge",
							children: tag.count
						})]
					}, tag.name))] }),
					orphans.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ob-hint wrap",
						children: [
							t("home.orphans"),
							" · ",
							overview.orphanCount ?? orphans.length
						]
					}), orphans.map((path) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ob-row",
						onClick: () => onOpenNote(path),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "main",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "path",
								children: path
							})
						})
					}, path))] })
				]
			});
		}
		function InboxWidget({ overview, t, title, onOpenNote }) {
			const inbox = overview.inbox ?? [];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card, {
				id: "inbox",
				title,
				count: String(inbox.length),
				children: [inbox.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "ob-hint wrap",
					children: t("home.inboxEmpty")
				}), inbox.map((note) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "ob-row",
					onClick: () => onOpenNote(note.path),
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NoteLine, {
						path: note.path,
						title: note.title
					})
				}, note.path))]
			});
		}
		function ActionsWidget({ enabledIds, overview, t, title, onFill }) {
			const chips = [];
			if (enabledIds.includes("daily") && overview.daily?.source !== "none" && overview.daily?.todayRel) chips.push({
				key: "daily",
				label: t("dash.action.daily"),
				text: t("panel.prompt.dailyWork", {
					date: overview.todayDate ?? "",
					path: overview.daily.todayRel
				})
			});
			if (enabledIds.includes("structure")) chips.push({
				key: "structure",
				label: t("home.action.structure"),
				text: t("home.action.structure")
			});
			if (enabledIds.includes("links")) chips.push({
				key: "links",
				label: t("dash.action.broken"),
				text: t("panel.prompt.brokenSweep")
			});
			if (enabledIds.includes("search")) chips.push({
				key: "search",
				label: t("home.widget.search"),
				text: t("home.action.search")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Card, {
				id: "actions",
				title,
				children: [chips.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "ob-hint wrap",
					children: t("home.actionsEmpty")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "ob-quick",
					children: chips.map((chip) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "ob-chip",
						onClick: () => onFill(chip.text),
						children: chip.label
					}, chip.key))
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
		*
		* Do not remount this root from a MutationObserver: the center column is
		* owned by the shell React tree. Re-entering createRoot/unmount during its
		* commit (settings dialog, session switch) tears down the settings UI.
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
			let host;
			const mountInto = (column) => {
				if (container !== void 0 && column.contains(container)) return;
				root?.unmount();
				container?.remove();
				if (host !== void 0) delete host.dataset.dshObsidianHost;
				host = column;
				host.dataset.dshObsidianHost = "";
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
			let evictingSiblings = false;
			const applyActive = () => {
				if (controller.getSnapshot().panelOpen) {
					const column = conversationColumn();
					if (column !== void 0) mountInto(column);
					evictingSiblings = true;
					document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: "ssh" }));
					document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: "taskboard" }));
					evictingSiblings = false;
					for (const attr of SIBLING_ATTRS) document.documentElement.removeAttribute(attr);
					document.querySelectorAll("[data-dsh-ssh-entry][data-active], [data-dsh-taskboard-entry][data-active]").forEach((el) => {
						el.removeAttribute("data-active");
					});
					document.documentElement.setAttribute(ACTIVE_ATTR, "");
					document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: PANEL_NAME }));
				} else document.documentElement.removeAttribute(ACTIVE_ATTR);
			};
			const onOtherActivate = (event) => {
				if (evictingSiblings) return;
				if (event.detail !== PANEL_NAME && controller.getSnapshot().panelOpen) controller.close();
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
			const stopWait = watchUntilFound(conversationColumn, (column) => {
				if (controller.getSnapshot().panelOpen) mountInto(column);
				else host = column;
			});
			applyActive();
			return () => {
				document.removeEventListener("click", onClickSidebarRow, true);
				document.removeEventListener(ACTIVATE_EVENT, onOtherActivate);
				stopWait();
				unsubscribe();
				document.documentElement.removeAttribute(ACTIVE_ATTR);
				if (host !== void 0) delete host.dataset.dshObsidianHost;
				root?.unmount();
				root = void 0;
				container?.remove();
				container = void 0;
				host = void 0;
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
			const rpc = createObsidianRpc(ctx.connection);
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
				label: () => {
					try {
						return t("nav.label");
					} catch {
						return "Obsidian";
					}
				},
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
