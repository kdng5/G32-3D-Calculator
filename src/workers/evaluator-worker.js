import {BufferGeometryLoader} from "three";
import * as THREE from "three";
import {Brush, Evaluator} from "three-bvh-csg";

const evaluator = new Evaluator();
const loader = new BufferGeometryLoader();
const placeholderMaterial = new THREE.MeshBasicMaterial();

self.onmessage = async function (e)
{
    const { geometryAData, geometryBData, operation } = e.data;

    try
    {
        const geomA = loader.parse(geometryAData);
        const geomB = loader.parse(geometryBData);
        const mA = new Brush(geomA, placeholderMaterial);
        const mB = new Brush(geomB, placeholderMaterial);

        const resultMesh = evaluator.evaluate(mA, mB, operation);
        const resultData = resultMesh.geometry.toJSON();
        self.postMessage({ success: true, geometry: resultData });
    }
    catch (err)
    {
        self.postMessage({ success: false, error: err.message || err.toString() });
    }
};