#!/bin/bash

# EDWIN-Update.command
#
# Updates an existing EDWIN installation to the latest version.
# Preserves user/ directory and all personal data.

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================

INSTALL_DIR="$HOME/edwin"
LOG_FILE="$INSTALL_DIR/install.log"

# ============================================================================
# Logging
# ============================================================================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "$LOG_FILE" >&2
}

pause() {
    echo ""
    echo "Press any key to close this window..."
    read -n 1 -s
}

exit_with_error() {
    log_error "$1"
    echo ""
    echo "Update failed. Check the log file for details:"
    echo "  $LOG_FILE"
    pause
    exit 1
}

# ============================================================================
# Main Update Flow
# ============================================================================

main() {
    clear
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  EDWIN Update"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    log "========================================"
    log "EDWIN Update Started"
    log "========================================"

    # Check if EDWIN is installed
    if [ ! -d "$INSTALL_DIR" ]; then
        echo ""
        echo "EDWIN is not installed at $INSTALL_DIR"
        echo ""
        echo "Please run the installer first (EDWIN-Install.command)."
        echo ""
        exit_with_error "EDWIN not found at $INSTALL_DIR"
    fi

    if [ ! -d "$INSTALL_DIR/.git" ]; then
        echo ""
        echo "The directory $INSTALL_DIR exists but is not a Git repository."
        echo ""
        echo "Cannot update. Please reinstall EDWIN."
        echo ""
        exit_with_error "Not a git repository: $INSTALL_DIR"
    fi

    # Verify it's the EDWIN repository
    if [ ! -d "$INSTALL_DIR/core" ] || [ ! -d "$INSTALL_DIR/tools" ]; then
        echo ""
        echo "The directory $INSTALL_DIR doesn't appear to be an EDWIN installation."
        echo ""
        echo "Cannot update. Please reinstall EDWIN."
        echo ""
        exit_with_error "Invalid EDWIN installation at $INSTALL_DIR"
    fi

    log "Found EDWIN installation at $INSTALL_DIR"

    # Navigate to installation directory
    cd "$INSTALL_DIR"

    # Check for uncommitted changes (excluding user/ directory)
    log "Checking for uncommitted changes..."

    # We use git diff-index to check for changes, but we want to exclude user/
    # First, check if there are any changes at all
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        # There are changes. Check if they're only in user/
        local changed_files=$(git diff-index --name-only HEAD -- 2>/dev/null | grep -v "^user/" || true)

        if [ -n "$changed_files" ]; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "  Uncommitted changes detected"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "You have uncommitted changes outside of user/:"
            echo ""
            echo "$changed_files"
            echo ""
            echo "The updater won't overwrite them."
            echo ""
            echo "To update, either:"
            echo "  1. Commit or stash your changes manually"
            echo "  2. Discard them (if you know what you're doing)"
            echo ""
            exit_with_error "Uncommitted changes detected"
        else
            log "Changes are only in user/ directory (preserved)"
        fi
    fi

    # Pull latest changes
    log "Pulling latest changes..."
    echo ""
    echo "Downloading updates..."
    echo ""

    if ! git pull --ff-only >> "$LOG_FILE" 2>&1; then
        log_error "Failed to pull updates"
        echo ""
        echo "Failed to download updates. This might happen if:"
        echo "  - Your local changes conflict with updates"
        echo "  - You're not connected to the internet"
        echo "  - The branch has diverged from the remote"
        echo ""
        echo "Check the log file for details: $LOG_FILE"
        echo ""
        exit_with_error "Git pull failed"
    fi

    log "Updates pulled successfully"

    # Verify user/ directory still exists and is intact
    if [ ! -d "$INSTALL_DIR/user" ]; then
        log "Note: user/ directory does not exist (normal for fresh install)"
    else
        log "Verified user/ directory is intact"
    fi

    # Run sync engine
    log "Running sync engine..."
    echo ""
    echo "Syncing EDWIN skills and persona..."
    echo ""

    local engine_path="$INSTALL_DIR/tools/sync/engine.mjs"

    if [ ! -f "$engine_path" ]; then
        echo ""
        echo "Sync engine not found at $engine_path"
        echo "The update may have failed or the repository structure changed."
        echo ""
        exit_with_error "Sync engine not found"
    fi

    if ! node "$engine_path" --target all >> "$LOG_FILE" 2>&1; then
        log_error "Sync engine failed"
        echo ""
        echo "The sync engine encountered an error."
        echo "Check the log file for details: $LOG_FILE"
        echo ""
        exit_with_error "Sync engine failed"
    fi

    log "Sync completed successfully"

    # Success message
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Update Complete!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "EDWIN has been updated successfully."
    echo ""
    echo "Your personal data in the user/ directory has been preserved."
    echo ""
    echo "Restart Claude to load the changes."
    echo ""

    log "Update completed successfully"
    log "========================================"

    pause
}

# ============================================================================
# Entry Point
# ============================================================================

main
