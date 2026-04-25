import { useState } from 'react'
import { createUser, updateUser } from '../lib/api'
import type { User, Grade } from '../types'
import { GRADE_LABELS, getSubjectsForGrade } from '../types'

interface Props {
  user: User | null
  onClose: () => void
  onSave: () => void
}

export default function UserModal({ user, onClose, onSave }: Props) {
  const [name, setName] = useState(user?.name ?? '')
  const [grade, setGrade] = useState<Grade>(user?.grade ?? 'high')
  const [scores, setScores] = useState<Record<string, string>>(() => {
    // 初始化所有可能科目的成績
    const init: Record<string, string> = {}
    for (const grade of (['middle', 'high', 'university'] as Grade[])) {
      for (const s of getSubjectsForGrade(grade)) {
        init[s.id] = user?.scores?.[s.id]?.toString() ?? ''
      }
    }
    return init
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleScoreChange = (subjectId: string, val: string) => {
    setScores((prev) => ({ ...prev, [subjectId]: val }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('請填寫名稱'); return }
    setLoading(true)
    setError('')
    try {
      const parsedScores: Record<string, number> = {}
      for (const s of getSubjectsForGrade(grade)) {
        const v = scores[s.id]
        if (v !== '') {
          const n = parseInt(v)
          if (!isNaN(n)) parsedScores[s.id] = Math.min(100, Math.max(0, n))
        }
      }
      const scoresPayload = Object.keys(parsedScores).length > 0 ? parsedScores : null

      if (user) {
        await updateUser(user.id, { name: name.trim(), grade, scores: scoresPayload })
      } else {
        await createUser({ name: name.trim(), grade, scores: scoresPayload })
      }
      onSave()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '儲存失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90dvh] overflow-y-auto">
        <h2 className="text-white text-lg font-semibold mb-6">
          {user ? '編輯使用者' : '建立新使用者'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 名稱 */}
          <div>
            <label className="block text-slate-300 text-sm mb-1">名稱</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：小明"
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-500"
            />
          </div>

          {/* 學習階段 */}
          <div>
            <label className="block text-slate-300 text-sm mb-2">學習階段</label>
            <div className="flex gap-2">
              {(['middle', 'high', 'university'] as Grade[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrade(g)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    grade === g
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {GRADE_LABELS[g]}
                </button>
              ))}
            </div>
          </div>

          {/* 各科成績 */}
          <div>
            <label className="block text-slate-300 text-sm mb-1">
              各科段考成績（選填，0–100）
            </label>
            <p className="text-slate-500 text-xs mb-3">AI 會依各科成績調整講解深度</p>
            <div className="grid grid-cols-3 gap-2">
              {getSubjectsForGrade(grade).map((s) => (
                <div key={s.id} className="bg-slate-700 rounded-lg px-2 py-2">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs">{s.icon}</span>
                    <span className="text-slate-300 text-xs">{s.label}</span>
                  </div>
                  <input
                    type="number"
                    value={scores[s.id]}
                    onChange={(e) => handleScoreChange(s.id, e.target.value)}
                    placeholder="–"
                    min={0}
                    max={100}
                    className="w-full bg-slate-600 text-white rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500 text-center"
                  />
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? '儲存中...' : '儲存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
