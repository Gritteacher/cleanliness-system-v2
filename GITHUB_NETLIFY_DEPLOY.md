# Deploy ด้วย GitHub + Netlify

## 1. สร้าง Repository ใน GitHub

สร้าง Repository ใหม่ เช่น

```text
cleanliness-system-v2
```

เลือก Public หรือ Private ได้ตามต้องการ

## 2. อัปโหลดโปรเจกต์ขึ้น GitHub

วิธี Command line:

```bash
git init
git add .
git commit -m "Initial React Supabase app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cleanliness-system-v2.git
git push -u origin main
```

## 3. เชื่อม Netlify

ไปที่ Netlify

```text
Add new project
Import an existing project
Deploy with GitHub
เลือก repository
```

ค่า Build settings:

```text
Build command: npm run build
Publish directory: dist
```

ในโปรเจกต์มี `netlify.toml` ใส่ค่านี้ไว้แล้ว

## 4. ตั้งค่า Environment Variables ใน Netlify

เข้าเมนู:

```text
Site configuration
Environment variables
Add a variable
```

เพิ่ม 2 ค่า:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## 5. Deploy

กด Deploy

หลังจากนี้ทุกครั้งที่แก้โค้ดแล้ว push ขึ้น GitHub, Netlify จะ build และ deploy ให้อัตโนมัติ

## สำคัญ

อย่าอัปโหลดไฟล์ `.env` ขึ้น GitHub  
ในชุด GitHub zip นี้ลบ `.env` ออกแล้ว และใช้ `.env.example` เป็นตัวอย่างแทน
