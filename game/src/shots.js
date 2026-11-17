// Deterministic screenshot setups for Neon Bay. Each shot mode stages the
// world (player, cars, police, mission) so a headless render shows the game
// at its best; the seeded RNG makes the layout repeatable.
export function applyShot(name, api, world) {
  const { city, vehicles, people, missions, player } = world;
  if (name === 'start') {
    // Title screen over the city: do not start the game; the overlay stays up
    // while the camera slowly orbits the plaza.
    api.setCam(Math.PI * 0.75, 0.28, 42);
    api.teleport(30, 24, Math.PI);
    return;
  }
  api.startGame();
  if (name === 'drive') {
    // Player driving down a main road with traffic around, HUD + minimap live.
    api.setCash(1250);
    api.teleport(0, -60, 0);
    api.enterNearestCar();
    if (api) { /* car entered; the loop drives it once keys are simulated below */ }
    // Pre-place the car mid-road and give it speed so the shot is in motion.
    const car = world.vehicles.playerCar;
    if (car) { car.speed = 14; }
    api.setCam(0, 0.3, 11);
    return;
  }
  if (name === 'chase') {
    // 3-star wanted: police cruisers closing in on the player's car.
    api.setCash(3400);
    api.teleport(0, 20, 0);
    api.enterNearestCar();
    const car = world.vehicles.playerCar;
    if (car) { car.speed = 16; }
    api.setWanted(3);
    api.setCam(0, 0.32, 12);
    return;
  }
  if (name === 'mission') {
    // Mission 1 active: player on foot near the plaza, beacon over Marina Point.
    api.setCash(750);
    api.setMission(0);
    api.teleport(30, 40, Math.PI);
    api.setCam(Math.PI, 0.3, 10);
    return;
  }
  // Unknown shot name: just start the game.
}
