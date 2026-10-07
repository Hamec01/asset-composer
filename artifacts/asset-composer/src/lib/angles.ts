export function angleDelta(a: number, b: number) {
  return ((b-a+180)%360+360)%360-180;
}

export function shortestAngleLerp(a: number, b: number, t: number) {
  return a+angleDelta(a,b)*t;
}
