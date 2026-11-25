"""매일 뉴스 수집 → 요약 → 저장 → 푸시 알림.

사용법:
  python scripts/news.py collect   # 네이버 수집 + GitHub Models 요약 → data/ 저장
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
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

import requests

KST = timezone(timedelta(hours=9))
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
KEEP_DAYS = 30
MAX_ARTICLES = 25

TOPICS = [
    {"id": "economy", "name": "경제", "queries": ["경제", "증시", "금리", "환율"]},
    {"id": "it_ai", "name": "IT/AI", "queries": ["인공지능", "AI", "반도체", "IT"]},
    {"id": "world", "name": "국제", "queries": ["국제", "외교", "미국", "중국"]},
    {"id": "sports", "name": "스포츠", "queries": ["스포츠", "야구", "축구"]},
]

NAVER_URL = "https://openapi.naver.com/v1/search/news.json"
MODELS_URL = "https://models.github.ai/inference/chat/completions"
MODEL = os.environ.get("NEWS_MODEL", "openai/gpt-4o-mini")


# ---------- 수집 ----------

def clean(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text or "")
    return html.unescape(text).strip()


def fetch_topic(topic: dict) -> list[dict]:
    headers = {
        "X-Naver-Client-Id": os.environ["NAVER_CLIENT_ID"],
        "X-Naver-Client-Secret": os.environ["NAVER_CLIENT_SECRET"],
    }
    since = datetime.now(KST) - timedelta(hours=24)
    seen, articles = set(), []
    for q in topic["queries"]:
        r = requests.get(
            NAVER_URL,
            headers=headers,
            params={"query": q, "display": 30, "sort": "date"},
            timeout=15,
        )
        r.raise_for_status()
        for it in r.json().get("items", []):
            title = clean(it.get("title"))
            key = re.sub(r"\W", "", title)[:40]
            if not title or key in seen:
                continue
            try:
                pub = parsedate_to_datetime(it["pubDate"])
            except Exception:
                continue
            if pub < since:
                continue
            seen.add(key)
            articles.append({
                "title": title,
                "desc": clean(it.get("description"))[:150],
                "url": it.get("originallink") or it.get("link"),
                "pub": pub.isoformat(),
            })
    articles.sort(key=lambda a: a["pub"], reverse=True)
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
        f"{i}. {a['title']} — {a['desc']}" for i, a in enumerate(articles, 1)
    )
    r = requests.post(
        MODELS_URL,
        headers={
            "Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}",
            "Content-Type": "application/json",
        },
        json={
            "model": MODEL,
            "messages": [
                {"role": "system", "content": "당신은 간결하고 정확한 한국어 뉴스 에디터입니다."},
                {"role": "user", "content": PROMPT.format(topic=topic["name"], items=items)},
            ],
            "temperature": 0.3,
            "response_format": {"type": "json_object"},
        },
        timeout=60,
    )
    r.raise_for_status()
    content = r.json()["choices"][0]["message"]["content"]
    match = re.search(r"\{.*\}", content, re.S)
    parsed = json.loads(match.group(0) if match else content)

    issues = []
    for iss in parsed.get("issues", [])[:5]:
        links = []
        for n in iss.get("articles", []):
            if isinstance(n, int) and 1 <= n <= len(articles):
                a = articles[n - 1]
                links.append({"title": a["title"], "url": a["url"]})
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
            "articles": [{"title": "예시 기사", "url": "https://news.naver.com"}],
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
                print(f"[{t['name']}] 기사 {len(articles)}개")
                if articles:
                    entry["issues"] = summarize(t, articles)
        except Exception as e:  # 한 토픽이 실패해도 나머지는 계속
            failed += 1
            entry["error"] = "요약을 가져오지 못했습니다."
            print(f"[{t['name']}] 실패: {e}", file=sys.stderr)
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
