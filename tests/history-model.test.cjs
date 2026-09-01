const test = require('node:test')
const assert = require('node:assert/strict')
const historyModel = require('../public/history-model.js')

test('records only changed document states and undoes them in reverse order', () => {
  const history = historyModel.create(3)
  const first = { x: 10, text: 'A' }
  const second = { x: 20, text: 'A' }
  const third = { x: 20, text: 'B' }

  assert.equal(historyModel.record(history, first, first, 'no-op'), false)
  assert.equal(historyModel.record(history, first, second, 'move'), true)
  assert.equal(historyModel.record(history, second, third, 'edit'), true)
  assert.deepEqual(historyModel.undo(history), { label: 'edit', snapshot: second })
  assert.deepEqual(historyModel.undo(history), { label: 'move', snapshot: first })
  assert.equal(historyModel.undo(history), null)
})

test('keeps only the configured number of undo steps and can be cleared', () => {
  const history = historyModel.create(2)
  historyModel.record(history, { value: 0 }, { value: 1 }, 'one')
  historyModel.record(history, { value: 1 }, { value: 2 }, 'two')
  historyModel.record(history, { value: 2 }, { value: 3 }, 'three')

  assert.deepEqual(history.entries.map((entry) => entry.label), ['two', 'three'])
  historyModel.clear(history)
  assert.equal(history.entries.length, 0)
})
