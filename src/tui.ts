#!/usr/bin/env bun
/**
 * codex-chat TUI
 *
 * Usage:
 *   bun run src/tui.ts            # start chat (auto-login if needed)
 *   bun run src/tui.ts login      # force re-login (browser)
 *   bun run src/tui.ts login:headless  # device flow (no browser)
 *   bun run src/tui.ts logout     # clear saved tokens
 */

import * as readline from "readline"
import { clearTokens, loadTokens, loginBrowser, loginDevice } from "./auth"
import { streamChat, type Message } from "./api"

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
  white: "\x1b[97m",
  bgDark: "\x1b[48;5;234m",
}

function dim(s: string) { return `${c.dim}${s}${c.reset}` }
function bold(s: string) { return `${c.bold}${s}${c.reset}` }
function green(s: string) { return `${c.green}${s}${c.reset}` }
function cyan(s: string) { return `${c.cyan}${s}${c.reset}` }
function red(s: string) { return `${c.red}${s}${c.reset}` }
function yellow(s: string) { return `${c.yellow}${s}${c.reset}` }
function gray(s: string) { return `${c.gray}${s}${c.reset}` }

function clearLine() { process.stdout.write("\r\x1b[2K") }
function printBanner() {
  console.log()
  console.log(bold(cyan("  ╔═══════════════════════════╗")))
  console.log(bold(cyan("  ║  ") + bold(white("  codex-chat  ")) + bold(cyan("           ║"))))
  console.log(bold(cyan("  ║  ") + gray("  ChatGPT sub → free API  ") + bold(cyan("  ║"))))
  console.log(bold(cyan("  ╚═══════════════════════════╝")))
  console.log()
  console.log(gray("  /exit  quit   /clear  new chat   /model  switch model"))
  console.log(gray("  /logout  clear session"))
  console.log()
}

function white(s: string) { return `${c.white}${s}${c.reset}` }

// ── Models ────────────────────────────────────────────────────────────────────

const MODELS = [
  { id: "gpt-5.3-codex", label: "GPT-5.3 Codex (default)" },
  { id: "gpt-5.1-codex", label: "GPT-5.1 Codex" },
  { id: "gpt-5.1-codex-mini", label: "GPT-5.1 Codex Mini" },
  { id: "gpt-5.4", label: "GPT-5.4" },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const arg = process.argv[2]

  if (arg === "logout") {
    await clearTokens()
    console.log(green("  Logged out. Tokens cleared."))
    process.exit(0)
  }

  if (arg === "login" || arg === "login:headless") {
    console.log(yellow("\n  Authenticating with ChatGPT..."))
    const store = arg === "login:headless" ? await loginDevice() : await loginBrowser()
    console.log(green(`\n  ✓ Logged in! Account: ${store.account_id ?? "unknown"}`))
    process.exit(0)
  }

  // Auto-login if no tokens
  let store = await loadTokens()
  if (!store) {
    console.log(yellow("\n  No session found. Starting browser login...\n"))
    store = await loginBrowser()
    console.log(green(`\n  ✓ Logged in! Account: ${store.account_id ?? "unknown"}\n`))
  }

  printBanner()

  const messages: Message[] = []
  let model = MODELS[0].id

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })

  process.stdout.write(cyan("  You › "))

  rl.on("line", async (input) => {
    const text = input.trim()
    if (!text) { process.stdout.write(cyan("  You › ")); return }

    // Commands
    if (text === "/exit" || text === "/quit") {
      console.log(dim("\n  Bye!\n"))
      process.exit(0)
    }

    if (text === "/clear") {
      messages.length = 0
      console.clear()
      printBanner()
      console.log(gray("  Chat cleared.\n"))
      process.stdout.write(cyan("  You › "))
      return
    }

    if (text === "/logout") {
      await clearTokens()
      console.log(green("\n  Logged out.\n"))
      process.exit(0)
    }

    if (text === "/model") {
      console.log()
      MODELS.forEach((m, i) => {
        const active = m.id === model
        console.log(`  ${active ? green("▶") : " "} ${i + 1}. ${active ? bold(m.label) : m.label}`)
      })
      console.log()
      process.stdout.write(gray("  Select [1-4]: "))
      const pick = await new Promise<string>((r) => rl.once("line", r))
      const idx = parseInt(pick.trim()) - 1
      if (idx >= 0 && idx < MODELS.length) {
        model = MODELS[idx].id
        console.log(green(`\n  ✓ Model: ${MODELS[idx].label}\n`))
      } else {
        console.log(yellow("  Invalid choice.\n"))
      }
      process.stdout.write(cyan("  You › "))
      return
    }

    // Regular message
    messages.push({ role: "user", content: text })
    console.log()
    process.stdout.write(`  ${bold(cyan("GPT"))} › `)

    let fullResponse = ""
    let spinner = 0
    const spinFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
    const spinTimer = setInterval(() => {
      clearLine()
      process.stdout.write(`  ${bold(cyan("GPT"))} › ${gray(spinFrames[spinner++ % spinFrames.length])}`)
    }, 80)

    try {
      let first = true
      for await (const chunk of streamChat(messages, model, store!)) {
        if (chunk.type === "delta" && chunk.text) {
          if (first) {
            clearInterval(spinTimer)
            clearLine()
            process.stdout.write(`  ${bold(cyan("GPT"))} › `)
            first = false
          }
          process.stdout.write(chunk.text)
          fullResponse += chunk.text
        } else if (chunk.type === "error") {
          clearInterval(spinTimer)
          clearLine()
          console.log(red(`\n  Error: ${chunk.error}`))
        }
      }
    } catch (err: any) {
      clearInterval(spinTimer)
      clearLine()
      console.log(red(`\n  Error: ${err.message}`))
    }

    clearInterval(spinTimer)
    console.log("\n")

    if (fullResponse) {
      messages.push({ role: "assistant", content: fullResponse })
    }

    process.stdout.write(cyan("  You › "))
  })

  rl.on("close", () => {
    console.log(dim("\n  Bye!\n"))
    process.exit(0)
  })
}

main().catch((err) => {
  console.error(red(`\n  Fatal: ${err.message}\n`))
  process.exit(1)
})
