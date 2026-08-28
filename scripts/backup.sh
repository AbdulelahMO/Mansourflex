#!/bin/bash
# نسخة احتياطية من قاعدة البيانات والمرفقات معاً.
#
# قاعدة SQLite لا تُنسخ بـ cp والنظام يعمل: قد تُلتقط أثناء الكتابة فتخرج تالفة ولا
# يُكتشف ذلك إلا يوم الحاجة. لذلك تُستخدم VACUUM INTO التي تُخرج لقطة متماسكة ولو
# كان النظام يكتب، ثم يُتحقّق من سلامتها قبل اعتمادها.
set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="$PROJECT/prisma/dev.db"
UPLOADS="$PROJECT/uploads"

DEST="${1:-${BACKUP_DIR:-$HOME/Library/Mobile Documents/com~apple~CloudDocs/property-manager-backups}}"
KEEP_DAYS="${KEEP_DAYS:-14}"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DEST/backup-$STAMP"

[ -f "$DB" ] || { echo "✗ قاعدة البيانات غير موجودة: $DB" >&2; exit 1; }
mkdir -p "$OUT"

# لقطة متماسكة من القاعدة
sqlite3 "$DB" "VACUUM INTO '$OUT/dev.db';"

# التحقق من سلامة اللقطة قبل الاعتماد عليها
INTEGRITY="$(sqlite3 "$OUT/dev.db" "PRAGMA integrity_check;")"
if [ "$INTEGRITY" != "ok" ]; then
  echo "✗ اللقطة تالفة: $INTEGRITY" >&2
  rm -rf "$OUT"
  exit 1
fi

# المرفقات: الصكوك والاتفاقيات الموقّعة وصور العقارات وفواتير الموردين
if [ -d "$UPLOADS" ]; then
  tar -czf "$OUT/uploads.tar.gz" -C "$PROJECT" uploads
fi

# بيان يوصف ما في النسخة، ليُتحقّق منه عند الاستعادة
{
  echo "التاريخ: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "المصدر: $PROJECT"
  echo "حجم القاعدة: $(du -h "$OUT/dev.db" | cut -f1)"
  [ -f "$OUT/uploads.tar.gz" ] && echo "حجم المرفقات: $(du -h "$OUT/uploads.tar.gz" | cut -f1)"
  echo "سلامة القاعدة: $INTEGRITY"
  echo
  echo "عدد السجلات:"
  for T in buildings units owners tenants contracts payments expenses financial_documents \
           management_agreements owner_remittances users audit_logs; do
    printf "  %-24s %s\n" "$T" "$(sqlite3 "$OUT/dev.db" "SELECT COUNT(*) FROM $T;" 2>/dev/null || echo '—')"
  done
  echo
  echo "البصمات:"
  shasum -a 256 "$OUT/dev.db" | sed "s|$OUT/||"
  [ -f "$OUT/uploads.tar.gz" ] && shasum -a 256 "$OUT/uploads.tar.gz" | sed "s|$OUT/||"
} > "$OUT/manifest.txt"

# حذف ما تجاوز مدة الاحتفاظ
find "$DEST" -maxdepth 1 -type d -name 'backup-*' -mtime "+$KEEP_DAYS" -exec rm -rf {} + 2>/dev/null || true

echo "✓ نسخة احتياطية: $OUT"
sed -n '1,6p' "$OUT/manifest.txt"
