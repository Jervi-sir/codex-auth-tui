import { useEffect, useState } from "react"
import { Box, Text } from "ink"

export function Spinner({ active = true }: { active?: boolean }) {
  const frames = [".", "..", "..."]
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!active) return

    const timer = setInterval(() => {
      setIndex((value) => (value + 1) % frames.length)
    }, 180)

    return () => clearInterval(timer)
  }, [active])

  return <Text color="yellow">{frames[index]}</Text>
}