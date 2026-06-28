import { useState } from 'react';
import { colorTeams, DAY_LABELS } from '../data/colorTeams.js';
import { defaultDutyAreas } from '../data/dutyAreas.js';
import { resetDemoData } from '../utils/storage.js';
import { upsertAreas } from '../services/supabaseService.js';

export default function AreaSetup({ data, setData, refreshData }) {
  const [areas, setAreas] = useState(data.areas || []);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function updateArea(areaId, field, value) {
    setAreas((prev) => prev.map((area) => area.id === areaId ? { ...area, [field]: value } : area));
  }

  function updateRoom(areaId, teamId, value) {
    setAreas((prev) => prev.map((area) => {
      if (area.id !== areaId) return area;
      return {
        ...area,
        roomsByTeam: {
          ...area.roomsByTeam,
          [teamId]: value
        }
      };
    }));
  }

  async function saveAreas() {
    setBusy(true);
    setMessage('');
    try {
      await upsertAreas(areas);
      setData({ ...data, areas });
      try {
        await refreshData();
      } catch {
        // cache
      }
      setMessage('บันทึกข้อมูลพื้นที่ลง Supabase เรียบร้อยแล้ว');
    } catch (error) {
      setMessage(`บันทึกพื้นที่ไม่สำเร็จ: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function resetAreasOnly() {
    setBusy(true);
    setAreas(defaultDutyAreas);
    try {
      await upsertAreas(defaultDutyAreas);
      setData({ ...data, areas: defaultDutyAreas });
      setMessage('รีเซ็ตเฉพาะตารางพื้นที่เรียบร้อยแล้ว');
    } catch (error) {
      setMessage(`รีเซ็ตพื้นที่ไม่สำเร็จ: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  function resetAllDemo() {
    if (!confirm('ต้องการล้างข้อมูลที่บันทึกในเครื่องนี้หรือไม่? ข้อมูลใน Supabase จะไม่ถูกลบ')) return;
    const next = resetDemoData();
    setData(next);
    setAreas(next.areas);
    setMessage('ล้างข้อมูลในเครื่องเรียบร้อยแล้ว');
  }

  return (
    <section className="page-shell">
      <div className="hero-card">
        <div>
          <span className="eyebrow">Area Setup</span>
          <h2>จัดการพื้นที่รับผิดชอบ</h2>
          <p>แสดงตารางพื้นที่ตามวันเวร จันทร์-ศุกร์</p>
        </div>
        <div className="hero-actions">
          <button className="btn btn-primary" type="button" onClick={saveAreas} disabled={busy}>บันทึกพื้นที่</button>
          <button className="btn btn-ghost" type="button" onClick={resetAreasOnly} disabled={busy}>รีเซ็ตพื้นที่</button>
          <button className="btn btn-danger" type="button" onClick={resetAllDemo} disabled={busy}>ล้าง cache</button>
        </div>
      </div>

      {message ? <div className={message.includes('ไม่สำเร็จ') ? 'alert danger' : 'alert success'}>{message}</div> : null}

      <div className="table-card area-setup-table">
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>พื้นที่</th>
                {colorTeams.map((team) => <th key={team.id}>{DAY_LABELS[team.dutyDay]}<br />{team.shortName}</th>)}
              </tr>
            </thead>
            <tbody>
              {areas.map((area) => (
                <tr key={area.id}>
                  <td>
                    <input
                      value={area.areaName}
                      onChange={(e) => updateArea(area.id, 'areaName', e.target.value)}
                    />
                  </td>
                  {colorTeams.map((team) => (
                    <td key={team.id}>
                      <input
                        value={area.roomsByTeam?.[team.id] || ''}
                        onChange={(e) => updateRoom(area.id, team.id, e.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
