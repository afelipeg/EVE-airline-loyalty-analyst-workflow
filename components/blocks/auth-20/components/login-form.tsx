import { type ComponentProps } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { AuthLogo } from "./auth-logo"
import { EyeOffIcon, EyeIcon } from "lucide-react"

type FormSubmitHandler = NonNullable<ComponentProps<"form">["onSubmit"]>
type FormSubmitEvent = Parameters<FormSubmitHandler>[0]

export function LoginForm({
  showPassword,
  pending,
  error,
  onTogglePassword,
  onSubmit,
}: {
  showPassword: boolean
  pending: boolean
  error: string | null
  onTogglePassword: () => void
  onSubmit: (event: FormSubmitEvent) => void
}) {
  return (
    <div className="flex w-full max-w-[26rem] flex-col gap-5">
      {/* Card */}
      <Card className="w-full gap-0 overflow-hidden p-0 shadow-sm">
        <CardHeader className="flex flex-col items-center gap-4 px-6 pt-8 pb-0 text-center sm:px-8 sm:pt-9">
          <AuthLogo />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-semibold text-balance">Loyalty Analyst</h1>
            <p className="text-muted-foreground text-sm text-pretty">
              Sign in to continue to the analyst workspace.
            </p>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-6 px-6 pt-6 pb-6 sm:px-8 sm:pt-7 sm:pb-8">
          <form className="flex flex-col gap-5" onSubmit={onSubmit}>
            <FieldGroup className="gap-4">
              <Field className="gap-2" data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="auth-20-identifier">Email or username</FieldLabel>
                <Input
                  id="auth-20-identifier"
                  name="email"
                  type="text"
                  autoComplete="username"
                  placeholder="you@company.com or username"
                  required
                  aria-invalid={error ? true : undefined}
                />
              </Field>

              <Field className="gap-2" data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="auth-20-password">Password</FieldLabel>

                <InputGroup className="w-full">
                  <InputGroupInput
                    id="auth-20-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                    aria-invalid={error ? true : undefined}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      type="button"
                      size="icon-xs"
                      className="text-muted-foreground"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      aria-pressed={showPassword}
                      onClick={onTogglePassword}
                    >
                      {showPassword ? (
                        <EyeOffIcon aria-hidden="true" />
                      ) : (
                        <EyeIcon aria-hidden="true" />
                      )}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {error ? <FieldError>{error}</FieldError> : null}
              </Field>
            </FieldGroup>

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
