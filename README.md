# 감성 뉴스

매일 아침 7시, 경제 · IT/AI · 국제 · 스포츠 뉴스를 AI로 요약해 푸시 알림으로 보내주는 개인용 PWA.

- 수집: 네이버 뉴스 검색 API
- 요약: GitHub Models (`openai/gpt-4o-mini`, 무료)
- 실행: GitHub Actions (매일 06:40 KST)
- 앱: GitHub Pages (PWA, 웹 푸시)

## 구조

```
scripts/news.py               수집 · 요약 · 저장 · 푸시
.github/workflows/daily.yml   매일 실행 + Pages 배포
web/                          PWA (index.html, app.js, sw.js …)
data/                         날짜별 요약 JSON (최근 30일)
```

## 설정 (최초 1회)

| 종류 | 이름 | 값 |
|---|---|---|
| Secret | `NAVER_CLIENT_ID` | 네이버 개발자센터 Client ID |
| Secret | `NAVER_CLIENT_SECRET` | 네이버 개발자센터 Client Secret |
| Variable | `VAPID_PUBLIC_KEY` | 앱 알림 설정 1단계에서 생성 |
| Secret | `VAPID_PRIVATE_KEY` | 앱 알림 설정 1단계에서 생성 |
| Secret | `PUSH_SUBSCRIPTION` | 앱 알림 설정 2단계에서 생성 |

Settings → Pages → Source: **GitHub Actions**

## 로컬 테스트

```bash
pip install -r requirements.txt
python scripts/news.py collect --dry-run   # API 없이 가짜 데이터 생성
cp -r data web/ && python -m http.server -d web 8000
```

## 토픽 바꾸기

`scripts/news.py`의 `TOPICS`에서 이름과 검색 키워드를 수정하면 됩니다.
