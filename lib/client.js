window.__ModuleLoader__.load({
	id: "dsh-obsidian-channel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
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
		const DIFF_LINE_CAP = 500;
		function diffLines(a, b) {
			const al = a.split("\n").slice(0, DIFF_LINE_CAP);
			const bl = b.split("\n").slice(0, DIFF_LINE_CAP);
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
				truncated: a.split("\n").length > DIFF_LINE_CAP || b.split("\n").length > DIFF_LINE_CAP
			};
		}
		const KIND_KEYS = {
			create: "history.created",
			update: "history.updated",
			append: "history.appended",
			delete: "history.deleted",
			undo: "history.undone",
			restore: "history.restored",
			rollback: "history.rolledBack"
		};
		function fmtTime(ts) {
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
												fmtTime(e.ts),
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
										children: t(KIND_KEYS[e.kind] ?? "history." + e.kind)
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
			const diff = (0, react.useMemo)(() => diffLines(before ?? "", after ?? ""), [before, after]);
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
						DIFF_LINE_CAP,
						" 行）"
					]
				})]
			});
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
		/** Close any sibling center-column panels so the conversation is visible again. */
		function dismissSiblingPanels() {
			document.documentElement.removeAttribute("data-dsh-taskboard-active");
			document.documentElement.removeAttribute("data-dsh-ssh-active");
			document.dispatchEvent(new CustomEvent("dsh-panel-activate", { detail: "obsidian" }));
		}
		/**
		* Mount the Obsidian sidebar entry.
		*
		* The click handler reads the configured vault through the plugin's own
		* `/obsidian` RPC (config/get). On first use it prompts for the vault path and
		* persists it (config/set); once configured, the vault is registered as a DSH
		* workspace (`workspaces.create`) and a session is opened there
		* (`workspaces.startSession`) — i.e. the entry behaves like a native workspace.
		*
		* @param ctx - client root context (services: workspaces, connection).
		* @returns disposer removing the entry and its observers.
		*/
		function mountObsidianEntry(ctx) {
			if (typeof document !== "undefined" && document.querySelector("[data-dsh-obsidian-entry]") !== null) return () => {};
			const openVault = async (vaultDir) => {
				try {
					const ws = await ctx.workspaces.create({ path: vaultDir });
					dismissSiblingPanels();
					ctx.workspaces.startSession(ws.workspaceId);
				} catch (error) {
					console.error("[dsh-obsidian-channel] failed to open vault session:", error);
				}
			};
			const onClick = () => {
				(async () => {
					const res = await ctx.connection.rpc.call("/obsidian", "config/get", null);
					if (!res.ok) {
						console.error("[dsh-obsidian-channel] config/get failed:", res.error?.message);
						return;
					}
					const vaultDir = res.value?.vaultDir;
					if (vaultDir) {
						await openVault(vaultDir);
						return;
					}
					const path = window.prompt("请输入你的 Obsidian vault 绝对路径：", "");
					if (path === null || path.trim() === "") return;
					const setRes = await ctx.connection.rpc.call("/obsidian", "config/set", {
						field: "vaultDir",
						value: path.trim()
					});
					if (!setRes.ok) {
						console.error("[dsh-obsidian-channel] config/set failed:", setRes.error?.message);
						return;
					}
					await openVault(path.trim());
				})();
			};
			const entry = createEntry(onClick);
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
			tryPlace();
			return () => {
				waitObserver.disconnect();
				rootObserver?.disconnect();
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
			"history.closeDetail": "关闭详情"
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
			"history.closeDetail": "Close detail"
		};
		//#endregion
		//#region src/client/index.tsx
		/** Required client services: slots registry, workspaces (vault workspace), locale, connection RPC. */
		const inject = [
			"slots",
			"workspaces",
			"locale",
			"connection"
		];
		/** Sidebar entry styles (plain CSS, injected once; mirrors the shell nav-item look). */
		const ENTRY_STYLE = [
			"[data-dsh-obsidian-entry]{display:flex;align-items:center;gap:8px;width:100%;padding:6px 10px;border-radius:6px;background:transparent;border:1px solid transparent;color:inherit;cursor:pointer;font:inherit;font-size:13px}",
			"[data-dsh-obsidian-entry]:hover{background:var(--dsw-specific-sidebar-nav-item-hover,rgba(128,128,140,.12))}",
			"[data-dsh-obsidian-entry] .entryIcon{display:inline-flex;align-items:center;color:var(--dsw-alias-text-accent,#a78bfa)}",
			"[data-dsh-obsidian-entry] .entryLabel{flex:1;text-align:left}"
		].join("\n");
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-obsidian: dictionaries");
			const t = ctx.locale.bind(NS);
			let styleSeated = false;
			ctx.effect(() => {
				if (!styleSeated) {
					styleSeated = true;
					const style = document.createElement("style");
					style.id = "dsh-obsidian-entry-style";
					style.textContent = ENTRY_STYLE;
					document.head.appendChild(style);
				}
				return mountObsidianEntry(ctx);
			}, "dsh-obsidian: sidebar entry");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-obsidian-channel",
				order: 100,
				label: () => t("nav.label"),
				locale: NS,
				inject: () => ({ rpc: (endpoint, payload) => ctx.connection.rpc.call("/obsidian", endpoint, payload ?? null) })
			}, ObsidianSettingsSection));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
