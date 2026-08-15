# 🎵 AudioVault - GitHub Pages 배포 가이드

이 폴더(`deploy-github-pages`)의 파일들은 **GitHub Pages**에 단독 정적 호스팅하여 사용할 수 있도록 완전히 분리 패키징된 배포판입니다.

---

## 🚀 GitHub Pages 배포 방법 (3단계)

### 1단계: GitHub에 새 저장소 생성
1. [GitHub](https://github.com/)에 로그인 후 새 Repository를 생성합니다 (예: `audio-vault` 또는 `my-audio-web`).
2. 저장소 공개 범위를 **Public**으로 설정합니다.

### 2단계: 파일 업로드
이 `deploy-github-pages` 폴더 안의 모든 파일과 폴더를 해당 GitHub 저장소에 업로드(Commit & Push)합니다:
- `index.html`
- `locales/` 폴더
- `images/` 폴더

### 3단계: GitHub Pages 활성화
1. GitHub 저장소의 **[Settings]** ➔ 좌측 메뉴의 **[Pages]** 클릭.
2. **Build and deployment** 섹션의 **Branch**를 `main` (또는 `master`), 폴더를 `/(root)` 로 선택 후 **[Save]** 클릭.
3. 1~2분 후 생성되는 URL(예: `https://<사용자아이디>.github.io/<저장소이름>/`)로 접속하면 끝! 🎉

---

## 🛡️ 관리자 모드 접속 방법 (GitHub Pages)

GitHub Pages는 정적 호스팅이므로 URL 쿼리 파라미터를 통해 관리자로 접속할 수 있습니다:
```
https://<사용자아이디>.github.io/<저장소이름>/?token=<관리자난수토큰>
```
- 백엔드 서버(`https://mer.r-e.kr`)에서 발급된 유효한 관리자 토큰을 입력하면 GitHub Pages에서도 `[🛡️ 관리자 모드 ON]` 버튼 및 곡 수정, 맵핑, 강제 고정 기능이 완벽하게 활성화됩니다.
