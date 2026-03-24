import { Box, Text } from "ink"

const BARS = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]

function toBar(level: number): string {
  const index = Math.max(0, Math.min(BARS.length - 1, Math.round(level * (BARS.length - 1))))
  return BARS[index]
}

export function VoiceWave({ levels, listening }: { levels: number[]; listening: boolean }) {
  const normalized = levels.length > 0 ? levels : new Array(12).fill(0)

  return (
    <Box>
      <Text color={listening ? "red" : "gray"}>{normalized.map(toBar).join(" ")}</Text>
    </Box>
  )
}
