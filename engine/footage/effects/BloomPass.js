import { BaseEffectPass } from "./BaseEffectPass.js";

// BloomPass — bright-pass + 16-tap radial gather, additively blended on top
// of the input. Single-shader so it stays cheap; threshold rides on uMix so
// the bloom turns on smoothly with the section weight rather than popping.
// Driven by drops and CLAIM_TO_BODY / PATENT_TO_SCREAM transition recipes.
const FRAG = `
  uniform sampler2D uInput;
  uniform float uMix;
  uniform float uTime;
  uniform float uViolence;
  uniform float uKick;
  uniform vec2 uResolution;
  varying vec2 vUv;

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec3 base = texture2D(uInput, vUv).rgb;
    float threshold = mix(0.78, 0.45, clamp(uMix, 0.0, 1.0));
    vec3 bloom = vec3(0.0);
    float total = 0.0;
    // Two concentric rings at different radii — 8 + 8 taps — gives a
    // smoother glow than a single ring without going to a full separable
    // gaussian (which would need 2 passes / ping-pong targets).
    for (int i = 0; i < 8; i++) {
      float a = float(i) / 8.0 * 6.2831853;
      vec2 dir = vec2(cos(a), sin(a));
      vec3 s1 = texture2D(uInput, vUv + dir * 0.010).rgb;
      vec3 s2 = texture2D(uInput, vUv + dir * 0.024).rgb;
      float w1 = smoothstep(threshold, 1.0, luma(s1));
      float w2 = smoothstep(threshold, 1.0, luma(s2)) * 0.6;
      bloom += s1 * w1 + s2 * w2;
      total += w1 + w2;
    }
    bloom /= max(0.001, total);
    float gain = uMix * (1.1 + uViolence * 0.4 + uKick * 0.6);
    vec3 outc = base + bloom * gain;
    gl_FragColor = vec4(outc, 1.0);
  }
`;

export class BloomPass extends BaseEffectPass {
  constructor(gl) { super(gl, FRAG); }
}
