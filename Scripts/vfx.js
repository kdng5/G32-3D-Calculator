import * as THREE from "three";
import {camera, renderer, scene} from "./main";
import {RenderPass} from "three/addons/postprocessing/RenderPass";
import {UnrealBloomPass} from "three/addons/postprocessing/UnrealBloomPass";
import {OutputPass} from "three/addons";
import {EffectComposer} from "three/addons/postprocessing/EffectComposer";

let composer;

export function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.15,
        0.25,
        0.95
    );
    const outputPass = new OutputPass();

    composer = new EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(outputPass);

    window.addEventListener('resize', () => {
        composer.setSize(window.innerWidth, window.innerHeight);
    });
}

export function renderWithComposer() {
    if (composer) {
        composer.render();
    }
}