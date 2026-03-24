import { useEffect, useState } from "react"
import { Box, Text } from "ink"
import { Spinner } from "./spinner"

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
    <Box marginBottom={1} borderStyle="round" borderColor="gray" borderDimColor paddingX={1}>
      <Box marginRight={3}>
        <Text dimColor>Account </Text>
        <Text color="green">{accountLabel}</Text>
      </Box>
      <Box marginRight={3}>
        <Text dimColor>Model </Text>
        <Text color="cyan">{modelLabel}</Text>
      </Box>
      <Box>
        <Text dimColor>Status </Text>
        <Text>{status}</Text>
        {streaming ? <Spinner /> : null}
      </Box>
    </Box>
  )
}
