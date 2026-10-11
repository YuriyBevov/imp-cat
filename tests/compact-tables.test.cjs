const test = require('node:test')
const assert = require('node:assert/strict')
const { expandCompactTables } = require('../lib/compact-tables.cjs')
const { normalizeCodexAnalysis } = require('../lib/document-agent.cjs')
const table = () => ({ tableId:'t',columnEdges:[.1,.2,.8],rowEdges:[.2,.3,.4],readingOrder:3,
  style:{fontSizePt:10,fontFamily:'Arial'},confidence:.98,needsReview:false,borders:{top:false,bottom:false,left:true,right:true},
  cells:[{row:0,column:0,rowSpan:1,columnSpan:2,text:'Merged header',borders:null},
    {row:1,column:0,text:'1'},{row:1,column:1,text:''}] })

test('compact table expands shared tracks, empty cells and spans without repeating header text',()=>{
 const input=table(), snapshot=structuredClone(input), cells=expandCompactTables([input])
 assert.deepEqual(input,snapshot)
 assert.equal(cells.length,3)
 assert.equal(cells[0].columnSpan,2)
 assert.equal(cells[2].sourceText,'')
 assert.deepEqual(cells[1].borders,input.borders)
 assert.ok(Math.abs(cells[0].regions[0].width-.7)<1e-8)
 const analysis=normalizeCodexAnalysis({pages:[{pageIndex:0,segments:[],tables:[input]}]},{pages:[{index:0,width:1000,height:1000,image:'page.png'}]})
 assert.equal(analysis.pages[0].segments.length,3)
 assert.equal(analysis.pages[0].segments[2].columnIndex,1)
})

test('incomplete, overlapping or reversed tables fail before translation and layout',()=>{
 const incomplete=table();incomplete.cells.pop()
 assert.throws(()=>expandCompactTables([incomplete]),/пропущено ячеек 1/)
 const overlapping=table();overlapping.cells.push({row:0,column:1,text:'duplicate'})
 assert.throws(()=>expandCompactTables([overlapping]),/пересекаются/)
 const reversed=table();reversed.columnEdges=[.2,.1,.8]
 assert.throws(()=>expandCompactTables([reversed]),/возрастанию/)
 const outside=table();outside.cells[0].columnSpan=3
 assert.throws(()=>expandCompactTables([outside]),/за границы/)
 assert.throws(()=>expandCompactTables([table(),table()]),/Повторяющийся/)
})

test('continued compact tables get global row addresses and keep footer reading order',()=>{
 const first=table();first.headerRowCount=1
 const second=table();second.headerRowCount=0
 const raw={pages:[{pageIndex:0,segments:[{segmentId:'footer',type:'text',sourceText:'Footer',readingOrder:4,regions:[{x:.1,y:.9,width:.8,height:.05}]}],tables:[first]}, {pageIndex:1,segments:[],tables:[second]}]}
 const manifest={pages:[0,1].map(index=>({index,width:1000,height:1000,image:`page-${index}.png`}))}
 const analysis=normalizeCodexAnalysis(raw,manifest)
 assert.equal(analysis.pages[0].segments.at(-1).sourceText,'Footer')
 assert.equal(analysis.pages[0].segments[0].isTableHeader,true)
 assert.deepEqual(analysis.pages[1].segments.map(c=>c.rowIndex),[2,3,3])
 assert.ok(analysis.pages[1].segments.every(c=>!c.isTableHeader))
 second.columnEdges=[.1,.8];second.cells=[{row:0,column:0,text:'a'},{row:1,column:0,text:'b'}]
 assert.throws(()=>normalizeCodexAnalysis(raw,manifest),/число колонок/)
})
