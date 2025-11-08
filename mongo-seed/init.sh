#!/usr/bin/env bash
set -euo pipefail

DB="${MONGO_INITDB_DATABASE:-mydb}"

echo "[seed] Importando CSVs a la base '$DB'..."
shopt -s nullglob
for file in /seed/*.csv; do
  coll="$(basename "$file" .csv)"
  echo "[seed] -> $file  =>  $DB.$coll"
  mongoimport \
    --host localhost \
    --port 27017 \
    --db "$DB" \
    --collection "$coll" \
    --type csv \
    --headerline \
    --drop \
    --ignoreBlanks \
    "$file"
done
echo "[seed] Listo."
