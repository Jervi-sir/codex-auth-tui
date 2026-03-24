import { existsSync, mkdirSync, statSync } from "fs"
import { dirname, join } from "path"

const SWIFT_SOURCE = join(import.meta.dir, "native", "macos-speech-to-text.swift")
const BINARY_PATH = join(process.cwd(), ".cache", "codex-chat", "macos-speech-to-text")

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

export async function recordSpeechToText(): Promise<string> {
  if (process.platform !== "darwin") {
    throw new Error("Microphone dictation is currently supported on macOS only")
  }

  const binary = await ensureSpeechBinary()
  const proc = Bun.spawn([binary], {
    stdout: "pipe",
    stderr: "pipe",
  })

  const stdoutPromise = new Response(proc.stdout).text()
  const stderrPromise = new Response(proc.stderr).text()
  const exitCode = await proc.exited
  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise])

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || "Speech transcription failed")
  }

  const transcript = stdout.trim()
  if (!transcript) {
    throw new Error("No speech was detected")
  }

  return transcript
}
