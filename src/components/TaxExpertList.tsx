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
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, where, limit, setDoc } from 'firebase/firestore';

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

  // Sync Diagnostics States
  const [firestoreCount, setFirestoreCount] = useState<number | null>(null);
  const [sheetCount, setSheetCount] = useState<number | null>(null);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'loading'>('loading');
  const [dbErrorMessage, setDbErrorMessage] = useState<string | null>(null);

  // Firestore helpers
  const loadPostsFromFirestore = async (): Promise<BoardPost[]> => {
    try {
      const q = query(collection(db, 'board_posts'));
      const querySnapshot = await getDocs(q);
      const posts: BoardPost[] = [];

      querySnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const registeredDate = data.registeredDate || '';

        posts.push({
          id: data.id || docSnapshot.id,
          title: data.title || '',
          content: data.content || '',
          writerName: data.writerName || '',
          writerPhone: data.writerPhone || '',
          registeredDate: registeredDate,
        });
      });

      // Sort in-memory to guarantee descending order by registeredDate
      posts.sort((a, b) => {
        const dateA = a.registeredDate || '';
        const dateB = b.registeredDate || '';
        return dateB.localeCompare(dateA);
      });

      return posts;
    } catch (err) {
      console.error('Firestore board fetch error:', err);
      throw err; // Rethrow to show active diagnostics on screen
    }
  };

  const savePostToFirestore = async (post: BoardPost) => {
    try {
      await setDoc(doc(db, 'board_posts', post.id), {
        ...post,
        createdAt: serverTimestamp(),
      });
      console.log('Successfully saved to Firestore Cloud DB:', post.id);
    } catch (err) {
      console.error('Firestore board save error:', err);
      throw err; // Rethrow to catch during form submittal and alert user
    }
  };

  const updatePostInFirestore = async (postId: string, title: string, content: string) => {
    try {
      // Direct update by post.id document
      const docRef = doc(db, 'board_posts', postId);
      await updateDoc(docRef, {
        title: title,
        content: content,
      });
      console.log('Successfully updated post directly in Firestore Cloud DB:', postId);
    } catch (err) {
      // Fallback query for old legacy documents that used random auto-IDs
      try {
        const q = query(collection(db, 'board_posts'), where('id', '==', postId), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docId = querySnapshot.docs[0].id;
          const docRef = doc(db, 'board_posts', docId);
          await updateDoc(docRef, {
            title: title,
            content: content,
          });
          console.log('Successfully updated legacy post in Firestore Cloud DB via query:', postId);
        }
      } catch (innerErr) {
        console.error('Firestore board update error:', innerErr);
      }
    }
  };

  const deletePostFromFirestore = async (postId: string) => {
    try {
      // Direct delete by post.id document
      const docRef = doc(db, 'board_posts', postId);
      await deleteDoc(docRef);
      console.log('Successfully deleted post directly from Firestore Cloud DB:', postId);
    } catch (err) {
      // Fallback query for old legacy documents that used random auto-IDs
      try {
        const q = query(collection(db, 'board_posts'), where('id', '==', postId), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docId = querySnapshot.docs[0].id;
          const docRef = doc(db, 'board_posts', docId);
          await deleteDoc(docRef);
          console.log('Successfully deleted legacy post from Firestore Cloud DB via query:', postId);
        }
      } catch (innerErr) {
        console.error('Firestore board delete error:', innerErr);
      }
    }
  };

  // Board loading and managing functions
  const loadBoardPosts = async (forceRefresh: boolean | any = false) => {
    const isForced = forceRefresh === true;

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
        const contentStr = String(post.content || '').trim();
        
        // 🚨 1. If ID looks like a mobile phone number (digits only, e.g. starting with '010' or '8210')
        const cleanId = idStr.replace(/[^0-9]/g, '');
        const isPhoneId = (cleanId.startsWith('010') && cleanId.length >= 10) || (cleanId.startsWith('8210') && cleanId.length >= 11);
        if (isPhoneId) return false;

        // 🚨 2. If title looks like a 4-8 digit password
        const isNumericPassword = /^\d{4,8}$/.test(titleStr);
        if (isNumericPassword) return false;

        // 🚨 3. Must have realistic titles
        if (!titleStr) return false;
        
        // 🚨 4. Prevent headers fallback
        if (titleStr === '비밀번호' || contentStr === '이름' || idStr === '전화번호') return false;

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

    // Only show full loading spinner if we don't have ANY posts yet
    const showSpinner = boardPosts.length === 0 && cachedList.length === 0;
    if (showSpinner) {
      setBoardLoading(true);
    }
    setBoardError(null);

    try {
      setDbStatus('loading');
      setDbErrorMessage(null);

      let firestoreList: BoardPost[] = [];
      try {
        firestoreList = await loadPostsFromFirestore();
        setFirestoreCount(firestoreList.length);
        setDbStatus('connected');
      } catch (fsErr: any) {
        console.error('Firestore fetch failed in loadBoardPosts:', fsErr);
        setDbStatus('error');
        setDbErrorMessage(fsErr?.message || String(fsErr));
        setFirestoreCount(0);
      }
      
      // Load from Google Sheets as well as backup or primary source
      let sheetList: BoardPost[] = [];
      const targetSpreadsheetId = connectedSheet?.spreadsheetId || '1KpApTrIuRpatfaVszLIkIBFYeeoROXxRSUGIPkHw4Yg';
      
      if (targetSpreadsheetId) {
        try {
          if (googleToken) {
            sheetList = await fetchBoardPosts(googleToken, targetSpreadsheetId);
          } else {
            sheetList = await fetchPublicBoardPosts(targetSpreadsheetId);
          }
          setSheetCount(sheetList.length);
        } catch (sheetErr: any) {
          console.warn('Google Sheets board fetch failed, falling back to Firestore/local data:', sheetErr);
          setSheetCount(0);
        }
      } else {
        setSheetCount(0);
      }

      const cleanFirestore = cleanPosts(firestoreList);
      const cleanSheet = cleanPosts(sheetList);

      // Merge both lists to be completely identical and delete duplicates using post.id
      const map = new Map<string, BoardPost>();
      
      // Put Google Sheet posts first
      cleanSheet.forEach(post => {
        if (post && post.id) {
          map.set(post.id, post);
        }
      });

      // Overlay Firestore posts (making sure Firestore overrides or acts as secondary)
      cleanFirestore.forEach(post => {
        if (post && post.id) {
          map.set(post.id, post);
        }
      });

      const mergedList = Array.from(map.values());

      // 🚨 Super-robust, content-based strict deduplication.
      // This wipes out any pre-existing duplicate posts (cloned and saved during older bugs) 
      // by ensuring that no two posts with the same title, content, and author are shown or saved.
      const uniqueByContent: BoardPost[] = [];
      const seenFingerprints = new Set<string>();

      mergedList.forEach(post => {
        const titleStr = (post.title || '').trim();
        const contentStr = (post.content || '').trim();
        const writerStr = (post.writerName || '').trim();
        const dateStr = (post.registeredDate || '').trim();
        
        const normDate = normalizeDateForFingerprint(dateStr);
        const fp = `${titleStr}_#_${contentStr}_#_${writerStr}_#_${normDate}`;
        if (!seenFingerprints.has(fp)) {
          seenFingerprints.add(fp);
          uniqueByContent.push(post);
        } else {
          // If Firestore contains a duplicated post, auto-prune it in background to heal the Firestore collection!
          if (post.id && !post.id.startsWith('post_stable_')) {
            console.log('Background auto-pruning duplicate Firestore post doc:', post.id);
            deletePostFromFirestore(post.id).catch(err => {
              console.warn(`Failed to background-prune duplicate Firestore post: ${post.id}`, err);
            });
          }
        }
      });

      // Sort merged list in memory by registeredDate descending
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

      // 🔄 Bidirectional Sync to make Firestore and Google Sheet identical

      // 1. Check for posts in Sheet that are missing in Firestore and auto-migrate them
      const firestoreIds = new Set(cleanFirestore.map(p => p.id));
      const missingInFirestore = cleanSheet.filter(p => !firestoreIds.has(p.id));
      if (missingInFirestore.length > 0) {
        console.log(`Auto-migrating ${missingInFirestore.length} missing sheet posts to Firestore...`);
        missingInFirestore.forEach(mPost => {
          savePostToFirestore(mPost).catch(fErr => {
            console.error('Failed to auto-migrate sheet post to Firestore:', mPost.id, fErr);
          });
        });
      }

      // 2. Check for posts in Firestore that are missing in Google Sheet and backup if googleToken is available
      if (googleToken && targetSpreadsheetId) {
        const sheetIds = new Set(cleanSheet.map(p => p.id));
        const missingInSheet = cleanFirestore.filter(p => !sheetIds.has(p.id));
        
        if (missingInSheet.length > 0 || hasChanged) {
          console.log(`Synchronizing Google Sheet backup with identical Cloud DB posts...`);
          overwriteBoardPosts(googleToken, targetSpreadsheetId, sorted).catch(syncErr => {
            console.warn('Background Google Sheet backup-sync failed:', syncErr);
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      if (showSpinner) {
        setBoardError(`게시글을 불러올 수 없습니다.`);
      }
    } finally {
      setBoardLoading(false);
    }
  };

  const handleWritePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    if (!postContent.trim()) {
      alert('내용을 입력해주세요.');
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

      // Save to Firestore and await to ensure it succeeds before celebrating!
      await savePostToFirestore(newPost);

      // Save to Google Sheet as backup sync if token is active
      const targetSpreadsheetId = connectedSheet?.spreadsheetId || '1KpApTrIuRpatfaVszLIkIBFYeeoROXxRSUGIPkHw4Yg';
      if (googleToken && targetSpreadsheetId) {
        try {
          await appendBoardPost(googleToken, targetSpreadsheetId, newPost);
        } catch (sheetErr: any) {
          console.warn('Google Sheet append backup failed:', sheetErr);
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
      
      alert('게시글이 실시간 클라우드 DB에 성공적으로 등록되었습니다!');
    } catch (err: any) {
      console.error('Post submit error:', err);
      alert(`클라우드 DB 게시글 등록 실패: ${err.message || err}\n\n데이터베이스 연결 상태를 확인해주십시오.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;
    if (!editTitle.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }
    if (!editContent.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      // Update in Firestore in background for ultra-speed UI response
      updatePostInFirestore(editingPost.id, editTitle.trim(), editContent.trim()).catch(err => {
        console.error('Background Firestore update failed:', err);
      });

      // Update in Google Sheet in background as backup sync if token is active
      const targetSpreadsheetId = connectedSheet?.spreadsheetId || '1KpApTrIuRpatfaVszLIkIBFYeeoROXxRSUGIPkHw4Yg';
      if (googleToken && targetSpreadsheetId) {
        const updateSheetPromise = async () => {
          const currentPosts = await fetchBoardPosts(googleToken, targetSpreadsheetId);
          const updatedList = currentPosts.map(p => {
            if (p.id === editingPost.id) {
              return {
                ...p,
                title: editTitle.trim(),
                content: editContent.trim()
              };
            }
            return p;
          });
          await overwriteBoardPosts(googleToken, targetSpreadsheetId, updatedList);
        };
        updateSheetPromise().catch(sheetErr => {
          console.warn('Background Google Sheet backup update failed:', sheetErr);
        });
      }

      // Update state locally immediately
      setBoardPosts(prev => {
        const updated = prev.map(p => {
          if (p.id === editingPost.id) {
            return {
              ...p,
              title: editTitle.trim(),
              content: editContent.trim()
            };
          }
          return p;
        });
        localStorage.setItem('centric_board_posts', JSON.stringify(updated));
        return updated;
      });

      setIsEditOpen(false);
      setEditingPost(null);
      setEditTitle('');
      setEditContent('');
      alert('게시글이 수정되었습니다!');
    } catch (err: any) {
      console.error('Post edit error:', err);
      alert(`게시글 수정 실패: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    const confirmDelete = window.confirm('정말 이 게시글을 삭제하시겠습니까?');
    if (!confirmDelete) return;

    setBoardLoading(true);
    try {
      // Delete from Firestore in background for ultra-speed UI response
      deletePostFromFirestore(postId).catch(err => {
        console.error('Background Firestore delete failed:', err);
      });

      // Delete from Google Sheet in background as backup sync if token is active
      const targetSpreadsheetId = connectedSheet?.spreadsheetId || '1KpApTrIuRpatfaVszLIkIBFYeeoROXxRSUGIPkHw4Yg';
      if (googleToken && targetSpreadsheetId) {
        const deleteSheetPromise = async () => {
          const currentPosts = await fetchBoardPosts(googleToken, targetSpreadsheetId);
          const updatedList = currentPosts.filter(p => p.id !== postId);
          await overwriteBoardPosts(googleToken, targetSpreadsheetId, updatedList);
        };
        deleteSheetPromise().catch(sheetErr => {
          console.warn('Background Google Sheet backup delete failed:', sheetErr);
        });
      }

      // Update state locally immediately
      setBoardPosts(prev => {
        const updated = prev.filter(p => p.id !== postId);
        localStorage.setItem('centric_board_posts', JSON.stringify(updated));
        return updated;
      });

      alert('게시글이 삭제되었습니다!');
    } catch (err: any) {
      console.error('Post delete error:', err);
      alert(`게시글 삭제 실패: ${err.message}`);
    } finally {
      setBoardLoading(false);
    }
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

  return (
    <div className="w-full bg-gray-50 min-h-screen text-gray-800 flex flex-col font-sans" id="tax_expert_view_container">
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
              {isBoardOpen ? '조세전문가 게시판' : '조세 전문가'}
            </h1>
            <p className="hidden xs:block text-[10px] sm:text-xs md:text-sm text-gray-500 mt-0.5">
              {isBoardOpen 
                ? '조세전문가와 회원들이 자유롭게 소통하는 세금 지식 광장입니다' 
                : '세금에 관한 최고의 전문가를 만나보세요'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isBoardOpen ? (
              <button
                type="button"
                onClick={() => setIsBoardOpen(false)}
                className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg shadow-xs border border-gray-200 transition text-[11px] sm:text-xs cursor-pointer whitespace-nowrap"
                id="back_to_experts_btn"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>전문가 목록</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsBoardOpen(true);
                  loadBoardPosts();
                }}
                className="flex items-center gap-1 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-lg shadow-sm transition text-[11px] sm:text-xs cursor-pointer whitespace-nowrap"
                id="open_board_btn"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>조세전문가 게시판</span>
              </button>
            )}
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
                {/* 실시간 클라우드 상태 표시기 */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700/90 border border-blue-100 rounded-lg text-xs font-semibold select-none">
                  <Zap className="w-3.5 h-3.5 text-blue-500 fill-blue-500 animate-pulse" />
                  <span>실시간 클라우드 DB (30일 유효)</span>
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

            {/* 실시간 백엔드 및 구글 시트 동기화 디바이스 현황 */}
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs text-gray-600 shadow-xs" id="sync_diagnostics_bar">
              <div className="flex flex-wrap items-center gap-3 md:gap-5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">데이터 실시간 연동 현황:</span>
                </div>
                
                {/* 1. Firestore Cloud DB Status */}
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${
                    dbStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
                    dbStatus === 'loading' ? 'bg-amber-400' : 'bg-red-500'
                  }`} />
                  <span className="font-medium text-gray-700">구글 클라우드 DB (Firestore):</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                    dbStatus === 'connected' ? 'bg-green-100 text-green-800' :
                    dbStatus === 'loading' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {dbStatus === 'connected' ? `연결됨 (조회: ${firestoreCount ?? 0}건)` : 
                     dbStatus === 'loading' ? '연결중...' : '연결 오류'}
                  </span>
                </div>

                {/* 2. Google Sheets Backup Status */}
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-medium text-gray-700">구글 스프레드시트 (백업):</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    연결됨 ({sheetCount !== null ? `${sheetCount}건` : '로딩중...'})
                  </span>
                </div>
              </div>

              {dbErrorMessage && (
                <div className="md:max-w-xs text-[10px] text-red-600 bg-red-50 border border-red-100 p-1.5 rounded flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                  <span className="truncate">오류 상세: {dbErrorMessage}</span>
                </div>
              )}
            </div>

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
    </div>
  );
}
