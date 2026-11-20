import type {
  MapConfig,
  MapId,
  Point2D,
  TrackBounds,
  TrackDirection,
  TrackPosition,
} from '../types/game';

// --- Track Geometry Builders ---

export function createTrueStadiumPoints(
  cx: number,
  cy: number,
  straightHalf: number,
  radius: number,
  arcSamples = 40,
  straightSamples = 24
): Point2D[] {
  const pts: Point2D[] = [];
  // Start at top-center moving clockwise (right -> bottom arc -> left -> top arc)
  for (let i = 0; i < straightSamples; i++) {
    const t = i / straightSamples;
    pts.push({ x: cx - straightHalf + t * (straightHalf * 2), y: cy - radius });
  }
  for (let i = 0; i < arcSamples; i++) {
    const a = -Math.PI / 2 + (i / arcSamples) * Math.PI;
    pts.push({ x: cx + straightHalf + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
  }
  for (let i = 0; i < straightSamples; i++) {
    const t = i / straightSamples;
    pts.push({ x: cx + straightHalf - t * (straightHalf * 2), y: cy + radius });
  }
  for (let i = 0; i < arcSamples; i++) {
    const a = Math.PI / 2 + (i / arcSamples) * Math.PI;
    pts.push({ x: cx - straightHalf + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
  }
  return pts;
}

export function createCirclePoints(
  cx: number,
  cy: number,
  radius: number,
  numPts = 144
): Point2D[] {
  const pts: Point2D[] = [];
  // Start at top (-PI/2) moving clockwise
  for (let i = 0; i < numPts; i++) {
    const a = -Math.PI / 2 + (i / numPts) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
  }
  return pts;
}

/**
 * Generates a continuous 5-pointed star drawing path (pentagram {5/2}: 0->2->4->1->3->0)
 * with smooth circular corner fillets at each outer star tip so all 4 lanes stay clean.
 */
export function createStarDrawingPoints(
  cx: number,
  cy: number,
  outerRadius: number,
  filletRadius = 175
): Point2D[] {
  const starTips: Point2D[] = [];
  // Star drawing order clockwise: Top (-90°), Bottom-Right (+54°), Top-Left (+198°), Top-Right (-18°), Bottom-Left (+126°)
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + k * ((4 * Math.PI) / 5);
    starTips.push({
      x: cx + Math.cos(a) * outerRadius,
      y: cy + Math.sin(a) * outerRadius,
    });
  }

  // Tangent cutback for 36° vertex angle: d = R_fillet / tan(18°)
  const halfAngle = Math.PI / 10; // 18 deg
  const cutback = filletRadius / Math.tan(halfAngle);
  const pts: Point2D[] = [];

  for (let i = 0; i < 5; i++) {
    const prev = starTips[(i + 4) % 5];
    const curr = starTips[i];
    const next = starTips[(i + 1) % 5];

    const inDx = curr.x - prev.x;
    const inDy = curr.y - prev.y;
    const inLen = Math.hypot(inDx, inDy);
    const uxIn = inDx / inLen;
    const uyIn = inDy / inLen;

    const outDx = next.x - curr.x;
    const outDy = next.y - curr.y;
    const outLen = Math.hypot(outDx, outDy);
    const uxOut = outDx / outLen;
    const uyOut = outDy / outLen;

    const pEnter = { x: curr.x - uxIn * cutback, y: curr.y - uyIn * cutback };
    const pExit = { x: curr.x + uxOut * cutback, y: curr.y + uyOut * cutback };

    // Bisector inward from tip to arc center
    const bisX = -uxIn + uxOut;
    const bisY = -uyIn + uyOut;
    const bisLen = Math.hypot(bisX, bisY);
    const centerDist = filletRadius / Math.sin(halfAngle);
    const arcCx = curr.x + (bisX / bisLen) * centerDist;
    const arcCy = curr.y + (bisY / bisLen) * centerDist;

    const startAng = Math.atan2(pEnter.y - arcCy, pEnter.x - arcCx);
    let endAng = Math.atan2(pExit.y - arcCy, pExit.x - arcCx);
    // Shortest clockwise sweep (+angle in screen coordinates)
    while (endAng < startAng) endAng += Math.PI * 2;
    if (endAng - startAng > Math.PI) {
      endAng -= Math.PI * 2;
    }

    const arcSteps = 14;
    for (let s = 0; s <= arcSteps; s++) {
      const a = startAng + (s / arcSteps) * (endAng - startAng);
      pts.push({
        x: arcCx + Math.cos(a) * filletRadius,
        y: arcCy + Math.sin(a) * filletRadius,
      });
    }

    // Add intermediate points along straight edge toward next tip
    const nextEnter = {
      x: next.x - uxOut * cutback,
      y: next.y - uyOut * cutback,
    };
    const edgeSteps = 18;
    for (let e = 1; e < edgeSteps; e++) {
      const t = e / edgeSteps;
      pts.push({
        x: pExit.x + (nextEnter.x - pExit.x) * t,
        y: pExit.y + (nextEnter.y - pExit.y) * t,
      });
    }
  }

  // Rotate array so index 0 is in the middle of the first long chord (clean straight start)
  const shift = 22;
  return [...pts.slice(shift), ...pts.slice(0, shift)];
}

const DONGHO_ART_SCALE = 11.0;
const DONGHO_CENTER_X = 5000;
const DONGHO_CENTER_Y = 6600;

// Silhouette control points in [0..1000] x [0..1300] space matching Dong Ho "Vinh Hoa" outline
const DONGHO_SILHOUETTE_RAW: ReadonlyArray<readonly [number, number]> = [
  [410, 145], // Top of boy's head
  [575, 200], // Right side of head
  [655, 325], // Lotus & neck curve
  [830, 395], // Rooster comb & beak
  [840, 560], // Rooster arched chest
  [875, 765], // Rooster plump belly
  [760, 1020], // Rooster legs & right claw
  [470, 1135], // Underbelly & left claw
  [210, 1085], // Chrysanthemum & lower tail tip
  [105, 865], // Sweeping green/red rooster tail
  [125, 575], // Boy's rounded left arm & shoulder
  [225, 345], // Boy's left ear & cheek
  [275, 200], // Upper-left temple
];

function createClosedCatmullRom(
  control: ReadonlyArray<readonly [number, number]>,
  samplesPerSeg: number,
  scale: number,
  offsetX: number,
  offsetY: number
): Point2D[] {
  const n = control.length;
  const pts: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = control[(i - 1 + n) % n];
    const p1 = control[i];
    const p2 = control[(i + 1) % n];
    const p3 = control[(i + 2) % n];

    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg;
      const t2 = t * t;
      const t3 = t2 * t;

      const x =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);

      pts.push({
        x: offsetX + (x - 500) * scale,
        y: offsetY + (y - 650) * scale,
      });
    }
  }
  return pts;
}

export function getTrackBounds(points: Point2D[]): TrackBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

// --- Theme Scenery Helpers ---

function drawTreeCluster(
  ctx: CanvasRenderingContext2D,
  trees: ReadonlyArray<readonly [number, number, number]>,
  foliageDark = '#166534',
  foliageLight = '#22c55e'
) {
  for (const [x, y, r] of trees) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.25, y + r * 0.3, r * 1.02, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = foliageDark;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = foliageLight;
    ctx.beginPath();
    ctx.arc(x - r * 0.16, y - r * 0.18, r * 0.68, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawOAnQuanBoard(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const boardHalfW = 3900;
  const boardHalfH = 1280;
  const colW = (boardHalfW * 2) / 5;

  // Warm sunlit wood / courtyard stone surface of the board
  ctx.fillStyle = '#e7d5ad';
  ctx.beginPath();
  ctx.roundRect(cx - boardHalfW - 950, cy - boardHalfH, boardHalfW * 2 + 1900, boardHalfH * 2, boardHalfH);
  ctx.fill();

  // Hand-drawn charcoal ink border & cells
  ctx.strokeStyle = '#292524';
  ctx.lineWidth = 34;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.roundRect(cx - boardHalfW - 950, cy - boardHalfH, boardHalfW * 2 + 1900, boardHalfH * 2, boardHalfH);
  ctx.stroke();

  // Vertical dividers separating Quan arcs and 5 Dan columns
  for (let i = 0; i <= 5; i++) {
    const x = cx - boardHalfW + i * colW;
    ctx.beginPath();
    ctx.moveTo(x, cy - boardHalfH);
    ctx.lineTo(x, cy + boardHalfH);
    ctx.stroke();
  }

  // Horizontal center divider across the 5 Dan columns
  ctx.beginPath();
  ctx.moveTo(cx - boardHalfW, cy);
  ctx.lineTo(cx + boardHalfW, cy);
  ctx.stroke();

  // Deterministic pebbles / copper coins ("sỏi / xu") inside the Dan & Quan boxes
  const pebbles: Array<[number, number, number, string]> = [
    // Left Quan
    [cx - boardHalfW - 420, cy - 180, 62, '#78350f'],
    [cx - boardHalfW - 560, cy + 120, 56, '#92400e'],
    [cx - boardHalfW - 310, cy + 210, 58, '#b45309'],
    [cx - boardHalfW - 500, cy - 280, 52, '#78350f'],
    // Right Quan
    [cx + boardHalfW + 400, cy - 140, 64, '#78350f'],
    [cx + boardHalfW + 540, cy + 160, 58, '#92400e'],
    [cx + boardHalfW + 320, cy + 220, 54, '#b45309'],
    [cx + boardHalfW + 490, cy - 300, 56, '#78350f'],
  ];
  for (let col = 0; col < 5; col++) {
    const cellCx = cx - boardHalfW + col * colW + colW * 0.5;
    for (let row = 0; row < 2; row++) {
      const cellCy = cy + (row === 0 ? -boardHalfH * 0.5 : boardHalfH * 0.5);
      for (let p = 0; p < 4; p++) {
        const angle = col * 1.7 + row * 2.3 + p * 1.57;
        const rad = 110 + (p % 2) * 85;
        pebbles.push([
          cellCx + Math.cos(angle) * rad,
          cellCy + Math.sin(angle) * rad * 0.72,
          44 + ((col + p) % 3) * 6,
          p % 2 === 0 ? '#92400e' : '#78350f',
        ]);
      }
    }
  }

  for (const [px, py, pr, col] of pebbles) {
    ctx.fillStyle = 'rgba(28, 25, 23, 0.25)';
    ctx.beginPath();
    ctx.ellipse(px + 12, py + 16, pr, pr * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(px, py, pr, pr * 0.75, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 6;
    ctx.stroke();
  }
}

function drawSpectatorSeated(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tunicColor: string,
  headbandColor: string,
  facingAngle: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(facingAngle);

  // Drop shadow
  ctx.fillStyle = 'rgba(28, 25, 23, 0.18)';
  ctx.beginPath();
  ctx.ellipse(18, 22, 165, 130, 0, 0, Math.PI * 2);
  ctx.fill();

  // Traditional ao ba ba shoulders
  ctx.fillStyle = tunicColor;
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.ellipse(0, 0, 125, 165, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Arms reaching forward toward the board
  ctx.fillStyle = '#fde6d2';
  ctx.beginPath();
  ctx.ellipse(105, -62, 55, 28, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(105, 62, 55, 28, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head & hair bun + khăn rằn headband
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.arc(-8, 0, 82, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = headbandColor;
  ctx.beginPath();
  ctx.arc(8, 0, 82, -Math.PI * 0.65, Math.PI * 0.65);
  ctx.lineWidth = 26;
  ctx.strokeStyle = headbandColor;
  ctx.stroke();

  ctx.restore();
}

function drawDongHoVinhHoaArt(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.translate(DONGHO_CENTER_X, DONGHO_CENTER_Y);
  ctx.scale(DONGHO_ART_SCALE, DONGHO_ART_SCALE);
  ctx.translate(-500, -650);

  // Subtle paper watermark medallion
  ctx.fillStyle = 'rgba(217, 119, 6, 0.08)';
  ctx.beginPath();
  ctx.arc(500, 620, 440, 0, Math.PI * 2);
  ctx.fill();

  // --- Lotus Flower & Leaves (Upper-Right behind neck) ---
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 6;
  // Green lotus leaf
  ctx.fillStyle = '#2d5a27';
  ctx.beginPath();
  ctx.ellipse(735, 360, 72, 42, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Lotus petals (warm terracotta/ochre)
  ctx.fillStyle = '#d98a4e';
  for (const [ang, lx, ly] of [
    [-0.5, 635, 310],
    [-0.1, 665, 295],
    [0.35, 695, 315],
  ] as const) {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Stem & lotus bud top-right
  ctx.beginPath();
  ctx.moveTo(690, 260);
  ctx.quadraticCurveTo(695, 200, 705, 170);
  ctx.stroke();
  ctx.fillStyle = '#f5d782';
  ctx.beginPath();
  ctx.ellipse(705, 160, 14, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // --- Rooster Tail Feathers (Sweeping left bottom) ---
  // Outer dark green / black tail plumes
  ctx.fillStyle = '#1f4d2b';
  ctx.beginPath();
  ctx.moveTo(260, 660);
  ctx.quadraticCurveTo(75, 760, 120, 1020);
  ctx.quadraticCurveTo(220, 920, 320, 780);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Terracotta red inner tail feather layer
  ctx.fillStyle = '#b93822';
  ctx.beginPath();
  ctx.moveTo(290, 700);
  ctx.quadraticCurveTo(140, 810, 185, 1030);
  ctx.quadraticCurveTo(270, 940, 355, 810);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // --- Chrysanthemum Roundel (Bottom-left) ---
  ctx.fillStyle = '#b93822';
  ctx.beginPath();
  ctx.arc(225, 1020, 66, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(225, 1020, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // --- Rooster Plump Ivory Body ---
  ctx.fillStyle = '#faf3dc';
  ctx.beginPath();
  ctx.ellipse(545, 770, 255, 235, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Rooster Wing (Layered red & green woodblock shading)
  ctx.fillStyle = '#b93822';
  ctx.beginPath();
  ctx.ellipse(455, 755, 155, 95, 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2d5a27';
  ctx.beginPath();
  ctx.ellipse(470, 795, 125, 60, 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Rooster Neck & Head (Right)
  ctx.fillStyle = '#faf3dc';
  ctx.beginPath();
  ctx.moveTo(610, 620);
  ctx.quadraticCurveTo(645, 455, 755, 435);
  ctx.quadraticCurveTo(855, 445, 825, 595);
  ctx.quadraticCurveTo(795, 720, 690, 760);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Woodblock neck feather lines
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(645 + i * 24, 575);
    ctx.lineTo(635 + i * 24, 655);
    ctx.stroke();
  }

  // Rooster Red Comb & Wattle + Beak
  ctx.fillStyle = '#c8281c';
  ctx.beginPath();
  ctx.moveTo(705, 445);
  ctx.quadraticCurveTo(725, 385, 770, 410);
  ctx.quadraticCurveTo(800, 395, 820, 440);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Rooster Beak
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.moveTo(815, 460);
  ctx.lineTo(868, 455);
  ctx.lineTo(822, 492);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Rooster Eye
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.arc(765, 472, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fef9c3';
  ctx.beginPath();
  ctx.arc(768, 469, 6, 0, Math.PI * 2);
  ctx.fill();

  // Rooster Yellow Legs & Claws
  ctx.fillStyle = '#f5d782';
  ctx.beginPath();
  ctx.roundRect(430, 995, 220, 68, 28);
  ctx.fill();
  ctx.stroke();

  // --- Boy Figure ("Bé Vinh Hoa") ---
  // Red & terracotta traditional tunic / yếm
  ctx.fillStyle = '#b93822';
  ctx.beginPath();
  ctx.ellipse(425, 515, 165, 130, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Jade Green Collar (Vòng cổ)
  ctx.strokeStyle = '#1f4d2b';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(430, 385, 115, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 6;

  // Chubby Left Arm & Hands hugging the rooster
  ctx.fillStyle = '#fcecd0';
  ctx.beginPath();
  ctx.ellipse(235, 560, 72, 155, -0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Forearm & Hand resting on rooster wing
  ctx.beginPath();
  ctx.ellipse(455, 650, 125, 52, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Red bracelet / bangle
  ctx.strokeStyle = '#b93822';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(335, 642, 42, -1.2, 1.2);
  ctx.stroke();

  // Boy's Round Head
  ctx.strokeStyle = '#1c1917';
  ctx.lineWidth = 6;
  ctx.fillStyle = '#fcecd0';
  ctx.beginPath();
  ctx.ellipse(420, 275, 160, 155, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Hair tuft lines (chỏm tóc) at crown
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(415 + i * 11, 148);
    ctx.lineTo(415 + i * 13, 185);
    ctx.stroke();
  }

  // Expressive Eyes, Brows, Nose & Red Smiling Mouth
  ctx.beginPath();
  ctx.arc(365, 268, 28, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(485, 268, 28, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();

  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.ellipse(368, 286, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(482, 286, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#b93822';
  ctx.beginPath();
  ctx.ellipse(425, 345, 24, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Calligraphy "荣花" (Vinh Hoa) on top-right in traditional sumi ink
  ctx.fillStyle = '#1c1917';
  ctx.font = 'bold 72px serif';
  ctx.textAlign = 'center';
  ctx.fillText('荣', 845, 215);
  ctx.fillText('花', 845, 300);

  ctx.restore();
}

function drawHuePalaceBuilding(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  roofColor: string,
  ridgeColor: string,
  pillarColor = '#b91c1c',
  doubleTier = false
) {
  // Ground shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.34)';
  ctx.fillRect(x + 42, y + 48, w, h);

  // Stone foundation platform
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(x - 24, y - 20, w + 48, h + 44);

  // Crimson walls / colonnade under eaves
  ctx.fillStyle = pillarColor;
  ctx.fillRect(x + 12, y + h - 38, w - 24, 42);

  // Main Golden-Amber Imperial Ceramic Tile Roof
  ctx.fillStyle = roofColor;
  ctx.fillRect(x, y, w, h);

  // Subtle vertical ceramic tile ribs
  ctx.strokeStyle = 'rgba(120, 53, 15, 0.32)';
  ctx.lineWidth = 6;
  for (let rx = x + 36; rx < x + w - 24; rx += 46) {
    ctx.beginPath();
    ctx.moveTo(rx, y + 8);
    ctx.lineTo(rx, y + h - 8);
    ctx.stroke();
  }

  // Ornate central roof ridge
  ctx.fillStyle = ridgeColor;
  ctx.fillRect(x - 10, y + h * 0.45, w + 20, 26);

  if (doubleTier) {
    // Upper tier roof (matching Dien Thai Hoa / Ngo Mon)
    const uw = w * 0.72;
    const uh = h * 0.48;
    const ux = x + (w - uw) / 2;
    const uy = y + h * 0.14;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.fillRect(ux + 16, uy + 20, uw, uh);
    ctx.fillStyle = '#ea9a2e';
    ctx.fillRect(ux, uy, uw, uh);
    // Weathered central dark tile patch (visible in aerial Hue photo!)
    ctx.fillStyle = '#7c4a2d';
    ctx.fillRect(ux + uw * 0.36, uy + 10, uw * 0.3, uh - 20);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(ux - 12, uy + uh * 0.44, uw + 24, 22);
  }
}

// --- Static Scenery Coordinates ---

const OANQUAN_TREES: ReadonlyArray<readonly [number, number, number]> = [
  // Golden apricot blossoms (Hoa Mai) & rural trees around courtyard
  [920, 1450, 145],
  [1240, 1780, 115],
  [8800, 1750, 150],
  [8500, 1480, 115],
  // Areca palms top-left
  [1850, 580, 75],
  [2150, 520, 70],
  [2450, 560, 72],
  [2750, 540, 68],
];

const HUE_INNER_TREES: ReadonlyArray<readonly [number, number, number]> = [
  [3650, 4200, 155], [3950, 4550, 170], [3600, 5050, 165], [3850, 5650, 155],
  [3700, 6450, 175], [3950, 7050, 160], [3800, 7950, 195], [4350, 8250, 210],
  [4850, 8450, 200], [5450, 8550, 175], [6950, 8550, 185], [7550, 8400, 205],
  [8150, 8200, 190], [8550, 7650, 175], [8450, 6450, 165], [8550, 5350, 175],
  [8350, 4450, 160], [8100, 3850, 155], [4450, 3550, 150], [7750, 3550, 150],
  // Flowering white frangipani near Tam Quan
  [5400, 8250, 125], [7000, 8250, 125],
];

const HUE_OUTER_TREES: ReadonlyArray<readonly [number, number, number]> = [
  [1500, 1900, 195], [1200, 3100, 215], [950, 4500, 210], [850, 6200, 225],
  [980, 7900, 210], [1550, 9600, 200], [2850, 10850, 210], [6200, 11750, 220],
  [9550, 10850, 215], [10950, 9450, 200], [11650, 7600, 220], [11750, 5600, 215],
  [11350, 3600, 205], [10350, 1950, 210], [8400, 920, 195], [5200, 850, 200],
];

// Deterministic Mid-Autumn tinsel ring sparkles around Ngôi Sao
const NGOISAO_TINSEL: ReadonlyArray<{ a: number; r: number; len: number; tilt: number; col: string }> =
  Array.from({ length: 240 }, (_, i) => {
    const colors = ['#e879f9', '#38bdf8', '#facc15', '#f43f5e', '#a855f7'];
    return {
      a: (i / 240) * Math.PI * 2,
      r: 4060 + ((i * 53) % 210) - 105,
      len: 130 + ((i * 37) % 90),
      tilt: ((i * 71) % 100) * 0.0314,
      col: colors[i % colors.length],
    };
  });

// --- Main Map Registry ---

export const MAPS_CONFIG: Record<MapId, MapConfig> = {
  oanquan: {
    id: 'oanquan',
    name: 'Ô Ăn Quan',
    subtitle: 'Sprint · Đường chạy vòng tròn Ô Ăn Quan',
    category: 'sprint',
    laps: 1,
    durationLabel: '~1 phút',
    bgGrass: '#efe5cb',
    trackColor: '#d9c49e',
    trackWidth: 224,
    generatePoints: () => createTrueStadiumPoints(4800, 2800, 4700, 2000, 44, 28),
    drawScenery: (ctx) => {
      // Soft watercolor courtyard ground patches
      ctx.fillStyle = 'rgba(180, 145, 95, 0.14)';
      ctx.beginPath();
      ctx.ellipse(4800, 3300, 6200, 2600, 0, 0, Math.PI * 2);
      ctx.fill();

      // Traditional tiled-roof countryside house in upper background (matching Image 2)
      ctx.fillStyle = 'rgba(28, 25, 23, 0.16)';
      ctx.fillRect(5180, -350, 2300, 820);
      // Adobe/whitewashed walls & shadow
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(5200, -100, 2100, 520);
      // Red terracotta sloped roof
      ctx.fillStyle = '#c2410c';
      ctx.beginPath();
      ctx.moveTo(5050, 120);
      ctx.lineTo(5480, -450);
      ctx.lineTo(7250, -450);
      ctx.lineTo(7520, 120);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#7c2d12';
      ctx.lineWidth = 18;
      ctx.stroke();
      // Adjacent straw kitchen shed + water jar (chum nước)
      ctx.fillStyle = '#b48a4e';
      ctx.fillRect(7480, -120, 680, 520);
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(7340, 390, 95, 0, Math.PI * 2);
      ctx.fill();

      // Blooming yellow Hoa Mai trees & Areca palms
      drawTreeCluster(ctx, OANQUAN_TREES.slice(0, 4), '#ca8a04', '#facc15');
      drawTreeCluster(ctx, OANQUAN_TREES.slice(4), '#15803d', '#4ade80');

      // Giant hand-inked Ô Ăn Quan Board in center
      drawOAnQuanBoard(ctx, 4800, 2800);

      // Seated Village Players around the Ô Ăn Quan board (matching Image 2)
      drawSpectatorSeated(ctx, 2100, 1320, '#84cc16', '#0284c7', Math.PI * 0.42);
      drawSpectatorSeated(ctx, 3750, 1280, '#93c5fd', '#0f766e', Math.PI * 0.5);
      drawSpectatorSeated(ctx, 5400, 1280, '#f97316', '#292524', Math.PI * 0.52);
      drawSpectatorSeated(ctx, 4800, 4340, '#dc2626', '#84cc16', -Math.PI * 0.5);
    },
  },

  ngoisao: {
    id: 'ngoisao',
    name: 'Đèn Ông Sao',
    subtitle: 'Mile · Chạy theo nét vẽ ngôi sao 5 cánh',
    category: 'mile',
    laps: 2,
    durationLabel: '~2 phút',
    bgGrass: '#090714',
    trackColor: '#f6e29c',
    trackWidth: 204,
    generatePoints: () => createStarDrawingPoints(4800, 4800, 3660, 175),
    drawScenery: (ctx) => {
      const cx = 4800;
      const cy = 4800;

      // Subtle warm festival night ambient halo
      const glow = ctx.createRadialGradient(cx, cy, 400, cx, cy, 4600);
      glow.addColorStop(0, 'rgba(234, 179, 8, 0.16)');
      glow.addColorStop(0.6, 'rgba(190, 24, 93, 0.10)');
      glow.addColorStop(1, 'rgba(9, 7, 20, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 5200, cy - 5200, 10400, 10400);

      // Red bamboo lantern stick handle going down
      ctx.fillStyle = '#be123c';
      ctx.fillRect(cx + 260, cy + 520, 190, 4100);
      ctx.fillStyle = '#fb7185';
      ctx.fillRect(cx + 305, cy + 520, 55, 4100);

      // Iridescent Mid-Autumn Tinsel Wreath Ring (Vòng kim tuyến ngũ sắc)
      ctx.lineCap = 'round';
      for (const sp of NGOISAO_TINSEL) {
        const x = cx + Math.cos(sp.a) * sp.r;
        const y = cy + Math.sin(sp.a) * sp.r;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(sp.a + Math.PI / 2 + sp.tilt);
        ctx.strokeStyle = sp.col;
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(-sp.len * 0.5, 0);
        ctx.lineTo(sp.len * 0.5, 0);
        ctx.stroke();
        ctx.restore();
      }

      // Compute 5 outer tips & 5 inner pentagon vertices for the translucent cellophane wings
      const outerTips: Point2D[] = [];
      const innerPts: Point2D[] = [];
      const rOuter = 3660;
      const rInner = rOuter * 0.382;
      for (let i = 0; i < 5; i++) {
        const aOut = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        const aIn = aOut + Math.PI / 5;
        outerTips.push({ x: cx + Math.cos(aOut) * rOuter, y: cy + Math.sin(aOut) * rOuter });
        innerPts.push({ x: cx + Math.cos(aIn) * rInner, y: cy + Math.sin(aIn) * rInner });
      }

      // Draw each of the 5 star wings: Red on top/sides, Emerald Green on bottom 2 (matching Image 3)
      for (let i = 0; i < 5; i++) {
        const tip = outerTips[i];
        const inR = innerPts[i];
        const inL = innerPts[(i + 4) % 5];
        const isGreenWing = i === 2 || i === 3;
        ctx.fillStyle = isGreenWing ? 'rgba(4, 120, 87, 0.78)' : 'rgba(185, 28, 28, 0.80)';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(inL.x, inL.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.lineTo(inR.x, inR.y);
        ctx.closePath();
        ctx.fill();

        // Delicate white paper-cut lantern pattern inside each wing tip
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.lineWidth = 14;
        ctx.beginPath();
        const midX = (tip.x + cx) * 0.52;
        const midY = (tip.y + cy) * 0.52;
        ctx.arc(midX, midY, 210, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Central circular traditional medallion (Hoa văn đèn lồng trắng giữa sao)
      ctx.fillStyle = 'rgba(153, 27, 27, 0.88)';
      ctx.beginPath();
      ctx.arc(cx, cy, 860, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 24;
      ctx.beginPath();
      ctx.arc(cx, cy, 780, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(cx, cy, 560, 0, Math.PI * 2);
      ctx.stroke();

      // Floral petals around central medallion
      for (let p = 0; p < 12; p++) {
        const a = (p / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 670, cy + Math.sin(a) * 670, 85, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  },

  dongho: {
    id: 'dongho',
    name: 'Tranh Đông Hồ (Vinh Hoa)',
    subtitle: 'Medium · Chạy theo đường nét tranh dân gian',
    category: 'medium',
    laps: 3,
    durationLabel: '~3 phút',
    bgGrass: '#f3df6a',
    trackColor: '#e0c46c',
    trackWidth: 216,
    generatePoints: () =>
      createClosedCatmullRom(
        DONGHO_SILHOUETTE_RAW,
        12,
        DONGHO_ART_SCALE,
        DONGHO_CENTER_X,
        DONGHO_CENTER_Y
      ),
    drawScenery: (ctx) => {
      // Warm handmade Giấy Điệp paper texture striations
      ctx.fillStyle = 'rgba(217, 165, 32, 0.10)';
      for (let y = -1800; y < 15500; y += 260) {
        ctx.fillRect(-2000, y, 15000, 95);
      }

      // Traditional woodblock painting border frame around canvas
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 42;
      ctx.strokeRect(
        DONGHO_CENTER_X - 540 * DONGHO_ART_SCALE,
        DONGHO_CENTER_Y - 680 * DONGHO_ART_SCALE,
        1080 * DONGHO_ART_SCALE,
        1360 * DONGHO_ART_SCALE
      );

      // Full Đông Hồ "Vinh Hoa" Woodblock Artwork inside the contour track
      drawDongHoVinhHoaArt(ctx);
    },
  },

  kinhthanhhue: {
    id: 'kinhthanhhue',
    name: 'Kinh Thành Huế',
    subtitle: 'Long · Vòng tròn bao quanh Đại Nội Huế',
    category: 'long',
    laps: 4,
    durationLabel: '~4 phút',
    bgGrass: '#4d7c34',
    trackColor: '#d2c2ae',
    trackWidth: 224,
    generatePoints: () => createCirclePoints(6200, 6200, 5015, 144),
    drawScenery: (ctx) => {
      const cx = 6200;
      const cy = 6200;

      // Iconic Hộ Thành Hà (Outer Imperial Moat) on the upper-left perimeter
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(450, 4800);
      ctx.lineTo(3100, 650);
      ctx.lineTo(3650, 950);
      ctx.lineTo(1000, 5100);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath();
      ctx.moveTo(580, 4720);
      ctx.lineTo(3140, 740);
      ctx.lineTo(3520, 960);
      ctx.lineTo(960, 4940);
      ctx.closePath();
      ctx.fill();

      // Inner Imperial Citadel Park Lawn
      ctx.fillStyle = '#5c913e';
      ctx.beginPath();
      ctx.arc(cx, cy, 4650, 0, Math.PI * 2);
      ctx.fill();

      // Hoàng Thành Stone Citadel Walls enclosing the Đại Nội complex
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 95;
      ctx.strokeRect(3200, 3050, 6000, 5950);

      // --- Sân Đại Triều Nghi (Grand Flagstone Courtyard) ---
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(4650, 5750, 3100, 1700);
      // Stone grid lines
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.25)';
      ctx.lineWidth = 10;
      for (let gx = 4850; gx < 7700; gx += 220) {
        ctx.beginPath();
        ctx.moveTo(gx, 5750);
        ctx.lineTo(gx, 7450);
        ctx.stroke();
      }

      // Ceremonial brick/stone walkway axis (Ngọ Môn -> Điện Thái Hòa -> Hậu Cung)
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(6020, 3300, 360, 5950);

      // Symmetrical Imperial Red & Gold Flower Beds in Sân Đại Triều Nghi
      for (const fx of [5320, 6820]) {
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(fx, 6350, 340, 340);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(fx + 70, 6420, 200, 200);
      }

      // Royal golden chrysanthemum pots flanking central path
      ctx.fillStyle = '#facc15';
      for (let py = 5950; py <= 7250; py += 260) {
        ctx.beginPath();
        ctx.arc(5930, py, 48, 0, Math.PI * 2);
        ctx.arc(6470, py, 48, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Điện Thái Hòa (Giant Centerpiece Double-Tiered Imperial Palace) ---
      drawHuePalaceBuilding(ctx, 4700, 4620, 3000, 1020, '#df8b22', '#facc15', '#b91c1c', true);

      // --- Cần Chánh / Hậu Cung behind Điện Thái Hòa ---
      drawHuePalaceBuilding(ctx, 5400, 3380, 1600, 640, '#d97706', '#facc15', '#991b1b', true);

      // --- Side Gates (Tả / Hữu Túc Môn) & Auxiliary Green-Roof Halls ---
      drawHuePalaceBuilding(ctx, 4050, 4800, 420, 380, '#d97706', '#facc15', '#b91c1c');
      drawHuePalaceBuilding(ctx, 7930, 4800, 420, 380, '#d97706', '#facc15', '#b91c1c');
      drawHuePalaceBuilding(ctx, 3550, 7450, 680, 820, '#365314', '#94a3b8', '#78350f');
      drawHuePalaceBuilding(ctx, 8180, 7450, 680, 820, '#3f6212', '#94a3b8', '#78350f');

      // --- Ngọ Môn (Lầu Ngũ Phụng & Flanking Pavilions) ---
      drawHuePalaceBuilding(ctx, 4550, 7480, 760, 460, '#d97706', '#facc15', '#b91c1c');
      drawHuePalaceBuilding(ctx, 7090, 7480, 760, 460, '#d97706', '#facc15', '#b91c1c');
      drawHuePalaceBuilding(ctx, 5460, 7380, 1480, 820, '#df8b22', '#facc15', '#b91c1c', true);

      // --- Tam Quan Southern Stone Gate ---
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(5580, 8620, 1240, 260);
      ctx.fillStyle = '#475569';
      for (const gx of [5760, 6130, 6500]) {
        ctx.fillRect(gx, 8680, 140, 190);
      }

      // Lush Imperial Trees (inner & outer citadel canopies)
      drawTreeCluster(ctx, HUE_OUTER_TREES, '#14532d', '#22c55e');
      drawTreeCluster(ctx, HUE_INNER_TREES, '#166534', '#4ade80');
    },
  },
};

export class Track {
  public config: MapConfig;
  public direction: TrackDirection;
  public points: Point2D[];
  public cumulativeLengths: number[];
  public totalLength: number;
  public bounds: TrackBounds;

  constructor(config: MapConfig, direction: TrackDirection = 'cw') {
    this.config = config;
    this.direction = direction;
    const basePts = config.generatePoints();
    // Reverse order (preserving index 0 start/finish line) for counter-clockwise races
    this.points =
      direction === 'ccw' && basePts.length > 2
        ? [basePts[0], ...basePts.slice(1).reverse()]
        : basePts;
    this.bounds = getTrackBounds(this.points);
    this.cumulativeLengths = [0];
    this.totalLength = 0;

    for (let i = 0; i < this.points.length; i++) {
      const p1 = this.points[i];
      const p2 = this.points[(i + 1) % this.points.length];
      this.totalLength += Math.hypot(p2.x - p1.x, p2.y - p1.y);
      this.cumulativeLengths.push(this.totalLength);
    }
  }

  getPositionAt(distance: number, laneOffset: number): TrackPosition {
    const d = ((distance % this.totalLength) + this.totalLength) % this.totalLength;
    let idx = 0;
    for (let i = 0; i < this.cumulativeLengths.length - 1; i++) {
      if (d >= this.cumulativeLengths[i] && d <= this.cumulativeLengths[i + 1]) {
        idx = i;
        break;
      }
    }
    const p1 = this.points[idx];
    const p2 = this.points[(idx + 1) % this.points.length];
    const segLen = this.cumulativeLengths[idx + 1] - this.cumulativeLengths[idx];
    const t = segLen > 0 ? (d - this.cumulativeLengths[idx]) / segLen : 0;
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    return {
      x: p1.x + (p2.x - p1.x) * t + -Math.sin(angle) * laneOffset,
      y: p1.y + (p2.y - p1.y) * t + Math.cos(angle) * laneOffset,
      angle,
    };
  }

  draw(ctx: CanvasRenderingContext2D) {
    const pad = 2600;
    const bgX = this.bounds.minX - pad;
    const bgY = this.bounds.minY - pad;
    const bgW = this.bounds.width + pad * 2;
    const bgH = this.bounds.height + pad * 2;

    ctx.fillStyle = this.config.bgGrass;
    ctx.fillRect(bgX, bgY, bgW, bgH);

    // Mowed lawn stripes for outdoor heritage grounds
    if (this.config.id === 'kinhthanhhue') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      for (let sy = Math.floor(bgY / 200) * 200; sy < bgY + bgH; sy += 200) {
        ctx.fillRect(bgX, sy, bgW, 100);
      }
    }

    this.config.drawScenery(ctx);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const isDongHo = this.config.id === 'dongho';
    const isStar = this.config.id === 'ngoisao';

    // Outer & inner track curb border
    ctx.strokeStyle = isDongHo ? '#1c1917' : isStar ? '#fef08a' : '#f8fafc';
    ctx.lineWidth = this.config.trackWidth + 22;
    this.strokePath(ctx);

    // Subtle track edge shadow rim
    ctx.strokeStyle = isDongHo ? '#78350f' : isStar ? '#dc2626' : '#78716c';
    ctx.lineWidth = this.config.trackWidth + 8;
    this.strokePath(ctx);

    // Main track surface
    ctx.strokeStyle = this.config.trackColor;
    ctx.lineWidth = this.config.trackWidth;
    this.strokePath(ctx);

    // 4-lane dashed divider lines at offsets -46, 0, +46
    ctx.strokeStyle = isDongHo ? 'rgba(28, 25, 23, 0.35)' : 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 22]);
    this.strokeOffsetPath(ctx, -46);
    this.strokePath(ctx);
    this.strokeOffsetPath(ctx, 46);
    ctx.setLineDash([]);

    // Checkered Start / Finish Line
    const startPos = this.getPositionAt(0, 0);
    ctx.save();
    ctx.translate(startPos.x, startPos.y);
    ctx.rotate(startPos.angle);
    const w = this.config.trackWidth;
    const cell = 16;
    for (let row = -w / 2; row < w / 2; row += cell) {
      const even = Math.floor(row / cell) % 2 === 0;
      const cellH = Math.min(cell, w / 2 - row);
      ctx.fillStyle = even ? '#ffffff' : '#0f172a';
      ctx.fillRect(-10, row, 10, cellH);
      ctx.fillStyle = even ? '#0f172a' : '#ffffff';
      ctx.fillRect(0, row, 10, cellH);
    }
    ctx.restore();

    // Directional chevrons painted just ahead of the Start Line to show CW / CCW direction clearly
    for (const d of [145, 235, 325]) {
      const p = this.getPositionAt(d, 0);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.strokeStyle = isDongHo ? 'rgba(185, 56, 34, 0.65)' : 'rgba(250, 204, 21, 0.78)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(-24, -44);
      ctx.lineTo(18, 0);
      ctx.lineTo(-24, 44);
      ctx.stroke();
      ctx.restore();
    }
  }

  strokePath(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    this.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
  }

  strokeOffsetPath(ctx: CanvasRenderingContext2D, offset: number) {
    const n = this.points.length;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const prev = this.points[(i - 1 + n) % n];
      const curr = this.points[i];
      const next = this.points[(i + 1) % n];
      const angle = Math.atan2(next.y - prev.y, next.x - prev.x);
      const ox = curr.x + -Math.sin(angle) * offset;
      const oy = curr.y + Math.cos(angle) * offset;
      if (i === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

export function drawMapThumbnail(canvas: HTMLCanvasElement, cfg: MapConfig) {
  const c = canvas.getContext('2d');
  if (!c) return;
  const w = canvas.width;
  const h = canvas.height;
  c.clearRect(0, 0, w, h);
  c.fillStyle = cfg.bgGrass;
  c.fillRect(0, 0, w, h);

  const pts = cfg.generatePoints();
  const bounds = getTrackBounds(pts);
  const padX = 16;
  const padY = 14;
  const availW = w - padX * 2;
  const availH = h - padY * 2;
  const scale = Math.min(availW / bounds.width, availH / bounds.height);
  const offsetX = padX + (availW - bounds.width * scale) / 2 - bounds.minX * scale;
  const offsetY = padY + (availH - bounds.height * scale) / 2 - bounds.minY * scale;

  c.save();
  c.translate(offsetX, offsetY);
  c.scale(scale, scale);

  // Render full heritage scenery inside the miniature preview!
  cfg.drawScenery(c);

  c.lineJoin = 'round';
  c.lineCap = 'round';
  const thumbTrackW = Math.max(cfg.trackWidth, 260);

  c.strokeStyle = cfg.id === 'dongho' ? '#1c1917' : '#ffffff';
  c.lineWidth = thumbTrackW + 55;
  c.beginPath();
  pts.forEach((p, i) => (i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y)));
  c.closePath();
  c.stroke();

  c.strokeStyle = cfg.trackColor;
  c.lineWidth = thumbTrackW;
  c.stroke();

  c.restore();
}
