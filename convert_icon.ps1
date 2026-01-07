Add-Type -AssemblyName System.Drawing
$source = "C:\Users\ya168\.gemini\antigravity\brain\ffe8b6d7-223b-4b23-a0f4-63f484fdc169\uploaded_image_1767800700460.jpg"
$dest = "e:\Joe Tasks\Organizer\src-tauri\icons\app-icon.png"
$img = [System.Drawing.Image]::FromFile($source)
$img.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
Write-Host "Conversion Complete"
