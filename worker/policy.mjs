export const quotaMessage = 'โควตาสร้าง PDF ฟรีของวันนี้หมดแล้ว กรุณาลองใหม่วันถัดไป';
export function errorResponse(error) {
  const message=String(error?.message || 'ทำรายการไม่สำเร็จ');
  const quota=/browser time limit|quota|daily.*limit/i.test(message);
  const busy=!quota&&/429|concurrent|too many/i.test(message);
  return new Response(JSON.stringify({message:quota?quotaMessage:busy?'มีผู้ส่งออกพร้อมกันหลายคน กรุณารอสักครู่แล้วลองใหม่':message}),{
    status:quota||busy?429:500,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...(quota||busy?{'Retry-After':quota?'3600':'30'}:{})}
  });
}
export function apiName(pathname) {
  for(const prefix of ['/api/','/.netlify/functions/'])if(pathname.startsWith(prefix))return pathname.slice(prefix.length);
  return null;
}
