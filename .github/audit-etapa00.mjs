import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const [out,repo]=process.argv.slice(2);
const url='http://127.0.0.1:5173';
const fixture={schemaVersion:3,students:[],turmas:[{id:'audit-a',name:'Turma Fictícia A'},{id:'audit-b',name:'Turma Fictícia B'}],activities:[],activityRecords:[],termSettings:[],studentExtraPoints:[],evaluationComponents:[],componentScores:[]};
const date='2026-01-01T12:00:00.000Z';
for(let i=1;i<=41;i++)fixture.students.push({id:'s'+i,name:'Aluno Fictício '+String(i).padStart(2,'0'),turma:'Turma Fictícia A',createdAt:date});
for(const t of [1,2,3]){
 for(const [block,name,max,kind,order] of [['AEP','Atividades',10,'activities',0],['AEP','Feira',10,'manual',1],['AL','AL',20,'manual',0],['AV','AV',20,'manual',0],['AG','AG',20,'manual',0],['TESTE','Teste',20,'manual',0],['PE','Extra',null,'manual',0]]){
 const id='audit-'+t+'-'+name;fixture.evaluationComponents.push({id,turmaId:'audit-a',term:t,blockId:block,name,maxPoints:max,kind,order});if(kind==='manual')for(let i=1;i<=41;i++){if(i%7===0)continue;fixture.componentScores.push({studentId:'s'+i,componentId:id,score:i%5===0?0:Math.min(max??3,(i%10)+0.25+t/10)});}}
 for(let j=1;j<=5;j++){const id='act-'+t+'-'+j;const d='2026-'+String(t*3).padStart(2,'0')+'-'+String(j+1).padStart(2,'0');fixture.activities.push({id,turmaId:'audit-a',name:'Atividade fictícia '+j,date:d,deadline:d,term:t,createdAt:date});for(let i=1;i<=41;i++){const done=(i+j)%3!==0;fixture.activityRecords.push({id:'rec-'+t+'-'+j+'-'+i,studentId:'s'+i,activityId:id,done,...(done?{markedAt:(i+j)%2===0?d:'2026-12-01'}:{})});}}
}
fs.writeFileSync(path.join(out,'fixture.json'),JSON.stringify(fixture,null,2));
const inventory=[];function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,ent.name);if(ent.isDirectory())walk(f);else if(/\.(tsx?|css)$/.test(f)){const s=fs.readFileSync(f,'utf8');inventory.push({file:path.relative(repo,f),lines:s.split('\n').length,inlineLiteral:(s.match(/style=\{\{/g)||[]).length,inlineAttributes:(s.match(/\bstyle=\{/g)||[]).length,tokens:[...new Set([...s.matchAll(/--[\w-]+(?=\s*[:)])/g)].map(x=>x[0]))]});}}}walk(path.join(repo,'src'));fs.writeFileSync(path.join(out,'inventory.json'),JSON.stringify(inventory,null,2));
const browser=await chromium.launch();const results=[];
const flush=()=>fs.writeFileSync(path.join(out,'resultados.json'),JSON.stringify(results,null,2));
try{for(const [width,height] of [[1366,768],[1920,1080],[390,844]]){
const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,permissions:['clipboard-read','clipboard-write'],locale:'pt-BR'});
const p=await context.newPage();p.setDefaultTimeout(9000);const errors=[];
p.on('pageerror',e=>errors.push(e.message));
await p.route('**/*',route=>{const u=route.request().url();return u.startsWith(url+'/')||u.startsWith('https://fonts.googleapis.com/')||u.startsWith('https://fonts.gstatic.com/')?route.continue():route.abort()});
await p.addInitScript(data=>{if(!sessionStorage.getItem('audit-seeded')){localStorage.setItem('school_control_data',JSON.stringify(data));sessionStorage.setItem('audit-seeded','1')}},fixture);
const tag=width+'x'+height;const shot=async name=>p.screenshot({path:path.join(out,tag+'-'+name+'.png'),animations:'disabled'});
const run=async(name,fn)=>{try{const data=await fn();results.push({tag,name,status:'pass',data});}catch(e){results.push({tag,name,status:'fail',error:String(e)});try{await shot('erro-'+name)}catch{}}finally{flush();console.log(JSON.stringify(results.at(-1)));}};
const tab=async name=>p.getByRole('tab',{name,exact:true}).first().click();
const metrics=()=>p.evaluate(()=>({devicePixelRatio,zoomCSS:getComputedStyle(document.documentElement).zoom,visualViewportScale:visualViewport?.scale,viewport:[innerWidth,innerHeight],font:document.fonts.check('14px Inter'),scrollY,documentWidth:document.documentElement.scrollWidth,scrollContainers:[...document.querySelectorAll('*')].filter(e=>e.clientHeight>0&&(e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2)&&/auto|scroll/.test(getComputedStyle(e).overflow+getComputedStyle(e).overflowX+getComputedStyle(e).overflowY)).map(e=>({tag:e.tagName,top:e.scrollTop,left:e.scrollLeft,clientWidth:e.clientWidth,clientHeight:e.clientHeight,scrollWidth:e.scrollWidth,scrollHeight:e.scrollHeight})),visibleRows:[...document.querySelectorAll('table tbody tr')].filter(e=>{const r=e.getBoundingClientRect();let top=0,bottom=innerHeight;for(let a=e.parentElement;a;a=a.parentElement){if(/auto|scroll|hidden|clip/.test(getComputedStyle(a).overflowY)){const b=a.getBoundingClientRect();top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom)}}return r.height>0&&r.top>=top&&r.bottom<=bottom&&r.left<innerWidth&&r.right>0}).length}));
const storage=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('school_control_data')));
const inputs=()=>p.locator('input[data-spreadsheet-input]:visible');
await run('cadastro',async()=>{await p.goto(url);await p.getByRole('button',{name:'Turma Fictícia A',exact:true}).waitFor();await p.evaluate(()=>document.fonts.ready);await shot('cadastro');assert.equal((await storage()).students.length,41);return metrics()});
await run('geral',async()=>{await p.getByRole('button',{name:'Turma Fictícia A',exact:true}).click();await p.getByText('Resumo geral das notas',{exact:true}).waitFor();await shot('geral');assert.equal(await p.locator('table tbody tr:visible').count(),41);return metrics()});
await run('modal-aluno',async()=>{await p.getByRole('button',{name:'Adicionar aluno',exact:true}).click();await p.getByRole('dialog').waitFor();await shot('modal-aluno');await p.keyboard.press('Escape');assert.equal((await storage()).students.length,41)});
await run('modal-configuracao',async()=>{await p.getByRole('button',{name:'Configurar divisões'}).click();await p.getByRole('dialog').waitFor();await shot('modal-configuracao');await p.keyboard.press('Escape')});
await run('menu-aluno',async()=>{await p.getByRole('button',{name:/Ações de Aluno Fictício 01/}).click();await shot('menu-aluno');await p.keyboard.press('Escape')});
await run('atividade',async()=>{await tab('AEP');const cell=p.getByRole('button',{name:/Aluno Fictício 01: Atividade fictícia 1/});await cell.waitFor();await shot('atividades');const m=await metrics();await cell.scrollIntoViewIfNeeded();await cell.hover();await p.getByRole('tooltip').waitFor();await shot('tooltip-atividade');await p.mouse.move(0,0);return m});
await run('menu-atividade',async()=>{await p.getByRole('button',{name:'Opções da atividade Atividade fictícia 1'}).click();await shot('menu-atividade');await p.getByRole('menuitem',{name:'Renomear atividade'}).click();await p.getByRole('dialog').waitFor();await shot('modal-renomear');await p.keyboard.press('Escape')});
await run('notas',async()=>{await tab('AL');await inputs().first().waitFor();assert.equal(await inputs().count(),41);await shot('notas');return metrics()});
await run('pesquisa-scroll',async()=>{await inputs().nth(30).scrollIntoViewIfNeeded();const before=await metrics();await p.keyboard.press('Control+f');const search=p.getByRole('textbox',{name:'Pesquisar aluno'});await search.waitFor();await p.waitForTimeout(100);const after=await metrics();await search.fill('Aluno Ficticio 03');await shot('pesquisa');assert.equal(await inputs().count(),1);await p.keyboard.press('Escape');assert.equal(await inputs().count(),41);return {before,after,rowsAfterSearch:1,deltaY:after.scrollY-before.scrollY}});
await run('50-notas',async()=>{const times=[];for(const value of ['12.75','13.75','14.75']){let n=0;const start=performance.now();for(const block of ['AL','AV']){await tab(block);const count=block==='AL'?41:9;for(let i=0;i<count;i++){const el=inputs().nth(i);await el.fill(value);await el.press('Tab');n++}}const elapsedMs=performance.now()-start;const actual=(await storage()).componentScores.filter(s=>['audit-1-AL','audit-1-AV'].includes(s.componentId)&&s.score===Number(value)).length;assert.equal(actual,50);times.push({n,elapsedMs,persistedCount:actual})}return {times,medianMs:times.map(x=>x.elapsedMs).sort((a,b)=>a-b)[1],method:'Playwright fill + Tab, não digitação humana'}});
await run('clipboard',async()=>{await tab('AL');await inputs().first().click();await p.evaluate(()=>navigator.clipboard.writeText('0\n12,5\n\n19,25'));await p.keyboard.press('Control+v');await p.waitForTimeout(200);const data=await storage();const values=['s1','s2','s3','s4'].map(id=>data.componentScores.find(s=>s.studentId===id&&s.componentId==='audit-1-AL')?.score??null);assert.deepEqual(values,[0,12.5,null,19.25]);await shot('clipboard');await p.getByRole('button',{name:'Nota',exact:true}).click();await p.keyboard.press('Control+c');const copied=await p.evaluate(()=>navigator.clipboard.readText());assert.equal(copied.split(/\r?\n/).length,41);await shot('selecao-coluna');return {values,copied}});
await run('periodos-persistencia',async()=>{const select=p.getByLabel('Selecionar trimestre');await select.selectOption('2');await shot('trimestre-2');const s2=await inputs().first().inputValue();await select.selectOption('3');await shot('trimestre-3');const s3=await inputs().first().inputValue();assert.notEqual(s2,s3);await select.selectOption('1');await p.reload();await p.getByRole('button',{name:'Turma Fictícia A',exact:true}).click();await tab('AL');assert.equal(await inputs().first().inputValue(),'0');assert.equal(await inputs().nth(2).inputValue(),'');return {s2,s3,persisted:true}});
await run('ordenacao',async()=>{await p.getByRole('button',{name:'A → Z'}).click();assert.equal(await inputs().first().getAttribute('data-student-id'),'s41');await p.getByRole('button',{name:'Z → A'}).click();assert.equal(await inputs().first().getAttribute('data-student-id'),'s1')});
await run('exportacao',async()=>{const dl=p.waitForEvent('download');await p.getByRole('button',{name:'Exportar Excel'}).click();const file=await dl;await file.saveAs(path.join(out,tag+'-exportacao.xlsx'));return {filename:file.suggestedFilename()}});
await run('navegacao-cabecalho',async()=>{await p.evaluate(()=>window.scrollTo(0,0));const nav=p.getByRole('navigation',{name:'Cadastro e turmas'});await nav.waitFor();const header=p.locator('.app-header');const headerBox=await header.boundingBox();const desktop=width>=640;assert(headerBox.height>=(desktop?49:44));const active=nav.getByRole('button',{name:'Turma Fictícia A',exact:true});assert.equal(await active.getAttribute('aria-pressed'),'true');await nav.getByRole('button',{name:'Turma Fictícia B',exact:true}).click();assert.equal(await nav.getByRole('button',{name:'Turma Fictícia B',exact:true}).getAttribute('aria-pressed'),'true');await nav.getByRole('button',{name:'Turma Fictícia A',exact:true}).click();await tab('Geral');await p.keyboard.press('Control+f');const search=p.getByRole('textbox',{name:'Pesquisar aluno'});await search.waitFor();assert.equal(await search.locator('xpath=ancestor::*[contains(@class,"class-context")]').count(),1);await p.keyboard.press('Escape');await tab('AL');await inputs().nth(30).scrollIntoViewIfNeeded();const before=await metrics();await p.keyboard.press('Control+f');await search.waitFor();await p.waitForTimeout(150);assert.equal(await search.locator('xpath=ancestor::*[contains(@class,"gradebook-search-toolbar")]').count(),1);assert.equal(await search.evaluate(el=>el===document.activeElement),true);const box=await search.boundingBox();assert(box&&box.y>=0&&box.y+box.height<=height,'search outside viewport');const after=await metrics();await shot('pr02-pesquisa-aderente');await p.keyboard.press('Escape');const pageWidth=await p.evaluate(()=>document.documentElement.scrollWidth);return {headerHeight:headerBox.height,navHeight:(await nav.boundingBox()).height,viewport:width,pageWidth,deltaY:after.scrollY-before.scrollY,searchVisible:true};});
await run('pr03-modal-teclado',async()=>{
  await p.evaluate(()=>window.scrollTo(0,0));await p.getByRole('button',{name:'Adicionar aluno',exact:true}).first().click();
  const dialog=p.getByRole('dialog');await dialog.waitFor();await p.waitForTimeout(250);
  const box=await dialog.boundingBox();assert(box&&box.x>=-1&&box.y>=-1&&box.x+box.width<=width+1&&box.y+box.height<=height+1,'modal outside viewport');
  for(let i=0;i<6;i++){await p.keyboard.press('Tab');assert(await dialog.evaluate(el=>el.contains(document.activeElement)),'focus escaped dialog');}
  await shot('pr03-modal-teclado');await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});return {keyboardTrap:true,escape:true,box};
});
await run('pr03-tooltip-estados',async()=>{
  await tab('AEP');const buttons=p.getByRole('button',{name:/Aluno Fictício 0[1-9]: Atividade fictícia 1/});
  let states=[];for(const label of ['No prazo','Atrasada','Pendente']){
    const target=buttons.filter({hasNotText:'__never__'});const count=await target.count();
    let chosen=null;for(let i=0;i<count;i++){const b=target.nth(i);if((await b.getAttribute('aria-label')||'').toLowerCase().includes(label.toLowerCase())){chosen=b;break;}}
    if(!chosen){states.push({label,available:false});continue;}
    await chosen.scrollIntoViewIfNeeded();await chosen.hover();await p.getByRole('tooltip').waitFor();await p.waitForTimeout(220);
    const pop=p.locator('[data-radix-popper-content-wrapper]:visible').last();const box=await pop.boundingBox();assert(box&&box.x>=-2&&box.y>=-2&&box.x+box.width<=width+2&&box.y+box.height<=height+2,'tooltip outside viewport');
    await shot('pr03-tooltip-'+label.replaceAll(' ','-'));states.push({label,available:true,box});await p.mouse.move(0,0);await p.waitForTimeout(200);
  }assert(states.some(x=>x.available),'no fixture status available');return states;
});
await run('pr03-transferencia',async()=>{
  await p.getByRole('navigation',{name:'Cadastro e turmas'}).getByRole('button',{name:'Cadastro',exact:true}).click();
  const before=await storage();const student=before.students.find(x=>x.id==='s1');assert(student);
  await p.getByRole('button',{name:'Ações de Aluno Fictício 01',exact:true}).click();
  await p.getByRole('menuitem',{name:'Transferir para outra turma'}).click();
  const dialog=p.getByRole('dialog');await dialog.waitFor();await dialog.locator('select').selectOption('audit-b');await shot('pr03-transferencia');
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await dialog.waitFor({state:'hidden'});
  assert.equal((await storage()).students.find(x=>x.id==='s1').turma,student.turma);
  await p.getByRole('button',{name:'Ações de Aluno Fictício 01',exact:true}).click();await p.getByRole('menuitem',{name:'Transferir para outra turma'}).click();await dialog.waitFor();await dialog.locator('select').selectOption('audit-b');await dialog.getByRole('button',{name:'Transferir',exact:true}).click();await dialog.waitFor({state:'hidden'});
  const after=await storage();assert.equal(after.students.find(x=>x.id==='s1').turma,'Turma Fictícia B');assert.equal(after.students.length,before.students.length);assert.deepEqual(after.activityRecords,before.activityRecords);return {cancelPreserved:true,transferPreservedHistory:true,studentCount:after.students.length};
});
await run('pr03-csv',async()=>{
  await p.getByRole('button',{name:'Importar CSV',exact:true}).click();const dialog=p.getByRole('dialog');await dialog.waitFor();await p.waitForTimeout(250);await shot('pr03-csv-inicial');
  const before=await storage();const file=dialog.locator('input[type=file]');await file.setInputFiles({name:'fixture-audit.csv',mimeType:'text/csv',buffer:Buffer.from('nome,turma\\nAluno CSV Fictício,Turma Fictícia A\\n,Turma Fictícia A\\n','utf8')});
  await dialog.getByText('Nome em branco',{exact:false}).first().waitFor();await shot('pr03-csv-validacao');
  await dialog.getByRole('button',{name:/^Importar 1 aluno$/}).click();await dialog.getByText(/1 aluno importado com sucesso/).waitFor();
  const after=await storage();assert.equal(after.students.length,before.students.length+1);assert.equal(after.students.filter(x=>x.name==='Aluno CSV Fictício').length,1);assert.equal(after.turmas.length,before.turmas.length);await shot('pr03-csv-sucesso');
  await dialog.getByRole('button',{name:'Concluir',exact:true}).click();await dialog.waitFor({state:'hidden'});await p.getByRole('button',{name:'Importar CSV',exact:true}).click();await dialog.waitFor();await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});return {validImported:1,invalidIgnored:1,existingClassReused:true,escape:true};
});
results.push({tag,name:'pageerrors',status:errors.length?'fail':'pass',errors});flush();await context.close();
}}finally{await browser.close();flush()}
if(results.some(r=>r.status==='fail'))process.exitCode=1;
