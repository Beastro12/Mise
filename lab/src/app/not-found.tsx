import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-chalk">Not here</h1>
      <p className="prose-lab mt-2 text-chalk-dim">
        That page does not exist. If you followed a link from inside the app, the thing it pointed
        at was probably deleted.
      </p>
      <Link href="/" className="btn mt-4 no-underline">
        Back to today
      </Link>
    </div>
  )
}
