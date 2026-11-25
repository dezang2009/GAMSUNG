const CONFIG = window.APP_CONFIG || {};
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

function openDialog(d) {
  d.classList.remove("closing");
  d.showModal();
}

function closeDialog(d) {
  if (!d.open || d.classList.contains("closing")) return;
  d.classList.add("closing");
  const done = () => { d.classList.remove("closing"); d.close(); };
  d.addEventListener("animationend", done, { once: true });
  setTimeout(() => d.open && done(), 400); // 애니메이션 미지원 대비
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
  try { dates = (await getJSON("data/index.json")).dates || []; } catch {}

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
    state.doc = await getJSON(`data/${date}.json`);
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
    const sources = [...new Set((iss.articles || []).map((a) => a.source).filter(Boolean))];
    return `
      <button class="card" data-i="${i}" style="animation-delay:${i * 50}ms">
        <div class="card-top"><span class="badge">${pad(i + 1)}</span><h3>${esc(iss.title)}</h3></div>
        <p>${esc(iss.summary)}</p>
        <div class="card-foot">
          <span class="src">${esc(sources.join(" · ") || "관련 기사")}</span>
          <span class="more">기사 ${iss.articles?.length || 0}개 →</span>
        </div>
      </button>`;
  }).join("");

  const time = doc.generated_at ? doc.generated_at.slice(11, 16) : "";
  $("#content").innerHTML = html + (time ? `<p class="meta">${time} 업데이트 · AI 요약은 틀릴 수 있어요</p>` : "");
  $("#content").querySelectorAll(".card").forEach((c) => { c.onclick = () => openIssue(+c.dataset.i); });
}

function openIssue(i) {
  const t = currentTopic();
  const iss = t.issues[i];
  const arrow = `<svg class="go" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>`;
  $("#modalBody").innerHTML = `
    <span class="badge">${esc(t.name)} ${pad(i + 1)}</span>
    <h2 id="modalTitle">${esc(iss.title)}</h2>
    <p>${esc(iss.summary)}</p>
    ${iss.articles?.length ? `<h4>관련 기사</h4><ul class="article-list">${iss.articles.map((a) => `
      <li><a href="${esc(a.url)}" target="_blank" rel="noopener">
        <span class="t">${esc(a.title)}${a.source ? `<span class="s">${esc(a.source)}</span>` : ""}</span>${arrow}
      </a></li>`).join("")}</ul>` : ""}
    <div class="modal-actions"><button type="button" class="btn block" data-close>닫기</button></div>`;
  openDialog($("#modal"));
}

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
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
init();
