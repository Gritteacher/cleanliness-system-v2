import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
let server,Home;
before(async()=>{server=await createServer({server:{middlewareMode:true},optimizeDeps:{noDiscovery:true},appType:'custom'});Home=(await server.ssrLoadModule('/src/pages/SystemHome.jsx')).default;});
after(async()=>{await server?.close();});
test('home retains two internal systems and adds the requested external shirt system',()=>{
 const html=renderToStaticMarkup(React.createElement(Home,{navigate:()=>{}}));
 assert.ok(html.includes('3 ระบบ'));assert.equal((html.match(/class="system-choice /g)||[]).length,3);
 assert.ok(html.includes('ระบบรณรงค์ความสะอาด'));assert.ok(html.includes('ระบบรายงานเวรดูแลนักเรียน'));assert.ok(html.includes('ระบบจัดการเสื้อกีฬาภายใน'));
 assert.match(html,/<a[^>]*href="https:\/\/dsnsize\.gritspace\.cc\/"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
 assert.ok(html.includes('เปิดแท็บใหม่'));assert.equal((html.match(/<button type="button" class="system-choice /g)||[]).length,2);
});
