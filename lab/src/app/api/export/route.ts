import { exportAll } from '@/lib/services/transfer'

export const dynamic = 'force-dynamic'

/** The whole database as one JSON file. */
export async function GET() {
  const payload = await exportAll()
  const date = payload.exportedAt.slice(0, 10)
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="lab-export-${date}.json"`,
      'cache-control': 'no-store',
    },
  })
}
