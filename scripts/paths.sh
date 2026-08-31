# أين تعيش القاعدة والمرفقات — نفس ما يقرأه التطبيق.
#
# Sourced by backup and restore so the three of them agree. On a developer's machine these
# are the checkout's own paths; on a server DATABASE_URL and UPLOADS_DIR point at a mounted
# volume, and a backup that ignored them would faithfully snapshot an empty database and
# report success. Mirrors src/lib/paths.ts.

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# .env is where the application reads its configuration locally, and the shell does not.
if [ -z "${DATABASE_URL:-}" ] && [ -f "$PROJECT/.env" ]; then
  DATABASE_URL="$(sed -n 's/^[[:space:]]*DATABASE_URL[[:space:]]*=[[:space:]]*//p' "$PROJECT/.env" | tail -1 | tr -d '"'"'")"
fi

DB="$PROJECT/prisma/dev.db"
case "${DATABASE_URL:-}" in
  file:/*) DB="${DATABASE_URL#file:}" ;;                  # absolute — a mounted volume
  file:*)  DB="$PROJECT/prisma/${DATABASE_URL#file:}" ;;  # relative to the schema, as Prisma resolves it
esac
DB="${DB%%\?*}"                                           # drop any ?connection_limit=… tail

UPLOADS="${UPLOADS_DIR:-$PROJECT/uploads}"
# tar is entered by the parent so the archive keeps a top-level `uploads/`, whatever the
# directory's absolute path happens to be.
UPLOADS_PARENT="$(dirname "$UPLOADS")"
UPLOADS_NAME="$(basename "$UPLOADS")"
