import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Flame,
  Hand,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
} from "lucide-react";
import { HistoricalPersonaId } from "../../../types/vision";
import {
  LowPolyObjectBlueprint,
  LowPolySceneBlueprint,
} from "../../../types/world3d";
import {
  buildInteractiveWorld,
  BuiltWorld,
  CharacterRig,
  createCharacterRig,
  WORLD_THEMES,
  WorldAtmosphere,
  WorldObjectEntry,
} from "../three/worldBuilder";
import { createAvatarFaceTexture } from "../three/worldTextures";
import { worldSfx } from "../three/worldSfx";

interface Interactive3DWorldProps {
  personaId: HistoricalPersonaId;
  avatarImageUrl: string | null;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  externalWorldEvent?: { id: number; text: string } | null;
  customSceneBlueprint?: LowPolySceneBlueprint | null;
  spawnedObjectEvent?: { id: number; object: LowPolyObjectBlueprint } | null;
  cameraRotationDeg?: number;
  cameraPitchDeg?: number;
  cameraZoom?: number;
  onCameraChange?: (cam: {
    rotationDeg: number;
    pitchDeg: number;
    zoom: number;
  }) => void;
}

interface ActiveObjectHud {
  id: string;
  name: string;
  kind: string;
  status: string;
  description: string;
}

function detectSoftwareGl(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const raw = ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(
      String(raw ?? "")
    );
  } catch {
    return false;
  }
}

function scheduleAfterDraw(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  callback: () => void
): () => void {
  let cancelled = false;
  let rafId = 0;
  let timerId = 0;

  if (typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext) {
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (cancelled) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      if (!sync) {
        timerId = window.setTimeout(callback, 80);
        return;
      }
      const res = gl.clientWaitSync(sync, 0, 0);
      if (res === gl.TIMEOUT_EXPIRED) {
        rafId = requestAnimationFrame(poll);
      } else {
        gl.deleteSync(sync);
        timerId = window.setTimeout(callback, 80);
      }
    };
    rafId = requestAnimationFrame(poll);
  } else {
    timerId = window.setTimeout(callback, 80);
  }

  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
    window.clearTimeout(timerId);
  };
}

export const Interactive3DWorld: React.FC<Interactive3DWorldProps> = ({
  personaId,
  avatarImageUrl,
  onCanvasReady,
  externalWorldEvent,
  customSceneBlueprint,
  spawnedObjectEvent,
  cameraRotationDeg,
  cameraPitchDeg,
  cameraZoom,
  onCameraChange,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Scene & character refs for imperative controls + effect updates
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const worldRef = useRef<BuiltWorld | null>(null);
  const charRigRef = useRef<CharacterRig | null>(null);
  const maxAnisoRef = useRef<number>(4);

  // Mutable simulation refs (zero React re-renders inside render loop)
  const keysRef = useRef<Set<string>>(new Set());
  const touchMoveRef = useRef<{ forward: number; right: number }>({
    forward: 0,
    right: 0,
  });
  const charPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 4.5));
  const charVelYRef = useRef<number>(0);
  const isGroundedRef = useRef<boolean>(true);
  const charYawRef = useRef<number>(Math.PI);
  const camYawRef = useRef<number>(0);
  const camPitchRef = useRef<number>(0.36);
  const camDistRef = useRef<number>(8.2);
  const footstepTimerRef = useRef<number>(0);
  const nearestObjIdRef = useRef<string | null>(null);
  const selectedObjIdRef = useRef<string | null>(null);
  const atmosphereRef = useRef<WorldAtmosphere>("daylight");

  // Pre-allocated scratch vectors (zero GC in render tick)
  const scratchForward = useRef(new THREE.Vector3());
  const scratchRight = useRef(new THREE.Vector3());
  const scratchMove = useRef(new THREE.Vector3());
  const scratchCamTarget = useRef(new THREE.Vector3());
  const scratchDesiredCam = useRef(new THREE.Vector3());
  const scratchNdc = useRef(new THREE.Vector2());
  const raycasterRef = useRef(new THREE.Raycaster());

  // Latest props in refs so callbacks stay stable across renders
  const personaIdRef = useRef(personaId);
  personaIdRef.current = personaId;
  const customBlueprintRef = useRef(customSceneBlueprint);
  customBlueprintRef.current = customSceneBlueprint;
  const onCanvasReadyRef = useRef(onCanvasReady);
  onCanvasReadyRef.current = onCanvasReady;
  const onCameraChangeRef = useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;

  const emitCameraChange = useCallback(() => {
    if (!onCameraChangeRef.current) return;
    let deg = Math.round(((camYawRef.current * 180) / Math.PI) % 360);
    if (deg > 180) deg -= 360;
    if (deg < -180) deg += 360;
    const pitchDeg = Math.round((camPitchRef.current * 180) / Math.PI);
    const zoom = Number(camDistRef.current.toFixed(1));
    onCameraChangeRef.current({ rotationDeg: deg, pitchDeg, zoom });
  }, []);

  // React UI state for compact HUD
  const [nearestObject, setNearestObject] = useState<ActiveObjectHud | null>(null);
  const [selectedObject, setSelectedObject] = useState<ActiveObjectHud | null>(null);
  const [reactionBanner, setReactionBanner] = useState<string>(
    "Walk with WASD, drag to orbit camera, and press [E] or click any object to interact."
  );
  const [isAiReacting, setIsAiReacting] = useState(false);
  const [atmosphere, setAtmosphere] = useState<WorldAtmosphere>("daylight");
  const [rainEnabled, setRainEnabled] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [objectPrompt, setObjectPrompt] = useState("");
  const [interactedCount, setInteractedCount] = useState(0);

  const applyAtmosphere = useCallback((mode: WorldAtmosphere) => {
    atmosphereRef.current = mode;
    setAtmosphere(mode);
    worldRef.current?.setAtmosphere(mode);
  }, []);

  const applyWorldEffect = useCallback(
    (effect: string) => {
      const world = worldRef.current;
      if (!world) return;
      if (effect === "ignite") {
        world.igniteAllBraziers();
      } else if (effect === "daylight") {
        applyAtmosphere("daylight");
      } else if (effect === "dusk") {
        applyAtmosphere("dusk");
      } else if (effect === "rain") {
        world.setRainEnabled(true);
        setRainEnabled(true);
      } else if (effect === "shimmer") {
        for (const item of world.interactables) {
          if (item.kind === "pillar" && !item.isActive) {
            item.interact();
          }
        }
      }
    },
    [applyAtmosphere]
  );

  const triggerObjectInteraction = useCallback(
    async (entry: WorldObjectEntry, customUserAction?: string) => {
      selectedObjIdRef.current = entry.id;
      const localReaction = entry.interact();
      worldSfx.playInteract(entry.kind);
      setInteractedCount((c) => c + 1);

      if (entry.kind === "portal") {
        const nextMode: WorldAtmosphere =
          atmosphereRef.current === "daylight"
            ? "dusk"
            : atmosphereRef.current === "dusk"
              ? "starlight"
              : "daylight";
        applyAtmosphere(nextMode);
      }

      setSelectedObject({
        id: entry.id,
        name: entry.name,
        kind: entry.kind,
        status: entry.statusLabel(),
        description: entry.description,
      });
      setReactionBanner(localReaction);

      // Ask Gemini 4 for an era-authentic reaction + dynamic worldEffect
      setIsAiReacting(true);
      try {
        const theme = WORLD_THEMES[personaIdRef.current] ?? WORLD_THEMES.none;
        const res = await fetch("/api/world/interact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objectName: entry.name,
            objectKind: entry.kind,
            objectState: entry.statusLabel(),
            personaId: personaIdRef.current,
            worldTheme: theme.name,
            userAction: customUserAction ?? "inspect and activate",
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            reply?: string;
            worldEffect?: string;
          };
          if (data.reply) {
            setReactionBanner(`${entry.name}: ${data.reply}`);
          }
          if (data.worldEffect && data.worldEffect !== "none") {
            applyWorldEffect(data.worldEffect);
          }
        }
      } catch {
        // Local physical interaction + SFX already succeeded cleanly
      } finally {
        setIsAiReacting(false);
      }
    },
    [applyAtmosphere, applyWorldEffect]
  );

  const triggerInteractionRef = useRef(triggerObjectInteraction);
  triggerInteractionRef.current = triggerObjectInteraction;

  const interactNearest = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    const targetId = nearestObjIdRef.current ?? selectedObjIdRef.current;
    if (!targetId) return;
    const entry = world.interactables.find((o) => o.id === targetId);
    if (entry) {
      void triggerInteractionRef.current(entry);
    }
  }, []);

  const triggerJump = useCallback(() => {
    if (isGroundedRef.current) {
      charVelYRef.current = 7.4;
      isGroundedRef.current = false;
      worldSfx.playJump();
    }
  }, []);

  const resetPosition = useCallback(() => {
    charPosRef.current.set(0, 0, 4.5);
    charVelYRef.current = 0;
    isGroundedRef.current = true;
    charYawRef.current = Math.PI;
    camYawRef.current = 0;
    camPitchRef.current = 0.36;
    camDistRef.current = 8.2;
    emitCameraChange();
    setReactionBanner("Returned character to the central courtyard plaza.");
  }, [emitCameraChange]);

  // 1. Mount Three.js WebGLRenderer, Scene, RoomEnvironment, Camera, Input & Render Loop ONCE
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    const gl = renderer.getContext();
    const isSoftwareGl = detectSoftwareGl(gl);

    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";

    const width = Math.max(mount.clientWidth, 320);
    const height = Math.max(mount.clientHeight, 180);
    renderer.setSize(width, height, false);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    maxAnisoRef.current = renderer.capabilities.getMaxAnisotropy();
    onCanvasReadyRef.current?.(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Neutral HDR-like PMREM studio environment so metallic brass/stone PBR materials shine
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 160);
    camera.position.set(0, 4.2, 12.2);
    cameraRef.current = camera;

    // Build initial world & character
    const built = buildInteractiveWorld(
      scene,
      personaIdRef.current,
      maxAnisoRef.current,
      customBlueprintRef.current
    );
    worldRef.current = built;

    const rig = createCharacterRig(personaIdRef.current);
    rig.root.position.copy(charPosRef.current);
    rig.root.rotation.y = charYawRef.current;
    scene.add(rig.root);
    charRigRef.current = rig;

    // ResizeObserver updates canvas + camera cleanly
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cw = Math.max(Math.round(entry.contentRect.width), 1);
        const ch = Math.max(Math.round(entry.contentRect.height), 1);
        renderer.setSize(cw, ch, false);
        camera.aspect = cw / ch;
        camera.updateProjectionMatrix();
      }
    });
    resizeObserver.observe(mount);

    // Pointer Orbit + Click-to-Interact (distinguish click <5px from drag)
    let isDragging = false;
    let dragDistance = 0;
    let lastX = 0;
    let lastY = 0;

    const canvasEl = renderer.domElement;
    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      dragDistance = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      canvasEl.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      dragDistance += Math.hypot(dx, dy);
      lastX = e.clientX;
      lastY = e.clientY;
      camYawRef.current -= dx * 0.0065;
      camPitchRef.current = THREE.MathUtils.clamp(
        camPitchRef.current + dy * 0.005,
        0.12,
        1.18
      );
      emitCameraChange();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      if (canvasEl.hasPointerCapture(e.pointerId)) {
        canvasEl.releasePointerCapture(e.pointerId);
      }
      if (dragDistance < 6 && worldRef.current) {
        const rect = canvasEl.getBoundingClientRect();
        scratchNdc.current.set(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycasterRef.current.setFromCamera(scratchNdc.current, camera);
        const hits = raycasterRef.current.intersectObjects(
          worldRef.current.raycastTargets,
          false
        );
        if (hits.length > 0) {
          const hitId = hits[0].object.userData.interactableId as
            | string
            | undefined;
          if (hitId) {
            const entry = worldRef.current.interactables.find(
              (o) => o.id === hitId
            );
            if (entry) {
              void triggerInteractionRef.current(entry);
            }
          }
        }
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camDistRef.current = THREE.MathUtils.clamp(
        camDistRef.current + e.deltaY * 0.006,
        4.2,
        15.5
      );
      emitCameraChange();
    };

    canvasEl.addEventListener("pointerdown", onPointerDown);
    canvasEl.addEventListener("pointermove", onPointerMove);
    canvasEl.addEventListener("pointerup", onPointerUp);
    canvasEl.addEventListener("wheel", onWheel, { passive: false });

    // Keyboard controls
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const code = e.code;
      if (
        code === "KeyW" ||
        code === "KeyA" ||
        code === "KeyS" ||
        code === "KeyD" ||
        code === "ArrowUp" ||
        code === "ArrowDown" ||
        code === "ArrowLeft" ||
        code === "ArrowRight" ||
        code === "Space"
      ) {
        e.preventDefault();
      }
      keysRef.current.add(code);

      if (code === "Space" && !e.repeat && isGroundedRef.current) {
        charVelYRef.current = 7.4;
        isGroundedRef.current = false;
        worldSfx.playJump();
      } else if (code === "KeyE" && !e.repeat) {
        const w = worldRef.current;
        const targetId = nearestObjIdRef.current ?? selectedObjIdRef.current;
        if (w && targetId) {
          const entry = w.interactables.find((o) => o.id === targetId);
          if (entry) {
            void triggerInteractionRef.current(entry);
          }
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    const onBlur = () => {
      keysRef.current.clear();
      touchMoveRef.current.forward = 0;
      touchMoveRef.current.right = 0;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    // Continuous render loop paced safely on SwiftShader/software GL vs RAF on hardware GPU
    let disposed = false;
    let rafId = 0;
    let cancelAfterDraw: (() => void) | null = null;
    let prevTime = performance.now();
    let elapsed = 0;

    const tick = () => {
      if (disposed) return;

      const now = performance.now();
      const dt = Math.min((now - prevTime) / 1000, 0.05);
      prevTime = now;
      elapsed += dt;

      const currentWorld = worldRef.current;
      const currentRig = charRigRef.current;

      if (currentWorld && currentRig) {
        // 1. Movement input relative to camera yaw
        const keys = keysRef.current;
        let moveF = touchMoveRef.current.forward;
        let moveR = touchMoveRef.current.right;
        if (keys.has("KeyW") || keys.has("ArrowUp")) moveF += 1;
        if (keys.has("KeyS") || keys.has("ArrowDown")) moveF -= 1;
        if (keys.has("KeyD") || keys.has("ArrowRight")) moveR += 1;
        if (keys.has("KeyA") || keys.has("ArrowLeft")) moveR -= 1;

        const isSprinting =
          keys.has("ShiftLeft") || keys.has("ShiftRight");
        const moveSpeed = isSprinting ? 8.8 : 5.4;

        scratchForward.current.set(
          -Math.sin(camYawRef.current),
          0,
          -Math.cos(camYawRef.current)
        );
        scratchRight.current.set(
          Math.cos(camYawRef.current),
          0,
          -Math.sin(camYawRef.current)
        );

        scratchMove.current
          .set(0, 0, 0)
          .addScaledVector(scratchForward.current, moveF)
          .addScaledVector(scratchRight.current, moveR);

        const moving = scratchMove.current.lengthSq() > 0.001;
        if (moving) {
          scratchMove.current.normalize();
          charPosRef.current.addScaledVector(
            scratchMove.current,
            moveSpeed * dt
          );

          // Smooth character facing toward velocity
          const desiredYaw = Math.atan2(
            scratchMove.current.x,
            scratchMove.current.z
          );
          let diff = desiredYaw - charYawRef.current;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          charYawRef.current += diff * Math.min(1, dt * 12);

          // Procedural walk cycle & footsteps
          const cadence = isSprinting ? 13 : 9.2;
          const swing = Math.sin(elapsed * cadence) * (isSprinting ? 0.72 : 0.52);
          currentRig.leftLeg.rotation.x = swing;
          currentRig.rightLeg.rotation.x = -swing;
          currentRig.leftArm.rotation.x = -swing * 0.78;
          currentRig.rightArm.rotation.x = swing * 0.78;
          currentRig.bodyPivot.position.y = Math.abs(Math.cos(elapsed * cadence)) * 0.055;

          if (isGroundedRef.current) {
            footstepTimerRef.current += dt;
            const stepInterval = isSprinting ? 0.25 : 0.36;
            if (footstepTimerRef.current >= stepInterval) {
              footstepTimerRef.current = 0;
              worldSfx.playFootstep();
            }
          }
        } else {
          // Smooth idle recovery + gentle breathing
          currentRig.leftLeg.rotation.x = THREE.MathUtils.damp(
            currentRig.leftLeg.rotation.x,
            0,
            10,
            dt
          );
          currentRig.rightLeg.rotation.x = THREE.MathUtils.damp(
            currentRig.rightLeg.rotation.x,
            0,
            10,
            dt
          );
          currentRig.leftArm.rotation.x = THREE.MathUtils.damp(
            currentRig.leftArm.rotation.x,
            0,
            10,
            dt
          );
          currentRig.rightArm.rotation.x = THREE.MathUtils.damp(
            currentRig.rightArm.rotation.x,
            0,
            10,
            dt
          );
          currentRig.bodyPivot.position.y = Math.sin(elapsed * 2.2) * 0.025;
        }

        // 2. Vertical Jump & Gravity
        if (!isGroundedRef.current || charVelYRef.current !== 0) {
          charPosRef.current.y += charVelYRef.current * dt;
          charVelYRef.current -= 20 * dt;
          if (charPosRef.current.y <= 0) {
            charPosRef.current.y = 0;
            charVelYRef.current = 0;
            isGroundedRef.current = true;
          }
        }

        // 3. Plaza perimeter clamping & obstacle push-out + nearest proximity search
        const distFromCenter = Math.hypot(
          charPosRef.current.x,
          charPosRef.current.z
        );
        const maxPlazaRadius = 21.4;
        if (distFromCenter > maxPlazaRadius) {
          const scale = maxPlazaRadius / distFromCenter;
          charPosRef.current.x *= scale;
          charPosRef.current.z *= scale;
        }

        let closestEntry: WorldObjectEntry | null = null;
        let closestDist = Infinity;

        for (const obj of currentWorld.interactables) {
          obj.update(dt, elapsed);

          const dx = charPosRef.current.x - obj.position.x;
          const dz = charPosRef.current.z - obj.position.z;
          const d = Math.hypot(dx, dz);
          const minSep = obj.collisionRadius + 0.42;
          if (d < minSep && d > 0.0001) {
            const push = (minSep - d) / d;
            charPosRef.current.x += dx * push;
            charPosRef.current.z += dz * push;
          }
          if (d <= obj.interactRadius && d < closestDist) {
            closestDist = d;
            closestEntry = obj;
          }
        }

        // Sync proximity selection ring & React HUD only when ID changes
        if (closestEntry) {
          currentWorld.selectionRing.visible = true;
          currentWorld.selectionRing.position.set(
            closestEntry.position.x,
            0.04,
            closestEntry.position.z
          );
          const ringScale = Math.max(0.85, closestEntry.collisionRadius * 1.15);
          currentWorld.selectionRing.scale.setScalar(
            ringScale + Math.sin(elapsed * 4) * 0.04
          );
          if (nearestObjIdRef.current !== closestEntry.id) {
            nearestObjIdRef.current = closestEntry.id;
            setNearestObject({
              id: closestEntry.id,
              name: closestEntry.name,
              kind: closestEntry.kind,
              status: closestEntry.statusLabel(),
              description: closestEntry.description,
            });
          }
        } else {
          currentWorld.selectionRing.visible = false;
          if (nearestObjIdRef.current !== null) {
            nearestObjIdRef.current = null;
            setNearestObject(null);
          }
        }

        // Update rain drops if visible
        if (currentWorld.rainPoints.visible) {
          const posAttr = currentWorld.rainPoints.geometry.getAttribute(
            "position"
          ) as THREE.BufferAttribute;
          const arr = posAttr.array as Float32Array;
          for (let i = 1; i < arr.length; i += 3) {
            arr[i] -= 16 * dt;
            if (arr[i] < 0) arr[i] = 18;
          }
          posAttr.needsUpdate = true;
        }

        // Apply character transform + height-responsive contact shadow
        currentRig.root.position.set(
          charPosRef.current.x,
          0,
          charPosRef.current.z
        );
        currentRig.bodyPivot.position.y += charPosRef.current.y;
        currentRig.root.rotation.y = charYawRef.current;
        const shadowFade = Math.max(0.18, 0.55 - charPosRef.current.y * 0.14);
        (currentRig.shadowPlane.material as THREE.MeshBasicMaterial).opacity =
          shadowFade;

        // 4. Smooth third-person orbit camera
        scratchCamTarget.current.set(
          charPosRef.current.x,
          charPosRef.current.y + 1.45,
          charPosRef.current.z
        );
        const horiz = Math.cos(camPitchRef.current) * camDistRef.current;
        const vert = Math.sin(camPitchRef.current) * camDistRef.current;
        scratchDesiredCam.current.set(
          scratchCamTarget.current.x + Math.sin(camYawRef.current) * horiz,
          scratchCamTarget.current.y + vert,
          scratchCamTarget.current.z + Math.cos(camYawRef.current) * horiz
        );
        camera.position.lerp(scratchDesiredCam.current, Math.min(1, dt * 10));
        camera.lookAt(scratchCamTarget.current);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        cancelAfterDraw = scheduleAfterDraw(gl, tick);
      } else {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      cancelAfterDraw?.();
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      canvasEl.removeEventListener("pointerdown", onPointerDown);
      canvasEl.removeEventListener("pointermove", onPointerMove);
      canvasEl.removeEventListener("pointerup", onPointerUp);
      canvasEl.removeEventListener("wheel", onWheel);
      onCanvasReadyRef.current?.(null);

      if (worldRef.current) {
        worldRef.current.dispose();
        worldRef.current = null;
      }
      if (charRigRef.current) {
        charRigRef.current.root.traverse((child) => {
          const mesh = child as THREE.Mesh;
          mesh.geometry?.dispose();
          if (mesh.material) {
            const mats = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material];
            for (const m of mats) {
              (m as THREE.MeshStandardMaterial).map?.dispose();
              m.dispose();
            }
          }
        });
        scene.remove(charRigRef.current.root);
        charRigRef.current = null;
      }

      envTarget.dispose();
      renderer.dispose();
      if (canvasEl.parentNode === mount) {
        mount.removeChild(canvasEl);
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  // 2. Rebuild World Theme & Character Rig cleanly whenever personaId or Gemini 4 low-poly blueprint changes
  const initialMountPersonaRef = useRef(true);
  useEffect(() => {
    if (initialMountPersonaRef.current) {
      initialMountPersonaRef.current = false;
      return;
    }
    const scene = sceneRef.current;
    if (!scene) return;

    if (worldRef.current) {
      worldRef.current.dispose();
      worldRef.current = null;
    }
    if (charRigRef.current) {
      charRigRef.current.root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          for (const m of mats) {
            (m as THREE.MeshStandardMaterial).map?.dispose();
            m.dispose();
          }
        }
      });
      scene.remove(charRigRef.current.root);
      charRigRef.current = null;
    }

    const built = buildInteractiveWorld(
      scene,
      personaId,
      maxAnisoRef.current,
      customSceneBlueprint
    );
    if (!customSceneBlueprint) {
      built.setAtmosphere(atmosphereRef.current);
    }
    worldRef.current = built;

    const rig = createCharacterRig(personaId);
    rig.root.position.copy(charPosRef.current);
    rig.root.rotation.y = charYawRef.current;
    scene.add(rig.root);
    charRigRef.current = rig;

    nearestObjIdRef.current = null;
    selectedObjIdRef.current = null;
    setNearestObject(null);
    setSelectedObject(null);
    setRainEnabled(Boolean(customSceneBlueprint?.palette.rain));

    if (customSceneBlueprint) {
      setReactionBanner(
        `Gemini 4 built "${customSceneBlueprint.sceneName}" (${customSceneBlueprint.objects.length} interactive low-poly props).`
      );
    } else {
      const theme = WORLD_THEMES[personaId] ?? WORLD_THEMES.none;
      setReactionBanner(`Entered ${theme.name}. Every object can be activated.`);
    }
  }, [personaId, customSceneBlueprint]);

  // 2b. Spawn new Gemini-4-constructed low-poly object right in front of the player character
  useEffect(() => {
    if (!spawnedObjectEvent?.object || !worldRef.current) return;
    const aheadX =
      charPosRef.current.x + Math.sin(charYawRef.current) * 3.4;
    const aheadZ =
      charPosRef.current.z + Math.cos(charYawRef.current) * 3.4;
    const clampedRadius = Math.hypot(aheadX, aheadZ);
    const scale = clampedRadius > 18 ? 18 / clampedRadius : 1;

    const placedBp: LowPolyObjectBlueprint = {
      ...spawnedObjectEvent.object,
      x: aheadX * scale,
      z: aheadZ * scale,
      rotationY: charYawRef.current + Math.PI,
    };

    const entry = worldRef.current.addObjectBlueprint(placedBp);
    worldSfx.playInteract("portal");
    selectedObjIdRef.current = entry.id;
    setSelectedObject({
      id: entry.id,
      name: entry.name,
      kind: entry.kind,
      status: entry.statusLabel(),
      description: entry.description,
    });
    setReactionBanner(
      `Gemini 4 constructed "${entry.name}" from ${placedBp.parts.length} low-poly primitives right in front of you!`
    );
  }, [spawnedObjectEvent]);

  // 3. Apply User Photo / Transformed Character Portrait onto Avatar Head Faceplate
  useEffect(() => {
    let active = true;
    const rig = charRigRef.current;
    if (!rig) return;

    void createAvatarFaceTexture(avatarImageUrl, personaId).then((tex) => {
      if (!active || !charRigRef.current) {
        tex.dispose();
        return;
      }
      const oldMap = charRigRef.current.faceMaterial.map;
      charRigRef.current.faceMaterial.map = tex;
      charRigRef.current.faceMaterial.needsUpdate = true;
      oldMap?.dispose();
    });

    return () => {
      active = false;
    };
  }, [avatarImageUrl, personaId]);

  // 4. Respond to mid-session voice / steering prompts from GenieWorldView
  useEffect(() => {
    if (!externalWorldEvent?.text) return;
    const lower = externalWorldEvent.text.toLowerCase();
    const world = worldRef.current;
    if (!world) return;

    if (lower.includes("rain") || lower.includes("storm")) {
      world.setRainEnabled(true);
      setRainEnabled(true);
      setReactionBanner("Steered World: Rain begins falling across the plaza.");
    } else if (
      lower.includes("torch") ||
      lower.includes("ignite") ||
      lower.includes("fire") ||
      lower.includes("brazier") ||
      lower.includes("lantern")
    ) {
      world.igniteAllBraziers();
      worldSfx.playInteract("brazier");
      setReactionBanner("Steered World: All courtyard torches & lanterns ignited.");
    } else if (
      lower.includes("dusk") ||
      lower.includes("sunset") ||
      lower.includes("evening")
    ) {
      applyAtmosphere("dusk");
      setReactionBanner("Steered World: Sky shifted to warm dusk.");
    } else if (
      lower.includes("night") ||
      lower.includes("star") ||
      lower.includes("dark")
    ) {
      applyAtmosphere("starlight");
      setReactionBanner("Steered World: Night stars illuminate the courtyard.");
    } else if (
      lower.includes("sun") ||
      lower.includes("day") ||
      lower.includes("clear")
    ) {
      world.setRainEnabled(false);
      setRainEnabled(false);
      applyAtmosphere("daylight");
      setReactionBanner("Steered World: Clear daylight breaks across the stone.");
    } else {
      // If user named a specific object or wants to interact, target selected or closest object
      const match =
        world.interactables.find((o) =>
          lower.includes(o.kind) || lower.includes(o.name.toLowerCase())
        ) ??
        world.interactables.find(
          (o) =>
            o.id === (nearestObjIdRef.current ?? selectedObjIdRef.current)
        );
      if (match) {
        void triggerInteractionRef.current(match, externalWorldEvent.text);
      } else {
        applyWorldEffect("shimmer");
        setReactionBanner(`Steered World: ${externalWorldEvent.text}`);
      }
    }
  }, [applyAtmosphere, applyWorldEffect, externalWorldEvent]);

  const handleCommandObjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = objectPrompt.trim();
    const world = worldRef.current;
    if (!cmd || !world) return;
    const targetId = nearestObjIdRef.current ?? selectedObjIdRef.current;
    const targetObj =
      world.interactables.find((o) => o.id === targetId) ??
      world.interactables[0];
    setObjectPrompt("");
    if (targetObj) {
      void triggerObjectInteraction(targetObj, cmd);
    }
  };

  // 5. Sync external slider camera controls into Three.js camera refs cleanly
  useEffect(() => {
    if (typeof cameraRotationDeg === "number" && Number.isFinite(cameraRotationDeg)) {
      camYawRef.current = (cameraRotationDeg * Math.PI) / 180;
    }
  }, [cameraRotationDeg]);

  useEffect(() => {
    if (typeof cameraPitchDeg === "number" && Number.isFinite(cameraPitchDeg)) {
      camPitchRef.current = THREE.MathUtils.clamp(
        (cameraPitchDeg * Math.PI) / 180,
        0.12,
        1.18
      );
    }
  }, [cameraPitchDeg]);

  useEffect(() => {
    if (typeof cameraZoom === "number" && Number.isFinite(cameraZoom)) {
      camDistRef.current = THREE.MathUtils.clamp(cameraZoom, 4.2, 15.5);
    }
  }, [cameraZoom]);

  const activeTarget = nearestObject ?? selectedObject;
  const themeInfo = WORLD_THEMES[personaId] ?? WORLD_THEMES.none;
  const activeSceneTitle = customSceneBlueprint?.sceneName ?? themeInfo.name;

  return (
    <div className="relative w-full aspect-video bg-[#07090E] overflow-hidden select-none">
      {/* Dedicated WebGL Mount Container (never shares DOM children with HUD) */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-Left World Banner & Proximity Prompt (leaves top-right clear for floating panel) */}
      <div className="pointer-events-none absolute top-3 left-3 flex flex-col items-start gap-2 max-w-[360px]">
        <div className="pointer-events-auto w-full bg-[#07090E]/90 border border-slate-700/80 rounded-md px-3 py-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-cyan-300 truncate">
              {activeSceneTitle}
            </span>
            <span className="font-mono text-[11px] text-slate-400 shrink-0">
              {interactedCount} interactions
            </span>
          </div>
          <div className="mt-1 flex items-start gap-1.5 text-slate-200 leading-snug">
            {isAiReacting ? (
              <Loader2 className="w-3.5 h-3.5 mt-0.5 shrink-0 animate-spin text-cyan-400" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-cyan-400" />
            )}
            <span>{reactionBanner}</span>
          </div>
        </div>

        {/* Proximity / Selected Object Action Prompt */}
        {activeTarget && (
          <button
            type="button"
            onClick={interactNearest}
            className="pointer-events-auto inline-flex items-center gap-2 px-3 py-2 bg-[#07090E]/90 hover:bg-[#111827] border border-cyan-500/60 rounded-md text-xs text-slate-100 cursor-pointer transition-colors"
          >
            <Hand className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>
              <span className="font-mono text-cyan-300 mr-1">[E]</span>
              <span className="font-medium">{activeTarget.name}</span>
              <span className="text-slate-400 ml-1.5">
                ({activeTarget.status})
              </span>
            </span>
          </button>
        )}
      </div>

      {/* Bottom Interactive Dock (collapsible so 3D viewport stays unobstructed) */}
      <div className="pointer-events-none absolute bottom-3 inset-x-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setControlsCollapsed((c) => !c)}
            className="pointer-events-auto inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-[#07090E]/90 hover:bg-[#111827] text-slate-300 border border-slate-700 rounded cursor-pointer"
          >
            {controlsCollapsed ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {controlsCollapsed ? "Show 3D Controls" : "Hide Controls"}
          </button>

          {!controlsCollapsed && activeTarget && (
            <form
              onSubmit={handleCommandObjectSubmit}
              className="pointer-events-auto flex items-center gap-1.5 flex-1 max-w-sm ml-auto"
            >
              <input
                type="text"
                value={objectPrompt}
                onChange={(e) => setObjectPrompt(e.target.value)}
                placeholder={`Action for ${activeTarget.name}...`}
                className="flex-1 min-w-0 px-2.5 py-1 text-xs bg-[#07090E]/90 text-slate-100 placeholder:text-slate-500 border border-slate-700 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500"
              />
              <button
                type="submit"
                disabled={!objectPrompt.trim() || isAiReacting}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded cursor-pointer disabled:opacity-40"
              >
                <Send className="w-3 h-3" />
                Act
              </button>
            </form>
          )}
        </div>

        {!controlsCollapsed && (
          <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#07090E]/90 border border-slate-800 rounded-md">
            {/* Movement & Jump Touch Pad */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Move Left"
                onPointerDown={() => (touchMoveRef.current.right = -1)}
                onPointerUp={() => (touchMoveRef.current.right = 0)}
                onPointerLeave={() => (touchMoveRef.current.right = 0)}
                className="p-1.5 bg-[#111827] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Move Forward"
                onPointerDown={() => (touchMoveRef.current.forward = 1)}
                onPointerUp={() => (touchMoveRef.current.forward = 0)}
                onPointerLeave={() => (touchMoveRef.current.forward = 0)}
                className="p-1.5 bg-[#111827] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Move Backward"
                onPointerDown={() => (touchMoveRef.current.forward = -1)}
                onPointerUp={() => (touchMoveRef.current.forward = 0)}
                onPointerLeave={() => (touchMoveRef.current.forward = 0)}
                className="p-1.5 bg-[#111827] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded cursor-pointer"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Move Right"
                onPointerDown={() => (touchMoveRef.current.right = 1)}
                onPointerUp={() => (touchMoveRef.current.right = 0)}
                onPointerLeave={() => (touchMoveRef.current.right = 0)}
                className="p-1.5 bg-[#111827] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={triggerJump}
                className="ml-1 px-2.5 py-1 text-[11px] font-medium bg-[#111827] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded cursor-pointer"
              >
                Jump
              </button>
              <button
                type="button"
                disabled={!activeTarget}
                onClick={interactNearest}
                className="px-2.5 py-1 text-[11px] font-medium bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 rounded cursor-pointer disabled:opacity-40"
              >
                Interact [E]
              </button>
            </div>

            {/* World Atmosphere & Quick Effects */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const next: WorldAtmosphere =
                    atmosphere === "daylight"
                      ? "dusk"
                      : atmosphere === "dusk"
                        ? "starlight"
                        : "daylight";
                  applyAtmosphere(next);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[#111827] hover:bg-slate-800 text-slate-200 border border-slate-700 rounded cursor-pointer"
              >
                <Sun className="w-3 h-3 text-amber-400" />
                {atmosphere === "daylight"
                  ? "Day"
                  : atmosphere === "dusk"
                    ? "Dusk"
                    : "Night"}
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !rainEnabled;
                  setRainEnabled(next);
                  worldRef.current?.setRainEnabled(next);
                }}
                className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] border rounded cursor-pointer ${
                  rainEnabled
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                    : "bg-[#111827] hover:bg-slate-800 border-slate-700 text-slate-200"
                }`}
              >
                <CloudRain className="w-3 h-3" />
                Rain
              </button>

              <button
                type="button"
                onClick={() => {
                  worldRef.current?.igniteAllBraziers();
                  worldSfx.playInteract("brazier");
                  setReactionBanner("Ignited every brazier and lantern in the plaza.");
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[#111827] hover:bg-slate-800 text-amber-300 border border-slate-700 rounded cursor-pointer"
              >
                <Flame className="w-3 h-3" />
                Ignite All
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !sfxMuted;
                  worldSfx.muted = next;
                  setSfxMuted(next);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[#111827] hover:bg-slate-800 text-slate-300 border border-slate-700 rounded cursor-pointer"
                title={sfxMuted ? "Unmute 3D Sound Effects" : "Mute 3D Sound Effects"}
              >
                {sfxMuted ? (
                  <VolumeX className="w-3 h-3 text-slate-400" />
                ) : (
                  <Volume2 className="w-3 h-3 text-cyan-400" />
                )}
                SFX
              </button>

              <button
                type="button"
                onClick={resetPosition}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-[#111827] hover:bg-slate-800 text-slate-300 border border-slate-700 rounded cursor-pointer"
                title="Reset character position"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
