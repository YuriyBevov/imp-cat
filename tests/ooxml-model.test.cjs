const test = require('node:test')
const assert = require('node:assert/strict')
const JSZip = require('jszip')
const { JSDOM } = require('jsdom')
const ooxml = require('../public/ooxml-model.js')

const { DOMParser } = new JSDOM('').window

const namespaces = `
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:v="urn:schemas-microsoft-com:vml"`

test('extracts page-relative DrawingML anchor geometry and text', () => {
  const xml = `<w:document ${namespaces}><w:body><w:p><w:r><w:drawing>
    <wp:anchor relativeHeight="42" behindDoc="0">
      <wp:positionH relativeFrom="page"><wp:posOffset>95250</wp:posOffset></wp:positionH>
      <wp:positionV relativeFrom="margin"><wp:posOffset>190500</wp:posOffset></wp:positionV>
      <wp:extent cx="190500" cy="285750" />
      <wp:docPr id="7" name="Stamp" />
      <a:xfrm rot="5400000" />
      <w:txbxContent><w:p><w:r><w:t>/Штамп: № 18871/</w:t></w:r></w:p></w:txbxContent>
    </wp:anchor>
  </w:drawing></w:r></w:p></w:body></w:document>`

  const [object] = ooxml.parseFloatingObjectsFromXml(xml, { DOMParser })
  assert.equal(object.sourceType, 'drawing-anchor')
  assert.equal(object.text, '/Штамп: № 18871/')
  assert.equal(object.x.offsetPx, 10)
  assert.equal(object.y.offsetPx, 20)
  assert.equal(object.widthPx, 20)
  assert.equal(object.heightPx, 30)
  assert.equal(object.rotation, 90)
  assert.equal(object.zIndex, 42)

  assert.deepEqual(ooxml.resolveFloatingGeometry(object, {
    width: 800,
    height: 1100,
    contentBounds: { x: 80, y: 100, width: 640, height: 900 },
  }, { x: 0, y: 0, width: 1, height: 1 }), {
    x: 10,
    y: 120,
    width: 20,
    height: 30,
    resolved: true,
  })
})

test('resolves VML shapes inside a scaled Word group', () => {
  const xml = `<w:document ${namespaces}><w:body><w:p><w:r><w:pict>
    <v:group style="position:absolute;margin-left:72pt;margin-top:36pt;width:144pt;height:72pt" coordorigin="0,0" coordsize="200,100">
      <v:shape id="signature" style="position:absolute;left:50;top:25;width:100;height:50;z-index:8">
        <v:textbox><w:txbxContent><w:p><w:r><w:t>/Подпись/</w:t></w:r></w:p></w:txbxContent></v:textbox>
      </v:shape>
    </v:group>
  </w:pict></w:r></w:p></w:body></w:document>`

  const [object] = ooxml.parseFloatingObjectsFromXml(xml, { DOMParser })
  assert.equal(object.sourceType, 'vml-shape')
  assert.equal(object.text, '/Подпись/')
  assert.equal(object.x.offsetPx, 144)
  assert.equal(object.y.offsetPx, 72)
  assert.equal(object.widthPx, 96)
  assert.equal(object.heightPx, 48)
  assert.equal(object.zIndex, 8)
})

test('reads document and reusable header shapes from the DOCX archive', async () => {
  const drawing = `<w:document ${namespaces}><w:body><wp:anchor>
    <wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>
    <wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV>
    <wp:extent cx="95250" cy="95250"/><wp:docPr id="1"/>
    <w:txbxContent><w:p><w:r><w:t>Основной объект</w:t></w:r></w:p></w:txbxContent>
  </wp:anchor></w:body></w:document>`
  const header = `<w:hdr ${namespaces}><v:shape id="header" style="position:absolute;left:10pt;top:5pt;width:40pt;height:20pt">
    <v:textbox><w:txbxContent><w:p><w:r><w:t>Штамп колонтитула</w:t></w:r></w:p></w:txbxContent></v:textbox>
  </v:shape></w:hdr>`
  const zip = new JSZip()
  zip.file('word/document.xml', drawing)
  zip.file('word/header1.xml', header)
  const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' })

  const objects = await ooxml.parseFloatingObjects(arrayBuffer, { JSZip, DOMParser })
  assert.equal(objects.length, 2)
  assert.deepEqual(objects.map(object => object.partKind).sort(), ['document', 'header'])

  const used = new Set()
  const firstHeader = ooxml.matchFloatingObject(objects, 'Штамп колонтитула', used, {
    partKind: 'header', pageIndex: 0,
  })
  const secondHeader = ooxml.matchFloatingObject(objects, 'Штамп колонтитула', used, {
    partKind: 'header', pageIndex: 1,
  })
  assert.ok(firstHeader)
  assert.ok(secondHeader)
})

test('keeps repeated labels at different coordinates but deduplicates AlternateContent fallbacks', () => {
  const repeated = `<w:document ${namespaces}><w:body><w:p><w:r><w:pict>
    <v:shape id="one" style="position:absolute;left:10pt;top:20pt;width:40pt;height:20pt"><v:textbox><w:txbxContent><w:p><w:r><w:t>/Подпись/</w:t></w:r></w:p></w:txbxContent></v:textbox></v:shape>
    <v:shape id="two" style="position:absolute;left:100pt;top:20pt;width:40pt;height:20pt"><v:textbox><w:txbxContent><w:p><w:r><w:t>/Подпись/</w:t></w:r></w:p></w:txbxContent></v:textbox></v:shape>
  </w:pict></w:r></w:p></w:body></w:document>`
  assert.equal(ooxml.parseFloatingObjectsFromXml(repeated, { DOMParser }).length, 2)

  const alternate = `<w:document ${namespaces}><w:body><mc:AlternateContent>
    <mc:Choice><wp:anchor><wp:positionH relativeFrom="page"><wp:posOffset>95250</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>95250</wp:posOffset></wp:positionV><wp:extent cx="381000" cy="190500"/><wp:docPr id="5"/><w:txbxContent><w:p><w:r><w:t>Один объект</w:t></w:r></w:p></w:txbxContent></wp:anchor></mc:Choice>
    <mc:Fallback><v:shape id="fallback" style="position:absolute;left:10px;top:10px;width:40px;height:20px"><v:textbox><w:txbxContent><w:p><w:r><w:t>Один объект</w:t></w:r></w:p></w:txbxContent></v:textbox></v:shape></mc:Fallback>
  </mc:AlternateContent></w:body></w:document>`
  const [object] = ooxml.parseFloatingObjectsFromXml(alternate, { DOMParser })
  assert.equal(object.sourceType, 'drawing-anchor')
})
