#!/usr/bin/env bun
/**
 * codex-chat TUI
 *
 * Usage:
 *   bun run src/tui.tsx                # start chat (auto-login if needed)
 *   bun run src/tui.tsx login          # force re-login (browser)
 *   bun run src/tui.tsx login:headless # device flow (no browser)
 *   bun run src/tui.tsx logout         # clear saved tokens
 */

import { execSync } from "child_process"
import { Box, render, useApp, useInput } from "ink"
import { useEffect, useMemo, useRef, useState } from "react"
import { clearTokens, loadTokens, loginBrowser, loginDevice, type TokenStore } from "./auth"
import { streamChat, type Message } from "./api"
import { initCharm } from "./charm"
import { recordSpeechToText } from "./speech"
import { AppHeader } from "./components/app-header"
import { ConversationPane } from "./components/conversation-pane"
import { FooterHints } from "./components/footer-hints"
import { PromptPanel } from "./components/prompt-panel"
import { SessionStrip } from "./components/session-strip"
import { Sidebar } from "./components/sidebar"
import {
  type CommandSuggestion,
  type RepoFileStat,
  type RepoSnapshot,
  type TranscriptEntry,
} from "@/types"

const MODELS = [
  { id: "gpt-5.3-codex", label: "GPT-5.3 Codex", note: "default" },
  { id: "gpt-5.1-codex", label: "GPT-5.1 Codex", note: "previous gen" },
  { id: "gpt-5.1-codex-mini", label: "GPT-5.1 Codex Mini", note: "faster" },
  { id: "gpt-5.4", label: "GPT-5.4", note: "general purpose" },
] as const

const COMMANDS = [
  { command: "/help", description: "Show available commands" },
  { command: "/account", description: "Show the current account" },
  { command: "/files", description: "Toggle modified files panel" },
  { command: "/mic", description: "Dictate with the microphone" },
  { command: "/model", description: "Switch the active model" },
  { command: "/clear", description: "Start a new conversation" },
  { command: "/logout", description: "Clear saved authentication" },
  { command: "/exit", description: "Quit the terminal app" },
] as const

const VOICE_WAVE_BARS = 12

function formatCurrentTask(transcript: TranscriptEntry[]): string {
  const latestUserEntry = [...transcript].reverse().find((entry) => entry.role === "user")
  return latestUserEntry?.content ?? "Waiting for the next prompt"
}

function estimateTokenCount(transcript: TranscriptEntry[]): number {
  const totalChars = transcript.reduce((sum, entry) => sum + entry.content.length, 0)
  return Math.max(0, Math.round(totalChars / 4))
}

function getCommandSuggestions(draft: string): CommandSuggestion[] {
  if (!draft.startsWith("/")) return []

  const commandPart = draft.trim().split(/\s+/, 1)[0].toLowerCase()
  return COMMANDS.filter(({ command }) => command.startsWith(commandPart) || command.includes(commandPart))
}

function readRepoSnapshot(): RepoSnapshot {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim()
    const statusOutput = execSync("git status --short", { encoding: "utf8" }).trim()
    const diffOutput = execSync("git diff --numstat", { encoding: "utf8" }).trim()

    const stats = new Map<string, RepoFileStat>()

    for (const line of diffOutput.split("\n")) {
      if (!line.trim()) continue
      const [addedRaw, removedRaw, ...rest] = line.split("\t")
      const path = rest.join("\t")
      stats.set(path, {
        path,
        added: Number.parseInt(addedRaw, 10) || 0,
        removed: Number.parseInt(removedRaw, 10) || 0,
        status: "M",
      })
    }

    for (const line of statusOutput.split("\n")) {
      if (!line.trim()) continue
      const status = line.slice(0, 2).trim() || "M"
      const path = line.slice(3).trim()
      const current = stats.get(path)

      stats.set(path, {
        path,
        added: current?.added ?? 0,
        removed: current?.removed ?? 0,
        status,
      })
    }

    return {
      branch,
      files: Array.from(stats.values()).slice(0, 6),
    }
  } catch {
    return { branch: "unknown", files: [] }
  }
}

function formatAccountLabel(store: TokenStore): string {
  return store.account_email?.trim() || store.account_username?.trim() || store.account_name?.trim() || store.account_id?.trim() || "unknown account"
}

function formatAccountDetails(store: TokenStore): string[] {
  const details = [
    store.account_name ? `name    ${store.account_name}` : null,
    store.account_email ? `email   ${store.account_email}` : null,
    store.account_username ? `user    ${store.account_username}` : null,
    store.account_id ? `id      ${store.account_id}` : null,
  ].filter((value): value is string => Boolean(value))

  return details.length > 0 ? details : ["No account profile information available"]
}

function ChatApp({ store }: { store: TokenStore }) {
  const { exit } = useApp()
  const [history, setHistory] = useState<Message[]>([])
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [draft, setDraft] = useState("")
  const [model, setModel] = useState<(typeof MODELS)[number]["id"]>(MODELS[0].id)
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceLevels, setVoiceLevels] = useState<number[]>(() => new Array(VOICE_WAVE_BARS).fill(0))
  const [status, setStatus] = useState(`Authenticated as ${formatAccountLabel(store)}`)
  const [selectedSuggestion, setSelectedSuggestion] = useState(0)
  const [repoSnapshot, setRepoSnapshot] = useState<RepoSnapshot>(() => readRepoSnapshot())
  const [filesExpanded, setFilesExpanded] = useState(true)
  const nextEntryId = useRef(1)
  const historyRef = useRef<Message[]>([])
  const activeRequestId = useRef(0)

  const suggestions = useMemo(() => getCommandSuggestions(draft), [draft])
  const visibleTranscript = transcript.slice(-6)
  const tokenEstimate = estimateTokenCount(transcript)
  const currentTask = formatCurrentTask(transcript)
  const selectedModel = MODELS.find((item) => item.id === model) ?? MODELS[0]
  const accountLabel = formatAccountLabel(store)

  useEffect(() => {
    historyRef.current = history
  }, [history])

  useEffect(() => {
    setSelectedSuggestion((current) => {
      if (suggestions.length === 0) return 0
      return Math.min(current, suggestions.length - 1)
    })
  }, [suggestions])

  const pushEntry = (role: TranscriptEntry["role"], content: string) => {
    const id = nextEntryId.current++
    setTranscript((current) => [...current, { id, role, content }])
    return id
  }

  const replaceEntry = (id: number, role: TranscriptEntry["role"], content: string) => {
    setTranscript((current) => current.map((entry) => (entry.id === id ? { ...entry, role, content } : entry)))
  }

  const autocompleteCommand = () => {
    const suggestion = suggestions[selectedSuggestion] ?? suggestions[0]
    if (!suggestion) return
    setDraft(suggestion.command)
    setStatus(`${suggestion.command} ready`)
  }

  const printHelp = () => {
    pushEntry("status", COMMANDS.map(({ command, description }) => `${command}  ${description}`).join("\n"))
    setStatus("Command list updated")
  }

  const resetConversation = () => {
    activeRequestId.current += 1
    historyRef.current = []
    setHistory([])
    setTranscript([])
    setDraft("")
    setStatus("Conversation cleared")
  }

  const startDictation = async () => {
    if (streaming || listening || modelPickerOpen) return

    setVoiceLevels(new Array(VOICE_WAVE_BARS).fill(0))
    setListening(true)
    setStatus("Listening to microphone")

    try {
      const transcript = await recordSpeechToText({
        onLevel: (value) => {
          setVoiceLevels((current) => [...current.slice(-(VOICE_WAVE_BARS - 1)), value])
        },
      })
      setDraft((current) => (current ? `${current} ${transcript}` : transcript))
      setStatus("Speech added to composer")
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      pushEntry("error", `Microphone\n${message}`)
      setStatus("Microphone transcription failed")
    } finally {
      setListening(false)
      setVoiceLevels((current) => current.map((value) => value * 0.35))
    }
  }

  const submitPrompt = async (value: string) => {
    let text = value.trim()
    if (!text || streaming || listening) return

    if (text.startsWith("/") && !text.includes(" ")) {
      const exactCommand = COMMANDS.find(({ command }) => command === text)
      if (!exactCommand && suggestions.length > 0) {
        text = suggestions[selectedSuggestion]?.command ?? suggestions[0].command
      }
    }

    if (text === "/exit" || text === "/quit") {
      exit()
      return
    }

    if (text === "/help") {
      printHelp()
      return
    }

    if (text === "/account") {
      pushEntry("status", `Current account\n${formatAccountDetails(store).join("\n")}`)
      setStatus(`Using account ${accountLabel}`)
      return
    }

    if (text === "/files") {
      setFilesExpanded((current) => {
        const next = !current
        setStatus(next ? "Modified files expanded" : "Modified files collapsed")
        return next
      })
      return
    }

    if (text === "/mic") {
      await startDictation()
      return
    }

    if (text === "/clear") {
      resetConversation()
      return
    }

    if (text === "/logout") {
      setStatus("Clearing saved session")
      await clearTokens()
      exit()
      return
    }

    if (text === "/model") {
      setModelPickerOpen(true)
      setStatus("Select a model with 1-4")
      return
    }

    const requestId = activeRequestId.current + 1
    activeRequestId.current = requestId
    const nextHistory = [...historyRef.current, { role: "user", content: text } satisfies Message]
    historyRef.current = nextHistory
    setHistory(nextHistory)
    pushEntry("user", text)
    setStreaming(true)
    setStatus(`Streaming from ${selectedModel.label}`)

    const assistantEntryId = pushEntry("assistant", "Thinking...")
    let response = ""
    let sawError = false

    try {
      for await (const chunk of streamChat(nextHistory, model, store)) {
        if (activeRequestId.current !== requestId) return

        if (chunk.type === "delta" && chunk.text) {
          response += chunk.text
          replaceEntry(assistantEntryId, "assistant", response)
          continue
        }

        if (chunk.type === "error") {
          sawError = true
          replaceEntry(assistantEntryId, "error", chunk.error ?? "Unknown error")
          setStatus("Request failed")
        }
      }

      if (!sawError && response) {
        const updatedHistory = [...nextHistory, { role: "assistant", content: response } satisfies Message]
        historyRef.current = updatedHistory
        setHistory(updatedHistory)
        setStatus("Ready")
      } else if (!sawError) {
        replaceEntry(assistantEntryId, "status", "No response received")
        setStatus("No response received")
      }
    } catch (error) {
      if (activeRequestId.current !== requestId) return

      const message = error instanceof Error ? error.message : String(error)
      replaceEntry(assistantEntryId, "error", message)
      setStatus("Request failed")
    } finally {
      if (activeRequestId.current === requestId) {
        setStreaming(false)
        setRepoSnapshot(readRepoSnapshot())
      }
    }
  }

  useInput((input, key) => {
    if (modelPickerOpen) {
      if (key.escape) {
        setModelPickerOpen(false)
        setStatus("Model selection cancelled")
        return
      }

      const index = Number.parseInt(input, 10) - 1
      if (!Number.isNaN(index) && MODELS[index]) {
        setModel(MODELS[index].id)
        setModelPickerOpen(false)
        setStatus(`Model set to ${MODELS[index].label}`)
      }
      return
    }

    if (key.ctrl && input === "c") {
      exit()
      return
    }

    if (key.ctrl && input === "l") {
      resetConversation()
      return
    }

    if (key.ctrl && input.toLowerCase() === "f") {
      setFilesExpanded((current) => !current)
      return
    }

    if (key.ctrl && input === "r") {
      void startDictation()
      return
    }

    if (streaming || listening) return

    if ((key.tab || key.rightArrow) && suggestions.length > 0) {
      autocompleteCommand()
      return
    }

    if (key.upArrow && suggestions.length > 0) {
      setSelectedSuggestion((current) => (current - 1 + suggestions.length) % suggestions.length)
      return
    }

    if (key.downArrow && suggestions.length > 0) {
      setSelectedSuggestion((current) => (current + 1) % suggestions.length)
      return
    }

    if (key.return) {
      const value = draft
      setDraft("")
      void submitPrompt(value)
      return
    }

    if (key.backspace || key.delete) {
      setDraft((current) => current.slice(0, -1))
      return
    }

    if (!key.ctrl && !key.meta && input) {
      setDraft((current) => current + input)
    }
  })

  return (
    <Box flexDirection="column" >
      <AppHeader accountLabel={accountLabel} accountName={store.account_name} repoSnapshot={repoSnapshot} />
      <SessionStrip accountLabel={accountLabel} modelLabel={selectedModel.label} status={status} streaming={streaming} />

      <Box alignItems="flex-start">
        <Box flexDirection="column" flexGrow={1}  >
          <ConversationPane transcript={visibleTranscript} />
          <PromptPanel
            draft={draft}
            streaming={streaming}
            listening={listening}
            voiceLevels={voiceLevels}
            modelLabel={selectedModel.label}
            suggestions={suggestions}
            selectedSuggestion={selectedSuggestion}
          />
        </Box>

        <Sidebar
          currentTask={currentTask}
          tokenEstimate={tokenEstimate}
          historyCount={history.length}
          streaming={streaming}
          accountLabel={accountLabel}
          filesExpanded={filesExpanded}
          repoSnapshot={repoSnapshot}
        />
      </Box>

      <FooterHints />
    </Box>
  )
}

async function main() {
  await initCharm()
  const arg = process.argv[2]

  if (arg === "logout") {
    await clearTokens()
    console.log("Logged out. Tokens cleared.")
    process.exit(0)
  }

  if (arg === "login" || arg === "login:headless") {
    console.log("Authenticating with ChatGPT...")
    const store = arg === "login:headless" ? await loginDevice() : await loginBrowser()
    console.log(`Logged in. Account: ${formatAccountLabel(store)}`)
    process.exit(0)
  }

  let store = await loadTokens()
  if (!store) {
    console.log("No session found. Starting browser login...")
    store = await loginBrowser()
    console.log(`Logged in. Account: ${formatAccountLabel(store)}`)
  }

  render(<ChatApp store={store} />)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Fatal: ${message}`)
  process.exit(1)
})
