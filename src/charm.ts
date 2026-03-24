import { initLip, Lipgloss } from "charsm"

let lipgloss: any = null

export async function initCharm() {
  await initLip()
  lipgloss = new Lipgloss()
  
  // Panel Title Style
  lipgloss.createStyle({
    id: "panel_title",
    bold: true,
    canvasColor: {
      color: "#F25D94"
    }
  })

  // Accent gradient style
  lipgloss.createStyle({
    id: "accent",
    canvasColor: {
      color: "#7D56F4"
    }
  })

  // Badges
  lipgloss.createStyle({
    id: "badge_green",
    bold: true,
    padding: [0, 1, 0, 1],
    canvasColor: {
      color: "#FFF",
      background: "#04B575"
    }
  })

  lipgloss.createStyle({
    id: "badge_cyan",
    bold: true,
    padding: [0, 1, 0, 1],
    canvasColor: {
      color: "#000",
      background: "#00BFFF"
    }
  })
}

export function getCharm() {
  if (!lipgloss) {
    throw new Error("Charm Wasm not initialized")
  }
  return lipgloss
}
