import { observeDOM, TextField } from './dom-observer';
import { UIInjector, TabId, tabToPanelMode } from './ui-injector';
import { Correction, RewriteTone } from '../lib/deepseek';

const ui = new UIInjector();
const analyzedFields = new Set<TextField>();

// Per-field debounce timers and last-known-text
const fieldTimers = new WeakMap<TextField, number>();
const fieldLastText = new WeakMap<TextField, string>();
const fieldDetectedLang = new WeakMap<TextField, string>();

const TYPING_DEBOUNCE_MS = 900;
const MIN_TEXT_LENGTH = 5;
const MIN_TEXT_LENGTH_FOR_LANG_DETECT = 12;

// Tracks whichever panel controller is currently open, so the async request
// functions (called from panel-internal callbacks) can push results into it.
let activeController: ReturnType<UIInjector['openPanel']> | null = null;

// Guards against the selection trigger re-opening the panel in a loop right
// after it was closed or opened.
let lastPanelOpenTime = 0;

// =============================================================================
// Text extraction / replacement helpers
// =============================================================================

function getFieldText(field: TextField): string {
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    return field.value;
  }
  return (field as HTMLElement).innerText || (field as HTMLElement).textContent || '';
}

/**
 * Robustly locates a verbatim substring inside a contenteditable's text nodes
 * and builds a Range covering it. Searches against real textContent (not
 * innerText) so it stays aligned with the DOM, and prefers the match closest
 * to `hintStart`. Falls back to the first occurrence anywhere in the field.
 */
function findTextRangeInField(field: HTMLElement, search: string, hintStart: number): Range | null {
  if (!search) return null;

  const textNodes: Text[] = [];
  let totalLen = 0;

  const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT, null);
  let node: Text | null;
  while (node = walker.nextNode() as Text | null) {
    textNodes.push(node);
    totalLen += node.textContent?.length || 0;
  }

  if (textNodes.length === 0) return null;

  const fullText = textNodes.map(n => n.textContent).join('');
  let idx = fullText.indexOf(search);
  if (idx === -1) return null;

  // Prefer a match near where the correction was expected, but never stray
  // more than a little — the verbatim match is what matters most.
  const windowStart = Math.max(0, hintStart - 40);
  const nearIdx = fullText.indexOf(search, windowStart);
  if (nearIdx !== -1) idx = nearIdx;

  const range = document.createRange();
  let pos = 0;
  for (let i = 0; i < textNodes.length; i++) {
    const len = textNodes[i].textContent?.length || 0;
    if (idx >= pos && idx < pos + len) {
      const withinStart = idx - pos;
      if (withinStart + search.length <= len) {
        range.setStart(textNodes[i], withinStart);
        range.setEnd(textNodes[i], withinStart + search.length);
      } else {
        range.setStart(textNodes[i], withinStart);
        let remaining = withinStart + search.length - len;
        let j = i + 1;
        while (remaining > 0 && j < textNodes.length) {
          const l2 = textNodes[j].textContent?.length || 0;
          const take = Math.min(remaining, l2);
          range.setEnd(textNodes[j], take);
          remaining -= take;
          j++;
        }
      }
      return range;
    }
    pos += len;
  }
  return null;
}

/**
 * Applies a single correction's text replacement to a field. Positions are
 * character offsets into the field's plain-text content. Returns true on success.
 * The contenteditable path locates the verbatim "original" in the DOM so it
 * works even if the current caret/selection is elsewhere (no reselect needed).
 */
function applyTextReplacement(field: TextField, start: number, end: number, original: string, suggestion: string): boolean {
  if (!original || suggestion == null) return false;

  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    const val = field.value;
    const atPosition = val.substring(start, end);
    let s = start, e = end;
    if (atPosition !== original) {
      const idx = val.indexOf(original);
      if (idx === -1) return false;
      s = idx;
      e = idx + original.length;
    }
    field.value = val.substring(0, s) + suggestion + val.substring(e);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  try {
    // Ensure the field is focused so execCommand targets the right context.
    if (document.activeElement !== field) {
      field.focus();
    }

    const range = findTextRangeInField(field, original, start);
    if (!range) return false;

    const selection = window.getSelection();
    if (!selection) return false;

    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('insertText', false, suggestion);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  } catch {
    return false;
  }
}

function replaceEntireFieldText(field: TextField, newText: string): boolean {
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    field.value = newText;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  try {
    if (document.activeElement !== field) {
      field.focus();
    }
    const selection = window.getSelection();
    if (!selection) return false;
    const range = document.createRange();
    range.selectNodeContents(field);
    selection.removeAllRanges();
    selection.addRange(range);

    let ok = false;
    try {
      ok = document.execCommand('insertText', false, newText);
    } catch {
      ok = false;
    }

    if (!ok) {
      // Fallback: replace the rendered content directly.
      while (field.firstChild) field.removeChild(field.firstChild);
      field.appendChild(document.createTextNode(newText));
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Real-time typing detector — debounced Improve-tab analysis
// =============================================================================

function scheduleAnalysis(field: TextField) {
  const text = getFieldText(field);

  if (text.length < MIN_TEXT_LENGTH) {
    fieldLastText.set(field, text);
    return;
  }

  if (fieldLastText.get(field) === text) return;

  const existing = fieldTimers.get(field);
  if (existing) window.clearTimeout(existing);

  const timer = window.setTimeout(() => {
    fieldLastText.set(field, text);
    runProofreadCheck(field, text);
    maybeDetectLanguage(field, text);
  }, TYPING_DEBOUNCE_MS);

  fieldTimers.set(field, timer);
}

async function runProofreadCheck(field: TextField, text: string) {
  // Don't interrupt if the panel is already open on a different tab
  if (ui.isPanelOpenFor(field) && ui.getActiveTab() !== 'grammar') return;

  const response = await chrome.runtime.sendMessage({ type: 'ANALYZE_TEXT', text });
  if (!response) return;

  if (response.success) {
    const corrections: Correction[] = response.data.corrections;
    handleSpellingFeedback(field, corrections);
    if (corrections.length === 0) return;
    if (!ui.isPanelOpenFor(field)) {
      openPanelFor(field, 'grammar');
    } else {
      activeController?.setCorrections(corrections);
    }
  } else if (response.error && !response.error.includes('disabled')) {
    ui.showToast(`Check failed: ${response.error}`, 'error');
  }
}

async function maybeDetectLanguage(field: TextField, text: string) {
  if (text.trim().length < MIN_TEXT_LENGTH_FOR_LANG_DETECT) return;
  const lastChecked = (field as any)._ogLangCheckedLength || 0;
  if (Math.abs(text.length - lastChecked) < 40 && fieldDetectedLang.has(field)) return;
  (field as any)._ogLangCheckedLength = text.length;

  const response = await chrome.runtime.sendMessage({ type: 'DETECT_LANGUAGE', text });
  if (response?.success) {
    const lang = response.data.language;
    fieldDetectedLang.set(field, lang);
    ui.showLanguageBadge(field, lang, () => {
      openPanelFor(field, 'translate');
    });
  }
}

// =============================================================================
// Panel orchestration
// =============================================================================

function openPanelFor(field: TextField, initialTab: TabId) {
  lastPanelOpenTime = Date.now();
  activeController = ui.openPanel(
    { element: field },
    initialTab,
    {
      onRequestMode: (tab, subTab) => requestPanelMode(field, tab, subTab),
      onAccept: (correction) => {
        const ok = applyTextReplacement(field, correction.start, correction.end, correction.original, correction.suggestion);
        if (!ok) {
          ui.showToast('Could not apply that suggestion — select the text and try again', 'error');
          return;
        }
        fieldLastText.set(field, getFieldText(field));
        requestPanelMode(field, ui.getActiveTab(), null);
      },
      onAcceptAll: (corrections) => {
        const sorted = [...corrections].sort((a, b) => b.start - a.start);
        let failures = 0;
        for (const c of sorted) {
          if (!applyTextReplacement(field, c.start, c.end, c.original, c.suggestion)) failures++;
        }
        if (failures > 0) {
          ui.showToast(`Applied ${sorted.length - failures} of ${sorted.length} suggestions`, 'warning', { duration: 4000 });
        }
        fieldLastText.set(field, getFieldText(field));
        requestPanelMode(field, ui.getActiveTab(), null);
      },
      onTranslateRequest: (targetLanguage) => requestTranslate(field, targetLanguage),
      onTranslateReplace: (translated) => {
        const ok = replaceEntireFieldText(field, translated);
        fieldLastText.set(field, getFieldText(field));
        ui.closePanel();
        activeController = null;
        if (ok) {
          ui.showToast('Replaced', 'success', { duration: 2000 });
        } else {
          ui.showToast('Could not replace the text', 'error', { duration: 4000 });
        }
      },
      onToneRequest: (tone) => requestToneRewrite(field, tone),
      onToneReplace: (rewritten) => {
        const ok = replaceEntireFieldText(field, rewritten);
        fieldLastText.set(field, getFieldText(field));
        ui.closePanel();
        activeController = null;
        if (ok) {
          ui.showToast('Replaced', 'success', { duration: 2000 });
        } else {
          ui.showToast('Could not replace the text', 'error', { duration: 4000 });
        }
      },
      onCopy: (text) => {
        navigator.clipboard?.writeText(text).then(() => {
          ui.showToast('Copied to clipboard', 'success', { duration: 2000 });
        }).catch(() => {
          ui.showToast('Could not copy — select and copy manually', 'warning');
        });
      },
    }
  );
  return activeController;
}

async function requestPanelMode(field: TextField, tab: TabId, subTab: 'clarity' | 'humanize' | null) {
  const text = getFieldText(field);
  if (!text.trim()) return;

  const mode = tabToPanelMode(tab, subTab);
  if (!mode) return; // translate has its own flow, handled by requestTranslate

  try {
    let corrections: Correction[];
    if (mode === 'grammar') {
      const response = await chrome.runtime.sendMessage({ type: 'ANALYZE_TEXT', text });
      if (!response.success) throw new Error(response.error || 'Check failed');
      corrections = response.data.corrections;
      handleSpellingFeedback(field, corrections);
    } else {
      const response = await chrome.runtime.sendMessage({ type: 'ANALYZE_PANEL_MODE', text, mode });
      if (!response.success) throw new Error(response.error || 'Request failed');
      corrections = response.data.corrections;
    }
    activeController?.setCorrections(corrections);
  } catch (err: any) {
    activeController?.setError(err.message || 'Something went wrong');
  }
}

async function requestTranslate(field: TextField, targetLanguage: string) {
  const text = getFieldText(field);
  if (!text.trim()) return;

  chrome.runtime.sendMessage({ type: 'SAVE_TRANSLATE_TARGET', language: targetLanguage });

  try {
    const response = await chrome.runtime.sendMessage({ type: 'TRANSLATE_TEXT', text, targetLanguage });
    if (!response.success) throw new Error(response.error || 'Translation failed');
    activeController?.setTranslateResult(response.data.translated, response.data.detectedLanguage);
  } catch (err: any) {
    activeController?.setError(err.message || 'Translation failed');
  }
}

async function requestToneRewrite(field: TextField, tone: RewriteTone) {
  const text = getFieldText(field);
  if (!text.trim()) return;

  try {
    const response = await chrome.runtime.sendMessage({ type: 'REWRITE_TEXT', text, tone });
    if (!response.success) throw new Error(response.error || 'Rewrite failed');
    activeController?.setRewriteResult(response.data.rewritten);
  } catch (err: any) {
    activeController?.setError(err.message || 'Rewrite failed');
  }
}

// =============================================================================
// Inline spelling highlighting (CSS Custom Highlight API — contenteditable only)
// =============================================================================

let highlightStyleInjected = false;

function ensureHighlightStyle() {
  if (highlightStyleInjected) return;
  highlightStyleInjected = true;
  const style = document.createElement('style');
  style.id = 'og-spelling-highlight-style';
  style.textContent = `
    ::highlight(og-spelling) {
      background: rgba(239, 68, 68, 0.16);
      text-decoration: underline wavy #ef4444;
      text-decoration-skip-ink: none;
    }
  `;
  document.head.appendChild(style);
}

function clearSpellingHighlights() {
  const highlights = (window.CSS as any)?.highlights;
  if (highlights) highlights.delete('og-spelling');
}

function updateSpellingHighlights(field: TextField, corrections: Correction[]) {
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) return;
  const cssHighlights = (window.CSS as any)?.highlights;
  if (!cssHighlights || typeof (window as any).Highlight === 'undefined') return;

  const spellingRanges: Range[] = corrections
    .filter(c => c.type === 'spelling')
    .map(c => findTextRangeInField(field, c.original, c.start))
    .filter((r): r is Range => r !== null);

  if (spellingRanges.length === 0) {
    cssHighlights.delete('og-spelling');
    return;
  }

  ensureHighlightStyle();
  const highlight = new (window as any).Highlight(...spellingRanges);
  cssHighlights.set('og-spelling', highlight);
}

function handleSpellingFeedback(field: TextField, corrections: Correction[]) {
  updateSpellingHighlights(field, corrections);
  const count = corrections.filter(c => c.type === 'spelling').length;
  if (count > 0) {
    ui.showSpellingBadge(field, count, () => {
      if (!ui.isPanelOpenFor(field)) openPanelFor(field, 'grammar');
    });
  } else {
    ui.hideSpellingBadge(field);
  }
}

// =============================================================================
// Selection trigger — opens the panel when the user selects text
// =============================================================================

let selectionOpenTimer: number | null = null;

function onSelectionPotential() {
  if (selectionOpenTimer !== null) window.clearTimeout(selectionOpenTimer);
  selectionOpenTimer = window.setTimeout(tryOpenPanelForSelection, 220);
}

function tryOpenPanelForSelection() {
  selectionOpenTimer = null;

  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const anchor = sel.anchorNode;
  if (!anchor) return;

  const el = anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as HTMLElement);
  if (!el) return;

  const field = el.closest('input, textarea, [contenteditable]');
  if (!field || !isTextField(field)) return;
  if (ui.isPanelOpenFor(field)) return;
  if (Date.now() - lastPanelOpenTime < 2500) return;

  const text = getFieldText(field as TextField);
  if (!text.trim() || text.trim().length < 2) return;

  openPanelFor(field as TextField, 'improve');
}

// =============================================================================
// Field wiring
// =============================================================================

function handleInput(event: Event) {
  const target = event.target as TextField;
  clearSpellingHighlights();
  ui.hideSpellingBadge(target);
  scheduleAnalysis(target);
}

function handlePaste(event: Event) {
  const target = event.target as TextField;
  setTimeout(() => scheduleAnalysis(target), 100);
}

function isTextField(el: Element): el is TextField {
  const name = el.tagName.toLowerCase();
  return name === 'input' || name === 'textarea' || (el as HTMLElement).isContentEditable;
}

observeDOM((el) => {
  if (analyzedFields.has(el)) return;
  el.addEventListener('input', handleInput);
  el.addEventListener('paste', handlePaste);
  analyzedFields.add(el);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'OPEN_PANEL') {
    const active = document.activeElement as HTMLElement;
    const field = (active && isTextField(active)) ? (active as TextField) : Array.from(analyzedFields).pop();
    if (!field) {
      ui.showToast('Click into a text field first', 'warning');
      return;
    }
    openPanelFor(field, 'improve');
  }
});

// Auto-open the panel when the user selects text in an editable field
document.addEventListener('mouseup', onSelectionPotential);
document.addEventListener('keyup', onSelectionPotential);

// Test connection to background
chrome.runtime.sendMessage({ type: 'PING' }, () => {
  if (chrome.runtime.lastError) {
    // Silent fail
  }
});
