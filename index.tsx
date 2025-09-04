

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// --- DOM Element References ---

// Main Content Areas
const calculatorContent = document.getElementById("calculator-content") as HTMLDivElement;
const adminLoginContent = document.getElementById("admin-login-content") as HTMLDivElement;
const adminPanelContent = document.getElementById("admin-panel-content") as HTMLDivElement;
const reportContent = document.getElementById("report-content") as HTMLDivElement;


// Navigation Tabs
const calculatorTab = document.getElementById("calculator-tab") as HTMLButtonElement;
const adminTab = document.getElementById("admin-tab") as HTMLButtonElement;
const reportTab = document.getElementById("report-tab") as HTMLButtonElement;


// Admin Login Form
const adminLoginForm = document.getElementById("admin-login-form") as HTMLFormElement;
const adminPasswordInput = document.getElementById("admin-password") as HTMLInputElement;
const loginErrorMessage = document.getElementById("login-error-message") as HTMLDivElement;


// Calculator Form & Results
const form = document.getElementById("calc-form") as HTMLFormElement;
const calculateBtn = document.getElementById("calculate-btn") as HTMLButtonElement;
const resultsPlaceholder = document.getElementById("results-placeholder");
const loadingIndicator = document.getElementById("loading-indicator");
const errorMessage = document.getElementById("error-message");
const resultsContent = document.getElementById("results-content");
const calculationMethodSelect = document.getElementById("calculation-method") as HTMLSelectElement;
const fugitiveEmissionInputsWrapper = document.getElementById("fugitive-emission-inputs-wrapper") as HTMLDivElement;
const leakRateInput = document.getElementById("leak-rate") as HTMLInputElement;

// Report View
const latexCodeOutput = document.getElementById("latex-code-output") as HTMLElement;
const copyLatexBtn = document.getElementById("copy-latex-btn") as HTMLButtonElement;


// --- App State ---
let isAdmin = false;
let currentLatexReport = "";


// --- View Management Logic ---
const showView = (view: 'calculator' | 'login' | 'adminPanel' | 'report') => {
    // Hide all main views first
    calculatorContent.classList.add('hidden');
    adminLoginContent.classList.add('hidden');
    adminPanelContent.classList.add('hidden');
    reportContent.classList.add('hidden');

    // Deactivate all tabs
    calculatorTab.classList.remove('active-tab');
    adminTab.classList.remove('active-tab');
    reportTab.classList.remove('active-tab');
    calculatorTab.setAttribute('aria-selected', 'false');
    adminTab.setAttribute('aria-selected', 'false');
    reportTab.setAttribute('aria-selected', 'false');

    switch (view) {
        case 'calculator':
            calculatorTab.classList.add('active-tab');
            calculatorTab.setAttribute('aria-selected', 'true');
            calculatorContent.classList.remove('hidden');
            break;
        case 'login':
            adminTab.classList.add('active-tab');
            adminTab.setAttribute('aria-selected', 'true');
            adminLoginContent.classList.remove('hidden');
            break;
        case 'adminPanel':
            adminTab.classList.add('active-tab');
            adminTab.setAttribute('aria-selected', 'true');
            adminPanelContent.classList.remove('hidden');
            break;
        case 'report':
            reportTab.classList.add('active-tab');
            reportTab.setAttribute('aria-selected', 'true');
            reportContent.classList.remove('hidden');
            break;
    }
};

adminTab.addEventListener('click', () => {
    // If logged in, show panel, otherwise show login
    showView(isAdmin ? 'adminPanel' : 'login');
});

calculatorTab.addEventListener('click', () => showView('calculator'));

reportTab.addEventListener('click', () => {
    if(isAdmin) showView('report');
});

// --- Admin Login Logic ---
adminLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const password = adminPasswordInput.value;
    if (password === "0665") {
        isAdmin = true;
        reportTab.classList.remove('hidden'); // Show report tab on successful login
        showView('adminPanel');
        adminPasswordInput.value = ""; 
        loginErrorMessage.classList.add("hidden");
    } else {
        loginErrorMessage.textContent = "Incorrect password. Please try again.";
        loginErrorMessage.classList.remove("hidden");
        adminPasswordInput.value = "";
        adminPasswordInput.focus();
    }
});


// --- UI Interaction Logic ---
(document.getElementById('date') as HTMLInputElement).valueAsDate = new Date();

calculationMethodSelect.addEventListener("change", () => {
    const isFugitive = calculationMethodSelect.value === 'fugitive-emission-method';
    fugitiveEmissionInputsWrapper.classList.toggle('hidden', !isFugitive);
    leakRateInput.required = isFugitive;
});

copyLatexBtn.addEventListener('click', () => {
    if (currentLatexReport) {
        navigator.clipboard.writeText(currentLatexReport).then(() => {
            copyLatexBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyLatexBtn.textContent = 'Copy Code';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            copyLatexBtn.textContent = 'Copy Failed';
        });
    }
});


// --- State Management ---
const setLoading = (isLoading: boolean) => {
  if (isLoading) {
    calculateBtn.disabled = true;
    calculateBtn.textContent = "Calculating...";
    resultsPlaceholder?.classList.add("hidden");
    errorMessage?.classList.add("hidden");
    resultsContent.innerHTML = "";
    loadingIndicator?.classList.remove("hidden");
  } else {
    calculateBtn.disabled = false;
    calculateBtn.textContent = "Calculate Required Ventilation";
    loadingIndicator?.classList.add("hidden");
  }
};

const setError = (message: string) => {
    resultsContent.innerHTML = "";
    errorMessage.textContent = message;
    errorMessage.classList.remove("hidden");
}

const setResults = (htmlContent: string, latexContent: string) => {
    errorMessage?.classList.add("hidden");
    resultsContent.innerHTML = htmlContent;

    // Update and store latex report
    currentLatexReport = latexContent;
    latexCodeOutput.textContent = currentLatexReport;
}

// --- Main Application Logic ---
form.addEventListener("submit", (e) => {
  e.preventDefault();
  setLoading(true);

  try {
    const formData = new FormData(form);
    
    // Project Info
    const projectInfo = {
        projectName: formData.get("project-name") as string,
        location: formData.get("location") as string,
        company: formData.get("company") as string,
        date: formData.get("date") as string,
        performedBy: formData.get("performed-by") as string,
    };
    
    // Calculation Inputs
    const calcInputs: ReportInputs = {
        length: parseFloat(formData.get("length") as string),
        width: parseFloat(formData.get("width") as string),
        height: parseFloat(formData.get("height") as string),
        insideTempF: parseFloat(formData.get("inside-temp") as string),
        outsideTempF: parseFloat(formData.get("outside-temp") as string),
        goal: formData.get("calculation-goal") as string,
        method: formData.get("calculation-method") as string,
        leakRate: parseFloat(formData.get("leak-rate") as string),
        lfl: parseFloat(formData.get("lfl") as string),
        safetyFactor: parseFloat(formData.get("safety-factor") as string),
        inletObstructionFactor: parseFloat(formData.get("inlet-obstruction") as string),
        outletObstructionFactor: parseFloat(formData.get("outlet-obstruction") as string),
    };


    if (calcInputs.insideTempF === calcInputs.outsideTempF) {
        setError("Calculation failed: Inside and outside temperatures cannot be the same. A temperature difference is required for the stack effect calculation.");
        return;
    }
    
    if (calcInputs.method === 'fugitive-emission-method' && (isNaN(calcInputs.leakRate) || isNaN(calcInputs.lfl) || isNaN(calcInputs.safetyFactor))) {
        setError("Validation failed: Please fill in all required fields for the Fugitive Emission Method (Leak Rate, LFL, Safety Factor).");
        return;
    }

    const reportHtml = generateEngineeringReport(calcInputs);
    const reportLatex = generateLatexReport(calcInputs, projectInfo);
    setResults(reportHtml, reportLatex);

  } catch (error) {
    console.error(error);
    setError(
      "An error occurred during calculation. Please check your inputs and try again."
    );
  } finally {
    setTimeout(() => setLoading(false), 250);
  }
});

interface ReportInputs {
    length: number;
    width: number;
    height: number;
    insideTempF: number;
    outsideTempF: number;
    goal: string;
    method: string;
    leakRate?: number;
    lfl?: number;
    safetyFactor?: number;
    inletObstructionFactor: number;
    outletObstructionFactor: number;
}

interface ProjectInfo {
    projectName: string;
    location: string;
    company: string;
    date: string;
    performedBy: string;
}

// Helper to get obstruction name from factor for reports
const getObstructionName = (factor: number): string => {
    switch (factor) {
        case 1.0: return 'None (Unobstructed)';
        case 0.92: return 'Bird Screen (92% Free Area)';
        case 0.85: return 'Insect Screen (85% Free Area)';
        case 0.75: return 'Weather Hood (75% Free Area)';
        case 0.55: return 'Standard Louver (55% Free Area)';
        case 0.35: return 'Acoustic Louver (35% Free Area)';
        default: return `Custom Factor: ${factor}`;
    }
};

function generateLatexReport(inputs: ReportInputs, projectInfo: ProjectInfo): string {
    const { length, width, height, insideTempF, outsideTempF, goal, method, leakRate, lfl, safetyFactor, inletObstructionFactor, outletObstructionFactor } = inputs;

    // Helper to escape LaTeX special characters from user input
    const escapeLatex = (str: string) => {
        if (!str) return '';
        return str.replace(/&/g, '\\&')
                  .replace(/%/g, '\\%')
                  .replace(/\$/g, '\\$')
                  .replace(/#/g, '\\#')
                  .replace(/_/g, '\\_')
                  .replace(/{/g, '\\{')
                  .replace(/}/g, '\\}')
                  .replace(/~/g, '\\textasciitilde{}')
                  .replace(/\^/g, '\\textasciicircum{}')
                  .replace(/\\/g, '\\textbackslash{}');
    };
    
    const safeProjectName = escapeLatex(projectInfo.projectName);
    const safeLocation = escapeLatex(projectInfo.location);
    const safeCompany = escapeLatex(projectInfo.company);
    const safePerformedBy = escapeLatex(projectInfo.performedBy);
    const inletObstructionName = escapeLatex(getObstructionName(inletObstructionFactor));
    const outletObstructionName = escapeLatex(getObstructionName(outletObstructionFactor));


    // --- Intermediate Calculations ---
    const K = 0.65; // Discharge coefficient
    const g = 32.2; // Gravity (ft/s^2)
    const dh = height / 2; // Height to Neutral Pressure Level
    const floorArea = length * width;
    const volume = floorArea * height;

    // --- Goal Description ---
    let goalDescription: string;
    switch (goal) {
        case 'reclassify-d1-to-d2':
            goalDescription = `The primary objective of this engineering calculation is to determine the minimum natural ventilation requirements necessary to safely reclassify the specified building from a Class 1, Division 1 hazardous location to a Class 1, Division 2 location. This involves ensuring that any potential flammable gas release is diluted to a concentration well below the Lower Flammable Limit (LFL) under worst-case conditions.`;
            break;
        case 'maintain-d2':
            goalDescription = `The primary objective of this engineering calculation is to verify that the natural ventilation for the specified building is sufficient to maintain its existing Class 1, Division 2 hazardous area classification. This analysis confirms that the ventilation system can adequately dilute potential flammable gas releases to a concentration well below the Lower Flammable Limit (LFL).`;
            break;
        default:
            goalDescription = `The objective is to determine the natural ventilation requirements for the building to be classified as a Class 1, Division 2 hazardous location.`;
    }

    // --- Method-Specific Calculations & LaTeX ---
    let qRequired: number;
    let qRequiredLatex: string;
    let methodDisplay: string;
    let methodologyDescription: string;

    if (method === 'fugitive-emission-method') {
        methodDisplay = 'Fugitive Emission Method (API RP 500)';
        methodologyDescription = `The Fugitive Emission Method, based on the principles outlined in API Recommended Practice 500, has been selected. This method is highly suitable for scenarios where potential leak sources can be estimated. It calculates the required ventilation rate ($Q_v$) by determining the airflow needed to dilute a credible gas leak ($Q_{leak}$) to a fraction of its Lower Flammable Limit (LFL), as determined by a safety factor (C). This approach provides a direct and robust assessment of ventilation adequacy.`;

        const lflDecimal = lfl / 100;
        qRequired = leakRate / (safetyFactor * lflDecimal);
        qRequiredLatex = `
\\subsection{Calculation of Minimum Required Airflow ($Q_{required}$)}
This method calculates the ventilation rate ($Q_v$) needed to dilute a potential gas leak to a concentration below its Lower Flammable Limit (LFL), incorporating a safety factor (C). The fundamental relationship is expressed by the equation:
\\begin{equation}
    Q_{v} = \\frac{Q_{leak}}{C \\times LFL_{decimal}}
\\end{equation}
Where:
\\begin{itemize}
    \\item $Q_{v}$ is the minimum required ventilation rate in Cubic Feet per Minute (CFM).
    \\item $Q_{leak}$ is the assumed or estimated gas leak rate in CFM.
    \\item $C$ is a dimensionless safety factor, typically between 0.25 (for adequate ventilation) and 1.0. A lower value represents a higher degree of safety.
    \\item $LFL_{decimal}$ is the Lower Flammable Limit of the gas, expressed as a decimal fraction (e.g., 5\\% LFL = 0.05).
\\end{itemize}

\\subsubsection*{Substituting Project-Specific Values}
The following values are used for this calculation:
\\begin{itemize}
    \\item $Q_{leak}$ (Assumed Gas Leak Rate) = ${leakRate.toFixed(2)} \\text{ CFM}$
    \\item LFL (Lower Flammable Limit) = ${lfl}\\% = ${lflDecimal.toFixed(3)} \\text{ in decimal form}$
    \\item C (Safety Factor) = ${safetyFactor.toFixed(2)}
\\end{itemize}
First, the target maximum concentration is determined:
\\begin{equation}
    \\text{Max Concentration} = C \\times LFL_{decimal} = ${safetyFactor.toFixed(2)} \\times ${lflDecimal.toFixed(3)} = ${(safetyFactor * lflDecimal).toFixed(4)}
\\end{equation}
Next, the required airflow is calculated:
\\begin{equation}
    Q_{v} = \\frac{${leakRate.toFixed(2)} \\text{ CFM}}{${(safetyFactor * lflDecimal).toFixed(4)}} = ${qRequired.toFixed(2)} \\text{ CFM}
\\end{equation}
Therefore, the minimum required airflow rate to safely dilute the potential leak is \\textbf{${qRequired.toFixed(2)} CFM}.
`;
    } else { // Area Method
        methodDisplay = 'Area Method (AGA XL1001)';
        methodologyDescription = `The Area Method, as specified in Section 5.2 and Appendix B of the American Gas Association (AGA) report XL1001, has been selected. This prescriptive method is applicable for buildings with a floor area up to 2,000 sq ft. It determines the minimum required ventilation rate based on two criteria: a complete air change every 5 minutes and a minimum airflow rate per square foot of floor area. The more stringent of these two criteria is used for the final design.`;

        const airflowByVolume = volume / 5;
        const airflowByArea = floorArea * 1.0;
        qRequired = Math.max(airflowByVolume, airflowByArea);
        qRequiredLatex = `
\\subsection{Calculation of Minimum Required Airflow ($Q_{required}$)}
As per Appendix B of AGA XL1001, the minimum required airflow is the greater of two distinct criteria. Both are calculated below to determine the controlling requirement.

\\subsubsection*{Criterion A: One Complete Air Change in 5 Minutes}
This criterion ensures that the entire volume of air within the building is replaced within a 5-minute timeframe.
\\begin{itemize}
    \\item Building Volume ($V$) = Length $\\times$ Width $\\times$ Height
    \\item $V = ${length.toFixed(2)} \\text{ ft} $\\times$ ${width.toFixed(2)} \\text{ ft} $\\times$ ${height.toFixed(2)} \\text{ ft} = ${volume.toFixed(2)} \\text{ ft}^3$
\\end{itemize}
The required airflow based on volume ($Q_{volume}$) is:
\\begin{equation}
    Q_{volume} = \\frac{V}{5 \\text{ min}} = \\frac{${volume.toFixed(2)} \\text{ ft}^3}{5 \\text{ min}} = ${airflowByVolume.toFixed(2)} \\text{ CFM}
\\end{equation}

\\subsubsection*{Criterion B: 1.0 CFM per Square Foot of Floor Area}
This criterion provides a baseline ventilation rate based on the building's footprint.
\\begin{itemize}
    \\item Floor Area ($A_{floor}$) = Length $\\times$ Width
    \\item $A_{floor} = ${length.toFixed(2)} \\text{ ft} $\\times$ ${width.toFixed(2)} \\text{ ft} = ${floorArea.toFixed(2)} \\text{ ft}^2$
\\end{itemize}
The required airflow based on area ($Q_{area}$) is:
\\begin{equation}
    Q_{area} = A_{floor} \\times 1.0 \\frac{\\text{CFM}}{\\text{ft}^2} = ${floorArea.toFixed(2)} \\text{ ft}^2 \\times 1.0 \\frac{\\text{CFM}}{\\text{ft}^2} = ${airflowByArea.toFixed(2)} \\text{ CFM}
\\end{equation}

\\subsubsection*{Conclusion for Required Airflow}
The final required airflow rate ($Q_{required}$) is the greater of the values calculated from Criterion A and Criterion B.
\\begin{equation}
    Q_{required} = \\max(Q_{volume}, Q_{area}) = \\max(${airflowByVolume.toFixed(2)}, ${airflowByArea.toFixed(2)}) = ${qRequired.toFixed(2)} \\text{ CFM}
\\end{equation}
Therefore, the minimum required airflow rate for this building is \\textbf{${qRequired.toFixed(2)} CFM}.
`;
    }

    // --- Common Calculations & LaTeX ---
    const tiRankine = insideTempF + 459.67;
    const toRankine = outsideTempF + 459.67;
    const tempDenominator = Math.max(tiRankine, toRankine);
    const deltaT = Math.abs(tiRankine - toRankine);
    const sqrtInnerTerm = (2 * g * dh * deltaT) / tempDenominator;
    const sqrtTerm = Math.sqrt(sqrtInnerTerm);
    const singleOpeningFreeArea = qRequired / (60 * K * sqrtTerm);
    
    const grossInletArea = singleOpeningFreeArea / inletObstructionFactor;
    const grossOutletArea = singleOpeningFreeArea / outletObstructionFactor;
    const totalRequiredGrossArea = grossInletArea + grossOutletArea;


    const ventAreaLatex = `
\\subsection{Calculation of Required Free Vent Area (A)}
The required airflow ($Q_{required}$) is achieved through natural ventilation driven by the stack effect. The stack effect is the bulk movement of air due to density differences arising from temperature differentials between the building's interior and exterior. The physical vent area needed to facilitate this airflow is calculated using the following industry-standard formula:
\\begin{equation}
    A_{free} = \\frac{Q}{60 \\cdot K \\cdot \\sqrt{\\frac{2 \\cdot g \\cdot \\Delta h \\cdot |T_i - T_o|}{T_{abs, max}}}}
\\end{equation}
\\subsubsection*{Definition of Variables and Constants}
\\begin{itemize}
    \\item $A_{free}$ = Required \\textbf{free} (unobstructed) vent area for \\textbf{each} opening (i.e., for the inlet and for the outlet) in square feet (ft$^2$). This is the value to be calculated.
    \\item $Q$ = Required airflow rate from the previous step, in CFM. ($Q = ${qRequired.toFixed(2)} \\text{ CFM})
    \\item $60$ = Conversion factor from minutes to seconds.
    \\item $K$ = Discharge Coefficient (dimensionless). This factor accounts for the efficiency of the opening. A value of \\textbf{${K}} is a standard, conservative assumption for a sharp-edged orifice or louver.
    \\item $g$ = Acceleration due to gravity. In Imperial units, $g = \\textbf{${g} \\text{ ft/s}^2}$.
    \\item $\\Delta h$ = Height to the Neutral Pressure Level in feet (ft). For a simple building with high and low vents, this is assumed to be half the building height. ($\\Delta h = ${height.toFixed(2)} / 2 = \\textbf{${dh.toFixed(2)} \\text{ ft}})
    \\item $T_i$ = Inside absolute temperature in degrees Rankine (°R).
    \\item $T_o$ = Outside absolute temperature in degrees Rankine (°R).
    \\item $T_{abs, max}$ = The greater of the inside or outside absolute temperature, used as the denominator to represent the density of the air exiting the building.
\\end{itemize}

\\subsubsection*{Step-by-Step Calculation for Free Area}
\\paragraph{1. Convert Temperatures to Absolute Scale (Rankine)}
The formula requires temperatures to be in an absolute scale.
\\begin{itemize}
    \\item $T_i (°R) = T_i (°F) + 459.67 = ${insideTempF.toFixed(2)} + 459.67 = ${tiRankine.toFixed(2)} °R$
    \\item $T_o (°R) = T_o (°F) + 459.67 = ${outsideTempF.toFixed(2)} + 459.67 = ${toRankine.toFixed(2)} °R$
    \\item $|T_i - T_o| = |${tiRankine.toFixed(2)} - ${toRankine.toFixed(2)}| = ${deltaT.toFixed(2)} °R$
    \\item $T_{abs, max} = \\max(${tiRankine.toFixed(2)}, ${toRankine.toFixed(2)}) = ${tempDenominator.toFixed(2)} °R$
\\end{itemize}

\\paragraph{2. Calculate the Driving Force Term (inside the square root)}
\\begin{equation}
    \\frac{2 \\cdot g \\cdot \\Delta h \\cdot |T_i - T_o|}{T_{abs, max}} = \\frac{2 \\cdot ${g} \\cdot ${dh.toFixed(2)} \\cdot ${deltaT.toFixed(2)}}{${tempDenominator.toFixed(2)}} = ${sqrtInnerTerm.toFixed(3)} \\text{ ft}^2/\\text{s}^2
\\end{equation}

\\paragraph{3. Calculate the Velocity Term (the square root)}
\\begin{equation}
    \\sqrt{${sqrtInnerTerm.toFixed(3)}} = ${sqrtTerm.toFixed(3)} \\text{ ft/s}
\\end{equation}

\\paragraph{4. Substitute all values to find the required free area per opening, $A_{free}$}
\\begin{equation}
    A_{free} = \\frac{${qRequired.toFixed(2)}}{60 \\cdot ${K} \\cdot ${sqrtTerm.toFixed(3)}} = \\frac{${qRequired.toFixed(2)}}{${(60 * K * sqrtTerm).toFixed(2)}} = ${singleOpeningFreeArea.toFixed(2)} \\text{ ft}^2
\\end{equation}

\\subsection{Adjustment for Vent Obstructions (Gross Area)}
The calculated $A_{free}$ represents the net clear area required. Obstructions like louvers and screens reduce the effective area of a vent. Therefore, the \\textbf{gross} physical area of the vent must be larger. This is calculated by dividing the free area by the obstruction's free area factor.

\\subsubsection*{Low-Level Inlet Gross Area}
\\begin{equation}
    A_{gross, inlet} = \\frac{A_{free}}{\\text{Factor}_{inlet}} = \\frac{${singleOpeningFreeArea.toFixed(2)} \\text{ ft}^2}{${inletObstructionFactor.toFixed(2)}} = ${grossInletArea.toFixed(2)} \\text{ ft}^2
\\end{equation}

\\subsubsection*{High-Level Outlet Gross Area}
\\begin{equation}
    A_{gross, outlet} = \\frac{A_{free}}{\\text{Factor}_{outlet}} = \\frac{${singleOpeningFreeArea.toFixed(2)} \\text{ ft}^2}{${outletObstructionFactor.toFixed(2)}} = ${grossOutletArea.toFixed(2)} \\text{ ft}^2
\\end{equation}
`;

    // --- Final Report Assembly ---
    return `
\\documentclass[11pt, letterpaper]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{amsmath}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{fancyhdr}
\\usepackage{hyperref}
\\usepackage{float}
\\usepackage{tabularx}
\\usepackage{microtype}

\\hypersetup{
    colorlinks=true, linkcolor=blue, urlcolor=cyan,
    pdftitle={Ventilation Calculation Report},
    pdfauthor={${safePerformedBy}},
    pdfsubject={Engineering Report},
    breaklinks=true
}

\\title{Engineering Report: \\\\ Ventilation Calculation for Electrical Area Classification}
\\author{${safePerformedBy} \\\\ ${safeCompany}}
\\date{${projectInfo.date}}

\\pagestyle{fancy}
\\fancyhf{} % clear all header and footer fields
\\fancyhead[L]{${safeCompany} - ${safeProjectName}}
\\fancyfoot[C]{\\thepage}
\\renewcommand{\\headrulewidth}{0.4pt}
\\renewcommand{\\footrulewidth}{0.4pt}

\\begin{document}
\\maketitle
\\thispagestyle{empty}
\\newpage

\\tableofcontents
\\newpage

\\section{Executive Summary}
This engineering report details the calculation of natural ventilation requirements for the facility located at ${safeLocation}, for the project titled "${safeProjectName}". The objective is to ensure compliance with standards for a Class 1, Division 2 hazardous area classification.

Based on the input parameters and the selected \\textbf{${methodDisplay}}, the analysis concludes that a \\textbf{total installed gross vent area of ${totalRequiredGrossArea.toFixed(2)} square feet} is required. To achieve effective ventilation for lighter-than-air gases, this area must be divided between low-level inlet openings and high-level outlet openings, accounting for any obstructions like louvers or screens. This report provides a detailed step-by-step breakdown of the calculation process and final recommendations.

\\section{Objective}
${goalDescription}

\\section{Methodology and Standards}
${methodologyDescription}
${method === 'area-method' && floorArea > 2000 ? `
\\par\\textbf{Warning:} The building's floor area of ${floorArea.toFixed(2)} ft$^2$ exceeds the 2,000 ft$^2$ guideline for this method. The Fugitive Emission Method is strongly recommended as a more appropriate alternative.` : ''}

\\section{Input Parameters}
The calculations herein are based on the following project-specific data:
\\begin{table}[H]
\\centering
\\caption{Summary of Input Parameters}
\\label{tab:inputs}
\\begin{tabularx}{\\textwidth}{l X}
\\toprule
\\textbf{Parameter} & \\textbf{Value} \\\\
\\midrule
\\multicolumn{2}{c}{\\textbf{Project Information}} \\\\
\\midrule
Project Name & ${safeProjectName} \\\\
Location & ${safeLocation} \\\\
Company & ${safeCompany} \\\\
Date & ${projectInfo.date} \\\\
Performed By & ${safePerformedBy} \\\\
\\midrule
\\multicolumn{2}{c}{\\textbf{Building and Environmental Data}} \\\\
\\midrule
Building Length & ${length.toFixed(2)} ft \\\\
Building Width & ${width.toFixed(2)} ft \\\\
Building Height & ${height.toFixed(2)} ft \\\\
Inside Temperature ($T_{i,F}$) & ${insideTempF.toFixed(2)} °F \\\\
Outside Temperature ($T_{o,F}$) & ${outsideTempF.toFixed(2)} °F \\\\
Inlet Vent Obstruction & ${inletObstructionName} \\\\
Outlet Vent Obstruction & ${outletObstructionName} \\\\
\\midrule
\\multicolumn{2}{c}{\\textbf{Calculation Method Parameters}} \\\\
\\midrule
Calculation Method & ${methodDisplay} \\\\
${method === 'fugitive-emission-method' ? `
Assumed Gas Leak Rate ($Q_{leak}$) & ${leakRate.toFixed(2)} CFM \\\\
Gas LFL & ${lfl}\\% \\\\
Safety Factor (C) & ${safetyFactor.toFixed(2)} \\\\
` : ''}
\\bottomrule
\\end{tabularx}
\\end{table}

\\section{Calculation Process}
The calculation is performed in two main stages: first, determining the minimum required airflow rate ($Q_{required}$), and second, calculating the physical vent area (A) needed to achieve that airflow via natural stack effect.

${qRequiredLatex}

${ventAreaLatex}

\\section{Results}
The key results derived from the calculation process are summarized below.
\\begin{table}[H]
\\centering
\\caption{Summary of Calculation Results}
\\label{tab:results}
\\begin{tabularx}{\\textwidth}{X l}
\\toprule
\\textbf{Calculated Result} & \\textbf{Value} \\\\ 
\\midrule
Required Airflow Rate ($Q_{required}$) & ${qRequired.toFixed(2)} \\text{ CFM} \\\\
Required Free Area per Opening ($A_{free}$) & ${singleOpeningFreeArea.toFixed(2)} \\text{ sq ft} \\\\
\\midrule
\\multicolumn{2}{c}{\\textbf{Final Recommended Gross Vent Area}} \\\\ 
\\midrule
Required Low-Level Inlet Gross Area & ${grossInletArea.toFixed(2)} \\text{ sq ft} \\\\
Required High-Level Outlet Gross Area & ${grossOutletArea.toFixed(2)} \\text{ sq ft} \\\\
\\midrule
\\textbf{Total Required Gross Vent Area} & \\textbf{${totalRequiredGrossArea.toFixed(2)} sq ft} \\\\ 
\\bottomrule
\\end{tabularx}
\\end{table}

\\section{Final Summary and Recommendation}
To achieve adequate ventilation for a Class 1, Division 2 classification, a total installed \\textbf{gross vent area of ${totalRequiredGrossArea.toFixed(2)} square feet} is required.

It is strongly recommended that this area be split between low-level inlet vents and high-level outlet vents to ensure effective air circulation and purging of lighter-than-air gases (e.g., natural gas). The required gross area for each is specified below to provide the necessary \\textbf{${singleOpeningFreeArea.toFixed(2)} sq ft of free area} at each location.
\\begin{itemize}
    \\item \\textbf{Low-Level Inlet Vents:} A total installed gross area of \\textbf{${grossInletArea.toFixed(2)} sq ft} should be located as low as practicable.
    \\item \\textbf{High-Level Outlet Vents:} A total installed gross area of \\textbf{${grossOutletArea.toFixed(2)} sq ft} should be located as high as practicable.
\\end{itemize}

\\textbf{Important Note on "Free Area" vs "Gross Area":} The term "free vent area" refers to the net clear area of the opening. The presence of louvers, screens, grilles, or other obstructions can significantly reduce this area. The "gross area" is the larger physical size of the vent needed to compensate for these obstructions. The manufacturer's data for the selected ventilation devices should be consulted to verify their free area percentage.

\\section{Assumptions and Disclaimer}
\\subsection*{Assumptions}
\\begin{itemize}
    \\item The calculation assumes \\textbf{no-wind conditions}, representing a worst-case scenario where natural ventilation relies solely on the thermal stack effect.
    \\item The potentially flammable gas is assumed to be \\textbf{lighter than air} (e.g., natural gas), dictating the placement of high-level exhaust vents.
    \\item The Discharge Coefficient (K=0.65) assumes vents are simple, sharp-edged openings. The actual coefficient may vary.
    \\item The building is assumed to be reasonably well-sealed, such that ventilation occurs primarily through the designed openings.
\\end{itemize}
\\subsection*{Disclaimer}
This report provides a preliminary calculation based on the provided data and standard engineering formulas. It is intended for informational and planning purposes only. This document should be reviewed and approved by a qualified professional engineer before being used for final design, construction, or official classification purposes. The user is solely responsible for verifying the applicability of the chosen method and the accuracy of all input data.

\\end{document}
`;
}


function generateEngineeringReport(inputs: ReportInputs): string {
  const { length, width, height, insideTempF, outsideTempF, goal, method, leakRate, lfl, safetyFactor, inletObstructionFactor, outletObstructionFactor } = inputs;
  
  // --- Constants and Initial Calculations ---
  const K = 0.65; // Discharge coefficient
  const g = 32.2; // Gravity (ft/s^2)
  const dh = height / 2; // Height to Neutral Pressure Level
  const floorArea = length * width;
  const volume = floorArea * height;
  
  let goalDescription: string;
  switch (goal) {
    case 'reclassify-d1-to-d2':
      goalDescription = "To determine the natural ventilation requirements necessary to reclassify the specified building from Class 1, Division 1 to Class 1, Division 2.";
      break;
    case 'maintain-d2':
      goalDescription = "To verify the natural ventilation requirements needed to maintain the building's existing Class 1, Division 2 classification.";
      break;
    default:
      goalDescription = "To determine the natural ventilation requirements for the building to be classified as Class 1, Division 2.";
  }
  
  // --- Calculation Logic ---
  let verificationContent: string;
  let qRequired: number;
  let qRequiredContent: string;

  if (method === 'fugitive-emission-method') {
    verificationContent = `
        <h3>3. Verification of Calculation Method</h3>
        <p>The <strong>Fugitive Emission Method</strong> (based on API RP 500 principles) has been selected. This method is suitable for any building size, especially where specific potential leak sources can be estimated. It provides a direct calculation of the ventilation needed to prevent the formation of a flammable atmosphere by diluting potential leaks.</p>
    `;
    
    const lflDecimal = lfl / 100;
    qRequired = leakRate / (safetyFactor * lflDecimal);

    qRequiredContent = `
        <h3>4. Calculation of Minimum Required Airflow (Q<sub>required</sub>)</h3>
        <p>This method calculates the ventilation rate (Q<sub>v</sub>) needed to dilute a potential gas leak to a concentration below its Lower Flammable Limit (LFL), incorporating a safety factor (C).</p>
        <p>Formula: <code>Q<sub>v</sub> = Q<sub>leak</sub> / (C * LFL)</code></p>
        <h4>Substitution of Values:</h4>
        <ul>
            <li>Assumed Gas Leak Rate (Q<sub>leak</sub>) = <strong>${leakRate.toFixed(2)} CFM</strong></li>
            <li>Lower Flammable Limit (LFL) = ${lfl}% = <strong>${lflDecimal.toFixed(3)}</strong> in decimal form</li>
            <li>Safety Factor (C) = ${safetyFactor * 100}% = <strong>${safetyFactor.toFixed(2)}</strong> (unitless)</li>
        </ul>
        <h4>Step-by-Step Calculation:</h4>
        <ol>
            <li>Calculate the target concentration limit: C * LFL = ${safetyFactor.toFixed(2)} * ${lflDecimal.toFixed(3)} = <strong>${(safetyFactor * lflDecimal).toFixed(4)}</strong>. This is the maximum safe concentration allowed.</li>
            <li>Calculate required airflow: Q<sub>v</sub> = ${leakRate.toFixed(2)} CFM / ${(safetyFactor * lflDecimal).toFixed(4)} = <strong>${qRequired.toFixed(2)} CFM</strong>.</li>
        </ol>
        <h4>Conclusion for Required Airflow</h4>
        <p>The ventilation system must provide at least this rate of airflow to safely dilute potential leaks.</p>
        <ul>
          <li>Q<sub>required</sub> = <strong>${qRequired.toFixed(2)} CFM</strong> (Cubic Feet per Minute)</li>
        </ul>
    `;

  } else { // Area Method
      verificationContent = `
        <h3>3. Verification of Calculation Method</h3>
        <p>The <strong>Area Method</strong> (per Section 5.2 of AGA XL1001) has been selected. This method is applicable for buildings up to 2,000 sq ft.</p>
        <ul>
          <li>Building Floor Area = ${length} ft * ${width} ft = <strong>${floorArea.toFixed(2)} sq ft</strong></li>
        </ul>`;
      if (floorArea > 2000) {
        verificationContent += `<p class="warning"><strong>Warning:</strong> The building's floor area exceeds 2,000 sq ft. Per AGA XL1001, Section 5.2, this method may not be appropriate. It is recommended to use the Fugitive Emission Method instead.</p>`;
      } else {
        verificationContent += `<p>The building's floor area is within the acceptable range for this method.</p>`;
      }
      
      const airflowByVolume = volume / 5;
      const airflowByArea = floorArea * 1.0;
      qRequired = Math.max(airflowByVolume, airflowByArea);
      
      qRequiredContent = `
        <h3>4. Calculation of Minimum Required Airflow (Q<sub>required</sub>)</h3>
        <p>As per Appendix B of AGA XL1001, the minimum required airflow is the greater of two conditions:</p>
        <h4>Criterion A: Complete Air Change in 5 Minutes</h4>
        <ul>
            <li>Building Volume = ${length} ft * ${width} ft * ${height} ft = ${volume.toFixed(2)} cu ft</li>
            <li>Required Airflow (Q<sub>volume</sub>) = ${volume.toFixed(2)} cu ft / 5 min = <strong>${airflowByVolume.toFixed(2)} CFM</strong></li>
        </ul>
        <h4>Criterion B: 1.0 CFM per Square Foot of Floor Area</h4>
        <ul>
            <li>Floor Area = ${floorArea.toFixed(2)} sq ft</li>
            <li>Required Airflow (Q<sub>area</sub>) = ${floorArea.toFixed(2)} sq ft * 1.0 CFM/sq ft = <strong>${airflowByArea.toFixed(2)} CFM</strong></li>
        </ul>
        <h4>Conclusion for Required Airflow</h4>
        <p>The greater of the two values is selected to ensure adequate ventilation:</p>
        <ul>
          <li>Q<sub>required</sub> = max(${airflowByVolume.toFixed(2)}, ${airflowByArea.toFixed(2)}) = <strong>${qRequired.toFixed(2)} CFM</strong> (Cubic Feet per Minute)</li>
        </ul>
      `;
  }

  // --- Common Calculations for Vent Area ---
  const tiRankine = insideTempF + 459.67;
  const toRankine = outsideTempF + 459.67;
  const tempDenominator = Math.max(tiRankine, toRankine); 
  const deltaT = Math.abs(tiRankine - toRankine);
  const sqrtTerm = Math.sqrt((2 * g * dh * deltaT) / tempDenominator);
  const singleOpeningFreeArea = qRequired / (60 * K * sqrtTerm);

  const grossInletArea = singleOpeningFreeArea / inletObstructionFactor;
  const grossOutletArea = singleOpeningFreeArea / outletObstructionFactor;
  const totalRequiredGrossArea = grossInletArea + grossOutletArea;


  // --- Report Section Generation ---
  const summaryInputsContent = `
    <h3>1. Summary of Inputs</h3>
    <table class="data-table">
        <tr><td>Building Length</td><td>${length.toFixed(2)} ft</td></tr>
        <tr><td>Building Width</td><td>${width.toFixed(2)} ft</td></tr>
        <tr><td>Building Height</td><td>${height.toFixed(2)} ft</td></tr>
        <tr><td>Inside Temperature</td><td>${insideTempF.toFixed(2)} °F</td></tr>
        <tr><td>Outside Temperature</td><td>${outsideTempF.toFixed(2)} °F</td></tr>
        <tr><td>Inlet Obstruction</td><td>${getObstructionName(inletObstructionFactor)}</td></tr>
        <tr><td>Outlet Obstruction</td><td>${getObstructionName(outletObstructionFactor)}</td></tr>
        <tr><td>Calculation Method</td><td>${method === 'area-method' ? 'Area Method (AGA XL1001)' : 'Fugitive Emission Method (API RP 500)'}</td></tr>
        ${method === 'fugitive-emission-method' ? `
        <tr><td>Gas Leak Rate (Q_leak)</td><td>${leakRate.toFixed(2)} CFM</td></tr>
        <tr><td>Gas LFL</td><td>${lfl}%</td></tr>
        <tr><td>Safety Factor (C)</td><td>${safetyFactor.toFixed(2)}</td></tr>
        ` : ''}
    </table>
  `;
  
  const ventAreaContent = `
    <h3>5. Calculation of Required Vent Area</h3>
    <p>This section calculates the physical vent area required to achieve Q<sub>required</sub> using the natural stack effect, which is air movement driven by temperature differences.</p>
    <h4>A. Required Free Area</h4>
    <p>First, we calculate the required <strong>free area</strong> (A<sub>free</sub>), which is the unobstructed opening size needed for airflow.</p>
    <p>Formula: <code>A<sub>free</sub> = Q / (60 * K * &radic;(2 * g * &Delta;h * |T<sub>i</sub> - T<sub>o</sub>| / T<sub>max,abs</sub>))</code></p>
    <ul>
      <li><b>Q</b> = ${qRequired.toFixed(2)} CFM</li>
      <li><b>K</b> = ${K} (Discharge Coefficient)</li>
      <li><b>g</b> = ${g} ft/s² (Gravity)</li>
      <li><b>&Delta;h</b> = ${dh.toFixed(2)} ft (Height to Neutral Pressure Level)</li>
      <li><b>|T<sub>i,abs</sub> - T<sub>o,abs</sub>|</b> = ${deltaT.toFixed(2)} °R (Absolute temp difference)</li>
    </ul>
    <p>This calculation results in a required free area of <strong>${singleOpeningFreeArea.toFixed(2)} sq ft per opening</strong> (one for inlet, one for outlet).</p>

    <h4>B. Required Gross Area</h4>
    <p>Next, we adjust for obstructions like louvers or screens to find the <strong>gross area</strong> (A<sub>gross</sub>), which is the actual size of the vent you need to install.</p>
    <p>Formula: <code>A<sub>gross</sub> = A<sub>free</sub> / ObstructionFactor</code></p>
    <ul>
      <li>Low-Level Inlet: ${singleOpeningFreeArea.toFixed(2)} sq ft / ${inletObstructionFactor.toFixed(2)} = <strong>${grossInletArea.toFixed(2)} sq ft</strong></li>
       <li>High-Level Outlet: ${singleOpeningFreeArea.toFixed(2)} sq ft / ${outletObstructionFactor.toFixed(2)} = <strong>${grossOutletArea.toFixed(2)} sq ft</strong></li>
    </ul>
    <p><b>Note:</b> The calculated free area represents the required unobstructed area for low-level inlets, and an equal free area is required for high-level outlets. The gross area is the larger physical size needed to achieve that free area.</p>
  `;

  const recommendationContent = `
    <h3>6. Final Recommendation</h3>
    <p>To achieve adequate ventilation for a Class 1, Division 2 classification, a total installed <strong>gross vent area of ${totalRequiredGrossArea.toFixed(2)} square feet</strong> is required.</p>
    <p>This total area must be appropriately distributed between low and high vents to ensure proper air circulation for lighter-than-air gases:</p>
    <ul>
      <li><strong>Required Low-level Inlet Gross Area: ${grossInletArea.toFixed(2)} sq ft</strong></li>
      <li><strong>Required High-level Outlet Gross Area: ${grossOutletArea.toFixed(2)} sq ft</strong></li>
    </ul>
    <p>These gross areas will provide the necessary <strong>${singleOpeningFreeArea.toFixed(2)} sq ft of free area</strong> at each location (inlet and outlet).</p>
    <p class="warning">Note: The "gross area" is the physical vent size needed. The "free area" is the net clear opening after accounting for obstructions. Always verify the free area percentage with the vent manufacturer's specifications.</p>
  `;
  
  const assumptionsAndDisclaimer = `
    <h3>7. Assumptions & Limitations</h3>
    <ul>
      <li>The calculation assumes <strong>no-wind conditions</strong>, representing a worst-case scenario for natural ventilation which relies solely on the stack effect.</li>
      <li>The gas being handled is assumed to be <strong>lighter than air</strong> (e.g., natural gas), dictating the placement of high-level exhaust vents.</li>
      <li>The Discharge Coefficient (K=0.65) assumes vents are simple, sharp-edged openings. The presence of louvers, screens, or other obstructions will reduce the effective free area and require a larger gross vent size.</li>
      <li>The building is assumed to be reasonably well-sealed, so that ventilation occurs primarily through the designed openings.</li>
    </ul>

    <h3>8. Disclaimer</h3>
    <p>This report provides a preliminary calculation based on the provided data and standard engineering formulas. It should be reviewed and approved by a qualified professional engineer before being used for design, construction, or official classification purposes. The user is solely responsible for verifying the applicability of the chosen method and the accuracy of the input data.</p>
  `;

  return `
    <h2>Engineering Report: Ventilation Calculation</h2>
    
    <h3>Executive Summary</h3>
    <p>Based on the provided data and selected calculation method, the <strong>Total Required Gross Vent Area</strong> to achieve the ventilation goal is:</p>
    <div class="summary-result">
      ${totalRequiredGrossArea.toFixed(2)} sq ft
    </div>

    ${summaryInputsContent}

    <h3>2. Objective</h3>
    <p>${goalDescription}</p>

    ${verificationContent}
    ${qRequiredContent}
    ${ventAreaContent}
    ${recommendationContent}
    ${assumptionsAndDisclaimer}
  `;
}