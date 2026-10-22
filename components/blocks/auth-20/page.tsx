import { Suspense } from "react"

import { Auth } from "./components/auth"

export function Page() {
  return (
    <div className="bg-background flex min-h-svh w-full items-center justify-center px-4 py-6 sm:px-8 sm:py-10 lg:px-10">
      {/* Auth reads ?next= with useSearchParams, which needs a Suspense boundary. */}
      <Suspense>
        <Auth />
      </Suspense>
    </div>
  )
}
