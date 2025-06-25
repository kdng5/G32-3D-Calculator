import {currentDistance, domainRestrictionsEnabled, equations, NO_DOMAIN_PARAMS, quality} from "./equations-list";
import {compile} from "mathjs";
import * as THREE from "three";
import {Brush, Evaluator, SUBTRACTION} from "three-bvh-csg";
import {scene} from "./main";
import {isExpressionEmpty, RGBTo01RGB} from "./utils";
import nerdamer from "nerdamer";

const geometryPool = [];
const materialPool = new Map();
const evaluator = new Evaluator();

export function renderGraph(expression, domainRestriction, material, meshes = [], error, show = true)
{
    if(isExpressionEmpty(expression)) return meshes;

    const restrictions = domainRestrictionsEnabled ? domainRestriction : NO_DOMAIN_PARAMS;
    if(meshes.length !== 0) deleteMesh(meshes);
    if(error !== '') error.innerHTML = '';

    try
    {
        const expressions = expression.expression;
        expressions.forEach(eq => render(eq));
        return meshes;
    }
    catch(e)
    {
        if(error === '')
            return `Error while graphing ${expression.expression}<br>${e.message}`;

        error.innerHTML = e.message;
        error.style.display = 'block';
        return [];
    }

    function render(eq)
    {
        const {xRange, yRange, xSteps, ySteps,
            minX, minY, minZ, maxZ} = getGraphVars(restrictions);

        const solvedFor = expression.solvedFor;
        const solved = nerdamer(eq).solveFor(solvedFor).toString();
        if(solved.includes(',')) renderDiscretePoints(solved, material);
        else
        {
            const compiled = compile(solved);
            //#region Create Vertices and Faces
            const totalVertices = (xSteps + 1) * (ySteps + 1);
            const vertices = new Float32Array(totalVertices * 3);
            let vertexIndex = 0;
            const validIndices = new Set();

            for(let i = 0; i <= xSteps; i++)
            {
                const x = minX + (i * xRange / xSteps);
                for(let j = 0; j <= ySteps; j++)
                {
                    let y = minY + (j * yRange / ySteps);
                    let z = compiled.evaluate({x, y});
                    const currentIndex = i * (ySteps + 1) + j;

                    if(isFinite(z) && !isNaN(z) && z <= maxZ && z >= minZ)
                    {
                        if (solvedFor === 'z')
                        {
                            vertices[vertexIndex] = x;
                            vertices[vertexIndex + 1] = z;
                            vertices[vertexIndex + 2] = -y;
                        }
                        else if (solvedFor === 'y')
                        {
                            vertices[vertexIndex] = x;
                            vertices[vertexIndex + 1] = y;
                            vertices[vertexIndex + 2] = -z;
                        }
                        else
                        {
                            vertices[vertexIndex] = z;
                            vertices[vertexIndex + 1] = x;
                            vertices[vertexIndex + 2] = -y;
                        }
                        validIndices.add(currentIndex);
                    }

                    vertexIndex += 3;
                }
            }

            const indices = [];
            for(let i = 0; i < xSteps; i++)
            {
                for(let j = 0; j < ySteps; j++)
                {
                    const a = i * (ySteps + 1) + j;
                    const b = (i + 1) * (ySteps + 1) + j;
                    const c = (i + 1) * (ySteps + 1) + (j + 1);
                    const d = i * (ySteps + 1) + (j + 1);
                    if(validIndices.has(a) && validIndices.has(b) && validIndices.has(c) && validIndices.has(d))
                        indices.push(a, b, d, b, c, d);
                }
            }
            //#endregion

            //#region Create Mesh
            const geometry = getPooledGeometry();
            geometry.setIndex(indices);
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([]), 1))
            geometry.computeVertexNormals();

            finalizeMesh(new Brush(geometry, material));
            //#endregion
        }
    }

    function renderDiscretePoints(points, solvedFor)
    {
        points.split(',').forEach(point =>
        {
            const mesh = new Brush(new THREE.SphereGeometry(1), material);
            switch(solvedFor)
            {
                case 'x': mesh.position.setX(point); break;
                case 'y': mesh.position.setY(point); break;
                case 'z': mesh.position.setZ(point); break;
            }
            mesh.scale.setScalar(currentDistance / 20);
            finalizeMesh(mesh);
        })
    }

    function finalizeMesh(mesh)
    {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        meshes.push(mesh);
        mesh.visible = show;
        scene.add(mesh);
    }
}

export function renderDefiniteIntegral(expression, index, limits, material, meshes = [], show = true)
{
    for(let i = 0; i < expression.expression.length; i++)
    {
        let mesh = new Brush(
            new THREE.BoxGeometry(limits.To - limits.From, currentDistance),
            material
        );

        const originalMesh = equations[index].equationGraph.mesh[i];
        mesh.position.copy(originalMesh.position);
        mesh.position.setX((limits.From + limits.To) / 2);

        mesh = evaluator.evaluate(mesh, originalMesh, SUBTRACTION);
        mesh.visible = show;
        meshes.push(mesh);
        scene.add(mesh);
    }

    return meshes;
}

//#region Helpers
export function getGraphMeshes(equations)
{
    return equations.map(eq => eq.equationGraph.mesh).flat(Infinity);
}

export function getGraphVars(restrictions)
{
    const minX = restrictions.x.x; const maxX = restrictions.x.y;
    const minY = restrictions.y.x; const maxY = restrictions.y.y;
    const minZ = restrictions.z.x; const maxZ = restrictions.z.y;
    const xRange = maxX - minX; const yRange = maxY - minY;

    const step = Math.min(xRange, yRange) / quality.value;
    const xSteps = Math.ceil(xRange / step);
    const ySteps = Math.ceil(yRange / step);

    return {xRange, yRange, xSteps, ySteps, minX, minY, minZ, maxZ};
}

export function deleteMesh(meshes)
{
    meshes.forEach(mesh =>
    {
        if(mesh.geometry) returnGeometryToPool(mesh.geometry);
        scene.remove(mesh);
    })
    meshes.length = 0;
}
//#endregion

//#region Pooling
function getPooledGeometry()
{
    return geometryPool.pop() || new THREE.BufferGeometry();
}

function returnGeometryToPool(geometry)
{
    geometry.setIndex(null);
    geometry.deleteAttribute('position');
    geometry.deleteAttribute('normal');
    geometryPool.push(geometry);
}

export function getCachedMaterial(color)
{
    const key = `${color.r}, ${color.g}, ${color.b}, ${color.a}`;
    if (!materialPool.has(key))
    {
        const material = new THREE.MeshPhongMaterial(
            {
                color: RGBTo01RGB(color),
                transparent: true,
                opacity: color.a,
                side: THREE.DoubleSide,
                shininess: 100
            }
        );
        materialPool.set(key, material);
    }
    return materialPool.get(key);
}
//#endregion