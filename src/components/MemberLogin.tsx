import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Phone, Lock, Eye, EyeOff, UserPlus, LogIn, Sparkles, Building2, User, 
  Mail, FileText, CheckCircle2, Smartphone, Copy, Check 
} from 'lucide-react';
import { UserRow } from '../types';

// Robust LocalStorage getter helper for sandbox safety
const safeGetLocalStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('LocalStorage access is blocked or restricted:', e);
    return null;
  }
};

interface MemberLoginProps {
  onLogin: (phoneNumber: string, password: string, rememberMe: boolean) => Promise<boolean>;
  onRegister: (user: UserRow) => Promise<boolean>;
  isLoading: boolean;
  errorMsg: string;
  connectedSheet: { title: string; spreadsheetId: string } | null;
  totalUsersCount: number;
  deferredPrompt: any;
  onInstallApp: () => void;
}

export default function MemberLogin({ 
  onLogin, 
  onRegister, 
  isLoading: isActionLoading, 
  errorMsg,
  connectedSheet,
  totalUsersCount,
  deferredPrompt,
  onInstallApp
}: MemberLoginProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(() => {
    return safeGetLocalStorage('auto_login_phone') || '';
  });
  const [password, setPassword] = useState(() => {
    return safeGetLocalStorage('auto_login_pw') || '';
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    const saved = safeGetLocalStorage('auto_login_enabled');
    return saved === null ? true : saved === 'true';
  });
  
  // Registration States
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regOtherInfo, setRegOtherInfo] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  
  const [localError, setLocalError] = useState('');
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showInAppGuide, setShowInAppGuide] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // In-app webview detector for KakaoTalk and Naver
  const [isInAppWebView] = useState(() => {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      return ua.includes('kakaotalk') || ua.includes('naver');
    }
    return false;
  });

  const fallbackCopyText = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
      }
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
  };

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 3000);
        })
        .catch(() => {
          fallbackCopyText(url);
        });
    } else {
      fallbackCopyText(url);
    }
  };

  const handleOpenExternalBrowser = () => {
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.href;
      if (navigator.userAgent.toLowerCase().includes('kakaotalk')) {
        window.location.href = `kakaotalk://web/openExternalApp?url=${encodeURIComponent(currentUrl)}`;
      } else {
        alert("상단 오른쪽[...] 버튼 또는 메뉴 버튼을 눌러 '기본 브라우저로 열기(Safari/Chrome)'를 선택해 주세요. 해당 모드로 전환해야 로그인이 항시 유지됩니다!");
      }
    }
  };

  // Auto-format phone number: e.g. 01012345678 -> 010-1234-5678
  const formatPhoneNumber = (val: string) => {
    const numbers = val.replace(/[^0-9]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
    const formatted = formatPhoneNumber(e.target.value);
    if (formatted.length <= 13) {
      setter(formatted);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    
    if (!phoneNumber) {
      setLocalError('전화번호를 입력해 주세요.');
      return;
    }
    if (phoneNumber.replace(/[^0-9]/g, '').length < 10) {
      setLocalError('올바른 전화번호 형식이 아닙니다.');
      return;
    }
    if (!password) {
      setLocalError('비밀번호를 입력해 주세요.');
      return;
    }

    const success = await onLogin(phoneNumber, password, rememberMe);
    if (!success) {
      // Detailed error will be handled by parent/errorMsg
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    const plainPhone = regPhone.replace(/[^0-9]/g, '');
    if (!regPhone || plainPhone.length < 10) {
      setLocalError('올바른 전화번호를 입력해 주세요. (예: 010-1234-5678)');
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setLocalError('비밀번호는 최소 4자리 이상이어야 합니다.');
      return;
    }
    if (!regName.trim()) {
      setLocalError('이름을 입력해 주세요.');
      return;
    }

    const newUser: UserRow = {
      phoneNumber: regPhone,
      password: regPassword,
      name: regName.trim(),
      email: regEmail.trim(),
      otherInfo: regOtherInfo.trim() || '일반 회원',
      registeredDate: new Date().toISOString().split('T')[0]
    };

    const success = await onRegister(newUser);
    if (success) {
      // Switch back to login, auto-fill credentials
      setPhoneNumber(regPhone);
      setPassword(regPassword);
      setIsSignUp(false);
      // Reset registration form
      setRegPhone('');
      setRegPassword('');
      setRegName('');
      setRegEmail('');
      setRegOtherInfo('');
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden self-center mx-auto" id="login_component_wrapper">
      {/* Visual Header */}
      <div className="bg-slate-900 px-8 py-8 text-center relative overflow-hidden" id="login_visual_header">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(100,116,139,0.15),transparent)] pointer-events-none" />
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-slate-800 text-teal-400 mb-4 shadow-inner" id="login_logo_badge">
          <Building2 className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold font-sans tracking-tight text-white mb-1">
          {isSignUp ? '신규 회원가입' : '사용자 로그인'}
        </h2>
        <p className="text-slate-400 text-sm font-sans">
          {isSignUp ? '사용자 정보를 스프레드시트에 안전하게 등록합니다' : '전화번호와 비밀번호로 간편하게 본인인증하기'}
        </p>
      </div>

      {/* Forms Segment */}
      <div className="p-8" id="login_form_section">

        {/* PWA App Install Banner: ALWAYS visible so users can easily see and install it on ANY platform */}
        <div className="mb-5 p-4 rounded-2xl bg-teal-50 border border-teal-100 text-xs leading-relaxed font-sans text-teal-800 shadow-xs" id="pwa_install_banner">
          <div className="flex items-start gap-2.5">
            <span className="text-sm mt-0.5 select-none">📱</span>
            <div className="flex-1">
              <span className="font-bold block text-sm mb-1 text-teal-900 flex items-center gap-1.5">
                홈 화면에 앱 추가
                <span className="inline-block py-0.5 px-1.5 bg-teal-600/10 text-[10px] text-teal-700 font-bold rounded-md uppercase tracking-wider">추천 PWA</span>
              </span>
              <p className="text-teal-700/90 mb-3">
                바탕화면에 앱으로 설치하여 매번 주소 입력 없이 원클릭 접속과 끊김없는 자동 로그인을 누리세요!
              </p>
              
              {deferredPrompt ? (
                /* Native browser prompt is supported and ready */
                <button
                  type="button"
                  onClick={onInstallApp}
                  className="w-full py-2.5 px-3 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  id="installBtn"
                >
                  <Smartphone className="w-3.5 h-3.5 text-white" />
                  CENTRIC AI 원클릭 앱 설치하기
                </button>
              ) : (
                /* Browser prompt not dispatched yet (e.g., iOS Safari, in-app webview or iframe) */
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowInstallGuide(!showInstallGuide)}
                    className="w-full py-2.5 px-3 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
                    id="install_guide_toggle_btn"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-white" />
                    {showInstallGuide ? '설치 안내 닫기' : 'CENTRIC AI 앱 설치 방법 보기'}
                  </button>

                  {showInstallGuide && (
                    <div className="mt-3 p-3.5 bg-white border border-teal-100/80 rounded-xl space-y-3.5 text-slate-700 shadow-inner animate-fadeIn" id="manual_install_instructions">
                      {/* iOS Safari */}
                      <div>
                        <span className="font-bold text-teal-900 block text-[11px] mb-1">🍎 아이폰 (Safari)</span>
                        <ol className="list-decimal pl-4 space-y-0.5 text-slate-600">
                          <li>Safari 브라우저 하단 central 바의 <strong className="text-teal-800 text-[12px]">공유 버튼(네모 속의 위 화살표 ⎙ 또는 ⎋)</strong>을 누릅니다.</li>
                          <li>메뉴를 아래로 내려 <strong className="text-teal-800">‘홈 화면에 추가’</strong>를 선택해 주세요.</li>
                        </ol>
                      </div>

                      {/* Android / Samsung / Chrome */}
                      <div className="border-t border-slate-100 pt-3">
                        <span className="font-bold text-teal-900 block text-[11px] mb-1">🤖 안드로이드 (크롬 / 삼성 인터넷)</span>
                        <ol className="list-decimal pl-4 space-y-0.5 text-slate-600">
                          <li>우측 상단 혹은 하단의 <strong className="text-teal-800">메뉴 버튼(세로 점 3개 ⋮ 또는 줄 3개 ☰)</strong>을 누릅니다.</li>
                          <li>메뉴에서 <strong className="text-teal-800">‘앱 설치’</strong> 또는 <strong className="text-teal-800">‘홈 화면에 추가’</strong>를 선택해 주세요.</li>
                        </ol>
                      </div>

                      {/* PC Chrome / Whale */}
                      <div className="border-t border-slate-100 pt-3">
                        <span className="font-bold text-teal-900 block text-[11px] mb-1">💻 PC 데스크톱 (크롬 / 웨일 / 엣지)</span>
                        <p className="pl-1 text-slate-600 leading-normal">
                          브라우저 주소창 최우측 부근의 <strong className="text-teal-800">설치 및 다운로드 아이콘(⊕ 또는 화살표 대지 모양)</strong>을 클릭하시면 즉시 앱으로 독립 설치됩니다.
                        </p>
                      </div>

                      {/* Inside Iframe Info */}
                      <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-lg text-amber-900">
                        <strong className="text-[10px] block mb-0.5">⚠️ 주의사항</strong>
                        포탈 인앱 웹뷰(카카오톡, 네이버 앱 등)나 미리보기 웹 화면 내에서는 브라우저 보안 제약으로 직접 설치가 제한될 수 있습니다. 꼭 우측 상단의 <strong>'새 창'</strong> 혹은 <strong>외부 브라우저(크롬, 사파리)</strong>로 이동한 상태에서 설정을 진행해 주세요.
                      </div>
                    </div>
                  )}

                  {/* KakaoTalk / Naver Toggleable Warning */}
                  {isInAppWebView && (
                    <div className="pt-1 border-t border-dashed border-teal-100/80">
                      <button
                        type="button"
                        onClick={() => setShowInAppGuide(!showInAppGuide)}
                        className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5 mt-1"
                        id="inapp_guide_toggle_btn"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                        {showInAppGuide ? '카카오톡/네이버 간편접속 안내 닫기' : '카카오톡/네이버 로그인 풀림 해결방법 보기'}
                      </button>

                      {showInAppGuide && (
                        <div className="mt-3 p-4 rounded-xl bg-white border border-amber-200 text-xs leading-relaxed font-sans text-amber-950 shadow-inner animate-fadeIn space-y-3" id="inapp_webview_banner_toggleable">
                          <div>
                            <span className="font-bold block text-sm mb-1 text-slate-900">카카오톡/네이버 인앱 브라우저 안내</span>
                            <p className="text-amber-800">
                              카카오톡이나 네이버 앱 내부에서 열린 화면은 닫힐 때 <span className="underline font-semibold">자동 로그인이 풀리며, 홈 화면 앱 추가(PWA)가 어렵습니다.</span> 보다 안정적인 로그인 상태 유지와 앱 설치를 위해 아래 가이드 항목 중 편하신 방법을 선택해 주세요!
                            </p>
                          </div>

                          {/* Option buttons */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={handleOpenExternalBrowser}
                              className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center justify-center gap-1.5"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              자동으로 외부 앱 열기
                            </button>

                            <button
                              type="button"
                              onClick={handleCopyLink}
                              className={`w-full py-2.5 px-3 font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                                copySuccess 
                                  ? 'bg-teal-600 text-white hover:bg-teal-700' 
                                  : 'bg-white border border-amber-300 text-slate-800 hover:bg-amber-100'
                              }`}
                            >
                              {copySuccess ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-white" />
                                  주소 복사 완료!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                                  주소(URL) 직접 복사하기
                                </>
                              )}
                            </button>
                          </div>

                          {copySuccess && (
                            <div className="text-[10px] text-teal-800 font-bold bg-teal-50 border border-teal-100 p-2 rounded-lg text-center animate-fadeIn">
                              👍 주소가 복사되었습니다! 크롬(Chrome)이나 사파리(Safari) 앱 주소바에 붙여넣어 접속해 주세요.
                            </div>
                          )}

                          {/* Manual guide for KakaoTalk default features */}
                          <div className="border-t border-amber-200/50 pt-2.5 text-[11px] text-amber-800 space-y-1">
                            <strong className="block text-slate-900">💡 카카오톡 기본 메뉴로 여는 방법 (권장):</strong>
                            <ul className="list-disc pl-4 space-y-1 text-slate-700 font-sans">
                              <li>
                                <strong>아이폰(iOS):</strong> 카카오톡 화면 우측 하단의 <strong className="text-amber-950">더보기(...) 버튼</strong> 또는 인터넷 창의 <strong className="text-amber-950 font-bold">오른쪽 하단 점 3개(⋯)</strong>를 누르신 뒤 <strong className="text-amber-950">[기본 브라우저로 열기]</strong>를 누르면 사파리(Safari)로 이동합니다.
                              </li>
                              <li>
                                <strong>안드로이드(Android):</strong> 카카오톡 화면 우측 하단의 <strong className="text-amber-950 font-bold">더보기(⋮ 또는 ☰)</strong> 메뉴를 누르신 후 <strong className="text-amber-950 font-bold font-sans">[다른 브라우저로 열기]</strong>를 터치해 주시면 크롬(Chrome)으로 자동 이동합니다.
                              </li>
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error notification banner */}
        {(errorMsg || localError) && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs leading-relaxed font-sans flex items-start gap-2.5"
            id="login_error"
          >
            <span className="font-semibold select-none mt-0.5 opacity-90">⚠️</span>
            <div className="flex-1 font-medium">{localError || errorMsg}</div>
          </motion.div>
        )}

        {!isSignUp ? (
          // LOGIN FORM
          <form onSubmit={handleLoginSubmit} className="space-y-5" id="signin_form">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 font-mono" htmlFor="signin_phone">
                전화번호 (CONTACT)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  id="signin_phone"
                  name="username"
                  autoComplete="username"
                  required
                  type="text"
                  inputMode="numeric"
                  placeholder="010-1234-5678"
                  value={phoneNumber}
                  onChange={(e) => handlePhoneChange(e, setPhoneNumber)}
                  className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-slate-800 font-medium placeholder-slate-400 font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 font-mono" htmlFor="signin_password">
                비밀번호 (PASSWORD)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="signin_password"
                  name="password"
                  autoComplete="current-password"
                  required
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-slate-800 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3.5 flex items-center text-slate-400 hover:text-slate-600 outline-none pr-1.5"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs py-1" id="login_options_wrapper">
              <label className="flex items-center gap-2 text-slate-600 font-medium cursor-pointer select-none" id="remember_me_label">
                <input
                  id="remember_me_checkbox"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 accent-teal-600"
                />
                로그인 상태 유지 (자동 로그인)
              </label>
            </div>

            <button
              id="signin_submit_btn"
              type="submit"
              disabled={isActionLoading}
              className="w-full py-3 px-4 rounded-xl border border-transparent bg-slate-950 text-white font-medium hover:bg-slate-800 focus:ring-2 focus:ring-slate-300 transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isActionLoading ? (
                <>
                  <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                  로그인 확인 중...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  회원 로그인
                </>
              )}
            </button>
          </form>
        ) : (
          // SIGN UP (REGISTER) FORM
          <form onSubmit={handleRegisterSubmit} className="space-y-4" id="signup_form">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 font-mono" htmlFor="signup_phone">
                전화번호 (Phone) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  id="signup_phone"
                  required
                  type="text"
                  inputMode="numeric"
                  placeholder="010-1234-5678"
                  value={regPhone}
                  onChange={(e) => handlePhoneChange(e, setRegPhone)}
                  className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-slate-800 font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 font-mono" htmlFor="signup_password">
                비밀번호 (Password) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="signup_password"
                  required
                  type={showRegPassword ? 'text' : 'password'}
                  placeholder="비밀번호 설정 (4자리 이상)"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-2.5 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-slate-800 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute inset-y-0 right-3.5 flex items-center text-slate-400 hover:text-slate-600 outline-none"
                >
                  {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 font-mono" htmlFor="signup_name">
                  이름 (Name) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="signup_name"
                    required
                    type="text"
                    placeholder="홍길동"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-slate-800 font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 font-mono" htmlFor="signup_email">
                  이메일 (Email)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="signup_email"
                    type="email"
                    placeholder="user@exam.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-slate-800 font-sans"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 font-mono" htmlFor="signup_other">
                기타 정보 (Other Info)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                  <FileText className="w-4 h-4" />
                </span>
                <input
                  id="signup_other"
                  type="text"
                  placeholder="예: 영업부 과장, 특별 할인 등"
                  value={regOtherInfo}
                  onChange={(e) => setRegOtherInfo(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none transition text-slate-800 font-sans"
                />
              </div>
            </div>

            <button
              id="signup_submit_btn"
              type="submit"
              disabled={isActionLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl border border-transparent bg-teal-600 text-white font-medium hover:bg-teal-700 focus:ring-2 focus:ring-teal-200 transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isActionLoading ? (
                <>
                  <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                  구글 시트에 회원 저장 중...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  가입 완료 및 시트 동기화
                </>
              )}
            </button>
          </form>
        )}

        {/* Form Toggle Slider Footer */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center" id="switch_form_footer">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setLocalError('');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-800 tracking-wide font-sans cursor-pointer transition select-none"
          >
            {isSignUp ? (
              <>
                기존 계정이 있으신가요? <span className="underline">로그인하기</span>
              </>
            ) : (
              <>
                아직 회원이 아니신가요? <span className="underline font-bold">1초만에 회원가입</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
