import { execSync } from "node:child_process";

const PORTS = [3000, 3001, 3002, 3003, 3005, 3006];

function killPorts() {
  const isWindows = process.platform === "win32";

  for (const port of PORTS) {
    try {
      if (isWindows) {
        const stdout = execSync(`netstat -ano -p tcp | findstr :${port}`, { encoding: "utf8" });
        const lines = stdout.trim().split("\n");
        const pids = new Set();
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5 && (parts[1].endsWith(`:${port}`) || parts[1] === `[::]:${port}`)) {
            const pid = parts[parts.length - 1];
            if (pid && pid !== "0" && pid !== String(process.pid)) {
              pids.add(pid);
            }
          }
        }
        for (const pid of pids) {
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
            console.log(`Freed port ${port} (terminated PID ${pid})`);
          } catch {}
        }
      } else {
        const stdout = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" }).trim();
        if (stdout) {
          const pids = stdout.split("\n");
          for (const pid of pids) {
            execSync(`kill -9 ${pid}`, { stdio: "ignore" });
            console.log(`Freed port ${port} (terminated PID ${pid})`);
          }
        }
      }
    } catch {
      // No process found on this port, ignore
    }
  }
}

killPorts();
