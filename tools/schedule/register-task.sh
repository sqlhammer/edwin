#!/usr/bin/env bash

# register-task.sh
#
# Manages scheduled tasks via launchd on macOS.
# Creates plist files in ~/Library/LaunchAgents/, loads them with launchctl.
# Prompts are read from files to avoid quoting issues.
#
# Usage:
#   ./register-task.sh --name <name> --schedule <cron> --prompt-file <path> --log-file <path>
#   ./register-task.sh --list
#   ./register-task.sh --remove <task-id>
#   ./register-task.sh --help
#
# Options:
#   --name <name>           Human-readable task name
#   --schedule <cron>       Cron expression (e.g., "0 8 * * 1-5")
#   --prompt-file <path>    Path to file containing the prompt (relative to repo root or absolute)
#   --log-file <path>       Path to log file (relative to repo root or absolute)
#   --list                  List all EDWIN scheduled tasks
#   --remove <id>           Remove a scheduled task by ID
#   --dry-run               Print what would be done without doing it
#   --help                  Show this help
#
# Exit codes:
#   0 - Success
#   1 - Expected failure (task not found, launchctl failed)
#   2 - Bad usage

set -euo pipefail

# Headless claude invocation - SINGLE SOURCE OF TRUTH for scheduled task commands
# If claude flags change, update this constant only.
readonly CLAUDE_HEADLESS_CMD='claude -p "$(cat %PROMPT_FILE%)" --output-format text --permission-mode dontAsk'

# Resolve script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
LABEL_PREFIX="com.edwin.task"

# Parse args
NAME=""
SCHEDULE=""
PROMPT_FILE=""
LOG_FILE=""
LIST=false
REMOVE=""
DRY_RUN=false
HELP=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)
      NAME="$2"
      shift 2
      ;;
    --schedule)
      SCHEDULE="$2"
      shift 2
      ;;
    --prompt-file)
      PROMPT_FILE="$2"
      shift 2
      ;;
    --log-file)
      LOG_FILE="$2"
      shift 2
      ;;
    --list)
      LIST=true
      shift
      ;;
    --remove)
      REMOVE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help)
      HELP=true
      shift
      ;;
    *)
      echo "Error: Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

# Help
if [[ "$HELP" == true ]]; then
  sed -n '3,23p' "$0" | sed 's/^# //' | sed 's/^#//'
  exit 0
fi

# List mode
if [[ "$LIST" == true ]]; then
  echo "EDWIN scheduled tasks:"
  if [[ ! -d "$LAUNCH_AGENTS_DIR" ]]; then
    echo "  (none - LaunchAgents directory does not exist)"
    exit 0
  fi

  found=false
  for plist in "$LAUNCH_AGENTS_DIR/$LABEL_PREFIX"*.plist; do
    if [[ -f "$plist" ]]; then
      found=true
      label=$(basename "$plist" .plist)
      # Check if loaded
      if launchctl list | grep -q "$label"; then
        status="loaded"
      else
        status="not loaded"
      fi
      echo "  $label ($status)"
    fi
  done

  if [[ "$found" == false ]]; then
    echo "  (none)"
  fi
  exit 0
fi

# Remove mode
if [[ -n "$REMOVE" ]]; then
  # REMOVE should be the full task ID (e.g., "edwin-1640000000-morning-brief")
  # The label is "com.edwin.task.<task-id>"
  label="$LABEL_PREFIX.$REMOVE"
  plist_path="$LAUNCH_AGENTS_DIR/$label.plist"

  if [[ ! -f "$plist_path" ]]; then
    echo "Error: Task not found: $REMOVE" >&2
    echo "Plist does not exist: $plist_path" >&2
    exit 1
  fi

  if [[ "$DRY_RUN" == true ]]; then
    echo "Dry run - would remove:"
    echo "  launchctl bootout gui/$(id -u) $plist_path"
    echo "  rm $plist_path"
    # Also clean up prompt and log files
    prompt_file="$REPO_ROOT/user/schedule-prompts/$REMOVE.txt"
    log_file="$REPO_ROOT/user/schedule-logs/$REMOVE.log"
    [[ -f "$prompt_file" ]] && echo "  rm $prompt_file"
    [[ -f "$log_file" ]] && echo "  rm $log_file"
    exit 0
  fi

  # Unload/bootout (try both, ignore errors if not loaded)
  launchctl bootout "gui/$(id -u)" "$plist_path" 2>/dev/null || launchctl unload "$plist_path" 2>/dev/null || true

  # Remove plist
  rm -f "$plist_path"

  # Clean up prompt and log files
  prompt_file="$REPO_ROOT/user/schedule-prompts/$REMOVE.txt"
  log_file="$REPO_ROOT/user/schedule-logs/$REMOVE.log"
  rm -f "$prompt_file" "$log_file"

  echo "Removed task: $REMOVE"
  exit 0
fi

# Create mode - validate required args
if [[ -z "$NAME" ]]; then
  echo "Error: --name is required" >&2
  exit 2
fi

if [[ -z "$SCHEDULE" ]]; then
  echo "Error: --schedule is required" >&2
  exit 2
fi

if [[ -z "$PROMPT_FILE" ]]; then
  echo "Error: --prompt-file is required" >&2
  exit 2
fi

if [[ -z "$LOG_FILE" ]]; then
  echo "Error: --log-file is required" >&2
  exit 2
fi

# Resolve paths to absolute
if [[ "$PROMPT_FILE" != /* ]]; then
  PROMPT_FILE="$REPO_ROOT/$PROMPT_FILE"
fi

if [[ "$LOG_FILE" != /* ]]; then
  LOG_FILE="$REPO_ROOT/$LOG_FILE"
fi

# Ensure prompt file exists
if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "Error: Prompt file not found: $PROMPT_FILE" >&2
  exit 1
fi

# Ensure log directory exists
LOG_DIR="$(dirname "$LOG_FILE")"
mkdir -p "$LOG_DIR"

# Parse cron expression to launchd StartCalendarInterval
# Cron: minute hour day month weekday
# We support basic patterns like "0 8 * * 1-5" (weekday at 8am)

# Validate cron expression has exactly 5 fields
FIELD_COUNT=$(echo "$SCHEDULE" | awk '{print NF}')
if [[ "$FIELD_COUNT" -ne 5 ]]; then
  echo "Error: Invalid cron expression '$SCHEDULE'. Expected 5 fields (minute hour day month weekday), got $FIELD_COUNT." >&2
  exit 1
fi

IFS=' ' read -r MINUTE HOUR DAY MONTH WEEKDAY <<< "$SCHEDULE"

# Collect weekdays for array-based StartCalendarInterval if needed
WEEKDAYS=()

if [[ "$WEEKDAY" != "*" ]]; then
  # Parse weekday specification: single (1), comma-list (1,3,5), range (1-5), or combinations (1,3-5)
  # Both cron and launchd use the same numbering: 0=Sunday, 1=Monday...6=Saturday
  IFS=',' read -ra PARTS <<< "$WEEKDAY"
  for PART in "${PARTS[@]}"; do
    if [[ "$PART" == *-* ]]; then
      # Range like "1-5"
      IFS='-' read -r START END <<< "$PART"
      # Validate numeric
      if ! [[ "$START" =~ ^[0-6]$ ]] || ! [[ "$END" =~ ^[0-6]$ ]]; then
        echo "Error: Invalid weekday range '$PART'. Weekdays must be 0-6 (0=Sunday)." >&2
        exit 1
      fi

      # Check for wrap-around (e.g., 6-1 for Sat-Mon)
      if [[ $START -gt $END ]]; then
        echo "Error: Weekday range '$PART' wraps week boundary. Specify days explicitly (e.g., '6,0,1')." >&2
        exit 1
      fi

      # Expand range
      for ((day=START; day<=END; day++)); do
        WEEKDAYS+=("$day")
      done
    else
      # Single weekday
      if ! [[ "$PART" =~ ^[0-6]$ ]]; then
        echo "Error: Invalid weekday '$PART'. Weekdays must be 0-6 (0=Sunday)." >&2
        exit 1
      fi
      WEEKDAYS+=("$PART")
    fi
  done
fi

# Build base calendar interval fields
# Store fields as key-value pairs (no indentation yet)
INTERVAL_FIELDS=()

if [[ "$MINUTE" != "*" ]]; then
  INTERVAL_FIELDS+=("<key>Minute</key><integer>$MINUTE</integer>")
fi

if [[ "$HOUR" != "*" ]]; then
  INTERVAL_FIELDS+=("<key>Hour</key><integer>$HOUR</integer>")
fi

if [[ "$DAY" != "*" ]]; then
  INTERVAL_FIELDS+=("<key>Day</key><integer>$DAY</integer>")
fi

if [[ "$MONTH" != "*" ]]; then
  INTERVAL_FIELDS+=("<key>Month</key><integer>$MONTH</integer>")
fi

# Generate task ID from name and timestamp
TASK_ID="edwin-$(date +%s)-$(echo "$NAME" | tr '[:upper:] ' '[:lower:]-' | tr -cd '[:alnum:]-')"
LABEL="$LABEL_PREFIX.$TASK_ID"
PLIST_PATH="$LAUNCH_AGENTS_DIR/$LABEL.plist"

# Build the command with the prompt file substituted
CMD="${CLAUDE_HEADLESS_CMD//%PROMPT_FILE%/$PROMPT_FILE}"

# Build StartCalendarInterval section
# If we have multiple weekdays, use an array of dicts; otherwise use a single dict
CALENDAR_INTERVAL_SECTION=""

if [[ ${#WEEKDAYS[@]} -gt 1 ]]; then
  # Multiple weekdays - use array format
  CALENDAR_INTERVAL_SECTION="  <key>StartCalendarInterval</key>\n  <array>\n"
  for WEEKDAY_NUM in "${WEEKDAYS[@]}"; do
    CALENDAR_INTERVAL_SECTION="${CALENDAR_INTERVAL_SECTION}    <dict>\n"
    for FIELD in "${INTERVAL_FIELDS[@]}"; do
      CALENDAR_INTERVAL_SECTION="${CALENDAR_INTERVAL_SECTION}      $FIELD\n"
    done
    CALENDAR_INTERVAL_SECTION="${CALENDAR_INTERVAL_SECTION}      <key>Weekday</key><integer>$WEEKDAY_NUM</integer>\n"
    CALENDAR_INTERVAL_SECTION="${CALENDAR_INTERVAL_SECTION}    </dict>\n"
  done
  CALENDAR_INTERVAL_SECTION="${CALENDAR_INTERVAL_SECTION}  </array>"
elif [[ ${#WEEKDAYS[@]} -eq 1 ]]; then
  # Single weekday - use dict format with Weekday key
  CALENDAR_INTERVAL_SECTION="  <key>StartCalendarInterval</key>\n  <dict>\n"
  for FIELD in "${INTERVAL_FIELDS[@]}"; do
    CALENDAR_INTERVAL_SECTION="${CALENDAR_INTERVAL_SECTION}    $FIELD\n"
  done
  CALENDAR_INTERVAL_SECTION="${CALENDAR_INTERVAL_SECTION}    <key>Weekday</key><integer>${WEEKDAYS[0]}</integer>\n"
  CALENDAR_INTERVAL_SECTION="${CALENDAR_INTERVAL_SECTION}  </dict>"
else
  # No weekday specified - use dict format without Weekday key
  CALENDAR_INTERVAL_SECTION="  <key>StartCalendarInterval</key>\n  <dict>\n"
  for FIELD in "${INTERVAL_FIELDS[@]}"; do
    CALENDAR_INTERVAL_SECTION="${CALENDAR_INTERVAL_SECTION}    $FIELD\n"
  done
  CALENDAR_INTERVAL_SECTION="${CALENDAR_INTERVAL_SECTION}  </dict>"
fi

# Create plist
PLIST_CONTENT="<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">
<plist version=\"1.0\">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-c</string>
    <string>$CMD</string>
  </array>
$(echo -e "$CALENDAR_INTERVAL_SECTION")
  <key>StandardOutPath</key>
  <string>$LOG_FILE</string>
  <key>StandardErrorPath</key>
  <string>$LOG_FILE</string>
  <key>WorkingDirectory</key>
  <string>$REPO_ROOT</string>
</dict>
</plist>"

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run - would create:"
  echo "  Plist: $PLIST_PATH"
  echo "  Label: $LABEL"
  echo "  Command: $CMD"
  echo ""
  echo "Plist content:"
  echo "$PLIST_CONTENT"
  exit 0
fi

# Ensure LaunchAgents directory exists
mkdir -p "$LAUNCH_AGENTS_DIR"

# Write plist
echo "$PLIST_CONTENT" > "$PLIST_PATH"

# Load the job (try modern bootstrap, fall back to legacy load)
if launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" 2>/dev/null; then
  echo "Task registered: $TASK_ID (bootstrap)"
elif launchctl load "$PLIST_PATH" 2>/dev/null; then
  echo "Task registered: $TASK_ID (load)"
else
  echo "Error: Failed to load launchd job" >&2
  rm -f "$PLIST_PATH"
  exit 1
fi

# Output the task ID for the caller to record in schedule.json
echo "TASK_ID=$TASK_ID"
echo "LABEL=$LABEL"

exit 0
