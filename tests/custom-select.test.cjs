const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { JSDOM } = require('jsdom')

const projectRoot = path.resolve(__dirname, '..')
const client = fs.readFileSync(path.join(projectRoot, 'public/custom-select.js'), 'utf8')
const styles = fs.readFileSync(path.join(projectRoot, 'public/ui-kit.css'), 'utf8')

test('BaseSelect enhances native selects and preserves their change contract', async () => {
  const dom = new JSDOM(`<!doctype html><body><select id="size" data-select-icon="grid" aria-label="Размер сетки"><option value="4">4 px</option><option value="8" selected>8 px</option></select></body>`, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://127.0.0.1/',
  })
  dom.window.eval(client)
  const select = dom.window.document.querySelector('#size')
  const trigger = dom.window.document.querySelector('.base-select')
  assert.equal(select.classList.contains('base-select__native'), true)
  assert.match(trigger.textContent, /8 px/)
  assert.ok(trigger.querySelector('use[href="/icons.svg#icon-grid"]'))
  trigger.getBoundingClientRect = () => ({ left: 20, right: 104, top: 20, bottom: 54, width: 84, height: 34 })

  let changes = 0
  select.addEventListener('change', () => { changes += 1 })
  trigger.click()
  assert.equal(dom.window.document.querySelector('#size-options').style.width, '84px')
  const option = [...dom.window.document.querySelectorAll('.base-select__item')].find(item => item.dataset.value === '4')
  option.click()
  assert.equal(select.value, '4')
  assert.equal(changes, 1)
  assert.match(trigger.textContent, /4 px/)

  select.value = '8'
  await Promise.resolve()
  assert.match(trigger.textContent, /8 px/)
  dom.window.close()
})

test('BaseSelect ships shared trigger, portal, option, and state styling', () => {
  for (const className of ['base-select', 'base-select__content', 'base-select__item', 'base-select__indicator']) {
    assert.match(styles, new RegExp(`\\.${className}`))
  }
})
