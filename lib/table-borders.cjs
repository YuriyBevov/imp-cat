// null means unknown; absence of evidence must never create a printed line.
function normalizeTableBorders(value) {
  if (!value || typeof value !== 'object') return null
  return Object.fromEntries(['top', 'right', 'bottom', 'left'].map(side => [side,
    typeof value[side] === 'boolean' ? value[side] : null]))
}
module.exports = { normalizeTableBorders }
