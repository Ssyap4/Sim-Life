# Local household only: downloads explicitly requested highlights from their public share pages.
# No footage is checked into Git. Re-run before a local Vite build.
param([string]$SourceDir='D:\Sim-Life-PrivateUfc')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$target=Join-Path $root 'public\media\ufc-private'
New-Item -ItemType Directory -Force $SourceDir,$target | Out-Null
$clips=@(
 @{name='exchange-1';page='https://tenor.com/view/cruz-garbrandt-ufc-dance-gif-7464546'},
 @{name='exchange-2';page='https://tenor.com/view/holloway-vs-gaethje-max-holloway-justin-gaethje-ufc-ko-gif-7856354374511510347'},
 @{name='exchange-3';page='https://tenor.com/view/jorge-masvidal-masvidal-ufc261-knockout-kamaru-usman-gif-10083132014987551152'},
 @{name='celebrate-1';page='https://tenor.com/view/fired-up-max-holloway-ufc-ready-to-go-pumped-gif-16301938'},
 @{name='celebrate-2';page='https://tenor.com/view/win-fight-wwe-ufc-happy-gif-9055531'},
 @{name='celebrate-3';page='https://tenor.com/view/ufc-mma-leon-edwards-kamaru-usman-3-gif-13957978660888203488'}
)
$installed=@()
foreach($clip in $clips){
 $file=Join-Path $SourceDir ($clip.name+'.mp4')
 if(!(Test-Path $file)){
  try{
   $html=(& curl.exe -fLsS --max-time 20 $clip.page) -join "`n"
   if($LASTEXITCODE -ne 0){throw 'page download failed'}
   $media=[regex]::Match($html,'https://media(?:[0-9]+)?\.tenor\.com/[^"\s<>]+?\.mp4').Value
   if(!$media){throw 'MP4 link not found'}
   & curl.exe -fLsS --max-time 30 -o ($file+'.tmp') $media
   if($LASTEXITCODE -ne 0){throw 'clip download failed'}
   $bytes=[IO.File]::ReadAllBytes($file+'.tmp')
   if($bytes.Length -lt 1000 -or [Text.Encoding]::ASCII.GetString($bytes,4,4) -ne 'ftyp'){throw 'not an MP4'}
   Move-Item -Force ($file+'.tmp') $file
  }catch{Write-Warning ($clip.name+': '+$_.Exception.Message);continue}
 }
 Copy-Item -Force $file $target
 $installed+=($clip.name+'.mp4')
 Write-Output ($clip.name+' '+(Get-Item $file).Length+' bytes')
}
# Write ASCII-compatible UTF-8 without BOM; absent manifest means use original art.
[IO.File]::WriteAllText((Join-Path $target 'manifest.json'),(ConvertTo-Json -InputObject @($installed) -Compress),(New-Object Text.UTF8Encoding($false)))
