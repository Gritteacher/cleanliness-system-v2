import { createPracticePdf } from './utils/practicePdf.mjs';
import { practicePdfOptions } from '../../src/utils/practicePdfOptions.js';
const json=(message,status)=>new Response(JSON.stringify({message}),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});

export default async function handler(request){
  if(request.method!=='POST')return json('Method not allowed',405);
  let input;
  try{
    if(Number(request.headers.get('content-length'))>2048)return json('ข้อมูลส่งออกไม่ถูกต้อง',400);
    const text=await request.text();if(text.length>2048)return json('ข้อมูลส่งออกไม่ถูกต้อง',400);
    input=practicePdfOptions(JSON.parse(text));
  }catch(error){return json(error.message==='Unexpected end of JSON input'?'ข้อมูลส่งออกไม่ถูกต้อง':error.message,400);}
  try{
    const pdf=await createPracticePdf(input);
    return new Response(pdf,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="practice-duty-${input.start}-${input.end}.pdf"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }catch(error){console.error('practice-pdf',error.message);return json(error.message||'สร้าง PDF ไม่สำเร็จ กรุณาลองอีกครั้ง',500);}
}
export const config={rateLimit:{windowLimit:6,windowSize:60,aggregateBy:['ip','domain']}};
