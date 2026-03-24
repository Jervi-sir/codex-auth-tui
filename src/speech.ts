import { existsSync, mkdirSync, statSync } from "fs"
import { dirname, join } from "path"

const SWIFT_SOURCE = join(import.meta.dir, "native", "macos-speech-to-text.swift")
const BINARY_PATH = join(process.cwd(), ".cache", "codex-chat", "macos-speech-to-text")

interface SpeechEvent {
  type: "level" | "result"
  value?: number
  text?: string
}

interface RecordSpeechOptions {
  onLevel?: (value: number) => void
}

async function ensureSpeechBinary(): Promise<string> {
  const sourceStat = statSync(SWIFT_SOURCE)
  const needsBuild = !existsSync(BINARY_PATH) || statSync(BINARY_PATH).mtimeMs < sourceStat.mtimeMs

  if (!needsBuild) return BINARY_PATH

  mkdirSync(dirname(BINARY_PATH), { recursive: true })

  const proc = Bun.spawn(["swiftc", SWIFT_SOURCE, "-O", "-o", BINARY_PATH], {
    stdout: "pipe",
    stderr: "pipe",
  })

  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(stderr.trim() || "Failed to compile speech helper")
  }

  return BINARY_PATH
}

function parseSpeechEvent(line: string): SpeechEvent | null {
  try {
    return JSON.parse(line) as SpeechEvent
  } catch {
    return null
  }
}

export async function recordSpeechToText(options: RecordSpeechOptions = {}): Promise<string> {
  if (process.platform !== "darwin") {
    throw new Error("Microphone dictation is currently supported on macOS only")
  }

  const binary = await ensureSpeechBinary()
  const proc = Bun.spawn([binary], {
    stdout: "pipe",
    stderr: "pipe",
  })

  const reader = proc.stdout.getReader()
  let stdoutBuffer = ""
  let transcript = ""

  const stdoutPromise = (async () => {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      stdoutBuffer += new TextDecoder().decode(value, { stream: true })
      const lines = stdoutBuffer.split("\n")
      stdoutBuffer = lines.pop() ?? ""

      for (const line of lines) {
        const event = parseSpeechEvent(line.trim())
        if (!event) continue

        if (event.type === "level" && typeof event.value === "number") {
          options.onLevel?.(event.value)
        }

        if (event.type === "result" && event.text) {
          transcript = event.text
        }
      }
    }

    if (stdoutBuffer.trim()) {
      const event = parseSpeechEvent(stdoutBuffer.trim())
      if (event?.type === "result" && event.text) {
        transcript = event.text
      }
    }
  })()

  const stderrPromise = new Response(proc.stderr).text()
  const exitCode = await proc.exited
  const [, stderr] = await Promise.all([stdoutPromise, stderrPromise])

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || "Speech transcription failed")
  }

  if (!transcript.trim()) {
    throw new Error("No speech was detected")
  }

  return transcript.trim()
}
