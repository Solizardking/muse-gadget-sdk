#!/usr/bin/env python3
"""Record reference evidence without copying user secrets, avatars or build products."""
import hashlib
import json
from pathlib import Path
root=Path('/Users/8bit/Untitled')
files=['README.md','LICENSE','CODE_OF_CONDUCT.md','CONTRIBUTING.md','.gitignore',
       'esp32/AGENTS.md','esp32/main/image_fetch.h','esp32/devices/AGENTS.md',
       'linux/AGENTS.md','linux/src/musegadget/executor.py','linux/pyproject.toml',
       'skills/README.md','.github/workflows/esp32.yml','.github/workflows/linux.yml']
records=[]
for name in files:
    file=root/name
    records.append({'path':name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest() if file.exists() else None})
Path('docs/reference-manifest.json').write_text(json.dumps({'reference_root':str(root),'files':records},indent=2)+'\n')
print('Recorded upstream reference hashes; no credentials copied.')
