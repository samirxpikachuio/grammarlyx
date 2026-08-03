import { Correction, PanelMode, RewriteTone, REWRITE_TONES, TRANSLATE_LANGUAGES } from '../lib/deepseek';

export type TabId = 'improve' | 'grammar' | 'translate' | 'rephrase' | 'shorten' | 'formal' | 'more';

const PRIMARY_TABS: { id: TabId; label: string }[] = [
  { id: 'improve', label: 'Improve' },
  { id: 'grammar', label: 'Fix Grammar' },
  { id: 'translate', label: 'Translate' },
  { id: 'rephrase', label: 'Rephrase' },
  { id: 'shorten', label: 'Shorten' },
  { id: 'formal', label: 'Formal' },
  { id: 'more', label: 'More' },
];

// "more" expands into these sub-modes
const MORE_TABS: { id: 'clarity' | 'humanize'; label: string }[] = [
  { id: 'clarity', label: 'Clarity & Concision' },
  { id: 'humanize', label: 'Humanize' },
];

// Maps a panel tab (+ optional sub-tab) to the underlying analysis mode used by deepseek.ts
export function tabToPanelMode(tab: TabId, subTab: 'clarity' | 'humanize' | null): PanelMode | null {
  switch (tab) {
    case 'improve': return 'improve';
    case 'grammar': return 'grammar';
    case 'rephrase': return 'paraphrase';
    case 'shorten': return 'shorten';
    case 'formal': return 'formal';
    case 'more': return subTab;
    default: return null; // translate has no direct panel mode
  }
}

export interface PanelField {
  element: HTMLElement;
}

type AcceptHandler = (correction: Correction) => void;
type AcceptAllHandler = (corrections: Correction[]) => void;

interface PanelHandlers {
  onRequestMode: (tab: TabId, subTab: 'clarity' | 'humanize' | null) => void;
  onAccept: AcceptHandler;
  onAcceptAll: AcceptAllHandler;
  onTranslateRequest: (targetLanguage: string) => void;
  onTranslateReplace: (translated: string) => void;
  onToneRequest: (tone: RewriteTone) => void;
  onToneReplace: (rewritten: string) => void;
  onCopy: (text: string) => void;
}

export class UIInjector {
  private container: HTMLElement;
  private shadowRoot: ShadowRoot;

  // Panel state
  private panelEl: HTMLElement | null = null;
  private panelField: PanelField | null = null;
  private activeTab: TabId = 'improve';
  private activeSubTab: 'clarity' | 'humanize' = 'clarity';
  private handlers: PanelHandlers | null = null;

  // Language badge state (one per field, tracked by element id)
  private badgeEls: Map<string, HTMLElement> = new Map();
  private spellingBadgeEls: Map<string, HTMLElement> = new Map();

  private updateScheduled = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'open-grammarly-root';
    this.container.style.position = 'fixed';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100vw';
    this.container.style.height = '100vh';
    this.container.style.pointerEvents = 'none';
    this.container.style.zIndex = '2147483647';
    document.body.appendChild(this.container);

    this.shadowRoot = this.container.attachShadow({ mode: 'open' });
    this.injectStyles();

    document.addEventListener('mousedown', (e) => {
      if (this.panelEl && !this.container.contains(e.target as Node)) {
        const field = this.panelField?.element;
        if (field && field.contains(e.target as Node)) return;
        this.closePanel();
      }
    });

    window.addEventListener('scroll', () => this.scheduleReposition(), { passive: true, capture: true });
    window.addEventListener('resize', () => this.scheduleReposition(), { passive: true });
  }

  private scheduleReposition() {
    if (this.updateScheduled) return;
    this.updateScheduled = true;
    requestAnimationFrame(() => {
      this.repositionPanel();
      this.repositionBadges();
      this.updateScheduled = false;
    });
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
      }

      /* ---- Language badge ---- */
      .og-lang-badge {
        position: absolute;
        display: flex;
        align-items: center;
        gap: 4px;
        background: #111827;
        color: white;
        font-size: 11px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 999px;
        pointer-events: auto;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        z-index: 2147483646;
        user-select: none;
      }
      .og-lang-badge:hover { background: #1f2937; }
      .og-lang-badge .og-lang-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #34d399;
      }

      /* ---- Spelling badge ---- */
      .og-spelling-badge {
        position: absolute;
        background: #dc2626;
        color: white;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 8px;
        border-radius: 999px;
        pointer-events: auto;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(220, 38, 38, 0.35);
        z-index: 2147483646;
        user-select: none;
        white-space: nowrap;
      }
      .og-spelling-badge:hover { background: #b91c1c; }

      /* ---- Docked panel ---- */
      .og-panel {
        position: fixed;
        width: 380px;
        max-width: 92vw;
        background: linear-gradient(180deg, #ecfdf7 0%, #ffffff 55%);
        border: 1px solid #d1fae5;
        border-radius: 18px;
        box-shadow: 0 12px 40px rgba(6, 78, 59, 0.18);
        pointer-events: auto;
        overflow: hidden;
        z-index: 2147483647;
        color: #0f172a;
        animation: og-panel-in 0.14s ease-out;
      }
      @keyframes og-panel-in {
        from { transform: translateY(6px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .og-tabs {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 10px 10px 8px;
        overflow-x: auto;
        scrollbar-width: none;
        border-bottom: 1px solid rgba(16, 185, 129, 0.15);
      }
      .og-tabs::-webkit-scrollbar { display: none; }
      .og-tab-btn {
        background: none;
        border: none;
        font-size: 13px;
        font-weight: 600;
        color: #6b7280;
        padding: 6px 10px;
        border-radius: 8px;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .og-tab-btn:hover {
        background: rgba(16, 185, 129, 0.08);
        color: #065f46;
      }
      .og-tab-btn.og-tab-active {
        color: #047857;
        background: rgba(16, 185, 129, 0.12);
      }

      .og-panel-close {
        margin-left: auto;
        background: none;
        border: none;
        color: #9ca3af;
        font-size: 16px;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 6px;
        flex-shrink: 0;
      }
      .og-panel-close:hover {
        background: rgba(0,0,0,0.05);
        color: #374151;
      }

      .og-panel-body {
        padding: 14px 16px 12px;
        max-height: 340px;
        overflow-y: auto;
      }

      .og-mode-heading {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 700;
        color: #059669;
        margin-bottom: 8px;
      }

      .og-more-heading {
        margin-top: 14px;
        font-size: 11px;
        font-weight: 700;
        color: #9ca3af;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .og-diff-text {
        font-size: 14px;
        line-height: 1.65;
        color: #1f2937;
        white-space: pre-wrap;
      }
      .og-diff-del {
        color: #9ca3af;
        text-decoration: line-through;
        text-decoration-color: #f87171;
      }
      .og-diff-ins {
        color: #047857;
        font-weight: 700;
        background: rgba(16, 185, 129, 0.12);
        border-radius: 3px;
        padding: 0 2px;
      }

      .og-empty-state, .og-loading-state, .og-error-state {
        font-size: 13px;
        color: #6b7280;
        padding: 10px 2px 4px;
      }
      .og-error-state { color: #dc2626; }

      .og-loading-state {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .og-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid #a7f3d0;
        border-top-color: #059669;
        border-radius: 50%;
        animation: og-spin 0.7s linear infinite;
        flex-shrink: 0;
      }
      @keyframes og-spin { to { transform: rotate(360deg); } }

      .og-suggestion-item {
        border-bottom: 1px solid rgba(16, 185, 129, 0.1);
        padding: 10px 0;
      }
      .og-suggestion-item:last-child { border-bottom: none; }
      .og-suggestion-explanation {
        font-size: 11.5px;
        color: #6b7280;
        margin-top: 6px;
      }
      .og-suggestion-accept-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 6px;
      }
      .og-mini-accept {
        background: #d1fae5;
        color: #065f46;
        border: none;
        font-size: 11.5px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 6px;
        cursor: pointer;
      }
      .og-mini-accept:hover { background: #a7f3d0; }

      .og-panel-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 16px 14px;
      }
      .og-btn {
        padding: 8px 14px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        border: none;
      }
      .og-btn-primary { background: #059669; color: white; }
      .og-btn-primary:hover { background: #047857; }
      .og-btn-primary:disabled {
        background: #a7f3d0;
        color: #d1fae5;
        cursor: not-allowed;
      }
      .og-btn-icon {
        background: rgba(0,0,0,0.04);
        border: none;
        border-radius: 8px;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #4b5563;
        flex-shrink: 0;
      }
      .og-btn-icon:hover { background: rgba(0,0,0,0.08); }

      /* ---- Translate tab ---- */
      .og-translate-select {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid #d1fae5;
        background: white;
        font-size: 13px;
        color: #1f2937;
        margin-bottom: 10px;
        cursor: pointer;
      }
      .og-translate-result {
        font-size: 14px;
        color: #1f2937;
        background: white;
        border: 1px solid #d1fae5;
        border-radius: 10px;
        padding: 10px 12px;
        white-space: pre-wrap;
        min-height: 40px;
      }
      .og-translate-detected {
        font-size: 11.5px;
        color: #6b7280;
        margin-top: 8px;
      }

      /* ---- Toast ---- */
      .og-toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1f2937;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 13px;
        max-width: 320px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: og-slide-in 0.3s ease-out;
        z-index: 2147483647;
      }
      .og-toast.og-error { background: #dc2626; }
      .og-toast.og-warning { background: #d97706; }
      .og-toast.og-success { background: #059669; }
      .og-toast-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 16px;
        padding: 0;
        margin-left: auto;
        opacity: 0.7;
      }
      .og-toast-close:hover { opacity: 1; }
      .og-toast-action {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
      }
      .og-toast-action:hover { background: rgba(255,255,255,0.3); }
      @keyframes og-slide-in {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  // =========================================================================
  // Language badge — small pill shown near a field once its language is known
  // =========================================================================

  public showLanguageBadge(field: HTMLElement, languageName: string, onClick: () => void) {
    const id = this.getElementId(field);
    this.hideLanguageBadge(field);

    const badge = document.createElement('div');
    badge.className = 'og-lang-badge';
    badge.dataset.elementId = id;
    badge.innerHTML = `<span class="og-lang-dot"></span><span></span>`;
    badge.querySelector('span:last-child')!.textContent = languageName;
    badge.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });

    this.shadowRoot.appendChild(badge);
    this.badgeEls.set(id, badge);
    this.positionBadge(field, badge);
  }

  public hideLanguageBadge(field: HTMLElement) {
    const id = this.getElementId(field);
    const existing = this.badgeEls.get(id);
    if (existing) {
      existing.remove();
      this.badgeEls.delete(id);
    }
  }

  public showSpellingBadge(field: HTMLElement, count: number, onClick: () => void) {
    const id = this.getElementId(field);
    this.hideSpellingBadge(field);

    const badge = document.createElement('div');
    badge.className = 'og-spelling-badge';
    badge.textContent = `${count} misspelling${count > 1 ? 's' : ''}`;
    badge.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });

    this.shadowRoot.appendChild(badge);
    this.spellingBadgeEls.set(id, badge);
    this.positionSpellingBadge(field, badge);
  }

  public hideSpellingBadge(field: HTMLElement) {
    const id = this.getElementId(field);
    const existing = this.spellingBadgeEls.get(id);
    if (existing) {
      existing.remove();
      this.spellingBadgeEls.delete(id);
    }
  }

  private positionSpellingBadge(field: HTMLElement, badge: HTMLElement) {
    const rect = field.getBoundingClientRect();
    badge.style.left = `${rect.right - 10}px`;
    badge.style.top = `${rect.bottom + 6}px`;
    const bRect = badge.getBoundingClientRect();
    if (bRect.right > window.innerWidth) {
      badge.style.left = `${window.innerWidth - bRect.width - 8}px`;
    }
    if (bRect.left < 0) {
      badge.style.left = '8px';
    }
  }

  private positionBadge(field: HTMLElement, badge: HTMLElement) {
    const rect = field.getBoundingClientRect();
    badge.style.left = `${rect.right - 10}px`;
    badge.style.top = `${rect.top - 10}px`;
    const bRect = badge.getBoundingClientRect();
    if (bRect.right > window.innerWidth) {
      badge.style.left = `${window.innerWidth - bRect.width - 8}px`;
    }
    if (bRect.top < 0) {
      badge.style.top = `${rect.bottom + 4}px`;
    }
  }

  private repositionBadges() {
    this.badgeEls.forEach((badge, id) => {
      const field = this.findFieldById(id);
      if (!field || !document.body.contains(field)) {
        badge.remove();
        this.badgeEls.delete(id);
        return;
      }
      this.positionBadge(field, badge);
    });
    this.spellingBadgeEls.forEach((badge, id) => {
      const field = this.findFieldById(id);
      if (!field || !document.body.contains(field)) {
        badge.remove();
        this.spellingBadgeEls.delete(id);
        return;
      }
      this.positionSpellingBadge(field, badge);
    });
  }

  private findFieldById(id: string): HTMLElement | null {
    return document.querySelector(`[data-og-id="${id}"]`);
  }

  private getElementId(element: HTMLElement): string {
    if (!element.dataset.ogId) {
      element.dataset.ogId = Math.random().toString(36).substr(2, 9);
    }
    return element.dataset.ogId;
  }

  // =========================================================================
  // Docked tabbed panel
  // =========================================================================

  public openPanel(field: PanelField, initialTab: TabId, handlers: PanelHandlers) {
    this.closePanel();
    this.panelField = field;
    this.activeTab = initialTab;
    this.handlers = handlers;

    const panel = document.createElement('div');
    panel.className = 'og-panel';
    panel.innerHTML = `
      <div class="og-tabs"></div>
      <div class="og-panel-body"></div>
      <div class="og-panel-footer"></div>
    `;

    this.shadowRoot.appendChild(panel);
    this.panelEl = panel;
    this.renderTabs();
    this.repositionPanel();

    if (initialTab === 'translate') {
      this.renderTranslatePrompt();
    } else if (initialTab === 'more') {
      this.renderMoreMenu();
    } else {
      this.renderLoading();
      handlers.onRequestMode(initialTab, null);
    }

    return {
      setLoading: () => this.renderLoading(),
      setCorrections: (corrections: Correction[]) => this.renderCorrections(corrections),
      setTranslateResult: (translated: string, detectedLanguage: string) => this.renderTranslateResult(translated, detectedLanguage),
      setRewriteResult: (rewritten: string) => this.renderRewriteResult(rewritten),
      setError: (message: string) => this.renderError(message),
      isOpen: () => this.panelEl === panel,
    };
  }

  public closePanel() {
    if (this.panelEl) {
      this.panelEl.remove();
      this.panelEl = null;
    }
    this.panelField = null;
    this.handlers = null;
  }

  public isPanelOpenFor(field: HTMLElement): boolean {
    return !!this.panelEl && this.panelField?.element === field;
  }

  public getActiveTab(): TabId {
    return this.activeTab;
  }

  private repositionPanel() {
    if (!this.panelEl || !this.panelField) return;
    const rect = this.panelField.element.getBoundingClientRect();
    let x = rect.left;
    let y = rect.bottom + 8;

    const panelRect = this.panelEl.getBoundingClientRect();
    const width = panelRect.width || 380;

    if (x + width > window.innerWidth - 10) {
      x = Math.max(10, window.innerWidth - width - 10);
    }
    if (y + 200 > window.innerHeight) {
      y = Math.max(10, rect.top - 8 - (panelRect.height || 220));
    }

    this.panelEl.style.left = `${x}px`;
    this.panelEl.style.top = `${y}px`;
  }

  private renderTabs() {
    if (!this.panelEl || !this.handlers) return;
    const handlers = this.handlers;
    const tabsRow = this.panelEl.querySelector('.og-tabs')!;
    tabsRow.innerHTML = '';

    PRIMARY_TABS.forEach(tab => {
      const btn = document.createElement('button');
      btn.className = 'og-tab-btn' + (this.activeTab === tab.id ? ' og-tab-active' : '');
      btn.textContent = tab.label;
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.activeTab = tab.id;
        this.renderTabs();
        if (tab.id === 'more') {
          this.renderMoreMenu();
        } else if (tab.id === 'translate') {
          this.renderTranslatePrompt();
        } else {
          this.renderLoading();
          handlers.onRequestMode(tab.id, null);
        }
      });
      tabsRow.appendChild(btn);
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'og-panel-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.closePanel();
    });
    tabsRow.appendChild(closeBtn);
  }

  private renderMoreMenu() {
    if (!this.panelEl || !this.handlers) return;
    const handlers = this.handlers;
    const body = this.panelEl.querySelector('.og-panel-body')!;
    const footer = this.panelEl.querySelector('.og-panel-footer')!;
    footer.innerHTML = '';

    body.innerHTML = `<div class="og-mode-heading">Choose a mode</div>`;
    const list = document.createElement('div');
    MORE_TABS.forEach(sub => {
      const item = document.createElement('button');
      item.className = 'og-tab-btn';
      item.style.display = 'block';
      item.style.width = '100%';
      item.style.textAlign = 'left';
      item.style.padding = '10px 8px';
      item.textContent = sub.label;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.activeSubTab = sub.id;
        this.renderLoading();
        handlers.onRequestMode('more', sub.id);
      });
      list.appendChild(item);
    });
    body.appendChild(list);

    const toneHeading = document.createElement('div');
    toneHeading.className = 'og-more-heading';
    toneHeading.textContent = 'Rewrite with tone';
    body.appendChild(toneHeading);

    const toneList = document.createElement('div');
    REWRITE_TONES.forEach(tone => {
      const item = document.createElement('button');
      item.className = 'og-tab-btn';
      item.style.display = 'block';
      item.style.width = '100%';
      item.style.textAlign = 'left';
      item.style.padding = '10px 8px';
      item.textContent = tone.label;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.renderLoading();
        handlers.onToneRequest(tone.id);
      });
      toneList.appendChild(item);
    });
    body.appendChild(toneList);
    this.scheduleReposition();
  }

  private renderLoading() {
    if (!this.panelEl) return;
    const body = this.panelEl.querySelector('.og-panel-body')!;
    const footer = this.panelEl.querySelector('.og-panel-footer')!;
    body.innerHTML = `<div class="og-loading-state"><span class="og-spinner"></span>Checking…</div>`;
    footer.innerHTML = '';
    this.scheduleReposition();
  }

  private renderError(message: string) {
    if (!this.panelEl) return;
    const body = this.panelEl.querySelector('.og-panel-body')!;
    const footer = this.panelEl.querySelector('.og-panel-footer')!;
    body.innerHTML = `<div class="og-error-state"></div>`;
    body.querySelector('.og-error-state')!.textContent = message;
    footer.innerHTML = '';
    this.scheduleReposition();
  }

  private modeHeading(): string {
    if (this.activeTab === 'more') {
      return this.activeSubTab === 'clarity' ? 'Clarity & Concision' : 'Humanize';
    }
    switch (this.activeTab) {
      case 'improve': return 'Improved version';
      case 'grammar': return 'Fix grammar errors';
      case 'rephrase': return 'Rephrase suggestions';
      case 'shorten': return 'Shorten wordy sentences';
      case 'formal': return 'Make it formal';
      default: return 'Suggestions';
    }
  }

  private renderCorrections(corrections: Correction[]) {
    if (!this.panelEl || !this.handlers) return;
    const handlers = this.handlers;
    const body = this.panelEl.querySelector('.og-panel-body')!;
    const footer = this.panelEl.querySelector('.og-panel-footer')!;

    if (corrections.length === 0) {
      const msg = this.activeTab === 'grammar'
        ? '✓ Nothing to change here — looks good!'
        : 'No changes suggested — try a different mode';
      body.innerHTML = `<div class="og-empty-state"></div>`;
      body.querySelector('.og-empty-state')!.textContent = msg;
      footer.innerHTML = '';
      this.scheduleReposition();
      return;
    }

    body.innerHTML = `<div class="og-mode-heading"></div><div class="og-suggestion-list"></div>`;
    body.querySelector('.og-mode-heading')!.textContent = this.modeHeading();
    const list = body.querySelector('.og-suggestion-list')!;

    corrections.forEach((c) => {
      const item = document.createElement('div');
      item.className = 'og-suggestion-item';
      const diffEl = document.createElement('div');
      diffEl.className = 'og-diff-text';
      diffEl.appendChild(this.renderDiffSpan(c));
      item.appendChild(diffEl);

      if (c.explanation) {
        const expl = document.createElement('div');
        expl.className = 'og-suggestion-explanation';
        expl.textContent = c.explanation;
        item.appendChild(expl);
      }

      const row = document.createElement('div');
      row.className = 'og-suggestion-accept-row';
      const acceptBtn = document.createElement('button');
      acceptBtn.className = 'og-mini-accept';
      acceptBtn.textContent = 'Accept';
      acceptBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handlers.onAccept(c);
      });
      row.appendChild(acceptBtn);
      item.appendChild(row);

      list.appendChild(item);
    });

    footer.innerHTML = `<span style="font-size:12px;color:#6b7280;"></span>`;
    (footer.querySelector('span') as HTMLElement).textContent =
      `${corrections.length} suggestion${corrections.length > 1 ? 's' : ''}`;

    if (corrections.length > 1) {
      const acceptAllBtn = document.createElement('button');
      acceptAllBtn.className = 'og-btn og-btn-primary';
      acceptAllBtn.textContent = 'Accept All';
      acceptAllBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handlers.onAcceptAll(corrections);
      });
      footer.appendChild(acceptAllBtn);
    } else {
      const acceptBtn = document.createElement('button');
      acceptBtn.className = 'og-btn og-btn-primary';
      acceptBtn.textContent = 'Accept';
      acceptBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handlers.onAccept(corrections[0]);
      });
      footer.appendChild(acceptBtn);
    }

    this.scheduleReposition();
  }

  private renderDiffSpan(c: Correction): DocumentFragment {
    const frag = document.createDocumentFragment();
    const del = document.createElement('span');
    del.className = 'og-diff-del';
    del.textContent = c.original;
    const ins = document.createElement('span');
    ins.className = 'og-diff-ins';
    ins.textContent = c.suggestion;
    frag.appendChild(del);
    frag.appendChild(document.createTextNode(' '));
    frag.appendChild(ins);
    return frag;
  }

  private renderTranslatePrompt() {
    if (!this.panelEl || !this.handlers) return;
    const handlers = this.handlers;
    const body = this.panelEl.querySelector('.og-panel-body')!;
    const footer = this.panelEl.querySelector('.og-panel-footer')!;
    footer.innerHTML = '';

    body.innerHTML = `
      <div class="og-mode-heading">Translate to</div>
      <select class="og-translate-select"></select>
    `;

    const select = body.querySelector('.og-translate-select') as HTMLSelectElement;
    TRANSLATE_LANGUAGES.forEach(lang => {
      const opt = document.createElement('option');
      opt.value = lang.name;
      opt.textContent = lang.name;
      select.appendChild(opt);
    });

    const goBtn = document.createElement('button');
    goBtn.className = 'og-btn og-btn-primary';
    goBtn.style.marginTop = '10px';
    goBtn.style.width = '100%';
    goBtn.textContent = 'Translate';
    goBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.renderLoading();
      handlers.onTranslateRequest(select.value);
    });
    body.appendChild(goBtn);

    this.scheduleReposition();
  }

  private renderTranslateResult(translated: string, detectedLanguage: string) {
    if (!this.panelEl || !this.handlers) return;
    const handlers = this.handlers;
    const body = this.panelEl.querySelector('.og-panel-body')!;
    const footer = this.panelEl.querySelector('.og-panel-footer')!;

    body.innerHTML = `
      <div class="og-mode-heading">Translated</div>
      <div class="og-translate-result"></div>
      <div class="og-translate-detected"></div>
    `;
    body.querySelector('.og-translate-result')!.textContent = translated;
    body.querySelector('.og-translate-detected')!.textContent = `Detected source language: ${detectedLanguage}`;

    footer.innerHTML = '';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'og-btn-icon';
    copyBtn.title = 'Copy translation';
    copyBtn.textContent = '⧉';
    copyBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handlers.onCopy(translated);
    });
    footer.appendChild(copyBtn);

    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'og-btn og-btn-primary';
    replaceBtn.textContent = 'Replace';
    replaceBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handlers.onTranslateReplace(translated);
    });
    footer.appendChild(replaceBtn);

    this.scheduleReposition();
  }

  private renderRewriteResult(rewritten: string) {
    if (!this.panelEl || !this.handlers) return;
    const handlers = this.handlers;
    const body = this.panelEl.querySelector('.og-panel-body')!;
    const footer = this.panelEl.querySelector('.og-panel-footer')!;

    body.innerHTML = `
      <div class="og-mode-heading">Rewritten</div>
      <div class="og-translate-result"></div>
    `;
    body.querySelector('.og-translate-result')!.textContent = rewritten;

    footer.innerHTML = '';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'og-btn-icon';
    copyBtn.title = 'Copy rewrite';
    copyBtn.textContent = '⧉';
    copyBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handlers.onCopy(rewritten);
    });
    footer.appendChild(copyBtn);

    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'og-btn og-btn-primary';
    replaceBtn.textContent = 'Replace';
    replaceBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handlers.onToneReplace(rewritten);
    });
    footer.appendChild(replaceBtn);

    this.scheduleReposition();
  }

  // =========================================================================
  // Toasts
  // =========================================================================

  public showToast(message: string, type: 'error' | 'warning' | 'success' | 'info' = 'info', options?: { action?: string; onAction?: () => void; duration?: number }) {
    this.shadowRoot.querySelectorAll('.og-toast').forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = `og-toast og-${type}`;

    let html = `<span>${message}</span>`;
    if (options?.action && options?.onAction) {
      html += `<button class="og-toast-action">${options.action}</button>`;
    }
    html += `<button class="og-toast-close">×</button>`;
    toast.innerHTML = html;

    toast.querySelector('.og-toast-close')?.addEventListener('click', () => toast.remove());
    if (options?.action && options?.onAction) {
      toast.querySelector('.og-toast-action')?.addEventListener('click', () => {
        options.onAction!();
        toast.remove();
      });
    }

    this.shadowRoot.appendChild(toast);

    const duration = options?.duration ?? (type === 'error' ? 8000 : 5000);
    if (duration > 0) {
      setTimeout(() => {
        if (this.shadowRoot.contains(toast)) toast.remove();
      }, duration);
    }
  }
}
