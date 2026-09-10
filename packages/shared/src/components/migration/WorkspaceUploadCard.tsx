import React, { useState, useRef } from "react";
import { UploadCloud, FileSpreadsheet, ArrowRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  parseSpreadsheetContent,
  parseWorkbookBinary,
  type SpreadsheetParseResult,
} from "../../migration";

export interface WorkspaceUploadCardProps {
  onStartIngest: (params: {
    workspaceName: string;
    parseResult: SpreadsheetParseResult;
  }) => Promise<void>;
  isIngesting: boolean;
}

export function WorkspaceUploadCard({ onStartIngest, isIngesting }: WorkspaceUploadCardProps) {
  const currentYear = new Date().getFullYear();
  const [workspaceName, setWorkspaceName] = useState(`${currentYear}/${currentYear + 1} Baseline Intake`);
  const [parseResult, setParseResult] = useState<SpreadsheetParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParseError(null);
    setIsParsing(true);

    try {
      let result: SpreadsheetParseResult;
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext === "csv" || ext === "tsv" || ext === "txt") {
        const text = await file.text();
        result = parseSpreadsheetContent(text);
      } else {
        const buffer = await file.arrayBuffer();
        result = parseWorkbookBinary(buffer);
      }

      setParseResult(result);
    } catch (err: any) {
      setParseError(err.message || "Failed to parse file. Please upload a valid CSV or Excel file.");
      setParseResult(null);
    } finally {
      setIsParsing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parseResult || parseResult.totalRows === 0) return;
    await onStartIngest({
      workspaceName,
      parseResult,
    });
  };

  return (
    <div className="w-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <UploadCloud className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Upload Data Workspace</h2>
          <p className="text-xs text-slate-500">
            Import existing students, guardian contacts, and past term results via spreadsheet
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Workspace Title Input */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Migration Batch Label
          </label>
          <input
            type="text"
            required
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="e.g. 2026/2027 Academic Intake Roster"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
          />
        </div>

        {/* Dropzone */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Spreadsheet Source File
          </label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
              fileName
                ? "border-indigo-300 bg-indigo-50/30"
                : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/60"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
              accept=".csv,.tsv,.xlsx,.xls"
              className="hidden"
            />

            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-100 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="h-6 w-6 text-indigo-600" />
            </div>

            {isParsing ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Reading spreadsheet records...</span>
              </div>
            ) : fileName ? (
              <div className="space-y-1">
                <p className="text-xs font-bold text-indigo-950 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {fileName}
                </p>
                {parseResult && (
                  <p className="text-[11px] text-slate-500 font-medium">
                    Parsed <span className="font-bold text-slate-800">{parseResult.totalRows}</span> rows across{" "}
                    <span className="font-bold text-slate-800">{parseResult.headers.length}</span> columns
                  </p>
                )}
                {parseError && (
                  <p className="text-xs font-medium text-rose-600 flex items-center justify-center gap-1 mt-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {parseError}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Click to browse or drag and drop your spreadsheet here
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Supports Excel (.xlsx, .xls) and CSV (.csv, .tsv) files
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!parseResult || parseResult.totalRows === 0 || isIngesting || isParsing}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {isIngesting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Staging {parseResult?.totalRows} Records...</span>
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                <span>Begin Staging & Duplicate Check</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
