const MIN_CYCLE_GAP = 21

function getUnresolvedShortCyclePairs(cycles) {
  const included = cycles
    .filter(cycle => cycle.review_state !== 'excluded')
    .slice()
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  return included.slice(1).flatMap((later, index) => {
    const earlier = included[index]
    const gap = Math.round((new Date(later.start_date) - new Date(earlier.start_date)) / 86400000)
    if (gap < 1 || gap >= MIN_CYCLE_GAP || later.review_state === 'confirmed') return []
    return [{ earlier, later, gap }]
  })
}

function findUnresolvedShortCyclePair(cycles, selectedCycleId, confirmationCycleId) {
  return getUnresolvedShortCyclePairs(cycles).find(pair =>
    pair.later.id === Number(confirmationCycleId) &&
    [pair.earlier.id, pair.later.id].includes(Number(selectedCycleId))
  ) ?? null
}

module.exports = { MIN_CYCLE_GAP, getUnresolvedShortCyclePairs, findUnresolvedShortCyclePair }
