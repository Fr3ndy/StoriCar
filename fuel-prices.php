<?php
// Sicurezza: non esporre mai errori PHP in produzione
ini_set('display_errors', 0);
error_reporting(0);
/**
 * fuel-prices.php
 * Prezzi benzina via API carburanti.mise.gov.it
 * Area: Assemini, Sestu, Uta, Elmas, Quartu, Quartucciu, Pirri, Cagliari
 *
 * GET fuel-prices.php           → tutti gli impianti
 * GET fuel-prices.php?refresh=1 → forza aggiornamento cache
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET');

// Origine consentita: dalla variabile d'ambiente o wildcard in sviluppo
$allowedOrigin = getenv('ALLOWED_ORIGIN') ?: '*';
header('Access-Control-Allow-Origin: ' . $allowedOrigin);

define('CACHE_DIR', __DIR__ . '/cache');
define('CACHE_TTL', 3600); // 1 ora
define('REFRESH_COOLDOWN', 30); // Cooldown tra refresh forzati: 5 minuti

define('API_URL', 'https://carburanti.mise.gov.it/ospzApi/search/zone');

// Coordinate obbligatorie: devono essere inviate dal client (GPS)
if (!isset($_GET['lat']) || !isset($_GET['lng'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Parametri lat e lng obbligatori.']);
    exit;
}

$centerLat = (float)$_GET['lat'];
$centerLng = (float)$_GET['lng'];

// Validazione coordinate
if ($centerLat < -90 || $centerLat > 90 || $centerLng < -180 || $centerLng > 180) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Coordinate non valide.']);
    exit;
}

$radiusKm = isset($_GET['km']) ? max(1, min(50, (int)$_GET['km'])) : 10;

// Carburanti da includere
$FUEL_NAMES = ['Benzina', 'Gasolio', 'GPL', 'Metano', 'Benzina additivata', 'Gasolio additivato', 'Benzina Speciale'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureCacheDir(): void {
    if (!is_dir(CACHE_DIR)) {
        mkdir(CACHE_DIR, 0755, true);
    }
}

function cacheFile(float $lat, float $lng, int $km): string {
    // Cache separata per area: arrotondiamo a 2 decimali (~1km di precisione)
    $key = round($lat, 2) . '_' . round($lng, 2) . '_' . $km;
    return CACHE_DIR . '/fuel_' . md5($key) . '.json';
}

function cacheIsValid(string $file): bool {
    return file_exists($file) && (time() - filemtime($file)) < CACHE_TTL;
}

function callApi(float $lat, float $lng, int $km): ?array {
    $payload = json_encode([
        'points' => [['lat' => $lat, 'lng' => $lng]],
        'radius' => $km
    ]);

    $raw = null;

    // Usa cURL (più affidabile di file_get_contents per HTTPS su server)
    if (function_exists('curl_init')) {
        $ch = curl_init(API_URL);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_FOLLOWLOCATION => true,
            // Verifica SSL abilitata per prevenire attacchi MITM
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Origin: https://carburanti.mise.gov.it',
                'Referer: https://carburanti.mise.gov.it/ospzSearch/zona',
                'User-Agent: Mozilla/5.0',
            ],
        ]);
        $raw = curl_exec($ch);
        curl_close($ch);
    } else {
        // Fallback file_get_contents
        $ctx = stream_context_create([
            'http' => [
                'method'  => 'POST',
                'header'  =>
                    "Content-Type: application/json\r\n" .
                    "Origin: https://carburanti.mise.gov.it\r\n" .
                    "Referer: https://carburanti.mise.gov.it/ospzSearch/zona\r\n" .
                    "User-Agent: Mozilla/5.0\r\n",
                'content' => $payload,
                'timeout' => 30,
            ],
            'ssl' => [
                // Verifica SSL abilitata per prevenire attacchi MITM
                'verify_peer'      => true,
                'verify_peer_name' => true,
            ],
        ]);
        $raw = @file_get_contents(API_URL, false, $ctx);
    }

    if (!$raw) {
        return null;
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return null;
    }

    if (!isset($data['success']) || !$data['success']) {
        return null;
    }

    return $data['results'] ?? [];
}

// ── Carica e normalizza impianti ──────────────────────────────────────────────

function loadImpianti(array $FUEL_NAMES, float $lat, float $lng, int $km): array {
    ensureCacheDir();
    $forceRefresh = isset($_GET['refresh']) && $_GET['refresh'] === '1';
    $cacheFile    = cacheFile($lat, $lng, $km);

    // Rate limiting sul refresh forzato: non più di 1 volta ogni REFRESH_COOLDOWN secondi
    if ($forceRefresh && file_exists($cacheFile) && (time() - filemtime($cacheFile)) < REFRESH_COOLDOWN) {
        $forceRefresh = false; // silenziosamente ignora, usa la cache
    }

    if (!$forceRefresh && cacheIsValid($cacheFile)) {
        $cached = json_decode(@file_get_contents($cacheFile), true);
        if (is_array($cached) && count($cached) > 5) {
            return $cached;
        }
    }

    $results = callApi($lat, $lng, $km);

    if (!$results) {
        if (file_exists($cacheFile)) {
            $fallback = json_decode(@file_get_contents($cacheFile), true);
            return is_array($fallback) ? $fallback : [];
        }
        return [];
    }

    $impianti = [];

    foreach ($results as $imp) {
        // Estrai prezzi per ogni carburante richiesto
        $prezzi = [];

        foreach ($imp['fuels'] ?? [] as $f) {
            $nome = isset($f['name']) ? trim($f['name']) : '';
            foreach ($FUEL_NAMES as $fn) {
                if (strtolower($nome) === strtolower($fn)) {
                    if (!isset($prezzi[$fn])) {
                        $prezzi[$fn] = [
                            'self'    => null,
                            'servito' => null,
                            'data'    => '',
                        ];
                    }

                    $price = isset($f['price']) ? (float)$f['price'] : null;

                    if (!empty($f['isSelf'])) {
                        $prezzi[$fn]['self'] = $price;
                    } else {
                        $prezzi[$fn]['servito'] = $price;
                    }

                    $prezzi[$fn]['data'] = substr($imp['insertDate'] ?? '', 0, 16);
                }
            }
        }

        // Salta impianti senza nessuno dei carburanti richiesti
        if (empty($prezzi)) {
            continue;
        }

        $impianti[] = [
            'id'       => isset($imp['id']) ? (string)$imp['id'] : '',
            'nome'     => !empty($imp['name']) ? $imp['name'] : ('Impianto ' . ($imp['id'] ?? '')),
            'bandiera' => $imp['brand'] ?? '',
            'lat'      => isset($imp['location']['lat']) ? (float)$imp['location']['lat'] : 0.0,
            'lng'      => isset($imp['location']['lng']) ? (float)$imp['location']['lng'] : 0.0,
            'prezzi'   => $prezzi,
        ];
    }

    // Salva cache (best effort)
    @file_put_contents($cacheFile, json_encode($impianti, JSON_UNESCAPED_UNICODE));

    return $impianti;
}

// ── Filtro outlier (IQR) ──────────────────────────────────────────────────────

/**
 * Dato un array di valori, restituisce [min_valido, max_valido]
 * usando il metodo IQR: esclude valori fuori da Q1-1.5*IQR / Q3+1.5*IQR.
 */
function iqrBounds(array $values): array {
    if (count($values) < 4) {
        return [-INF, INF]; // troppo pochi dati, non filtrare
    }
    sort($values);
    $n  = count($values);
    $q1 = $values[(int)floor($n * 0.25)];
    $q3 = $values[(int)floor($n * 0.75)];
    $iqr = $q3 - $q1;
    return [$q1 - 1.5 * $iqr, $q3 + 1.5 * $iqr];
}

/**
 * Rimuove dagli impianti i prezzi che sono outlier statistici per quel carburante.
 * Se un impianto perde tutti i prezzi, viene rimosso.
 */
function filterOutliers(array $impianti, array $fuelNames): array {
    // 1. Raccoglie tutti i prezzi self+servito per carburante
    $allPrices = [];
    foreach ($fuelNames as $fn) {
        $allPrices[$fn] = [];
        foreach ($impianti as $imp) {
            $p = $imp['prezzi'][$fn] ?? null;
            if (!$p) continue;
            if ($p['self']    !== null) $allPrices[$fn][] = $p['self'];
            if ($p['servito'] !== null) $allPrices[$fn][] = $p['servito'];
        }
    }

    // 2. Calcola i bounds per ogni carburante
    $bounds = [];
    foreach ($fuelNames as $fn) {
        $bounds[$fn] = iqrBounds($allPrices[$fn]);
    }

    // 3. Applica il filtro: azzera i prezzi fuori range
    $result = [];
    foreach ($impianti as $imp) {
        $prezzi = $imp['prezzi'];
        foreach ($fuelNames as $fn) {
            if (!isset($prezzi[$fn])) continue;
            [$lo, $hi] = $bounds[$fn];
            if ($prezzi[$fn]['self']    !== null && ($prezzi[$fn]['self']    < $lo || $prezzi[$fn]['self']    > $hi)) {
                $prezzi[$fn]['self'] = null;
            }
            if ($prezzi[$fn]['servito'] !== null && ($prezzi[$fn]['servito'] < $lo || $prezzi[$fn]['servito'] > $hi)) {
                $prezzi[$fn]['servito'] = null;
            }
            // Se entrambi null, rimuovi la voce carburante
            if ($prezzi[$fn]['self'] === null && $prezzi[$fn]['servito'] === null) {
                unset($prezzi[$fn]);
            }
        }
        // Salta impianto se non ha più nessun carburante valido
        if (empty($prezzi)) continue;
        $imp['prezzi'] = $prezzi;
        $result[] = $imp;
    }

    return $result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

$impianti = loadImpianti($FUEL_NAMES, $centerLat, $centerLng, $radiusKm);

if (empty($impianti)) {
    http_response_code(503);
    echo json_encode([
        'ok'    => false,
        'error' => 'Impossibile recuperare i dati. Riprova più tardi.',
    ]);
    exit;
}

// Rimuovi outlier prima di calcolare le statistiche
$impianti = filterOutliers($impianti, $FUEL_NAMES);

// Statistiche per carburante
$stats = [];

foreach ($FUEL_NAMES as $fn) {
    $selfArr    = [];
    $servitoArr = [];

    foreach ($impianti as $imp) {
        if (!isset($imp['prezzi'][$fn])) {
            continue;
        }

        $p = $imp['prezzi'][$fn];

        if ($p['self'] !== null) {
            $selfArr[] = $p['self'];
        }

        if ($p['servito'] !== null) {
            $servitoArr[] = $p['servito'];
        }
    }

    $stats[$fn] = [
        'self' => $selfArr ? [
            'min'   => round(min($selfArr), 3),
            'max'   => round(max($selfArr), 3),
            'media' => round(array_sum($selfArr) / count($selfArr), 3),
            'count' => count($selfArr),
        ] : null,
        'servito' => $servitoArr ? [
            'min'   => round(min($servitoArr), 3),
            'max'   => round(max($servitoArr), 3),
            'media' => round(array_sum($servitoArr) / count($servitoArr), 3),
            'count' => count($servitoArr),
        ] : null,
    ];
}

$cf = cacheFile($centerLat, $centerLng, $radiusKm);
echo json_encode([
    'ok'         => true,
    'aggiornato' => date(
        'Y-m-d H:i',
        file_exists($cf) ? filemtime($cf) : time()
    ),
    'fonte'      => 'MIMIT - Osservatorio Carburanti',
    'totale'     => count($impianti),
    'carburanti' => $FUEL_NAMES,
    'stats'      => $stats,
    'impianti'   => $impianti,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
