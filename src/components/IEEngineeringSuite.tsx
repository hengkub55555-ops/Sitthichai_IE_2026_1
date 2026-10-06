import React, { useState, useMemo } from 'react';
import {
  COMPONENT_LIST,
  ComputedModelRow,
  ComponentKey,
  TimeUnit,
  getUnitDivisor,
  getUnitLabel,
} from '../data/plant9771Data';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Layers,
  Gauge,
  Users,
  Wrench,
} from 'lucide-react';

interface IEEngineeringSuiteProps {
  rows: ComputedModelRow[];
  shiftHours: number;
  efficiencyPct: number;
  timeUnit: TimeUnit;
  onSyncAllStd: () => void;
  onApplyKaizen: (
    fgLabReductionPct: number,
    cabLabReductionPct: number,
    doorLabReductionPct: number,
    mcReductionPct: number
  ) => void;
}

export const IEEngineeringSuite: React.FC<IEEngineeringSuiteProps> = ({
  rows,
  shiftHours,
  efficiencyPct,
  timeUnit,
  onSyncAllStd,
  onApplyKaizen,
}) => {
  const [selectedModelId, setSelectedModelId] = useState<string>('ALL');
  const [numLines, setNumLines] = useState<number>(4);
  const [shiftsPerDay, setShiftsPerDay] = useState<number>(2);
  const [workingDays, setWorkingDays] = useState<number>(25);
  const [allowancePct, setAllowancePct] = useState<number>(5);

  // Kaizen What-If sliders
  const [fgKaizenPct, setFgKaizenPct] = useState<number>(10);
  const [cabKaizenPct, setCabKaizenPct] = useState<number>(8);
  const [doorKaizenPct, setDoorKaizenPct] = useState<number>(12);
  const [mcKaizenPct, setMcKaizenPct] = useState<number>(5);

  const unitDiv = getUnitDivisor(timeUnit);
  const unitLabel = getUnitLabel(timeUnit);

  // Station workload & Yamazumi calculation
  const stationAnalysis = useMemo(() => {
    const effectiveSecPerShiftPerson =
      Math.max(0.1, shiftHours) * 3600 * (Math.max(1, efficiencyPct) / 100);

    const targetRows =
      selectedModelId === 'ALL'
        ? rows
        : rows.filter((r) => r.id === selectedModelId);

    const totalPlanQty = targetRows.reduce((acc, r) => acc + r.planQty, 0);

    // Available line seconds across the planning horizon (e.g. monthly or batch horizon)
    // For single-shift Takt reference: Available seconds per shift across active lines
    const availableShiftSecondsAllLines =
      effectiveSecPerShiftPerson * Math.max(1, numLines) * Math.max(1, shiftsPerDay) * Math.max(1, workingDays);

    const taktTimeSec =
      totalPlanQty > 0 ? availableShiftSecondsAllLines / totalPlanQty : 0;

    const stations = COMPONENT_LIST.map((comp) => {
      let weightedMcSec = 0;
      let weightedLabSec = 0;

      for (const r of targetRows) {
        const pair = r.components[comp.key];
        weightedMcSec += (pair?.mc || 0) * r.planQty;
        weightedLabSec += (pair?.lab || 0) * r.planQty;
      }

      const avgMcPerUnit = totalPlanQty > 0 ? weightedMcSec / totalPlanQty : 0;
      const avgLabPerUnit = totalPlanQty > 0 ? weightedLabSec / totalPlanQty : 0;
      const avgTotalPerUnit = avgMcPerUnit + avgLabPerUnit;

      // Required MP for this station (single shift basis matching Master Table formula)
      const stationReqMp = weightedLabSec / effectiveSecPerShiftPerson;
      const recommendedHeads = Math.ceil(
        stationReqMp * (1 + allowancePct / 100)
      );

      // Operator cycle time if balanced across recommended operators per line
      const headsPerLineShift = Math.max(
        1,
        Math.round(recommendedHeads / Math.max(1, numLines * shiftsPerDay))
      );
      const effectiveCycleTimeSec =
        avgLabPerUnit > 0 ? avgLabPerUnit / headsPerLineShift : 0;

      return {
        ...comp,
        weightedMcSec,
        weightedLabSec,
        weightedTotalSec: weightedMcSec + weightedLabSec,
        avgMcPerUnit,
        avgLabPerUnit,
        avgTotalPerUnit,
        stationReqMp,
        recommendedHeads,
        headsPerLineShift,
        effectiveCycleTimeSec,
      };
    });

    const activeStations = stations.filter((s) => s.avgTotalPerUnit > 0);
    const maxStationTime = Math.max(
      ...activeStations.map((s) => s.avgTotalPerUnit),
      1
    );
    const sumStationTime = activeStations.reduce(
      (acc, s) => acc + s.avgTotalPerUnit,
      0
    );

    // Line Balance Efficiency (LBE) across active sub-assembly groups
    const lbePct =
      activeStations.length > 0 && maxStationTime > 0
        ? (sumStationTime / (activeStations.length * maxStationTime)) * 100
        : 0;

    // Smoothness Index (SI)
    const smoothnessIndex = Math.sqrt(
      activeStations.reduce(
        (acc, s) => acc + Math.pow(maxStationTime - s.avgTotalPerUnit, 2),
        0
      )
    );

    const bottleneck =
      activeStations.length > 0
        ? activeStations.reduce((prev, curr) =>
            curr.avgTotalPerUnit > prev.avgTotalPerUnit ? curr : prev
          )
        : null;

    return {
      stations,
      activeStations,
      totalPlanQty,
      taktTimeSec,
      maxStationTime,
      sumStationTime,
      lbePct,
      smoothnessIndex,
      bottleneck,
    };
  }, [
    rows,
    selectedModelId,
    shiftHours,
    efficiencyPct,
    numLines,
    shiftsPerDay,
    workingDays,
    allowancePct,
  ]);

  // Kaizen simulation impact calculation
  const kaizenSimulation = useMemo(() => {
    const effectiveSecPerPerson =
      Math.max(0.1, shiftHours) * 3600 * (Math.max(1, efficiencyPct) / 100);

    let currentLabSec = 0;
    let simulatedLabSec = 0;
    let currentMcSec = 0;
    let simulatedMcSec = 0;

    for (const r of rows) {
      for (const comp of COMPONENT_LIST) {
        const mc = r.components[comp.key]?.mc || 0;
        const lab = r.components[comp.key]?.lab || 0;

        currentMcSec += mc * r.planQty;
        currentLabSec += lab * r.planQty;

        const labFactor =
          comp.group === 'FG'
            ? 1 - fgKaizenPct / 100
            : comp.group === 'CAB'
            ? 1 - cabKaizenPct / 100
            : 1 - doorKaizenPct / 100;

        simulatedLabSec += lab * labFactor * r.planQty;
        simulatedMcSec += mc * (1 - mcKaizenPct / 100) * r.planQty;
      }
    }

    const currentMp = currentLabSec / effectiveSecPerPerson;
    const newMp = simulatedLabSec / effectiveSecPerPerson;
    const savedMp = currentMp - newMp;
    const savedLabHours = (currentLabSec - simulatedLabSec) / 3600;
    const savedMcHours = (currentMcSec - simulatedMcSec) / 3600;

    return {
      currentMp,
      newMp,
      savedMp,
      savedLabHours,
      savedMcHours,
      reductionPct:
        currentLabSec > 0
          ? ((currentLabSec - simulatedLabSec) / currentLabSec) * 100
          : 0,
    };
  }, [
    rows,
    shiftHours,
    efficiencyPct,
    fgKaizenPct,
    cabKaizenPct,
    doorKaizenPct,
    mcKaizenPct,
  ]);

  const auditDiscrepancies = useMemo(() => {
    return rows.filter(
      (r) =>
        Math.abs(r.sumMc - r.stdMc) > 0.05 ||
        Math.abs(r.sumLab - r.stdLab) > 0.05
    );
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Section 1: Yamazumi Line Balancing & Takt Time Analyzer */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-emerald-700" />
              <span>
                01. Yamazumi Chart & Line Balancing Analysis (วิเคราะห์สมดุลสายการผลิตและคอขวด)
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              เปรียบเทียบเวลางานรายสถานี (FG, CAB, DOOR Sub-assy) เทียบกับ Takt Time และจัดสรรจำนวนคน (Manpower Allocation)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 text-slate-700 font-medium">
              <span>เลือก Model:</span>
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="ALL">ทุก Model ถ่วงน้ำหนัก Plan Qty (Plant Mix)</option>
                {rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.model} (Plan: {r.planQty.toLocaleString()})
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-1.5 text-slate-700">
              <span>จำนวน Line:</span>
              <input
                type="number"
                min={1}
                max={20}
                value={numLines}
                onChange={(e) => setNumLines(Math.max(1, Number(e.target.value)))}
                className="w-14 border border-slate-300 rounded px-2 py-1 text-right font-mono-tabular bg-amber-50/60"
              />
            </label>

            <label className="flex items-center gap-1.5 text-slate-700">
              <span>กะ/วัน:</span>
              <input
                type="number"
                min={1}
                max={3}
                value={shiftsPerDay}
                onChange={(e) =>
                  setShiftsPerDay(Math.max(1, Number(e.target.value)))
                }
                className="w-12 border border-slate-300 rounded px-2 py-1 text-right font-mono-tabular bg-amber-50/60"
              />
            </label>

            <label className="flex items-center gap-1.5 text-slate-700">
              <span>Allowance (PFD %):</span>
              <input
                type="number"
                min={0}
                max={30}
                value={allowancePct}
                onChange={(e) =>
                  setAllowancePct(Math.max(0, Number(e.target.value)))
                }
                className="w-14 border border-slate-300 rounded px-2 py-1 text-right font-mono-tabular bg-amber-50/60"
              />
            </label>
          </div>
        </div>

        {/* IE Line Balancing KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 my-4">
          <div className="border border-slate-200 rounded-md p-3 bg-slate-50/60">
            <div className="text-[11px] text-slate-500">
              Bottleneck Process (คอขวดหลัก)
            </div>
            <div className="text-lg font-bold text-rose-700 font-mono-tabular mt-0.5">
              {stationAnalysis.bottleneck?.label || '-'}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {stationAnalysis.bottleneck
                ? `${(
                    stationAnalysis.bottleneck.avgTotalPerUnit / unitDiv
                  ).toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })} ${unitLabel}/คัน`
                : '-'}
            </div>
          </div>

          <div className="border border-slate-200 rounded-md p-3 bg-slate-50/60">
            <div className="text-[11px] text-slate-500">
              Line Balance Eff. (LBE %)
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono-tabular mt-0.5">
              {stationAnalysis.lbePct.toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-500">
              Balance Loss {(100 - stationAnalysis.lbePct).toFixed(1)}%
            </div>
          </div>

          <div className="border border-slate-200 rounded-md p-3 bg-slate-50/60">
            <div className="text-[11px] text-slate-500">
              Total Cycle Time เฉลี่ย/คัน
            </div>
            <div className="text-lg font-bold text-slate-900 font-mono-tabular mt-0.5">
              {(stationAnalysis.sumStationTime / unitDiv).toLocaleString(
                undefined,
                { maximumFractionDigits: 1 }
              )}
            </div>
            <div className="text-[11px] text-slate-500">
              หน่วย: {unitLabel} (MC + Labor)
            </div>
          </div>

          <div className="border border-slate-200 rounded-md p-3 bg-slate-50/60">
            <div className="text-[11px] text-slate-500">
              Plant Takt Time (เป้าหมาย/คัน)
            </div>
            <div className="text-lg font-bold text-emerald-700 font-mono-tabular mt-0.5">
              {stationAnalysis.taktTimeSec.toFixed(1)} วินาที
            </div>
            <div className="text-[11px] text-slate-500">
              ที่ {numLines} สายการผลิต × {shiftsPerDay} กะ ({workingDays} วัน)
            </div>
          </div>

          <div className="border border-slate-200 rounded-md p-3 bg-slate-50/60">
            <div className="text-[11px] text-slate-500">
              MP รวมเผื่อ PFD ({allowancePct}%)
            </div>
            <div className="text-lg font-bold text-amber-700 font-mono-tabular mt-0.5">
              {stationAnalysis.stations
                .reduce((acc, s) => acc + s.recommendedHeads, 0)
                .toLocaleString()}{' '}
              คน
            </div>
            <div className="text-[11px] text-slate-500">
              ปัดเศษรายสถานีพร้อม Relief Man
            </div>
          </div>
        </div>

        {/* Visual Yamazumi Vertical Stack Chart + Station Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
          <div className="lg:col-span-6 border border-slate-200 rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-800">
                Yamazumi Station Stack (เวลางานเฉลี่ยต่อคัน แยกตามสถานี - {unitLabel})
              </span>
              <div className="flex items-center gap-3 text-[11px] text-slate-600">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-[#0D7A5F] inline-block rounded-xs" />
                  MC
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-[#D97706] inline-block rounded-xs" />
                  Labor
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              {stationAnalysis.stations.map((st) => {
                const mcPct =
                  stationAnalysis.maxStationTime > 0
                    ? (st.avgMcPerUnit / stationAnalysis.maxStationTime) * 100
                    : 0;
                const labPct =
                  stationAnalysis.maxStationTime > 0
                    ? (st.avgLabPerUnit / stationAnalysis.maxStationTime) * 100
                    : 0;
                const isBottleneck =
                  stationAnalysis.bottleneck?.key === st.key &&
                  st.avgTotalPerUnit > 0;

                return (
                  <div key={st.key} className="grid grid-cols-12 items-center gap-2 text-xs">
                    <div className="col-span-2 font-medium text-slate-700 flex items-center gap-1">
                      <span className="font-mono-tabular">{st.label}</span>
                      {isBottleneck && (
                        <span className="text-[10px] text-rose-700 font-semibold">
                          [BN]
                        </span>
                      )}
                    </div>
                    <div className="col-span-8 bg-slate-100 h-4 rounded-xs overflow-hidden flex">
                      <div
                        style={{ width: `${mcPct}%` }}
                        className="bg-[#0D7A5F] h-full transition-all duration-150"
                        title={`MC: ${(st.avgMcPerUnit / unitDiv).toFixed(2)} ${unitLabel}`}
                      />
                      <div
                        style={{ width: `${labPct}%` }}
                        className="bg-[#D97706] h-full transition-all duration-150"
                        title={`Labor: ${(st.avgLabPerUnit / unitDiv).toFixed(2)} ${unitLabel}`}
                      />
                    </div>
                    <div className="col-span-2 text-right font-mono-tabular text-[11px] text-slate-700">
                      {(st.avgTotalPerUnit / unitDiv).toLocaleString(undefined, {
                        maximumFractionDigits: timeUnit === 'sec' ? 0 : 2,
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Station Manpower & Line Allocation Table */}
          <div className="lg:col-span-6 border border-slate-200 rounded-md overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 text-xs font-semibold text-slate-800 flex items-center justify-between">
              <span>ตารางจัดสรรกำลังคนรายสถานี (Station Manpower Balancing)</span>
              <span className="text-[11px] font-normal text-slate-500">
                คิดจาก Plan Qty: {stationAnalysis.totalPlanQty.toLocaleString()} คัน
              </span>
            </div>
            <div className="overflow-x-auto max-h-[340px]">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200">
                    <th className="py-1.5 px-2.5 text-left font-semibold">รหัส</th>
                    <th className="py-1.5 px-2.5 text-left font-semibold">ส่วนประกอบ</th>
                    <th className="py-1.5 px-2.5 text-right font-semibold">MC เฉลี่ย</th>
                    <th className="py-1.5 px-2.5 text-right font-semibold">Lab เฉลี่ย</th>
                    <th className="py-1.5 px-2.5 text-right font-semibold">Req. MP</th>
                    <th className="py-1.5 px-2.5 text-right font-semibold">
                      จัดคน (+PFD)
                    </th>
                    <th className="py-1.5 px-2.5 text-left font-semibold">สถานะภาระงาน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {stationAnalysis.stations.map((st) => {
                    const sharePct =
                      stationAnalysis.sumStationTime > 0
                        ? (st.avgTotalPerUnit / stationAnalysis.sumStationTime) *
                          100
                        : 0;
                    return (
                      <tr key={st.key} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2.5 font-mono-tabular text-slate-500">
                          {st.stationCode}
                        </td>
                        <td className="py-1.5 px-2.5 font-medium text-slate-900">
                          {st.label}{' '}
                          <span className="text-[11px] text-slate-500 font-normal">
                            · {st.group}
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono-tabular text-slate-700">
                          {(st.avgMcPerUnit / unitDiv).toFixed(
                            timeUnit === 'sec' ? 1 : 2
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono-tabular text-slate-700">
                          {(st.avgLabPerUnit / unitDiv).toFixed(
                            timeUnit === 'sec' ? 1 : 2
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono-tabular font-semibold text-emerald-800 bg-emerald-50/40">
                          {st.stationReqMp.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-mono-tabular font-semibold text-slate-900">
                          {st.recommendedHeads} คน
                        </td>
                        <td className="py-1.5 px-2.5 text-[11px]">
                          {sharePct > 35 ? (
                            <span className="text-rose-700 font-medium">
                              คอขวดหลัก ({sharePct.toFixed(1)}%)
                            </span>
                          ) : sharePct > 15 ? (
                            <span className="text-amber-700 font-medium">
                              ภาระงานสูง ({sharePct.toFixed(1)}%)
                            </span>
                          ) : st.avgTotalPerUnit > 0 ? (
                            <span className="text-emerald-700">
                              ปกติ ({sharePct.toFixed(1)}%)
                            </span>
                          ) : (
                            <span className="text-slate-400">ไม่มีใช้งาน</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Kaizen What-If Simulator & STD Variance Diagnostic */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kaizen / ECRS Simulator */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-700" />
                <span>
                  02. ECRS & Kaizen Manpower Reduction Simulator (จำลองการลดเวลางาน)
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ทดลองปรับลดเวลา Labor / Machine จากการทำ Kaizen, Karakuri หรือเพิ่ม Jig & Fixture
              </p>
            </div>
            <button
              onClick={() =>
                onApplyKaizen(
                  fgKaizenPct,
                  cabKaizenPct,
                  doorKaizenPct,
                  mcKaizenPct
                )
              }
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>นำค่า Kaizen ไปใช้จริงในตาราง</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-slate-700">
                    ลด Labor สถานี FG (Final Assembly):
                  </span>
                  <span className="font-mono-tabular font-semibold text-emerald-700">
                    -{fgKaizenPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={fgKaizenPct}
                  onChange={(e) => setFgKaizenPct(Number(e.target.value))}
                  className="w-full accent-emerald-700 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-slate-700">
                    ลด Labor สถานี CAB (Cabinet/Foaming):
                  </span>
                  <span className="font-mono-tabular font-semibold text-emerald-700">
                    -{cabKaizenPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={cabKaizenPct}
                  onChange={(e) => setCabKaizenPct(Number(e.target.value))}
                  className="w-full accent-emerald-700 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-slate-700">
                    ลด Labor สถานี DOOR ทั้งหมด (R/F/FL/FR/RL/RR):
                  </span>
                  <span className="font-mono-tabular font-semibold text-emerald-700">
                    -{doorKaizenPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={doorKaizenPct}
                  onChange={(e) => setDoorKaizenPct(Number(e.target.value))}
                  className="w-full accent-emerald-700 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-slate-700">
                    ลด Machine Time (Speedup / SMED):
                  </span>
                  <span className="font-mono-tabular font-semibold text-amber-700">
                    -{mcKaizenPct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={mcKaizenPct}
                  onChange={(e) => setMcKaizenPct(Number(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-md p-4 bg-slate-50/70 flex flex-col justify-between">
              <div className="text-xs font-semibold text-slate-700 mb-2">
                ผลลัพธ์จากการทำ Kaizen (Expected IE Saving)
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">MP ปัจจุบัน → หลัง Kaizen:</span>
                  <span className="font-mono-tabular font-bold text-slate-900 flex items-center gap-1">
                    {kaizenSimulation.currentMp.toFixed(2)}
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-emerald-700">
                      {kaizenSimulation.newMp.toFixed(2)} คน
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ประหยัดกำลังคน (MP Saved):</span>
                  <span className="font-mono-tabular font-bold text-emerald-700 text-sm">
                    -{kaizenSimulation.savedMp.toFixed(2)} คน (
                    {kaizenSimulation.reductionPct.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ชั่วโมงแรงงานที่ลดได้:</span>
                  <span className="font-mono-tabular font-semibold text-slate-800">
                    -{kaizenSimulation.savedLabHours.toFixed(2)} ชม.
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ชั่วโมงเครื่องจักรที่ลดได้:</span>
                  <span className="font-mono-tabular font-semibold text-slate-800">
                    -{kaizenSimulation.savedMcHours.toFixed(2)} ชม.
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                คำแนะนำ IE: เน้นทำ Kaizen ที่สถานี FG และ CAB ของตระกูล BM เนื่องจากใช้คนรวมสูงสุดถึง 419.83 คน (56% ของทั้งโรงงาน)
              </div>
            </div>
          </div>
        </div>

        {/* STD Audit & Data Integrity Diagnostic */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>03. ตรวจสอบความสอดคล้องเวลามาตรฐาน (STD Audit)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  เทียบค่า STD ตั้งต้น กับผลรวมส่วนประกอบย่อย (SUM = FG + CAB + DOOR)
                </p>
              </div>
              <button
                onClick={onSyncAllStd}
                className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-medium rounded transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
                title="ปรับค่า STD MC และ STD Labor ให้เท่ากับผลรวม SUM ของทุกส่วนประกอบ"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync STD = SUM</span>
              </button>
            </div>

            <div className="mt-3 space-y-2 max-h-[190px] overflow-y-auto">
              {auditDiscrepancies.length === 0 ? (
                <div className="p-4 text-center text-xs text-emerald-800 bg-emerald-50/60 border border-emerald-200 rounded-md">
                  ข้อมูล STD MC และ STD Labor ของทุก Model ตรงกับผลรวมส่วนประกอบย่อย (SUM) 100%
                </div>
              ) : (
                auditDiscrepancies.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 border border-amber-200 bg-amber-50/50 rounded-md flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900">
                        Model: {item.model}
                      </span>
                      <div className="text-[11px] text-slate-600 mt-0.5 font-mono-tabular">
                        STD ({item.stdMc.toFixed(0)} / {item.stdLab.toFixed(0)} ={' '}
                        {item.stdTotal.toFixed(0)}) ≠ SUM (
                        {item.sumMc.toFixed(1)} / {item.sumLab.toFixed(1)} ={' '}
                        {item.sumTotal.toFixed(1)})
                      </div>
                    </div>
                    <span className="font-mono-tabular font-bold text-amber-800">
                      Δ STD: {item.deltaStd > 0 ? `+${item.deltaStd}` : item.deltaStd}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800">
              หลักเกณฑ์วิศวกรรมอุตสาหการ (IE Standard Practice):
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              • ค่า |Δ STD| ≤ 1 วินาที เกิดจากการปัดเศษทศนิยม 3 ตำแหน่งของแต่ละ Sub-assembly (เช่น SBS550 มี SUM MC = 1,968.996 วินาที เทียบกับ STD MC = 1,970 วินาที)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
