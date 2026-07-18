$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
& "$root\python\python.exe" -m uvicorn app:app --host 127.0.0.1 --port 8000 --app-dir $root
