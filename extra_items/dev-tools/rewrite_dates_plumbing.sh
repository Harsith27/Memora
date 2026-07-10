#!/usr/bin/env bash
set -euo pipefail

START_DATE="2026-01-01"
BASE="$(git merge-base HEAD origin/main)"
OLD_HEAD="$(git rev-parse HEAD)"
TS="$(date +%Y%m%d%H%M%S)"
BACKUP_BRANCH="backup-main-before-date-plumbing-${TS}"

# Safety backup before rewriting history.
git branch "$BACKUP_BRANCH" "$OLD_HEAD"

mapfile -t COMMITS < <(git rev-list --reverse "${BASE}..${OLD_HEAD}")

NEW_PARENT="$BASE"
INDEX=0

for OLD_COMMIT in "${COMMITS[@]}"; do
  DATE_STAMP="$(date -d "$START_DATE +$INDEX day" '+%Y-%m-%dT12:00:00')"

  TREE_HASH="$(git show -s --format=%T "$OLD_COMMIT")"

  AUTHOR_NAME="$(git show -s --format=%an "$OLD_COMMIT")"
  AUTHOR_EMAIL="$(git show -s --format=%ae "$OLD_COMMIT")"
  COMMITTER_NAME="$(git show -s --format=%cn "$OLD_COMMIT")"
  COMMITTER_EMAIL="$(git show -s --format=%ce "$OLD_COMMIT")"

  MSG_FILE="$(mktemp)"
  git show -s --format=%B "$OLD_COMMIT" > "$MSG_FILE"

  NEW_COMMIT="$({
    GIT_AUTHOR_NAME="$AUTHOR_NAME" \
    GIT_AUTHOR_EMAIL="$AUTHOR_EMAIL" \
    GIT_AUTHOR_DATE="$DATE_STAMP" \
    GIT_COMMITTER_NAME="$COMMITTER_NAME" \
    GIT_COMMITTER_EMAIL="$COMMITTER_EMAIL" \
    GIT_COMMITTER_DATE="$DATE_STAMP" \
    git commit-tree "$TREE_HASH" -p "$NEW_PARENT" < "$MSG_FILE"
  })"

  rm -f "$MSG_FILE"
  NEW_PARENT="$NEW_COMMIT"
  INDEX=$((INDEX + 1))
done

# Move main to rewritten tip, guarded by expected old head.
git update-ref refs/heads/main "$NEW_PARENT" "$OLD_HEAD"

echo "Rewritten commits: $INDEX"
echo "Backup branch: $BACKUP_BRANCH"
git log --date=short --pretty=format:'%h %ad %s' -n 20
