# 목차 전체를 맥락으로 두고, 장별로 본문을 작성해 텍스트 파일로 저장합니다.
# 사전: visionforlife 서버 실행 (serve.bat → http://localhost:8780) + Ollama
#
# 사용:
#   powershell -File write_book_chapters.ps1 -TocPath .\toc.txt
#   powershell -File write_book_chapters.ps1 -TocPath .\toc.txt -Mode rag -StartFrom 3
#
param(
    [Parameter(Mandatory = $true)][string]$TocPath,
    [string]$OutDir = '',
    [string]$ApiBase = 'http://localhost:8780',
    [ValidateSet('rag', 'model')][string]$Mode = 'rag',
    [int]$StartFrom = 1,
    [int]$TimeoutSec = 600,
    [int]$SummaryChars = 700
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path -LiteralPath $TocPath)) {
    throw "목차 파일 없음: $TocPath"
}
if (-not $OutDir) {
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $OutDir = Join-Path $ScriptDir ("book_out_" + $stamp)
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Get-SafeFileName([string]$s) {
    $t = $s -replace '[\\/:*?"<>|]', '_'
    $t = ($t -replace '\s+', ' ').Trim()
    if ($t.Length -gt 60) { $t = $t.Substring(0, 60).Trim() }
    if (-not $t) { $t = 'chapter' }
    return $t
}

function Parse-Toc([string]$path) {
    $items = @()
    $lines = Get-Content -LiteralPath $path -Encoding UTF8
    foreach ($line in $lines) {
        $raw = $line.Trim()
        if (-not $raw -or $raw.StartsWith('#')) { continue }
        if ($raw -match '^\s*(\d+)\s*[\.\)、:：\-–—]\s*(.+)$') {
            $items += [pscustomobject]@{ Num = [int]$Matches[1]; Title = $Matches[2].Trim() }
        } elseif ($raw -match '^\s*(\d+)\s+(.+)$') {
            $items += [pscustomobject]@{ Num = [int]$Matches[1]; Title = $Matches[2].Trim() }
        }
    }
    if (-not $items.Count) { throw '목차에서 번호 항목을 찾지 못했습니다. 예: 1. 주제' }
    return ($items | Sort-Object Num)
}

function Ask-Local([string]$question, [string]$context) {
    $uri = $ApiBase.TrimEnd('/') + '/api/ai/ask'
    $payload = @{
        question = $question
        context  = $context
        mode     = $Mode
    } | ConvertTo-Json -Depth 4 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    try {
        $r = Invoke-RestMethod -Uri $uri -Method POST -ContentType 'application/json; charset=utf-8' `
            -Body $bytes -TimeoutSec $TimeoutSec
    } catch {
        throw "API 호출 실패 ($uri): $($_.Exception.Message)`nvisionforlife serve.bat 가 켜져 있는지 확인하세요."
    }
    if (-not $r.ok) {
        $err = if ($r.error) { [string]$r.error } else { 'unknown' }
        throw "API 오류: $err"
    }
    return [string]$r.answer
}

function Make-Summary([string]$text, [int]$maxChars) {
    $t = ($text -replace '\r\n', "`n").Trim()
    if ($t.Length -le $maxChars) { return $t }
    return $t.Substring(0, $maxChars).Trim() + "`n…(요약 생략)"
}

# health
try {
    $h = Invoke-RestMethod -Uri ($ApiBase.TrimEnd('/') + '/api/health') -TimeoutSec 10
    Write-Host ("서버 OK · mode=$Mode · searchDbReady=" + [string]$h.rag.searchDbReady)
} catch {
    throw "서버에 연결할 수 없습니다: $ApiBase (serve.bat 실행 후 다시 시도)"
}

$chapters = Parse-Toc $TocPath
$tocBlock = ($chapters | ForEach-Object { "$($_.Num). $($_.Title)" }) -join "`n"
Write-Host "목차 $($chapters.Count)개 → $OutDir"
Write-Host $tocBlock
Write-Host ''

$prevNotes = New-Object System.Collections.Generic.List[string]
$logPath = Join-Path $OutDir '_progress.txt'
"시작 $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') mode=$Mode" | Set-Content -LiteralPath $logPath -Encoding UTF8

foreach ($ch in $chapters) {
    if ($ch.Num -lt $StartFrom) {
        $existing = Get-ChildItem -LiteralPath $OutDir -Filter ('{0:D2}_*.txt' -f $ch.Num) -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notlike '_*' } | Select-Object -First 1
        if ($existing) {
            $prevNotes.Add(("$($ch.Num). $($ch.Title)`n" + (Make-Summary (Get-Content -LiteralPath $existing.FullName -Raw -Encoding UTF8) $SummaryChars)))
            Write-Host ("건너뜀(기존 파일 사용) {0:D2}. {1}" -f $ch.Num, $ch.Title)
            continue
        }
        Write-Host ("건너뜀(파일 없음) {0:D2}" -f $ch.Num)
        continue
    }

    $prevBlock = if ($prevNotes.Count) {
        "【이미 작성한 장 — 용어·톤·논지를 이어서 유지】`n" + (($prevNotes | ForEach-Object { "----`n$_" }) -join "`n")
    } else {
        '【이미 작성한 장】 없음 (첫 장)'
    }

    $question = @"
당신은 한 권의 책을 집필 중입니다. 아래는 이 책의 전체 목차입니다. 모든 장을 이 목차의 흐름·용어·논지 안에서 일관되게 쓰세요.

【전체 목차】
$tocBlock

$prevBlock

【지금 쓸 장】
$($ch.Num). $($ch.Title)

요청:
- 지금 장($($ch.Num)번)의 본문만 작성하세요. 다른 장 전체를 다시 쓰지 마세요.
- 앞뒤 장과 자연히 이어지도록 쓰되, '이 장에서만' 완성된 글이 되게 하세요.
- 책 본문 문체로 충분히 풍성하게 쓰세요 (소제목이 있으면 마크다운 ## 사용 가능).
- 서두에 '답변:', '알겠습니다' 같은 메타 문구는 넣지 마세요. 본문만 출력하세요.
"@

    Write-Host ("작성 중 {0:D2}. {1} ..." -f $ch.Num, $ch.Title)
    $answer = Ask-Local $question ("책 집필 · $($ch.Num). $($ch.Title)")
    if (-not $answer.Trim()) { throw "빈 답변: $($ch.Num). $($ch.Title)" }

    $fname = ('{0:D2}_{1}.txt' -f $ch.Num, (Get-SafeFileName $ch.Title))
    $fpath = Join-Path $OutDir $fname
    $header = @"
# $($ch.Num). $($ch.Title)
# generated $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') · mode=$Mode

"@
    ($header + $answer.Trim() + "`n") | Set-Content -LiteralPath $fpath -Encoding UTF8
    $prevNotes.Add(("$($ch.Num). $($ch.Title)`n" + (Make-Summary $answer $SummaryChars)))
    ("OK {0:D2} → {1} ({2} chars)" -f $ch.Num, $fname, $answer.Length) | Add-Content -LiteralPath $logPath -Encoding UTF8
    Write-Host ("  저장: $fname  ({0}자)" -f $answer.Length)
}

Write-Host ''
Write-Host "완료: $OutDir"
Get-ChildItem -LiteralPath $OutDir -Filter '*.txt' | Sort-Object Name | ForEach-Object {
    Write-Host ("  " + $_.Name)
}
