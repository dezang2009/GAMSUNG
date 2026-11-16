import './styles/app.css';
import { App } from './ui/app';
import { Game } from './game/game';

const app = new App(document.getElementById('app')!);
app.start();

// 안드로이드: 뒤로 가기 · 백그라운드로 갈 때 저장
import('@capacitor/app')
  .then(({ App: Cap }) => {
    Cap.addListener('backButton', () => {
      if (!app.back()) Game.saveNow().then(() => Cap.exitApp());
    });
    Cap.addListener('pause', () => Game.saveNow());
  })
  .catch(() => {});
addEventListener('pagehide', () => Game.saveNow());
document.addEventListener('visibilitychange', () => document.hidden && Game.saveNow());
// 테스트에서 상태를 보는 창구 (게임 진행에는 쓰지 않아요)
(globalThis as any).__nexus = { Game, app };
