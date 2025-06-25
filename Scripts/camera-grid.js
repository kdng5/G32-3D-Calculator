import * as THREE from "three";
import { Pane } from 'tweakpane';
import {camera, orbitControls} from "./main";

let graphGroup = null;
let xArrow, yArrow, zArrow;
let zLine;
let labelSprites = {};
const BASE_AXES_SIZE = 3.5;
const LABEL_DISTANCE_FACTOR = 1.2;

const VIEW_PRESETS = {
    top: { position: { x: 0, y: 20, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    bottom: { position: { x: 0, y: -20, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    left: { position: { x: -20, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    right: { position: { x: 20, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } },
    front: { position: { x: 0, y: 0, z: 20 }, target: { x: 0, y: 0, z: 0 } },
    back: { position: { x: 0, y: 0, z: -20 }, target: { x: 0, y: 0, z: 0 } },
    default: { position: { x: 10, y: 10, z: 10 }, target: { x: 0, y: 0, z: 0 } }
};

function initViewControls(camera, orbitControls) {
    const pane = new Pane({
        title: 'Camera Views',
        expanded: true
    });

    pane.addButton({ title: 'Top View' }).on('click', () => setCameraView('top', camera, orbitControls));
    pane.addButton({ title: 'Bottom View' }).on('click', () => setCameraView('bottom', camera, orbitControls));
    pane.addButton({ title: 'Left View' }).on('click', () => setCameraView('left', camera, orbitControls));
    pane.addButton({ title: 'Right View' }).on('click', () => setCameraView('right', camera, orbitControls));
    pane.addButton({ title: 'Front View' }).on('click', () => setCameraView('front', camera, orbitControls));
    pane.addButton({ title: 'Back View' }).on('click', () => setCameraView('back', camera, orbitControls));
    pane.addButton({ title: 'Reset' }).on('click', () => setCameraView('default', camera, orbitControls));

    pane.element.style.position = 'absolute';
    pane.element.style.top = '20px';
    pane.element.style.right = '20px';
    pane.element.style.zIndex = '1000';
    pane.element.style.width = '300px';
}

function setCameraView(viewName) {
    const preset = VIEW_PRESETS[viewName];
    camera.position.copy(new THREE.Vector3(preset.position.x, preset.position.y, preset.position.z));
    orbitControls.target.copy(new THREE.Vector3(preset.target.x, preset.target.y, preset.target.z));
    orbitControls.update();
}

export function graphInit(scene, camera, orbitControls) {
    if (graphGroup) scene.remove(graphGroup);

    graphGroup = new THREE.Group();
    labelSprites = {};

    const axesSize = 3.5;
    const labelDistance = axesSize * 1.2;
    const labelSize = 1.5;

    xArrow = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0, 0),
        axesSize, 0xff0000, 0.7, 0.4
    );
    xArrow.userData.direction = new THREE.Vector3(1, 0, 0);
    xArrow.userData.baseLength = axesSize;
    labelSprites.x = addAxisLabel('X', 0xff0000, new THREE.Vector3(labelDistance, 0, 0), labelSize);

    yArrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 0),
        axesSize, 0x00ff00, 0.7, 0.4
    );
    yArrow.userData.direction = new THREE.Vector3(0, 1, 0);
    yArrow.userData.baseLength = axesSize;
    labelSprites.y = addAxisLabel('Y', 0x0000ff, new THREE.Vector3(0, 0, labelDistance * -1), labelSize);

    zArrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(0, 0, 0),
        axesSize, 0x0000ff, 0.7, 0.4
    );
    zArrow.userData.direction = new THREE.Vector3(0, 0, -1);
    zArrow.userData.baseLength = axesSize;
    labelSprites.z = addAxisLabel('Z', 0x00ff00, new THREE.Vector3(0, labelDistance, 0), labelSize);

    const shaftRadius = 0.05;
    const ShaftHeight = 40;
    const shaftGeometry = new THREE.CylinderGeometry(shaftRadius, shaftRadius, ShaftHeight, 16);
    const shaftMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    zLine = new THREE.Mesh(shaftGeometry, shaftMaterial);
    zLine.position.set(0, 0.5, 0);

    graphGroup.add(zLine);
    graphGroup.add(xArrow, yArrow, zArrow);
    graphGroup.add(new THREE.GridHelper(50, 50));
    orbitControls.addEventListener('change', updateArrowScale);

    scene.add(graphGroup);
    initViewControls(camera, orbitControls);
}

function addAxisLabel(text, color, position, size) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    context.fillStyle = 'rgba(0, 0, 0, 0)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.font = 'Bold 40px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.fillText(text, canvas.width/2, canvas.height/2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
    });

    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(size, size/2, 1);
    sprite.userData.originalSize = size;
    graphGroup.add(sprite);
    return sprite;
}

function updateArrowScale() {
    const distance = orbitControls.getDistance();
    const scale = THREE.MathUtils.clamp(distance * 0.4, 0.5, 18);


    if (xArrow && yArrow && zArrow) {
        xArrow.setLength(scale, scale * 0.2, scale * 0.1);
        yArrow.setLength(scale, scale * 0.2, scale * 0.1);
        zArrow.setLength(scale, scale * 0.2, scale * 0.1);

        const scaleRatio = scale / BASE_AXES_SIZE;

        labelSprites.x.position.copy(
            xArrow.userData.direction.clone()
                .multiplyScalar(xArrow.userData.baseLength * LABEL_DISTANCE_FACTOR * scaleRatio)
        );

        labelSprites.y.position.copy(
            zArrow.userData.direction.clone()
                .multiplyScalar(yArrow.userData.baseLength * LABEL_DISTANCE_FACTOR * scaleRatio)
        );

        labelSprites.z.position.copy(
            yArrow.userData.direction.clone()
                .multiplyScalar(zArrow.userData.baseLength * LABEL_DISTANCE_FACTOR * scaleRatio)
        );
    }

    const labelScale = scale / 3.5;
    Object.values(labelSprites).forEach(sprite => {
        if (sprite) {
            const originalSize = sprite.userData.originalSize;
            sprite.scale.set(
                originalSize * labelScale,
                (originalSize/2) * labelScale,
                1
            );
        }
    })
}

export function top() { setCameraView('top'); }
export function bottom() { setCameraView('bottom'); }
export function left() { setCameraView('left'); }
export function right() { setCameraView('right'); }
export function front() { setCameraView('front'); }
export function back() { setCameraView('back'); }
