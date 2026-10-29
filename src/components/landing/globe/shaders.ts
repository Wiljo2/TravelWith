export const BODY_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

export const BODY_FRAGMENT = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uRim;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec3 n = normalize(vNormal);
  float fresnel = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 2.6);
  float light = 0.93 + 0.07 * dot(n, normalize(vec3(-0.5, 0.7, 0.6)));
  gl_FragColor = vec4(mix(uBase * light, uRim, fresnel * 0.75), 1.0);
  #include <colorspace_fragment>
}`;

export const HALO_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  float edge = clamp(-dot(normalize(vNormal), normalize(vView)) / 0.55, 0.0, 1.0);
  gl_FragColor = vec4(uColor, pow(edge, 3.0) * 0.42);
  #include <colorspace_fragment>
}`;

export const DOTS_VERTEX = /* glsl */ `
varying float vFacing;
void main() {
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * mat3(instanceMatrix) * vec3(0.0, 0.0, 1.0));
  vFacing = smoothstep(0.0, 0.6, dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}`;

export const DOTS_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vFacing;
void main() {
  gl_FragColor = vec4(uColor, uOpacity * (0.25 + 0.75 * vFacing));
  #include <colorspace_fragment>
}`;

export const ARC_VERTEX = /* glsl */ `
varying float vU;
void main() {
  vU = uv.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const ARC_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uDraw;
uniform float uOpacity;
varying float vU;
void main() {
  if (vU > uDraw) discard;
  gl_FragColor = vec4(uColor, uOpacity);
  #include <colorspace_fragment>
}`;

export const COMET_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uHead;
uniform float uTail;
varying float vU;
void main() {
  float d = uHead - vU;
  if (d < 0.0 || d > uTail) discard;
  gl_FragColor = vec4(uColor, pow(1.0 - d / uTail, 1.6));
  #include <colorspace_fragment>
}`;
