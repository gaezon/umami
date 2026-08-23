#!/usr/bin/env bash
# Sync this fork with umami-software/umami.
#
# The fork's git history was content-reconciled rather than merge-committed, so
# `git merge upstream/master` replays thousands of diverged commits and conflicts
# on fork-local files. The checkpoint in .github/upstream-sync-base is the last
# upstream SHA we have already taken. New work is applied as:
#   1. `git merge -s ours <checkpoint>` if that commit is not in HEAD (records
#      the shared history without changing the tree)
#   2. `git merge <current-upstream>` which is then incremental
set -euo pipefail

CHECKPOINT_PATH=".github/upstream-sync-base"
SYNC_BRANCH="sync/upstream"

github_output() {
  local key="$1"
  local value="$2"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    printf '%s=%s\n' "$key" "$value" >>"$GITHUB_OUTPUT"
  fi
}

read_checkpoint_at() {
  local ref="$1"
  if git cat-file -e "$ref:$CHECKPOINT_PATH" 2>/dev/null; then
    git show "$ref:$CHECKPOINT_PATH" | tr -d '[:space:]'
  fi
}

validate_checkpoint() {
  local sha="$1"
  if ! [[ "$sha" =~ ^[0-9a-fA-F]{40}$ ]]; then
    echo "::error::Invalid upstream checkpoint: $sha" >&2
    exit 1
  fi
  if ! git cat-file -e "$sha^{commit}" 2>/dev/null; then
    echo "::error::Checkpoint commit is not available locally: $sha" >&2
    exit 1
  fi
}

cmd_check() {
  local workflow_checkpoint=""
  if git cat-file -e "HEAD:$CHECKPOINT_PATH" 2>/dev/null; then
    workflow_checkpoint="$(git show "HEAD:$CHECKPOINT_PATH" | tr -d '[:space:]')"
  fi

  git checkout -B migration-base origin/master
  local sync_base_ref="origin/master"
  local sync_pr_number=""
  if [ -n "${GH_TOKEN:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
    sync_pr_number="$(gh pr list --repo "$GITHUB_REPOSITORY" --head "$SYNC_BRANCH" --state open --json number --jq '.[0].number // empty')"
  fi
  if [ -n "$sync_pr_number" ] && git show-ref --verify --quiet refs/remotes/origin/"$SYNC_BRANCH"; then
    sync_base_ref="origin/$SYNC_BRANCH"
    echo "Using the existing sync PR branch as the comparison base"
  fi

  local last_synced=""
  last_synced="$(read_checkpoint_at "$sync_base_ref")"
  if [ -z "$last_synced" ] && [ -n "$workflow_checkpoint" ]; then
    last_synced="$workflow_checkpoint"
    echo "Using the checkpoint from the workflow ref"
  fi
  if [ -z "$last_synced" ]; then
    echo "::error::Missing $CHECKPOINT_PATH checkpoint" >&2
    exit 1
  fi

  local current_upstream
  current_upstream="$(git rev-parse "${UPSTREAM_REF:-upstream/master}")"
  validate_checkpoint "$last_synced"

  local UPSTREAM_COMMITS
  if [ "$last_synced" = "$current_upstream" ]; then
    UPSTREAM_COMMITS=0
  elif ! git merge-base --is-ancestor "$last_synced" "$current_upstream"; then
    echo "::error::Upstream history changed: checkpoint $last_synced is not an ancestor of $current_upstream" >&2
    exit 1
  else
    UPSTREAM_COMMITS="$(git rev-list --count "$last_synced..$current_upstream")"
  fi

  local history_unification_needed=false
  if ! git merge-base --is-ancestor "$last_synced" origin/master; then
    history_unification_needed=true
    echo "Fork history does not contain checkpoint $last_synced; will unify before merging"
  fi

  github_output "last-synced" "$last_synced"
  github_output "current-upstream" "$current_upstream"
  github_output "upstream-commits" "$UPSTREAM_COMMITS"
  github_output "history-unification-needed" "$history_unification_needed"

  if [ "${UPSTREAM_COMMITS:-0}" -eq 0 ] && [ "$history_unification_needed" = false ]; then
    github_output "no-merge-needed" "true"
    echo "No new commits to merge"
  else
    github_output "no-merge-needed" "false"
    echo "Found $UPSTREAM_COMMITS candidate upstream changes; unification_needed=$history_unification_needed"
  fi
}

resolve_fork_local_conflicts() {
  local conflict_paths
  conflict_paths="$(git diff --name-only --diff-filter=U)"

  if [ -z "$conflict_paths" ]; then
    echo "Merge failed without file conflicts; aborting merge" >&2
    git merge --abort || true
    exit 1
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
    echo "::error::Unresolved non-workflow merge conflicts:" >&2
    printf ' - %s\n' "$non_fork_conflicts" >&2
    git merge --abort
    exit 1
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
  local current_upstream="${CURRENT_UPSTREAM:?CURRENT_UPSTREAM is required}"
  local upstream_commits="${UPSTREAM_COMMITS:?UPSTREAM_COMMITS is required}"
  validate_checkpoint "$last_synced"
  validate_checkpoint "$current_upstream"

  git checkout -B "$SYNC_BRANCH" origin/master

  local unified=false
  if ! git merge-base --is-ancestor "$last_synced" HEAD; then
    echo "Recording checkpoint $last_synced as merged without taking its tree"
    git merge -s ours --no-ff --no-edit \
      -m "ci: record upstream checkpoint ${last_synced} as merged" \
      "$last_synced"
    unified=true
  fi

  if [ "$upstream_commits" -gt 0 ]; then
    if ! git merge --no-ff --no-edit --no-commit "$current_upstream"; then
      resolve_fork_local_conflicts
    fi

    drop_upstream_workflow_changes

    printf '%s\n' "$current_upstream" >"$CHECKPOINT_PATH"
    git add -- "$CHECKPOINT_PATH"

    if git diff --cached --quiet && [ -z "$(git rev-parse -q --verify MERGE_HEAD || true)" ]; then
      echo "No effective upstream changes remain after preserving fork-local files"
      github_output "has-changes" "false"
      git merge --abort || true
      exit 0
    fi

    if git rev-parse -q --verify MERGE_HEAD >/dev/null; then
      git commit --no-edit
    elif ! git diff --cached --quiet; then
      git commit -m "chore: sync upstream/master"
    fi
    github_output "has-changes" "true"
    github_output "branch" "$SYNC_BRANCH"
    return 0
  fi

  if [ "$unified" = true ]; then
    github_output "has-changes" "true"
    github_output "branch" "$SYNC_BRANCH"
    echo "History unification commit is ready on $SYNC_BRANCH"
    return 0
  fi

  github_output "has-changes" "false"
}

usage() {
  echo "Usage: $0 check|merge" >&2
  exit 2
}

case "${1:-}" in
  check) cmd_check ;;
  merge) cmd_merge ;;
  *) usage ;;
esac
