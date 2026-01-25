# Synesis Export Plugin for Zotero 7

Export PDF annotations from Zotero to Synesis format for qualitative research analysis.

## Features

- Export highlighted text from PDFs
- Export user comments associated with highlights
- Export tags as codes
- Export selected items or entire library
- **Configurable field names** for compatibility with your project template
- Output in Synesis format (`.syn`) ready for qualitative analysis

## Installation

### Method 1: Install from XPI file

1. Download `synesis-export.xpi` from Releases
2. In Zotero, go to **Tools > Add-ons**
3. Click the gear icon and select **Install Add-on From File...**
4. Select the downloaded `.xpi` file
5. Restart Zotero

### Method 2: Build from source

1. Clone this repository
2. Run the build script:
   ```bash
   cd zotero-synesis-export
   zip -r synesis-export.xpi manifest.json bootstrap.js content/ update.json LICENSE
   ```
3. Install the generated `.xpi` file as described above

### Method 3: Use build batch command

Windows: powershell -File build.ps1
Linux/Mac: ./build.sh

## Usage

### Export Selected Items

1. Select one or more items in your Zotero library
2. Right-click and select **Export Annotations to Synesis...**
3. Choose a location to save the `.syn` file

### Export All Annotations

1. Go to **Tools > Export All Annotations to Synesis...**
2. Choose a location to save the `.syn` file

### Configure Field Names

1. Go to **Tools > Synesis Export Preferences...**
2. Enter custom field names for:
   - **Quotation** (highlighted text) - default: `QUOTATION`
   - **Memo** (user comments) - default: `MEMO`
   - **Code** (tags) - default: `CODE`
3. Click OK to save

This allows you to customize the output format for compatibility with your project template.

## Output Format

The plugin exports annotations in Synesis format:

```
SOURCE @authorYear
END SOURCE

ITEM @authorYear
    QUOTATION : The exact highlighted text from the PDF
    MEMO : User's comment associated with the highlight
    CODE : first_tag
    CODE : second_tag
END ITEM
```

### Field Descriptions

- **SOURCE**: One block per bibliographic item (identified by citekey)
- **ITEM**: One block per annotation
  - `QUOTATION`: The literal highlighted text (required)
  - `MEMO`: User's comment (optional, only if present)
  - `CODE`: Tags applied to the annotation (optional, one line per tag)

Note: Field names (QUOTATION, MEMO, CODE) can be customized via preferences.

## Requirements

- Zotero 7.0 or later
- PDF annotations created using Zotero's built-in PDF reader

## Compatibility

This plugin is designed for Zotero 7 only. It uses the new bootstrapped plugin architecture.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Author

Christian M. De Britto

## Related

- [Synesis Language](https://github.com/synesis-lang/synesis)
- [Zotero](https://www.zotero.org/)
