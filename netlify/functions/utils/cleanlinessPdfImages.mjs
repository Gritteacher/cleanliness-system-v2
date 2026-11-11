import {cleanlinessPhotoUrl} from '../../../shared/cleanlinessDailyLayout.mjs';

export async function loadCleanlinessImages(overview,supabaseUrl){
 const urls=[...new Set((overview.rooms||[]).map(r=>cleanlinessPhotoUrl(r,supabaseUrl)).filter(Boolean))];
 if(urls.length>60)throw new Error('จำนวนภาพมากเกินการจัดหน้ารายงานประจำวัน');
 const images=new Map();let next=0;const deadline=AbortSignal.timeout(12000);
 await Promise.all(Array.from({length:Math.min(6,urls.length)},async()=>{
  while(next<urls.length&&!deadline.aborted){
   const url=urls[next++];
   try{
    const response=await fetch(url,{redirect:'manual',signal:AbortSignal.any([deadline,AbortSignal.timeout(6000)])});
    if(!response.ok||Number(response.headers.get('content-length'))>524288)continue;
    const reader=response.body.getReader(),chunks=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>524288){await reader.cancel();throw new Error('Image too large');}chunks.push(Buffer.from(value));}
    const bytes=Buffer.concat(chunks);
    const mime=bytes[0]===255&&bytes[1]===216?'image/jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'image/webp':bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':'';
    if(mime)images.set(url,`data:${mime};base64,${bytes.toString('base64')}`);
   }catch{/* A missing image must not remove its area or scores. */}
  }
 }));
 return images;
}
