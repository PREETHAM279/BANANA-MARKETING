#!/bin/bash
# Restores the CRM database from one of the files in the backups folder.
source "$(dirname "$0")/scripts/mac/common.sh"
shopt -s nullglob
files=( $(ls -t backups/crm-*.db 2>/dev/null) )
if [ ${#files[@]} -eq 0 ]; then
  bold "No backups found in $APP_DIR/backups."
  exit 0
fi
bold "Choose a backup to restore (newest first):"
i=1
for f in "${files[@]}"; do
  printf "  %2d) %s  (%s)\n" "$i" "$(basename "$f")" "$(du -h "$f" | awk '{print $1}')"
  i=$((i + 1))
  [ $i -gt 20 ] && break
done
read -r -p "Number to restore (or Enter to cancel): " n
[[ "$n" =~ ^[0-9]+$ ]] && [ "$n" -ge 1 ] && [ "$n" -le ${#files[@]} ] || { echo "Cancelled."; exit 0; }
chosen="${files[$((n - 1))]}"
head -c 15 "$chosen" | grep -q "SQLite format 3" || fail "$chosen is not a valid CRM database."
was_running=0
if is_running; then was_running=1; bold "Stopping the CRM..."; stop_server; fi
ts="$(date +%Y-%m-%d_%H-%M-%S)"
if [ -f data/crm.db ]; then cp data/crm.db "backups/crm-$ts-before-restore.db"; info "Current database saved as backups/crm-$ts-before-restore.db"; fi
rm -f data/crm.db-journal data/crm.db-wal data/crm.db-shm
cp "$chosen" data/crm.db || fail "Restore failed."
bold "Restored $(basename "$chosen")."
if [ $was_running -eq 1 ]; then exec "$APP_DIR/start-crm.command"; fi
info "Double-click start-crm.command to open the CRM."
