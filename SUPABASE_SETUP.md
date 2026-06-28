# ขั้นตอนตั้งค่า Supabase สำหรับระบบตรวจความสะอาดคณะสี V2

## 1. เปิด SQL Editor ใน Supabase

ให้รันไฟล์ SQL ตามลำดับนี้:

1. `supabase/01_schema.sql`
2. `supabase/02_seed_master_data.sql`

## 2. สร้างผู้ใช้ใน Supabase Auth

ไปที่ Supabase Dashboard → Authentication → Users → Add user

สร้างผู้ใช้ตามนี้ โดยกำหนดรหัสผ่านเอง:

| บทบาท | Email ที่ใช้ใน Supabase Auth | Username ที่ใช้หน้า Login |
|---|---|---|
| Admin | admin@tsn.local | admin |
| ประธานแม้นนฤมิตร | maen@tsn.local | maen |
| ประธานเยาวมาลย์อุทิศ | yaowaman@tsn.local | yaowaman |
| ประธานนิภานภดล | nipha@tsn.local | nipha |
| ประธานปิยราชบพิตร | piyarat@tsn.local | piyarat |
| ประธานภาณุรังษี | phanu@tsn.local | phanu |

หลังจากสร้าง Auth users แล้ว ให้รันไฟล์:

3. `supabase/03_create_profiles_after_auth_users.sql`

## 3. ตั้งค่า Environment

ไฟล์ `.env` ใส่ค่า Supabase ให้แล้วจากค่าที่ส่งมา

ถ้าจะ Deploy ไป Netlify หรือ Vercel ให้เพิ่ม Environment Variables:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 4. การใช้งาน Login

หน้า Login ใช้ Username เช่น `admin` หรือ `maen`  
ระบบจะแปลงเป็น email ภายใน เช่น `admin@tsn.local`

## 5. หมายเหตุเรื่องความปลอดภัย

เวอร์ชันนี้เชื่อม Supabase Auth / Database / Storage แล้ว และใช้ RLS แบบ MVP เพื่อให้ระบบใช้งานได้ก่อน

ก่อนใช้จริงระดับ Production ควรเพิ่ม RLS ให้เข้มขึ้น เช่น:
- ประธานแก้ได้เฉพาะข้อมูลเวรของสีตนเอง
- ประธานแก้ได้เฉพาะคะแนนของตนเอง
- Admin เท่านั้นที่แก้พื้นที่และลบข้อมูลได้


## 6. ถ้าเพิ่มฟีเจอร์ล้างข้อมูลผ่านหน้าเว็บ

ถ้าโปรเจกต์ Supabase ของครูเคยรัน SQL ชุดเก่าไปแล้ว ให้รันเพิ่ม:

```text
supabase/04_admin_cleanup_policies.sql
```

ไฟล์นี้เพิ่มสิทธิ์ให้เว็บสามารถ:
- ลบประวัติการแก้ไขจากตาราง `edit_logs`
- ลบรูปจาก Storage bucket `area-photos` ผ่าน Storage API

ถ้าเป็นการติดตั้งใหม่ตั้งแต่ต้น และรัน `01_schema.sql` เวอร์ชันล่าสุดแล้ว ไม่จำเป็นต้องรันไฟล์นี้ซ้ำ


## 7. เปิดระบบจัดการบัญชีผู้ใช้

หากต้องการให้ผู้ใช้เปลี่ยนชื่อผู้ใช้/รหัสผ่าน และให้ Admin เห็นรหัสสำรอง ให้รันเพิ่ม:

```text
supabase/05_account_management.sql
```

หลังรันแล้ว หน้า Admin Panel จะเห็นตารางจัดการบัญชีผู้ใช้ และผู้ใช้จะมีหน้า "บัญชี" สำหรับแก้ไขข้อมูลของตนเอง
