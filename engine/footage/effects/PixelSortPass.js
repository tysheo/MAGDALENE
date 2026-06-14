import { BaseEffectPass } from "./BaseEffectPass.js";

const FRAG = `
  uniform sampler2D uInput;
  uniform float uTime;
  uniform float uMix;
  uniform float uViolence;
  uniform float uPressure;
  uniform float uClarity;
  uniform vec2 uResolution;
  varying vec2 vUv;

  float gLum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
  float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    float threshold = mix(0.85, 0.35, clamp(uMix * (0.4 + uViolence + uPressure * 0.5), 0.0, 1.0));
    vec3 base = texture2D(uInput, vUv).rgb;
    float l = gLum(base);
    float pixel = 1.0 / uResolution.x;
    float trace = 0.0;
    vec3 sortColor = base;
    for (int i = 1; i < 28; i++) {
      vec2 sampleUv = vUv - vec2(pixel * float(i), 0.0);
      vec3 sampleC = texture2D(uInput, sampleUv).rgb;
      float sl = gLum(sampleC);
      if (sl > threshold && sl > l) {
        sortColor = sampleC;
        trace = float(i);
        break;
      }
    }
    float sortIntensity = clamp(uMix * (0.5 + uViolence * 0.8), 0.0, 1.0);
    vec3 outc = mix(base, sortColor, sortIntensity * step(0.001, trace));
    float band = step(0.97, gHash(vec2(floor(vUv.y * uResolution.y * 0.5), floor(uTime * 30.0))));
    outc = mix(outc, sortColor * 0.6, band * uMix * uViolence);
    gl_FragColor = vec4(outc, 1.0);
  }
`;

export class PixelSortPass extends BaseEffectPass {
  constructor(gl) { super(gl, FRAG); }
}
