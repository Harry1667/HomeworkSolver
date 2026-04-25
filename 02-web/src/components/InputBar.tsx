import { useRef, useState } from 'react'
import { uploadImage } from '../lib/api'

interface Props {
  onSend: (message: string, imageName?: string) => void
  disabled?: boolean
}

export default function InputBar({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const [imageName, setImageName] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const preview = URL.createObjectURL(file)
      setImagePreview(preview)
      const result = await uploadImage(file)
      setImageName(result.filename)
    } catch {
      alert('圖片上傳失敗，請重試')
      setImagePreview(null)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeImage = () => {
    setImageName(null)
    setImagePreview(null)
  }

  const handleSend = () => {
    if (disabled || (!text.trim() && !imageName)) return
    onSend(text.trim(), imageName ?? undefined)
    setText('')
    setImageName(null)
    setImagePreview(null)
    // 重設 textarea 高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    // 自動調整高度
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`
  }

  const canSend = !disabled && !uploading && (text.trim().length > 0 || imageName !== null)

  return (
    <div className="border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      {/* 圖片預覽 */}
      {imagePreview && (
        <div className="mb-3 relative inline-block">
          <img
            src={imagePreview}
            alt="預覽"
            className="h-24 rounded-lg border border-slate-200 object-cover"
          />
          <button
            onClick={removeImage}
            className="absolute -top-2 -right-2 w-5 h-5 bg-slate-700 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-500 transition-colors"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* 圖片上傳按鈕 */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading}
          className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors disabled:opacity-40 mb-0.5"
          title="上傳圖片"
        >
          {uploading ? (
            <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleImageSelect}
        />

        {/* 文字輸入 */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoFocus
          placeholder="輸入題目，或上傳圖片… (Enter 送出，Shift+Enter 換行)"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-50 dark:disabled:bg-slate-800/50 leading-relaxed"
          style={{ minHeight: '40px', maxHeight: '160px' }}
        />

        {/* 送出按鈕 */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="flex-shrink-0 w-9 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed mb-0.5"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
