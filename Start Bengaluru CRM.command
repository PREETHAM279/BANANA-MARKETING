#!/bin/bash
# Convenience launcher at the top of the repository - runs bengaluru-crm/start-crm.command.
exec "$(cd "$(dirname "$0")" && pwd)/bengaluru-crm/start-crm.command"
