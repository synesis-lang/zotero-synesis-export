# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project aims to follow Semantic Versioning.

## [0.1.4]
### Added
- Export options for a single item and a selected collection (context menu and Tools menu).
- Separate prompts for Quotation, Memo, and Code field names.

### Changed
- Field formatting now uses `FIELD:` (no space before the colon).
- File picker handling to prefer absolute paths and work across Zotero 7/8.

### Fixed
- Startup compatibility for Zotero 8 (ES module import and window listener fallback).
- Windows XPI build now preserves forward slashes in ZIP entries.

## [0.1.0]
### Added
- Initial release: export PDF highlights, comments, and tags to Synesis format.
- Tools menu entries for export and preferences.
