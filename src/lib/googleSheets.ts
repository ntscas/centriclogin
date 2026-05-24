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
  const pIndex = header.findIndex(h => h.includes('전화번호')) >= 0 ? header.findIndex(h => h.includes('전화번호')) : 0;
  const passIndex = header.findIndex(h => h.includes('비밀번호')) >= 0 ? header.findIndex(h => h.includes('비밀번호')) : 1;
  const nIndex = header.findIndex(h => h.includes('이름')) >= 0 ? header.findIndex(h => h.includes('이름')) : 2;
  const eIndex = header.findIndex(h => h.includes('이메일')) >= 0 ? header.findIndex(h => h.includes('이메일')) : 3;
  const oIndex = header.findIndex(h => h.includes('기타')) >= 0 ? header.findIndex(h => h.includes('기타')) : 4;
  const rIndex = header.findIndex(h => h.includes('등록')) >= 0 ? header.findIndex(h => h.includes('등록')) : 5;

  return rows
    .filter(row => row[pIndex]) // skip empty records
    .map(row => ({
      phoneNumber: row[pIndex]?.trim() || '',
      password: row[passIndex] || '',
      name: row[nIndex] || '',
      email: row[eIndex] || '',
      otherInfo: row[oIndex] || '',
      registeredDate: row[rIndex] || '',
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

  const pIndex = header.findIndex(h => h.includes('전화번호')) >= 0 ? header.findIndex(h => h.includes('전화번호')) : 0;
  const passIndex = header.findIndex(h => h.includes('비밀번호')) >= 0 ? header.findIndex(h => h.includes('비밀번호')) : 1;
  const nIndex = header.findIndex(h => h.includes('이름')) >= 0 ? header.findIndex(h => h.includes('이름')) : 2;
  const eIndex = header.findIndex(h => h.includes('이메일')) >= 0 ? header.findIndex(h => h.includes('이메일')) : 3;
  const oIndex = header.findIndex(h => h.includes('기타')) >= 0 ? header.findIndex(h => h.includes('기타')) : 4;
  const rIndex = header.findIndex(h => h.includes('등록')) >= 0 ? header.findIndex(h => h.includes('등록')) : 5;

  return rows
    .filter(r => r[pIndex])
    .map(r => ({
      phoneNumber: r[pIndex]?.trim() || '',
      password: r[passIndex] || '',
      name: r[nIndex] || '',
      email: r[eIndex] || '',
      otherInfo: r[oIndex] || '',
      registeredDate: r[rIndex] || '',
    }));
}

/**
 * Fetches spreadsheet rows from a publicly shared spreadsheet link
 */
export async function fetchPublicUserRows(spreadsheetId: string): Promise<UserRow[]> {
  // Try fetching the 'Users' tab first
  const urlWithSheetName = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&sheet=Users`;
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

