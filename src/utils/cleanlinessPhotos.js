export const MAX_CLEANLINESS_PHOTOS=10;
export function remainingPhotoSlots(count){return Math.max(0,MAX_CLEANLINESS_PHOTOS-count);}
export function validatePhotoSelection(count,files){
 const remaining=remainingPhotoSlots(count);
 if(files.length>remaining)throw new Error(remaining?`พื้นที่นี้เพิ่มได้อีก ${remaining} รูป (สูงสุด 10 รูปต่อวัน)`:'พื้นที่นี้มีรูปครบ 10 รูปแล้ว กรุณาลบรูปก่อนเพิ่ม');
}
export async function assertPhotoCapacity(client,submissionId){
 const result=await client.from('cs_submission_photos').select('id',{head:true,count:'exact'}).eq('submission_id',submissionId).is('deleted_at',null);
 if(result.error)throw result.error;
 if(!Number.isInteger(result.count))throw new Error('ตรวจจำนวนรูปไม่สำเร็จ กรุณาลองอีกครั้ง');
 validatePhotoSelection(result.count,[null]);
}
export function publicRoomPhotos(room){
 const urls=(room.photo_public_urls||[]).filter(Boolean);
 return [...new Set(urls.length?urls:[room.legacy_public_url||room.legacy_thumbnail_url].filter(Boolean))];
}
export function photoUploadError(error){
 return String(error?.message||'').includes('CLEANLINESS_PHOTO_LIMIT')?'พื้นที่นี้มีรูปครบ 10 รูปแล้ว กรุณาลบรูปก่อนเพิ่ม':error?.message||'อัปโหลดรูปไม่สำเร็จ';
}
