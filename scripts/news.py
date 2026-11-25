"""매일 뉴스 수집 → 요약 → 저장 → 푸시 알림.

사용법:
  python scripts/news.py collect   # 구글 뉴스 수집 + GitHub Models 요약 → data/ 저장
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
from urllib.parse import quote

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

MODELS_URL = "https://models.github.ai/inference/chat/completions"
MODEL = os.environ.get("NEWS_MODEL", "openai/gpt-4o-mini")


# ---------- 수집 (구글 뉴스 RSS) ----------

def clean(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html.unescape(text or ""))
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def get_feed(url: str) -> bytes:
    for attempt in range(4):
        try:
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0 (news-digest)"}, timeout=20)
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

PROMPT = """다음은 최근 24시간 '{topic}' 분야 한국 뉴스 목록입니다.
비슷한 기사를 묶어 오늘의 핵심 이슈 3~5개를 뽑아 주세요.

규칙:
- 중요도 순으로 정렬
- title: 이슈를 나타내는 짧은 제목 (25자 이내)
- summary: 무슨 일이 있었는지 1~2문장, 사실만
- articles: 관련 기사 번호 배열 (1~3개)
- 아래 JSON 형식으로만 답하기

{{"issues": [{{"title": "...", "summary": "...", "articles": [1, 2]}}]}}

기사 목록:
{items}"""


def summarize(topic: dict, articles: list[dict]) -> list[dict]:
    items = "\n".join(
        f"{i}. [{a['source']}] {a['title']}" + (f" (관련: {a['desc']})" if a["desc"] else "") for i, a in enumerate(articles, 1)
    )
    r = requests.post(
        MODELS_URL,
        headers={
            "Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
        },
        json={
            "model": MODEL,
            "messages": [
                {"role": "system", "content": "당신은 간결하고 정확한 한국어 뉴스 에디터입니다. 반드시 JSON으로만 답합니다."},
                {"role": "user", "content": PROMPT.format(topic=topic["name"], items=items)},
            ],
            "temperature": 0.3,
        },
        timeout=60,
    )
    try:
        r.raise_for_status()
        content = r.json()["choices"][0]["message"]["content"] or ""
        match = re.search(r"\{.*\}", content, re.S)
        parsed = json.loads(match.group(0) if match else content)
    except Exception as e:
        raise RuntimeError(f"모델 응답 오류 HTTP {r.status_code}: {type(e).__name__}: {e} | 본문: {r.text[:300]!r}") from e

    issues = []
    for iss in parsed.get("issues", [])[:5]:
        links = []
        for n in iss.get("articles", []):
            if isinstance(n, int) and 1 <= n <= len(articles):
                a = articles[n - 1]
                links.append({"title": a["title"], "source": a["source"], "url": a["url"]})
        issues.append({
            "title": str(iss.get("title", "")).strip(),
            "summary": str(iss.get("summary", "")).strip(),
            "articles": links,
        })
    return issues


def fake_issues(topic: dict) -> list[dict]:
    return [
        {
            "title": f"{topic['name']} 테스트 이슈 {n}",
            "summary": f"{topic['name']} 분야의 가짜 요약 문장입니다. 실제 실행 시 AI 요약이 들어갑니다.",
            "articles": [{"title": "예시 기사", "source": "예시신문", "url": "https://news.google.com"}],
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
                articles = fetch_topic(t)
                print(f"[{t['name']}] 기사 {len(articles)}개", flush=True)
                if articles:
                    entry["issues"] = summarize(t, articles)
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
