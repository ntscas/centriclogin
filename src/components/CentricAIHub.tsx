import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  FileCode, 
  TrendingUp, 
  ShieldAlert, 
  FileCheck, 
  FolderKanban, 
  History, 
  Settings, 
  HelpCircle, 
  Database, 
  FileSpreadsheet, 
  Sparkles, 
  BookOpen, 
  DownloadCloud, 
  Cpu, 
  Brain,
  ExternalLink,
  Loader2,
  AlertCircle
} from 'lucide-react';

export interface MenuItem {
  title: string;
  description: string;
  link: string;
  iconName: string;
  sortOrder: number;
  isVisible: boolean;
}

const GOOGLE_API_KEY = 'AIzaSyBS1kIHPn1j2iCL4npiitSo_6Sm0M42450';
const GOOGLE_SHEET_ID = '1CtvvJmwuEw1LA9GjGe1RncKMTdECQxwU-CVFkj122iA';
const SHEET_RANGE = 'Tax_Hub!A1:O';

// Map named icons to Lucide ones
const ICON_COMPONENTS: { [key: string]: React.ComponentType<any> } = {
  DocumentSearchIcon: FileCode,
  DataAnalysisIcon: TrendingUp,
  FraudDetectionIcon: ShieldAlert,
  ReportingIcon: FileCheck,
  CaseManagementIcon: FolderKanban,
  AuditTrailIcon: History,
  SettingsIcon: Settings,
  HelpIcon: HelpCircle,
  DataCollectionIcon: Database,
  FileListIcon: FileSpreadsheet,
  SparklesIcon: Sparkles,
  BookOpenIcon: BookOpen,
  FolderDownloadIcon: DownloadCloud,
  AIIcon: Cpu,
  AIIcon1: Brain
};

// Default fallback items if Sheets fails
const DEFAULT_MENU_ITEMS: MenuItem[] = [
  { title: "세무 법령 검색", description: "AI 기반 세법 및 판례 입체적 통합 검색", link: "https://centrictax.vercel.app/", iconName: "DocumentSearchIcon", sortOrder: 1, isVisible: true },
  { title: "데이터 분석", description: "대용량 납세 정보 및 과세 자료 심층 계량 분석", link: "https://centrictax.vercel.app/", iconName: "DataAnalysisIcon", sortOrder: 2, isVisible: true },
  { title: "탈세 혐의 탐지", description: "머신러닝 기반 이상 징후 조세 회피 분석 탐지", link: "https://centrictax.vercel.app/", iconName: "FraudDetectionIcon", sortOrder: 3, isVisible: true },
  { title: "조사 보고서", description: "조사 결과 보고서 및 해명서 조안 자동 초안 작성", link: "https://centrictax.vercel.app/", iconName: "ReportingIcon", sortOrder: 4, isVisible: true },
  { title: "사건 관리", description: "심판 청구, 불복 소송 진행 주기 및 타임라인", link: "https://centrictax.vercel.app/", iconName: "CaseManagementIcon", sortOrder: 5, isVisible: true },
  { title: "감사 로그", description: "보안 적정성 검토 및 감사 통제 추적 장치", link: "https://centrictax.vercel.app/", iconName: "AuditTrailIcon", sortOrder: 6, isVisible: true },
  { title: "자료 수집", description: "외부 전산망 및 유관 소명 대사 연계 모듈", link: "https://centrictax.vercel.app/", iconName: "DataCollectionIcon", sortOrder: 7, isVisible: true },
  { title: "시스템 설정", description: "전산 환경 및 연동 정보 종합 커스터마이징", link: "https://centrictax.vercel.app/", iconName: "SettingsIcon", sortOrder: 8, isVisible: true }
];

export default function CentricAIHub() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    fetchMenuItems();
    // Reset window scroll to 0 instantly on initial loading, ensuring pristine top placement
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById('centric_ai_hub_container')?.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById('app_root_layout')?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, []);

  // Automatically scroll up to ensure that the CENTRIC Tax AI title is perfectly visible 
  // and the search result grid is displayed from the very top right under the search box
  useEffect(() => {
    if (searchTerm.trim()) {
      const headerEl = document.getElementById('hub_header');
      if (headerEl) {
        headerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [searchTerm]);

  const fetchMenuItems = async () => {
    try {
      setLoading(true);
      setErrorCode(null);

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(SHEET_RANGE)}?key=${GOOGLE_API_KEY}`;
      
      const response = await fetch(url, { referrerPolicy: 'no-referrer' });
      
      if (!response.ok) {
        throw new Error(`Sheets API responded with error status: ${response.status}`);
      }

      const data = await response.json();
      const rows = data.values as string[][] | undefined;

      if (!rows || rows.length === 0) {
        throw new Error('No values found in Google sheet');
      }

      // Map rows skipping header
      const items: MenuItem[] = rows.slice(1).map(row => {
        const title = row[0] || '';
        const description = row[1] || '';
        const link = row[2] || '';
        const iconName = row[3] || 'AIIcon';
        const sortRaw = row[4];
        const sortOrder = (sortRaw !== undefined && sortRaw !== '' && !isNaN(Number(sortRaw))) 
                          ? Number(sortRaw) 
                          : 9999;
        const visibilityRaw = row[8];
        const isVisible = String(visibilityRaw).trim() === '1';

        return { title, description, link, iconName, sortOrder, isVisible };
      }).filter(item => item.isVisible);

      // Sort
      items.sort((a, b) => a.sortOrder - b.sortOrder);
      
      setMenuItems(items);
      setUsingFallback(false);
    } catch (err) {
      console.warn('CentricAIHub Google sheets loading failed, rendering local fallbacks:', err);
      // Fallback
      setMenuItems(DEFAULT_MENU_ITEMS);
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return menuItems;
    const term = searchTerm.toLowerCase().trim();
    return menuItems.filter(item => 
      item.title.toLowerCase().includes(term) || 
      item.description.toLowerCase().includes(term)
    );
  }, [searchTerm, menuItems]);

  return (
    <div className="min-h-screen bg-slate-900 font-sans text-slate-100 flex flex-col w-full" id="centric_ai_hub_container">
      {/* Header Bar */}
      <header className="bg-slate-900/50 border-b border-slate-850" id="hub_header">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div 
              className="flex items-center cursor-pointer hover:opacity-85 select-none transition"
              onClick={() => {
                setSearchTerm('');
                window.scrollTo({ top: 0, behavior: 'instant' });
                document.getElementById('centric_ai_hub_container')?.scrollTo({ top: 0, behavior: 'instant' });
                document.getElementById('app_root_layout')?.scrollIntoView({ behavior: 'instant', block: 'start' });
              }}
              title="CENTRIC Tax AI 초기 홈으로 리셋"
            >
              <svg className="h-8 w-8 text-blue-500" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path stroke="none" d="M0 0h24v24H0z" />
                <path d="M9 12l-4.463 4.463a5 5 0 1 1 7.071 -7.071l4.463 -4.463" />
                <path d="M12.5 5.5l5 5" />
                <path d="M14.5 7.5l5 5" />
                <path d="M3 21l3.536-3.536" />
                <path d="M17.464 8.536l3.536 -3.536" />
              </svg>
                <span className="ml-3 text-xl font-bold text-white">CENTRIC Tax AI</span>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-2 rounded-full text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
              <img className="h-9 w-9 rounded-full ring-2 ring-slate-700" src="https://picsum.photos/100/100" alt="User Avatar" />
            </div>
          </div>
        </nav>
      </header>


      {/* Sticky Search and Info bar */}
      <div className="sticky top-[41px] md:top-[57px] z-10 bg-slate-900/85 backdrop-blur-md border-b border-slate-800 py-4" id="hub_search_section">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl mx-auto relative border border-slate-800 rounded-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              id="hub_module_search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="모듈 검색..."
              className="block w-full rounded-md border-0 bg-slate-800/80 py-3 pl-10 pr-3 text-slate-100 ring-1 ring-inset ring-slate-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 transition outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Modules Grid Container */}
      <main className="container mx-auto px-4 pb-12 sm:px-6 lg:px-8 flex-1 flex flex-col justify-start" id="hub_grid_container">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
            <p className="text-lg animate-pulse mt-2">데이터 연결 확인 중...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 bg-slate-800/20 rounded-2xl border border-dashed border-slate-700 max-w-xl mx-auto w-full px-6">
            <p className="text-slate-500 text-xl font-medium">검색 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full" id="hub_modules_grid">
            {filteredItems.map((item, index) => {
              const IconComponent = ICON_COMPONENTS[item.iconName] || ICON_COMPONENTS.AIIcon;
              const isUrlActive = !!item.link;

              return (
                <a
                  key={index}
                  href={isUrlActive ? item.link : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block rounded-xl border border-slate-800 bg-slate-800/50 p-4 shadow-lg transition-all duration-300 ease-in-out hover:border-blue-500/50 hover:shadow-blue-500/20 hover:-translate-y-1 cursor-pointer"
                  id={`module_card_${index}`}
                >
                  <div className="flex items-center mb-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-blue-400 transition-colors group-hover:bg-blue-500 group-hover:text-white">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <h3 className="ml-3 text-base sm:text-lg font-bold text-white leading-tight group-hover:text-blue-400 transition-colors truncate">
                      {item.title}
                    </h3>
                  </div>

                  <p className="text-sm text-slate-400 leading-relaxed line-clamp-2 min-h-[40px]">
                    {item.description}
                  </p>

                  <div className="absolute top-1 right-1 p-2 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
