#!/usr/bin/env python3
"""
nitro-bridge.py — Local HTTP bridge for NitroSense fan control
Run this alongside 'npm run dev' so the React UI can read/write fan speeds.
"""

import json
import os
import platform
import shutil
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

SYSFS_PATH = "/sys/devices/platform/acer-wmi/nitro_sense/fan_speed"
PORT = 7337


def log(level, message):
    stream = sys.stderr if level in {"ERROR", "WARN"} else sys.stdout
    print(f"[nitro-bridge] {level}: {message}", file=stream, flush=True)


def run_command(command, timeout=2):
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        return {
            "ok": result.returncode == 0,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "returncode": result.returncode,
        }
    except FileNotFoundError:
        return {
            "ok": False,
            "stdout": "",
            "stderr": f"Command not found: {command[0]}",
            "returncode": 127,
        }
    except Exception as exc:
        return {
            "ok": False,
            "stdout": "",
            "stderr": str(exc),
            "returncode": 1,
        }


def get_loaded_modules():
    module_names = ("acer_wmi", "linuwu_sense")
    modules = {name: False for name in module_names}
    lsmod = run_command(["lsmod"])

    if lsmod["ok"]:
        for line in lsmod["stdout"].splitlines():
            name = line.split()[0] if line.split() else ""
            if name in modules:
                modules[name] = True
    else:
        for name in module_names:
            modules[name] = os.path.isdir(f"/sys/module/{name}")

    return {
        "loaded": modules,
        "lsmod_available": lsmod["ok"],
        "lsmod_error": lsmod["stderr"] or None,
    }


def get_diagnostics():
    try:
        with open("/proc/cmdline", "r", encoding="utf-8") as handle:
            cmdline = handle.read().strip()
    except Exception as exc:
        cmdline = ""
        log("WARN", f"Unable to read /proc/cmdline: {exc}")

    modules = get_loaded_modules()
    sysfs_exists = os.path.exists(SYSFS_PATH)

    return {
        "kernel": platform.release(),
        "cmdline": {
            "raw": cmdline,
            "nitro_v4_enabled": "nitro_v4=1" in cmdline.split(),
        },
        "modules": modules,
        "sysfs": {
            "path": SYSFS_PATH,
            "exists": sysfs_exists,
            "readable": os.access(SYSFS_PATH, os.R_OK) if sysfs_exists else False,
            "writable": os.access(SYSFS_PATH, os.W_OK) if sysfs_exists else False,
        },
        "pkexec": {
            "available": shutil.which("pkexec") is not None,
        },
    }


def error_payload(reason, message, diagnostics, details=None):
    payload = {
        "status": "error",
        "reason": reason,
        "message": message,
        "diagnostics": diagnostics,
    }
    if details:
        payload["details"] = details
    return payload


def ensure_sysfs_available(diagnostics, for_write=False):
    sysfs = diagnostics["sysfs"]
    modules = diagnostics["modules"]["loaded"]
    nitro_v4_enabled = diagnostics["cmdline"]["nitro_v4_enabled"]

    if not sysfs["exists"]:
        hints = []
        if not nitro_v4_enabled:
            hints.append("missing kernel parameter nitro_v4=1")
        if not modules.get("linuwu_sense"):
            hints.append("linuwu_sense is not loaded")
        if not modules.get("acer_wmi"):
            hints.append("acer_wmi is not loaded")

        message = "Nitro hardware interface not available. Check kernel/module."
        details = ", ".join(hints) if hints else "sysfs path missing"
        log("WARN", f"{message} ({details})")
        return error_payload("nitro_not_available", message, diagnostics, details)

    if not sysfs["readable"]:
        message = "Nitro hardware interface exists but is not readable."
        log("WARN", message)
        return error_payload("permission_denied", message, diagnostics)

    if for_write and not sysfs["writable"] and not diagnostics["pkexec"]["available"]:
        message = "Nitro hardware interface is not writable and pkexec is unavailable."
        log("WARN", message)
        return error_payload("permission_denied", message, diagnostics)

    return None


def read_fan_speed():
    diagnostics = get_diagnostics()
    availability_error = ensure_sysfs_available(diagnostics)
    if availability_error:
        return availability_error

    try:
        with open(SYSFS_PATH, "r", encoding="utf-8") as handle:
            raw = handle.read().strip()

        parts = [part.strip() for part in raw.split(",")]
        if len(parts) != 2:
            message = f"Unexpected fan speed format: {raw!r}"
            log("ERROR", message)
            return error_payload("invalid_response", message, diagnostics)

        cpu, gpu = int(parts[0]), int(parts[1])
        return {
            "status": "ok",
            "cpu": cpu,
            "gpu": gpu,
            "diagnostics": diagnostics,
        }
    except PermissionError as exc:
        message = f"Permission denied while reading fan speeds: {exc}"
        log("ERROR", message)
        return error_payload("permission_denied", message, diagnostics)
    except Exception as exc:
        message = f"Failed to read fan speeds: {exc}"
        log("ERROR", message)
        return error_payload("read_failed", message, diagnostics)


def write_fan_speed(cpu, gpu):
    diagnostics = get_diagnostics()
    availability_error = ensure_sysfs_available(diagnostics, for_write=True)
    if availability_error:
        return availability_error

    value = f"{cpu},{gpu}\n"

    try:
        if diagnostics["sysfs"]["writable"]:
            with open(SYSFS_PATH, "w", encoding="utf-8") as handle:
                handle.write(value)
        else:
            result = subprocess.run(
                ["pkexec", "tee", SYSFS_PATH],
                input=value,
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            if result.returncode != 0:
                message = "Failed to write fan speeds through pkexec."
                details = result.stderr.strip() or result.stdout.strip() or f"return code {result.returncode}"
                log("ERROR", f"{message} {details}")
                return error_payload("write_failed", message, diagnostics, details)

        log("INFO", f"Applied fan speed: CPU={cpu}% GPU={gpu}%")
        return {
            "status": "ok",
            "success": True,
            "cpu": cpu,
            "gpu": gpu,
            "diagnostics": diagnostics,
        }
    except PermissionError as exc:
        message = f"Permission denied while writing fan speeds: {exc}"
        log("ERROR", message)
        return error_payload("permission_denied", message, diagnostics)
    except Exception as exc:
        message = f"Failed to write fan speeds: {exc}"
        log("ERROR", message)
        return error_payload("write_failed", message, diagnostics)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def send_json(self, code, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_json(200, {"status": "ok"})

    def do_GET(self):
        if self.path == "/read":
            payload = read_fan_speed()
            self.send_json(200 if payload["status"] == "ok" else 503, payload)
            return

        if self.path == "/diagnostics":
            self.send_json(200, {"status": "ok", "diagnostics": get_diagnostics()})
            return

        if self.path == "/health":
            diagnostics = get_diagnostics()
            self.send_json(200, {"status": "ok", "diagnostics": diagnostics})
            return

        self.send_json(404, {"status": "error", "reason": "not_found", "message": "Not found"})

    def do_POST(self):
        if self.path != "/write":
            self.send_json(404, {"status": "error", "reason": "not_found", "message": "Not found"})
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        try:
            payload = json.loads(body or b"{}")
            cpu = max(0, min(100, int(payload.get("cpu", 0))))
            gpu = max(0, min(100, int(payload.get("gpu", 0))))
        except Exception as exc:
            self.send_json(
                400,
                {
                    "status": "error",
                    "reason": "invalid_payload",
                    "message": f"Invalid JSON payload: {exc}",
                },
            )
            return

        result = write_fan_speed(cpu, gpu)
        self.send_json(200 if result["status"] == "ok" else 503, result)


if __name__ == "__main__":
    print(f"[nitro-bridge] Starting on http://localhost:{PORT}", flush=True)
    print(f"[nitro-bridge] Sysfs path: {SYSFS_PATH}", flush=True)
    print("[nitro-bridge] CORS: all origins allowed (localhost only)", flush=True)

    server = HTTPServer(("127.0.0.1", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[nitro-bridge] Stopped.", flush=True)
