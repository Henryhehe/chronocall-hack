import * as THREE from "three";
import { HistoricalPersonaId } from "../types/vision";
import {
  LowPolyObjectBlueprint,
  LowPolyPartSpec,
  LowPolySceneBlueprint,
} from "../types/world3d";
import {
  createContactShadowTexture,
  createStoneFloorTexture,
  createWoodPlankTexture,
} from "./worldTextures";

export type WorldAtmosphere = "daylight" | "dusk" | "starlight";

export interface WorldThemePalette {
  name: string;
  skyColor: number;
  fogColor: number;
  groundBase: string;
  groundGrout: string;
  accentColor: number;
  robeColor: number;
  trimColor: number;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
}

export const WORLD_THEMES: Record<HistoricalPersonaId, WorldThemePalette> = {
  "roman-senator": {
    name: "Roman Forum Courtyard",
    skyColor: 0x1b263b,
    fogColor: 0x1b263b,
    groundBase: "#8B7D6B",
    groundGrout: "#4A4137",
    accentColor: 0xf59e0b,
    robeColor: 0x991b1b,
    trimColor: 0xfbbf24,
    sunColor: 0xffe4b5,
    sunIntensity: 2.3,
    hemiSky: 0x93c5fd,
    hemiGround: 0x5c4738,
  },
  "renaissance-polymath": {
    name: "Florentine Workshop Terrace",
    skyColor: 0x182235,
    fogColor: 0x182235,
    groundBase: "#7E6752",
    groundGrout: "#3E3024",
    accentColor: 0x38bdf8,
    robeColor: 0x7f1d1d,
    trimColor: 0xd97706,
    sunColor: 0xffedd5,
    sunIntensity: 2.2,
    hemiSky: 0xbae6fd,
    hemiGround: 0x47382b,
  },
  "victorian-inventor": {
    name: "Gaslit London Courtyard",
    skyColor: 0x0f172a,
    fogColor: 0x0f172a,
    groundBase: "#475569",
    groundGrout: "#1E293B",
    accentColor: 0xf59e0b,
    robeColor: 0x1e293b,
    trimColor: 0xd97706,
    sunColor: 0xfde68a,
    sunIntensity: 1.7,
    hemiSky: 0x64748b,
    hemiGround: 0x1e293b,
  },
  "edo-samurai": {
    name: "Kyoto Cedar Courtyard",
    skyColor: 0x13202a,
    fogColor: 0x13202a,
    groundBase: "#5B6457",
    groundGrout: "#2E352B",
    accentColor: 0xef4444,
    robeColor: 0x0f172a,
    trimColor: 0xdc2626,
    sunColor: 0xfef3c7,
    sunIntensity: 2.1,
    hemiSky: 0xa7f3d0,
    hemiGround: 0x2d3a2d,
  },
  "ancient-pharaoh": {
    name: "Thebes Sandstone Temple",
    skyColor: 0x221b18,
    fogColor: 0x221b18,
    groundBase: "#B69162",
    groundGrout: "#6E5233",
    accentColor: 0x06b6d4,
    robeColor: 0x1d4ed8,
    trimColor: 0xf59e0b,
    sunColor: 0xffdfa8,
    sunIntensity: 2.5,
    hemiSky: 0xfde68a,
    hemiGround: 0x6d4c2f,
  },
  none: {
    name: "Aether Astral Plaza",
    skyColor: 0x0b1220,
    fogColor: 0x0b1220,
    groundBase: "#334155",
    groundGrout: "#0F172A",
    accentColor: 0x06b6d4,
    robeColor: 0x0e7490,
    trimColor: 0x38bdf8,
    sunColor: 0xe0f2fe,
    sunIntensity: 2.0,
    hemiSky: 0x38bdf8,
    hemiGround: 0x1e293b,
  },
};

export interface CharacterRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  head: THREE.Group;
  faceMaterial: THREE.MeshStandardMaterial;
  shadowPlane: THREE.Mesh;
}

export interface WorldObjectEntry {
  id: string;
  name: string;
  kind: string;
  description: string;
  group: THREE.Group;
  position: THREE.Vector3;
  collisionRadius: number;
  interactRadius: number;
  isActive: boolean;
  interactCount: number;
  statusLabel: () => string;
  interact: () => string;
  update: (dt: number, elapsed: number) => void;
}

export interface BuiltWorld {
  worldGroup: THREE.Group;
  interactables: WorldObjectEntry[];
  raycastTargets: THREE.Object3D[];
  selectionRing: THREE.Mesh;
  rainPoints: THREE.Points;
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  setAtmosphere: (mode: WorldAtmosphere) => void;
  setRainEnabled: (enabled: boolean) => void;
  igniteAllBraziers: () => void;
  addObjectBlueprint: (bp: LowPolyObjectBlueprint) => WorldObjectEntry;
  dispose: () => void;
}

function createLowPolyGeometry(part: LowPolyPartSpec): THREE.BufferGeometry {
  const [sx, sy, sz] = part.size;
  switch (part.shape) {
    case "cylinder":
      return new THREE.CylinderGeometry(
        Math.max(0.05, sx),
        Math.max(0.05, sz || sx),
        Math.max(0.08, sy),
        8
      );
    case "cone":
      return new THREE.ConeGeometry(
        Math.max(0.06, sx),
        Math.max(0.1, sy),
        7
      );
    case "sphere":
      return new THREE.SphereGeometry(Math.max(0.08, sx), 8, 6);
    case "torus":
      return new THREE.TorusGeometry(
        Math.max(0.12, sx),
        Math.min(sx * 0.45, Math.max(0.03, sz || sy || sx * 0.2)),
        6,
        14
      );
    case "octahedron":
      return new THREE.OctahedronGeometry(Math.max(0.08, sx), 0);
    case "dodecahedron":
      return new THREE.DodecahedronGeometry(Math.max(0.08, sx), 0);
    case "box":
    default:
      return new THREE.BoxGeometry(
        Math.max(0.08, sx),
        Math.max(0.08, sy),
        Math.max(0.08, sz)
      );
  }
}

export function buildLowPolyObjectEntry(
  bp: LowPolyObjectBlueprint
): WorldObjectEntry {
  const root = new THREE.Group();
  root.position.set(bp.x, 0, bp.z);
  root.rotation.y = bp.rotationY;
  root.scale.setScalar(bp.scale || 1);

  const animRoot = new THREE.Group();
  root.add(animRoot);

  const emissiveMaterials: { mat: THREE.MeshStandardMaterial; base: number }[] = [];
  let pointLight: THREE.PointLight | null = null;
  let glowColor = "#06B6D4";

  for (const part of bp.parts) {
    const geo = createLowPolyGeometry(part);
    const emissiveInt = part.emissiveIntensity ?? 0;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(part.color),
      emissive: new THREE.Color(part.emissive || "#000000"),
      emissiveIntensity: emissiveInt,
      roughness: part.roughness,
      metalness: part.metalness,
      flatShading: true,
    });

    if (emissiveInt > 0.1 || bp.interactionEffect === "ignite" || bp.interactionEffect === "pulse") {
      emissiveMaterials.push({ mat, base: emissiveInt });
      if (part.emissive && part.emissive !== "#000000") {
        glowColor = part.emissive;
      }
    }

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(part.position[0], part.position[1], part.position[2]);
    mesh.rotation.set(part.rotation[0], part.rotation[1], part.rotation[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    animRoot.add(mesh);
  }

  // Seat lowest vertex cleanly on floor y = 0
  animRoot.updateMatrixWorld(true);
  const localBox = new THREE.Box3().setFromObject(animRoot);
  if (Number.isFinite(localBox.min.y)) {
    animRoot.position.y -= localBox.min.y;
  }

  const size = new THREE.Vector3();
  localBox.getSize(size);
  const footprint = Math.max(size.x, size.z) * (bp.scale || 1);
  const collisionRadius = Math.max(0.65, Math.min(2.6, footprint * 0.48));
  const interactRadius = collisionRadius + 2.0;

  if (
    bp.interactionEffect === "ignite" ||
    emissiveMaterials.some((e) => e.base > 0.4)
  ) {
    pointLight = new THREE.PointLight(
      new THREE.Color(glowColor),
      bp.interactionEffect === "ignite" ? 2.4 : 1.4,
      9,
      2
    );
    pointLight.position.set(0, Math.max(1.2, size.y * 0.75), 0);
    animRoot.add(pointLight);
  }

  let bounceVel = 0;
  let spinBoost = 0;
  const baseScale = bp.scale || 1;

  const entry: WorldObjectEntry = {
    id: bp.id,
    name: bp.name,
    kind: bp.kind,
    description: bp.description,
    group: root,
    position: new THREE.Vector3(bp.x, 0, bp.z),
    collisionRadius,
    interactRadius,
    isActive: false,
    interactCount: 0,
    statusLabel: () => (entry.isActive ? "Active" : "Ready"),
    interact: () => {
      entry.isActive = !entry.isActive;
      entry.interactCount += 1;

      if (bp.interactionEffect === "bounce") {
        bounceVel = 4.2;
        root.rotation.y += 0.45;
      } else if (bp.interactionEffect === "spin") {
        spinBoost = 6.0;
      } else if (bp.interactionEffect === "chime") {
        bounceVel = 2.4;
      }

      for (const em of emissiveMaterials) {
        if (em.mat.emissive.getHex() === 0) {
          em.mat.emissive.setHex(0x06b6d4);
        }
        em.mat.emissiveIntensity = entry.isActive
          ? Math.max(1.8, em.base * 1.8)
          : em.base;
      }
      if (pointLight) {
        pointLight.intensity = entry.isActive ? 3.2 : 1.2;
      }

      return entry.isActive
        ? `Activated ${bp.name} (${bp.interactionEffect}).`
        : `Deactivated ${bp.name}.`;
    },
    update: (dt, elapsed) => {
      if (bp.interactionEffect === "spin") {
        spinBoost = THREE.MathUtils.damp(spinBoost, entry.isActive ? 2.2 : 0.35, 3, dt);
        animRoot.rotation.y += dt * spinBoost;
      } else if (bp.interactionEffect === "levitate") {
        const targetY = entry.isActive
          ? 0.55 + Math.sin(elapsed * 3.0) * 0.14
          : Math.sin(elapsed * 1.5) * 0.04;
        animRoot.position.y = THREE.MathUtils.damp(
          animRoot.position.y,
          Math.max(0, -localBox.min.y + targetY),
          6,
          dt
        );
        if (entry.isActive) animRoot.rotation.y += dt * 0.9;
      } else if (bp.interactionEffect === "pulse") {
        const s = entry.isActive
          ? baseScale * (1.06 + Math.sin(elapsed * 5) * 0.04)
          : baseScale;
        root.scale.setScalar(THREE.MathUtils.damp(root.scale.x, s, 8, dt));
      }

      if (root.position.y > 0 || bounceVel > 0) {
        root.position.y += bounceVel * dt;
        bounceVel -= 15 * dt;
        if (root.position.y <= 0) {
          root.position.y = 0;
          bounceVel = 0;
        }
      }
    },
  };

  return entry;
}

export function createCharacterRig(
  personaId: HistoricalPersonaId
): CharacterRig {
  const palette = WORLD_THEMES[personaId] ?? WORLD_THEMES.none;
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xe5b899,
    roughness: 0.65,
    metalness: 0.04,
  });
  const robeMat = new THREE.MeshStandardMaterial({
    color: palette.robeColor,
    roughness: 0.72,
    metalness: 0.08,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: palette.trimColor,
    roughness: 0.28,
    metalness: 0.85,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.7,
    metalness: 0.15,
  });

  // Grounded radial contact shadow
  const shadowGeo = new THREE.PlaneGeometry(1.5, 1.5);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: createContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.025;
  root.add(shadowPlane);

  // Articulated legs (pivoted at hip y = 0.78)
  const makeLeg = (xOffset: number) => {
    const leg = new THREE.Group();
    leg.position.set(xOffset, 0.78, 0);
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.095, 0.48, 12),
      darkMat
    );
    thigh.position.y = -0.24;
    thigh.castShadow = true;
    const boot = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.28, 0.28),
      trimMat
    );
    boot.position.set(0, -0.64, 0.04);
    boot.castShadow = true;
    leg.add(thigh, boot);
    return leg;
  };
  const leftLeg = makeLeg(-0.18);
  const rightLeg = makeLeg(0.18);
  bodyPivot.add(leftLeg, rightLeg);

  // Sculpted Torso + Belt + Cape
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.24, 0.74, 14),
    robeMat
  );
  torso.position.y = 1.16;
  torso.castShadow = true;
  bodyPivot.add(torso);

  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.265, 0.265, 0.1, 14),
    trimMat
  );
  belt.position.y = 0.87;
  bodyPivot.add(belt);

  const cape = new THREE.Mesh(
    new THREE.PlaneGeometry(0.58, 0.88),
    new THREE.MeshStandardMaterial({
      color: palette.robeColor,
      roughness: 0.82,
      metalness: 0.05,
      side: THREE.DoubleSide,
    })
  );
  cape.position.set(0, 1.05, -0.27);
  cape.rotation.x = 0.12;
  cape.castShadow = true;
  bodyPivot.add(cape);

  // Articulated arms + shoulder pauldrons
  const makeArm = (xOffset: number) => {
    const arm = new THREE.Group();
    arm.position.set(xOffset, 1.44, 0);
    const pauldron = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 12, 10),
      trimMat
    );
    pauldron.castShadow = true;
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.072, 0.48, 10),
      robeMat
    );
    sleeve.position.y = -0.25;
    sleeve.castShadow = true;
    const hand = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 10, 10),
      skinMat
    );
    hand.position.y = -0.52;
    arm.add(pauldron, sleeve, hand);
    return arm;
  };
  const leftArm = makeArm(-0.36);
  const rightArm = makeArm(0.36);
  bodyPivot.add(leftArm, rightArm);

  // Head + Photo Portrait Face Plate + Persona Headgear
  const head = new THREE.Group();
  head.position.set(0, 1.78, 0);
  const cranium = new THREE.Mesh(
    new THREE.SphereGeometry(0.23, 18, 16),
    skinMat
  );
  cranium.castShadow = true;
  head.add(cranium);

  const faceMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.4,
    metalness: 0.05,
  });
  const facePlate = new THREE.Mesh(
    new THREE.CircleGeometry(0.19, 24),
    faceMaterial
  );
  facePlate.position.set(0, 0, 0.21);
  head.add(facePlate);

  // Era headgear
  if (personaId === "roman-senator") {
    const wreath = new THREE.Mesh(
      new THREE.TorusGeometry(0.235, 0.032, 10, 24),
      trimMat
    );
    wreath.rotation.x = Math.PI / 2 - 0.15;
    wreath.position.y = 0.12;
    head.add(wreath);
  } else if (personaId === "victorian-inventor") {
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.03, 20),
      darkMat
    );
    brim.position.y = 0.19;
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.2, 0.28, 20),
      darkMat
    );
    crown.position.y = 0.33;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.215, 0.215, 0.05, 20),
      trimMat
    );
    band.position.y = 0.22;
    head.add(brim, crown, band);
  } else if (personaId === "edo-samurai") {
    const kabuto = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      darkMat
    );
    kabuto.position.y = 0.06;
    const crest = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.024, 8, 18, Math.PI),
      trimMat
    );
    crest.rotation.z = Math.PI;
    crest.position.set(0, 0.28, 0.18);
    head.add(kabuto, crest);
  } else if (personaId === "ancient-pharaoh") {
    const nemes = new THREE.Mesh(
      new THREE.ConeGeometry(0.29, 0.42, 6),
      new THREE.MeshStandardMaterial({
        color: 0x1d4ed8,
        roughness: 0.4,
        metalness: 0.45,
      })
    );
    nemes.position.set(0, 0.14, -0.02);
    const uraeus = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 10),
      trimMat
    );
    uraeus.position.set(0, 0.21, 0.22);
    head.add(nemes, uraeus);
  } else {
    const visor = new THREE.Mesh(
      new THREE.TorusGeometry(0.225, 0.025, 8, 20),
      trimMat
    );
    visor.rotation.x = Math.PI / 2;
    visor.position.y = 0.15;
    head.add(visor);
  }

  bodyPivot.add(head);

  return {
    root,
    bodyPivot,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    head,
    faceMaterial,
    shadowPlane,
  };
}

export function buildInteractiveWorld(
  scene: THREE.Scene,
  personaId: HistoricalPersonaId,
  maxAnisotropy: number,
  customBlueprint?: LowPolySceneBlueprint | null
): BuiltWorld {
  const basePalette = WORLD_THEMES[personaId] ?? WORLD_THEMES.none;
  const palette: WorldThemePalette = customBlueprint
    ? {
        name: customBlueprint.sceneName,
        skyColor: new THREE.Color(customBlueprint.palette.skyColor).getHex(),
        fogColor: new THREE.Color(customBlueprint.palette.fogColor).getHex(),
        groundBase: customBlueprint.palette.groundColor,
        groundGrout: customBlueprint.palette.groutColor,
        accentColor: new THREE.Color(customBlueprint.palette.accentColor).getHex(),
        robeColor: basePalette.robeColor,
        trimColor: basePalette.trimColor,
        sunColor: new THREE.Color(customBlueprint.palette.sunColor).getHex(),
        sunIntensity: customBlueprint.palette.sunIntensity,
        hemiSky: new THREE.Color(customBlueprint.palette.hemiSky).getHex(),
        hemiGround: new THREE.Color(customBlueprint.palette.hemiGround).getHex(),
      }
    : basePalette;
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  scene.background = new THREE.Color(palette.skyColor);
  scene.fog = new THREE.FogExp2(palette.fogColor, 0.017);

  // Warm key sun + cool hemisphere sky/ground fill
  const hemiLight = new THREE.HemisphereLight(
    palette.hemiSky,
    palette.hemiGround,
    0.85
  );
  worldGroup.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(
    palette.sunColor,
    palette.sunIntensity
  );
  sunLight.position.set(16, 26, 14);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 70;
  const d = 24;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.02;
  worldGroup.add(sunLight);

  // Extended natural outer terrain + patterned courtyard stone plaza
  const stoneTex = createStoneFloorTexture(
    palette.groundBase,
    palette.groundGrout,
    maxAnisotropy
  );
  const woodTex = createWoodPlankTexture("#5C3D28", "#3B2415", maxAnisotropy);

  const outerGround = new THREE.Mesh(
    new THREE.CircleGeometry(90, 64),
    new THREE.MeshStandardMaterial({
      color: palette.hemiGround,
      roughness: 0.95,
      metalness: 0.02,
    })
  );
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.receiveShadow = true;
  worldGroup.add(outerGround);

  const plazaFloor = new THREE.Mesh(
    new THREE.CircleGeometry(22.5, 64),
    new THREE.MeshStandardMaterial({
      map: stoneTex,
      roughness: 0.78,
      metalness: 0.06,
    })
  );
  plazaFloor.rotation.x = -Math.PI / 2;
  plazaFloor.position.y = 0.01;
  plazaFloor.receiveShadow = true;
  worldGroup.add(plazaFloor);

  // Center medallion ring (offset >= 0.02 so zero Z-fighting)
  const centerRing = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.1, 48),
    new THREE.MeshStandardMaterial({
      color: palette.accentColor,
      roughness: 0.3,
      metalness: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  centerRing.rotation.x = -Math.PI / 2;
  centerRing.position.y = 0.03;
  worldGroup.add(centerRing);

  // Selection highlight ring beneath whichever object is hovered or nearest
  const selectionRing = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.15, 32),
    new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    })
  );
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.position.y = 0.04;
  selectionRing.visible = false;
  worldGroup.add(selectionRing);

  const interactables: WorldObjectEntry[] = [];
  const raycastTargets: THREE.Object3D[] = [];

  const registerObject = (entry: WorldObjectEntry) => {
    entry.group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.userData.interactableId = entry.id;
        raycastTargets.push(child);
      }
    });
    interactables.push(entry);
    worldGroup.add(entry.group);
  };

  // Shared materials
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.76,
    metalness: 0.06,
  });
  const darkStoneMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.82,
    metalness: 0.08,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.25,
    metalness: 0.9,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughness: 0.72,
    metalness: 0.05,
  });

  if (customBlueprint && customBlueprint.objects.length > 0) {
    for (const bp of customBlueprint.objects) {
      registerObject(buildLowPolyObjectEntry(bp));
    }
  } else {
  // 1. Braziers (4 corners of the central courtyard)
  const brazierCoords: [number, number][] = [
    [-5.5, -5.5],
    [5.5, -5.5],
    [-5.5, 5.5],
    [5.5, 5.5],
  ];
  brazierCoords.forEach(([bx, bz], i) => {
    const g = new THREE.Group();
    g.position.set(bx, 0, bz);

    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.7, 0.45, 12),
      darkStoneMat
    );
    plinth.position.y = 0.225;
    plinth.castShadow = true;
    plinth.receiveShadow = true;

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.4, 0.55, 10),
      stoneMat
    );
    stem.position.y = 0.72;
    stem.castShadow = true;

    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.32, 0.34, 14),
      brassMat
    );
    bowl.position.y = 1.15;
    bowl.castShadow = true;

    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xff6b00,
      emissive: 0xff5500,
      emissiveIntensity: 2.2,
      roughness: 0.3,
    });
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.78, 10),
      flameMat
    );
    flame.position.y = 1.58;

    const light = new THREE.PointLight(0xff8c24, 3.2, 11, 2);
    light.position.y = 1.85;

    g.add(plinth, stem, bowl, flame, light);

    const entry: WorldObjectEntry = {
      id: `brazier-${i}`,
      name: `Temple Brazier #${i + 1}`,
      kind: "brazier",
      description: "Bronze fire brazier lighting the courtyard.",
      group: g,
      position: new THREE.Vector3(bx, 0, bz),
      collisionRadius: 0.85,
      interactRadius: 2.5,
      isActive: true,
      interactCount: 0,
      statusLabel: () => (entry.isActive ? "Lit" : "Extinguished"),
      interact: () => {
        entry.isActive = !entry.isActive;
        entry.interactCount += 1;
        flame.visible = entry.isActive;
        light.intensity = entry.isActive ? 3.2 : 0;
        return entry.isActive
          ? `Ignited ${entry.name} — warm firelight spills across the stone.`
          : `Extinguished ${entry.name}.`;
      },
      update: (_dt, elapsed) => {
        if (entry.isActive) {
          const flicker = 1 + Math.sin(elapsed * 9 + i * 2) * 0.14;
          flame.scale.set(1, flicker, 1);
          light.intensity = 3.0 + Math.sin(elapsed * 11 + i) * 0.45;
        }
      },
    };
    registerObject(entry);
  });

  // 2. Hinged Relic Chest
  {
    const g = new THREE.Group();
    g.position.set(-7.5, 0, 0.5);
    g.rotation.y = Math.PI / 3;

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.9), woodMat);
    base.position.y = 0.35;
    base.castShadow = true;

    const strapL = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.72, 0.94),
      brassMat
    );
    strapL.position.set(-0.42, 0.36, 0);
    const strapR = strapL.clone();
    strapR.position.x = 0.42;

    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.7, -0.45);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.24, 0.92), woodMat);
    lid.position.set(0, 0.12, 0.45);
    lid.castShadow = true;
    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.08), brassMat);
    clasp.position.set(0, 0.04, 0.92);
    lidPivot.add(lid, clasp);

    const relicCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 0),
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 1.8,
        roughness: 0.12,
        metalness: 0.3,
      })
    );
    relicCrystal.position.set(0, 0.55, 0);

    g.add(base, strapL, strapR, lidPivot, relicCrystal);

    let targetAngle = 0;
    const entry: WorldObjectEntry = {
      id: "relic-chest",
      name: "Gilded Relic Chest",
      kind: "chest",
      description: "Brass-bound chest guarding an illuminated artifact.",
      group: g,
      position: g.position.clone(),
      collisionRadius: 1.0,
      interactRadius: 2.6,
      isActive: false,
      interactCount: 0,
      statusLabel: () => (entry.isActive ? "Open" : "Locked"),
      interact: () => {
        entry.isActive = !entry.isActive;
        entry.interactCount += 1;
        targetAngle = entry.isActive ? -Math.PI * 0.58 : 0;
        return entry.isActive
          ? "Opened the Relic Chest — a glowing prism rises from inside!"
          : "Closed and latched the Relic Chest.";
      },
      update: (dt, elapsed) => {
        lidPivot.rotation.x = THREE.MathUtils.damp(
          lidPivot.rotation.x,
          targetAngle,
          8,
          dt
        );
        const targetCrystalY = entry.isActive
          ? 1.15 + Math.sin(elapsed * 3) * 0.08
          : 0.52;
        relicCrystal.position.y = THREE.MathUtils.damp(
          relicCrystal.position.y,
          targetCrystalY,
          7,
          dt
        );
        relicCrystal.rotation.y += dt * (entry.isActive ? 2.2 : 0.4);
      },
    };
    registerObject(entry);
  }

  // 3. Kinetic Brass Astrolabe / Orrery
  {
    const g = new THREE.Group();
    g.position.set(7.5, 0, -1.5);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 1.0, 1.05, 16),
      stoneMat
    );
    base.position.y = 0.525;
    base.castShadow = true;

    const ringOuter = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.055, 12, 36),
      brassMat
    );
    ringOuter.position.y = 1.9;
    ringOuter.castShadow = true;

    const ringInner = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.045, 12, 32),
      brassMat
    );
    ringInner.position.y = 1.9;

    const coreOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 20, 20),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.5,
        roughness: 0.2,
        metalness: 0.6,
      })
    );
    coreOrb.position.y = 1.9;

    g.add(base, ringOuter, ringInner, coreOrb);

    const entry: WorldObjectEntry = {
      id: "celestial-astrolabe",
      name: "Celestial Astrolabe",
      kind: "astrolabe",
      description: "Spinning brass orrery aligned to the sky dome.",
      group: g,
      position: g.position.clone(),
      collisionRadius: 1.1,
      interactRadius: 2.8,
      isActive: false,
      interactCount: 0,
      statusLabel: () => (entry.isActive ? "Overdrive" : "Orbiting"),
      interact: () => {
        entry.isActive = !entry.isActive;
        entry.interactCount += 1;
        return entry.isActive
          ? "Astrolabe rings spin into harmonic alignment!"
          : "Astrolabe returns to steady celestial drift.";
      },
      update: (dt) => {
        const speed = entry.isActive ? 3.2 : 0.65;
        ringOuter.rotation.y += dt * speed;
        ringOuter.rotation.x += dt * speed * 0.4;
        ringInner.rotation.z -= dt * speed * 1.4;
        ringInner.rotation.y += dt * speed * 0.5;
      },
    };
    registerObject(entry);
  }

  // 4. Center Sanctum Fountain
  {
    const g = new THREE.Group();
    g.position.set(0, 0, -8.5);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.35, 0.55, 24),
      stoneMat
    );
    rim.position.y = 0.275;
    rim.castShadow = true;
    rim.receiveShadow = true;

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      emissive: 0x0369a1,
      emissiveIntensity: 0.35,
      roughness: 0.08,
      metalness: 0.1,
      clearcoat: 1.0,
    });
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 0.1, 24), waterMat);
    water.position.y = 0.52;

    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.42, 1.5, 14),
      stoneMat
    );
    spire.position.y = 1.05;
    spire.castShadow = true;

    const crownOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x06b6d4,
        emissiveIntensity: 1.1,
        roughness: 0.15,
      })
    );
    crownOrb.position.y = 1.95;

    g.add(rim, water, spire, crownOrb);

    const entry: WorldObjectEntry = {
      id: "sanctum-fountain",
      name: "Sanctum Fountain",
      kind: "fountain",
      description: "Luminous stone basin fed by spring water.",
      group: g,
      position: g.position.clone(),
      collisionRadius: 2.3,
      interactRadius: 3.4,
      isActive: false,
      interactCount: 0,
      statusLabel: () => (entry.isActive ? "Surging" : "Calm"),
      interact: () => {
        entry.isActive = !entry.isActive;
        entry.interactCount += 1;
        waterMat.emissiveIntensity = entry.isActive ? 1.1 : 0.35;
        return entry.isActive
          ? "Fountain waters surge upward with bright cyan luminescence."
          : "The fountain settles into calm mirror ripples.";
      },
      update: (dt, elapsed) => {
        const pulse = entry.isActive
          ? 2.1 + Math.sin(elapsed * 5) * 0.2
          : 1.95 + Math.sin(elapsed * 2) * 0.05;
        crownOrb.position.y = THREE.MathUtils.damp(crownOrb.position.y, pulse, 6, dt);
        crownOrb.rotation.y += dt * (entry.isActive ? 2.4 : 0.5);
      },
    };
    registerObject(entry);
  }

  // 5. Time Portal Archway
  {
    const g = new THREE.Group();
    g.position.set(0, 0, -15.5);

    const colL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.8, 0.8), darkStoneMat);
    colL.position.set(-1.7, 1.9, 0);
    colL.castShadow = true;
    const colR = colL.clone();
    colR.position.x = 1.7;

    const lintel = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.65, 1.0), stoneMat);
    lintel.position.set(0, 4.05, 0);
    lintel.castShadow = true;

    const portalMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.4,
      roughness: 0.2,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });
    const portalDisc = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.14, 14, 40),
      portalMat
    );
    portalDisc.position.set(0, 2.0, 0);

    g.add(colL, colR, lintel, portalDisc);

    const entry: WorldObjectEntry = {
      id: "time-portal",
      name: "Chrono Portal Arch",
      kind: "portal",
      description: "Ancient archway that shifts the sky and atmosphere.",
      group: g,
      position: g.position.clone(),
      collisionRadius: 1.6,
      interactRadius: 3.4,
      isActive: false,
      interactCount: 0,
      statusLabel: () => (entry.isActive ? "Charged" : "Standby"),
      interact: () => {
        entry.isActive = !entry.isActive;
        entry.interactCount += 1;
        portalMat.emissiveIntensity = entry.isActive ? 2.6 : 1.4;
        return "Activated Chrono Portal Arch — sky and lighting shifted!";
      },
      update: (dt) => {
        portalDisc.rotation.z += dt * (entry.isActive ? 2.8 : 0.7);
      },
    };
    registerObject(entry);
  }

  // 6. Bronze Resonance Bell Tower
  {
    const g = new THREE.Group();
    g.position.set(8.8, 0, 5.8);
    g.rotation.y = -Math.PI / 4;

    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.0, 10), woodMat);
    postL.position.set(-0.85, 1.5, 0);
    postL.castShadow = true;
    const postR = postL.clone();
    postR.position.x = 0.85;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 0.24), woodMat);
    beam.position.y = 2.95;

    const bellPivot = new THREE.Group();
    bellPivot.position.y = 2.85;
    const bellBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.48, 0.72, 18),
      brassMat
    );
    bellBody.position.y = -0.55;
    bellBody.castShadow = true;
    bellPivot.add(bellBody);

    g.add(postL, postR, beam, bellPivot);

    let swingAmp = 0;
    const entry: WorldObjectEntry = {
      id: "resonance-bell",
      name: "Bronze Courtyard Bell",
      kind: "bell",
      description: "Suspended ceremonial bell that rings on contact.",
      group: g,
      position: g.position.clone(),
      collisionRadius: 1.1,
      interactRadius: 2.8,
      isActive: false,
      interactCount: 0,
      statusLabel: () => (swingAmp > 0.04 ? "Ringing" : "Still"),
      interact: () => {
        entry.interactCount += 1;
        swingAmp = 0.55;
        return "Struck the Bronze Bell — a deep harmonic chime echoes across the courtyard.";
      },
      update: (dt, elapsed) => {
        if (swingAmp > 0.002) {
          bellPivot.rotation.x = Math.sin(elapsed * 9) * swingAmp;
          swingAmp = THREE.MathUtils.damp(swingAmp, 0, 1.8, dt);
        } else {
          bellPivot.rotation.x = 0;
        }
      },
    };
    registerObject(entry);
  }

  // 7. Scholar's Lectern & Illuminated Tome
  {
    const g = new THREE.Group();
    g.position.set(-3.6, 0, -3.2);
    g.rotation.y = 0.4;

    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.34, 1.05, 12),
      woodMat
    );
    stand.position.y = 0.525;
    stand.castShadow = true;

    const desk = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.6), woodMat);
    desk.position.set(0, 1.08, 0);
    desk.rotation.x = 0.35;
    desk.castShadow = true;

    const bookMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.35,
      roughness: 0.6,
    });
    const tome = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.07, 0.4), bookMat);
    tome.position.set(0, 1.15, 0.02);
    tome.rotation.x = 0.35;

    g.add(stand, desk, tome);

    const entry: WorldObjectEntry = {
      id: "scroll-lectern",
      name: "Chronicle Lectern",
      kind: "lectern",
      description: "Ancient manuscript recording the history of this plaza.",
      group: g,
      position: g.position.clone(),
      collisionRadius: 0.75,
      interactRadius: 2.4,
      isActive: false,
      interactCount: 0,
      statusLabel: () => (entry.isActive ? "Illuminated" : "Closed"),
      interact: () => {
        entry.isActive = !entry.isActive;
        entry.interactCount += 1;
        bookMat.emissiveIntensity = entry.isActive ? 1.5 : 0.35;
        return entry.isActive
          ? "Opened the Chronicle Tome — golden ink inscriptions shimmer."
          : "Closed the Chronicle Tome.";
      },
      update: (dt, elapsed) => {
        const targetY = entry.isActive
          ? 1.28 + Math.sin(elapsed * 3.5) * 0.05
          : 1.15;
        tome.position.y = THREE.MathUtils.damp(tome.position.y, targetY, 8, dt);
      },
    };
    registerObject(entry);
  }

  // 8. Hanging Lantern Posts (2 interactive posts)
  const lanternCoords: [number, number][] = [
    [-9.2, 6.2],
    [4.4, 8.8],
  ];
  lanternCoords.forEach(([lx, lz], idx) => {
    const g = new THREE.Group();
    g.position.set(lx, 0, lz);

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.14, 2.8, 10),
      woodMat
    );
    post.position.y = 1.4;
    post.castShadow = true;

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.1, 0.1), woodMat);
    arm.position.set(0.32, 2.7, 0);

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfbbf24,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    const globe = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 1), glassMat);
    globe.position.set(0.62, 2.42, 0);

    const pt = new THREE.PointLight(0xfbbf24, 2.6, 10, 2);
    pt.position.set(0.62, 2.38, 0);

    g.add(post, arm, globe, pt);

    const entry: WorldObjectEntry = {
      id: `lantern-${idx}`,
      name: `Courtyard Lantern #${idx + 1}`,
      kind: "lantern",
      description: "Elevated amber street lantern.",
      group: g,
      position: new THREE.Vector3(lx, 0, lz),
      collisionRadius: 0.55,
      interactRadius: 2.5,
      isActive: true,
      interactCount: 0,
      statusLabel: () => (entry.isActive ? "Lit" : "Off"),
      interact: () => {
        entry.isActive = !entry.isActive;
        entry.interactCount += 1;
        pt.intensity = entry.isActive ? 2.6 : 0;
        glassMat.emissiveIntensity = entry.isActive ? 1.8 : 0.05;
        return entry.isActive
          ? `Lit ${entry.name}.`
          : `Dimmed ${entry.name}.`;
      },
      update: () => {},
    };
    registerObject(entry);
  });

  // 9. Interactive Crates & Perimeter Pillars (so even scenery objects react!)
  const crateCoords: [number, number][] = [
    [-8.5, -6.4],
    [10.2, -5.8],
    [-2.4, 8.2],
  ];
  crateCoords.forEach(([cx, cz], idx) => {
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    g.rotation.y = idx * 0.7;

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), woodMat);
    body.position.y = 0.45;
    body.castShadow = true;
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(0.94, 0.14, 0.94),
      brassMat
    );
    trim.position.y = 0.45;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 0.42, 12),
      darkStoneMat
    );
    cap.position.set(0.15, 1.11, -0.1);
    cap.castShadow = true;

    g.add(body, trim, cap);

    let hopVel = 0;
    const entry: WorldObjectEntry = {
      id: `crate-${idx}`,
      name: `Supply Crate #${idx + 1}`,
      kind: "crate",
      description: "Brass-strapped merchant crate with ceramic vessel.",
      group: g,
      position: new THREE.Vector3(cx, 0, cz),
      collisionRadius: 0.75,
      interactRadius: 2.3,
      isActive: false,
      interactCount: 0,
      statusLabel: () => `Inspected ×${entry.interactCount}`,
      interact: () => {
        entry.interactCount += 1;
        hopVel = 3.4;
        g.rotation.y += 0.35;
        return `Shifted ${entry.name} and checked its cargo.`;
      },
      update: (dt) => {
        if (g.position.y > 0 || hopVel > 0) {
          g.position.y += hopVel * dt;
          hopVel -= 14 * dt;
          if (g.position.y <= 0) {
            g.position.y = 0;
            hopVel = 0;
          }
        }
      },
    };
    registerObject(entry);
  });

  // 10. Four Carved Interactive Monolith Pillars around the perimeter
  const pillarAngles = [0.4, 1.9, 3.6, 5.1];
  pillarAngles.forEach((ang, idx) => {
    const px = Math.cos(ang) * 14.5;
    const pz = Math.sin(ang) * 14.5;
    const g = new THREE.Group();
    g.position.set(px, 0, pz);

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.5, 1.4),
      darkStoneMat
    );
    plinth.position.y = 0.25;
    plinth.castShadow = true;
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, 3.6, 12),
      stoneMat
    );
    shaft.position.y = 2.3;
    shaft.castShadow = true;
    const runeBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.49, 0.49, 0.28, 12),
      new THREE.MeshStandardMaterial({
        color: palette.accentColor,
        emissive: palette.accentColor,
        emissiveIntensity: 0.35,
        roughness: 0.3,
      })
    );
    runeBand.position.y = 3.3;

    g.add(plinth, shaft, runeBand);

    const entry: WorldObjectEntry = {
      id: `pillar-${idx}`,
      name: `Carved Monolith #${idx + 1}`,
      kind: "pillar",
      description: "Inscribed courtyard column with resonant rune ring.",
      group: g,
      position: new THREE.Vector3(px, 0, pz),
      collisionRadius: 0.95,
      interactRadius: 2.6,
      isActive: false,
      interactCount: 0,
      statusLabel: () => (entry.isActive ? "Resonating" : "Dormant"),
      interact: () => {
        entry.isActive = !entry.isActive;
        entry.interactCount += 1;
        const mat = runeBand.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = entry.isActive ? 2.2 : 0.35;
        return entry.isActive
          ? `Awakened the rune ring on ${entry.name}.`
          : `Quieted ${entry.name}.`;
      },
      update: (dt) => {
        if (entry.isActive) {
          runeBand.rotation.y += dt * 1.4;
        }
      },
    };
    registerObject(entry);
  });
  }

  // Natural Outdoor Perimeter: InstancedMesh cypress/olive trees & boulders (never a floating wall)
  const treeCount = 26;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.36, 2.2, 8);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x4b3621,
    roughness: 0.9,
  });
  const canopyGeo = new THREE.ConeGeometry(1.35, 3.8, 9);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x2d4c2b,
    roughness: 0.85,
  });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
  trunks.castShadow = true;
  canopies.castShadow = true;

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  for (let i = 0; i < treeCount; i++) {
    const a = (i / treeCount) * Math.PI * 2 + (i % 2) * 0.08;
    const rad = 24.5 + (i % 3) * 3.2;
    const sc = 0.85 + ((i * 7) % 5) * 0.08;
    const tx = Math.cos(a) * rad;
    const tz = Math.sin(a) * rad;

    dummy.position.set(tx, 1.1 * sc, tz);
    dummy.scale.set(sc, sc, sc);
    dummy.rotation.y = a;
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);

    dummy.position.set(tx, 3.3 * sc, tz);
    dummy.updateMatrix();
    canopies.setMatrixAt(i, dummy.matrix);

    tint.setHSL(0.28 + ((i % 4) - 2) * 0.015, 0.38, 0.25 + (i % 3) * 0.03);
    canopies.setColorAt(i, tint);
  }
  trunks.computeBoundingSphere();
  canopies.computeBoundingSphere();
  worldGroup.add(trunks, canopies);

  // Weather Rain Particle System (toggled by AI/portal effects)
  const rainCount = 700;
  const rainPos = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 44;
    rainPos[i * 3 + 1] = Math.random() * 18;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 44;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0xbae6fd,
    size: 0.14,
    transparent: true,
    opacity: 0.72,
  });
  const rainPoints = new THREE.Points(rainGeo, rainMat);
  rainPoints.visible = Boolean(customBlueprint?.palette.rain);
  worldGroup.add(rainPoints);

  const setAtmosphere = (mode: WorldAtmosphere) => {
    if (mode === "daylight") {
      scene.background = new THREE.Color(palette.skyColor);
      scene.fog = new THREE.FogExp2(palette.fogColor, 0.017);
      sunLight.color.setHex(palette.sunColor);
      sunLight.intensity = palette.sunIntensity;
      hemiLight.intensity = 0.85;
    } else if (mode === "dusk") {
      scene.background = new THREE.Color(0x2a1824);
      scene.fog = new THREE.FogExp2(0x2a1824, 0.02);
      sunLight.color.setHex(0xfb923c);
      sunLight.intensity = 1.6;
      hemiLight.intensity = 0.65;
    } else {
      scene.background = new THREE.Color(0x060b16);
      scene.fog = new THREE.FogExp2(0x060b16, 0.024);
      sunLight.color.setHex(0x93c5fd);
      sunLight.intensity = 0.85;
      hemiLight.intensity = 0.45;
    }
  };

  const setRainEnabled = (enabled: boolean) => {
    rainPoints.visible = enabled;
  };

  const igniteAllBraziers = () => {
    for (const obj of interactables) {
      if ((obj.kind === "brazier" || obj.kind === "lantern") && !obj.isActive) {
        obj.interact();
      }
    }
  };

  const addObjectBlueprint = (bp: LowPolyObjectBlueprint): WorldObjectEntry => {
    const entry = buildLowPolyObjectEntry(bp);
    registerObject(entry);
    return entry;
  };

  const dispose = () => {
    worldGroup.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const m of mats) {
          const std = m as THREE.MeshStandardMaterial;
          std.map?.dispose();
          m.dispose();
        }
      }
    });
    scene.remove(worldGroup);
  };

  return {
    worldGroup,
    interactables,
    raycastTargets,
    selectionRing,
    rainPoints,
    sunLight,
    hemiLight,
    setAtmosphere,
    setRainEnabled,
    igniteAllBraziers,
    addObjectBlueprint,
    dispose,
  };
}
