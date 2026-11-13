import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
let server,Overview,Export,Practice;
before(async()=>{
 server=await createServer({server:{middlewareMode:true},optimizeDeps:{noDiscovery:true},appType:'custom'});
 Overview=(await server.ssrLoadModule('/src/pages/v3/PublicOverview.jsx')).default;
 Export=(await server.ssrLoadModule('/src/components/PracticePdfExport.jsx')).default;
 Practice=(await server.ssrLoadModule('/src/pages/PracticePage.jsx')).default;
});
after(async()=>{await server?.close();});
const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,{date:'2026-11-02',navigate:()=>{},...props}));
test('public cleanliness page has no export button or dedicated print document',()=>{
 const html=render(Overview,{data:{date:'2026-11-02'},isAdmin:false});assert.ok(!html.includes('ส่งออก PDF'));assert.ok(!html.includes('class="clean-print"'));assert.ok(html.includes('ผลเวรประจำวัน'));
});
test('admin cleanliness page retains its export action and prepared print report',()=>{
 const html=render(Overview,{data:{date:'2026-11-02'},isAdmin:true});assert.ok(html.includes('ส่งออก PDF'));assert.ok(html.includes('class="clean-print"'));
});
test('PDF/PNG dialog defaults to denied; only an admin sees it',()=>{
 assert.equal(render(Export,{}),'');assert.equal(render(Export,{isAdmin:false}),'');
 const html=render(Export,{isAdmin:true});assert.ok(html.includes('ส่งออก PDF / ภาพ'));assert.ok(html.includes('ภาพ PNG'));
});
test('public practice page stays accessible without the export tool',()=>{
 const html=render(Practice,{isAdmin:false});assert.ok(!html.includes('ส่งออก PDF / ภาพ'));assert.ok(html.includes('รายงานเวรดูแลนักเรียน'));
});
