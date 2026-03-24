import { Box, Text } from "ink"
import type { CommandSuggestion } from "@/types"
import { Panel } from "./panel"
import { VoiceWave } from "./voice-wave"

export function PromptPanel({
  draft,
  streaming,
  modelLabel,
  suggestions,
  selectedSuggestion,
  listening,
  voiceLevels,
}: {
  draft: string
  streaming: boolean
  modelLabel: string
  suggestions: CommandSuggestion[]
  selectedSuggestion: number
  listening: boolean
  voiceLevels: number[]
}) {
  return (
    <Panel title="Prompt" accent={draft.startsWith("/") ? "yellow" : "blue"}>
      <Box >
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
      <Box marginTop={1}>
        <VoiceWave levels={voiceLevels} listening={listening} />
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
