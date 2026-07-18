<?php
/**
 * 진리서재 Cafe24 API — 회원 등록·로그인·진도·회원관리
 * URL: /truthlib/api/...  → 이 파일로 rewrite
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
if ($origin !== '' && (
  preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#i', $origin) ||
  preg_match('#^https?://100\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$#', $origin) ||
  preg_match('#^https?://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$#', $origin) ||
  preg_match('#^https?://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$#', $origin)
)) {
  header('Access-Control-Allow-Origin: ' . $origin);
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type, X-VFL-Session, Authorization');
  header('Vary: Origin');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

define('VFL_ROOT', __DIR__);
define('VFL_DB', VFL_ROOT . '/data/truthlib.db');
define('VFL_COOKIE', 'vfl_session');
define('VFL_SESSION_DAYS', 30);
define('VFL_PBKDF2_ITERS', 120000);

$config = [
  'adminPin' => '4464572',
  'adminPinRequired' => true,
];
if (is_file(VFL_ROOT . '/api.config.php')) {
  $loaded = include VFL_ROOT . '/api.config.php';
  if (is_array($loaded)) {
    $config = array_merge($config, $loaded);
  }
}

function vfl_json($status, $payload, $cookies = []) {
  http_response_code($status);
  foreach ($cookies as $c) {
    header('Set-Cookie: ' . $c, false);
  }
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

function vfl_body() {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function vfl_path() {
  $uri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
  $uri = rawurldecode((string)$uri);
  if (preg_match('#/api(/.*)?$#', $uri, $m)) {
    $rest = isset($m[1]) ? $m[1] : '';
    return '/api' . ($rest === '' ? '' : $rest);
  }
  if (!empty($_GET['__path'])) {
    return '/api/' . ltrim((string)$_GET['__path'], '/');
  }
  return '/api';
}

function vfl_db() {
  $dir = dirname(VFL_DB);
  if (!is_dir($dir)) {
    @mkdir($dir, 0755, true);
  }
  $db = new PDO('sqlite:' . VFL_DB);
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->exec("CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'learner',
    status TEXT NOT NULL DEFAULT 'pending',
    goals TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )");
  $db->exec("CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at REAL NOT NULL
  )");
  $db->exec("CREATE TABLE IF NOT EXISTS user_progress (
    user_id INTEGER NOT NULL,
    course_slug TEXT NOT NULL,
    node_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'visited',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, course_slug, node_id)
  )");
  $db->exec("CREATE TABLE IF NOT EXISTS operator_messages (
    user_id INTEGER PRIMARY KEY,
    body TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    read_at TEXT
  )");
  // migrate status/role if old DB
  $cols = [];
  foreach ($db->query("PRAGMA table_info(users)") as $row) {
    $cols[$row['name']] = true;
  }
  if (empty($cols['status'])) {
    $db->exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  }
  if (empty($cols['role'])) {
    $db->exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'learner'");
  }
  return $db;
}

function vfl_now_iso() {
  return date('Y-m-d\\TH:i:sO');
}

function vfl_normalize_phone($raw) {
  $digits = preg_replace('/\\D+/', '', (string)$raw);
  if (strlen($digits) === 11 && strpos($digits, '01') === 0) {
    return substr($digits, 0, 3) . '-' . substr($digits, 3, 4) . '-' . substr($digits, 7);
  }
  if (strlen($digits) === 10 && strpos($digits, '01') === 0) {
    return substr($digits, 0, 3) . '-' . substr($digits, 3, 3) . '-' . substr($digits, 6);
  }
  throw new Exception('올바른 휴대폰 번호를 입력하세요 (예: 010-3193-4530)');
}

function vfl_hash_password($password) {
  $salt = random_bytes(16);
  $digest = hash_pbkdf2('sha256', $password, $salt, VFL_PBKDF2_ITERS, 32, true);
  return 'pbkdf2_sha256$' . bin2hex($salt) . '$' . bin2hex($digest);
}

function vfl_verify_password($password, $stored) {
  $parts = explode('$', (string)$stored, 3);
  if (count($parts) !== 3 || $parts[0] !== 'pbkdf2_sha256') return false;
  $salt = @hex2bin($parts[1]);
  $expect = $parts[2];
  if ($salt === false) return false;
  $digest = hash_pbkdf2('sha256', $password, $salt, VFL_PBKDF2_ITERS, 32, true);
  return hash_equals($expect, bin2hex($digest));
}

function vfl_user_row($row) {
  $phone = $row['email'];
  return [
    'id' => (int)$row['id'],
    'phone' => $phone,
    'email' => $phone,
    'name' => $row['name'],
    'role' => $row['role'] ?: 'learner',
    'status' => $row['status'] ?: 'active',
    'goals' => $row['goals'],
    'createdAt' => $row['created_at'],
  ];
}

function vfl_session_cookie($token, $maxAge = null) {
  if ($maxAge === null) $maxAge = VFL_SESSION_DAYS * 24 * 3600;
  $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
  $parts = [
    VFL_COOKIE . '=' . $token,
    'Path=/truthlib',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' . (int)$maxAge,
  ];
  if ($secure) $parts[] = 'Secure';
  return implode('; ', $parts);
}

function vfl_clear_cookie() {
  $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
  $parts = [VFL_COOKIE . '=; Path=/truthlib; HttpOnly; Max-Age=0; SameSite=Lax'];
  if ($secure) $parts[0] .= '; Secure';
  // Also clear legacy Path=/ cookie if present.
  $parts[] = VFL_COOKIE . '=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax' . ($secure ? '; Secure' : '');
  return $parts;
}

function vfl_token_from_request() {
  if (!empty($_COOKIE[VFL_COOKIE])) return (string)$_COOKIE[VFL_COOKIE];
  $hdr = (string)($_SERVER['HTTP_X_VFL_SESSION'] ?? '');
  if ($hdr !== '') return $hdr;
  $q = (string)($_GET['vfl_token'] ?? '');
  if ($q !== '') return $q;
  $auth = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
  if (preg_match('/^Bearer\s+(.+)$/i', $auth, $m)) return trim($m[1]);
  return null;
}

function vfl_user_from_token(PDO $db, $token) {
  if (!$token) return null;
  $st = $db->prepare("SELECT u.* FROM users u
    JOIN sessions s ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > ?");
  $st->execute([$token, microtime(true)]);
  $row = $st->fetch(PDO::FETCH_ASSOC);
  if (!$row) return null;
  if (($row['status'] ?: 'active') !== 'active') {
    $db->prepare("DELETE FROM sessions WHERE token = ?")->execute([$token]);
    return null;
  }
  return vfl_user_row($row);
}

function vfl_is_localhost() {
  $host = strtolower(explode(':', $_SERVER['HTTP_HOST'] ?? '')[0]);
  return in_array($host, ['localhost', '127.0.0.1'], true);
}

function vfl_pin_ok($pin, $config) {
  if (empty($config['adminPinRequired'])) return true;
  if (vfl_is_localhost()) return true;
  return trim((string)$pin) === trim((string)$config['adminPin']);
}

function vfl_is_operator($user) {
  return $user && ($user['role'] ?? '') === 'operator' && ($user['status'] ?? '') === 'active';
}

function vfl_require_pin_or_operator(PDO $db, $config, $data = [], $pinQuery = '') {
  $pin = trim((string)($pinQuery !== '' ? $pinQuery : ($data['pin'] ?? '')));
  if (vfl_pin_ok($pin, $config)) return [true, null, $pin !== '' || vfl_is_localhost()];
  $user = vfl_user_from_token($db, vfl_token_from_request());
  if (vfl_is_operator($user)) return [true, $user, false];
  return [false, null, false];
}

function vfl_progress_payload(PDO $db, $userId, $slug) {
  $st = $db->prepare("SELECT node_id, status, updated_at FROM user_progress
    WHERE user_id = ? AND course_slug = ? ORDER BY updated_at ASC");
  $st->execute([$userId, $slug]);
  $nodes = [];
  $last = null;
  $visited = 0;
  $completed = 0;
  while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
    $nodes[$row['node_id']] = $row['status'];
    $last = $row['node_id'];
    if (in_array($row['status'], ['visited', 'completed'], true)) $visited++;
    if ($row['status'] === 'completed') $completed++;
  }
  // percent needs mindmap — approximate from completed/visited without total
  $percent = 0;
  $mapPath = VFL_ROOT . '/data/courses/' . $slug . '/mindmap.json';
  if (is_file($mapPath)) {
    $map = json_decode(file_get_contents($mapPath), true);
    $total = 0;
    if (!empty($map['nodes']) && is_array($map['nodes'])) {
      foreach ($map['nodes'] as $n) {
        $id = $n['id'] ?? '';
        if ($id === '' || $id === ($map['rootId'] ?? null)) continue;
        $total++;
      }
    }
    if ($total > 0) $percent = min(100, (int)round($visited * 100 / $total));
  }
  return [
    'percent' => $percent,
    'lastNodeId' => $last,
    'visitedCount' => $visited,
    'completedCount' => $completed,
    'nodes' => $nodes,
  ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$path = vfl_path();
$db = vfl_db();
$data = ($method === 'POST' || $method === 'PATCH') ? vfl_body() : [];

try {
  if ($method === 'GET' && $path === '/api/health') {
    vfl_json(200, ['ok' => true, 'service' => 'truthlib', 'runtime' => 'php']);
  }

  if ($method === 'GET' && $path === '/api/hymn/titles') {
    $titles = null;
    $local = dirname(__DIR__) . '/hymnapp/titles.json';
    if (is_file($local)) {
      $titles = json_decode(file_get_contents($local), true);
    }
    if (!is_array($titles)) {
      $raw = @file_get_contents('https://thegospel.kr/hymnapp/titles.json');
      $titles = $raw ? json_decode($raw, true) : null;
    }
    if (!is_array($titles)) {
      vfl_json(502, ['ok' => false, 'error' => 'hymn titles unavailable']);
    }
    vfl_json(200, ['ok' => true, 'titles' => $titles]);
  }

  if ($method === 'GET' && $path === '/api/auth/me') {
    $user = vfl_user_from_token($db, vfl_token_from_request());
    vfl_json(200, ['ok' => (bool)$user, 'user' => $user]);
  }

  if ($method === 'GET' && $path === '/api/auth/notice') {
    $user = vfl_user_from_token($db, vfl_token_from_request());
    if (!$user) vfl_json(401, ['ok' => false, 'error' => 'login required']);
    $st = $db->prepare("SELECT user_id, body, created_at, read_at FROM operator_messages
      WHERE user_id = ? AND (read_at IS NULL OR read_at = '')");
    $st->execute([$user['id']]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    $notice = null;
    if ($row && trim((string)$row['body']) !== '') {
      $notice = [
        'userId' => (int)$row['user_id'],
        'body' => $row['body'],
        'createdAt' => $row['created_at'],
        'readAt' => $row['read_at'],
      ];
    }
    vfl_json(200, ['ok' => true, 'notice' => $notice]);
  }

  if ($method === 'GET' && $path === '/api/admin/users') {
    $pin = (string)($_GET['pin'] ?? '');
    list($ok, $op, $isMain) = vfl_require_pin_or_operator($db, $config, [], $pin);
    if (!$ok) vfl_json(403, ['ok' => false, 'error' => 'admin or operator required']);
    if ($op && $pin === '') $isMain = false;
    $rows = $db->query("SELECT u.id, u.email, u.name, u.role, u.status, u.goals, u.created_at,
        COUNT(DISTINCT p.course_slug) AS course_count,
        COUNT(p.node_id) AS node_count
      FROM users u
      LEFT JOIN user_progress p ON p.user_id = u.id
      GROUP BY u.id
      ORDER BY CASE u.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, u.id ASC
      LIMIT 200")->fetchAll(PDO::FETCH_ASSOC);
    $users = [];
    foreach ($rows as $row) {
      $users[] = [
        'id' => (int)$row['id'],
        'phone' => $row['email'],
        'email' => $row['email'],
        'name' => $row['name'],
        'role' => $row['role'] ?: 'learner',
        'status' => $row['status'] ?: 'active',
        'goals' => $row['goals'],
        'createdAt' => $row['created_at'],
        'courseCount' => (int)$row['course_count'],
        'nodeCount' => (int)$row['node_count'],
      ];
    }
    vfl_json(200, ['ok' => true, 'users' => $users, 'isMainAdmin' => (bool)$isMain]);
  }

  if ($method === 'GET' && $path === '/api/catalogs') {
    $file = VFL_ROOT . '/data/catalogs.json';
    $index = is_file($file) ? json_decode(file_get_contents($file), true) : ['catalogs' => []];
    vfl_json(200, ['ok' => true, 'catalogs' => $index['catalogs'] ?? []]);
  }

  if ($method === 'GET' && $path === '/api/site-settings') {
    $file = VFL_ROOT . '/data/site-settings.json';
    $settings = ['version' => 1, 'authRequired' => true];
    if (is_file($file)) {
      $raw = json_decode(file_get_contents($file), true);
      if (is_array($raw)) {
        $settings['version'] = isset($raw['version']) ? (int)$raw['version'] : 1;
        $settings['authRequired'] = array_key_exists('authRequired', $raw)
          ? (bool)$raw['authRequired']
          : true;
      }
    }
    vfl_json(200, ['ok' => true, 'settings' => $settings]);
  }

  if ($method === 'GET' && $path === '/api/courses') {
    $catalog = trim((string)($_GET['catalog'] ?? ''));
    $user = vfl_user_from_token($db, vfl_token_from_request());
    $courses = [];
    if ($catalog !== '') {
      $file = VFL_ROOT . '/data/catalogs/' . $catalog . '/courses.json';
      if (!is_file($file)) vfl_json(404, ['ok' => false, 'error' => 'catalog not found']);
      $doc = json_decode(file_get_contents($file), true);
      $courses = $doc['courses'] ?? [];
      foreach ($courses as &$c) {
        $c['catalogSlug'] = $catalog;
      }
      unset($c);
    } else {
      $cats = json_decode(@file_get_contents(VFL_ROOT . '/data/catalogs.json'), true);
      foreach (($cats['catalogs'] ?? []) as $cat) {
        $slug = $cat['slug'] ?? '';
        if ($slug === '') continue;
        $file = VFL_ROOT . '/data/catalogs/' . $slug . '/courses.json';
        if (!is_file($file)) continue;
        $doc = json_decode(file_get_contents($file), true);
        foreach (($doc['courses'] ?? []) as $c) {
          $c['catalogSlug'] = $slug;
          $courses[] = $c;
        }
      }
    }
    $out = [];
    foreach ($courses as $course) {
      $slug = trim((string)($course['slug'] ?? ''));
      if ($slug === '') continue;
      $item = $course;
      if ($user) {
        $item['progress'] = vfl_progress_payload($db, $user['id'], $slug);
      } else {
        $item['progress'] = null;
      }
      $out[] = $item;
    }
    vfl_json(200, ['ok' => true, 'courses' => $out, 'catalog' => $catalog !== '' ? $catalog : null]);
  }

  if ($method === 'GET' && $path === '/api/progress') {
    $user = vfl_user_from_token($db, vfl_token_from_request());
    if (!$user) vfl_json(401, ['ok' => false, 'error' => 'login required']);
    $slug = trim((string)($_GET['course'] ?? ''));
    if ($slug === '') vfl_json(400, ['ok' => false, 'error' => 'invalid course']);
    vfl_json(200, [
      'ok' => true,
      'course' => $slug,
      'progress' => vfl_progress_payload($db, $user['id'], $slug),
    ]);
  }

  if ($method === 'POST' && $path === '/api/admin/verify') {
    $pin = trim((string)($data['pin'] ?? ''));
    if (empty($config['adminPinRequired'])) {
      vfl_json(200, ['ok' => true]);
    }
    vfl_json(200, ['ok' => $pin === trim((string)$config['adminPin'])]);
  }

  if ($method === 'POST' && $path === '/api/auth/register') {
    $phone = vfl_normalize_phone($data['phone'] ?? $data['email'] ?? '');
    $password = (string)($data['password'] ?? '');
    $name = trim((string)($data['name'] ?? ''));
    if (strlen($password) < 6) throw new Exception('비밀번호는 6자 이상이어야 합니다');
    $hash = vfl_hash_password($password);
    $now = vfl_now_iso();
    try {
      $st = $db->prepare("INSERT INTO users (email, password_hash, name, role, status, created_at)
        VALUES (?, ?, ?, 'learner', 'pending', ?)");
      $st->execute([$phone, $hash, $name, $now]);
    } catch (PDOException $e) {
      throw new Exception('이미 등록된 휴대폰 번호입니다');
    }
    $id = (int)$db->lastInsertId();
    $st = $db->prepare("SELECT * FROM users WHERE id = ?");
    $st->execute([$id]);
    $user = vfl_user_row($st->fetch(PDO::FETCH_ASSOC));
    vfl_json(200, [
      'ok' => true,
      'user' => $user,
      'pending' => true,
      'message' => '등록되었습니다. 운영자 승인 후 로그인할 수 있습니다.',
    ]);
  }

  if ($method === 'POST' && $path === '/api/auth/login') {
    $phone = vfl_normalize_phone($data['phone'] ?? $data['email'] ?? '');
    $password = (string)($data['password'] ?? '');
    $st = $db->prepare("SELECT * FROM users WHERE email = ?");
    $st->execute([$phone]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if (!$row || !vfl_verify_password($password, $row['password_hash'])) {
      vfl_json(401, ['ok' => false, 'error' => '휴대폰 번호 또는 비밀번호가 올바르지 않습니다']);
    }
    $status = $row['status'] ?: 'active';
    if ($status === 'pending') {
      vfl_json(401, ['ok' => false, 'error' => '승인 대기 중입니다. 운영자 승인 후 로그인할 수 있습니다']);
    }
    if ($status === 'disabled') {
      vfl_json(401, ['ok' => false, 'error' => '이용이 제한된 계정입니다']);
    }
    if ($status !== 'active') {
      vfl_json(401, ['ok' => false, 'error' => '로그인할 수 없는 계정입니다']);
    }
    $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    $expires = microtime(true) + VFL_SESSION_DAYS * 24 * 3600;
    $db->prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
      ->execute([$token, $row['id'], $expires]);
    $db->prepare("DELETE FROM sessions WHERE expires_at < ?")->execute([microtime(true)]);
    vfl_json(200, ['ok' => true, 'user' => vfl_user_row($row), 'token' => $token], [vfl_session_cookie($token)]);
  }

  if ($method === 'POST' && $path === '/api/auth/logout') {
    $token = vfl_token_from_request();
    if ($token) {
      $db->prepare("DELETE FROM sessions WHERE token = ?")->execute([$token]);
    }
    vfl_json(200, ['ok' => true], vfl_clear_cookie());
  }

  if ($method === 'POST' && $path === '/api/auth/goals') {
    $user = vfl_user_from_token($db, vfl_token_from_request());
    if (!$user) vfl_json(401, ['ok' => false, 'error' => 'login required']);
    $goals = trim((string)($data['goals'] ?? ''));
    $db->prepare("UPDATE users SET goals = ? WHERE id = ?")->execute([$goals, $user['id']]);
    $st = $db->prepare("SELECT * FROM users WHERE id = ?");
    $st->execute([$user['id']]);
    vfl_json(200, ['ok' => true, 'user' => vfl_user_row($st->fetch(PDO::FETCH_ASSOC))]);
  }

  if ($method === 'POST' && $path === '/api/auth/notice/read') {
    $user = vfl_user_from_token($db, vfl_token_from_request());
    if (!$user) vfl_json(401, ['ok' => false, 'error' => 'login required']);
    $db->prepare("UPDATE operator_messages SET read_at = ? WHERE user_id = ? AND (read_at IS NULL OR read_at = '')")
      ->execute([vfl_now_iso(), $user['id']]);
    vfl_json(200, ['ok' => true]);
  }

  if ($method === 'POST' && $path === '/api/admin/users/approve') {
    list($ok) = vfl_require_pin_or_operator($db, $config, $data);
    if (!$ok) vfl_json(403, ['ok' => false, 'error' => 'admin or operator required']);
    $uid = (int)($data['userId'] ?? $data['id'] ?? 0);
    $db->prepare("UPDATE users SET status = 'active' WHERE id = ?")->execute([$uid]);
    $st = $db->prepare("SELECT * FROM users WHERE id = ?");
    $st->execute([$uid]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if (!$row) throw new Exception('회원을 찾을 수 없습니다');
    vfl_json(200, ['ok' => true, 'user' => vfl_user_row($row)]);
  }

  if ($method === 'POST' && $path === '/api/admin/users/disable') {
    list($ok) = vfl_require_pin_or_operator($db, $config, $data);
    if (!$ok) vfl_json(403, ['ok' => false, 'error' => 'admin or operator required']);
    $uid = (int)($data['userId'] ?? $data['id'] ?? 0);
    $db->prepare("UPDATE users SET status = 'disabled' WHERE id = ?")->execute([$uid]);
    $db->prepare("DELETE FROM sessions WHERE user_id = ?")->execute([$uid]);
    $st = $db->prepare("SELECT * FROM users WHERE id = ?");
    $st->execute([$uid]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if (!$row) throw new Exception('회원을 찾을 수 없습니다');
    vfl_json(200, ['ok' => true, 'user' => vfl_user_row($row)]);
  }

  if ($method === 'POST' && $path === '/api/admin/users/set-role') {
    if (!vfl_pin_ok($data['pin'] ?? '', $config)) {
      vfl_json(403, ['ok' => false, 'error' => 'main admin pin required']);
    }
    $uid = (int)($data['userId'] ?? $data['id'] ?? 0);
    $role = trim((string)($data['role'] ?? ''));
    if (!in_array($role, ['learner', 'operator'], true)) {
      throw new Exception('role must be learner or operator');
    }
    $st = $db->prepare("SELECT * FROM users WHERE id = ?");
    $st->execute([$uid]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if (!$row) throw new Exception('회원을 찾을 수 없습니다');
    if ($role === 'operator' && ($row['status'] ?: 'active') !== 'active') {
      throw new Exception('활성 회원만 운영자로 임명할 수 있습니다');
    }
    $db->prepare("UPDATE users SET role = ? WHERE id = ?")->execute([$role, $uid]);
    $st->execute([$uid]);
    vfl_json(200, ['ok' => true, 'user' => vfl_user_row($st->fetch(PDO::FETCH_ASSOC))]);
  }

  if ($method === 'POST' && $path === '/api/admin/users/message') {
    list($ok) = vfl_require_pin_or_operator($db, $config, $data);
    if (!$ok) vfl_json(403, ['ok' => false, 'error' => 'admin or operator required']);
    $uid = (int)($data['userId'] ?? $data['id'] ?? 0);
    $body = trim((string)($data['body'] ?? $data['message'] ?? ''));
    if ($body === '') throw new Exception('안내 내용을 입력하세요');
    $st = $db->prepare("SELECT id FROM users WHERE id = ?");
    $st->execute([$uid]);
    if (!$st->fetch()) throw new Exception('회원을 찾을 수 없습니다');
    $now = vfl_now_iso();
    $db->prepare("INSERT INTO operator_messages (user_id, body, created_at, read_at)
      VALUES (?, ?, ?, NULL)
      ON CONFLICT(user_id) DO UPDATE SET body = excluded.body, created_at = excluded.created_at, read_at = NULL")
      ->execute([$uid, $body, $now]);
    vfl_json(200, ['ok' => true, 'message' => [
      'userId' => $uid, 'body' => $body, 'createdAt' => $now, 'readAt' => null,
    ]]);
  }

  if ($method === 'POST' && $path === '/api/admin/users/update-name') {
    list($ok) = vfl_require_pin_or_operator($db, $config, $data);
    if (!$ok) vfl_json(403, ['ok' => false, 'error' => 'admin or operator required']);
    $uid = (int)($data['userId'] ?? $data['id'] ?? 0);
    $name = trim((string)($data['name'] ?? ''));
    if ($name === '') throw new Exception('이름을 입력하세요');
    if (mb_strlen($name, 'UTF-8') > 40) throw new Exception('이름은 40자 이하여야 합니다');
    $st = $db->prepare("SELECT * FROM users WHERE id = ?");
    $st->execute([$uid]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if (!$row) throw new Exception('회원을 찾을 수 없습니다');
    $db->prepare("UPDATE users SET name = ? WHERE id = ?")->execute([$name, $uid]);
    $st->execute([$uid]);
    vfl_json(200, ['ok' => true, 'user' => vfl_user_row($st->fetch(PDO::FETCH_ASSOC))]);
  }

  if ($method === 'POST' && $path === '/api/progress') {
    $user = vfl_user_from_token($db, vfl_token_from_request());
    if (!$user) vfl_json(401, ['ok' => false, 'error' => 'login required']);
    $slug = trim((string)($data['course'] ?? $data['courseSlug'] ?? ''));
    $nodeId = trim((string)($data['nodeId'] ?? ''));
    $status = trim((string)($data['status'] ?? 'visited'));
    if ($slug === '' || $nodeId === '') vfl_json(400, ['ok' => false, 'error' => 'course and nodeId required']);
    if (!in_array($status, ['visited', 'completed'], true)) $status = 'visited';
    $db->prepare("INSERT INTO user_progress (user_id, course_slug, node_id, status, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, course_slug, node_id) DO UPDATE SET
        status = excluded.status, updated_at = excluded.updated_at")
      ->execute([$user['id'], $slug, $nodeId, $status, vfl_now_iso()]);
    vfl_json(200, [
      'ok' => true,
      'course' => $slug,
      'progress' => vfl_progress_payload($db, $user['id'], $slug),
    ]);
  }

  // Catalog/course/mindmap/AI/site-settings editing stays on local Python — return clear error on hosting.
  if (preg_match('#^/api/(catalogs|courses|mindmap|ai/ask|course-image|site-settings)$#', $path) && in_array($method, ['POST', 'PATCH'], true)) {
    vfl_json(501, [
      'ok' => false,
      'error' => '콘텐츠 편집은 집 PC 서버(serve.bat)에서만 가능합니다',
    ]);
  }

  vfl_json(404, ['ok' => false, 'error' => 'not found', 'path' => $path]);
} catch (Exception $e) {
  $code = 400;
  vfl_json($code, ['ok' => false, 'error' => $e->getMessage()]);
}
