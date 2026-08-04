# Clean & Care — Cleanliness System V3

ระบบติดตามการดูแลพื้นที่ของคณะสี โรงเรียนเทพศิรินทร์ นนทบุรี สร้างด้วย React, Vite และ Supabase

## ความสามารถหลัก

- Public Scoreboard แสดงคะแนนรวมและผลรายพื้นที่ที่เผยแพร่แล้ว
- Login ด้วยบัญชี Supabase Auth เดิม และตรวจสิทธิ์จาก `cs_profiles`
- President Workspace บันทึกการเข้าเวรและร่วมประเมินพื้นที่
- Admin Setup เปิดภาคเรียน เพิ่มพื้นที่ จับคู่ห้องกับคณะ และตั้งตารางเวร จ.–ศ.
- Row Level Security แยกสิทธิ์ `anon`, `president` และ `admin`
- รูปภาพเก็บใน private bucket `cs-duty-photos`
- Audit log สำหรับข้อมูลหลักและข้อมูลปฏิบัติงาน

ระบบ V3 ใช้ตารางที่ขึ้นต้นด้วย `cs_` จึงทำงานคู่กับ V2 เดิมได้ระหว่างการย้ายระบบ

## เริ่มต้นพัฒนา

```bash
npm install
npm run dev
```

สร้าง `.env.local` จาก `.env.example` แล้วกำหนด:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
```

## ฐานข้อมูล

Migration หลักอยู่ที่:

```text
supabase/migrations/202608040001_cleanliness_v3_foundation.sql
```

Migration สร้าง 15 ตาราง, RLS policies, helper functions, audit triggers, private Storage bucket, ข้อมูล 5 คณะ และย้ายเฉพาะ identity/role จาก `profiles` เดิม โดยไม่ย้ายข้อมูลรหัสผ่าน

## ลำดับการตั้งค่าครั้งแรก

1. Login ด้วยบัญชี Admin
2. เปิดภาคเรียนในหน้า “จัดการระบบ”
3. เพิ่มพื้นที่ตรวจความสะอาด
4. จับคู่ห้อง/พื้นที่กับแต่ละคณะ
5. ตั้งตารางเวรวันจันทร์–ศุกร์
6. ตรวจหน้า “งานวันนี้” ด้วยบัญชีประธานคณะ

## Build

```bash
npm run build
```

ผลลัพธ์อยู่ใน `dist/` และตั้งค่า Netlify ให้ publish โฟลเดอร์นี้แล้ว
