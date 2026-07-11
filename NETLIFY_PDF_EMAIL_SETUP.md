# ตั้งค่าระบบส่ง PDF หน้าสาธารณะทางอีเมล

ระบบนี้เพิ่ม 2 ส่วน

1. ปุ่ม `สร้าง PDF` ในหน้าสาธารณะ
   - ต้องกรอกชื่อผู้ใช้และรหัสผ่านของระบบก่อน
   - เมื่อถูกต้อง ระบบจะสร้าง PDF จากข้อมูลหน้าสาธารณะของวันที่เลือก

2. ส่ง PDF อัตโนมัติทุกวันเวลา 09:00 น. ตามเวลาประเทศไทย
   - ใช้ Netlify Scheduled Function
   - เวลาใน cron ใช้ UTC ดังนั้น 09:00 น. ประเทศไทย = 02:00 UTC
   - ตั้งไว้ที่ `0 2 * * *`

## Environment variables ที่ต้องตั้งใน Netlify

ไปที่ Netlify > Site configuration > Environment variables แล้วเพิ่มค่าเหล่านี้

```text
PUBLIC_SITE_URL=https://YOUR-SITE.netlify.app
RESEND_API_KEY=ใส่ API Key จาก Resend
MAIL_FROM=ระบบตรวจความสะอาด <อีเมลผู้ส่งที่ Resend อนุญาต>
DAILY_PDF_TO=gritsn.th@gmail.com
```

ระบบยังใช้ค่าที่มีอยู่เดิมด้วย

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## หมายเหตุเรื่องอีเมลผู้รับ

ตอนนี้ตั้งค่าเริ่มต้นตามที่ระบุไว้คือ

```text
gritsn.th@gmail.com
```

หากต้องการเปลี่ยนเป็นอีเมลอื่น ให้แก้ที่ Environment variable ชื่อ `DAILY_PDF_TO`

## หลังตั้งค่าเสร็จ

ให้กด Deploy ใหม่ใน Netlify

```text
Deploys > Trigger deploy > Clear cache and deploy site
```

## ทดสอบปุ่มสร้าง PDF

1. เปิดหน้าสาธารณะ
2. เลือกวันที่
3. กดปุ่ม `สร้าง PDF`
4. กรอกชื่อผู้ใช้และรหัสผ่านของระบบ
5. ระบบจะดาวน์โหลด PDF

## ทดสอบ function ด้วยตัวเอง

หลัง deploy แล้ว สามารถกดสร้าง PDF จากปุ่มหน้าเว็บได้ทันที

ส่วนการส่งอีเมลอัตโนมัติจะทำงานตอน 09:00 น. ของทุกวันตามเวลาประเทศไทย


## อัปเดตแก้ timeout 30 วินาที

ปุ่มสร้าง PDF แบบกดเองเปลี่ยนเป็นวิธีที่เสถียรกว่า:

```text
1. ผู้ใช้กรอกชื่อผู้ใช้และรหัสผ่าน
2. ระบบตรวจสอบรหัสผ่านด้วย Function ขนาดเล็ก
3. เปิดหน้ารายงานแบบ PDF
4. Browser เปิดหน้าต่าง Print ให้กด Save as PDF
```

วิธีนี้ไม่ต้องให้ Netlify เปิด Chromium ตอนผู้ใช้กดปุ่ม จึงไม่ติด timeout 30 วินาที

ส่วนอีเมลรายวันใช้ Scheduled Function เรียก Background Function เพื่อให้มีเวลาสร้าง PDF นานขึ้น
