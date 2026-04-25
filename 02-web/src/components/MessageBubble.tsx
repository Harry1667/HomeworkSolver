import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import type { Message } from '../types'

interface Props {
  message: Message
  streaming?: boolean
  showRating?: boolean
  rated?: number | null
  onRate?: (stars: number) => void
  onPractice?: () => void
  onMarkWrong?: () => void
  wrongMarked?: boolean
  isAdvisor?: boolean
}

export default function MessageBubble({
  message, streaming, showRating, rated, onRate,
  onPractice, onMarkWrong, wrongMarked, isAdvisor,
}: Props) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%]">
          {message.image_name && (
            <div className="mb-2">
              <img
                src={`/uploads/${message.image_name}`}
                alt="附件圖片"
                className="max-w-xs rounded-lg border border-indigo-300"
              />
            </div>
          )}
          {message.content && (
            <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 mb-4">
      {/* AI 頭像 */}
      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-sm">{isAdvisor ? '🎓' : '📚'}</span>
      </div>
      <div className="flex-1 max-w-[85%]">
        {/* 訊息內容 */}
        <div className={`bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-800 dark:text-slate-200 ${streaming ? 'streaming-cursor' : ''}`}>
          <div className="prose prose-sm prose-slate dark:prose-invert max-w-none
            prose-headings:font-semibold prose-headings:text-slate-800 dark:prose-headings:text-slate-200 prose-headings:mt-3 prose-headings:mb-1
            prose-p:my-1 prose-p:leading-relaxed
            prose-ul:my-1 prose-ul:pl-4 prose-li:my-0.5
            prose-ol:my-1 prose-ol:pl-4
            prose-code:bg-slate-200 dark:prose-code:bg-slate-700 prose-code:text-slate-800 dark:prose-code:text-slate-200 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-slate-800 dark:prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-lg prose-pre:p-3 prose-pre:overflow-x-auto prose-pre:my-2
            prose-blockquote:border-l-2 prose-blockquote:border-indigo-300 prose-blockquote:pl-3 prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-400
            prose-table:text-xs prose-th:bg-slate-100 dark:prose-th:bg-slate-700 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-td:border prose-td:border-slate-200 dark:prose-td:border-slate-600
            prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-strong:font-semibold
          ">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        </div>

        {/* 動作列：評分 + 練習 + 錯題 */}
        {showRating && (
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            {/* 評分 */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400 dark:text-slate-500">有幫助嗎？</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => !rated && onRate?.(star)}
                  disabled={!!rated}
                  className={`text-lg transition-transform ${
                    rated
                      ? star <= (rated ?? 0) ? 'text-amber-400' : 'text-slate-200'
                      : 'text-slate-300 hover:text-amber-400 hover:scale-110'
                  } disabled:cursor-default`}
                  title={`${star} 顆星`}
                >
                  ★
                </button>
              ))}
            </div>

            {/* 分隔 */}
            {!isAdvisor && <span className="text-slate-200 dark:text-slate-700">|</span>}

            {/* 相似題練習 */}
            {!isAdvisor && onPractice && (
              <button
                onClick={onPractice}
                className="text-xs text-indigo-500 hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
              >
                ✏️ 練習相似題
              </button>
            )}

            {/* 標記錯題 */}
            {!isAdvisor && onMarkWrong && (
              <button
                onClick={!wrongMarked ? onMarkWrong : undefined}
                disabled={wrongMarked}
                className={`text-xs px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  wrongMarked
                    ? 'text-red-400 cursor-default'
                    : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                }`}
              >
                {wrongMarked ? '❌ 已記入錯題本' : '❌ 我答錯了'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
