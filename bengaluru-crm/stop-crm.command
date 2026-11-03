#!/bin/bash
# Stops the Bengaluru Sales CRM background server.
source "$(dirname "$0")/scripts/mac/common.sh"
if stop_server; then
  bold "CRM stopped. Your data is safe in data/crm.db."
else
  bold "The CRM is not running."
fi
