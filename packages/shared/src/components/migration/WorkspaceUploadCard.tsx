import React, { useState, useRef } from "react";
import { UploadCloud, FileSpreadsheet, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { parseSpreadsheetContent, type SpreadsheetParseResult } from "../../migration";

export interface WorkspaceUploadCardProps {
  onStartIngest: (params: {
    workspaceName: string;
    admissionPrefix: string;
    nextSequence: number;
    parseResult: SpreadsheetParseResult;
  }) => Promise<void>;
  isIngesting: boolean;
}

export function WorkspaceUploadCard({ onStartIngest, isIngesting }: WorkspaceUploadCardProps) {
  const currentYear = new Date().getFullYear();
  const [workspaceName, setWorkspaceName] = useState(`${currentYear}/${currentYear + 1} Baseline Intake`);
  const [admissionPrefix, setAdmissionPrefix] = useState(`SCH/${currentYear}/`);
  const [nextSequence, setNextSequence] = useState(1);
  const [parseResult, setParseResult] = useState<SpreadsheetParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsParsing(true);

    try {
      const text = await file.text();
      const result = parseSpreadsheetContent(text);
      setParseResult(result);
    } catch (err) {
      console.error("Failed to parse spreadsheet:", err);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsParsing(true);

    try {
      const text = await file.text();
      const result = parseSpreadsheetContent(text);
      setParseResult(result);
    } catch (err) {
      console.error("Failed to parse spreadsheet:", err);
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parseResult || parseResult.totalRows === 0) return;

    await onStartIngest({
      workspaceName,
      admissionPrefix,
      nextSequence,
      parseResult,
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 leading-tight flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
          Upload & Stage School Spreadsheet
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Import student rosters and historical scores from CSV or Excel files with zero direct database writes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Workspace Configurations */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Workspace Label
            </label>
            <input
              type="text"
              required
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              placeholder="e.g. 2026/2027 Baseline Intake"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Admission No. Prefix
            </label>
            <input
              type="text"
              value={admissionPrefix}
              onChange={(e) => setAdmissionPrefix(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-mono font-medium text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              placeholder="e.g. SCH/2026/"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Sequence Starting Seed
            </label>
            <input
              type="number"
              min={1}
              value={nextSequence}
              onChange={(e) => setNextSequence(parseInt(e.target.value, 10) || 1)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-mono font-medium text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              placeholder="e.g. 1 or 101"
            />
          </div>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
            fileName
              ? "border-indigo-300 bg-indigo-50/20"
              : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50/70"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,.tsv,.txt"
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-2.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              {isParsing ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <UploadCloud className="h-6 w-6" />
              )}
            </div>

            {fileName ? (
              <div>
                <p className="text-sm font-bold text-slate-900">{fileName}</p>
                {parseResult && (
                  <p className="text-xs font-medium text-emerald-600 mt-1 flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Parsed {parseResult.totalRows} rows across {parseResult.headers.length} columns
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Click to browse or drag and drop your spreadsheet here
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Supports .csv and text exports from Excel, Google Sheets, or legacy systems
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
                <Sparkles className="h-4 w-4" />
                <span>Begin Staging & Clash Intelligence</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
