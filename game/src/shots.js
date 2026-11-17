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
    // Staged on the open beachfront promenade so the cruisers are in frame.
    api.setCash(3400);
    api.teleport(0, 20, 0);
    api.enterNearestCar();
    const car = world.vehicles.playerCar;
    if (car) {
      car.x = -70; car.z = 102; car.heading = Math.PI / 2; car.speed = 16;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
    }
    api.setWanted(3);
    // Line the cruisers up right behind the player's car on the same road,
    // so the chase is in frame from the first second.
    const pc = world.vehicles.playerCar;
    if (pc) {
      const fx = Math.sin(pc.heading), fz = Math.cos(pc.heading);
      world.vehicles.police.forEach((p, i) => {
        const back = 14 + i * 9;
        p.x = pc.x - fx * back + (i - 1) * 3.5;
        p.z = pc.z - fz * back;
        p.heading = pc.heading;
        p.speed = 22;
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = p.heading;
      });
    }
    api.setCam(0, 0.32, 12);
    return;
  }
  if (name === 'mission') {
    // Mission 1 active: player on foot south of the plaza, looking south
    // toward the Marina Point beacon over the beach and sunset sea.
    api.setCash(750);
    api.setMission(0);
    api.teleport(45, 95, 0); // street by the beach, beacon just ahead
    api.setCam(Math.PI, 0.32, 12);
    return;
  }
  // Unknown shot name: just start the game.
}
