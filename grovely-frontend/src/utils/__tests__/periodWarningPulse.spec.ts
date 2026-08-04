import { describe, expect, it } from 'vitest'
import { getWarningPulseDates } from '../periodWarningPulse'

describe('period warning pulse dates', () => {
  it('highlights every period involved in a short-cycle pair', () => {
    const dates = getWarningPulseDates(
      { targetDate: '2026-06-13', cycleIds: [1, 2], affectedDates: ['2026-06-13', '2026-07-03'] },
      [
        { id: 1, start_date: '2026-06-13', end_date: '2026-06-15' },
        { id: 2, start_date: '2026-07-03', end_date: '2026-07-06' },
      ]
    )

    expect([...dates]).toEqual(['2026-06-13', '2026-06-14', '2026-06-15', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06'])
  })
})
