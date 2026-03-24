import { useEffect, useState } from "react"
import { Box, Text } from "ink"
import { AccentColor } from "@/types"
import { getCharm } from "../charm"

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
      borderColor={accent === "blue" ? "#7D56F4" : accent === "yellow" ? "#EE6FF8" : accent}
      borderDimColor
      paddingX={1}
      paddingY={0}
      flexGrow={flexGrow}
    >
      <Box >
        <Text>{getCharm().apply({ value: " " + title + " ", id: accent === "blue" ? "accent" : "panel_title" })}</Text>
      </Box>
      {children}
    </Box>
  )
}