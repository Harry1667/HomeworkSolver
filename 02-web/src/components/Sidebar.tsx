import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { getConversations, deleteConversation } from '../lib/api'
import { getSubjectsForGrade, GRADE_LABELS, ADVISOR_SUBJECT } from '../types'
import type { Conversation } from '../types'
import SettingsModal from './SettingsModal'

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const navigate = useNavigate()
  const currentUser = useStore((s) => s.currentUser)
  const currentSubject = useStore((s) => s.currentSubject)
  const currentConversation = useStore((s) => s.currentConversation)
  const setCurrentSubject = useStore((s) => s.setCurrentSubject)
  const setCurrentConversation = useStore((s) => s.setCurrentConversation)
  const setCurrentUser = useStore((s) => s.setCurrentUser)

  const [histories, setHistories] = useState<Record<string, Conversation[]>>({})
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // 當切換科目時，載入歷史對話
  useEffect(() => {
    if (!currentUser || !currentSubject) return
    loadHistory(currentSubject)
    setExpandedSubject(currentSubject)
  }, [currentSubject, currentUser])

  // 當有新對話建立時，重新載入歷史
  useEffect(() => {
    if (!currentConversation || !currentSubject) return
    const subjectHistory = histories[currentSubject] ?? []
    if (!subjectHistory.find((c) => c.id === currentConversation.id)) {
      loadHistory(currentSubject)
    }
  }, [currentConversation?.id])

  const loadHistory = async (subject: string) => {
    if (!currentUser) return
    const convs = await getConversations(currentUser.id, subject)
    setHistories((prev) => ({ ...prev, [subject]: convs }))
  }

  const handleSubjectClick = (subjectId: string) => {
    if (expandedSubject === subjectId && currentSubject === subjectId) {
      // 再次點選同科目：切換展開/收合
      setExpandedSubject(expandedSubject ? null : subjectId)
      return
    }
    setCurrentSubject(subjectId)
    setExpandedSubject(subjectId)
    loadHistory(subjectId)
  }

  const handleNewConversation = (e: React.MouseEvent, subjectId: string) => {
    e.stopPropagation()
    setCurrentSubject(subjectId)
    setCurrentConversation(null)
  }

  const handleConversationClick = (conv: Conversation) => {
    setCurrentSubject(conv.subject)
    setCurrentConversation(conv)
  }

  const handleDeleteConversation = async (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation()
    if (!confirm('確定刪除這筆對話？')) return
    await deleteConversation(conv.id)
    loadHistory(conv.subject)
    if (currentConversation?.id === conv.id) setCurrentConversation(null)
  }

  const handleLogout = () => {
    setCurrentUser(null)
    navigate('/')
  }

  if (!currentUser) return null

  return (
    <aside className="w-64 flex flex-col bg-sidebar-bg text-sidebar-text h-full overflow-hidden flex-shrink-0">
      {/* 使用者資訊 */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          {/* 手機版關閉按鈕 */}
          <button
            onClick={onClose}
            className="md:hidden mr-1 text-slate-500 hover:text-slate-300 flex-shrink-0"
            aria-label="關閉選單"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-lg hover:bg-slate-800 -mx-1 px-1 py-1 transition-colors group"
          >
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 group-hover:bg-indigo-500 transition-colors">
              {currentUser.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-slate-200 font-medium text-sm truncate">{currentUser.name}</div>
              <div className="text-slate-500 text-xs">
                {GRADE_LABELS[currentUser.grade]} · 學習檔案
              </div>
            </div>
            <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* 科目列表 */}
      <nav className="flex-1 overflow-y-auto py-2">

        {/* 班級導師 */}
        <div className="px-1 mb-1">
          <div
            className={`group flex items-center gap-2 px-3 py-2 text-sm transition-colors rounded ${
              currentSubject === ADVISOR_SUBJECT
                ? 'bg-indigo-700/60 text-indigo-100'
                : 'hover:bg-slate-800 text-slate-300 hover:text-slate-100'
            }`}
          >
            <button
              onClick={() => { setCurrentSubject(ADVISOR_SUBJECT); setExpandedSubject(ADVISOR_SUBJECT); loadHistory(ADVISOR_SUBJECT) }}
              className="flex items-center gap-2 flex-1 text-left"
            >
              <span className="text-base leading-none">🎓</span>
              <span className="flex-1">班級導師</span>
            </button>
            <button
              onClick={(e) => handleNewConversation(e, ADVISOR_SUBJECT)}
              className="opacity-0 group-hover:opacity-100 hover:text-indigo-400 p-0.5 rounded"
              title="新對話"
            >
              +
            </button>
          </div>
          {expandedSubject === ADVISOR_SUBJECT && (histories[ADVISOR_SUBJECT] ?? []).length > 0 && (
            <div className="ml-6 mr-1 mb-1 space-y-0.5">
              {(histories[ADVISOR_SUBJECT] ?? []).map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleConversationClick(conv)}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded truncate flex items-center gap-1 group/conv transition-colors ${
                    currentConversation?.id === conv.id
                      ? 'bg-indigo-900/50 text-indigo-300'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate flex-1">{conv.title}</span>
                  <span
                    role="button"
                    onClick={(e) => handleDeleteConversation(e, conv)}
                    className="opacity-0 group-hover/conv:opacity-100 hover:text-red-400 flex-shrink-0"
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mx-3 my-1 border-t border-slate-800" />

        {getSubjectsForGrade(currentUser.grade).map((subject) => {
          const isActive = currentSubject === subject.id
          const isExpanded = expandedSubject === subject.id
          const subjectHistory = histories[subject.id] ?? []

          return (
            <div key={subject.id}>
              {/* 科目行 */}
              <div
                className={`group flex items-center gap-2 px-3 py-2 text-sm transition-colors rounded mx-1 ${
                  isActive
                    ? 'bg-sidebar-active text-sidebar-text-active'
                    : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <button
                  onClick={() => handleSubjectClick(subject.id)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  <span className="text-base leading-none">{subject.icon}</span>
                  <span className="flex-1 text-left">{subject.label}</span>
                </button>
                <button
                  onClick={(e) => handleNewConversation(e, subject.id)}
                  className="opacity-0 group-hover:opacity-100 hover:text-indigo-400 p-0.5 rounded"
                  title="新對話"
                >
                  +
                </button>
              </div>

              {/* 歷史對話（展開時顯示） */}
              {isExpanded && subjectHistory.length > 0 && (
                <div className="ml-6 mr-1 mb-1 space-y-0.5">
                  {subjectHistory.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => handleConversationClick(conv)}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded truncate flex items-center gap-1 group/conv transition-colors ${
                        currentConversation?.id === conv.id
                          ? 'bg-indigo-900/50 text-indigo-300'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate flex-1">{conv.title}</span>
                      <span
                        role="button"
                        onClick={(e) => handleDeleteConversation(e, conv)}
                        className="opacity-0 group-hover/conv:opacity-100 hover:text-red-400 flex-shrink-0"
                      >
                        ×
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* 底部按鈕 */}
      <div className="p-3 border-t border-slate-800 space-y-0.5">
        <button
          onClick={() => navigate('/wrong-answers')}
          className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 px-2 py-2 rounded hover:bg-slate-800 transition-colors"
        >
          <span className="w-3.5 h-3.5 flex items-center justify-center text-sm leading-none">❌</span>
          錯題本
        </button>
        <button
          onClick={() => navigate('/subject-rules')}
          className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 px-2 py-2 rounded hover:bg-slate-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          自訂科目要求
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 px-2 py-2 rounded hover:bg-slate-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          設定
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 px-2 py-2 rounded hover:bg-slate-800 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          切換使用者
        </button>
      </div>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </aside>
  )
}
