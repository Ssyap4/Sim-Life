param([string]$Cache='D:\Sim-Life-PrivateSoundtrack')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$target=Join-Path $root 'public\audio\soundtrack'
$manifest=Get-Content -Raw -Encoding UTF8 (Join-Path $target 'manifest.json') | ConvertFrom-Json
foreach($track in $manifest){
  if($track.file -notmatch '^[a-z0-9-]+\.mp3$'){throw 'Invalid soundtrack filename'}
  $file=Join-Path $Cache $track.file
  if(!(Test-Path -LiteralPath $file)){throw ('Missing private track: '+$track.file)}
  if((Get-Item -LiteralPath $file).Length -lt 500000){throw 'Invalid soundtrack file'}
}
foreach($track in $manifest){Copy-Item -LiteralPath (Join-Path $Cache $track.file) -Destination (Join-Path $target $track.file) -Force}
Write-Output ('Installed '+$manifest.Count+' private tracks locally')
