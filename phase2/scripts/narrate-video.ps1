param([Parameter(Mandatory=$true)][string]$BuildDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$scenes = Get-Content -LiteralPath (Join-Path $BuildDirectory 'video/scenes.json') -Raw -Encoding utf8 | ConvertFrom-Json
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice.SelectVoice('Microsoft Zira Desktop')
$voice.Rate = 0
try {
    for ($i = 0; $i -lt $scenes.Count; $i++) {
        $wav = Join-Path $BuildDirectory ('video/scene-{0:D2}.wav' -f ($i+1))
        $voice.SetOutputToWaveFile($wav)
        $voice.Speak($scenes[$i].narration)
        $voice.SetOutputToNull()
    }
} finally { $voice.Dispose() }
Write-Output ('Narrated {0} scenes with a synthetic English voice.' -f $scenes.Count)
