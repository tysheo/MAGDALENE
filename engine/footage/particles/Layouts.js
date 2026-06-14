function grid(cols, rows, role = "full") {
  const cells = [];
  const w = 6 / cols;
  const h = 6 / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      cells.push({
        cx: -3 + w * (x + 0.5),
        cy: 3 - h * (y + 0.5),
        w,
        h,
        role
      });
    }
  }
  return cells;
}

export const LAYOUTS = {
  solo: [{ cx: 0, cy: 0, w: 6, h: 6, role: "full" }],

  duo_h: [
    { cx: -1.52, cy: 0, w: 2.96, h: 6, role: "full" },
    { cx: 1.52, cy: 0, w: 2.96, h: 6, role: "full" }
  ],

  duo_v: [
    { cx: 0, cy: 1.52, w: 6, h: 2.96, role: "full" },
    { cx: 0, cy: -1.52, w: 6, h: 2.96, role: "full" }
  ],

  triptych: [
    { cx: -2, cy: 0, w: 1.96, h: 6, role: "full" },
    { cx: 0, cy: 0, w: 1.96, h: 6, role: "full" },
    { cx: 2, cy: 0, w: 1.96, h: 6, role: "full" }
  ],

  quad: grid(2, 2),
  hex: grid(3, 2),
  ennead: grid(3, 3),
  dodec: grid(4, 3),

  mondrian_a: [
    { cx: -1.55, cy: 0, w: 2.9, h: 6, role: "full" },
    { cx: 1.55, cy: 1.55, w: 3.0, h: 2.9, role: "full" },
    { cx: 0.8, cy: -1.55, w: 1.45, h: 2.9, role: "full" },
    { cx: 2.35, cy: -0.75, w: 1.45, h: 1.35, role: "full" },
    { cx: 2.35, cy: -2.25, w: 1.45, h: 1.35, role: "full" }
  ],

  mondrian_b: [
    { cx: -2.05, cy: 1.55, w: 1.9, h: 2.9, role: "full" },
    { cx: -2.05, cy: -1.55, w: 1.9, h: 2.9, role: "full" },
    { cx: 0.35, cy: 0, w: 2.6, h: 6, role: "full" },
    { cx: 2.25, cy: 1.85, w: 1.2, h: 2.3, role: "full" },
    { cx: 2.25, cy: -1.15, w: 1.2, h: 3.5, role: "full" }
  ],

  filmstrip_h: [
    { cx: -2.72, cy: 0, w: 0.62, h: 4.45, role: "full", opacity: 0.55 },
    { cx: -2.05, cy: 0, w: 0.68, h: 4.9, role: "full", opacity: 0.68 },
    { cx: -1.25, cy: 0, w: 0.82, h: 5.35, role: "full", opacity: 0.82 },
    { cx: 0, cy: 0, w: 1.55, h: 6, role: "full", opacity: 1, z: 0.1 },
    { cx: 1.25, cy: 0, w: 0.82, h: 5.35, role: "full", opacity: 0.82 },
    { cx: 2.05, cy: 0, w: 0.68, h: 4.9, role: "full", opacity: 0.68 },
    { cx: 2.72, cy: 0, w: 0.62, h: 4.45, role: "full", opacity: 0.55 }
  ],

  ghost_overlay: [
    { cx: 0, cy: 0, w: 6, h: 6, role: "full", opacity: 1, z: 0 },
    { cx: 0.18, cy: -0.12, w: 6, h: 6, role: "ghost", opacity: 0.4, z: 0.15 }
  ],

  shear_h: [
    { cx: 0, cy: 1.5, w: 6, h: 3.0, role: "full" },
    { cx: 0, cy: -1.5, w: 6, h: 3.0, role: "full" }
  ],

  center_ring: [
    { cx: 0, cy: 0, w: 2.45, h: 2.45, role: "core", opacity: 1, z: 0.18 },
    { cx: 0, cy: 0, w: 6, h: 6, role: "ring", opacity: 0.72, z: -0.05 }
  ],

  fg_bg_swap: [
    { cx: 0, cy: 0, w: 6, h: 6, role: "foreground", opacity: 1, z: 0.18 },
    { cx: 0, cy: 0, w: 6, h: 6, role: "background", opacity: 0.86, z: -0.12 }
  ]
};

export const LAYOUT_IDS = Object.keys(LAYOUTS);

export function getLayout(id) {
  return LAYOUTS[id] || LAYOUTS.solo;
}

export function layoutCellCount(id) {
  return getLayout(id).length;
}
