/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- State Management ---
let lastCalculationData: { formData: any, results: any, recommendations: string[] } | null = null;
let isAdminAuthenticated = false;
let isDiagramInitialized = false;
let fugitiveSources: { type: string; quantity: number }[] = [];


// --- DOM Element References ---

// Main Content Areas
const calculatorContent = document.getElementById("calculator-content") as HTMLDivElement;
const theoryContent = document.getElementById("theory-content") as HTMLDivElement;
const adminLoginContent = document.getElementById("admin-login-content") as HTMLDivElement;
const adminPanelContent = document.getElementById("admin-panel-content") as HTMLDivElement;
const reportContent = document.getElementById("report-content") as HTMLDivElement;
const resultsSummaryContent = document.getElementById("results-summary-content") as HTMLDivElement;
const diagramContent = document.getElementById("diagram-content") as HTMLDivElement;
const toggleHeaderBtn = document.getElementById('toggle-header-btn') as HTMLButtonElement;
const collapsibleHeader = document.getElementById('collapsible-header') as HTMLDivElement;


// Navigation Tabs
const calculatorTab = document.getElementById("calculator-tab") as HTMLButtonElement;
const theoryTab = document.getElementById("theory-tab") as HTMLButtonElement;
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
const designModeRadio = document.getElementById("design-mode-radio") as HTMLInputElement;
const verificationModeRadio = document.getElementById("verification-mode-radio") as HTMLInputElement;
const existingVentDataContainer = document.getElementById("existing-vent-data") as HTMLDivElement;


// Fugitive Emission Builder
const fugitiveFactorSetSelect = document.getElementById('fugitive-factor-set') as HTMLSelectElement;
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

// Diagram View
const diagramPalette = document.getElementById("diagram-palette") as HTMLDivElement;
const diagramCanvas = document.getElementById("diagram-canvas") as unknown as SVGSVGElement;
const clearDiagramBtn = document.getElementById("clear-diagram-btn") as HTMLButtonElement;
const zoomInBtn = document.getElementById('zoom-in-btn') as HTMLButtonElement;
const zoomOutBtn = document.getElementById('zoom-out-btn') as HTMLButtonElement;
const resetViewBtn = document.getElementById('reset-view-btn') as HTMLButtonElement;
const equipmentList = document.getElementById('equipment-list') as HTMLUListElement;
const diagramLegend = document.getElementById('diagram-legend') as HTMLDivElement;


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

const FUGITIVE_EMISSION_FACTOR_SETS: { [key: string]: { name: string; factors: { [key: string]: { label: string; rateCFM: number } } } } = {
    'average-epa': {
        name: 'Average Emission Factors (EPA / Table 1)',
        factors: {
            'valves': { label: 'Valves', rateCFM: 0.00392 },
            'connectors': { label: 'Connectors', rateCFM: 0.00017 },
            'flanges': { label: 'Flanges', rateCFM: 0.00034 },
        }
    },
    'pegged-api': {
        name: 'Pegged (Maximum) Rates (API / Table 2)',
        factors: {
            'valves': { label: 'Valves', rateCFM: 0.112 },
            'flanges': { label: 'Flanges', rateCFM: 0.067 },
            'threaded-connections': { label: 'Threaded Connections', rateCFM: 0.024 },
        }
    }
};


let diagramState: {
    equipment: { type: string; x: number; y: number; id: number }[];
    building: { width: number; length: number };
    pixelsPerFoot: number;
    transform: { scale: number; translateX: number; translateY: number; };
} = {
    equipment: [],
    building: { width: 0, length: 0 },
    pixelsPerFoot: 1, // pixels per foot at scale 1
    transform: { scale: 1, translateX: 0, translateY: 0 },
};
let nextEquipmentId = 0; // For unique IDs


// --- Utility Functions ---

function hideAllContent(): void {
  calculatorContent.classList.add("hidden");
  theoryContent.classList.add("hidden");
  adminLoginContent.classList.add("hidden");
  adminPanelContent.classList.add("hidden");
  reportContent.classList.add("hidden");
  resultsSummaryContent.classList.add("hidden");
  diagramContent.classList.add("hidden");
}

function deactivateAllTabs(): void {
  calculatorTab.classList.remove("active-tab");
  calculatorTab.setAttribute("aria-selected", "false");
  theoryTab.classList.remove("active-tab");
  theoryTab.setAttribute("aria-selected", "false");
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

if (toggleHeaderBtn && collapsibleHeader) {
    toggleHeaderBtn.addEventListener('click', () => {
        const isExpanded = toggleHeaderBtn.getAttribute('aria-expanded') === 'true';
        collapsibleHeader.classList.toggle('collapsed');
        toggleHeaderBtn.setAttribute('aria-expanded', String(!isExpanded));
    });
}

function handleTabClick(tab: HTMLButtonElement, content: HTMLDivElement): void {
  deactivateAllTabs();
  hideAllContent();
  tab.classList.add("active-tab");
  tab.setAttribute("aria-selected", "true");
  content.classList.remove("hidden");
}

calculatorTab.addEventListener("click", () => handleTabClick(calculatorTab, calculatorContent));
theoryTab.addEventListener("click", () => handleTabClick(theoryTab, theoryContent));
resultsSummaryTab.addEventListener("click", () => handleTabClick(resultsSummaryTab, resultsSummaryContent));
diagramTab.addEventListener("click", () => {
    handleTabClick(diagramTab, diagramContent);
    // Initialize the diagram only the first time the tab is clicked after a calculation.
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

const handleModeChange = () => {
    const isVerification = verificationModeRadio.checked;
    existingVentDataContainer.classList.toggle('hidden', !isVerification);

    const existingInletAreaInput = document.getElementById('existing-inlet-area') as HTMLInputElement;
    const existingOutletAreaInput = document.getElementById('existing-outlet-area') as HTMLInputElement;
    if (existingInletAreaInput && existingOutletAreaInput) {
        existingInletAreaInput.required = isVerification;
        existingOutletAreaInput.required = isVerification;
    }

    calculateBtn.textContent = isVerification ? "Verify Ventilation" : "Calculate Required Ventilation";
};

designModeRadio.addEventListener('change', handleModeChange);
verificationModeRadio.addEventListener('change', handleModeChange);


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
        // Restore button text based on mode after calculation
        handleModeChange();
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
    const factorSetKey = getString('fugitive-factor-set');
    const factors = FUGITIVE_EMISSION_FACTOR_SETS[factorSetKey]?.factors;
    
    // Calculate leakRate from builder if applicable
    const leakRate = method === "fugitive-emission-method" && factors
        ? fugitiveSources.reduce((total, src) => total + (factors[src.type].rateCFM * src.quantity), 0)
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

    const calculationMode = getString('calculation-mode-select');
    let modeSpecificResults = {};

    if (calculationMode === 'verification') {
        const existingInletArea = getNumber('existing-inlet-area');
        const existingOutletArea = getNumber('existing-outlet-area');
        if (isNaN(existingInletArea) || isNaN(existingOutletArea)) {
            throw new Error("Existing Inlet and Outlet areas must be provided for Verification Mode.");
        }

        const effectiveInletFreeArea = existingInletArea * inletObstruction;
        const effectiveOutletFreeArea = existingOutletArea * outletObstruction;
        const limitingFreeArea = Math.min(effectiveInletFreeArea, effectiveOutletFreeArea);
        const actualVentilationRate = limitingFreeArea * totalFlowPerArea;
        
        const status = actualVentilationRate >= requiredVentilationRate ? 'Adequate' : 'Inadequate';
        const flowDifference = actualVentilationRate - requiredVentilationRate;
        
        modeSpecificResults = {
            mode: 'verification',
            existingInletArea,
            existingOutletArea,
            actualVentilationRate,
            status,
            flowDifference,
            limitingFreeArea,
        };

    } else { // 'design' mode
        let finalRequiredArea: number; // in ft^2
        if (totalFlowPerArea < 1e-6) {
            finalRequiredArea = Infinity;
        } else {
            finalRequiredArea = requiredVentilationRate / totalFlowPerArea;
        }
        const requiredGrossInletArea = isFinite(finalRequiredArea) && inletObstruction > 0 ? finalRequiredArea / inletObstruction : Infinity;
        const requiredGrossOutletArea = isFinite(finalRequiredArea) && outletObstruction > 0 ? finalRequiredArea / outletObstruction : Infinity;
        
        modeSpecificResults = {
            mode: 'design',
            finalRequiredArea,
            requiredGrossInletArea,
            requiredGrossOutletArea,
        };
    }
    
    // Package results - all values are Imperial
    const units = { length: 'ft', temp: '°F', velocity: 'mph', flow: 'CFM', area: 'ft²' };
    const results = {
        units,
        method,
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
        requiredRateFromACH,
        requiredRateFromFloorArea,
        leakRate,
        fugitiveSources: [...fugitiveSources], // Save a copy
        fugitiveFactorSet: factorSetKey,
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
        ...modeSpecificResults,
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
    if (results.mode === 'design') {
        const maxGrossArea = Math.max(results.requiredGrossInletArea, results.requiredGrossOutletArea);
        if (maxGrossArea > (results.floorArea * 0.1) && isFinite(maxGrossArea)) { // If vent area > 10% of floor area
            recommendations.push("The required gross vent area is very large relative to the building size. Natural ventilation may be insufficient or impractical. Consider evaluating building design or exploring mechanical ventilation options.");
        } else if (!isFinite(maxGrossArea)) {
            recommendations.push("The calculation resulted in an infinite area, meaning natural ventilation is impossible under the specified conditions (zero wind and no temperature difference). At least one driving force (wind or stack effect) is required.");
        }
    } else { // verification mode
        if (results.status === 'Inadequate') {
             recommendations.push(`The existing ventilation is inadequate by a deficit of ${Math.abs(results.flowDifference).toFixed(2)} CFM. To resolve this, consider increasing vent sizes, reducing vent obstructions (e.g., switching to high-flow louvers), or implementing a mechanical ventilation system.`);
        } else {
            const safetyMargin = (results.actualVentilationRate / results.requiredVentilationRate);
            recommendations.push(`The existing ventilation is adequate and exceeds the requirement by ${results.flowDifference.toFixed(2)} CFM, providing a safety margin of ${safetyMargin.toFixed(2)}x. The current design is sufficient for the specified conditions.`);
        }
    }

    return recommendations;
}


function displayResults(results: any, recommendations: string[]): void {
  const units = results.units;
  let summaryResult: string;

  if (results.mode === 'verification') {
        const statusClass = results.status === 'Adequate' ? 'status-adequate' : 'status-inadequate';
        const differenceText = results.flowDifference >= 0 
            ? `Surplus of ${results.flowDifference.toFixed(2)} ${units.flow}`
            : `Deficit of ${Math.abs(results.flowDifference).toFixed(2)} ${units.flow}`;

        summaryResult = `
          <div class="summary-grid verification-grid">
              <div>
                  <div class="summary-result">${results.requiredVentilationRate.toFixed(2)} ${units.flow}</div>
                  <p>Required Ventilation Rate</p>
              </div>
              <div>
                  <div class="summary-result">${results.actualVentilationRate.toFixed(2)} ${units.flow}</div>
                  <p>Actual Ventilation Rate</p>
              </div>
              <div class="full-width-item">
                  <div class="summary-result ${statusClass}">${results.status}</div>
                  <p>${differenceText}</p>
              </div>
          </div>
        `;
  } else { // Design mode
      const grossInletArea = results.requiredGrossInletArea;
      const grossOutletArea = results.requiredGrossOutletArea;
      summaryResult = (isFinite(grossInletArea) && isFinite(grossOutletArea))
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
  }

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
        <text x="${lengthLabelX}" y="${lengthLabelY - 4}" transform="rotate(${-angleDeg} ${lengthLabelX} ${lengthLabelY})" text-anchor="middle" font-size="8" fill="#e0e0e0">Length: ${l_orig.toFixed(2)} ft</text>
        <text x="${widthLabelX}" y="${widthLabelY - 4}" transform="rotate(${angleDeg} ${widthLabelX} ${widthLabelY})" text-anchor="middle" font-size="8" fill="#e0e0e0">Width: ${w_orig.toFixed(2)} ft</text>
        <text x="${heightLabelX}" y="${heightLabelY}" transform="rotate(-90 ${heightLabelX} ${heightLabelY})" text-anchor="middle" font-size="8" fill="#e0e0e0">Height: ${h_orig.toFixed(2)} ft</text>
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
            <tr><td>Gas Constant for Air (R_air)</td><td>${results.R_AIR.toFixed(2)} ft·lbf/(lb·°R)</td></tr>
            <tr><td>Gravitational Acceleration (g)</td><td>${results.G.toFixed(2)} ft/s²</td></tr>
            <tr><td>Wind Units Conversion (C4)</td><td>${results.C4_WIND_UNITS.toFixed(2)}</td></tr>
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
        const factorSetKey = results.fugitiveFactorSet;
        const factors = FUGITIVE_EMISSION_FACTOR_SETS[factorSetKey].factors;
        const sourcesTableRows = results.fugitiveSources.map((src: any) => `
            <tr>
                <td>${factors[src.type].label}</td>
                <td>${src.quantity}</td>
                <td>${(factors[src.type].rateCFM * src.quantity).toFixed(2)}</td>
            </tr>
        `).join('');

        step1Html = `
            <p>Based on the Fugitive Emission Method (API RP 500), the total leak rate (Q_leak) is first calculated from the sum of all potential component leaks.</p>
            <div class="calculation-step">
                <p class="formula">1. Total Leak Rate (Q_leak)</p>
                <p class="sub-calculation">Using factor set: <strong>${FUGITIVE_EMISSION_FACTOR_SETS[factorSetKey].name}</strong></p>
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
            <p class="calculation">Wind Flow per Area (F_w) = C4 × Cv × V_eff × C_eff = ${results.C4_WIND_UNITS.toFixed(2)} × ${results.cvWindEffectiveness.toString()} × ${results.effectiveWindVelocity.toFixed(2)} × ${results.cEff.toFixed(2)} = <strong>${results.windFlowPerArea.toFixed(2)} ${results.units.flow}/${results.units.area}</strong></p>
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
                    <li>Inside (ρ_in): ${results.P_ATM.toFixed(2)} / (${results.R_AIR.toFixed(2)} × ${results.insideTempR.toFixed(2)}) = ${results.airDensityInside.toPrecision(4)} lb/ft³</li>
                    <li>Outside (ρ_out): ${results.P_ATM.toFixed(2)} / (${results.R_AIR.toFixed(2)} × ${results.outsideTempR.toFixed(2)}) = ${results.airDensityOutside.toPrecision(4)} lb/ft³</li>
                    <li>Difference (|Δρ|): |${results.airDensityInside.toPrecision(4)} - ${results.airDensityOutside.toPrecision(4)}| = ${results.airDensityDifference.toPrecision(4)} lb/ft³</li>
                </ul>
            </p>
            <p class="sub-calculation">Average air density (ρ_avg) is calculated for the stack effect equation:
                <br>ρ_avg = (ρ_in + ρ_out) / 2 = (${results.airDensityInside.toPrecision(4)} + ${results.airDensityOutside.toPrecision(4)}) / 2 = <strong>${results.rhoAvg.toPrecision(4)} lb/ft³</strong>
            </p>
            <p class="sub-calculation">The Discharge Coefficient (K) for the selected vent type is <strong>${results.kDischargeCoeff}</strong>.</p>
            <p class="calculation">Stack Flow per Area (F_s) = 60 × K × C_eff × √(g × H × |Δρ| / ρ_avg) = 60 × ${results.kDischargeCoeff} × ${results.cEff.toFixed(2)} × √(${results.G.toFixed(2)} × ${results.height.toFixed(2)} × ${results.airDensityDifference.toPrecision(4)} / ${results.rhoAvg.toPrecision(4)}) = <strong>${results.stackFlowPerArea.toFixed(2)} ${results.units.flow}/${results.units.area}</strong></p>
        </div>
         <div class="calculation-step">
            <p class="formula">3. Total Flow per Unit Area (F_total)</p>
            <p class="calculation">F_total = √(F_w² + F_s²) = √(${results.windFlowPerArea.toFixed(2)}² + ${results.stackFlowPerArea.toFixed(2)}²) = <strong>${results.totalFlowPerArea.toFixed(2)} ${results.units.flow}/${results.units.area}</strong></p>
        </div>
    `;

    let finalStepsHtml = '';
    if (results.mode === 'verification') {
        finalStepsHtml = `
            <h4>Step 3: Calculate Actual Provided Airflow (Qa)</h4>
            <p>The actual ventilation rate is determined by the smaller of the two vent free areas (the limiting factor) multiplied by the total available driving force.</p>
            <div class="calculation-step">
                <p class="formula">1. Limiting Free Area (A_limit)</p>
                <p class="sub-calculation">Inlet Free Area = Gross Area × Obstruction = ${results.existingInletArea.toFixed(2)} × ${results.inletObstruction.toFixed(2)} = ${(results.existingInletArea * results.inletObstruction).toFixed(2)} ${results.units.area}</p>
                <p class="sub-calculation">Outlet Free Area = Gross Area × Obstruction = ${results.existingOutletArea.toFixed(2)} × ${results.outletObstruction.toFixed(2)} = ${(results.existingOutletArea * results.outletObstruction).toFixed(2)} ${results.units.area}</p>
                <p class="calculation">A_limit = min(Inlet Free Area, Outlet Free Area) = <strong>${results.limitingFreeArea.toFixed(2)} ${results.units.area}</strong></p>
            </div>
            <div class="calculation-step">
                <p class="formula">2. Actual Ventilation Rate (Qa)</p>
                <p class="calculation">Qa = A_limit × F_total = ${results.limitingFreeArea.toFixed(2)} × ${results.totalFlowPerArea.toFixed(2)} = <strong>${results.actualVentilationRate.toFixed(2)} ${results.units.flow}</strong></p>
            </div>

            <h4>Step 4: Compare Provided vs. Required Airflow</h4>
            <p>The final step is to compare the actual ventilation rate (Qa) with the required rate (Qv) from Step 1.</p>
            <div class="calculation-step">
                <p class="formula">Result: ${results.status}</p>
                 <ul>
                    <li>Required (Qv): ${results.requiredVentilationRate.toFixed(2)} ${results.units.flow}</li>
                    <li>Provided (Qa): ${results.actualVentilationRate.toFixed(2)} ${results.units.flow}</li>
                 </ul>
                 <p class="calculation">Difference = Qa - Qv = <strong>${results.flowDifference.toFixed(2)} ${results.units.flow}</strong></p>
            </div>
        `;
    } else { // Design mode
        finalStepsHtml = `
            <h4>Step 3: Calculate Required Vent Free Area</h4>
            <p>The required vent free area is the total required ventilation rate divided by the total flow per unit area available from natural forces.</p>
            <div class="calculation-step">
                <p class="formula">Required Vent Free Area (A_req)</p>
                <p class="calculation">A_req = Qv / F_total = ${results.requiredVentilationRate.toFixed(2)} / ${results.totalFlowPerArea.toFixed(2)} = <strong>${isFinite(results.finalRequiredArea) ? results.finalRequiredArea.toFixed(2) + ` ${results.units.area}` : 'N/A'}</strong></p>
                <p class="info-note">This is the required *free* area for BOTH the inlet and outlet vents.</p>
            </div>
            <h4>Step 4: Calculate Required Gross Vent Areas</h4>
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
    }

    // Assemble final HTML
    detailsContainer.innerHTML = `
      <h3>Detailed Calculation Steps</h3>
      <h4>Calculation Constants</h4>
      ${constantsHtml}
      <h4>Step 1: Determine Required Ventilation Rate (Qv)</h4>
      ${step1Html}
      <h4>Step 2: Calculate Natural Ventilation Driving Forces</h4>
      ${step2Html}
      ${finalStepsHtml}
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
            
            // BUG FIX: Restore fugitive sources from file *before* populating the form
            // to prevent the 'change' event on the factor set selector from clearing them.
            if (loadedData.fugitiveSources) {
                fugitiveSources = loadedData.fugitiveSources;
            } else {
                fugitiveSources = [];
            }

            // Populate form
            for (const key in loadedData.formData) {
                const value = loadedData.formData[key];
                
                // Special handling for radio buttons, which are grouped by name.
                const radioButtons = document.querySelectorAll(`input[type="radio"][name="${key}"]`) as NodeListOf<HTMLInputElement>;
                if (radioButtons.length > 0) {
                    radioButtons.forEach(radio => {
                        radio.checked = (radio.value === value);
                    });
                    continue; // Radio group handled, move to next key.
                }

                // Handle all other elements (input, select) by ID, as their ID matches their name.
                const element = document.getElementById(key) as HTMLInputElement | HTMLSelectElement;
                if (element) {
                    element.value = value;
                }
            }
            
            // Manually update UI elements that depend on selections
            populateFugitiveSourceTypes(); // Update component list based on now-selected factor set
            renderFugitiveSourcesList(); // Render the restored sources
            calculationMethodSelect.dispatchEvent(new Event('change')); // Show/hide fugitive section
            handleModeChange(); // Show/hide verification inputs
            
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
        leakRate, lfl, safetyFactor, fugitiveSources, fugitiveFactorSet, mode
    } = results;

    const methodTitle = method === 'area-method' ? 'Area Method (AGA XL1001)' : 'Fugitive Emission Method (API RP 500)';
    
    let fugitiveInputsHtml = '';
    if (method === 'fugitive-emission-method') {
        const factors = FUGITIVE_EMISSION_FACTOR_SETS[fugitiveFactorSet].factors;
        const sourceRows = fugitiveSources.map((src: any) => `
            <tr>
                <td>${factors[src.type].label}</td>
                <td>${src.quantity}</td>
                <td>${(factors[src.type].rateCFM * src.quantity).toFixed(2)}</td>
            </tr>
        `).join('');

        fugitiveInputsHtml = `
            <tr><td colspan="3" class="table-section-header"><em>Fugitive Emission Sources</em></td></tr>
            <tr><td>Factor Set</td><td colspan="2">${FUGITIVE_EMISSION_FACTOR_SETS[fugitiveFactorSet].name}</td></tr>
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

    let modeSpecificInputsHtml = '';
    if (mode === 'verification') {
        modeSpecificInputsHtml = `
            <tr><td colspan="3" class="table-section-header"><em>Existing Vent Data</em></td></tr>
            <tr><td>Existing Inlet Gross Area</td><td>${results.existingInletArea.toFixed(2)}</td><td>${units.area}</td></tr>
            <tr><td>Existing Outlet Gross Area</td><td>${results.existingOutletArea.toFixed(2)}</td><td>${units.area}</td></tr>
        `;
    }

    const recommendationsHtml = recommendations.map(rec => `<li>${rec}</li>`).join('');

    const areaMethodDescription = `The Area Method, as outlined in AGA Report No. XL1001, provides a conservative approach for determining ventilation requirements in general-purpose buildings where specific sources of gas release are not defined. The required ventilation rate is determined as the greater of two calculations: one based on achieving a minimum number of air changes per hour (ACH), and another based on the building's floor area. This ensures a baseline level of air quality and safety by providing sufficient airflow to dilute minor, unforeseen fugitive emissions.`;
    const fugitiveMethodDescription = `The Fugitive Emission Method, based on guidelines from API Recommended Practice 500, is a targeted approach used when a potential leak source can be quantified. This method calculates the precise ventilation rate required to dilute the substance from a known potential leak ($Q_{\\text{leak}}$) to a concentration well below its Lower Flammable Limit (LFL). A safety factor (C), typically 0.25 for 25% LFL, is applied to ensure the atmosphere remains non-hazardous. This method is ideal for enclosures containing equipment with known or estimated leak rates.`;
    const methodDescription = method === 'area-method' ? areaMethodDescription : fugitiveMethodDescription;

    let sourcesHtml = '';
    if (method === 'fugitive-emission-method') {
        sourcesHtml = `
            <h4>Data Sources</h4>
            <p>The component emission factors and conversion methodology are sourced from the following industry-standard documents:</p>
            <ul>
                <li><strong>Emission Factor Data:</strong> U.S. Environmental Protection Agency (EPA) "Protocol for Equipment Leak Emission Estimates" — EPA-453/R-95-017, November 195, Table 2-4.</li>
                <li><strong>Conversion Methodology:</strong> API Recommended Practice 500 (API RP 500), 2014 Edition, Appendix B.1 — Gas Leakage and Ventilation Calculations.</li>
            </ul>
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
    const assumptionsHtml = assumptions.map(item => `<li>${item}</li>`).join('');
    
    let executiveSummary, finalResultsTable, conclusion;
    if (mode === 'verification') {
        executiveSummary = `<p>This report analyzes the existing natural ventilation for the specified building to verify its adequacy based on the <strong>${methodTitle}</strong>. The objective was to determine if the provided vent areas supply sufficient airflow to meet safety requirements. The analysis concluded that the existing ventilation is <strong>${results.status}</strong>.</p>`;
        finalResultsTable = `
            <table class="data-table">
                <thead><tr><th>Description</th><th>Value</th></tr></thead>
                <tbody>
                    <tr><td>Required Ventilation Rate</td><td>${results.requiredVentilationRate.toFixed(2)} ${units.flow}</td></tr>
                    <tr><td>Actual Provided Ventilation Rate</td><td>${results.actualVentilationRate.toFixed(2)} ${units.flow}</td></tr>
                    <tr><td><strong>Status</strong></td><td><strong>${results.status}</strong></td></tr>
                    <tr><td>Surplus / Deficit</td><td>${results.flowDifference.toFixed(2)} ${units.flow}</td></tr>
                </tbody>
            </table>
        `;
        conclusion = `<p>The existing natural ventilation system was analyzed and found to be <strong>${results.status}</strong> for the specified conditions and the <strong>${methodTitle}</strong> methodology.</p>`;
    } else { // Design mode
        const { requiredGrossInletArea, requiredGrossOutletArea } = results;
        executiveSummary = `<p>This report details the calculation of required natural ventilation for the specified building, based on the <strong>${methodTitle}</strong>. The objective was to determine the necessary gross area for both inlet and outlet vents to ensure adequate air exchange for electrical area classification purposes. The final required gross ventilation area is <strong>${isFinite(requiredGrossInletArea) ? requiredGrossInletArea.toFixed(2) : 'Not Achievable'} ${units.area}</strong> for the inlet and <strong>${isFinite(requiredGrossOutletArea) ? requiredGrossOutletArea.toFixed(2) : 'Not Achievable'} ${units.area}</strong> for the outlet.</p>`;
        finalResultsTable = `
            <table class="data-table">
                <thead><tr><th>Description</th><th>Value</th></tr></thead>
                <tbody>
                    <tr><td>Required Gross Inlet Area</td><td>${isFinite(requiredGrossInletArea) ? requiredGrossInletArea.toFixed(2) + ` ${units.area}` : 'N/A'}</td></tr>
                    <tr><td>Required Gross Outlet Area</td><td>${isFinite(requiredGrossOutletArea) ? requiredGrossOutletArea.toFixed(2) + ` ${units.area}` : 'N/A'}</td></tr>
                </tbody>
            </table>
        `;
        conclusion = `<p>The total required gross area for natural ventilation has been calculated to be <strong>${isFinite(requiredGrossInletArea) ? requiredGrossInletArea.toFixed(2) : 'Not Achievable'} ${units.area}</strong> for the air inlet and <strong>${isFinite(requiredGrossOutletArea) ? requiredGrossOutletArea.toFixed(2) : 'Not Achievable'} ${units.area}</strong> for the air outlet. This is based on the input parameters and the <strong>${methodTitle}</strong> methodology.</p>`;
    }

    const reportHtml = `
        <h2>Calculation Report</h2>

        <h3>Executive Summary</h3>
        ${executiveSummary}

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
                ${modeSpecificInputsHtml}
                <tr><td colspan="3" class="table-section-header"><em>Calculation Method</em></td></tr>
                <tr><td>Method Selected</td><td colspan="2">${methodTitle}</td></tr>
                ${fugitiveInputsHtml}
            </tbody>
        </table>

        <h3>Methodology and Standards</h3>
        <p>${methodDescription}</p>
        ${sourcesHtml}
        <div class="info-note" style="text-align: left; padding: 1rem; margin-top: 1rem; margin-bottom: 1rem;">
            Note on Stack Effect: This calculation uses a formula based on the difference in air density between the inside and outside of the building. This is a first-principles approach derived from the Ideal Gas Law and provides a more accurate result across a wide range of temperatures than simplified handbook equations.
        </div>
        
        <div id="detailed-steps-clone"></div>

        <h3>Assumptions</h3>
        <ul>${assumptionsHtml}</ul>

        <h3>Final Results</h3>
        ${finalResultsTable}
        
        <h3>Conclusion</h3>
        ${conclusion}
        
        <h3>Analysis & Recommendations</h3>
        <p>The following recommendations should be considered for the final design:</p>
        <ul>${recommendationsHtml}</ul>
    `;
    resultsSummaryContent.innerHTML = reportHtml;

    // Clone the detailed steps from the main results page into the report
    const originalDetails = document.getElementById('results-details');
    const cloneTarget = document.getElementById('detailed-steps-clone');
    if(originalDetails && cloneTarget) {
        cloneTarget.innerHTML = originalDetails.innerHTML.replace(/<h3>/g, '<h4>').replace(/<\/h3>/g, '</h4>');
    }
}

function generateLatexReport(formData: any, results: any, recommendations: string[]): string {
    const {
        method, units, length, width, height, insideTemp, outsideTemp, windVelocity,
        buildingVolume, floorArea, requiredVentilationRate, windFlowPerArea,
        stackFlowPerArea, totalFlowPerArea, 
        leakRate, fugitiveSources, lfl, safetyFactor, airDensityInside, airDensityOutside, 
        airDensityDifference, rhoAvg, cEff, insideTempR, outsideTempR, cvWindEffectiveness,
        terrainFactor, kDischargeCoeff, effectiveWindVelocity, inletObstruction, outletObstruction, fugitiveFactorSet,
        mode
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
    const methodTitle = method === 'area-method' ? 'Area Method (AGA XL1001)' : 'Fugitive Emission Method (API RP 500 ANNEX B)';

    let sourcesLatex = '';
    if (method === 'fugitive-emission-method') {
        sourcesLatex = `
\\subsection*{Data Sources}
The component emission factors and conversion methodology are sourced from the following industry-standard documents:
\\begin{itemize}
    \\item \\textbf{Emission Factor Data:} U.S. Environmental Protection Agency (EPA) \u0060\u0060Protocol for Equipment Leak Emission Estimates'' -- EPA-453/R-95-017, November 1995, Table 2-4.
    \\item \\textbf{Conversion Methodology:} API Recommended Practice 500 (API RP 500), 2014 Edition, Appendix B.1 -- Gas Leakage and Ventilation Calculations.
\\end{itemize}
        `;
    }

    let step1CalcDetails: string;
    if (method === 'area-method') {
        const { requiredRateFromACH, requiredRateFromFloorArea } = results;
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
        const factors = FUGITIVE_EMISSION_FACTOR_SETS[fugitiveFactorSet].factors;
        const sourceRows = fugitiveSources.map((src: any) => 
            `${escapeLatex(factors[src.type].label)} & ${src.quantity} & ${(factors[src.type].rateCFM * src.quantity).toFixed(2)} \\\\`
        ).join('\n');
        
        step1CalcDetails = `
\\subsubsection*{1a. Calculate Total Leak Rate ($Q_{\\text{leak}}$)}
The total leak rate is the sum of emissions from all specified components using the \\textbf{${escapeLatex(FUGITIVE_EMISSION_FACTOR_SETS[fugitiveFactorSet].name)}} factor set.
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
Factor Set & \\multicolumn{2}{l}{${escapeLatex(FUGITIVE_EMISSION_FACTOR_SETS[fugitiveFactorSet].name)}} \\\\
\\multicolumn{3}{l}{
    \\begin{tabular}{l c c}
        \\toprule
        Component & Qty & Leak Rate (CFM) \\\\
        \\midrule
        ${fugitiveSources.map((src: any) => `${escapeLatex(FUGITIVE_EMISSION_FACTOR_SETS[fugitiveFactorSet].factors[src.type].label)} & ${src.quantity} & ${(FUGITIVE_EMISSION_FACTOR_SETS[fugitiveFactorSet].factors[src.type].rateCFM * src.quantity).toFixed(2)} \\\\`).join('\n')}
        \\midrule
        \\multicolumn{2}{r}{\\textbf{Total}} & \\textbf{${leakRate.toFixed(2)}} \\\\
        \\bottomrule
    \\end{tabular}
} \\\\
Gas LFL & ${lfl} & \\% \\\\
Safety Factor (C) & ${safetyFactor} & -- \\\\
` : '';

    let modeSpecificInputsLatex = '';
    if (mode === 'verification') {
        modeSpecificInputsLatex = `
\\midrule
\\multicolumn{3}{l}{\\textit{Existing Vent Data}} \\\\
Existing Inlet Gross Area & ${results.existingInletArea.toFixed(2)} & ${latexAreaUnit} \\\\
Existing Outlet Gross Area & ${results.existingOutletArea.toFixed(2)} & ${latexAreaUnit} \\\\
`;
    }

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
Wind Effect (${windPerc.toFixed(2)}\\%) \\\\
\\colorbox{SteelBlue}{\\rule{${windScale}\\linewidth}{12pt}}
\\vspace{2mm}
\\noindent
Stack Effect (${stackPerc.toFixed(2)}\\%) \\\\
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
    
    let executiveSummary, resultsTable, finalSteps, conclusion;
    if (mode === 'verification') {
        executiveSummary = `This report analyzes the existing natural ventilation for the specified building to verify its adequacy, in accordance with the \\textbf{${methodTitle}}. The analysis concluded that the existing ventilation is \\textbf{${results.status}}.`;
        resultsTable = `
\\begin{tabular}{lc}
    \\toprule
    \\textbf{Description} & \\textbf{Value} \\\\
    \\midrule
    Required Ventilation Rate & ${results.requiredVentilationRate.toFixed(2)} CFM \\\\
    Actual Provided Ventilation & ${results.actualVentilationRate.toFixed(2)} CFM \\\\
    \\textbf{Status} & \\textbf{${results.status}} \\\\
    Surplus / Deficit & ${results.flowDifference.toFixed(2)} CFM \\\\
    \\bottomrule
\\end{tabular}
        `;
        finalSteps = `
\\subsection{Step 3: Calculate Actual Provided Airflow ($Q_a$)}
The actual ventilation rate is determined by the smaller of the two vent free areas multiplied by the total available driving force.
\\subsubsection*{3a. Limiting Free Area ($A_{\\text{limit}}$)}
\\begin{align*}
A_{\\text{free,in}} &= A_{\\text{gross,in}} \\times F_{\\text{obstruct,in}} = ${results.existingInletArea.toFixed(2)} \\times ${inletObstruction} = ${(results.existingInletArea * inletObstruction).toFixed(2)} \\text{ ft}^2 \\\\
A_{\\text{free,out}} &= A_{\\text{gross,out}} \\times F_{\\text{obstruct,out}} = ${results.existingOutletArea.toFixed(2)} \\times ${outletObstruction} = ${(results.existingOutletArea * outletObstruction).toFixed(2)} \\text{ ft}^2 \\\\
A_{\\text{limit}} &= \\min(A_{\\text{free,in}}, A_{\\text{free,out}}) = \\mathbf{${results.limitingFreeArea.toFixed(2)} \\text{ ft}^2}
\\end{align*}
\\subsubsection*{3b. Actual Ventilation Rate ($Q_a$)}
\\begin{align*}
Q_a &= A_{\\text{limit}} \\times F_{\\text{total}} \\\\
&= ${results.limitingFreeArea.toFixed(2)} \\text{ ft}^2 \\times ${totalFlowPerArea.toFixed(2)} \\frac{\\text{CFM}}{\\text{ft}^2} = \\mathbf{${results.actualVentilationRate.toFixed(2)} \\text{ CFM}}
\\end{align*}

\\subsection{Step 4: Compare Provided vs. Required Airflow}
The actual ventilation rate ($Q_a$) is compared with the required rate ($Q_v$).
\\begin{itemize}
    \\item Required ($Q_v$): ${results.requiredVentilationRate.toFixed(2)} CFM
    \\item Provided ($Q_a$): ${results.actualVentilationRate.toFixed(2)} CFM
\\end{itemize}
The result is \\textbf{${results.status}}, with a difference of ${results.flowDifference.toFixed(2)} CFM.
`;
        conclusion = `The existing natural ventilation system was analyzed and found to be \\textbf{${results.status}} for the specified conditions and the \\textbf{${methodTitle}} methodology.`;

    } else { // Design mode
        const { finalRequiredArea, requiredGrossInletArea, requiredGrossOutletArea } = results;
        executiveSummary = `This report details the calculation of required natural ventilation for the specified building, in accordance with industry standards for electrical area classification. The objective of this calculation was to determine the necessary gross area for both inlet and outlet vents to ensure adequate air exchange. The calculation was performed using the \\textbf{${methodTitle}}.`;
        resultsTable = `
\\begin{tabular}{lc}
    \\toprule
    \\textbf{Description} & \\textbf{Value} \\\\
    \\midrule
    Required Gross Inlet Area & \\huge\\bfseries ${isFinite(requiredGrossInletArea) ? requiredGrossInletArea.toFixed(2) : 'N/A'} ${latexAreaUnit} \\\\
    Required Gross Outlet Area & \\huge\\bfseries ${isFinite(requiredGrossOutletArea) ? requiredGrossOutletArea.toFixed(2) : 'N/A'} ${latexAreaUnit} \\\\
    \\bottomrule
\\end{tabular}
        `;
        finalSteps = `
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
`;
        conclusion = `The total required gross area for natural ventilation has been calculated to be \\textbf{${isFinite(requiredGrossInletArea) ? requiredGrossInletArea.toFixed(2) : 'Not Achievable'} ${latexAreaUnit}} for the air inlet and \\textbf{${isFinite(requiredGrossOutletArea) ? requiredGrossOutletArea.toFixed(2) : 'Not Achievable'} ${latexAreaUnit}} for the air outlet. This is based on the input parameters and the \\textbf{${methodTitle}} methodology.`;
    }

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
\\usepackage{tabularx}

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
${executiveSummary}
Based on the provided building dimensions and environmental conditions, the final results are:
\\begin{center}
${resultsTable}
\\end{center}
This represents the total opening size needed, accounting for obstructions. Detailed inputs and step-by-step calculations are provided in the subsequent sections of this report.

${visualSummaryLatex}
\\newpage

\\section{Input Data Summary}
The following table summarizes all input data used for this ventilation calculation. All units are USA customary units.

\\begin{table}[h!]
\\centering
\\begin{tabularx}{\\textwidth}{l X l}
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
${modeSpecificInputsLatex}
\\midrule
\\multicolumn{3}{l}{\\textit{Calculation Method}} \\\\
Method Selected & \\multicolumn{2}{l}{${escapeLatex(methodTitle)}} \\\\
${fugitiveMethodInputsLatex}
\\bottomrule
\\end{tabularx}
\\caption{Summary of All Input Parameters.}
\\end{table}

\\section{Methodology and Standards}
The calculation was performed using the \\textbf{${escapeLatex(methodTitle)}}.

${methodDescription}
${sourcesLatex}

Note on Stack Effect: This calculation uses a formula based on the difference in air density between the inside and outside of the building. This is a first-principles approach derived from the Ideal Gas Law and provides a more accurate result across a wide range of temperatures than simplified handbook equations.

\\section{Governing Equations}
The following equations are used to determine the required ventilation area.

\\subsection*{Required Ventilation Rate ($Q_v$)}

\\textit{For Area Method:}
\\begin{equation}
\\begin{split}
Q_v = \\max \\bigg( & \\frac{\\text{Volume}}{5 \\text{ min}}, \\\\
& \\text{Area}_{\\text{floor}} \\times 1.5 \\frac{\\text{CFM}}{\\text{ft}^2} \\bigg)
\\end{split}
\\end{equation}

\\textit{For Fugitive Emission Method:}
\\begin{equation}
Q_v = \\frac{Q_{\\text{leak}}}{C \\times (LFL / 100)}
\\end{equation}

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

${finalSteps}

\\newpage
\\section{Assumptions}
The following assumptions were made during the calculation:
\\begin{itemize}
${assumptionItems}
\\end{itemize}

\\section{Final Results}
The table below summarizes the final calculated results.

\\begin{table}[h!]
\\centering
${resultsTable}
\\caption{Final Calculation Results.}
\\end{table}

\\section{Conclusion}
${conclusion}

\\section{Analysis \\& Recommendations}
The following recommendations should be considered for the final design:
\\begin{itemize}
${recItems}
\\end{itemize}

\\vfill
\\newpage

\\begin{center}
\\small
\\textbf{Disclaimer} \\\\
\\vspace{0.5cm}
\\parbox{0.8\\textwidth}{
\\centering
This tool was created for educational purposes only. All calculations should be checked for proper theory and accuracy. The Author is not responsible or liable for this tool's use. \\\\
\\copyright \\textasciitilde{}Tim Bickford.
}
\\end{center}

\\end{document}
    `;
}

// --- Diagram Generation ---
// State variables for diagram interaction
let isPanning = false;
let isDraggingEquipment = false;
let draggedEquipmentInfo: { id: number; startX: number; startY: number; mouseStartX: number; mouseStartY: number; } | null = null;
let lastMousePos = { x: 0, y: 0 };


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

    // --- Drag and Drop ---
    diagramCanvas.addEventListener('dragover', (e) => e.preventDefault());
    diagramCanvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const type = e.dataTransfer?.getData('text/plain');
        if (type && EQUIPMENT_ZONES[type]) {
            const worldPoint = getDiagramWorldCoordinates(e);

            // Convert world pixel coordinates to feet
            const realX = worldPoint.x / diagramState.pixelsPerFoot;
            const realY = worldPoint.y / diagramState.pixelsPerFoot;
            
            // Check if drop is within building bounds
            if (realX >= 0 && realX <= diagramState.building.length && realY >= 0 && realY <= diagramState.building.width) {
                diagramState.equipment.push({ type, x: realX, y: realY, id: nextEquipmentId++ });
                renderDiagram();
            }
        }
    });

    // --- Pan and Zoom ---
    diagramCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        const { scale } = diagramState.transform;
        const newScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;
        
        const mousePoint = getSVGCoordinates(e);
        
        // Adjust translation to zoom towards the mouse pointer
        const newTranslateX = mousePoint.x - (mousePoint.x - diagramState.transform.translateX) * (newScale / scale);
        const newTranslateY = mousePoint.y - (mousePoint.y - diagramState.transform.translateY) * (newScale / scale);

        diagramState.transform.scale = newScale;
        diagramState.transform.translateX = newTranslateX;
        diagramState.transform.translateY = newTranslateY;
        
        renderDiagram();
    });

    diagramCanvas.addEventListener('mousedown', (e) => {
        // This handler only initiates panning. Dragging is initiated by a mousedown
        // on an equipment icon, which will stop propagation.
        isPanning = true;
        lastMousePos = { x: e.clientX, y: e.clientY };
        diagramCanvas.classList.add('panning');
    });

    diagramCanvas.addEventListener('mousemove', (e) => {
        if (isDraggingEquipment && draggedEquipmentInfo) {
            const mousePos = getDiagramWorldCoordinates(e);
            const mouseFeetX = mousePos.x / diagramState.pixelsPerFoot;
            const mouseFeetY = mousePos.y / diagramState.pixelsPerFoot;

            const deltaX = mouseFeetX - draggedEquipmentInfo.mouseStartX;
            const deltaY = mouseFeetY - draggedEquipmentInfo.mouseStartY;

            let newX = draggedEquipmentInfo.startX + deltaX;
            let newY = draggedEquipmentInfo.startY + deltaY;
            
            // Clamp to building boundaries
            newX = Math.max(0, Math.min(diagramState.building.length, newX));
            newY = Math.max(0, Math.min(diagramState.building.width, newY));

            const equipment = diagramState.equipment.find(eq => eq.id === draggedEquipmentInfo!.id);
            if (equipment) {
                equipment.x = newX;
                equipment.y = newY;
                renderDiagram();
            }

        } else if (isPanning) {
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;
            diagramState.transform.translateX += dx;
            diagramState.transform.translateY += dy;
            lastMousePos = { x: e.clientX, y: e.clientY };
            renderDiagram();
        }
    });

    const stopActions = () => {
        isPanning = false;
        isDraggingEquipment = false;
        draggedEquipmentInfo = null;
        diagramCanvas.classList.remove('panning');
        diagramCanvas.classList.remove('dragging-equipment');
    };

    diagramCanvas.addEventListener('mouseup', stopActions);
    diagramCanvas.addEventListener('mouseleave', stopActions);

    // --- Button Controls ---
    zoomInBtn.addEventListener('click', () => {
        diagramState.transform.scale *= 1.2;
        renderDiagram();
    });
    zoomOutBtn.addEventListener('click', () => {
        diagramState.transform.scale /= 1.2;
        renderDiagram();
    });
    resetViewBtn.addEventListener('click', () => {
         setupDiagramCanvas(diagramState.building.width, diagramState.building.length, false);
    });
    clearDiagramBtn.addEventListener('click', () => {
         diagramState.equipment = [];
         renderDiagram();
    });
    
    // --- Equipment List Deletion ---
    equipmentList.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const removeBtn = target.closest('.remove-equipment-btn');
        if (removeBtn) {
            const idToRemove = parseInt(removeBtn.getAttribute('data-id') || '-1', 10);
            diagramState.equipment = diagramState.equipment.filter(eq => eq.id !== idToRemove);
            renderDiagram();
        }
    });
}

function getSVGCoordinates(event: { clientX: number, clientY: number }): DOMPoint {
    if (!diagramCanvas) return new DOMPoint(0, 0);
    const CTM = diagramCanvas.getScreenCTM();
    if (!CTM) return new DOMPoint(0, 0);
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(CTM.inverse());
}

function getDiagramWorldCoordinates(event: { clientX: number, clientY: number }): { x: number, y: number } {
    const svgPoint = getSVGCoordinates(event);
    const { scale, translateX, translateY } = diagramState.transform;
    // Inverse transform: p_world = (p_svg - translate) / scale
    const worldX = (svgPoint.x - translateX) / scale;
    const worldY = (svgPoint.y - translateY) / scale;
    return { x: worldX, y: worldY };
}


function setupDiagramCanvas(buildingWidthFt: number, buildingLengthFt: number, clearEquipment = true) {
    if (!diagramCanvas) return;
    diagramState.building.width = buildingWidthFt;
    diagramState.building.length = buildingLengthFt;
    if(clearEquipment) {
        diagramState.equipment = [];
        nextEquipmentId = 0;
    }

    const padding = 50; // pixels
    const canvasRect = diagramCanvas.getBoundingClientRect();
    if(canvasRect.width === 0 || canvasRect.height === 0) return;

    const availableWidth = canvasRect.width - padding * 2;
    const availableHeight = canvasRect.height - padding * 2;

    const scaleX = availableWidth > 0 ? availableWidth / buildingLengthFt : 1;
    const scaleY = availableHeight > 0 ? availableHeight / buildingWidthFt : 1;

    diagramState.pixelsPerFoot = Math.min(scaleX, scaleY);
    
    // Center the building in the view
    const buildingWidthPx = buildingWidthFt * diagramState.pixelsPerFoot;
    const buildingLengthPx = buildingLengthFt * diagramState.pixelsPerFoot;
    const initialTranslateX = (canvasRect.width - buildingLengthPx) / 2;
    const initialTranslateY = (canvasRect.height - buildingWidthPx) / 2;

    diagramState.transform = {
        scale: 1,
        translateX: initialTranslateX,
        translateY: initialTranslateY
    };

    renderDiagram();
}

function renderDiagram() {
    if (!diagramCanvas) return;
    diagramCanvas.innerHTML = ''; 
    equipmentList.innerHTML = '';

    const { pixelsPerFoot, transform } = diagramState;
    const buildingLengthPx = diagramState.building.length * pixelsPerFoot;
    const buildingWidthPx = diagramState.building.width * pixelsPerFoot;

    // Master group for pan and zoom
    const masterGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    masterGroup.setAttribute('transform', `translate(${transform.translateX} ${transform.translateY}) scale(${transform.scale})`);
    
    // Building Outline
    const buildingRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    buildingRect.setAttribute('x', '0');
    buildingRect.setAttribute('y', '0');
    buildingRect.setAttribute('width', buildingLengthPx.toString());
    buildingRect.setAttribute('height', buildingWidthPx.toString());
    buildingRect.setAttribute('class', 'building-outline');
    masterGroup.appendChild(buildingRect);

    // Dimension Labels
    const addDimension = (x1: number, y1: number, x2: number, y2: number, label: string, offset: number) => {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'dimension');
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1.toString());
        line.setAttribute('y1', y1.toString());
        line.setAttribute('x2', x2.toString());
        line.setAttribute('y2', y2.toString());
        line.setAttribute('class', 'dimension-line');
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', ((x1 + x2) / 2).toString());
        text.setAttribute('y', ((y1 + y2) / 2 + offset).toString());
        text.setAttribute('class', 'dimension-text');
        text.textContent = label;
        g.appendChild(line);
        g.appendChild(text);
        return g;
    };
    masterGroup.appendChild(addDimension(0, -20, buildingLengthPx, -20, `${diagramState.building.length.toFixed(2)} ft`, -5));
    masterGroup.appendChild(addDimension(-20, 0, -20, buildingWidthPx, `${diagramState.building.width.toFixed(2)} ft`, 4));

    // Equipment and Zones
    diagramState.equipment.forEach(item => {
        const eqData = EQUIPMENT_ZONES[item.type];
        if (!eqData) return;

        const cx = item.x * pixelsPerFoot;
        const cy = item.y * pixelsPerFoot;

        // Render zones (largest radius first)
        [...eqData.zones].sort((a,b) => b.radius - a.radius).forEach(zone => {
            const radiusPx = zone.radius * pixelsPerFoot;
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', cx.toString());
            circle.setAttribute('cy', cy.toString());
            circle.setAttribute('r', radiusPx.toString());
            circle.setAttribute('class', zone.type === 'Division 1' ? 'zone-div1' : 'zone-div2');
            masterGroup.appendChild(circle);

            // Add Dimension Line and Text
            const dimensionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            const dimLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            dimLine.setAttribute('x1', cx.toString());
            dimLine.setAttribute('y1', cy.toString());
            dimLine.setAttribute('x2', (cx + radiusPx).toString());
            dimLine.setAttribute('y2', cy.toString());
            dimLine.setAttribute('class', 'dimension-radius-line');

            const dimText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            dimText.setAttribute('x', (cx + radiusPx / 2).toString());
            dimText.setAttribute('y', (cy - 5 / transform.scale).toString());
            dimText.setAttribute('class', 'dimension-radius-text');
            dimText.textContent = `R: ${zone.radius} ft`;

            dimensionGroup.appendChild(dimLine);
            dimensionGroup.appendChild(dimText);
            masterGroup.appendChild(dimensionGroup);


            // Zone Label
            const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            labelText.setAttribute('x', cx.toString());
            labelText.setAttribute('y', (cy - radiusPx + (12 / transform.scale)).toString());
            labelText.setAttribute('class', 'zone-label');
            labelText.textContent = zone.type === 'Division 1' ? 'Div 1' : 'Div 2';
            masterGroup.appendChild(labelText);
        });

        // Equipment Icon (Draggable)
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        icon.setAttribute('cx', cx.toString());
        icon.setAttribute('cy', cy.toString());
        icon.setAttribute('r', (Math.min(5 / transform.scale, 2 * pixelsPerFoot)).toString()); // Make icon size more consistent when zoomed
        icon.setAttribute('class', 'equipment-icon draggable-equipment');
        
        icon.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // Prevent canvas panning
            
            isDraggingEquipment = true;
            const mousePos = getDiagramWorldCoordinates(e);
            draggedEquipmentInfo = {
                id: item.id,
                startX: item.x, // in feet
                startY: item.y, // in feet
                mouseStartX: mousePos.x / pixelsPerFoot,
                mouseStartY: mousePos.y / pixelsPerFoot,
            };
            diagramCanvas.classList.add('dragging-equipment');
        });

        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = eqData.label;
        icon.appendChild(title);
        masterGroup.appendChild(icon);
        
        // Add to equipment list
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <span>${eqData.label}</span>
            <button class="remove-equipment-btn" data-id="${item.id}" title="Remove Item">×</button>
        `;
        equipmentList.appendChild(listItem);
    });
    
    diagramCanvas.appendChild(masterGroup);

    // Scale Bar and Legend (drawn directly on SVG, not affected by pan/zoom)
    const scaleBarLengthFt = 5;
    const scaleBarLengthPx = scaleBarLengthFt * pixelsPerFoot * transform.scale;
    const scaleGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    scaleGroup.setAttribute('class', 'scale-bar-group');
    const scaleLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    scaleLine.setAttribute('x1', '20');
    scaleLine.setAttribute('y1', (diagramCanvas.clientHeight - 20).toString());
    scaleLine.setAttribute('x2', (20 + scaleBarLengthPx).toString());
    scaleLine.setAttribute('y2', (diagramCanvas.clientHeight - 20).toString());
    scaleLine.setAttribute('class', 'scale-bar');
    const scaleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    scaleText.setAttribute('x', (20 + scaleBarLengthPx / 2).toString());
    scaleText.setAttribute('y', (diagramCanvas.clientHeight - 25).toString());
    scaleText.setAttribute('class', 'scale-text');
    scaleText.textContent = `${scaleBarLengthFt} ft`;
    scaleGroup.appendChild(scaleLine);
    scaleGroup.appendChild(scaleText);
    diagramCanvas.appendChild(scaleGroup);

    // Render Legend
    diagramLegend.innerHTML = '';
    const legendData = [
        { class: 'zone-div1', label: 'Class I, Division 1' },
        { class: 'zone-div2', label: 'Class I, Division 2' },
    ];
    legendData.forEach(item => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        const swatch = document.createElement('div');
        swatch.className = `legend-swatch ${item.class}`;
        const label = document.createElement('span');
        label.className = 'legend-label';
        label.textContent = item.label;
        legendItem.appendChild(swatch);
        legendItem.appendChild(label);
        diagramLegend.appendChild(legendItem);
    });
}


// --- Fugitive Emission Builder Logic ---
function populateFugitiveSourceTypes() {
    const selectedSetKey = fugitiveFactorSetSelect.value;
    const factors = FUGITIVE_EMISSION_FACTOR_SETS[selectedSetKey].factors;

    fugitiveSourceTypeSelect.innerHTML = ''; // Clear existing options
    Object.keys(factors).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = factors[key].label;
        fugitiveSourceTypeSelect.appendChild(option);
    });
}

function initFugitiveEmissionBuilder() {
    // Populate factor set dropdown
    Object.keys(FUGITIVE_EMISSION_FACTOR_SETS).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = FUGITIVE_EMISSION_FACTOR_SETS[key].name;
        fugitiveFactorSetSelect.appendChild(option);
    });
    
    // Add event listener to factor set dropdown
    fugitiveFactorSetSelect.addEventListener('change', () => {
        // Clear existing sources when set is changed to avoid mismatches
        fugitiveSources = [];
        populateFugitiveSourceTypes();
        renderFugitiveSourcesList();
    });

    // Initial population of component types based on default selection
    populateFugitiveSourceTypes();
    // Initial render of the (empty) list
    renderFugitiveSourcesList();
}

function renderFugitiveSourcesList() {
    const selectedSetKey = fugitiveFactorSetSelect.value;
    const factors = FUGITIVE_EMISSION_FACTOR_SETS[selectedSetKey].factors;
    
    fugitiveSourcesList.innerHTML = '';
    if (fugitiveSources.length === 0) {
        fugitiveSourcesList.innerHTML = `<p class="info-note" style="text-align: left;">No fugitive emission sources added yet.</p>`;
    } else {
        fugitiveSources.forEach((source, index) => {
            const item = document.createElement('div');
            item.className = 'fugitive-source-item';
            
            const label = factors[source.type].label;
            const totalRate = (factors[source.type].rateCFM * source.quantity).toFixed(2);

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
    const selectedSetKey = fugitiveFactorSetSelect.value;
    const factors = FUGITIVE_EMISSION_FACTOR_SETS[selectedSetKey].factors;

    const total = fugitiveSources.reduce((acc, src) => {
        // Ensure the source type exists in the current factor set before calculating
        if (factors[src.type]) {
            return acc + (factors[src.type].rateCFM * src.quantity);
        }
        return acc;
    }, 0);
    totalLeakRateValue.textContent = `${total.toFixed(2)} CFM`;
}


// --- Initialization ---
initDiagramGenerator();
initFugitiveEmissionBuilder();
// Set today's date in the date input field
dateInput.value = new Date().toISOString().substring(0, 10);