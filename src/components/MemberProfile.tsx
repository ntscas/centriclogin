import { motion } from 'motion/react';
import { User, Phone, Mail, Calendar, LogOut, CheckCircle2, ChevronRight, FileText, Badge, X } from 'lucide-react';
import { UserRow } from '../types';

interface MemberProfileProps {
  user: UserRow;
  onLogout: () => void;
  spreadsheetName?: string;
  onClose?: () => void;
}

export default function MemberProfile({ user, onLogout, spreadsheetName, onClose }: MemberProfileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-lg bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden self-center mx-auto relative"
      id="profile_component_wrapper"
    >
      {/* Close button if provided with onClose action */}
      {onClose && (
        <button
          onClick={onClose}
          type="button"
          className="absolute top-5 right-5 z-20 p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-full transition cursor-pointer"
          title="닫기"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Dynamic Colored Header */}
      <div className="bg-slate-900 px-8 py-10 relative overflow-hidden" id="profile_visual_header">
        <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-400 to-indigo-500 flex items-center justify-center text-white shadow-lg text-2xl font-bold font-sans">
            {user.name[0]}
          </div>
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold mb-2 font-sans">
              <CheckCircle2 className="w-3.5 h-3.5" />
              인증완료
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight font-sans">
              {user.name} 님, 환영합니다!
            </h2>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="p-8 space-y-6" id="profile_details_section">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest font-mono border-b border-slate-100 pb-2">
          회원 프로필 상세 정보
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="profile_details_grid">
          {/* Phone row */}
          <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-100" id="profile_detail_phone">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-600">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">전화번호</span>
              <span className="text-sm font-semibold text-slate-700 font-sans">{user.phoneNumber}</span>
            </div>
          </div>

          {/* Email row */}
          <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-100" id="profile_detail_email">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">이메일</span>
              <span className="text-sm font-semibold text-slate-700 font-sans truncate max-w-[150px]">
                {user.email || '미등록'}
              </span>
            </div>
          </div>

          {/* Custom Info Row */}
          <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-100 md:col-span-2" id="profile_detail_other">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <span className="block text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">기타 정보</span>
              <span className="text-sm font-bold text-slate-800 font-sans">{user.otherInfo || '기타 기록 없음'}</span>
            </div>
          </div>

          {/* Date row */}
          <div className="flex items-center gap-3.5 p-4 rounded-xl bg-slate-50 border border-slate-100 md:col-span-2" id="profile_detail_date">
            <div className="p-2 rounded-lg bg-slate-200/50 text-slate-600">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="block text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">회원 가입일</span>
              <span className="text-sm font-semibold text-slate-600 font-sans">{user.registeredDate || '기록 없음'}</span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="pt-2 flex gap-4" id="profile_actions">
          <button
            id="profile_logout_btn"
            onClick={onLogout}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition active:scale-98 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            안전 로그아웃
          </button>
        </div>
      </div>
    </motion.div>
  );
}
