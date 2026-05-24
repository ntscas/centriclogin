import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, Users, Settings, Database, RefreshCw, LogOut, 
  FileSpreadsheet, Sparkles, AlertTriangle, CheckCircle2, Phone, Home, ShieldCheck,
  ExternalLink
} from 'lucide-react';

import { UserRow, SpreadsheetConfig } from './types';
import { initAuth, googleSignIn, logout as googleSignOut, getAccessToken } from './lib/firebase';
import { 
  fetchUserRows, createDatabaseSpreadsheet, appendUserRow, 
  overwriteUsers, extractSpreadsheetId 
} from './lib/googleSheets';

import MemberLogin from './components/MemberLogin';
import MemberProfile from './components/MemberProfile';
import AdminConsole from './components/AdminConsole';

// Preloaded mock database for instant interactive trial
const INITIAL_MOCK_USERS: UserRow[] = [
  {
    phoneNumber: '010-1234-5678',
    password: '1234',
    name: '김이음',
    email: 'manger@company.com',
    otherInfo: '영업기획팀 부장 (우수사원)',
    registeredDate: '2026-05-10'
  },
  {
    phoneNumber: '010-9876-5432',
    password: '5678',
    name: '이지수',
    email: 'jisu@company.com',
    otherInfo: '인재개발팀 대리',
    registeredDate: '2026-05-15'
  },
  {
    phoneNumber: '010-5555-5555',
    password: '0000',
    name: '박강현',
    email: 'kang@service.net',
    otherInfo: '임시 협력업체 개발본부장',
    registeredDate: '2026-05-20'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');
  
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
  const [iframeSrc, setIframeSrc] = useState('https://centrictax.vercel.app/centric_pro.html');
  
  // Global actions loading & error feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // 1. Initial Load: Check localStorage and Initialize Auth
  useEffect(() => {
    // A. Restore spreadsheet configurations from localstorage
    const savedSheetId = localStorage.getItem('g_sheets_connected_id');
    const savedSheetUrl = localStorage.getItem('g_sheets_connected_url');
    const savedSheetTitle = localStorage.getItem('g_sheets_connected_title');
    
    if (savedSheetId && savedSheetUrl && savedSheetTitle) {
      setConnectedSheet({
        spreadsheetId: savedSheetId,
        spreadsheetUrl: savedSheetUrl,
        title: savedSheetTitle
      });
    }

    // B. Check localstorage for cached user states (keeps things working offline/guest-mode)
    const cachedUsers = localStorage.getItem('g_sheets_cached_users');
    if (cachedUsers) {
      try {
        setUsers(JSON.parse(cachedUsers));
      } catch (err) {
        console.error('Error parsing cached users:', err);
      }
    }

    // C. Subscribe to Google Firebase Auth
    const unsubscribe = initAuth(
      async (user, token) => {
        setIsAdminAuthenticated(true);
        setAdminUser(user);
        setGoogleToken(token);
        
        // If we have a saved sheet, immediately fetch the live rows
        if (savedSheetId) {
          await syncWithSpreadsheet(token, savedSheetId);
        }
      },
      () => {
        setIsAdminAuthenticated(false);
        setAdminUser(null);
        setGoogleToken(null);
      }
    );

    return () => unsubscribe();
  }, []);

  // Quick Flash toast notifications
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // 2. Fetch Spreadsheet data helper
  const syncWithSpreadsheet = async (token: string, sheetId: string): Promise<boolean> => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const rows = await fetchUserRows(token, sheetId);
      setUsers(rows);
      setIsDataLoadedFromSheet(true);
      localStorage.setItem('g_sheets_cached_users', JSON.stringify(rows));
      return true;
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || '스프레더시트 동기화 실패. 공유 권한이나 ID를 재확인해 주세요.');
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
      
      localStorage.setItem('g_sheets_connected_id', id);
      localStorage.setItem('g_sheets_connected_url', url);
      localStorage.setItem('g_sheets_connected_title', title);

      // Now load users
      const syncSuccess = await syncWithSpreadsheet(googleToken, id);
      if (syncSuccess) {
        triggerToast(`스프레드시트 '${title}'와 연동되었습니다!`);
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
      localStorage.setItem('g_sheets_connected_id', result.spreadsheetId);
      localStorage.setItem('g_sheets_connected_url', result.spreadsheetUrl);
      localStorage.setItem('g_sheets_connected_title', config.title);

      // Force refresh (it will find empty header rows)
      await syncWithSpreadsheet(googleToken, result.spreadsheetId);
      triggerToast('Google Drive에 사용자 DB 시트가 생성되었습니다!');
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

  // F. User Action: Login Verification
  const handleUserLogin = async (phoneNumber: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setErrorMsg('');
    await new Promise(resolve => setTimeout(resolve, 800)); // fluid delay for premium micro-experience

    // Matches telephone formatting
    const match = users.find(u => 
      u.phoneNumber.replace(/[^0-9]/g, '') === phoneNumber.replace(/[^0-9]/g, '') && 
      u.password === password
    );

    setIsLoading(false);
    if (match) {
      setLoggedInMember(match);
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
      localStorage.setItem('g_sheets_cached_users', JSON.stringify(updatedList));

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
      localStorage.setItem('g_sheets_cached_users', JSON.stringify(updatedList));

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

      {/* MAIN CONTENT AREA */}
      <main className="w-full max-w-6xl mx-auto px-4 py-6 flex-1 flex flex-col justify-start text-sans" id="app_main_content">
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
                    {/* Embedded Session Bar / User Management Sub-Header */}
                    <div className="w-full bg-white border border-slate-100 border-b-0 rounded-t-3xl rounded-b-none p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4" id="session_control_bar">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold">
                          {loggedInMember.name[0]}
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 font-sans font-medium">인증 회원 세션 활성화</div>
                          <h4 className="text-sm font-bold text-slate-800 font-sans">
                            {loggedInMember.name} 님 <span className="font-normal text-slate-500">({loggedInMember.phoneNumber})</span>
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setIsProfileOpen(true)}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                          id="open_profile_dialog_btn"
                        >
                          <Users className="w-3.5 h-3.5 text-teal-400" />
                          내 프로필 정보 ({loggedInMember.name})
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => setIframeSrc('https://centrictax.vercel.app/centric_pro.html')}
                          className={`px-4 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                            iframeSrc === 'https://centrictax.vercel.app/centric_pro.html'
                              ? 'bg-teal-600 text-white ring-1 ring-teal-600'
                              : 'bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                          id="view_centric_pro_btn"
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          조세전문가
                        </button>

                        <button
                          type="button"
                          onClick={() => setIframeSrc('https://centrictax.vercel.app/')}
                          className={`px-4 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                            iframeSrc === 'https://centrictax.vercel.app/'
                              ? 'bg-teal-600 text-white ring-1 ring-teal-600'
                              : 'bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                          id="view_centric_ai_btn"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          CENTRIC AI
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setLoggedInMember(null);
                            setIframeSrc('https://centrictax.vercel.app/centric_pro.html');
                          }}
                          className="px-4 py-2 bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                          id="session_logout_btn"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          로그아웃
                        </button>
                      </div>
                    </div>

                    {/* Integrated Page Iframe Canvas */}
                    <div className="flex-1 w-full bg-white border border-slate-100 rounded-b-3xl rounded-t-none overflow-hidden shadow-lg relative min-h-[calc(100vh-220px)] flex flex-col" id="centric_pro_canvas">
                      <iframe
                        src={iframeSrc}
                        title="Centric Pro Portal"
                        className="w-full flex-1 border-0 min-h-[650px]"
                        id="embedded_centric_pro_frame"
                        allow="fullscreen; clipboard-read; clipboard-write;"
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                      />
                    </div>
                  </div>
                ) : (
                  <MemberLogin 
                    onLogin={handleUserLogin}
                    onRegister={handleAddUser}
                    isLoading={isLoading}
                    errorMsg={errorMsg}
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
          <p>© 2026 Google Sheets Login Portal. Designed with Inter & Space Grotesk slate styling.</p>
          <p className="mt-1 opacity-80">This project complies with Google Workspace Auth policies & sandboxed previews.</p>
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
                  setLoggedInMember(null);
                  setIframeSrc('https://centrictax.vercel.app/centric_pro.html');
                  setIsProfileOpen(false);
                  triggerToast('로그아웃되었습니다.');
                }}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
