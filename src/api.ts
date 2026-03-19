import { ensureFreshToken, loadTokens, type TokenStore } from "./auth"
import { platform, release, arch } from "os"

const CODEX_ENDPOINT = "https://chatgpt.com/backend-api/codex/responses"
const VERSION = "0.1.0"

export interface Message {
  role: "user" | "assistant" | "system"
  content: string
}

export interface StreamChunk {
  type: "delta" | "done" | "error"
  text?: string
  error?: string
}

function buildHeaders(store: TokenStore): Headers {
  const h = new Headers()
  h.set("Content-Type", "application/json")
  h.set("Authorization", `Bearer ${store.access_token}`)
  h.set("User-Agent", `opencode/${VERSION} (${platform()} ${release()}; ${arch()})`)
  h.set("originator", "opencode")
  if (store.account_id) h.set("ChatGPT-Account-Id", store.account_id)
  return h
}

function buildBody(messages: Message[], model = "gpt-5.3-codex") {
  // Extract system message as instructions if present
  const systemMsg = messages.find((m) => m.role === "system")
  const instructions = systemMsg?.content ?? "You are a helpful assistant."

  // Convert non-system messages to OpenAI responses API format
  const input = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role,
      content: [{ type: "input_text", text: m.content }],
    }))

  return JSON.stringify({
    model,
    instructions,
    input,
    stream: true,
    reasoning: { effort: "medium", summary: "auto" },
    tools: [],
    store: false,
  })
}

// ── Streaming fetch ───────────────────────────────────────────────────────────

export async function* streamChat(
  messages: Message[],
  model?: string,
  storeOverride?: TokenStore,
): AsyncGenerator<StreamChunk> {
  let store = storeOverride ?? (await loadTokens())
  if (!store) throw new Error("Not authenticated. Run: bun run src/tui.ts login")
  store = await ensureFreshToken(store)

  const res = await fetch(CODEX_ENDPOINT, {
    method: "POST",
    headers: buildHeaders(store),
    body: buildBody(messages, model),
  })

  if (!res.ok) {
    const body = await res.text()
    yield { type: "error", error: `HTTP ${res.status}: ${body.slice(0, 300)}` }
    return
  }

  if (!res.body) {
    yield { type: "error", error: "No response body" }
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith("data:")) continue
        const data = trimmed.slice(5).trim()
        if (data === "[DONE]") { yield { type: "done" }; return }

        try {
          const event = JSON.parse(data)
          const delta = extractDelta(event)
          if (delta) yield { type: "delta", text: delta }
        } catch {
          // malformed SSE line — skip
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  yield { type: "done" }
}

function extractDelta(event: any): string | null {
  // Responses API format
  if (event.type === "response.output_text.delta") return event.delta ?? null
  if (event.type === "content_block_delta") return event.delta?.text ?? null

  // Chat completions format fallback
  const choice = event.choices?.[0]
  return choice?.delta?.content ?? choice?.text ?? null
}

// ── Single-shot helper (for server route) ────────────────────────────────────

export async function chatStream(
  messages: Message[],
  model?: string,
  store?: TokenStore,
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder()
  const gen = streamChat(messages, model, store)

  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await gen.next()
      if (done) { controller.close(); return }
      if (value.type === "delta" && value.text) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: value.text })}\n\n`))
      } else if (value.type === "done") {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      } else if (value.type === "error") {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: value.error })}\n\n`))
        controller.close()
      }
    },
  })
}
