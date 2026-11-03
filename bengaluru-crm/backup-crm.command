#!/bin/bash
# Makes a complete copy of your CRM database in the backups folder (safe while the CRM is running).
source "$(dirname "$0")/scripts/mac/common.sh"
ensure_node
[ -d node_modules ] || fail "Run start-crm.command once first."
bold "Backing up your CRM..."
node scripts/backup.mjs || fail "Backup failed."
info "Tip: copy the backups folder to iCloud Drive, Google Drive or a USB stick for an off-Mac copy."
open "$APP_DIR/backups"
