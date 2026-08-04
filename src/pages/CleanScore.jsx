import { useMemo, useState } from 'react';
import { colorTeams, getTeam } from '../data/colorTeams.js';
import TeamBadge from '../components/TeamBadge.jsx';
import PhotoPreview from '../components/PhotoPreview.jsx';
import { todayISO, formatThaiDate, getDutyTeamForDate, getDayLabel } from '../utils/dateUtils.js';
import {
  STATUS_LABELS,
  getAreasForTeam,
  getDutyRecord,
  getScoreByEvaluator,
  getScores
} from '../utils/scoring.js';
import { addLog } from '../utils/storage.js';
import {
  upsertCleanScore,
  upsertCleanScores,
  insertEditLog,
  insertEditLogs
} from '../services/supabaseService.js';

function getInitialDutyTeamId(dateString) {
  return getDutyTeamForDate(dateString)?.id || colorTeams[0].id;
}

function normalizeScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(10, score));
}

export default function CleanScore({ data, setData, user, refreshData }) {
  const initialDate = todayISO();
  const isAdmin = user.role === 'ADMIN';

  const [recordDate, setRecordDate] = useState(initialDate);
  const [dutyColorId, setDutyColorId] = useState(
    isAdmin ? colorTeams[0].id : getInitialDutyTeamId(initialDate)
  );

  // โหมดประธานคณะสี: บันทึกทีละพื้นที่
  const [areaId, setAreaId] = useState('');
  const [scoreValue, setScoreValue] = useState('');
  const [scoreNote, setScoreNote] = useState('');

  // โหมด Admin: เลือกหลายสิทธิ์ หลายพื้นที่ และกำหนดคะแนนรายพื้นที่
  const [adminEvaluatorColorIds, setAdminEvaluatorColorIds] = useState([colorTeams[0].id]);
  const [adminAreaIds, setAdminAreaIds] = useState([]);
  const [adminAreaScores, setAdminAreaScores] = useState({});
  const [adminAreaNotes, setAdminAreaNotes] = useState({});
  const [bulkScoreValue, setBulkScoreValue] = useState('');

  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const areas = useMemo(
    () => getAreasForTeam(data, dutyColorId),
    [data, dutyColorId]
  );

  const area = areas.find((item) => item.id === areaId) || areas[0];
  const selectedAreaId = area?.id || '';

  const evaluatorColorId = isAdmin ? adminEvaluatorColorIds[0] : user.colorTeamId;
  const dutyTeam = getTeam(dutyColorId);
  const evaluatorTeam = getTeam(evaluatorColorId);
  const dateDutyTeam = getDutyTeamForDate(recordDate);

  const record = area
    ? getDutyRecord(data, recordDate, area.id, dutyColorId)
    : null;

  const scores = area
    ? getScores(data, recordDate, area.id, dutyColorId)
    : [];

  const existingScore = area
    ? getScoreByEvaluator(data, recordDate, area.id, dutyColorId, evaluatorColorId)
    : null;

  const selectableAdminAreas = useMemo(
    () => areas.filter((item) => {
      const itemRecord = getDutyRecord(data, recordDate, item.id, dutyColorId);
      return itemRecord?.status !== 'ACTIVITY';
    }),
    [areas, data, recordDate, dutyColorId]
  );

  const selectedAdminAreas = useMemo(
    () => areas.filter((item) => adminAreaIds.includes(item.id)),
    [areas, adminAreaIds]
  );

  const selectedCombinationCount =
    adminEvaluatorColorIds.length * selectedAdminAreas.length;

  function resetAdminSelection() {
    setAdminAreaIds([]);
    setAdminAreaScores({});
    setAdminAreaNotes({});
    setBulkScoreValue('');
  }

  function handleDateChange(value) {
    setRecordDate(value);

    if (!isAdmin) {
      setDutyColorId(getInitialDutyTeamId(value));
    } else {
      resetAdminSelection();
    }

    setAreaId('');
    setMessage('');
  }

  function handleDutyColorChange(value) {
    setDutyColorId(value);
    setAreaId('');
    setMessage('');
    resetAdminSelection();
  }

  function toggleAdminEvaluator(teamId) {
    setAdminEvaluatorColorIds((current) => (
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId]
    ));
    setMessage('');
  }

  function toggleAllAdminEvaluators() {
    setAdminEvaluatorColorIds((current) => (
      current.length === colorTeams.length
        ? []
        : colorTeams.map((team) => team.id)
    ));
    setMessage('');
  }

  function toggleAdminArea(areaItem) {
    const itemRecord = getDutyRecord(data, recordDate, areaItem.id, dutyColorId);
    if (itemRecord?.status === 'ACTIVITY') return;

    setAdminAreaIds((current) => {
      const isSelected = current.includes(areaItem.id);
      return isSelected
        ? current.filter((id) => id !== areaItem.id)
        : [...current, areaItem.id];
    });

    setMessage('');
  }

  function toggleAllAdminAreas() {
    const selectableIds = selectableAdminAreas.map((item) => item.id);
    const allSelected =
      selectableIds.length > 0 &&
      selectableIds.every((id) => adminAreaIds.includes(id));

    setAdminAreaIds(allSelected ? [] : selectableIds);
    setMessage('');
  }

  function updateAdminAreaScore(areaItemId, value) {
    setAdminAreaScores((current) => ({
      ...current,
      [areaItemId]: value
    }));
  }

  function updateAdminAreaNote(areaItemId, value) {
    setAdminAreaNotes((current) => ({
      ...current,
      [areaItemId]: value
    }));
  }

  function applyBulkScore() {
    const score = normalizeScore(bulkScoreValue);

    if (score === null) {
      setMessage('กรุณากรอกคะแนนรวมที่ต้องการใช้กับพื้นที่ที่เลือก');
      return;
    }

    if (!adminAreaIds.length) {
      setMessage('กรุณาติ๊กเลือกพื้นที่ก่อนใช้คะแนนเดียวกัน');
      return;
    }

    setAdminAreaScores((current) => {
      const next = { ...current };
      adminAreaIds.forEach((selectedId) => {
        next[selectedId] = String(score);
      });
      return next;
    });

    setMessage(`ใส่คะแนน ${score} ให้พื้นที่ที่เลือก ${adminAreaIds.length} พื้นที่แล้ว กรุณาตรวจสอบก่อนบันทึก`);
  }

  async function handlePresidentSubmit(event) {
    event.preventDefault();
    if (!area || !evaluatorColorId) return;

    setBusy(true);
    setMessage('');

    try {
      const cleanScore = normalizeScore(scoreValue);
      if (cleanScore === null) {
        throw new Error('กรุณากรอกคะแนน 0-10');
      }

      const scoreId = `${recordDate}-${area.id}-${dutyColorId}-${evaluatorColorId}`;
      const oldScore = existingScore;
      const nextScore = {
        id: scoreId,
        recordDate,
        areaId: area.id,
        room: area.roomsByTeam[dutyColorId],
        dutyColorId,
        evaluatorColorId,
        cleanScore,
        scoreNote,
        submittedBy: user.id,
        submittedName: user.displayName,
        submittedAt: oldScore?.submittedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await upsertCleanScore(nextScore);

      const log = {
        id: `log-${Date.now()}`,
        editedAt: new Date().toISOString(),
        action: oldScore ? 'UPDATE_CLEAN_SCORE' : 'CREATE_CLEAN_SCORE',
        tableName: 'cleanScores',
        recordId: scoreId,
        oldData: oldScore || null,
        newData: nextScore,
        editedBy: user.displayName
      };

      try {
        await insertEditLog(log);
      } catch {
        // ไม่ให้ log ทำให้การบันทึกหลักล้มเหลว
      }

      const nextScores = oldScore
        ? data.cleanScores.map((item) => item.id === oldScore.id ? nextScore : item)
        : [nextScore, ...data.cleanScores];

      let nextData = { ...data, cleanScores: nextScores };
      nextData = addLog(nextData, log);
      setData(nextData);

      try {
        await refreshData();
      } catch {
        // ใช้ข้อมูลในหน้าจอต่อได้
      }

      setMessage('บันทึกคะแนนความสะอาดในระบบเรียบร้อยแล้ว');
    } catch (error) {
      setMessage(`บันทึกไม่สำเร็จ: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleAdminBulkSubmit(event) {
    event.preventDefault();
    setMessage('');

    if (!adminEvaluatorColorIds.length) {
      setMessage('กรุณาติ๊กเลือกสิทธิ์ประธานคณะสีอย่างน้อย 1 สี');
      return;
    }

    if (!selectedAdminAreas.length) {
      setMessage('กรุณาติ๊กเลือกพื้นที่อย่างน้อย 1 พื้นที่');
      return;
    }

    const invalidArea = selectedAdminAreas.find((item) => (
      normalizeScore(adminAreaScores[item.id]) === null
    ));

    if (invalidArea) {
      setMessage(`กรุณากรอกคะแนน 0-10 สำหรับห้อง ${invalidArea.roomsByTeam[dutyColorId]}`);
      return;
    }

    setBusy(true);

    try {
      const timestamp = new Date().toISOString();
      const nextScores = [];
      const logs = [];

      selectedAdminAreas.forEach((selectedArea) => {
        const cleanScore = normalizeScore(adminAreaScores[selectedArea.id]);
        const scoreNote = String(adminAreaNotes[selectedArea.id] || '').trim();

        adminEvaluatorColorIds.forEach((selectedEvaluatorId) => {
          const selectedEvaluatorTeam = getTeam(selectedEvaluatorId);
          const oldScore = getScoreByEvaluator(
            data,
            recordDate,
            selectedArea.id,
            dutyColorId,
            selectedEvaluatorId
          );

          const scoreId =
            `${recordDate}-${selectedArea.id}-${dutyColorId}-${selectedEvaluatorId}`;

          const nextScore = {
            id: scoreId,
            recordDate,
            areaId: selectedArea.id,
            room: selectedArea.roomsByTeam[dutyColorId],
            dutyColorId,
            evaluatorColorId: selectedEvaluatorId,
            cleanScore,
            scoreNote,
            submittedBy: user.id,
            submittedName:
              `${user.displayName} (แทน${selectedEvaluatorTeam?.shortName || selectedEvaluatorId})`,
            submittedAt: oldScore?.submittedAt || timestamp,
            updatedAt: timestamp
          };

          nextScores.push(nextScore);

          logs.push({
            id: `log-${Date.now()}-${logs.length}`,
            editedAt: timestamp,
            action: oldScore ? 'UPDATE_CLEAN_SCORE' : 'CREATE_CLEAN_SCORE',
            tableName: 'cleanScores',
            recordId: scoreId,
            oldData: oldScore || null,
            newData: nextScore,
            editedBy:
              `${user.displayName} ใช้สิทธิ์แทน${selectedEvaluatorTeam?.shortName || selectedEvaluatorId}`
          });
        });
      });

      await upsertCleanScores(nextScores);

      try {
        await insertEditLogs(logs);
      } catch {
        // ไม่ให้ log ทำให้การบันทึกคะแนนหลักล้มเหลว
      }

      const scoreMap = new Map(data.cleanScores.map((item) => [item.id, item]));
      nextScores.forEach((item) => scoreMap.set(item.id, item));

      let nextData = {
        ...data,
        cleanScores: Array.from(scoreMap.values())
      };

      logs.forEach((log) => {
        nextData = addLog(nextData, log);
      });

      setData(nextData);

      try {
        await refreshData();
      } catch {
        // ใช้ข้อมูลในหน้าจอต่อได้
      }

      setMessage(
        `บันทึกเรียบร้อย ${nextScores.length} คะแนน ` +
        `(${selectedAdminAreas.length} พื้นที่ × ${adminEvaluatorColorIds.length} สิทธิ์)`
      );
    } catch (error) {
      setMessage(`บันทึกไม่สำเร็จ: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  const average = scores.length
    ? scores.reduce((sum, item) => sum + Number(item.cleanScore || 0), 0) / scores.length
    : 0;

  if (isAdmin) {
    const allEvaluatorSelected =
      adminEvaluatorColorIds.length === colorTeams.length;

    const allAreaSelected =
      selectableAdminAreas.length > 0 &&
      selectableAdminAreas.every((item) => adminAreaIds.includes(item.id));

    return (
      <section className="page-shell clean-score-page">
        <div className="hero-card">
          <div>
            <span className="eyebrow">Admin Bulk Score</span>
            <h2>ให้คะแนนความสะอาดแบบเช็กลิสต์</h2>
            <p>
              เลือกวันที่ คณะสีที่ตรวจ สิทธิ์ประธาน และพื้นที่ได้หลายรายการ
              จากนั้นกำหนดคะแนนของแต่ละพื้นที่ก่อนบันทึกครั้งเดียว
            </p>
            <div className="badge-row">
              {dutyTeam ? (
                <TeamBadge
                  teamId={dutyTeam.id}
                  label={`คณะสีที่ตรวจ: ${dutyTeam.shortName}`}
                />
              ) : null}
              {dateDutyTeam ? (
                <TeamBadge
                  teamId={dateDutyTeam.id}
                  label={`เวรตามวันจริง: ${dateDutyTeam.shortName}`}
                />
              ) : null}
              <span className="chip info">
                เลือก {adminEvaluatorColorIds.length} สิทธิ์
              </span>
              <span className="chip info">
                เลือก {selectedAdminAreas.length} พื้นที่
              </span>
            </div>
          </div>
        </div>

        {message ? (
          <div className={
            message.includes('ไม่สำเร็จ') || message.includes('กรุณา')
              ? 'alert danger'
              : 'alert success'
          }>
            {message}
          </div>
        ) : null}

        <form className="form-card admin-bulk-score-form" onSubmit={handleAdminBulkSubmit}>
          <div className="form-grid">
            <label>
              วันที่
              <input
                type="date"
                value={recordDate}
                onChange={(event) => handleDateChange(event.target.value)}
              />
            </label>

            <label>
              คณะสีที่ต้องการให้คะแนน
              <select
                value={dutyColorId}
                onChange={(event) => handleDutyColorChange(event.target.value)}
              >
                {colorTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="info-panel">
            <strong>
              วันที่เลือก: {formatThaiDate(recordDate)} • {getDayLabel(recordDate)}
            </strong>
            <p>
              Admin สามารถเลือกใช้สิทธิ์แทนประธานได้ตั้งแต่ 1–5 สี
              และเลือกพื้นที่ที่จะให้คะแนนได้หลายพื้นที่
            </p>
          </div>

          <section className="bulk-score-section">
            <div className="bulk-score-section-head">
              <div>
                <span className="bulk-step">ขั้นที่ 1</span>
                <h3>ติ๊กเลือกสิทธิ์ประธานคณะสี</h3>
                <p>คะแนนของทุกพื้นที่ที่เลือกจะถูกบันทึกในนามสิทธิ์ที่ติ๊กไว้</p>
              </div>
              <button
                className="btn btn-ghost btn-small"
                type="button"
                onClick={toggleAllAdminEvaluators}
              >
                {allEvaluatorSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้ง 5 สี'}
              </button>
            </div>

            <div className="evaluator-check-grid">
              {colorTeams.map((team) => {
                const checked = adminEvaluatorColorIds.includes(team.id);
                return (
                  <label
                    key={team.id}
                    className={`bulk-check-card ${checked ? 'selected' : ''}`}
                    style={{
                      '--accent': team.accentColor,
                      '--soft': team.softColor
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAdminEvaluator(team.id)}
                    />
                    <TeamBadge teamId={team.id} />
                    <span>{checked ? 'เลือกใช้สิทธิ์แล้ว' : 'ยังไม่เลือก'}</span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="bulk-score-section">
            <div className="bulk-score-section-head">
              <div>
                <span className="bulk-step">ขั้นที่ 2</span>
                <h3>ติ๊กเลือกพื้นที่และกำหนดคะแนน</h3>
                <p>
                  ใส่คะแนนรายพื้นที่ได้ หรือใช้ช่องคะแนนเดียวกันกับพื้นที่ที่เลือก
                </p>
              </div>
              <button
                className="btn btn-ghost btn-small"
                type="button"
                onClick={toggleAllAdminAreas}
              >
                {allAreaSelected ? 'ยกเลิกทุกพื้นที่' : 'เลือกทุกพื้นที่'}
              </button>
            </div>

            <div className="bulk-score-apply">
              <label>
                คะแนนเดียวสำหรับพื้นที่ที่ติ๊ก
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.25"
                  value={bulkScoreValue}
                  onChange={(event) => setBulkScoreValue(event.target.value)}
                  placeholder="0-10"
                />
              </label>
              <button
                className="btn btn-primary"
                type="button"
                onClick={applyBulkScore}
              >
                ใช้คะแนนนี้กับพื้นที่ที่เลือก
              </button>
            </div>

            <div className="bulk-area-list">
              {areas.map((areaItem) => {
                const itemRecord = getDutyRecord(
                  data,
                  recordDate,
                  areaItem.id,
                  dutyColorId
                );
                const itemScores = getScores(
                  data,
                  recordDate,
                  areaItem.id,
                  dutyColorId
                );
                const isActivity = itemRecord?.status === 'ACTIVITY';
                const checked = adminAreaIds.includes(areaItem.id);
                const room = areaItem.roomsByTeam[dutyColorId];

                return (
                  <article
                    key={areaItem.id}
                    className={[
                      'bulk-area-row',
                      checked ? 'selected' : '',
                      isActivity ? 'disabled' : ''
                    ].filter(Boolean).join(' ')}
                  >
                    <label className="bulk-area-selector">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isActivity}
                        onChange={() => toggleAdminArea(areaItem)}
                      />
                      <span className="bulk-area-number">
                        ห้อง {room}
                      </span>
                      <strong>{areaItem.areaName}</strong>
                    </label>

                    <div className="bulk-area-meta">
                      <span>
                        สถานะ: {itemRecord
                          ? STATUS_LABELS[itemRecord.status] || itemRecord.status
                          : 'ยังไม่มีข้อมูลการมาทำเวร'}
                      </span>
                      <span>คะแนนปัจจุบัน: {itemScores.length}/5 สี</span>
                      {isActivity ? (
                        <span className="status-note">
                          ยกเว้น ไม่ต้องให้คะแนน
                        </span>
                      ) : null}
                    </div>

                    <div className="bulk-area-inputs">
                      <label>
                        คะแนน /10
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.25"
                          value={adminAreaScores[areaItem.id] ?? ''}
                          onChange={(event) =>
                            updateAdminAreaScore(areaItem.id, event.target.value)
                          }
                          disabled={!checked || isActivity}
                          placeholder="0-10"
                        />
                      </label>

                      <label>
                        เหตุผล / หมายเหตุ
                        <input
                          value={adminAreaNotes[areaItem.id] ?? ''}
                          onChange={(event) =>
                            updateAdminAreaNote(areaItem.id, event.target.value)
                          }
                          disabled={!checked || isActivity}
                          placeholder="ระบุเหตุผลของพื้นที่นี้"
                        />
                      </label>
                    </div>

                    <div className="bulk-area-photo">
                      <PhotoPreview
                        src={itemRecord?.photo}
                        thumb={itemRecord?.photoThumb}
                        compact
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="bulk-score-summary">
            <div>
              <span>สิทธิ์ที่เลือก</span>
              <strong>{adminEvaluatorColorIds.length} /5 สี</strong>
            </div>
            <div>
              <span>พื้นที่ที่เลือก</span>
              <strong>{selectedAdminAreas.length} พื้นที่</strong>
            </div>
            <div>
              <span>จำนวนคะแนนที่จะบันทึก</span>
              <strong>{selectedCombinationCount} รายการ</strong>
            </div>
          </div>

          <div className="alert warning">
            การบันทึกจะเพิ่มหรืออัปเดตคะแนนเดิมตาม
            วันที่ + พื้นที่ + คณะสีที่ตรวจ + สิทธิ์ประธาน
          </div>

          <button
            className="btn btn-primary btn-wide"
            type="submit"
            disabled={
              busy ||
              !adminEvaluatorColorIds.length ||
              !selectedAdminAreas.length
            }
          >
            {busy
              ? 'กำลังบันทึกคะแนนทั้งหมด...'
              : `บันทึก ${selectedCombinationCount} รายการ`}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="page-shell clean-score-page">
      <div className="hero-card">
        <div>
          <span className="eyebrow">Clean Score</span>
          <h2>ให้คะแนนความสะอาด</h2>
          <p>เลือกวันที่แล้วระบบจะแสดงคณะสีเวรของวันนั้นอัตโนมัติ</p>
          <div className="badge-row">
            <TeamBadge
              teamId={evaluatorTeam?.id}
              label={`ผู้ประเมิน: ${evaluatorTeam?.shortName || ''}`}
            />
            {dutyTeam ? (
              <TeamBadge
                teamId={dutyTeam.id}
                label={`คณะสีที่ตรวจ: ${dutyTeam.shortName}`}
              />
            ) : null}
          </div>
        </div>
      </div>

      {message ? (
        <div className={message.includes('ไม่สำเร็จ') ? 'alert danger' : 'alert success'}>
          {message}
        </div>
      ) : null}

      <form className="form-card" onSubmit={handlePresidentSubmit}>
        <div className="form-grid">
          <label>
            วันที่
            <input
              type="date"
              value={recordDate}
              onChange={(event) => handleDateChange(event.target.value)}
            />
          </label>

          <label>
            คณะสีเวรตามวันที่
            <select value={dutyColorId} disabled>
              {colorTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            ห้องเรียน / พื้นที่
            <select
              value={selectedAreaId}
              onChange={(event) => setAreaId(event.target.value)}
            >
              {areas.map((item) => (
                <option key={item.id} value={item.id}>
                  ห้อง {item.roomsByTeam[dutyColorId]} — {item.areaName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="info-panel">
          <strong>
            วันที่เลือก: {formatThaiDate(recordDate)} • {getDayLabel(recordDate)}
          </strong>
          <p>
            ระบบล็อกคณะสีเวรตามวันที่โดยอัตโนมัติ
            เพื่อให้การให้คะแนนตรงกับเวรประจำวัน
          </p>
        </div>

        {area ? (
          <div className="info-panel">
            <TeamBadge teamId={dutyTeam?.id} />
            <strong>ห้อง {area.roomsByTeam[dutyColorId]}</strong>
            <p>{area.areaName}</p>
            <div className="mini-grid">
              <span>
                สถานะ: {record
                  ? STATUS_LABELS[record.status] || record.status
                  : 'ยังไม่มีข้อมูลการมาทำเวร'}
              </span>
              <span>จำนวนคน: {record?.studentCount ?? '-'} คน</span>
              <span>คะแนนประธาน: {scores.length}/5 สี</span>
              <span>เฉลี่ยปัจจุบัน: {average.toFixed(2)} /10</span>
            </div>
          </div>
        ) : null}

        <div className="score-photo-box">
          <PhotoPreview
            src={record?.photo}
            thumb={record?.photoThumb}
            compact
          />
        </div>

        <label>
          คะแนนความสะอาด /10
          <input
            type="number"
            min="0"
            max="10"
            step="0.25"
            value={scoreValue}
            onChange={(event) => setScoreValue(event.target.value)}
            placeholder="กรอกคะแนน 0-10"
            required
          />
        </label>

        <label>
          หมายเหตุการให้คะแนน
          <textarea
            value={scoreNote}
            onChange={(event) => setScoreNote(event.target.value)}
            placeholder="เช่น พื้นที่สะอาดดี แต่ยังมีเศษใบไม้เล็กน้อย"
          />
        </label>

        {existingScore ? (
          <div className="alert info">
            มีคะแนนของสีนี้แล้ว หากบันทึกอีกครั้ง ระบบจะอัปเดตคะแนนเดิม
          </div>
        ) : null}

        <button
          className="btn btn-primary btn-wide"
          type="submit"
          disabled={busy}
        >
          {busy ? 'กำลังบันทึก...' : 'บันทึกคะแนนความสะอาด'}
        </button>
      </form>
    </section>
  );
}
