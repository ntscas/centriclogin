import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Database, RefreshCw, KeyRound, ExternalLink, Plus, Trash2, 
  Search, Shield, AlertTriangle, CheckCircle2, Copy, FileSpreadsheet, 
  HelpCircle, UserPlus, LogOut, Loader2, Link
} from 'lucide-react';
import { UserRow, SpreadsheetConfig } from '../types';

interface AdminConsoleProps {
  isAdminAuthenticated: boolean;
  adminUser: any | null;
  spreadsheet: SpreadsheetConfig | null;
  users: UserRow[];
  isLoading: boolean;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  onConnectSpreadsheet: (urlOrId: string) => Promise<boolean>;
  onConnectPublicSpreadsheet: (urlOrId: string) => Promise<boolean>;
  onCreateSpreadsheet: () => Promise<boolean>;
  onAddUser: (user: UserRow) => Promise<boolean>;
  onDeleteUser: (phoneNumber: string) => Promise<boolean>;
  onRefreshData: () => Promise<void>;
}

export default function AdminConsole({
  isAdminAuthenticated,
  adminUser,
  spreadsheet,
  users,
  isLoading,
  onGoogleSignIn,
  onGoogleSignOut,
  onConnectSpreadsheet,
  onConnectPublicSpreadsheet,
  onCreateSpreadsheet,
  onAddUser,
  onDeleteUser,
  onRefreshData,
}: AdminConsoleProps) {
  const [spreadsheetInput, setSpreadsheetInput] = useState('');
  const [publicSpreadsheetInput, setPublicSpreadsheetInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [publicConnectError, setPublicConnectError] = useState('');
  const [isPublicLinking, setIsPublicLinking] = useState(false);
  
  // New User Form Modal/State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newOther, setNewOther] = useState('');
  const [addError, setAddError] = useState('');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const copyShareUrl = () => {
    if (!spreadsheet) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?sheetId=${spreadsheet.spreadsheetId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedShareUrl(true);
    setTimeout(() => setCopiedShareUrl(false), 2000);
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectError('');
    if (!spreadsheetInput.trim()) {
      setConnectError('구글 시트 URL 또는 ID를 입력해 주세요.');
      return;
    }
    const success = await onConnectSpreadsheet(spreadsheetInput);
    if (success) {
      setSpreadsheetInput('');
    } else {
      setConnectError('스프레드시트를 연결할 수 없습니다. 공유 설정을 확인해 주세요.');
    }
  };

  const handlePublicConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublicConnectError('');
    if (!publicSpreadsheetInput.trim()) {
      setPublicConnectError('구글 시트 URL 또는 ID를 입력해 주세요.');
      return;
    }
    setIsPublicLinking(true);
    try {
      const success = await onConnectPublicSpreadsheet(publicSpreadsheetInput);
      if (success) {
        setPublicSpreadsheetInput('');
      } else {
        setPublicConnectError('구글 시트 연동 실패: 데이터가 비어있거나 공유설정("링크가 있는 모든 사용자 보기") 상태인지 꼭 확인해 주세요.');
      }
    } catch (err: any) {
      setPublicConnectError(err.message || '오류가 발생했습니다.');
    } finally {
      setIsPublicLinking(false);
    }
  };

  const formatNewPhone = (val: string) => {
    const numbers = val.replace(/[^0-9]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    
    const plainPhone = newPhone.replace(/[^0-9]/g, '');
    if (!newPhone || plainPhone.length < 10) {
      setAddError('올바른 전화번호를 입력해 주세요. (예: 010-1234-5678)');
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      setAddError('비밀번호는 최소 4자리 이상이어야 합니다.');
      return;
    }
    if (!newName.trim()) {
      setAddError('이름을 입력해 주세요.');
      return;
    }

    const newUser: UserRow = {
      phoneNumber: newPhone,
      password: newPassword,
      name: newName.trim(),
      email: newEmail.trim(),
      otherInfo: newOther.trim() || '일반 회원',
      registeredDate: new Date().toISOString().split('T')[0]
    };

    const success = await onAddUser(newUser);
    if (success) {
      // Clear and close
      setNewPhone('');
      setNewPassword('');
      setNewName('');
      setNewEmail('');
      setNewOther('');
      setShowAddModal(false);
    } else {
      setAddError('회원 추가 중 오류가 발생했습니다.');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.phoneNumber.includes(searchTerm) ||
    u.otherInfo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full space-y-6" id="admin_console_container">
      {/* 1. GOOGLE AUTHENTICATION SECTION */}
      <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-6" id="admin_auth_banner">
        <div className="flex items-center gap-4 text-center md:text-left">
          <div className={`p-4 rounded-2xl ${isAdminAuthenticated ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-500'}`} id="admin_shield_icon">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-sans">구글 스프레드시트 데이터베이스 연동</h3>
            <p className="text-slate-500 text-sm font-sans mt-0.5">
              {isAdminAuthenticated 
                ? `구글 로그인 성공: ${adminUser?.email || ''}` 
                : '스프레드시트에 직접 쓰기/읽기 권한을 주려면 관리자 가글 인증이 필요합니다.'
              }
            </p>
          </div>
        </div>

        <div>
          {isAdminAuthenticated ? (
            <button
              id="google_logout_btn"
              onClick={onGoogleSignOut}
              className="px-5 py-2.5 bg-slate-100 ring-1 ring-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              구글 연결 해제
            </button>
          ) : (
            <button
              id="google_signin_btn"
              onClick={onGoogleSignIn}
              className="gsi-material-button hover:opacity-95 transition"
              style={{ margin: 0 }}
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents font-sans font-semibold">Sign in with Google</span>
              </div>
            </button>
          )}
        </div>
      </div>

      {isAdminAuthenticated ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="admin_control_grid">
          {/* LEFT: SPREADSHEET MANAGER (Col 1) */}
          <div className="lg:col-span-1 bg-white border border-gray-100 rounded-3xl p-6 shadow-md h-fit space-y-6" id="sheet_manager_box">
            <div>
              <h4 className="text-md font-bold text-slate-800 font-sans mb-1 flex items-center gap-2">
                <FileSpreadsheet className="w-4.5 h-4.5 text-teal-600" />
                구글 스프레드시트 지정
              </h4>
              <p className="text-xs text-slate-400 font-sans">회원 정보를 저장할 구글 시트를 연동하거나 새로 만듭니다.</p>
            </div>

            {/* SPREADSHEET ALREADY CONNECTED CARD */}
            {spreadsheet ? (
              <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-3.5" id="connected_sheet_info">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-semibold text-teal-600 uppercase tracking-wider block mb-0.5">연동 상태</span>
                    <h5 className="text-sm font-bold text-slate-900 font-sans line-clamp-1">{spreadsheet.title}</h5>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-teal-500 fill-teal-50" />
                </div>
                
                <div className="bg-white rounded-xl p-3 border border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>시트 ID:</span>
                    <button 
                      onClick={() => copyToClipboard(spreadsheet.spreadsheetId)}
                      className="text-teal-600 hover:text-teal-800 font-mono font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId ? '복사됨!' : '복사 ID'}
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="font-mono text-slate-500 truncate select-all">{spreadsheet.spreadsheetId}</p>
                </div>

                <a
                  href={spreadsheet.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer referrer"
                  className="w-full py-2.5 px-4 rounded-xl font-semibold bg-teal-600 hover:bg-teal-700 text-white text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                  id="google_sheet_link_btn"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  스프레드시트 열기
                </a>

                {/* 다른 컴퓨터/디바이스 공유 연동 링크 지원 */}
                <div className="pt-3 border-t border-teal-100/60 text-xs">
                  <span className="block text-[10px] font-bold text-slate-500 mb-1">🔗 타 컴퓨터/디바이스 연동 공유 링크:</span>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}${window.location.pathname}?sheetId=${spreadsheet.spreadsheetId}`}
                      className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] text-slate-500 font-mono truncate focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={copyShareUrl}
                      className="px-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-[10.5px] font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                      {copiedShareUrl ? '복사됨' : '복사'}
                    </button>
                  </div>
                  <p className="text-[9.5px] text-slate-400 mt-1 leading-relaxed">
                    위 링크를 복사하여 다른 기기나 사용자에게 전달하면, <b>복잡한 설정 없이</b> 동일한 구글 시트 데이터 기반으로 즉시 로그인이 가능합니다.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-100 text-amber-800 text-xs font-sans leading-relaxed flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>현재 연동된 스프레드시트가 없습니다. 사용자 로그인을 매칭하려면 구글 시트를 만드시거나 기존 것을 연동해 주세요.</span>
              </div>
            )}

            {/* CONNECT FORM / PROVIOSION BTN */}
            <div className="space-y-4" id="sheet_action_forms">
              {/* Option A: Full write-access auth connect */}
              <form onSubmit={handleConnectSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-sans">
                    구글 API 계정형 연동 (쓰기/일기 권한)
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      placeholder="스프레드시트 주소(URL) 또는 ID 입력"
                      value={spreadsheetInput}
                      onChange={(e) => setSpreadsheetInput(e.target.value)}
                      className="w-full pr-10 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-xs text-slate-800"
                    />
                    <button type="submit" className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-teal-600 transition cursor-pointer">
                      <Link className="w-4 h-4" />
                    </button>
                  </div>
                  {connectError && (
                    <p className="text-rose-500 text-[10px] font-sans mt-1.5">{connectError}</p>
                  )}
                </div>
              </form>

              {/* Option B: Direct reader public link connect */}
              <form onSubmit={handlePublicConnectSubmit} className="space-y-3 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-teal-700 mb-1.5 font-sans">
                    공개 공유링크 직접 연동 (로그인 생략형)
                  </label>
                  <p className="text-[10px] text-slate-400 leading-relaxed mb-2 font-sans">
                    시트 권한이 "링크가 있는 모든 사용자 - 뷰어" 상태이면 구글계정 로그인 없이 즉시 조회 가능합니다.
                  </p>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={publicSpreadsheetInput}
                      onChange={(e) => setPublicSpreadsheetInput(e.target.value)}
                      className="w-full pr-10 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none text-xs text-slate-800"
                    />
                    <button type="submit" disabled={isPublicLinking} className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-teal-600 transition cursor-pointer">
                      {isPublicLinking ? (
                        <span className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {publicConnectError && (
                    <p className="text-rose-500 text-[10px] font-sans mt-1.5 leading-normal">{publicConnectError}</p>
                  )}
                </div>
              </form>

              <div className="relative py-2 text-center" id="sheet_or_divider">
                <span className="absolute inset-y-4 left-0 right-0 border-t border-slate-100 pointer-events-none" />
                <span className="relative z-10 px-3 bg-white text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">or</span>
              </div>

              <button
                type="button"
                onClick={onCreateSpreadsheet}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl ring-1 ring-teal-200 ring-inset bg-teal-50/50 text-teal-700 text-xs font-semibold hover:bg-teal-50 transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                id="create_sheet_btn"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    시트 생성 중...
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    새 구글 스프레드시트 만들기
                  </>
                )}
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] text-slate-500 font-sans space-y-2">
              <p className="font-semibold text-slate-600">💡 구글 시트 데이터베이스 가이드:</p>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li>생성 시트에는 <strong>Users</strong> 탭이 생성됩니다.</li>
                <li>첫 행에는 <code className="font-mono bg-white px-1 py-0.5 rounded text-teal-600 font-bold">전화번호, 비밀번호, 이름, 이메일, 기타 정보, 등록일</code> 헤더가 할당됩니다.</li>
                <li>이후 로그인은 엑셀 행을 직접 읽어서 즉석 매칭합니다.</li>
              </ul>
            </div>
          </div>

          {/* RIGHT: REALTIME MEMBERS LIST TABLE (Col 2 & 3) */}
          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-3xl p-6 shadow-md space-y-4" id="members_table_box">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 pb-2" id="members_table_header">
              <div>
                <h4 className="text-md font-bold text-slate-800 font-sans flex items-center gap-2">
                  <Database className="w-4.5 h-4.5 text-teal-600" />
                  실시간 회원 데이터베이스 로우
                </h4>
                <p className="text-xs text-slate-400 font-sans">구글스프레드시트에서 조회가 허가된 행 데이터 리스트입니다.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onRefreshData}
                  disabled={isLoading || !spreadsheet}
                  className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer disabled:opacity-50"
                  title="스프레드시트 데이터 동기화 리프레시"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  disabled={!spreadsheet}
                  onClick={() => setShowAddModal(true)}
                  className="py-2 px-3.5 rounded-xl bg-slate-900 font-medium text-white text-xs hover:bg-slate-800 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  id="admin_add_member_btn"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  행 추가
                </button>
              </div>
            </div>

            {/* SEARCH AND COUNT */}
            <div className="flex items-center justify-between gap-4" id="search_panel">
              <div className="relative flex-1 max-w-xs">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  placeholder="이름, 전화번호, 기타 정보 검색"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-3 pl-9 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-teal-500 focus:ring-1 focus:ring-teal-100 outline-none text-xs text-slate-800"
                />
              </div>
              <span className="text-xs text-slate-400 font-sans">
                총 <strong>{filteredUsers.length}</strong>명 조회됨
              </span>
            </div>

            {/* TABLE GRID */}
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs" id="table_spinning_loader">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                <span>스프레드시트에서 데이터를 안전하게 불러오고 있습니다...</span>
              </div>
            ) : !spreadsheet ? (
              <div className="py-20 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-8 space-y-3" id="no_sheet_table_placeholder">
                <div className="p-3 bg-rose-50 text-rose-500 rounded-full">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-slate-800 font-sans">데이터베이스 시트 미연동</h5>
                  <p className="text-xs text-slate-400 font-sans mt-0.5 max-w-sm">구글 스프레드시트가 연결되어야 실시간 회원 목록을 확인할 수 있습니다.</p>
                </div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-16 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-8 text-slate-400 text-xs space-y-2" id="table_empty_placeholder">
                <span>데이터 베이스 행이 비어있습니다.</span>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="text-xs font-bold text-teal-600 underline cursor-pointer"
                >
                  새로운 첫 번째 회원 등록하기
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-2xl" id="admin_sheet_table_wrapper">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-mono font-semibold border-b border-slate-100">
                      <th className="px-4 py-3 text-[10px] tracking-wider">이름</th>
                      <th className="px-4 py-3 text-[10px] tracking-wider">전화번호</th>
                      <th className="px-4 py-3 text-[10px] tracking-wider">비밀번호</th>
                      <th className="px-4 py-3 text-[10px] tracking-wider">이메일</th>
                      <th className="px-4 py-3 text-[10px] tracking-wider">기타 정보</th>
                      <th className="px-4 py-3 text-[10px] tracking-wider">가입일</th>
                      <th className="px-4 py-3 text-[10px] tracking-wider text-right">삭제</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700">
                    {filteredUsers.map((user, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3 font-semibold text-slate-800">{user.name}</td>
                        <td className="px-4 py-3 font-mono">{user.phoneNumber}</td>
                        <td className="px-4 py-3 font-mono text-slate-400">
                          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-sans text-slate-600">{user.password}</code>
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-[120px] truncate">{user.email || '-'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{user.otherInfo || '-'}</td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-[10px]">{user.registeredDate}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onDeleteUser(user.phoneNumber)}
                            className="p-1.5 hover:bg-rose-50 hover:text-rose-500 rounded-lg text-slate-400 transition cursor-pointer"
                            title={`${user.name} 회원 삭제`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* NOT AUTHENTICATED STATE IN ADMIN CONSOLE */
        <div className="py-12 border border-dashed border-slate-200 rounded-3xl bg-white shadow-sm text-center flex flex-col items-center justify-center p-8 max-w-2xl mx-auto space-y-6" id="admin_console_guest_prompt">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <KeyRound className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-bold text-slate-800 font-sans">구글 스프레드시트 데이터베이스 지정</h4>
            <p className="text-xs text-slate-400 font-sans max-w-md mx-auto">
              구글 드라이브 시트에 회원/사용자 데이터를 안전하게 저장하고 조회합니다.
              로그인 생략형(공개 공유링크) 또는 구글 API 연동 방식을 선택해 지정해 주세요.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full pt-4 border-t border-slate-100">
            {/* Left: Google Sign-In */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/60 flex flex-col items-center justify-between space-y-4">
              <div className="text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase font-mono block mb-1">방법 1. 구글 인증형 (읽기/쓰기 가능)</span>
                <p className="text-[10px] text-slate-400 font-sans">관리자 권한의 구글 계정으로 연결하여 실시간 저장 및 엑셀 수정 제어가 가능합니다.</p>
              </div>
              <button
                type="button"
                onClick={onGoogleSignIn}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Database className="w-4 h-4 text-teal-400" />
                구글 연동 로그인
              </button>
            </div>

            {/* Right: Direct Public Connection */}
            <div className="p-4 bg-teal-50/20 rounded-2xl border border-teal-100/50 flex flex-col items-center justify-between space-y-4">
              <div className="text-center">
                <span className="text-[11px] font-bold text-teal-700 uppercase font-mono block mb-1">방법 2. 공유링크 직접 연동 (조회 전용)</span>
                <p className="text-[10px] text-slate-400 font-sans">구글 로그인 없이 시트 공유 설정을 "링크가 있는 모든 사용자 - 뷰어"로 하신 후 바로 사용합니다.</p>
              </div>
              <form onSubmit={handlePublicConnectSubmit} className="w-full space-y-1.5">
                <div className="relative">
                  <input
                    required
                    type="text"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={publicSpreadsheetInput}
                    onChange={(e) => setPublicSpreadsheetInput(e.target.value)}
                    className="w-full pr-10 pl-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-teal-500 outline-none text-xs text-slate-800 font-sans shadow-2xs"
                  />
                  <button type="submit" disabled={isPublicLinking} className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-teal-600 transition cursor-pointer">
                    {isPublicLinking ? (
                      <span className="w-3.5 h-3.5 border-1.5 border-teal-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 text-teal-600" />
                    )}
                  </button>
                </div>
                {publicConnectError && (
                  <p className="text-rose-500 text-[10px] font-sans text-left leading-normal">{publicConnectError}</p>
                )}
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN ADD USER MODAL PANEL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition" id="add_user_modal">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
          >
            <div className="bg-slate-950 px-6 py-5 text-white flex items-center justify-between">
              <h5 className="text-sm font-bold font-sans flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-teal-400" />
                신규 회원 행 직접 삽입
              </h5>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setAddError('');
                }}
                className="text-slate-400 hover:text-white transition outline-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 text-left">
              {addError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-[11px] font-sans">
                  ⚠️ {addError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">
                  전화번호 *
                </label>
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  placeholder="010-1111-2222"
                  value={newPhone}
                  onChange={(e) => {
                    const formatted = formatNewPhone(e.target.value);
                    if (formatted.length <= 13) setNewPhone(formatted);
                  }}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-100 outline-none text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">
                  비밀번호 *
                </label>
                <input
                  required
                  type="text"
                  placeholder="로그인에 사용할 비밀번호 (최소 4자)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-100 outline-none text-xs text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">
                    이름 *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="이름"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-100 outline-none text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">
                    이메일
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. email@com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-100 outline-none text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-1">
                  기타 정보
                </label>
                <input
                  type="text"
                  placeholder="예: 영업팀 대리, VIP 고객, 메모 등"
                  value={newOther}
                  onChange={(e) => setNewOther(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-100 outline-none text-xs text-slate-800"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition shadow-sm cursor-pointer"
                >
                  행 직접 삽입
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
