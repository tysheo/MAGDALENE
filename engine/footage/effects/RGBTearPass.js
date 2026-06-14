import { BaseEffectPass } from "./BaseEffectPass.js";

const FRAG = `
  uniform sampler2D uInput;
  uniform float uTime;
  uniform float uMix;
  uniform float uViolence;
  uniform float uSnare;
  uniform float uKick;
  uniform vec2 uResolution;
  varying vec2 vUv;

  float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    float band = step(0.92, gHash(vec2(floor(vUv.y * 90.0), floor(uTime * 60.0))));
    float tear = (band * 2.0 - 1.0) * uMix * (uSnare * 0.06 + 0.014);
    vec2 horizontalShift = vec2(tear, 0.0);
    float spread = uMix * (uSnare * 0.012 + uViolence * 0.008 + uKick * 0.004) + 0.002;
    float jitter = (gHash(vec2(uTime * 60.0, vUv.y * 200.0)) - 0.5) * uMix * uSnare * 0.02;
    vec2 uvR = vUv + horizontalShift + vec2( spread + jitter, 0.0);
    vec2 uvG = vUv + horizontalShift;
    vec2 uvB = vUv + horizontalShift + vec2(-spread - jitter, 0.0);
    float r = texture2D(uInput, uvR).r;
    float g = texture2D(uInput, uvG).g;
    float b = texture2D(uInput, uvB).b;
    vec3 base = texture2D(uInput, vUv).rgb;
    vec3 split = vec3(r, g, b);
    gl_FragColor = vec4(mix(base, split, clamp(uMix, 0.0, 1.0)), 1.0);
  }
`;

export class RGBTearPass extends BaseEffectPass {
  constructor(gl) { super(gl, FRAG); }
}
