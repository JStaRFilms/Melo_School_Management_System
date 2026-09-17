"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { appToast, getErrorMessage } from "@school/shared/toast";

interface CountedSchool {
  _id: string;
  name: string;
  currentStudentCount: number | null;
}

export function StudentCountValue({ school }: { school: CountedSchool }) {
  const recalculate = useMutation(
    "functions/platform/index:recalculateSchoolEnrollmentCount" as never,
  );
  const [isCalculating, setIsCalculating] = useState(false);

  if (school.currentStudentCount !== null) {
    return (
      <span className="font-bold text-slate-900">
        {school.currentStudentCount.toLocaleString()}
      </span>
    );
  }

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      await recalculate({ schoolId: school._id as never } as never);
      appToast.success("Student count calculated", {
        description: `${school.name} now has a current enrollment count.`,
      });
    } catch (error) {
      appToast.error("Could not calculate student count", {
        description: getErrorMessage(
          error,
          "Try again after reviewing the school roster.",
        ),
      });
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCalculate}
      disabled={isCalculating}
      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400"
    >
      {isCalculating ? "Calculating..." : "Calculate"}
    </button>
  );
}
