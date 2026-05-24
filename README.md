# 🚀 Centric AI & 조세전문가 통합 로그인 포탈

구글 스프레드시트(Google Sheets)를 회원 데이터베이스로 삼아 안전하게 회원을 인증하고 로그인 세션을 유지하며, **Centric AI**와 **조세전문가 전용 서비스**를 인앱(In-app) 브라우저 캔버스로 매끄럽게 임베딩하는 단일 화면 인증 포탈 웹앱입니다.

이 프로젝트는 **React + TypeScript + Vite + Tailwind CSS** 기반으로 제작되었으며, AI Studio 빌드 도구 또는 로컬 개발 환경에서 즉시 깃허브(GitHub)에 업로드 및 배포를 지원합니다.

---

## 🎨 주요 기능 및 특징

- **실시간 회원 인증 & 전용 콘텐츠 제공**: 전화번호와 미리 정해둔 비밀번호 조합으로 신속하고 철저하게 사용자를 구분하여 회원을 보호합니다.
- **인앱 서비스 캔버스 통합**: 로그인 완료 직후, Centric AI(`https://centrictax.vercel.app/`) 및 조세전문가 세금 솔루션(`https://centrictax.vercel.app/centric_pro.html`)을 간격 없는 단일 화면 패널에서 즉시 사용할 수 있습니다.
- **분리형 마이 프로필 다이얼로그**: 깔끔한 팝업 모달 형태로 자신의 상세 가입 내역 및 이용 허가 구분을 확인할 수 있어 불필요한 레이아웃 공간 차지를 최소화했습니다.
- **세련된 타이포그래피 & 무드**: 모던한 샌드 박스형 UI와 높은 대비의 컬러 구도를 채택하여 장시간 집중하기에 피로함 없는 친근한 다크/라이트 하이브리드 미학을 발휘합니다.

---

## 📦 깃허브(GitHub) 업로드 및 배포 가이드

Google AI Studio는 자체적으로 이 소스 코드를 깃허브나 파일(ZIP)로 내보낼 수 있는 편리한 기능을 내장하고 있습니다. 아래 단계들을 따라 쉽고 온전하게 내보낼 수 있습니다.

### 방법 1. AI Studio 설정을 이용한 원클릭 내보내기 (권장)
1. 화면 오른쪽 상단 혹은 좌측 상단의 **Settings(설정) 메뉴**를 엽니다.
2. **Export to GitHub (GitHub로 내보내기)** 또는 **Download ZIP (ZIP 다운로드)** 옵션을 검색하십시오.
   - **GitHub로 내보내기**: 사용자 GitHub 계정을 연결하여 즉시 새로운 개인/공유 레포지토리에 이 프로덕션 소스 코드 전체를 커밋 및 푸시합니다.
   - **Download ZIP**: 소스 파일을 컴퓨터에 다이렉트로 내려받은 뒤, 직접 로컬 터미널에서 `git init`, `git remote add` 명령을 통해 원하는 Repository에 등록할 수 있습니다.

### 방법 2. 직접 내보낸 ZIP 파일을 GitHub에 밀어넣기
만약 로컬로 ZIP 다운로드를 하셨다면 아래와 같이 수행하여 깃허브에 구성할 수 있습니다.

```bash
# 1. 압축을 풀고 해당 폴더로 진입합니다.
cd google-sheets-login-portal

# 2. 로컬 Git 레포지토리 초기화
git init

# 3. 모든 파일 스테이징 및 첫 번째 커밋 생성
git add .
git commit -m "feat: Centric Portal Google Sheets & AI integration"

# 4. 본인의 깃허브 원격 주소 연결
git branch -M main
git remote add origin https://github.com/사용자이름/레포지토리이름.git

# 5. 레포지토리에 전송
git push -u origin main
```

---

## 🛠️ 로컬 개발 환경 실행 가이드

사용자 컴퓨터(PC 또는 맥)에 노드 패키지 매니저가 성립되어 있는 경우, 로컬 서버를 동작시키는 방법입니다.

### 1. 필수 프로그램 설치
- **Node.js** 18버전 이상 혹은 최신 LTS 버전이 필요합니다.

### 2. 의존성 패키지 설치
터미널에서 레포지토리 폴더로 이동한 뒤 아래 명령어를 호출합니다.
```bash
npm install
```

### 3. 로컬 개발 서버 부팅 (`http://localhost:3000`)
```bash
npm run dev
```
기본적으로 포트 `3000`에서 Vite HMR(Hot Module Replacement) 기능과 함께 쾌속 개발 디버깅 브라우저가 오픈됩니다.

### 4. 프로덕션 빌드 (배포용 파일 추출)
```bash
npm run build
```
빌드가 완료되면 `/dist` 디렉토리에 정적 HTML/CSS/JS 번들 결과물이 산출됩니다. 이 결과물은 Vercel, Netlify, Cloud Run, GitHub Pages 등에 손쉽게 서버리스로 즉시 퍼블리싱 가능합니다.

---

## 🔒 환경 변수 설정 (.env.example)

실제 구글 시트 데이터베이스 연동과 사용자 회원정보의 안정적 처리를 위해 필요한 설정이 있다면 `.env.example`을 참고하여 `.env` 파일을 로컬에 생성해 주시거나 호스팅 서비스의 Settings 환경 변수로 주입해 주세요.

---

제작자 및 서비스 제공: **Centric Tax**
궁금한 점이 있거나 기능 변동 요구가 있을 시 언제든 AI Coding Agent에게 물어보세요!
