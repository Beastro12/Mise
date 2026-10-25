import type { NextConfig } from 'next'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// This app lives in a subdirectory of a repository that holds another app, so
// Turbopack's automatic root detection would otherwise land on the repository
// root and resolve the other app's files (DECISIONS D2).
const projectRoot = dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  // The tutor and grader run in route handlers. Keep the Anthropic SDK and the
  // libSQL driver on the server: they must never be traced into a client bundle.
  serverExternalPackages: ['@libsql/client', '@anthropic-ai/sdk'],
  typedRoutes: true,
  turbopack: { root: projectRoot },
}

export default nextConfig
