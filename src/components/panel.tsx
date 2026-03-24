import { useEffect, useState } from "react"
import { Box, Text } from "ink"
import { AccentColor } from "@/types"

export function Panel({
  title,
  children,
  accent = "gray",
  flexGrow,
}: {
  title: string
  children: React.ReactNode
  accent?: AccentColor
  flexGrow?: number
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={accent}
      borderDimColor
      paddingX={1}
      paddingY={0}
      flexGrow={flexGrow}
    >
      <Box marginBottom={1}>
        <Text color={accent} bold>{title}</Text>
      </Box>
      {children}
    </Box>
  )
}