# Build script for Synesis Export Zotero plugin (PowerShell)

$xpiPath = "synesis-export.xpi"

# Remove old build
if (Test-Path $xpiPath) {
    Remove-Item $xpiPath
}

# Create XPI using ZipArchive so entries use forward slashes
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open($xpiPath, "Create")

function Add-FileToZip([string]$filePath, [string]$entryName) {
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zip,
        $filePath,
        $entryName,
        [IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
}

Add-FileToZip "manifest.json" "manifest.json"
Add-FileToZip "bootstrap.js" "bootstrap.js"
Add-FileToZip "update.json" "update.json"
Add-FileToZip "LICENSE" "LICENSE"

$contentRoot = (Resolve-Path "content").Path
Get-ChildItem -Path $contentRoot -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($contentRoot.Length + 1).Replace("\", "/")
    Add-FileToZip $_.FullName ("content/" + $relative)
}

$zip.Dispose()

Write-Host "Build complete: $xpiPath"
