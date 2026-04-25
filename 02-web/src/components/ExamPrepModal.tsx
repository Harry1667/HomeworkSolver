import { useRef, useState } from 'react'
import { examPrep } from '../lib/api'
import { getSubjectsForGrade } from '../types'
import type { User } from '../types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  user: User
  onClose: () => void
}

export default function ExamPrepModal({ user, onClose }: Props) {
  const subjects = getSubjectsForGrade(user.grade)
  const [subject, setSubject] = useState(subjects[0]?.id ?? '')
  const [examDate, setExamDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().slice(0, 10)

  const handleGenerate = async () => {
    if (!examDate) return setError('請選擇考試日期')
    setError('')
    setLoading(true)
    setResult('')
    try {
      for await (const event of examPrep({ userId: user.id, subject, examDate })) {
        if (event.type === 'chunk') setResult(prev => prev + (event.content ?? ''))
        else if (event.type === 'error') setError(event.message ?? 'AI 無法回應')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">考前衝刺計畫</h3>
            <p className="text-xs text-slate-400 mt-0.5">AI 根據你的弱點生成客製化複習計畫</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        {!result && (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">科目</label>
              <div className="flex flex-wrap gap-2">
                {subjects.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSubject(s.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      subject === s.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">考試日期</label>
              <input
                type="date"
                value={examDate}
                min={minDateStr}
                onChange={e => setExamDate(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
            </div>
          </div>
        )}

        {loading && (
          <div className="p-5 flex items-center gap-2 text-slate-400 text-sm">
            <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            AI 正在生成衝刺計畫...
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2 flex-shrink-0">
          {result ? (
            <>
              <button onClick={() => setResult('')} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                重新生成
              </button>
              <button onClick={onClose} className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
                完成
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">取消</button>
              <button
                onClick={handleGenerate}
                disabled={loading || !examDate}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                生成計畫
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
