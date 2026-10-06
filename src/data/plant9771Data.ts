export type ComponentKey =
  | 'FG'
  | 'CAB'
  | 'R'
  | 'F'
  | 'VEG'
  | 'FB'
  | 'FL'
  | 'FR'
  | 'RL'
  | 'RR'
  | 'DND_IN'
  | 'DND_OUT';

export interface ComponentMeta {
  key: ComponentKey;
  label: string;
  thaiName: string;
  group: 'FG' | 'CAB' | 'DOOR';
  stationCode: string;
}

export const COMPONENT_LIST: ComponentMeta[] = [
  { key: 'FG', label: 'FG', thaiName: 'Final Assembly (ประกอบขั้นสุดท้าย)', group: 'FG', stationCode: 'ST-01' },
  { key: 'CAB', label: 'CAB', thaiName: 'Cabinet Assy & Foaming (ประกอบตู้/ฉีดโฟม)', group: 'CAB', stationCode: 'ST-02' },
  { key: 'R', label: 'R', thaiName: 'Refrig Door (ประตูช่องแช่เย็น)', group: 'DOOR', stationCode: 'ST-03' },
  { key: 'F', label: 'F', thaiName: 'Freezer Door (ประตูช่องแช่แข็ง)', group: 'DOOR', stationCode: 'ST-04' },
  { key: 'VEG', label: 'VEG', thaiName: 'Vegetable Door/Comp (ช่องแช่ผัก)', group: 'DOOR', stationCode: 'ST-05' },
  { key: 'FB', label: 'FB', thaiName: 'Freezer Bottom Door (ประตูห้องเย็นล่าง)', group: 'DOOR', stationCode: 'ST-06' },
  { key: 'FL', label: 'FL', thaiName: 'French Door Left (ประตูบนซ้าย)', group: 'DOOR', stationCode: 'ST-07' },
  { key: 'FR', label: 'FR', thaiName: 'French Door Right (ประตูบนขวา)', group: 'DOOR', stationCode: 'ST-08' },
  { key: 'RL', label: 'RL', thaiName: 'Lower Door Left (ประตูล่างซ้าย)', group: 'DOOR', stationCode: 'ST-09' },
  { key: 'RR', label: 'RR', thaiName: 'Lower Door Right (ประตูล่างขวา)', group: 'DOOR', stationCode: 'ST-10' },
  { key: 'DND_IN', label: 'DND In', thaiName: 'Dispenser Inner (ชุดกดน้ำด้านใน)', group: 'DOOR', stationCode: 'ST-11' },
  { key: 'DND_OUT', label: 'DND Out', thaiName: 'Dispenser Outer (ชุดกดน้ำด้านนอก)', group: 'DOOR', stationCode: 'ST-12' },
];

export const DOOR_COMPONENT_LIST: ComponentMeta[] = COMPONENT_LIST.filter(
  (c) => c.group === 'DOOR'
);

export interface TimePair {
  mc: number;
  lab: number;
}

export interface ModelRow {
  id: string;
  model: string;
  family: '1D' | 'BM' | 'FUF' | 'TM' | 'SBS' | 'T DOOR';
  stdMc: number;
  stdLab: number;
  planQty: number;
  components: Record<ComponentKey, TimePair>;
}

const zeroComp = (): Record<ComponentKey, TimePair> => ({
  FG: { mc: 0, lab: 0 },
  CAB: { mc: 0, lab: 0 },
  R: { mc: 0, lab: 0 },
  F: { mc: 0, lab: 0 },
  VEG: { mc: 0, lab: 0 },
  FB: { mc: 0, lab: 0 },
  FL: { mc: 0, lab: 0 },
  FR: { mc: 0, lab: 0 },
  RL: { mc: 0, lab: 0 },
  RR: { mc: 0, lab: 0 },
  DND_IN: { mc: 0, lab: 0 },
  DND_OUT: { mc: 0, lab: 0 },
});

export const INITIAL_PLANT_9771_MODELS: ModelRow[] = [
  {
    id: 'm-1',
    model: '1D',
    family: '1D',
    stdMc: 1158,
    stdLab: 638,
    planQty: 1200,
    components: {
      ...zeroComp(),
      FG: { mc: 683.65, lab: 239.636 },
      CAB: { mc: 401.875, lab: 187.667 },
      R: { mc: 72.475, lab: 210.697 },
    },
  },
  {
    id: 'm-2',
    model: 'BM',
    family: 'BM',
    stdMc: 4453,
    stdLab: 7341,
    planQty: 600,
    components: {
      ...zeroComp(),
      FG: { mc: 2904.854, lab: 2779.228 },
      CAB: { mc: 807.131, lab: 1331.984 },
      VEG: { mc: 187.125, lab: 851.728 },
      FB: { mc: 164.67, lab: 686.356 },
      RL: { mc: 247.005, lab: 1113.72 },
      RR: { mc: 142.215, lab: 577.984 },
    },
  },
  {
    id: 'm-3',
    model: 'BM sh DND',
    family: 'BM',
    stdMc: 4453,
    stdLab: 7341,
    planQty: 300,
    components: {
      ...zeroComp(),
      FG: { mc: 2904.854, lab: 2779.228 },
      CAB: { mc: 807.131, lab: 1331.984 },
      VEG: { mc: 187.125, lab: 851.728 },
      FB: { mc: 164.67, lab: 686.356 },
      RL: { mc: 247.005, lab: 1113.72 },
      DND_IN: { mc: 71.114, lab: 288.992 },
      DND_OUT: { mc: 71.101, lab: 288.992 },
    },
  },
  {
    id: 'm-4',
    model: 'BM T DOOR',
    family: 'BM',
    stdMc: 4453,
    stdLab: 7341,
    planQty: 300,
    components: {
      ...zeroComp(),
      FG: { mc: 2904.854, lab: 2779.228 },
      CAB: { mc: 807.131, lab: 1331.984 },
      FL: { mc: 223.245, lab: 975.86 },
      FR: { mc: 128.55, lab: 562.224 },
      RL: { mc: 247.005, lab: 1113.72 },
      RR: { mc: 142.215, lab: 577.984 },
    },
  },
  {
    id: 'm-5',
    model: 'BM T DOOR sh DND',
    family: 'BM',
    stdMc: 4453,
    stdLab: 7341,
    planQty: 200,
    components: {
      ...zeroComp(),
      FG: { mc: 2904.854, lab: 2779.228 },
      CAB: { mc: 807.131, lab: 1331.984 },
      FL: { mc: 223.245, lab: 975.86 },
      FR: { mc: 128.55, lab: 562.224 },
      RL: { mc: 247.005, lab: 1113.72 },
      DND_IN: { mc: 71.114, lab: 288.992 },
      DND_OUT: { mc: 71.101, lab: 288.992 },
    },
  },
  {
    id: 'm-6',
    model: 'FUF14',
    family: 'FUF',
    stdMc: 1400,
    stdLab: 1518,
    planQty: 700,
    components: {
      ...zeroComp(),
      FG: { mc: 625.75, lab: 594.7405 },
      CAB: { mc: 706.468, lab: 522.014 },
      R: { mc: 67.782, lab: 401.2455 },
    },
  },
  {
    id: 'm-7',
    model: 'FUF18/22',
    family: 'FUF',
    stdMc: 1728,
    stdLab: 1872,
    planQty: 700,
    components: {
      ...zeroComp(),
      FG: { mc: 878.332, lab: 694.077 },
      CAB: { mc: 750.432, lab: 773.441 },
      R: { mc: 99.236, lab: 404.482 },
    },
  },
  {
    id: 'm-8',
    model: 'TM595',
    family: 'TM',
    stdMc: 1635,
    stdLab: 1771,
    planQty: 300,
    components: {
      ...zeroComp(),
      FG: { mc: 858.7, lab: 631.442 },
      CAB: { mc: 649.143, lab: 381.324 },
      R: { mc: 63.401, lab: 372.854 },
      F: { mc: 63.756, lab: 385.38 },
    },
  },
  {
    id: 'm-9',
    model: 'SBS550',
    family: 'SBS',
    stdMc: 1970,
    stdLab: 2819,
    planQty: 300,
    components: {
      ...zeroComp(),
      FG: { mc: 1344.529, lab: 986.444 },
      CAB: { mc: 484.674, lab: 1096.982 },
      R: { mc: 71.008, lab: 396.3582 },
      F: { mc: 68.789, lab: 339.2155 },
    },
  },
  {
    id: 'm-10',
    model: 'SBS620',
    family: 'SBS',
    stdMc: 2002,
    stdLab: 3223,
    planQty: 200,
    components: {
      ...zeroComp(),
      FG: { mc: 1327.757, lab: 1103.798 },
      CAB: { mc: 521.783, lab: 1199.357 },
      R: { mc: 77.44, lab: 500.2642 },
      F: { mc: 75.02, lab: 419.5822 },
    },
  },
  {
    id: 'm-11',
    model: 'T DOOR 520',
    family: 'T DOOR',
    stdMc: 1967,
    stdLab: 3519,
    planQty: 150,
    components: {
      ...zeroComp(),
      FG: { mc: 1095.253, lab: 1644.668 },
      CAB: { mc: 640.751, lab: 899.569 },
      FL: { mc: 42.398, lab: 178.388 },
      FR: { mc: 42.398, lab: 178.388 },
      RL: { mc: 93.568, lab: 395.002 },
      RR: { mc: 52.632, lab: 222.985 },
    },
  },
  {
    id: 'm-12',
    model: 'TM10/12',
    family: 'TM',
    stdMc: 1530,
    stdLab: 1248,
    planQty: 150,
    components: {
      ...zeroComp(),
      FG: { mc: 1148.744, lab: 509.758 },
      CAB: { mc: 212.544, lab: 338.926 },
      R: { mc: 76.888, lab: 193.396 },
      F: { mc: 91.824, lab: 205.92 },
    },
  },
  {
    id: 'm-13',
    model: 'TM14',
    family: 'TM',
    stdMc: 1832,
    stdLab: 1617,
    planQty: 300,
    components: {
      ...zeroComp(),
      FG: { mc: 1449.73, lab: 873.052 },
      CAB: { mc: 210.912, lab: 342.28 },
      R: { mc: 76.888, lab: 194.578 },
      F: { mc: 94.47, lab: 207.09 },
    },
  },
  {
    id: 'm-14',
    model: 'TM19/21',
    family: 'TM',
    stdMc: 1599,
    stdLab: 1733,
    planQty: 400,
    components: {
      ...zeroComp(),
      FG: { mc: 779.81, lab: 655.9184 },
      CAB: { mc: 646.9285, lab: 450.0664 },
      R: { mc: 76.888, lab: 305.3436 },
      F: { mc: 95.3735, lab: 321.672 },
    },
  },
  {
    id: 'm-15',
    model: 'TM545',
    family: 'TM',
    stdMc: 1335,
    stdLab: 1088,
    planQty: 300,
    components: {
      ...zeroComp(),
      FG: { mc: 790.64, lab: 332.496 },
      CAB: { mc: 388.8, lab: 130.698 },
      R: { mc: 76.888, lab: 303.746 },
      F: { mc: 78.672, lab: 321.06 },
    },
  },
  {
    id: 'm-16',
    model: 'T DOOR 469/456',
    family: 'T DOOR',
    stdMc: 1800,
    stdLab: 3468,
    planQty: 200,
    components: {
      ...zeroComp(),
      FG: { mc: 931.745, lab: 1147.428 },
      CAB: { mc: 270.974, lab: 1080.031 },
      FL: { mc: 138.322, lab: 312.4695 },
      FR: { mc: 138.322, lab: 277.5344 },
      RL: { mc: 156.17, lab: 336.4146 },
      RR: { mc: 164.467, lab: 314.1211 },
    },
  },
];

export type TimeUnit = 'sec' | 'min' | 'hr';

export function getUnitDivisor(unit: TimeUnit): number {
  if (unit === 'min') return 60;
  if (unit === 'hr') return 3600;
  return 1;
}

export function getUnitLabel(unit: TimeUnit): string {
  if (unit === 'min') return 'นาที';
  if (unit === 'hr') return 'ชั่วโมง';
  return 'วินาที';
}

export interface ComputedModelRow extends ModelRow {
  stdTotal: number;
  sumMc: number;
  sumLab: number;
  sumTotal: number;
  fgTotal: number;
  fgSharePct: number;
  cabTotal: number;
  cabSharePct: number;
  doorSumMc: number;
  doorSumLab: number;
  doorSumTotal: number;
  doorSharePct: number;
  deltaStd: number;
  reqMp: number;
  laborRatioPct: number;
  mcHoursTotal: number;
  labHoursTotal: number;
}

export function computeModelMetrics(
  row: ModelRow,
  shiftHours: number,
  efficiencyPct: number
): ComputedModelRow {
  let sumMc = 0;
  let sumLab = 0;
  let doorSumMc = 0;
  let doorSumLab = 0;

  for (const comp of COMPONENT_LIST) {
    const pair = row.components[comp.key];
    const mc = Number(pair?.mc || 0);
    const lab = Number(pair?.lab || 0);
    sumMc += mc;
    sumLab += lab;
    if (comp.group === 'DOOR') {
      doorSumMc += mc;
      doorSumLab += lab;
    }
  }

  const stdTotal = Number(row.stdMc || 0) + Number(row.stdLab || 0);
  const sumTotal = sumMc + sumLab;

  const fgTotal =
    Number(row.components.FG?.mc || 0) + Number(row.components.FG?.lab || 0);
  const cabTotal =
    Number(row.components.CAB?.mc || 0) + Number(row.components.CAB?.lab || 0);
  const doorSumTotal = doorSumMc + doorSumLab;

  const fgSharePct = sumTotal > 0 ? (fgTotal / sumTotal) * 100 : 0;
  const cabSharePct = sumTotal > 0 ? (cabTotal / sumTotal) * 100 : 0;
  const doorSharePct = sumTotal > 0 ? (doorSumTotal / sumTotal) * 100 : 0;

  const deltaStd = Math.round(sumTotal) - Math.round(stdTotal);

  const effectiveSecondsPerPerson =
    Math.max(0.1, shiftHours) * 3600 * (Math.max(1, efficiencyPct) / 100);
  const totalLabSeconds = sumLab * Math.max(0, row.planQty);
  const totalMcSeconds = sumMc * Math.max(0, row.planQty);

  const reqMp = totalLabSeconds / effectiveSecondsPerPerson;
  const laborRatioPct = sumTotal > 0 ? (sumLab / sumTotal) * 100 : 0;

  return {
    ...row,
    stdTotal,
    sumMc,
    sumLab,
    sumTotal,
    fgTotal,
    fgSharePct,
    cabTotal,
    cabSharePct,
    doorSumMc,
    doorSumLab,
    doorSumTotal,
    doorSharePct,
    deltaStd,
    reqMp,
    laborRatioPct,
    mcHoursTotal: totalMcSeconds / 3600,
    labHoursTotal: totalLabSeconds / 3600,
  };
}
