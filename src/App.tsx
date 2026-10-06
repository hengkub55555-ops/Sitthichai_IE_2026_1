/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  COMPONENT_LIST,
  DOOR_COMPONENT_LIST,
  INITIAL_PLANT_9771_MODELS,
  ModelRow,
  ComponentKey,
  TimeUnit,
  computeModelMetrics,
  getUnitDivisor,
  getUnitLabel,
} from './data/plant9771Data';
import { IEEngineeringSuite } from './components/IEEngineeringSuite';
import {
  Search,
  Plus,
  Download,
  RotateCcw,
  Copy,
  X,
} from 'lucide-react';

type TableTab = 'Master' | 'FG' | 'CAB' | 'DOOR' | 'SUM';
type WorkspaceView = 'ALL' | 'MASTER_ONLY' | 'IE_ANALYSIS';

export default function App() {
  const [models, setModels] = useState<ModelRow[]>(() =>
    structuredClone(INITIAL_PLANT_9771_MODELS)
  );
  const [shiftHours, setShiftHours] = useState<number>(8);
  const [efficiencyPct, setEfficiencyPct] = useState<number>(85);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('sec');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TableTab>('Master');
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('ALL');
  const [highlightedModelId, setHighlightedModelId] = useState<string | null>(
    null
  );

  const unitDiv = getUnitDivisor(timeUnit);
  const unitLabel = getUnitLabel(timeUnit);

  // Format up to 1 decimal place, stripping trailing .0 (e.g. 2,331 or 923.3)
  const fmt1 = (secVal: number) => {
    const val = secVal / unitDiv;
    return Number(val.toFixed(1)).toLocaleString('en-US', {
      maximumFractionDigits: 1,
    });
  };

  // Format percentage up to 1 decimal place, stripping trailing .0 (e.g. 33% or 48.2%)
  const fmtPct = (pctVal: number) => {
    return `${Number(pctVal.toFixed(1))}%`;
  };

  // Format raw input value for editable cells
  const formatVal = (secVal: number, decimalsIfConverted = 3) => {
    const converted = secVal / unitDiv;
    if (timeUnit === 'sec') {
      return Number(converted.toFixed(4)).toString();
    }
    return Number(converted.toFixed(decimalsIfConverted)).toString();
  };

  // Compute all rows
  const computedRows = useMemo(() => {
    return models.map((m) =>
      computeModelMetrics(m, shiftHours, efficiencyPct)
    );
  }, [models, shiftHours, efficiencyPct]);

  // Filtered rows by search query
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return computedRows;
    return computedRows.filter(
      (r) =>
        r.model.toLowerCase().includes(q) ||
        r.family.toLowerCase().includes(q)
    );
  }, [computedRows, searchQuery]);

  // Plant-wide summary metrics & unweighted/weighted component totals
  const summary = useMemo(() => {
    const count = filteredRows.length;
    let totalPlanQty = 0;
    let totalMcHours = 0;
    let totalLabHours = 0;
    let totalReqMp = 0;

    let sumOfModelMc = 0;
    let sumOfModelLab = 0;
    let sumOfModelTotal = 0;

    let sumFgMc = 0;
    let sumFgLab = 0;
    let sumCabMc = 0;
    let sumCabLab = 0;
    let sumDoorMc = 0;
    let sumDoorLab = 0;

    let maxModel = filteredRows[0] || null;
    let minModel = filteredRows[0] || null;
    let deltaOverOneCount = 0;

    for (const r of filteredRows) {
      totalPlanQty += r.planQty;
      totalMcHours += r.mcHoursTotal;
      totalLabHours += r.labHoursTotal;
      totalReqMp += r.reqMp;

      sumOfModelMc += r.sumMc;
      sumOfModelLab += r.sumLab;
      sumOfModelTotal += r.sumTotal;

      sumFgMc += r.components.FG?.mc || 0;
      sumFgLab += r.components.FG?.lab || 0;
      sumCabMc += r.components.CAB?.mc || 0;
      sumCabLab += r.components.CAB?.lab || 0;
      sumDoorMc += r.doorSumMc;
      sumDoorLab += r.doorSumLab;

      if (!maxModel || r.sumTotal > maxModel.sumTotal) {
        maxModel = r;
      }
      if (!minModel || r.sumTotal < minModel.sumTotal) {
        minModel = r;
      }
      if (Math.abs(r.deltaStd) > 1) {
        deltaOverOneCount += 1;
      }
    }

    const avgMc = count > 0 ? sumOfModelMc / count : 0;
    const avgLab = count > 0 ? sumOfModelLab / count : 0;
    const avgTotal = count > 0 ? sumOfModelTotal / count : 0;
    const laborToMcRatio = sumOfModelMc > 0 ? sumOfModelLab / sumOfModelMc : 0;
    const laborSharePct =
      sumOfModelTotal > 0 ? (sumOfModelLab / sumOfModelTotal) * 100 : 0;

    // Sort models descending by sumTotal for the left chart
    const sortedByTotalDesc = [...filteredRows].sort(
      (a, b) => b.sumTotal - a.sumTotal
    );

    // Component totals (both unweighted sum across models and weighted by Plan Qty)
    const componentTotals = COMPONENT_LIST.map((comp) => {
      let unweightedMc = 0;
      let unweightedLab = 0;
      let weightedMc = 0;
      let weightedLab = 0;
      for (const r of filteredRows) {
        const pair = r.components[comp.key];
        const mc = pair?.mc || 0;
        const lab = pair?.lab || 0;
        unweightedMc += mc;
        unweightedLab += lab;
        weightedMc += mc * r.planQty;
        weightedLab += lab * r.planQty;
      }
      return {
        ...comp,
        unweightedMc,
        unweightedLab,
        unweightedTotal: unweightedMc + unweightedLab,
        weightedMc,
        weightedLab,
        weightedTotal: weightedMc + weightedLab,
      };
    });

    const maxComponentWeighted = Math.max(
      ...componentTotals.map((c) => c.weightedTotal),
      1
    );

    const sumFgTotal = sumFgMc + sumFgLab;
    const sumCabTotal = sumCabMc + sumCabLab;
    const sumDoorTotal = sumDoorMc + sumDoorLab;

    const fgOverallSharePct =
      sumOfModelTotal > 0 ? (sumFgTotal / sumOfModelTotal) * 100 : 0;
    const cabOverallSharePct =
      sumOfModelTotal > 0 ? (sumCabTotal / sumOfModelTotal) * 100 : 0;
    const doorOverallSharePct =
      sumOfModelTotal > 0 ? (sumDoorTotal / sumOfModelTotal) * 100 : 0;

    return {
      count,
      totalPlanQty,
      totalMcHours,
      totalLabHours,
      totalReqMp,
      sumOfModelMc,
      sumOfModelLab,
      sumOfModelTotal,
      sumFgMc,
      sumFgLab,
      sumFgTotal,
      fgOverallSharePct,
      sumCabMc,
      sumCabLab,
      sumCabTotal,
      cabOverallSharePct,
      sumDoorMc,
      sumDoorLab,
      sumDoorTotal,
      doorOverallSharePct,
      avgMc,
      avgLab,
      avgTotal,
      maxModel,
      minModel,
      laborToMcRatio,
      laborSharePct,
      deltaOverOneCount,
      sortedByTotalDesc,
      componentTotals,
      maxComponentWeighted,
    };
  }, [filteredRows]);

  // Handlers for editing cells
  const handleModelNameChange = (id: string, newName: string) => {
    setModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, model: newName } : m))
    );
  };

  const handleStdChange = (
    id: string,
    field: 'stdMc' | 'stdLab' | 'planQty',
    val: string
  ) => {
    const num = val === '' ? 0 : Number(val);
    if (Number.isNaN(num)) return;
    setModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: num } : m))
    );
  };

  const handleComponentChange = (
    id: string,
    compKey: ComponentKey,
    subField: 'mc' | 'lab',
    val: string
  ) => {
    const num = val === '' ? 0 : Number(val) * unitDiv;
    if (Number.isNaN(num)) return;
    setModels((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        return {
          ...m,
          components: {
            ...m.components,
            [compKey]: {
              ...m.components[compKey],
              [subField]: num,
            },
          },
        };
      })
    );
  };

  const handleAddModel = () => {
    const nextIdx = models.length + 1;
    const newRow: ModelRow = {
      id: `m-${Date.now()}`,
      model: `NEW-MODEL-${nextIdx}`,
      family: 'TM',
      stdMc: 1500,
      stdLab: 1500,
      planQty: 200,
      components: {
        FG: { mc: 900, lab: 700 },
        CAB: { mc: 450, lab: 500 },
        R: { mc: 75, lab: 150 },
        F: { mc: 75, lab: 150 },
        VEG: { mc: 0, lab: 0 },
        FB: { mc: 0, lab: 0 },
        FL: { mc: 0, lab: 0 },
        FR: { mc: 0, lab: 0 },
        RL: { mc: 0, lab: 0 },
        RR: { mc: 0, lab: 0 },
        DND_IN: { mc: 0, lab: 0 },
        DND_OUT: { mc: 0, lab: 0 },
      },
    };
    setModels((prev) => [...prev, newRow]);
  };

  const handleDuplicateModel = (row: ModelRow) => {
    const copy: ModelRow = {
      ...structuredClone(row),
      id: `m-${Date.now()}`,
      model: `${row.model} (Copy)`,
    };
    setModels((prev) => {
      const idx = prev.findIndex((m) => m.id === row.id);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const handleDeleteModel = (id: string) => {
    if (models.length <= 1) return;
    setModels((prev) => prev.filter((m) => m.id !== id));
  };

  const handleReset = () => {
    setModels(structuredClone(INITIAL_PLANT_9771_MODELS));
    setShiftHours(8);
    setEfficiencyPct(85);
    setTimeUnit('sec');
    setSearchQuery('');
    setHighlightedModelId(null);
  };

  const handleSyncAllStd = () => {
    setModels((prev) =>
      prev.map((m) => {
        const comp = computeModelMetrics(m, shiftHours, efficiencyPct);
        return {
          ...m,
          stdMc: Math.round(comp.sumMc),
          stdLab: Math.round(comp.sumLab),
        };
      })
    );
  };

  const handleApplyKaizen = (
    fgLabReductionPct: number,
    cabLabReductionPct: number,
    doorLabReductionPct: number,
    mcReductionPct: number
  ) => {
    setModels((prev) =>
      prev.map((m) => {
        const updatedComps = { ...m.components };
        let newSumMc = 0;
        let newSumLab = 0;

        for (const comp of COMPONENT_LIST) {
          const oldMc = m.components[comp.key]?.mc || 0;
          const oldLab = m.components[comp.key]?.lab || 0;
          const labFactor =
            comp.group === 'FG'
              ? 1 - fgLabReductionPct / 100
              : comp.group === 'CAB'
              ? 1 - cabLabReductionPct / 100
              : 1 - doorLabReductionPct / 100;
          const mcFactor = 1 - mcReductionPct / 100;

          const nextMc = Number((oldMc * mcFactor).toFixed(3));
          const nextLab = Number((oldLab * labFactor).toFixed(3));
          updatedComps[comp.key] = { mc: nextMc, lab: nextLab };
          newSumMc += nextMc;
          newSumLab += nextLab;
        }

        return {
          ...m,
          stdMc: Math.round(newSumMc),
          stdLab: Math.round(newSumLab),
          components: updatedComps,
        };
      })
    );
  };

  const handleExportCsv = () => {
    const headers = [
      '#',
      'Model',
      'STD_MC',
      'STD_Labor',
      'STD_Total',
      ...COMPONENT_LIST.flatMap((c) => [`${c.label}_MC`, `${c.label}_Lab`]),
      'SUM_MC',
      'SUM_Labor',
      'SUM_Total',
      'Delta_STD',
      'Plan_Qty',
      'Req_MP',
    ];

    const csvRows = computedRows.map((r, i) => [
      i + 1,
      `"${r.model}"`,
      (r.stdMc / unitDiv).toFixed(timeUnit === 'sec' ? 0 : 2),
      (r.stdLab / unitDiv).toFixed(timeUnit === 'sec' ? 0 : 2),
      (r.stdTotal / unitDiv).toFixed(timeUnit === 'sec' ? 0 : 2),
      ...COMPONENT_LIST.flatMap((c) => [
        ((r.components[c.key]?.mc || 0) / unitDiv).toFixed(3),
        ((r.components[c.key]?.lab || 0) / unitDiv).toFixed(3),
      ]),
      (r.sumMc / unitDiv).toFixed(2),
      (r.sumLab / unitDiv).toFixed(2),
      (r.sumTotal / unitDiv).toFixed(2),
      r.deltaStd,
      r.planQty,
      r.reqMp.toFixed(2),
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...csvRows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Plant_9771_STD_Time_${activeTab}_${timeUnit}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Top Navigation Contract (3-Zone Header) */}
      <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between sticky top-0 z-30">
        <a
          href="#top"
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap"
        >
          STD Time Table – Plant 9771 (MC time / Labor time)
        </a>

        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
          <button
            onClick={() => setWorkspaceView('ALL')}
            className={`py-1 transition-colors cursor-pointer whitespace-nowrap ${
              workspaceView === 'ALL'
                ? 'text-emerald-800 font-semibold underline underline-offset-4'
                : 'hover:text-slate-900'
            }`}
          >
            ภาพรวมทั้งหมด (Integrated View)
          </button>
          <button
            onClick={() => setWorkspaceView('MASTER_ONLY')}
            className={`py-1 transition-colors cursor-pointer whitespace-nowrap ${
              workspaceView === 'MASTER_ONLY'
                ? 'text-emerald-800 font-semibold underline underline-offset-4'
                : 'hover:text-slate-900'
            }`}
          >
            ตาราง STD & กราฟ (STD Tables)
          </button>
          <button
            onClick={() => setWorkspaceView('IE_ANALYSIS')}
            className={`py-1 transition-colors cursor-pointer whitespace-nowrap ${
              workspaceView === 'IE_ANALYSIS'
                ? 'text-emerald-800 font-semibold underline underline-offset-4'
                : 'hover:text-slate-900'
            }`}
          >
            วิเคราะห์สมดุลสายการผลิต & Kaizen (IE Suite)
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleAddModel}
            className="px-3 py-1.5 text-xs font-medium rounded bg-[#0D7A5F] hover:bg-[#095E49] text-white transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่ม Model</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-5 py-4 space-y-4">
        {/* Control Bar & Primary Plant Totals */}
        <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          {/* Parameters & Search Bar */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 text-slate-600">
              <span>เวลาทำงาน/กะ (ชม.)</span>
              <input
                type="number"
                step="0.5"
                min="1"
                max="24"
                value={shiftHours}
                onChange={(e) =>
                  setShiftHours(Math.max(0.5, Number(e.target.value)))
                }
                className="w-16 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono-tabular bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </label>

            <label className="flex items-center gap-1.5 text-slate-600">
              <span>Efficiency %</span>
              <input
                type="number"
                step="1"
                min="1"
                max="200"
                value={efficiencyPct}
                onChange={(e) =>
                  setEfficiencyPct(Math.max(1, Number(e.target.value)))
                }
                className="w-16 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono-tabular bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </label>

            <label className="flex items-center gap-1.5 text-slate-600">
              <span>หน่วยเวลา</span>
              <select
                value={timeUnit}
                onChange={(e) => setTimeUnit(e.target.value as TimeUnit)}
                className="border border-slate-300 rounded px-2 py-1 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="sec">วินาที</option>
                <option value="min">นาที</option>
                <option value="hr">ชั่วโมง</option>
              </select>
            </label>

            <div className="relative flex-1 min-w-[180px] max-w-[260px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหา Model..."
                className="w-full border border-slate-300 rounded pl-8 pr-2.5 py-1 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <button
              onClick={handleAddModel}
              className="px-3 py-1 bg-[#0D7A5F] hover:bg-[#095E49] text-white font-medium rounded transition-colors cursor-pointer whitespace-nowrap"
            >
              + เพิ่ม Model
            </button>

            <button
              onClick={handleExportCsv}
              className="px-3 py-1 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded transition-colors cursor-pointer whitespace-nowrap"
            >
              Export CSV
            </button>

            <button
              onClick={handleReset}
              className="px-3 py-1 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* 4 Headline Totals Strip */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
              <div>
                <div className="text-[11px] text-slate-500">Plan Qty รวม</div>
                <div className="text-xl font-bold font-mono-tabular text-slate-900">
                  {summary.totalPlanQty.toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-500">
                  MC time รวม (ชม.)
                </div>
                <div className="text-xl font-bold font-mono-tabular text-slate-900">
                  {summary.totalMcHours.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-500">
                  Labor time รวม (ชม.)
                </div>
                <div className="text-xl font-bold font-mono-tabular text-slate-900">
                  {summary.totalLabHours.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-500">
                  MP ที่ต้องใช้รวม (คน)
                </div>
                <div className="text-xl font-bold font-mono-tabular text-slate-900">
                  {summary.totalReqMp.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 mt-1.5">
              แก้ไขช่องสีเหลืองได้ทุกช่อง – SUM / Total / Δ STD / Req.MP คำนวณอัตโนมัติ (MP = Labor × Qty ÷ (เวลา/กะ × Eff%))
            </p>
          </div>

          {/* Section Filter Tabs (Master | FG | CAB | DOOR | SUM) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              {(['Master', 'FG', 'CAB', 'DOOR', 'SUM'] as TableTab[]).map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
                      activeTab === tab
                        ? 'bg-[#0D7A5F] text-white border-[#0D7A5F]'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {tab}
                  </button>
                )
              )}
            </div>

            <div className="text-[11px] text-slate-500">
              สัดส่วนเวลารวมทุก Model: <strong className="text-slate-800">FG {fmtPct(summary.fgOverallSharePct)}</strong> · <strong className="text-slate-800">CAB {fmtPct(summary.cabOverallSharePct)}</strong> · <strong className="text-slate-800">DOOR {fmtPct(summary.doorOverallSharePct)}</strong>
            </div>
          </div>
        </section>

        {/* Master Charts & Tables View */}
        {workspaceView !== 'IE_ANALYSIS' && (
          <>
            {/* Show KPI Cards and Dual Charts when on Master or SUM tab */}
            {(activeTab === 'Master' || activeTab === 'SUM') && (
              <>
                {/* 6 KPI Summary Cards Row */}
                <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                    <div className="text-[11px] text-slate-500">จำนวน Model</div>
                    <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-0.5">
                      {summary.count}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                    <div className="text-[11px] text-slate-500">Total เฉลี่ย</div>
                    <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-0.5">
                      {Math.round(summary.avgTotal / unitDiv).toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono-tabular mt-0.5">
                      MC {Math.round(summary.avgMc / unitDiv).toLocaleString()} / Lab{' '}
                      {Math.round(summary.avgLab / unitDiv).toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                    <div className="text-[11px] text-slate-500">สูงสุด</div>
                    <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-0.5">
                      {summary.maxModel
                        ? Math.round(
                            summary.maxModel.sumTotal / unitDiv
                          ).toLocaleString()
                        : '-'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {summary.maxModel?.model || '-'}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                    <div className="text-[11px] text-slate-500">ต่ำสุด</div>
                    <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-0.5">
                      {summary.minModel
                        ? Math.round(
                            summary.minModel.sumTotal / unitDiv
                          ).toLocaleString()
                        : '-'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {summary.minModel?.model || '-'}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                    <div className="text-[11px] text-slate-500">Labor : MC</div>
                    <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-0.5">
                      {summary.laborToMcRatio.toFixed(2)} : 1
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Labor {Math.round(summary.laborSharePct)}% ของ Total
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                    <div className="text-[11px] text-slate-500">Δ STD เกิน ±1</div>
                    <div
                      className={`text-xl font-bold font-mono-tabular mt-0.5 ${
                        summary.deltaOverOneCount > 0
                          ? 'text-rose-600'
                          : 'text-slate-900'
                      }`}
                    >
                      {summary.deltaOverOneCount}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {summary.deltaOverOneCount === 0
                        ? 'ตรงกัน STD ทุก Model'
                        : 'พบค่าคลาดเคลื่อนจาก STD'}
                    </div>
                  </div>
                </section>

                {/* Dual Stacked Horizontal Bar Charts */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left Chart: Total time per Model (MC + Labor) */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-xs font-bold text-slate-900">
                        Total time ต่อ Model (MC + Labor)
                      </h2>
                      <div className="flex items-center gap-3 text-[11px] text-slate-600">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 bg-[#0D7A5F] inline-block" />
                          MC
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 bg-[#D97706] inline-block" />
                          Labor
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 mt-2">
                      {summary.sortedByTotalDesc.map((r) => {
                        const maxTotal =
                          summary.sortedByTotalDesc[0]?.sumTotal || 1;
                        const mcWidthPct = (r.sumMc / maxTotal) * 100;
                        const labWidthPct = (r.sumLab / maxTotal) * 100;
                        const isHighlighted = highlightedModelId === r.id;

                        return (
                          <div
                            key={r.id}
                            onClick={() =>
                              setHighlightedModelId(
                                isHighlighted ? null : r.id
                              )
                            }
                            className={`grid grid-cols-12 items-center gap-2 text-[11px] py-0.5 px-1 rounded cursor-pointer transition-colors ${
                              isHighlighted
                                ? 'bg-emerald-50 ring-1 ring-emerald-500'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="col-span-3 text-slate-600 truncate font-medium">
                              {r.model}
                            </div>
                            <div className="col-span-7 bg-slate-100 h-3.5 flex overflow-hidden">
                              <div
                                style={{ width: `${mcWidthPct}%` }}
                                className="bg-[#0D7A5F] h-full"
                                title={`${r.model} MC: ${Math.round(
                                  r.sumMc / unitDiv
                                ).toLocaleString()} ${unitLabel}`}
                              />
                              <div
                                style={{ width: `${labWidthPct}%` }}
                                className="bg-[#D97706] h-full"
                                title={`${r.model} Labor: ${Math.round(
                                  r.sumLab / unitDiv
                                ).toLocaleString()} ${unitLabel}`}
                              />
                            </div>
                            <div className="col-span-2 text-right font-mono-tabular text-slate-600">
                              {Math.round(r.sumTotal / unitDiv).toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Chart: Component Time Share (Weighted by Plan Qty) */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-xs font-bold text-slate-900">
                        สัดส่วนเวลาตามส่วนประกอบ (ถ่วงน้ำหนักด้วย Plan Qty)
                      </h2>
                      <div className="flex items-center gap-3 text-[11px] text-slate-600">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 bg-[#0D7A5F] inline-block" />
                          MC
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 bg-[#D97706] inline-block" />
                          Labor
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 mt-2">
                      {summary.componentTotals.map((comp) => {
                        const mcWidthPct =
                          (comp.weightedMc / summary.maxComponentWeighted) *
                          100;
                        const labWidthPct =
                          (comp.weightedLab / summary.maxComponentWeighted) *
                          100;

                        return (
                          <div
                            key={comp.key}
                            className="grid grid-cols-12 items-center gap-2 text-[11px] py-0.5"
                          >
                            <div
                              className="col-span-2 text-slate-600 font-medium truncate"
                              title={comp.thaiName}
                            >
                              {comp.label}
                            </div>
                            <div className="col-span-8 bg-slate-100 h-3.5 flex overflow-hidden">
                              <div
                                style={{ width: `${mcWidthPct}%` }}
                                className="bg-[#0D7A5F] h-full"
                                title={`${comp.label} MC: ${Math.round(
                                  comp.weightedMc / unitDiv
                                ).toLocaleString()} ${unitLabel}`}
                              />
                              <div
                                style={{ width: `${labWidthPct}%` }}
                                className="bg-[#D97706] h-full"
                                title={`${comp.label} Labor: ${Math.round(
                                  comp.weightedLab / unitDiv
                                ).toLocaleString()} ${unitLabel}`}
                              />
                            </div>
                            <div className="col-span-2 text-right font-mono-tabular text-slate-600">
                              {Math.round(
                                comp.weightedTotal / unitDiv
                              ).toLocaleString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* TAB 1: MASTER TABLE */}
            {activeTab === 'Master' && (
              <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-[#F1F5F3] text-slate-800 border-b border-slate-300">
                        <th
                          rowSpan={2}
                          className="py-2 px-2 text-center font-bold border-r border-slate-200 sticky left-0 bg-[#F1F5F3] z-20 w-8"
                        >
                          #
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2 px-2.5 text-left font-bold border-r border-slate-200 sticky left-8 bg-[#F1F5F3] z-20 min-w-[130px]"
                        >
                          Model
                        </th>
                        <th
                          colSpan={3}
                          className="py-1.5 px-2 text-center font-bold border-r border-slate-200"
                        >
                          STD
                        </th>
                        {COMPONENT_LIST.map((comp) => (
                          <th
                            key={comp.key}
                            colSpan={2}
                            className="py-1.5 px-2 text-center font-bold border-r border-slate-200"
                            title={comp.thaiName}
                          >
                            {comp.label}
                          </th>
                        ))}
                        <th
                          colSpan={2}
                          className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-[#E8F5E9]"
                        >
                          SUM
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2 px-2 text-right font-bold border-r border-slate-200 bg-[#E8F5E9] text-slate-900"
                        >
                          Total
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2 px-2 text-right font-bold border-r border-slate-200"
                        >
                          Δ STD
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2 px-2 text-right font-bold border-r border-slate-200"
                        >
                          Plan Qty
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2 px-2 text-right font-bold border-r border-slate-200 bg-[#E8F5E9] text-slate-900"
                        >
                          Req. MP
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2 px-2 text-center font-bold"
                        >
                          จัดการ
                        </th>
                      </tr>

                      <tr className="bg-[#F1F5F3] text-slate-700 border-b border-slate-300">
                        <th className="py-1 px-1.5 text-right font-bold border-r border-slate-200">
                          MC
                        </th>
                        <th className="py-1 px-1.5 text-right font-bold border-r border-slate-200">
                          Labor
                        </th>
                        <th className="py-1 px-1.5 text-right font-bold border-r border-slate-200 bg-[#E8F5E9] text-slate-900">
                          Total
                        </th>

                        {COMPONENT_LIST.map((comp) => (
                          <React.Fragment key={comp.key}>
                            <th className="py-1 px-1.5 text-right font-bold border-r border-slate-200">
                              MC
                            </th>
                            <th className="py-1 px-1.5 text-right font-bold border-r border-slate-200">
                              Lab
                            </th>
                          </React.Fragment>
                        ))}

                        <th className="py-1 px-1.5 text-right font-bold border-r border-slate-200 bg-[#E8F5E9] text-slate-900">
                          MC
                        </th>
                        <th className="py-1 px-1.5 text-right font-bold border-r border-slate-200 bg-[#E8F5E9] text-slate-900">
                          Labor
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200 font-mono-tabular">
                      {filteredRows.map((row, idx) => {
                        const isRowHighlighted = highlightedModelId === row.id;
                        return (
                          <tr
                            key={row.id}
                            className={`transition-colors ${
                              isRowHighlighted
                                ? 'bg-emerald-50/90'
                                : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="py-1 px-2 text-center text-slate-500 border-r border-slate-200 sticky left-0 bg-white z-10">
                              {idx + 1}
                            </td>

                            <td className="py-1 px-2 text-left font-sans font-medium text-slate-900 border-r border-slate-200 sticky left-8 bg-white z-10 whitespace-nowrap">
                              <input
                                type="text"
                                value={row.model}
                                onChange={(e) =>
                                  handleModelNameChange(row.id, e.target.value)
                                }
                                className="w-full bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 rounded px-1 font-medium text-slate-900"
                              />
                            </td>

                            {/* STD MC */}
                            <td className="p-0.5 border-r border-slate-200 bg-[#FEFCE8]/60">
                              <input
                                type="number"
                                step="any"
                                value={formatVal(row.stdMc, 1)}
                                onChange={(e) =>
                                  handleStdChange(
                                    row.id,
                                    'stdMc',
                                    String(Number(e.target.value) * unitDiv)
                                  )
                                }
                                className="w-14 text-right px-1 py-0.5 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded text-slate-800"
                              />
                            </td>

                            {/* STD Labor */}
                            <td className="p-0.5 border-r border-slate-200 bg-[#FEFCE8]/60">
                              <input
                                type="number"
                                step="any"
                                value={formatVal(row.stdLab, 1)}
                                onChange={(e) =>
                                  handleStdChange(
                                    row.id,
                                    'stdLab',
                                    String(Number(e.target.value) * unitDiv)
                                  )
                                }
                                className="w-14 text-right px-1 py-0.5 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded text-slate-800"
                              />
                            </td>

                            {/* STD Total */}
                            <td className="py-1 px-2 text-right font-bold bg-[#E8F5E9] text-slate-900 border-r border-slate-200">
                              {Math.round(row.stdTotal / unitDiv).toLocaleString()}
                            </td>

                            {/* All 12 Components */}
                            {COMPONENT_LIST.map((comp) => {
                              const mcVal = row.components[comp.key]?.mc || 0;
                              const labVal = row.components[comp.key]?.lab || 0;
                              return (
                                <React.Fragment key={comp.key}>
                                  <td className="p-0.5 border-r border-slate-200 bg-[#FEFCE8]/50">
                                    <input
                                      type="number"
                                      step="any"
                                      value={formatVal(mcVal, 3)}
                                      onChange={(e) =>
                                        handleComponentChange(
                                          row.id,
                                          comp.key,
                                          'mc',
                                          e.target.value
                                        )
                                      }
                                      className={`w-16 text-right px-1 py-0.5 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded ${
                                        mcVal === 0
                                          ? 'text-slate-400'
                                          : 'text-slate-800'
                                      }`}
                                    />
                                  </td>
                                  <td className="p-0.5 border-r border-slate-200 bg-[#FEFCE8]/50">
                                    <input
                                      type="number"
                                      step="any"
                                      value={formatVal(labVal, 3)}
                                      onChange={(e) =>
                                        handleComponentChange(
                                          row.id,
                                          comp.key,
                                          'lab',
                                          e.target.value
                                        )
                                      }
                                      className={`w-16 text-right px-1 py-0.5 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded ${
                                        labVal === 0
                                          ? 'text-slate-400'
                                          : 'text-slate-800'
                                      }`}
                                    />
                                  </td>
                                </React.Fragment>
                              );
                            })}

                            {/* SUM MC */}
                            <td className="py-1 px-2 text-right font-bold bg-[#E8F5E9] text-slate-900 border-r border-slate-200">
                              {Math.round(row.sumMc / unitDiv).toLocaleString()}
                            </td>

                            {/* SUM Labor */}
                            <td className="py-1 px-2 text-right font-bold bg-[#E8F5E9] text-slate-900 border-r border-slate-200">
                              {Math.round(row.sumLab / unitDiv).toLocaleString()}
                            </td>

                            {/* SUM Total */}
                            <td className="py-1 px-2 text-right font-bold bg-[#E8F5E9] text-slate-900 border-r border-slate-200">
                              {Math.round(row.sumTotal / unitDiv).toLocaleString()}
                            </td>

                            {/* Delta STD */}
                            <td
                              className={`py-1 px-2 text-right font-bold border-r border-slate-200 ${
                                Math.abs(row.deltaStd) > 1
                                  ? 'text-rose-600 bg-rose-50'
                                  : row.deltaStd !== 0
                                  ? 'text-amber-700'
                                  : 'text-slate-600'
                              }`}
                            >
                              {row.deltaStd}
                            </td>

                            {/* Plan Qty */}
                            <td className="p-0.5 border-r border-slate-200 bg-[#FEFCE8]">
                              <input
                                type="number"
                                step="10"
                                min="0"
                                value={row.planQty}
                                onChange={(e) =>
                                  handleStdChange(
                                    row.id,
                                    'planQty',
                                    e.target.value
                                  )
                                }
                                className="w-16 text-right px-1 py-0.5 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 rounded font-semibold text-slate-900"
                              />
                            </td>

                            {/* Req. MP */}
                            <td className="py-1 px-2 text-right font-bold bg-[#E8F5E9] text-slate-900 border-r border-slate-200">
                              {row.reqMp.toFixed(2)}
                            </td>

                            {/* Row Actions */}
                            <td className="py-1 px-1.5 text-center whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => handleDeleteModel(row.id)}
                                  title="ลบ Model นี้"
                                  className="px-1.5 py-0.5 border border-slate-200 rounded hover:bg-rose-50 hover:text-rose-600 text-slate-500 transition-colors cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDuplicateModel(row)}
                                  title="คัดลอก Model นี้"
                                  className="px-1.5 py-0.5 border border-slate-200 rounded hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    <tfoot>
                      <tr className="bg-[#F1F5F3] font-mono-tabular font-bold text-slate-900 border-t-2 border-slate-300">
                        <td className="py-2 px-2 text-center sticky left-0 bg-[#F1F5F3] z-10 border-r border-slate-200"></td>
                        <td className="py-2 px-2.5 text-left font-sans sticky left-8 bg-[#F1F5F3] z-10 border-r border-slate-200">
                          รวม
                        </td>
                        <td className="py-2 px-1.5 text-right border-r border-slate-200">
                          {fmt1(summary.sumOfModelMc)}
                        </td>
                        <td className="py-2 px-1.5 text-right border-r border-slate-200">
                          {fmt1(summary.sumOfModelLab)}
                        </td>
                        <td className="py-2 px-2 text-right bg-[#E8F5E9] border-r border-slate-200">
                          {fmt1(summary.sumOfModelTotal)}
                        </td>

                        {COMPONENT_LIST.map((comp) => {
                          const compStat = summary.componentTotals.find(
                            (c) => c.key === comp.key
                          );
                          return (
                            <React.Fragment key={comp.key}>
                              <td className="py-2 px-1.5 text-right border-r border-slate-200">
                                {compStat ? fmt1(compStat.unweightedMc) : '0'}
                              </td>
                              <td className="py-2 px-1.5 text-right border-r border-slate-200">
                                {compStat ? fmt1(compStat.unweightedLab) : '0'}
                              </td>
                            </React.Fragment>
                          );
                        })}

                        <td className="py-2 px-2 text-right bg-[#E8F5E9] border-r border-slate-200">
                          {fmt1(summary.sumOfModelMc)}
                        </td>
                        <td className="py-2 px-2 text-right bg-[#E8F5E9] border-r border-slate-200">
                          {fmt1(summary.sumOfModelLab)}
                        </td>
                        <td className="py-2 px-2 text-right bg-[#E8F5E9] border-r border-slate-200">
                          {fmt1(summary.sumOfModelTotal)}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-200">
                          {summary.deltaOverOneCount}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-200">
                          {summary.totalPlanQty.toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-right bg-[#E8F5E9] border-r border-slate-200">
                          {summary.totalReqMp.toFixed(2)}
                        </td>
                        <td className="py-2 px-2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            )}

            {/* TAB 2: FG DEDICATED VIEW (Exact Match to Uploaded Images 1 & 2) */}
            {activeTab === 'FG' && (
              <section className="bg-white border border-slate-200 rounded-lg overflow-hidden max-w-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F1F5F3] text-slate-800 border-b border-slate-300">
                        <th
                          rowSpan={2}
                          className="py-2.5 px-3 text-right font-bold border-r border-slate-200 w-10"
                        >
                          #
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2.5 px-3 text-right font-bold border-r border-slate-200 min-w-[160px]"
                        >
                          Model
                        </th>
                        <th
                          colSpan={3}
                          className="py-1.5 px-3 text-right font-bold border-r border-slate-200"
                        >
                          FG
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2.5 px-3 text-right font-bold min-w-[130px]"
                        >
                          % ของ Model Total
                        </th>
                      </tr>
                      <tr className="bg-[#F1F5F3] text-slate-800 border-b border-slate-300">
                        <th className="py-1.5 px-3 text-right font-bold border-r border-slate-200">
                          MC
                        </th>
                        <th className="py-1.5 px-3 text-right font-bold border-r border-slate-200">
                          Labor
                        </th>
                        <th className="py-1.5 px-3 text-right font-bold border-r border-slate-200 bg-[#E8F5E9]">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono-tabular">
                      {filteredRows.map((row, idx) => {
                        const fgMc = row.components.FG?.mc || 0;
                        const fgLab = row.components.FG?.lab || 0;
                        return (
                          <tr key={row.id} className="hover:bg-slate-50/80">
                            <td className="py-1.5 px-3 text-right text-slate-600 border-r border-slate-200">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-3 text-left font-sans text-slate-900 border-r border-slate-200">
                              {row.model}
                            </td>
                            <td className="p-1 border-r border-slate-200 bg-[#FEFCE8]/40">
                              <input
                                type="number"
                                step="any"
                                value={formatVal(fgMc, 3)}
                                onChange={(e) =>
                                  handleComponentChange(
                                    row.id,
                                    'FG',
                                    'mc',
                                    e.target.value
                                  )
                                }
                                className="w-24 text-right px-1.5 py-0.5 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 rounded text-slate-900"
                              />
                            </td>
                            <td className="p-1 border-r border-slate-200 bg-[#FEFCE8]/40">
                              <input
                                type="number"
                                step="any"
                                value={formatVal(fgLab, 4)}
                                onChange={(e) =>
                                  handleComponentChange(
                                    row.id,
                                    'FG',
                                    'lab',
                                    e.target.value
                                  )
                                }
                                className="w-24 text-right px-1.5 py-0.5 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 rounded text-slate-900"
                              />
                            </td>
                            <td className="py-1.5 px-3 text-right bg-[#E8F5E9] text-slate-900 border-r border-slate-200">
                              {fmt1(row.fgTotal)}
                            </td>
                            <td className="py-1.5 px-3 text-right text-slate-900">
                              {fmtPct(row.fgSharePct)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#F1F5F3] font-mono-tabular font-bold text-slate-900 border-t border-slate-300">
                        <td className="py-2 px-3 border-r border-slate-200"></td>
                        <td className="py-2 px-3 text-left font-sans border-r border-slate-200">
                          รวม
                        </td>
                        <td className="py-2 px-3 text-right border-r border-slate-200 bg-[#E8F5E9]/60">
                          {fmt1(summary.sumFgMc)}
                        </td>
                        <td className="py-2 px-3 text-right border-r border-slate-200 bg-[#E8F5E9]/60">
                          {fmt1(summary.sumFgLab)}
                        </td>
                        <td className="py-2 px-3 text-right bg-[#E8F5E9] border-r border-slate-200">
                          {fmt1(summary.sumFgTotal)}
                        </td>
                        <td className="py-2 px-3 text-right bg-[#E8F5E9]/60">
                          {fmtPct(summary.fgOverallSharePct)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            )}

            {/* TAB 3: CAB DEDICATED VIEW (Exact Match to Uploaded Image 3) */}
            {activeTab === 'CAB' && (
              <section className="bg-white border border-slate-200 rounded-lg overflow-hidden max-w-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F1F5F3] text-slate-800 border-b border-slate-300">
                        <th
                          rowSpan={2}
                          className="py-2.5 px-3 text-right font-bold border-r border-slate-200 w-10"
                        >
                          #
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2.5 px-3 text-right font-bold border-r border-slate-200 min-w-[160px]"
                        >
                          Model
                        </th>
                        <th
                          colSpan={3}
                          className="py-1.5 px-3 text-right font-bold border-r border-slate-200"
                        >
                          CAB
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2.5 px-3 text-right font-bold min-w-[130px]"
                        >
                          % ของ Model Total
                        </th>
                      </tr>
                      <tr className="bg-[#F1F5F3] text-slate-800 border-b border-slate-300">
                        <th className="py-1.5 px-3 text-right font-bold border-r border-slate-200">
                          MC
                        </th>
                        <th className="py-1.5 px-3 text-right font-bold border-r border-slate-200">
                          Labor
                        </th>
                        <th className="py-1.5 px-3 text-right font-bold border-r border-slate-200 bg-[#E8F5E9]">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono-tabular">
                      {filteredRows.map((row, idx) => {
                        const cabMc = row.components.CAB?.mc || 0;
                        const cabLab = row.components.CAB?.lab || 0;
                        return (
                          <tr key={row.id} className="hover:bg-slate-50/80">
                            <td className="py-1.5 px-3 text-right text-slate-600 border-r border-slate-200">
                              {idx + 1}
                            </td>
                            <td className="py-1.5 px-3 text-left font-sans text-slate-900 border-r border-slate-200">
                              {row.model}
                            </td>
                            <td className="p-1 border-r border-slate-200 bg-[#FEFCE8]/40">
                              <input
                                type="number"
                                step="any"
                                value={formatVal(cabMc, 4)}
                                onChange={(e) =>
                                  handleComponentChange(
                                    row.id,
                                    'CAB',
                                    'mc',
                                    e.target.value
                                  )
                                }
                                className="w-24 text-right px-1.5 py-0.5 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 rounded text-slate-900"
                              />
                            </td>
                            <td className="p-1 border-r border-slate-200 bg-[#FEFCE8]/40">
                              <input
                                type="number"
                                step="any"
                                value={formatVal(cabLab, 4)}
                                onChange={(e) =>
                                  handleComponentChange(
                                    row.id,
                                    'CAB',
                                    'lab',
                                    e.target.value
                                  )
                                }
                                className="w-24 text-right px-1.5 py-0.5 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 rounded text-slate-900"
                              />
                            </td>
                            <td className="py-1.5 px-3 text-right bg-[#E8F5E9] text-slate-900 border-r border-slate-200">
                              {fmt1(row.cabTotal)}
                            </td>
                            <td className="py-1.5 px-3 text-right text-slate-900">
                              {fmtPct(row.cabSharePct)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#F1F5F3] font-mono-tabular font-bold text-slate-900 border-t border-slate-300">
                        <td className="py-2 px-3 border-r border-slate-200"></td>
                        <td className="py-2 px-3 text-left font-sans border-r border-slate-200">
                          รวม
                        </td>
                        <td className="py-2 px-3 text-right border-r border-slate-200 bg-[#E8F5E9]/60">
                          {fmt1(summary.sumCabMc)}
                        </td>
                        <td className="py-2 px-3 text-right border-r border-slate-200 bg-[#E8F5E9]/60">
                          {fmt1(summary.sumCabLab)}
                        </td>
                        <td className="py-2 px-3 text-right bg-[#E8F5E9] border-r border-slate-200">
                          {fmt1(summary.sumCabTotal)}
                        </td>
                        <td className="py-2 px-3 text-right bg-[#E8F5E9]/60">
                          {fmtPct(summary.cabOverallSharePct)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            )}

            {/* TAB 4: DOOR DEDICATED VIEW (Exact Match to Uploaded Image 4) */}
            {activeTab === 'DOOR' && (
              <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-[#F1F5F3] text-slate-800 border-b border-slate-300">
                        <th
                          rowSpan={2}
                          className="py-2 px-2 text-right font-bold border-r border-slate-200 sticky left-0 bg-[#F1F5F3] z-20 w-8"
                        >
                          #
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2 px-2.5 text-right font-bold border-r border-slate-200 sticky left-8 bg-[#F1F5F3] z-20 min-w-[130px]"
                        >
                          Model
                        </th>
                        {DOOR_COMPONENT_LIST.map((comp) => (
                          <th
                            key={comp.key}
                            colSpan={3}
                            className="py-1.5 px-2 text-right font-bold border-r border-slate-200"
                            title={comp.thaiName}
                          >
                            {comp.label}
                          </th>
                        ))}
                        <th
                          colSpan={3}
                          className="py-1.5 px-2 text-right font-bold border-r border-slate-200 bg-[#E8F5E9]"
                        >
                          DOOR SUM
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2 px-2.5 text-right font-bold min-w-[115px]"
                        >
                          % ของ Model Total
                        </th>
                      </tr>

                      <tr className="bg-[#F1F5F3] text-slate-800 border-b border-slate-300">
                        {DOOR_COMPONENT_LIST.map((comp) => (
                          <React.Fragment key={comp.key}>
                            <th className="py-1 px-1.5 text-right font-bold border-r border-slate-200">
                              MC
                            </th>
                            <th className="py-1 px-1.5 text-right font-bold border-r border-slate-200">
                              Labor
                            </th>
                            <th className="py-1 px-1.5 text-right font-bold border-r border-slate-200 bg-[#E8F5E9]">
                              Total
                            </th>
                          </React.Fragment>
                        ))}
                        <th className="py-1 px-1.5 text-right font-bold border-r border-slate-200 bg-[#E8F5E9]">
                          MC
                        </th>
                        <th className="py-1 px-1.5 text-right font-bold border-r border-slate-200 bg-[#E8F5E9]">
                          Labor
                        </th>
                        <th className="py-1 px-1.5 text-right font-bold border-r border-slate-200 bg-[#E8F5E9]">
                          Total
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200 font-mono-tabular">
                      {filteredRows.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-slate-50/80">
                          <td className="py-1 px-2 text-right text-slate-600 border-r border-slate-200 sticky left-0 bg-white z-10">
                            {idx + 1}
                          </td>
                          <td className="py-1 px-2.5 text-left font-sans text-slate-900 border-r border-slate-200 sticky left-8 bg-white z-10 whitespace-nowrap">
                            {row.model}
                          </td>

                          {DOOR_COMPONENT_LIST.map((comp) => {
                            const mcVal = row.components[comp.key]?.mc || 0;
                            const labVal = row.components[comp.key]?.lab || 0;
                            const subTotal = mcVal + labVal;
                            return (
                              <React.Fragment key={comp.key}>
                                <td className="p-0.5 border-r border-slate-200 bg-[#FEFCE8]/40">
                                  <input
                                    type="number"
                                    step="any"
                                    value={formatVal(mcVal, 4)}
                                    onChange={(e) =>
                                      handleComponentChange(
                                        row.id,
                                        comp.key,
                                        'mc',
                                        e.target.value
                                      )
                                    }
                                    className={`w-16 text-right px-1 py-0.5 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 rounded ${
                                      mcVal === 0
                                        ? 'text-slate-500'
                                        : 'text-slate-900'
                                    }`}
                                  />
                                </td>
                                <td className="p-0.5 border-r border-slate-200 bg-[#FEFCE8]/40">
                                  <input
                                    type="number"
                                    step="any"
                                    value={formatVal(labVal, 4)}
                                    onChange={(e) =>
                                      handleComponentChange(
                                        row.id,
                                        comp.key,
                                        'lab',
                                        e.target.value
                                      )
                                    }
                                    className={`w-16 text-right px-1 py-0.5 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 rounded ${
                                      labVal === 0
                                        ? 'text-slate-500'
                                        : 'text-slate-900'
                                    }`}
                                  />
                                </td>
                                <td className="py-1 px-1.5 text-right font-bold bg-[#E8F5E9] text-slate-900 border-r border-slate-200">
                                  {fmt1(subTotal)}
                                </td>
                              </React.Fragment>
                            );
                          })}

                          {/* DOOR SUM (MC, Labor, Total) */}
                          <td className="py-1 px-2 text-right font-bold bg-[#E8F5E9] text-slate-900 border-r border-slate-200">
                            {fmt1(row.doorSumMc)}
                          </td>
                          <td className="py-1 px-2 text-right font-bold bg-[#E8F5E9] text-slate-900 border-r border-slate-200">
                            {fmt1(row.doorSumLab)}
                          </td>
                          <td className="py-1 px-2 text-right font-bold bg-[#E8F5E9] text-slate-900 border-r border-slate-200">
                            {fmt1(row.doorSumTotal)}
                          </td>

                          {/* % of Model Total */}
                          <td className="py-1 px-2.5 text-right text-slate-900">
                            {fmtPct(row.doorSharePct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    <tfoot>
                      <tr className="bg-[#F1F5F3] font-mono-tabular font-bold text-slate-900 border-t border-slate-300">
                        <td className="py-2 px-2 sticky left-0 bg-[#F1F5F3] z-10 border-r border-slate-200"></td>
                        <td className="py-2 px-2.5 text-left font-sans sticky left-8 bg-[#F1F5F3] z-10 border-r border-slate-200">
                          รวม
                        </td>
                        {DOOR_COMPONENT_LIST.map((comp) => {
                          const compStat = summary.componentTotals.find(
                            (c) => c.key === comp.key
                          );
                          return (
                            <React.Fragment key={comp.key}>
                              <td className="py-2 px-1.5 text-right border-r border-slate-200 bg-[#E8F5E9]/60">
                                {compStat ? fmt1(compStat.unweightedMc) : '0'}
                              </td>
                              <td className="py-2 px-1.5 text-right border-r border-slate-200 bg-[#E8F5E9]/60">
                                {compStat ? fmt1(compStat.unweightedLab) : '0'}
                              </td>
                              <td className="py-2 px-1.5 text-right border-r border-slate-200 bg-[#E8F5E9]">
                                {compStat
                                  ? fmt1(compStat.unweightedTotal)
                                  : '0'}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td className="py-2 px-2 text-right bg-[#E8F5E9] border-r border-slate-200">
                          {fmt1(summary.sumDoorMc)}
                        </td>
                        <td className="py-2 px-2 text-right bg-[#E8F5E9] border-r border-slate-200">
                          {fmt1(summary.sumDoorLab)}
                        </td>
                        <td className="py-2 px-2 text-right bg-[#E8F5E9] border-r border-slate-200">
                          {fmt1(summary.sumDoorTotal)}
                        </td>
                        <td className="py-2 px-2.5 text-right bg-[#E8F5E9]/60">
                          {fmtPct(summary.doorOverallSharePct)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            )}

            {/* TAB 5: SUM EXECUTIVE SUMMARY VIEW */}
            {activeTab === 'SUM' && (
              <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F1F5F3] text-slate-800 border-b border-slate-300">
                        <th
                          rowSpan={2}
                          className="py-2 px-2.5 text-right font-bold border-r border-slate-200 w-9"
                        >
                          #
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2 px-3 text-left font-bold border-r border-slate-200 min-w-[140px]"
                        >
                          Model
                        </th>
                        <th
                          colSpan={2}
                          className="py-1.5 px-2 text-center font-bold border-r border-slate-200"
                        >
                          FG (48.1%)
                        </th>
                        <th
                          colSpan={2}
                          className="py-1.5 px-2 text-center font-bold border-r border-slate-200"
                        >
                          CAB (23.8%)
                        </th>
                        <th
                          colSpan={2}
                          className="py-1.5 px-2 text-center font-bold border-r border-slate-200"
                        >
                          DOOR SUM (28.1%)
                        </th>
                        <th
                          colSpan={3}
                          className="py-1.5 px-2 text-center font-bold border-r border-slate-200 bg-[#E8F5E9]"
                        >
                          SUM รวมทุกแผนก
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2 px-2.5 text-right font-bold border-r border-slate-200"
                        >
                          STD Total
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2 px-2 text-right font-bold border-r border-slate-200"
                        >
                          Δ STD
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2 px-2.5 text-right font-bold border-r border-slate-200"
                        >
                          Plan Qty
                        </th>
                        <th
                          rowSpan={2}
                          className="py-2 px-2.5 text-right font-bold bg-[#E8F5E9]"
                        >
                          Req. MP
                        </th>
                      </tr>
                      <tr className="bg-[#F1F5F3] text-slate-700 border-b border-slate-300">
                        <th className="py-1 px-2 text-right font-bold border-r border-slate-200 bg-[#E8F5E9]/60">
                          Total
                        </th>
                        <th className="py-1 px-2 text-right font-bold border-r border-slate-200">
                          %
                        </th>
                        <th className="py-1 px-2 text-right font-bold border-r border-slate-200 bg-[#E8F5E9]/60">
                          Total
                        </th>
                        <th className="py-1 px-2 text-right font-bold border-r border-slate-200">
                          %
                        </th>
                        <th className="py-1 px-2 text-right font-bold border-r border-slate-200 bg-[#E8F5E9]/60">
                          Total
                        </th>
                        <th className="py-1 px-2 text-right font-bold border-r border-slate-200">
                          %
                        </th>
                        <th className="py-1 px-2 text-right font-bold border-r border-slate-200 bg-[#E8F5E9]">
                          MC
                        </th>
                        <th className="py-1 px-2 text-right font-bold border-r border-slate-200 bg-[#E8F5E9]">
                          Labor
                        </th>
                        <th className="py-1 px-2 text-right font-bold border-r border-slate-200 bg-[#E8F5E9]">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono-tabular">
                      {filteredRows.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-slate-50/80">
                          <td className="py-1.5 px-2.5 text-right text-slate-500 border-r border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-3 text-left font-sans font-medium text-slate-900 border-r border-slate-200">
                            {row.model}
                          </td>
                          <td className="py-1.5 px-2 text-right bg-[#E8F5E9]/50 border-r border-slate-200">
                            {fmt1(row.fgTotal)}
                          </td>
                          <td className="py-1.5 px-2 text-right text-slate-600 border-r border-slate-200">
                            {fmtPct(row.fgSharePct)}
                          </td>
                          <td className="py-1.5 px-2 text-right bg-[#E8F5E9]/50 border-r border-slate-200">
                            {fmt1(row.cabTotal)}
                          </td>
                          <td className="py-1.5 px-2 text-right text-slate-600 border-r border-slate-200">
                            {fmtPct(row.cabSharePct)}
                          </td>
                          <td className="py-1.5 px-2 text-right bg-[#E8F5E9]/50 border-r border-slate-200">
                            {fmt1(row.doorSumTotal)}
                          </td>
                          <td className="py-1.5 px-2 text-right text-slate-600 border-r border-slate-200">
                            {fmtPct(row.doorSharePct)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-bold bg-[#E8F5E9] border-r border-slate-200">
                            {Math.round(row.sumMc / unitDiv).toLocaleString()}
                          </td>
                          <td className="py-1.5 px-2 text-right font-bold bg-[#E8F5E9] border-r border-slate-200">
                            {Math.round(row.sumLab / unitDiv).toLocaleString()}
                          </td>
                          <td className="py-1.5 px-2 text-right font-bold bg-[#E8F5E9] border-r border-slate-200">
                            {Math.round(row.sumTotal / unitDiv).toLocaleString()}
                          </td>
                          <td className="py-1.5 px-2.5 text-right border-r border-slate-200">
                            {Math.round(row.stdTotal / unitDiv).toLocaleString()}
                          </td>
                          <td className="py-1.5 px-2 text-right border-r border-slate-200">
                            {row.deltaStd}
                          </td>
                          <td className="py-1.5 px-2.5 text-right border-r border-slate-200">
                            {row.planQty.toLocaleString()}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-bold bg-[#E8F5E9]">
                            {row.reqMp.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#F1F5F3] font-mono-tabular font-bold text-slate-900 border-t border-slate-300">
                        <td className="py-2 px-2.5 border-r border-slate-200"></td>
                        <td className="py-2 px-3 text-left font-sans border-r border-slate-200">
                          รวม
                        </td>
                        <td className="py-2 px-2 text-right bg-[#E8F5E9] border-r border-slate-200">
                          {fmt1(summary.sumFgTotal)}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-200">
                          {fmtPct(summary.fgOverallSharePct)}
                        </td>
                        <td className="py-2 px-2 text-right bg-[#E8F5E9] border-r border-slate-200">
                          {fmt1(summary.sumCabTotal)}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-200">
                          {fmtPct(summary.cabOverallSharePct)}
                        </td>
                        <td className="py-2 px-2 text-right bg-[#E8F5E9] border-r border-slate-200">
                          {fmt1(summary.sumDoorTotal)}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-200">
                          {fmtPct(summary.doorOverallSharePct)}
                        </td>
                        <td className="py-2 px-2 text-right bg-[#E8F5E9] border-r border-slate-200">
                          {fmt1(summary.sumOfModelMc)}
                        </td>
                        <td className="py-2 px-2 text-right bg-[#E8F5E9] border-r border-slate-200">
                          {fmt1(summary.sumOfModelLab)}
                        </td>
                        <td className="py-2 px-2 text-right bg-[#E8F5E9] border-r border-slate-200">
                          {fmt1(summary.sumOfModelTotal)}
                        </td>
                        <td className="py-2 px-2.5 text-right border-r border-slate-200">
                          {fmt1(summary.sumOfModelTotal)}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-slate-200">
                          {summary.deltaOverOneCount}
                        </td>
                        <td className="py-2 px-2.5 text-right border-r border-slate-200">
                          {summary.totalPlanQty.toLocaleString()}
                        </td>
                        <td className="py-2 px-2.5 text-right bg-[#E8F5E9]">
                          {summary.totalReqMp.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {/* Senior IE Engineering Workbench (Line Balancing, Takt Time, Yamazumi, Kaizen Simulator) */}
        {workspaceView !== 'MASTER_ONLY' && (
          <IEEngineeringSuite
            rows={filteredRows}
            shiftHours={shiftHours}
            efficiencyPct={efficiencyPct}
            timeUnit={timeUnit}
            onSyncAllStd={handleSyncAllStd}
            onApplyKaizen={handleApplyKaizen}
          />
        )}
      </main>
    </div>
  );
}
