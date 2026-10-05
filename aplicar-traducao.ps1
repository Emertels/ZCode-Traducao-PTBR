# Instalador de tradução PT-BR para ZCode — Emerson Teles
# ======================================================================
$utf8Console = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8Console
[Console]::OutputEncoding = $utf8Console
$OutputEncoding = $utf8Console

function Read-OpenChoice([string]$Prompt) {
    Write-Host $Prompt -NoNewline -ForegroundColor White
    while ($true) {
        $key = [Console]::ReadKey($true)
        if ($key.KeyChar -eq 's' -or $key.KeyChar -eq 'S') { Write-Host 'S'; return $true }
        if ($key.KeyChar -eq 'n' -or $key.KeyChar -eq 'N') { Write-Host 'N'; return $false }
        if ($key.Key -eq [ConsoleKey]::Enter) { Write-Host 'Enter'; return $false }
        if ($key.Key -eq [ConsoleKey]::Escape) { Write-Host 'Esc'; return $false }
    }
}
try { $Host.UI.RawUI.WindowTitle = "Instalador ZCode PT-BR - Emerson Teles" } catch {}

function Find-ZCodeInstallation {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Programs\zcode"),
        (Join-Path $env:ProgramFiles "ZCode"),
        (Join-Path ${env:ProgramFiles(x86)} "ZCode")
    )
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path (Join-Path $candidate "resources\app.asar"))) { return $candidate }
    }
    foreach ($key in @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )) {
        foreach ($app in (Get-ItemProperty $key -ErrorAction SilentlyContinue)) {
            if ($app.DisplayName -match "ZCode" -and $app.InstallLocation -and (Test-Path (Join-Path $app.InstallLocation "resources\app.asar"))) { return $app.InstallLocation }
        }
    }
    return $null
}

function Get-AppVersion($ExePath) {
    if (-not (Test-Path $ExePath)) { return $null }
    $v = (Get-Item -LiteralPath $ExePath).VersionInfo.FileVersion
    if (-not $v) { $v = (Get-Item -LiteralPath $ExePath).VersionInfo.ProductVersion }
    if ($v) { $p = $v.Split('.'); if ($p.Length -ge 3) { return "$($p[0]).$($p[1]).$($p[2])" }; return $v }
    return $null
}

function Write-InstallerHeader {
    Clear-Host
    Write-Host ''
    Write-Host ' ==================================================================== ' -ForegroundColor Cyan
    Write-Host '                 TRADUÇÃO ZCODE PARA PORTUGUÊS DO BRASIL             ' -ForegroundColor Green
    Write-Host '               Desenvolvido e Personalizado por: Emerson Teles       ' -ForegroundColor Yellow
    Write-Host ' ==================================================================== ' -ForegroundColor Cyan
    Write-Host ''
}
Write-InstallerHeader
Write-Host '[1/6] Validando arquivos da tradução...' -ForegroundColor White
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
$patcher = Join-Path $scriptDir "patch-zcode.cjs"
$dictionary = Join-Path $scriptDir "pt_dictionary.json"
$pluginPatcher = Join-Path $scriptDir "patch-plugins.cjs"
$visualPatcher = Join-Path $scriptDir "patch-visual-judge.cjs"
if (-not (Test-Path $patcher) -or -not (Test-Path $dictionary)) { Write-Host "[x] patch-zcode.cjs ou pt_dictionary.json não encontrado." -ForegroundColor Red; Pause; exit 1 }

Write-Host '[2/6] Procurando a instalação do ZCode...' -ForegroundColor White
$zcodeDir = Find-ZCodeInstallation
while (-not $zcodeDir) {
    $inputPath = Read-Host "Cole a pasta de instalação do ZCode"
    if ([string]::IsNullOrWhiteSpace($inputPath)) { Write-Host "Operação cancelada." -ForegroundColor Yellow; exit 1 }
    if (Test-Path (Join-Path $inputPath "resources\app.asar")) { $zcodeDir = $inputPath } else { Write-Host "Pasta inválida: resources\app.asar não foi encontrado." -ForegroundColor Red }
}
$resources = Join-Path $zcodeDir "resources"
$targetAsar = Join-Path $resources "app.asar"
$exePath = Join-Path $zcodeDir "ZCode.exe"
$version = Get-AppVersion $exePath
if (-not $version) { Write-Host "[x] Não foi possível detectar a versão do ZCode.exe." -ForegroundColor Red; Pause; exit 1 }
$running = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like "*zcode*" }
if ($running) { Write-Host "Fechando ZCode para aplicar a tradução..." -ForegroundColor Yellow; $running | Stop-Process -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2 }
Write-Host '[3/6] Verificando o backup original da versão...' -ForegroundColor White
$backupDir = Join-Path $zcodeDir "_backups"
$versionBackup = Join-Path $backupDir $version
$backupAsar = Join-Path $versionBackup "app.asar"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Write-Host "[x] Node.js não foi encontrado. Instale o Node.js e execute novamente." -ForegroundColor Red; Pause; exit 1 }
$verifier = Join-Path $scriptDir "tools\verify-clean-asar.cjs"
& $node.Source $patcher $zcodeDir --detect-state
$sourceState = $LASTEXITCODE
$backupIsClean = $false
if (Test-Path -LiteralPath $backupAsar -PathType Leaf) {
    & $node.Source $verifier "zcode" $backupAsar $version 2>$null
    $backupIsClean = ($LASTEXITCODE -eq 0)
}
if ($sourceState -eq 10) {
    if ($backupIsClean) {
        Write-Host "[i] ZCode já está traduzido para Português (Brasil). Nenhuma alteração necessária." -ForegroundColor Cyan
        Write-Host "[i] Backup original em inglês preservado em: $backupAsar" -ForegroundColor Cyan
        if (Read-OpenChoice "Deseja abrir o ZCode? [S = abrir | N/Enter/Esc = fechar]: ") { Start-Process -FilePath "explorer.exe" -ArgumentList "`"$exePath`"" }
        exit 0
    }
    Write-Host "[x] ZCode está traduzido, mas o backup original desta versão está ausente ou inválido." -ForegroundColor Red
    Write-Host "    Repare/instale o ZCode oficial por cima e tente novamente; mantenha as pastas de dados do usuário." -ForegroundColor Cyan
    Pause
    exit 1
}
if ($sourceState -ne 0 -and -not $backupIsClean) {
    Write-Host "[x] O app.asar está modificado e não há backup original limpo desta versão." -ForegroundColor Red
    Write-Host "    Repare/instale o ZCode oficial por cima e tente novamente; mantenha as pastas de dados do usuário." -ForegroundColor Cyan
    Pause
    exit 1
}
if ((Test-Path -LiteralPath $backupAsar -PathType Leaf) -and -not $backupIsClean) {
    Write-Host "[x] O backup original desta versão não passou na verificação e não será substituído." -ForegroundColor Red
    Write-Host "    Repare/instale o ZCode oficial por cima e tente novamente; mantenha as pastas de dados do usuário." -ForegroundColor Cyan
    Pause
    exit 1
}
if ($sourceState -eq 11 -and $backupIsClean) {
    Write-Host "[i] Alteração parcial detectada; a tradução será refeita usando o backup original limpo." -ForegroundColor Cyan
}
New-Item -ItemType Directory -Path $versionBackup -Force | Out-Null
$settingsPath = Join-Path $env:USERPROFILE ".zcode\v2\setting.json"
$settingsBackup = Join-Path $versionBackup "setting.json"
if ($sourceState -eq 0 -and (Test-Path $settingsPath) -and -not (Test-Path $settingsBackup)) { Copy-Item -LiteralPath $settingsPath -Destination $settingsBackup }
$locales = Join-Path $zcodeDir "locales"
$ptPak = Join-Path $locales "pt-BR.pak"
$enPak = Join-Path $locales "en-US.pak"
$ptPakWasAbsent = Join-Path $versionBackup "pt-BR-pak-was-absent.txt"
if (-not (Test-Path $ptPak) -and (Test-Path $enPak) -and -not (Test-Path $ptPakWasAbsent)) { [IO.File]::WriteAllText($ptPakWasAbsent, "pt-BR.pak ausente antes da instalação") }
$regPaths = @(
    "HKCU:\Software\Classes\Directory\shell\ZCode.OpenInZCode",
    "HKCU:\Software\Classes\Directory\Background\shell\ZCode.OpenInZCode",
    "HKCU:\Software\Classes\*\shell\ZCode.OpenInZCode",
    "HKCU:\Software\Classes\Drive\shell\ZCode.OpenInZCode"
)
$registryBackup = Join-Path $versionBackup "context-menu-original.json"
if ($sourceState -eq 0 -and -not (Test-Path -LiteralPath $registryBackup)) {
    $registryState = @()
    $registrySnapshotComplete = $true
    foreach ($rp in $regPaths) {
        $key = $null
        try {
            $relativePath = $rp.Substring('HKCU:\'.Length)
            $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($relativePath)
            if (-not $key) { continue }
            $valueNames = @($key.GetValueNames())
            $defaultExists = $valueNames -contains ''
            $muiExists = $valueNames -contains 'MUIVerb'
            $registryState += [pscustomobject]@{
                Path = $rp
                DefaultExists = $defaultExists
                DefaultValue = if ($defaultExists) { $key.GetValue('') } else { $null }
                DefaultKind = if ($defaultExists) { [string]$key.GetValueKind('') } else { $null }
                MuiExists = $muiExists
                MuiValue = if ($muiExists) { $key.GetValue('MUIVerb') } else { $null }
                MuiKind = if ($muiExists) { [string]$key.GetValueKind('MUIVerb') } else { $null }
            }
        } catch {
            $registrySnapshotComplete = $false
            Write-Host "[!] Não foi possível ler a chave de menu '$rp': $($_.Exception.Message)" -ForegroundColor Yellow
        } finally { if ($key) { $key.Dispose() } }
    }
    if ($registrySnapshotComplete) {
        ConvertTo-Json -InputObject @($registryState) -Depth 8 | Set-Content -LiteralPath $registryBackup -Encoding UTF8
    } else {
        Write-Host '[!] Backup do menu não foi gravado porque o Registro não pôde ser lido por completo.' -ForegroundColor Yellow
    }
}
# Guardar os arquivos auxiliares originais uma única vez no backup da versão.
$glmFiles = @(
    @{ Source = (Join-Path $resources "glm\zcode.cjs"); Name = "zcode.cjs" },
    @{ Source = (Join-Path $resources "glm\packages\browser-use-plugin\dist\mcp\server.js"); Name = "server.js" }
)
foreach ($item in $glmFiles) {
    $dest = Join-Path $versionBackup $item.Name
    if ($sourceState -eq 0 -and (Test-Path $item.Source) -and -not (Test-Path $dest)) { Copy-Item -LiteralPath $item.Source -Destination $dest }
}

Write-Host '[4/6] Aplicando tradução principal...' -ForegroundColor White
Write-Host "Aplicando tradução dinâmica na versão $version..." -ForegroundColor Cyan
& $node.Source $patcher $zcodeDir
if ($LASTEXITCODE -eq 10) {
    Write-Host ''
    Write-Host "[i] ZCode já está traduzido para Português (Brasil). Nenhuma alteração necessária." -ForegroundColor Cyan
    Write-Host "[i] Backup original em inglês preservado." -ForegroundColor Cyan
    Write-Host "Backup original em inglês preservado em: $versionBackup\app.asar" -ForegroundColor Cyan
    if (Read-OpenChoice "Deseja abrir o ZCode? [S = abrir | N/Enter/Esc = fechar]: ") {
        Start-Process -FilePath "explorer.exe" -ArgumentList "`"$exePath`""
    }
    exit 0
}
if ($LASTEXITCODE -eq 11) {
    Write-Host "[x] O app.asar está modificado e não há backup original confiável para reconstruí-lo." -ForegroundColor Red
    Write-Host "    Repare/instale o ZCode oficial por cima e tente novamente; mantenha as pastas de dados do usuário." -ForegroundColor Cyan
    Pause
    exit 1
}
if ($LASTEXITCODE -ne 0) { Write-Host "[x] O patcher falhou. Nenhum ASAR estático será usado." -ForegroundColor Red; Pause; exit 1 }

# Ajustes auxiliares de localização e mensagens, com backups originais imutáveis.
$glmCjs = $glmFiles[0].Source
if (Test-Path $glmCjs) {
    $content = [IO.File]::ReadAllText($glmCjs, [Text.Encoding]::UTF8)
    $content = $content.Replace("String to replace not found in file.", "Texto a ser substituído não foi encontrado no arquivo.")
    $content = $content.Replace("old_string is not unique in the file.", "O texto antigo não é exclusivo no arquivo.")
    [IO.File]::WriteAllText($glmCjs, $content, (New-Object Text.UTF8Encoding($false)))
}
if (Test-Path $settingsPath) {
    try {
        $settings = Get-Content -LiteralPath $settingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if (-not $settings.general) { $settings | Add-Member -NotePropertyName general -NotePropertyValue ([pscustomobject]@{}) }
        $settings.general | Add-Member -NotePropertyName locale -NotePropertyValue "pt-BR" -Force
        $settings | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $settingsPath -Encoding UTF8
    } catch { Write-Host "[!] Não foi possível atualizar setting.json: $($_.Exception.Message)" -ForegroundColor Yellow }
}
if ((Test-Path $enPak) -and -not (Test-Path $ptPak)) { Copy-Item -LiteralPath $enPak -Destination $ptPak }
Write-Host '[5/6] Traduzindo skills e plugins (essa etapa pode demorar)...' -ForegroundColor White
foreach ($auxPatcher in @($pluginPatcher, $visualPatcher)) {
    if (Test-Path $auxPatcher) { & $node.Source $auxPatcher $versionBackup (Join-Path $resources "glm"); if ($LASTEXITCODE -ne 0) { Write-Host "[!] Um patch auxiliar não foi aplicado: $(Split-Path $auxPatcher -Leaf)" -ForegroundColor Yellow } }
}

# Traduzir os itens do menu de contexto sem alterar a versão do aplicativo.
foreach ($rp in $regPaths) {
    $key = $null
    try {
        $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($rp.Substring('HKCU:\'.Length), $true)
        if ($key) { $key.SetValue('', 'Abrir no ZCode', [Microsoft.Win32.RegistryValueKind]::String); $key.SetValue('MUIVerb', 'Abrir no ZCode', [Microsoft.Win32.RegistryValueKind]::String) }
    } catch { Write-Host "[!] Não foi possível traduzir a entrada de menu '$rp': $($_.Exception.Message)" -ForegroundColor Yellow }
    finally { if ($key) { $key.Dispose() } }
}

Write-Host '[6/6] Tradução concluída.' -ForegroundColor White
Write-Host "
[OK] Tradução PT-BR instalada na versão $version." -ForegroundColor Green
Write-Host "Backup original preservado em: $versionBackup" -ForegroundColor Gray
if (Read-OpenChoice "Deseja abrir o ZCode? [S = abrir | N/Enter/Esc = fechar]: ") { Start-Process -FilePath "explorer.exe" -ArgumentList "`"$exePath`"" }
