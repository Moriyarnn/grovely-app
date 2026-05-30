#!/usr/bin/env bash
# Grovely .env validator
# Catches common configuration mistakes before `docker compose up`.
# Usage:
#   ./validate-env.sh            # validates ./.env
#   ./validate-env.sh path/.env  # validates a specific file

set -u

ENV_FILE="${1:-.env}"

if [ -t 1 ]; then
  RED=$'\033[0;31m'; YELLOW=$'\033[0;33m'; GREEN=$'\033[0;32m'; BLUE=$'\033[0;34m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
else
  RED=''; YELLOW=''; GREEN=''; BLUE=''; BOLD=''; RESET=''
fi

errors=0
warnings=0

err()  { echo "${RED}error${RESET}: $1"; errors=$((errors+1)); }
warn() { echo "${YELLOW}warn${RESET}:  $1"; warnings=$((warnings+1)); }
info() { echo "${BLUE}info${RESET}:  $1"; }

echo "${BOLD}Grovely .env check${RESET} (${ENV_FILE})"
echo

if [ ! -f "$ENV_FILE" ]; then
  err "$ENV_FILE not found in the current directory."
  echo "       Download the template with:"
  echo "         curl -o .env https://raw.githubusercontent.com/Moriyarnn/grovely-app/main/.env.example"
  exit 1
fi

# Pull a value out of the env file (last definition wins, strips surrounding quotes).
get() {
  grep -E "^[[:space:]]*${1}=" "$ENV_FILE" 2>/dev/null \
    | tail -1 \
    | sed -E "s/^[[:space:]]*${1}=//; s/^['\"]//; s/['\"]$//"
}

# Required values
REQUIRED=(OWNER1_USERNAME OWNER1_PASSWORD OWNER2_USERNAME OWNER2_PASSWORD)
PLACEHOLDERS=("your_username" "partner_username" "change_me" "you" "partner")

for var in "${REQUIRED[@]}"; do
  val=$(get "$var")
  if [ -z "$val" ]; then
    err "$var is empty or missing."
    continue
  fi
  for ph in "${PLACEHOLDERS[@]}"; do
    if [ "$val" = "$ph" ]; then
      err "$var is still the template placeholder (\"$ph\"). Pick a real value."
    fi
  done
done

# Both owners must be distinct
u1=$(get OWNER1_USERNAME)
u2=$(get OWNER2_USERNAME)
if [ -n "$u1" ] && [ "$u1" = "$u2" ]; then
  err "OWNER1_USERNAME and OWNER2_USERNAME must be different."
fi

p1=$(get OWNER1_PASSWORD)
p2=$(get OWNER2_PASSWORD)
if [ -n "$p1" ] && [ "$p1" = "$p2" ]; then
  warn "OWNER1_PASSWORD and OWNER2_PASSWORD are identical."
fi

# Timezone
tz=$(get TZ)
if [ -z "$tz" ] || [ "$tz" = "UTC" ]; then
  warn "TZ is unset or UTC. Notifications fire on UTC time — set TZ to your local zone for correct delivery."
fi

# License / premium awareness
lic=$(get LICENSE_KEY)
disable_email=$(get DISABLE_EMAIL)
mail_user=$(get MAIL_USER)
mail_pass=$(get MAIL_PASSWORD)
account1_email=$(get ACCOUNT1_EMAIL)

mail_configured=true
[ -z "$mail_user" ] || [ "$mail_user" = "you@example.com" ] && mail_configured=false
[ -z "$mail_pass" ] || [ "$mail_pass" = "your-app-password" ] && mail_configured=false

s3_any=$(get BACKUP_S3_ENDPOINT)$(get BACKUP_S3_BUCKET)$(get BACKUP_S3_KEY)$(get BACKUP_S3_SECRET)$(get BACKUP_S3_REGION)
webdav_any=$(get BACKUP_WEBDAV_URL)$(get BACKUP_WEBDAV_USER)$(get BACKUP_WEBDAV_PASS)

if [ -z "$lic" ]; then
  info "LICENSE_KEY is blank — running in free tier. Email notifications, off-site backups, advanced cycle analytics, and partner-facing features stay locked. Get a key at https://grovely.lemonsqueezy.com."
  if [ "$mail_configured" = "true" ]; then
    warn "MAIL_USER / MAIL_PASSWORD are configured but LICENSE_KEY is blank — email notifications are premium and will not send."
  fi
  if [ -n "$s3_any" ] || [ -n "$webdav_any" ]; then
    warn "BACKUP_* variables are configured but LICENSE_KEY is blank — off-site backups are premium and will not run. The free in-app manual backup still works."
  fi
else
  if [[ ! "$lic" =~ ^ey ]]; then
    warn "LICENSE_KEY is set but does not look like a JWT (expected to start with \"ey\"). Premium features will stay locked."
  fi

  if [ "$disable_email" = "true" ]; then
    info "LICENSE_KEY is set but DISABLE_EMAIL=true — premium email notifications are disabled. Set DISABLE_EMAIL=false to receive period, fertile window, and pantry alerts."
  else
    if [ "$mail_configured" = "false" ]; then
      warn "Email is enabled (DISABLE_EMAIL=false) and you have a license, but MAIL_USER/MAIL_PASSWORD are unset. Notifications will not send. See .env.example for SMTP setup."
    fi
    if [ -z "$account1_email" ] || [ "$account1_email" = "you@example.com" ]; then
      warn "ACCOUNT1_EMAIL is unset or still the placeholder — no notifications will reach the primary owner."
    fi
  fi

  if [ -z "$s3_any" ] && [ -z "$webdav_any" ]; then
    info "No off-site backup target configured (BACKUP_S3_* or BACKUP_WEBDAV_*). The premium scheduled backup runs locally only. The free in-app manual backup is always available. See .env.example for off-site setup."
  fi

  # If any S3 var is set, require the full set
  if [ -n "$s3_any" ]; then
    for v in BACKUP_S3_ENDPOINT BACKUP_S3_BUCKET BACKUP_S3_KEY BACKUP_S3_SECRET BACKUP_S3_REGION; do
      if [ -z "$(get $v)" ]; then
        warn "$v is missing — S3 backups need all five BACKUP_S3_* vars set."
      fi
    done
  fi

  # Same idea for WebDAV
  if [ -n "$webdav_any" ]; then
    for v in BACKUP_WEBDAV_URL BACKUP_WEBDAV_USER BACKUP_WEBDAV_PASS; do
      if [ -z "$(get $v)" ]; then
        warn "$v is missing — WebDAV backups need all three BACKUP_WEBDAV_* vars set."
      fi
    done
  fi
fi

echo
if [ $errors -eq 0 ] && [ $warnings -eq 0 ]; then
  echo "${GREEN}OK${RESET}: your .env looks good. Start Grovely with:"
  echo "  docker compose up -d"
  exit 0
elif [ $errors -eq 0 ]; then
  echo "${GREEN}OK${RESET} with $warnings warning(s). Safe to start, but review the items above."
  exit 0
else
  echo "${RED}fail${RESET}: $errors error(s), $warnings warning(s). Fix errors above before running docker compose up."
  exit 1
fi
