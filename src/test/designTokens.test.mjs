import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../styles/design-tokens.css', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const approved = JSON.parse(readFileSync(new URL('../../docs/design/soft-blue.tokens.json', import.meta.url), 'utf8'));
const vars = new Map([...css.matchAll(/^\s*--([\w-]+):\s*([^;]+);/gm)].map(m=>[m[1],m[2].trim()]));
function resolve(name,seen=new Set()){
  assert(!seen.has(name),'ciclo: '+name);seen.add(name);
  const value=vars.get(name);assert(value,'token ausente: '+name);
  const alias=value.match(/^var\(--([\w-]+)\)$/);return alias?resolve(alias[1],seen):value;
}
function rgb(name){
  const [h,s,l]=resolve(name).split(/\s+/).map(parseFloat);
  assert([h,s,l].every(Number.isFinite),name+' não é HSL');
  const c=(1-Math.abs(2*l/100-1))*s/100,x=c*(1-Math.abs(h/60%2-1)),m=l/100-c/2;
  const triplet=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return triplet.map(v=>Math.round((v+m)*255));
}
function lum(v){return v.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0)}
function ratio(a,b){const x=lum(rgb(a)),y=lum(rgb(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
test('tokens Soft Blue importados e aliases legados resolvem',()=>{
  assert(entry.includes("@import './styles/design-tokens.css'"));
  for(const n of ["background","foreground","card","card-foreground","popover","popover-foreground","primary","primary-foreground","secondary","secondary-foreground","muted","muted-foreground","accent","accent-foreground","destructive","destructive-foreground","border","input","ring","present","present-foreground","present-light","absent","absent-foreground","absent-light","done","done-foreground","done-light","not-done","not-done-foreground","not-done-light","warning","warning-foreground","warning-light","warning-border","table-header","table-header-foreground","table-stripe","table-hover","sidebar-background","sidebar-foreground","sidebar-primary","sidebar-primary-foreground","sidebar-accent","sidebar-accent-foreground","sidebar-border","sidebar-ring"])assert.doesNotThrow(()=>rgb(n));
  for(const n of vars.keys())resolve(n);
});
test('cores da direção aprovada são preservadas',()=>{
  const mapping={"brand":"brand","action":"action","background":"surface-canvas","surface":"surface-default","foreground":"text-main","mutedForeground":"text-muted","border":"border-subtle","tableHeader":"surface-table-header","selection":"surface-selection","active":"surface-active","globalHeader":"surface-global-header","globalHeaderForeground":"text-main","lowGrade":"status-low-grade","lowGradeBackground":"status-low-grade-bg","actionForeground":"action-text","success":"status-success","successBackground":"status-success-bg","onTimeBackground":"status-on-time-bg","late":"status-late","lateBackground":"status-late-bg","pending":"status-pending","pendingBackground":"status-pending-bg"};
  for(const [k,n] of Object.entries(mapping))assert.equal('#'+rgb(n).map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase(),approved.colors[k],k);
});
test('pares de texto e contornos essenciais atingem contraste mínimo',()=>{
  const pairs=[['foreground','background',4.5],['foreground','card',4.5],['muted-foreground','table-header',4.5],['primary-foreground','primary',4.5],['accent-foreground','accent',4.5],['destructive-foreground','destructive',4.5],['present','present-light',4.5],['absent','absent-light',4.5],['done','done-light',4.5],['not-done','not-done-light',4.5],['warning-foreground','warning-light',4.5],['status-pending','status-pending-bg',4.5],['border-control','background',3],['border-control','card',3],['focus','surface-selection',3],['focus','surface-default',3],['text-main','surface-global-header',4.5]];
  for(const [a,b,min] of pairs)assert(ratio(a,b)>=min,a+'/'+b+' = '+ratio(a,b).toFixed(2));
});
