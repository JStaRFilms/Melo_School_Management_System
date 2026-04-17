#!/usr/bin/env python3
"""Verification script for the tenant school public-site batch.

Runs the app-specific checks required by the implementation workflow.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PNPM = "pnpm.cmd" if os.name == "nt" else "pnpm"

CHECKS = [
    [PNPM, "--filter", "@school/sites", "build"],
    [PNPM, "--filter", "@school/sites", "exec", "tsc", "--noEmit", "-p", "tsconfig.json"],
    [PNPM, "--filter", "@school/sites", "lint"],
]


def run_check(command: list[str]) -> int:
    print(f"\n$ {' '.join(command)}")
    completed = subprocess.run(command, cwd=ROOT)
    return completed.returncode


def main() -> int:
    print("Running vibe verification for @school/sites...")
    for command in CHECKS:
        result = run_check(command)
        if result != 0:
            print("\nVerification failed.")
            return result
    print("\nAll vibe verification checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
