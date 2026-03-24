import { useEffect, useState } from "react"
import { Box, Text } from "ink"

export function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <Box justifyContent="space-between">
      <Text dimColor>{label}</Text>
      <Text color={valueColor}>{value}</Text>
    </Box>
  )
}