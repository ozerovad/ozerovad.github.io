import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* Blender exports Y-up glTF. A source image pixel maps to:
   x = (pixelX - 530) / 10, z = (pixelY - 317) / 10.
   Camera up points along +X so the long lake runs vertically, like the brief. */
export function imageToWorld(pixel, height = 0.65) {
  return new THREE.Vector3(
    (pixel[0] - 530) / 10,
    height,
    (pixel[1] - 317) / 10,
  );
}

export function createLakeScene(container, onProgress) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#8d9770");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);

  const camera = new THREE.OrthographicCamera(-32, 32, 20, -20, 0.1, 400);
  camera.up.set(1, 0, 0);
  scene.add(new THREE.HemisphereLight("#f6f5dd", "#556442", 1.55));
  const sunlight = new THREE.DirectionalLight("#fff4d8", 1.8);
  sunlight.position.set(-20, 65, 18);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, {
    left: -65,
    right: 65,
    top: 65,
    bottom: -65,
    near: 1,
    far: 160,
  });
  sunlight.shadow.bias = -0.0005;
  sunlight.shadow.normalBias = 0.08;
  scene.add(sunlight);
  let model;
  const waterMaterials = [];

  function resize() {
    renderer.setSize(container.clientWidth, container.clientHeight);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  const ready = new GLTFLoader()
    .loadAsync("./assets/lake.glb", (event) => {
      if (event.total)
        onProgress(Math.round((event.loaded / event.total) * 100));
    })
    .then((gltf) => {
      model = gltf.scene;
      model.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => {
          if (material.name.includes("blue water")) {
            material.color.set("#396974");
            material.roughness = 0.48;
            material.metalness = 0.05;
            waterMaterials.push(material);
          }
        });
      });
      scene.add(model);
      return model;
    });

  function render(view, time) {
    const aspect = container.clientWidth / container.clientHeight;
    const width = view.overview
      ? Math.max(70, 112 * aspect)
      : Math.min(aspect < 0.8 ? 34 : 64, 56 * aspect);
    const height = width / aspect;
    camera.left = -width / 2;
    camera.right = width / 2;
    camera.top = height / 2;
    camera.bottom = -height / 2;
    camera.updateProjectionMatrix();
    const x = view.overview ? 0 : view.x;
    const z = view.overview ? 0 : view.z;
    // A tiny oblique angle lets the subtle ground elevation and trees read as 3D.
    camera.position.set(x - 7, 110, z + 5);
    camera.lookAt(x, 0, z);
    camera.updateMatrixWorld();
    // Gentle color modulation is decorative, not a physical water simulation.
    waterMaterials.forEach((material) => {
      material.emissive.set("#16343b");
      material.emissiveIntensity = 0.045 + 0.015 * Math.sin(time * 0.35);
    });
    renderer.render(scene, camera);
  }

  function project(worldPosition) {
    const p = worldPosition.clone().project(camera);
    return {
      x: (p.x * 0.5 + 0.5) * container.clientWidth,
      y: (-0.5 * p.y + 0.5) * container.clientHeight,
      visible:
        p.z >= -1 && p.z <= 1 && Math.abs(p.x) < 0.96 && Math.abs(p.y) < 0.94,
    };
  }
  return {
    ready,
    render,
    project,
    container,
    renderer,
    dispose() {
      observer.disconnect();
      renderer.dispose();
    },
  };
}
