#!/usr/bin/env bash
# Upgrade this fork to the latest stable GitHub Release of umami-software/umami.
#
# Daily master commits are ignored on purpose: only published, non-prerelease
# releases are candidates. A day with no new release is a no-op (no PR).
set -euo pipefail

CHECKPOINT_PATH=".github/upstream-sync-base"
SYNC_BRANCH="sync/upstream"
UPSTREAM_REPO="${UPSTREAM_REPO:-umami-software/umami}"

github_output() {
  local key="$1"
  local value="$2"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    printf '%s=%s\n' "$key" "$value" >>"$GITHUB_OUTPUT"
  fi
}

github_output_multiline() {
  local key="$1"
  local value="$2"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    local delim="EOF"
    printf '%s<<%s\n%s\n%s\n' "$key" "$delim" "$value" "$delim" >>"$GITHUB_OUTPUT"
  fi
}

read_checkpoint_at() {
  local ref="$1"
  if git cat-file -e "$ref:$CHECKPOINT_PATH" 2>/dev/null; then
    git show "$ref:$CHECKPOINT_PATH" | head -n 1 | tr -d '[:space:]'
  fi
}

validate_sha() {
  local sha="$1"
  if ! [[ "$sha" =~ ^[0-9a-fA-F]{40}$ ]]; then
    echo "::error::Invalid commit SHA: $sha" >&2
    exit 1
  fi
  if ! git cat-file -e "$sha^{commit}" 2>/dev/null; then
    echo "::error::Commit is not available locally: $sha" >&2
    exit 1
  fi
}

latest_stable_release_tag() {
  if [ -n "${LATEST_RELEASE_TAG:-}" ]; then
    printf '%s\n' "$LATEST_RELEASE_TAG"
    return 0
  fi
  gh api "repos/${UPSTREAM_REPO}/releases/latest" --jq .tag_name
}

cmd_check() {
  git checkout -B migration-base origin/master

  local last_synced=""
  last_synced="$(read_checkpoint_at origin/master)"
  if [ -z "$last_synced" ] && git cat-file -e "HEAD:$CHECKPOINT_PATH" 2>/dev/null; then
    last_synced="$(git show "HEAD:$CHECKPOINT_PATH" | head -n 1 | tr -d '[:space:]')"
    echo "Using the checkpoint from the workflow ref"
  fi
  if [ -z "$last_synced" ]; then
    echo "::error::Missing $CHECKPOINT_PATH checkpoint" >&2
    exit 1
  fi
  validate_sha "$last_synced"

  local release_tag
  release_tag="$(latest_stable_release_tag)"
  if [ -z "$release_tag" ]; then
    echo "::error::Could not resolve the latest stable upstream release" >&2
    exit 1
  fi

  local release_sha
  if [ -n "${LATEST_RELEASE_SHA:-}" ]; then
    release_sha="$LATEST_RELEASE_SHA"
  else
    release_sha="$(git rev-parse "${release_tag}^{commit}")"
  fi
  validate_sha "$release_sha"

  github_output "last-synced" "$last_synced"
  github_output "release-tag" "$release_tag"
  github_output "release-sha" "$release_sha"
  github_output "current-upstream" "$release_sha"

  if [ "$last_synced" = "$release_sha" ]; then
    github_output "upstream-commits" "0"
    github_output "no-merge-needed" "true"
    echo "Already on latest stable release ${release_tag} (${release_sha})"
    return 0
  fi

  if ! git merge-base --is-ancestor "$last_synced" "$release_sha"; then
    echo "::error::Latest release ${release_tag} (${release_sha}) is not a descendant of checkpoint ${last_synced}" >&2
    exit 1
  fi

  local commit_count
  commit_count="$(git rev-list --count "$last_synced..$release_sha")"
  github_output "upstream-commits" "$commit_count"
  github_output "no-merge-needed" "false"
  echo "New stable release ${release_tag} (${commit_count} commits after checkpoint)"
}

mark_needs_manual() {
  local conflicts="$1"
  git merge --abort || true
  github_output "has-changes" "false"
  github_output "needs-manual" "true"
  github_output_multiline "conflicts" "$conflicts"
}

resolve_fork_local_conflicts() {
  local conflict_paths
  conflict_paths="$(git diff --name-only --diff-filter=U)"

  if [ -z "$conflict_paths" ]; then
    echo "Merge failed without file conflicts; aborting merge" >&2
    mark_needs_manual "(merge failed without file conflicts)"
    return 1
  fi

  local non_fork_conflicts=""
  local path
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    case "$path" in
      .github/workflows/*|.gitignore) ;;
      *) non_fork_conflicts+="$path"$'\n' ;;
    esac
  done <<<"$conflict_paths"

  if [ -n "$non_fork_conflicts" ]; then
    echo "Application conflicts require a manual upgrade:" >&2
    printf ' - %s\n' "$non_fork_conflicts" >&2
    mark_needs_manual "$(printf '%s' "$non_fork_conflicts")"
    return 1
  fi

  echo "Resolving fork-local conflicts by keeping the current fork versions:"
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    case "$path" in
      .github/workflows/*|.gitignore)
        echo " - $path"
        git checkout --ours -- "$path"
        git add -- "$path"
        ;;
    esac
  done <<<"$conflict_paths"
  return 0
}

drop_upstream_workflow_changes() {
  local workflow_changes
  workflow_changes="$(git diff --name-only --cached -- '.github/workflows/*' || true)"
  local path
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    if git cat-file -e "HEAD:$path" 2>/dev/null; then
      git restore --source=HEAD --staged --worktree -- "$path"
    else
      git rm -f -- "$path"
    fi
  done <<<"$workflow_changes"
}

cmd_merge() {
  local last_synced="${LAST_SYNCED:?LAST_SYNCED is required}"
  local release_sha="${CURRENT_UPSTREAM:?CURRENT_UPSTREAM is required}"
  local release_tag="${RELEASE_TAG:-}"
  local upstream_commits="${UPSTREAM_COMMITS:?UPSTREAM_COMMITS is required}"
  validate_sha "$last_synced"
  validate_sha "$release_sha"

  github_output "needs-manual" "false"
  github_output "has-changes" "false"

  if [ "$upstream_commits" -eq 0 ]; then
    echo "No new stable release to merge"
    return 0
  fi

  git checkout -B "$SYNC_BRANCH" origin/master

  # Keep this inside an actual release upgrade so we never open a PR whose
  # only job is to rewrite git history.
  if ! git merge-base --is-ancestor "$last_synced" HEAD; then
    echo "Recording checkpoint $last_synced as merged without taking its tree"
    git merge -s ours --no-ff --no-edit \
      -m "ci: record upstream checkpoint ${last_synced} as merged" \
      "$last_synced"
  fi

  if ! git merge --no-ff --no-edit --no-commit "$release_sha"; then
    if ! resolve_fork_local_conflicts; then
      return 0
    fi
  fi

  drop_upstream_workflow_changes

  printf '%s\n' "$release_sha" >"$CHECKPOINT_PATH"
  git add -- "$CHECKPOINT_PATH"

  if git diff --cached --quiet && [ -z "$(git rev-parse -q --verify MERGE_HEAD || true)" ]; then
    echo "No effective changes from ${release_tag:-$release_sha} after preserving fork-local files"
    git merge --abort || true
    return 0
  fi

  local message="chore: upgrade umami to ${release_tag:-$release_sha}"
  if git rev-parse -q --verify MERGE_HEAD >/dev/null; then
    git commit --no-edit
  elif ! git diff --cached --quiet; then
    git commit -m "$message"
  fi

  github_output "has-changes" "true"
  github_output "branch" "$SYNC_BRANCH"
}

issue_title_for() {
  printf 'Manual upgrade needed: umami %s\n' "$1"
}

cmd_notify() {
  local release_tag="${RELEASE_TAG:?RELEASE_TAG is required}"
  local conflicts="${CONFLICTS:-}"
  local title
  title="$(issue_title_for "$release_tag")"

  local existing=""
  existing="$(
    gh issue list --repo "$GITHUB_REPOSITORY" --state open --json number,title \
      | jq -r --arg t "$title" '.[] | select(.title == $t) | .number' \
      | head -n 1
  )"
  if [ -n "$existing" ]; then
    echo "Issue #${existing} already tracks ${release_tag}"
    github_output "already-reported" "true"
    github_output "issue-number" "$existing"
    return 0
  fi

  local body
  body="$(cat <<EOF
Latest stable upstream release [${release_tag}](https://github.com/${UPSTREAM_REPO}/releases/tag/${release_tag}) does not apply cleanly onto this fork.

Conflicting files:

$(printf '%s\n' "$conflicts" | sed '/^$/d; s/^/- /')

The daily job will keep watching this tag but will not open another issue until this one is closed.
EOF
)"

  local url
  url="$(gh issue create --repo "$GITHUB_REPOSITORY" --title "$title" --body "$body")"
  echo "Opened $url"
  github_output "already-reported" "false"
  github_output "issue-url" "$url"
}

usage() {
  echo "Usage: $0 check|merge|notify" >&2
  exit 2
}

case "${1:-}" in
  check) cmd_check ;;
  merge) cmd_merge ;;
  notify) cmd_notify ;;
  *) usage ;;
esac
