-- Run after 01_schema.sql

insert into public.color_teams
(id, name, short_name, color_name, accent_color, soft_color, duty_day, sort_order)
values
('maen', 'คณะแม้นนฤมิตร', 'แม้นนฤมิตร', 'สีม่วง', '#7C3AED', '#F3E8FF', 'monday', 1),
('yaowaman', 'คณะเยาวมาลย์อุทิศ', 'เยาวมาลย์อุทิศ', 'สีน้ำเงิน', '#2563EB', '#DBEAFE', 'tuesday', 2),
('nipha', 'คณะนิภานภดล', 'นิภานภดล', 'สีแสด', '#F97316', '#FFEDD5', 'wednesday', 3),
('piyarat', 'คณะปิยราชบพิตร', 'ปิยราชบพิตร', 'สีชมพู', '#EC4899', '#FCE7F3', 'thursday', 4),
('phanu', 'คณะภาณุรังษี', 'ภาณุรังษี', 'สีแดง', '#DC2626', '#FEE2E2', 'friday', 5)
on conflict (id) do update set
name = excluded.name,
short_name = excluded.short_name,
color_name = excluded.color_name,
accent_color = excluded.accent_color,
soft_color = excluded.soft_color,
duty_day = excluded.duty_day,
sort_order = excluded.sort_order,
updated_at = now();

insert into public.duty_areas
(id, area_no, area_name, rooms_by_team)
values
('area-01', 1, 'รอบเรือนรำเพย', '{"maen":"1/1","yaowaman":"1/2","nipha":"1/4","piyarat":"1/3","phanu":"1/5"}'),
('area-02', 2, 'สวนหลวงพ่อ ชุ่มถึงสวนหลวงพ่อ โรงอาหารด้านถนน', '{"maen":"1/7","yaowaman":"1/9","nipha":"1/6","piyarat":"1/8","phanu":"1/10"}'),
('area-03', 3, 'โรงอาหาร ซุ้มสระบัว', '{"maen":"1/13","yaowaman":"1/11","nipha":"1/14","piyarat":"1/12","phanu":"1/15"}'),
('area-04', 4, 'ทางเดินริมน้ำ ด้านสนามกีฬา', '{"maen":"2/2","yaowaman":"2/1","nipha":"2/3","piyarat":"2/4","phanu":"2/5"}'),
('area-05', 5, 'ลานกีฬา โมลยานุสรณ์', '{"maen":"2/7","yaowaman":"2/6","nipha":"2/10","piyarat":"2/9","phanu":"2/8"}'),
('area-06', 6, 'ซุ้มรอบสนามกีฬา โมลยานุสรณ์', '{"maen":"2/11","yaowaman":"2/13","nipha":"2/15","piyarat":"2/12","phanu":"2/14"}'),
('area-07', 7, 'รอบอาคาร 1 จนถึงขอบสระน้ำ', '{"maen":"3/3","yaowaman":"3/2","nipha":"3/4","piyarat":"3/1","phanu":"3/5"}'),
('area-08', 8, 'รอบอาคาร 5 ถึงขอบสระน้ำ', '{"maen":"3/8","yaowaman":"3/6","nipha":"3/7","piyarat":"3/9","phanu":"3/10"}'),
('area-09', 9, 'ร้านสวัสดิการ อาคารพยาบาล', '{"maen":"3/11","yaowaman":"3/15","nipha":"3/12","piyarat":"3/14","phanu":"3/13"}'),
('area-10', 10, 'รอบอาคาร 4', '{"maen":"4/1","yaowaman":"4/3","nipha":"4/2","piyarat":"4/5","phanu":"4/4"}'),
('area-11', 11, 'หน้าโรงฝึกงานและห้องน้ำหลังอาคาร 4', '{"maen":"4/6","yaowaman":"4/8","nipha":"4/7","piyarat":"4/9","phanu":"4/10"}'),
('area-12', 12, 'รอบโดมสุขศรีการประชาร่วมใจ', '{"maen":"5/1","yaowaman":"4/11","nipha":"5/5","piyarat":"5/2","phanu":"4/12"}'),
('area-13', 13, 'สนามฟุตบอลหญ้าเทียม', '{"maen":"5/4","yaowaman":"5/3","nipha":"5/9","piyarat":"5/6","phanu":"5/8"}'),
('area-14', 14, 'รอบอาคาร 6 และใต้อาคาร 6', '{"maen":"5/10","yaowaman":"5/7","nipha":"6/2","piyarat":"5/11","phanu":"5/12"}'),
('area-15', 15, 'หน้าอาคาร 2', '{"maen":"6/5","yaowaman":"6/1","nipha":"6/7","piyarat":"6/3","phanu":"6/4"}'),
('area-16', 16, 'หน้าอาคาร 3 ลานแม่รำเพย', '{"maen":"6/9","yaowaman":"6/6","nipha":"6/10","piyarat":"6/12","phanu":"6/11"}'),
('area-17', 17, 'หน้าอาคาร 3 ลานแม่รำเพย', '{"yaowaman":"6/8"}')
on conflict (id) do update set
area_no = excluded.area_no,
area_name = excluded.area_name,
rooms_by_team = excluded.rooms_by_team,
updated_at = now();
