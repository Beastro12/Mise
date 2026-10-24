import { listParking } from '@/lib/services/misc'
import { ParkingList } from '@/components/parking-list'

export const dynamic = 'force-dynamic'

export default async function ParkingPage() {
  const items = await listParking()

  return (
    <div className="max-w-3xl">
      <h1 className="text-lg font-semibold tracking-tight text-chalk">Parking lot</h1>
      <p className="prose-lab mt-2 text-chalk-dim">
        Where a tangent goes so it stops competing with the concept you are on. Promote it into a
        lesson note when it earns a place, or drop it.
      </p>

      <div className="mt-6">
        <ParkingList items={items} />
      </div>
    </div>
  )
}
