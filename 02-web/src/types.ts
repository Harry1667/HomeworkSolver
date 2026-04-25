export type Grade = 'middle' | 'high' | 'university'

export interface ExamScore {
  id: number
  user_id: number
  subject: string
  exam_name: string
  score: number
  exam_date: string
  created_at: string
}

export interface User {
  id: number
  name: string
  grade: Grade
  scores: Record<string, number> | null
  created_at: string
}

export interface Conversation {
  id: number
  user_id: number
  subject: string
  title: string
  created_at: string
}

export interface Message {
  id: number
  conversation_id: number
  role: 'user' | 'assistant'
  content: string
  image_name: string | null
  created_at: string
}

export interface Subject {
  id: string
  label: string
  icon: string
}

export const SUBJECTS_BY_GRADE: Record<Grade, Subject[]> = {
  middle: [
    { id: 'chinese',   label: '國文', icon: '📖' },
    { id: 'english',   label: '英文', icon: '🔤' },
    { id: 'math',      label: '數學', icon: '📐' },
    { id: 'science',   label: '理化', icon: '⚗️' },
    { id: 'biology',   label: '生物', icon: '🧬' },
    { id: 'history',   label: '歷史', icon: '📜' },
    { id: 'geography', label: '地理', icon: '🗺️' },
    { id: 'civics',    label: '公民', icon: '⚖️' },
  ],
  high: [
    { id: 'chinese',   label: '國文', icon: '📖' },
    { id: 'english',   label: '英文', icon: '🔤' },
    { id: 'math',      label: '數學', icon: '📐' },
    { id: 'physics',   label: '物理', icon: '🔭' },
    { id: 'chemistry', label: '化學', icon: '🧪' },
    { id: 'biology',   label: '生物', icon: '🧬' },
    { id: 'history',   label: '歷史', icon: '📜' },
    { id: 'geography', label: '地理', icon: '🗺️' },
    { id: 'civics',    label: '公民', icon: '⚖️' },
    { id: 'earth',     label: '地科', icon: '🌍' },
  ],
  university: [
    { id: 'eng_math',       label: '工程數學',   icon: '📊' },
    { id: 'calculus',       label: '基礎微積分', icon: '∫' },
    { id: 'em',             label: '電磁學',     icon: '⚡' },
    { id: 'electronics',    label: '電子學',     icon: '💡' },
    { id: 'quantum',        label: '量子物理',   icon: '⚛️' },
    { id: 'modern_physics', label: '近代物理',   icon: '🔬' },
    { id: 'optics',         label: '光學',       icon: '🔆' },
  ],
}

export function getSubjectsForGrade(grade: Grade): Subject[] {
  return SUBJECTS_BY_GRADE[grade] ?? SUBJECTS_BY_GRADE.high
}

// 所有科目的平面列表（供查找用）
export const ALL_SUBJECTS: Subject[] = [
  ...SUBJECTS_BY_GRADE.middle,
  { id: 'physics',        label: '物理',       icon: '🔭' },
  { id: 'chemistry',      label: '化學',       icon: '🧪' },
  { id: 'earth',          label: '地科',       icon: '🌍' },
  { id: 'eng_math',       label: '工程數學',   icon: '📊' },
  { id: 'calculus',       label: '基礎微積分', icon: '∫' },
  { id: 'em',             label: '電磁學',     icon: '⚡' },
  { id: 'electronics',    label: '電子學',     icon: '💡' },
  { id: 'quantum',        label: '量子物理',   icon: '⚛️' },
  { id: 'modern_physics', label: '近代物理',   icon: '🔬' },
  { id: 'optics',         label: '光學',       icon: '🔆' },
]

export const GRADE_LABELS: Record<Grade, string> = {
  middle: '國中',
  high: '高中',
  university: '大學',
}

export const ADVISOR_SUBJECT = 'advisor'
