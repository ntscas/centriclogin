import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, Users, Settings, Database, RefreshCw, LogOut, 
  FileSpreadsheet, Sparkles, AlertTriangle, CheckCircle2, Phone, Home, ShieldCheck,
  ExternalLink, MessageSquare
} from 'lucide-react';

import { UserRow, SpreadsheetConfig } from './types';
import { initAuth, googleSignIn, logout as googleSignOut, getAccessToken, db } from './lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  fetchUserRows, fetchPublicUserRows, createDatabaseSpreadsheet, appendUserRow, 
  overwriteUsers, extractSpreadsheetId, ensureBoardSheet
} from './lib/googleSheets';

import MemberLogin from './components/MemberLogin';
import MemberProfile from './components/MemberProfile';
import AdminConsole from './components/AdminConsole';
import CentricAIHub from './components/CentricAIHub';
import TaxExpertList from './components/TaxExpertList';

// =========================================================================
// ⚙️ [구글 스프레드시트 아이디 설정]
// - 구글 로그인 후 연결하여 관리하면 자동으로 브라우저에 연동 스프레드시트가 기록됩니다.
// =========================================================================
const DEFAULT_SPREADSHEET_ID = '1KpApTrIuRpatfaVszLIkIBFYeeoROXxRSUGIPkHw4Yg';

// =========================================================================
// 🔄 [모바일 환경 쿠키/로컬스토리지 이중백업 영속성 유틸리티]
// - 인앱 웹뷰(카카오톡/네이버 등) 및 샌드박스 아이프레임(Vite Preview) 환경 완벽 지원
// - 쿠키에는 오직 소량의 세션 인증용 필드(아이디/비밀번호/자동로그인 활성화 여부)만 보관하여 쿠키 용량 수용한계(4KB) 초과를 원천 차단합니다.
// =========================================================================
const memoryStorage = new Map<string, string>();

// 쿠키에 기록할 안전 필드 지정 (전체 유저 DB나 세션 프로필 같은 대용량 데이터는 쿠키 대형화 방지를 위해 로컬스토리지에만 저장)
const SAFE_COOKIE_KEYS = ['auto_login_phone', 'auto_login_pw', 'auto_login_enabled'];

const setPersistentItem = (key: string, value: string) => {
  try {
    memoryStorage.set(key, value);
  } catch (e) {}
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('LocalStorage setItem error:', e);
  }
  // 쿠키에는 허용된 경량 세션 키만 기록하여 400 Bad Request 에러 방지
  if (SAFE_COOKIE_KEYS.includes(key)) {
    try {
      const expires = new Date();
      expires.setTime(expires.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year
      document.cookie = `${key}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax;Secure`;
    } catch (e) {
      console.warn('Cookie set error:', e);
    }
  }
};

const getPersistentItem = (key: string): string | null => {
  let val: string | null = null;
  try {
    val = memoryStorage.get(key) || null;
  } catch (e) {}
  if (val) return val;

  try {
    val = localStorage.getItem(key);
    if (val) {
      memoryStorage.set(key, val);
      return val;
    }
  } catch (e) {
    console.warn('LocalStorage getItem error:', e);
  }

  if (SAFE_COOKIE_KEYS.includes(key)) {
    try {
      const nameEQ = key + "=";
      const ca = document.cookie.split(';');
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
          val = decodeURIComponent(c.substring(nameEQ.length, c.length));
          memoryStorage.set(key, val);
          // Restore to localStorage to auto-heal
          try {
            localStorage.setItem(key, val);
          } catch (_) {}
          return val;
        }
      }
    } catch (e) {
      console.warn('Cookie get error:', e);
    }
  }
  return null;
};

const removePersistentItem = (key: string) => {
  try {
    memoryStorage.delete(key);
  } catch (e) {}
  try {
    localStorage.removeItem(key);
  } catch (e) {}
  try {
    document.cookie = `${key}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax;Secure`;
  } catch (e) {}
};

// 실시간으로 브라우저에 존재할 수 있는 이전 버전의 거대 쿠키(g_sheets_cached_users, logged_in_member_data 등)를 일괄 소거하는 복구 루틴
try {
  if (typeof document !== 'undefined') {
    const dCookies = document.cookie.split(';');
    for (let i = 0; i < dCookies.length; i++) {
      const parts = dCookies[i].split('=');
      const name = parts[0].trim();
      if (name && !SAFE_COOKIE_KEYS.includes(name)) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax;Secure`;
      }
    }
  }
} catch (e) {
  console.warn('Silent cookie cleanup failed:', e);
}

// Preloaded mock database for instant interactive trial
const INITIAL_MOCK_USERS: UserRow[] = [];

export default function App() {
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    return params.get('admin') === 'true' ? 'admin' : 'user';
  });
  
  // Google Auth & Sync States
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminUser, setAdminUser] = useState<any | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  
  // Connected Sheet info
  const [connectedSheet, setConnectedSheet] = useState<SpreadsheetConfig | null>(null);
  
  // Core user records (loaded from Sheet OR falling back to mock storage)
  const [users, setUsers] = useState<UserRow[]>(INITIAL_MOCK_USERS);
  const [isDataLoadedFromSheet, setIsDataLoadedFromSheet] = useState(false);
  
  // Logged-in member session state
  const [loggedInMember, setLoggedInMember] = useState<UserRow | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [iframeSrc, setIframeSrc] = useState('https://centrictax.vercel.app/');
  const [centricAiResetTrigger, setCentricAiResetTrigger] = useState(0);
  const [expertResetTrigger, setExpertResetTrigger] = useState(0);
  
  // Global actions loading & error feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // 1. Initial Load: Check Firestore database configuration + localStorage and Initialize Auth
  useEffect(() => {
    let activeSheetId = DEFAULT_SPREADSHEET_ID;
    let activeSheetUrl = `https://docs.google.com/spreadsheets/d/${activeSheetId}/edit`;
    let activeSheetTitle = '연동된 회원 데이터베이스';
    let isSubscribed = true;
    let authUnsubscribe: (() => void) | undefined;

    const initializeAndLoad = async () => {
      // 1. Fetch global sheet configuration from Firestore first (for other computers)
      try {
        const docRef = doc(db, 'settings', 'spreadsheet_config');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && isSubscribed) {
          const fsData = docSnap.data();
          if (fsData.spreadsheetId) {
            activeSheetId = fsData.spreadsheetId;
            activeSheetUrl = fsData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${fsData.spreadsheetId}/edit`;
            activeSheetTitle = fsData.title || '연동된 회원 데이터베이스';
            console.log('Successfully loaded global database Sheet ID from Firestore:', activeSheetId);
          }
        }
      } catch (err) {
        console.warn('Initial Firestore spreadsheet_config fetch skipped/failed (falling back to cache/local):', err);
      }

      // 2. Allow URL query parameter to force-override active sheet, fallback to Firestore global setting, fallback to persistent storage fallback
      const params = new URLSearchParams(window.location.search);
      const urlSheetId = params.get('sheetId');
      
      const savedSheetId = urlSheetId || activeSheetId || getPersistentItem('g_sheets_connected_id');
      const savedSheetUrl = (savedSheetId === activeSheetId) ? activeSheetUrl : (getPersistentItem('g_sheets_connected_url') || `https://docs.google.com/spreadsheets/d/${savedSheetId}/edit`);
      const savedSheetTitle = (savedSheetId === activeSheetId) ? activeSheetTitle : (getPersistentItem('g_sheets_connected_title') || '연동된 회원 데이터베이스');

      if (!isSubscribed) return;

      if (savedSheetId) {
        const config: SpreadsheetConfig = {
          spreadsheetId: savedSheetId,
          spreadsheetUrl: savedSheetUrl,
          title: savedSheetTitle
        };
        setConnectedSheet(config);

        // Keep local cache in sync
        if (urlSheetId) {
          setPersistentItem('g_sheets_connected_id', urlSheetId);
          setPersistentItem('g_sheets_connected_url', savedSheetUrl);
          setPersistentItem('g_sheets_connected_title', savedSheetTitle);
        }
      }

      // Load cached local user records as immediate fast fallback
      let resolvedUsers: UserRow[] = [];
      const cachedUsers = getPersistentItem('g_sheets_cached_users');
      if (cachedUsers && isSubscribed) {
        try {
          resolvedUsers = JSON.parse(cachedUsers);
          setUsers(resolvedUsers);
        } catch (err) {
          console.error('Error parsing cached users:', err);
        }
      }

      const autoLoginEnabled = getPersistentItem('auto_login_enabled') === 'true';
      const savedPhone = getPersistentItem('auto_login_phone');
      const savedPw = getPersistentItem('auto_login_pw');

      const normalizePhone = (phone: string) => {
        let digits = phone.replace(/[^0-9]/g, '');
        if (digits.startsWith('8210') && digits.length >= 11) {
          digits = '0' + digits.slice(2);
        }
        return digits;
      };

      // Check auto-login instantly using cached user list from last session
      if (autoLoginEnabled && savedPhone && savedPw && isSubscribed) {
        const searchPhone = normalizePhone(savedPhone);
        const searchPw = savedPw.trim();

        const autoMatch = resolvedUsers.find(u => {
          const uPhone = normalizePhone(u.phoneNumber);
          const uPassword = (u.password || '').trim();
          return uPhone === searchPhone && uPassword === searchPw;
        });

        if (autoMatch) {
          setLoggedInMember(autoMatch);
          console.log('Auto-login session restored from cached user list:', autoMatch.name);
        }
      }

      // Background download of actual Google sheet user database entries (so logins actually work live!)
      if (savedSheetId) {
        try {
          const rows = await fetchPublicUserRows(savedSheetId);
          if (rows && rows.length > 0 && isSubscribed) {
            setUsers(rows);
            setIsDataLoadedFromSheet(true);
            setPersistentItem('g_sheets_cached_users', JSON.stringify(rows));

            // Sync/Verify active session live with Google Sheets
            if (autoLoginEnabled && savedPhone && savedPw) {
              const searchPhone = normalizePhone(savedPhone);
              const searchPw = savedPw.trim();

              const remoteMatch = rows.find(u => {
                const uPhone = normalizePhone(u.phoneNumber);
                const uPassword = (u.password || '').trim();
                return uPhone === searchPhone && uPassword === searchPw;
              });

              if (remoteMatch) {
                setLoggedInMember(remoteMatch);
              } else {
                // If account has been removed or modified on the Google sheets backend, log out visually,
                // but do NOT force-erase their saved credential fields to prevent frustrated user lockouts on slow networks.
                setLoggedInMember(null);
                console.warn('Auto-login session was not validated live against raw sheet, session logged out.');
              }
            }
          }
        } catch (err) {
          console.warn('Silent public sheets sync skipped (using cached/default data instead):', err);
        }
      }

      // 3. Setup Firebase Auth listener
      authUnsubscribe = initAuth(
        async (user, token) => {
          if (!isSubscribed) return;
          setIsAdminAuthenticated(true);
          setAdminUser(user);
          setGoogleToken(token);
          
          if (savedSheetId) {
            await syncWithSpreadsheet(token, savedSheetId);
          }
        },
        () => {
          if (!isSubscribed) return;
          setIsAdminAuthenticated(false);
          setAdminUser(null);
          setGoogleToken(null);
        }
      );
    };

    initializeAndLoad();

    return () => {
      isSubscribed = false;
      if (authUnsubscribe) authUnsubscribe();
    };
  }, []);

  // 1b. Login Routing: Determine initial active page based on user permissions
  useEffect(() => {
    if (loggedInMember) {
      const isAiY = loggedInMember.ai === 'Y';
      const isNcentricY = loggedInMember.ncentric === 'Y';
      const isTaxtalkY = loggedInMember.taxtalk === 'Y';

      if (!isAiY && !isNcentricY && !isTaxtalkY) {
        setIframeSrc('');
      } else if (isAiY) {
        setIframeSrc('https://centrictax.vercel.app/');
      } else if (isNcentricY) {
        setIframeSrc('https://centrictax.vercel.app/centric_pro.html');
      } else {
        setIframeSrc('https://ntscas.github.io/taxexpertboard/');
      }
    } else {
      setIframeSrc('https://centrictax.vercel.app/');
    }
  }, [loggedInMember]);

  // Quick Flash toast notifications
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // 2. Fetch Spreadsheet data helper (supports both token AND direct read-only fallback)
  const syncWithSpreadsheet = async (token: string | null, sheetId: string): Promise<boolean> => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      let rows: UserRow[] = [];
      if (token) {
        // Authenticated Google Sheets API
        try {
          rows = await fetchUserRows(token, sheetId);
        } catch (authErr) {
          console.warn('Authenticated user rows fetch failed, trying public load fallback:', authErr);
          rows = await fetchPublicUserRows(sheetId);
        }
      } else {
        // Public Google Sheets CSV Export
        rows = await fetchPublicUserRows(sheetId);
      }
      setUsers(rows);
      setIsDataLoadedFromSheet(true);
      setPersistentItem('g_sheets_cached_users', JSON.stringify(rows));
      return true;
    } catch (err: any) {
      console.error(err);
      if (token) {
        setErrorMsg(err.message || '스프레더시트 동기화 실패. 공유 권한("링크가 있는 모든 사용자 보기")이나 ID를 재확인해 주세요.');
      } else {
        console.warn('Silent background fall-back to cache:', err);
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // A. Admin Action: Link current Google OAuth
  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setIsLoading(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setIsAdminAuthenticated(true);
        setAdminUser(result.user);
        setGoogleToken(result.accessToken);
        triggerToast('구글 계정이 연동되었습니다!');
        
        // If there is an existing configured sheet, sync it immediately
        if (connectedSheet) {
          await syncWithSpreadsheet(result.accessToken, connectedSheet.spreadsheetId);
        }
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setErrorMsg('구글계정 인증에 실패했습니다. 팝업 차단을 꺼주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // B. Admin Action: Google disconnect
  const handleGoogleSignOut = async () => {
    setErrorMsg('');
    setIsLoading(true);
    try {
      await googleSignOut();
      setIsAdminAuthenticated(false);
      setAdminUser(null);
      setGoogleToken(null);
      triggerToast('구글 연동을 해제했습니다.');
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // C. Admin Action: Connect an existing Sheet via URL or ID
  const handleConnectSpreadsheet = async (urlOrId: string): Promise<boolean> => {
    if (!googleToken) {
      setErrorMsg('구글 로그인을 먼저 진행해 주세요.');
      return false;
    }
    const id = extractSpreadsheetId(urlOrId);
    if (!id) {
      setErrorMsg('올바르지 않은 시트 URL 또는 ID 형식입니다.');
      return false;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      // Fetch sheets data first to get properties
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}`, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      if (!response.ok) {
        throw new Error('시트에 접근할 수가 없습니다. 타사 시트인가요? 권한을 확인해주세요.');
      }
      const data = await response.json();
      const title = data.properties?.title || '연동된 구글 스프레드시트';
      const url = `https://docs.google.com/spreadsheets/d/${id}/edit`;

      const config: SpreadsheetConfig = { spreadsheetId: id, spreadsheetUrl: url, title };
      setConnectedSheet(config);
      
      setPersistentItem('g_sheets_connected_id', id);
      setPersistentItem('g_sheets_connected_url', url);
      setPersistentItem('g_sheets_connected_title', title);

      // Save global configuration in Firestore setting so other computers sync automatically!
      try {
        await setDoc(doc(db, 'settings', 'spreadsheet_config'), {
          spreadsheetId: id,
          spreadsheetUrl: url,
          title,
          updatedAt: new Date().toISOString()
        });
      } catch (fsErr) {
        console.error('Failed to write global configuration to Firestore settings document:', fsErr);
      }

      // Now load users
      const syncSuccess = await syncWithSpreadsheet(googleToken, id);
      
      // Also automatically initialize the FreeBoard sheet tab
      try {
        await ensureBoardSheet(googleToken, id);
      } catch (boardErr) {
        console.warn('Failed to ensure FreeBoard sheet when connecting spreadsheet:', boardErr);
      }

      if (syncSuccess) {
        triggerToast(`스프레드시트 '${title}'와 연동되였으며, 다른 컴퓨터에서도 이 설정이 전역 적용됩니다!`);
      }
      return syncSuccess;
    } catch (err: any) {
      console.error(err);
      setErrorMsg('시트 정보를 가져오는데 실패했습니다. Users 탭이 생성되어 있는지 확인하세요.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // C2. Public Action: Connect an existing Sheet directly via URL or ID without requiring Google OAuth login!
  const handleConnectPublicSpreadsheet = async (urlOrId: string): Promise<boolean> => {
    const id = extractSpreadsheetId(urlOrId);
    if (!id) {
      setErrorMsg('올바르지 않은 시트 URL 또는 ID 형식입니다.');
      return false;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const rows = await fetchPublicUserRows(id);
      if (!rows || rows.length === 0) {
        throw new Error('시트에서 데이터를 읽지 못했습니다. 스프레드시트가 비어있거나, 헤더 행만 있거나, 이름/전화번호 열을 찾을 수 없습니다.');
      }

      const url = `https://docs.google.com/spreadsheets/d/${id}/edit`;
      const config: SpreadsheetConfig = { 
        spreadsheetId: id, 
        spreadsheetUrl: url, 
        title: '연동된 공개 구글시트' 
      };

      setConnectedSheet(config);
      setUsers(rows);
      setIsDataLoadedFromSheet(true);
      
      setPersistentItem('g_sheets_connected_id', id);
      setPersistentItem('g_sheets_connected_url', url);
      setPersistentItem('g_sheets_connected_title', config.title);
      setPersistentItem('g_sheets_cached_users', JSON.stringify(rows));

      // Save global configuration in Firestore setting so other computers sync automatically!
      try {
        await setDoc(doc(db, 'settings', 'spreadsheet_config'), {
          spreadsheetId: id,
          spreadsheetUrl: url,
          title: config.title,
          updatedAt: new Date().toISOString()
        });
      } catch (fsErr) {
        console.error('Failed to write global public configuration to Firestore settings document:', fsErr);
      }

      triggerToast(`구글 시트 연동 성공! 다른 컴퓨터 디바이스에도 전역 적용됩니다. (동계 회원수: ${rows.length}명)`);
      return true;
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || '구글 시트 연동에 실패했습니다. 링크 공유 설정이 "링크가 있는 모든 사용자 보기(ビューワー / Viewer)" 상태인지 꼭 확인해 주세요.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // D. Admin Action: Create a brand new database Spreadsheet Automatically
  const handleCreateSpreadsheet = async (): Promise<boolean> => {
    if (!googleToken) {
      setErrorMsg('구글 로그인을 먼저 진행해 주세요.');
      return false;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const result = await createDatabaseSpreadsheet(googleToken, '구글시트 로그인 사용자 DB');
      const config: SpreadsheetConfig = {
        spreadsheetId: result.spreadsheetId,
        spreadsheetUrl: result.spreadsheetUrl,
        title: '구글시트 로그인 사용자 DB'
      };
      
      setConnectedSheet(config);
      setPersistentItem('g_sheets_connected_id', result.spreadsheetId);
      setPersistentItem('g_sheets_connected_url', result.spreadsheetUrl);
      setPersistentItem('g_sheets_connected_title', config.title);

      // Save global configuration in Firestore setting so other computers sync automatically!
      try {
        await setDoc(doc(db, 'settings', 'spreadsheet_config'), {
          spreadsheetId: result.spreadsheetId,
          spreadsheetUrl: result.spreadsheetUrl,
          title: '구글시트 로그인 사용자 DB',
          updatedAt: new Date().toISOString()
        });
      } catch (fsErr) {
        console.error('Failed to write global configuration to Firestore settings document:', fsErr);
      }

      // Force refresh (it will find empty header rows)
      await syncWithSpreadsheet(googleToken, result.spreadsheetId);

      // Also automatically initialize the FreeBoard sheet tab
      try {
        await ensureBoardSheet(googleToken, result.spreadsheetId);
      } catch (boardErr) {
        console.warn('Failed to ensure FreeBoard sheet when preparing spreadsheet:', boardErr);
      }

      triggerToast('Google Drive에 사용자 DB 및 자유게시판(FreeBoard) 시트가 생성되었습니다!');
      return true;
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`스프레드시트 생성 실패: ${err.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // E. Admin Action: Refresh Data rows
  const handleRefreshData = async () => {
    if (!connectedSheet) return;
    if (!googleToken) {
      setErrorMsg('구글 세션이 만료되었습니다. 다시 로그인 해보세요.');
      return;
    }
    const success = await syncWithSpreadsheet(googleToken, connectedSheet.spreadsheetId);
    if (success) {
      triggerToast('구글 시트의 실시간 데이터가 갱신되었습니다!');
    }
  };

  // F. User Action: Clean session & Logout helper
  const handleLogout = () => {
    setLoggedInMember(null);
    setIframeSrc('https://centrictax.vercel.app/');
    removePersistentItem('auto_login_phone');
    removePersistentItem('auto_login_pw');
    removePersistentItem('auto_login_enabled');
    removePersistentItem('logged_in_member_data');
    triggerToast('로그아웃되었습니다.');
  };

  // F2. User Action: Login Verification
  const handleUserLogin = async (phoneNumber: string, password: string, rememberMe = false): Promise<boolean> => {
    setIsLoading(true);
    setErrorMsg('');

    // Resilient digit extractor & normalizer
    const normalize = (phone: string) => {
      let digits = phone.replace(/[^0-9]/g, '');
      // If it starts with Korean country code e.g. 821012345678 -> convert to standard 01012345678
      if (digits.startsWith('8210') && digits.length >= 11) {
        digits = '0' + digits.slice(2);
      }
      return digits;
    };

    const targetPhoneNormalized = normalize(phoneNumber);
    const targetPasswordNormalized = password.trim();

    let activeUsers = users;

    // Direct Real-time Google Sheets Fetch to ensure that users newly added/edited inside the Sheet can log in instantly!
    const sheetIdToFetch = connectedSheet?.spreadsheetId || DEFAULT_SPREADSHEET_ID;
    if (sheetIdToFetch) {
      try {
        const rows = await fetchPublicUserRows(sheetIdToFetch);
        if (rows && rows.length > 0) {
          activeUsers = rows;
          setUsers(rows);
          setPersistentItem('g_sheets_cached_users', JSON.stringify(rows));
        }
      } catch (err) {
        console.warn('Real-time sheet check failed on login attempt, falling back to local cache:', err);
      }
    }

    // Matches telephone formatting & password checks securely
    const match = activeUsers.find(u => {
      const dbPhoneNormalized = normalize(u.phoneNumber);
      const dbPasswordNormalized = (u.password || '').trim();
      return dbPhoneNormalized === targetPhoneNormalized && dbPasswordNormalized === targetPasswordNormalized;
    });

    setIsLoading(false);
    if (match) {
      setLoggedInMember(match);
      if (rememberMe) {
        setPersistentItem('auto_login_phone', phoneNumber);
        setPersistentItem('auto_login_pw', password);
        setPersistentItem('auto_login_enabled', 'true');
        setPersistentItem('logged_in_member_data', JSON.stringify(match));
      } else {
        removePersistentItem('auto_login_phone');
        removePersistentItem('auto_login_pw');
        removePersistentItem('auto_login_enabled');
        removePersistentItem('logged_in_member_data');
      }
      triggerToast(`${match.name}님 로그인 성공!`);
      return true;
    } else {
      setErrorMsg('존재하지 않는 회원 번호이거나 비밀번호가 맞지 않습니다.');
      return false;
    }
  };

  // G. User / Admin Action: Register (Add member row)
  const handleAddUser = async (newUser: UserRow): Promise<boolean> => {
    // Check duplication
    const plainNew = newUser.phoneNumber.replace(/[^0-9]/g, '');
    const isDup = users.some(u => u.phoneNumber.replace(/[^0-9]/g, '') === plainNew);
    if (isDup) {
      setErrorMsg('이미 이 전화번호로 가입된 회원이 존재합니다.');
      return false;
    }

    setIsLoading(true);
    setErrorMsg('');
    try {
      const updatedList = [...users, newUser];
      setUsers(updatedList);
      setPersistentItem('g_sheets_cached_users', JSON.stringify(updatedList));

      // If connected live to Google spreadsheet, append immediately
      if (googleToken && connectedSheet) {
        await appendUserRow(googleToken, connectedSheet.spreadsheetId, newUser);
        // Refresh local rows to be sure
        await fetchUserRows(googleToken, connectedSheet.spreadsheetId);
      }
      
      triggerToast(`${newUser.name}님이 성공적으로 데이터베이스에 추가되었습니다.`);
      return true;
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`스프레드시트 원격 추가 실패: ${err.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // H. Admin Action: Delete member row (Rewrites database to clean empty rows)
  const handleDeleteUser = async (phoneNumber: string): Promise<boolean> => {
    const isConfirmed = window.confirm(`전화번호 '${phoneNumber}' 정보를 데이터베이스 시트에서 영구 영구히 삭제할까요?`);
    if (!isConfirmed) return false;

    setIsLoading(true);
    setErrorMsg('');
    try {
      const updatedList = users.filter(u => u.phoneNumber !== phoneNumber);
      setUsers(updatedList);
      setPersistentItem('g_sheets_cached_users', JSON.stringify(updatedList));

      if (googleToken && connectedSheet) {
        await overwriteUsers(googleToken, connectedSheet.spreadsheetId, updatedList);
        triggerToast('구글 시트의 전체 멤버를 안전하게 재정렬하여 삭제했습니다.');
      } else {
        triggerToast('가상 데이터베이스의 회원 행을 삭제했습니다.');
      }
      return true;
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`삭제 정보 동기화 중 에러가 발생했습니다: ${err.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-start ${loggedInMember ? 'pb-0' : 'pb-16'}`} id="app_root_layout">
      {/* TOAST SYSTEM ACCORDING TO PREMIUM MICRO-ANIMS */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-2xl flex items-center gap-3 text-xs font-semibold tracking-wide font-sans cursor-pointer pointer-events-none"
            id="toast_toast_banner"
          >
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping shrink-0" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 탭 전환 버튼: URL 주소 끝에 ?admin=true 가 입력되었을 때만 디스크리트하게 상단에 노출합니다. */}
      {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('admin') === 'true' && (
        <div className="w-full bg-white border-b border-slate-200/60 py-2.5 px-4 mb-2 flex justify-between items-center shadow-xs" id="admin_discreet_bar">
          <div className="flex items-center gap-2 select-none">
            <span className="p-1 bg-teal-100 text-teal-600 rounded">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-slate-700 font-sans">관리자 설정 모드 활성화됨</span>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner gap-0.5" id="header_tab_selector">
            <button
              id="tab_user_btn"
              onClick={() => {
                setActiveTab('user');
                setErrorMsg('');
              }}
              className={`px-4 py-1 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
                activeTab === 'user'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              사용자 포털
            </button>
            <button
              id="tab_admin_btn"
              onClick={() => {
                setActiveTab('admin');
                setErrorMsg('');
              }}
              className={`px-4 py-1 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              관리자 설정
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className={`w-full ${loggedInMember ? 'max-w-full px-[2px]' : 'max-w-6xl px-4'} mx-auto py-6 flex-1 flex flex-col justify-start text-sans`} id="app_main_content">
        {/* Dynamic Transition Canvas */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full flex-1 flex flex-col justify-start"
          >
            {activeTab === 'user' ? (
              /* TAB 1: MEMBER LOGIN VIEW WITH EMBEDDED SITE & POPUP PROFILE */
              <div className={`flex-1 flex flex-col justify-start w-full ${loggedInMember ? 'py-0' : 'py-4'}`} id="member_portal_view">
                {loggedInMember ? (
                  <div className="w-full flex-1 flex flex-col space-y-0" id="embedded_pro_portal">
                    {/* Embedded Session Bar / User Management Sub-Header (Optimized for Mobile Single-Row) */}
                    <div className="w-full bg-white/95 backdrop-blur-md border border-slate-100 rounded-t-2xl md:rounded-t-3xl rounded-b-none py-1 px-2.5 md:py-2 md:px-4 shadow-sm flex flex-row items-center justify-between gap-1 md:gap-4 sticky top-0 z-30" id="session_control_bar">
                      <div 
                        onClick={() => setIsProfileOpen(true)}
                        className="flex items-center gap-1.5 md:gap-3 cursor-pointer hover:bg-slate-50 p-0.5 -m-0.5 rounded-xl transition-all duration-150 group active:scale-98 min-w-0"
                        id="session_profile_click_area"
                        title="내 프로필 정보 보기"
                        role="button"
                      >
                        <div className="w-6.5 h-6.5 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold group-hover:bg-teal-600 group-hover:text-white transition-all duration-200 shadow-xs text-[10px] md:text-base shrink-0">
                          {loggedInMember.name[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="hidden xs:flex text-[8px] md:text-[10px] text-slate-400 font-sans font-medium items-center gap-1 leading-none mb-0.5 md:mb-1">
                            인증 회원 세션 활성화
                            <span className="text-[7.5px] md:text-[9px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-normal shrink-0 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">프로필</span>
                          </div>
                          <div className="xs:hidden text-[7px] text-slate-400 font-sans font-medium mb-0.5 whitespace-nowrap">
                            인증세션
                          </div>
                          <h4 className="text-[10px] md:text-sm font-bold text-slate-800 font-sans group-hover:text-teal-700 transition-colors leading-none truncate">
                            {loggedInMember.name} <span className="font-normal text-slate-400 text-[8px] md:text-xs">({loggedInMember.phoneNumber.slice(-4)})</span>
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 md:gap-2 shrink-0">
                        {loggedInMember?.ai === 'Y' && (
                          <button
                            type="button"
                            onClick={() => {
                              setIframeSrc('https://centrictax.vercel.app/');
                              setCentricAiResetTrigger(prev => prev + 1);
                              window.scrollTo({ top: 0, behavior: 'instant' });
                            }}
                            className={`px-2 py-1 md:px-4 md:py-2 text-[9px] md:text-xs font-semibold rounded-lg md:rounded-xl transition flex items-center gap-1 md:gap-1.5 cursor-pointer shadow-xs ${
                              iframeSrc === 'https://centrictax.vercel.app/'
                                ? 'bg-teal-600 text-white ring-1 ring-teal-600'
                                : 'bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                            id="view_centric_ai_btn"
                          >
                            <Sparkles className="w-2.5 md:w-3.5 h-2.5 md:h-3.5 text-amber-500 shrink-0" />
                            <span className="hidden xs:inline">CENTRIC AI</span>
                            <span className="xs:hidden">CENTRIC AI</span>
                          </button>
                        )}

                        {loggedInMember?.ncentric === 'Y' && (
                          <button
                            type="button"
                            onClick={() => {
                              setIframeSrc('https://centrictax.vercel.app/centric_pro.html');
                              setExpertResetTrigger(prev => prev + 1);
                              window.scrollTo({ top: 0, behavior: 'instant' });
                            }}
                            className={`px-2 py-1 md:px-4 md:py-2 text-[9px] md:text-xs font-semibold rounded-lg md:rounded-xl transition flex items-center gap-1 md:gap-1.5 cursor-pointer shadow-xs ${
                              iframeSrc === 'https://centrictax.vercel.app/centric_pro.html'
                                ? 'bg-teal-600 text-white ring-1 ring-teal-600'
                                : 'bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                            id="view_centric_pro_btn"
                          >
                            <Building2 className="w-2.5 md:w-3.5 h-2.5 md:h-3.5 shrink-0" />
                            <span className="hidden xs:inline">조세전문가</span>
                            <span className="xs:hidden">조세전문가</span>
                          </button>
                        )}

                        {loggedInMember?.taxtalk === 'Y' && (
                          <button
                            type="button"
                            onClick={() => {
                              setIframeSrc('https://ntscas.github.io/taxexpertboard/');
                              window.scrollTo({ top: 0, behavior: 'instant' });
                            }}
                            className={`px-2 py-1 md:px-4 md:py-2 text-[9px] md:text-xs font-semibold rounded-lg md:rounded-xl transition flex items-center gap-1 md:gap-1.5 cursor-pointer shadow-xs ${
                              iframeSrc === 'https://ntscas.github.io/taxexpertboard/'
                                ? 'bg-teal-600 text-white ring-1 ring-teal-600'
                                : 'bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                            id="view_centric_board_btn"
                          >
                            <MessageSquare className="w-2.5 md:w-3.5 h-2.5 md:h-3.5 shrink-0" />
                            <span className="hidden xs:inline">게시판</span>
                            <span className="xs:hidden">게시판</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleLogout}
                          className="p-1 md:p-2.5 bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 rounded-lg md:rounded-xl transition flex items-center justify-center cursor-pointer shadow-xs"
                          id="session_logout_btn"
                          title="로그아웃"
                        >
                          <LogOut className="w-3 md:w-4 h-3 md:h-4 shrink-0" />
                        </button>
                      </div>
                    </div>

                    {/* Integrated Page Local or Iframe Canvas */}
                    <div className="flex-1 w-full bg-white border border-t-0 border-slate-100 rounded-b-2xl md:rounded-b-3xl rounded-t-none overflow-visible shadow-lg relative min-h-[calc(100vh-220px)] flex flex-col" id="centric_pro_canvas">
                      {iframeSrc === '' ? (
                        <div className="flex-1 w-full bg-slate-50 min-h-[650px] flex flex-col items-center justify-center p-8 text-center text-slate-500 rounded-b-2xl md:rounded-b-3xl" id="empty_portal_view">
                          <AlertTriangle className="w-12 h-12 text-slate-300 mb-3" />
                          <p className="font-semibold text-lg text-slate-700">이용할 수 있는 메뉴가 없습니다.</p>
                          <p className="text-sm text-slate-400 mt-1">관리자에게 메뉴 활성화 권한을 확인해 주세요.</p>
                        </div>
                      ) : iframeSrc === 'https://centrictax.vercel.app/' ? (
                        <CentricAIHub key={`centric_ai_hub_${centricAiResetTrigger}`} />
                      ) : iframeSrc === 'https://centrictax.vercel.app/centric_pro.html' ? (
                        <TaxExpertList 
                          key={`tax_expert_list_${expertResetTrigger}`}
                          loggedInMember={loggedInMember}
                          googleToken={googleToken}
                          connectedSheet={connectedSheet}
                        />
                      ) : (
                        <iframe
                          src={iframeSrc}
                          title="Centric Pro Portal"
                          className="w-full flex-1 border-0 min-h-[650px]"
                          id="embedded_centric_pro_frame"
                          allow="fullscreen; clipboard-read; clipboard-write;"
                          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox allow-top-navigation allow-top-navigation-by-user-activation"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <MemberLogin 
                    onLogin={handleUserLogin}
                    onRegister={handleAddUser}
                    isLoading={isLoading}
                    errorMsg={errorMsg}
                    connectedSheet={connectedSheet}
                    totalUsersCount={users.length}
                  />
                )}
              </div>
            ) : (
              /* TAB 2: ADMIN ZONE VIEW */
              <AdminConsole 
                isAdminAuthenticated={isAdminAuthenticated}
                adminUser={adminUser}
                spreadsheet={connectedSheet}
                users={users}
                isLoading={isLoading}
                onGoogleSignIn={handleGoogleSignIn}
                onGoogleSignOut={handleGoogleSignOut}
                onConnectSpreadsheet={handleConnectSpreadsheet}
                onConnectPublicSpreadsheet={handleConnectPublicSpreadsheet}
                onCreateSpreadsheet={handleCreateSpreadsheet}
                onAddUser={handleAddUser}
                onDeleteUser={handleDeleteUser}
                onRefreshData={handleRefreshData}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* FOOTER */}
      {!loggedInMember && (
        <footer className="mt-auto pt-12 text-center text-[11px] text-slate-400 font-mono" id="app_bottom_footer">
          <p>CENTRIC Tax AI Hub</p>
          <p className="mt-1 opacity-80">N CENTRIC Tax</p>
        </footer>
      )}

      {/* SEPARATE MEMBERSHIP PROFILE FLOATING DIALOG (MODAL) */}
      <AnimatePresence>
        {isProfileOpen && loggedInMember && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4" id="separate_profile_modal_wrapper">
            <div className="absolute inset-x-0 inset-y-0 bg-transparent" onClick={() => setIsProfileOpen(false)} />
            <div className="relative z-10 w-full max-w-lg">
              <MemberProfile
                user={loggedInMember}
                spreadsheetName={connectedSheet?.title}
                onClose={() => setIsProfileOpen(false)}
                onLogout={() => {
                  handleLogout();
                  setIsProfileOpen(false);
                }}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
