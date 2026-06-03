export interface UserRow {
  phoneNumber: string;
  password?: string;
  name: string;
  email: string;
  otherInfo: string;
  registeredDate: string;
}

export function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : url.trim();
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
 * Fetches all user rows from the connected spreadsheet
 */
export async function fetchUserRows(token: string, spreadsheetId: string): Promise<UserRow[]> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A1:Z1000`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch spreadsheet data: ${errorText}. Please verify the spreadsheet ID and make sure a tab named 'Users' exists.`);
  }

  const data = await response.json();
  const values: string[][] = data.values || [];

  if (values.length === 0) {
    return [];
  }

  // Parse headers to match columns dynamically or assume standard order:
  // Col 0: 전화번호 (phoneNumber)
  // Col 1: 비밀번호 (password)
  // Col 2: 이름 (name)
  // Col 3: 이메일 (email)
  // Col 4: 기타 정보 (otherInfo)
  // Col 5: 등록일 (registeredDate)
  const header = values[0];
  const rows = values.slice(1);

  // Maps columns based on header strings or use default indices as fallback
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

  return rows
    .filter(row => row[finalPIndex]) // skip empty records
    .map(row => ({
      phoneNumber: row[finalPIndex] ? String(row[finalPIndex]).trim() : '',
      password: row[finalPassIndex] ? String(row[finalPassIndex]).trim() : '',
      name: row[finalNIndex] ? String(row[finalNIndex]).trim() : '',
      email: row[finalEIndex] ? String(row[finalEIndex]).trim() : '',
      otherInfo: row[finalOIndex] ? String(row[finalOIndex]).trim() : '',
      registeredDate: row[finalRIndex] ? String(row[finalRIndex]).trim() : '',
    }));
}

/**
 * Appends a single user row to Google Sheets
 */
export async function appendUserRow(token: string, spreadsheetId: string, user: UserRow): Promise<void> {
  const rowData = [
    user.phoneNumber,
    user.password || '0000',
    user.name,
    user.email,
    user.otherInfo,
    user.registeredDate || new Date().toISOString().split('T')[0]
  ];

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A1:append?valueInputOption=USER_ENTERED`,
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
    throw new Error(`Failed to append user row: ${errorText}`);
  }
}

/**
 * Re-writes entire user records list to Users sheet, clean and neat.
 */
export async function overwriteUsers(token: string, spreadsheetId: string, users: UserRow[]): Promise<void> {
  // 1. Clear existing list starting from row 2
  const clearResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A2:Z1000:clear`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!clearResponse.ok) {
    const errorText = await clearResponse.text();
    throw new Error(`Failed to clear sheet before overwriting: ${errorText}`);
  }

  if (users.length === 0) return;

  // 2. Format row values
  const values = users.map(user => [
    user.phoneNumber,
    user.password || '0000',
    user.name,
    user.email,
    user.otherInfo,
    user.registeredDate
  ]);

  // 3. Write new values
  const writeResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Users!A2?valueInputOption=USER_ENTERED`,
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
    throw new Error(`Failed to update users sheet: ${errorText}`);
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

  return rows
    .filter(r => r[finalPIndex])
    .map(r => ({
      phoneNumber: r[finalPIndex] ? String(r[finalPIndex]).trim() : '',
      password: r[finalPassIndex] ? String(r[finalPassIndex]).trim() : '',
      name: r[finalNIndex] ? String(r[finalNIndex]).trim() : '',
      email: r[finalEIndex] ? String(r[finalEIndex]).trim() : '',
      otherInfo: r[finalOIndex] ? String(r[finalOIndex]).trim() : '',
      registeredDate: r[finalRIndex] ? String(r[finalRIndex]).trim() : '',
    }));
}

/**
 * Fetches spreadsheet rows from a publicly shared spreadsheet link
 */
export async function fetchPublicUserRows(spreadsheetId: string): Promise<UserRow[]> {
  // Use Google Visualization API to request the specific 'Users' sheet in CSV format
  const urlWithSheetName = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=Users`;
  let response = await fetch(urlWithSheetName);
  
  if (!response.ok) {
    // Fallback: download the first active sheet/tab (does not filter by tab name)
    const urlDefault = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    response = await fetch(urlDefault);
  }

  if (!response.ok) {
    throw new Error('전화번호/비밀번호 데이터베이스를 구글 시트에서 가져오는 데 실패했습니다. 시트 공유 설정이 "링크가 있는 모든 사용자 보기(뷰어)"로 구성되어 있는지 확인해 주세요.');
  }
  const text = await response.text();
  return parseCSV(text);
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
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/FreeBoard!A1:F1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [['ID', '제목', '내용', '작성자 이름', '작성자 연락처', '등록일']],
        }),
      }
    );

    if (!headerResponse.ok) {
      const errorText = await headerResponse.text();
      throw new Error(`Failed to initialize 'FreeBoard' headers: ${errorText}`);
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
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tabName}!A1:append?valueInputOption=USER_ENTERED`,
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
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tabName}!A2:Z1000:clear`,
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
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tabName}!A2?valueInputOption=USER_ENTERED`,
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

  const id = idIdx >= 0 && row[idIdx] ? String(row[idIdx]).trim() : `post_${Date.now()}_${rowIndex}`;
  const title = titleIdx < row.length ? String(row[titleIdx] || '').trim() : '';
  const content = contentIdx < row.length ? String(row[contentIdx] || '').trim() : '';
  const writerName = nameIdx < row.length ? String(row[nameIdx] || '').trim() : '익명회원';
  const writerPhone = phoneIdx < row.length ? String(row[phoneIdx] || '').trim() : '';
  const registeredDate = dateIdx < row.length ? String(row[dateIdx] || '').trim() : '';

  return { id, title, content, writerName, writerPhone, registeredDate };
}

/**
 * Fetches board posts via authorized API
 */
export async function fetchBoardPosts(token: string, spreadsheetId: string): Promise<BoardPost[]> {
  const tabName = await detectBoardTabName(token, spreadsheetId);
  await ensureBoardSheet(token, spreadsheetId);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tabName}!A1:Z1000`,
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


