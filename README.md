# 🎵 AudioVault - GitHub Pages 배포 가이드

이 폴더(`deploy-github-pages`)의 파일들은 **GitHub Pages**에 단독 정적 호스팅하여 사용할 수 있도록 완전히 분리 패키징된 배포판입니다.

---

## 🚀 GitHub Pages 배포 링크

- **저장소 주소**: `https://github.com/CheaterMer/my-audio-web`
- **배포 후 사이트 주소**: `https://cheatermer.github.io/my-audio-web/`

---

## 🛠️ 업로드 방법 (택 1)

### 방법 A. 원클릭 푸시 배치 파일 실행
1. `deploy-github-pages` 폴더 안의 **`push-github.bat`** 파일을 더블 클릭하여 실행합니다.
2. 브라우저 로그인 창이 뜨면 `CheaterMer` 계정으로 로그인/승인하면 자동으로 업로드됩니다.

### 방법 B. 웹 브라우저에서 직접 업로드
1. [https://github.com/CheaterMer/my-audio-web](https://github.com/CheaterMer/my-audio-web) 접속
2. 상단의 **[Add file] ➔ [Upload files]** 클릭
3. 이 `deploy-github-pages` 폴더의 모든 파일(`index.html`, `locales/`, `images/`)을 드래그 앤 드롭하여 업로드 후 **[Commit changes]** 클릭.

---

## 🌐 GitHub Pages 활성화 (최초 1회)

1. [https://github.com/CheaterMer/my-audio-web/settings/pages](https://github.com/CheaterMer/my-audio-web/settings/pages) 접속.
2. **Build and deployment** ➔ **Branch**를 `main`, 폴더를 `/(root)`로 선택하고 **[Save]** 클릭.
3. 1분 후 `https://cheatermer.github.io/my-audio-web/` 로 접속하시면 전 세계 어디서나 접속 가능합니다! 🎉

---

## 🛡️ 관리자 모드 접속 방법 (GitHub Pages)

GitHub Pages는 정적 호스팅이므로 URL 쿼리 파라미터를 통해 관리자로 접속할 수 있습니다:
```
https://<사용자아이디>.github.io/<저장소이름>/?token=<관리자난수토큰>
```
- 백엔드 서버(`https://mer.r-e.kr`)에서 발급된 유효한 관리자 토큰을 입력하면 GitHub Pages에서도 `[🛡️ 관리자 모드 ON]` 버튼 및 곡 수정, 맵핑, 강제 고정 기능이 완벽하게 활성화됩니다.
