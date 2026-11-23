from pathlib import Path
import sys
import zipfile

destination = Path(sys.argv[2]).resolve()
with zipfile.ZipFile(sys.argv[1]) as source:
    members = source.infolist()
    if sum(info.file_size for info in members) > 400_000_000:
        raise SystemExit("Build input exceeds the size bound")
    for info in members:
        relative = Path(info.filename)
        if not relative.parts or relative.parts[0] not in {
            "native-android", "between-worlds-prod", "build-input.json"
        }:
            raise SystemExit("Unexpected input directory")
        path = (destination / relative).resolve()
        if not path.is_relative_to(destination):
            raise SystemExit("Input must stay under the build workspace")
        if info.is_dir():
            path.mkdir(parents=True, exist_ok=True)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("xb") as out:
                out.write(source.read(info))
