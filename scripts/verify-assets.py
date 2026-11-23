from hashlib import sha256
import json
from pathlib import Path
import sys
import zipfile

root = Path(sys.argv[1])
native = root / "native-android"
source = native / "app/src/main/assets"
packs = source / "avatar/packs"
poses = list((packs / "poses").rglob("*.webp"))
if len(poses) != 115:
    raise SystemExit("The required 115 poses were not staged")
files = {f"assets/{p.relative_to(source).as_posix()}": p for p in poses}
files["assets/avatar/packs/index.json"] = packs / "index.json"
files["assets/voice/voice-bank.json"] = source / "voice/voice-bank.json"
files["assets/world-between/owner-avatar.jpg"] = root / "between-worlds-prod/public/owner-avatar.jpg"
with zipfile.ZipFile(native / "app/build/outputs/apk/debug/app-debug.apk") as built:
    for name, path in files.items():
        if sha256(path.read_bytes()).digest() != sha256(built.read(name)).digest():
            raise SystemExit("A required private asset differs from the staged input")
print(json.dumps({"asset_files_verified": len(files), "pose_files_verified": len(poses)}))
