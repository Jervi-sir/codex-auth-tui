import { Box, Text } from "ink"

export function FooterHints() {
  return (
    <Box marginTop={1} justifyContent="space-between">
      <Text dimColor>ctrl+l clear  ctrl+f files  ctrl+r mic</Text>
      <Text dimColor>tab complete  / commands  enter send</Text>
    </Box>
  )
}
