import { Box, Text } from "ink"
import { basename } from "path"
import { RepoSnapshot } from "@/types"
import { Panel } from "./panel"
import { StatRow } from "./stat-row"

export function Sidebar({
  currentTask,
  tokenEstimate,
  historyCount,
  streaming,
  accountLabel,
  filesExpanded,
  repoSnapshot,
}: {
  currentTask: string
  tokenEstimate: number
  historyCount: number
  streaming: boolean
  accountLabel: string
  filesExpanded: boolean
  repoSnapshot: RepoSnapshot
}) {
  return (
    <Box width={38} flexDirection="column" gap={0}>
      <Panel title="Current Task" accent="blue">
        <Text bold wrap="wrap">{currentTask}</Text>
      </Panel>

      <Box>
        <Panel title="Context" accent="gray">
          <StatRow label="tokens" value={tokenEstimate.toLocaleString()} />
          <StatRow label="messages" value={String(historyCount)} />
          <StatRow label="state" value={streaming ? "responding" : "ready"} />
          <StatRow label="account" value={accountLabel} valueColor="green" />
        </Panel>
      </Box>

      <Box>
        <Panel title="LSP" accent="green" flexGrow={1}>
          <Text color="green">* typescript</Text>
        </Panel>
      </Box>

      <Box>
        <Panel title={`${filesExpanded ? "v" : ">"} Modified Files`} accent="yellow" flexGrow={1}>
          {filesExpanded ? (
            repoSnapshot.files.length === 0 ? (
              <Text dimColor>No local changes</Text>
            ) : (
              repoSnapshot.files.map((file) => (
                <Box key={file.path} justifyContent="space-between">
                  <Text wrap="truncate-end">{basename(file.path)}</Text>
                  <Text>
                    <Text color="green">+{file.added}</Text>
                    <Text dimColor> </Text>
                    <Text color="red">-{file.removed}</Text>
                  </Text>
                </Box>
              ))
            )
          ) : (
            <Text dimColor>Press ctrl+f to expand</Text>
          )}
        </Panel>
      </Box>

      <Box>
        <Panel title="Workspace" accent="gray" flexGrow={1}>
          <Text dimColor wrap="truncate-middle">{basename(process.cwd())}:{repoSnapshot.branch}</Text>
          <Text color="green">* codex-chat</Text>
        </Panel>
      </Box>
    </Box>
  )
}