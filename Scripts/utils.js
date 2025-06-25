import * as THREE from "three";
import nerdamer from "nerdamer/all.min";
import {acceleratedRaycast, computeBoundsTree} from "three-mesh-bvh";

//#region Init
export function initUtils()
{
    initBVH();
}

function initBVH()
{
    THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
    THREE.Mesh.prototype.raycast = acceleratedRaycast;
}
//#endregion

//#region Tweakpane
export function RGBTo01RGB(color)
{
    return new THREE.Color(color.r / 255, color.g / 255, color.b / 255);
}

export function RGBAObjToVector4(color)
{
    return new THREE.Vector4(color.r / 255, color.g / 255, color.b / 255, color.a);
}

export function setupPaneStyle(pane)
{
    const style = pane.element.style;
    style.position = "fixed";
    style.transform = "scale(1.5)";
    style.maxHeight = "500px"; style.maxWidth = "500px";
    style.overflowY = "auto";
    return style;
}
//#endregion

//#region UI
export function createText(content = '', display = 'none')
{
    const text = document.createElement('p');
    const style = text.style;
    text.setAttribute('class', 'text');
    style.marginLeft = '12px'; style.marginRight = '12px';
    style.display = display;
    text.textContent = content;
    return text;
}

export function createError(content = '', display = 'none')
{
    const error = createText(content, display);
    error.setAttribute('class', 'error');
    return error;
}

export function createVerticalCell()
{
    const cell = document.createElement('div');
    cell.style.display = 'flex';
    cell.style.flexDirection = 'column';
    cell.style.alignItems = 'start';
    cell.style.gap = '4px';
    return cell;
}

export function createHorizontalCell()
{
    const cell = document.createElement('div');
    cell.style.display = 'flex';
    cell.style.alignItems = 'start';
    cell.style.gap = '4px';
    return cell;
}
//#endregion

//#region Math
export function sanitizeEquation(expression)
{
    let og = expression;
    if(expression.includes('log('))
        throw new Error('Please specify the base of the logarithm. For example: log10(x) = 1');
    expression = expression.replace(/ln\(/g, 'log(');

    let solvedFor = 'z';
    let sanitizedEquation = [];

    if(!expression.includes('='))
        expression = 'z = ' + expression;

    const compiled = nerdamer(expression);
    if(expression.includes('z'))
        expression = compiled.solveFor('z');
    else if(expression.includes('y'))
    {
        expression = compiled.solveFor('y');
        solvedFor = 'y';
    }
    else
    {
        expression = compiled.solveFor('x');
        solvedFor = 'x';
    }

    sanitizedEquation = expression.toString().split(',')
        .map(expr => solvedFor + ' = ' + expr);
    if(sanitizedEquation.length === 1) og = '';
    return {expression: sanitizedEquation, solvedFor: solvedFor, og: og};
}

export function getExpressions(equations)
{
    return equations
        .filter(eq => eq.isVisible.value)
        .map(eq =>
        {
            if(eq.expression.expression.length !== 0)
                return eq.expression;
        });
}

export function getPlainExpressions(equations)
{
    return getExpressions(equations).map(expr => expr.expression).flat(Infinity);
}

export function extractExpression(expression)
{
    return expression.expression.map(expr => expr.split('=')[1].trim());
}

export function isExpressionEmpty(expression)
{
    return expression.expression.length === 0;
}

export function getTrueExpressionsLength(equations)
{
    return equations.filter(eq => eq.expression.expression.length !== 0).length;
}
//#endregion

//#region BVH
export function toBVH(meshA, meshB)
{
    const matrixBtoA = new THREE.Matrix4()
        .copy(meshA.matrixWorld).invert()
        .multiply(meshB.matrixWorld);

    const geometryBTransformed = meshB.geometry.clone();
    geometryBTransformed.applyMatrix4(matrixBtoA);

    return matrixBtoA;
}

export function setBVH(mesh)
{
    mesh.geometry.computeBoundsTree();
}
//#endregion