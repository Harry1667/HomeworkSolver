import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { getWrongAnswers, deleteWrongAnswer } from '../lib/api'

import type { WrongAnswer } from '../lib/api'
import { ALL_SUBJECTS } from '../types'

const SUBJECT_LABELS: Record<string, string> = Object.fromEntries(
  ALL_SUBJECTS.map(s => [s.id, s.label])
)
const SUBJECT_ICONS: Record<string, string> = Object.fromEntries(
  ALL_SUBJECTS.map(s => [s.id, s.icon])
)

export default function WrongAnswersPage() {
  const navigate = useNavigate()
  const currentUser = useStore(s => s.currentUser)
  const setCurrentSubject = useStore(s => s.setCurrentSubject)
  const setCurrentConversation = useStore(s => s.setCurrentConversation)
  const setPendingQuestion = useStore(s => s.setPendingQuestion)
  const [items, setItems] = useState<WrongAnswer[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    if (!currentUser) { navigate('/'); return }
    getWrongAnswers(currentUser.id).then(setItems)
  }, [currentUser])

  const subjects = [...new Set(items.map(i => i.subject))]

  const filtered = filter === 'all' ? items : items.filter(i => i.subject === filter)

  const handleDelete = async (item: WrongAnswer) => {
    if (!currentUser) return
    await deleteWrongAnswer(item.id, currentUser.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
  }

  const handleGoToConversation = (item: WrongAnswer) => {
    setCurrentSubject(item.subject)
    setCurrentConversation({
      id: item.conversation_id,
      user_id: item.user_id,
      subject: item.subject,
      title: item.question.slice(0, 25) || '錯題',
      created_at: item.created_at,
    })
    navigate('/main')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate('/main')}
          className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          ← 返回
        </button>
        <div>
          <h1 className="font-semibold text-slate-800 dark:text-slate-100">錯題本</h1>
          <p className="text-xs text-slate-400">共 {items.length} 道錯題</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* 科目篩選 */}
        {subjects.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            <button
              onClick={() => setFilter('all')}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === 'all'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-400 hover:text-indigo-600'
              }`}
            >
              全部
            </button>
            {subjects.map(subj => (
              <button
                key={subj}
                onClick={() => setFilter(subj)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filter === subj
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-400 hover:text-indigo-600'
                }`}
              >
                {SUBJECT_ICONS[subj]} {SUBJECT_LABELS[subj] || subj}
              </button>
            ))}
          </div>
        )}

        {/* 空白狀態 */}
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-slate-500">
              {filter === 'all' ? '還沒有錯題' : `${SUBJECT_LABELS[filter] || filter}沒有錯題`}
            </p>
            <p className="text-slate-400 text-sm mt-1">解題時點「我答錯了」就會記在這裡</p>
          </div>
        )}

        {/* 錯題列表 */}
        <div className="space-y-3">
          {filtered.map(item => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              {/* 題目標題列 */}
              <div
                className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                onClick={() => setExpanded(expanded === item.id ? null : item.id)}
              >
                <span className="text-base mt-0.5 flex-shrink-0">{SUBJECT_ICONS[item.subject] || '📝'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      {SUBJECT_LABELS[item.subject] || item.subject}
                    </span>
                    <span className="text-xs text-slate-400">{item.created_at.slice(0, 10)}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                    {item.question || '（圖片題目）'}
                  </p>
                </div>
                <span className="text-slate-400 text-xs flex-shrink-0 mt-1">
                  {expanded === item.id ? '▲' : '▼'}
                </span>
              </div>

              {/* 展開內容 */}
              {expanded === item.id && (
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700">
                  <div className="mt-3 bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">AI 解析</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap line-clamp-6">
                      {item.ai_answer}
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleGoToConversation(item)}
                      className="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-lg transition-colors"
                    >
                      查看解析
                    </button>
                    {item.question && (
                      <button
                        onClick={() => {
                          setCurrentSubject(item.subject)
                          setCurrentConversation(null)
                          setPendingQuestion(item.question)
                          navigate('/main')
                        }}
                        className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg transition-colors"
                      >
                        ✏️ 重新練習
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(item)}
                      className="text-xs text-slate-400 hover:text-red-500 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
