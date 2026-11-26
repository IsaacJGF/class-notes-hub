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
const assertOverviewWidth=async(label)=>{
 const m=await p.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth}));
 assert(m.documentWidth<=width+1&&m.bodyWidth<=width+1,label+' / page overflow '+JSON.stringify(m));return m;
};
await run('pr06-geral-totais',async()=>{
 const period=p.getByLabel('Selecionar trimestre');const before=await storage();
 const region=p.getByRole('region',{name:'Planilha geral de notas'});const fmt=n=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
 const round=n=>Math.round((n+Number.EPSILON)*100)/100;
 const students=fixture.students.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'}));const blocks=['AEP','AL','AV','AG','TESTE','PE'];const summaries=[];
 for(const term of [1,2,3]){
  await period.selectOption(String(term));await region.locator('[data-spreadsheet-grid="overview-audit-a-'+term+'"]').first().waitFor();
  const rows=await region.locator('tbody tr').evaluateAll(rs=>rs.map(r=>[...r.querySelectorAll('[data-spreadsheet-cell]')].map(c=>{const clone=c.cloneNode(true);clone.querySelectorAll('svg,.sr-only,button').forEach(n=>n.remove());return {value:c.getAttribute('data-spreadsheet-value'),visual:clone.textContent.trim(),low:c.getAttribute('data-overview-below')==='true'};})));
  const components=fixture.evaluationComponents.filter(x=>x.turmaId==='audit-a'&&x.term===term);const activities=fixture.activities.filter(x=>x.turmaId==='audit-a'&&x.term===term);
  assert.equal(rows.length,41);let verified=0,low=0;
  for(let i=0;i<students.length;i++){
   const student=students[i],expected=Object.fromEntries(blocks.map(b=>[b,0]));
   for(const comp of components){
    let value=0;
    if(comp.kind==='activities'){let weighted=0;for(const a of activities){const r=fixture.activityRecords.find(x=>x.studentId===student.id&&x.activityId===a.id);if(r?.done)weighted+=a.deadline&&r.markedAt&&!r.overrideOnTime&&r.markedAt>a.deadline?0.7:1;}value=activities.length?round(comp.maxPoints*weighted/activities.length):0;}
    else value=fixture.componentScores.find(x=>x.studentId===student.id&&x.componentId===comp.id)?.score??0;
    expected[comp.blockId]+=value;
   }
   const total=round(blocks.reduce((sum,b)=>sum+expected[b],0));
   assert.equal(rows[i][0].value,student.name);assert.equal(rows[i].length,8);
   for(let j=0;j<7;j++){const n=j===6?total:expected[blocks[j]],isLow=j===6?n<70:blocks[j]!=='PE'&&n<14;const actual=rows[i][j+1];
    assert.equal(actual.value,fmt(n),student.name+' / term '+term+' / column '+j);assert.equal(actual.visual,fmt(n));assert.equal(actual.low,isLow);verified++;if(isLow)low++;
   }
  }
  await p.evaluate(()=>window.scrollTo(0,0));await region.evaluate(e=>{e.scrollTop=0;e.scrollLeft=0;});await shot('pr06-geral-trimestre-'+term);await assertOverviewWidth('Geral trimestre '+term);
  summaries.push({term,students:rows.length,verifiedValues:verified,belowAverageCells:low,metrics:await metrics()});
 }
 await period.selectOption('1');await region.locator('[data-spreadsheet-grid="overview-audit-a-1"]').first().waitFor();assert.deepEqual(await storage(),before,'Geral must not modify records');return {summaries,unchanged:true};
});
await run('pr06-geral-copia-busca',async()=>{
 const region=p.getByRole('region',{name:'Planilha geral de notas'});const before=await storage();
 const cells=region.locator('td[data-overview-column="final"]');const expected=await cells.evaluateAll(xs=>xs.map(x=>x.getAttribute('data-spreadsheet-value')));assert.equal(expected.length,41);
 await region.getByRole('button',{name:'Nota final',exact:true}).click();assert.equal(await region.locator('td[data-spreadsheet-selected=true]').count(),41);
 await p.evaluate(()=>navigator.clipboard.writeText('__PR06_SENTINEL__'));await p.keyboard.press('Control+c');await p.waitForFunction(async()=>await navigator.clipboard.readText()!=='__PR06_SENTINEL__',null,{timeout:2500});
 const copied=(await p.evaluate(()=>navigator.clipboard.readText())).split(String.fromCharCode(10)).map(x=>x.replace(String.fromCharCode(13),''));
 assert.deepEqual(copied,expected);await shot('pr06-geral-copia');await assertOverviewWidth('Geral selecionada');
 await p.keyboard.press('Control+f');const search=p.getByRole('textbox',{name:'Pesquisar aluno',exact:true});await search.waitFor();assert.equal(await search.locator('xpath=ancestor::*[contains(@class,"class-context")]').count(),1);
 await search.fill('Aluno Ficticio 03');assert.equal(await cells.count(),1);await shot('pr06-geral-filtrada');await assertOverviewWidth('Geral filtrada');await search.fill('nome inexistente 123');await region.getByText('Nenhum aluno encontrado.',{exact:true}).waitFor();await shot('pr06-geral-vazia');await assertOverviewWidth('Geral vazia');await p.keyboard.press('Escape');assert.equal(await cells.count(),41);
 assert.deepEqual(await storage(),before);return {copiedValues:copied.length,accentSearch:true,emptyState:true,unchanged:true};
});
await run('pr06-rolagem-horizontal',async()=>{
 const region=p.getByRole('region',{name:'Planilha geral de notas'});await p.evaluate(()=>window.scrollTo(0,0));await region.evaluate(e=>{e.scrollLeft=0;e.scrollTop=0;});
 const initial=await assertOverviewWidth('Geral antes da rolagem');
 const scroll=await region.evaluate(e=>{const name=e.querySelector('th:first-child');const before=name.getBoundingClientRect().left;e.scrollLeft=e.scrollWidth;const h=e.querySelector('th[data-overview-column="final"]').getBoundingClientRect(),b=e.getBoundingClientRect();return {left:e.scrollLeft,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,finalVisible:h.left>=b.left-1&&h.right<=b.right+1,nameDelta:name.getBoundingClientRect().left-before};});
 if(width===390)assert(scroll.left>0,'missing internal horizontal scroll');assert(scroll.finalVisible,'final column not reachable '+JSON.stringify(scroll));assert(Math.abs(scroll.nameDelta)<=2,'student column not sticky');await assertOverviewWidth('Geral apos rolagem');await shot('pr06-rolagem-final');await region.evaluate(e=>e.scrollLeft=0);return {initial,scroll};
});
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
await run('pr04-densidade-rolagem',async()=>{
 await tab('AL');await p.evaluate(()=>window.scrollTo(0,0));const region=p.getByRole('region',{name:'Planilha de AL',exact:true});await region.waitFor();await region.evaluate(e=>{e.scrollTop=0;e.scrollLeft=0});await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(100);
 const initial=await region.evaluate(e=>{const r=e.getBoundingClientRect(),head=e.querySelector('thead').getBoundingClientRect(),rows=[...e.querySelectorAll('tbody tr')];return {rows:rows.length,visibleRows:rows.filter(x=>{const b=x.getBoundingClientRect();return b.top>=Math.max(0,r.top,head.bottom)-1&&b.bottom<=Math.min(innerHeight,r.bottom)+1}).length,rowHeight:rows[0].getBoundingClientRect().height,inputHeight:e.querySelector('input').getBoundingClientRect().height,regionHeight:r.height,top:r.top,pageWidth:document.documentElement.scrollWidth,headerPosition:getComputedStyle(e.querySelector('th')).position,namePosition:getComputedStyle(e.querySelector('td')).position}});
 await shot('pr04-densidade');assert.equal(initial.rows,41);assert.equal(initial.headerPosition,'sticky');assert.equal(initial.namePosition,'sticky');assert(initial.pageWidth<=width+1,'page overflow '+JSON.stringify(initial));if(width===1366)assert(initial.visibleRows>=8,'minimum 8 visible rows: '+JSON.stringify(initial));
 await region.evaluate(e=>e.scrollTop=600);await p.waitForTimeout(100);const before=await region.evaluate(e=>({scrollTop:e.scrollTop,scrollY,headerTop:e.querySelector('th').getBoundingClientRect().top,regionTop:e.getBoundingClientRect().top}));assert(before.scrollTop>0);assert(Math.abs(before.headerTop-before.regionTop)<=2,'header not sticky');
 await p.keyboard.press('Control+f');const search=p.getByRole('textbox',{name:'Pesquisar aluno'});await search.waitFor();await p.waitForTimeout(180);const after=await region.evaluate(e=>({scrollTop:e.scrollTop,scrollY}));assert(Math.abs(after.scrollTop-before.scrollTop)<=2,'internal scroll jump');assert(Math.abs(after.scrollY-before.scrollY)<=5,'page scroll jump');await shot('pr04-scroll-pesquisa');await p.keyboard.press('Escape');return {initial,before,after};
});
await run('pr04-matriz-selecao',async()=>{
 await tab('AEP');const details=p.locator('details').filter({has:p.locator('summary').getByText('Planilha completa — AEP',{exact:true})});await details.locator('summary').click();
 const region=p.getByRole('region',{name:'Planilha completa de AEP'});await region.waitFor();
 const cell=(r,c)=>region.locator('[data-spreadsheet-row="'+r+'"][data-spreadsheet-column="'+c+'"]');
 const start=cell(0,1),end=cell(2,2);await start.scrollIntoViewIfNeeded();await start.click();await end.locator('input').click({modifiers:['Shift']});
 assert.equal(await region.locator('[data-spreadsheet-selected=true]').count(),6);
 const expected=[];for(let r=0;r<3;r++){let row=[];for(let c=1;c<=2;c++)row.push(await cell(r,c).getAttribute('data-spreadsheet-value'));expected.push(row);}
 const copy=async()=>{await p.evaluate(()=>navigator.clipboard.writeText('__AUDIT_SENTINEL__'));await p.keyboard.press('Control+c');await p.waitForFunction(async()=>await navigator.clipboard.readText()!=='__AUDIT_SENTINEL__',null,{timeout:2500});return (await p.evaluate(()=>navigator.clipboard.readText())).split(/\r?\n/).map(x=>x.split('\t'));};
 const focused=await p.evaluate(()=>({tag:document.activeElement?.tagName,grid:document.activeElement?.closest('[data-spreadsheet-cell]')?.getAttribute('data-spreadsheet-grid'),native:window.getSelection()?.toString()}));
 assert(focused.grid,'selection focus not in spreadsheet '+JSON.stringify(focused));assert.equal(focused.native,'');
 const copiedRows=await copy();assert.deepEqual(copiedRows,expected,'clipboard range contents');await shot('pr04-selecao-retangular');
 const before=await storage();const calcBefore=await cell(0,1).getAttribute('data-spreadsheet-value');
 const matrix=[['99','3,25'],['99','0'],['99','']].map(r=>r.join(String.fromCharCode(9))).join(String.fromCharCode(10));
 await p.evaluate(v=>navigator.clipboard.writeText(v),matrix);await p.keyboard.press('Control+v');await p.waitForTimeout(250);
 const after=await storage();const values=['s1','s2','s3'].map(id=>after.componentScores.find(x=>x.studentId===id&&x.componentId==='audit-1-Feira')?.score??null);
 assert.deepEqual(values,[3.25,0,null]);assert.equal(await cell(0,1).getAttribute('data-spreadsheet-value'),calcBefore);assert.deepEqual(after.activityRecords,before.activityRecords);
 await shot('pr04-matriz-colada');
 await start.scrollIntoViewIfNeeded();await end.scrollIntoViewIfNeeded();const first=await start.boundingBox(),last=await end.boundingBox();assert(first&&last);await p.mouse.move(first.x+first.width/2,first.y+first.height/2);await p.mouse.down();try{await p.mouse.move(last.x+last.width/2,last.y+last.height/2,{steps:12});}finally{await p.mouse.up();}
 assert.equal(await region.locator('[data-spreadsheet-selected=true]').count(),6,'drag range');const dragged=await copy();const expectedAfter=[];for(let r=0;r<3;r++){let row=[];for(let c=1;c<=2;c++)row.push(await cell(r,c).getAttribute('data-spreadsheet-value'));expectedAfter.push(row);}assert.deepEqual(dragged,expectedAfter,'drag clipboard contents');
 await shot('pr04-arraste');await details.locator('summary').click();return {selected:6,copiedRows,values,calculatedUnchanged:true,dragged};
});
await run('pr03-modal-teclado',async()=>{
  await p.evaluate(()=>window.scrollTo(0,0));await p.getByRole('button',{name:'Adicionar aluno',exact:true}).first().click();
  const dialog=p.getByRole('dialog');await dialog.waitFor();await p.waitForTimeout(250);
  const box=await dialog.boundingBox();assert(box&&box.x>=-1&&box.y>=-1&&box.x+box.width<=width+1&&box.y+box.height<=height+1,'modal outside viewport');
  for(let i=0;i<6;i++){await p.keyboard.press('Tab');assert(await dialog.evaluate(el=>el.contains(document.activeElement)),'focus escaped dialog');}
  await shot('pr03-modal-teclado');await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});return {keyboardTrap:true,escape:true,box};
});
await run('pr03-tooltip-estados',async()=>{
  await tab('AEP');const states=[];
  // Accessible label "Atrasado (70%)" differs from visual chip "Atrasada".
  for(const [label,accessible] of [['No prazo',/No prazo/i],['Atrasada',/Atrasad[oa]/i],['Pendente',/Pendente/i]]){
    const buttons=p.getByRole('button',{name:/Aluno Fictício 0[1-9]: Atividade fictícia 1/});
    const count=await buttons.count();let chosen=null;
    for(let i=0;i<count;i++){const b=buttons.nth(i);if(accessible.test(await b.getAttribute('aria-label')||'')){chosen=b;break;}}
    assert(chosen,'estado ausente na fixture: '+label);
    const tip=p.locator('[data-school-tooltip][data-state="delayed-open"],[data-school-tooltip][data-state="instant-open"]').filter({hasText:label});
    const phase=async(name,fn)=>{try{return await fn()}catch(e){const diag=await p.evaluate(()=>({active:document.activeElement?.outerHTML?.slice(0,700),tips:[...document.querySelectorAll('[data-school-tooltip]')].map(x=>({state:x.getAttribute('data-state'),text:x.textContent,rect:x.getBoundingClientRect().toJSON()})),scrollY}));throw Error(label+' / '+name+': '+String(e)+' / '+JSON.stringify(diag));}};
    const show=async(mode)=>phase(mode,async()=>{await tip.waitFor({state:'visible'});await p.waitForTimeout(180);const box=await tip.boundingBox();assert(box&&box.x>=-2&&box.y>=-2&&box.x+box.width<=width+2&&box.y+box.height<=height+2,'tooltip outside viewport '+JSON.stringify(box));return box;});
    await p.keyboard.press('Escape');await p.mouse.move(0,0);
    await chosen.evaluate(el=>el.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));await p.waitForTimeout(250);
    await chosen.hover();const box=await show('hover');await shot('pr03-tooltip-'+label.replaceAll(' ','-'));
    await p.keyboard.press('Escape');await p.mouse.move(0,0);await tip.waitFor({state:'hidden'});
    // A real focus transition on an already visible cell, without browser-induced
    // scroll (Radix closes tooltip on scroll). Do not synthesize focus events.
    await chosen.evaluate(el=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();el.blur();});
    await p.waitForTimeout(250);
    await chosen.evaluate(el=>el.focus({preventScroll:true}));
    assert(await chosen.evaluate(el=>el===document.activeElement),'focus not on activity cell');
    const keyboardBox=await show('keyboard focus');await shot('pr03-tooltip-foco-'+label.replaceAll(' ','-'));
    await p.keyboard.press('Escape');await tip.waitFor({state:'hidden'});await chosen.evaluate(el=>el.blur());
    states.push({label,hover:true,keyboardFocus:true,escape:true,box,keyboardBox});
    console.log('TOOLTIP_OK '+tag+' '+label);
  }
  assert.equal(states.length,3);return states;
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
  const before=await storage();const file=dialog.locator('input[type=file]');const csv=['nome,turma','Aluno CSV Fictício,Turma Fictícia A',',Turma Fictícia A',''].join(String.fromCharCode(10));assert.equal(csv.split(String.fromCharCode(10)).length,4);await file.setInputFiles({name:'fixture-audit.csv',mimeType:'text/csv',buffer:Buffer.from(csv,'utf8')});
  await dialog.getByText('Nome em branco',{exact:false}).first().waitFor();await shot('pr03-csv-validacao');
  await dialog.getByRole('button',{name:/^Importar 1 aluno$/}).click();await dialog.getByText(/1 aluno importado com sucesso/).waitFor();
  const after=await storage();assert.equal(after.students.length,before.students.length+1);assert.equal(after.students.filter(x=>x.name==='Aluno CSV Fictício').length,1);assert.equal(after.turmas.length,before.turmas.length);await shot('pr03-csv-sucesso');
  await dialog.getByRole('button',{name:'Concluir',exact:true}).click();await dialog.waitFor({state:'hidden'});await p.getByRole('button',{name:'Importar CSV',exact:true}).click();await dialog.waitFor();await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});return {validImported:1,invalidIgnored:1,existingClassReused:true,escape:true};
});
await run('pr05-cadastro-filtros',async()=>{
 await p.getByRole('navigation',{name:'Cadastro e turmas'}).getByRole('button',{name:'Cadastro',exact:true}).click();
 await p.evaluate(()=>window.scrollTo(0,0));await shot('pr05-cadastro');
 const before=await storage();
 const turmaForm=p.getByRole('form',{name:'Cadastrar turma',exact:true});const turmaName=turmaForm.getByRole('textbox',{name:'Nome da turma'});
 await turmaName.fill('Turma Fictícia A');await turmaForm.getByRole('button',{name:'Adicionar',exact:true}).click();await p.getByText('Turma já existe.',{exact:true}).waitFor();assert.equal(await turmaName.getAttribute('aria-invalid'),'true');assert.equal((await storage()).turmas.length,before.turmas.length);await shot('pr05-turma-duplicada');
 await turmaName.fill('Turma Auditoria C');await turmaForm.getByRole('button',{name:'Adicionar',exact:true}).click();await p.getByRole('navigation',{name:'Cadastro e turmas'}).getByRole('button',{name:'Turma Auditoria C',exact:true}).waitFor();
 const newClass=(await storage()).turmas.find(x=>x.name==='Turma Auditoria C');assert(newClass);
 const alunoForm=p.getByRole('form',{name:'Cadastrar aluno',exact:true});const add=alunoForm.getByRole('button',{name:'Adicionar',exact:true});assert(await add.isDisabled());await alunoForm.getByRole('textbox',{name:'Nome do aluno'}).fill('Aluno Auditoria Áureo');await alunoForm.getByLabel('Turma do aluno').selectOption(newClass.id);assert(await add.isEnabled());await add.click();await p.getByText('Aluno Auditoria Áureo',{exact:true}).waitFor();
 const after=await storage();assert.equal(after.students.length,before.students.length+1);assert.equal(after.turmas.length,before.turmas.length+1);assert.equal(after.students.find(x=>x.name==='Aluno Auditoria Áureo').turma,newClass.name);
 const filter=p.getByLabel('Filtrar alunos por turma');await filter.selectOption(newClass.name);assert.equal(await p.locator('.registration-table tbody tr').count(),2);
 const search=p.getByRole('searchbox',{name:'Pesquisar aluno por nome'});await search.fill('aureo');assert.equal(await p.locator('.registration-table tbody tr').count(),2);await shot('pr05-filtro');
 await search.fill('nome inexistente 123');await p.getByText('Nenhum aluno encontrado com esses filtros.',{exact:true}).waitFor();await shot('pr05-cadastro-vazio');await p.keyboard.press('Escape');assert.equal(await search.inputValue(),'');await filter.selectOption('all');
 assert((await p.evaluate(()=>document.documentElement.scrollWidth))<=width+1,'cadastro overflow');return {duplicateRejected:true,classCreated:true,studentCreated:true,accentSearch:true,emptyState:true};
});
await run('pr05-atividades-prazos',async()=>{
 const nav=p.getByRole('navigation',{name:'Cadastro e turmas'});await nav.getByRole('button',{name:'Turma Auditoria C',exact:true}).click();await tab('AEP');
 await p.getByText('Ainda não há atividades neste trimestre.',{exact:true}).waitFor();await shot('pr05-atividades-vazio');
 const form=p.getByRole('form',{name:'Cadastrar atividade'});const name=form.getByRole('textbox',{name:'Nome da atividade'});const date=form.getByLabel('Data da atividade',{exact:true});const deadline=form.getByRole('combobox',{name:'Prazo',exact:true});const add=form.getByRole('button',{name:'Adicionar atividade'});
 const before=await storage();const cls=before.turmas.find(x=>x.name==='Turma Auditoria C');const student=before.students.find(x=>x.name==='Aluno Auditoria Áureo');assert(cls&&student);
 assert(await add.isDisabled());await p.evaluate(()=>window.scrollTo(0,0));const box=await form.boundingBox();await shot('pr05-formulario-padrao');const results=[];
 for(const [mode,title,expected] of [['none','Auditoria sem prazo',null],['date','Auditoria data específica','2026-11-28'],['days','Auditoria prazo em dias','2026-11-30']]){
   await name.fill(title);await date.fill('2026-11-25');await deadline.selectOption(mode);
   if(mode==='date'){assert(await add.isDisabled());await form.getByLabel('Data limite',{exact:true}).fill(expected);}
   if(mode==='days'){await form.getByRole('spinbutton',{name:'Dias após a atividade',exact:true}).fill('5');}
   if(expected){await form.getByText('Vence em '+expected.split('-').reverse().join('/'),{exact:true}).waitFor();}
   assert(await add.isEnabled());await shot('pr05-formulario-'+mode);await add.click();await p.waitForFunction(({id,title})=>JSON.parse(localStorage.getItem('school_control_data')).activities.some(x=>x.turmaId===id&&x.name===title),{id:cls.id,title});
   const state=await storage();const activity=state.activities.find(x=>x.turmaId===cls.id&&x.name===title);assert.equal(activity.deadline??null,expected);assert.equal(activity.date,'2026-11-25');assert.equal(activity.term,1);assert(state.activityRecords.some(r=>r.studentId===student.id&&r.activityId===activity.id&&!r.done));results.push({mode,deadline:activity.deadline??null});
 }
 assert.equal((await storage()).activities.length,before.activities.length+3);assert((await p.evaluate(()=>document.documentElement.scrollWidth))<=width+1,'atividade overflow');await shot('pr05-atividades-criadas');return {formHeight:box.height,results,pendingRecords:true};
});
await run('pr05-alertas',async()=>{
 const nav=p.getByRole('navigation',{name:'Cadastro e turmas'});await nav.getByRole('button',{name:'Turma Fictícia A',exact:true}).click();await tab('AEP');
 const alert=p.locator('.activity-alerts');await alert.waitFor({state:'visible'});
 const original=await p.evaluate(()=>localStorage.getItem('alert_activity_threshold'));assert.equal(original,'50');
 await alert.locator('summary').click();const input=alert.getByRole('spinbutton',{name:'Limite de aproveitamento (%)',exact:true});assert.equal(await input.inputValue(),'50');assert(await alert.locator('span.rounded-cell').count()>0);await shot('pr05-alerta-expandido');
 await input.fill('100');await p.waitForFunction(()=>localStorage.getItem('alert_activity_threshold')==='100');assert.equal(await input.inputValue(),'100');assert(await alert.getByText('Limite atual: 100%',{exact:true}).isVisible());await shot('pr05-alerta-limite');
 await input.fill('50');await p.waitForFunction(()=>localStorage.getItem('alert_activity_threshold')==='50');await alert.locator('summary').click();assert.equal(await alert.getAttribute('open'),null);return {expanded:true,thresholdPreserved:true,thresholdChangePersisted:true,independentFixture:true};
});
await run('pr06-historico-geral',async()=>{
 const before=await storage();const student=before.students.find(x=>x.id==='s1');assert.equal(student.turma,'Turma Fictícia B');
 const nav=p.getByRole('navigation',{name:'Cadastro e turmas'});await nav.getByRole('button',{name:'Turma Fictícia B',exact:true}).click();await tab('Geral');
 const region=p.getByRole('region',{name:'Planilha geral de notas'});const open=region.getByRole('button',{name:'Ver histórico de atividades de Aluno Fictício 01',exact:true});await open.click();
 const history=region.getByText('Histórico de atividades de Aluno Fictício 01',{exact:true});await history.waitFor();
 const expected=before.activityRecords.filter(r=>r.studentId==='s1'&&before.activities.some(a=>a.id===r.activityId&&a.turmaId!=='audit-b'));assert.equal(expected.length,15);
 const panel=history.locator('xpath=../..');const sections=panel.locator('section');assert.equal(await sections.count(),3);assert.equal(await panel.getByText(/^(Não entregue|Feita com atraso|No prazo)$/).count(),15);
 await shot('pr06-historico');await assertOverviewWidth('Historico aberto');await region.getByRole('button',{name:'Ocultar histórico de atividades de Aluno Fictício 01',exact:true}).click();await history.waitFor({state:'hidden'});
 assert.deepEqual(await storage(),before);return {records:expected.length,terms:3,unchanged:true};
});
const openPr07Home=async()=>{await p.goto(url+'/#/');await p.getByRole('navigation',{name:'Cadastro e turmas'}).waitFor();await p.evaluate(()=>window.scrollTo(0,0));};
let pr07Phase='';
const runPr07=async(name,fn)=>run(name,async()=>{pr07Phase='initialization';try{return await fn();}catch(e){const diag=await p.evaluate(()=>({url:location.href,active:document.activeElement?.outerHTML?.slice(0,500),main:!!document.querySelector('#main-content'),dialog:!!document.querySelector('[role=dialog]'),width:document.documentElement.scrollWidth}));throw Error(pr07Phase+' / '+String(e)+' / '+JSON.stringify(diag));}});
await runPr07('pr07-teclado-foco',async()=>{
 const before=await storage();await openPr07Home();assert.equal(await p.locator('html').getAttribute('lang'),'pt-BR');pr07Phase='skip link';const initialUrl=p.url();
 const skip=p.getByRole('link',{name:'Ir para o conteúdo principal'});await p.keyboard.press('Tab');assert(await skip.evaluate(e=>e===document.activeElement));await p.keyboard.press('Enter');await p.waitForFunction(()=>document.activeElement?.id==='main-content');assert.equal(p.url(),initialUrl,'Skip link must preserve route');await shot('pr07-salto-conteudo');pr07Phase='navigation and tabs';
 const nav=p.getByRole('navigation',{name:'Cadastro e turmas'});const turma=nav.getByRole('button',{name:'Turma Fictícia A',exact:true});await turma.focus();await p.keyboard.press('Enter');assert.equal(await turma.getAttribute('aria-pressed'),'true');
 const geral=p.getByRole('tab',{name:'Geral',exact:true});await geral.focus();await p.keyboard.press('ArrowRight');assert.equal(await p.getByRole('tab',{name:'AEP',exact:true}).getAttribute('aria-selected'),'true');await p.keyboard.press('ArrowRight');assert.equal(await p.getByRole('tab',{name:'AL',exact:true}).getAttribute('aria-selected'),'true');
 pr07Phase='grade focus and Tab';const region=p.getByRole('region',{name:'Planilha de AL',exact:true});await region.waitFor();const grades=region.locator('input[data-spreadsheet-input]');await grades.first().focus();const outline=await grades.first().evaluate(e=>({width:getComputedStyle(e).outlineWidth,style:getComputedStyle(e).outlineStyle}));assert.equal(outline.style,'solid');assert(parseFloat(outline.width)>=2);await shot('pr07-foco-nota');await p.keyboard.press('Tab');assert(await grades.nth(1).evaluate(e=>e===document.activeElement),'Tab must advance to next grade');
 pr07Phase='search focus return';await p.keyboard.press('Control+f');const search=p.getByRole('textbox',{name:'Pesquisar aluno',exact:true});await search.waitFor();await p.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Pesquisar aluno');await search.fill('Aluno Ficticio');await p.getByRole('status').filter({hasText:/[0-9]+\/[0-9]+/}).waitFor();await p.keyboard.press('Escape');await p.waitForFunction(()=>document.activeElement?.getAttribute('title')==='Pesquisar (Ctrl+F)');await shot('pr07-foco-pesquisa');
 pr07Phase='add modal return';const add=p.getByRole('button',{name:'Adicionar aluno',exact:true}).first();await add.focus();await p.keyboard.press('Enter');const dialog=p.getByRole('dialog');await dialog.waitFor();await p.keyboard.press('Tab');assert(await dialog.evaluate(e=>e.contains(document.activeElement)));await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await p.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Adicionar aluno');
 pr07Phase='config modal return';const config=p.getByRole('button',{name:'Configurar divisões',exact:true});await config.focus();await p.keyboard.press('Enter');await dialog.waitFor();await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await p.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Configurar divisões');assert.deepEqual(await storage(),before);return {skipLink:true,arrowTabs:true,gradeTab:true,searchReturn:true,addModalReturn:true,configModalReturn:true,outline};
});
await runPr07('pr07-movimento-contraste',async()=>{
 const before=await storage();await openPr07Home();await p.getByRole('navigation',{name:'Cadastro e turmas'}).getByRole('button',{name:'Turma Fictícia A',exact:true}).click();await p.emulateMedia({reducedMotion:'reduce'});
 try{
  assert(await p.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches));
  const add=p.getByRole('button',{name:'Adicionar aluno',exact:true}).first();await add.click();const dialog=p.getByRole('dialog');await dialog.waitFor();
  pr07Phase='reduced motion';const durations=await dialog.evaluate(e=>({animation:getComputedStyle(e).animationDuration,transition:getComputedStyle(e).transitionDuration}));
  assert(durations.animation.split(',').every(x=>parseFloat(x)<=.001));assert(durations.transition.split(',').every(x=>parseFloat(x)===0));await shot('pr07-movimento-reduzido');
  pr07Phase='contrast enabled action';await dialog.getByRole('textbox',{name:'Nome do novo aluno'}).fill('Aluno fictício contraste');assert(await dialog.getByRole('button',{name:'Adicionar aluno',exact:true}).isEnabled());const contrast=await dialog.evaluate(e=>{
   const primary=e.querySelector('button[type=submit]');const ctx=document.createElement('canvas').getContext('2d');
   const rgb=value=>{ctx.fillStyle=value;const v=ctx.fillStyle;if(v.startsWith('#'))return v.slice(1).match(/../g).map(x=>parseInt(x,16));return v.match(/[0-9.]+/g).slice(0,3).map(Number);};
   const lum=value=>rgb(value).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((a,b,i)=>a+b*[.2126,.7152,.0722][i],0);
   const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
   const bg=getComputedStyle(e).backgroundColor;const title=e.querySelector('h2');const input=e.querySelector('input');return {title:ratio(getComputedStyle(title).color,bg),body:ratio(getComputedStyle(e.querySelector('p')).color,bg),action:ratio(getComputedStyle(primary).color,getComputedStyle(primary).backgroundColor),field:ratio(getComputedStyle(input).borderTopColor,getComputedStyle(input).backgroundColor)};
  });
  assert(contrast.title>=4.5&&contrast.body>=4.5&&contrast.action>=4.5&&contrast.field>=3,JSON.stringify(contrast));await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  assert.deepEqual(await storage(),before);return {durations,contrast};
 }finally{await p.emulateMedia({reducedMotion:'no-preference'});}
});
await runPr07('pr07-reflow-ampliacao',async()=>{
 const before=await storage();await openPr07Home();const layouts=[];
 try{
  for(const [w,h] of [[683,384],[320,568]]){
   pr07Phase='reflow '+w+'x'+h;await p.setViewportSize({width:w,height:h});const nav=p.getByRole('navigation',{name:'Cadastro e turmas'});await nav.getByRole('button',{name:'Cadastro',exact:true}).click();
   const check=async(label)=>{const m=await p.evaluate(()=>({viewport:innerWidth,page:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert(m.page<=w+1&&m.body<=w+1,label+' '+JSON.stringify(m));return m;};
   await p.evaluate(()=>window.scrollTo(0,0));const cadastro=await check('Cadastro');await shot('pr07-reflow-'+w+'-cadastro');
   await nav.getByRole('button',{name:'Turma Fictícia A',exact:true}).click();await tab('Geral');const geral=await check('Geral');const region=p.getByRole('region',{name:'Planilha geral de notas'});const last=await region.evaluate(e=>{e.scrollLeft=e.scrollWidth;const r=e.getBoundingClientRect(),t=e.querySelector('th[data-overview-column="final"]').getBoundingClientRect();return t.right<=r.right+1&&t.left>=r.left-1;});assert(last,'Final not reachable');await shot('pr07-reflow-'+w+'-geral');
   await tab('AL');const al=await check('AL');const input=p.getByRole('region',{name:'Planilha de AL',exact:true}).locator('input[data-spreadsheet-input]').first();await input.scrollIntoViewIfNeeded();await input.focus();assert(await input.evaluate(e=>e===document.activeElement));await shot('pr07-reflow-'+w+'-notas');
   await tab('AEP');const atividade=await check('Atividades');await shot('pr07-reflow-'+w+'-atividades');
   await p.getByRole('button',{name:'Adicionar aluno',exact:true}).first().click();const dialog=p.getByRole('dialog');await dialog.waitFor();await p.waitForTimeout(180);const box=await dialog.boundingBox();assert(box&&box.x>=-1&&box.y>=-1&&box.x+box.width<=w+1&&box.y+box.height<=h+1,'dialog outside viewport '+JSON.stringify(box));await shot('pr07-reflow-'+w+'-modal');await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
   layouts.push({width:w,height:h,cadastro,geral,al,atividade,finalReachable:last,dialog:box});
  }
  assert.deepEqual(await storage(),before);return {layouts,method:'viewport emulation, not native browser/Electron zoom'};
 }finally{await p.setViewportSize({width,height});}
});
results.push({tag,name:'pageerrors',status:errors.length?'fail':'pass',errors});flush();await context.close();
}}finally{await browser.close();flush()}
if(results.some(r=>r.status==='fail'))process.exitCode=1;
