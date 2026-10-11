/* Read-only replay of real recognition results through the actual client.
 * Usage: node scripts/verify_saved_documents.cjs DATA_DIR OUTPUT_DIR
 * Private documents and generated artifacts stay outside version control.
 */
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const { JSDOM, VirtualConsole } = require('jsdom')
const { buildSceneFromAgent } = require('../lib/studio-model.cjs')
const root = path.resolve(__dirname, '..')
const pause = () => new Promise(resolve => setTimeout(resolve, 25))
function audit(scene) {
  const active = scene.objects.filter(object => !object.excluded)
  assert.equal(new Set(scene.objects.map(object => object.id)).size, scene.objects.length, 'duplicate IDs')
  for (let i = 0; i < active.length; i++) {
    const a = active[i], area = scene.pages[a.pageIndex].contentBounds
    for (const value of [a.x - area.x, a.y - area.y, a.width, a.height]) assert.ok(Math.abs(value / 17 - Math.round(value / 17)) < 1e-5, `${a.id}: off grid`)
    assert.ok(a.x >= area.x - .01 && a.y >= area.y - .01 && a.x + a.width <= area.x + area.width + .01 && a.y + a.height <= area.y + area.height + .01, `${a.id}: outside area`)
    for (let j = i + 1; j < active.length; j++) {
      const b = active[j]
      assert.ok(a.pageIndex !== b.pageIndex || Math.min(a.x+a.width,b.x+b.width) <= Math.max(a.x,b.x)+.01 || Math.min(a.y+a.height,b.y+b.height) <= Math.max(a.y,b.y)+.01, `${a.id} overlaps ${b.id}`)
    }
  }
}
async function main() {
 const source = path.resolve(process.argv[2] || 'data/studio'), destination = path.resolve(process.argv[3] || '.build/real-document-verification')
 if (source === destination || destination.startsWith(source + path.sep)) throw new Error('Output must be outside user data')
 await fs.mkdir(destination,{recursive:true})
 const html=await fs.readFile(path.join(root,'public/studio.html'),'utf8')
 const scripts=await Promise.all(['translation-units.js','table-model.js','layout-model.js','history-model.js','studio.js'].map(name=>fs.readFile(path.join(root,'public',name),'utf8')))
 const report=[]
 for (const id of await fs.readdir(source)) {
  if (!/^[a-f0-9]{32}$/.test(id)) continue
  let analysis
  try {analysis=JSON.parse(await fs.readFile(path.join(source,id,'analysis.json'),'utf8'))} catch {continue}
  if (!analysis.pages?.every(page=>Array.isArray(page.segments))) continue
  const result={id,sourcePages:analysis.pages.length,model:analysis.model,status:'passed',scenarios:[]}
  let dom
  try {
   const scene=buildSceneFromAgent(analysis,{documentId:id});scene.workflowStage=3
   const original=scene.objects.map(object=>({id:object.id,sourceText:object.sourceText,type:object.type}))
   let saved=null,revision=0
   const errors=[],virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',error=>errors.push(error.message))
   dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:`http://localhost/?document=${id}`,virtualConsole})
   dom.window.CSS={escape:String};dom.window.Element.prototype.scrollIntoView=()=>{}
   dom.window.fetch=async(url,options={})=>({ok:true,json:async()=>{
    if(options.method==='PUT'){saved=JSON.parse(options.body);revision++;return {metadata:{id,revision}}}
    if(String(url).endsWith('/status'))return {translationProviderConfigured:false}
    if(String(url).endsWith('/knowledge-matches/refresh'))return {metadata:{id,revision},scene:saved||scene}
    if(String(url).endsWith(`/documents/${id}`))return {metadata:{id,revision},scene}
    return {}
   }})
   for(const script of scripts)dom.window.eval(script)
   const waitSave=async before=>{for(let n=0;n<140&&revision<=before;n++)await pause();assert.ok(revision>before,'save did not complete');assert.deepEqual(errors,[]);audit(saved)}
   await waitSave(0)
   for(const object of original){const current=saved.objects.find(item=>item.id===object.id);assert.ok(current,`lost ${object.id}`);assert.equal(current.sourceText,object.sourceText);assert.equal(current.type,object.type)}
   result.scenarios.push('load/save: all texts and types preserved; grid, bounds and no overlaps')
   const document=dom.window.document
   const cell=saved.objects.find(object=>object.type==='table_cell'&&!object.excluded)
   if(cell){
    const open=()=>{const node=[...document.querySelectorAll('.scene-object')].find(node=>node.dataset.id===cell.id);assert.ok(node);node.dispatchEvent(new dom.window.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:100,clientY:100}));assert.equal(document.querySelector('#table-context-menu').hidden,false)}
    const count=saved.objects.length;const columns=saved.objects.filter(item=>item.tableId===cell.tableId&&item.rowIndex===cell.rowIndex).length
    open();document.querySelector('#table-copy-row').click();open()
    let before=revision;document.querySelector('#table-paste-row-after').click();await waitSave(before)
    assert.equal(saved.objects.length,count+columns);result.scenarios.push('copy row and insert below; no overlaps')
    before=revision;document.querySelector('#undo-button').click();await waitSave(before);assert.equal(saved.objects.length,count)
    result.scenarios.push('undo restores cell count')
    open();before=revision;document.querySelector('#table-cut-row').click();await waitSave(before);assert.equal(saved.objects.length,count-columns)
    before=revision;document.querySelector('#undo-button').click();await waitSave(before);assert.equal(saved.objects.length,count)
    result.scenarios.push('cut row and undo; content restored')
   }
   result.objects=saved.objects.length;result.workPages=saved.pages.length;result.tables=saved.tables.length
   await fs.writeFile(path.join(destination,`${id}.scene.json`),JSON.stringify(saved,null,2))
  }catch(error){result.status='failed';result.error=error.message}
  finally{dom?.window.close()}
  report.push(result);console.log(JSON.stringify(result))
 }
 await fs.writeFile(path.join(destination,'report.json'),JSON.stringify(report,null,2))
 if(report.some(result=>result.status==='failed'))process.exitCode=1
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
