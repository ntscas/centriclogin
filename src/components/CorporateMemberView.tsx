import React from 'react';
import { Phone, Building2, ShieldCheck, Mail, ArrowRight, UserCheck } from 'lucide-react';

interface CorporateMemberViewProps {
  userName?: string;
}

export default function CorporateMemberView({ userName }: CorporateMemberViewProps) {
  return (
    <div className="flex-1 w-full bg-slate-50/50 p-4 md:p-8 flex flex-col justify-center items-center min-h-[600px] font-sans" id="corporate_member_view">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden" id="corporate_content_card">
        {/* Editorial style banner */}
        <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 px-6 py-8 md:px-10 md:py-12 text-white relative overflow-hidden" id="corporate_banner">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent)] pointer-events-none" />
          <div className="relative z-10 flex flex-col gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-xs text-teal-200 self-start font-semibold uppercase tracking-wider" id="corporate_badge">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
              Corporate Member
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white font-sans">
              기업회원 전용 서비스
            </h2>
            <p className="text-teal-100/90 text-sm font-sans max-w-lg mt-1 leading-relaxed">
              {userName ? <strong className="text-emerald-300">{userName}</strong> : '기업'} 회원님, 환영합니다. 비즈니스 세무 및 요청사항에 대해 전담 전문가들이 신속하고 진정성 있는 해답을 제공해 드립니다.
            </p>
          </div>
        </div>

        {/* Support details */}
        <div className="p-6 md:p-10 space-y-8" id="corporate_main_content">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 md:p-6" id="welcome_guide_message">
            <h3 className="font-bold text-slate-800 text-base mb-2 font-sans flex items-center gap-2">
              <span className="text-xl select-none">💬</span>
              안내 및 도움말
            </h3>
            <p className="text-slate-600 text-xs md:text-sm leading-relaxed font-sans">
              기업회원님께서는 비즈니스 애로사항이나 추가 세무 지원 요청이 있으신 경우, 서류 작성이나 불편한 문의 게시판 대신 아래의 전담 안내처로 연락해 주시면 가장 빠르고 실무적인 맞춤형 피드백을 전달해 드리겠습니다.
            </p>
          </div>

          <div className="space-y-4" id="corporate_contacts_section">
            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-bold font-mono pl-1" id="contacts_title">
              전담 비즈니스 지원센터
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="contacts_grid">
              {/* Contact Card 1: Kang */}
              <div 
                className="bg-white border border-slate-200/80 hover:border-teal-200 hover:shadow-md rounded-2xl p-5 flex flex-col justify-between transition-all group scale-100 active:scale-98"
                id="contact_card_kang"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-teal-50 group-hover:bg-teal-100 text-teal-700 p-2.5 rounded-xl transition-colors">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 text-base block">강승윤 대표</span>
                        <span className="text-[10px] text-teal-600 font-bold tracking-wider uppercase">Executive Representative</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-500 text-xs leading-normal font-sans mb-4">
                    종합 기업 세무 전략 수립 및 법인 컨설팅 총괄
                  </p>
                </div>

                <a 
                  href="tel:01099306889"
                  className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm group-hover:shadow-md"
                  id="call_btn_kang"
                >
                  <Phone className="w-4 h-4 text-white" />
                  010-9930-6889 전화 연결
                </a>
              </div>

              {/* Contact Card 2: Lee */}
              <div 
                className="bg-white border border-slate-200/80 hover:border-teal-200 hover:shadow-md rounded-2xl p-5 flex flex-col justify-between transition-all group scale-100 active:scale-98"
                id="contact_card_lee"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-teal-50 group-hover:bg-teal-100 text-teal-700 p-2.5 rounded-xl transition-colors">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 text-base block">이명진 전무</span>
                        <span className="text-[10px] text-teal-600 font-bold tracking-wider uppercase">Senior Managing Director</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-500 text-xs leading-normal font-sans mb-4">
                    세무 조사 대응 파트 총괄 및 실무 긴급 요청사항 해결
                  </p>
                </div>

                <a 
                  href="tel:01091228218"
                  className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm group-hover:shadow-md"
                  id="call_btn_lee"
                >
                  <Phone className="w-4 h-4 text-white" />
                  010-9122-8218 전화 연결
                </a>
              </div>
            </div>
          </div>

          {/* Quick Notice footer block */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-400" id="corporate_info_footer">
            <span className="flex items-center gap-1 font-sans">
              <ShieldCheck className="w-4 h-4 text-teal-500" />
              CENTRIC AI는 대한민국 대표 법인 및 기업 회원과 함께합니다.
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              지원 시간 : 24시간 언제는 연락 가능
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
