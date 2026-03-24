import { useEffect, useState } from "react"
import { Box, Text } from "ink"
import { TokenStore } from "@/auth";

export function AccountSummary({ store, accountLabel }: { store: TokenStore; accountLabel: string }) {
  return (
    <Box flexDirection="column">
      <Text color="green">{accountLabel}</Text>
      {store.account_email ? <Text dimColor>{store.account_email}</Text> : null}
      {store.account_username ? <Text dimColor>{store.account_username}</Text> : null}
    </Box>
  )
}