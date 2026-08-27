"use client"

/**
 * The public face of the site: a plain, working calculator — and nothing else.
 *
 * Owner decision 2026-08-14: the site is a private club (the app behind it
 * spends paid API credits), so anonymous visitors get this page alone. Typing
 * the door code and pressing "=" reveals the sign-in card. The code is
 * deliberately cosmetic — a door knocker, not a credential: it only reveals a
 * form, every page and API route is gated server-side by the session
 * middleware, and /login reaches the same form without the theater. It ships
 * in client JavaScript and is therefore readable by anyone who looks; that is
 * understood and is why it guards nothing by itself.
 *
 * The code comes from NEXT_PUBLIC_DOOR_CODE so it can be rotated in Vercel
 * without a code change. Design: "Front Door Concepts" canvas, direction A.
 */

import { useState } from "react"

const DOOR_CODE = process.env.NEXT_PUBLIC_DOOR_CODE || "2468"

type Op = "+" | "−" | "×" | "÷"

export function DoorCalculator() {
  const [disp, setDisp] = useState("0")
  const [acc, setAcc] = useState<number | null>(null)
  const [op, setOp] = useState<Op | null>(null)
  const [fresh, setFresh] = useState(true)
  const [typed, setTyped] = useState("")
  const [unlocked, setUnlocked] = useState(false)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const apply = (a: number, b: number, o: Op): number => {
    if (o === "+") return a + b
    if (o === "−") return a - b
    if (o === "×") return a * b
    return b === 0 ? Number.NaN : a / b
  }

  const fmt = (n: number): string => {
    if (!Number.isFinite(n)) return "Error"
    const r = Math.round(n * 1e9) / 1e9
    const out = String(r)
    if (out.length <= 12) return out
    const p = r.toPrecision(8)
    return p.includes("e") ? p : p.replace(/\.?0+$/, "")
  }

  const digit = (d: string) => {
    const next = fresh ? d : disp.length < 12 ? disp + d : disp
    setDisp(next.replace(/^0(?=\d)/, ""))
    setFresh(false)
    setTyped(typed + d)
  }
  const dot = () => {
    if (fresh) {
      setDisp("0.")
      setFresh(false)
      setTyped("")
      return
    }
    if (!disp.includes(".")) {
      setDisp(disp + ".")
      setTyped("")
    }
  }
  const pressOp = (o: Op) => {
    const cur = Number.parseFloat(disp)
    const nextAcc = op && !fresh ? apply(acc as number, cur, op) : acc === null || !fresh ? cur : acc
    setAcc(nextAcc)
    setOp(o)
    setFresh(true)
    setDisp(fmt(nextAcc))
    setTyped("")
  }
  const eq = () => {
    if (typed === DOOR_CODE && op === null) {
      setUnlocked(true)
      return
    }
    if (op === null) {
      setFresh(true)
      setTyped("")
      return
    }
    const res = apply(acc as number, Number.parseFloat(disp), op)
    setDisp(fmt(res))
    setAcc(null)
    setOp(null)
    setFresh(true)
    setTyped("")
  }
  const clr = () => {
    setDisp("0")
    setAcc(null)
    setOp(null)
    setFresh(true)
    setTyped("")
  }
  const back = () => {
    if (fresh) return
    const d = disp.length > 1 ? disp.slice(0, -1) : "0"
    setDisp(d)
    setFresh(d === "0")
    setTyped(typed.slice(0, -1))
  }
  const neg = () => {
    setDisp(fmt(-Number.parseFloat(disp)))
    setTyped("")
  }
  const pct = () => {
    setDisp(fmt(Number.parseFloat(disp) / 100))
    setTyped("")
  }

  const relock = () => {
    setUnlocked(false)
    setLoginError(null)
    setEmail("")
    setPassword("")
    clr()
  }

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setLoginError(null)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (res.ok) {
        window.location.assign("/")
        return
      }
      const body = await res.json().catch(() => null)
      setLoginError(body?.error || `Sign-in failed (HTTP ${res.status})`)
    } catch {
      setLoginError("Could not reach the sign-in service.")
    } finally {
      setBusy(false)
    }
  }

  const keyBase =
    "h-14 rounded-[10px] text-xl font-medium cursor-pointer border-0 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-stone-900"
  const numKey = `${keyBase} bg-stone-100 text-stone-900 hover:bg-stone-200`
  const opKey = `${keyBase} bg-stone-200 text-stone-900 hover:bg-stone-300`

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center relative">
      {!unlocked ? (
        <div className="w-80">
          <div className="bg-white border border-stone-200 rounded-[14px] p-5 shadow-sm">
            <div
              className="h-[72px] flex items-end justify-end px-2 pb-2 text-[44px] font-medium text-stone-900 tracking-tight overflow-hidden whitespace-nowrap"
              aria-live="polite"
            >
              {disp}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button type="button" className={opKey} onClick={clr}>
                C
              </button>
              <button type="button" className={opKey} onClick={back}>
                ⌫
              </button>
              <button type="button" className={opKey} onClick={neg}>
                ±
              </button>
              <button type="button" className={opKey} onClick={() => pressOp("÷")}>
                ÷
              </button>
              {["7", "8", "9"].map((d) => (
                <button key={d} type="button" className={numKey} onClick={() => digit(d)}>
                  {d}
                </button>
              ))}
              <button type="button" className={opKey} onClick={() => pressOp("×")}>
                ×
              </button>
              {["4", "5", "6"].map((d) => (
                <button key={d} type="button" className={numKey} onClick={() => digit(d)}>
                  {d}
                </button>
              ))}
              <button type="button" className={opKey} onClick={() => pressOp("−")}>
                −
              </button>
              {["1", "2", "3"].map((d) => (
                <button key={d} type="button" className={numKey} onClick={() => digit(d)}>
                  {d}
                </button>
              ))}
              <button type="button" className={opKey} onClick={() => pressOp("+")}>
                +
              </button>
              <button type="button" className={opKey} onClick={pct}>
                %
              </button>
              <button type="button" className={numKey} onClick={() => digit("0")}>
                0
              </button>
              <button type="button" className={numKey} onClick={dot}>
                .
              </button>
              <button type="button" className={`${keyBase} bg-stone-900 text-stone-50 hover:bg-stone-800`} onClick={eq}>
                =
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form
          onSubmit={signIn}
          className="w-80 bg-white border border-stone-200 rounded-[14px] p-7 shadow-sm flex flex-col gap-3.5"
        >
          <div className="text-[15px] font-semibold text-stone-900">Sign in</div>
          <input
            type="email"
            required
            autoFocus
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 border border-stone-200 rounded-[10px] px-3 text-sm text-stone-900 bg-stone-50 outline-none focus:border-stone-400"
          />
          <input
            type="password"
            required
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 border border-stone-200 rounded-[10px] px-3 text-sm text-stone-900 bg-stone-50 outline-none focus:border-stone-400"
          />
          {loginError && <p className="text-xs text-red-600">{loginError}</p>}
          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-[10px] bg-stone-900 text-stone-50 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Continue"}
          </button>
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-stone-400">Invite only.</span>
            <button type="button" onClick={relock} className="text-xs text-stone-500 bg-transparent border-0 cursor-pointer p-0">
              Back
            </button>
          </div>
        </form>
      )}

      <div className="absolute bottom-6 text-xs text-stone-300">© 2026</div>
    </div>
  )
}
