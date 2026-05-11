import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { Database } from 'bun:sqlite'

dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3002
const PROXY_TOKEN = process.env.PROXY_TOKEN
const PROXY_URL = process.env.PROXY_URL || 'https://clip.twloop.com'
if (!PROXY_TOKEN) {
  console.error('❌ 缺少 PROXY_TOKEN，請在 .env 設定')
  process.exit(1)
}

// GEMINI_API_KEY 可從 .env 或 DB 設定（DB 優先）
let GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

// ── 目錄初始化 ────────────────────────────────────────────
const DB_DIR = join(__dirname, 'database')
const UPLOAD_DIR = join(__dirname, 'uploads')
if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true })
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })

// ── SQLite（bun:sqlite API）──────────────────────────────
const db = new Database(join(DB_DIR, 'homeworksolver.sqlite'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    grade      TEXT    NOT NULL DEFAULT 'high',
    score      INTEGER,
    created_at TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject    TEXT    NOT NULL,
    title      TEXT    NOT NULL DEFAULT '對話',
    rating     INTEGER,
    created_at TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT    NOT NULL,
    content         TEXT    NOT NULL,
    image_name      TEXT,
    created_at      TEXT    DEFAULT (datetime('now'))
  );
`)

// 自訂科目要求表
db.exec(`
  CREATE TABLE IF NOT EXISTS subject_rules (
    subject     TEXT PRIMARY KEY,
    extra_rules TEXT NOT NULL DEFAULT ''
  );
`)

// 應用程式設定表
db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );
`)

// 錯題本
db.exec(`
  CREATE TABLE IF NOT EXISTS wrong_answers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject         TEXT    NOT NULL,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    question        TEXT    NOT NULL DEFAULT '',
    ai_answer       TEXT    NOT NULL DEFAULT '',
    note            TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    DEFAULT (datetime('now'))
  );
`)

// 家長 token
db.exec(`
  CREATE TABLE IF NOT EXISTS parent_tokens (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT    NOT NULL UNIQUE,
    created_at TEXT    DEFAULT (datetime('now'))
  );
`)

// 教學策略 & 整體學習檔案表
db.exec(`
  CREATE TABLE IF NOT EXISTS teaching_strategies (
    user_id    INTEGER NOT NULL,
    subject    TEXT    NOT NULL,
    strategy   TEXT    NOT NULL DEFAULT '',
    updated_at TEXT    DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, subject),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_learning_profiles (
    user_id    INTEGER PRIMARY KEY,
    profile    TEXT    NOT NULL DEFAULT '',
    updated_at TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`)

// 段考成績 & 弱點分析表
db.exec(`
  CREATE TABLE IF NOT EXISTS exam_scores (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject    TEXT    NOT NULL,
    exam_name  TEXT    NOT NULL DEFAULT '段考',
    score      INTEGER NOT NULL,
    exam_date  TEXT    NOT NULL,
    created_at TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subject_weaknesses (
    user_id    INTEGER NOT NULL,
    subject    TEXT    NOT NULL,
    content    TEXT    NOT NULL DEFAULT '',
    updated_at TEXT    DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, subject),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`)

// 既有資料庫遷移
try { db.exec('ALTER TABLE conversations ADD COLUMN rating INTEGER') } catch {}

// ── DB helpers（bun:sqlite 用 db.prepare().method()）────────
function parseUser(u) {
  if (!u) return u
  let scores = null
  if (u.score) {
    try { scores = JSON.parse(u.score) } catch { scores = null }
  }
  const { score, ...rest } = u
  return { ...rest, scores }
}

const q = {
  allUsers:    db.prepare('SELECT * FROM users ORDER BY created_at DESC'),
  userById:    db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser:  db.prepare('INSERT INTO users (name, grade, score) VALUES ($name, $grade, $score)'),
  updateUser:  db.prepare('UPDATE users SET name = $name, grade = $grade, score = $score WHERE id = $id'),
  deleteUser:  db.prepare('DELETE FROM users WHERE id = ?'),

  conversations: db.prepare(
    'SELECT * FROM conversations WHERE user_id = ? AND subject = ? ORDER BY created_at DESC LIMIT 30'
  ),
  convById:    db.prepare('SELECT * FROM conversations WHERE id = ?'),
  insertConv:  db.prepare('INSERT INTO conversations (user_id, subject, title) VALUES ($user_id, $subject, $title)'),
  updateConvRating: db.prepare('UPDATE conversations SET rating = $rating WHERE id = $id'),
  deleteConv:  db.prepare('DELETE FROM conversations WHERE id = ?'),
  updateScore: db.prepare('UPDATE users SET score = $score WHERE id = $id'),

  messages:    db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'),
  insertMsg:   db.prepare('INSERT INTO messages (conversation_id, role, content, image_name) VALUES ($conversation_id, $role, $content, $image_name)'),

  allSubjectRules: db.prepare('SELECT * FROM subject_rules'),
  subjectRuleBy:   db.prepare('SELECT * FROM subject_rules WHERE subject = ?'),
  upsertSubjectRule: db.prepare(`
    INSERT INTO subject_rules (subject, extra_rules) VALUES ($subject, $extra_rules)
    ON CONFLICT(subject) DO UPDATE SET extra_rules = excluded.extra_rules
  `),

  // 段考成績
  examScoresByUser:    db.prepare('SELECT * FROM exam_scores WHERE user_id = ? ORDER BY exam_date ASC, created_at ASC'),
  insertExamScore:     db.prepare('INSERT INTO exam_scores (user_id, subject, exam_name, score, exam_date) VALUES ($user_id, $subject, $exam_name, $score, $exam_date)'),
  deleteExamScore:     db.prepare('DELETE FROM exam_scores WHERE id = ?'),
  latestExamScore:     db.prepare('SELECT score FROM exam_scores WHERE user_id = ? AND subject = ? ORDER BY exam_date DESC, created_at DESC LIMIT 1'),

  // AI 弱點
  weaknessesByUser:    db.prepare('SELECT * FROM subject_weaknesses WHERE user_id = ?'),
  weaknessBySubject:   db.prepare('SELECT * FROM subject_weaknesses WHERE user_id = ? AND subject = ?'),
  upsertWeakness:      db.prepare(`
    INSERT INTO subject_weaknesses (user_id, subject, content, updated_at)
    VALUES ($user_id, $subject, $content, datetime('now'))
    ON CONFLICT(user_id, subject) DO UPDATE SET content = excluded.content, updated_at = datetime('now')
  `),

  // 應用程式設定
  getSetting:    db.prepare('SELECT value FROM app_settings WHERE key = ?'),
  upsertSetting: db.prepare(`INSERT INTO app_settings (key, value) VALUES ($key, $value)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`),

  // 近期對話訊息（供弱點分析用）
  recentMsgsForSubject: db.prepare(`
    SELECT m.role, m.content FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE c.user_id = ? AND c.subject = ?
    ORDER BY m.created_at DESC LIMIT 60
  `),

  // 教學策略
  getStrategy:    db.prepare('SELECT strategy FROM teaching_strategies WHERE user_id = ? AND subject = ?'),
  allStrategies:  db.prepare('SELECT subject, strategy, updated_at FROM teaching_strategies WHERE user_id = ? AND strategy != ""'),
  upsertStrategy: db.prepare(`
    INSERT INTO teaching_strategies (user_id, subject, strategy, updated_at)
    VALUES ($user_id, $subject, $strategy, datetime('now'))
    ON CONFLICT(user_id, subject) DO UPDATE SET strategy = excluded.strategy, updated_at = datetime('now')
  `),

  // 家長 token
  getParentToken:    db.prepare('SELECT token FROM parent_tokens WHERE user_id = ?'),
  upsertParentToken: db.prepare(`INSERT INTO parent_tokens (user_id, token) VALUES ($user_id, $token)
    ON CONFLICT(user_id) DO UPDATE SET token = excluded.token`),
  getUserByToken:    db.prepare('SELECT u.* FROM users u JOIN parent_tokens p ON p.user_id = u.id WHERE p.token = ?'),

  // 使用量統計
  usageStatsByUser:  db.prepare(`
    SELECT c.subject,
      COUNT(DISTINCT c.id) as conv_count,
      COUNT(m.id) as msg_count
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id AND m.role = 'user'
    WHERE c.user_id = ? AND c.subject != 'advisor'
    GROUP BY c.subject
  `),

  // 錯題本
  wrongAnswersByUser:    db.prepare('SELECT * FROM wrong_answers WHERE user_id = ? ORDER BY created_at DESC'),
  wrongAnswersBySubject: db.prepare('SELECT * FROM wrong_answers WHERE user_id = ? AND subject = ? ORDER BY created_at DESC'),
  insertWrongAnswer:     db.prepare('INSERT INTO wrong_answers (user_id, subject, conversation_id, question, ai_answer, note) VALUES ($user_id, $subject, $conv_id, $question, $ai_answer, $note)'),
  deleteWrongAnswer:     db.prepare('DELETE FROM wrong_answers WHERE id = ? AND user_id = ?'),

  // 整體學習檔案
  getLearningProfile:    db.prepare('SELECT profile FROM user_learning_profiles WHERE user_id = ?'),
  upsertLearningProfile: db.prepare(`
    INSERT INTO user_learning_profiles (user_id, profile, updated_at)
    VALUES ($user_id, $profile, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET profile = excluded.profile, updated_at = datetime('now')
  `),
}

// ── Multer（圖片上傳）────────────────────────────────────
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_, file, cb) => {
    const ext = file.originalname.split('.').pop()
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('只接受 JPG / PNG / GIF / WebP'))
    }
  },
})

// ── 共用標籤 ─────────────────────────────────────────────
const GRADE_LABELS = { middle: '國中', high: '高中', university: '大學' }
const SUBJECT_LABELS = {
  chinese: '國文', english: '英文', math: '數學',
  science: '理化', biology: '生物', history: '歷史',
  geography: '地理', civics: '公民',
  physics: '物理', chemistry: '化學', earth: '地球科學',
  eng_math: '工程數學', calculus: '基礎微積分', em: '電磁學',
  electronics: '電子學', quantum: '量子物理',
  modern_physics: '近代物理', optics: '光學',
}

// ── System Prompt ─────────────────────────────────────────
function buildSystemPrompt(user, subject, extraRules = '', weakness = '', latestExamScore = null, strategy = '', learningProfile = '') {
  const grade = GRADE_LABELS[user.grade] || '學生'
  const subjectName = SUBJECT_LABELS[subject] || subject

  // 科目成績（優先用最新段考成績，fallback 到手動設定值）
  let scores = null
  if (user.score) { try { scores = JSON.parse(user.score) } catch {} }
  const subjectScore = latestExamScore ?? scores?.[subject] ?? null

  let scoreSection = '- 使用標準解題步驟，適度補充說明。'
  if (subjectScore !== null) {
    if (subjectScore < 60) {
      scoreSection = `- 此學生 ${subjectName} 成績約 **${subjectScore} 分（需要加強）**：\n  - 步驟拆得更細，每一步都要說明原因\n  - 補充前置知識，不假設學生已知\n  - 每步驟加「白話翻譯」讓學生看懂`
    } else if (subjectScore >= 80) {
      scoreSection = `- 此學生 ${subjectName} 成績約 **${subjectScore} 分（程度優秀）**：\n  - 可補充進階解法或一題多解\n  - 說明常見考試變形與陷阱\n  - 適度提升說明深度`
    } else {
      scoreSection = `- 此學生 ${subjectName} 成績約 **${subjectScore} 分（中等）**：\n  - 標準步驟講解，適度補充提醒\n  - 重要觀念可稍作強調`
    }
  }

  // 年級語言風格
  const gradeGuide = {
    middle:     '- 用日常生活例子類比，避免艱深術語\n  - 多用「想像一下…」「舉個例子…」引導\n  - 每步驟確認學生理解再繼續',
    high:       '- 可使用標準學術術語，但首次出現要說明\n  - 點出概念之間的關聯\n  - 補充考試常見陷阱和易錯點',
    university: '- 直接用學術語言，不需過度簡化\n  - 可補充延伸閱讀方向或相關定理\n  - 說明背後的數學推導和物理直覺',
  }

  // 科目專屬規則
  const subjectRules = {
    // 國中
    chinese:        '- 古文題：先逐句翻成白話，再說明題意\n- 作文題：只給架構、素材方向與開頭範例，不直接代寫全文\n- 修辭/文法題：說明該修辭手法的定義與判斷方式',
    english:        '- 【必做】題目出現的英文句子或選項，一律附上中文翻譯（格式：英文句 → 中文翻譯）\n- 文法題：說明規則名稱與例句，再套用到題目\n- 翻譯/閱讀題：逐句拆解，先理解再翻譯\n- 單字題：說明詞性、搭配詞與例句用法',
    math:           '- 每個公式第一次出現時說明名稱、定義與適用條件\n- 計算步驟逐行列出，絕不跳步\n- 幾何題先說明已知條件和想要的結論，再決定解法',
    science:        '- 先列出已知量（含單位）和未知量\n- 每個公式說明各符號代表的物理量\n- 計算完畢後確認單位是否合理\n- 概念題先說明物理現象，再對應到原理',
    biology:        '- 重點名詞加粗標記，首次出現時給定義\n- 圖表題說明如何判讀（坐標軸意義、曲線趨勢）\n- 生化反應說明反應物、產物與反應意義\n- 分類題說明分類依據',
    history:        '- 先建立時代背景和前因，再回答題目\n- 記憶型題目給口訣、時間軸或聯想方式\n- 比較題用表格呈現異同\n- 影響分析要說明短期和長期影響',
    geography:      '- 先建立地理位置背景，再分析成因\n- 地圖/圖表題說明如何判讀（符號、比例尺、等高線）\n- 氣候題連結緯度、洋流、地形等成因\n- 人文地理說明人地關係',
    civics:         '- 先引用相關法條或憲法條文，再分析題目\n- 概念題說明定義、範圍與實例\n- 時事題分析正反意見，不表達個人政治立場',
    // 高中
    physics:        '- 先列出已知量、未知量和適用的定律或公式\n- 向量題要分解分量，明確標示方向\n- 代入數值前確認單位換算正確\n- 推導過程每步說明物理意義，不只是數學操作',
    chemistry:      '- 先確認反應類型（氧化還原、酸鹼、沉澱等）\n- 化學方程式先配平再計算\n- 莫耳換算要一步步列出：質量→莫耳→微粒數\n- 有機化學說明官能基與反應機制',
    earth:          '- 重點名詞加粗，首次出現時給定義\n- 圖表題說明如何判讀（地質圖、天氣圖、星圖）\n- 地球系統的現象要連結各圈層之間的交互作用\n- 天文題說明觀測條件和視角',
    // 大學
    eng_math:       '- 先說明使用哪種數學工具（矩陣運算、Laplace、Fourier、數值方法）及其適用條件\n- 推導每一步都要說明目的，不能只列算式\n- 特徵值/特徵向量問題說明物理或工程意義\n- 給出解的驗算方式',
    calculus:       '- 先寫出相關定義或定理（夾擠定理、羅必達、微積分基本定理等）\n- 計算步驟完整展開，說明每步換算依據\n- 說明幾何意義（面積、體積、切線）\n- 說明收斂/發散的判斷依據',
    em:             '- 先引用 Maxwell 方程或相關積分/微分定律\n- 向量運算每步說清楚（梯度、散度、旋度的物理意義）\n- 邊界條件要明確列出並說明\n- 說明電場、磁場、電位的物理意義',
    electronics:    '- 先確認元件工作區間（截止/主動/飽和）\n- 建立小訊號等效電路或大訊號模型\n- 逐步推導轉移函數、增益、頻率響應\n- 說明回授對穩定性的影響',
    quantum:        '- 先寫出對應的薛丁格方程（時間相關或非相關）或狄拉克符號\n- 說明量子數的物理意義與允許值\n- 計算期望值時說明積分設置\n- 說明波函數的物理詮釋（機率密度）',
    modern_physics: '- 先說明適用的相對論效應（時間膨脹、長度收縮、質能等效）或量子現象\n- 給出完整推導，連結實驗觀測結果\n- 說明古典物理在何處失效，以及相對論/量子如何修正\n- 數量級估算要說明假設',
    optics:         '- 先說明使用幾何光學還是波動光學，並說明適用條件\n- 幾何光學：畫光路圖說明折射/反射路徑\n- 波動光學：說明干涉/繞射條件（光程差、相位差）\n- 偏振題說明偏振態與穿透率計算',
  }

  const weaknessSection = weakness?.trim()
    ? `\n## 此學生在${subjectName}的已知弱點（請特別加強說明）\n${weakness.trim()}\n遇到相關題目時，主動補充這些弱點的觀念釐清。`
    : ''

  const extraSection = extraRules?.trim()
    ? `\n## 此科目額外指定要求（最高優先級，必須遵守）\n${extraRules.trim()}`
    : ''

  const strategySection = strategy?.trim()
    ? `\n## 個人化教學策略（由此科目 Agent 持續更新）\n${strategy.trim()}\n請根據以上策略調整你的講解方式。`
    : ''

  const profileSection = learningProfile?.trim()
    ? `\n## 學生整體學習特徵（跨科目分析）\n${learningProfile.trim()}`
    : ''

  return `你是一位${grade}學生的${subjectName}老師。
${profileSection}${strategySection}
## 回答格式（固定照這個寫）

第一行：「這題考的是＿＿。」（一句話點出考點）
接著：用 1. 2. 3. 逐點解釋解題邏輯，每點 1–2 句，說清楚「為什麼」
最後一行：「因此，答案是＿＿。」或「所以選＿＿。」

## 長度要求
- 整體約 150–250 字，不要更長
- 每個編號點控制在 1–2 句話
- 不要加開場白、不要加結語問句

## 數學公式
- 行內公式用 $...$，例如 $a^2 + b^2 = c^2$
- 獨立公式用 $$...$$
- 簡單的數字運算可以用純文字

## 語言風格（${grade}）
${gradeGuide[user.grade] || gradeGuide.high}

## 根據成績調整
${scoreSection}

## ${subjectName}規則
${subjectRules[subject] || '步驟清楚，說明每步目的'}
${weaknessSection}${extraSection}

## 圖片題
- 先寫「題目是：…」確認內容
- 圖片看不清楚就請學生手動輸入

## 禁止
- ❌ 不直接給答案（要有推理過程）
- ❌ 不說「顯然可得」
- ❌ 不用超出${grade}程度的解法
- ❌ 不加「還有問題嗎？」之類的結語

請用繁體中文回答。`
}

// ── 班級導師 Prompt ───────────────────────────────────────
function buildAdvisorPrompt(user, strategies, weaknesses, examScores, profile) {
  const grade = GRADE_LABELS[user.grade] || '學生'

  const strategiesText = strategies.length > 0
    ? strategies.map(s => `【${SUBJECT_LABELS[s.subject] || s.subject}】\n${s.strategy}`).join('\n\n')
    : '（尚無各科教學策略資料，需要更多學習對話後才能分析）'

  const weaknessText = Object.keys(weaknesses).length > 0
    ? Object.entries(weaknesses).map(([subj, w]) => `【${SUBJECT_LABELS[subj] || subj}】\n${w}`).join('\n\n')
    : '（尚無弱點分析資料）'

  const scoresText = examScores.length > 0
    ? examScores.map(s => `${SUBJECT_LABELS[s.subject] || s.subject} ${s.exam_name}：${s.score}分（${s.exam_date}）`).join('\n')
    : '（尚無成績資料）'

  const profileText = profile?.trim() || '（尚無整體學習檔案，需要在多個科目累積學習對話後才能生成）'

  return `你是 ${user.name} 的班級導師，負責關心這位${grade}學生的整體學習狀況。

## 學生基本資料
- 姓名：${user.name}
- 學習階段：${grade}

## 段考成績紀錄
${scoresText}

## 各科弱點分析
${weaknessText}

## 各科個人化教學策略（由各科 Agent 持續更新）
${strategiesText}

## 學生整體學習檔案（跨科目協調 Agent 分析）
${profileText}

## 你的職責
- 用溫暖但直接的方式回答學生關於自身學習的問題
- 提供具體可行的建議，不說空話
- 指出問題的根源，不只描述表面現象
- 適當鼓勵，但也直接指出需要改進的地方
- 不幫學生解題，只討論學習策略、狀況、方向

## 回答格式
- 直接回答學生的問題，不要開場白
- 約 150–250 字
- 語氣像朋友式的導師，不要太正式

請用繁體中文回答。`
}

// ── Agent：更新各科教學策略（非同步，解完題後觸發）─────
async function updateTeachingStrategy(userId, subject) {
  try {
    const msgs = q.recentMsgsForSubject.all(userId, subject)
    if (msgs.length < 6) return

    const subjectName = SUBJECT_LABELS[subject] || subject
    const convoText = msgs.reverse()
      .map(m => `${m.role === 'user' ? '學生' : 'AI老師'}：${m.content.slice(0, 150)}`)
      .join('\n').slice(0, 2500)

    const prompt = `你是「${subjectName}」科目的教學策略分析師。
以下是學生最近的學習對話：

${convoText}

根據以上對話，分析此學生在「${subjectName}」的學習特徵，制定個人化教學策略：
要求：
- 每點一句話，不超過 8 點
- 格式：每行以「• 」開頭
- 涵蓋：常見錯誤模式、學習風格偏好、需加強的知識點、最有效的講解方式
- 只輸出策略清單，不要其他說明文字
- 使用繁體中文`

    const data = await callAI(prompt, 'strategy-update')
    q.upsertStrategy.run({ $user_id: userId, $subject: subject, $strategy: data.content.trim() })
    console.log(`✅ 教學策略更新：userId=${userId} subject=${subject}`)

    // 觸發跨科目整合
    updateLearningProfile(userId).catch(() => {})
  } catch (err) {
    console.error('Strategy update failed:', err.message)
  }
}

// ── Agent：跨科目協調，更新整體學習檔案 ─────────────────
async function updateLearningProfile(userId) {
  try {
    const strategies = q.allStrategies.all(userId)
    if (strategies.length < 2) return

    const user = q.userById.get(userId)
    if (!user) return
    const grade = GRADE_LABELS[user.grade] || '學生'

    const strategiesText = strategies
      .filter(s => s.strategy?.trim())
      .map(s => `【${SUBJECT_LABELS[s.subject] || s.subject}】\n${s.strategy}`)
      .join('\n\n')

    if (!strategiesText) return

    const prompt = `以下是一位${grade}學生在各科目的教學策略分析（由各科 Agent 產生）：

${strategiesText}

作為跨科目協調 Agent，綜合以上分析，描述這位學生的整體學習特徵：
要求：
- 每點一句話，不超過 6 點
- 格式：每行以「• 」開頭
- 涵蓋：跨科共同的學習弱點、整體學習風格、建議的優先改善方向
- 只輸出清單，不要其他說明文字
- 使用繁體中文`

    const data = await callAI(prompt, 'profile-update')
    q.upsertLearningProfile.run({ $user_id: userId, $profile: data.content.trim() })
    console.log(`✅ 整體學習檔案更新：userId=${userId}`)
  } catch (err) {
    console.error('Learning profile update failed:', err.message)
  }
}

// 從 DB 載入設定（覆蓋 .env）
const dbKey = q.getSetting.get('gemini_api_key')?.value
if (dbKey) GEMINI_API_KEY = dbKey
console.log(GEMINI_API_KEY
  ? '   Vision: Gemini Flash 啟用（圖片題目支援）'
  : '   Vision: 未設定 GEMINI_API_KEY，圖片題目無法辨識'
)

// ── AI Provider 輪換 ─────────────────────────────────────
// 嘗試順序：proxy/openai → proxy/gemini → proxy/claude → Gemini direct → Anthropic direct → OpenAI direct
const PROXY_PROVIDERS = ['openai', 'gemini', 'claude']

async function callAI(prompt, group) {
  const errors = []

  // 1. 透過 Proxy 逐一試各 provider
  for (const provider of PROXY_PROVIDERS) {
    try {
      const res = await fetch(`${PROXY_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${PROXY_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, project: 'homeworksolver', group, provider }),
      })
      if (res.status >= 500) { errors.push(`proxy/${provider}: ${res.status}`); continue }
      if (!res.ok) throw new Error(`Proxy ${res.status}`)  // 4xx = 不重試
      const data = await res.json()
      if (data.ok) return { content: data.content, provider: data.actual_provider || provider, model: data.actual_model || provider }
      errors.push(`proxy/${provider}: ok=false`)
    } catch (err) {
      if (err.message.match(/^Proxy \d{3}$/) && !err.message.match(/^Proxy 5/)) throw err
      errors.push(`proxy/${provider}: ${err.message}`)
    }
  }

  // 2. Gemini direct（需 GEMINI_API_KEY）
  if (GEMINI_API_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
      )
      if (res.ok) {
        const data = await res.json()
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (content) return { content, provider: 'gemini', model: 'gemini-2.0-flash' }
      }
      errors.push(`gemini-direct: ${res.status}`)
    } catch (err) { errors.push(`gemini-direct: ${err.message}`) }
  }

  // 3. Anthropic direct（需 ANTHROPIC_API_KEY）
  if (ANTHROPIC_API_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
      })
      if (res.ok) {
        const data = await res.json()
        const content = data.content?.[0]?.text
        if (content) return { content, provider: 'anthropic', model: 'claude-haiku-4-5' }
      }
      errors.push(`anthropic-direct: ${res.status}`)
    } catch (err) { errors.push(`anthropic-direct: ${err.message}`) }
  }

  // 4. OpenAI direct（需 OPENAI_API_KEY）
  if (OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
      })
      if (res.ok) {
        const data = await res.json()
        const content = data.choices?.[0]?.message?.content
        if (content) return { content, provider: 'openai', model: 'gpt-4o-mini' }
      }
      errors.push(`openai-direct: ${res.status}`)
    } catch (err) { errors.push(`openai-direct: ${err.message}`) }
  }

  throw new Error(`所有 AI provider 都無法回應（${errors.join(' | ')}）`)
}

// ── Express ───────────────────────────────────────────────
const app = express()
app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(UPLOAD_DIR))
app.use(express.static(join(__dirname, 'dist')))

// ── 使用者 API ────────────────────────────────────────────
app.get('/api/users', (_, res) => {
  res.json(q.allUsers.all().map(parseUser))
})

app.post('/api/users', (req, res) => {
  const { name, grade, scores } = req.body
  if (!name?.trim()) return res.status(400).json({ error: '請填寫名稱' })
  if (!['middle', 'high', 'university'].includes(grade))
    return res.status(400).json({ error: '學習階段無效' })

  const scoreJson = scores ? JSON.stringify(scores) : null
  const result = q.insertUser.run({ $name: name.trim(), $grade: grade, $score: scoreJson })
  res.json(parseUser(q.userById.get(result.lastInsertRowid)))
})

app.put('/api/users/:id', (req, res) => {
  const { name, grade, scores } = req.body
  const scoreJson = scores ? JSON.stringify(scores) : null
  q.updateUser.run({ $name: name, $grade: grade, $score: scoreJson, $id: req.params.id })
  res.json(parseUser(q.userById.get(req.params.id)))
})

app.delete('/api/users/:id', (req, res) => {
  q.deleteUser.run(req.params.id)
  res.json({ ok: true })
})

// ── 對話紀錄 API ──────────────────────────────────────────
app.get('/api/conversations/:userId/:subject', (req, res) => {
  res.json(q.conversations.all(req.params.userId, req.params.subject))
})

app.get('/api/messages/:conversationId', (req, res) => {
  res.json(q.messages.all(req.params.conversationId))
})

app.delete('/api/conversations/:id', (req, res) => {
  q.deleteConv.run(req.params.id)
  res.json({ ok: true })
})

app.post('/api/conversations/:id/rate', (req, res) => {
  const { stars } = req.body
  const s = Number(stars)
  if (!s || s < 1 || s > 5) return res.status(400).json({ error: '評分無效（1–5）' })

  const conv = q.convById.get(req.params.id)
  if (!conv) return res.status(404).json({ error: '找不到對話' })

  q.updateConvRating.run({ $rating: s, $id: conv.id })

  res.json({ ok: true })
})

// ── 自訂科目規則 API ──────────────────────────────────────
app.get('/api/subject-rules', (_, res) => {
  const rows = q.allSubjectRules.all()
  const result = {}
  for (const r of rows) result[r.subject] = r.extra_rules
  res.json(result)
})

app.put('/api/subject-rules/:subject', (req, res) => {
  const { extra_rules } = req.body
  q.upsertSubjectRule.run({ $subject: req.params.subject, $extra_rules: extra_rules ?? '' })
  res.json({ ok: true })
})

// ── 圖片上傳 ─────────────────────────────────────────────
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到圖片' })
  res.json({ filename: req.file.filename, url: `/uploads/${req.file.filename}` })
})

// ── 解題 API（SSE 串流）───────────────────────────────────
app.post('/api/solve', async (req, res) => {
  const { userId, subject, message, conversationId, imageName } = req.body
  if (!message?.trim() && !imageName)
    return res.status(400).json({ error: '請輸入題目' })

  const user = q.userById.get(userId)
  if (!user) return res.status(404).json({ error: '找不到使用者' })

  // 建立或沿用對話
  let convId = conversationId ? Number(conversationId) : null
  const userText = message?.trim() || ''

  if (!convId) {
    const title = userText.slice(0, 25) || (subject === 'advisor' ? '與導師的對話' : '圖片題目')
    const r = q.insertConv.run({ $user_id: userId, $subject: subject, $title: title })
    convId = Number(r.lastInsertRowid)
  }

  // 儲存使用者訊息
  q.insertMsg.run({
    $conversation_id: convId,
    $role: 'user',
    $content: userText,
    $image_name: imageName || null,
  })

  // 組合 prompt（班級導師 vs 科目老師）
  let systemPrompt, fullPrompt

  const selfSolve = req.body.selfSolve === true

  if (subject === 'advisor') {
    const strategies = q.allStrategies.all(userId)
    const weaknessRows = q.weaknessesByUser.all(userId)
    const weaknesses = weaknessRows.reduce((acc, r) => ({ ...acc, [r.subject]: r.content }), {})
    const examScores = q.examScoresByUser.all(userId)
    const profile = q.getLearningProfile.get(userId)?.profile || ''
    systemPrompt = buildAdvisorPrompt(user, strategies, weaknesses, examScores, profile)
    fullPrompt = `${systemPrompt}\n\n---\n\n學生說：${userText}`
  } else {
    // 載入此科目的自訂規則、弱點、最新成績、教學策略
    const subjectRuleRow = q.subjectRuleBy.get(subject)
    const extraRules = subjectRuleRow?.extra_rules || ''
    const weaknessRow = q.weaknessBySubject.get(userId, subject)
    const weakness = weaknessRow?.content || ''
    const latestScore = q.latestExamScore.get(userId, subject)?.score ?? null
    const strategy = q.getStrategy.get(userId, subject)?.strategy || ''
    const learningProfile = q.getLearningProfile.get(userId)?.profile || ''
    systemPrompt = buildSystemPrompt(user, subject, extraRules, weakness, latestScore, strategy, learningProfile)
    if (selfSolve) {
      fullPrompt = `${systemPrompt}\n\n---\n\n【學生自己嘗試解題，請評分並批改】\n\n學生的解答：${userText}\n\n請按以下格式回應：\n1. 先說「你答對了 X 分，因為...」\n2. 逐步指出哪個步驟正確、哪個有問題\n3. 針對錯誤的地方給提示，不直接給出正確解法\n4. 最後說「你要不要再試試看？」`
    } else {
      fullPrompt = `${systemPrompt}\n\n---\n\n學生的題目：${userText || '（請分析圖片中的題目）'}`
    }
  }

  // 讀取圖片（如有）
  let imageBase64 = null
  let imageMimeType = 'image/jpeg'
  if (imageName) {
    const imagePath = join(UPLOAD_DIR, imageName)
    if (existsSync(imagePath)) {
      const imgData = await Bun.file(imagePath).arrayBuffer()
      imageBase64 = Buffer.from(imgData).toString('base64')
      const ext = imageName.split('.').pop()?.toLowerCase()
      imageMimeType = { png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[ext] ?? 'image/jpeg'
    }
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')

  res.write(`data: ${JSON.stringify({ type: 'meta', conversationId: convId })}\n\n`)

  try {
    let content = null
    let actualProvider = 'unknown'
    let actualModel = 'unknown'

    // ── 圖片題目：走 Gemini Vision ────────────────────────
    if (imageBase64 && GEMINI_API_KEY) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: fullPrompt },
                { inline_data: { mime_type: imageMimeType, data: imageBase64 } },
              ],
            }],
            generationConfig: { maxOutputTokens: 4096 },
          }),
        }
      )

      if (!geminiRes.ok) throw new Error(`Gemini Vision API ${geminiRes.status}`)
      const geminiData = await geminiRes.json()
      const candidate = geminiData.candidates?.[0]
      if (!candidate) throw new Error('Gemini 未返回內容')
      content = candidate.content?.parts?.map(p => p.text || '').join('') ?? ''
      actualProvider = 'gemini'
      actualModel = 'gemini-2.0-flash'
    }

    // ── 純文字題目（或圖片但沒有 Gemini key）：走 callAI 輪換 ──
    if (!content) {
      const textNote = imageBase64 && !GEMINI_API_KEY
        ? '\n[學生附上了一張題目圖片，但目前圖片解析功能未設定（需要 GEMINI_API_KEY），請提示學生手動輸入題目文字]'
        : ''
      const data = await callAI(fullPrompt + textNote, subject)
      content = data.content
      actualProvider = data.provider
      actualModel = data.model
    }

    // 儲存 AI 回覆
    q.insertMsg.run({
      $conversation_id: convId,
      $role: 'assistant',
      $content: content,
      $image_name: null,
    })

    // 模擬打字串流（每次 3 字，12ms 間隔 ≈ 每秒 250 字）
    const CHUNK = 3
    for (let i = 0; i < content.length; i += CHUNK) {
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: content.slice(i, i + CHUNK) })}\n\n`)
      await Bun.sleep(12)
    }

    res.write(`data: ${JSON.stringify({
      type: 'done',
      conversationId: convId,
      provider: actualProvider,
      model: actualModel,
    })}\n\n`)

    // 非同步更新各科教學策略（班級導師對話不觸發）
    if (subject !== 'advisor') {
      updateTeachingStrategy(userId, subject).catch(() => {})
    }

  } catch (err) {
    console.error('Proxy 呼叫失敗:', err.message)
    res.write(`data: ${JSON.stringify({ type: 'error', message: `AI 服務暫時無法回應：${err.message}` })}\n\n`)
  }

  res.end()
})

// ── 應用程式設定 API ──────────────────────────────────────
app.get('/api/app-settings', (_, res) => {
  const key = GEMINI_API_KEY
  // 回傳時遮蔽中間部分，只露頭尾
  const masked = key.length > 8
    ? key.slice(0, 4) + '•'.repeat(key.length - 8) + key.slice(-4)
    : key ? '•'.repeat(key.length) : ''
  res.json({ gemini_api_key_masked: masked, gemini_enabled: !!key })
})

app.put('/api/app-settings', (req, res) => {
  const { gemini_api_key } = req.body
  if (gemini_api_key !== undefined) {
    const trimmed = (gemini_api_key ?? '').trim()
    q.upsertSetting.run({ $key: 'gemini_api_key', $value: trimmed })
    GEMINI_API_KEY = trimmed
  }
  res.json({ ok: true })
})

// ── 段考成績 API ──────────────────────────────────────────
app.get('/api/exam-scores/:userId', (req, res) => {
  res.json(q.examScoresByUser.all(req.params.userId))
})

app.post('/api/exam-scores', (req, res) => {
  const { userId, subject, examName, score, examDate } = req.body
  if (!userId || !subject || score === undefined || !examDate)
    return res.status(400).json({ error: '缺少必要欄位' })
  const s = Number(score)
  if (isNaN(s) || s < 0 || s > 100)
    return res.status(400).json({ error: '成績必須在 0–100 之間' })

  const r = q.insertExamScore.run({
    $user_id: userId,
    $subject: subject,
    $exam_name: examName || '段考',
    $score: s,
    $exam_date: examDate,
  })
  res.json({ id: r.lastInsertRowid, ok: true })
})

app.delete('/api/exam-scores/:id', (req, res) => {
  q.deleteExamScore.run(req.params.id)
  res.json({ ok: true })
})

// ── AI 弱點分析 API ───────────────────────────────────────
app.get('/api/weaknesses/:userId', (req, res) => {
  const rows = q.weaknessesByUser.all(req.params.userId)
  const result = {}
  for (const r of rows) result[r.subject] = r.content
  res.json(result)
})

app.post('/api/weaknesses/analyze', async (req, res) => {
  const { userId, subject } = req.body
  if (!userId || !subject) return res.status(400).json({ error: '缺少參數' })

  const user = q.userById.get(userId)
  if (!user) return res.status(404).json({ error: '找不到使用者' })

  // 取近期訊息
  const msgs = q.recentMsgsForSubject.all(userId, subject)
  if (msgs.length < 4) {
    return res.json({ content: '（對話紀錄不足，請多使用後再分析）', skipped: true })
  }

  const subjectName = SUBJECT_LABELS[subject] || subject

  // 整理對話內容（最多 3000 字）
  const convoText = msgs.reverse().map(m =>
    `${m.role === 'user' ? '學生' : 'AI老師'}：${m.content.slice(0, 200)}`
  ).join('\n').slice(0, 3000)

  const prompt = `你是學習分析師。以下是一位學生在「${subjectName}」的學習對話記錄：

${convoText}

根據以上對話，分析這位學生在「${subjectName}」最主要的學習弱點或常犯的錯誤，列出 3–5 個重點。
要求：
- 每個弱點用一句話精準描述（15字以內）
- 格式：每行以「• 」開頭
- 只輸出弱點清單，不要任何其他說明文字
- 使用繁體中文`

  try {
    const data = await callAI(prompt, 'weakness-analysis')
    const content = data.content.trim()
    q.upsertWeakness.run({ $user_id: userId, $subject: subject, $content: content })
    res.json({ content })
  } catch (err) {
    console.error('弱點分析失敗:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── 使用量統計 API ────────────────────────────────────────
app.get('/api/usage-stats/:userId', (req, res) => {
  res.json(q.usageStatsByUser.all(req.params.userId))
})

// ── 考前衝刺 API（SSE）────────────────────────────────────
app.post('/api/exam-prep', async (req, res) => {
  const { userId, subject, examDate } = req.body
  if (!userId || !subject || !examDate)
    return res.status(400).json({ error: '缺少必要欄位' })

  const user = q.userById.get(userId)
  if (!user) return res.status(404).json({ error: '找不到使用者' })

  const grade = GRADE_LABELS[user.grade] || '學生'
  const subjectName = SUBJECT_LABELS[subject] || subject
  const weakness = q.weaknessBySubject.get(userId, subject)?.content || ''
  const strategy = q.getStrategy.get(userId, subject)?.strategy || ''
  const recentScores = q.examScoresByUser.all(userId).filter(s => s.subject === subject)
  const latestScore = recentScores[recentScores.length - 1]?.score ?? null

  const today = new Date().toISOString().slice(0, 10)
  const daysLeft = Math.max(0, Math.ceil((new Date(examDate).getTime() - new Date(today).getTime()) / 86400000))

  const scoreText = latestScore !== null ? `最近成績：${latestScore} 分` : '尚無成績紀錄'
  const weaknessText = weakness || '（尚無弱點分析）'
  const strategyText = strategy || '（尚無教學策略）'

  const prompt = `你是 ${user.name} 的${subjectName}老師。距離${subjectName}考試還有 ${daysLeft} 天。

學生資料：
- 學習階段：${grade}
- ${scoreText}
- 弱點：${weaknessText}
- 學習特徵：${strategyText}

請制定一個具體的「${daysLeft} 天衝刺計畫」：
- 每一天要做什麼（具體到教材單元或題型）
- 哪些弱點優先補強
- 考前一天要做什麼
格式清楚，用「第 1 天」、「第 2 天」...列出，最後加一句鼓勵的話。
使用繁體中文，整體不超過 400 字。`

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')

  try {
    const { content } = await callAI(prompt, 'exam-prep')
    const CHUNK = 3
    for (let i = 0; i < content.length; i += CHUNK) {
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: content.slice(i, i + CHUNK) })}\n\n`)
      await Bun.sleep(12)
    }
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`)
  }
  res.end()
})

// ── 家長模式 API ──────────────────────────────────────────
app.get('/api/parent/token/:userId', (req, res) => {
  const existing = q.getParentToken.get(req.params.userId)
  if (existing) return res.json({ token: existing.token })

  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  q.upsertParentToken.run({ $user_id: req.params.userId, $token: token })
  res.json({ token })
})

app.get('/api/parent/view/:token', (req, res) => {
  const user = q.getUserByToken.get(req.params.token)
  if (!user) return res.status(404).json({ error: '連結無效' })

  const parsed = parseUser(user)
  const weaknesses = q.weaknessesByUser.all(user.id).reduce((acc, r) => ({ ...acc, [r.subject]: r.content }), {})
  const examScores = q.examScoresByUser.all(user.id)
  const strategies = q.allStrategies.all(user.id)
  const profile = q.getLearningProfile.get(user.id)?.profile || ''
  const usage = q.usageStatsByUser.all(user.id)
  const wrongCount = q.wrongAnswersByUser.all(user.id).length

  res.json({ user: parsed, weaknesses, examScores, strategies, profile, usage, wrongCount })
})

// ── 錯題本 API ────────────────────────────────────────────
app.get('/api/wrong-answers/:userId', (req, res) => {
  res.json(q.wrongAnswersByUser.all(req.params.userId))
})

app.post('/api/wrong-answers', (req, res) => {
  const { userId, subject, conversationId, question, aiAnswer, note } = req.body
  if (!userId || !subject || !conversationId)
    return res.status(400).json({ error: '缺少必要欄位' })
  const r = q.insertWrongAnswer.run({
    $user_id: userId,
    $subject: subject,
    $conv_id: conversationId,
    $question: question || '',
    $ai_answer: aiAnswer || '',
    $note: note || '',
  })
  res.json({ id: r.lastInsertRowid, ok: true })
})

app.delete('/api/wrong-answers/:id', (req, res) => {
  q.deleteWrongAnswer.run(req.params.id, req.query.userId)
  res.json({ ok: true })
})

// ── 教學策略 & 學習檔案 API ───────────────────────────────
app.get('/api/strategies/:userId', (req, res) => {
  const rows = q.allStrategies.all(req.params.userId)
  const result = {}
  for (const r of rows) result[r.subject] = { strategy: r.strategy, updated_at: r.updated_at }
  res.json(result)
})

app.get('/api/learning-profile/:userId', (req, res) => {
  const row = q.getLearningProfile.get(req.params.userId)
  res.json({ profile: row?.profile || '' })
})

// SPA fallback
app.get('*', (_, res) => {
  const indexPath = join(__dirname, 'dist', 'index.html')
  if (existsSync(indexPath)) {
    res.sendFile(indexPath)
  } else {
    res.status(404).send('尚未 build，請先執行 bun run build')
  }
})

app.listen(PORT, () => {
  console.log(`✅ HomeworkSolver 啟動於 http://localhost:${PORT}`)
  console.log(`   Proxy: ${PROXY_URL}`)
})
