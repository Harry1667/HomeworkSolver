import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { getMessages, solve, rateConversation, addWrongAnswer } from '../lib/api'
import type { Message } from '../types'
import { ALL_SUBJECTS, ADVISOR_SUBJECT } from '../types'
import MessageBubble from './MessageBubble'
import InputBar from './InputBar'

const ADVISOR_EXAMPLES = [
  '我哪科最弱？',
  '我最近的學習狀況怎樣？',
  '我應該先從哪科開始努力？',
  '我的學習有什麼共同問題嗎？',
]

// 各科目的範例題目
const SUBJECT_EXAMPLES: Record<string, string[]> = {
  // 共通
  chinese:       ['這首詩在說什麼意思？', '起承轉合的結構怎麼寫？', '這段古文如何翻成白話？'],
  english:       ['這個句子的文法哪裡錯了？', 'present perfect 和 simple past 怎麼分？', '幫我解釋這個單字的用法'],
  math:          ['解方程式：2x + 3 = 7', '圓的面積公式是什麼？', '質數和合數的差別是什麼？'],
  biology:       ['細胞分裂的過程是什麼？', 'DNA 和 RNA 的差別？', '光合作用的化學反應式'],
  history:       ['這個歷史事件的背景是什麼？', '清末的洋務運動為何失敗？', '二次世界大戰的起因'],
  geography:     ['如何判讀氣候圖？', '台灣的地形分布有什麼特色？', '東南亞的地理位置和氣候'],
  civics:        ['憲法和法律的差別是什麼？', '三權分立的運作方式？', '這個公民議題的正反意見'],
  // 國中
  science:       ['F = ma 公式怎麼用？', '如何計算電路的電阻？', '酸鹼中和的反應原理'],
  // 高中
  physics:       ['牛頓第二定律怎麼應用？', '電場和磁場的差別？', '如何計算物體做的功？'],
  chemistry:     ['如何配平化學方程式？', '酸鹼中和反應是什麼？', '莫耳的概念怎麼用？'],
  earth:         ['板塊運動為什麼會造成地震？', '如何從等高線圖判斷地形？', '颱風是怎麼形成的？'],
  // 大學
  eng_math:      ['如何求矩陣的特徵值？', 'Laplace transform 怎麼用？', 'Fourier series 的概念是什麼？'],
  calculus:      ['極限的定義是什麼？', '如何用微分求函數的極值？', '定積分怎麼計算面積？'],
  em:            ['Maxwell 方程組各代表什麼？', '電場和電位的關係？', '平面電磁波的性質'],
  electronics:   ['BJT 和 MOSFET 的差別？', '放大器的增益怎麼計算？', 'OP-AMP 的理想特性'],
  quantum:       ['薛丁格方程式是什麼？', '測不準原理的意義？', '量子穿隧效應怎麼理解？'],
  modern_physics:['相對論的時間膨脹是什麼？', '光電效應的原理？', '原子核的結合能'],
  optics:        ['折射定律怎麼推導？', '干涉和繞射的差別？', '透鏡成像公式怎麼用？'],
}

interface ChatAreaProps {
  onOpenSidebar?: () => void
}

export default function ChatArea({ onOpenSidebar }: ChatAreaProps) {
  const currentUser = useStore((s) => s.currentUser)
  const currentSubject = useStore((s) => s.currentSubject)
  const currentConversation = useStore((s) => s.currentConversation)
  const setCurrentConversation = useStore((s) => s.setCurrentConversation)
  const pendingQuestion = useStore((s) => s.pendingQuestion)
  const setPendingQuestion = useStore((s) => s.setPendingQuestion)

  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [convId, setConvId] = useState<number | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [showRating, setShowRating] = useState(false)
  const [wrongMarked, setWrongMarked] = useState(false)
  const [selfSolveMode, setSelfSolveMode] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  const isAdvisor = currentSubject === ADVISOR_SUBJECT
  const subject = isAdvisor
    ? { id: ADVISOR_SUBJECT, label: '班級導師', icon: '🎓' }
    : ALL_SUBJECTS.find((s) => s.id === currentSubject)
  const examples = currentSubject && !isAdvisor ? (SUBJECT_EXAMPLES[currentSubject] ?? []) : []

  // 載入歷史訊息
  useEffect(() => {
    if (!currentConversation) {
      setMessages([])
      setConvId(null)
      setShowRating(false)
      setRating(null)
      return
    }
    setConvId(currentConversation.id)
    setShowRating(false)
    setRating(null)
    setWrongMarked(false)
    getMessages(currentConversation.id).then(setMessages)
  }, [currentConversation])

  // 自動捲到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // 處理從錯題本過來的練習題
  useEffect(() => {
    if (!pendingQuestion || !currentSubject || !currentUser) return
    const q = pendingQuestion
    setPendingQuestion(null)
    handleSend(q)
  }, [currentSubject])

  const handleRate = async (stars: number) => {
    if (!convId) return
    setRating(stars)
    await rateConversation(convId, stars)
  }

  const handlePractice = () => {
    handleSend('請根據上面這道題，再出 2–3 道類似的練習題讓我練習，不要直接給答案')
  }

  const handleMarkWrong = async () => {
    if (!currentUser || !currentSubject || !convId) return
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    const lastAI = [...messages].reverse().find(m => m.role === 'assistant')
    try {
      await addWrongAnswer({
        userId: currentUser.id,
        subject: currentSubject,
        conversationId: convId,
        question: lastUser?.content ?? '',
        aiAnswer: lastAI?.content ?? '',
      })
      setWrongMarked(true)
    } catch {}
  }

  const handleSend = async (message: string, imageName?: string) => {
    if (!currentUser || !currentSubject) return
    setShowRating(false)
    setWrongMarked(false)

    // 立即顯示使用者訊息
    const userMsg: Message = {
      id: Date.now(),
      conversation_id: convId ?? 0,
      role: 'user',
      content: message,
      image_name: imageName ?? null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setStreaming(true)
    setStreamingContent('')

    let currentConvId = convId
    const isNewConversation = convId === null
    let fullContent = ''

    try {
      for await (const event of solve({
        userId: currentUser.id,
        subject: currentSubject,
        message,
        conversationId: currentConvId,
        imageName: imageName ?? null,
        selfSolve: selfSolveMode,
      })) {
        if (event.type === 'meta') {
          currentConvId = event.conversationId
          setConvId(event.conversationId)
          // 只有建立新對話時才更新 store（讓 sidebar 刷新）
          if (isNewConversation) {
            setCurrentConversation({
              id: event.conversationId,
              user_id: currentUser.id,
              subject: currentSubject,
              title: message.slice(0, 25) || '圖片題目',
              created_at: new Date().toISOString(),
            })
          }
        } else if (event.type === 'chunk') {
          fullContent += event.content
          setStreamingContent(fullContent)
        } else if (event.type === 'done') {
          const aiMsg: Message = {
            id: Date.now() + 1,
            conversation_id: currentConvId ?? 0,
            role: 'assistant',
            content: fullContent,
            image_name: null,
            created_at: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, aiMsg])
          setStreamingContent('')
          setStreaming(false)
          setShowRating(true)
          setRating(null)
        } else if (event.type === 'error') {
          const errMsg: Message = {
            id: Date.now() + 1,
            conversation_id: currentConvId ?? 0,
            role: 'assistant',
            content: `❌ ${event.message}`,
            image_name: null,
            created_at: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, errMsg])
          setStreamingContent('')
          setStreaming(false)
        }
      }
    } catch (err) {
      console.error(err)
      setStreamingContent('')
      setStreaming(false)
    }
  }

  // ── 空白狀態（未選科目）────────────────────────────────
  if (!currentSubject) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <button
            onClick={onOpenSidebar}
            className="md:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="開啟選單"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-slate-400 text-sm">作業解題助手</span>
        </header>
        <div className="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <div className="text-5xl mb-4">👈</div>
            <p className="text-slate-500 text-lg">請從左側選擇科目開始解題</p>
            <p className="text-slate-400 text-sm mt-2">選擇後即可貼入題目或上傳圖片</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 頂部科目標題 */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
        {/* 手機版漢堡選單 */}
        <button
          onClick={onOpenSidebar}
          className="md:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="開啟選單"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-xl">{subject?.icon}</span>
        <span className="font-semibold text-slate-800 dark:text-slate-100">{subject?.label}</span>
        {currentConversation && (
          <>
            <span className="text-slate-300 dark:text-slate-600 mx-1">/</span>
            <span className="text-slate-500 dark:text-slate-400 text-sm truncate max-w-xs">{currentConversation.title}</span>
          </>
        )}
        {!isAdvisor && (
          <button
            onClick={() => setSelfSolveMode(v => !v)}
            className={`ml-auto text-xs px-2.5 py-1 rounded-full border transition-colors ${
              selfSolveMode
                ? 'bg-amber-500 text-white border-amber-500'
                : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-amber-400 hover:text-amber-500'
            }`}
            title="開啟後，AI 會批改你的解答而非直接給答案"
          >
            {selfSolveMode ? '✏️ 批改模式' : '✏️ 我來解解看'}
          </button>
        )}
      </header>

      {/* 訊息列表 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !streaming && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <span className="text-4xl mb-3">{subject?.icon}</span>
            {isAdvisor ? (
              <>
                <p className="text-slate-500 mb-1">我是你的班級導師，可以問我你的學習狀況</p>
                <p className="text-slate-400 text-sm mb-4">根據你所有科目的學習記錄，給你具體建議</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {ADVISOR_EXAMPLES.map(ex => (
                    <button
                      key={ex}
                      onClick={() => handleSend(ex)}
                      className="text-sm px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="text-slate-500 mb-1">把你的{subject?.label}題目貼上來，我來幫你一步一步講解</p>
                <p className="text-slate-400 text-sm mb-6">或者拍一張題目的照片上傳</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {examples.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => handleSend(ex)}
                      className="text-sm px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {messages.map((msg, idx) => {
          const isLastAssistant =
            msg.role === 'assistant' && idx === messages.length - 1
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              showRating={isLastAssistant && showRating}
              rated={isLastAssistant ? rating : null}
              onRate={handleRate}
              onPractice={isLastAssistant ? handlePractice : undefined}
              onMarkWrong={isLastAssistant ? handleMarkWrong : undefined}
              wrongMarked={isLastAssistant ? wrongMarked : false}
              isAdvisor={isAdvisor}
            />
          )
        })}

        {/* 串流中的 AI 回覆 */}
        {streaming && streamingContent && (
          <MessageBubble
            message={{
              id: -1,
              conversation_id: convId ?? 0,
              role: 'assistant',
              content: streamingContent,
              image_name: null,
              created_at: new Date().toISOString(),
            }}
            streaming
            isAdvisor={isAdvisor}
          />
        )}

        {/* 等待中（尚未有內容） */}
        {streaming && !streamingContent && (
          <div className="flex gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-sm">📚</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 輸入區：key 改變時重新掛載，觸發 autoFocus */}
      <InputBar
        key={`${currentSubject}-${currentConversation?.id ?? 'new'}`}
        onSend={handleSend}
        disabled={streaming}
      />
    </div>
  )
}
