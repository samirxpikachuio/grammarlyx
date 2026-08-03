import { analyzeText, analyzePanelMode, rewriteText, translateText, detectLanguage, RewriteTone, PanelMode } from '../lib/deepseek';
import { getSettings, saveSettings } from '../lib/storage';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'openPanel',
    title: 'Open Grammarly',
    contexts: ['selection', 'editable']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'openPanel' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'OPEN_PANEL',
      text: info.selectionText || ''
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PING') {
    sendResponse({ success: true, message: 'PONG' });
    return;
  }
  if (request.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return;
  }
  if (request.type === 'ANALYZE_TEXT') {
    handleAnalysis(request.text).then(sendResponse);
    return true;
  }
  if (request.type === 'ANALYZE_PANEL_MODE') {
    handlePanelMode(request.text, request.mode).then(sendResponse);
    return true;
  }
  if (request.type === 'REWRITE_TEXT') {
    handleRewrite(request.text, request.tone).then(sendResponse);
    return true;
  }
  if (request.type === 'TRANSLATE_TEXT') {
    handleTranslate(request.text, request.targetLanguage).then(sendResponse);
    return true;
  }
  if (request.type === 'DETECT_LANGUAGE') {
    handleDetectLanguage(request.text).then(sendResponse);
    return true;
  }
  if (request.type === 'SAVE_TRANSLATE_TARGET') {
    saveSettings({ lastTranslateTarget: request.language }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

async function handleAnalysis(text: string) {
  try {
    const settings = await getSettings();
    if (!settings.enabled) {
      return { success: false, error: 'Extension is disabled' };
    }
    const results = await analyzeText(text, settings);
    return { success: true, data: results };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handlePanelMode(text: string, mode: Exclude<PanelMode, 'grammar'>) {
  try {
    const settings = await getSettings();
    if (!settings.enabled) {
      return { success: false, error: 'Extension is disabled' };
    }
    const corrections = await analyzePanelMode(text, mode, settings);
    return { success: true, data: { corrections } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleRewrite(text: string, tone: RewriteTone) {
  try {
    const settings = await getSettings();
    if (!settings.enabled) {
      return { success: false, error: 'Extension is disabled' };
    }
    const result = await rewriteText(text, tone, settings);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleTranslate(text: string, targetLanguage: string) {
  try {
    const settings = await getSettings();
    if (!settings.enabled) {
      return { success: false, error: 'Extension is disabled' };
    }
    const result = await translateText(text, targetLanguage);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function handleDetectLanguage(text: string) {
  try {
    const result = await detectLanguage(text);
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
