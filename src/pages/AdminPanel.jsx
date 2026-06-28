import { useMemo, useState } from 'react';
import { colorTeams } from '../data/colorTeams.js';
import TeamBadge from '../components/TeamBadge.jsx';
import { todayISO } from '../utils/dateUtils.js';
import { STATUS_LABELS, calculateStudentScore } from '../utils/scoring.js';
import { addLog } from '../utils/storage.js';
import { deleteDutyRecordRemote, upsertDutyRecord, insertEditLog, cleanupSelectedData } from '../services/supabaseService.js';

const CLEANUP_DEFAULTS = {
  dutyRecords: false,
  cleanScores: false,
  editLogs: false,
  storageFiles: false,
  dutyAreas: false,
  localCache: false
};

export default function AdminPanel({ data, setData, user, refreshData }) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [teamId, setTeamId] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [cleanupOptions, setCleanupOptions] = useState(CLEANUP_DEFAULTS);
  const [cleanupConfirm, setCleanupConfirm] = useState('');
  const [cleanupBusy, setCleanupBusy] = useState(false);

  const dutyRows = useMemo(() => data.dutyRecords.filter((record) => {
    const area = data.areas.find((item) => item.id === record.areaId);
    const matchDate = record.recordDate === selectedDate;
    const matchTeam = teamId === 'all' || record.dutyColorId === teamId;
    const matchQuery = !query || `${record.room} ${area?.areaName || ''}`.includes(query);
    return matchDate && matchTeam && matchQuery;
  }), [data, selectedDate, teamId, query]);

  function toggleCleanup(name) {
    setCleanupOptions((prev) => ({
      ...prev,
      [name]: !prev[name]
    }));
  }

  function getCleanupLabels() {
    const labels = [];
    if (cleanupOptions.dutyRecords) labels.push('ข้อมูลการมาทำเวร');
    if (cleanupOptions.cleanScores) labels.push('คะแนนความสะอาด');
    if (cleanupOptions.editLogs) labels.push('ประวัติการแก้ไข');
    if (cleanupOptions.storageFiles) labels.push('รูปภาพใน Storage');
    if (cleanupOptions.dutyAreas) labels.push('ตารางพื้นที่/ห้อง');
    if (cleanupOptions.localCache) labels.push('Cache ใน Browser');
    return labels;
  }

  async function handleCleanup() {
    const labels = getCleanupLabels();

    if (!labels.length) {
      setMessage('กรุณาติ๊กข้อมูลที่ต้องการลบก่อน');
      return;
    }

    if (cleanupConfirm.trim() !== 'ลบข้อมูล') {
      setMessage('กรุณาพิมพ์คำว่า ลบข้อมูล เพื่อยืนยัน');
      return;
    }

    const detail = labels.join(', ');
    const ok = confirm(`ยืนยันการลบ: ${detail}\n\nเมื่อลบแล้วไม่สามารถกู้คืนจากหน้าเว็บได้`);
    if (!ok) return;

    setCleanupBusy(true);
    setMessage('');

    try {
      await cleanupSelectedData(cleanupOptions);

      if (cleanupOptions.localCache) {
        localStorage.removeItem('cleanliness_v2_app_data');
      }

      const nextData = await refreshData();

      if (cleanupOptions.dutyAreas) {
        setData({
          ...nextData,
          areas: [],
          dutyRecords: [],
          cleanScores: [],
          editLogs: nextData.editLogs || []
        });
      }

      setCleanupOptions(CLEANUP_DEFAULTS);
      setCleanupConfirm('');
      setMessage(`ลบข้อมูลสำเร็จ: ${detail}`);
    } catch (error) {
      setMessage(`ลบข้อมูลไม่สำเร็จ: ${error.message}`);
    } finally {
      setCleanupBusy(false);
    }
  }

  async function deleteDutyRecord(record) {
    if (!confirm('ยืนยันการลบข้อมูลการมาทำเวรนี้?')) return;

    try {
      await deleteDutyRecordRemote(record.id);

      const log = {
        id: `log-${Date.now()}`,
        editedAt: new Date().toISOString(),
        action: 'DELETE_DUTY_RECORD',
        tableName: 'dutyRecords',
        recordId: record.id,
        oldData: record,
        newData: null,
        editedBy: user.displayName
      };

      try {
        await insertEditLog(log);
      } catch {
        // skip
      }

      let nextData = {
        ...data,
        dutyRecords: data.dutyRecords.filter((item) => item.id !== record.id)
      };
      nextData = addLog(nextData, log);
      setData(nextData);
      setMessage('ลบข้อมูลเรียบร้อยแล้ว');

      try {
        await refreshData();
      } catch {
        // cache
      }
    } catch (error) {
      setMessage(`ลบไม่สำเร็จ: ${error.message}`);
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const studentCount = Number(form.get('studentCount') || 0);
    const nextRecord = {
      ...editing,
      status: form.get('status'),
      studentCount,
      studentScore: calculateStudentScore(studentCount),
      photoNote: form.get('photoNote'),
      updatedAt: new Date().toISOString()
    };

    try {
      await upsertDutyRecord(nextRecord);

      const log = {
        id: `log-${Date.now()}`,
        editedAt: new Date().toISOString(),
        action: 'ADMIN_UPDATE_DUTY_RECORD',
        tableName: 'dutyRecords',
        recordId: editing.id,
        oldData: editing,
        newData: nextRecord,
        editedBy: user.displayName
      };

      try {
        await insertEditLog(log);
      } catch {
        // skip
      }

      let nextData = {
        ...data,
        dutyRecords: data.dutyRecords.map((item) => item.id === editing.id ? nextRecord : item)
      };
      nextData = addLog(nextData, log);
      setData(nextData);
      setEditing(null);
      setMessage('แก้ไขข้อมูลเรียบร้อยแล้ว');

      try {
        await refreshData();
      } catch {
        // cache
      }
    } catch (error) {
      setMessage(`แก้ไขไม่สำเร็จ: ${error.message}`);
    }
  }

  return (
    <section className="page-shell">
      <div className="hero-card">
        <div>
          <span className="eyebrow">Admin Panel</span>
          <h2>จัดการข้อมูลทั้งหมด</h2>
          <p>ค้นหา แก้ไข ลบ และล้างข้อมูลทดลองจากหน้าเว็บ</p>
        </div>
      </div>

      {message ? <div className={message.includes('ไม่สำเร็จ') || message.includes('กรุณา') ? 'alert danger' : 'alert success'}>{message}</div> : null}

      <div className="cleanup-card">
        <div className="section-title">
          <div>
            <h3>ล้างข้อมูลระบบ</h3>
            <p>Admin สามารถติ๊กเลือกได้ว่าจะลบข้อมูลส่วนใดบ้าง</p>
          </div>
        </div>

        <div className="cleanup-grid">
          <label className="check-card">
            <input
              type="checkbox"
              checked={cleanupOptions.dutyRecords}
              onChange={() => toggleCleanup('dutyRecords')}
            />
            <span>
              <strong>ข้อมูลการมาทำเวร</strong>
              <small>สถานะ จำนวนคน หมายเหตุ และลิงก์รูปในแต่ละห้อง</small>
            </span>
          </label>

          <label className="check-card">
            <input
              type="checkbox"
              checked={cleanupOptions.cleanScores}
              onChange={() => toggleCleanup('cleanScores')}
            />
            <span>
              <strong>คะแนนความสะอาด</strong>
              <small>คะแนนที่หัวหน้าคณะสีหรือ Admin ให้ไว้</small>
            </span>
          </label>

          <label className="check-card">
            <input
              type="checkbox"
              checked={cleanupOptions.editLogs}
              onChange={() => toggleCleanup('editLogs')}
            />
            <span>
              <strong>ประวัติการแก้ไข</strong>
              <small>Log การเพิ่ม แก้ไข และลบข้อมูล</small>
            </span>
          </label>

          <label className="check-card">
            <input
              type="checkbox"
              checked={cleanupOptions.storageFiles}
              onChange={() => toggleCleanup('storageFiles')}
            />
            <span>
              <strong>รูปภาพใน Storage</strong>
              <small>ลบไฟล์รูปทั้งหมดใน bucket area-photos ด้วย Storage API</small>
            </span>
          </label>

          <label className="check-card warning">
            <input
              type="checkbox"
              checked={cleanupOptions.dutyAreas}
              onChange={() => toggleCleanup('dutyAreas')}
            />
            <span>
              <strong>ตารางพื้นที่/ห้อง</strong>
              <small>ไม่แนะนำ ถ้าลบแล้วต้อง Seed ตารางพื้นที่ใหม่</small>
            </span>
          </label>

          <label className="check-card">
            <input
              type="checkbox"
              checked={cleanupOptions.localCache}
              onChange={() => toggleCleanup('localCache')}
            />
            <span>
              <strong>Cache ใน Browser</strong>
              <small>ล้างข้อมูลที่ค้างในเครื่องผู้ดูแลระบบเครื่องนี้</small>
            </span>
          </label>
        </div>

        <div className="cleanup-confirm">
          <label>
            พิมพ์คำว่า <strong>ลบข้อมูล</strong> เพื่อยืนยัน
            <input
              value={cleanupConfirm}
              onChange={(event) => setCleanupConfirm(event.target.value)}
              placeholder="ลบข้อมูล"
            />
          </label>
          <button
            className="btn btn-danger"
            type="button"
            onClick={handleCleanup}
            disabled={cleanupBusy}
          >
            {cleanupBusy ? 'กำลังลบข้อมูล...' : 'ลบข้อมูลที่เลือก'}
          </button>
        </div>
      </div>

      <div className="filter-card">
        <label>
          วันที่
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </label>
        <label>
          คณะสี
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="all">ทุกคณะสี</option>
            {colorTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
        <label>
          ค้นหา
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ห้อง / พื้นที่" />
        </label>
      </div>

      <div className="table-card">
        <div className="section-title">
          <h3>ตารางข้อมูลการมาทำเวร</h3>
        </div>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>พื้นที่</th>
                <th>คณะสี</th>
                <th>สถานะ</th>
                <th>จำนวนคน</th>
                <th>คะแนนคน</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {dutyRows.map((record) => {
                const area = data.areas.find((item) => item.id === record.areaId);
                return (
                  <tr key={record.id}>
                    <td>{record.room}</td>
                    <td>{area?.areaName}</td>
                    <td><TeamBadge teamId={record.dutyColorId} size="small" /></td>
                    <td>{STATUS_LABELS[record.status] || record.status}</td>
                    <td>{record.studentCount}</td>
                    <td>{Number(record.studentScore || 0).toFixed(2)}</td>
                    <td>
                      <div className="action-row">
                        <button className="btn btn-small" type="button" onClick={() => setEditing(record)}>แก้ไข</button>
                        <button className="btn btn-small btn-danger" type="button" onClick={() => deleteDutyRecord(record)}>ลบ</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!dutyRows.length ? (
                <tr><td colSpan="7">ไม่พบข้อมูล</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-card">
        <div className="section-title">
          <h3>ประวัติการแก้ไขล่าสุด</h3>
        </div>
        <div className="log-list">
          {(data.editLogs || []).slice(0, 12).map((log) => (
            <div key={log.id} className="log-item">
              <strong>{log.action}</strong>
              <span>{log.editedBy} • {new Date(log.editedAt).toLocaleString('th-TH')}</span>
            </div>
          ))}
          {!data.editLogs?.length ? <p className="muted-text">ยังไม่มีประวัติการแก้ไข</p> : null}
        </div>
      </div>

      {editing ? (
        <div className="modal-backdrop">
          <form className="edit-modal" onSubmit={saveEdit}>
            <h3>แก้ไขข้อมูลการมาทำเวร</h3>
            <label>
              สถานะ
              <select name="status" defaultValue={editing.status}>
                <option value="PRESENT">มาทำเวร</option>
                <option value="ABSENT">ไม่มาทำเวร</option>
                <option value="ACTIVITY">ไปกิจกรรม / ไม่นำมาคำนวณ</option>
              </select>
            </label>
            <label>
              จำนวนคน
              <input name="studentCount" type="number" min="0" defaultValue={editing.studentCount} />
            </label>
            <label>
              หมายเหตุ
              <textarea name="photoNote" defaultValue={editing.photoNote || ''} />
            </label>
            <div className="action-row">
              <button className="btn btn-primary" type="submit">บันทึก</button>
              <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>ยกเลิก</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
