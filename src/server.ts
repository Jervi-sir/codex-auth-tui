#!/usr/bin/env bun
/**
 * codex-chat Web Server
 * Usage: bun run src/server.ts [port]
 */

import { loadTokens, loginBrowser, ensureFreshToken } from "@/auth"
import { chatStream } from "@/api"
import { join } from "path"

const PORT = parseInt(process.argv[2] ?? "3000")

function formatAccountLabel(store: Awaited<ReturnType<typeof loadTokens>>): string {
  if (!store) return "unknown"
  return store.account_email ?? store.account_username ?? store.account_name ?? store.account_id ?? "unknown"
}

// ── Static React app (inlined) ────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Codex Chat</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Syne:wght@400;500;600;700;800&display=swap');

  :root {
    --bg: #0c0c0e;
    --bg2: #111115;
    --bg3: #16161c;
    --border: #232330;
    --accent: #7c6af7;
    --accent2: #a78bfa;
    --accent-glow: rgba(124,106,247,0.15);
    --text: #e8e6f0;
    --text2: #9590a8;
    --text3: #5a5670;
    --user-bg: #1a1824;
    --gpt-bg: #13131a;
    --mono: 'DM Mono', monospace;
    --sans: 'Syne', sans-serif;
    --radius: 12px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--mono);
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Noise overlay */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
    opacity: 0.4;
  }

  header {
    position: relative;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
    background: var(--bg2);
    backdrop-filter: blur(12px);
  }

  .logo {
    font-family: var(--sans);
    font-weight: 800;
    font-size: 16px;
    letter-spacing: -0.02em;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 12px var(--accent);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 12px var(--accent); }
    50% { opacity: 0.5; box-shadow: 0 0 4px var(--accent); }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .model-select {
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text2);
    font-family: var(--mono);
    font-size: 11px;
    padding: 6px 10px;
    cursor: pointer;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239590a8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    padding-right: 26px;
    transition: border-color .2s;
  }
  .model-select:hover { border-color: var(--accent); }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text3);
    padding: 5px 10px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: var(--bg3);
  }

  .status-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #4ade80;
    box-shadow: 0 0 6px #4ade80;
  }

  #chat {
    flex: 1;
    overflow-y: auto;
    padding: 32px 0;
    scroll-behavior: smooth;
    position: relative;
    z-index: 1;
  }

  #chat::-webkit-scrollbar { width: 4px; }
  #chat::-webkit-scrollbar-track { background: transparent; }
  #chat::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

  .messages {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .msg {
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: fadeUp 0.2s ease forwards;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .msg-label {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0 4px;
  }

  .msg.user .msg-label { color: var(--accent2); }
  .msg.assistant .msg-label { color: var(--text3); }

  .msg-bubble {
    padding: 14px 18px;
    border-radius: var(--radius);
    font-size: 14px;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .msg.user .msg-bubble {
    background: var(--user-bg);
    border: 1px solid rgba(124,106,247,0.2);
  }

  .msg.assistant .msg-bubble {
    background: var(--gpt-bg);
    border: 1px solid var(--border);
    color: var(--text);
  }

  /* Code blocks */
  .msg-bubble code {
    font-family: var(--mono);
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 13px;
  }

  .msg-bubble pre {
    background: #0a0a10;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    margin: 8px 0;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.6;
  }

  .msg-bubble pre code {
    background: none;
    border: none;
    padding: 0;
  }

  .cursor {
    display: inline-block;
    width: 2px;
    height: 1em;
    background: var(--accent);
    margin-left: 2px;
    vertical-align: text-bottom;
    animation: blink .8s step-end infinite;
  }

  @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }

  .empty-state {
    text-align: center;
    padding: 80px 24px;
    color: var(--text3);
  }

  .empty-state h2 {
    font-family: var(--sans);
    font-size: 28px;
    font-weight: 700;
    color: var(--text2);
    margin-bottom: 8px;
    letter-spacing: -0.02em;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 20px;
    filter: grayscale(0.3);
  }

  .suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 24px;
  }

  .suggestion {
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 12px;
    color: var(--text2);
    cursor: pointer;
    transition: all .15s;
  }

  .suggestion:hover {
    border-color: var(--accent);
    color: var(--accent2);
    background: var(--accent-glow);
  }

  .input-area {
    position: relative;
    z-index: 10;
    border-top: 1px solid var(--border);
    background: var(--bg2);
    padding: 16px 24px;
  }

  .input-wrap {
    max-width: 760px;
    margin: 0 auto;
    display: flex;
    gap: 10px;
    align-items: flex-end;
  }

  #input {
    flex: 1;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: var(--mono);
    font-size: 14px;
    line-height: 1.6;
    padding: 12px 16px;
    resize: none;
    outline: none;
    min-height: 48px;
    max-height: 180px;
    transition: border-color .2s, box-shadow .2s;
  }

  #input::placeholder { color: var(--text3); }

  #input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  #send {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: var(--accent);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all .15s;
    flex-shrink: 0;
  }

  #send:hover { background: var(--accent2); transform: translateY(-1px); }
  #send:active { transform: translateY(0); }
  #send:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

  #send svg { width: 18px; height: 18px; fill: white; }

  .btn-clear {
    background: none;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text3);
    font-family: var(--mono);
    font-size: 11px;
    padding: 5px 10px;
    cursor: pointer;
    transition: all .15s;
  }
  .btn-clear:hover { color: var(--text2); border-color: var(--text3); }

  .cost-note {
    text-align: center;
    font-size: 10px;
    color: var(--text3);
    margin-top: 10px;
    letter-spacing: 0.05em;
  }
</style>
</head>
<body>
<header>
  <div class="logo">
    <div class="logo-dot"></div>
    codex-chat
  </div>
  <div class="header-right">
    <select class="model-select" id="modelSelect">
      <option value="gpt-5.3-codex">GPT-5.3 Codex</option>
      <option value="gpt-5.1-codex">GPT-5.1 Codex</option>
      <option value="gpt-5.1-codex-mini">GPT-5.1 Codex Mini</option>
      <option value="gpt-5.4">GPT-5.4</option>
    </select>
    <button class="btn-clear" onclick="clearChat()">clear</button>
    <div class="status-badge">
      <div class="status-dot"></div>
      ChatGPT Pro
    </div>
  </div>
</header>

<div id="chat">
  <div class="messages" id="messages">
    <div class="empty-state" id="emptyState">
      <div class="empty-icon">⬡</div>
      <h2>codex-chat</h2>
      <p>Using your ChatGPT subscription. Zero API cost.</p>
      <div class="suggestions">
        <div class="suggestion" onclick="suggest(this)">Explain async/await in JS</div>
        <div class="suggestion" onclick="suggest(this)">Write a Bun HTTP server</div>
        <div class="suggestion" onclick="suggest(this)">Refactor this to use TypeScript generics</div>
        <div class="suggestion" onclick="suggest(this)">Debug my Postgres query</div>
      </div>
    </div>
  </div>
</div>

<div class="input-area">
  <div class="input-wrap">
    <textarea id="input" placeholder="Message Codex..." rows="1"></textarea>
    <button id="send" onclick="sendMessage()">
      <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
    </button>
  </div>
  <div class="cost-note">∅ cost · powered by your ChatGPT Pro/Plus subscription</div>
</div>

<script>
const messagesEl = document.getElementById('messages')
const emptyState = document.getElementById('emptyState')
const inputEl = document.getElementById('input')
const sendBtn = document.getElementById('send')
const modelSelect = document.getElementById('modelSelect')

let history = []
let streaming = false

function suggest(el) {
  inputEl.value = el.textContent
  inputEl.focus()
  autoResize()
}

function clearChat() {
  history = []
  messagesEl.innerHTML = ''
  messagesEl.appendChild(emptyState)
  emptyState.style.display = ''
}

function autoResize() {
  inputEl.style.height = 'auto'
  inputEl.style.height = Math.min(inputEl.scrollHeight, 180) + 'px'
}

inputEl.addEventListener('input', autoResize)
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
})

function appendMessage(role, text) {
  emptyState.style.display = 'none'

  const wrap = document.createElement('div')
  wrap.className = 'msg ' + role

  const label = document.createElement('div')
  label.className = 'msg-label'
  label.textContent = role === 'user' ? 'you' : 'codex'

  const bubble = document.createElement('div')
  bubble.className = 'msg-bubble'
  bubble.textContent = text

  wrap.appendChild(label)
  wrap.appendChild(bubble)
  messagesEl.appendChild(wrap)
  scrollBottom()
  return bubble
}

function renderMarkdown(bubble, text) {
  // Very minimal: handle code blocks and backtick code
  let html = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\`\`\`(\w+)?\n([\s\S]*?)\`\`\`/g, (_,lang,code)=>\`<pre><code>\${code.trimEnd()}</code></pre>\`)
    .replace(/\`([^\`]+)\`/g,'<code>$1</code>')
    .replace(/\n/g,'<br/>')
  bubble.innerHTML = html
}

function scrollBottom() {
  const chat = document.getElementById('chat')
  chat.scrollTop = chat.scrollHeight
}

async function sendMessage() {
  const text = inputEl.value.trim()
  if (!text || streaming) return

  inputEl.value = ''
  autoResize()

  history.push({ role: 'user', content: text })
  appendMessage('user', text)

  const model = modelSelect.value
  streaming = true
  sendBtn.disabled = true

  const bubble = appendMessage('assistant', '')
  const cursor = document.createElement('span')
  cursor.className = 'cursor'
  bubble.appendChild(cursor)

  let fullText = ''

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, model }),
    })

    if (!res.ok) throw new Error(await res.text())

    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') break
        try {
          const parsed = JSON.parse(data)
          if (parsed.error) throw new Error(parsed.error)
          if (parsed.text) {
            fullText += parsed.text
            cursor.remove()
            renderMarkdown(bubble, fullText)
            bubble.appendChild(cursor)
            scrollBottom()
          }
        } catch (e) {
          if (e.message !== 'Unexpected end of JSON input') throw e
        }
      }
    }
  } catch (err) {
    cursor.remove()
    bubble.style.color = '#f87171'
    bubble.textContent = 'Error: ' + err.message
  }

  cursor.remove()
  if (fullText) {
    renderMarkdown(bubble, fullText)
    history.push({ role: 'assistant', content: fullText })
  }

  streaming = false
  sendBtn.disabled = false
  inputEl.focus()
  scrollBottom()
}
</script>
</body>
</html>`

// ── Server ────────────────────────────────────────────────────────────────────

async function main() {
  // Check auth on startup
  let store = await loadTokens()
  if (!store) {
    console.log("\n  No session found. Starting browser login...\n")
    store = await loginBrowser()
    console.log(`\n  ✓ Logged in! Account: ${formatAccountLabel(store)}`)
  }

  const server = Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url)

      // Serve the React SPA
      if (url.pathname === "/" || url.pathname === "/index.html") {
        return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })
      }

      // Chat API
      if (url.pathname === "/api/chat" && req.method === "POST") {
        try {
          const body = await req.json() as { messages: Array<{ role: string; content: string }>; model?: string }
          const freshStore = await ensureFreshToken(store!)
          store = freshStore

          const stream = await chatStream(
            body.messages as any,
            body.model,
            freshStore,
          )

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "X-Accel-Buffering": "no",
            },
          })
        } catch (err: any) {
          return new Response(err.message, { status: 500 })
        }
      }

      // Auth status
      if (url.pathname === "/api/auth") {
        return Response.json({
          authenticated: !!store,
          account_id: store?.account_id,
          account_email: store?.account_email,
          account_name: store?.account_name,
          account_username: store?.account_username,
        })
      }

      return new Response("Not found", { status: 404 })
    },
  })

  console.log(`\n  ╔══════════════════════════════════╗`)
  console.log(`  ║  codex-chat web server running   ║`)
  console.log(`  ║  http://localhost:${PORT}           ║`)
  console.log(`  ╚══════════════════════════════════╝\n`)
}

main().catch((err) => {
  console.error(`\n  Fatal: ${err.message}\n`)
  process.exit(1)
})
