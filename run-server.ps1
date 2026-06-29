# Simple PowerShell Static Web Server for Cert-generator
$port = 8080
$path = "c:\Users\Sento Eclipsen\Downloads\Cert-generator"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "=========================================" -ForegroundColor Green
    Write-Host "Web Server is running at http://localhost:$port/" -ForegroundColor Green
    Write-Host "Press Ctrl+C in this PowerShell window to stop." -ForegroundColor Yellow
    Write-Host "=========================================" -ForegroundColor Green
    
    Start-Process "http://localhost:$port/"

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/") { $urlPath = "/index.html" }
        
        $relPath = $urlPath.TrimStart('/')
        $filePath = [System.IO.Path]::Combine($path, $relPath)
        
        Write-Host "$($request.HttpMethod) $($request.Url.PathAndQuery)" -NoNewline
        
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".csv"  { "text/csv; charset=utf-8" }
                ".svg"  { "image/svg+xml; charset=utf-8" }
                default { "application/octet-stream" }
            }
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host " - 200 OK" -ForegroundColor Green
        } else {
            $response.StatusCode = 404
            $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            Write-Host " - 404 Not Found" -ForegroundColor Red
        }
        $response.Close()
    }
}
catch { Write-Error $_ }
finally {
    $listener.Stop()
    Write-Host "Server stopped." -ForegroundColor Yellow
}
