import * as THREE from "three";

const loader = new THREE.BufferGeometryLoader();
const placeholderMaterial = new THREE.MeshBasicMaterial();

export function renderInfiniteSolutions(meshA, meshB, operation, timeout)
{
    return new Promise((resolve, reject) =>
    {
        const worker = new Worker(
            new URL('./evaluator-worker.js', import.meta.url),
            {type: 'module'}
        );

        const timer = setTimeout(() =>
        {
            worker.terminate();
            reject(new Error('Intersection calculation exceeded time limit'));
        },
            timeout * 1000
        );

        worker.onmessage = (e) =>
        {
            clearTimeout(timer);
            if (e.data.success)
            {
                const geometry = loader.parse(e.data.geometry);
                resolve(new THREE.Mesh(geometry, placeholderMaterial));
            }
            else
                reject(new Error(e.data.error));
        };

        const geometryAData = meshA.geometry.toJSON();
        const geometryBData = meshB.geometry.toJSON();

        worker.postMessage({
            geometryAData,
            geometryBData,
            operation,
        });
    });
}