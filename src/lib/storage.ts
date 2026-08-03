export interface Settings {
  enabled: boolean;
  aggressiveness: number;
  mode: 'casual' | 'professional' | 'academic';
  lastTranslateTarget: string;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  aggressiveness: 0.5,
  mode: 'professional',
  lastTranslateTarget: 'English',
};

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  const storedSettings = result.settings || {};
  return { ...DEFAULT_SETTINGS, ...storedSettings };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({
    settings: { ...current, ...settings },
  });
}
