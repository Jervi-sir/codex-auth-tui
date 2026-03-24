import { Box, Text } from "ink"
import { Spinner } from "./spinner"
import { getCharm } from "../charm"

export function SessionStrip({
  accountLabel,
  modelLabel,
  status,
  streaming,
}: {
  accountLabel: string
  modelLabel: string
  status: string
  streaming: boolean
}) {
  return (
    <Box borderStyle="round" borderColor="gray" borderDimColor paddingX={1}>
      <Box>
        <Text dimColor>Account  </Text>
        <Text>{getCharm().apply({ value: accountLabel, id: "badge_green" })}</Text>
      </Box>
      <Box>
        <Text dimColor>Model  </Text>
        <Text>{getCharm().apply({ value: modelLabel, id: "badge_cyan" })}</Text>
      </Box>
      <Box>
        <Text dimColor>Status </Text>
        <Text>{status}</Text>
        {streaming ? <Spinner /> : null}
      </Box>
    </Box>
  )
}
