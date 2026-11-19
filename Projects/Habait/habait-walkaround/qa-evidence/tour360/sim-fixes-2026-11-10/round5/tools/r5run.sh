#!/usr/bin/env bash
# r5run.sh <tab> ... : the four sets of each tab through the skirting edit (cache hits are $0)
cd /c/RnD/Projects/Habait/habait-walkaround; export HABAIT_APP_DIR=C:/RnD/Projects/Habait/tools/appdeps
for t in "$@"; do for s in base parquet concrete marble; do timeout 170 node Habait/tour360/tools/gen-pano.mjs apt846 ${t}__${s} gpt25-medium --prompts _local/round5/prompts.json --seed 91 --cap 367.66 2>&1 | tail -1 | cut -c1-120; done; done
