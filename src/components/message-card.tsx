import { Box, Text } from "ink"
import type { TranscriptEntry } from "@/types"

export function MessageCard({ entry }: { entry: TranscriptEntry }) {
  const theme =
    entry.role === "user"
      ? { label: "You", color: "blue" as const, border: "blue" as const }
      : entry.role === "assistant"
        ? { label: "Code", color: "cyan" as const, border: "gray" as const }
        : entry.role === "error"
          ? { label: "Error", color: "red" as const, border: "red" as const }
          : { label: "Info", color: "yellow" as const, border: "yellow" as const }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.border} borderDimColor paddingX={1} marginBottom={1}>
      <Box marginBottom={1}>
        <Text color={theme.color}>{theme.label}</Text>
      </Box>
      <Text>{entry.content || " "}</Text>
    </Box>
  )
}
