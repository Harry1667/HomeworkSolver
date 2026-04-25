import { useEffect, useState } from 'react'
import { getSubjectRules, updateSubjectRule } from '../lib/api'
import { getSubjectsForGrade } from '../types'
import type { Grade } from '../types'

interface Props {
  grade: Grade
  onClose: () => void
}

export default function SubjectRulesModal({ grade, onClose }: Props) {
  const subjects = getSubjectsForGrade(grade)
  const [activeSubject, setActiveSubject] = useState(subjects[0]?.id ?? '')
  const [rules, setRules] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSubjectRules().then((data) => {
      const init: Record<string, string> = {}
      for (const s of subjects) init[s.id] = data[s.id] ?? ''
      setRules(init)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await updateSubjectRule(activeSubject, rules[activeSubject] ?? '')
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const activeSubjectInfo = subjects.find((s) => s.id === activeSubject)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-white font-semibold">自訂科目要求</h2>
            <p className="text-slate-400 text-xs mt-0.5">為每個科目新增額外的 AI 教學指引，優先級最高</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* 科目列表 */}
          <div className="w-36 flex-shrink-0 border-r border-slate-700 overflow-y-auto py-2">
            {subjects.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSubject(s.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  activeSubject === s.id
                    ? 'bg-indigo-600/30 text-indigo-300 border-r-2 border-indigo-500'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
                {rules[s.id]?.trim() && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* 編輯區 */}
          <div className="flex-1 flex flex-col p-5 min-h-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{activeSubjectInfo?.icon}</span>
              <span className="text-slate-200 font-medium">{activeSubjectInfo?.label}</span>
              <span className="text-slate-500 text-xs ml-1">額外要求</span>
            </div>
            <textarea
              value={rules[activeSubject] ?? ''}
              onChange={(e) => setRules((prev) => ({ ...prev, [activeSubject]: e.target.value }))}
              placeholder={`在這裡輸入對「${activeSubjectInfo?.label}」的額外要求...\n\n例如：\n- 解題時必須同時提供中英文術語對照\n- 數學題一定要畫圖輔助說明\n- 每次解完題後出一道類似的練習題`}
              className="flex-1 bg-slate-700 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-500 resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between mt-3">
              <p className="text-slate-500 text-xs">留空則不套用額外要求</p>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? '儲存中...' : saved ? '✓ 已儲存' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
