/**
 * Injected styles for the sidebar entry and the center-column Obsidian
 * surface. Attribute-scoped so nothing leaks; colors ride --dsw-* tokens.
 */

const STYLE_ID = 'dsh-obsidian-ui-style'

const CSS = [
  // --- sidebar entry --------------------------------------------------------
  '[data-dsh-obsidian-entry]{display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 12px;border-radius:8px;background:transparent;border:none;color:var(--dsw-alias-label-secondary,inherit);cursor:pointer;font:inherit;font-size:13px;white-space:nowrap}',
  '[data-dsh-obsidian-entry]:hover{background:var(--dsw-specific-sidebar-nav-item-hover,rgba(128,128,140,.12));color:var(--dsw-alias-label-primary,inherit)}',
  '[data-dsh-obsidian-entry][data-active]{background:var(--dsw-specific-sidebar-nav-item-active,rgba(167,139,250,.18));color:var(--dsw-alias-label-primary,inherit);font-weight:600}',
  '[data-dsh-obsidian-entry] .entryIcon{display:inline-flex;align-items:center;justify-content:center;flex:none;color:var(--dsw-alias-text-accent,#a78bfa)}',
  '[data-dsh-obsidian-entry] .entryLabel{flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis}',
  '[data-dsh-frame][data-sidebar-collapsed] [data-dsh-obsidian-entry]{justify-content:center;padding:0}',
  '[data-dsh-frame][data-sidebar-collapsed] [data-dsh-obsidian-entry] .entryLabel{display:none}',

  // --- center-column takeover ----------------------------------------------
  '[data-pane="conversation"],[class*="centerCol"]{position:relative}',
  '[data-dsh-obsidian-view]{position:absolute;inset:0;display:none;z-index:61;background:var(--dsw-alias-bg-base,#111);color:var(--dsw-alias-label-primary,inherit)}',
  'html[data-dsh-obsidian-active] [data-dsh-obsidian-view]{display:block}',
  'html[data-dsh-obsidian-active] [data-pane="conversation"]>:not([data-dsh-obsidian-view]),html[data-dsh-obsidian-active] [class*="centerCol"]>:not([data-dsh-obsidian-view]){display:none!important}',
  'html[data-dsh-obsidian-active] [data-dsh-taskboard-view],html[data-dsh-obsidian-active] [data-dsh-ssh-view]{display:none!important}',

  // --- dashboard ------------------------------------------------------------
  '[data-dsh-obsidian-view] .ob-surface{display:flex;flex-direction:column;height:100%;min-height:0;padding:18px 22px 16px;gap:14px;box-sizing:border-box;font-family:var(--dsw-font-family,inherit)}',
  '[data-dsh-obsidian-view] .ob-kicker{margin:0 0 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-text-accent,#a78bfa);opacity:.9}',
  '[data-dsh-obsidian-view] .ob-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex:none}',
  '[data-dsh-obsidian-view] .ob-title{margin:0;font-size:22px;font-weight:700;letter-spacing:-.02em}',
  '[data-dsh-obsidian-view] .ob-sub{margin:4px 0 0;font-size:12px;opacity:.6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:52vw}',
  '[data-dsh-obsidian-view] .ob-actions{display:flex;gap:8px;flex:none}',
  '[data-dsh-obsidian-view] .ob-btn{padding:5px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,140,.4));background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:13px}',
  '[data-dsh-obsidian-view] .ob-btn:disabled{opacity:.5;cursor:default}',
  '[data-dsh-obsidian-view] .ob-btn.primary{border-color:var(--dsw-alias-text-accent,#a78bfa);color:var(--dsw-alias-text-accent,#a78bfa)}',
  '[data-dsh-obsidian-view] .ob-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;flex:none}',
  '[data-dsh-obsidian-view] .ob-stat{padding:10px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,140,.22));background:var(--dsw-alias-bg-layer-2,rgba(128,128,140,.06))}',
  '[data-dsh-obsidian-view] .ob-stat .n{display:block;font-size:16px;font-weight:700;line-height:1.2}',
  '[data-dsh-obsidian-view] .ob-stat .l{display:block;margin-top:2px;font-size:11px;opacity:.55}',
  '[data-dsh-obsidian-view] .ob-stat.warn .n{color:#f0b429}',
  '[data-dsh-obsidian-view] .ob-quick{display:flex;flex-wrap:wrap;gap:8px;align-items:center;flex:none}',
  '[data-dsh-obsidian-view] .ob-quick-label{font-size:12px;opacity:.55;margin-right:4px}',
  '[data-dsh-obsidian-view] .ob-chip{padding:6px 12px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,140,.35));background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:13px}',
  '[data-dsh-obsidian-view] .ob-chip:hover{border-color:var(--dsw-alias-text-accent,#a78bfa);color:var(--dsw-alias-text-accent,#a78bfa)}',
  '[data-dsh-obsidian-view] .ob-body{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);grid-auto-rows:auto;gap:12px;flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;align-content:start}',
  '[data-dsh-obsidian-view] .ob-card{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border:1px solid var(--dsw-alias-border-l1,rgba(128,128,140,.22));border-radius:12px;background:var(--dsw-alias-bg-layer-2,transparent);min-width:0}',
  '[data-dsh-obsidian-view] .ob-card.span2{grid-column:1/-1}',
  '[data-dsh-obsidian-view] .ob-card-h{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;font-weight:600;line-height:1.55;min-width:0}',
  '[data-dsh-obsidian-view] .ob-card-h>span:first-child{flex:none}',
  '[data-dsh-obsidian-view] .ob-count{font-weight:500;opacity:.65;font-size:12px;line-height:1.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}',
  '[data-dsh-obsidian-view] .ob-hint{font-size:12px;line-height:1.55;opacity:.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '[data-dsh-obsidian-view] .ob-msg{font-size:12px}',
  '[data-dsh-obsidian-view] .ob-msg.err{color:#ff6b6b}',
  '[data-dsh-obsidian-view] .ob-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px;border-radius:8px;cursor:pointer;border:1px solid transparent;min-width:0}',
  '[data-dsh-obsidian-view] .ob-row:hover{background:rgba(128,128,140,.08);border-color:rgba(128,128,140,.18)}',
  '[data-dsh-obsidian-view] .ob-row .main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}',
  '[data-dsh-obsidian-view] .ob-row .path{font-size:13px;line-height:1.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}',
  '[data-dsh-obsidian-view] .ob-row .meta{font-size:11px;line-height:1.55;opacity:.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}',
  '[data-dsh-obsidian-view] .ob-stat{min-width:0}',
  '[data-dsh-obsidian-view] .ob-stat .n{line-height:1.45;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '[data-dsh-obsidian-view] .ob-stat .l{line-height:1.45;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '[data-dsh-obsidian-view] .ob-badge{flex:none;font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid rgba(128,128,140,.4)}',
  '[data-dsh-obsidian-view] .ob-link{flex:none;font-size:12px;opacity:.75;background:none;border:none;color:var(--dsw-alias-text-accent,#a78bfa);cursor:pointer;padding:0}',
  '[data-dsh-obsidian-view] .ob-input,[data-dsh-obsidian-view] .ob-area{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,140,.35));background:var(--dsw-specific-input-major,transparent);color:inherit;font:inherit;font-size:13px}',
  '[data-dsh-obsidian-view] .ob-composer{display:flex;gap:8px;align-items:flex-end;flex:none;padding-top:4px;border-top:1px solid var(--dsw-alias-border-l1,rgba(128,128,140,.18))}',
  '[data-dsh-obsidian-view] .ob-composer .ob-area{flex:1;min-height:52px;resize:vertical}',
  '@media (max-width:900px){[data-dsh-obsidian-view] .ob-stats{grid-template-columns:repeat(2,minmax(0,1fr))}[data-dsh-obsidian-view] .ob-body{grid-template-columns:1fr}}',
  '[data-dsh-obsidian-view] .ob-diff{display:flex;flex-direction:column;border:1px solid rgba(128,128,140,.22);border-radius:8px;overflow:hidden;max-height:240px}',
  '[data-dsh-obsidian-view] .ob-diff .pane{display:flex;overflow:auto}',
  '[data-dsh-obsidian-view] .ob-diff .col{flex:1;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.45;white-space:pre-wrap;word-break:break-all;padding:6px 10px}',
  '[data-dsh-obsidian-view] .ob-diff .col+.col{border-left:1px solid rgba(128,128,140,.2)}',
  '[data-dsh-obsidian-view] .ob-diff .pane-head{padding:6px 10px;font-size:11px;opacity:.65;border-bottom:1px solid rgba(128,128,140,.2)}',
  '[data-dsh-obsidian-view] .ob-diff .del{background:rgba(255,107,107,.12);color:#ff6b6b}',
  '[data-dsh-obsidian-view] .ob-diff .add{background:rgba(81,200,138,.12);color:#51c88a}',
].join('\n')

/** Seat the stylesheet once per page. */
export function seatStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}
