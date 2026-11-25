"""매일 뉴스 수집 → 요약 → 저장 → 푸시 알림.

사용법:
  python scripts/news.py collect   # 구글 뉴스 수집 + Gemini 요약 → data/ 저장
  python scripts/news.py notify    # 오늘 요약으로 웹 푸시 발송
  python scripts/news.py collect --dry-run   # API 없이 가짜 데이터로 테스트
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import quote, urljoin

import requests

KST = timezone(timedelta(hours=9))
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
KEEP_DAYS = 30
MAX_ARTICLES = 25

GN = "https://news.google.com/rss"
GN_PARAMS = "hl=ko&gl=KR&ceid=KR:ko"


def gn_topic(name: str) -> str:
    return f"{GN}/headlines/section/topic/{name}?{GN_PARAMS}"


def gn_search(q: str) -> str:
    return f"{GN}/search?q={quote(q + ' when:1d')}&{GN_PARAMS}"


TOPICS = [
    {"id": "economy", "name": "경제", "feeds": [gn_topic("BUSINESS"), gn_search("경제")]},
    {"id": "it_ai", "name": "IT/AI", "feeds": [gn_topic("TECHNOLOGY"), gn_search("인공지능 OR AI")]},
    {"id": "world", "name": "국제", "feeds": [gn_topic("WORLD")]},
    {"id": "sports", "name": "스포츠", "feeds": [gn_topic("SPORTS")]},
]

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
# 앞에서부터 시도, 404(모델 없음)면 다음 모델로
GEMINI_MODELS = [m for m in [os.environ.get("GEMINI_MODEL"), "gemini-flash-latest", "gemini-flash-lite-latest"] if m]
ENRICH_LIMIT = 15        # 토픽당 원문 페이지를 열어볼 기사 수
GEMINI_GAP_SEC = 15      # 무료 한도(분당 요청 수) 대비 호출 간격
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"


# ---------- 수집 (구글 뉴스 RSS) ----------

def clean(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html.unescape(text or ""))
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def get_feed(url: str) -> bytes:
    for attempt in range(4):
        try:
            r = requests.get(url, headers={"User-Agent": UA}, timeout=20)
            if r.status_code == 200:
                return r.content
            err = f"HTTP {r.status_code}"
        except requests.RequestException as e:
            err = str(e)
        time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"피드 실패 {err}: {url}")


def parse_feed(xml: bytes) -> list[dict]:
    """구글 뉴스 RSS → [{title, source, desc, url, pub}]"""
    out = []
    for it in ET.fromstring(xml).iter("item"):
        source = (it.findtext("source") or "").strip()
        title = clean(it.findtext("title"))
        if source and title.endswith(f" - {source}"):
            title = title[: -len(source) - 3].strip()
        # description 안에 묶인 관련 기사 제목들 → 요약 재료
        related = [clean(a) for a in re.findall(r"<a [^>]*>(.*?)</a>", html.unescape(it.findtext("description") or ""))]
        related = [t for t in related if t and t != title]
        try:
            pub = parsedate_to_datetime(it.findtext("pubDate"))
        except Exception:
            continue
        out.append({
            "title": title,
            "source": source,
            "desc": " / ".join(related)[:150],
            "url": (it.findtext("link") or "").strip(),
            "pub": pub,
        })
    return out


def fetch_topic(topic: dict) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    seen, articles = set(), []
    for url in topic["feeds"]:
        for a in parse_feed(get_feed(url)):
            key = re.sub(r"\W", "", a["title"])[:40]
            if not a["title"] or key in seen or a["pub"] < since:
                continue
            seen.add(key)
            articles.append(a)
    articles.sort(key=lambda a: a["pub"], reverse=True)
    for a in articles:
        a["pub"] = a["pub"].isoformat()
    return articles[:MAX_ARTICLES]


# ---------- 요약 ----------

# ---------- 원문 정보 (사진 · 요약 재료) ----------

def decode_links(articles: list[dict]) -> None:
    """구글 뉴스 링크 → 언론사 원문 링크 (실패하면 구글 링크 유지)"""
    try:
        from googlenewsdecoder import gnewsdecoder
        res = gnewsdecoder([a["url"] for a in articles], timeout=15)
        for a, r in zip(articles, res):
            if r.get("success") and r.get("decoded_url"):
                a["url"] = r["decoded_url"]
    except Exception as e:
        print(f"  링크 변환 실패: {e}", flush=True)


def meta(page: str, *names: str) -> str:
    for n in names:
        m = re.search(
            rf'<meta[^>]+(?:property|name)=["\']{re.escape(n)}["\'][^>]*content=["\']([^"\']+)', page, re.I
        ) or re.search(
            rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\']{re.escape(n)}["\']', page, re.I
        )
        if m:
            return html.unescape(m.group(1)).strip()
    return ""


def enrich(a: dict) -> None:
    """원문 페이지에서 대표 사진 주소와 요약용 발췌문을 가져온다 (발췌문은 저장하지 않음)."""
    a["image"], a["excerpt"] = "", ""
    if "news.google.com" in a["url"]:
        return
    try:
        r = requests.get(a["url"], headers={"User-Agent": UA}, timeout=10)
        if r.status_code != 200 or "html" not in r.headers.get("content-type", ""):
            return
        r.encoding = r.apparent_encoding if not r.encoding or r.encoding.lower() == "iso-8859-1" else r.encoding
        page = r.text[:1_500_000]
    except requests.RequestException:
        return

    img = meta(page, "og:image", "twitter:image", "og:image:url")
    if img:
        img = urljoin(a["url"], img)
        a["image"] = img.replace("http://", "https://", 1)

    text = ""
    try:
        import trafilatura
        text = trafilatura.extract(page, include_comments=False, include_tables=False) or ""
    except Exception:
        pass
    if len(text) < 80:
        text = meta(page, "og:description", "description")
    a["excerpt"] = re.sub(r"\s+", " ", text)[:1000]


# ---------- 요약 (Gemini) ----------

PROMPT = """다음은 최근 24시간 '{topic}' 분야 한국 뉴스 목록입니다.

할 일:
1. 비슷한 기사를 묶어 오늘의 핵심 이슈 3~5개를 중요도 순으로 뽑습니다.
2. 이슈마다 대표 기사 1~3개를 고르고, 각 기사를 앱에서 읽을 '요약 기사'로 새로 씁니다.

규칙:
- issue.title: 이슈 제목 (25자 이내)
- issue.summary: 무슨 일이 있었는지 1~2문장
- article.n: 기사 번호
- article.body: 문단 3~4개 배열. 각 문단 2~3문장.
  · 제공된 제목·발췌문에 있는 사실만 사용하고, 추측하거나 지어내지 않습니다.
  · 원문 문장을 그대로 옮기지 말고 자연스러운 기사체로 새로 씁니다.
  · 발췌문이 없는 기사는 제목에서 알 수 있는 내용만 1~2문단으로 짧게 씁니다.
- JSON으로만 답합니다.

{{"issues": [{{"title": "...", "summary": "...", "articles": [{{"n": 1, "body": ["...", "..."]}}]}}]}}

기사 목록:
{items}"""

_last_call = [0.0]


def gemini(prompt: str) -> dict:
    key = os.environ["GEMINI_API_KEY"]
    wait = GEMINI_GAP_SEC - (time.time() - _last_call[0])
    if wait > 0:
        time.sleep(wait)

    body = {
        "systemInstruction": {"parts": [{"text": "당신은 간결하고 정확한 한국어 뉴스 에디터입니다."}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "responseMimeType": "application/json"},
    }
    last_err = ""
    for model in GEMINI_MODELS:
        for attempt in range(3):
            _last_call[0] = time.time()
            r = requests.post(
                GEMINI_URL.format(model=model),
                headers={"x-goog-api-key": key, "Content-Type": "application/json"},
                json=body, timeout=120,
            )
            if r.status_code == 429 or r.status_code >= 500:
                last_err = f"{model} HTTP {r.status_code}: {r.text[:200]}"
                time.sleep(65 if r.status_code == 429 else 10)
                continue
            break
        if r.status_code == 404:
            last_err = f"{model} 없음(404)"
            continue
        try:
            r.raise_for_status()
            parts = r.json()["candidates"][0]["content"]["parts"]
            text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
            match = re.search(r"\{.*\}", text, re.S)
            return json.loads(match.group(0) if match else text)
        except Exception as e:
            raise RuntimeError(f"Gemini 응답 오류 {model} HTTP {r.status_code}: {type(e).__name__}: {e} | 본문: {r.text[:300]!r}") from e
    raise RuntimeError(f"Gemini 호출 실패: {last_err}")


def summarize(topic: dict, articles: list[dict]) -> list[dict]:
    items = "\n".join(
        f"{i}. [{a['source']}] {a['title']}"
        + (f"\n   발췌: {a['excerpt']}" if a.get("excerpt") else (f"\n   관련: {a['desc']}" if a.get("desc") else ""))
        for i, a in enumerate(articles, 1)
    )
    parsed = gemini(PROMPT.format(topic=topic["name"], items=items))

    issues = []
    for iss in parsed.get("issues", [])[:5]:
        links = []
        for art in iss.get("articles", [])[:3]:
            n = art.get("n") if isinstance(art, dict) else art
            if not isinstance(n, int) or not 1 <= n <= len(articles):
                continue
            a = articles[n - 1]
            body = art.get("body", []) if isinstance(art, dict) else []
            links.append({
                "title": a["title"],
                "source": a["source"],
                "url": a["url"],
                "image": a.get("image", ""),
                "pub": a["pub"],
                "body": [str(b).strip() for b in body if str(b).strip()][:5],
            })
        if links:
            issues.append({
                "title": str(iss.get("title", "")).strip(),
                "summary": str(iss.get("summary", "")).strip(),
                "articles": links,
            })
    return issues


def fake_issues(topic: dict) -> list[dict]:
    now = datetime.now(timezone.utc).isoformat()
    return [
        {
            "title": f"{topic['name']} 테스트 이슈 {n}",
            "summary": f"{topic['name']} 분야의 가짜 요약 문장입니다. 실제 실행 시 AI 요약이 들어갑니다.",
            "articles": [{
                "title": f"{topic['name']} 예시 기사 {n}",
                "source": "예시신문",
                "url": "https://news.google.com",
                "image": "",
                "pub": now,
                "body": ["첫 번째 문단입니다. 실제 실행 시 AI가 쓴 요약 기사가 들어갑니다.",
                         "두 번째 문단입니다. 원문 내용을 바탕으로 새로 쓴 글이 표시됩니다."],
            }],
        }
        for n in range(1, 4)
    ]


# ---------- 저장 ----------

def save(day: str, topics: list[dict]) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    doc = {
        "date": day,
        "generated_at": datetime.now(KST).isoformat(timespec="seconds"),
        "topics": topics,
    }
    (DATA_DIR / f"{day}.json").write_text(
        json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    cutoff = (datetime.now(KST) - timedelta(days=KEEP_DAYS)).strftime("%Y-%m-%d")
    dates = []
    for f in DATA_DIR.glob("????-??-??.json"):
        if f.stem < cutoff:
            f.unlink()
        else:
            dates.append(f.stem)
    dates.sort(reverse=True)
    (DATA_DIR / "index.json").write_text(
        json.dumps({"dates": dates}, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def collect(dry_run: bool) -> None:
    day = datetime.now(KST).strftime("%Y-%m-%d")
    out, failed = [], 0
    for t in TOPICS:
        entry = {"id": t["id"], "name": t["name"], "issues": [], "error": None}
        try:
            if dry_run:
                entry["issues"] = fake_issues(t)
            else:
                articles = fetch_topic(t)[:ENRICH_LIMIT]
                print(f"[{t['name']}] 기사 {len(articles)}개", flush=True)
                if articles:
                    decode_links(articles)
                    for a in articles:
                        enrich(a)
                    print(f"[{t['name']}] 원문 {sum(1 for a in articles if a['excerpt'])}개 · 사진 {sum(1 for a in articles if a['image'])}개", flush=True)
                    entry["issues"] = summarize(t, articles)
                    print(f"[{t['name']}] 이슈 {len(entry['issues'])}개", flush=True)
        except Exception as e:  # 한 토픽이 실패해도 나머지는 계속
            failed += 1
            entry["error"] = "요약을 가져오지 못했습니다."
            print(f"[{t['name']}] 실패: {e}", flush=True)
        out.append(entry)
    save(day, out)
    print(f"저장 완료: data/{day}.json")
    if failed == len(TOPICS):
        sys.exit(1)


# ---------- 알림 ----------

def notify() -> None:
    sub = os.environ.get("PUSH_SUBSCRIPTION", "").strip()
    key = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
    if not sub or not key:
        print("PUSH_SUBSCRIPTION 또는 VAPID_PRIVATE_KEY 없음 → 알림 건너뜀")
        return

    from pywebpush import webpush, WebPushException

    day = datetime.now(KST).strftime("%Y-%m-%d")
    doc = json.loads((DATA_DIR / f"{day}.json").read_text(encoding="utf-8"))
    heads = [
        f"{t['name']}: {t['issues'][0]['title']}"
        for t in doc["topics"] if t["issues"]
    ]
    body = "\n".join(heads) if heads else "오늘의 요약을 확인하세요."

    site = os.environ.get("SITE_URL", "")
    payload = {"title": f"오늘의 뉴스 · {day[5:].replace('-', '/')}", "body": body, "url": "./"}
    m = re.match(r"https://[^/]+", site)
    subject = m.group(0) if m else "mailto:noreply@example.com"
    try:
        webpush(
            subscription_info=json.loads(sub),
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=key,
            vapid_claims={"sub": subject},
            ttl=6 * 3600,
        )
        print("푸시 발송 완료")
    except WebPushException as e:
        status = getattr(e.response, "status_code", None)
        print(f"푸시 실패({status}): {e}", file=sys.stderr)
        if status in (404, 410):
            print("구독이 만료됐습니다. 앱에서 알림을 다시 켜고 PUSH_SUBSCRIPTION을 갱신하세요.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("cmd", choices=["collect", "notify"])
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()
    collect(a.dry_run) if a.cmd == "collect" else notify()
