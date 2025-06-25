import {analysisTab, equations} from "./equations-list";
import {
    createError,
    createText,
    createVerticalCell,
    extractExpression,
    getExpressions,
    RGBAObjToVector4,
} from "./utils";
import nerdamer from "nerdamer";
import {renderGraph, renderDefiniteIntegral} from "./graph";
import {
    shaderSpeeds,
    derivativeShaderData,
    getShaderMaterial,
    integralShaderData
} from "./shaders";
import {scene} from "./main";

//#region Variables
//#region General
//#region Results and Errors
export const results = {
    derivative: createVerticalCell(),
    integral: createVerticalCell(),
};

const resultStyles = {
    derivative: results.derivative.style,
    integral: results.integral.style,
}

const errors = {
    derivative: createError(),
    integral: createError(),
}

const errorStyles = {
    derivative: errors.derivative.style,
    integral: errors.integral.style,
}
//#endregion

const tools = {
    derivative: {key: 'derivative', calculate: differentiate},
    integral: {key: 'integral', calculate: integrateExpr},
}

const showModule = {
    derivative: {value: false},
    integral: {value: false},
}

export const graphs = {
    derivative: [],
    integral: []
}

export const targetVariables = {
    derivative: {variable: 'x'},
    integral: {variable: 'x'},
}
//#endregion

export const derivationLevel = {value: 1};
export const integralMode = {mode: 'Indefinite'};
export const integralLimits = {limits: {From: 0, To: 1}};
//#endregion

//#region Init
export function initCalculus()
{
    initDerivative();
    initIntegral();
}

function initDerivative()
{
    const derivativeFolder = analysisTab.addFolder({title: 'Derivative', expanded: false});

    derivativeFolder.addBinding(showModule.derivative, 'value', {label: "Show Derivative"})
        .on('change', ev =>
        {
            if(!results.derivative.hasChildNodes())
                handle(derivative);

            if(ev.value)
                alpha.value.w = tempAlpha;
            else
            {
                tempAlpha = alpha.value.w;
                alpha.value.w = 0;
            }

            if(graphs.derivative)
                graphs.derivative.forEach(graph => graph.forEach(mesh => mesh.visible = ev.value));

            color.hidden = !ev.value; speed.hidden = !ev.value;
            derivationLevelGUI.hidden = !ev.value;
            deriveForGUI.hidden = !ev.value;
            resultText.style.display = ev.value ? 'flex' : 'none';
            resultStyles.derivative.display = ev.value ? 'flex' : 'none';
            errorStyles.derivative.display = ev.value ? 'flex' : 'none';
        });

    const alpha = derivativeShaderData.uColor;
    let tempAlpha = alpha.value.w;
    const color = derivativeFolder.addBinding(
        {Color: {r: 0, g: 255, b: 0, a: 1}}, 'Color')
        .on('change', ev => derivativeShaderData.uColor.value = RGBAObjToVector4(ev.value));
    color.hidden = true;

    const speed = derivativeFolder.addBinding(shaderSpeeds.derivative, 'Speed', {min: 0, max: 0.3});
    speed.hidden = true;

    const derivationLevelGUI = derivativeFolder.addBinding(
        derivationLevel, 'value',
        {label: "Derivation Level", min: 1, step: 1, unit: "Level"}
    )
        .on('change', () => handle(derivative));
    derivationLevelGUI.hidden = true;

    const deriveForGUI = derivativeFolder.addBinding(
        targetVariables.derivative, 'variable',
        {label: "Derive For", options: {x: 'x', y: 'y', z: 'z'}}
    )
        .on('change', () => handle(derivative));
    deriveForGUI.hidden = true;

    const resultText = createText('Results', 'none');
    derivativeFolder.element.append(
        resultText,
        results.derivative, errors.derivative
    );
}

function initIntegral()
{
    const integralFolder = analysisTab.addFolder({title: 'Integral', expanded: false});

    integralFolder.addBinding(showModule.integral, 'value', {label: "Show Integral"})
        .on('change', ev =>
        {
            if(!results.integral.hasChildNodes())
                handle(integral);

            if(ev.value)
                alpha.value.w = tempAlpha;
            else
            {
                tempAlpha = alpha.value.w;
                alpha.value.w = 0;
            }

            if(graph.integral)
                graphs.integral.forEach(graph => graph.forEach(mesh => mesh.visible = ev.value));

            color.hidden = !ev.value; speed.hidden = !ev.value;
            integralModeGUI.hidden = !ev.value;
            integrateForGUI.hidden = !ev.value;
            resultText.style.display = ev.value ? 'flex' : 'none';
            resultStyles.integral.display = ev.value ? 'flex' : 'none';
            errorStyles.integral.display = ev.value ? 'flex' : 'none';
        });

    const alpha = integralShaderData.uColor;
    let tempAlpha = alpha.value.w;
    const color = integralFolder.addBinding(
        {Color: {r: 0, g: 0, b: 255, a: 1}}, 'Color')
        .on('change', ev => integralShaderData.uColor.value = RGBAObjToVector4(ev.value));
    color.hidden = true;

    const speed = integralFolder.addBinding(shaderSpeeds.integral, 'Speed', {min: 0, max: 0.3});
    speed.hidden = true;

    const integralModeGUI = integralFolder.addBinding(
        integralMode, 'mode',
        {
            label: "Integral Mode",
            options:
            {
                Definite: 'Definite',
                Indefinite: 'Indefinite'
            }
        })
        .on('change', ev =>
        {
            from.hidden = ev.value === 'Indefinite';
            to.hidden = ev.value === 'Indefinite';
            handle(integral);
        });
    integralModeGUI.hidden = true;

    const integrateForGUI = integralFolder.addBinding(
        targetVariables.integral, 'variable',
        {label: "Integrate For", options: {x: 'x', y: 'y', z: 'z'}}
    )
        .on('change', () => handle(integral));
    integrateForGUI.hidden = true;

    const from = integralFolder.addBinding(
        integralLimits.limits, 'From',
        {min: 1, step: 1})
        .on('change', () => handle(integral));
    from.hidden = true;

    const to = integralFolder.addBinding(
        integralLimits.limits, 'To',
        {min: 1, step: 1})
        .on('change', () => handle(integral));
    to.hidden = true;

    const resultText = createText('Results', 'none');
    integralFolder.element.append(
        resultText,
        results.integral, errors.integral
    );
}
//#endregion

//#region Handler
function handle(operation)
{
    const o = operation();
    o.reset();

    try
    {
        const expressions = getExpressions(equations);
        expressions.forEach((expression) => o.calculate(expression));
        if(o.error.innerHTML !== '')
            o.errorStyle.display = 'flex';
    }
    catch(e)
    {
        if(e.message.includes('is not a function'))
            e.message = 'The equation list contains plain equations <br>' +
                'that are mathematically undefined for ' + operation.name;
        o.error.innerHTML = e.message;
        o.errorStyle.display = 'flex';
    }
}

function derivative()
{
    return {
        error: errors.derivative,
        errorStyle: errorStyles.derivative,
        calculate: (expression) => addResult(expression, 'derivative'),
        reset: () => reset('derivative')
    }
}

function integral()
{
    return {
        error: errors.integral,
        errorStyle: errorStyles.integral,
        calculate: (expression) => addResult(expression, 'integral'),
        reset: () => reset('integral')
    }
}
//#endregion

//#region Helpers
//#region General
//#region Data
function getIndexByExpr(expr, key)
{
    const index = equations.findIndex(eq =>
    {
        if(eq.expression.expression)
            return eq.expression.expression.some(expression =>
                expr.expression.includes(expression));
    });
    if(index === -1)
        return Array.from(results[key].children)
            .findIndex(child => child.textContent === expr.expression.toString());
    else
        return index;
}

function getDiffExprByIndex(index, key)
{
    return results[key].children[index].textContent;
}

function decomposeGraphReference(reference, key)
{
    const expression = typeof reference === 'number' ?
        getDiffExprByIndex(reference, key) : reference;
    const index = typeof reference === 'number' ?
        reference : getIndexByExpr(expression, key);
    return {expression, index};
}
//#endregion

//#region Operations
//#region Results
function addResult(expression, key)
{
    const result = tools[key].calculate(expression);
    results[key].append(createText(result.expression.toString(), 'flex'));
    resultStyles[key].display = showModule[key].value ? 'flex' : 'none';
    graph(result, key, showModule[key].value);
}

function removeResult(result, key)
{
    results[key].removeChild(results[key].children[getIndexByExpr(result, key)]);
    removeGraphs(result, key);
}

function showResult(result, key, show)
{
    const index = typeof result === 'number' ?
        result : getIndexByExpr(result, key);
    showGraph(index, key, show);
}
//#endregion

//#region Expression
export function addExpression(expression)
{
    for(const key in tools)
    {
        if(!showModule[key].value) continue;
        addResult(expression, key);
    }
}

export function removeExpression(expression)
{
    for(const key in tools)
    {
        if(!showModule[key].value) continue;
        removeResult(expression, key);
    }
}

export function showExpression(expression, show)
{
    for(const key in tools)
    {
        if(!showModule[key].value) continue;
        showResult(expression, key, show);
    }
}

export function changeExpression(expression)
{
    for(const key in tools)
    {
        if(!showModule[key].value) continue;
        const index = getIndexByExpr(expression, key);
        const tool = tools[key];
        const resultText = results[tool.key].children[index];
        const result = tool.calculate(expression);
        resultText.textContent = result.expression.toString();
        graph(result, tool.key, equations[index].isVisible);
    }
}
//#endregion
//#endregion

//#region Graphing
function graph(graphReference, key, show = true)
{
    let {expression, index} = decomposeGraphReference(graphReference, key);
    const graphLocation = index < graphs[key].length ?
        graphs[key][index] : [];

    let graph = isDefiniteIntegral(expression) ?
        renderDefiniteIntegral(expression, index, integralLimits.limits, getShaderMaterial(key), graphLocation, show) :
        renderGraph(
        expression, equations[index].restrictions,
        getShaderMaterial(key),
        graphLocation,
        '',
        show
    );

    if(typeof graph === 'string')
    {
        errors[key].innerHTML += graph + "<br><br>";
        return;
    }

    if(index < graphs[key].length)
        graphs[key][index] = graph;
    else
        graphs[key].push(graph);
}

function removeGraphs(graphReference, key)
{
    const index = decomposeGraphReference(graphReference, key).index;
    graphs[key][index].forEach(graph => scene.remove(graph));
    graphs[key][index].length = 0;
}

function showGraph(graphReference, key, show)
{
    graphs[key][decomposeGraphReference(graphReference, key).index]
        .forEach(graph => graph.visible = show);
}

export function updateCalculusGraph(index)
{
    for(const key in tools)
    {
        if(!showModule[key].value) continue;
        graph(index, key, equations[index].isVisible);
    }
}
//#endregion

//#region Reset
export function resetCalculus()
{
    for(const key in tools) reset(key);
}

function reset(key)
{
    results[key].innerHTML = ''; errors[key].innerHTML = '';
    resultStyles[key].display = 'none'; errorStyles[key].display = 'none';
    graphs[key].forEach(graph => graph.forEach(mesh => scene.remove(mesh)));
    graphs[key].length = 0;
}
//#endregion
//#endregion

//#region Calculations
function differentiate(expression)
{
    const solution = nerdamer.diff(
        nerdamer(extractExpression(expression)),
        targetVariables.derivative.variable, derivationLevel.value)
        .toString().split(',')
        .map(expr => expression.solvedFor + ' = ' + expr);
    return {expression: solution, solvedFor: expression.solvedFor};
}

function integrateExpr(expression)
{
    const expressions = nerdamer(extractExpression(expression));
    let solution = integralMode.mode === 'Indefinite' ?
        nerdamer.integrate(expressions, targetVariables.integral.variable).toString().split(',') :
        nerdamer.defint(
            expressions,
            integralLimits.limits.From, integralLimits.limits.To,
            targetVariables.integral.variable)
            .toString();
    if(Array.isArray(solution))
        solution = solution.map(expr => expression.solvedFor + ' = ' + expr);
    else
        solution = [solution];
    return {expression: solution, solvedFor: expression.solvedFor};
}
//#endregion

//#region Integral
function isDefiniteIntegral(expression)
{
    for(let i = 0; i < expression.expression.length; i++)
        if(expression.expression[i].includes('='))
            return false;
    return true;
}
//#endregion
//#endregion