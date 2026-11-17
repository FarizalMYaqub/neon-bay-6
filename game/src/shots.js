// Deterministic screenshot modes: ?shot=<name>&seed=7
// start  — title screen over the city
// drive  — player driving with traffic + HUD + minimap
// chase  — 3-star wanted, police chasing the player
// mission— mission active with the objective marker visible
import { parseShot } from './rng.js';

export const SHOT_NAMES = ['start', 'drive', 'chase', 'mission'];

export function currentShot() {
  const { shot, seed } = parseShot();
  return { shot: SHOT_NAMES.includes(shot) ? shot : '', seed };
}

// Apply a shot mode to a freshly built game state. Returns the mode name.
export function applyShotMode(game, shot) {
  if (!shot) return '';
  if (shot === 'start') {
    game.state = 'title';
    game.orbitCam = true;
    return 'start';
  }
  // All gameplay shots start the game immediately, no title click needed.
  game.startGame();
  if (shot === 'drive') {
    // Walk the player next to a parked car first so entering always works,
    // then put the car on the main north-south road, driving away from the plaza.
    game.player.x = 10; game.player.z = 20;
    game.enterNearestCar(true);
    game.playerCar.x = 44; game.playerCar.z = -120;
    game.playerCar.heading = 0;
    game.playerCar.speed = 18;
    game.playerCar.sync();
    game.cameraMode = 'chase';
    return 'drive';
  }
  if (shot === 'chase') {
    game.player.x = 10; game.player.z = 20;
    game.enterNearestCar(true);
    game.playerCar.x = 44; game.playerCar.z = -120;
    game.playerCar.heading = 0;
    game.playerCar.speed = 20;
    game.playerCar.sync();
    game.setWanted(3);
    game.spawnPoliceNear(3);
    // Line the cruisers up ahead on the same road so the chase reads in frame.
    game.police.cars.forEach((pc, i) => {
      pc.x = 44 + (i - 1) * 6;
      pc.z = game.playerCar.z + 28 + i * 14;
      pc.heading = Math.PI;
      pc.sync();
    });
    return 'chase';
  }
  if (shot === 'mission') {
    game.missions.start();
    game.hud.showDialogue(game.missions.current().dialogue, 15000);
    // Put the player in a car on the road leading to the marker.
    game.player.x = 10; game.player.z = 20;
    game.enterNearestCar(true);
    game.playerCar.speed = 12;
    const t = game.missions.current().target;
    game.playerCar.x = t.x;
    game.playerCar.z = t.z + 34;
    game.playerCar.heading = Math.PI;
    game.playerCar.sync();
    return 'mission';
  }
  return '';
}
