"use client";

import { useState, useEffect } from "react";
import { DateTimePicker } from "./datetimeui";

interface DateRangePickerProps {
  dateFrom: string;
  dateTo: string;
  onApply: (from: string, to: string) => void;
  onClear?: () => void;
  label?: string;
}

export function DateRangePicker({
  dateFrom,
  dateTo,
  onApply,
  onClear,
  label,
}: DateRangePickerProps) {
  const [localFrom, setLocalFrom] = useState(dateFrom);
  const [localTo, setLocalTo] = useState(dateTo);

  useEffect(() => {
    setLocalFrom(dateFrom);
    setLocalTo(dateTo);
  }, [dateFrom, dateTo]);

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] text-slate-400 uppercase font-bold ml-1">
            Start Date
          </span>
          <DateTimePicker
            value={localFrom}
            onChange={setLocalFrom}
            placeholder="Select start date"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] text-slate-400 uppercase font-bold ml-1">
            End Date
          </span>
          <DateTimePicker
            value={localTo}
            onChange={setLocalTo}
            placeholder="Select end date"
            minDate={localFrom}
          />
        </div>
        <div className="flex items-center gap-2 mt-2">
          {onClear && (localFrom || localTo) && (
            <button
              onClick={() => {
                setLocalFrom("");
                setLocalTo("");
                onClear();
              }}
              className="flex-1 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-red-500 bg-slate-100 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => onApply(localFrom, localTo)}
            className="flex-1 py-1.5 text-[11px] font-semibold text-white dark:text-[#0f172a] bg-[#4ade80] hover:bg-[#4ade80]/90 rounded-lg transition-all shadow-sm active:scale-95"
          >
            Apply Dates
          </button>
        </div>
      </div>
    </div>
  );
}
