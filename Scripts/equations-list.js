import {Pane} from 'tweakpane';
import {deleteMesh, getCachedMaterial, getGraphMeshes, renderGraph} from './graph';
import {randomInt} from 'mathjs';
import {orbitControls, scene} from "./main";
import * as THREE from "three";
import {
    createError, createHorizontalCell,
    createText, createVerticalCell, getExpressions, getPlainExpressions, getTrueExpressionsLength, RGBAObjToVector4,
    RGBTo01RGB, sanitizeEquation, setBVH,
    setupPaneStyle, toBVH,
} from "./utils";

import nerdamer from "nerdamer/all.min";
import {getShaderMaterial, intersectionShaderData, shaderSpeeds} from "./shaders";
import {HOLLOW_INTERSECTION} from "three-bvh-csg";
import {
    addExpression,
    changeExpression, graphs,
    initCalculus, removeExpression,
    resetCalculus, showExpression,
    updateCalculusGraph
} from "./calculus";

import {renderInfiniteSolutions} from "../src/workers/evaluator-wrapper";

//#region Variables
//#region Tweakpane
export const pane = new Pane();
let equationTab
export let analysisTab;
//#endregion

//#region Graph Settings
const isQualityDynamic = {value: true};
export const quality = {value: 700};
export let domainRestrictionsEnabled = { value: true };
let graphScale;
export let currentDistance;
export let NO_DOMAIN_PARAMS;
//#endregion

//#region Intersection
export let equations = [];
const enableIntersection = {value: false};
export const intersectionResult = {value: ''};
const timeLimit = {value: 10};
export let intersectionFunctionGUI;
let intersectionLoader, intersectionLoaderText, intersectionFunctionStyle,
    intersectionErrorGUI, intersectionErrorStyle, intersectionResultGUI;
let intersectionMesh = [];
//#endregion
//#endregion

//#region Init Functions
export function equationsListInit()
{
    setStyle();
    initTabs();
    initOrbitControl();
    initResolution();
    initCheckbox();
    initButton();
    initIntersection();
    initCalculus();
}

function setStyle()
{
    const style = setupPaneStyle(pane);
    style.top = "0%"; style.left = "0%";
    style.transformOrigin = "top left";
    style.transform = "scale(1.5)";
}

function initTabs()
{
    const tabs = pane.addTab(
        {
            pages:
            [
                {title: 'Equations List'},
                {title: 'Analysis'}
            ]
        });
    equationTab = tabs.pages[0];
    analysisTab = tabs.pages[1];
}

function initCheckbox()
{
    const settings = { domainRestrictions: true };

    equationTab.addBinding(settings, 'domainRestrictions', {
        label: 'Domain Restrictions'
        }).on('change', ev => {
            domainRestrictionsEnabled = ev.value;  
            updateGraph();
        });


}

function initButton()
{
    equationTab.addButton({title: 'Add Equation'}).on('click', () => addEquation());
    equationTab.addButton({title: 'Delete All Equations'}).on('click', clearEquations);
    equationTab.addBlade({view: 'separator'});
}

function initResolution()
{
    equationTab.addBinding(
        isQualityDynamic, 'value',
        {label: 'Dynamic Quality'}).on(
        'change', ev =>
        {
            if(ev.value)
            {
                quality.value = 700;
                updateGraph();
            }
            qualitySlider.hidden = ev.value;
        }
    );

    let qualityUpdateTimeout;
    const qualitySlider = equationTab.addBinding(
        quality, 'value',
        {label: 'Quality', min: 100, max: 5000}).on(
            'change', () =>
        {
            if(isQualityDynamic.value) return;
            if(qualityUpdateTimeout) clearTimeout(qualityUpdateTimeout);
            qualityUpdateTimeout = setTimeout(() => updateGraph(), 50);
        }
    );
    qualitySlider.hidden = isQualityDynamic.value;

    equationTab.addBlade({view: 'separator'});
}

function initOrbitControl()
{
    graphScale = orbitControls.getDistance();
    NO_DOMAIN_PARAMS = getTrueRestrictions(graphScale);
    let orbitUpdateTimeout;

    orbitControls.addEventListener('end', () =>
    {
        currentDistance = orbitControls.getDistance();
        quality.value = Math.round(700 * Math.pow(0.95, currentDistance - 12));

        if(intersectionMesh.length > 0 &&
            (intersectionResult.value === 'One Solution' ||
            intersectionResult.value === 'Multiple Solutions'))
            intersectionMesh.forEach(mesh => mesh.scale.setScalar(currentDistance / 20));

        if(domainRestrictionsEnabled ||
            Math.abs(currentDistance - graphScale) < 0.01) return;

        if (orbitUpdateTimeout) clearTimeout(orbitUpdateTimeout);
        orbitUpdateTimeout = setTimeout(() =>
        {
            graphScale = currentDistance;
            NO_DOMAIN_PARAMS = getTrueRestrictions(graphScale);
            updateGraph();
            if(intersectionMesh.length > 0 && intersectionResult.value === 'Infinite Solutions')
                intersectionMesh.forEach(mesh =>
                    mesh.scale.multiplyScalar((currentDistance - graphScale) / 12)
                );
            orbitUpdateTimeout = null;
        }, 50);
    });
}

function initIntersection()
{
    const intersectionFolder = analysisTab.addFolder({title: 'Intersection', expanded: false});

    intersectionFolder.addBinding(
        enableIntersection, 'value',
        {label: 'Show Intersection'}).on(
            'change', (ev) =>
        {
            limit.hidden = !ev.value;
            color.hidden = !ev.value;
            speed.hidden = !ev.value;
            showIntersection(ev.value)
        }
    );

    const limit = intersectionFolder.addBinding(
        timeLimit, 'value',
        {label: 'Calculation Time Limit (seconds)', min: 1, max: 3600}
    );
    limit.hidden = true;

    const color = intersectionFolder.addBinding(
        {"Intersection Color": {r: 255, g: 0, b: 0, a: 1}}, 'Intersection Color')
        .on('change', (ev) => intersectionShaderData.uColor.value = RGBAObjToVector4(ev.value));
    color.hidden = true;

    const speed = intersectionFolder.addBinding(
        shaderSpeeds.intersection, 'Speed',
        {min: 0, max: 0.3}
    );
    speed.hidden = true;

    intersectionResultGUI = intersectionFolder.addBinding(
        intersectionResult, 'value',
        {readonly: true, label: 'Result'});
    intersectionResultGUI.hidden = true;

    intersectionFunctionGUI = createText();
    intersectionFunctionStyle = intersectionFunctionGUI.style;

    intersectionErrorGUI = createError();
    intersectionErrorStyle = intersectionErrorGUI.style;

    intersectionLoader = document.getElementById("intersection-loader");
    intersectionLoaderText = intersectionLoader.querySelector(".text");

    intersectionFolder.element.append(intersectionFunctionGUI, intersectionErrorGUI, intersectionLoader);
}

function initComponents(subCell)
{
    //#region Domain Restrictions
    const domains = createVerticalCell();

    const DOMAIN_PARAMS =
        {
            x: { x: -5, y: 5 },
            y: { x: -5, y: 5 },
            z: { x: -5, y: 5 },
        };

    const x = equationTab.addBinding(DOMAIN_PARAMS, 'x', {label: 'X Restrictions'});
    const y = equationTab.addBinding(DOMAIN_PARAMS, 'y', {label: 'Y Restrictions'});
    const z = equationTab.addBinding(DOMAIN_PARAMS, 'z', {label: 'Z Restrictions'});

    let domainUpdateTimeout;
    [x, y, z].forEach(domain => domain.on('change', () =>
    {
        if(graph.mesh.length === 0) return;

        if(domainUpdateTimeout) clearTimeout(domainUpdateTimeout);

        domainUpdateTimeout = setTimeout(() =>
        {
            preInfUpdate();
            evaluateExpression(equation);
            changeExpression(equationExpression.expression);
            postInfUpdate();
            domainUpdateTimeout = null;
        }, 150);
    }));

    domains.append(x.element, y.element, z.element);
    domains.style.display = domainRestrictionsEnabled ? 'flex' : 'none';
    domains.style.marginBottom = '30px';
    //#endregion

    //#region Error and Input Field
    const error = createError();
    let graph = {mesh: [], compiledExpression: null};
    let equationExpression = {expression: '', solvedFor: ''};
    let pureInput = {expression: ''};
    const inputField = equationTab.addBinding(equationExpression, 'expression', {label: (equations.length + 1).toString()});
    inputField.on('change', (ev) =>
    {
        try
        {
            pureInput.expression = ev.value;
            error.textContent = '';
            error.style.display = 'none';
            equation.expression = sanitizeEquation(ev.value);
            evaluateExpression(equation);
            handleIntersection();
            if(getTrueExpressionsLength(equations) === graphs.derivative.length)
                changeExpression(equation.expression);
            else
                addExpression(equation.expression);
        }
        catch(e)
        {
            error.textContent = e.message;
            error.style.display = 'block';
        }
    });
    inputField.element.style.marginTop = '5px';
    //#endregion

    //#region Color and Visibility
    let graphColor =
        {
            color:
                {
                    r: randomInt(255),
                    g: randomInt(255),
                    b: randomInt(255),
                    a: 1
                }
        };
    const color = equationTab.addBinding(graphColor, 'color', {label: ''}).on('change', (ev) =>
    {
        if(graph.mesh.length === 0) return;
        graph.mesh.forEach(mesh =>
        {
            mesh.material.setValues(
                {
                    color: RGBTo01RGB(ev.value),
                    opacity: ev.value.a
                }
            );
        });
    });
    color.element.style.marginBottom = '10px';

    let tempExpression;
    const isVisible = {value: true};
    const visibility = equationTab.addBinding(isVisible, 'value', {label: ''}).on('change', ev =>
    {
        if(graph.mesh.length === 0) return;
        resetIntersection();
        if(ev.value) equationExpression = tempExpression;
        else
        {
            tempExpression = equationExpression;
            equationExpression = null;
        }
        handleIntersection();
        showExpression(equations.indexOf(equation), ev.value);
        graph.mesh.forEach(mesh => mesh.visible = ev.value);
    });
    visibility.element.style.marginTop = '5px';
    visibility.element.style.marginRight = '-145px';
    //#endregion

    //#region Delete Button
    const deleteButton = equationTab.addButton({title: 'Delete'});
    deleteButton.on('click', () =>
    {
        removeExpression(equation.expression);
        equations.splice(equations.indexOf(equations.find(eq => eq.cell === subCell)), 1);
        deleteEquation(graph.mesh, subCell);
        handleIntersection();
        updateEquationsList();
    });
    deleteButton.element.style.marginTop = '5px';
    //#endregion

    //#region Components Assembly
    const miniCell = createHorizontalCell();
    miniCell.append(visibility.element, inputField.element, deleteButton.element, error);
    subCell.append(miniCell, color.element, domains);

    const equation = {
        pureInput: pureInput,
        order: inputField.controller.view.labelElement,
        expression: equationExpression,
        color: graphColor, error, isVisible: isVisible,
        domains, restrictions: DOMAIN_PARAMS,
        equationGraph: graph,
        cell: subCell
    };
    //#endregion

    return equation;
}
//#endregion

//#region Helper Functions
//#region Equation Handling
export function addEquation(expression = null)
{
    if(getTrueExpressionsLength(equations) < equations.length) return;

    const cell = createVerticalCell();
    equationTab.element.append(cell);
    const equation = initComponents(cell);
    equations.push(equation);

    if (expression) {
        if (
            typeof expression === 'object' &&
            Array.isArray(expression.expression) &&
            typeof expression.solvedFor === 'string'
        ) {
            equation.expression = {
                expression: [...expression.expression],
                solvedFor: expression.solvedFor,
                og: expression.og ?? ''
            };
            evaluateExpression(equation);
            handleIntersection();

        } else if (typeof expression === 'string') {
            equation.expression.expression = [expression];
            evaluateExpression(equation);
            handleIntersection();
        }
    }
}

function deleteEquation(mesh, cell, isClearing = false)
{
    resetIntersection();
    if(cell) cell.remove();
    if(mesh) deleteMesh(mesh);
    if(!isClearing)
        handleIntersection();
}

export function clearEquations()
{
    equations.forEach(child =>
    {
        const mesh = child.equationGraph.mesh;
        deleteEquation(mesh, child.cell, true);
    });
    equations.length = 0;
    resetIntersection();
    resetAnalysis();
}
//#endregion

//#region Graph Handling
function getTrueRestrictions(graphScale, screenBuffer = graphScale * 0.5)
{
    const uniformDomain = {
        x: -graphScale + screenBuffer,
        y: graphScale - screenBuffer
    }
    return {x: uniformDomain, y: uniformDomain, z: uniformDomain};
}

function evaluateExpression(equation)
{
    //#region Setup Function Variables
    const expression = equation.expression;
    const error = equation.error;
    let graph = equation.equationGraph;
    const graphColor = equation.color;
    //#endregion

    renderGraph(expression, equation.restrictions, getCachedMaterial(graphColor.color), graph.mesh, error);
}

function updateGraph()
{
    preInfUpdate();
    equations.forEach((equation, index) =>
    {
        equation.domains.style.display = domainRestrictionsEnabled ? 'flex' : 'none';
        updateCalculusGraph(index);
        evaluateExpression(equation);
    });
    postInfUpdate();
}

function updateEquationsList()
{
    for(let i = 0; i < equations.length; i++)
        equations[i].order.textContent = i + 1;
}
//#endregion

//#region Intersection Handling
function showIntersection(show)
{
    intersectionResultGUI.hidden = !show;
    showSub(intersectionFunctionStyle, show);
    showSub(intersectionErrorStyle, show);
    if(intersectionMesh.length > 0)
        intersectionMesh.forEach(mesh => mesh.visible = show);

    if(intersectionResult.value === '')
        calculateIntersections();

    function showSub(sub, show)
    {
        sub.display = show ? 'block' : 'none';
    }
}

function calculateIntersections()
{
    if(hasNoEquations()) return;

    resetIntersection();
    try
    {
        let system = [];
        getExpressions(equations).forEach(expr =>
        {
            if(expr.og !== '') system.push(expr.og);
            else expr.expression.forEach(e => system.push(e));
        });
        const trueSystem = new Set(system);
        system = [...trueSystem];
        const result = nerdamer.solveEquations(system);
        if(getTrueExpressionsLength(equations) === 1 || (result.length > 0 && result[0][1] === undefined))
            handleInfiniteSolutions().then(result => intersectionResult.value = result);
        else
            intersectionResult.value = result.toString() === '' || result.toString().includes('NaN') ?
                'No Solutions' :  formatFiniteSolutions(result);
    }
    catch (error)
    {
        intersectionResult.value = handleIntersectionError(error);
    }

    function hasNoEquations()
    {
        for(let i = 0; i < equations.length; i++)
        {
            for(let j = 0; j < equations[i].expression.expression.length; j++)
                if(equations[i].expression.expression[j] !== '')
                    return false;
        }
        return true;
    }
}

function handleIntersectionError(error)
{
    resetIntersectionMesh();
    if(error.message === 'System does not have a distinct solution')
    {
        if(!areAllGraphsIntersecting()) return 'No Solutions';
        else
        {
            handleInfiniteSolutions().then();
            return 'Infinite Solutions';
        }
    }

    intersectionErrorGUI.textContent = error.message;
    intersectionErrorStyle.display = 'block';
    return 'Error';
}

function areAllGraphsIntersecting()
{
    const meshes = getGraphMeshes(equations);
    for(let i = 0; i < meshes.length; i++)
    {
        const meshA = meshes[i]; setBVH(meshA);
        for (let j = i + 1; j < meshes.length; j++)
        {
            const meshB = meshes[j]; const geometryBToBVH = toBVH(meshA, meshB);
            setBVH(meshB);
            if(!meshA.geometry.boundsTree.intersectsGeometry(meshB.geometry, geometryBToBVH))
                return false;
        }
    }
    return true;
}

function formatFiniteSolutions(result)
{
    result.forEach((solution) =>
    {
        intersectionFunctionGUI.textContent += solution[0] + ' = ' + solution[1] + '   ';
        intersectionFunctionGUI.innerHTML += '<br>';
    });

    const hasMultipleSolutions =
        !areAllGraphsIntersecting() &&
        getGraphMeshes(equations).length > equations.length;
    if(hasMultipleSolutions)
    {
        intersectionFunctionGUI.innerHTML +=
            '<br>Showing the first solution<br>' +
            'Nadermer currently doesn\'t support <br>' +
            'showing multiple discrete equations';
    }

    renderDiscreteIntersection(result);
    intersectionFunctionStyle.display = 'block';
    return !hasMultipleSolutions ? 'One Solution' : 'Multiple Solutions';
}

function renderDiscreteIntersection(result)
{
    const position = new THREE.Vector3(0, 0, 0);
    result.forEach(solution =>
    {
        if(solution[0] === 'x') position.x = solution[1];
        else if(solution[0] === 'y') position.z = -solution[1];
        else position.y = solution[1];
    })
    intersectionMesh = [new THREE.Mesh(
        new THREE.SphereGeometry(1),
        getShaderMaterial('intersection')
    )];
    intersectionMesh.forEach(mesh =>
    {
        mesh.position.copy(position);
        mesh.scale.setScalar(currentDistance / 20);
        scene.add(mesh);
    });
}

async function handleInfiniteSolutions()
{
    if(getTrueExpressionsLength(equations) <= 1 || new Set(getPlainExpressions(equations)).size === 1)
    {
        intersectionMesh = equations[0].equationGraph.mesh.map(mesh => mesh.clone());
    }
    else
    {
        const meshes = getGraphMeshes(equations);
        intersectionMesh = [meshes[0]];
        try
        {
            intersectionLoader.style.display = 'flex';
            for(let i = 1; i < meshes.length; i++)
            {
                const progress = Math.round((i / (meshes.length)) * 100);
                intersectionLoaderText.dataset.text = `Calculating intersection: ${progress}%`;
                intersectionMesh = [await renderInfiniteSolutions(
                    intersectionMesh[0], meshes[i], HOLLOW_INTERSECTION, timeLimit.value
                )];
            }
            intersectionLoaderText.dataset.text = 'Calculation Completed';
            setTimeout(() => intersectionLoader.style.display = 'none', 1500);
        }
        catch(e)
        {
            intersectionLoader.style.display = 'none';
            handleIntersectionError(e);
            return 'Infnite Solutions';
        }
    }

    intersectionMesh.forEach(mesh =>
    {
        mesh.scale.setScalar(1.05);
        mesh.material = getShaderMaterial('intersection');
        mesh.visible = true;
        scene.add(mesh);
    })
    return 'Infinite Solutions';
}

function handleIntersection()
{
    if(enableIntersection.value)
        calculateIntersections();
    else intersectionResult.value = '';
}

function resetIntersection()
{
    intersectionLoader.style.display = 'none';
    intersectionResult.value = '';
    intersectionFunctionGUI.textContent = '';
    intersectionFunctionStyle.display = 'none';
    intersectionErrorGUI.textContent = '';
    intersectionErrorStyle.display = 'none';
    resetIntersectionMesh();
}

function resetIntersectionMesh()
{
    intersectionMesh.forEach(mesh => scene.remove(mesh));
    intersectionMesh.length = 0;
}

function preInfUpdate()
{
    if(intersectionResult.value === 'Infinite Solutions')
        resetIntersectionMesh();
}

function postInfUpdate()
{
    if(enableIntersection.value && intersectionMesh.length <= 0)
        handleInfiniteSolutions().catch(e => handleIntersectionError(e));
}
//#endregion

function resetAnalysis()
{
    resetIntersection();
    resetCalculus();
}
//#endregion