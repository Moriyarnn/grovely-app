const MIN_CYCLE_GAP = 21

function getAdjacentShortCyclePairs(cycles) {
  const included = cycles
    .filter(cycle => cycle.review_state !== 'excluded')
    .slice()
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  return included.slice(1).flatMap((later, index) => {
    const earlier = included[index]
    const gap = Math.round((new Date(later.start_date) - new Date(earlier.start_date)) / 86400000)
    if (gap < 1 || gap >= MIN_CYCLE_GAP) return []
    return [{ earlier, later, gap }]
  })
}

function getUnresolvedShortCyclePairs(cycles) {
  return getAdjacentShortCyclePairs(cycles)
    .filter(pair => pair.later.review_state !== 'confirmed')
}

// Confirming a short pair keeps both cycles in averages, but the earlier cycle
// must not retain a second generated fertility forecast. The later cycle is the
// only actionable forecast source; manually logged ovulation remains untouched.
function getConfirmedShortCycleForecastSuppressionIds(cycles) {
  return new Set(
    getAdjacentShortCyclePairs(cycles)
      .filter(pair => pair.later.review_state === 'confirmed')
      .map(pair => pair.earlier.id)
  )
}

function getUnresolvedShortCycleIds(cycles) {
  return new Set(
    getUnresolvedShortCyclePairs(cycles)
      .flatMap(pair => [pair.earlier.id, pair.later.id])
  )
}

function findUnresolvedShortCyclePair(cycles, selectedCycleId, confirmationCycleId) {
  return getUnresolvedShortCyclePairs(cycles).find(pair =>
    pair.later.id === Number(confirmationCycleId) &&
    [pair.earlier.id, pair.later.id].includes(Number(selectedCycleId))
  ) ?? null
}

module.exports = {
  MIN_CYCLE_GAP,
  getConfirmedShortCycleForecastSuppressionIds,
  getUnresolvedShortCyclePairs,
  getUnresolvedShortCycleIds,
  findUnresolvedShortCyclePair
}
