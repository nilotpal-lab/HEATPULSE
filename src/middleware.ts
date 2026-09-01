/**
 * HeatPulse — Next.js Response Middleware
 *
 * Strips browser-extension-injected attributes from the HTML response
 * before the browser parses it, preventing React hydration mismatches.
 *
 * Extensions like Bisect inject: bis_skin_checked, bis_register,
 * and __processed_* attributes into every element.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function middleware(_request: NextRequest) {
  const response = NextResponse.next()

  // Only process HTML responses
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html')) return response

  // Read the HTML and strip injected attributes
  const html = response.text()
  return new Promise<Response>((resolve) => {
    html.then((body) => {
      const cleaned = body
        // Remove bis_skin_checked attributes
        .replace(/\sbis_skin_checked="[^"]*"/g, '')
        // Remove bis_register attributes
        .replace(/\sbis_register="[^"]*"/g, '')
        // Remove __processed_* attributes
        .replace(/\s__processed_[a-f0-9-]+="[^"]*"/g, '')
      response.headers.set('content-length', String(new TextEncoder().encode(cleaned).length))
      resolve(new NextResponse(cleaned, response))
    })
  })
}

export const config = {
  // Match all HTML page requests, exclude API routes and static assets
  matcher: ['/((?!_next/static|_next/image|api/|favicon.ico).*)'],
}
