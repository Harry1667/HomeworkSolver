import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { getAppSettings, updateAppSettings } from '../lib/api'

interface Props {
  onClose: () => void
}

export default function SettingsModal({ onClose }: Props) {
  const theme = useStore(s => s.theme)
  const toggleTheme = useStore(s => s.toggleTheme)

  const [geminiKey, setGeminiKey] = useState('')
  const [geminiMasked, setGeminiMasked] = useState('')
  const [geminiEnabled, setGeminiEnabled] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getAppSettings().then(d => {
      setGeminiMasked(d.gemini_api_key_masked)
      setGeminiEnabled(d.gemini_enabled)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await updateAppSettings({ gemini_api_key: geminiKey })
    setSaving(false)
    setSaved(true)
    setEditing(false)
    setGeminiEnabled(!!geminiKey.trim())
    setGeminiMasked(
      geminiKey.length > 8
        ? geminiKey.slice(0, 4) + '•'.repeat(geminiKey.length - 8) + geminiKey.slice(-4)
        : geminiKey ? '•'.repeat(geminiKey.length) : ''
    )
    setGeminiKey('')
    setTimeout(() => setSaved(false), 2500)
  }

  const handleClear = async () => {
    await updateAppSettings({ gemini_api_key: '' })
    setGeminiKey('')
    setGeminiMasked('')
    setGeminiEnabled(false)
    setEditing(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-white">設定</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-6">

          {/* 外觀 */}
          <section>
            <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">外觀</div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                  {theme === 'dark' ? (
                    <svg className="w-4 h-4 text-slate-500 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {theme === 'dark' ? '深色模式' : '淺色模式'}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500">切換介面色調</div>
                </div>
              </div>

              {/* Toggle switch */}
              <button
                onClick={toggleTheme}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </section>

          {/* 分隔線 */}
          <div className="border-t border-slate-100 dark:border-slate-700" />

          {/* AI 圖片辨識 */}
          <section>
            <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">AI 圖片辨識</div>

            {/* 狀態指示 */}
            <div className="flex items-center gap-2 mb-4">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${geminiEnabled ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              <span className="text-sm text-slate-600 dark:text-slate-300">
                Gemini Vision
              </span>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                geminiEnabled
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
              }`}>
                {geminiEnabled ? '已啟用' : '未設定'}
              </span>
            </div>

            {/* Key 顯示 / 輸入 */}
            {!editing ? (
              <div className="space-y-2">
                {geminiMasked && (
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2.5">
                    <span className="flex-1 text-sm font-mono text-slate-600 dark:text-slate-300 tracking-wider">
                      {geminiMasked}
                    </span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditing(true); setShowKey(false) }}
                    className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium"
                  >
                    {geminiMasked ? '修改 Key' : '+ 設定 Gemini Key'}
                  </button>
                  {geminiEnabled && (
                    <button
                      onClick={handleClear}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={e => setGeminiKey(e.target.value)}
                    placeholder="AIza..."
                    autoFocus
                    className="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500 pr-10 placeholder-slate-400"
                  />
                  <button
                    onClick={() => setShowKey(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showKey ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                <p className="text-xs text-slate-400 dark:text-slate-500">
                  取得免費 Key：
                  <span className="text-indigo-500 dark:text-indigo-400"> aistudio.google.com/apikey</span>
                </p>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setEditing(false); setGeminiKey('') }}
                    className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !geminiKey.trim()}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-40"
                  >
                    {saving ? '儲存中...' : saved ? '✓ 已儲存' : '儲存'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* 底部 padding（手機版） */}
        <div className="h-safe-bottom sm:h-0" />
      </div>
    </div>
  )
}
