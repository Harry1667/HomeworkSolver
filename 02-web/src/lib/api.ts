import type { User, Conversation, Message, ExamScore } from '../types'

const BASE = '/api'

// ── Users ──────────────────────────────────────────────────
export async function getUsers(): Promise<User[]> {
  const r = await fetch(`${BASE}/users`)
  return r.json()
}

export async function createUser(data: { name: string; grade: string; scores: Record<string, number> | null }): Promise<User> {
  const r = await fetch(`${BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!r.ok) throw new Error((await r.json()).error)
  return r.json()
}

export async function updateUser(id: number, data: { name: string; grade: string; scores: Record<string, number> | null }): Promise<User> {
  const r = await fetch(`${BASE}/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return r.json()
}

export async function deleteUser(id: number): Promise<void> {
  await fetch(`${BASE}/users/${id}`, { method: 'DELETE' })
}

// ── Conversations ──────────────────────────────────────────
export async function getConversations(userId: number, subject: string): Promise<Conversation[]> {
  const r = await fetch(`${BASE}/conversations/${userId}/${subject}`)
  return r.json()
}

export async function deleteConversation(id: number): Promise<void> {
  await fetch(`${BASE}/conversations/${id}`, { method: 'DELETE' })
}

// ── 自訂科目規則 ───────────────────────────────────────────
export async function getSubjectRules(): Promise<Record<string, string>> {
  const r = await fetch(`${BASE}/subject-rules`)
  return r.json()
}

export async function updateSubjectRule(subject: string, extraRules: string): Promise<void> {
  await fetch(`${BASE}/subject-rules/${subject}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ extra_rules: extraRules }),
  })
}

export async function rateConversation(id: number, stars: number): Promise<void> {
  await fetch(`${BASE}/conversations/${id}/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stars }),
  })
}

// ── Messages ───────────────────────────────────────────────
export async function getMessages(conversationId: number): Promise<Message[]> {
  const r = await fetch(`${BASE}/messages/${conversationId}`)
  return r.json()
}

// ── Upload ─────────────────────────────────────────────────
export async function uploadImage(file: File): Promise<{ filename: string; url: string }> {
  const form = new FormData()
  form.append('image', file)
  const r = await fetch(`${BASE}/upload`, { method: 'POST', body: form })
  if (!r.ok) throw new Error('上傳失敗')
  return r.json()
}

// ── App Settings ───────────────────────────────────────────
export async function getAppSettings(): Promise<{ gemini_api_key_masked: string; gemini_enabled: boolean }> {
  const r = await fetch(`${BASE}/app-settings`)
  return r.json()
}

export async function updateAppSettings(data: { gemini_api_key?: string }): Promise<void> {
  await fetch(`${BASE}/app-settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

// ── Exam Scores ────────────────────────────────────────────
export async function getExamScores(userId: number): Promise<ExamScore[]> {
  const r = await fetch(`${BASE}/exam-scores/${userId}`)
  return r.json()
}

export async function addExamScore(data: {
  userId: number
  subject: string
  examName: string
  score: number
  examDate: string
}): Promise<{ id: number; ok: boolean }> {
  const r = await fetch(`${BASE}/exam-scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!r.ok) throw new Error((await r.json()).error)
  return r.json()
}

export async function deleteExamScore(id: number): Promise<void> {
  await fetch(`${BASE}/exam-scores/${id}`, { method: 'DELETE' })
}

// ── Weaknesses ─────────────────────────────────────────────
export async function getWeaknesses(userId: number): Promise<Record<string, string>> {
  const r = await fetch(`${BASE}/weaknesses/${userId}`)
  return r.json()
}

export async function analyzeWeakness(userId: number, subject: string): Promise<{ content: string; skipped?: boolean }> {
  const r = await fetch(`${BASE}/weaknesses/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, subject }),
  })
  if (!r.ok) throw new Error((await r.json()).error)
  return r.json()
}

// ── Wrong Answers ──────────────────────────────────────────
export interface WrongAnswer {
  id: number
  user_id: number
  subject: string
  conversation_id: number
  question: string
  ai_answer: string
  note: string
  created_at: string
}

export async function getWrongAnswers(userId: number): Promise<WrongAnswer[]> {
  const r = await fetch(`${BASE}/wrong-answers/${userId}`)
  return r.json()
}

export async function addWrongAnswer(data: {
  userId: number
  subject: string
  conversationId: number
  question: string
  aiAnswer: string
  note?: string
}): Promise<{ id: number; ok: boolean }> {
  const r = await fetch(`${BASE}/wrong-answers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!r.ok) throw new Error((await r.json()).error)
  return r.json()
}

export async function deleteWrongAnswer(id: number, userId: number): Promise<void> {
  await fetch(`${BASE}/wrong-answers/${id}?userId=${userId}`, { method: 'DELETE' })
}

// ── Usage Stats ────────────────────────────────────────────
export interface UsageStat {
  subject: string
  conv_count: number
  msg_count: number
}

export async function getUsageStats(userId: number): Promise<UsageStat[]> {
  const r = await fetch(`${BASE}/usage-stats/${userId}`)
  return r.json()
}

// ── Parent Mode ────────────────────────────────────────────
export async function getParentToken(userId: number): Promise<{ token: string }> {
  const r = await fetch(`${BASE}/parent/token/${userId}`)
  return r.json()
}

export async function getParentView(token: string): Promise<any> {
  const r = await fetch(`${BASE}/parent/view/${token}`)
  if (!r.ok) throw new Error('連結無效')
  return r.json()
}

// ── Exam Prep (SSE) ────────────────────────────────────────
export async function* examPrep(payload: {
  userId: number
  subject: string
  examDate: string
}): AsyncGenerator<{ type: string; content?: string; message?: string }> {
  const res = await fetch(`${BASE}/exam-prep`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.body) throw new Error('無回應')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      if (part.startsWith('data: ')) {
        try { yield JSON.parse(part.slice(6)) } catch {}
      }
    }
  }
}

// ── Strategies ─────────────────────────────────────────────
export async function getStrategies(userId: number): Promise<Record<string, { strategy: string; updated_at: string }>> {
  const r = await fetch(`${BASE}/strategies/${userId}`)
  return r.json()
}

// ── Solve (SSE) ────────────────────────────────────────────
export type SolveEvent =
  | { type: 'meta'; conversationId: number }
  | { type: 'chunk'; content: string }
  | { type: 'done'; conversationId: number; provider?: string; model?: string }
  | { type: 'error'; message: string }

export async function* solve(payload: {
  userId: number
  subject: string
  message: string
  conversationId?: number | null
  imageName?: string | null
  selfSolve?: boolean
}): AsyncGenerator<SolveEvent> {
  const res = await fetch(`${BASE}/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.body) throw new Error('無回應')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      if (part.startsWith('data: ')) {
        try {
          yield JSON.parse(part.slice(6)) as SolveEvent
        } catch {
          // skip malformed
        }
      }
    }
  }
}
