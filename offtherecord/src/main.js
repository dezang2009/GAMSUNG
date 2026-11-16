import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@fontsource/gowun-batang/korean-400.css';
import '@fontsource/gowun-batang/korean-700.css';
import '@fontsource/gowun-batang/latin-400.css';
import '@fontsource/gowun-batang/latin-700.css';
import './styles/tokens.css';
import './styles/app.css';
import { createEngine } from './engine/GameEngine.js';
import { createSaveSystem } from './systems/SaveSystem.js';
import { createUI } from './ui/UIController.js';

async function boot() {
  const root = document.getElementById('app');
  const engine = createEngine({ saveSystem: createSaveSystem() });
  const ui = createUI(root, engine);
  const r = await engine.load();
  if (!r.data) ui.render();
  if (r.recovered) ui.toast('마지막 저장이 손상돼 직전 저장으로 이어서 해요', '', true);
  if (r.error) ui.toast(r.error, '새로 시작할 수 있어요', true);
  // 테스트에서 상태를 확인하는 창구 (게임 진행에는 쓰지 않아요)
  globalThis.__otr = { engine };
}

boot();
