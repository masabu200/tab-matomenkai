#!/bin/sh
# Builds the Chrome Web Store upload ZIP from extension/.
# The store rejects a manifest that contains "key" (it assigns the ID itself), so the copy
# inside the ZIP drops it; the development manifest keeps it so local builds share the store ID.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
VERSION=$(python3 -c "import json;print(json.load(open('$ROOT/extension/manifest.json'))['version'])")
STAGE=$(mktemp -d "${TMPDIR:-/tmp}/pwm-store-XXXXXX")
OUT="$ROOT/dist/tab-matomenkai-$VERSION.zip"
mkdir -p "$ROOT/dist"
rsync -a --exclude '.DS_Store' --exclude 'CHROMEWEBSTORE.md' "$ROOT/extension/" "$STAGE/"
python3 - "$STAGE/manifest.json" <<'PY'
import json,sys
p=sys.argv[1]; m=json.load(open(p)); m.pop('key',None)
json.dump(m,open(p,'w'),ensure_ascii=False,indent=2); open(p,'a').write('\n')
PY
rm -f "$OUT"
(cd "$STAGE" && zip -qr -X "$OUT" .)
rm -rf "$STAGE"
echo "$OUT"
