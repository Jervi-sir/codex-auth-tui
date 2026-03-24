import { Box, Text } from "ink"
import type { CommandSuggestion } from "@/types"
import { Panel } from "./panel"

export function PromptPanel({
  draft,
  streaming,
  modelLabel,
  suggestions,
  selectedSuggestion,
  listening,
}: {
  draft: string
  streaming: boolean
  modelLabel: string
  suggestions: CommandSuggestion[]
  selectedSuggestion: number
  listening: boolean
}) {
  return (
    <Panel title="Prompt" accent={draft.startsWith("/") ? "yellow" : "blue"}>
      <Box marginBottom={1}>
        <Text>{draft || (listening ? "Listening to microphone..." : streaming ? "Waiting for response..." : "Type a message")}</Text>
      </Box>
      <Box>
        <Text color="blue">Code</Text>
        <Text dimColor>  {modelLabel}  OpenAI</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={listening ? "red" : "gray"}>{listening ? "* mic live" : "* mic ready"}</Text>
        <Text dimColor>  ctrl+r dictate  /mic speech to text</Text>
      </Box>
      {suggestions.length > 0 ? (
        <Box marginTop={1} flexDirection="column">
          {suggestions.map((suggestion, index) => (
            <Box key={suggestion.command}>
              <Text color={index === selectedSuggestion ? "yellow" : "gray"}>
                {index === selectedSuggestion ? "> " : "  "}
                {suggestion.command}
              </Text>
              <Text dimColor>  {suggestion.description}</Text>
            </Box>
          ))}
        </Box>
      ) : null}
    </Panel>
  )
}
