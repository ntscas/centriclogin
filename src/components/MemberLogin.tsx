import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Phone, Lock, Eye, EyeOff, UserPlus, LogIn, Sparkles, Building2, User, Mail, FileText } from 'lucide-react';
import { UserRow } from '../types';

interface MemberLoginProps {
  onLogin: (phoneNumber: string, password: string) => Promise<boolean>;
  onRegister: (user: UserRow) => Promise<boolean>;
  isLoading: boolean;
  errorMsg: string;
}

export default function MemberLogin({ onLogin, onRegister, isLoading: isActionLoading, errorMsg }: MemberLoginProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Registration States
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regOtherInfo, setRegOtherInfo] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  
  const [localError, setLocalError] = useState('');

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

    const success = await onLogin(phoneNumber, password);
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
