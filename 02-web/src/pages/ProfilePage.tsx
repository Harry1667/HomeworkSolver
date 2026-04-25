import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { getExamScores, addExamScore, deleteExamScore, getWeaknesses, analyzeWeakness, getUsageStats, getParentToken, getStrategies } from '../lib/api'
import type { UsageStat } from '../lib/api'
import { getSubjectsForGrade, GRADE_LABELS } from '../types'
import ExamPrepModal from '../components/ExamPrepModal'
import type { ExamScore } from '../types'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'

const LINE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#84cc16']

// ── Custom recharts components ──────────────────────────────
function ScoreDot(props: any) {
  const { cx, cy, value } = props
  const color = value >= 80 ? '#22c55e' : value >= 60 ? '#f59e0b' : '#ef4444'
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />
}

function ScoreTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  if (payload.length === 1) {
    const score = payload[0].value
    const color = score >= 80 ? 'text-green-500' : score >= 60 ? 'text-amber-500' : 'text-red-500'
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-lg text-sm">
        <div className="text-slate-500 dark:text-slate-400 text-xs mb-0.5">{label}</div>
        <div className={`font-bold text-lg ${color}`}>{score} 分</div>
      </div>
    )
  }
  // Multi-subject tooltip
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 shadow-lg text-sm min-w-[120px]">
      <div className="text-slate-500 dark:text-slate-400 text-xs mb-2 font-medium">{label}</div>
      <div className="space-y-1">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
              <span className="text-slate-600 dark:text-slate-300 text-xs">{p.name}</span>
            </div>
            <span className="font-semibold text-slate-800 dark:text-white text-xs">{p.value} 分</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Add Score Modal ─────────────────────────────────────────
interface AddScoreModalProps {
  subject: string
  subjectLabel: string
  onClose: () => void
  onSaved: () => void
  userId: number
}

function AddScoreModal({ subject, subjectLabel, onClose, onSaved, userId }: AddScoreModalProps) {
  const [examName, setExamName] = useState('')
  const [score, setScore] = useState('')
  const [examDate, setExamDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const presets = ['第一次段考', '第二次段考', '期中考', '期末考', '模擬考', '小考']

  const handleSave = async () => {
    const s = Number(score)
    if (!examName.trim()) return setError('請填寫考試名稱')
    if (isNaN(s) || s < 0 || s > 100) return setError('成績請填 0–100')
    if (!examDate) return setError('請選擇日期')
    setError('')
    setSaving(true)
    try {
      await addExamScore({ userId, subject, examName: examName.trim(), score: s, examDate })
      onSaved()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 dark:text-white">新增考試成績</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Subject badge */}
          <div className="text-xs text-slate-400 dark:text-slate-500">科目：{subjectLabel}</div>

          {/* Exam name */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">考試名稱</label>
            <input
              type="text"
              value={examName}
              onChange={e => setExamName(e.target.value)}
              placeholder="例：第一次段考"
              className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {presets.map(p => (
                <button
                  key={p}
                  onClick={() => setExamName(p)}
                  className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Score */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">成績（0–100）</label>
            <input
              type="number"
              value={score}
              onChange={e => setScore(e.target.value)}
              placeholder="85"
              min={0} max={100}
              className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">考試日期</label>
            <input
              type="date"
              value={examDate}
              onChange={e => setExamDate(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">取消</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? '儲存中...' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Profile Page ───────────────────────────────────────
export default function ProfilePage() {
  const navigate = useNavigate()
  const currentUser = useStore(s => s.currentUser)
  const theme = useStore(s => s.theme)

  const [examScores, setExamScores] = useState<ExamScore[]>([])
  const [weaknesses, setWeaknesses] = useState<Record<string, string>>({})
  const [analyzing, setAnalyzing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [showExamPrep, setShowExamPrep] = useState(false)
  const [usageStats, setUsageStats] = useState<UsageStat[]>([])
  const [strategies, setStrategies] = useState<Record<string, { strategy: string; updated_at: string }>>({})
  const [parentToken, setParentToken] = useState<string | null>(null)
  const [copyMsg, setCopyMsg] = useState('')

  useEffect(() => {
    if (!currentUser) { navigate('/', { replace: true }); return }
    loadAll()
  }, [currentUser])

  const subjects = currentUser ? getSubjectsForGrade(currentUser.grade) : []
  const [activeSubjectId, setActiveSubjectId] = useState(subjects[0]?.id ?? '')

  const activeSubject = subjects.find(s => s.id === activeSubjectId)

  const loadAll = async () => {
    if (!currentUser) return
    const [scores, weak, usage, strats] = await Promise.all([
      getExamScores(currentUser.id),
      getWeaknesses(currentUser.id),
      getUsageStats(currentUser.id),
      getStrategies(currentUser.id),
    ])
    setExamScores(scores)
    setWeaknesses(weak)
    setUsageStats(usage)
    setStrategies(strats)
  }

  const handleGetParentLink = async () => {
    if (!currentUser) return
    const { token } = await getParentToken(currentUser.id)
    setParentToken(token)
    const url = `${window.location.origin}/parent/${token}`
    await navigator.clipboard.writeText(url)
    setCopyMsg('連結已複製！')
    setTimeout(() => setCopyMsg(''), 2000)
  }

  const isAllView = activeSubjectId === 'all'
  const subjectScores = isAllView ? [] : examScores.filter(s => s.subject === activeSubjectId)
  const chartData = subjectScores.map(s => ({
    name: s.exam_name,
    score: s.score,
    date: s.exam_date,
  }))

  // 全部科目合併圖表數據
  const subjectsWithData = useMemo(
    () => subjects.filter(s => examScores.some(e => e.subject === s.id)),
    [examScores, subjects]
  )

  const allChartData = useMemo(() => {
    if (!examScores.length) return []
    // 以 exam_name 為橫軸，同名考試視為同一次
    const examMap = new Map<string, { date: string; scores: Record<string, number> }>()
    for (const s of examScores) {
      if (!examMap.has(s.exam_name)) examMap.set(s.exam_name, { date: s.exam_date, scores: {} })
      const entry = examMap.get(s.exam_name)!
      if (s.exam_date < entry.date) entry.date = s.exam_date
      entry.scores[s.subject] = s.score
    }
    return [...examMap.entries()]
      .sort(([, a], [, b]) => a.date.localeCompare(b.date))
      .map(([name, { scores }]) => ({ name, ...scores }))
  }, [examScores])

  const latestScore = subjectScores[subjectScores.length - 1]?.score
  const avgScore = subjectScores.length
    ? Math.round(subjectScores.reduce((a, b) => a + b.score, 0) / subjectScores.length)
    : null
  const trend = subjectScores.length >= 2
    ? subjectScores[subjectScores.length - 1].score - subjectScores[subjectScores.length - 2].score
    : null

  const currentWeakness = weaknesses[activeSubjectId] ?? ''
  const totalRecorded = Object.entries(
    examScores.reduce<Record<string, boolean>>((acc, s) => { acc[s.subject] = true; return acc }, {})
  ).length

  const handleAnalyze = async () => {
    if (!currentUser) return
    setAnalyzing(true)
    try {
      const result = await analyzeWeakness(currentUser.id, activeSubjectId)
      setWeaknesses(prev => ({ ...prev, [activeSubjectId]: result.content }))
    } catch (e) {
      console.error(e)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    await deleteExamScore(id)
    setExamScores(prev => prev.filter(s => s.id !== id))
    setDeletingId(null)
  }

  const gridColor = theme === 'dark' ? '#334155' : '#f1f5f9'
  const axisColor = theme === 'dark' ? '#64748b' : '#94a3b8'

  if (!currentUser) return null

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <button
          onClick={() => navigate('/main')}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-semibold text-slate-800 dark:text-white">學習檔案</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

          {/* User hero card */}
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold flex-shrink-0 backdrop-blur-sm">
                {currentUser.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xl font-bold">{currentUser.name}</div>
                <div className="text-indigo-200 text-sm">{GRADE_LABELS[currentUser.grade]}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="bg-white/10 rounded-xl px-3 py-2.5 text-center backdrop-blur-sm">
                <div className="text-xl font-bold">{totalRecorded}</div>
                <div className="text-indigo-200 text-xs mt-0.5">已追蹤科目</div>
              </div>
              <div className="bg-white/10 rounded-xl px-3 py-2.5 text-center backdrop-blur-sm">
                <div className="text-xl font-bold">{examScores.length}</div>
                <div className="text-indigo-200 text-xs mt-0.5">成績紀錄</div>
              </div>
              <div className="bg-white/10 rounded-xl px-3 py-2.5 text-center backdrop-blur-sm">
                <div className="text-xl font-bold">{Object.keys(weaknesses).length}</div>
                <div className="text-indigo-200 text-xs mt-0.5">已分析科目</div>
              </div>
            </div>
          </div>

          {/* Subject tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {/* 全部 tab */}
            <button
              onClick={() => setActiveSubjectId('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                activeSubjectId === 'all'
                  ? 'bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <span className="text-base leading-none">📊</span>
              <span>全部趨勢</span>
            </button>
            {subjects.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSubjectId(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                  activeSubjectId === s.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <span className="text-base leading-none">{s.icon}</span>
                <span>{s.label}</span>
                {examScores.some(e => e.subject === s.id) && (
                  <span className={`w-1.5 h-1.5 rounded-full ${activeSubjectId === s.id ? 'bg-white/60' : 'bg-indigo-400'}`} />
                )}
              </button>
            ))}
          </div>

          {/* Score Chart Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-lg">{isAllView ? '📊' : activeSubject?.icon}</span>
                <div>
                  <h2 className="font-semibold text-slate-800 dark:text-white text-sm">
                    {isAllView ? '全部科目成績趨勢' : `${activeSubject?.label} 成績趨勢`}
                  </h2>
                  {!isAllView && subjectScores.length > 0 && (
                    <div className="flex items-center gap-3 mt-0.5">
                      {latestScore !== undefined && (
                        <span className={`text-xs font-medium ${latestScore >= 80 ? 'text-green-500' : latestScore >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                          最新 {latestScore} 分
                        </span>
                      )}
                      {avgScore !== null && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">平均 {avgScore} 分</span>
                      )}
                      {trend !== null && (
                        <span className={`text-xs ${trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                          {trend > 0 ? `↑ +${trend}` : trend < 0 ? `↓ ${trend}` : '→ 持平'}
                        </span>
                      )}
                    </div>
                  )}
                  {isAllView && subjectsWithData.length > 0 && (
                    <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {subjectsWithData.length} 科有成績紀錄
                    </div>
                  )}
                </div>
              </div>
              {!isAllView && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  新增成績
                </button>
              )}
            </div>

            <div className="p-5">
              {/* 全部科目多線圖 */}
              {isAllView ? (
                allChartData.length === 0 || subjectsWithData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
                      <span className="text-xl">📊</span>
                    </div>
                    <p className="text-slate-400 dark:text-slate-500 text-sm">尚無任何科目成績</p>
                    <p className="text-slate-300 dark:text-slate-600 text-xs mt-1">先切換到各科目新增段考成績</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={allChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} ticks={[0, 20, 40, 60, 80, 100]} />
                      <ReferenceLine y={60} stroke={theme === 'dark' ? '#ef4444' : '#fca5a5'} strokeDasharray="4 4" />
                      <ReferenceLine y={80} stroke={theme === 'dark' ? '#22c55e' : '#86efac'} strokeDasharray="4 4" />
                      <Tooltip content={<ScoreTooltip />} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                        formatter={(value) => {
                          const s = subjects.find(s => s.id === value)
                          return s ? `${s.icon} ${s.label}` : value
                        }}
                      />
                      {subjectsWithData.map((s, i) => (
                        <Line
                          key={s.id}
                          type="monotone"
                          dataKey={s.id}
                          name={s.id}
                          stroke={LINE_COLORS[i % LINE_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 4, fill: LINE_COLORS[i % LINE_COLORS.length], stroke: 'white', strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                          connectNulls={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )
              ) : (
                /* 單科圖 */
                chartData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <p className="text-slate-400 dark:text-slate-500 text-sm">尚無成績紀錄</p>
                    <p className="text-slate-300 dark:text-slate-600 text-xs mt-1">點擊「新增成績」記錄你的段考結果</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} ticks={[0, 20, 40, 60, 80, 100]} />
                      <ReferenceLine y={60} stroke={theme === 'dark' ? '#ef4444' : '#fca5a5'} strokeDasharray="4 4" />
                      <ReferenceLine y={80} stroke={theme === 'dark' ? '#22c55e' : '#86efac'} strokeDasharray="4 4" />
                      <Tooltip content={<ScoreTooltip />} />
                      <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2.5} dot={<ScoreDot />} activeDot={{ r: 7, stroke: '#6366f1', strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )
              )}
            </div>
          </div>

          {/* Weakness Card — 只在單科模式顯示 */}
          {!isAllView && <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
              <div>
                <h2 className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                  <span>🎯</span> AI 弱點分析
                </h2>
                <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">根據你在 {activeSubject?.label} 的對話記錄自動分析</p>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                {analyzing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {currentWeakness ? '重新分析' : 'AI 分析'}
                  </>
                )}
              </button>
            </div>

            <div className="p-5">
              {currentWeakness ? (
                <div className="space-y-2">
                  {currentWeakness.split('\n').filter(l => l.trim()).map((line, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-red-500 text-xs">!</span>
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                        {line.replace(/^[•\-]\s*/, '')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-3">
                    <span className="text-2xl">🔍</span>
                  </div>
                  <p className="text-slate-400 dark:text-slate-500 text-sm">尚未進行弱點分析</p>
                  <p className="text-slate-300 dark:text-slate-600 text-xs mt-1">需有足夠的對話紀錄才能分析</p>
                </div>
              )}
            </div>
          </div>}

          {/* Score History — 只在單科模式顯示 */}
          {!isAllView && subjectScores.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                <h2 className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                  <span>📋</span> 考試紀錄
                </h2>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {[...subjectScores].reverse().map(s => {
                  const scoreColor = s.score >= 80 ? 'text-green-500 bg-green-50 dark:bg-green-900/20' :
                    s.score >= 60 ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' :
                    'text-red-500 bg-red-50 dark:bg-red-900/20'
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${scoreColor}`}>
                        {s.score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-800 dark:text-slate-200 text-sm font-medium">{s.exam_name}</div>
                        <div className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">{s.exam_date}</div>
                      </div>
                      <button
                        onClick={() => handleDelete(s.id)}
                        disabled={deletingId === s.id}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0 disabled:opacity-40"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 使用量統計 */}
          {usageStats.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                <h2 className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                  <span>📊</span> 解題使用量
                </h2>
              </div>
              <div className="p-4 grid grid-cols-2 gap-2">
                {usageStats.map(u => (
                  <div key={u.subject} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
                    <span className="text-base">{subjects.find(s => s.id === u.subject)?.icon ?? '📝'}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                        {subjects.find(s => s.id === u.subject)?.label ?? u.subject}
                      </div>
                      <div className="text-xs text-slate-400">{u.conv_count} 次對話・{u.msg_count} 題</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 考前衝刺 + 家長模式 */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowExamPrep(true)}
              className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4 text-white text-left hover:from-amber-400 hover:to-orange-400 transition-all shadow-sm"
            >
              <div className="text-2xl mb-2">🚀</div>
              <div className="font-semibold text-sm">考前衝刺計畫</div>
              <div className="text-amber-100 text-xs mt-0.5">AI 依弱點生成複習計畫</div>
            </button>
            <button
              onClick={handleGetParentLink}
              className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl p-4 text-white text-left hover:from-slate-500 hover:to-slate-600 transition-all shadow-sm"
            >
              <div className="text-2xl mb-2">👨‍👩‍👧</div>
              <div className="font-semibold text-sm">家長查看連結</div>
              <div className="text-slate-300 text-xs mt-0.5">{copyMsg || '複製唯讀連結給家長'}</div>
            </button>
          </div>

          {/* 教學策略更新時間 */}
          {Object.keys(strategies).length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                <h2 className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                  <span>🤖</span> Agent 教學策略狀態
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">每次解完題後自動更新</p>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {Object.entries(strategies).map(([subj, data]) => (
                  <div key={subj} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{subjects.find(s => s.id === subj)?.icon ?? '📝'}</span>
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {subjects.find(s => s.id === subj)?.label ?? subj}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span className="text-xs text-slate-400">{data.updated_at.slice(0, 10)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom padding */}
          <div className="h-4" />
        </div>
      </div>

      {showExamPrep && <ExamPrepModal user={currentUser} onClose={() => setShowExamPrep(false)} />}

      {showAddModal && activeSubject && (
        <AddScoreModal
          subject={activeSubjectId}
          subjectLabel={activeSubject.label}
          userId={currentUser.id}
          onClose={() => setShowAddModal(false)}
          onSaved={async () => {
            setShowAddModal(false)
            const scores = await getExamScores(currentUser.id)
            setExamScores(scores)
          }}
        />
      )}
    </div>
  )
}
