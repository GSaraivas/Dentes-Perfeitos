import { assetUrl } from './assets.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gsap } from 'gsap';

function createView(element, environment) {
  const implant = element.dataset.scene === 'implant';
  const scene = new THREE.Scene();
  scene.environment = environment;
  scene.environmentIntensity = implant ? 1.32 : 1.05;
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 40);
  camera.position.set(0, .2, 6.7);
  camera.lookAt(0, 0, 0);
  const object = new THREE.Group();
  scene.add(object);
  const key = new THREE.DirectionalLight('#ffe2bb', implant ? 3 : 2.3);
  key.position.set(-3, 4, 5);
  const fill = new THREE.DirectionalLight('#f7f0ed', 2.2);
  fill.position.set(4, 1, -3);
  scene.add(key, fill, new THREE.HemisphereLight('#fff7e7', '#7d6856', 1.0));
  return { element, scene, camera, object, implant, ready: false, visible: false, pointer: { x: 0, y: 0, angle: 0 }, key };
}

function addImplant(object) {
  const metal = new THREE.MeshPhysicalMaterial({ color: '#cab6a1', metalness: .92, roughness: .24, clearcoat: .3 });
  const lightMetal = new THREE.MeshPhysicalMaterial({ color: '#f1dfc8', metalness: .87, roughness: .19 });
  function cylinder(top, bottom, height, y, material) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 64), material);
    mesh.position.y = y;
    object.add(mesh);
  }
  cylinder(.33, .23, .99, -.88, metal);
  cylinder(.40, .34, .25, -.30, lightMetal);
  cylinder(.26, .33, .08, -.13, metal);
  cylinder(.16, .22, .26, .15, lightMetal);
  cylinder(.11, .12, .17, .34, metal);
  const thread = new class extends THREE.Curve {
    getPoint(t, target = new THREE.Vector3()) {
      const angle = t * Math.PI * 2 * 8;
      const radius = .245 + .086 * t;
      return target.set(Math.cos(angle) * radius, -1.34 + t * .92, Math.sin(angle) * radius);
    }
  }();
  object.add(new THREE.Mesh(new THREE.TubeGeometry(thread, 210, .031, 8, false), lightMetal));
}

function bindDrag(view, signal) {
  const { element, pointer } = view;
  let drag;
  element.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !view.ready) return;
    drag = { id: event.pointerId, x: event.clientX };
    element.setPointerCapture(event.pointerId);
  }, { signal });
  element.addEventListener('pointermove', (event) => {
    const box = element.getBoundingClientRect();
    pointer.x = (event.clientX - box.left) / box.width - .5;
    pointer.y = (event.clientY - box.top) / box.height - .5;
    if (drag?.id !== event.pointerId) return;
    pointer.angle += (event.clientX - drag.x) * .012;
    drag.x = event.clientX;
  }, { signal });
  element.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; }, { signal });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    element.addEventListener(type, () => { drag = null; }, { signal });
  }
}

export async function initScenes(state) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .05, .1, 100, { size: 128 });
  room.dispose();
  pmrem.dispose();
  const stage = document.createElement('div');
  stage.className = 'scene-stage';
  stage.setAttribute('aria-hidden', 'true');
  stage.append(renderer.domElement);
  const views = [...document.querySelectorAll('[data-scene]')].map((element) => createView(element, environment.texture));
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const { signal } = controller;
  let disposed = false;
  let activeView;
  let width = 0, height = 0, pixelRatio = 0;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { views.find(({ element }) => element === entry.target).visible = entry.isIntersecting; });
  });
  const material = new THREE.MeshPhysicalMaterial({
    color: '#fff2dc', roughness: .25, metalness: .02, clearcoat: .39,
    clearcoatRoughness: .22, iridescence: .1, iridescenceIOR: 1.32,
    sheen: .16, sheenColor: '#f1d8b7', sheenRoughness: .72
  });
  const disposeModel = (root) => {
    const materials = new Set();
    root.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry.dispose();
      materials.add(node.material);
    });
    materials.forEach((item) => item.dispose());
  };
  function teardown() {
    if (disposed) return;
    disposed = true;
    controller.abort();
    gsap.ticker.remove(tick);
    observer.disconnect();
    stage.remove();
    views.forEach(({ scene, element }) => {
      element.classList.remove('scene-ready');
      const hint = element.querySelector('[data-scene-hint]');
      if (hint) hint.textContent = 'ESTUDO ANATÔMICO';
      disposeModel(scene);
    });
    environment.dispose();
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
  function tick(time, delta) {
    if (document.hidden) return;
    const view = views.find(({ ready, visible }) => ready && visible);
    if (!view) return;
    if (view !== activeView) {
      if (activeView) activeView.element.classList.remove('scene-ready');
      view.element.append(stage);
      activeView = view;
    }
    const { element, camera, scene, object, implant, pointer, key } = view;
    const w = element.clientWidth;
    const h = element.clientHeight;
    if (!w || !h) return;
    const ratio = Math.min(devicePixelRatio, innerWidth < 768 ? 1.3 : 1.6, Math.sqrt(940000 / (w * h)));
    if (w !== width || h !== height || ratio !== pixelRatio) {
      width = w; height = h; pixelRatio = ratio;
      renderer.setPixelRatio(ratio);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const p = implant ? state.tech.progress : state.hero.progress;
    const entry = Math.min(1, (time - view.started) / .85);
    const eased = 1 - (1 - entry) ** 3;
    const blend = 1 - Math.exp(-Math.min(delta, 40) * .008);
    const targetY = implant ? -.23 + p * 3.8 : -.22 + time * .18 + pointer.angle + pointer.x * .5 + p * .79;
    object.rotation.y += (targetY - object.rotation.y) * blend;
    object.rotation.x = implant ? .14 - p * .28 : .13 + pointer.y * .16;
    object.rotation.z = implant ? -.31 : -.15 + (1 - eased) * .26;
    object.position.y = (1 - eased) * -.27 + Math.sin(time * 1.25) * .048;
    object.position.x = implant ? 0 : p * .47;
    object.scale.setScalar((.73 + eased * .27) * (implant ? 1 : 1 - .26 * p));
    camera.position.z = (camera.aspect < .93 ? 7.05 : 6.7) - (implant ? .52 : .60) * p;
    key.position.x = -3 + Math.cos(object.rotation.y) * .48;
    renderer.render(scene, camera);
    element.classList.add('scene-ready');
  }

  renderer.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); teardown(); }, { signal });
  motion.addEventListener('change', (event) => { if (event.matches) teardown(); }, { signal });
  window.addEventListener('pagehide', (event) => { if (!event.persisted) teardown(); }, { signal });
  views.forEach((view) => observer.observe(view.element));
  try {
    const gltf = await new GLTFLoader().loadAsync(assetUrl('molar.glb'));
    if (disposed) { disposeModel(gltf.scene); return; }
    const tooth = gltf.scene.children[0];
    tooth.material.dispose();
    tooth.material = material;
    const [hero, tech] = views;
    hero.object.add(tooth);
    // The implant illustration uses a crown-only mesh supplied separately.
    const crownModel = await new GLTFLoader().loadAsync(assetUrl('coroa.glb')).catch(() => null);
    if (disposed) { if (crownModel) disposeModel(crownModel.scene); return; }
    if (crownModel) {
      const ceramic = crownModel.scene.children[0];
      ceramic.material.dispose();
      ceramic.material = material;
      ceramic.scale.setScalar(.64);
      ceramic.position.y = .62;
      tech.object.add(ceramic);
      addImplant(tech.object);
      tech.ready = true;
    }
    hero.ready = true;
    hero.element.querySelector('[data-scene-hint]').textContent = 'ARRASTE PARA GIRAR';
    views.forEach((view) => { view.started = gsap.ticker.time; });
    bindDrag(hero, signal);
    gsap.ticker.add(tick);
  } catch {
    teardown();
  }
}