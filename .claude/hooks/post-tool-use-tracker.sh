#!/bin/bash
# Note: Not using 'set -e' to allow graceful error handling

# Post-tool-use hook that tracks edited files and their repos
# This runs after Edit, MultiEdit, or Write tools complete successfully


# Read tool information from stdin
tool_info=$(cat)


# Extract relevant data
tool_name=$(echo "$tool_info" | jq -r '.tool_name // empty')
file_path=$(echo "$tool_info" | jq -r '.tool_input.file_path // empty')
session_id=$(echo "$tool_info" | jq -r '.session_id // empty')


# Skip if not an edit tool or no file path
if [[ ! "$tool_name" =~ ^(Edit|MultiEdit|Write)$ ]] || [[ -z "$file_path" ]]; then
    exit 0  # Exit 0 for skip conditions
fi

# Skip markdown files
if [[ "$file_path" =~ \.(md|markdown)$ ]]; then
    exit 0  # Exit 0 for skip conditions
fi

# Create cache directory in project
cache_dir="$CLAUDE_PROJECT_DIR/.claude/tsc-cache/${session_id:-default}"
mkdir -p "$cache_dir"

# Function to detect repo from file path
detect_repo() {
    local file="$1"
    local project_root="$CLAUDE_PROJECT_DIR"

    # Remove project root from path
    local relative_path="${file#$project_root/}"

    # Extract first directory component
    local top_dir=$(echo "$relative_path" | cut -d'/' -f1)

    case "$top_dir" in
        apps|packages|tooling)
            local sub_dir=$(echo "$relative_path" | cut -d'/' -f2)
            if [[ -n "$sub_dir" ]]; then
                echo "$top_dir/$sub_dir"
            else
                echo "$top_dir"
            fi
            ;;
        *)
            if [[ ! "$relative_path" =~ / ]]; then
                echo "root"
            else
                echo "unknown"
            fi
            ;;
    esac
}

# Function to get build command for repo
get_build_command() {
    local repo="$1"
    local project_root="$CLAUDE_PROJECT_DIR"
    local repo_path="$project_root/$repo"

    if [[ -f "$repo_path/package.json" ]]; then
        if grep -q '"build"' "$repo_path/package.json" 2>/dev/null; then
            local pkg_name
            pkg_name=$(jq -r '.name // empty' "$repo_path/package.json" 2>/dev/null)
            if [[ -n "$pkg_name" ]]; then
                echo "cd $project_root && pnpm turbo run build --filter=$pkg_name"
            fi
            return
        fi
    fi

    echo ""
}

# Function to get TSC command for repo
get_tsc_command() {
    local repo="$1"
    local project_root="$CLAUDE_PROJECT_DIR"
    local repo_path="$project_root/$repo"

    if [[ -f "$repo_path/tsconfig.json" ]]; then
        local pkg_name
        pkg_name=$(jq -r '.name // empty' "$repo_path/package.json" 2>/dev/null)
        if [[ -n "$pkg_name" ]]; then
            echo "cd $project_root && pnpm turbo run check-types --filter=$pkg_name"
        fi
        return
    fi

    echo ""
}

# Detect repo
repo=$(detect_repo "$file_path")

# Skip if unknown repo
if [[ "$repo" == "unknown" ]] || [[ -z "$repo" ]]; then
    exit 0  # Exit 0 for skip conditions
fi

# Log edited file
echo "$(date +%s):$file_path:$repo" >> "$cache_dir/edited-files.log"

# Update affected repos list
if ! grep -q "^$repo$" "$cache_dir/affected-repos.txt" 2>/dev/null; then
    echo "$repo" >> "$cache_dir/affected-repos.txt"
fi

# Store build commands
build_cmd=$(get_build_command "$repo")
tsc_cmd=$(get_tsc_command "$repo")

if [[ -n "$build_cmd" ]]; then
    echo "$repo:build:$build_cmd" >> "$cache_dir/commands.txt.tmp"
fi

if [[ -n "$tsc_cmd" ]]; then
    echo "$repo:tsc:$tsc_cmd" >> "$cache_dir/commands.txt.tmp"
fi

# Remove duplicates from commands
if [[ -f "$cache_dir/commands.txt.tmp" ]]; then
    sort -u "$cache_dir/commands.txt.tmp" > "$cache_dir/commands.txt"
    rm -f "$cache_dir/commands.txt.tmp"
fi

# Exit cleanly
exit 0
