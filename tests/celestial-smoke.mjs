import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const output=process.env.NORTHSTAR_SCREENSHOTS || '/tmp/northstar-validation';
const origin=process.env.NORTHSTAR_TEST_ORIGIN || 'http://127.0.0.1:8010';
const debug=process.env.NORTHSTAR_DEBUG_ORIGIN || 'http://127.0.0.1:9230';
await mkdir(output,{recursive:true});
const version=await(await fetch(debug+'/json/version')).json();
const browser=new WebSocket(version.webSocketDebuggerUrl);await new Promise(r=>browser.onopen=r);
let browserId=0;const browserPending=new Map();
browser.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){browserPending.get(m.id)?.(m.result);browserPending.delete(m.id);}};
const browserCall=(method,params={})=>new Promise(r=>{const id=++browserId;browserPending.set(id,r);browser.send(JSON.stringify({id,method,params}));});
const {browserContextId}=await browserCall('Target.createBrowserContext');
const {targetId}=await browserCall('Target.createTarget',{url:'about:blank',browserContextId});
const tabs=await(await fetch(debug+'/json/list')).json();
const ws=new WebSocket(tabs.find(t=>t.id===targetId).webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pending=new Map(),errors=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);};
const call=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,m=>m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result));ws.send(JSON.stringify({id:i,method,params}));});
const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
try {
await call('Runtime.enable');await call('Page.enable');
await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await call('Page.navigate',{url:origin+'/'});await wait(3100);
assert.equal(await ev(`document.querySelector('#pf-count').textContent`),'0');
const sample=JSON.stringify({trades:[{date:'2025-01-15',asset:'VWCE',amount:1000,shares:7,purchasePrice:142.857,broker:'Isolated test'},{date:'2025-02-03',asset:'VFEA',amount:500,shares:8,purchasePrice:62.5,broker:'Isolated test'}],quotes:{VWCE:null,VFEA:null},quoteDate:''});
await ev(`localStorage.setItem('jarvis-private-portfolio-v1',${JSON.stringify(sample)})`);
await call('Page.reload');await wait(1200);
assert.equal(await ev(`document.querySelector('#pf-count').textContent`),'2');
assert.equal(await ev(`localStorage.getItem('jarvis-private-portfolio-v1')`),sample);
assert(await ev(`!!document.querySelector('#pf-chart svg')`));
assert.equal(await ev(`document.querySelector('#hero-value').textContent`),'€1,814.34');
assert.equal(await ev(`document.querySelector('#core-allocation').textContent`),'66.0% / 34.0%');
// Inspect exports inside the isolated browser; never send or save transactions remotely.
const exported=await ev(`(async()=>{const original=URL.createObjectURL;const blobs=[];URL.createObjectURL=b=>{blobs.push(b);return original(b)};const prevent=e=>{if(e.target.closest('a[download]'))e.preventDefault()};document.addEventListener('click',prevent,true);document.querySelector('#pf-json').click();document.querySelector('#pf-backup').click();URL.createObjectURL=original;document.removeEventListener('click',prevent,true);return await Promise.all(blobs.map(b=>b.text()));})()`);
assert(exported.length===2);
const jsonExport=exported.find(t=>t.trim().startsWith('{'));assert.equal(JSON.parse(jsonExport).trades.length,2);
await ev(`(()=>{const original=window.confirm;window.confirm=()=>true;document.querySelector('#pf-csv').value=${JSON.stringify(sample)};document.querySelector('#pf-import').click();window.confirm=original;})()`);
assert.equal(await ev(`localStorage.getItem('jarvis-private-portfolio-v1')`),sample);
assert(exported.some(t=>t.includes('VWCE')&&t.includes('VFEA')));
await ev(`document.querySelector('#pf-refresh').click()`);await wait(300);
assert.equal(await ev(`localStorage.getItem('jarvis-private-portfolio-v1')`),sample);
assert.match(await ev(`document.querySelector('#pf-feed').textContent`),/Automatic Xetra/);
// Date/percentage readout, visibility, timeframes, accessible slider.
const chart=await ev(`(()=>{const before=document.querySelector('#pf-readout').textContent;const s=document.querySelector('#pf-scrub');s.value=s.min;s.dispatchEvent(new Event('input',{bubbles:true}));return {before,after:document.querySelector('#pf-readout').textContent,min:s.min,max:s.max};})()`);
assert.notEqual(chart.before,chart.after);assert.match(chart.after,/%/);
await ev(`document.querySelector('#pf-legend button').click()`);assert.equal(await ev(`document.querySelector('#pf-legend button').getAttribute('aria-pressed')`),'false');
await ev(`document.querySelector('#pf-legend button').click();document.querySelector('#pf-periods [data-range="1Y"]').click()`);
assert.equal(await ev(`document.querySelector('#pf-periods [data-range="1Y"]').getAttribute('aria-pressed')`),'true');
for(const [name,width,height,mobile] of [['desktop',1440,1000,false],['ipad-landscape',1366,1024,true],['ipad-portrait',1024,1366,true],['ipad-11-portrait',834,1194,true],['mobile',390,844,true]]){
 await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});await ev('scrollTo(0,0)');await wait(500);
 const layout=await ev(`({width:innerWidth,scroll:document.documentElement.scrollWidth,canvas:document.querySelector('#celestial-core').getBoundingClientRect().width,overflow:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>({tag:e.tagName,id:e.id,class:String(e.className),width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right}))})`);assert(layout.scroll<=layout.width,name+JSON.stringify(layout));assert(layout.canvas>200);
 if(name==='mobile'){
   const nav=await ev(`(()=>{const b=document.querySelector('.nav').getBoundingClientRect();return {bottom:b.bottom,top:b.top,height:innerHeight,identity:document.querySelector('.identity').getBoundingClientRect().bottom}})()`);
   assert(Math.abs(nav.bottom-nav.height)<2,JSON.stringify(nav));assert(nav.top>nav.identity);
 }
 const image=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`${output}/${name}.png`,Buffer.from(image.data,'base64'));
}
await call('Emulation.setDeviceMetricsOverride',{width:1366,height:1024,deviceScaleFactor:1,mobile:true});
await ev(`document.querySelector('#explore-core').click()`);await wait(350);
assert.equal(await ev(`document.querySelector('#core-dialog').open`),true);assert.equal(await ev(`document.activeElement.id`),'close-core');
await ev(`document.querySelector('[data-asset="SXR8"]').click()`);assert.match(await ev(`document.querySelector('#asset-detail').textContent`),/benchmark only/);
await ev(`document.querySelector('[data-asset="VWCE"]').click()`);assert.match(await ev(`document.querySelector('#asset-detail').textContent`),/allocation/);
// Native modal keeps keyboard focus inside while background is inert.
await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});
assert(await ev(`document.querySelector('#core-dialog').contains(document.activeElement)`));
const b=await ev(`(()=>{const b=document.querySelector('#celestial-map').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`);
await ev(`document.querySelector('#motion-toggle').click()`);
const beforeDrag=await ev(`document.querySelector('#celestial-map').toDataURL()`);
await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x,y:b.y}]});await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+60,y:b.y+30}]});await wait(180);assert.notEqual(await ev(`document.querySelector('#celestial-map').toDataURL()`),beforeDrag);
await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait(300);
await ev(`document.querySelector('#motion-toggle').click()`);
const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(`${output}/celestial-atlas.png`,Buffer.from(shot.data,'base64'));
await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});assert.equal(await ev(`document.querySelector('#core-dialog').open`),false);assert.equal(await ev('document.activeElement.id'),'explore-core');
await ev(`document.querySelector('.nav a[href="#pf-holdings"]').click()`);await wait(800);assert.equal(await ev('location.hash'),'#pf-holdings');
assert.equal(await ev(`document.querySelector('.nav [aria-current]').hash`),'#pf-holdings',JSON.stringify(await ev(`({y:scrollY,sections:[...document.querySelectorAll('.observatory,[data-destination]')].map(s=>({id:s.id,d:s.dataset.destination,y:s.getBoundingClientRect().top})),hash:location.hash})`)));
assert(await ev(`parseFloat(document.querySelector('.nav').style.getPropertyValue('--beacon-width'))>0`));
assert(await ev(`document.querySelector('#pf-holdings').getBoundingClientRect().top<350`),'Holdings must actually scroll into view');await ev('history.back()');await wait(400);assert.equal(await ev('location.hash'),'');
await ev(`document.querySelector('.nav a[href="#pf-chart"]').click()`);await wait(1000);
const chartShot=await call('Page.captureScreenshot',{format:'png'});await writeFile(`${output}/performance.png`,Buffer.from(chartShot.data,'base64'));
await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await wait(100);assert.equal(await ev(`document.querySelector('#motion-toggle span').textContent`),'OFF');
await ev(`document.querySelector('.nav a[href="#top"]').click()`);await wait(100);
assert.equal(await ev('scrollY'),0);
assert.equal(await ev(`document.querySelector('.nav [aria-current]').hash`),'#top');
assert.equal(await ev(`localStorage.getItem('jarvis-private-portfolio-v1')`),sample);
assert.equal(errors.length,0,JSON.stringify(errors));
await ev(`localStorage.removeItem('jarvis-private-portfolio-v1')`);
console.log(JSON.stringify({passed:['empty portfolio','isolated sample valuation €1,814.34','JSON import round trip and JSON/CSV export','refresh without storage mutation','storage unchanged','chart scrubbing','series visibility','timeframe selection','five responsive layouts without page overflow','atlas asset details','touch drag','Escape and focus restoration','hash navigation and Back','reduced motion'],chart,exceptions:errors.length},null,2));
} finally {
  ws.close();
  await browserCall('Target.disposeBrowserContext',{browserContextId});
  browser.close();
}

