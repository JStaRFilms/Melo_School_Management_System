"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Download, Printer, Share2, X, CheckCircle2, Award } from "lucide-react";
import React from "react";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName?: string;
  classNameTitle?: string;
  termAverage?: string;
  position?: string;
}

export function InteractiveReportModal({
  isOpen,
  onClose,
  studentName = "Sarah Okon",
  classNameTitle = "JSS 2 Silver",
  termAverage = "92.6%",
  position = "1st of 42",
}: ReportModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl rounded-3xl border border-stone-200 bg-white shadow-2xl overflow-hidden text-stone-900"
        >
          {/* Header Action Bar */}
          <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/80 px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-stone-600">
                Official Report Card Preview
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print</span>
              </button>
              <button
                onClick={onClose}
                className="rounded-xl p-1.5 text-stone-400 hover:bg-stone-200/60 hover:text-stone-700 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Printable Report Sheet Body */}
          <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto">
            {/* School Crest & Header */}
            <div className="text-center border-b border-stone-200 pb-5">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white font-serif text-2xl font-bold shadow-md">
                M
              </div>
              <h3 className="font-serif text-2xl font-bold text-stone-900">
                MELO DEMO ACADEMY
              </h3>
              <p className="text-xs text-stone-500 font-mono">
                Continuous Assessment & Terminal Evaluation • Session 2025/2026
              </p>
            </div>

            {/* Student Metadata Card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl bg-stone-50 p-4 border border-stone-200/80 text-xs font-mono">
              <div>
                <span className="text-stone-400 block text-[10px]">STUDENT NAME</span>
                <span className="font-bold text-stone-800">{studentName}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">CLASS ARM</span>
                <span className="font-bold text-stone-800">{classNameTitle}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">TERM AVERAGE</span>
                <span className="font-bold text-emerald-700">{termAverage}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">CLASS POSITION</span>
                <span className="font-bold text-amber-700">{position}</span>
              </div>
            </div>

            {/* Subject Breakdown Table */}
            <div className="rounded-2xl border border-stone-200 overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-stone-100 text-stone-600 border-b border-stone-200">
                  <tr>
                    <th className="p-3">Subject</th>
                    <th className="p-3">CA1 (20)</th>
                    <th className="p-3">CA2 (20)</th>
                    <th className="p-3">Exam (60)</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  <tr>
                    <td className="p-3 font-semibold text-stone-900 font-sans">Mathematics</td>
                    <td className="p-3">19</td>
                    <td className="p-3">18</td>
                    <td className="p-3">56</td>
                    <td className="p-3 font-bold text-stone-900">93</td>
                    <td className="p-3 text-emerald-700 font-bold">A1</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-stone-900 font-sans">English Language</td>
                    <td className="p-3">18</td>
                    <td className="p-3">18</td>
                    <td className="p-3">54</td>
                    <td className="p-3 font-bold text-stone-900">90</td>
                    <td className="p-3 text-emerald-700 font-bold">A1</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-stone-900 font-sans">Basic Science</td>
                    <td className="p-3">20</td>
                    <td className="p-3">19</td>
                    <td className="p-3">56</td>
                    <td className="p-3 font-bold text-stone-900">95</td>
                    <td className="p-3 text-emerald-700 font-bold">A1</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-stone-900 font-sans">Civic Education</td>
                    <td className="p-3">17</td>
                    <td className="p-3">18</td>
                    <td className="p-3">53</td>
                    <td className="p-3 font-bold text-stone-900">88</td>
                    <td className="p-3 text-emerald-700 font-bold">A1</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Principal Remark & Digital Stamp */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-stone-200 text-xs">
              <div>
                <span className="text-stone-400 font-mono block text-[10px]">
                  PRINCIPAL'S REMARK
                </span>
                <p className="italic font-serif text-stone-800 text-sm mt-0.5">
                  "Exemplary diligence and academic excellence throughout the term."
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-800 font-mono">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-[11px] font-bold">Digitally Certified & Sealed</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
