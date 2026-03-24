import { existsSync, mkdirSync } from "fs"
import { readFile, writeFile } from "fs/promises"
import { join } from "path"
import { homedir } from "os"

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
const ISSUER = "https://auth.openai.com"
const OAUTH_PORT = 1455
const TOKENS_DIR = join(homedir(), ".codex-chat")
const TOKENS_FILE = join(TOKENS_DIR, "tokens.json")

export interface TokenStore {
  access_token: string
  refresh_token: string
  expires_at: number
  account_id?: string
  account_email?: string
  account_name?: string
  account_username?: string
}

interface PkceCodes {
  verifier: string
  challenge: string
}

interface TokenResponse {
  id_token: string
  access_token: string
  refresh_token: string
  expires_in?: number
}

export interface IdTokenClaims {
  chatgpt_account_id?: string
  organizations?: Array<{ id: string }>
  "https://api.openai.com/auth"?: { chatgpt_account_id?: string }
  email?: string
  name?: string
  preferred_username?: string
  nickname?: string
}

interface AccountProfile {
  account_id?: string
  account_email?: string
  account_name?: string
  account_username?: string
}

// ── Token persistence ────────────────────────────────────────────────────────

export async function loadTokens(): Promise<TokenStore | null> {
  try {
    if (!existsSync(TOKENS_FILE)) return null
    const raw = await readFile(TOKENS_FILE, "utf-8")
    return JSON.parse(raw) as TokenStore
  } catch {
    return null
  }
}

export async function saveTokens(store: TokenStore): Promise<void> {
  if (!existsSync(TOKENS_DIR)) mkdirSync(TOKENS_DIR, { recursive: true })
  await writeFile(TOKENS_FILE, JSON.stringify(store, null, 2))
}

export async function clearTokens(): Promise<void> {
  try {
    const { unlink } = await import("fs/promises")
    await unlink(TOKENS_FILE)
  } catch {}
}

// ── PKCE helpers ─────────────────────────────────────────────────────────────

async function generatePKCE(): Promise<PkceCodes> {
  const verifier = generateRandomString(43)
  const data = new TextEncoder().encode(verifier)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return { verifier, challenge: base64UrlEncode(hash) }
}

function generateRandomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes).map((b) => chars[b % chars.length]).join("")
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const binary = String.fromCharCode(...bytes)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function generateState(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer)
}

// ── JWT parsing ───────────────────────────────────────────────────────────────

function parseJwtClaims(token: string): IdTokenClaims | undefined {
  const parts = token.split(".")
  if (parts.length !== 3) return undefined
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString())
  } catch {
    return undefined
  }
}

export function extractAccountId(tokens: TokenResponse): string | undefined {
  return extractAccountProfile(tokens).account_id
}

export function extractAccountProfile(tokens: TokenResponse): AccountProfile {
  const profile: AccountProfile = {}

  for (const t of [tokens.id_token, tokens.access_token]) {
    if (!t) continue
    const c = parseJwtClaims(t)
    if (!c) continue

    profile.account_id ||= 
      c.chatgpt_account_id ||
      c["https://api.openai.com/auth"]?.chatgpt_account_id ||
      c.organizations?.[0]?.id
    profile.account_email ||= c.email
    profile.account_name ||= c.name
    profile.account_username ||= c.preferred_username || c.nickname
  }

  return profile
}

function createTokenStore(tokens: TokenResponse, previous?: TokenStore): TokenStore {
  const profile = extractAccountProfile(tokens)

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    account_id: profile.account_id ?? previous?.account_id,
    account_email: profile.account_email ?? previous?.account_email,
    account_name: profile.account_name ?? previous?.account_name,
    account_username: profile.account_username ?? previous?.account_username,
  }
}

// ── Token exchange & refresh ──────────────────────────────────────────────────

async function exchangeCode(code: string, redirectUri: string, pkce: PkceCodes): Promise<TokenResponse> {
  const res = await fetch(`${ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
      code_verifier: pkce.verifier,
    }).toString(),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(`${ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }).toString(),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  return res.json()
}

// ── Browser OAuth (PKCE) ──────────────────────────────────────────────────────

const HTML_SUCCESS = `<!doctype html><html><head><title>Auth Success</title>
<style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0a0a0a;color:#f0f0f0;}
.box{text-align:center;padding:2rem;}h1{color:#4ade80;}p{color:#888;}</style></head>
<body><div class="box"><h1>✓ Authorized</h1><p>You can close this tab and return to the terminal.</p></div>
<script>setTimeout(()=>window.close(),2000)</script></body></html>`

const HTML_ERROR = (e: string) => `<!doctype html><html><head><title>Auth Failed</title>
<style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0a0a0a;color:#f0f0f0;}
.box{text-align:center;padding:2rem;}h1{color:#f87171;}code{color:#fca5a5;background:#1a0a0a;padding:.5rem 1rem;border-radius:.5rem;display:block;margin-top:1rem;}</style></head>
<body><div class="box"><h1>Authorization Failed</h1><code>${e}</code></div></body></html>`

export async function loginBrowser(): Promise<TokenStore> {
  const redirectUri = `http://localhost:${OAUTH_PORT}/auth/callback`
  const pkce = await generatePKCE()
  const state = generateState()

  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "openid profile email offline_access",
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
    state,
    originator: "opencode",
  })
  const authUrl = `${ISSUER}/oauth/authorize?${params}`

  return new Promise((resolve, reject) => {
    const server = Bun.serve({
      port: OAUTH_PORT,
      fetch(req) {
        const url = new URL(req.url)
        if (url.pathname !== "/auth/callback") return new Response("Not found", { status: 404 })

        const error = url.searchParams.get("error")
        if (error) {
          const msg = url.searchParams.get("error_description") || error
          server.stop()
          reject(new Error(msg))
          return new Response(HTML_ERROR(msg), { headers: { "Content-Type": "text/html" } })
        }

        const code = url.searchParams.get("code")
        const returnedState = url.searchParams.get("state")
        if (!code) {
          server.stop()
          reject(new Error("Missing authorization code"))
          return new Response(HTML_ERROR("Missing authorization code"), { status: 400, headers: { "Content-Type": "text/html" } })
        }
        if (returnedState !== state) {
          server.stop()
          reject(new Error("State mismatch"))
          return new Response(HTML_ERROR("State mismatch"), { status: 400, headers: { "Content-Type": "text/html" } })
        }

        exchangeCode(code, redirectUri, pkce)
          .then(async (tokens) => {
            server.stop()
            const store = createTokenStore(tokens)
            await saveTokens(store)
            resolve(store)
          })
          .catch((err) => { server.stop(); reject(err) })

        return new Response(HTML_SUCCESS, { headers: { "Content-Type": "text/html" } })
      },
    })

    console.log(`\n  Open this URL in your browser:\n\n  ${authUrl}\n`)
  })
}

// ── Device flow (headless) ────────────────────────────────────────────────────

export async function loginDevice(): Promise<TokenStore> {
  const deviceRes = await fetch(`${ISSUER}/api/accounts/deviceauth/usercode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID }),
  })
  if (!deviceRes.ok) throw new Error("Failed to initiate device authorization")

  const deviceData = (await deviceRes.json()) as {
    device_auth_id: string
    user_code: string
    interval: string
  }

  const interval = Math.max(parseInt(deviceData.interval) || 5, 1) * 1000 + 3000
  const deviceUrl = `${ISSUER}/codex/device`

  console.log(`\n  Visit: ${deviceUrl}`)
  console.log(`  Enter code: ${deviceData.user_code}\n`)
  console.log("  Waiting for authorization...")

  while (true) {
    await Bun.sleep(interval)
    const res = await fetch(`${ISSUER}/api/accounts/deviceauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_auth_id: deviceData.device_auth_id,
        user_code: deviceData.user_code,
      }),
    })

    if (res.ok) {
      const data = (await res.json()) as { authorization_code: string; code_verifier: string }
      const tokenRes = await fetch(`${ISSUER}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: data.authorization_code,
          redirect_uri: `${ISSUER}/deviceauth/callback`,
          client_id: CLIENT_ID,
          code_verifier: data.code_verifier,
        }).toString(),
      })
      if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`)
      const tokens: TokenResponse = await tokenRes.json()
      const store = createTokenStore(tokens)
      await saveTokens(store)
      return store
    }

    if (res.status !== 403 && res.status !== 404) throw new Error(`Unexpected status: ${res.status}`)
  }
}

// ── Ensure fresh token ────────────────────────────────────────────────────────

export async function ensureFreshToken(store: TokenStore): Promise<TokenStore> {
  if (store.expires_at > Date.now() + 60_000) return store
  const tokens = await refreshAccessToken(store.refresh_token)
  const updated = createTokenStore(tokens, store)
  await saveTokens(updated)
  return updated
}
