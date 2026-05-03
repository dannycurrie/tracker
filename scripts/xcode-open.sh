#!/bin/bash
set -e

echo "→ Prebuilding iOS..."
npx expo prebuild --platform ios --clean

echo "→ Installing CocoaPods..."
pod install --project-directory=ios

echo "→ Opening in Xcode..."
xed ios
