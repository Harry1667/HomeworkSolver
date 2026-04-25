import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import Sidebar from '../components/Sidebar'
import ChatArea from '../components/ChatArea'

export default function MainLayout() {
  const navigate = useNavigate()
  const currentUser = useStore((s) => s.currentUser)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // 若沒有選使用者，回到選擇頁
  useEffect(() => {
    if (!currentUser) navigate('/', { replace: true })
  }, [currentUser, navigate])

  if (!currentUser) return null

  return (
    <div className="flex h-full overflow-hidden">
      {/* 手機版背景遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 側欄：桌面版固定，手機版 overlay */}
      <div className={`
        fixed inset-y-0 left-0 z-30 md:static md:z-auto
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900">
        <ChatArea onOpenSidebar={() => setSidebarOpen(true)} />
      </main>
    </div>
  )
}
