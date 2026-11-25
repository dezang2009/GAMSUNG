const CONFIG = window.APP_CONFIG || {};
const $ = (s) => document.querySelector(s);
const state = { doc: null, topic: null };

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function formatDate(d) {
  const [y, m, day] = d.split("-").map(Number);
  const w = "일월화수목금토"[new Date(y, m - 1, day).getDay()];
  return `${y}년 ${m}월 ${day}일 (${w})`;
}

async function getJSON(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

// ---------- 뉴스 ----------

async function init() {
  let dates = [];
  try { dates = (await getJSON("data/index.json")).dates || []; } catch {}

  if (!dates.length) {
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

function render() {
  const { doc } = state;
  $("#tabs").innerHTML = doc.topics
    .map((t) => `<button class="tab" role="tab" data-id="${t.id}" aria-selected="${t.id === state.topic}">${esc(t.name)}</button>`)
    .join("");
  $("#tabs").querySelectorAll(".tab").forEach((b) => {
    b.onclick = () => { state.topic = b.dataset.id; store.set("topic", state.topic); render(); };
  });

  const t = doc.topics.find((x) => x.id === state.topic);
  let html;
  if (t.error && !t.issues.length) html = `<div class="empty error">${esc(t.error)}</div>`;
  else if (!t.issues.length) html = `<div class="empty">이 분야는 오늘 기사가 없어요.</div>`;
  else html = t.issues.map((iss, i) => `
      <article class="card">
        <span class="num">${String(i + 1).padStart(2, "0")}</span>
        <h3>${esc(iss.title)}</h3>
        <p>${esc(iss.summary)}</p>
        ${iss.articles?.length ? `<ul class="links">${iss.articles.map((a) =>
          `<li><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.title)}</a></li>`).join("")}</ul>` : ""}
      </article>`).join("");

  const time = doc.generated_at ? doc.generated_at.slice(11, 16) : "";
  $("#content").innerHTML = html + (time ? `<p class="meta">${time} 업데이트 · AI 요약은 틀릴 수 있어요</p>` : "");
}

// ---------- 알림 설정 ----------

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

function field(label, value) {
  return `<div class="field"><label>${label}</label><textarea readonly>${esc(value)}</textarea>
    <div class="row"><button type="button" class="btn ghost copy">복사</button></div></div>`;
}

function bindCopy(root) {
  root.querySelectorAll(".copy").forEach((b) => {
    b.onclick = async () => {
      const ta = b.closest(".field").querySelector("textarea");
      try { await navigator.clipboard.writeText(ta.value); } catch { ta.select(); document.execCommand("copy"); }
      b.textContent = "복사됨 ✓";
      setTimeout(() => (b.textContent = "복사"), 1500);
    };
  });
}

async function openSettings() {
  const body = $("#settingsBody");
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    body.innerHTML = isIOS && !standalone
      ? `<p>아이폰은 홈 화면에 추가한 앱에서만 알림을 받을 수 있어요.</p>
         <ol><li>Safari 하단 <b>공유</b> 버튼</li><li><b>홈 화면에 추가</b></li><li>홈 화면 아이콘으로 앱을 열고 다시 이 화면으로</li></ol>`
      : `<p>이 브라우저는 푸시 알림을 지원하지 않아요. Chrome, Edge, Safari 최신 버전을 사용해 주세요.</p>`;
  } else if (!CONFIG.vapidPublicKey) {
    body.innerHTML = `
      <h4>1단계 · 알림 키 만들기</h4>
      <p>알림 서명에 쓸 키를 이 기기에서 만듭니다. 키는 어디에도 전송되지 않아요.</p>
      <div class="row"><button type="button" class="btn" id="genKeys">키 만들기</button></div>
      <div id="keysOut"></div>`;
    $("#genKeys").onclick = async () => {
      const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      const pub = b64url(await crypto.subtle.exportKey("raw", kp.publicKey));
      const priv = (await crypto.subtle.exportKey("jwk", kp.privateKey)).d;
      $("#keysOut").innerHTML = `
        <p class="ok">지금 바로 두 값을 GitHub에 등록하세요. 창을 닫으면 다시 볼 수 없어요.</p>
        ${field("공개키 → Variables 탭 · VAPID_PUBLIC_KEY", pub)}
        ${field("비밀키 → Secrets 탭 · VAPID_PRIVATE_KEY", priv)}
        <p>등록 후 Actions에서 <b>Daily News</b>를 한 번 실행하면 2단계가 나타나요.</p>`;
      bindCopy($("#keysOut"));
    };
  } else {
    body.innerHTML = `
      <h4>2단계 · 이 기기에서 알림 켜기</h4>
      <p>버튼을 누르고 알림을 허용하면 구독 정보가 나와요. 이 값을 GitHub Secret <b>PUSH_SUBSCRIPTION</b>에 넣으면 끝!</p>
      <div class="row"><button type="button" class="btn" id="subBtn">알림 켜기</button>
      <button type="button" class="btn ghost" id="testBtn">테스트 알림</button></div>
      <div id="subOut"></div>`;
    $("#subBtn").onclick = subscribe;
    $("#testBtn").onclick = async () => {
      if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification("테스트 알림", { body: "알림이 잘 동작해요 👍", icon: "icon-192.png" });
    };
  }
  $("#settings").showModal();
}

async function subscribe() {
  const out = $("#subOut");
  if ((await Notification.requestPermission()) !== "granted") {
    out.innerHTML = `<p>알림이 차단되어 있어요. 브라우저/기기 설정에서 허용해 주세요.</p>`;
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
    out.innerHTML = `<p>구독에 실패했어요: ${esc(e.message)}</p>`;
    return;
  }
  out.innerHTML = `<p class="ok">알림 구독 완료!</p>${field("Secrets 탭 · PUSH_SUBSCRIPTION", JSON.stringify(sub))}`;
  bindCopy(out);
}

$("#settingsBtn").onclick = openSettings;
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
init();
