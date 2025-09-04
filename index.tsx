/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';

// --- State Management ---
let lastCalculationData: { formData: any, results: any, recommendations: string[] } | null = null;
let isAdminAuthenticated = false;
let isDiagramInitialized = false;
let fugitiveSources: { type: string; quantity: number }[] = [];


// --- DOM Element References ---

// Main Content Areas
const calculatorContent = document.getElementById("calculator-content") as HTMLDivElement;
const adminLoginContent = document.getElementById("admin-login-content") as HTMLDivElement;
const adminPanelContent = document.getElementById("admin-panel-content") as HTMLDivElement;
const reportContent = document.getElementById("report-content") as HTMLDivElement;
const resultsSummaryContent = document.getElementById("results-summary-content") as HTMLDivElement;
const diagramContent = document.getElementById("diagram-content") as HTMLDivElement;


// Navigation Tabs
const calculatorTab = document.getElementById("calculator-tab") as HTMLButtonElement;
const adminTab = document.getElementById("admin-tab") as HTMLButtonElement;
const reportTab = document.getElementById("report-tab") as HTMLButtonElement;
const resultsSummaryTab = document.getElementById("results-summary-tab") as HTMLButtonElement;
const diagramTab = document.getElementById("diagram-tab") as HTMLButtonElement;


// Calculator Form & Elements
const calcForm = document.getElementById("calc-form") as HTMLFormElement;
const calculateBtn = document.getElementById("calculate-btn") as HTMLButtonElement;
const loadCalcBtn = document.getElementById("load-calc-btn") as HTMLButtonElement;
const loadFileInput = document.getElementById("load-file-input") as HTMLInputElement;
const calculationMethodSelect = document.getElementById("calculation-method") as HTMLSelectElement;
const fugitiveEmissionInputs = document.getElementById("fugitive-emission-inputs-wrapper") as HTMLDivElement;
const dateInput = document.getElementById('date') as HTMLInputElement;

// Fugitive Emission Builder
const fugitiveSourceTypeSelect = document.getElementById('fugitive-source-type') as HTMLSelectElement;
const fugitiveSourceQtyInput = document.getElementById('fugitive-source-qty') as HTMLInputElement;
const addFugitiveSourceBtn = document.getElementById('add-fugitive-source-btn') as HTMLButtonElement;
const fugitiveSourcesList = document.getElementById('fugitive-sources-list') as HTMLDivElement;
const totalLeakRateValue = document.getElementById('total-leak-rate-value') as HTMLDivElement;


// Results Display
const resultsPlaceholder = document.getElementById("results-placeholder") as HTMLDivElement;
const loadingIndicator = document.getElementById("loading-indicator") as HTMLDivElement;
const errorMessage = document.getElementById("error-message") as HTMLDivElement;
const resultsContent = document.getElementById("results-content") as HTMLDivElement;

// Admin Login
const adminLoginForm = document.getElementById("admin-login-form") as HTMLFormElement;
const adminPasswordInput = document.getElementById("admin-password") as HTMLInputElement;
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
const loginErrorMessage = document.getElementById('login-error-message') as HTMLDivElement;

// Report View
const latexCodeOutput = document.getElementById("latex-code-output") as HTMLElement;
const copyLatexBtn = document.getElementById("copy-latex-btn") as HTMLButtonElement;
const downloadPdfBtn = document.getElementById("download-pdf-btn") as HTMLButtonElement;

// Diagram View
const diagramPalette = document.getElementById("diagram-palette") as HTMLDivElement;
// FIX: Correctly cast to SVGSVGElement to resolve typing errors and allow access to SVG-specific methods. This also resolves the error on line 1629.
const diagramCanvas = document.getElementById("diagram-canvas") as unknown as SVGSVGElement;
const clearDiagramBtn = document.getElementById("clear-diagram-btn") as HTMLButtonElement;


// --- Diagram State & Config ---
const EQUIPMENT_ZONES: { [key: string]: { label: string; zones: { type: 'Division 1' | 'Division 2'; shape: 'circle'; radius: number }[] } } = {
    'process-vent': {
        label: 'Process Vent (AGA Fig 1)',
        zones: [
            { type: 'Division 1', shape: 'circle', radius: 5 },
            { type: 'Division 2', shape: 'circle', radius: 15 },
        ]
    },
    'process-valve': {
        label: 'Process Valve (AGA Fig 3)',
        zones: [
            { type: 'Division 2', shape: 'circle', radius: 15 },
        ]
    },
    'instrument-vent': {
        label: 'Instrument Vent (AGA Fig 16)',
        zones: [
            { type: 'Division 1', shape: 'circle', radius: 1.5 },
            { type: 'Division 2', shape: 'circle', radius: 3 }
        ]
    },
    'pressure-vessel-flange': {
        label: 'Pressure Vessel Flange (AGA Fig 8)',
        zones: [
            { type: 'Division 2', shape: 'circle', radius: 15 },
        ]
    }
};

const FUGITIVE_EMISSION_FACTORS: { [key: string]: { label: string; rateCFM: number } } = {
    'valve-stem': { label: 'Valve Stem (Gas Service)', rateCFM: 0.23 },
    'connector-threaded': { label: 'Connector, Threaded', rateCFM: 0.09 },
    'flange': { label: 'Flange', rateCFM: 0.02 },
    'pump-seal': { label: 'Pump Seal (Light Liquid/Gas)', rateCFM: 0.42 },
    'compressor-seal': { label: 'Compressor Seal', rateCFM: 2.15 },
    'relief-valve': { label: 'Pressure Relief Valve', rateCFM: 0.88 },
    'open-ended-line': { label: 'Open-Ended Line/Valve', rateCFM: 0.09 },
};


let diagramState: {
    equipment: { type: string; x: number; y: number }[];
    building: { width: number; length: number };
    scale: number;
} = {
    equipment: [],
    building: { width: 0, length: 0 },
    scale: 1, // pixels per foot
};

// --- Utility Functions ---

function hideAllContent(): void {
  calculatorContent.classList.add("hidden");
  adminLoginContent.classList.add("hidden");
  adminPanelContent.classList.add("hidden");
  reportContent.classList.add("hidden");
  resultsSummaryContent.classList.add("hidden");
  diagramContent.classList.add("hidden");
}

function deactivateAllTabs(): void {
  calculatorTab.classList.remove("active-tab");
  calculatorTab.setAttribute("aria-selected", "false");
  adminTab.classList.remove("active-tab");
  adminTab.setAttribute("aria-selected", "false");
  if (reportTab) {
    reportTab.classList.remove("active-tab");
    reportTab.setAttribute("aria-selected", "false");
  }
  if (resultsSummaryTab) {
    resultsSummaryTab.classList.remove("active-tab");
    resultsSummaryTab.setAttribute("aria-selected", "false");
  }
  if (diagramTab) {
    diagramTab.classList.remove("active-tab");
    diagramTab.setAttribute("aria-selected", "false");
  }
}

function escapeLatex(str: string): string {
    if (!str) return '';
    // First, remove non-printable ASCII characters and complex Unicode/emojis which break pdflatex
    const sanitizedStr = str.replace(/[^\x20-\x7E]/g, '');

    // Then, escape special LaTeX characters
    return sanitizedStr
        .replace(/\\/g, '\\textbackslash{}')
        .replace(/&/g, '\\&')
        .replace(/%/g, '\\%')
        .replace(/\$/g, '\\$')
        .replace(/#/g, '\\#')
        .replace(/_/g, '\\_')
        .replace(/{/g, '\\{')
        .replace(/}/g, '\\}')
        .replace(/~/g, '\\textasciitilde{}')
        .replace(/\^/g, '\\textasciicircum{}');
}

// --- Event Listeners ---

function handleTabClick(tab: HTMLButtonElement, content: HTMLDivElement): void {
  deactivateAllTabs();
  hideAllContent();
  tab.classList.add("active-tab");
  tab.setAttribute("aria-selected", "true");
  content.classList.remove("hidden");
}

calculatorTab.addEventListener("click", () => handleTabClick(calculatorTab, calculatorContent));
resultsSummaryTab.addEventListener("click", () => handleTabClick(resultsSummaryTab, resultsSummaryContent));
diagramTab.addEventListener("click", () => {
    handleTabClick(diagramTab, diagramContent);
    // FIX: Initialize the diagram only the first time the tab is clicked after a calculation.
    // This ensures the container is visible and has dimensions before setup is called.
    if (lastCalculationData && !isDiagramInitialized) {
        // Use a short timeout to allow the browser to render the now-visible container.
        setTimeout(() => {
            setupDiagramCanvas(lastCalculationData!.results.width, lastCalculationData!.results.length);
            isDiagramInitialized = true;
        }, 0);
    }
});


adminTab.addEventListener("click", () => {
    const contentToShow = isAdminAuthenticated ? adminPanelContent : adminLoginContent;
    handleTabClick(adminTab, contentToShow);
});

reportTab.addEventListener("click", () => {
    if (!isAdminAuthenticated) return;
    if (lastCalculationData) {
        handleTabClick(reportTab, reportContent);
        const latexCode = generateLatexReport(
            lastCalculationData.formData,
            lastCalculationData.results,
            lastCalculationData.recommendations
        );
        latexCodeOutput.textContent = latexCode;
    }
});

calculationMethodSelect.addEventListener("change", () => {
    const isFugitive = calculationMethodSelect.value === "fugitive-emission-method";
    fugitiveEmissionInputs.classList.toggle("hidden", !isFugitive);
    // No longer a single required input, validation happens at calculation time
});

calcForm.addEventListener("submit", async (e: Event) => {
  e.preventDefault();
  await runCalculation();
});

loadCalcBtn.addEventListener('click', () => {
    loadFileInput.click();
});

loadFileInput.addEventListener('change', handleLoadCalculation);

adminLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (adminPasswordInput.value === '0665') {
        isAdminAuthenticated = true;
        hideAllContent();
        deactivateAllTabs();
        adminPanelContent.classList.remove('hidden');
        adminTab.classList.add("active-tab");
        adminTab.setAttribute("aria-selected", "true");
        loginErrorMessage.classList.add('hidden');
        if (lastCalculationData) {
            reportTab.classList.remove('hidden');
        }
    } else {
        loginErrorMessage.textContent = 'Incorrect password. Please try again.';
        loginErrorMessage.classList.remove('hidden');
    }
    adminPasswordInput.value = '';
});

logoutBtn.addEventListener('click', () => {
    isAdminAuthenticated = false;

    hideAllContent();
    deactivateAllTabs();

    reportTab.classList.add('hidden');
    reportTab.setAttribute("aria-selected", "false");
    resultsSummaryTab.classList.add('hidden');
    resultsSummaryTab.setAttribute("aria-selected", "false");
    diagramTab.classList.add('hidden');
    diagramTab.setAttribute("aria-selected", "false");

    adminTab.classList.add('active-tab');
    adminTab.setAttribute("aria-selected", "true");
    adminLoginContent.classList.remove('hidden');
});

copyLatexBtn.addEventListener("click", async () => {
    if (latexCodeOutput.textContent) {
        try {
            await navigator.clipboard.writeText(latexCodeOutput.textContent);
            copyLatexBtn.textContent = "Copied!";
            setTimeout(() => {
                copyLatexBtn.textContent = "Copy LaTeX Code";
            }, 2000);
        } catch (err) {
            console.error("Failed to copy text: ", err);
            alert("Failed to copy to clipboard.");
        }
    }
});

downloadPdfBtn.addEventListener("click", () => {
    if (lastCalculationData) {
        generatePdfReport(lastCalculationData.formData, lastCalculationData.results, lastCalculationData.recommendations);
    }
});

addFugitiveSourceBtn.addEventListener('click', () => {
    const type = fugitiveSourceTypeSelect.value;
    const quantity = parseInt(fugitiveSourceQtyInput.value, 10);

    if (type && quantity > 0) {
        const existingSource = fugitiveSources.find(s => s.type === type);
        if (existingSource) {
            existingSource.quantity += quantity;
        } else {
            fugitiveSources.push({ type, quantity });
        }
        renderFugitiveSourcesList();
        fugitiveSourceQtyInput.value = '1'; 
    }
});


// --- Core Logic ---

async function runCalculation(loadedData: any | null = null) {
    const formDataObj = loadedData ? loadedData.formData : Object.fromEntries(new FormData(calcForm).entries());
    // If loading, restore fugitive sources
    if (loadedData && loadedData.fugitiveSources) {
        fugitiveSources = loadedData.fugitiveSources;
        renderFugitiveSourcesList();
    }


    resultsPlaceholder.classList.add("hidden");
    resultsContent.innerHTML = "";
    resultsContent.classList.add("hidden");
    errorMessage.classList.add("hidden");
    loadingIndicator.classList.remove("hidden");
    calculateBtn.disabled = true;
    calculateBtn.textContent = "Calculating...";
    reportTab.classList.add('hidden');
    resultsSummaryTab.classList.add('hidden');
    diagramTab.classList.add('hidden');
    lastCalculationData = null;
    isDiagramInitialized = false;

    try {
        const localResult = performLocalCalculation(formDataObj);
        
        lastCalculationData = {
            formData: formDataObj,
            results: localResult.calculationResults,
            recommendations: localResult.recommendations,
        };

        displayResults(localResult.calculationResults, localResult.recommendations);
        renderResultsSummaryReport(lastCalculationData.results, lastCalculationData.formData, lastCalculationData.recommendations);
        
        resultsSummaryTab.classList.remove('hidden');
        diagramTab.classList.remove('hidden');
        isDiagramInitialized = false; // Reset diagram initialization state


        if (isAdminAuthenticated) {
            reportTab.classList.remove('hidden');
        }

    } catch (error) {
        console.error("Error during calculation:", error);
        errorMessage.textContent = `An error occurred: ${error instanceof Error ? error.message : String(error)}. Please check your inputs and try again.`;
        errorMessage.classList.remove("hidden");
    } finally {
        loadingIndicator.classList.add("hidden");
        calculateBtn.disabled = false;
        calculateBtn.textContent = "Calculate Required Ventilation";
    }
}

function performLocalCalculation(formData: { [key: string]: any }): { calculationResults: any, recommendations: string[] } {
    const getNumber = (id: string) => parseFloat(formData[id] as string);
    const getString = (id: string) => formData[id] as string;

    // Get raw inputs - all assumed to be in Imperial units
    const length = getNumber('length');
    const width = getNumber('width');
    const height = getNumber('height');
    const insideTemp = getNumber('inside-temp');
    const outsideTemp = getNumber('outside-temp');
    const windVelocity = getNumber('wind-velocity');
    const cvWindEffectiveness = getNumber('building-orientation');
    const terrainFactor = getNumber('surrounding-terrain');
    const kDischargeCoeff = getNumber('vent-opening-type');
    
    const inletObstruction = getNumber('inlet-obstruction');
    const outletObstruction = getNumber('outlet-obstruction');
    const method = getString("calculation-method");
    const gasType = getString('gas-type');
    const lfl = getNumber('lfl');
    const safetyFactor = getNumber('safety-factor');
    
    // Calculate leakRate from builder if applicable
    const leakRate = method === "fugitive-emission-method" 
        ? fugitiveSources.reduce((total, src) => total + (FUGITIVE_EMISSION_FACTORS[src.type].rateCFM * src.quantity), 0)
        : 0;


    // Constants (Imperial units)
    const R_AIR = 53.353; // ft·lbf/(lb·°R)
    const P_ATM = 2116.22; // psf
    const G = 32.2; // ft/s^2
    const C4_WIND_UNITS = 88.0; 

    // Intermediate Calculations (all in Imperial)
    const buildingVolume = length * width * height;
    const floorArea = length * width;
    const insideTempR = insideTemp + 459.67;
    const outsideTempR = outsideTemp + 459.67;

    if (insideTempR <= 0 || outsideTempR <= 0) throw new Error("Temperatures must be above absolute zero.");

    const airDensityInside = P_ATM / (R_AIR * insideTempR);
    const airDensityOutside = P_ATM / (R_AIR * outsideTempR);
    const airDensityDifference = Math.abs(airDensityInside - airDensityOutside);

    let requiredVentilationRate: number;
    let requiredRateFromACH: number | undefined;
    let requiredRateFromFloorArea: number | undefined;

    if (method === "area-method") {
        requiredRateFromACH = buildingVolume / 5;
        requiredRateFromFloorArea = floorArea * 1.5;
        requiredVentilationRate = Math.max(requiredRateFromACH, requiredRateFromFloorArea);
    } else { // fugitive-emission-method
        if (fugitiveSources.length === 0) throw new Error("Fugitive Emission Method requires at least one leak source.");
        if (isNaN(lfl) || isNaN(safetyFactor)) throw new Error("Missing LFL or Safety Factor for fugitive emission calculation.");
        requiredVentilationRate = leakRate / (safetyFactor * (lfl / 100));
    }

    const cEff = (inletObstruction + outletObstruction) / 2;
    const effectiveWindVelocity = windVelocity * terrainFactor;
    const windFlowPerArea = C4_WIND_UNITS * cvWindEffectiveness * effectiveWindVelocity * cEff;
    
    let stackFlowPerArea = 0;
    const rhoAvg = (airDensityInside + airDensityOutside) / 2;
    if (airDensityDifference > 1e-6) {
        stackFlowPerArea = 60 * kDischargeCoeff * cEff * Math.sqrt(G * height * airDensityDifference / rhoAvg);
    }
    const totalFlowPerArea = Math.sqrt(Math.pow(windFlowPerArea, 2) + Math.pow(stackFlowPerArea, 2));

    let finalRequiredArea: number; // in ft^2
    if (totalFlowPerArea < 1e-6) {
        finalRequiredArea = Infinity;
    } else {
        finalRequiredArea = requiredVentilationRate / totalFlowPerArea;
    }

    // NEW: Calculate Gross Areas
    const requiredGrossInletArea = isFinite(finalRequiredArea) && inletObstruction > 0 ? finalRequiredArea / inletObstruction : Infinity;
    const requiredGrossOutletArea = isFinite(finalRequiredArea) && outletObstruction > 0 ? finalRequiredArea / outletObstruction : Infinity;
    
    // Package results - all values are Imperial
    const units = { length: 'ft', temp: '°F', velocity: 'mph', flow: 'CFM', area: 'ft²' };
    const results = {
        method,
        units,
        length,
        width,
        height,
        insideTemp,
        outsideTemp,
        windVelocity,
        buildingVolume,
        floorArea,
        requiredVentilationRate,
        windFlowPerArea,
        stackFlowPerArea,
        totalFlowPerArea,
        finalRequiredArea, // This is free area
        requiredGrossInletArea,
        requiredGrossOutletArea,
        requiredRateFromACH,
        requiredRateFromFloorArea,
        leakRate,
        fugitiveSources: [...fugitiveSources], // Save a copy
        lfl,
        safetyFactor,
        gasType,
        airDensityInside,
        airDensityOutside,
        airDensityDifference,
        rhoAvg,
        cEff,
        insideTempR,
        outsideTempR,
        cvWindEffectiveness,
        terrainFactor,
        kDischargeCoeff,
        effectiveWindVelocity,
        inletObstruction,
        outletObstruction,
        R_AIR,
        P_ATM,
        G,
        C4_WIND_UNITS,
    };
    
    const recommendations = generateRecommendations(formData, results);

    return { calculationResults: results, recommendations };
}

function generateRecommendations(formData: { [key: string]: any }, results: any): string[] {
    const recommendations: string[] = [];
    const gasType = formData['gas-type'];

    // Gas Type guidance
    if (gasType === 'heavier-than-air') {
        recommendations.push("Critical: For heavier-than-air gases like propane, ventilation must be designed with high inlets and low outlets to effectively sweep vapors from floor level. The standard low-inlet/high-outlet design is ineffective and dangerous for these gases.");
    } else {
        recommendations.push("For lighter-than-air gases like natural gas, the standard design of low inlets and high outlets is correct, promoting natural convection and effective ventilation.");
    }

    // Wind Speed Analysis
    if (results.windVelocity < 5) {
        recommendations.push("The entered wind velocity is low. For a robust design, consider using a conservative, year-round average wind speed for the specific location (e.g., 7-10 mph).");
    }

    // Temperature Differential Analysis
    if (Math.abs(results.insideTemp - results.outsideTemp) < 10) {
        recommendations.push("The temperature difference is small, which minimizes the 'Stack Effect.' This makes ventilation highly dependent on wind. Ensure the average wind speed is reliable or consider scenarios with no temperature difference.");
    }
    
    // Vent Obstruction Analysis
    if (formData['inlet-obstruction'] === '1.0' || formData['outlet-obstruction'] === '1.0') {
        recommendations.push("An unobstructed vent was selected. Verify that no screens (bird, insect) or louvers will be installed, as these common items significantly reduce effective vent area.");
    }
    
    // Building Orientation Analysis
    if (formData['building-orientation'] === '0.25') {
        recommendations.push("A 'Parallel' building orientation provides the least effective wind-driven ventilation. If possible, orient vents to be perpendicular to prevailing winds, or consider a larger vent area to compensate.");
    }

    // Calculation Method Guidance
    if (results.method === 'area-method') {
        recommendations.push("The Area Method (AGA XL1001) is a conservative approach suitable for general-purpose buildings where specific leak sources are not defined. It ensures a baseline level of air quality and safety.");
    } else {
        recommendations.push("The Fugitive Emission Method (API RP 500) is ideal when you can quantify a potential leak rate. It provides a precise ventilation requirement to dilute a specific hazard to safe levels.");
        if (results.fugitiveSources.length > 0) {
            recommendations.push("The total leak rate was calculated based on the specified components. Ensure this list is comprehensive and reflects the actual equipment in the building for an accurate result.")
        }
    }

    // Outcome Feasibility
    const maxGrossArea = Math.max(results.requiredGrossInletArea, results.requiredGrossOutletArea);
    if (maxGrossArea > (results.floorArea * 0.1) && isFinite(maxGrossArea)) { // If vent area > 10% of floor area
        recommendations.push("The required gross vent area is very large relative to the building size. Natural ventilation may be insufficient or impractical. Consider evaluating building design or exploring mechanical ventilation options.");
    } else if (!isFinite(maxGrossArea)) {
        recommendations.push("The calculation resulted in an infinite area, meaning natural ventilation is impossible under the specified conditions (zero wind and no temperature difference). At least one driving force (wind or stack effect) is required.");
    }

    return recommendations;
}


function displayResults(results: any, recommendations: string[]): void {
  const grossInletArea = results.requiredGrossInletArea;
  const grossOutletArea = results.requiredGrossOutletArea;
  const units = results.units;

  const summaryResult = (isFinite(grossInletArea) && isFinite(grossOutletArea))
    ? `
        <div class="summary-grid">
            <div>
                <div class="summary-result">${grossInletArea.toFixed(2)} ${units.area}</div>
                <p>Required Gross Inlet Area</p>
            </div>
            <div>
                <div class="summary-result">${grossOutletArea.toFixed(2)} ${units.area}</div>
                <p>Required Gross Outlet Area</p>
            </div>
        </div>
        `
    : `<div class="summary-result">N/A</div><p class="warning">Calculation resulted in an invalid area. This may be due to identical inside/outside temperatures and zero wind, making natural ventilation impossible.</p>`;

  resultsContent.innerHTML = `
    <h2>Calculation Complete</h2>
    ${summaryResult}
    <div class="results-actions">
        <button id="save-calc-btn">Save Calculation to File</button>
    </div>
    <div id="results-recommendations"></div>
    <div id="results-visuals"></div>
    <div id="results-details"></div>
  `;

  document.getElementById('save-calc-btn')?.addEventListener('click', handleSaveCalculation);

  renderRecommendations(recommendations);
  renderVisualizations(results);
  renderDetailedSteps(results);

  resultsContent.classList.remove("hidden");
}

function renderRecommendations(recommendations: string[]) {
    const container = document.getElementById('results-recommendations');
    if (!container || recommendations.length === 0) return;

    const items = recommendations.map(rec => `<li class="${rec.startsWith('Critical') ? 'warning' : ''}">${rec}</li>`).join('');


    container.innerHTML = `
        <h3>Analysis & Recommendations</h3>
        <ul>${items}</ul>
    `;
}

function generateIsometricViewSvg(results: any): string {
    const l_orig = results.length;
    const w_orig = results.width;
    const h_orig = results.height;
    const gasType = results.gasType;

    const svgWidth = 250;
    const svgHeight = 160;
    const angle = Math.PI / 6; // 30 degrees
    const angleDeg = angle * 180 / Math.PI;

    const projectedWidth = (l_orig + w_orig) * Math.cos(angle);
    const projectedHeight = (l_orig + w_orig) * Math.sin(angle) + h_orig;
    
    const scale = (projectedWidth > 0 && projectedHeight > 0) 
        ? Math.min(
            (svgWidth * 0.9) / projectedWidth,
            (svgHeight * 0.75) / projectedHeight
          )
        : 1;

    const l = l_orig * scale;
    const w = w_orig * scale;
    const h = h_orig * scale;
    
    const finalProjWidth = (l + w) * Math.cos(angle);
    const finalProjHeight = (l + w) * Math.sin(angle) + h;

    const offsetX = (svgWidth - finalProjWidth) / 2;
    const offsetY = (svgHeight - finalProjHeight) / 2;
    
    const origin = { 
        x: offsetX + w * Math.cos(angle), 
        y: offsetY + finalProjHeight 
    };

    const len_vec = { x: l * Math.cos(angle), y: -l * Math.sin(angle) };
    const wid_vec = { x: -w * Math.cos(angle), y: -w * Math.sin(angle) };

    const p0 = { x: origin.x, y: origin.y };
    const p1 = { x: p0.x + len_vec.x, y: p0.y + len_vec.y };
    const p2 = { x: p0.x + wid_vec.x, y: p0.y + wid_vec.y };
    const p4 = { x: p0.x, y: p0.y - h };
    const p5 = { x: p1.x, y: p1.y - h };
    const p6 = { x: p2.x, y: p2.y - h };
    const p7 = { x: p5.x + wid_vec.x, y: p5.y + wid_vec.y };

    let inletArrowPath = '';
    let outletArrowPath = '';
    const arrowInset = 0.35;
    const arrowVerticalOffset = 0.2;
    const frontFaceLow = { x: p0.x + len_vec.x * arrowInset, y: p0.y + len_vec.y * arrowInset - h * arrowVerticalOffset };
    const frontFaceHigh = { x: p4.x + len_vec.x * arrowInset, y: p4.y + len_vec.y * arrowInset + h * arrowVerticalOffset };
    const sideFaceLow = { x: p0.x + wid_vec.x * (1 - arrowInset), y: p0.y + wid_vec.y * (1 - arrowInset) - h * arrowVerticalOffset };
    const sideFaceHigh = { x: p4.x + wid_vec.x * (1 - arrowInset), y: p4.y + wid_vec.y * (1 - arrowInset) + h * arrowVerticalOffset };
    const arrowLength = 40;
    if (gasType === 'heavier-than-air') {
        inletArrowPath = `M ${frontFaceHigh.x + arrowLength},${frontFaceHigh.y} L ${frontFaceHigh.x},${frontFaceHigh.y}`;
        outletArrowPath = `M ${sideFaceLow.x},${sideFaceLow.y} L ${sideFaceLow.x - arrowLength},${sideFaceLow.y}`;
    } else {
        inletArrowPath = `M ${frontFaceLow.x + arrowLength},${frontFaceLow.y} L ${frontFaceLow.x},${frontFaceLow.y}`;
        outletArrowPath = `M ${sideFaceHigh.x},${sideFaceHigh.y} L ${sideFaceHigh.x - arrowLength},${sideFaceHigh.y}`;
    }
    
    const lengthLabelX = (p4.x + p5.x) / 2;
    const lengthLabelY = (p4.y + p5.y) / 2;
    const widthLabelX = (p4.x + p6.x) / 2;
    const widthLabelY = (p4.y + p6.y) / 2;
    const heightLabelX = p5.x + 8;
    const heightLabelY = p5.y + h / 2;

    return `
      <svg class="building-diagram" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                <polygon class="arrow-head" points="0 0, 10 3.5, 0 7" />
            </marker>
        </defs>
        <polygon points="${p0.x},${p0.y} ${p1.x},${p1.y} ${p5.x},${p5.y} ${p4.x},${p4.y}" fill="#e0e0e0" fill-opacity="0.4" stroke="#e0e0e0" stroke-width="0.75"/>
        <polygon points="${p0.x},${p0.y} ${p2.x},${p2.y} ${p6.x},${p6.y} ${p4.x},${p4.y}" fill="#e0e0e0" fill-opacity="0.6" stroke="#e0e0e0" stroke-width="0.75"/>
        <polygon points="${p4.x},${p4.y} ${p5.x},${p5.y} ${p7.x},${p7.y} ${p6.x},${p6.y}" fill="#e0e0e0" fill-opacity="0.8" stroke="#e0e0e0" stroke-width="0.75"/>
        <path class="flow-arrow" d="${inletArrowPath}" marker-end="url(#arrowhead)" />
        <path class="flow-arrow" d="${outletArrowPath}" marker-end="url(#arrowhead)" />
        <text x="${lengthLabelX}" y="${lengthLabelY - 4}" transform="rotate(${-angleDeg} ${lengthLabelX} ${lengthLabelY})" text-anchor="middle" font-size="8" fill="#e0e0e0">Length: ${l_orig.toFixed(1)} ft</text>
        <text x="${widthLabelX}" y="${widthLabelY - 4}" transform="rotate(${angleDeg} ${widthLabelX} ${widthLabelY})" text-anchor="middle" font-size="8" fill="#e0e0e0">Width: ${w_orig.toFixed(1)} ft</text>
        <text x="${heightLabelX}" y="${heightLabelY}" transform="rotate(-90 ${heightLabelX} ${heightLabelY})" text-anchor="middle" font-size="8" fill="#e0e0e0">Height: ${h_orig.toFixed(1)} ft</text>
      </svg>
    `;
}

function renderVisualizations(results: any) {
    const visualsContainer = document.getElementById('results-visuals');
    if (!visualsContainer) return;

    const totalFlow = results.totalFlowPerArea;
    const windPerc = totalFlow > 0 ? (Math.pow(results.windFlowPerArea, 2) / Math.pow(totalFlow, 2)) * 100 : 0;
    const stackPerc = totalFlow > 0 ? (Math.pow(results.stackFlowPerArea, 2) / Math.pow(totalFlow, 2)) * 100 : 0;
    
    const diagramSvg = generateIsometricViewSvg(results);

    visualsContainer.innerHTML = `
      <h3>Visualizations</h3>
      <div class="visuals-grid">
        <div class="building-diagram-container">
            <h4>Building Isometric View</h4>
            ${diagramSvg}
        </div>
        <div class="contribution-chart-container">
          <h4>Ventilation Force Contribution</h4>
          <div class="contribution-chart">
              <div class="bar-label">Wind Effect (${windPerc.toFixed(2)}%)</div>
              <div class="bar" style="width: ${windPerc.toFixed(2)}%"></div>
              <div class="bar-label">Stack Effect (${stackPerc.toFixed(2)}%)</div>
              <div class="bar stack" style="width: ${stackPerc.toFixed(2)}%"></div>
          </div>
        </div>
      </div>
    `;
}


function renderDetailedSteps(results: any) {
    const detailsContainer = document.getElementById('results-details');
    if (!detailsContainer) return;

    // Constants Table
    const constantsHtml = `
      <div class="calculation-step">
        <p class="formula">Constants Used in Calculation</p>
        <table class="data-table">
            <tr><td>Atmospheric Pressure (P_atm)</td><td>${results.P_ATM.toFixed(2)} psf</td></tr>
            <tr><td>Gas Constant for Air (R_air)</td><td>${results.R_AIR.toFixed(3)} ft·lbf/(lb·°R)</td></tr>
            <tr><td>Gravitational Acceleration (g)</td><td>${results.G.toFixed(1)} ft/s²</td></tr>
            <tr><td>Wind Units Conversion (C4)</td><td>${results.C4_WIND_UNITS.toFixed(1)}</td></tr>
        </table>
      </div>
    `;

    // Step 1: Qv
    let step1Html = '';
    if (results.method === 'area-method') {
        step1Html = `
            <p>Based on the Area Method (AGA XL1001), the required ventilation rate (Qv) is the greater of two calculations: one based on air changes per hour (ACH) and one based on floor area.</p>
            <div class="calculation-step">
                <p class="formula">1. Rate based on Air Changes (Qv_ACH)</p>
                <p class="sub-calculation">Building Volume = L × W × H = ${results.length.toFixed(2)} × ${results.width.toFixed(2)} × ${results.height.toFixed(2)} = ${results.buildingVolume.toFixed(2)} ft³</p>
                <p class="calculation">Qv_ACH = Building Volume / 5 min = ${results.buildingVolume.toFixed(2)} / 5 = <strong>${results.requiredRateFromACH.toFixed(2)} ${results.units.flow}</strong></p>
            </div>
            <div class="calculation-step">
                <p class="formula">2. Rate based on Floor Area (Qv_Floor)</p>
                <p class="sub-calculation">Floor Area = L × W = ${results.length.toFixed(2)} × ${results.width.toFixed(2)} = ${results.floorArea.toFixed(2)} ft²</p>
                <p class="calculation">Qv_Floor = Floor Area × 1.5 CFM/ft² = ${results.floorArea.toFixed(2)} × 1.5 = <strong>${results.requiredRateFromFloorArea.toFixed(2)} ${results.units.flow}</strong></p>
            </div>
             <p class="info-note">The controlling rate is the larger of the two values: <strong>${results.requiredVentilationRate.toFixed(2)} ${results.units.flow}</strong>.</p>
        `;
    } else { // fugitive-emission-method
        const sourcesTableRows = results.fugitiveSources.map((src: any) => `
            <tr>
                <td>${FUGITIVE_EMISSION_FACTORS[src.type].label}</td>
                <td>${src.quantity}</td>
                <td>${(FUGITIVE_EMISSION_FACTORS[src.type].rateCFM * src.quantity).toFixed(2)}</td>
            </tr>
        `).join('');

        step1Html = `
            <p>Based on the Fugitive Emission Method (API RP 500), the total leak rate (Q_leak) is first calculated from the sum of all potential component leaks.</p>
            <div class="calculation-step">
                <p class="formula">1. Total Leak Rate (Q_leak)</p>
                <table class="data-table">
                    <thead><tr><th>Component</th><th>Quantity</th><th>Subtotal Leak Rate (CFM)</th></tr></thead>
                    <tbody>${sourcesTableRows}</tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2"><strong>Total Calculated Leak Rate (Q_leak)</strong></td>
                            <td><strong>${results.leakRate.toFixed(2)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <p>This total leak rate is then used to calculate the required ventilation rate (Qv) to dilute the potential gas leak to a safe concentration.</p>
            <div class="calculation-step">
                 <p class="formula">2. Required Ventilation Rate (Qv)</p>
                 <p class="sub-calculation">Qv = Q_leak / (C × (LFL/100))</p>
                 <ul>
                    <li>Q_leak (Total Leak Rate) = ${results.leakRate.toFixed(2)} ${results.units.flow}</li>
                    <li>C (Safety Factor) = ${results.safetyFactor}</li>
                    <li>LFL (Lower Flammable Limit) = ${results.lfl}%</li>
                 </ul>
                 <p class="calculation">Qv = ${results.leakRate.toFixed(2)} / (${results.safetyFactor} × (${results.lfl} / 100)) = <strong>${results.requiredVentilationRate.toFixed(2)} ${results.units.flow}</strong></p>
            </div>
        `;
    }

    // Step 2: Driving Forces
    const step2Html = `
        <p>Natural ventilation is driven by two forces: the Wind Effect and the Stack Effect. The total driving force is the vector sum of these two components.</p>
        
        <div class="calculation-step">
             <p class="formula">Prerequisite: Effective Obstruction Coefficient (C_eff)</p>
             <p class="sub-calculation">This coefficient represents the combined effect of any obstructions on the inlet and outlet vents. It is the average of the two free area percentages.</p>
             <p class="calculation">C_eff = (Inlet Obstruction + Outlet Obstruction) / 2 = (${results.inletObstruction.toFixed(2)} + ${results.outletObstruction.toFixed(2)}) / 2 = <strong>${results.cEff.toFixed(2)}</strong></p>
        </div>

        <div class="calculation-step">
            <p class="formula">1. Wind Effect (F_w)</p>
            <p class="sub-calculation">Effective Wind Velocity (V_eff) = Avg. Wind Velocity × Terrain Factor = ${results.windVelocity.toFixed(2)} mph × ${results.terrainFactor} = <strong>${results.effectiveWindVelocity.toFixed(2)} mph</strong></p>
            <p class="sub-calculation">The Wind Effectiveness coefficient (Cv) is set to <strong>${results.cvWindEffectiveness.toString()}</strong> based on the selected building orientation. This coefficient accounts for the angle of the prevailing wind relative to the vent openings.</p>
            <p class="calculation">Wind Flow per Area (F_w) = C4 × Cv × V_eff × C_eff = ${results.C4_WIND_UNITS.toFixed(1)} × ${results.cvWindEffectiveness.toString()} × ${results.effectiveWindVelocity.toFixed(2)} × ${results.cEff.toFixed(2)} = <strong>${results.windFlowPerArea.toFixed(2)} ${results.units.flow}/${results.units.area}</strong></p>
        </div>
        <div class="info-note" style="text-align: left; margin: 1rem 0;">Note on Stack Effect: This calculation uses a formula based on the difference in air density between the inside and outside of the building. This is a first-principles approach derived from the Ideal Gas Law and provides a more accurate result across a wide range of temperatures than simplified handbook equations.</div>
        <div class="calculation-step">
            <p class="formula">2. Stack Effect (F_s)</p>
            <p class="sub-calculation">Temperatures are converted to the Rankine scale for thermodynamic calculations (T(°R) = T(°F) + 459.67):</p>
            <ul>
                <li>Inside Temp (T_in): ${results.insideTemp.toFixed(2)} °F + 459.67 = ${results.insideTempR.toFixed(2)} °R</li>
                <li>Outside Temp (T_out): ${results.outsideTemp.toFixed(2)} °F + 459.67 = ${results.outsideTempR.toFixed(2)} °R</li>
            </ul>
             <p class="sub-calculation">
                Air densities (ρ) are calculated using the Ideal Gas Law (ρ = P_atm / (R_air × T_R)):
                <ul>
                    <li>Inside (ρ_in): ${results.P_ATM.toFixed(2)} / (${results.R_AIR.toFixed(3)} × ${results.insideTempR.toFixed(2)}) = ${results.airDensityInside.toPrecision(4)} lb/ft³</li>
                    <li>Outside (ρ_out): ${results.P_ATM.toFixed(2)} / (${results.R_AIR.toFixed(3)} × ${results.outsideTempR.toFixed(2)}) = ${results.airDensityOutside.toPrecision(4)} lb/ft³</li>
                    <li>Difference (|Δρ|): |${results.airDensityInside.toPrecision(4)} - ${results.airDensityOutside.toPrecision(4)}| = ${results.airDensityDifference.toPrecision(4)} lb/ft³</li>
                </ul>
            </p>
            <p class="sub-calculation">Average air density (ρ_avg) is calculated for the stack effect equation:
                <br>ρ_avg = (ρ_in + ρ_out) / 2 = (${results.airDensityInside.toPrecision(4)} + ${results.airDensityOutside.toPrecision(4)}) / 2 = <strong>${results.rhoAvg.toPrecision(4)} lb/ft³</strong>
            </p>
            <p class="sub-calculation">The Discharge Coefficient (K) for the selected vent type is <strong>${results.kDischargeCoeff}</strong>.</p>
            <p class="calculation">Stack Flow per Area (F_s) = 60 × K × C_eff × √(g × H × |Δρ| / ρ_avg) = 60 × ${results.kDischargeCoeff} × ${results.cEff.toFixed(2)} × √(${results.G.toFixed(1)} × ${results.height.toFixed(2)} × ${results.airDensityDifference.toPrecision(4)} / ${results.rhoAvg.toPrecision(4)}) = <strong>${results.stackFlowPerArea.toFixed(2)} ${results.units.flow}/${results.units.area}</strong></p>
        </div>
         <div class="calculation-step">
            <p class="formula">3. Total Flow per Unit Area (F_total)</p>
            <p class="calculation">F_total = √(F_w² + F_s²) = √(${results.windFlowPerArea.toFixed(2)}² + ${results.stackFlowPerArea.toFixed(2)}²) = <strong>${results.totalFlowPerArea.toFixed(2)} ${results.units.flow}/${results.units.area}</strong></p>
        </div>
    `;

    // Step 3: Final Free Area
    const step3Html = `
        <p>The required vent free area is the total required ventilation rate divided by the total flow per unit area available from natural forces.</p>
        <div class="calculation-step">
            <p class="formula">Required Vent Free Area (A_req)</p>
            <p class="calculation">A_req = Qv / F_total = ${results.requiredVentilationRate.toFixed(2)} / ${results.totalFlowPerArea.toFixed(2)} = <strong>${isFinite(results.finalRequiredArea) ? results.finalRequiredArea.toFixed(2) + ` ${results.units.area}` : 'N/A'}</strong></p>
            <p class="info-note">This is the required *free* area for BOTH the inlet and outlet vents.</p>
        </div>
    `;

    // NEW: Step 4 for Gross Area
    const step4Html = `
        <p>The gross area for each vent is determined by dividing the required free area by the obstruction factor (the percentage of the area that is open).</p>
        <div class="calculation-step">
            <p class="formula">Required Gross Inlet Area (A_gross_in)</p>
            <p class="calculation">A_gross_in = A_req / Obstruction_in = ${results.finalRequiredArea.toFixed(2)} / ${results.inletObstruction.toFixed(2)} = <strong>${isFinite(results.requiredGrossInletArea) ? results.requiredGrossInletArea.toFixed(2) + ` ${results.units.area}` : 'N/A'}</strong></p>
        </div>
        <div class="calculation-step">
            <p class="formula">Required Gross Outlet Area (A_gross_out)</p>
            <p class="calculation">A_gross_out = A_req / Obstruction_out = ${results.finalRequiredArea.toFixed(2)} / ${results.outletObstruction.toFixed(2)} = <strong>${isFinite(results.requiredGrossOutletArea) ? results.requiredGrossOutletArea.toFixed(2) + ` ${results.units.area}` : 'N/A'}</strong></p>
        </div>
    `;

    // Assemble final HTML
    detailsContainer.innerHTML = `
      <h3>Detailed Calculation Steps</h3>
      <h4>Calculation Constants</h4>
      ${constantsHtml}
      <h4>Step 1: Determine Required Ventilation Rate (Qv)</h4>
      ${step1Html}
      <h4>Step 2: Calculate Natural Ventilation Driving Forces</h4>
      ${step2Html}
      <h4>Step 3: Calculate Required Vent Free Area</h4>
      ${step3Html}
      <h4>Step 4: Calculate Required Gross Vent Areas</h4>
      ${step4Html}
    `;
}

// --- Save / Load ---
function handleSaveCalculation() {
    if (!lastCalculationData) return;

    const dataToSave = {
        formData: lastCalculationData.formData,
        results: lastCalculationData.results,
        recommendations: lastCalculationData.recommendations,
        fugitiveSources: fugitiveSources, // Save the sources
    };
    
    const jsonString = JSON.stringify(dataToSave, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const projectName = lastCalculationData.formData['project-name'] || 'ventilation-calculation';
    a.download = `${projectName.replace(/ /g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function handleLoadCalculation(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        try {
            const text = e.target?.result as string;
            const loadedData = JSON.parse(text);

            if (!loadedData.formData || !loadedData.results) {
                throw new Error("Invalid calculation file format.");
            }

            // Populate form
            for (const key in loadedData.formData) {
                const element = document.getElementById(key) as HTMLInputElement | HTMLSelectElement;
                if (element) {
                    element.value = loadedData.formData[key];
                }
            }
            
            // Trigger change event for method selector to show/hide relevant fields
            calculationMethodSelect.dispatchEvent(new Event('change'));
            
            // Re-run calculation and display results from the loaded file
            await runCalculation(loadedData);

        } catch (error) {
            console.error("Failed to load or parse calculation file:", error);
            alert(`Error loading file: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            // Reset file input to allow loading the same file again
            input.value = '';
        }
    };

    reader.onerror = () => {
        alert("Error reading file.");
    };

    reader.readAsText(file);
}


// --- PDF and LaTeX Report Generation ---

function getSelectText(id: string): string {
    const select = document.getElementById(id) as HTMLSelectElement;
    if (select && select.selectedIndex !== -1) {
        return select.options[select.selectedIndex].text;
    }
    return 'N/A';
};

function renderResultsSummaryReport(results: any, formData: any, recommendations: string[]) {
    const {
        method, units, length, width, height, insideTemp, outsideTemp, windVelocity,
        requiredGrossInletArea, requiredGrossOutletArea, leakRate, lfl, safetyFactor, fugitiveSources
    } = results;

    const methodTitle = method === 'area-method' ? 'Area Method (AGA XL1001)' : 'Fugitive Emission Method (API RP 500)';
    
    let fugitiveInputsHtml = '';
    if (method === 'fugitive-emission-method') {
        const sourceRows = fugitiveSources.map((src: any) => `
            <tr>
                <td>${FUGITIVE_EMISSION_FACTORS[src.type].label}</td>
                <td>${src.quantity}</td>
                <td>${(FUGITIVE_EMISSION_FACTORS[src.type].rateCFM * src.quantity).toFixed(2)}</td>
            </tr>
        `).join('');

        fugitiveInputsHtml = `
            <tr><td colspan="3" class="table-section-header"><em>Fugitive Emission Sources</em></td></tr>
            <tr>
                <td colspan="3">
                    <table class="data-table">
                        <thead><tr><th>Component</th><th>Qty</th><th>Leak Rate (CFM)</th></tr></thead>
                        <tbody>${sourceRows}</tbody>
                    </table>
                </td>
            </tr>
            <tr><td><strong>Total Leak Rate (Q_leak)</strong></td><td><strong>${leakRate.toFixed(2)}</strong></td><td><strong>${units.flow}</strong></td></tr>
            <tr><td>Gas LFL</td><td>${lfl}</td><td>%</td></tr>
            <tr><td>Safety Factor (C)</td><td>${safetyFactor}</td><td>--</td></tr>
        `;
    }

    const recommendationsHtml = recommendations.map(rec => `<li>${rec}</li>`).join('');

    const areaMethodDescription = `The Area Method, as outlined in AGA Report No. XL1001, provides a conservative approach for determining ventilation requirements in general-purpose buildings where specific sources of gas release are not defined. The required ventilation rate is determined as the greater of two calculations: one based on achieving a minimum number of air changes per hour (ACH), and another based on the building's floor area. This ensures a baseline level of air quality and safety by providing sufficient airflow to dilute minor, unforeseen fugitive emissions.`;
    const fugitiveMethodDescription = `The Fugitive Emission Method, based on guidelines from API Recommended Practice 500, is a targeted approach used when a potential leak source can be quantified. This method calculates the precise ventilation rate required to dilute the substance from a known potential leak (Q_leak) to a concentration well below its Lower Flammable Limit (LFL). A safety factor (C), typically 0.25 for 25% LFL, is applied to ensure the atmosphere remains non-hazardous. This method is ideal for enclosures containing equipment with known or estimated leak rates.`;
    const methodDescription = method === 'area-method' ? areaMethodDescription : fugitiveMethodDescription;

    const assumptions = [
        "Inlet and outlet vents are of equal size.",
        "Inlet vents are located near the floor, and outlet vents are located near the roof peak.",
        "The building is considered reasonably well-sealed, with leakage primarily through the specified ventilation openings.",
        "Air density is assumed to be uniform at any given level inside and outside the building.",
        "The calculation is based on steady-state conditions, not accounting for short-term gusts or lulls in wind.",
        "The provided average wind speed is representative of the conditions at the building's location and height.",
        "Obstructions like louvers and screens are accounted for by a uniform reduction coefficient applied to the entire vent area."
    ];
    const assumptionsHtml = assumptions.map(item => `<li>${item}</li>`).join('');
    
    const reportHtml = `
        <h2>Calculation Report</h2>
        <div class="results-actions">
            <button id="download-summary-pdf-btn">Download Report as PDF</button>
        </div>

        <h3>Executive Summary</h3>
        <p>This report details the calculation of required natural ventilation for the specified building, based on the <strong>${methodTitle}</strong>. The objective was to determine the necessary gross area for both inlet and outlet vents to ensure adequate air exchange for electrical area classification purposes. The final required gross ventilation area is <strong>${isFinite(requiredGrossInletArea) ? requiredGrossInletArea.toFixed(2) : 'Not Achievable'} ${units.area}</strong> for the inlet and <strong>${isFinite(requiredGrossOutletArea) ? requiredGrossOutletArea.toFixed(2) : 'Not Achievable'} ${units.area}</strong> for the outlet.</p>

        <h3>Input Data Summary</h3>
        <table class="data-table">
            <thead><tr><th>Parameter</th><th>Value</th><th>Unit</th></tr></thead>
            <tbody>
                <tr><td colspan="3" class="table-section-header"><em>Project Information</em></td></tr>
                <tr><td>Project Name</td><td>${formData['project-name']}</td><td>--</td></tr>
                <tr><td>Location</td><td>${formData.location}</td><td>--</td></tr>
                <tr><td>Company</td><td>${formData.company}</td><td>--</td></tr>
                <tr><td>Performed By</td><td>${formData['performed-by']}</td><td>--</td></tr>
                <tr><td>Date</td><td>${formData.date}</td><td>--</td></tr>
                <tr><td>Calculation Goal</td><td>${getSelectText('calculation-goal')}</td><td>--</td></tr>
                <tr><td colspan="3" class="table-section-header"><em>Building & Environmental Data</em></td></tr>
                <tr><td>Gas Type</td><td>${getSelectText('gas-type')}</td><td>--</td></tr>
                <tr><td>Building Length (L)</td><td>${length.toFixed(2)}</td><td>${units.length}</td></tr>
                <tr><td>Building Width (W)</td><td>${width.toFixed(2)}</td><td>${units.length}</td></tr>
                <tr><td>Vertical Vent Separation (H)</td><td>${height.toFixed(2)}</td><td>${units.length}</td></tr>
                <tr><td>Inside Temperature (T_in)</td><td>${insideTemp.toFixed(2)}</td><td>${units.temp}</td></tr>
                <tr><td>Outside Temperature (T_out)</td><td>${outsideTemp.toFixed(2)}</td><td>${units.temp}</td></tr>
                <tr><td>Average Wind Velocity (V)</td><td>${windVelocity.toFixed(2)}</td><td>${units.velocity}</td></tr>
                <tr><td>Building Orientation</td><td>${getSelectText('building-orientation')}</td><td>--</td></tr>
                <tr><td>Surrounding Terrain</td><td>${getSelectText('surrounding-terrain')}</td><td>--</td></tr>
                <tr><td>Vent Opening Type</td><td>${getSelectText('vent-opening-type')}</td><td>--</td></tr>
                <tr><td>Inlet Vent Obstruction</td><td>${getSelectText('inlet-obstruction')}</td><td>--</td></tr>
                <tr><td>Outlet Vent Obstruction</td><td>${getSelectText('outlet-obstruction')}</td><td>--</td></tr>
                <tr><td colspan="3" class="table-section-header"><em>Calculation Method</em></td></tr>
                <tr><td>Method Selected</td><td colspan="2">${methodTitle}</td></tr>
                ${fugitiveInputsHtml}
            </tbody>
        </table>

        <h3>Methodology and Standards</h3>
        <p>${methodDescription}</p>
        <div class="info-note" style="text-align: left; padding: 1rem; margin-top: 1rem; margin-bottom: 1rem;">
            Note on Stack Effect: This calculation uses a formula based on the difference in air density between the inside and outside of the building. This is a first-principles approach derived from the Ideal Gas Law and provides a more accurate result across a wide range of temperatures than simplified handbook equations.
        </div>

        <h3>Governing Equations</h3>
        <p>The calculation follows a three-step process: determining the required ventilation rate (Qv), calculating the available natural forces per unit area (F_total), and then finding the required area (A_req = Qv / F_total). The key equations are:</p>
        <div class="calculation-step">
            <p class="formula">A_req = Qv / &radic;(F_w² + F_s²)</p>
            <ul>
                <li><strong>A_req</strong>: Required Vent Area (ft²)</li>
                <li><strong>Qv</strong>: Required Ventilation Rate (CFM)</li>
                <li><strong>F_w</strong>: Wind Effect per unit area (CFM/ft²)</li>
                <li><strong>F_s</strong>: Stack Effect per unit area (CFM/ft²)</li>
            </ul>
        </div>
        
        <div id="detailed-steps-clone"></div>

        <h3>Assumptions</h3>
        <ul>${assumptionsHtml}</ul>

        <h3>Final Results</h3>
        <table class="data-table">
            <thead><tr><th>Description</th><th>Value</th></tr></thead>
            <tbody>
                <tr><td>Required Gross Inlet Area</td><td>${isFinite(requiredGrossInletArea) ? requiredGrossInletArea.toFixed(2) + ` ${units.area}` : 'N/A'}</td></tr>
                <tr><td>Required Gross Outlet Area</td><td>${isFinite(requiredGrossOutletArea) ? requiredGrossOutletArea.toFixed(2) + ` ${units.area}` : 'N/A'}</td></tr>
            </tbody>
        </table>
        
        <h3>Conclusion</h3>
        <p>The total required gross area for natural ventilation has been calculated to be <strong>${isFinite(requiredGrossInletArea) ? requiredGrossInletArea.toFixed(2) : 'Not Achievable'} ${units.area}</strong> for the air inlet and <strong>${isFinite(requiredGrossOutletArea) ? requiredGrossOutletArea.toFixed(2) : 'Not Achievable'} ${units.area}</strong> for the air outlet. This is based on the input parameters and the <strong>${methodTitle}</strong> methodology.</p>
        
        <h3>Analysis & Recommendations</h3>
        <p>The following recommendations should be considered for the final design:</p>
        <ul>${recommendationsHtml}</ul>
    `;
    resultsSummaryContent.innerHTML = reportHtml;

    // Clone the detailed steps from the main results page into the report
    const originalDetails = document.getElementById('results-details');
    const cloneTarget = document.getElementById('detailed-steps-clone');
    if(originalDetails && cloneTarget) {
        cloneTarget.innerHTML = originalDetails.innerHTML;
    }

    // Add event listener for the new PDF download button
    document.getElementById('download-summary-pdf-btn')?.addEventListener('click', async () => {
        await generateSummaryPdfReport(formData, results, recommendations, assumptions, methodDescription);
    });
}

const addVisualsToPdf = async (doc: jsPDF, results: any, startY: number): Promise<number> => {
    let y = startY;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const contentWidth = doc.internal.pageSize.getWidth() - 2 * margin;

    const addHeading = (text: string) => {
        if (y > pageHeight - 25) { doc.addPage(); y = margin; }
        doc.setFontSize(12);
        doc.text(text, margin, y);
        y += 8;
    };

    if (y > pageHeight - 150) { 
        doc.addPage();
        y = margin;
    }

    addHeading('Visual Summary');
    y += 2;

    const addIsometricPromise = new Promise<void>((resolve) => {
        const svgString = generateIsometricViewSvg(results);
        const img = new Image();
        const svgUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const svgWidth = 250;
            const svgHeight = 160;
            canvas.width = svgWidth * 2; // Increase resolution
            canvas.height = svgHeight * 2;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                const pngUrl = canvas.toDataURL('image/png');
                
                doc.setFontSize(10);
                doc.text('Building Isometric View', margin, y);
                y += 5;
                
                const imgProps = doc.getImageProperties(pngUrl);
                const imgWidth = contentWidth * 0.7;
                const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

                if (y + imgHeight > pageHeight - margin) {
                    doc.addPage(); y = margin;
                }
                
                const xOffset = (contentWidth - imgWidth) / 2;
                doc.addImage(pngUrl, 'PNG', margin + xOffset, y, imgWidth, imgHeight);
                y += imgHeight + 10;
            }
            resolve();
        };
        img.onerror = () => {
            console.error("Failed to load SVG for PDF.");
            resolve();
        };
        img.src = svgUrl;
    });

    await addIsometricPromise;

    if (y > pageHeight - 60) { doc.addPage(); y = margin; }

    doc.setFontSize(10);
    doc.text('Ventilation Force Contribution', margin, y);
    y += 7;

    const totalFlow = results.totalFlowPerArea;
    const windPerc = totalFlow > 0 ? (Math.pow(results.windFlowPerArea, 2) / Math.pow(totalFlow, 2)) * 100 : 0;
    const stackPerc = totalFlow > 0 ? (Math.pow(results.stackFlowPerArea, 2) / Math.pow(totalFlow, 2)) * 100 : 0;
    
    const barHeight = 8;
    const barWidth = contentWidth * 0.8;
    const barX = margin + (contentWidth - barWidth) / 2;

    doc.setFontSize(9);
    doc.text(`Wind Effect (${windPerc.toFixed(1)}%)`, margin, y);
    y += 5;
    doc.setFillColor(0, 123, 255);
    doc.rect(barX, y, barWidth * (windPerc / 100), barHeight, 'F');
    y += barHeight + 5;

    doc.text(`Stack Effect (${stackPerc.toFixed(1)}%)`, margin, y);
    y += 5;
    doc.setFillColor(40, 167, 69);
    doc.rect(barX, y, barWidth * (stackPerc / 100), barHeight, 'F');
    y += barHeight + 10;
    
    return y;
};


async function generateSummaryPdfReport(formData: any, results: any, recommendations: string[], assumptions: string[], methodDescription: string) {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    let y = margin;

    const addTitle = (text: string) => {
        if (y > pageHeight - 30) { doc.addPage(); y = margin; }
        doc.setFontSize(16);
        doc.text(text, margin, y);
        y += 10;
    };
    
    const addHeading = (text: string) => {
        if (y > pageHeight - 25) { doc.addPage(); y = margin; }
        doc.setFontSize(12);
        doc.text(text, margin, y);
        y += 8;
    };

    const addText = (text: string | string[], indent = 0) => {
        if (y > pageHeight - 20) { doc.addPage(); y = margin; }
        doc.setFontSize(10);
        const textToSplit = Array.isArray(text) ? text.join('\n') : text;
        const lines = doc.splitTextToSize(textToSplit, 180 - indent);
        doc.text(lines, margin + indent, y);
        y += lines.length * 5;
    };
    
    const addDiagramToPdf = (doc: jsPDF): Promise<void> => {
        return new Promise((resolve) => {
            if (diagramState.equipment.length === 0) {
                resolve();
                return;
            }

            const svgElement = document.getElementById('diagram-canvas') as unknown as SVGSVGElement;
            if (!svgElement) {
                resolve();
                return;
            }
            
            // FIX: Create a styled clone of the SVG for export.
            const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
            svgClone.setAttribute('width', svgElement.clientWidth.toString());
            svgClone.setAttribute('height', svgElement.clientHeight.toString());

            let cssText = '';
            const relevantSelectors = ['.building-outline', '.equipment-icon', '.zone-div1', '.zone-div2', 'text'];
            // Find all relevant CSS rules from loaded stylesheets and embed them.
            for (const sheet of Array.from(document.styleSheets)) {
                try {
                    if (!sheet.cssRules) continue;
                    for (const rule of Array.from(sheet.cssRules)) {
                        if (rule instanceof CSSStyleRule && relevantSelectors.some(s => rule.selectorText.includes(s))) {
                            cssText += rule.cssText + '\n';
                        }
                    }
                } catch (e) {
                    console.warn("Could not read CSS rules from stylesheet: " + sheet.href, e);
                }
            }
    
            const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
            styleElement.textContent = cssText;
            svgClone.prepend(styleElement);

            const svgString = new XMLSerializer().serializeToString(svgClone);
            const img = new Image();
            const svgUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));

            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Increase resolution for better PDF quality
                canvas.width = svgElement.clientWidth * 2;
                canvas.height = svgElement.clientHeight * 2;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const pngUrl = canvas.toDataURL('image/png');
                    
                    const imgProps = doc.getImageProperties(pngUrl);
                    const pdfWidth = doc.internal.pageSize.getWidth() - 2 * margin;
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    
                    // FIX: Correct page break logic. Check if space is available before adding content.
                    const neededHeight = 8 + 10 + 5 + pdfHeight + 10; // Heading, text, spacing, image, bottom margin
                    if (y + neededHeight > pageHeight - margin) {
                        doc.addPage();
                        y = margin;
                    }

                    addHeading('Hazardous Area Classification Diagram');
                    addText('The following is a top-down, to-scale diagram of the building floor plan with classified areas based on the placed equipment.');
                     y += 5;

                    doc.addImage(pngUrl, 'PNG', margin, y, pdfWidth, pdfHeight);
                    y += pdfHeight + 10;
                }
                resolve();
            };
            img.onerror = () => {
                console.error("Failed to load SVG as image for PDF generation.");
                resolve();
            };
            img.src = svgUrl;
        });
    };

    // --- Header ---
    addTitle('Natural Ventilation Calculation Report');
    addText(`Project: ${formData['project-name'] || 'N/A'}`);
    addText(`Date: ${formData.date || 'N/A'}`);
    y += 5;

    // --- Executive Summary ---
    addHeading('Executive Summary');
    const methodTitle = results.method === 'area-method' ? 'Area Method (AGA XL1001)' : 'Fugitive Emission Method (API RP 500)';
    addText(`This report details the calculation of required natural ventilation for the specified building, based on the ${methodTitle}. The final required gross ventilation area is ${isFinite(results.requiredGrossInletArea) ? results.requiredGrossInletArea.toFixed(2) : 'Not Achievable'} ${results.units.area} for the inlet and ${isFinite(results.requiredGrossOutletArea) ? results.requiredGrossOutletArea.toFixed(2) : 'Not Achievable'} ${results.units.area} for the outlet.`);
    y += 5;
    
    // --- Visual Summary ---
    y = await addVisualsToPdf(doc, results, y);

    // --- Final Results Table ---
    addHeading('Final Results');
    autoTable(doc, {
        startY: y,
        head: [['Description', 'Value']],
        body: [
            ['Required Gross Inlet Area', `${isFinite(results.requiredGrossInletArea) ? results.requiredGrossInletArea.toFixed(2) + ` ${results.units.area}` : 'N/A'}`],
            ['Required Gross Outlet Area', `${isFinite(results.requiredGrossOutletArea) ? results.requiredGrossOutletArea.toFixed(2) + ` ${results.units.area}` : 'N/A'}`]
        ],
        theme: 'grid'
    });
    y = (doc as any).lastAutoTable.finalY + 10;
    
    // --- Input Data ---
    addHeading('Input Data Summary');
    
    let fugitiveRows: any[] = [];
    if (results.method === 'fugitive-emission-method') {
        fugitiveRows.push([{ content: 'Fugitive Emission Sources', colSpan: 3, styles: { fontStyle: 'bold' } }]);
        
        results.fugitiveSources.forEach((src: any) => {
            fugitiveRows.push([
                FUGITIVE_EMISSION_FACTORS[src.type].label,
                `Qty: ${src.quantity}`,
                `${(FUGITIVE_EMISSION_FACTORS[src.type].rateCFM * src.quantity).toFixed(2)} CFM`
            ]);
        });
        
        fugitiveRows.push(
            [{ content: `Total Leak Rate (Q_leak): ${results.leakRate.toFixed(2)} CFM`, colSpan: 3, styles: { fontStyle: 'bold' } }],
            ['Gas LFL', results.lfl, '%'],
            ['Safety Factor (C)', results.safetyFactor, '--'],
        );
    }

    autoTable(doc, {
        startY: y,
        head: [['Parameter', 'Value', 'Unit']],
        body: [
            [{ content: 'Project Information', colSpan: 3, styles: { fontStyle: 'bold' } }],
            ['Project Name', formData['project-name'], '--'],
            ['Location', formData.location, '--'],
            ['Company', formData.company, '--'],
            ['Performed By', formData['performed-by'], '--'],
            ['Date', formData.date, '--'],
            [{ content: 'Building & Environmental Data', colSpan: 3, styles: { fontStyle: 'bold' } }],
            ['Gas Type', getSelectText('gas-type'), '--'],
            ['Building Dimensions (LxWxH)', `${results.length.toFixed(2)} x ${results.width.toFixed(2)} x ${results.height.toFixed(2)}`, results.units.length],
            ['Temperatures (In/Out)', `${results.insideTemp.toFixed(2)} / ${results.outsideTemp.toFixed(2)}`, results.units.temp],
            ['Average Wind Velocity', results.windVelocity.toFixed(2), results.units.velocity],
            ['Building Orientation', getSelectText('building-orientation'), '--'],
            ['Surrounding Terrain', getSelectText('surrounding-terrain'), '--'],
             [{ content: 'Calculation Method', colSpan: 3, styles: { fontStyle: 'bold' } }],
            ['Method Selected', methodTitle, ''],
            ...fugitiveRows
        ],
        theme: 'grid'
    });
     y = (doc as any).lastAutoTable.finalY + 10;

    // --- Methodology ---
    addHeading('Methodology and Standards');
    addText(methodDescription);
    addText(
        "Note on Stack Effect: This calculation uses a formula based on the difference in air density between the inside and outside of the building. This is a first-principles approach derived from the Ideal Gas Law and provides a more accurate result across a wide range of temperatures than simplified handbook equations."
    );
    y += 5;

    // --- Assumptions ---
    addHeading('Assumptions');
    addText(assumptions.map(a => `- ${a}`));
    y += 5;

    // --- Recommendations ---
    addHeading('Conclusion & Recommendations');
    addText(recommendations.map(r => `- ${r}`));
    
    // --- Diagram ---
    await addDiagramToPdf(doc);

    const projectName = formData['project-name'] || 'ventilation-report';
    doc.save(`${projectName.replace(/ /g, '_')}_Detailed_Report.pdf`);
}


function generateLatexReport(formData: any, results: any, recommendations: string[]): string {
    const {
        method, units, length, width, height, insideTemp, outsideTemp, windVelocity,
        buildingVolume, floorArea, requiredVentilationRate, windFlowPerArea,
        stackFlowPerArea, totalFlowPerArea, finalRequiredArea, requiredGrossInletArea,
        requiredGrossOutletArea, requiredRateFromACH, requiredRateFromFloorArea, 
        leakRate, fugitiveSources, lfl, safetyFactor, airDensityInside, airDensityOutside, 
        airDensityDifference, rhoAvg, cEff, insideTempR, outsideTempR, cvWindEffectiveness,
        terrainFactor, kDischargeCoeff, effectiveWindVelocity, inletObstruction, outletObstruction
    } = results;
    
    // Sanitize units for LaTeX
    const latexAreaUnit = units.area.replace('²', '$^2$');
    const latexTempUnit = units.temp.replace('°', '$^{\\circ}$');


    const recItems = recommendations.map(rec => `\\item ${escapeLatex(rec)}`).join('\n');

    const areaMethodDescription = `
The Area Method, as outlined in AGA Report No. XL1001, provides a conservative approach for determining ventilation requirements in general-purpose buildings where specific sources of gas release are not defined. The required ventilation rate is determined as the greater of two calculations: one based on achieving a minimum number of air changes per hour (ACH), and another based on the building's floor area. This ensures a baseline level of air quality and safety by providing sufficient airflow to dilute minor, unforeseen fugitive emissions.
    `;

    const fugitiveMethodDescription = `
The Fugitive Emission Method, based on guidelines from API Recommended Practice 500, is a targeted approach used when a potential leak source can be quantified. This method calculates the precise ventilation rate required to dilute the substance from a known potential leak ($Q_{\\text{leak}}$) to a concentration well below its Lower Flammable Limit (LFL). A safety factor (C), typically 0.25 for 25% LFL, is applied to ensure the atmosphere remains non-hazardous. This method is ideal for enclosures containing equipment with known or estimated leak rates.
    `;
    
    const methodDescription = method === 'area-method' ? areaMethodDescription : fugitiveMethodDescription;
    const methodTitle = method === 'area-method' ? 'Area Method (AGA XL1001)' : 'Fugitive Emission Method (API RP 500)';

    let step1CalcDetails: string;
    if (method === 'area-method') {
        step1CalcDetails = `
\\subsubsection*{1a. Rate based on Air Changes per Hour ($Q_{v,ACH}$)}
The building volume is calculated first:
\\begin{align*}
\\text{Volume} (V) &= L \\times W \\times H \\\\
&= ${length.toFixed(2)} \\text{ ft} \\times ${width.toFixed(2)} \\text{ ft} \\times ${height.toFixed(2)} \\text{ ft} = ${buildingVolume.toFixed(2)} \\text{ ft}^3
\\end{align*}
The required ventilation rate is then determined based on 12 air changes per hour (equivalent to one change every 5 minutes):
\\begin{align*}
Q_{v,ACH} &= \\frac{V}{5 \\text{ min}} \\\\
&= \\frac{${buildingVolume.toFixed(2)} \\text{ ft}^3}{5 \\text{ min}} = \\mathbf{${requiredRateFromACH.toFixed(2)} \\text{ CFM}}
\\end{align*}

\\subsubsection*{1b. Rate based on Floor Area ($Q_{v,\\text{Floor}}$)}
The building floor area is calculated:
\\begin{align*}
\\text{Area}_{\\text{floor}} &= L \\times W \\\\
&= ${length.toFixed(2)} \\text{ ft} \\times ${width.toFixed(2)} \\text{ ft} = ${floorArea.toFixed(2)} \\text{ ft}^2
\\end{align*}
The required ventilation rate is determined based on 1.5 CFM per square foot of floor area:
\\begin{align*}
Q_{v,\\text{Floor}} &= \\text{Area}_{\\text{floor}} \\times 1.5 \\frac{\\text{CFM}}{\\text{ft}^2} \\\\
&= ${floorArea.toFixed(2)} \\text{ ft}^2 \\times 1.5 = \\mathbf{${requiredRateFromFloorArea.toFixed(2)} \\text{ CFM}}
\\end{align*}

\\subsubsection*{1c. Controlling Ventilation Rate ($Q_v$)}
The controlling ventilation rate is the larger of the two calculated values:
\\begin{align*}
Q_v &= \\max(Q_{v,ACH}, Q_{v,\\text{Floor}}) \\\\
&= \\max(${requiredRateFromACH.toFixed(2)}, ${requiredRateFromFloorArea.toFixed(2)}) = \\mathbf{${requiredVentilationRate.toFixed(2)} \\text{ CFM}}
\\end{align*}
        `;
    } else {
        const sourceRows = fugitiveSources.map((src: any) => 
            `${escapeLatex(FUGITIVE_EMISSION_FACTORS[src.type].label)} & ${src.quantity} & ${(FUGITIVE_EMISSION_FACTORS[src.type].rateCFM * src.quantity).toFixed(2)} \\\\`
        ).join('\n');
        
        step1CalcDetails = `
\\subsubsection*{1a. Calculate Total Leak Rate ($Q_{\\text{leak}}$)}
The total leak rate is the sum of emissions from all specified components.
\\begin{center}
\\begin{tabular}{l c c}
\\toprule
\\textbf{Component} & \\textbf{Quantity} & \\textbf{Subtotal Leak (CFM)} \\\\
\\midrule
${sourceRows}
\\midrule
\\multicolumn{2}{r}{\\textbf{Total Leak Rate ($Q_{\\text{leak}}$)}} & \\textbf{${leakRate.toFixed(2)}} \\\\
\\bottomrule
\\end{tabular}
\\end{center}

\\subsubsection*{1b. Calculate Required Ventilation Rate ($Q_v$)}
The required ventilation rate is calculated to dilute the total leak rate to a safe concentration.
\\begin{align*}
Q_v &= \\frac{Q_{\\text{leak}}}{C \\times (LFL / 100)} \\\\
&= \\frac{${leakRate.toFixed(2)} \\text{ CFM}}{${safetyFactor} \\times (${lfl} / 100)} = \\mathbf{${requiredVentilationRate.toFixed(2)} \\text{ CFM}}
\\end{align*}
        `;
    }
    
    const assumptions = [
        "Inlet and outlet vents are of equal size.",
        "Inlet vents are located near the floor, and outlet vents are located near the roof peak.",
        "The building is considered reasonably well-sealed, with leakage primarily through the specified ventilation openings.",
        "Air density is assumed to be uniform at any given level inside and outside the building.",
        "The calculation is based on steady-state conditions, not accounting for short-term gusts or lulls in wind.",
        "The provided average wind speed is representative of the conditions at the building's location and height.",
        "Obstructions like louvers and screens are accounted for by a uniform reduction coefficient applied to the entire vent area."
    ];
    const assumptionItems = assumptions.map(item => `\\item ${escapeLatex(item)}`).join('\n');
    
    const fugitiveMethodInputsLatex = method === 'fugitive-emission-method' ? `
\\midrule
\\multicolumn{3}{l}{\\textit{Fugitive Emission Sources}} \\\\
\\multicolumn{3}{p{15cm}}{
    \\begin{tabular}{l c c}
        \\toprule
        Component & Qty & Leak Rate (CFM) \\\\
        \\midrule
        ${fugitiveSources.map((src: any) => `${escapeLatex(FUGITIVE_EMISSION_FACTORS[src.type].label)} & ${src.quantity} & ${(FUGITIVE_EMISSION_FACTORS[src.type].rateCFM * src.quantity).toFixed(2)} \\\\`).join('\n')}
        \\midrule
        \\multicolumn{2}{r}{\\textbf{Total}} & \\textbf{${leakRate.toFixed(2)}} \\\\
        \\bottomrule
    \\end{tabular}
} \\\\
Gas LFL & ${lfl} & \\% \\\\
Safety Factor (C) & ${safetyFactor} & -- \\\\
` : '';

    const totalFlow = results.totalFlowPerArea;
    const windPerc = totalFlow > 0 ? (Math.pow(results.windFlowPerArea, 2) / Math.pow(totalFlow, 2)) * 100 : 0;
    const stackPerc = totalFlow > 0 ? (Math.pow(results.stackFlowPerArea, 2) / Math.pow(totalFlow, 2)) * 100 : 0;
    const windScale = (windPerc / 100).toFixed(4);
    const stackScale = (stackPerc / 100).toFixed(4);

    const visualSummaryLatex = `
\\section*{Visual Summary}
\\subsection*{Ventilation Force Contribution}
The following chart illustrates the relative contribution of wind and stack effects to the total natural ventilation driving force.
\\vspace{5mm}
\\noindent
Wind Effect (${windPerc.toFixed(1)}\\%) \\\\
\\colorbox{SteelBlue}{\\rule{${windScale}\\linewidth}{12pt}}
\\vspace{2mm}
\\noindent
Stack Effect (${stackPerc.toFixed(1)}\\%) \\\\
\\colorbox{ForestGreen}{\\rule{${stackScale}\\linewidth}{12pt}}
\\subsection*{Building Isometric View}
The diagram below is a placeholder for the building's isometric view, which illustrates the ventilation strategy (inlet/outlet placement) based on the selected gas type.
\\begin{figure}[h!]
\\centering
\\framebox[0.9\\textwidth]{\\rule{0pt}{7cm} \\large Placeholder for Building Isometric View}
\\caption{Isometric view of the building. Please replace the placeholder above with a screenshot of the 'Building Isometric View' from the application's results page.}
\\label{fig:isometric}
\\end{figure}
    `;

    return `
\\documentclass[11pt]{article}
\\usepackage[a4paper, margin=1in]{geometry}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{graphicx}
\\usepackage{amsmath}
\\usepackage{booktabs}
\\usepackage[svgnames]{xcolor}
\\usepackage{hyperref}
\\usepackage{fancyhdr}
\\usepackage{lastpage}

\\hypersetup{
    colorlinks=true,
    linkcolor=blue,
    urlcolor=blue,
}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot[C]{Page \\thepage\\ of \\pageref{LastPage}}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0.4pt}

\\begin{document}

\\begin{titlepage}
    \\centering
    \\vspace*{2cm}
    {\\Huge\\bfseries Natural Ventilation Calculation Report}
    \\vspace{1.5cm}
    
    {\\Large for Electrical Area Classification}
    \\vspace{2cm}
    
    {\\large\\bfseries Project:} \\\\
    {\\large ${escapeLatex(formData['project-name'] || 'N/A')}}
    
    \\vspace{1cm}
    
    {\\large\\bfseries Location:} \\\\
    {\\large ${escapeLatex(formData.location || 'N/A')}}
    
    \\vspace{2cm}
    
    \\vfill
    
    \\begin{tabular}{ll}
        \\bfseries Company: & ${escapeLatex(formData.company || 'N/A')} \\\\
        \\bfseries Performed By: & ${escapeLatex(formData['performed-by'] || 'N/A')} \\\\
        \\bfseries Date: & ${escapeLatex(formData.date || 'N/A')}
    \\end{tabular}
    
    \\vspace{1cm}
\\end{titlepage}

\\tableofcontents
\\newpage

\\section*{Executive Summary}
This report details the calculation of required natural ventilation for the specified building, in accordance with industry standards for electrical area classification. The objective of this calculation was to determine the necessary gross area for both inlet and outlet vents to ensure adequate air exchange.

The calculation was performed using the \\textbf{${methodTitle}}. 

Based on the provided building dimensions and environmental conditions, the final required gross ventilation areas are:

\\begin{center}
\\begin{tabular}{lc}
    \\toprule
    \\textbf{Description} & \\textbf{Value} \\\\
    \\midrule
    Required Gross Inlet Area & \\huge\\bfseries ${isFinite(requiredGrossInletArea) ? requiredGrossInletArea.toFixed(2) : 'N/A'} ${latexAreaUnit} \\\\
    Required Gross Outlet Area & \\huge\\bfseries ${isFinite(requiredGrossOutletArea) ? requiredGrossOutletArea.toFixed(2) : 'N/A'} ${latexAreaUnit} \\\\
    \\bottomrule
\\end{tabular}
\\end{center}
This represents the total opening size needed, accounting for obstructions. Detailed inputs and step-by-step calculations are provided in the subsequent sections of this report.

${visualSummaryLatex}
\\newpage

\\section{Input Data Summary}
The following table summarizes all input data used for this ventilation calculation. All units are USA customary units.

\\begin{table}[h!]
\\centering
\\begin{tabular}{lll}
\\toprule
\\textbf{Parameter} & \\textbf{Value} & \\textbf{Unit} \\\\
\\midrule
\\multicolumn{3}{l}{\\textit{Project Information}} \\\\
Project Name & ${escapeLatex(formData['project-name'])} & -- \\\\
Location & ${escapeLatex(formData.location)} & -- \\\\
Company & ${escapeLatex(formData.company)} & -- \\\\
Performed By & ${escapeLatex(formData['performed-by'])} & -- \\\\
Date & ${escapeLatex(formData.date)} & -- \\\\
Calculation Goal & ${escapeLatex(getSelectText('calculation-goal'))} & -- \\\\
\\midrule
\\multicolumn{3}{l}{\\textit{Building \\& Environmental Data}} \\\\
Gas Type & ${escapeLatex(getSelectText('gas-type'))} & -- \\\\
Building Length (L) & ${length.toFixed(2)} & ${units.length} \\\\
Building Width (W) & ${width.toFixed(2)} & ${units.length} \\\\
Vertical Vent Separation (H) & ${height.toFixed(2)} & ${units.length} \\\\
Inside Temperature ($T_{\\text{in}}$) & ${insideTemp.toFixed(2)} & ${latexTempUnit} \\\\
Outside Temperature ($T_{\\text{out}}$) & ${outsideTemp.toFixed(2)} & ${latexTempUnit} \\\\
Average Wind Velocity ($V$) & ${windVelocity.toFixed(2)} & ${units.velocity} \\\\
Building Orientation & ${escapeLatex(getSelectText('building-orientation'))} & -- \\\\
Surrounding Terrain & ${escapeLatex(getSelectText('surrounding-terrain'))} & -- \\\\
Vent Opening Type & ${escapeLatex(getSelectText('vent-opening-type'))} & -- \\\\
Inlet Vent Obstruction & ${escapeLatex(getSelectText('inlet-obstruction'))} & -- \\\\
Outlet Vent Obstruction & ${escapeLatex(getSelectText('outlet-obstruction'))} & -- \\\\
\\midrule
\\multicolumn{3}{l}{\\textit{Calculation Method}} \\\\
Method Selected & \\multicolumn{2}{l}{${escapeLatex(methodTitle)}} \\\\
${fugitiveMethodInputsLatex}
\\bottomrule
\\end{tabular}
\\caption{Summary of All Input Parameters.}
\\end{table}

\\section{Methodology and Standards}
The calculation was performed using the \\textbf{${methodTitle}}.

${escapeLatex(methodDescription)}

Note on Stack Effect: This calculation uses a formula based on the difference in air density between the inside and outside of the building. This is a first-principles approach derived from the Ideal Gas Law and provides a more accurate result across a wide range of temperatures than simplified handbook equations.

\\section{Governing Equations}
The following equations are used to determine the required ventilation area.

\\subsection*{Required Ventilation Rate ($Q_v$)}
\\textit{For Area Method:}
\\begin{equation}
Q_v = \\max \\left( \\frac{\\text{Volume}}{5 \\text{ min}}, \\text{Area}_{\\text{floor}} \\times 1.5 \\frac{\\text{CFM}}{\\text{ft}^2} \\right)
\end{equation}
\\textit{For Fugitive Emission Method:}
\\begin{equation}
Q_v = \\frac{Q_{\\text{leak}}}{C \\times (LFL / 100)}
\end{equation}

\\subsection*{Natural Ventilation Driving Forces}
\\begin{equation}
F_w = C_4 \\times C_v \\times V_{\\text{eff}} \\times C_{\\text{eff}}
\\end{equation}
\\begin{equation}
F_s = 60 \\times K \\times C_{\\text{eff}} \\times \\sqrt{\\frac{g \\times H \\times |\\rho_{\\text{in}} - \\rho_{\\text{out}}|}{\\rho_{\\text{avg}}}}
\\end{equation}
\\begin{equation}
F_{\\text{total}} = \\sqrt{F_w^2 + F_s^2}
\\end{equation}

\\subsection*{Final Required Vent Area ($A_{\\text{req}}$)}
The required \\textit{free} area is first calculated:
\\begin{equation}
A_{\\text{req}} = \\frac{Q_v}{F_{\\text{total}}}
\\end{equation}
Then, the \\textit{gross} area is calculated based on vent obstructions:
\\begin{equation}
A_{\\text{gross}} = \\frac{A_{\\text{req}}}{\\text{Obstruction Factor}}
\\end{equation}

\\newpage
\\section{Step-by-Step Calculation}
\\subsection{Step 1: Determine Required Ventilation Rate ($Q_v$)}
The selected method is \\textbf{${methodTitle}}.
${step1CalcDetails}

\\subsection{Step 2: Calculate Natural Ventilation Driving Forces}
\\subsubsection*{2a. Wind Effect ($F_w$)}
The effective wind velocity is adjusted for terrain:
\\begin{align*}
V_{\\text{eff}} &= V \\times F_{\\text{terrain}} \\\\
&= ${windVelocity.toFixed(2)} \\text{ mph} \\times ${terrainFactor} = ${effectiveWindVelocity.toFixed(2)} \\text{ mph}
\\end{align*}
The effective obstruction coefficient ($C_{\\text{eff}}$) is the average of inlet and outlet factors, which is ${cEff.toFixed(2)}. The Wind Effectiveness Coefficient ($C_v$) is set to ${cvWindEffectiveness.toString()} based on the building's orientation.
\\begin{align*}
F_w &= C_4 \\times C_v \\times V_{\\text{eff}} \\times C_{\\text{eff}} \\\\
&= 88.0 \\times ${cvWindEffectiveness.toString()} \\times ${effectiveWindVelocity.toFixed(2)} \\text{ mph} \\times ${cEff.toFixed(2)} \\\\
&= \\mathbf{${windFlowPerArea.toFixed(2)} \\frac{\\text{CFM}}{\\text{ft}^2}}
\\end{align*}

\\subsubsection*{2b. Stack Effect ($F_s$)}
Air densities are calculated based on temperature (in Rankine):
\\begin{itemize}
    \\item Inside: $T_{\\text{in}} = ${insideTemp.toFixed(2)}$^{\\circ}$F = ${insideTempR.toFixed(2)}$^{\\circ}$R \\rightarrow \\rho_{\\text{in}} = ${airDensityInside.toPrecision(4)} \\text{ lb/ft}^3$
    \\item Outside: $T_{\\text{out}} = ${outsideTemp.toFixed(2)}$^{\\circ}$F = ${outsideTempR.toFixed(2)}$^{\\circ}$R \\rightarrow \\rho_{\\text{out}} = ${airDensityOutside.toPrecision(4)} \\text{ lb/ft}^3$
    \\item Density Difference $|\\Delta\\rho| = ${airDensityDifference.toPrecision(4)} \\text{ lb/ft}^3$
\\end{itemize}
The stack flow per unit area is then calculated:
\\begin{align*}
F_s &= 60 \\times K \\times C_{\\text{eff}} \\times \\sqrt{\\frac{g \\times H \\times |\\Delta\\rho|}{\\rho_{\\text{avg}}}} \\\\
&= 60 \\times ${kDischargeCoeff} \\times ${cEff.toFixed(2)} \\times \\sqrt{\\frac{32.2 \\times ${height.toFixed(2)} \\times ${airDensityDifference.toPrecision(4)}}{${rhoAvg.toPrecision(4)}}} \\\\
&= \\mathbf{${stackFlowPerArea.toFixed(2)} \\frac{\\text{CFM}}{\\text{ft}^2}}
\\end{align*}

\\subsubsection*{2c. Total Flow per Unit Area ($F_{\\text{total}}$)}
The total driving force is the vector sum of the wind and stack effects:
\\begin{align*}
F_{\\text{total}} &= \\sqrt{F_w^2 + F_s^2} \\\\
&= \\sqrt{(${windFlowPerArea.toFixed(2)})^2 + (${stackFlowPerArea.toFixed(2)})^2} \\\\
&= \\mathbf{${totalFlowPerArea.toFixed(2)} \\frac{\\text{CFM}}{\\text{ft}^2}}
\\end{align*}

\\subsection{Step 3: Calculate Required Vent Free Area ($A_{\\text{req}}$)}
The required vent free area is the required ventilation rate divided by the total flow per unit area.
\\begin{align*}
A_{\\text{req}} &= \\frac{Q_v}{F_{\\text{total}}} \\\\
&= \\frac{${requiredVentilationRate.toFixed(2)} \\text{ CFM}}{${totalFlowPerArea.toFixed(2)} \\frac{\\text{CFM}}{\\text{ft}^2}} \\\\
&= \\mathbf{${isFinite(finalRequiredArea) ? finalRequiredArea.toFixed(2) : '\\text{Infinity}'} \\text{ ft}^2}
\\end{align*}

\\subsection{Step 4: Calculate Required Gross Vent Areas}
The gross area accounts for obstructions by dividing the free area by the obstruction factor.
\\subsubsection*{4a. Gross Inlet Area}
\\begin{align*}
A_{\\text{gross,in}} &= \\frac{A_{\\text{req}}}{F_{\\text{obstruct,in}}} \\\\
&= \\frac{${finalRequiredArea.toFixed(2)}}{${inletObstruction.toFixed(2)}} = \\mathbf{${isFinite(requiredGrossInletArea) ? requiredGrossInletArea.toFixed(2) : '\\text{Infinity}'} \\text{ ft}^2}
\\end{align*}
\\subsubsection*{4b. Gross Outlet Area}
\\begin{align*}
A_{\\text{gross,out}} &= \\frac{A_{\\text{req}}}{F_{\\text{obstruct,out}}} \\\\
&= \\frac{${finalRequiredArea.toFixed(2)}}{${outletObstruction.toFixed(2)}} = \\mathbf{${isFinite(requiredGrossOutletArea) ? requiredGrossOutletArea.toFixed(2) : '\\text{Infinity}'} \\text{ ft}^2}
\\end{align*}

\\newpage
\\section{Assumptions}
The following assumptions were made during the calculation:
\\begin{itemize}
${assumptionItems}
\\end{itemize}

\\section{Final Results}
The table below summarizes the final calculated gross ventilation requirements.

\\begin{table}[h!]
\\centering
\\begin{tabular}{lc}
\\toprule
\\textbf{Description} & \\textbf{Value} \\\\
\\midrule
Required Gross Inlet Area & ${isFinite(requiredGrossInletArea) ? requiredGrossInletArea.toFixed(2) : 'N/A'} ${latexAreaUnit} \\\\
Required Gross Outlet Area & ${isFinite(requiredGrossOutletArea) ? requiredGrossOutletArea.toFixed(2) : 'N/A'} ${latexAreaUnit} \\\\
\\bottomrule
\\end{tabular}
\\caption{Final Gross Ventilation Area Requirements.}
\\end{table}

\\section{Conclusion}
The total required gross area for natural ventilation has been calculated to be \\textbf{${isFinite(requiredGrossInletArea) ? requiredGrossInletArea.toFixed(2) : 'Not Achievable'} ${latexAreaUnit}} for the air inlet and \\textbf{${isFinite(requiredGrossOutletArea) ? requiredGrossOutletArea.toFixed(2) : 'Not Achievable'} ${latexAreaUnit}} for the air outlet. This is based on the input parameters and the \\textbf{${methodTitle}} methodology.

\\section{Analysis \\& Recommendations}
The following recommendations should be considered for the final design:
\\begin{itemize}
${recItems}
\\end{itemize}

\\end{document}
    `;
}

function generatePdfReport(formData: any, results: any, recommendations: string[]) {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(18);
    doc.text("Natural Ventilation Calculation Report", 105, y, { align: 'center' });
    y += 15;

    doc.setFontSize(12);
    doc.text("Project Information", 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Project Name: ${formData['project-name']}`, 14, y);
    doc.text(`Location: ${formData.location}`, 120, y);
    y += 6;
    doc.text(`Company: ${formData.company}`, 14, y);
    doc.text(`Date: ${formData.date}`, 120, y);
    y += 6;
    doc.text(`Performed By: ${formData['performed-by']}`, 14, y);
    y+= 10;
    
    doc.setFontSize(12);
    doc.text("Summary of Results", 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Required Gross Inlet Area: ${isFinite(results.requiredGrossInletArea) ? results.requiredGrossInletArea.toFixed(2) : 'N/A'} ${results.units.area}`, 14, y);
    y += 6;
    doc.text(`Required Gross Outlet Area: ${isFinite(results.requiredGrossOutletArea) ? results.requiredGrossOutletArea.toFixed(2) : 'N/A'} ${results.units.area}`, 14, y);
    y += 10;

    doc.setFontSize(12);
    doc.text("Analysis & Recommendations", 14, y);
    y += 8;
    doc.setFontSize(10);
    const recLines = doc.splitTextToSize(recommendations.map(rec => `- ${rec}`).join('\n'), 180);
    doc.text(recLines, 14, y);
    y += recLines.length * 5 + 4;
    
    doc.setFontSize(12);
    doc.text("Input Data", 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Building Length: ${results.length.toFixed(2)} ${results.units.length}`, 14, y);
    doc.text(`Building Width: ${results.width.toFixed(2)} ${results.units.length}`, 120, y);
    y += 6;
    doc.text(`Vertical Vent Separation: ${results.height.toFixed(2)} ${results.units.length}`, 14, y);
    doc.text(`Inside Temp: ${results.insideTemp.toFixed(2)} ${results.units.temp}`, 120, y);
    y += 6;
    doc.text(`Outside Temp: ${results.outsideTemp.toFixed(2)} ${results.units.temp}`, 14, y);
    doc.text(`Wind Velocity: ${results.windVelocity.toFixed(2)} ${results.units.velocity}`, 120, y);
    y += 6;
    doc.text(`Building Orientation: ${getSelectText('building-orientation')}`, 14, y);
    doc.text(`Surrounding Terrain: ${getSelectText('surrounding-terrain')}`, 120, y);
    y += 6;
    doc.text(`Vent Opening Type (K): ${getSelectText('vent-opening-type')}`, 14, y);
    y += 10;
    
    doc.setFontSize(12);
    doc.text("Calculation Details", 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Required Ventilation Rate (Qv): ${results.requiredVentilationRate.toFixed(2)} ${results.units.flow}`, 14, y);
    y += 6;
    doc.text(`Total Flow per Unit Area (F_total): ${results.totalFlowPerArea.toFixed(2)} ${results.units.flow}/${results.units.area}`, 14, y);
    
    const projectName = formData['project-name'] || 'ventilation-report';
    doc.save(`${projectName.replace(/ /g, '_')}.pdf`);
}

// --- Diagram Generation ---
function initDiagramGenerator() {
    // Populate Palette
    Object.keys(EQUIPMENT_ZONES).forEach(key => {
        const item = document.createElement('div');
        item.className = 'palette-item';
        item.textContent = EQUIPMENT_ZONES[key].label;
        item.draggable = true;
        item.dataset.type = key;
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer?.setData('text/plain', key);
        });
        diagramPalette.appendChild(item);
    });

    diagramCanvas.addEventListener('dragover', (e) => e.preventDefault());

    diagramCanvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const type = e.dataTransfer?.getData('text/plain');
        if (type && EQUIPMENT_ZONES[type]) {
            const svgPoint = getSVGCoordinates(e);
            const realX = svgPoint.x / diagramState.scale;
            const realY = svgPoint.y / diagramState.scale;
            
            const buildingLengthPx = diagramState.building.length * diagramState.scale;
            const buildingWidthPx = diagramState.building.width * diagramState.scale;
            const canvasRect = diagramCanvas.getBoundingClientRect();
            const offsetX = (canvasRect.width - buildingLengthPx) / 2;
            const offsetY = (canvasRect.height - buildingWidthPx) / 2;

            const droppedX = (svgPoint.x - offsetX) / diagramState.scale;
            const droppedY = (svgPoint.y - offsetY) / diagramState.scale;

            if (droppedX >= 0 && droppedX <= diagramState.building.length && droppedY >= 0 && droppedY <= diagramState.building.width) {
                diagramState.equipment.push({ type, x: droppedX, y: droppedY });
                renderDiagram();
            }
        }
    });

    clearDiagramBtn.addEventListener('click', () => {
         diagramState.equipment = [];
         renderDiagram();
    });
}

function getSVGCoordinates(event: DragEvent): DOMPoint {
    const CTM = diagramCanvas.getScreenCTM();
    if (!CTM) return new DOMPoint(0, 0);
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(CTM.inverse());
}

function setupDiagramCanvas(buildingWidthFt: number, buildingLengthFt: number) {
    diagramState.building.width = buildingWidthFt;
    diagramState.building.length = buildingLengthFt;
    diagramState.equipment = [];

    const padding = 40;
    const canvasRect = diagramCanvas.getBoundingClientRect();
    if(canvasRect.width === 0 || canvasRect.height === 0) return;

    const availableWidth = canvasRect.width - padding * 2;
    const availableHeight = canvasRect.height - padding * 2;

    const scaleX = availableWidth > 0 ? availableWidth / buildingLengthFt : 1;
    const scaleY = availableHeight > 0 ? availableHeight / buildingWidthFt : 1;

    diagramState.scale = Math.min(scaleX, scaleY);
    diagramCanvas.setAttribute('viewBox', `0 0 ${canvasRect.width} ${canvasRect.height}`);
    
    renderDiagram();
}

function renderDiagram() {
    if (!diagramCanvas) return;
    diagramCanvas.innerHTML = ''; 

    const scale = diagramState.scale;
    const buildingWidthPx = diagramState.building.width * scale;
    const buildingLengthPx = diagramState.building.length * scale;
    const canvasRect = diagramCanvas.getBoundingClientRect();
    if(canvasRect.width === 0) return;

    const offsetX = (canvasRect.width - buildingLengthPx) / 2;
    const offsetY = (canvasRect.height - buildingWidthPx) / 2;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${offsetX}, ${offsetY})`);
    
    const buildingRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    buildingRect.setAttribute('x', '0');
    buildingRect.setAttribute('y', '0');
    buildingRect.setAttribute('width', buildingLengthPx.toString());
    buildingRect.setAttribute('height', buildingWidthPx.toString());
    buildingRect.setAttribute('class', 'building-outline');
    g.appendChild(buildingRect);

    diagramState.equipment.forEach(item => {
        const eqData = EQUIPMENT_ZONES[item.type];
        if (!eqData) return;

        const cx = item.x * scale;
        const cy = item.y * scale;

        [...eqData.zones].sort((a,b) => b.radius - a.radius).forEach(zone => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', cx.toString());
            circle.setAttribute('cy', cy.toString());
            circle.setAttribute('r', (zone.radius * scale).toString());
            circle.setAttribute('class', zone.type === 'Division 1' ? 'zone-div1' : 'zone-div2');
            g.appendChild(circle);
        });

        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        icon.setAttribute('cx', cx.toString());
        icon.setAttribute('cy', cy.toString());
        icon.setAttribute('r', '5');
        icon.setAttribute('class', 'equipment-icon');
        g.appendChild(icon);
    });
    
    diagramCanvas.appendChild(g);

    const legendData = [
        { class: 'zone-div1', label: 'Class I, Division 1' },
        { class: 'zone-div2', label: 'Class I, Division 2' },
    ];
    let legendY = 20;
    legendData.forEach(item => {
        const legendGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', '15');
        rect.setAttribute('y', legendY.toString());
        rect.setAttribute('width', '20');
        rect.setAttribute('height', '15');
        rect.setAttribute('class', item.class);
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '45');
        text.setAttribute('y', (legendY + 12).toString());
        text.setAttribute('fill', 'white');
        text.setAttribute('font-size', '12');
        text.textContent = item.label;

        legendGroup.appendChild(rect);
        legendGroup.appendChild(text);
        diagramCanvas.appendChild(legendGroup);
        legendY += 25;
    });
}


// --- Fugitive Emission Builder Logic ---
function initFugitiveEmissionBuilder() {
    // Populate dropdown
    Object.keys(FUGITIVE_EMISSION_FACTORS).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = FUGITIVE_EMISSION_FACTORS[key].label;
        fugitiveSourceTypeSelect.appendChild(option);
    });
    // Initial render
    renderFugitiveSourcesList();
}

function renderFugitiveSourcesList() {
    fugitiveSourcesList.innerHTML = '';
    if (fugitiveSources.length === 0) {
        fugitiveSourcesList.innerHTML = `<p class="info-note" style="text-align: left;">No fugitive emission sources added yet.</p>`;
    } else {
        fugitiveSources.forEach((source, index) => {
            const item = document.createElement('div');
            item.className = 'fugitive-source-item';
            
            const label = FUGITIVE_EMISSION_FACTORS[source.type].label;
            const totalRate = (FUGITIVE_EMISSION_FACTORS[source.type].rateCFM * source.quantity).toFixed(2);

            item.innerHTML = `
                <span><strong>${source.quantity}x</strong> ${label}</span>
                <span>${totalRate} CFM</span>
                <button class="remove-source-btn" data-index="${index}">×</button>
            `;
            fugitiveSourcesList.appendChild(item);
        });
    }
    
    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-source-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const indexToRemove = parseInt((e.target as HTMLElement).dataset.index || '-1', 10);
            if (indexToRemove > -1) {
                fugitiveSources.splice(indexToRemove, 1);
                renderFugitiveSourcesList();
            }
        });
    });

    updateTotalLeakRate();
}

function updateTotalLeakRate() {
    const total = fugitiveSources.reduce((acc, src) => {
        return acc + (FUGITIVE_EMISSION_FACTORS[src.type].rateCFM * src.quantity);
    }, 0);
    totalLeakRateValue.textContent = `${total.toFixed(2)} CFM`;
}


// --- Initialization ---
initDiagramGenerator();
initFugitiveEmissionBuilder();
// Set today's date in the date input field
dateInput.value = new Date().toISOString().substring(0, 10);