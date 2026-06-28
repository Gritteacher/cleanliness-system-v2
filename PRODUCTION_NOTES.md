# Production Notes

ระบบเชื่อม Supabase แล้ว โดยใช้:
- Supabase Auth
- Supabase Database
- Supabase Storage bucket: `area-photos`

สิทธิ์ล่าสุด:
- Admin เข้าเมนูทำเวรแทนหัวหน้าคณะสีเจ้าของเวรของวันที่เลือกได้ทุกสี
- Admin เข้าเมนูให้คะแนนและเลือกใช้สิทธิ์แทนหัวหน้าคณะสีใดก็ได้
- Admin ให้คะแนนได้ทุกวันโดยไม่ล็อกคณะสีตามวันที่เลือก
- ประธานคณะสียังทำเวรได้เฉพาะวันที่เป็นเวรของสีตนเอง

ก่อนใช้งานจริง:
1. รัน SQL ในโฟลเดอร์ `supabase/`
2. สร้าง Auth users
3. รัน SQL สร้าง profiles
4. ทดสอบ Login
5. ทดสอบอัปโหลดรูป
6. ตรวจ RLS และเพิ่มนโยบายให้เข้มขึ้นก่อนใช้งานจริง


## Admin cleanup

หน้า Admin Panel มีชุดล้างข้อมูลผ่าน Checkbox แล้ว:
- duty_records
- clean_scores
- edit_logs
- Storage bucket `area-photos`
- duty_areas
- local browser cache

หากลบรูปใน Storage ต้องมี RLS policy สำหรับ delete บน `storage.objects` ซึ่งอยู่ในไฟล์ `supabase/04_admin_cleanup_policies.sql`


## Account management

Run `supabase/05_account_management.sql` to add:
- `profiles.password_note`
- own profile update policy
- admin profile read/update policy

The web app cannot read historical authentication passwords. Admin sees only the backup password note saved by the user or admin.
