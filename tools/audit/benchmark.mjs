import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const [out]=process.argv.slice(2);
const fixture=JSON.parse(fs.readFileSync(path.join(out,'final','fixture.json'),'utf8'));
const browser=await chromium.launch();
const results=[];
const targets={original:'http://127.0.0.1:5181',final:'http://127.0.0.1:5182'};
try {
 for(const [width,height] of [[1366,768],[1920,1080],[390,844]]){
  for(let round=0;round<6;round++){
   for(const version of round%2===0?['original','final']:['final','original']){
    const url=targets[version],context=await browser.newContext({viewport:{width,height},locale:'pt-BR',deviceScaleFactor:1});
    try {
     const p=await context.newPage();p.setDefaultTimeout(12000);
     await p.route('**/*',r=>{const u=r.request().url();return u.startsWith(url+'/')||u.startsWith('https://fonts.googleapis.com/')||u.startsWith('https://fonts.gstatic.com/')?r.continue():r.abort()});
     await p.addInitScript(data=>{if(!sessionStorage.getItem('audit-seeded')){localStorage.setItem('school_control_data',JSON.stringify(data));sessionStorage.setItem('audit-seeded','1')}},fixture);
     await p.goto(url);await p.getByRole('button',{name:'Turma Fictícia A',exact:true}).click();
     await p.evaluate(()=>document.fonts.ready);
     const tab=name=>p.getByRole('tab',{name,exact:true}).first().click();
     await tab('AL');
     const input=()=>p.locator('input[data-spreadsheet-input]:visible');
     await input().first().waitFor();assert.equal(await input().count(),41);
     const start=performance.now();
     for(const [block,count] of [['AL',41],['AV',9]]){
      await tab(block);
      for(let i=0;i<count;i++){const e=input().nth(i);await e.fill('12.75');await e.press('Tab');}
     }
     const elapsedMs=performance.now()-start;
     const data=await p.evaluate(()=>JSON.parse(localStorage.getItem('school_control_data')));
     const persisted=data.componentScores.filter(s=>['audit-1-AL','audit-1-AV'].includes(s.componentId)&&s.score===12.75).length;
     assert.equal(persisted,50);
     const row={width,height,round,version,warmup:round===0,elapsedMs,persisted};
     results.push(row);console.log(JSON.stringify(row));
    }finally{await context.close();fs.writeFileSync(path.join(out,'benchmark.json'),JSON.stringify(results,null,2));}
   }
  }
 }
}finally{await browser.close();}
const median=a=>a.sort((x,y)=>x-y)[Math.floor(a.length/2)];
const summary=[1366,1920,390].map(width=>{
 const a=results.filter(x=>x.width===width&&!x.warmup&&x.version==='original').map(x=>x.elapsedMs);
 const b=results.filter(x=>x.width===width&&!x.warmup&&x.version==='final').map(x=>x.elapsedMs);
 assert.equal(a.length,5);assert.equal(b.length,5);
 return {width,originalMedianMs:median(a),finalMedianMs:median(b),ratio:median(b)/median(a),originalSamples:a,finalSamples:b};
});
fs.writeFileSync(path.join(out,'benchmark-summary.json'),JSON.stringify(summary,null,2));
