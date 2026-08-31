#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" == "0" ]]; then
  install -d -o postgres -g postgres -m 0700 /run/deledger-secrets
  for secret_name in postgres_password web_password maintenance_password operator_password; do
    case "$secret_name" in
      postgres_password) variable=POSTGRES_PASSWORD_FILE ;;
      web_password) variable=DELEDGER_WEB_PASSWORD_FILE ;;
      maintenance_password) variable=DELEDGER_MAINTENANCE_PASSWORD_FILE ;;
      operator_password) variable=DELEDGER_OPERATOR_PASSWORD_FILE ;;
    esac
    source_path="${!variable:-}"
    [[ -n "$source_path" ]] || continue
    [[ -r "$source_path" ]] || { printf '%s is not readable\n' "$variable" >&2; exit 1; }
    target_path="/run/deledger-secrets/$secret_name"
    install -o postgres -g postgres -m 0600 "$source_path" "$target_path"
    printf -v "$variable" '%s' "$target_path"
    export "$variable"
  done
fi

exec /usr/local/bin/docker-entrypoint.sh "$@"
