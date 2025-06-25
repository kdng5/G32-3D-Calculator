import {camera, renderer, scene} from "./main";
import {back, bottom, front, left, right, top} from "./camera-grid";
import {
    addEquation,
    clearEquations,
    equations,
    intersectionFunctionGUI,
    intersectionResult,
    pane
} from "./equations-list";
import {sanitizeEquation} from "./utils";
import {derivationLevel, integralMode, results, targetVariables} from "./calculus";

let importButton, exportButton;

document.addEventListener('DOMContentLoaded', () =>
{
    importButton = document.getElementById('importBtn').style;
    exportButton = document.getElementById('exportBtn').style;
})

export function exportImportInit()
{
    const exportBtn = document.getElementById('exportBtn');

    if (exportBtn) {
        exportBtn.onclick = exportFile;
    }
}

function getIntersections() {
    return [intersectionResult.value, intersectionFunctionGUI.textContent];
}

function getDerivative()
{
    return Array.from(results.derivative.children).map(child => child.textContent);
}

function getIntegral()
{
    return Array.from(results.integral.children).map(child => child.textContent);
}

function importFile(event)
{
    const fileInput = event.target;
    const files = fileInput.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileReader = new FileReader();

    fileReader.onload = loadFile;  //read txt
    fileReader.readAsText(file);
}

function loadFile(event) {
    const content = event.target.result;
    let lines = content.split('\n');

    let equationLines = [];
    let sgcDataFound = false;
    let sgcDataStartIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed === "---SGC Data---") {
            sgcDataFound = true;
            sgcDataStartIndex = i + 1;
            break;
        }
        if (trimmed.length > 0) {
            equationLines.push(trimmed);
        }
    }

    inputEquations(equationLines);

    //Import Tweakpane state
    if (sgcDataFound && sgcDataStartIndex < lines.length)
    {
        try
        {
            const sgcData = lines.slice(sgcDataStartIndex).join('\n');
            const paneState = JSON.parse(sgcData);
            pane.importState(paneState);
        }
        catch (error)
        {
            console.log('Error importing Tweakpane state:', error);
        }
    }
}

async function exportFile()
{
    importButton.display = 'none'; exportButton.display = 'none';

    const equations = getEquations().join('\n') + '\n\n';

    const screenshots = await getGraphScreenshots();

    let textData = '';
    textData += 'Equations:\n' + equations;
    
    let intersectionText = "Intersections:\n";
    const intersectionResult = getIntersections();
    intersectionText += intersectionResult[0] + "\n";
    intersectionText += intersectionResult[1] + "\n";
    textData += intersectionText + "\n";

    let derivativeText = "Derivative:\n";
    const derivativeResult = getDerivative();
    if(derivativeResult.length > 0)
    {
        derivativeText += "Derivation Level: " + derivationLevel.value + "\n" +
        "Derived For: " + targetVariables.derivative.variable + "\n";
        getDerivative().forEach(expr => derivativeText += expr + "\n");
    }
    textData += derivativeText + '\n';

    let integralText = "Integral:\n";
    const integralResult = getIntegral();
    if(integralResult.length > 0)
    {
        integralText += "Integral Mode: " + integralMode.mode + "\n" +
        "Integrated For: " + targetVariables.integral.variable + "\n";
        getIntegral().forEach(expr => integralText += expr + "\n");
    }
    textData += integralText + "\n";

    const zip = new JSZip();
    zip.file("Report.txt", textData);

    for (let i = 0; i < screenshots.length ; i++){
        const image = screenshots[i];

        const base64 = image.replace(/^data:image\/png;base64,/, "");

        zip.file("Graphs/" + graphOrbitFunctions[i].name + ".png", base64, {base64 : true}); //base64 encoded
    }

    //Tweakpane state export
    zip.file("data.sgc", equations + "---SGC Data---\n\n" + JSON.stringify(pane.exportState()));

    const blob = await zip.generateAsync({ type:"blob"});
    console.log("ZIP created, triggering download...");

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); //binary large object data
    link.download = "Report.zip";
    link.click();

    setTimeout(() =>
    {
        importButton.display = 'block';
        exportButton.display = 'block';
    }, 1000);
}

const graphOrbitFunctions = [top, bottom, left, right, front, back];

async function getGraphScreenshots()
{
    let screenshots = [];
   for(const func of graphOrbitFunctions)
   {
       func();

       await new Promise(resolve => setTimeout(resolve,500)); //500ms delay

       renderer.render(scene, camera);
       const image = renderer.domElement.toDataURL("image/png"); //convert base64
       screenshots.push(image);
   }
   return screenshots;
}

function inputEquations(equationStrings) {
    clearEquations();

    equationStrings.forEach(rawLine => {
        console.log(" Raw Equation:", rawLine);
        try {
            const parsed = sanitizeEquation(rawLine);

            addEquation(parsed);
        } catch (err) {
            console.error(" Error importing:", rawLine, "\n", err);
        }
    });
}


function getEquations() {
    return equations.map(eq => eq.pureInput.expression);
}

window.importFile = importFile;
window.exportFile = exportFile;