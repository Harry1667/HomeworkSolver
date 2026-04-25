import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { getSubjectRules, updateSubjectRule } from '../lib/api'
import { getSubjectsForGrade } from '../types'

export default function SubjectRulesPage() {
  const navigate = useNavigate()
  const currentUser = useStore((s) => s.currentUser)

  useEffect(() => {
    if (!currentUser) navigate('/', { replace: true })
  }, [currentUser, navigate])

  if (!currentUser) return null

  const subjects = getSubjectsForGrade(currentUser.grade)
  return <SubjectRulesContent subjects={subjects} onBack={() => navigate('/main')} />
}

function SubjectRulesContent({
  subjects,
  onBack,
}: {
  subjects: ReturnType<typeof getSubjectsForGrade>
  onBack: () => void
}) {
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
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="返回"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-slate-800 dark:text-white font-semibold">自訂科目要求</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">為每個科目新增額外的 AI 教學指引，優先級最高</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* 科目列表 */}
        <div className="w-40 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 overflow-y-auto py-2">
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSubject(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors ${
                activeSubject === s.id
                  ? 'bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-300 border-r-2 border-indigo-500'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span>{s.icon}</span>
              <span className="flex-1">{s.label}</span>
              {rules[s.id]?.trim() && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* 編輯區 */}
        <div className="flex-1 flex flex-col p-6 min-h-0">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">{activeSubjectInfo?.icon}</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">{activeSubjectInfo?.label}</span>
            <span className="text-slate-400 dark:text-slate-500 text-xs ml-1">額外要求</span>
          </div>
          <textarea
            value={rules[activeSubject] ?? ''}
            onChange={(e) => setRules((prev) => ({ ...prev, [activeSubject]: e.target.value }))}
            placeholder={`在這裡輸入對「${activeSubjectInfo?.label}」的額外要求...\n\n例如：\n- 解題時必須同時提供中英文術語對照\n- 數學題一定要畫圖輔助說明\n- 每次解完題後出一道類似的練習題`}
            className="flex-1 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500 resize-none leading-relaxed border border-slate-200 dark:border-slate-700"
          />
          <div className="flex items-center justify-between mt-4">
            <p className="text-slate-400 dark:text-slate-500 text-xs">留空則不套用額外要求</p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? '儲存中...' : saved ? '✓ 已儲存' : '儲存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
