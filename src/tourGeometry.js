const toRadians = (value) => Number(value) * Math.PI / 180;
const toDegrees = (value) => Number(value) * 180 / Math.PI;

export function interpolateGreatCircle(start, end, amount) {
  const t = Math.max(0, Math.min(1, Number(amount) || 0));
  const lat1 = toRadians(start.lat);
  const lng1 = toRadians(start.lng);
  const lat2 = toRadians(end.lat);
  const lng2 = toRadians(end.lng);
  const startVector = [Math.cos(lat1) * Math.cos(lng1), Math.cos(lat1) * Math.sin(lng1), Math.sin(lat1)];
  const endVector = [Math.cos(lat2) * Math.cos(lng2), Math.cos(lat2) * Math.sin(lng2), Math.sin(lat2)];
  const dot = Math.max(-1, Math.min(1, startVector.reduce((sum, value, index) => sum + value * endVector[index], 0)));
  const angle = Math.acos(dot);
  const sinAngle = Math.sin(angle);
  const vector = sinAngle < 1e-7
    ? startVector.map((value, index) => value + (endVector[index] - value) * t)
    : startVector.map((value, index) => (Math.sin((1 - t) * angle) / sinAngle) * value + (Math.sin(t * angle) / sinAngle) * endVector[index]);
  const magnitude = Math.hypot(...vector) || 1;
  const [x, y, z] = vector.map((value) => value / magnitude);
  const lng = ((toDegrees(Math.atan2(y, x)) + 540) % 360) - 180;
  return { lat: toDegrees(Math.asin(z)), lng };
}

export function midpoint(start, end) {
  return interpolateGreatCircle(start, end, 0.5);
}
