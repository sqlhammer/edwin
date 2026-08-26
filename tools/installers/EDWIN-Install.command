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

# Log file. Deliberately NOT inside INSTALL_DIR: `git clone` refuses a destination that
# exists and is not empty, so writing the log there before cloning made the installer
# create the obstacle it then tripped over — a fresh install could never succeed. The log
# is copied into the install directory once the clone has happened.
LOG_FILE="${TMPDIR:-/tmp}/edwin-install.log"
FINAL_LOG_FILE="$INSTALL_DIR/install.log"

# Repository to clone (read from package.json, or prompted)
REPO_URL=""

# Answer every confirmation with yes (for unattended runs)
ASSUME_YES=0

# Install missing prerequisites rather than only reporting them
INSTALL_DEPS=1

# Wait for a keypress before closing. A double-clicked .command owns its Terminal window,
# so without this every message scrolls past and vanishes.
NO_PAUSE=0

show_usage() {
    cat <<'USAGE'
EDWIN-Install.command — install EDWIN on macOS

Usage:
  EDWIN-Install.command [options]

Options:
  --repo-url <url>   Repository to install from (otherwise read from package.json or prompted)
  --yes              Answer yes to every confirmation; required for unattended runs
  --skip-deps        Report missing Git or Node.js instead of installing them
  --no-pause         Do not wait for a keypress before closing
  --help             Show this help

Missing prerequisites are installed for you. Git and Node.js come from Homebrew when it is
present; otherwise Node.js is installed from Node's official signed .pkg (checksum verified)
and Git from Apple's Command Line Tools. Nothing is downloaded through a web browser.
USAGE
}

while [ $# -gt 0 ]; do
    case "$1" in
        --repo-url)
            if [ -z "${2:-}" ]; then
                echo "Error: --repo-url requires a URL" >&2
                exit 2
            fi
            REPO_URL="$2"
            shift 2
            ;;
        --yes|-y)
            ASSUME_YES=1
            shift
            ;;
        --skip-deps)
            INSTALL_DEPS=0
            shift
            ;;
        --no-pause)
            NO_PAUSE=1
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            echo "Error: unknown option: $1" >&2
            echo "" >&2
            show_usage >&2
            exit 2
            ;;
    esac
done

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

# True when there is a terminal to prompt at. Without one, no question can be answered,
# so every confirmation must fail loudly rather than block forever.
have_tty() {
    [ -t 0 ]
}

# Ask a yes/no question. Defaults to yes on a bare Return.
confirm() {
    local prompt="$1"

    if [ "$ASSUME_YES" -eq 1 ]; then
        echo "$prompt [Y/n] y  (--yes)"
        return 0
    fi

    if ! have_tty; then
        return 1
    fi

    local reply=""
    # read fails at EOF, and set -e would abort the whole installer on it.
    if ! read -r -p "$prompt [Y/n] " reply; then
        return 1
    fi

    case "$reply" in
        ''|[Yy]|[Yy][Ee][Ss]) return 0 ;;
        *) return 1 ;;
    esac
}

# Pause and wait for user to press a key
pause() {
    if [ "$NO_PAUSE" -eq 1 ]; then
        return 0
    fi
    echo ""
    echo "Press any key to close this window..."
    read -n 1 -s || true
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

    # Must be a git URL (https, git@, or file:// — the last one so the clone path can be
    # exercised against a local repository instead of only against the live network).
    if [[ "$url" =~ ^https://.*\.git$ ]] || [[ "$url" =~ ^git@.*:.*\.git$ ]] || [[ "$url" =~ ^file:// ]]; then
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

# ---------------------------------------------------------------------------
# Homebrew
# ---------------------------------------------------------------------------

# Put Homebrew on PATH if it is installed. A double-clicked .command inherits a
# minimal environment, so an installed brew is frequently not on PATH yet —
# especially on Apple silicon, where it lives in /opt/homebrew rather than /usr/local.
load_brew_env() {
    if command_exists brew; then
        return 0
    fi

    local candidate
    for candidate in /opt/homebrew/bin/brew /usr/local/bin/brew; do
        if [ -x "$candidate" ]; then
            eval "$("$candidate" shellenv)"
            return 0
        fi
    done

    return 1
}

install_homebrew() {
    log "Installing Homebrew..."
    echo ""
    echo "Homebrew is the package manager most Mac developer tools install through."
    echo "Its installer asks for your password once, to create /opt/homebrew."
    echo ""

    # NONINTERACTIVE stops the official script waiting on a Return it will never get
    # here. It cannot suppress the sudo password prompt, which only you can answer.
    if ! NONINTERACTIVE=1 /bin/bash -c \
        "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"; then
        log_error "Homebrew installation failed"
        return 1
    fi

    load_brew_env
}

# ---------------------------------------------------------------------------
# Git
# ---------------------------------------------------------------------------

# /usr/bin/git exists on every Mac as a stub that fails until Apple's Command Line
# Tools are installed. So `command -v git` succeeding does not mean git works — the
# only reliable test is running it.
git_usable() {
    command_exists git || return 1
    git --version >/dev/null 2>&1
}

# Install Apple's Command Line Tools, which provide git. Tried without a GUI first:
# the sentinel file below makes the tools appear as an ordinary softwareupdate item,
# which can be installed from the command line. If that fails we fall back to asking
# macOS to show its own install dialog — still no browser, still no manual download.
install_command_line_tools() {
    local sentinel="/tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress"

    log "Installing Apple's Command Line Tools (provides git)..."

    if have_tty || sudo -n true 2>/dev/null; then
        touch "$sentinel" 2>/dev/null || true

        local label
        label=$(softwareupdate -l 2>/dev/null \
            | grep -E '^ *\* *(Label: )?Command Line Tools' \
            | sed -E 's/^ *\* *(Label: )?//' \
            | tail -1) || true

        if [ -n "$label" ]; then
            log "Found update label: $label"
            sudo softwareupdate -i "$label" --verbose || log_error "softwareupdate failed for: $label"
        else
            log "No Command Line Tools update label offered"
        fi

        rm -f "$sentinel" 2>/dev/null || true

        if git_usable; then
            return 0
        fi
    fi

    # Fallback: macOS shows its own dialog. One click, no download to find.
    log "Falling back to the macOS Command Line Tools dialog"
    xcode-select --install >/dev/null 2>&1 || true

    echo ""
    echo "macOS is showing an 'Install' dialog for the Command Line Tools."
    echo "Click Install and accept the licence. I'll wait for it to finish."
    echo ""

    local waited=0
    local timeout=1800
    while ! git_usable; do
        sleep 5
        waited=$((waited + 5))
        if [ "$((waited % 60))" -eq 0 ]; then
            echo "  still waiting... (${waited}s)"
        fi
        if [ "$waited" -ge "$timeout" ]; then
            log_error "Command Line Tools did not finish installing within $((timeout / 60)) minutes"
            return 1
        fi
    done

    return 0
}

ensure_git() {
    if git_usable; then
        log "git found: $(git --version)"
        return 0
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Git is not installed"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "EDWIN needs Git to download and update its files. I can install it."
    echo ""

    if [ "$INSTALL_DEPS" -eq 0 ]; then
        exit_with_error "Git is not installed (run without --skip-deps to install it)"
    fi

    if ! confirm "Install Git now?"; then
        echo ""
        echo "Nothing installed. Install Git yourself and run this installer again,"
        echo "or re-run with --yes to install it without being asked."
        echo ""
        exit_with_error "Git is not installed and installation was declined"
    fi

    if load_brew_env; then
        log "Installing git with Homebrew..."
        brew install git || log_error "brew install git failed"
    else
        install_command_line_tools || true
    fi

    if ! git_usable; then
        echo ""
        echo "Git still isn't working after the install attempt."
        echo "Check the log for what the installer reported: $LOG_FILE"
        echo ""
        exit_with_error "Git installation did not produce a working git"
    fi

    log "git installed: $(git --version)"
}

# ---------------------------------------------------------------------------
# Node.js
# ---------------------------------------------------------------------------

node_major() {
    node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/'
}

node_usable() {
    command_exists node || return 1
    local major
    major=$(node_major)
    [ -n "$major" ] || return 1
    [ "$major" -ge "$MIN_NODE_VERSION" ]
}

# Newest Node release carrying an LTS codename, from Node's own release index.
# index.tab is tab-separated with lts in column 10 ("-" for non-LTS releases), so this
# needs no JSON parser — which matters when the reason we are here is that there is no
# node to parse JSON with.
latest_node_lts() {
    curl -fsSL --max-time 60 https://nodejs.org/dist/index.tab 2>/dev/null \
        | awk -F'\t' 'NR > 1 && $10 != "-" && $10 != "" { print $1; exit }'
}

# Install Node from its official signed .pkg. The macOS package is universal, so there
# is no architecture in its name.
install_node_pkg() {
    local version="$1"
    local base="https://nodejs.org/dist/${version}"
    local pkg="node-${version}.pkg"
    local tmp

    tmp=$(mktemp -d) || return 1

    log "Downloading $pkg..."
    if ! curl -fL --max-time 900 --progress-bar -o "$tmp/$pkg" "$base/$pkg"; then
        log_error "Failed to download $base/$pkg"
        rm -rf "$tmp"
        return 1
    fi

    # This package is about to run as root, so verify it against Node's published
    # checksum first. A truncated or substituted download must not be installed.
    if ! curl -fsSL --max-time 120 -o "$tmp/SHASUMS256.txt" "$base/SHASUMS256.txt"; then
        log_error "Failed to download checksums from $base/SHASUMS256.txt"
        rm -rf "$tmp"
        return 1
    fi

    local expected actual
    expected=$(awk -v want="$pkg" '$2 == want { print $1 }' "$tmp/SHASUMS256.txt")
    actual=$(shasum -a 256 "$tmp/$pkg" | awk '{ print $1 }')

    if [ -z "$expected" ]; then
        log_error "No published checksum for $pkg — refusing to install it"
        rm -rf "$tmp"
        return 1
    fi

    if [ "$expected" != "$actual" ]; then
        log_error "Checksum mismatch for $pkg (expected $expected, got $actual) — refusing to install it"
        rm -rf "$tmp"
        return 1
    fi

    log "Checksum verified. Installing $pkg (this needs your password)..."
    if ! sudo installer -pkg "$tmp/$pkg" -target /; then
        log_error "installer failed for $pkg"
        rm -rf "$tmp"
        return 1
    fi

    rm -rf "$tmp"

    # The .pkg installs into /usr/local/bin, which a double-clicked .command may not
    # have inherited.
    case ":$PATH:" in
        *:/usr/local/bin:*) ;;
        *) export PATH="/usr/local/bin:$PATH" ;;
    esac

    return 0
}

ensure_node() {
    if node_usable; then
        log "Node.js found: $(node -v)"
        return 0
    fi

    local current=""
    if command_exists node; then
        current=$(node -v)
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [ -n "$current" ]; then
        echo "  Node.js $current is too old"
    else
        echo "  Node.js is not installed"
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    if [ -n "$current" ]; then
        echo "EDWIN needs Node.js $MIN_NODE_VERSION or higher. I can upgrade it."
    else
        echo "EDWIN needs Node.js to run its scripts. I can install it."
    fi
    echo ""

    if [ "$INSTALL_DEPS" -eq 0 ]; then
        exit_with_error "Node.js $MIN_NODE_VERSION or higher is required (run without --skip-deps to install it)"
    fi

    if ! confirm "Install Node.js now?"; then
        echo ""
        echo "Nothing installed. Install Node.js $MIN_NODE_VERSION or higher yourself and run this"
        echo "installer again, or re-run with --yes to install it without being asked."
        echo ""
        exit_with_error "Node.js is missing or too old and installation was declined"
    fi

    if load_brew_env; then
        log "Installing Node.js with Homebrew..."
        brew install node || log_error "brew install node failed"
    fi

    if ! node_usable; then
        local version
        version=$(latest_node_lts)
        if [ -z "$version" ]; then
            log_error "Could not determine the current Node.js LTS version from nodejs.org"
            echo ""
            echo "I couldn't reach nodejs.org to find out which version to install."
            echo "Check your network connection and run this installer again."
            echo ""
            exit_with_error "Could not determine the Node.js LTS version"
        fi
        log "Installing Node.js $version from the official package..."
        install_node_pkg "$version" || true
    fi

    if ! node_usable; then
        echo ""
        echo "Node.js still isn't usable after the install attempt."
        echo "Check the log for what the installer reported: $LOG_FILE"
        echo ""
        exit_with_error "Node.js installation did not produce a usable node"
    fi

    log "Node.js installed: $(node -v)"
}

check_prerequisites() {
    log "Checking prerequisites..."

    # Homebrew first if it is present: when it is, it is the least surprising way to
    # install both of the tools below.
    load_brew_env || true

    ensure_git
    ensure_node

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
            # git clone requires an empty destination, so this must be a plain emptiness
            # check. It used to exempt install.log, which only masked the fact that the
            # installer had just written that log here and would fail on it.
            local file_count=$(find "$INSTALL_DIR" -mindepth 1 | wc -l)
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
            # Empty — safe to clone into
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

    # --create-target: the engine refuses a missing ~/.claude by default, which is right for a
    # manual sync but wrong here. Someone running a double-click installer may not have started
    # Claude yet, and failing at the last step would leave them with a clone and nothing else.
    if ! node "$engine_path" --target all --create-target >> "$LOG_FILE" 2>&1; then
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
    # Never let a cosmetic screen-clear abort the installer: clear exits non-zero
    # when TERM is unset or minimal, and set -e would kill us here with no output.
    clear || true
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

    # The log lived outside INSTALL_DIR so it could not block the clone. Put a copy where
    # the documentation says to look for it. Best-effort: a failed copy must not fail an
    # otherwise successful install.
    if [ "$LOG_FILE" != "$FINAL_LOG_FILE" ] && [ -d "$INSTALL_DIR" ]; then
        if cp "$LOG_FILE" "$FINAL_LOG_FILE" 2>/dev/null; then
            echo "Install log: $FINAL_LOG_FILE"
            echo ""
        fi
    fi

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
