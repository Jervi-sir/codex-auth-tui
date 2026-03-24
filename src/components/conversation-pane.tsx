import { Box, Text } from "ink"
import type { TranscriptEntry } from "@/types"
import { Panel } from "./panel"
import { MessageCard } from "./message-card"

export function ConversationPane({ transcript }: { transcript: TranscriptEntry[] }) {
  if (transcript.length === 0) {
    return (
      <Panel title="Conversation" accent="gray">
        <Text dimColor>Start chatting or type / to open command suggestions.</Text>
      </Panel>
    )
  }

  return (
    <Box flexDirection="column">
      {transcript.map((entry) => <MessageCard key={entry.id} entry={entry} />)}
    </Box>
  )
}
