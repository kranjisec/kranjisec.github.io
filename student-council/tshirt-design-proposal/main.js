// main.js

const container = document.getElementById('tshirt-viewer');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5f6f8);

const camera = new THREE.PerspectiveCamera(28, container.offsetWidth/container.offsetHeight, 0.1, 100);
camera.position.set(0, 1.2, 3);

const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.offsetWidth, container.offsetHeight);
container.appendChild(renderer.domElement);

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 1.15);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight(0xffffff, 0.7);
keyLight.position.set(2, 3, 3);
scene.add(keyLight);

// --- ONLY WORKS if SCRIPT ORDER IN HTML IS CORRECT! ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.maxPolarAngle = Math.PI / 1.8;

let shirtMesh;

// Texture loader
const textureLoader = new THREE.TextureLoader();
const frontTexture = textureLoader.load('assets/Depan.png', undefined, undefined, handleTextureError);
const backTexture = textureLoader.load('assets/Belakang.png', undefined, undefined, handleTextureError);

// Red color hex for shirt body
const redColor = 0xcd2525;

const loader = new THREE.GLTFLoader();
loader.load('assets/polo.glb', function(gltf) {
    shirtMesh = gltf.scene;

    shirtMesh.traverse(child => {
        if (child.isMesh) {
            // TO DEBUG: If model doesn't show textures, log the child.name here
            // console.log(child.name);

            // If naming doesn't match, apply frontTexture as fallback
            if (child.name.toLowerCase().includes('front')) {
                child.material.map = frontTexture;
            } else if (child.name.toLowerCase().includes('back')) {
                child.material.map = backTexture;
            } else {
                child.material.map = frontTexture; // fallback
            }
            child.material.color.setHex(redColor);
            child.material.map.encoding = THREE.sRGBEncoding;
            child.material.needsUpdate = true;
        }
    });

    shirtMesh.scale.set(1.8, 1.8, 1.8);
    scene.add(shirtMesh);
}, undefined, function(error) {
    alert("Failed to load 3D model. Check the console (F12) for details and check your file paths!");
    console.error("Model Load Error:", error);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Responsive
window.addEventListener('resize', () => {
    const w = container.offsetWidth, h = container.offsetHeight;
    camera.aspect = w/h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
});

// Extra: error handler for missing images
function handleTextureError(err) {
  alert("Texture image not found. Check your assets folder and spelling!");
  console.error("Texture load error:", err);
}
