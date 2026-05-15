#!/bin/bash
set -e

# Usage: npm run release [patch|minor|major]
# Par défaut: patch

BUMP=${1:-patch}

if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
  echo "❌ Argument invalide: '$BUMP'"
  echo "   Usage: npm run release [patch|minor|major]"
  exit 1
fi

echo "🔖 Bump version ($BUMP)..."
npm version $BUMP --no-git-tag-version

VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"

echo "📦 Version: $TAG"

git add package.json
git commit -m "release: $TAG"
git tag $TAG

echo "🚀 Push vers GitHub..."
git push origin master --tags

echo ""
echo "✅ Release $TAG lancée ! Suis la CI ici :"
echo "   https://github.com/PascheK/dailyos/actions"
