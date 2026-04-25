import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Conversation } from '../types'

interface Store {
  currentUser: User | null
  currentSubject: string | null
  currentConversation: Conversation | null
  theme: 'dark' | 'light'
  pendingQuestion: string | null
  setCurrentUser: (user: User | null) => void
  setCurrentSubject: (subject: string | null) => void
  setCurrentConversation: (conv: Conversation | null) => void
  toggleTheme: () => void
  setPendingQuestion: (q: string | null) => void
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      currentUser: null,
      currentSubject: null,
      currentConversation: null,
      theme: 'dark',
      pendingQuestion: null,

      setCurrentUser: (user) =>
        set({ currentUser: user, currentSubject: null, currentConversation: null }),

      setCurrentSubject: (subject) =>
        set({ currentSubject: subject, currentConversation: null }),

      setCurrentConversation: (conv) =>
        set({ currentConversation: conv }),

      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      setPendingQuestion: (q) => set({ pendingQuestion: q }),
    }),
    {
      name: 'homeworksolver',
      partialize: (state) => ({
        currentUser: state.currentUser,
        currentSubject: state.currentSubject,
        theme: state.theme,
      }),
    }
  )
)
