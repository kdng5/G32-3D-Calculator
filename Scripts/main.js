import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {graphInit} from "./camera-grid";
import { exportImportInit} from "./import-export";
import {equationsListInit} from "./equations-list";
import {updateTime} from "./shaders";
import {initUtils} from "./utils";
import {renderWithComposer, setupLighting} from "./vfx";

//#region Scene Setup
export const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
document.body.appendChild( renderer.domElement );

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xFFFFFF);

export const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.01, 1000 );
camera.position.set(5, 5, 5);
camera.lookAt(0, 0, 0);

setupLighting();

export const orbitControls = new OrbitControls( camera, renderer.domElement );

window.addEventListener( 'resize', () =>
{
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width/height;
    camera.updateProjectionMatrix();
    renderer.setSize(width,height);
})
//#endregion

initUtils();
graphInit(scene, camera, orbitControls);
equationsListInit();
exportImportInit();

function animate(time)
{
    updateTime(time);
    orbitControls.update();
    renderWithComposer();
}
