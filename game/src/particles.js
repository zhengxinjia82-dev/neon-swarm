// Particles, floating score text and screen shake: the game's feel. Sparks and texts
// live in fixed pools, allocated once. The shake offset is a deterministic function of
// time, so the same seed always paints the same frame.

const SPARK_POOL = 256;
const TEXT_POOL = 24;

export function createParticles() {
  const sparks = [];
  for (let index = 0; index < SPARK_POOL; index += 1) {
    sparks.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff' });
  }
  const texts = [];
  for (let index = 0; index < TEXT_POOL; index += 1) {
    texts.push({ active: false, x: 0, y: 0, str: '', life: 0, maxLife: 1, color: '#fff' });
  }
  return { sparks, texts, shakeMag: 0, elapsed: 0 };
}

export function burst(particles, x, y, color, count, speed, random) {
  let made = 0;
  for (const spark of particles.sparks) {
    if (made >= count) break;
    if (spark.active) continue;
    const angle = random() * Math.PI * 2;
    const velocity = speed * (0.3 + random() * 0.9);
    spark.active = true;
    spark.x = x;
    spark.y = y;
    spark.vx = Math.cos(angle) * velocity;
    spark.vy = Math.sin(angle) * velocity;
    spark.maxLife = 0.35 + random() * 0.4;
    spark.life = spark.maxLife;
    spark.size = 1.5 + random() * 2.5;
    spark.color = color;
    made += 1;
  }
}

export function floatText(particles, x, y, str, color) {
  for (const text of particles.texts) {
    if (text.active) continue;
    text.active = true;
    text.x = x;
    text.y = y;
    text.str = str;
    text.maxLife = 0.9;
    text.life = text.maxLife;
    text.color = color;
    return;
  }
}

export function shake(particles, magnitude) {
  particles.shakeMag = Math.min(14, particles.shakeMag + magnitude);
}

export function updateParticles(particles, dt) {
  particles.elapsed += dt;
  particles.shakeMag = Math.max(0, particles.shakeMag - dt * 26);
  for (const spark of particles.sparks) {
    if (!spark.active) continue;
    spark.life -= dt;
    if (spark.life <= 0) { spark.active = false; continue; }
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.vx *= 1 - 2.2 * dt;
    spark.vy *= 1 - 2.2 * dt;
  }
  for (const text of particles.texts) {
    if (!text.active) continue;
    text.life -= dt;
    if (text.life <= 0) { text.active = false; continue; }
    text.y -= 42 * dt;
  }
}

/** The shake offset for this moment: sine-based, so it is the same for the same time. */
export function shakeOffset(particles) {
  const mag = particles.shakeMag;
  if (mag <= 0.05) return { x: 0, y: 0 };
  const t = particles.elapsed;
  return { x: Math.sin(t * 127.1) * mag, y: Math.sin(t * 149.7 + 1.3) * mag };
}

export function clearParticles(particles) {
  for (const spark of particles.sparks) spark.active = false;
  for (const text of particles.texts) text.active = false;
  particles.shakeMag = 0;
}
