import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getParentView } from '../lib/api'
import type { UsageStat } from '../lib/api'
import { ALL_SUBJECTS, GRADE_LABELS } from '../types'

const SUBJECT_LABELS: Record<string, string> = Object.fromEntries(ALL_SUBJECTS.map(s => [s.id, s.label]))
const SUBJECT_ICONS: Record<string, string> = Object.fromEntries(ALL_SUBJECTS.map(s => [s.id, s.icon]))

export default function ParentDashboard() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    getParentView(token).then(setData).catch(e => setError(e.message))
  }, [token])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-slate-600 font-medium">連結無效或已過期</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <span className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const { user, weaknesses, examScores, strategies, profile, usage, wrongCount } = data
  const usageMap: Record<string, UsageStat> = {}
  for (const u of (usage as UsageStat[])) usageMap[u.subject] = u

  const subjectsWithData = [...new Set([
    ...Object.keys(weaknesses),
    ...Object.keys(strategies),
    ...(examScores as any[]).map((s: any) => s.subject),
    ...(usage as UsageStat[]).map(u => u.subject),
  ])]

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">
            {user.name.charAt(0)}
          </div>
          <h1 className="text-xl font-bold text-slate-800">{user.name} 的學習狀況</h1>
          <p className="text-slate-400 text-sm">{(GRADE_LABELS as Record<string, string>)[user.grade] || user.grade}</p>
        </div>

        {/* 總覽統計 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 text-center border border-slate-100">
            <div className="text-2xl font-bold text-indigo-600">{(usage as UsageStat[]).reduce((a, u) => a + u.conv_count, 0)}</div>
            <div className="text-xs text-slate-400 mt-1">解題次數</div>
          </div>
          <div className="bg-white rounded-xl p-4 text-center border border-slate-100">
            <div className="text-2xl font-bold text-red-500">{wrongCount}</div>
            <div className="text-xs text-slate-400 mt-1">錯題紀錄</div>
          </div>
          <div className="bg-white rounded-xl p-4 text-center border border-slate-100">
            <div className="text-2xl font-bold text-green-500">{(examScores as any[]).length}</div>
            <div className="text-xs text-slate-400 mt-1">成績紀錄</div>
          </div>
        </div>

        {/* 整體學習檔案 */}
        {profile && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-4">
            <h2 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
              <span>🎓</span> AI 整體學習分析
            </h2>
            <div className="space-y-2">
              {profile.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs text-indigo-500">•</span>
                  <span className="text-slate-600 text-sm">{line.replace(/^[•\-]\s*/, '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 各科狀況 */}
        {subjectsWithData.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-4">
            <h2 className="font-semibold text-slate-800 text-sm mb-4">各科學習狀況</h2>
            <div className="space-y-4">
              {subjectsWithData.map(subj => {
                const stat = usageMap[subj]
                const subjExamScores = (examScores as any[]).filter((s: any) => s.subject === subj)
                const latestScore = subjExamScores[subjExamScores.length - 1]?.score
                const subjWeakness = weaknesses[subj]
                return (
                  <div key={subj} className="border-b border-slate-50 last:border-0 pb-4 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-slate-700 text-sm">
                        {SUBJECT_ICONS[subj]} {SUBJECT_LABELS[subj] || subj}
                      </span>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {stat && <span>解題 {stat.conv_count} 次</span>}
                        {latestScore !== undefined && (
                          <span className={`font-medium ${latestScore >= 80 ? 'text-green-500' : latestScore >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                            {latestScore} 分
                          </span>
                        )}
                      </div>
                    </div>
                    {subjWeakness && (
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {subjWeakness.split('\n').filter((l: string) => l.trim()).slice(0, 2).map((l: string) => l.replace(/^[•\-]\s*/, '')).join('；')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-300 mt-6">此頁面為唯讀，每次開啟會顯示最新資料</p>
      </div>
    </div>
  )
}
