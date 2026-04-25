import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useStore } from './store/useStore'
import UserPicker from './pages/UserPicker'
import MainLayout from './pages/MainLayout'
import SubjectRulesPage from './pages/SubjectRulesPage'
import ProfilePage from './pages/ProfilePage'
import WrongAnswersPage from './pages/WrongAnswersPage'
import ParentDashboard from './pages/ParentDashboard'

export default function App() {
  const theme = useStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  return (
    <Routes>
      <Route path="/" element={<UserPicker />} />
      <Route path="/main" element={<MainLayout />} />
      <Route path="/subject-rules" element={<SubjectRulesPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/wrong-answers" element={<WrongAnswersPage />} />
      <Route path="/parent/:token" element={<ParentDashboard />} />
    </Routes>
  )
}
