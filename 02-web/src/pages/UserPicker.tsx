import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { getUsers, deleteUser } from '../lib/api'
import type { User } from '../types'
import { GRADE_LABELS } from '../types'
import UserModal from '../components/UserModal'

function ThemeToggle() {
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  return (
    <button
      onClick={toggleTheme}
      className="fixed top-4 right-4 w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
      title={theme === 'dark' ? '切換淺色模式' : '切換深色模式'}
    >
      {theme === 'dark' ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  )
}

export default function UserPicker() {
  const navigate = useNavigate()
  const currentUser = useStore((s) => s.currentUser)
  const setCurrentUser = useStore((s) => s.setCurrentUser)

  const [users, setUsers] = useState<User[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)

  const load = async () => setUsers(await getUsers())

  // 若 localStorage 已有登入使用者，直接跳轉主畫面
  useEffect(() => {
    if (currentUser) navigate('/main', { replace: true })
  }, [currentUser, navigate])

  useEffect(() => { load() }, [])

  const handleSelect = (user: User) => {
    setCurrentUser(user)
    navigate('/main')
  }

  const handleDelete = async (e: React.MouseEvent, user: User) => {
    e.stopPropagation()
    if (!confirm(`確定要刪除「${user.name}」嗎？所有對話紀錄也會一併刪除。`)) return
    await deleteUser(user.id)
    load()
  }

  const handleEdit = (e: React.MouseEvent, user: User) => {
    e.stopPropagation()
    setEditUser(user)
    setModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
      <ThemeToggle />
      <div className="w-full max-w-md">
        {/* 標題 */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">📚</div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">作業解題助手</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">選擇使用者或建立新的學習檔案</p>
        </div>

        {/* 使用者列表 */}
        <div className="space-y-3 mb-6">
          {users.length === 0 && (
            <p className="text-center text-slate-500 dark:text-slate-500 py-8">尚無使用者，請先建立一個</p>
          )}
          {users.map((user) => (
            <div
              key={user.id}
              className="w-full flex items-center gap-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl p-4 transition-colors group shadow-sm dark:shadow-none"
            >
              {/* 頭像 + 資訊（可點選進入） */}
              <button
                onClick={() => handleSelect(user)}
                className="flex items-center gap-4 flex-1 min-w-0 text-left"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-slate-900 dark:text-white font-medium">{user.name}</div>
                  <div className="text-slate-500 dark:text-slate-400 text-sm">
                    {GRADE_LABELS[user.grade]}
                    {user.scores && Object.keys(user.scores).length > 0
                      ? `・已設定 ${Object.keys(user.scores).length} 科成績`
                      : ''}
                  </div>
                </div>
              </button>
              {/* 操作按鈕 */}
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={(e) => handleEdit(e, user)}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-600"
                >
                  編輯
                </button>
                <button
                  onClick={(e) => handleDelete(e, user)}
                  className="text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 text-sm px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-600"
                >
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 新增按鈕 */}
        <button
          onClick={() => { setEditUser(null); setModalOpen(true) }}
          className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:border-indigo-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors text-sm font-medium"
        >
          + 建立新使用者
        </button>
      </div>

      {modalOpen && (
        <UserModal
          user={editUser}
          onClose={() => setModalOpen(false)}
          onSave={() => { setModalOpen(false); load() }}
        />
      )}
    </div>
  )
}
