#!/bin/bash
# Build script for Synesis Export Zotero plugin

# Remove old build
rm -f synesis-export.xpi

# Create XPI (which is just a ZIP file)
zip -r synesis-export.xpi \
    manifest.json \
    bootstrap.js \
    content/ \
    update.json \
    LICENSE

echo "Build complete: synesis-export.xpi"
