export interface UserRow {
  phoneNumber: string;
  password?: string;
  name: string;
  email: string;
  otherInfo: string;
  registeredDate: string;
  ncentric?: string;
  ai?: string;
  taxtalk?: string;
}

export function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : url.trim();
}

// =============================================================
// Supabase 사용자 DB 연동 (구글시트 Users 탭을 대체, 2026-11-07)
// 계정 데이터: centric_users 테이블 (phone/password/name/email/role/regdate
//             /ai/ncentric/taxtalk/company/note)
// =============================================================
export const SUPABASE_URL = 'https://agwcumknhangcyhusfsn.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_FCIW6wEhq4EjutDW2rPIIA_IaGLAMkK';

const sbHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Accept': 'application/json',
};

interface SupabaseAccountRow {
  phone: string;
  password: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;      // 기타 정보(세무사/회계사/관리자 등)
  regdate?: string | null;   // 등록일
  ai?: boolean;
  ncentric?: boolean;
  taxtalk?: boolean;
  company?: string | null;
  note?: string | null;
}

/** Supabase 계정 행 → 사이트 UserRow 구조 (ai 등은 'TRUE'/'FALSE' 문자열) */
export function toUserRow(sb: SupabaseAccountRow): UserRow {
  return {
    phoneNumber: (sb.phone || '').trim(),
    password: (sb.password || '').trim(),
    name: (sb.name || '').trim(),
    email: (sb.email || '').trim(),
    otherInfo: (sb.role || '').trim(),
    registeredDate: sb.regdate ? String(sb.regdate).slice(0, 10) : '',
    ai: sb.ai ? 'TRUE' : 'FALSE',
    ncentric: sb.ncentric ? 'TRUE' : 'FALSE',
    taxtalk: sb.taxtalk ? 'TRUE' : 'FALSE',
  };
}

/** UserRow → Supabase 행 */
function toSupabaseRow(u: UserRow): SupabaseAccountRow {
  return {
    phone: (u.phoneNumber || '').trim(),
    password: (u.password || '0000').trim(),
    name: u.name || null,
    email: u.email || null,
    role: u.otherInfo || null,
    regdate: (u.registeredDate && u.registeredDate.slice(0, 10)) || null,
    ai: (u.ai || '').toUpperCase() !== 'FALSE',
    ncentric: (u.ncentric || '').toUpperCase() === 'TRUE',
    taxtalk: (u.taxtalk || '').toUpperCase() === 'TRUE',
  };
}

/** Supabase centric_users 전체 조회 */
export async function fetchSupabaseUsers(): Promise<UserRow[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/centric_users?select=*&limit=1000`, {
    headers: sbHeaders,
  });
  if (!res.ok) {
    throw new Error(`Supabase 사용자 DB 조회 실패 (${res.status})`);
  }
  const rows: SupabaseAccountRow[] = await res.json();
  return (rows || []).filter(r => r.phone).map(toUserRow);
}

/** Supabase centric_users에 계정 추가 */
export async function appendSupabaseUser(user: UserRow): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/centric_users`, {
    method: 'POST',
    headers: { ...sbHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(toSupabaseRow(user)),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase 사용자 등록 실패: ${t}`);
  }
}

/** Supabase에서 계정 삭제 */
export async function deleteSupabaseUser(phoneNumber: string): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/centric_users?phone=eq.${encodeURIComponent(phoneNumber)}`,
    { method: 'DELETE', headers: { ...sbHeaders, 'Content-Type': 'application/json' } }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase 사용자 삭제 실패: ${t}`);
  }
}

/**
 * Creates a new spreadsheet in the user's Google Drive with a 'Users' sheet
 */
export async function createDatabaseSpreadsheet(token: string, title: string = 'Google Sheets Login DB'): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: title,
      },
      sheets: [
        {
          properties: {
            title: 'Users',
            gridProperties: {
              rowCount: 1000,
              columnCount: 10,
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create spreadsheet: ${errorText}`);
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Initialize Headers
  await initializeHeaders(token, spreadsheetId);

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Writes the standard headers to the Users sheet
 */
export async function initializeHeaders(token: string, spreadsheetId: string): Promise<void> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A1:F1?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [['전화번호', '비밀번호', '이름', '이메일', '기타 정보', '등록일']],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to initialize headers: ${errorText}`);
  }
}

/**
 * Fetches all user rows (Supabase centric_users — 구글시트 대체, 시그니처 유지)
 */
export async function fetchUserRows(token: string, spreadsheetId: string): Promise<UserRow[]> {
  return fetchSupabaseUsers();
}

/**
 * Appends a single user row to Supabase centric_users
 */
export async function appendUserRow(token: string, spreadsheetId: string, user: UserRow): Promise<void> {
  await appendSupabaseUser(user);
}

/**
 * Re-writes entire user records list into Supabase centric_users (전체 재기록)
 */
export async function overwriteUsers(token: string, spreadsheetId: string, users: UserRow[]): Promise<void> {
  // 1. 기존 계정 전체 삭제 (phone에 '~'가 없으므로 전 행 매칭)
  const clearResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/centric_users?phone=neq.~`,
    {
      method: 'DELETE',
      headers: { ...sbHeaders, 'Content-Type': 'application/json' },
    }
  );

  if (!clearResponse.ok) {
    const errorText = await clearResponse.text();
    throw new Error(`Supabase 전체 삭제 실패: ${errorText}`);
  }

  if (users.length === 0) return;

  // 2. 청크 단위(200건) 재기록
  for (let i = 0; i < users.length; i += 200) {
    const chunk = users.slice(i, i + 200).map(toSupabaseRow);
    const writeResponse = await fetch(`${SUPABASE_URL}/rest/v1/centric_users`, {
      method: 'POST',
      headers: { ...sbHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (!writeResponse.ok) {
      const errorText = await writeResponse.text();
      throw new Error(`Supabase 재기록 실패: ${errorText}`);
    }
  }
}

/**
 * Robust CSV parser for Google Sheets public export
 */
function parseCSV(text: string): UserRow[] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal);
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentVal);
      lines.push(row);
      row = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  if (currentVal || row.length > 0) {
    row.push(currentVal);
    lines.push(row);
  }

  if (lines.length === 0) return [];
  const header = lines[0];
  const rows = lines.slice(1);

  const pIndex = header.findIndex(h => {
    const s = h.toLowerCase().replace(/\s/g, '');
    return s.includes('전화번호') || s.includes('phone') || s.includes('연락처') || s.includes('tel') || s.includes('mobile') || s.includes('contact');
  });
  const finalPIndex = pIndex >= 0 ? pIndex : 0;

  const passIndex = header.findIndex(h => {
    const s = h.toLowerCase().replace(/\s/g, '');
    return s.includes('비밀번호') || s.includes('password') || s.includes('pw') || s.includes('pass') || s.includes('비번');
  });
  const finalPassIndex = passIndex >= 0 ? passIndex : 1;

  const nIndex = header.findIndex(h => {
    const s = h.toLowerCase().replace(/\s/g, '');
    return s.includes('이름') || s.includes('name') || s.includes('성명') || s.includes('고객') || s.includes('회원');
  });
  const finalNIndex = nIndex >= 0 ? nIndex : 2;

  const eIndex = header.findIndex(h => {
    const s = h.toLowerCase().replace(/\s/g, '');
    return s.includes('이메일') || s.includes('email') || s.includes('mail');
  });
  const finalEIndex = eIndex >= 0 ? eIndex : 3;

  const oIndex = header.findIndex(h => {
    const s = h.toLowerCase().replace(/\s/g, '');
    return s.includes('기타') || s.includes('info') || s.includes('note') || s.includes('소속') || s.includes('설명') || s.includes('메모') || s.includes('직급');
  });
  const finalOIndex = oIndex >= 0 ? oIndex : 4;

  const rIndex = header.findIndex(h => {
    const s = h.toLowerCase().replace(/\s/g, '');
    return s.includes('등록') || s.includes('date') || s.includes('가입') || s.includes('시간') || s.includes('일자');
  });
  const finalRIndex = rIndex >= 0 ? rIndex : 5;

  const ncentIndex = header.findIndex(h => {
    const s = h.toLowerCase().replace(/\s/g, '');
    return s.includes('ncentric');
  });

  const aiIndex = header.findIndex(h => {
    const s = h.toLowerCase().replace(/\s/g, '');
    return s === 'ai' || s.includes('centricai');
  });

  const taxtalkIndex = header.findIndex(h => {
    const s = h.toLowerCase().replace(/\s/g, '');
    return s.includes('taxtalk') || s.includes('게시판');
  });

  return rows
    .filter(r => r[finalPIndex])
    .map(r => ({
      phoneNumber: r[finalPIndex] ? String(r[finalPIndex]).trim() : '',
      password: r[finalPassIndex] ? String(r[finalPassIndex]).trim() : '',
      name: r[finalNIndex] ? String(r[finalNIndex]).trim() : '',
      email: r[finalEIndex] ? String(r[finalEIndex]).trim() : '',
      otherInfo: r[finalOIndex] ? String(r[finalOIndex]).trim() : '',
      registeredDate: r[finalRIndex] ? String(r[finalRIndex]).trim() : '',
      ncentric: ncentIndex >= 0 && r[ncentIndex] ? String(r[ncentIndex]).trim() : '',
      ai: aiIndex >= 0 && r[aiIndex] ? String(r[aiIndex]).trim() : '',
      taxtalk: taxtalkIndex >= 0 && r[taxtalkIndex] ? String(r[taxtalkIndex]).trim() : '',
    }));
}

/**
 * Fetches spreadsheet rows from a publicly shared spreadsheet link
 */
export async function fetchPublicUserRows(spreadsheetId: string): Promise<UserRow[]> {
  // 구글시트 공개 CSV 대신 Supabase centric_users에서 조회 (시그니처 유지)
  return fetchSupabaseUsers();
}


export interface BoardPost {
  id: string;
  title: string;
  content: string;
  writerName: string;
  writerPhone: string;
  registeredDate: string;
}

/**
 * Helper to dynamically detect the existing board tab name (FreeBoard, FreeBoar, 자유게시판, 게시판) in the spreadsheet.
 * Defaults to 'FreeBoard' if neither exists.
 */
export async function detectBoardTabName(token: string, spreadsheetId: string): Promise<string> {
  try {
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const response = await fetch(getUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });
    if (response.ok) {
      const data = await response.json();
      const sheets: any[] = data.sheets || [];
      const foundSheet = sheets.find(s => {
        const t = String(s.properties?.title || '').trim().toLowerCase();
        return t === 'freeboard' || t === 'freeboar' || t === '자유게시판' || t === '게시판' || s.properties?.sheetId === 926715937;
      });
      if (foundSheet) {
        return foundSheet.properties.title;
      }
    }
  } catch (e) {
    console.warn('Failed to dynamically detect board tab name, using FreeBoard default:', e);
  }
  return 'FreeBoard';
}

/**
 * Checks if 'FreeBoard' or another valid board tab exists, and if not, creates 'FreeBoard' with proper headers.
 */
export async function ensureBoardSheet(token: string, spreadsheetId: string): Promise<void> {
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const response = await fetch(getUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch spreadsheet info to ensure FreeBoard: ${errorText}`);
  }

  const data = await response.json();
  const sheets: any[] = data.sheets || [];
  
  // Accept board sheets with standard names or gid 926715937
  const boardSheetExists = sheets.some(s => {
    const t = String(s.properties?.title || '').trim().toLowerCase();
    return t === 'freeboard' || t === 'freeboar' || t === '자유게시판' || t === '게시판' || s.properties?.sheetId === 926715937;
  });

  if (!boardSheetExists) {
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const updateResponse = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: 'FreeBoard',
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 10,
                },
              },
            },
          },
        ],
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to create 'FreeBoard' tab: ${errorText}`);
    }

    const headerResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/FreeBoard!A1:F1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [['id', 'title', 'content', 'writerName', 'writerPhone', 'registeredDate']],
        }),
      }
    );

    if (!headerResponse.ok) {
      const errorText = await headerResponse.text();
      throw new Error(`Failed to initialize 'FreeBoard' headers: ${errorText}`);
    }
  } else {
    // If the sheet already exists, let's verify if headers are written, and initialize them if they are missing
    const tabName = await detectBoardTabName(token, spreadsheetId);
    const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:F1`;
    const checkResponse = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      const rows = checkData.values || [];
      if (rows.length === 0 || !rows[0] || rows[0].length === 0 || !String(rows[0][0]).trim()) {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:F1?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              values: [['id', 'title', 'content', 'writerName', 'writerPhone', 'registeredDate']],
            }),
          }
        );
      }
    }
  }
}

/**
 * Appends a board post
 */
export async function appendBoardPost(token: string, spreadsheetId: string, post: BoardPost): Promise<void> {
  const tabName = await detectBoardTabName(token, spreadsheetId);
  await ensureBoardSheet(token, spreadsheetId);

  const rowData = [
    post.id,
    post.title,
    post.content,
    post.writerName,
    post.writerPhone,
    post.registeredDate
  ];

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowData],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to append board post: ${errorText}`);
  }
}

/**
 * Re-writes entire board records list to Board sheet, clean and neat.
 */
export async function overwriteBoardPosts(token: string, spreadsheetId: string, posts: BoardPost[]): Promise<void> {
  const tabName = await detectBoardTabName(token, spreadsheetId);
  await ensureBoardSheet(token, spreadsheetId);

  // 1. Clear existing list starting from row 2
  const clearResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A2:Z:clear`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!clearResponse.ok) {
    const errorText = await clearResponse.text();
    throw new Error(`Failed to clear board sheet before overwriting: ${errorText}`);
  }

  if (posts.length === 0) return;

  // 2. Format row values
  const values = posts.map(post => [
    post.id,
    post.title,
    post.content,
    post.writerName,
    post.writerPhone,
    post.registeredDate
  ]);

  // 3. Write new values
  const writeResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A2?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!writeResponse.ok) {
    const errorText = await writeResponse.text();
    throw new Error(`Failed to update board sheet: ${errorText}`);
  }
}

/**
 * Universal helper to parse a raw string row into a typed BoardPost based on header index mappings
 */
function parseRowToBoardPost(row: string[], headers: string[], rowIndex: number): BoardPost {
  const findIndex = (keys: string[], defaultIdx: number) => {
    const idx = headers.findIndex(h => {
      const s = String(h || '').toLowerCase().replace(/\s/g, '');
      return keys.some(key => s.includes(key));
    });
    return idx >= 0 ? idx : defaultIdx;
  };

  const idIdx = headers.findIndex(h => {
    const s = String(h || '').toLowerCase().replace(/\s/g, '');
    return s === 'id' || s === '번호' || s === '순번' || s === 'no';
  });

  const titleIdx = findIndex(['제목', 'title', 'subject'], 0);
  const contentIdx = findIndex(['내용', 'contents', 'content', 'body', 'memo'], 1);
  const nameIdx = findIndex(['작성자', '이름', 'writer', 'author', 'name', 'poster'], 2);
  const phoneIdx = findIndex(['연락처', '전화번호', 'phone', 'tel', 'contact', 'etc'], 3);
  const dateIdx = findIndex(['등록일', '날짜', 'date', 'registered', 'time', '일자'], 4);

  const title = titleIdx < row.length ? String(row[titleIdx] || '').trim() : '';
  const content = contentIdx < row.length ? String(row[contentIdx] || '').trim() : '';
  const writerName = nameIdx < row.length ? String(row[nameIdx] || '').trim() : '익명회원';
  const writerPhone = phoneIdx < row.length ? String(row[phoneIdx] || '').trim() : '';
  const registeredDate = dateIdx < row.length ? String(row[dateIdx] || '').trim() : '';

  let id = idIdx >= 0 && row[idIdx] ? String(row[idIdx]).trim() : '';
  if (!id || id.toLowerCase() === 'id') {
    // Generate a stable, deterministic ID based on row content to prevent duplicate creation on load
    const fingerprint = `${title}_${content}_${writerName}_${writerPhone}_${registeredDate}`;
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      hash = ((hash << 5) - hash) + fingerprint.charCodeAt(i);
      hash |= 0;
    }
    id = `post_stable_${Math.abs(hash)}`;
  }

  return { id, title, content, writerName, writerPhone, registeredDate };
}

/**
 * Fetches board posts via authorized API
 */
export async function fetchBoardPosts(token: string, spreadsheetId: string): Promise<BoardPost[]> {
  const tabName = await detectBoardTabName(token, spreadsheetId);
  await ensureBoardSheet(token, spreadsheetId);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:Z`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch board posts: ${errorText}`);
  }

  const data = await response.json();
  const values: string[][] = data.values || [];

  if (values.length <= 1) {
    return [];
  }

  const headers = values[0].map(h => String(h || '').trim());
  const rows = values.slice(1);

  return rows
    .filter(row => row.some(cell => String(cell || '').trim() !== '')) // skip completely empty rows
    .map((row, idx) => parseRowToBoardPost(row, headers, idx));
}

/**
 * Parses CSV for public board posts export
 */
function parseBoardCSV(text: string): BoardPost[] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal);
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentVal);
      lines.push(row);
      row = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  if (currentVal || row.length > 0) {
    row.push(currentVal);
    lines.push(row);
  }

  if (lines.length <= 1) return [];

  // Verify headers to make sure Google Sheets did not fallback to the Users/Logins sheet
  const headers = lines[0].map(h => String(h || '').trim());
  
  // A signature of the Users DB is headers containing '전화번호', '비밀번호', or '기타 정보'
  const headersStr = headers.map(h => h.toLowerCase().replace(/\s/g, '')).join(',');
  const isUserFallback = headersStr.includes('전화번호') || headersStr.includes('비밀번호') || headersStr.includes('기타정보') || headersStr.includes('phonenumber');
  
  if (isUserFallback) {
    console.warn('Google Sheets public export silently fell back to the main (Users) sheet because FreeBoard sheet does not exist yet.');
    return [];
  }

  const rows = lines.slice(1);

  return rows
    .filter(r => r.some(cell => String(cell || '').trim() !== '')) // skip completely empty rows
    .map((r, idx) => parseRowToBoardPost(r, headers, idx));
}

/**
 * Fetches board posts publicly via shared link (for non-admin viewer clients)
 * Robustly tries known public configurations and explicit overrides.
 */
export async function fetchPublicBoardPosts(spreadsheetId: string): Promise<BoardPost[]> {
  const targets = [
    { type: 'gid', val: '926715937' },                       // Explicit GID tab from user's active board
    { type: 'sheet', val: 'FreeBoard' },
    { type: 'sheet', val: 'FreeBoar' },
    { type: 'sheet', val: '자유게시판' },
    { type: 'sheet', val: '게시판' }
  ];

  for (const t of targets) {
    try {
      const paramName = t.type === 'gid' ? 'gid' : 'sheet';
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&${paramName}=${encodeURIComponent(t.val)}`;
      const response = await fetch(url);
      if (response.ok) {
        const text = await response.text();
        const posts = parseBoardCSV(text);
        if (posts && posts.length > 0) {
          console.log(`Successfully fetched ${posts.length} board posts using ${t.type}='${t.val}'`);
          return posts;
        }
      }
    } catch (e) {
      console.warn(`Direct board fetch fallback for target ${t.type}=${t.val} skipped:`, e);
    }
  }

  // Final fallback: try default export (usually first visible tab)
  try {
    const defaultUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    const response = await fetch(defaultUrl);
    if (response.ok) {
      const text = await response.text();
      const posts = parseBoardCSV(text);
      if (posts && posts.length > 0) {
        return posts;
      }
    }
  } catch (e) {
    console.warn('Default sheet csv export fallback failed:', e);
  }

  throw new Error('게시판 시트 데이터를 가져오는 데 실패했습니다. 구글 시트 공유 설정에서 "링크가 있는 모든 사용자에게 공개"되어 있는지 확인해주세요.');
}


