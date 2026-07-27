"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
} from "lucide-react";

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minDate?: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseValue(value: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} | null {
  if (!value) return null;
  const d = new Date(value.replace(" ", "T"));
  if (isNaN(d.getTime())) return null;
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  };
}

function formatDisplay(value: string): string {
  const p = parseValue(value);
  if (!p) return "";
  const h12 = p.hour % 12 || 12;
  const ampm = p.hour >= 12 ? "PM" : "AM";
  return `${pad(p.day)}-${pad(p.month + 1)}-${p.year}  ${pad(h12)}:${pad(p.minute)} ${ampm}`;
}

function toIsoLocal(y: number, mo: number, d: number, h: number, mi: number) {
  return `${y}-${pad(mo + 1)}-${pad(d)} ${pad(h)}:${pad(mi)}:00`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "DD-MM-YYYY HH:mm AM",
  className = "",
  minDate = "",
}: DateTimePickerProps) {
  const now = new Date();
  const parsed = parseValue(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsed?.year ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? now.getMonth());
  const [selDay, setSelDay] = useState<number | null>(parsed?.day ?? null);
  const [selYear, setSelYear] = useState(parsed?.year ?? now.getFullYear());
  const [selMonth, setSelMonth] = useState(parsed?.month ?? now.getMonth());
  const [hour, setHour] = useState(parsed?.hour ?? 0);
  const [minute, setMinute] = useState(parsed?.minute ?? 0);
  const [ampm, setAmpm] = useState(parsed && parsed.hour >= 12 ? "PM" : "AM");

  const [inputValue, setInputValue] = useState(
    parsed ? formatDisplay(value) : "",
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = parseValue(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
      setSelYear(p.year);
      setSelMonth(p.month);
      setSelDay(p.day);
      setHour(p.hour);
      setMinute(p.minute);
      setAmpm(p.hour >= 12 ? "PM" : "AM");
      setInputValue(formatDisplay(value));
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const changeHour = (delta: number) => {
    setHour((prev) => {
      let next = (prev + delta + 24) % 24;
      return next;
    });
  };

  const changeMinute = (delta: number) => {
    setMinute((prev) => {
      let next = (prev + delta + 60) % 60;
      return next;
    });
  };

  const toggleAmpm = () => {
    setAmpm((prev) => {
      const next = prev === "AM" ? "PM" : "AM";
      if (next === "PM" && hour < 12) setHour(hour + 12);
      if (next === "AM" && hour >= 12) setHour(hour - 12);
      return next;
    });
  };

  const selectDay = (d: number) => {
    setSelDay(d);
    setSelYear(viewYear);
    setSelMonth(viewMonth);
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const totalDays = getDaysInMonth(viewYear, viewMonth);
  const firstDow = getFirstDayOfWeek(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  const isToday = (day: number) => {
    const t = new Date();
    return (
      day === t.getDate() &&
      viewMonth === t.getMonth() &&
      viewYear === t.getFullYear()
    );
  };

  const isSelected = (d: number) =>
    selDay === d && selYear === viewYear && selMonth === viewMonth;

  const isDisabled = (d: number) => {
    if (!minDate) return false;
    const minP = parseValue(minDate);
    if (!minP) return false;
    const current = new Date(viewYear, viewMonth, d);
    const min = new Date(minP.year, minP.month, minP.day);
    min.setHours(0, 0, 0, 0);
    return current < min;
  };

  const clearAll = () => {
    onChange("");
    setSelDay(null);
    setOpen(false);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div
        className={`w-full flex items-center bg-slate-50 dark:bg-[#1e293b] border rounded transition-colors ${
          open
            ? "border-[#4ade80]/60 ring-1 ring-[#4ade80]/20"
            : "border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10"
        }`}
      >
        <div className="flex-1 flex flex-col min-w-0">
          <input
            type="text"
            value={inputValue}
            placeholder={placeholder}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={() => {
              const match = inputValue.match(
                /^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM|am|pm))?$/
              );
              if (match) {
                const [_, d, m, y, h, mi, ampmMatch] = match;
                let hourVal = parseInt(h);
                const minVal = parseInt(mi);
                const ampmStr = ampmMatch ? ampmMatch.toUpperCase() : null;
                
                if (ampmStr === "PM" && hourVal < 12) hourVal += 12;
                if (ampmStr === "AM" && hourVal === 12) hourVal = 0;
                
                onChange(
                  toIsoLocal(
                    parseInt(y),
                    parseInt(m) - 1,
                    parseInt(d),
                    hourVal,
                    minVal
                  )
                );
              } else if (inputValue === "") {
                onChange("");
              } else {
                setInputValue(value ? formatDisplay(value) : "");
              }
            }}
            className="w-full bg-transparent px-3 py-1.5 text-[11px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
          />
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-2 py-1.5 text-slate-400 hover:text-[#4ade80] transition-colors border-l border-slate-100 dark:border-white/5 cursor-pointer"
        >
          <Calendar
            className={`h-3.5 w-3.5 transition-transform ${open ? "scale-110" : ""}`}
          />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-[10000] w-[420px] bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-white/5">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex h-[260px]">
            <div className="flex-1 p-3 border-r border-slate-100 dark:border-white/5 overflow-hidden">
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {DAYS_SHORT.map((d) => (
                  <div key={d} className="text-[10px] font-bold text-slate-400 dark:text-slate-500 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5 mt-1">
                {cells.map((day, idx) => {
                  if (!day) return <div key={idx} className="h-8" />;
                  const disabled = isDisabled(day);
                  const selected = isSelected(day);
                  const today = isToday(day);
                  return (
                    <button
                      key={idx}
                      onClick={() => !disabled && selectDay(day)}
                      className={`h-8 flex items-center justify-center text-sm rounded-md transition-all cursor-pointer ${
                        selected
                          ? "bg-[#4ade80] text-white dark:text-[#0f172a] font-bold shadow"
                          : disabled
                            ? "opacity-20 cursor-not-allowed grayscale"
                            : today
                              ? "border border-[#4ade80]/50 text-[#4ade80]"
                              : "hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300"
                      }`}
                      disabled={disabled}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-[170px] flex flex-col items-center pt-5 bg-slate-50/80 dark:bg-white/5 border-l border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-1.5 mb-4">
                <Clock className="h-3.5 w-3.5 text-[#4ade80]" />
                <span className="uppercase text-[10px] font-semibold tracking-widest text-slate-500 dark:text-slate-400">
                  TIME
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Hour */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => changeHour(1)}
                    className="p-1 text-slate-400 hover:text-[#4ade80] hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-all active:scale-90"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pad(hour)}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      if (v) {
                        let num = parseInt(v.slice(-2));
                        if (num > 23) num = 23;
                        setHour(num);
                      } else {
                        setHour(0);
                      }
                    }}
                    className="w-10 h-10 text-center text-lg font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg shadow-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#4ade80]/50"
                  />
                  <button
                    onClick={() => changeHour(-1)}
                    className="p-1 text-slate-400 hover:text-[#4ade80] hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-all active:scale-90"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                <div className="text-xl font-bold text-slate-300 dark:text-slate-600">
                  :
                </div>

                {/* Minute */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => changeMinute(1)}
                    className="p-1 text-slate-400 hover:text-[#4ade80] hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-all active:scale-90"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pad(minute)}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      if (v) {
                        let num = parseInt(v.slice(-2));
                        if (num > 59) num = 59;
                        setMinute(num);
                      } else {
                        setMinute(0);
                      }
                    }}
                    className="w-10 h-10 text-center text-lg font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg shadow-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#4ade80]/50"
                  />
                  <button
                    onClick={() => changeMinute(-1)}
                    className="p-1 text-slate-400 hover:text-[#4ade80] hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-all active:scale-90"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                <div className="text-xl font-bold text-slate-300 dark:text-slate-600 mx-1"></div>

                {/* AM/PM */}
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    onClick={toggleAmpm}
                    className={`px-2 py-1 text-[10px] font-bold rounded transition-all border ${
                      ampm === "AM"
                        ? "bg-[#4ade80] border-[#4ade80] text-white dark:text-[#0f172a]"
                        : "bg-transparent border-slate-200 dark:border-white/10 text-slate-500 hover:border-[#4ade80] hover:text-[#4ade80]"
                    }`}
                  >
                    AM
                  </button>
                  <button
                    onClick={toggleAmpm}
                    className={`px-2 py-1 text-[10px] font-bold rounded transition-all border ${
                      ampm === "PM"
                        ? "bg-[#4ade80] border-[#4ade80] text-white dark:text-[#0f172a]"
                        : "bg-transparent border-slate-200 dark:border-white/10 text-slate-500 hover:border-[#4ade80] hover:text-[#4ade80]"
                    }`}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-[#0f172a]">
            <button
              onClick={clearAll}
              className="text-sm text-slate-500 hover:text-red-500 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => {
                if (!selDay) {
                  const today = new Date();
                  onChange(
                    toIsoLocal(
                      today.getFullYear(),
                      today.getMonth(),
                      today.getDate(),
                      hour,
                      minute,
                    ),
                  );
                } else {
                  onChange(toIsoLocal(selYear, selMonth, selDay, hour, minute));
                }
                setOpen(false);
              }}
              className="text-xs font-semibold text-white dark:text-[#0f172a] bg-[#4ade80] hover:bg-[#4ade80]/90 px-4 py-1.5 rounded-lg transition-all shadow-sm active:scale-95"
            >
              Select
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
