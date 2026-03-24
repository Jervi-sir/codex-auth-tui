import { useEffect, useState } from "react"
import { Box, Text } from "ink"
import { basename } from "path"
import { RepoFileStat, RepoSnapshot } from "@/types"


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
    <Box marginBottom={1} justifyContent="space-between">
      <Box>
        <Text color="cyanBright" bold>codex-chat</Text>
        <Text dimColor>  Ink terminal client</Text>
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