#!/bin/bash
# استعادة نسخة احتياطية.
#
# نسخة احتياطية لم تُجرَّب استعادتها ليست نسخة، بل أمنية. لذلك يأخذ هذا السكربت نسخة
# أمان من الحالة الراهنة قبل الكتابة فوقها، ويتحقّق من سلامة النسخة المستعادة بعدها.
set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="$PROJECT/prisma/dev.db"
UPLOADS="$PROJECT/uploads"

SRC="${1:-}"
if [ -z "$SRC" ] || [ ! -f "$SRC/dev.db" ]; then
  echo "الاستخدام: scripts/restore.sh <مجلد النسخة>" >&2
  echo "مثال:   scripts/restore.sh ~/Library/Mobile\\ Documents/com~apple~CloudDocs/property-manager-backups/backup-20260827-120000" >&2
  exit 1
fi

# التحقّق من سلامة النسخة قبل المساس بالبيانات الحالية
INTEGRITY="$(sqlite3 "$SRC/dev.db" "PRAGMA integrity_check;")"
[ "$INTEGRITY" = "ok" ] || { echo "✗ النسخة تالفة: $INTEGRITY" >&2; exit 1; }

echo "ستُستعاد النسخة التالية:"
sed -n '1,6p' "$SRC/manifest.txt" 2>/dev/null || true
echo
echo "⚠ أوقف خادم التطوير أولاً، فهو يمسك بقاعدة البيانات."
read -r -p "متابعة الاستعادة؟ اكتب نعم: " CONFIRM
[ "$CONFIRM" = "نعم" ] || { echo "أُلغيت."; exit 1; }

# نسخة أمان من الحالة الراهنة، فالاستعادة الخاطئة لا تُفقد شيئاً
SAFETY="$PROJECT/.restore-safety/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$SAFETY"
[ -f "$DB" ] && sqlite3 "$DB" "VACUUM INTO '$SAFETY/dev.db';"
[ -d "$UPLOADS" ] && tar -czf "$SAFETY/uploads.tar.gz" -C "$PROJECT" uploads
echo "✓ حُفظت الحالة الراهنة في: $SAFETY"

cp "$SRC/dev.db" "$DB"
# ملفات SQLite المساعدة تخصّ الحالة القديمة، وبقاؤها يفسد القاعدة المستعادة
rm -f "$DB-wal" "$DB-shm"

if [ -f "$SRC/uploads.tar.gz" ]; then
  rm -rf "$UPLOADS"
  tar -xzf "$SRC/uploads.tar.gz" -C "$PROJECT"
fi

AFTER="$(sqlite3 "$DB" "PRAGMA integrity_check;")"
[ "$AFTER" = "ok" ] || { echo "✗ القاعدة المستعادة تالفة: $AFTER" >&2; exit 1; }

echo "✓ تمت الاستعادة."
echo "  المباني: $(sqlite3 "$DB" 'SELECT COUNT(*) FROM buildings;')  |  العقود: $(sqlite3 "$DB" 'SELECT COUNT(*) FROM contracts;')  |  الدفعات: $(sqlite3 "$DB" 'SELECT COUNT(*) FROM payments;')"
echo "  شغّل الخادم من جديد."
