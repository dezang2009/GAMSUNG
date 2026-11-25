const CONFIG = window.APP_CONFIG || {};
const DATA = CONFIG.dataBase || "data/";
const NATIVE = !!CONFIG.native && !!window.AndroidApp;
const $ = (s) => document.querySelector(s);
const state = { doc: null, topic: null };

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");

function formatDate(d) {
  const [y, m, day] = d.split("-").map(Number);
  const w = "일월화수목금토"[new Date(y, m - 1, day).getDay()];
  return `${y}년 ${m}월 ${day}일 ${w}요일`;
}

async function getJSON(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

// ---------- 다이얼로그 (모달 / 바텀시트 공통) ----------

// 닫힘 애니메이션이 끝나면 실제로 닫는다. 다시 열면 대기 중인 닫기는 취소.
function animateOut(el, finish) {
  el.classList.add("closing");
  let doneFlag = false;
  const done = (e) => {
    if (doneFlag || (e && e.target !== el)) return;
    doneFlag = true;
    el.removeEventListener("animationend", done);
    clearTimeout(timer);
    el.classList.remove("closing");
    el._cancelOut = null;
    finish();
  };
  const timer = setTimeout(done, 400); // 애니메이션 미지원 대비
  el.addEventListener("animationend", done);
  el._cancelOut = () => { doneFlag = true; el.removeEventListener("animationend", done); clearTimeout(timer); el.classList.remove("closing"); };
}

function openDialog(d) {
  d._cancelOut?.();
  if (d.open) d.close();
  d.showModal();
}

function closeDialog(d) {
  if (!d.open || d.classList.contains("closing")) return;
  animateOut(d, () => d.close());
}

document.querySelectorAll("dialog").forEach((d) => {
  d.addEventListener("click", (e) => {
    if (e.target === d || e.target.closest("[data-close]")) closeDialog(d); // 바깥 영역/닫기 버튼
  });
  d.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog(d); }); // ESC
});

// ---------- 뉴스 ----------

async function init() {
  let dates = [];
  try { dates = (await getJSON(`${DATA}index.json?t=${Date.now()}`)).dates || []; } catch {}

  if (!dates.length) {
    $("#dateLabel").textContent = formatDate(new Date().toISOString().slice(0, 10));
    $("#content").innerHTML = `<div class="empty">아직 요약된 뉴스가 없어요.<br>매일 오전 7시쯤 업데이트됩니다.</div>`;
    return;
  }
  $("#dateSelect").innerHTML = dates.map((d) => `<option value="${d}">${d.slice(5).replace("-", "/")}</option>`).join("");
  $("#dateSelect").onchange = (e) => loadDate(e.target.value);
  loadDate(dates[0]);
}

async function loadDate(date) {
  $("#dateLabel").textContent = formatDate(date);
  $("#content").innerHTML = `<div class="empty">불러오는 중…</div>`;
  try {
    state.doc = await getJSON(`${DATA}${date}.json?t=${Date.now()}`);
  } catch {
    $("#content").innerHTML = `<div class="empty error">데이터를 불러오지 못했어요.</div>`;
    return;
  }
  const ids = state.doc.topics.map((t) => t.id);
  const saved = store.get("topic");
  state.topic = ids.includes(state.topic) ? state.topic : ids.includes(saved) ? saved : ids[0];
  render();
}

const currentTopic = () => state.doc.topics.find((x) => x.id === state.topic);

function render() {
  const { doc } = state;
  $("#tabs").innerHTML = doc.topics
    .map((t) => `<button class="tab" role="tab" data-id="${t.id}" aria-selected="${t.id === state.topic}">${esc(t.name)}</button>`)
    .join("");
  $("#tabs").querySelectorAll(".tab").forEach((b) => {
    b.onclick = () => { state.topic = b.dataset.id; store.set("topic", state.topic); render(); };
  });

  const t = currentTopic();
  let html;
  if (t.error && !t.issues.length) html = `<div class="empty error">${esc(t.error)}</div>`;
  else if (!t.issues.length) html = `<div class="empty">이 분야는 오늘 기사가 없어요.</div>`;
  else html = t.issues.map((iss, i) => {
    const srcs = sourcesOf(iss);
    const names = [...new Set(srcs.map((a) => a.source).filter(Boolean))];
    const who = names.length > 2 ? `${names.slice(0, 2).join(" · ")} 외 ${names.length - 2}곳` : names.join(" · ");
    return `
      <button class="card" data-i="${i}" style="animation-delay:${Math.min(i, 10) * 40}ms">
        <div class="card-top"><span class="badge">${pad(i + 1)}</span><h3>${esc(iss.title)}</h3></div>
        <p>${esc(iss.summary)}</p>
        <div class="card-foot">
          <span class="src">${esc(who || "관련 기사")}</span>
          <span class="more">언론사 ${names.length || srcs.length}곳 →</span>
        </div>
      </button>`;
  }).join("");

  const time = doc.generated_at ? doc.generated_at.slice(11, 16) : "";
  $("#content").innerHTML = html + (time ? `<p class="meta">${time} 업데이트 · AI 요약은 틀릴 수 있어요</p>` : "");
  $("#content").querySelectorAll(".card").forEach((c) => { c.onclick = () => openReader(t, t.issues[+c.dataset.i]); });
}

// 예전 데이터(articles)와 새 데이터(sources) 모두 지원
const sourcesOf = (iss) => iss.sources || iss.articles || [];

// ---------- 사진 없는 기사용 그래픽 ----------

const PALETTES = {
  economy: ["#2563eb", "#60a5fa", "#dbeafe"],
  it_ai: ["#4f46e5", "#a78bfa", "#ede9fe"],
  world: ["#0d9488", "#5eead4", "#ccfbf1"],
  sports: ["#ea580c", "#fdba74", "#ffedd5"],
};

function hash(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function graphic(seed, topicId) {
  const [a, b, c] = PALETTES[topicId] || PALETTES.economy;
  let h = hash(seed || "news");
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % 1000) / 1000;
  const blobs = Array.from({ length: 4 }, (_, k) =>
    `<circle cx="${(rnd() * 160).toFixed(0)}" cy="${(rnd() * 90).toFixed(0)}" r="${(20 + rnd() * 40).toFixed(0)}" fill="${k % 2 ? b : c}" opacity="${(0.35 + rnd() * 0.4).toFixed(2)}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
    <filter id="f"><feGaussianBlur stdDeviation="9"/></filter></defs>
    <rect width="160" height="90" fill="url(#g)"/><g filter="url(#f)">${blobs}</g>
    <g fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.2"><circle cx="${(30 + rnd() * 100).toFixed(0)}" cy="45" r="26"/><circle cx="${(30 + rnd() * 100).toFixed(0)}" cy="45" r="40"/></g></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

function bindFallback(root) {
  root.querySelectorAll("img[data-fallback]").forEach((img) => {
    img.onerror = () => { img.onerror = null; img.src = img.dataset.fallback; };
  });
}

// ---------- 기사 화면 ----------

function timeLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const k = new Date(d.getTime() + 9 * 3600e3); // KST
  return `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일 ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}

function openReader(t, iss) {
  const srcs = sourcesOf(iss);
  const first = srcs[0] || {};
  const body = iss.body?.length ? iss.body : first.body?.length ? first.body : [iss.summary].filter(Boolean);
  const image = iss.image || srcs.find((a) => a.image)?.image || "";
  const fb = graphic(iss.title, t.id);
  const names = [...new Set(srcs.map((a) => a.source).filter(Boolean))];
  const arrow = `<svg class="go" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>`;

  $("#readerSrc").textContent = t.name;
  $("#readerBody").innerHTML = `
    <div class="hero"><img alt="" referrerpolicy="no-referrer" src="${esc(image || fb)}" data-fallback="${esc(fb)}"></div>
    <div class="reader-content">
      <span class="badge">${esc(t.name)}</span>
      <h1>${esc(iss.title)}</h1>
      <p class="byline">${esc([names.length > 1 ? `언론사 ${names.length}곳 종합` : names[0], timeLabel(iss.pub || first.pub)].filter(Boolean).join(" · "))}</p>
      ${iss.body?.length || first.body?.length ? `<span class="ai-note">AI가 여러 기사를 바탕으로 요약했어요</span>` : ""}
      ${body.map((p) => `<p class="para">${esc(p)}</p>`).join("")}
      ${srcs.length ? `
        <h4 class="src-head">보도한 언론사 ${names.length || srcs.length}곳</h4>
        <ul class="article-list">${srcs.map((a) => `
          <li><a class="item" href="${esc(a.url)}" target="_blank" rel="noopener">
            <img class="thumb" alt="" loading="lazy" referrerpolicy="no-referrer" src="${esc(a.image || graphic(a.title, t.id))}" data-fallback="${esc(graphic(a.title, t.id))}">
            <span class="t">${esc(a.title)}<span class="s">${esc(a.source || "")}</span></span>${arrow}
          </a></li>`).join("")}</ul>` : ""}
    </div>`;
  bindFallback($("#readerBody"));
  const r = $("#reader");
  r._cancelOut?.();
  r.hidden = false;
  r.scrollTop = 0;
  document.body.classList.add("reading");
  history.pushState({ reader: true }, "", "#article");
}

function hideReader() {
  const r = $("#reader");
  if (r.hidden) return;
  if (r.classList.contains("closing")) return;
  animateOut(r, () => { r.hidden = true; document.body.classList.remove("reading"); });
}

$("#readerBack").onclick = () => (history.state?.reader ? history.back() : hideReader());

// 앱(안드로이드) 뒤로가기: 처리했으면 true, 홈 목록이면 false(앱 종료)
window.appBack = () => {
  const openDlg = [...document.querySelectorAll("dialog")].find((d) => d.open);
  if (openDlg) { closeDialog(openDlg); return true; }
  if (!$("#reader").hidden) {
    hideReader();
    if (history.state?.reader) history.replaceState(null, "", location.pathname + location.search);
    return true;
  }
  return false;
};
addEventListener("popstate", hideReader); // 폰 뒤로가기
if (location.hash === "#article") history.replaceState(null, "", location.pathname + location.search);

// ---------- 알림 설정 (바텀시트) ----------

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

function field(label, value) {
  return `<div class="field"><label>${label}</label>
    <div class="box"><textarea readonly>${esc(value)}</textarea>
    <button type="button" class="btn line copy">복사</button></div></div>`;
}

function bindCopy(root) {
  root.querySelectorAll(".copy").forEach((b) => {
    b.onclick = async () => {
      const ta = b.closest(".field").querySelector("textarea");
      try { await navigator.clipboard.writeText(ta.value); } catch { ta.select(); document.execCommand("copy"); }
      b.textContent = "완료";
      setTimeout(() => (b.textContent = "복사"), 1500);
    };
  });
}

function openSettings() {
  const body = $("#sheetBody");
  if (NATIVE) {
    const on = window.AndroidApp.notificationsEnabled();
    body.innerHTML = `
      <div class="step">
        <span class="step-label">매일 알림</span>
        <h4>${on ? "오전 7시쯤 알림이 와요" : "알림이 꺼져 있어요"}</h4>
        <p>${on ? "새 요약이 올라오면 앱이 알아서 알려드려요. 따로 설정할 건 없어요."
               : "휴대폰 설정 → 앱 → 감성 뉴스 → 알림에서 허용해 주세요."}</p>
        <div class="row"><button type="button" class="btn line" id="testBtn">테스트 알림</button></div>
      </div>`;
    $("#testBtn").onclick = () => window.AndroidApp.testNotification();
    openDialog($("#sheet"));
    return;
  }
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    body.innerHTML = isIOS && !standalone
      ? `<div class="step"><span class="step-label">먼저 해주세요</span><h4>홈 화면에 추가</h4>
           <p>아이폰은 홈 화면에 추가한 앱에서만 알림을 받을 수 있어요.</p>
           <ol><li>Safari 하단 <b>공유</b> 버튼</li><li><b>홈 화면에 추가</b></li><li>홈 화면 아이콘으로 열고 다시 🔔</li></ol></div>`
      : `<div class="step"><h4>알림 미지원 브라우저</h4><p>Chrome, Edge, Safari 최신 버전을 사용해 주세요.</p></div>`;
  } else if (!CONFIG.vapidPublicKey) {
    body.innerHTML = `
      <div class="step">
        <span class="step-label">STEP 1</span>
        <h4>알림 키 만들기</h4>
        <p>알림 서명에 쓸 키를 이 기기에서 만듭니다. 키는 어디에도 전송되지 않아요.</p>
        <div class="row"><button type="button" class="btn" id="genKeys">키 만들기</button></div>
        <div id="keysOut"></div>
      </div>`;
    $("#genKeys").onclick = async () => {
      const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      const pub = b64url(await crypto.subtle.exportKey("raw", kp.publicKey));
      const priv = (await crypto.subtle.exportKey("jwk", kp.privateKey)).d;
      $("#keysOut").innerHTML = `
        <div class="notice">지금 바로 GitHub에 등록하세요. 창을 닫으면 다시 볼 수 없어요.</div>
        ${field("공개키 → Variables · VAPID_PUBLIC_KEY", pub)}
        ${field("비밀키 → Secrets · VAPID_PRIVATE_KEY", priv)}
        <p style="margin-top:12px">등록 후 Actions에서 <b>Daily News</b>를 실행하면 STEP 2가 나타나요.</p>`;
      bindCopy($("#keysOut"));
    };
  } else {
    body.innerHTML = `
      <div class="step">
        <span class="step-label">STEP 2</span>
        <h4>이 기기에서 알림 켜기</h4>
        <p>알림을 허용하면 구독 정보가 나와요. GitHub Secret <b>PUSH_SUBSCRIPTION</b>에 넣으면 끝!</p>
        <div class="row">
          <button type="button" class="btn" id="subBtn">알림 켜기</button>
          <button type="button" class="btn line" id="testBtn">테스트 알림</button>
        </div>
        <div id="subOut"></div>
      </div>`;
    $("#subBtn").onclick = subscribe;
    $("#testBtn").onclick = async () => {
      if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification("테스트 알림", { body: "알림이 잘 동작해요 👍", icon: "icon-192.png" });
    };
  }
  openDialog($("#sheet"));
}

async function subscribe() {
  const out = $("#subOut");
  if ((await Notification.requestPermission()) !== "granted") {
    out.innerHTML = `<p style="margin-top:12px">알림이 차단되어 있어요. 브라우저/기기 설정에서 허용해 주세요.</p>`;
    return;
  }
  const reg = await navigator.serviceWorker.ready;
  const key = fromB64url(CONFIG.vapidPublicKey);
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const cur = sub.options?.applicationServerKey;
    if (cur && b64url(cur) !== CONFIG.vapidPublicKey) { await sub.unsubscribe(); sub = null; }
  }
  try {
    sub = sub || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
  } catch (e) {
    out.innerHTML = `<p style="margin-top:12px">구독에 실패했어요: ${esc(e.message)}</p>`;
    return;
  }
  out.innerHTML = `<div class="notice">알림 구독 완료! 아래 값을 등록하세요.</div>${field("Secrets · PUSH_SUBSCRIPTION", JSON.stringify(sub))}`;
  bindCopy(out);
}

$("#settingsBtn").onclick = openSettings;
if (!NATIVE && "serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
init();
