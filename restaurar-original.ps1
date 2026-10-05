# ==============================================================================
#  Restaurador do ZCode Original de Fabrica
#  Pacote de Tradução por: Emerson Teles
# ==============================================================================
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
$Host.UI.RawUI.WindowTitle = "Restaurar ZCode Original - Emerson Teles"

function Write-Header {
    Clear-Host
    Write-Host ""
    Write-Host " ==================================================================== " -ForegroundColor Yellow
    Write-Host "           RESTAURAR ZCODE ORIGINAL DE FÁBRICA                        " -ForegroundColor White
    Write-Host "              Pacote de Tradução por: Emerson Teles                   " -ForegroundColor Cyan
    Write-Host " ==================================================================== " -ForegroundColor Yellow
    Write-Host ""
}

function Copy-FileWithProgress {
    param(
        [string]$Source,
        [string]$Destination,
        [string]$Label = "Copiando"
    )

    $sourceFile = New-Object System.IO.FileInfo($Source)
    $totalBytes = $sourceFile.Length
    $totalMB = [math]::Round($totalBytes / 1MB, 1)

    $bufferSize = 4MB
    $buffer = New-Object byte[] $bufferSize

    $sourceStream = [System.IO.File]::OpenRead($Source)
    $destStream = [System.IO.File]::Create($Destination)

    $totalRead = 0
    $lastPercent = -1

    Write-Host "  $Label..." -ForegroundColor Cyan

    try {
        while (($bytesRead = $sourceStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $destStream.Write($buffer, 0, $bytesRead)
            $totalRead += $bytesRead
            $percent = [math]::Floor(($totalRead / $totalBytes) * 100)

            if ($percent -ne $lastPercent) {
                $lastPercent = $percent
                $copiedMB = [math]::Round($totalRead / 1MB, 1)
                $barLen = 22
                $filled = [math]::Floor(($percent / 100) * $barLen)
                $bar = ('=' * $filled) + (' ' * ($barLen - $filled))
                $msg = "`r    [$bar] $percent% ($copiedMB MB / $totalMB MB)   "
                Write-Host -NoNewline $msg
                Start-Sleep -Milliseconds 8
            }
        }
        Write-Host ""
    }
    finally {
        $sourceStream.Close()
        $destStream.Close()
    }
}

function Restore-ZCodeFile {
    param([string]$Source, [string]$Destination, [string]$Label)
    try {
        if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) { throw "O arquivo original não foi encontrado: $Source" }
        if (Test-Path -LiteralPath $Destination -PathType Container) { throw "O destino esperado como arquivo é uma pasta; ela foi mantida: $Destination" }
        $parent = Split-Path -Parent $Destination
        if (-not (Test-Path -LiteralPath $parent -PathType Container)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        if ((Test-Path -LiteralPath $Destination -PathType Leaf) -and
            (Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash -eq (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash) {
            Write-Host "    [i] $Label já corresponde ao original." -ForegroundColor Cyan
            return
        }
        [IO.File]::Copy($Source, $Destination, $true)
        if ((Get-FileHash -LiteralPath $Source -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash) {
            throw "A verificação do arquivo restaurado falhou: $Destination"
        }
        $script:restoreChanged = $true
        Write-Host "    [OK] $Label restaurado com sucesso." -ForegroundColor Green
    } catch {
        $script:restoreIncomplete = $true
        Write-Host "    [!] $Label não pôde ser restaurado: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

function Find-ZCodeInstallation {
    $candidates = @()

    $proc = Get-Process -Name "ZCode" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($proc -and $proc.Path) {
        $candidates += (Split-Path $proc.Path -Parent)
    }

    $candidates += (Join-Path $env:LOCALAPPDATA "Programs\ZCode")
    $candidates += (Join-Path $env:ProgramFiles "ZCode")
    if (${env:ProgramFiles(x86)}) {
        $candidates += (Join-Path ${env:ProgramFiles(x86)} "ZCode")
    }
    $candidates += (Join-Path $env:APPDATA "ZCode")

    $regPaths = @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    foreach ($rp in $regPaths) {
        try {
            $keys = Get-ItemProperty -Path $rp -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*ZCode*" }
            foreach ($k in $keys) {
                if ($k.InstallLocation -and (Test-Path $k.InstallLocation)) {
                    $candidates += $k.InstallLocation
                }
            }
        } catch { }
    }

    $drives = Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root
    foreach ($d in $drives) {
        $candidates += (Join-Path $d "ZCode")
        $candidates += (Join-Path $d "Programs\ZCode")
    }

    foreach ($cand in ($candidates | Where-Object { $_ } | Select-Object -Unique)) {
        if ((Test-Path (Join-Path $cand "resources\app.asar")) -or (Test-Path (Join-Path $cand "ZCode.exe"))) {
            return $cand
        }
    }

    return $null
}

# Inicio
Write-Header

# 1. Fechar processos
$running = Get-Process | Where-Object { $_.ProcessName -like "*zcode*" }
if ($running) {
    Write-Host "[-] Fechando processos do ZCode..." -ForegroundColor Yellow
    $running | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# 2. Localizar ZCode
Write-Host "[1/3] Localizando ZCode..." -ForegroundColor White
$zcodeDir = Find-ZCodeInstallation

while (-not $zcodeDir -or -not (Test-Path $zcodeDir)) {
    Write-Host ""
    Write-Host "[!] Não foi possivel detectar o ZCode automaticamente." -ForegroundColor Yellow
    $userInput = Read-Host "Digite ou cole a pasta onde o ZCode esta instalado"
    if ([string]::IsNullOrWhiteSpace($userInput)) {
        Write-Host "[x] Operacao cancelada." -ForegroundColor Red
        Exit 1
    }
    if (Test-Path (Join-Path $userInput "resources")) {
        $zcodeDir = $userInput
    } else {
        Write-Host "[x] Pasta invalida!" -ForegroundColor Red
    }
}

Write-Host "    -> ZCode localizado em: $zcodeDir" -ForegroundColor Green
$resourcesDir = Join-Path $zcodeDir "resources"
$targetAsar = Join-Path $resourcesDir "app.asar"

# Pasta padronizada de backup dentro do diretorio do programa
$backupDir = Join-Path $zcodeDir "_backups"

$detectedVersion = $null
$exePath = Join-Path $zcodeDir "ZCode.exe"
if (Test-Path $exePath) {
    try {
        $detectedVersion = (Get-Item $exePath).VersionInfo.FileVersion
        if (-not $detectedVersion) { $detectedVersion = (Get-Item $exePath).VersionInfo.ProductVersion }
    } catch { }
}

# 3. Localizar Backup
Write-Host ""
if ($detectedVersion) {
    Write-Host "[2/3] Localizando arquivo de backup original (v$detectedVersion)..." -ForegroundColor White
} else {
    Write-Host "[2/3] Localizando arquivo de backup..." -ForegroundColor White
}

$buildKey = $null
if ($detectedVersion) {
    $vparts = $detectedVersion.Split('.')
    $buildKey = if ($vparts.Length -ge 3) { "$($vparts[0]).$($vparts[1]).$($vparts[2])" } else { $detectedVersion }
}
$foundBackup = $null
if ($buildKey) {
    $candidate = Join-Path (Join-Path $backupDir $buildKey) "app.asar"
    if (Test-Path $candidate) { $foundBackup = $candidate }
}
if (-not $foundBackup) {
    # Uma instalação original recém-instalada pode não ter criado _backups.
    # Verifique o ASAR ativo antes de informar que não há nada para restaurar.
    $verifier = Join-Path $PSScriptRoot "tools\verify-clean-asar.cjs"
    $node = Get-Command node -ErrorAction SilentlyContinue
    $installedAsarClean = $false
    if ($buildKey -and $node -and (Test-Path -LiteralPath $verifier -PathType Leaf) -and (Test-Path -LiteralPath $targetAsar -PathType Leaf)) {
        & $node.Source $verifier "zcode" $targetAsar $buildKey
        $installedAsarClean = ($LASTEXITCODE -eq 0)
    }
    if ($installedAsarClean) {
        Write-Host "[i] O ZCode já está original; o app.asar da versão $buildKey passou na verificação." -ForegroundColor Cyan
        Write-Host "    Nenhum backup precisou ser criado para confirmar o estado original." -ForegroundColor Cyan
        Write-Host ""
        if (Test-Path -LiteralPath $exePath -PathType Leaf) {
            if (Read-OpenChoice "Deseja abrir o ZCode original? [S = abrir | N/Enter/Esc = fechar]: ") {
                Start-Process -FilePath "explorer.exe" -ArgumentList "`"$exePath`""
            }
        }
        Exit 0
    }

    Write-Host "" 
    Write-Host "[x] Não encontrei um backup original confiável da versão $buildKey." -ForegroundColor Red
    Write-Host "    O app.asar ativo não passou na verificação de arquivo original; nenhuma restauração foi feita." -ForegroundColor Yellow
    Write-Host "    Procurado em: $backupDir\<versão>\app.asar" -ForegroundColor Gray
    Write-Host "    Repare/instale o ZCode oficial por cima e tente novamente. Mantenha as pastas de dados do usuário." -ForegroundColor Cyan
    Write-Host ""
    Read-OpenChoice "Pressione Enter ou Esc para sair."
    Exit 1
}

$verifier = Join-Path $PSScriptRoot "tools\verify-clean-asar.cjs"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node -or -not (Test-Path $verifier)) {
    Write-Host "[x] Não foi possível verificar o backup. Confirme o Node.js e os arquivos do pacote." -ForegroundColor Red
    Read-OpenChoice "Pressione Enter ou Esc para sair."
    Exit 1
}
& $node.Source $verifier "zcode" $foundBackup $buildKey
if ($LASTEXITCODE -ne 0) {
    Write-Host "[x] O ASAR de backup não passou na verificação; restauração cancelada." -ForegroundColor Red
    Read-OpenChoice "Pressione Enter ou Esc para sair."
    Exit 1
}

Write-Host "    -> Backup reconhecido com sucesso em:" -ForegroundColor Green
Write-Host "       $foundBackup" -ForegroundColor Gray

# 4. Restaurar
Write-Host ""
Write-Host "[3/3] Restaurando ZCode original de fábrica..." -ForegroundColor White
$restoreChanged = $false
$restoreIncomplete = $false
$installedAsarHash = (Get-FileHash -LiteralPath $targetAsar -Algorithm SHA256).Hash
$backupAsarHash = (Get-FileHash -LiteralPath $foundBackup -Algorithm SHA256).Hash
if ($installedAsarHash -eq $backupAsarHash) {
    Write-Host "    [i] O app.asar já está original; não é necessário copiá-lo novamente." -ForegroundColor Cyan
} else {
    Copy-FileWithProgress -Source $foundBackup -Destination $targetAsar -Label "Restaurando app.asar original"
    $restoreChanged = $true
    Write-Host "    [OK] Arquivo app.asar restaurado com sucesso!" -ForegroundColor Green
}

# Restaurar arquivos de suporte GLM se existirem no backup
$backupCjs = Join-Path (Join-Path $backupDir $buildKey) "zcode.cjs"
$glmZCodeCjs = Join-Path $resourcesDir "glm\zcode.cjs"
if ((Test-Path $backupCjs) -and (Test-Path (Split-Path $glmZCodeCjs -Parent))) {
    Restore-ZCodeFile -Source $backupCjs -Destination $glmZCodeCjs -Label "Arquivo zcode.cjs"
}

$backupServer = Join-Path (Join-Path $backupDir $buildKey) "server.js"
$glmServerJs = Join-Path $resourcesDir "glm\packages\browser-use-plugin\dist\mcp\server.js"
if ((Test-Path $backupServer) -and (Test-Path (Split-Path $glmServerJs -Parent))) {
    Restore-ZCodeFile -Source $backupServer -Destination $glmServerJs -Label "Arquivo server.js"
}

$versionBackupDir = Join-Path $backupDir $buildKey
$settingsBackup = Join-Path $versionBackupDir "setting.json"
$settingsPath = Join-Path $env:USERPROFILE ".zcode\v2\setting.json"
if (Test-Path $settingsBackup) {
    $settingsParent = Split-Path $settingsPath -Parent
    Restore-ZCodeFile -Source $settingsBackup -Destination $settingsPath -Label "Preferências originais"
}
$ptPakWasAbsent = Join-Path $versionBackupDir "pt-BR-pak-was-absent.txt"
$ptPak = Join-Path (Join-Path $zcodeDir "locales") "pt-BE.pak"
if ((Test-Path $ptPakWasAbsent) -and (Test-Path $ptPak)) {
    Remove-Item -LiteralPath $ptPak -Force
    $restoreChanged = $true
    Write-Host "    [OK] Pacote de idioma criado pela tradução removido." -ForegroundColor Green
}
$registryBackup = Join-Path $versionBackupDir "context-menu-original.json"
if (Test-Path $registryBackup) {
    try {
        $registryState = Get-Content -LiteralPath $registryBackup -Raw -Encoding UTF8 | ConvertFrom-Json
        $registryRestoredCount = 0
        foreach ($entry in @($registryState)) {
            if (-not $entry.Path -or -not ([string]$entry.Path).StartsWith('HKCU:\', [StringComparison]::OrdinalIgnoreCase)) { continue }
            $relativePath = ([string]$entry.Path).Substring('HKCU:\'.Length)
            $key = $null
            try {
                $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($relativePath, $true)
            } catch {
                $restoreIncomplete = $true
                Write-Host "    [!] Não foi possível verificar a entrada de menu '$($entry.Path)': $($_.Exception.Message)" -ForegroundColor Yellow
                continue
            }
            if (-not $key) {
                Write-Host "    [i] Entrada de menu já ausente; nenhuma restauração necessária: $($entry.Path)" -ForegroundColor Cyan
                continue
            }
            if (($entry.DefaultExists -and $entry.DefaultValue -isnot [string]) -or ($entry.MuiExists -and $entry.MuiValue -isnot [string])) {
                $key.Dispose()
                Write-Host "    [!] Entrada de menu não restaurada: a chave existe, mas o backup contém valores inválidos ($($entry.Path))." -ForegroundColor Yellow
                $restoreIncomplete = $true
                continue
            }
            try {
                $valueNames = @($key.GetValueNames())
                $defaultExistsNow = $valueNames -contains ''
                $muiExistsNow = $valueNames -contains 'MUIVerb'
                $defaultMatches = ($defaultExistsNow -eq [bool]$entry.DefaultExists)
                $muiMatches = ($muiExistsNow -eq [bool]$entry.MuiExists)
                if ($defaultMatches -and $entry.DefaultExists) {
                    $defaultMatches = ([string]$key.GetValue('', $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) -ceq [string]$entry.DefaultValue) -and
                        ($key.GetValueKind('') -eq [Microsoft.Win32.RegistryValueKind]$entry.DefaultKind)
                }
                if ($muiMatches -and $entry.MuiExists) {
                    $muiMatches = ([string]$key.GetValue('MUIVerb', $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames) -ceq [string]$entry.MuiValue) -and
                        ($key.GetValueKind('MUIVerb') -eq [Microsoft.Win32.RegistryValueKind]$entry.MuiKind)
                }
                if ($defaultMatches -and $muiMatches) {
                    Write-Host "    [i] Entrada de menu já corresponde ao original: $($entry.Path)" -ForegroundColor Cyan
                    continue
                }
                if ($entry.DefaultExists) { $key.SetValue('', [string]$entry.DefaultValue, [Microsoft.Win32.RegistryValueKind]$entry.DefaultKind) } else { $key.DeleteValue('', $false) }
                if ($entry.MuiExists) { $key.SetValue('MUIVerb', [string]$entry.MuiValue, [Microsoft.Win32.RegistryValueKind]$entry.MuiKind) } else { $key.DeleteValue('MUIVerb', $false) }
                $registryRestoredCount++
            } catch { $restoreIncomplete = $true; Write-Host "    [!] Não foi possível restaurar a entrada de menu: $($_.Exception.Message)" -ForegroundColor Yellow }
            finally { if ($key) { $key.Dispose() } }
        }
        if ($registryRestoredCount -gt 0) { $restoreChanged = $true; Write-Host "    [OK] Textos originais do menu de contexto restaurados." -ForegroundColor Green }
    } catch { $restoreIncomplete = $true; Write-Host "    [!] Não foi possível restaurar o menu de contexto: $($_.Exception.Message)" -ForegroundColor Yellow }
}

$auxiliaryManifest = Join-Path $versionBackupDir "auxiliary-manifest.json"
if (Test-Path $auxiliaryManifest) {
    try {
        $auxiliaryEntries = Get-Content -LiteralPath $auxiliaryManifest -Raw -Encoding UTF8 | ConvertFrom-Json
        $allowedAuxRoots = @((Join-Path $env:USERPROFILE ".zcode"), (Join-Path $resourcesDir "glm")) | ForEach-Object { [IO.Path]::GetFullPath($_).TrimEnd('\') + '\' }
        $backupRootFull = [IO.Path]::GetFullPath($versionBackupDir).TrimEnd('\') + '\'
        $auxRestoredCount = 0
        $auxSkippedCount = 0
        foreach ($entry in @($auxiliaryEntries)) {
            try {
                $target = [IO.Path]::GetFullPath([string]$entry.path)
                if (-not ($allowedAuxRoots | Where-Object { $target.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) })) { continue }
                if ($entry.existed) {
                    $saved = [IO.Path]::GetFullPath((Join-Path $versionBackupDir ([string]$entry.backupRelativePath)))
                    if (-not $saved.StartsWith($backupRootFull, [StringComparison]::OrdinalIgnoreCase)) {
                        throw "O caminho do backup está fora de _backups."
                    }
                    if (-not (Test-Path -LiteralPath $saved -PathType Leaf)) {
                        throw "O arquivo de backup está ausente ou não é um arquivo."
                    }
                    if (Test-Path -LiteralPath $target -PathType Container) {
                        throw "O destino esperado como arquivo é uma pasta; ela foi mantida sem alterações."
                    }
                    $parent = Split-Path -Parent $target
                    if (-not (Test-Path -LiteralPath $parent -PathType Container)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
                    if (-not (Test-Path -LiteralPath $target -PathType Leaf) -or (Get-FileHash -LiteralPath $saved -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash) {
                        [IO.File]::Copy($saved, $target, $true)
                        $auxRestoredCount++
                        $restoreChanged = $true
                    }
                } elseif (Test-Path -LiteralPath $target) {
                    if (Test-Path -LiteralPath $target -PathType Container) {
                        throw "O destino que deveria ser removido é uma pasta; ela foi mantida sem alterações."
                    }
                    Remove-Item -LiteralPath $target -Force -ErrorAction Stop
                    $restoreChanged = $true
                }
            } catch {
                $auxSkippedCount++
                $restoreIncomplete = $true
                Write-Host "    [!] Arquivo auxiliar não restaurado: $($entry.path)" -ForegroundColor Yellow
                Write-Host "        $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
        if ($auxRestoredCount -gt 0) { Write-Host "    [OK] $auxRestoredCount arquivo(s) original(is) de plugins/habilidades restaurado(s)." -ForegroundColor Green }
        if ($auxSkippedCount -gt 0) { Write-Host "    [!] $auxSkippedCount arquivo(s) auxiliar(es) não puderam ser restaurados; consulte os avisos acima." -ForegroundColor Yellow }
    } catch {
        $restoreIncomplete = $true
        Write-Host "    [!] Não foi possível ler ou restaurar o manifesto auxiliar: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Restauração compatível com instalações antigas sem cópia de valores do registro.
if (-not (Test-Path $registryBackup)) {
    $regShellPaths = @(
        "HKCU:\Software\Classes\Directory\shell\ZCode.OpenInZCode",
        "HKCU:\Software\Classes\Directory\Background\shell\ZCode.OpenInZCode",
        "HKCU:\Software\Classes\*\shell\ZCode.OpenInZCode",
        "HKCU:\Software\Classes\Drive\shell\ZCode.OpenInZCode"
    )
    foreach ($rp in $regShellPaths) {
        if (Test-Path $rp) {
            Set-ItemProperty -Path $rp -Name "(Default)" -Value "在ZCode中打开" -ErrorAction SilentlyContinue
            Set-ItemProperty -Path $rp -Name "MUIVerb" -Value "在ZCode中打开" -ErrorAction SilentlyContinue
        }
    }
    Write-Host "    -> Menu de contexto restaurado com o padrão legado." -ForegroundColor Gray
}


# Conclusao
Write-Host ""
if ($restoreIncomplete) {
    Write-Host " ==================================================================== " -ForegroundColor Yellow
    Write-Host "       RESTAURAÇÃO PARCIAL: VERIFIQUE OS AVISOS ACIMA                  " -ForegroundColor Yellow
    Write-Host " ==================================================================== " -ForegroundColor Yellow
    Write-Host "  O arquivo principal foi processado, mas nem todos os itens auxiliares voltaram." -ForegroundColor Yellow
} elseif ($restoreChanged) {
    Write-Host " ==================================================================== " -ForegroundColor Green
    Write-Host "            ZCODE RESTAURADO PARA O ESTADO ORIGINAL                   " -ForegroundColor Green
    Write-Host " ==================================================================== " -ForegroundColor Green
    Write-Host "  Restauração concluída com sucesso." -ForegroundColor Green
} else {
    Write-Host " ==================================================================== " -ForegroundColor Cyan
    Write-Host "       O ZCODE JÁ ESTÁ ORIGINAL; RESTAURAÇÃO NÃO NECESSÁRIA           " -ForegroundColor Cyan
    Write-Host " ==================================================================== " -ForegroundColor Cyan
    Write-Host "  O pacote original já está instalado; não é necessário restaurar." -ForegroundColor Cyan
}
Write-Host ""

$exePath = Join-Path $zcodeDir "ZCode.exe"
if (Test-Path $exePath) {
    if (Read-OpenChoice "Deseja abrir o ZCode original? [S = abrir | N/Enter/Esc = fechar]: ") {
        Write-Host "Iniciando ZCode de forma independente..." -ForegroundColor Cyan
        Start-Process -FilePath "explorer.exe" -ArgumentList "`"$exePath`""
        Start-Sleep -Milliseconds 400
        Exit 0
    } else {
        Write-Host "Restauração concluída. Finalizando..." -ForegroundColor Gray
        Start-Sleep -Milliseconds 300
        Exit 0
    }
}
Exit 0
