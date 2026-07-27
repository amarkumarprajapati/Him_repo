"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (row: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  searchable?: boolean;
  searchKeys?: (keyof T)[];
  searchPlaceholder?: string;
  title?: React.ReactNode;
  titleIcon?: React.ReactNode;
  filters?: React.ReactNode;
  rowKey: (row: T, index: number) => string;
  loading?: boolean;
  className?: string;
  onPageSizeChange?: (size: number) => void;
}

export function DataTable<T>({
  data,
  columns,
  pageSize = 10,
  searchable = false,
  searchKeys,
  searchPlaceholder = "Search...",
  title,
  titleIcon,
  filters,
  rowKey,
  loading = false,
  className = "",
  onPageSizeChange,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSizeOpen, setIsSizeOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!searchable || !searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter((row) => {
      const keys = searchKeys || (Object.keys(row as any) as (keyof T)[]);
      return keys.some((key) => {
        const val = (row as any)[key];
        return val != null && String(val).toLowerCase().includes(term);
      });
    });
  }, [data, searchTerm, searchable, searchKeys]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push("...");
        pages.push(totalPages);
      }
    }
    return pages;
  };



  return (
    <div className={`bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-white/5 p-5 shadow-sm flex flex-col overflow-hidden ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 flex-shrink-0">
        {title && (
          <div className="flex items-center gap-2">
            {titleIcon}
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
              {title}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 ml-auto">
          {searchable && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-8 pr-3 py-1.5 rounded-md bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#4ade80]/50 w-48"
              />
            </div>
          )}
          {filters}
        </div>
      </div>

      <div className="overflow-auto custom-scrollbar flex-1 min-h-0">
        <table className="w-full text-left text-[12px] table-fixed min-w-full">
          <thead className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/5 sticky top-0 bg-white dark:bg-[#0f172a] z-10">
            <tr>
              {columns?.map((col) => (
                <th
                  key={col.key}
                  className={`pb-3 pt-1 font-medium ${col.align === "right" ? "text-right pr-10" : ""}`}
                  style={{ width: col.width, minWidth: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-slate-700 dark:text-slate-300">
            {loading ? (
              Array.from({ length: pageSize }).map((_, i) => (
                <tr
                  key={`skel-${i}`}
                  className="border-b border-slate-100 dark:border-white/5"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`py-3 ${col.align === "right" ? "text-right" : ""}`}
                      style={{ width: col.width, minWidth: col.width }}
                    >
                      <div className="h-3.5 rounded bg-slate-200 dark:bg-white/10 animate-pulse w-full max-w-[8rem]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <>
                {paginated?.map((row, i) => (
                  <tr
                    key={rowKey(row, i)}
                    className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors animate-row-fade-in opacity-0"
                    style={{ animationDelay: `${i * 0.02}s` }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`py-3 ${col.align === "right" ? "text-right pr-10" : ""}`}
                        style={{ width: col.width, minWidth: col.width }}
                      >
                        {col.render
                          ? col.render(row, i)
                          : String((row as any)[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
                {paginated.length === 0 && !loading && (
                  <tr>
                    <td colSpan={columns.length} className="py-20 text-center text-slate-400">
                      No data available
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-200 dark:border-white/5 flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2 border-l border-slate-200 dark:border-white/5 pl-4">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Load limit</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSizeOpen(!isSizeOpen)}
                className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/5 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-emerald-500/50 transition-all"
              >
                {pageSize}
                <ChevronLeft className={`h-3 w-3 text-slate-400 transition-transform ${isSizeOpen ? "-rotate-90" : ""}`} />
              </button>
              
              <AnimatePresence>
                {isSizeOpen && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setIsSizeOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 5 }}
                      className="absolute bottom-full mb-2 right-0 w-24 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden z-[70] p-1.5 flex flex-col gap-1"
                    >
                      {[10, 20, 50, 100].map((size) => (
                        <button
                          key={size}
                          onClick={() => {
                            onPageSizeChange?.(size);
                            setIsSizeOpen(false);
                          }}
                          className={`w-full px-2 py-1.5 text-[11px] font-bold rounded-lg transition-all text-left ${
                            pageSize === size
                              ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                              : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                      <div className="h-px bg-slate-100 dark:bg-white/10 my-0.5" />
                      <div className="px-2 py-1 flex items-center gap-1">
                        <span className="text-[9px] text-slate-400 font-bold uppercase">Custom</span>
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={pageSize}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val > 0) {
                              onPageSizeChange?.(val);
                            } else if (e.target.value === "") {
                              onPageSizeChange?.(1);
                            }
                          }}
                          className="w-full bg-slate-50 dark:bg-black/20 rounded px-1 py-0.5 text-[11px] font-bold text-emerald-500 outline-none"
                        />
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {getPageNumbers()?.map((num, idx) =>
            num === "..." ? (
              <span
                key={`dots-${idx}`}
                className="px-2 py-1 text-xs text-slate-400 dark:text-slate-500"
              >
                ...
              </span>
            ) : (
              <button
                key={num}
                onClick={() => setPage(num)}
                className={`min-w-[2rem] px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  num === currentPage
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                }`}
              >
                {num}
              </button>
            )
          )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
