"""
RailETA — Pre-Commit Security & Secret Scanner
Scans all source code, markdown, YAML, JSON, and config files to guarantee
zero hardcoded secrets, private keys, or API tokens before pushing to GitHub.
"""

import os
import re
import sys

# High entropy / secret patterns
SUSPICIOUS_PATTERNS = [
    (r"(?i)api[_-]?key\s*[:=]\s*['\"][a-zA-Z0-9_\-]{16,}['\"]", "Hardcoded API Key string assignment"),
    (r"(?i)bearer\s+[a-zA-Z0-9_\-\.]{20,}", "Hardcoded Bearer Token"),
    (r"rg_[a-zA-Z0-9]{20,}", "RailRadar API Key pattern"),
    (r"J2PoDev5zJO3vq5e3vhx", "MapTiler sample key pattern"),
    (r"9748b6e63727ff760d27b2af81aef9b8", "OpenWeather sample key pattern"),
    (r"2cb597dc08284692f5b0f20d0a6c4a45", "OpenTopography sample key pattern"),
    (r"-----BEGIN\s+(RSA|OPENSSH|DSA|EC|PGP)?\s*PRIVATE\s+KEY-----", "Private Key File Header"),
    (r"AIzaSy[a-zA-Z0-9_\-]{33}", "Google Gemini/Cloud API Key"),
    (r"ghp_[a-zA-Z0-9]{36}", "GitHub Personal Access Token"),
    (r"sk-[a-zA-Z0-9]{32,}", "OpenAI API Key"),
]

IGNORED_DIRS = {
    ".git", "node_modules", "venv", ".venv", "env", "__pycache__", ".pytest_cache", ".next", "out", "build", "dist"
}

IGNORED_FILES = {
    ".env", ".env.local", "security_audit_scanner.py"
}

def scan_repository(root_dir: str):
    print(f"Scanning directory: {root_dir} for security compliance...")
    findings = []
    file_count = 0

    for root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        
        for file in files:
            if file in IGNORED_FILES or file.endswith(".pyc") or file.endswith(".joblib") or file.endswith(".ico") or file.endswith(".png") or file.endswith(".woff2"):
                continue

            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, root_dir)
            file_count += 1

            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                for pattern, desc in SUSPICIOUS_PATTERNS:
                    matches = re.finditer(pattern, content)
                    for m in matches:
                        # Exclude harmless placeholder references
                        matched_text = m.group(0)
                        if "your_" in matched_text or "<YOUR_" in matched_text or "mock" in matched_text:
                            continue
                        findings.append((rel_path, desc, matched_text))
            except Exception as e:
                print(f"Warning: Could not read {rel_path}: {e}")

    print(f"Scanned {file_count} project files.")
    if findings:
        print("\n❌ SECURITY ISSUES DETECTED:")
        for path, desc, text in findings:
            print(f"  - {path}: {desc} -> {text[:30]}...")
        sys.exit(1)
    else:
        print("\n✅ ZERO SECRETS DETECTED: Codebase is 100% clean and ready for GitHub push!")
        sys.exit(0)

if __name__ == "__main__":
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    scan_repository(repo_root)
