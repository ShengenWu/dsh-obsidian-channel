#!/bin/sh
# Link the INSTALLED dsh's rc.6 runtime packages into this repo's node_modules
# so tests/smoke.mjs runs against the real defineTool/schemastery compilers.
# Usage: sh scripts/link-runtime.sh
set -e
DROOT="/Users/shengen/.nvm/versions/node/v24.13.0/lib/node_modules/@deepseek-ai/dsh/node_modules"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$HERE/node_modules/@deepseek-ai"
ln -sfn "$DROOT/@deepseek-ai/dsh-tools" "$HERE/node_modules/@deepseek-ai/dsh-tools"
ln -sfn "$DROOT/@deepseek-ai/schemastery" "$HERE/node_modules/@deepseek-ai/schemastery"
echo "linked rc.6 runtime packages into node_modules/@deepseek-ai"
