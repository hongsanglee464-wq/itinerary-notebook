import type { Trip } from '@/types'

export type BudgetSummary = {
  total: number
  filled: number
  blank: number
}

export function summarizeBudget(trip: Trip): BudgetSummary {
  let total = 0
  let filled = 0
  let blank = 0
  for (const day of trip.days) {
    for (const stop of day.stops) {
      if (typeof stop.cost === 'number' && Number.isFinite(stop.cost)) {
        total += stop.cost
        filled += 1
      } else {
        blank += 1
      }
    }
  }
  return { total, filled, blank }
}
