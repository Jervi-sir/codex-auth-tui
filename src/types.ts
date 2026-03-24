export type AccentColor = "gray" | "cyan" | "blue" | "yellow" | "green" | "red"

export type TranscriptEntry = {
  id: number
  role: "user" | "assistant" | "status" | "error"
  content: string
}

export type RepoFileStat = {
  path: string
  added: number
  removed: number
  status: string
}

export type RepoSnapshot = {
  branch: string
  files: RepoFileStat[]
}

export type CommandSuggestion = {
  command: string
  description: string
}

