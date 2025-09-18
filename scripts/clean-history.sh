#!/bin/bash
set -e

echo "⚠️  WARNING: This will rewrite Git history!"
echo "This will remove all references to Claude/AI assistants from commit messages"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

# Backup current branch
git branch backup-$(date +%Y%m%d-%H%M%S)

# Clean commit messages using filter-branch
echo "Cleaning commit messages..."
git filter-branch --force --msg-filter '
sed -e "s/🤖 Generated with \[Claude Code\].*//g" \
    -e "s/Co-Authored-By: Claude.*//g" \
    -e "s/Generated with Claude.*//g" \
    -e "s/\[Claude.*\]//g" \
    -e "s/Claude Code//g" \
    -e "s/claude\.ai\/code//g" \
    -e "s/Anthropic//g" \
    -e "s/CLAUDE\.md.*//g" \
    -e "/^$/d"
' --tag-name-filter cat -- --all

# Remove the original refs
git for-each-ref --format="%(refname)" refs/original/ | xargs -n 1 git update-ref -d

# Clean up reflog
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "✅ History cleaned locally"
echo ""
echo "To update the remote repository, run:"
echo "  git push --force --all origin"
echo "  git push --force --tags origin"
echo ""
echo "⚠️  WARNING: Force pushing will overwrite remote history!"
echo "Make sure all team members are aware before proceeding."