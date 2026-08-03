import React, { useEffect, useState } from 'react';
import { getSettings, saveSettings, Settings, DEFAULT_SETTINGS } from '../lib/storage';
import { Settings as SettingsIcon, Save, Zap, BookOpen, Sliders } from 'lucide-react';

export default function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState('');

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s);
    });
  }, []);

  const handleSave = async () => {
    try {
      await saveSettings(settings);
      setStatus('Settings saved!');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setStatus('Error saving settings');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-['Geist']">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="border-b border-gray-100 px-8 py-6 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                <SettingsIcon className="text-white w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
            </div>
            {status && (
              <div className={`px-4 py-2 rounded-full text-sm font-medium animate-fade-in ${
                status.includes('Error') 
                  ? 'bg-red-50 text-red-600' 
                  : 'bg-green-50 text-green-600'
              }`}>
                {status}
              </div>
            )}
          </div>
          
          <div className="p-8 space-y-10">
            {/* API Configuration */}
            <section className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900">AI Provider</h2>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                <p className="text-sm font-medium text-gray-900">DeepSeek (deepseek-chat)</p>
                <p className="text-xs text-gray-500 mt-1">
                  Requests are sent to a private DeepSeek proxy. No API key is required from you.
                </p>
              </div>
            </section>

            <div className="h-px bg-gray-100" />

            {/* Writing Preferences */}
            <section className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900">Writing Preferences</h2>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  Writing Mode
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['casual', 'professional', 'academic'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setSettings({ ...settings, mode: m })}
                      className={`
                        relative py-3 px-4 rounded-xl border text-sm font-medium transition-all duration-200
                        ${settings.mode === m 
                          ? 'bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-200 shadow-sm' 
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                        }
                      `}
                    >
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Aggressiveness
                  </label>
                  <span className="px-2.5 py-1 rounded-md bg-gray-100 text-xs font-semibold text-gray-600">
                    {Math.round(settings.aggressiveness * 100)}%
                  </span>
                </div>
                
                <div className="relative py-4">
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.1"
                    className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={settings.aggressiveness}
                    onChange={(e) => setSettings({ ...settings, aggressiveness: parseFloat(e.target.value) })}
                  />
                  <div className="flex justify-between mt-2 text-xs font-medium text-gray-400">
                    <span>Conservative</span>
                    <span>Balanced</span>
                    <span>Aggressive</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Save Button */}
            <div className="pt-6 border-t border-gray-100 flex justify-end">
              <button 
                onClick={handleSave}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium transition-all transform active:scale-[0.98] shadow-lg shadow-blue-600/25"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
