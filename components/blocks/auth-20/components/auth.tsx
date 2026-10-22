"use client"

import { useState, type ComponentProps } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { LoginForm } from "./login-form"

type FormSubmitHandler = NonNullable<ComponentProps<"form">["onSubmit"]>
type FormSubmitEvent = Parameters<FormSubmitHandler>[0]

export function Auth() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    }).catch(() => null)
    if (!response?.ok) {
      setPending(false)
      setError(response?.status === 401 ? "Invalid email or password." : "Could not sign in. Try again.")
      return
    }
    // Only same-site paths, so `next` cannot send the user to another origin.
    const next = searchParams.get("next")
    router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/")
    router.refresh()
  }

  return (
    <LoginForm
      showPassword={showPassword}
      pending={pending}
      error={error}
      onTogglePassword={() => setShowPassword((current) => !current)}
      onSubmit={handleSubmit}
    />
  )
}
