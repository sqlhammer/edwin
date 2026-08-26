#!/bin/bash

# EDWIN-Install.command
#
# Double-click macOS installer for EDWIN.
# Checks prerequisites, clones or updates the repository, and runs the sync engine.

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================

# Default installation directory (can be customized)
DEFAULT_INSTALL_DIR="$HOME/edwin"
INSTALL_DIR="$DEFAULT_INSTALL_DIR"

# Log file
LOG_FILE="$INSTALL_DIR/install.log"

# Repository to clone (read from package.json, or prompted)
REPO_URL=""

# Allow passing repository URL as argument
if [ "${1:-}" = "--repo-url" ] && [ -n "${2:-}" ]; then
    REPO_URL="$2"
fi

# Minimum Node.js version
MIN_NODE_VERSION=18

# ============================================================================
# Logging
# ============================================================================

# Note: log file directory is created later, after we know if we're cloning or updating

log() {
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_error() {
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "$LOG_FILE" >&2
}

# ============================================================================
# Helper Functions
# ============================================================================

# Open URL in default browser
open_url() {
    open "$1" 2>/dev/null || true
}

# Pause and wait for user to press a key
pause() {
    echo ""
    echo "Press any key to close this window..."
    read -n 1 -s
}

# Exit with error message and pause
exit_with_error() {
    log_error "$1"
    echo ""
    echo "Installation failed. Check the log file for details:"
    echo "  $LOG_FILE"
    pause
    exit 1
}

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Extract repository URL from package.json
get_repo_url() {
    local package_json="$1"

    if [ ! -f "$package_json" ]; then
        return 1
    fi

    # Extract repository.url from package.json
    # This is fragile but works for simple cases and doesn't require jq
    local url=$(grep -A 2 '"repository"' "$package_json" | grep '"url"' | sed 's/.*"url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

    if [ -z "$url" ]; then
        return 1
    fi

    # Strip git+ prefix if present
    url="${url#git+}"

    echo "$url"
    return 0
}

# Validate and normalize repository URL
validate_repo_url() {
    local url="$1"

    # Strip whitespace
    url=$(echo "$url" | xargs)

    # Empty is invalid
    if [ -z "$url" ]; then
        return 1
    fi

    # If it's in owner/repo format, convert to full GitHub URL
    if [[ "$url" =~ ^[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+$ ]]; then
        url="https://github.com/$url.git"
    fi

    # Must be a git URL (https or git@)
    if [[ "$url" =~ ^https://.*\.git$ ]] || [[ "$url" =~ ^git@.*:.*\.git$ ]]; then
        echo "$url"
        return 0
    fi

    # Try adding .git if missing
    if [[ "$url" =~ ^https:// ]] && [[ ! "$url" =~ \.git$ ]]; then
        echo "$url.git"
        return 0
    fi

    return 1
}

# Prompt user for repository URL
prompt_for_repo_url() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Repository URL Needed"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "I need to know which EDWIN repository to install from."
    echo ""
    echo "Please enter the GitHub repository URL or owner/repo:"
    echo ""
    echo "Examples:"
    echo "  https://github.com/username/edwin.git"
    echo "  username/edwin"
    echo ""
    echo -n "Repository: "

    local input
    read -r input

    local validated
    if validated=$(validate_repo_url "$input"); then
        echo "$validated"
        return 0
    else
        echo ""
        echo "That doesn't look like a valid repository URL."
        echo ""
        return 1
    fi
}

# ============================================================================
# Prerequisite Checks
# ============================================================================

check_prerequisites() {
    log "Checking prerequisites..."

    # Check for git
    if ! command_exists git; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Git is not installed"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "EDWIN needs Git to download and update its files."
        echo ""
        echo "I'll open the Git download page in your browser."
        echo "After installing Git, run this installer again."
        echo ""
        open_url "https://git-scm.com/downloads"
        exit_with_error "Git is not installed"
    fi

    # Check for Node.js
    if ! command_exists node; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Node.js is not installed"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "EDWIN needs Node.js to run its installation scripts."
        echo ""
        echo "I'll open the Node.js download page in your browser."
        echo "Download and install the LTS version, then run this installer again."
        echo ""
        open_url "https://nodejs.org/"
        exit_with_error "Node.js is not installed"
    fi

    # Check Node.js version
    local node_version=$(node -v | sed 's/v\([0-9]*\).*/\1/')
    if [ "$node_version" -lt "$MIN_NODE_VERSION" ]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Node.js version is too old"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "You have Node.js $(node -v), but EDWIN needs version $MIN_NODE_VERSION or higher."
        echo ""
        echo "I'll open the Node.js download page in your browser."
        echo "Download and install the latest LTS version, then run this installer again."
        echo ""
        open_url "https://nodejs.org/"
        exit_with_error "Node.js version $(node -v) is too old (need $MIN_NODE_VERSION or higher)"
    fi

    # Check for Claude Code or Claude Desktop
    local claude_dir="$HOME/.claude"
    local claude_desktop_dir="$HOME/Library/Application Support/Claude"

    if [ ! -d "$claude_dir" ]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Claude Code or Claude Desktop not detected"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "EDWIN is a personal assistant framework for Claude."
        echo ""
        echo "I couldn't find Claude Code or Claude Desktop on this machine."
        echo "If you have Claude Desktop installed, it should work — the installer"
        echo "just can't confirm it yet."
        echo ""
        echo "If you don't have either, install Claude Code (the command-line tool)"
        echo "or Claude Desktop (the app) first."
        echo ""
        echo "Download Claude Code: https://code.claude.ai/"
        echo "Download Claude Desktop: https://claude.ai/download"
        echo ""
        log "Warning: Claude Code/Desktop not detected at $claude_dir"
        echo "Continuing installation anyway..."
        echo ""
    else
        log "Claude detected at $claude_dir"
    fi

    log "Prerequisites OK"
}

# ============================================================================
# Repository Management
# ============================================================================

clone_or_update_repo() {
    log "Setting up EDWIN repository..."

    # Check if installation directory already exists
    if [ -d "$INSTALL_DIR/.git" ]; then
        # Existing git repository
        log "Found existing repository at $INSTALL_DIR"

        # Verify it's actually the EDWIN repository by checking for core/ and tools/
        if [ ! -d "$INSTALL_DIR/core" ] || [ ! -d "$INSTALL_DIR/tools" ]; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "  Directory exists but doesn't look like EDWIN"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "The directory $INSTALL_DIR exists but doesn't appear to be"
            echo "an EDWIN installation (missing core/ or tools/ directories)."
            echo ""
            echo "Please either:"
            echo "  1. Remove or rename that directory, or"
            echo "  2. Choose a different installation location"
            echo ""
            exit_with_error "Invalid repository at $INSTALL_DIR"
        fi

        # Get repository URL from package.json
        REPO_URL=$(get_repo_url "$INSTALL_DIR/package.json")
        if [ -z "$REPO_URL" ]; then
            log_error "Could not determine repository URL from $INSTALL_DIR/package.json"
            echo ""
            echo "Warning: Couldn't determine the repository URL."
            echo "I'll update from whatever remote is configured."
            echo ""
        fi

        # Update existing repository
        log "Updating repository..."
        cd "$INSTALL_DIR"

        # Check for uncommitted changes
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "  Uncommitted changes detected"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "Your EDWIN installation has uncommitted changes."
            echo "The installer won't overwrite them."
            echo ""
            echo "To update, either:"
            echo "  1. Commit or stash your changes manually, or"
            echo "  2. Remove the directory and run the installer again"
            echo ""
            exit_with_error "Uncommitted changes in $INSTALL_DIR"
        fi

        # Pull latest changes
        if ! git pull --ff-only >> "$LOG_FILE" 2>&1; then
            log_error "Failed to update repository"
            echo ""
            echo "Failed to update the repository. This might happen if:"
            echo "  - Your local changes conflict with updates"
            echo "  - You're not connected to the internet"
            echo ""
            echo "Check the log file for details: $LOG_FILE"
            echo ""
            exit_with_error "Git pull failed"
        fi

        log "Repository updated successfully"
    else
        # Need to clone
        if [ -d "$INSTALL_DIR" ]; then
            # Directory exists - check if it's empty or only contains our log file
            local file_count=$(find "$INSTALL_DIR" -mindepth 1 ! -name "install.log" | wc -l)
            if [ "$file_count" -gt 0 ]; then
                # Directory has other files, not safe to use
                echo ""
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo "  Directory already exists"
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo ""
                echo "The directory $INSTALL_DIR already exists but is not a"
                echo "Git repository."
                echo ""
                echo "Please remove or rename it before installing EDWIN."
                echo ""
                exit_with_error "Non-git directory exists at $INSTALL_DIR"
            fi
            # Directory is empty or only has our log - safe to use for clone
        fi

        # Get repository URL from package.json if running from within a clone
        if [ -z "$REPO_URL" ]; then
            local installer_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
            local package_json="$installer_dir/../../package.json"

            REPO_URL=$(get_repo_url "$package_json") || true
        fi

        # If we still don't have a URL, prompt the user
        if [ -z "$REPO_URL" ]; then
            # Check if we're in a non-interactive environment
            if [ ! -t 0 ]; then
                echo ""
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo "  Cannot prompt for repository URL"
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo ""
                echo "This installer needs to know which repository to clone from."
                echo ""
                echo "Since this is running non-interactively, please either:"
                echo "  1. Run this installer in a terminal, or"
                echo "  2. Pass the repository URL as an argument:"
                echo "     $0 --repo-url https://github.com/owner/edwin.git"
                echo ""
                exit_with_error "No repository URL and cannot prompt"
            fi

            # Prompt the user, retrying until valid
            while [ -z "$REPO_URL" ]; do
                REPO_URL=$(prompt_for_repo_url) || true
            done
        fi

        # Validate the URL we have
        REPO_URL=$(validate_repo_url "$REPO_URL")
        if [ -z "$REPO_URL" ]; then
            exit_with_error "Invalid repository URL"
        fi

        log "Cloning repository from $REPO_URL..."

        # Clone the repository
        if ! git clone "$REPO_URL" "$INSTALL_DIR" >> "$LOG_FILE" 2>&1; then
            log_error "Failed to clone repository"
            echo ""
            echo "Failed to download EDWIN. This might happen if:"
            echo "  - You're not connected to the internet"
            echo "  - The repository URL is incorrect"
            echo "  - You don't have access to the repository"
            echo ""
            echo "Repository URL: $REPO_URL"
            echo ""
            echo "Check the log file for details: $LOG_FILE"
            echo ""
            exit_with_error "Git clone failed"
        fi

        log "Repository cloned successfully"
    fi
}

# ============================================================================
# Sync Engine
# ============================================================================

run_sync_engine() {
    log "Running EDWIN sync engine..."

    local engine_path="$INSTALL_DIR/tools/sync/engine.mjs"

    if [ ! -f "$engine_path" ]; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Sync engine not found"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "The sync engine is missing from the repository."
        echo "This might mean the download was incomplete or corrupted."
        echo ""
        echo "Expected location: $engine_path"
        echo ""
        exit_with_error "Sync engine not found"
    fi

    # Run the sync engine
    echo ""
    echo "Installing EDWIN skills and persona..."
    echo ""

    if ! node "$engine_path" --target all >> "$LOG_FILE" 2>&1; then
        log_error "Sync engine failed"
        echo ""
        echo "The sync engine encountered an error."
        echo "Check the log file for details: $LOG_FILE"
        echo ""
        exit_with_error "Sync engine failed"
    fi

    log "Sync engine completed successfully"
}

# ============================================================================
# Main Installation Flow
# ============================================================================

main() {
    # Clear screen and show banner
    clear
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  EDWIN Installer"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "This will install EDWIN on your machine."
    echo ""
    echo "Installation directory: $INSTALL_DIR"
    echo "Log file: $LOG_FILE"
    echo ""

    log "========================================"
    log "EDWIN Installation Started"
    log "========================================"

    # Check prerequisites
    check_prerequisites

    # Clone or update repository
    clone_or_update_repo

    # Run sync engine
    run_sync_engine

    # Success message
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Installation Complete!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "EDWIN has been installed successfully."
    echo ""
    echo "Next step:"
    echo "  1. Open Claude (Desktop or Code)"
    echo "  2. Say: set up EDWIN"
    echo ""
    echo "That will complete the initial configuration."
    echo ""

    log "Installation completed successfully"
    log "========================================"

    pause
}

# ============================================================================
# Quarantine Handling
# ============================================================================

# Check if this script was launched with quarantine restrictions
# This happens when downloaded from a browser
check_quarantine() {
    if [ -n "${SSH_CONNECTION:-}" ] || [ -n "${SSH_CLIENT:-}" ]; then
        # Running over SSH, not a quarantine issue
        return 0
    fi

    # Check if we have the quarantine attribute
    local script_path="${BASH_SOURCE[0]}"
    if xattr -l "$script_path" 2>/dev/null | grep -q "com.apple.quarantine"; then
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Security Check Required"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "This installer was downloaded from the internet."
        echo "macOS requires you to explicitly allow it to run."
        echo ""
        echo "To run this installer:"
        echo "  1. Right-click (or Control-click) on this file"
        echo "  2. Select 'Open' from the menu"
        echo "  3. Click 'Open' in the dialog that appears"
        echo ""
        echo "Then the installer will start."
        echo ""
        pause
        exit 0
    fi
}

# ============================================================================
# Entry Point
# ============================================================================

# Check for quarantine first
check_quarantine

# Run main installation
main
