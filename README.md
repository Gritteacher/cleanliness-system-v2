# ระบบตรวจความสะอาดคณะสี V2

เว็บแอพ React + Vite แบบแยกไฟล์ รองรับ Mobile First  
เชื่อม Supabase Auth / Database / Storage แล้ว

## วิธีติดตั้ง

```bash
npm install
npm run dev
```

เปิดตาม URL ที่ Vite แสดง เช่น `http://localhost:5173`

## การตั้งค่า Supabase

อ่านไฟล์:

```text
SUPABASE_SETUP.md
```

และรัน SQL ในโฟลเดอร์:

```text
supabase/
```

ตามลำดับ

```text
01_schema.sql
02_seed_master_data.sql
03_create_profiles_after_auth_users.sql
```

## สิ่งที่เชื่อมแล้ว

- Supabase Auth สำหรับ Login
- Supabase Database สำหรับข้อมูลพื้นที่ ข้อมูลการมาทำเวร คะแนนความสะอาด และประวัติแก้ไข
- Supabase Storage สำหรับรูปภาพพื้นที่
- ลดขนาดรูปก่อนอัปโหลด
- หน้า Public อ่านข้อมูลจาก Supabase
- ประธานบันทึกข้อมูลและคะแนนลง Supabase
- Admin แก้ไข/ลบข้อมูลการมาทำเวรลง Supabase
- Admin ติ๊กเลือกลบข้อมูลทดลองจากหน้าเว็บได้ เช่น เวร คะแนน Log รูป Storage และ Cache
- Admin เข้าเมนูทำเวรแทนหัวหน้าคณะสีเจ้าของเวรของวันที่เลือกได้ทุกสี
- Admin เข้าเมนูให้คะแนนและเลือกใช้สิทธิ์แทนหัวหน้าคณะสีใดก็ได้
- Area Setup บันทึกพื้นที่ลง Supabase

## โครงสร้างหน้า

- Public Scoreboard ดูได้โดยไม่ต้อง Login
- Login
- President Dashboard
- กรอกข้อมูลการมาทำเวร
- ให้คะแนนความสะอาด
- Admin Summary
- Admin Area Details
- Admin Completeness
- Admin Panel
- Area Setup

## หมายเหตุ

ค่า Supabase ไม่ควรอัปขึ้น GitHub ผ่านไฟล์ `.env`  
หาก Deploy ไป Netlify/Vercel ให้เพิ่ม Environment Variables ตาม `.env.example`
