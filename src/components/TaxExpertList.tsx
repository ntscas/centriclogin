import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Award, 
  GraduationCap, 
  X, 
  AlertTriangle, 
  Globe,
  Loader2,
  ListFilter,
  MessageSquare,
  Plus,
  ChevronLeft,
  Send,
  RefreshCw,
  FileText,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';
import { UserRow, SpreadsheetConfig } from '../types';
import { BoardPost, appendBoardPost, fetchBoardPosts, fetchPublicBoardPosts, overwriteBoardPosts } from '../lib/googleSheets';
import { doc, getDocs, setDoc, query, where, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Professional {
  id: number;
  name: string;
  title: string;
  department: string;
  specialties: string[];
  email: string;
  phone: string;
  location: string;
  birth: string;
  education: string[];
  experience: string;
  languages: string[];
  bio: string;
  province: string;
  image: string;
}

const GOOGLE_API_KEY = 'AIzaSyBS1kIHPn1j2iCL4npiitSo_6Sm0M42450';
const GOOGLE_SHEET_ID = '1InckP0gk2TpAK5s7R9dFusctl2f_jFGJoBTqsZiQKko';
const SHEET_RANGE = 'prolist!A:N';

const INITIAL_DISPLAY_COUNT = 500;

export default function TaxExpertList({
  loggedInMember = null,
  googleToken = null,
  connectedSheet = null,
}: {
  key?: string;
  loggedInMember?: UserRow | null;
  googleToken?: string | null;
  connectedSheet?: SpreadsheetConfig | null;
}) {
  const activeGoogleToken = googleToken || (typeof window !== 'undefined' ? localStorage.getItem('g_sheets_admin_oauth_token') : null);

  // Custom dialogs/notifications for iframe-sandbox compatibility
  const [dialogAlertMessage, setDialogAlertMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    description?: string;
    onConfirm: () => void;
  } | null>(null);


  const [allProfessionals, setAllProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProf, setSelectedProf] = useState<Professional | null>(null);
  
  // Search & Filters State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [provinceFilter, setProvinceFilter] = useState<string>('');
  const [isSearchMode, setIsSearchMode] = useState<boolean>(false);

  // Board State
  const [isBoardOpen, setIsBoardOpen] = useState<boolean>(false);
  const [boardPosts, setBoardPosts] = useState<BoardPost[]>([]);
  const [boardLoading, setBoardLoading] = useState<boolean>(false);
  const [boardError, setBoardError] = useState<string | null>(null);

  // Board Write Modal/Form
  const [isWriteOpen, setIsWriteOpen] = useState<boolean>(false);
  const [postTitle, setPostTitle] = useState<string>('');
  const [postContent, setPostContent] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [boardSearchTerm, setBoardSearchTerm] = useState<string>('');

  // Board Edit Modal/Form
  const [editingPost, setEditingPost] = useState<BoardPost | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editContent, setEditContent] = useState<string>('');
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);

  // Custom dialog state to replace native window.alert and window.confirm
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showFeedback = (title: string, message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedbackModal({ isOpen: true, title, message, type });
  };

  const showConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };

  // Sync Diagnostics States
  const [sheetCount, setSheetCount] = useState<number | null>(null);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'loading'>('loading');
  const [dbErrorMessage, setDbErrorMessage] = useState<string | null>(null);

  // Touch/Pull to Refresh state for Mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isPulling, setIsPulling] = useState<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    // Check if the page is scrolled to the absolute top
    const container = document.getElementById('tax_expert_view_container');
    const containerScroll = container ? container.scrollTop : 0;
    if (window.scrollY === 0 && containerScroll === 0) {
      setTouchStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStart;
    
    if (diff > 0) {
      setIsPulling(true);
      // Tension friction to prevent pulling too far
      const pull = Math.min(diff * 0.4, 80);
      setPullDistance(pull);
    }
  };

  const handleTouchEnd = () => {
    setTouchStart(null);
    setIsPulling(false);
    if (pullDistance > 55) {
      console.log('User triggered mobile pull-to-refresh of board posts!');
      loadBoardPosts(true);
    }
    setPullDistance(0);
  };

  // Board loading and managing functions
  const loadBoardPosts = async (forceRefresh: boolean | any = false) => {
    const isForced = forceRefresh === true;

    // Load deleted post IDs from Firestore as tombstones so they won't show up again.
    // By pre-fetching this, we can filter them out even from our local cache instantaneously!
    let deletedPostIds = new Set<string>();
    try {
      const q = query(collection(db, 'board_posts'), where('deleted', '==', true));
      const deletedSnap = await getDocs(q);
      deletedSnap.forEach(d => {
        deletedPostIds.add(d.id);
      });
    } catch (fsErr) {
      console.warn('Silent fallback: failed to query deleted post tombstones from Firestore:', fsErr);
    }

    const normalizeDateForFingerprint = (dateStr: string): string => {
      if (!dateStr) return '';
      try {
        const formattedDate = dateStr.replace(/\./g, '/').replace('오후', 'PM').replace('오전', 'AM');
        const parsed = Date.parse(formattedDate);
        if (!isNaN(parsed)) {
          return String(Math.floor(parsed / 60000)); // normalize to nearest minute epoch
        }
      } catch (e) {
        // ignore
      }
      return dateStr.replace(/[^0-9]/g, '').slice(0, 12); // fallback to YYYYMMDDHHMM digits
    };

    // Helper to filter out any board posts that resemble user database fallback records or expired ones
    const cleanPosts = (posts: BoardPost[]): BoardPost[] => {
      if (!Array.isArray(posts)) return [];

      return posts.filter(post => {
        if (!post) return false;
        const idStr = String(post.id || '').trim();
        const titleStr = String(post.title || '').trim();
        
        // Prevent header rows from being treated as posts
        if (titleStr === 'title' || titleStr === '제목' || idStr === 'id') return false;
        
        // At least title must exist
        if (!titleStr) return false;

        // Filter out if marked as deleted in Firestore
        if (deletedPostIds && deletedPostIds.has(idStr)) return false;

        return true;
      });
    };

    // Load from cache first for instantaneous visual rendering, validating it strictly
    let cachedList: BoardPost[] = [];
    const cached = localStorage.getItem('centric_board_posts');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validCache = cleanPosts(parsed);
          cachedList = validCache;
          setBoardPosts(validCache);
        }
      } catch (e) {
        console.error('Error parsing board posts cache:', e);
      }
    }

    // Only show full loading spinner if we don't have ANY posts yet, or if it is a forced manual refresh
    const showSpinner = isForced || (boardPosts.length === 0 && cachedList.length === 0);
    if (showSpinner) {
      setBoardLoading(true);
    }
    setBoardError(null);

    try {
      setDbStatus('loading');
      setDbErrorMessage(null);

      // Load from Google Sheets ONLY
      let sheetList: BoardPost[] = [];
      const targetSpreadsheetId = connectedSheet?.spreadsheetId || '1KpApTrIuRpatfaVszLIkIBFYeeoROXxRSUGIPkHw4Yg';
      
      if (targetSpreadsheetId) {
        try {
          if (activeGoogleToken) {
            try {
              sheetList = await fetchBoardPosts(activeGoogleToken, targetSpreadsheetId);
            } catch (boardAuthErr: any) {
              console.warn('Authenticated board post fetch failed, trying public load fallback:', boardAuthErr);
              sheetList = await fetchPublicBoardPosts(targetSpreadsheetId);
            }
          } else {
            sheetList = await fetchPublicBoardPosts(targetSpreadsheetId);
          }
          setDbStatus('connected');
          setSheetCount(sheetList.length);
        } catch (sheetErr: any) {
          console.error('Google Sheets board fetch failed:', sheetErr);
          setDbStatus('error');
          setDbErrorMessage(sheetErr?.message || String(sheetErr));
          setSheetCount(0);
        }
      } else {
        setDbStatus('error');
        setDbErrorMessage('연결된 구글 스프레드시트 설정이 없습니다.');
        setSheetCount(0);
      }

      // Filter and clean Sheet posts
      const cleanAll = cleanPosts(sheetList);

      // 🚨 Super-robust, content-based strict deduplication.
      const uniqueByContent: BoardPost[] = [];
      const seenFingerprints = new Set<string>();

      cleanAll.forEach(post => {
        const titleStr = (post.title || '').trim();
        const contentStr = (post.content || '').trim();
        const writerStr = (post.writerName || '').trim();
        const dateStr = (post.registeredDate || '').trim();
        
        const normDate = normalizeDateForFingerprint(dateStr);
        const fp = `${titleStr}_#_${contentStr}_#_${writerStr}_#_${normDate}`;
        if (!seenFingerprints.has(fp)) {
          seenFingerprints.add(fp);
          uniqueByContent.push(post);
        }
      });

      // Sort list in memory by registeredDate descending
      const sorted = uniqueByContent.sort((a, b) => {
        const dateA = a.registeredDate || '';
        const dateB = b.registeredDate || '';
        return dateB.localeCompare(dateA);
      });
      
      // Update state and cache only if fetched posts differ from current cache to avoid unneeded blinking
      const hasChanged = JSON.stringify(sorted) !== JSON.stringify(cachedList);
      if (hasChanged || isForced) {
        setBoardPosts(sorted);
        localStorage.setItem('centric_board_posts', JSON.stringify(sorted));
      }
    } catch (err: any) {
      console.error('Error in loadBoardPosts logic:', err);
      if (showSpinner) {
        setBoardError(`게시글을 불러올 수 없습니다. 데이터베이스 상태를 확인해 주세요.`);
      }
    } finally {
      setBoardLoading(false);
    }
  };

  const handleWritePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim()) {
      showFeedback('입력 오류', '제목을 입력해주세요.', 'error');
      return;
    }
    if (!postContent.trim()) {
      showFeedback('입력 오류', '내용을 입력해주세요.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      const kstOffset = 9 * 60 * 60 * 1000; // KST is UTC+9
      const kstDate = new Date(now.getTime() + kstOffset);
      const registeredDate = kstDate.toISOString().replace('T', ' ').slice(0, 19);

      const newPost: BoardPost = {
        id: `post_${now.getTime()}`,
        title: postTitle.trim(),
        content: postContent.trim(),
        writerName: loggedInMember?.name || '익명회원',
        writerPhone: loggedInMember?.phoneNumber || '000-0000-0000',
        registeredDate: registeredDate,
      };

      // Save to Google Sheet immediately if token is active
      const targetSpreadsheetId = connectedSheet?.spreadsheetId || '1KpApTrIuRpatfaVszLIkIBFYeeoROXxRSUGIPkHw4Yg';
      let googleSheetSuccess = false;
      let isTokenExpired = false;

      if (activeGoogleToken && targetSpreadsheetId) {
        try {
          await appendBoardPost(activeGoogleToken, targetSpreadsheetId, newPost);
          googleSheetSuccess = true;
        } catch (sheetErr: any) {
          console.error('Failed to append to Google sheet:', sheetErr);
          const errStr = String(sheetErr?.message || sheetErr).toLowerCase();
          if (errStr.includes('auth') || errStr.includes('token') || errStr.includes('unauthorized') || errStr.includes('credential')) {
            isTokenExpired = true;
          }
        }
      }

      setPostTitle('');
      setPostContent('');
      setIsWriteOpen(false);
      
      // Update local state and cache immediately for super fast feedback
      setBoardPosts(prev => {
        const updated = [newPost, ...prev];
        localStorage.setItem('centric_board_posts', JSON.stringify(updated));
        return updated;
      });
      
      // Generate very transparent, honest response
      let successMessage = '✏️ 게시글이 성공적으로 등록되었습니다!';
      if (activeGoogleToken) {
        if (googleSheetSuccess) {
          successMessage += '\n\n구글 스프레드시트 기록이 완료되었습니다.';
        } else {
          successMessage += isTokenExpired
            ? '\n\n⚠️ 주의: Google 계정 연동 세션이 만료되었습니다. 다시 연동을 진행해 주시면 구글 스프레드시트에 정상 등록됩니다.'
            : '\n\n⚠️ 구글 시트 쓰기 중 오류가 발생했습니다. 잠시 후 다시 시도해 주십시오.';
        }
      } else {
        successMessage += '\n\n💡 안내: 게시글은 화면과 로컬에 임시 기록되었으나, 구글 시트 직접 쓰기 권한이 제한되어 있습니다. [설정] 메뉴에서 구글 계정을 연동해 주시면 구글 스프레드시트 본체와 즉시 실시간 연동됩니다.';
      }
      
      showFeedback('등록 완료', successMessage, googleSheetSuccess ? 'success' : 'info');
    } catch (err: any) {
      console.error('Post submit error:', err);
      showFeedback('등록 실패', `게시글 등록에 실패했습니다: ${err.message || err}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;
    if (!editTitle.trim()) {
      showFeedback('입력 오류', '제목을 입력해주세요.', 'error');
      return;
    }
    if (!editContent.trim()) {
      showFeedback('입력 오류', '내용을 입력해주세요.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const targetSpreadsheetId = connectedSheet?.spreadsheetId || '1KpApTrIuRpatfaVszLIkIBFYeeoROXxRSUGIPkHw4Yg';
      
      // Update state locally immediately
      const updatedList = boardPosts.map(p => {
        if (p.id === editingPost.id) {
          return {
            ...p,
            title: editTitle.trim(),
            content: editContent.trim()
          };
        }
        return p;
      });
      setBoardPosts(updatedList);
      localStorage.setItem('centric_board_posts', JSON.stringify(updatedList));

      let googleSheetSuccess = false;
      if (activeGoogleToken && targetSpreadsheetId) {
        try {
          const currentPosts = await fetchBoardPosts(activeGoogleToken, targetSpreadsheetId);
          const updatedSheetList = currentPosts.map(p => {
            if (p.id === editingPost.id) {
              return {
                ...p,
                title: editTitle.trim(),
                content: editContent.trim()
              };
            }
            return p;
          });
          await overwriteBoardPosts(activeGoogleToken, targetSpreadsheetId, updatedSheetList);
          googleSheetSuccess = true;
        } catch (sheetErr) {
          console.error('Failed to edit on Google sheet:', sheetErr);
        }
      }

      setIsEditOpen(false);
      setEditingPost(null);
      setEditTitle('');
      setEditContent('');
      
      let successMessage = '게시글이 성공적으로 수정되었습니다.';
      if (!googleSheetSuccess) {
        successMessage += '\n\n💡 안내: 화면과 로컬에는 수정사항이 적용되었으나, 구글 스프레드시트 실시간 수정은 권한(토큰) 연동이 필요합니다.';
      }
      showFeedback('수정 완료', successMessage, googleSheetSuccess ? 'success' : 'info');
    } catch (err: any) {
      console.error('Post edit error:', err);
      showFeedback('수정 실패', `게시글 수정 실패: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = (postId: string) => {
    showConfirmation(
      '게시글 삭제',
      '정말 이 게시글을 영구히 삭제하시겠습니까?',
      async () => {
        setBoardLoading(true);
        try {
          const targetSpreadsheetId = connectedSheet?.spreadsheetId || '1KpApTrIuRpatfaVszLIkIBFYeeoROXxRSUGIPkHw4Yg';
          
          // Update local state first for instant feedback.
          const updatedList = boardPosts.filter(p => p.id !== postId);
          setBoardPosts(updatedList);
          localStorage.setItem('centric_board_posts', JSON.stringify(updatedList));

          // Track deletion via Firestore tombstone, so even if we cannot update the Google sheet immediately,
          // the post is hidden globally for all logged-in devices right away.
          let firestoreRemoved = false;
          try {
            await setDoc(doc(db, 'board_posts', postId), {
              id: postId,
              deleted: true,
              deletedAt: new Date().toISOString()
            });
            firestoreRemoved = true;
          } catch (fsErr) {
            console.error('Failed to sync deletion to Firestore:', fsErr);
          }

          // Attempt direct Google Sheet delete if token is active
          let sheetRemoved = false;
          if (activeGoogleToken && targetSpreadsheetId) {
            try {
              const currentPosts = await fetchBoardPosts(activeGoogleToken, targetSpreadsheetId);
              const updatedSheetList = currentPosts.filter(p => p.id !== postId);
              await overwriteBoardPosts(activeGoogleToken, targetSpreadsheetId, updatedSheetList);
              sheetRemoved = true;
            } catch (sheetErr) {
              console.error('Failed to delete on Google sheet:', sheetErr);
            }
          }

          let alertMsg = '🗑️ 게시글이 성공적으로 삭제처리 되었습니다.';
          if (sheetRemoved) {
            alertMsg += '\n\n구글 스프레드시트에서도 영구히 삭제 완료되었습니다.';
          } else if (firestoreRemoved) {
            alertMsg += '\n\n💡 안내: 구글 스프레드시트 본체 행 삭제를 위해서는 Google 계정 연동 권한([설정] 탭)이 필요합니다만, 데이터베이스상 삭제 처리가 완료되어 다른 기기에서도 이 게시물은 더 이상 표시되지 않습니다.';
          } else {
            alertMsg += '\n\n💡 안내: 화면과 로컬 장치에서는 즉시 삭제되었으며, 구글 시트 본체 행 삭제를 위해 Google 로그인 연동 권한이 필요합니다.';
          }
          
          showFeedback('삭제 완료', alertMsg, sheetRemoved ? 'success' : 'info');
        } catch (err: any) {
          console.error('Post delete error:', err);
          showFeedback('삭제 실패', `게시글 삭제 실패: ${err.message}`, 'error');
        } finally {
          setBoardLoading(false);
        }
      }
    );
  };

  const filteredPosts = useMemo(() => {
    if (!boardSearchTerm.trim()) return boardPosts;
    const term = boardSearchTerm.toLowerCase();
    return boardPosts.filter(p => 
      p.title.toLowerCase().includes(term) ||
      p.content.toLowerCase().includes(term) ||
      p.writerName.toLowerCase().includes(term)
    );
  }, [boardPosts, boardSearchTerm]);

  useEffect(() => {
    fetchProfessionals();
    // Instantly reset window and container scroll to 0 on initial component loads, maintaining un-scrolled state
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById('tax_expert_view_container')?.scrollTo({ top: 0, behavior: 'instant' });
    document.getElementById('app_root_layout')?.scrollIntoView({ behavior: 'instant', block: 'start' });

    // 🚨 Critical Security Guard: Scan and purge list of logins from local cache instantly on mount
    const cached = localStorage.getItem('centric_board_posts');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasUserRecord = parsed.some(p => {
            if (!p) return false;
            const idStr = String(p.id || '').trim().replace(/[^0-9]/g, '');
            const titleStr = String(p.title || '').trim();
            const contentStr = String(p.content || '').trim();

            const isPhoneId = (idStr.startsWith('010') && idStr.length >= 10) || (idStr.startsWith('8210') && idStr.length >= 11);
            const isPasswordTitle = /^\d{4,8}$/.test(titleStr);
            const isHeaderMatch = titleStr === '비밀번호' || contentStr === '이름' || idStr === '전화번호';

            return isPhoneId || isPasswordTitle || isHeaderMatch;
          });

          if (hasUserRecord) {
            console.warn('Scanned and neutralized corrupted login DB rows from board cache successfully!');
            localStorage.removeItem('centric_board_posts');
            setBoardPosts([]);
          }
        }
      } catch (e) {
        localStorage.removeItem('centric_board_posts');
        setBoardPosts([]);
      }
    }
  }, []);

  // Smoothly scroll to the header so that Search Results are visible from their very first record
  // and the Tax Expert title and search box are nicely aligned at the top of the viewport
  useEffect(() => {
    if (searchTerm.trim() || provinceFilter) {
      const headerEl = document.getElementById('expert_header');
      if (headerEl) {
        headerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [searchTerm, provinceFilter]);

  useEffect(() => {
    if (boardSearchTerm.trim()) {
      const headerEl = document.getElementById('expert_header');
      if (headerEl) {
        headerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [boardSearchTerm]);

  // 🔄 다른 탭 이동 후 다시 돌아오면 자동 새로고침 및 실시간 갱신 효과
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isBoardOpen) {
        console.log('브라우저 탭 활성화 감지: 자유게시판 목록을 동기화합니다.');
        loadBoardPosts(true);
      }
    };

    const handleWindowFocus = () => {
      if (isBoardOpen) {
        console.log('브라우저 포커스 감지: 자유게시판 목록을 동기화합니다.');
        loadBoardPosts(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isBoardOpen]);

  const fetchProfessionals = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(SHEET_RANGE)}?key=${GOOGLE_API_KEY}`,
        { referrerPolicy: 'no-referrer' }
      );
      
      if (!response.ok) {
        throw new Error('시트 데이터를 불러오는데 실패했습니다.');
      }
      
      const data = await response.json();
      const rows = data.values as string[][] | undefined;
      
      if (!rows || rows.length <= 1) {
        throw new Error('데이터가 발견되지 않았거나 비어 있습니다.');
      }

      // Skip the header row and map content
      const parsed: Professional[] = rows.slice(1).map((row, index) => {
        return {
          id: index + 1,
          name: row[0] || '',
          title: row[1] || '',
          department: row[2] || '',
          specialties: row[3] ? row[3].split(',').map(s => s.trim()) : [],
          email: row[4] || '',
          phone: row[5] || '',
          location: row[6] || '',
          birth: row[7] || '',
          education: row[8] ? row[8].split(',').map(s => s.trim()) : [],
          experience: row[9] || '',
          languages: row[10] ? row[10].split(',').map(s => s.trim()) : [],
          bio: row[11] || '',
          province: row[12] || '',
          image: row[13] || ''
        };
      });

      setAllProfessionals(parsed);
    } catch (err: any) {
      console.error('TaxExpertList error matching details:', err);
      setError(err.message || '데이터를 로드하는 도중 에러가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // Get unique provinces
  const provinces = useMemo(() => {
    const list = allProfessionals.map(p => p.province).filter(Boolean);
    return Array.from(new Set(list));
  }, [allProfessionals]);

  // Performs filter on search and dropdown
  const filteredProfessionals = useMemo(() => {
    let result = allProfessionals;

    const term = searchTerm.toLowerCase().trim();
    if (term || provinceFilter) {
      setIsSearchMode(true);
      result = allProfessionals.filter(prof => {
        const matchesProvince = !provinceFilter || prof.province === provinceFilter;
        
        const matchesSearch = !term || [
          prof.name,
          prof.title,
          prof.department,
          prof.specialties.join(' '),
          prof.birth,
          prof.bio,
          prof.education.join(' '),
          prof.experience,
          prof.location,
          prof.languages.join(' ')
        ].some(val => val && String(val).toLowerCase().includes(term));

        return matchesProvince && matchesSearch;
      });
    } else {
      setIsSearchMode(false);
      // Fallback limit for initial display count to ensure performant UI rendering
      result = allProfessionals.slice(0, INITIAL_DISPLAY_COUNT);
    }

    return result;
  }, [allProfessionals, searchTerm, provinceFilter]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setProvinceFilter('');
    setIsSearchMode(false);
  };

  const targetSpreadsheetId = connectedSheet?.spreadsheetId || '1KpApTrIuRpatfaVszLIkIBFYeeoROXxRSUGIPkHw4Yg';

  return (
    <div 
      className="w-full bg-gray-50 min-h-screen text-gray-800 flex flex-col font-sans" 
      id="tax_expert_view_container"
    >
      {/* 헤더 */}
      <header className="bg-white shadow-xs border-b" id="expert_header">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 md:py-3 flex flex-row items-center justify-between gap-2 md:gap-4">
          <div className="min-w-0 flex-1">
            <h1 
              className="text-base sm:text-xl md:text-2xl font-bold text-gray-900 cursor-pointer hover:opacity-85 select-none transition truncate"
              onClick={() => {
                handleClearFilters();
                setBoardSearchTerm('');
                window.scrollTo({ top: 0, behavior: 'instant' });
                document.getElementById('tax_expert_view_container')?.scrollTo({ top: 0, behavior: 'instant' });
                document.getElementById('app_root_layout')?.scrollIntoView({ behavior: 'instant', block: 'start' });
              }}
              title="조세전문가 초기화 및 맨위로 이동"
            >
              조세 전문가
            </h1>
            <p className="hidden xs:block text-[10px] sm:text-xs md:text-sm text-gray-500 mt-0.5">
              세금에 관한 최고의 전문가를 만나보세요
            </p>
          </div>
        </div>
      </header>

      {isBoardOpen ? (
        <>
          {/* 게시판 검색 및 액션 세션 */}
          <div className="sticky top-[41px] md:top-[57px] z-20 backdrop-filter backdrop-blur-[10px] bg-white/95 border-b border-gray-200/80" id="board_search_section">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex-1 relative max-w-xl">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={boardSearchTerm}
                  onChange={(e) => setBoardSearchTerm(e.target.value)}
                  placeholder="게시글 제목, 내용, 작성자 이름 등으로 검색..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base outline-hidden"
                />
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* 연결된 구글 시트 ID 표시 */}
                <div className="px-3 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-mono select-all flex items-center gap-1.5" title="현재 연동중인 구글 스프레드시트 ID">
                  <span className="font-sans text-gray-500 font-medium text-[11px]">연동 시트 ID:</span>
                  <span className="font-mono text-slate-800 font-bold max-w-[200px] truncate">{targetSpreadsheetId}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadBoardPosts(true)}
                    disabled={boardLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${boardLoading ? 'animate-spin' : ''}`} />
                    <span>새로고침</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsWriteOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition text-sm cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>새 글 쓰기</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 게시판 컨텐츠 영역 */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 w-full flex-1 flex flex-col justify-start">

            {/* Pull to refresh visual indicator */}
            {pullDistance > 0 && (
              <div 
                style={{ height: `${pullDistance}px` }}
                className="mb-3 w-full overflow-hidden flex items-center justify-center bg-blue-50/75 border border-blue-200/55 rounded-xl transition-all duration-75 text-xs text-blue-600 font-semibold gap-2 shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-500 ${pullDistance > 55 ? 'animate-spin' : ''}`} />
                <span>{pullDistance > 55 ? '손을 놓으면 당겨서 새로고침 완료!' : '아래로 당겨서 게시판 새로고침...'}</span>
              </div>
            )}

            {boardLoading ? (
              <div className="text-center py-16 flex-1 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                <p className="text-gray-600 text-sm font-medium">게시글을 불러오는 중...</p>
              </div>
            ) : boardError ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-150 p-6 shadow-xs">
                <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900 mb-2">안내</h3>
                <p className="text-gray-600 text-sm max-w-md mx-auto mb-4">{boardError}</p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadBoardPosts(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition cursor-pointer"
                  >
                    다시 시도
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsWriteOpen(true)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm rounded-lg transition cursor-pointer"
                  >
                    새 글 등록
                  </button>
                </div>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-200 flex-1 flex flex-col items-center justify-center">
                <FileText className="w-12 h-12 text-gray-350 mb-3 mx-auto" />
                <h3 className="font-semibold text-gray-750 text-lg mb-1">등록된 게시글이 없습니다</h3>
                <p className="text-gray-500 text-sm mb-4">가장 먼저 유용한 게시글이나 질문 상담글을 작성해 보세요!</p>
                <button
                  type="button"
                  onClick={() => setIsWriteOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition cursor-pointer"
                >
                  첫 게시글 쓰기
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4" id="board_posts_list">
                {filteredPosts.map((post) => (
                  <div key={post.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-xs hover:shadow-md transition duration-200 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200 text-left">
                    <div className="flex justify-between items-start gap-3">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">{post.title}</h3>
                      <span className="text-[11px] sm:text-xs text-gray-400 font-mono flex items-center gap-1 shrink-0 whitespace-nowrap bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                        <Clock className="w-3 h-3 text-gray-400" />
                        {post.registeredDate}
                      </span>
                    </div>
                    
                    <p className="mt-3 text-gray-700 text-sm sm:text-base whitespace-pre-wrap leading-relaxed flex-1">
                      {post.content}
                    </p>

                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs sm:text-sm text-gray-500">
                      <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                        <span className="font-semibold text-slate-700">{post.writerName} 조세전문가</span>
                        <span className="text-gray-300">|</span>
                        <span className="font-mono text-slate-500">{post.writerPhone}</span>
                      </div>

                      {loggedInMember && post.writerPhone === loggedInMember.phoneNumber && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPost(post);
                              setEditTitle(post.title);
                              setEditContent(post.content);
                              setIsEditOpen(true);
                            }}
                            className="px-2.5 py-1 text-xs text-blue-600 hover:text-blue-800 font-semibold bg-blue-50 hover:bg-blue-100 rounded transition border border-blue-100 cursor-pointer"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePost(post.id)}
                            className="px-2.5 py-1 text-xs text-red-600 hover:text-red-850 font-semibold bg-red-50 hover:bg-red-100 rounded transition border border-red-100 cursor-pointer"
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* 고정 검색 및 필터 */}
          <div id="searchSection" className="sticky top-[41px] md:top-[57px] z-20 backdrop-filter backdrop-blur-[10px] bg-white/95 border-b border-gray-200/80">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex flex-col sm:flex-row mobile-search gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    id="searchInput"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="이름,전문분야,소속,출신,학력,경력 등으로 검색..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base outline-hidden"
                  />
                </div>
                <div className="w-full sm:w-48 relative">
                  <select
                    id="departmentFilter"
                    value={provinceFilter}
                    onChange={(e) => setProvinceFilter(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base appearance-none bg-white cursor-pointer"
                  >
                    <option value="">지역 검색</option>
                    {provinces.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                {isSearchMode && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm sm:text-base whitespace-nowrap cursor-pointer"
                    id="clearButton"
                  >
                    전체 보기
                  </button>
                )}
              </div>
              
              <div className="mt-3 text-xs sm:text-sm text-gray-650 flex justify-between items-center">
                <span id="displayInfo">
                  {isSearchMode ? (
                    <>검색 결과: <span className="font-semibold text-blue-600">{filteredProfessionals.length}</span>명</>
                  ) : (
                    <>전체 <span className="font-semibold text-gray-600">{allProfessionals.length}</span>명 중 <span className="font-semibold text-blue-600">{filteredProfessionals.length}</span>명 표시</>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* 컨텐츠 영역 */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 w-full flex-1 flex flex-col justify-start">
            {loading ? (
              <div className="text-center py-12 flex-1 flex flex-col items-center justify-center gap-3" id="loadingIndicator">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                <p className="text-gray-600">데이터를 불러오는 중...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12 flex-1 flex flex-col items-center justify-center gap-2" id="errorMessage">
                <AlertTriangle className="w-12 h-12 text-red-300 mx-auto mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">데이터를 불러올 수 없습니다</h3>
                <p className="text-xs sm:text-sm text-gray-600">{error}</p>
                <button 
                  type="button"
                  onClick={fetchProfessionals} 
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm sm:text-base cursor-pointer"
                >
                  다시 시도
                </button>
              </div>
            ) : filteredProfessionals.length === 0 ? (
              <div className="text-center py-12 flex-1 flex flex-col items-center justify-center gap-2" id="noResults">
                <User className="text-4xl sm:text-6xl text-gray-300 mb-4 mx-auto" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">검색 결과가 없습니다</h3>
                <p className="text-sm sm:text-base text-gray-600">다른 검색어나 필터를 시도해보세요.</p>
              </div>
            ) : (
              /* 전문가 목록 */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full" id="professionalsGrid">
                {filteredProfessionals.map(prof => (
                  <div
                    key={prof.id}
                    onClick={() => setSelectedProf(prof)}
                    className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer border border-gray-200 overflow-hidden flex flex-col justify-between"
                    id={`prof_card_${prof.id}`}
                  >
                    <div className="p-6">
                      <div className="flex items-center space-x-4 mb-4">
                        <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                          {prof.image ? (
                            <img 
                              src={prof.image} 
                              alt={prof.name} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://picsum.photos/150/150';
                              }}
                            />
                          ) : (
                            <User className="w-8 h-8 text-gray-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">{prof.name}</h3>
                          <p className="text-sm text-gray-600 truncate"><b>{prof.title}</b></p>
                          <p className="text-sm text-blue-600 truncate">{prof.department}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {prof.specialties.slice(0, 4).map((spec, i) => (
                            <span key={i} className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-medium">
                              {spec}
                            </span>
                          ))}
                          {prof.specialties.length > 4 && (
                            <span className="text-xs text-gray-500 self-center">+{prof.specialties.length - 4}개</span>
                          )}
                        </div>
                        
                        <div className="flex justify-between items-start text-sm text-gray-600 mt-2 pt-2 border-t border-gray-100">
                          <div className="w-1/2 pr-2 text-left truncate" title={prof.birth}>
                            <p className="line-clamp-2 text-xs sm:text-sm">{prof.birth || '-'}</p>
                          </div>
                          <div className="w-1/2 pl-2 border-l border-gray-200 text-right truncate" title={prof.education.join(', ')}>
                            <p className="line-clamp-2 text-xs sm:text-sm text-gray-600 leading-tight">
                              {prof.education[0] || '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* 프로필 모달 */}
      {selectedProf && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" 
          onClick={() => setSelectedProf(null)}
          id="profileModal"
        >
          <div 
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center z-10">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">조세전문가 프로필</h2>
              <button 
                onClick={() => setSelectedProf(null)} 
                className="p-2 hover:bg-gray-100 rounded-full cursor-pointer text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div id="modalContent" className="p-4 sm:p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 pb-6 border-b border-gray-100">
                <div className="w-32 h-40 bg-gray-300 rounded-lg flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                  {selectedProf.image ? (
                    <img 
                      src={selectedProf.image} 
                      alt={selectedProf.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User className="w-12 h-12 text-gray-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
                  <h3 className="text-2xl font-bold text-gray-900">{selectedProf.name}</h3>
                  <p className="text-lg text-gray-600 font-medium">{selectedProf.title}</p>
                  <p className="text-lg text-blue-600">{selectedProf.department}</p>
                  
                  <div className="space-y-2 text-sm text-gray-600 pt-2 flex flex-col items-center sm:items-start">
                    {selectedProf.email && (
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-gray-450" />
                        <span>{selectedProf.email}</span>
                      </div>
                    )}
                    {selectedProf.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-gray-450" />
                        <span>{selectedProf.phone}</span>
                      </div>
                    )}
                    {selectedProf.location && (
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-gray-450" />
                        <span>{selectedProf.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center text-sm sm:text-base">
                      <Award className="w-4.5 h-4.5 mr-2 text-blue-600" />
                      전문분야
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedProf.specialties.map((spec, idx) => (
                        <span key={idx} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center text-sm sm:text-base">
                      출신 및 생년
                    </h4>
                    <div className="space-y-1 text-sm text-gray-650 pl-1 leading-relaxed">
                      <span>{selectedProf.birth}</span>
                    </div>
                  </div>
                  
                  {selectedProf.education.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center text-sm sm:text-base">
                        <GraduationCap className="w-5 h-5 mr-2 text-blue-600" />
                        학력
                      </h4>
                      <ul className="space-y-1 text-sm text-gray-650 pl-1">
                        {selectedProf.education.map((edu, idx) => (
                          <li key={idx}>• {edu}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                <div className="space-y-6">
                  {selectedProf.experience && (
                    <div>
                      <h4 className="font-bold text-gray-900 mb-3 text-sm sm:text-base">경력</h4>
                      <div 
                        className="text-sm text-gray-650 leading-relaxed bg-gray-50 border border-gray-100 p-4 rounded-lg overflow-x-auto whitespace-pre-line"
                        dangerouslySetInnerHTML={{ __html: selectedProf.experience.replace(/\n/g, '<br />') }}
                      />
                    </div>
                  )}
                  
                  {selectedProf.languages.length > 0 && (
                    <div>
                      <h4 className="font-bold text-gray-900 mb-3 text-sm sm:text-base flex items-center gap-1.5 animate-pulse">
                        <Globe className="w-4 h-4 text-blue-500" />
                        언어
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedProf.languages.map((lang, idx) => (
                          <span key={idx} className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded text-xs font-medium">
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedProf.bio && (
                <div className="pt-4 border-t border-gray-150">
                  <h4 className="font-bold text-gray-900 mb-3 text-sm sm:text-base">소개</h4>
                  <p 
                    className="text-sm text-gray-650 leading-relaxed bg-blue-50/20 p-4 rounded-lg border border-blue-100/30"
                    dangerouslySetInnerHTML={{ __html: selectedProf.bio.replace(/\n/g, '<br />') }}
                  />
                </div>
              )}
            </div>

            <div className="bg-gray-50 border-t border-gray-150 px-6 py-3 flex justify-end shrink-0">
              <button 
                onClick={() => setSelectedProf(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg text-sm transition cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 게시판 글쓰기 모달 */}
      {isWriteOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">새 게시글 등록</h2>
              <button 
                type="button"
                onClick={() => setIsWriteOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWritePost} className="p-6 flex flex-col gap-4 text-left">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">작성자 정보</label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-650 flex items-center justify-between">
                  <div>
                    <strong>{loggedInMember?.name || '익명회원'}</strong> <span>({loggedInMember?.phoneNumber || '000-0000-0000'})</span>
                  </div>
                  <span className="text-[11px] bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">자동 기입</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">제목</label>
                <input 
                  type="text"
                  required
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="제목을 입력하세요..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm outline-hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">내용</label>
                <textarea
                  required
                  rows={8}
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="게시판에 등록할 세법 질문, 정보 공유, 상담 의견 등을 입력하세요..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm outline-hidden resize-none"
                />
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsWriteOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-750 hover:bg-gray-50 text-sm font-medium transition cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>등록 중...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>게시글 등록</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 게시판 글수정 모달 */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">게시글 수정</h2>
              <button 
                type="button"
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingPost(null);
                }}
                className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditPost} className="p-6 flex flex-col gap-4 text-left">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">작성자 정보</label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-650 flex items-center justify-between">
                  <div>
                    <strong>{editingPost?.writerName || '익명회원'}</strong> <span>({editingPost?.writerPhone || '000-0000-0000'})</span>
                  </div>
                  <span className="text-[11px] bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">작성자 본인</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">제목</label>
                <input 
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="제목을 입력하세요..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm outline-hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">내용</label>
                <textarea
                  required
                  rows={8}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="수정할 내용을 입력하세요..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm outline-hidden resize-none"
                />
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditOpen(false);
                    setEditingPost(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-750 hover:bg-gray-50 text-sm font-medium transition cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>수정 중...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>수정 완료</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CUSTOM DIALOGS & OVERLAYS (RESOLVES IFRAME BLOCKED POPUPS & FOCUS RACES) */}
      {/* ========================================================================= */}
      {feedbackModal && feedbackModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150" id="feedback_modal_overlay">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-150 scale-in duration-150 flex flex-col items-center text-center">
            {feedbackModal.type === 'success' ? (
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
              </div>
            ) : feedbackModal.type === 'error' ? (
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-blue-500" />
              </div>
            )}
            <h3 className="text-base font-bold text-gray-900 mb-1.5">{feedbackModal.title}</h3>
            <p className="text-xs text-gray-600 mb-5 whitespace-pre-wrap leading-relaxed">{feedbackModal.message}</p>
            <button
              type="button"
              onClick={() => setFeedbackModal(null)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl text-xs shadow-md shadow-blue-500/10 transition cursor-pointer"
              id="feedback_modal_confirm_btn"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150" id="confirm_modal_overlay">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-150 scale-in duration-150 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1.5">{confirmModal.title}</h3>
            <p className="text-xs text-gray-600 mb-5 whitespace-pre-wrap leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-2.5 w-full">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-750 font-semibold rounded-xl text-xs transition cursor-pointer"
                id="confirm_modal_cancel_btn"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  const onC = confirmModal.onConfirm;
                  setConfirmModal(null);
                  onC();
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold rounded-xl text-xs shadow-md shadow-red-500/10 transition cursor-pointer"
                id="confirm_modal_proceed_btn"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
