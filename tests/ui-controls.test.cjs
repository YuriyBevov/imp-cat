const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const html = fs.readFileSync(path.join(projectRoot, 'public/index.html'), 'utf8')
const app = fs.readFileSync(path.join(projectRoot, 'public/app.js'), 'utf8')

test('wires grid, continuous zoom, fit-width and workspace controls', () => {
  for (const controlId of ['grid-size', 'view-scale', 'workspace-height-scale']) {
    assert.match(html, new RegExp(`id="${controlId}"`))
  }
  assert.match(html, /id="fit-width"/)
  assert.match(html, /id="resolve-overlaps"/)
  assert.match(html, /id="view-scale" type="range" min="25" max="250"/)
  assert.match(app, /setViewScale\(Number\(elements\.viewScale\.value\)\)/)
  assert.match(app, /fitDocumentWidth/)
  assert.match(app, /resolveSegmentOverlaps/)
  assert.match(app, /setWorkspaceHeightScale\(Number\(elements\.workspaceHeightScale\.value\)\)/)
  assert.match(app, /screenDeltaToDocument/)
})
