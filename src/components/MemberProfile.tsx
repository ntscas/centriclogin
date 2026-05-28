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

        {/* WebView Integration Guide for App Developers */}
        <div className="pt-1" id="webview-dev-guide">
          <details className="group border border-teal-100 rounded-xl bg-teal-50/20 overflow-hidden transition-all duration-200">
            <summary className="flex items-center justify-between p-3.5 cursor-pointer select-none">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600">
                  <FileText className="w-4 h-4 text-teal-600" />
                </div>
                <div className="text-left">
                  <span className="block text-xs font-bold text-slate-700 font-sans">WebView 앱 빌드 및 구글 로그인 해법 가이드</span>
                  <span className="text-[9.5px] text-slate-500 font-sans mt-0.5">앱(WebView)에서 새창(target="_blank") 및 세션 유지를 적용하기 위한 조치</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform duration-200 shrink-0" />
            </summary>
            
            <div className="p-4 pt-1.5 border-t border-teal-100/40 text-[11px] text-slate-600 space-y-3 font-sans leading-relaxed max-h-[220px] overflow-y-auto scrollbar-thin">
              <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-2.5 text-amber-800 text-[10px]">
                💡 <strong>핵심 요약:</strong> 제미나이(Google)는 보안상 <strong>기본 인앱 웹뷰에서의 로그인을 차단</strong>하며, 새 창(target="_blank")은 앱 외부 브라우저로 열려 세션이 소실됩니다. 아래의 네이티브 App 소스코드를 웹뷰 앱 빌드 프로젝트에 복사하여 적용하면 동일 화면 내에서 즉시 로그인 유지가 가능해집니다.
              </div>

              <div>
                <span className="font-bold text-slate-800">1. 새 창(target="_blank") 외부 유출 방지 및 한 창 로드</span>
                <p className="mt-0.5 text-slate-500">
                  모바일 앱 개발 시 새창 열기 방지 및 현재 Webview 영역 안에서만 외부 링크(제미나이 등)가 이동하게 강제합니다:
                </p>
                <div className="mt-1.5 p-2 bg-slate-900 text-slate-200 rounded-lg font-mono text-[9px] overflow-x-auto whitespace-pre">
{`// Android (Kotlin) WebChromeClient & Window 제어
webView.settings.setSupportMultipleWindows(false) // 다중 창 미지원하여 단순 로드
// 또는 WebChromeClient에서 onCreateWindow를 오버라이드하여 
// webView.loadUrl(requestUrl) 로 현재 뷰에 덮어씌웁니다.`}
                </div>
                <div className="mt-1 p-2 bg-slate-900 text-slate-200 rounded-lg font-mono text-[9px] overflow-x-auto whitespace-pre">
{`// iOS (Swift / WKWebViewDelegate)
func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
    if navigationAction.targetFrame == nil {
        webView.load(navigationAction.request) // 새창을 무시하고 내부 로드 처리
    }
    return nil
}`}
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-800">2. 웹뷰 내 구글 소셜 로그인 차단 우회 (User-Agent 설정)</span>
                <p className="mt-0.5 text-slate-500">
                  구글은 WebView 식별값(Version/X.X)이 있으면 로그인을 차단합니다. 아래처럼 웹 브라우저 헤더로 UserAgent를 교체하면 로그인 창이 승인됩니다.
                </p>
                <div className="mt-1.5 p-2 bg-slate-900 text-slate-200 rounded-lg font-mono text-[9px] overflow-x-auto whitespace-pre">
{`// Android User-Agent 하드코딩 우회
val customUA = "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36"
webView.settings.userAgentString = customUA`}
                </div>
                <div className="mt-1 p-2 bg-slate-900 text-slate-200 rounded-lg font-mono text-[9px] overflow-x-auto whitespace-pre">
{`// iOS WKWebView User-Agent 교체
webView.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"`}
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-800">3. 쿠키 저장소 허용 및 제미나이(Google) 로그인 세션 공유</span>
                <p className="mt-0.5 text-slate-500">
                  앱을 재로그인해도 구글 세션 쿠키가 보관되도록 설정하여 매번 로그인하는 번거로움을 제거합니다.
                </p>
                <div className="mt-1.5 p-2 bg-slate-900 text-slate-200 rounded-lg font-mono text-[9px] overflow-x-auto whitespace-pre">
{`// Android (Kotlin) 쿠키 및 도메인 쿠키 허용
val cookieManager = CookieManager.getInstance()
cookieManager.setAcceptCookie(true)
cookieManager.setAcceptThirdPartyCookies(webView, true)`}
                </div>
              </div>
            </div>
          </details>
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
