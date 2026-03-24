import { useEffect, useState } from "react"
import { Box, Text } from "ink"
import { basename } from "path"
import { RepoFileStat, RepoSnapshot } from "@/types"
import { getCharm } from "../charm"


export function AppHeader({
  accountLabel,
  accountName,
  repoSnapshot,
}: {
  accountLabel: string
  accountName?: string
  repoSnapshot: RepoSnapshot
}) {
  return (
    <Box justifyContent="space-between">
      <Box>
        <Text>{getCharm().apply({ value: " codex-chat ", id: "accent" })}</Text>
        <Text dimColor>  Ink Wasm Client</Text>
      </Box>
      <Box>
        <Text dimColor>account </Text>
        <Text color="green">{accountLabel}</Text>
        {accountName && accountName !== accountLabel ? <Text dimColor>  {accountName}</Text> : null}
        <Text dimColor>  {basename(process.cwd())}:{repoSnapshot.branch}</Text>
      </Box>
    </Box>
  )
}