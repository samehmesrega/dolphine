import { useState } from 'react';

export type DateRange = { from: string; to: string };

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function getMonday(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = r.getDate() - day + (day === 0 ? -6 : 1);
  r.setDate(diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

type Preset = { label: string; getRange: () => DateRange };

const PRESETS: Preset[] = [
  {
    label: 'اليوم',
    getRange: () => {
      const d = new Date();
      return { from: fmt(startOfDay(d)), to: fmt(d) };
    },
  },
  {
    label: 'أمس',
    getRange: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return { from: fmt(startOfDay(d)), to: fmt(d) };
    },
  },
  {
    label: 'هذا الأسبوع',
    getRange: () => ({ from: fmt(getMonday(new Date())), to: fmt(new Date()) }),
  },
  {
    label: 'الأسبوع الماضي',
    getRange: () => {
      const monday = getMonday(new Date());
      const lastSunday = new Date(monday);
      lastSunday.setDate(lastSunday.getDate() - 1);
      const lastMonday = getMonday(lastSunday);
      return { from: fmt(lastMonday), to: fmt(lastSunday) };
    },
  },
  {
    label: 'آخر 7 أيام',
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return { from: fmt(startOfDay(from)), to: fmt(to) };
    },
  },
  {
    label: 'آخر 14 يوم',
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 13);
      return { from: fmt(startOfDay(from)), to: fmt(to) };
    },
  },
  {
    label: 'هذا الشهر',
    getRange: () => {
      const d = new Date();
      const from = new Date(d.getFullYear(), d.getMonth(), 1);
      return { from: fmt(from), to: fmt(d) };
    },
  },
  {
    label: 'الشهر الماضي',
    getRange: () => {
      const d = new Date();
      const lastDay = new Date(d.getFullYear(), d.getMonth(), 0);
      const firstDay = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      return { from: fmt(firstDay), to: fmt(lastDay) };
    },
  },
  {
    label: 'هذا العام',
    getRange: () => {
      const d = new Date();
      const from = new Date(d.getFullYear(), 0, 1);
      return { from: fmt(from), to: fmt(d) };
    },
  },
  {
    label: 'العام الماضي',
    getRange: () => {
      const d = new Date();
      const from = new Date(d.getFullYear() - 1, 0, 1);
      const to = new Date(d.getFullYear() - 1, 11, 31);
      return { from: fmt(from), to: fmt(to) };
    },
  },
];

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [activePreset, setActivePreset] = useState<string | null>('آخر 30 يوم');
  const [isCustom, setIsCustom] = useState(false);

  const handlePreset = (preset: Preset) => {
    setIsCustom(false);
    setActivePreset(preset.label);
    onChange(preset.getRange());
  };

  const handleCustom = () => {
    setIsCustom(true);
    setActivePreset(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => handlePreset(preset)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            activePreset === preset.label
              ? 'bg-amber-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {preset.label}
        </button>
      ))}
      <button
        type="button"
        onClick={handleCustom}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
          isCustom
            ? 'bg-amber-600 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        مخصص
      </button>
      {isCustom && (
        <div className="flex items-center gap-2 mt-2 w-full sm:w-auto sm:mt-0">
          <input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <span className="text-slate-500 text-sm">إلى</span>
          <input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      )}
    </div>
  );
}
