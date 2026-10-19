document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const dropZoneContent = document.querySelector(".drop-zone-content");
  const filePreview = document.getElementById("file-preview");
  const fileNameDisplay = document.getElementById("file-name-display");
  const fileSizeDisplay = document.getElementById("file-size-display");
  const clearFileBtn = document.getElementById("clear-file-btn");

  const paperTypeSelect = document.getElementById("paper-type-select");
  const engineBadge = document.getElementById("engine-badge");
  const paperTypeDesc = document.getElementById("paper-type-desc");

  const languagesSelect = document.getElementById("languages-select");
  const customLanguageInput = document.getElementById("custom-language-input");
  const dpiInput = document.getElementById("dpi-input");
  const startPageInput = document.getElementById("start-page");
  const endPageInput = document.getElementById("end-page");

  const submitBtn = document.getElementById("submit-btn");
  const submitSpinner = document.getElementById("submit-spinner");
  const btnText = document.querySelector(".btn-text");

  const emptyState = document.getElementById("empty-state");
  const loadingState = document.getElementById("loading-state");
  const loadingStatusText = document.getElementById("loading-status-text");
  const loadingSubText = document.getElementById("loading-sub-text");
  const statsPills = document.getElementById("stats-pills");
  const actionButtons = document.getElementById("action-buttons");
  const tabsNav = document.getElementById("tabs-nav");

  const statSubject = document.getElementById("stat-subject");
  const statDiagrams = document.getElementById("stat-diagrams");
  const statQuestions = document.getElementById("stat-questions");
  const statTime = document.getElementById("stat-time");
  const diagramBadgeCount = document.getElementById("diagram-badge-count");

  const tabMaths = document.getElementById("tab-maths");
  const tabPhysics = document.getElementById("tab-physics");
  const tabChemistry = document.getElementById("tab-chemistry");
  const tabDiagrams = document.getElementById("tab-diagrams");
  const tabMarkdownPreview = document.getElementById("tab-markdown-preview");
  const tabCombined = document.getElementById("tab-combined");
  const tabPages = document.getElementById("tab-pages");
  const tabJson = document.getElementById("tab-json");

  const markdownRenderedView = document.getElementById("markdown-rendered-view");
  const markdownRawView = document.getElementById("markdown-raw-view");
  const markdownExamTitle = document.getElementById("markdown-exam-title");
  const toggleMarkdownRawBtn = document.getElementById("toggle-markdown-raw-btn");
  const copyFullMarkdownBtn = document.getElementById("copy-full-markdown-btn");
  const downloadMarkdownBtn = document.getElementById("download-markdown-btn");

  const mathsQuestionsContainer = document.getElementById("maths-questions-container");
  const physicsQuestionsContainer = document.getElementById("physics-questions-container");
  const chemistryQuestionsContainer = document.getElementById("chemistry-questions-container");
  const diagramsGallery = document.getElementById("diagrams-gallery");
  const combinedTextArea = document.getElementById("combined-text-area");
  const pagesList = document.getElementById("pages-list");
  const jsonDisplay = document.getElementById("json-display");

  const mathsExamTitle = document.getElementById("maths-exam-title");
  const physicsExamTitle = document.getElementById("physics-exam-title");
  const chemistryExamTitle = document.getElementById("chemistry-exam-title");

  const copyBtn = document.getElementById("copy-btn");
  const downloadBtn = document.getElementById("download-btn");
  const copyMathLatexBtn = document.getElementById("copy-math-latex-btn");
  const copyMathMarkdownBtn = document.getElementById("copy-math-markdown-btn");
  const copyPhysicsMarkdownBtn = document.getElementById("copy-physics-markdown-btn");
  const copyChemMarkdownBtn = document.getElementById("copy-chem-markdown-btn");

  // Modal elements
  const keyModalTrigger = document.getElementById("key-modal-trigger");
  const apiKeyModal = document.getElementById("api-key-modal");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const cancelKeyBtn = document.getElementById("cancel-key-btn");
  const saveKeyBtn = document.getElementById("save-key-btn");
  const geminiKeyInput = document.getElementById("gemini-key-input");
  const geminiModelSelect = document.getElementById("gemini-model-select");
  const keyIndicator = document.getElementById("key-indicator");
  const keyStatusText = document.getElementById("key-status-text");

  // Diagram zoom modal
  const diagramModal = document.getElementById("diagram-modal");
  const closeDiagramModalBtn = document.getElementById("close-diagram-modal-btn");
  const diagramModalImg = document.getElementById("diagram-modal-img");
  const diagramModalTitle = document.getElementById("diagram-modal-title");
  const diagramModalRef = document.getElementById("diagram-modal-ref");
  const diagramModalSize = document.getElementById("diagram-modal-size");
  const diagramDownloadLink = document.getElementById("diagram-download-link");

  // Diagram Picker Modal elements
  const diagramPickerModal = document.getElementById("diagram-picker-modal");
  const closeDiagramPickerBtn = document.getElementById("close-diagram-picker-btn");
  const pickerCloseBtn = document.getElementById("picker-close-btn");
  const pickerDetachBtn = document.getElementById("picker-detach-btn");
  const pickerCustomUpload = document.getElementById("picker-custom-upload");
  const pickerTargetBadge = document.getElementById("picker-target-badge");
  const pickerCurrentStatus = document.getElementById("picker-current-status");
  const pickerAvailableCount = document.getElementById("picker-available-count");
  const pickerDiagramsGrid = document.getElementById("picker-diagrams-grid");
  const toastContainer = document.getElementById("toast-container");

  let selectedFile = null;
  let lastResult = null;
  let currentSubjectType = "formula_maths";
  let activePickerContext = null;

  // Initialize API Key state
  function updateKeyIndicator() {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) {
      keyIndicator.textContent = "✓";
      keyStatusText.textContent = "Gemini Key Saved";
      keyModalTrigger.style.borderColor = "rgba(16, 185, 129, 0.4)";
      keyModalTrigger.style.color = "#10b981";
    } else {
      keyIndicator.textContent = "🔑";
      keyStatusText.textContent = "Set Gemini Key";
      keyModalTrigger.style.borderColor = "rgba(255, 255, 255, 0.08)";
      keyModalTrigger.style.color = "var(--text-muted)";
    }
  }
  updateKeyIndicator();

  // Modal open/close
  keyModalTrigger.addEventListener("click", () => {
    geminiKeyInput.value = localStorage.getItem("gemini_api_key") || "";
    geminiModelSelect.value = localStorage.getItem("gemini_model") || "gemini-1.5-flash-8b";
    apiKeyModal.classList.remove("hidden");
  });

  function closeKeyModal() {
    apiKeyModal.classList.add("hidden");
  }
  closeModalBtn.addEventListener("click", closeKeyModal);
  cancelKeyBtn.addEventListener("click", closeKeyModal);

  saveKeyBtn.addEventListener("click", () => {
    const key = geminiKeyInput.value.trim();
    if (key) {
      localStorage.setItem("gemini_api_key", key);
    } else {
      localStorage.removeItem("gemini_api_key");
    }
    localStorage.setItem("gemini_model", geminiModelSelect.value);
    updateKeyIndicator();
    closeKeyModal();
  });

  // Paper Type Selection Change
  paperTypeSelect.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val === "formula_maths") {
      engineBadge.textContent = "Pix2Text Enabled";
      engineBadge.style.background = "linear-gradient(135deg, #6366f1, #a855f7)";
      paperTypeDesc.innerHTML = "Uses <strong>Pix2Text</strong> formula engine for LaTeX equations ($\\int, \\sum, \\lim$, fractions, matrices) and crops geometric figures.";
    } else if (val === "physics") {
      engineBadge.textContent = "STEM Physics";
      engineBadge.style.background = "linear-gradient(135deg, #0284c7, #2563eb)";
      paperTypeDesc.innerHTML = "Specialized for physics equations, vector signs, units ($m/s^2, kg$), and <strong>cropped diagrams</strong> (circuits, mechanics, rays).";
    } else if (val === "chemistry") {
      engineBadge.textContent = "STEM Chemistry";
      engineBadge.style.background = "linear-gradient(135deg, #059669, #10b981)";
      paperTypeDesc.innerHTML = "Specialized for chemical formulas ($H_2SO_4, KMnO_4$), reaction arrows, states of matter, and <strong>cropped apparatus diagrams</strong>.";
    } else {
      engineBadge.textContent = "Multilingual";
      engineBadge.style.background = "linear-gradient(135deg, #475569, #64748b)";
      paperTypeDesc.innerHTML = "Standard OCR for general and multilingual humanities papers with bilingual question alignment.";
    }
  });

  // Language custom input toggle
  languagesSelect.addEventListener("change", (e) => {
    if (e.target.value === "custom") {
      customLanguageInput.classList.remove("hidden");
      customLanguageInput.focus();
    } else {
      customLanguageInput.classList.add("hidden");
    }
  });

  // Drag and Drop
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("drag-over");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  function handleFileSelected(file) {
    selectedFile = file;
    fileNameDisplay.textContent = file.name;
    fileSizeDisplay.textContent = formatBytes(file.size);

    dropZoneContent.classList.add("hidden");
    filePreview.classList.remove("hidden");
    submitBtn.removeAttribute("disabled");
  }

  clearFileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    selectedFile = null;
    fileInput.value = "";
    filePreview.classList.add("hidden");
    dropZoneContent.classList.remove("hidden");
    submitBtn.setAttribute("disabled", "true");
  });

  // Tabs Switching
  const tabBtns = document.querySelectorAll(".tabs-nav .tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabTarget = btn.getAttribute("data-tab");
      switchTab(tabTarget);
    });
  });

  function switchTab(tabName) {
    tabBtns.forEach((b) => {
      if (b.getAttribute("data-tab") === tabName) {
        b.classList.add("active");
      } else {
        b.classList.remove("active");
      }
    });

    const allTabs = [
      tabMaths, tabPhysics, tabChemistry, tabDiagrams,
      tabMarkdownPreview, tabCombined, tabPages, tabJson
    ];
    allTabs.forEach((tab) => {
      if (tab) tab.classList.add("hidden");
    });

    const activeTabElem = document.getElementById(`tab-${tabName}`);
    if (activeTabElem) {
      activeTabElem.classList.remove("hidden");
    }

    // Trigger KaTeX render if math tab or markdown preview
    if (tabName === "maths" && window.renderMathInElement && mathsQuestionsContainer) {
      triggerKaTeX(mathsQuestionsContainer);
    } else if (tabName === "markdown-preview" && window.renderMathInElement && markdownRenderedView) {
      triggerKaTeX(markdownRenderedView);
    }
  }

  // Trigger KaTeX Auto-Render safely
  function triggerKaTeX(container) {
    if (window.renderMathInElement && container) {
      try {
        renderMathInElement(container, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\[", right: "\\]", display: true },
            { left: "\\(", right: "\\)", display: false }
          ],
          throwOnError: false
        });
      } catch (err) {
        console.warn("KaTeX rendering notice:", err);
      }
    }
  }

  // Diagram modal handling
  function openDiagramModal(diagram) {
    diagramModalImg.src = diagram.data_url || diagram.image_url;
    diagramModalTitle.textContent = `🖼️ ${diagram.title || 'Cropped Diagram'}`;
    diagramModalRef.textContent = diagram.question_ref || `Page ${diagram.page_number}`;
    diagramModalSize.textContent = `${diagram.width} × ${diagram.height} px`;
    diagramDownloadLink.href = diagram.data_url || diagram.image_url;
    diagramDownloadLink.download = `${diagram.id || 'diagram'}.png`;
    diagramModal.classList.remove("hidden");
  }

  closeDiagramModalBtn.addEventListener("click", () => {
    diagramModal.classList.add("hidden");
  });

  diagramModal.addEventListener("click", (e) => {
    if (e.target === diagramModal) {
      diagramModal.classList.add("hidden");
    }
  });

  // Toast notifications
  function showToast(msg, icon = "✓") {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = "toast-message";
    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(msg)}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // Diagram Picker and Editor
  function getTargetItem(context) {
    if (!context || !lastResult || !lastResult.questions) return null;
    const q = lastResult.questions[context.qIndex];
    if (!q) return null;
    if (context.type === "subquestion" && q.subquestions) {
      return q.subquestions[context.sqIndex] || null;
    }
    return q;
  }

  function getTargetLabel(context) {
    if (!context || !lastResult || !lastResult.questions) return "Question";
    const q = lastResult.questions[context.qIndex];
    if (!q) return "Question";
    if (context.type === "subquestion" && q.subquestions) {
      const sq = q.subquestions[context.sqIndex];
      return `Q${q.question_number || (context.qIndex + 1)} (${sq ? (sq.subquestion_number || (context.sqIndex + 1)) : ''})`;
    }
    return `Question ${q.question_number || (context.qIndex + 1)}`;
  }

  function openDiagramPicker(context) {
    if (!lastResult) return;
    activePickerContext = context;
    const targetItem = getTargetItem(context);
    if (!targetItem) return;

    const label = getTargetLabel(context);
    if (pickerTargetBadge) pickerTargetBadge.textContent = label;

    const currentDiags = targetItem.diagrams || [];
    if (pickerCurrentStatus) {
      if (currentDiags.length > 0) {
        const dt = currentDiags[0].title || '1 Diagram Attached';
        pickerCurrentStatus.textContent = `Current: ${dt}`;
        if (pickerDetachBtn) pickerDetachBtn.classList.remove("hidden");
      } else {
        pickerCurrentStatus.textContent = "Current: None attached";
        if (pickerDetachBtn) pickerDetachBtn.classList.add("hidden");
      }
    }

    renderPickerGrid();
    if (diagramPickerModal) diagramPickerModal.classList.remove("hidden");
  }

  function closeDiagramPicker() {
    if (diagramPickerModal) diagramPickerModal.classList.add("hidden");
    activePickerContext = null;
  }

  if (closeDiagramPickerBtn) closeDiagramPickerBtn.addEventListener("click", closeDiagramPicker);
  if (pickerCloseBtn) pickerCloseBtn.addEventListener("click", closeDiagramPicker);
  if (diagramPickerModal) {
    diagramPickerModal.addEventListener("click", (e) => {
      if (e.target === diagramPickerModal) closeDiagramPicker();
    });
  }

  if (pickerDetachBtn) {
    pickerDetachBtn.addEventListener("click", () => {
      if (!activePickerContext) return;
      const targetItem = getTargetItem(activePickerContext);
      const label = getTargetLabel(activePickerContext);
      if (targetItem) {
        targetItem.diagrams = [];
        closeDiagramPicker();
        syncUpdatedQuestionsAndViews(`Removed diagram from ${label}`);
      }
    });
  }

  if (pickerCustomUpload) {
    pickerCustomUpload.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file || !activePickerContext) return;

      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const dataUrl = uploadEvent.target.result;
        const img = new Image();
        img.onload = () => {
          const targetItem = getTargetItem(activePickerContext);
          const label = getTargetLabel(activePickerContext);
          const newDiag = {
            id: `custom_diag_${Date.now()}`,
            page_number: 1,
            title: file.name.replace(/\.[^/.]+$/, ""),
            question_ref: label,
            width: img.width,
            height: img.height,
            image_url: dataUrl,
            data_url: dataUrl,
            manually_assigned: true
          };

          if (!lastResult.diagrams) lastResult.diagrams = [];
          lastResult.diagrams.push(newDiag);

          if (targetItem) {
            targetItem.diagrams = [newDiag];
          }

          closeDiagramPicker();
          syncUpdatedQuestionsAndViews(`Custom diagram uploaded & attached to ${label}`);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    });
  }

  function renderPickerGrid() {
    if (!pickerDiagramsGrid) return;
    pickerDiagramsGrid.innerHTML = "";
    const allDiags = (lastResult && lastResult.diagrams) || [];
    if (pickerAvailableCount) pickerAvailableCount.textContent = `${allDiags.length} Available`;

    if (allDiags.length === 0) {
      pickerDiagramsGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 2rem;">
          <div class="empty-icon">🖼️</div>
          <p>No diagrams were automatically cropped from this document.</p>
          <p class="text-sm text-muted">You can click "Upload Custom" above to upload a diagram image directly.</p>
        </div>
      `;
      return;
    }

    const targetItem = getTargetItem(activePickerContext);
    const currentDiags = (targetItem && targetItem.diagrams) || [];

    allDiags.forEach((diag, dIdx) => {
      const isSelected = currentDiags.some(cd => cd.id === diag.id || (cd.image_url && cd.image_url === diag.image_url));

      const card = document.createElement("div");
      card.className = `picker-diag-card ${isSelected ? 'is-active' : ''}`;
      card.innerHTML = `
        <div class="picker-diag-thumb-wrap" title="Click to select this diagram">
          <img src="${diag.data_url || diag.image_url}" alt="${escapeHtml(diag.title || 'Diagram')}">
          ${isSelected ? '<span class="picker-selected-indicator">✓ Selected</span>' : ''}
        </div>
        <div class="picker-diag-meta">
          <div>
            <div class="picker-diag-title">${escapeHtml(diag.title || `Diagram ${dIdx + 1}`)}</div>
            <div class="picker-diag-subtext">${diag.question_ref ? `Associated: ${escapeHtml(diag.question_ref)} • ` : ''}Page ${diag.page_number} • ${diag.width}×${diag.height}px</div>
          </div>
          <div class="picker-diag-actions">
            <button type="button" class="btn-primary btn-sm picker-assign-btn">
              ${isSelected ? '✓ Selected' : 'Select Diagram'}
            </button>
            <button type="button" class="btn-secondary btn-sm picker-zoom-btn" title="Inspect full resolution">🔍 Inspect</button>
          </div>
        </div>
      `;

      card.querySelector(".picker-assign-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        assignDiagramToTarget(diag);
      });

      card.querySelector(".picker-diag-thumb-wrap").addEventListener("click", () => {
        assignDiagramToTarget(diag);
      });

      card.querySelector(".picker-zoom-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        openDiagramModal(diag);
      });

      pickerDiagramsGrid.appendChild(card);
    });
  }

  function assignDiagramToTarget(diag) {
    if (!activePickerContext) return;
    const targetItem = getTargetItem(activePickerContext);
    const label = getTargetLabel(activePickerContext);
    if (!targetItem) return;

    const clonedDiag = { ...diag, manually_assigned: true };
    targetItem.diagrams = [clonedDiag];
    diag.question_ref = label;

    closeDiagramPicker();
    syncUpdatedQuestionsAndViews(`Attached diagram to ${label}`);
  }

  function syncUpdatedQuestionsAndViews(msg) {
    if (!lastResult) return;
    lastResult.total_diagrams = (lastResult.diagrams || []).length;
    if (statDiagrams) statDiagrams.textContent = `${lastResult.total_diagrams} Diagrams`;
    if (diagramBadgeCount) diagramBadgeCount.textContent = lastResult.total_diagrams;

    if (currentSubjectType === "formula_maths") {
      renderSubjectQuestions(lastResult.questions || [], mathsQuestionsContainer, "maths");
    } else if (currentSubjectType === "physics") {
      renderSubjectQuestions(lastResult.questions || [], physicsQuestionsContainer, "physics");
    } else if (currentSubjectType === "chemistry") {
      renderSubjectQuestions(lastResult.questions || [], chemistryQuestionsContainer, "chemistry");
    } else {
      renderSubjectQuestions(lastResult.questions || [], mathsQuestionsContainer, "general");
    }

    renderDiagramsGallery(lastResult.diagrams || []);
    renderMarkdownPreview(lastResult, currentSubjectType);
    if (jsonDisplay) jsonDisplay.textContent = JSON.stringify(lastResult, null, 2);
    if (msg) showToast(msg);
  }

  // Form Submit Handler
  const ocrForm = document.getElementById("ocr-form");
  ocrForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    const paperType = paperTypeSelect.value;
    const languages = languagesSelect.value === "custom"
      ? (customLanguageInput.value.trim() || "eng+hin")
      : languagesSelect.value;

    const dpi = dpiInput.value;
    const startPage = startPageInput.value.trim();
    const endPage = endPageInput.value.trim();
    const apiKey = localStorage.getItem("gemini_api_key") || "";
    const model = localStorage.getItem("gemini_model") || "gemini-1.5-flash-8b";

    // UI state: loading
    submitBtn.setAttribute("disabled", "true");
    submitSpinner.classList.remove("hidden");
    btnText.textContent = "Processing Paper...";

    emptyState.classList.add("hidden");
    statsPills.classList.add("hidden");
    actionButtons.classList.add("hidden");
    tabsNav.classList.add("hidden");
    loadingState.classList.remove("hidden");

    if (paperType === "formula_maths") {
      loadingStatusText.textContent = "Running Pix2Text Mathematical Formula OCR & Isolating Diagrams...";
      loadingSubText.textContent = "Recognizing LaTeX symbols, roots, limits, matrices and cropping figures";
    } else {
      loadingStatusText.textContent = `Analyzing ${paperType.toUpperCase()} questions and cropping diagrams...`;
      loadingSubText.textContent = "Detecting drawings, apparatus, equations and structuring paper";
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("subject_type", paperType);
    formData.append("languages", languages);
    formData.append("dpi", dpi);
    if (startPage) formData.append("start_page", startPage);
    if (endPage) formData.append("end_page", endPage);
    if (apiKey) formData.append("api_key", apiKey);
    formData.append("model", model);

    try {
      const response = await fetch("/api/ocr/subject-process", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Unknown server error" }));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      const result = await response.json();
      lastResult = result;
      displayResults(result, paperType);
    } catch (err) {
      alert(`Processing failed: ${err.message}`);
      emptyState.classList.remove("hidden");
    } finally {
      loadingState.classList.add("hidden");
      submitBtn.removeAttribute("disabled");
      submitSpinner.classList.add("hidden");
      btnText.textContent = "Extract STEM Paper & Diagrams";
    }
  });

  // Display Results
  function displayResults(data, subjectType) {
    currentSubjectType = subjectType;

    // 1. Stats pills
    const totalQuestions = data.total_questions || (data.questions ? data.questions.length : 0);
    const totalDiagrams = data.total_diagrams || (data.diagrams ? data.diagrams.length : 0);
    const elapsed = data.processing_time_sec || 0;

    statSubject.textContent = subjectType === "formula_maths" ? "📐 Maths (Pix2Text)" : (subjectType === "physics" ? "⚡ Physics" : "🧪 Chemistry");
    statDiagrams.textContent = `${totalDiagrams} Diagrams`;
    statQuestions.textContent = `${totalQuestions} Questions`;
    statTime.textContent = `${elapsed}s`;
    diagramBadgeCount.textContent = totalDiagrams;

    statsPills.classList.remove("hidden");
    actionButtons.classList.remove("hidden");
    tabsNav.classList.remove("hidden");

    // 2. Raw Text & JSON
    combinedTextArea.value = data.raw_text || "";
    jsonDisplay.textContent = JSON.stringify(data, null, 2);

    // 3. Render Diagrams Gallery
    renderDiagramsGallery(data.diagrams || []);

    // 4. Render Markdown Document View
    renderMarkdownPreview(data, subjectType);

    // 5. Render Subject-Specific Questions
    if (subjectType === "formula_maths") {
      mathsExamTitle.textContent = `📐 ${data.exam_title || 'Mathematics Paper (LaTeX)'}`;
      renderSubjectQuestions(data.questions || [], mathsQuestionsContainer, "maths");
      switchTab("maths");
    } else if (subjectType === "physics") {
      physicsExamTitle.textContent = `⚡ ${data.exam_title || 'Physics Questions & Diagrams'}`;
      renderSubjectQuestions(data.questions || [], physicsQuestionsContainer, "physics");
      switchTab("physics");
    } else if (subjectType === "chemistry") {
      chemistryExamTitle.textContent = `🧪 ${data.exam_title || 'Chemistry Reactions & Structures'}`;
      renderSubjectQuestions(data.questions || [], chemistryQuestionsContainer, "chemistry");
      switchTab("chemistry");
    } else {
      renderSubjectQuestions(data.questions || [], mathsQuestionsContainer, "general");
      switchTab("maths");
    }
  }

  // Render Diagrams Gallery Tab
  function renderDiagramsGallery(diagrams) {
    diagramsGallery.innerHTML = "";
    if (!diagrams || diagrams.length === 0) {
      diagramsGallery.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🖼️</div>
          <p>No diagrams detected on the uploaded pages. If your document has diagrams, ensure 300 DPI is selected.</p>
        </div>
      `;
      return;
    }

    const questionsList = (lastResult && lastResult.questions) || [];

    diagrams.forEach((diag) => {
      let assignedQuestionLabel = diag.question_ref || "";
      if (questionsList.length > 0) {
        for (const q of questionsList) {
          if (q.diagrams && q.diagrams.some(d => d.id === diag.id || (d.image_url && d.image_url === diag.image_url))) {
            assignedQuestionLabel = `Assigned: Q${q.question_number || '?'}`;
            break;
          }
          if (q.subquestions) {
            for (const sq of q.subquestions) {
              if (sq.diagrams && sq.diagrams.some(d => d.id === diag.id || (d.image_url && d.image_url === diag.image_url))) {
                assignedQuestionLabel = `Assigned: Q${q.question_number}(${sq.subquestion_number})`;
                break;
              }
            }
          }
        }
      }

      const card = document.createElement("div");
      card.className = "diagram-card";
      card.innerHTML = `
        <div class="diagram-card-preview" title="Click to inspect full resolution">
          <img src="${diag.data_url || diag.image_url}" alt="${diag.title || 'Diagram'}">
        </div>
        <div class="diagram-card-footer">
          <div>
            <div class="diagram-card-title">${escapeHtml(diag.title || 'Cropped Figure')}</div>
            <div class="diagram-card-page">${assignedQuestionLabel ? `${escapeHtml(assignedQuestionLabel)} • ` : ''}Page ${diag.page_number} • ${diag.width}×${diag.height}px</div>
          </div>
          <div class="gallery-assign-wrap">
            <select class="gallery-assign-select" title="Assign this diagram to a question">
              <option value="">Assign to...</option>
              ${questionsList.map((q, idx) => `
                <option value="q_${idx}">Question ${escapeHtml(q.question_number || (idx + 1))}</option>
              `).join('')}
            </select>
            <a href="${diag.data_url || diag.image_url}" download="${diag.id || 'diagram'}.png" class="btn-secondary btn-sm" title="Download Image">
              📥
            </a>
          </div>
        </div>
      `;

      card.querySelector(".diagram-card-preview").addEventListener("click", () => {
        openDiagramModal(diag);
      });

      const assignSelect = card.querySelector(".gallery-assign-select");
      if (assignSelect) {
        assignSelect.addEventListener("change", (e) => {
          const val = e.target.value;
          if (!val) return;
          const qIdx = parseInt(val.replace("q_", ""), 10);
          if (!isNaN(qIdx) && questionsList[qIdx]) {
            const targetQ = questionsList[qIdx];
            const clone = { ...diag, manually_assigned: true };
            targetQ.diagrams = [clone];
            diag.question_ref = `Q${targetQ.question_number || (qIdx + 1)}`;
            syncUpdatedQuestionsAndViews(`Assigned diagram to Question ${targetQ.question_number || (qIdx + 1)}`);
          }
        });
      }

      diagramsGallery.appendChild(card);
    });
  }

  // Check if a question/subquestion already has the relevant mathematical formula in LaTeX blocks or text
  function questionHasRelevantFormula(item) {
    if (item.latex_formulas && item.latex_formulas.length > 0) return true;
    const combined = `${item.text_en || ''} ${item.text_hi || ''} ${item.text_ta || ''} ${item.text_te || ''} ${item.text_kn || ''}`;
    if (/\$[^$]+\$/.test(combined) || /\$\$.+?\$\$/s.test(combined)) return true;
    if (/\\(frac|sqrt|int|sum|lim|partial|alpha|beta|theta|gamma|delta|pi|pmatrix|bmatrix|times|cdot|approx|leq|geq)/.test(combined)) return true;
    if (/[a-zA-Z]\s*=\s*[\d\w\+\-\*\/\^\(\)]+/.test(combined) && /[+\-*/^=]/.test(combined)) return true;
    return false;
  }

  // Split introductory problem statement from sub-prompts (e.g. (i), (ii), (iii))
  function splitIntroAndSubPrompts(text) {
    if (!text) return { intro: '', prompts: '' };
    const match = text.match(/(\([iIvVxX\d]+\)|(?:\n|^)\s*(?:\([a-z]\)|\d+\.))/);
    if (match && match.index > 0) {
      return {
        intro: text.slice(0, match.index).trim(),
        prompts: text.slice(match.index).trim()
      };
    }
    return { intro: text, prompts: '' };
  }

  // Determines whether a cropped diagram should be displayed inside a question card:
  // - Never show cropped "🖼️ Graph / Plot" when the question already has the relevant formula
  // - If the formula or visual diagram is ONLY available in cropped images (formula missing in text), show the cropped image!
  function shouldRenderQuestionDiagram(diag, item, mode) {
    if (diag.manually_assigned || diag.is_selected) return true;
    const hasFormula = questionHasRelevantFormula(item);
    const titleLower = (diag.title || '').toLowerCase();
    const isGraphPlot = titleLower.includes('graph') || titleLower.includes('plot') || titleLower.includes('ग्राफ') || titleLower.includes('आरेख');

    // Rule: Do NOT show cropped Graph / Plot if question already has relevant formula
    if (isGraphPlot) {
      // Only show if the question does NOT have the relevant formula in the question
      return !hasFormula;
    }

    // Rule: Suppress cropped table images if tables are already structured in Markdown / HTML
    const isTableDiagram = titleLower.includes('table') || titleLower.includes('सारणी') || titleLower.includes('तालिका');
    if (isTableDiagram && ((item.tables && item.tables.length > 0) || (item.text_en && item.text_en.includes('|--')) || (item.text_hi && item.text_hi.includes('|--')))) {
      return false;
    }

    if (mode === "maths") {
      const combined = `${item.text_en || ''} ${item.text_hi || ''} ${item.subheading || ''}`.toLowerCase();
      const hasExplicitVisualRef = /\b(fig|figure|diagram|circuit|peripath|gate|चित्र|परिपथ|रेखाचित्र)\b/.test(combined);

      // If question has formula and no explicit visual diagram reference, suppress redundant formula crop
      if (hasFormula && !hasExplicitVisualRef) {
        return false;
      }
    }

    return true;
  }

  // Render Subject Questions (Maths, Physics, Chemistry)
  function renderSubjectQuestions(questions, container, mode) {
    container.innerHTML = "";
    if (!questions || questions.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No structured questions found.</p></div>`;
      return;
    }

    questions.forEach((q, qIdx) => {
      const card = document.createElement("div");
      card.className = "question-card";

      // Question Header
      const header = document.createElement("div");
      header.className = "question-card-header";
      const hasQDiag = (q.diagrams && q.diagrams.length > 0);
      header.innerHTML = `
        <div class="question-header-left">
          <span class="q-badge">Question ${escapeHtml(q.question_number || (qIdx + 1))}</span>
          ${q.section ? `<span class="section-badge">${escapeHtml(q.section)}</span>` : ''}
          ${q.subheading ? `<span class="subheading-badge">${escapeHtml(q.subheading)}</span>` : ''}
        </div>
        <div class="question-header-right">
          <button type="button" class="btn-diagram-trigger ${hasQDiag ? 'has-diagram' : ''}" title="${hasQDiag ? 'Change or manage diagram for this question' : 'Select an available diagram from document'}">
            ${hasQDiag ? `🖼️ Diagram (${q.diagrams.length}) • ✏️ Edit` : '+ 🖼️ Attach Diagram'}
          </button>
          ${q.marks ? `<span class="marks-badge">${escapeHtml(q.marks)}</span>` : ''}
        </div>
      `;
      header.querySelector(".btn-diagram-trigger").addEventListener("click", () => {
        openDiagramPicker({ type: "question", qIndex: qIdx });
      });
      card.appendChild(header);

      // Question Body
      const body = document.createElement("div");
      body.className = "question-card-body";

      // English text (Rendered with Markdown and LaTeX support)
      if (q.text_en) {
        const divEn = document.createElement("div");
        divEn.className = "question-text-en markdown-content";
        divEn.innerHTML = renderMarkdownContent(q.text_en);
        body.appendChild(divEn);
      }

      // Multilingual text (Hindi, Tamil, Telugu, Kannada)
      const langConfigs = [
        { key: "text_hi", cls: "question-text-hi" },
        { key: "text_ta", cls: "question-text-ta q-content ta" },
        { key: "text_te", cls: "question-text-te q-content te" },
        { key: "text_kn", cls: "question-text-kn q-content kn" }
      ];
      langConfigs.forEach(lc => {
        if (q[lc.key]) {
          const divLang = document.createElement("div");
          divLang.className = `${lc.cls} markdown-content`;
          divLang.innerHTML = renderMarkdownContent(q[lc.key]);
          body.appendChild(divLang);
        }
      });

      // Structured Tables
      if (q.tables && q.tables.length > 0) {
        q.tables.forEach(t => {
          const tblDiv = document.createElement("div");
          tblDiv.innerHTML = renderTableHtml(t);
          body.appendChild(tblDiv);
        });
      }

      // LaTeX Formulas Box
      if (q.latex_formulas && q.latex_formulas.length > 0) {
        q.latex_formulas.forEach((formula, fIdx) => {
          const formulaBox = document.createElement("div");
          formulaBox.className = "math-formula-box";
          formulaBox.innerHTML = `
            <div class="math-formula-header">
              <span class="formula-tag">LaTeX Equation ${fIdx + 1}</span>
              <button class="copy-formula-btn" data-latex="${escapeHtml(formula)}">Copy LaTeX</button>
            </div>
            <div class="formula-math-render">${escapeHtml(formula.startsWith('$') ? formula : `$$${formula}$$`)}</div>
          `;
          formulaBox.querySelector(".copy-formula-btn").addEventListener("click", (e) => {
            navigator.clipboard.writeText(formula);
            e.target.textContent = "Copied!";
            setTimeout(() => { e.target.textContent = "Copy LaTeX"; }, 1500);
          });
          body.appendChild(formulaBox);
        });
      }

      // Attached Cropped Diagrams
      if (q.diagrams && q.diagrams.length > 0) {
        const visibleDiags = q.diagrams.filter(d => shouldRenderQuestionDiagram(d, q, mode));
        visibleDiags.forEach((diag) => {
          const diagWrap = document.createElement("div");
          diagWrap.className = "question-diagram-wrapper";

          let displayTitle = diag.title || 'Diagram for Question';
          if (displayTitle.toLowerCase().includes('graph') || displayTitle.toLowerCase().includes('plot')) {
            displayTitle = 'Formula / Diagram Reference';
          }

          diagWrap.innerHTML = `
            <div class="diagram-header-label">
              <span>🖼️ ${escapeHtml(displayTitle)}</span>
              <div class="diag-header-actions">
                <button type="button" class="btn-secondary btn-sm diag-change-btn">✏️ Change</button>
                <button type="button" class="btn-secondary btn-sm diag-remove-btn" title="Remove diagram from this question">🗑️ Detach</button>
                <button type="button" class="btn-secondary btn-sm diag-zoom-btn">🔍 View Full Size</button>
              </div>
            </div>
            <div class="diagram-image-container">
              <img src="${diag.data_url || diag.image_url}" alt="${escapeHtml(displayTitle)}">
              <span class="diagram-click-hint">Click to Zoom</span>
            </div>
          `;
          diagWrap.querySelector(".diagram-image-container").addEventListener("click", () => {
            openDiagramModal(diag);
          });
          diagWrap.querySelector(".diag-zoom-btn").addEventListener("click", () => {
            openDiagramModal(diag);
          });
          diagWrap.querySelector(".diag-change-btn").addEventListener("click", () => {
            openDiagramPicker({ type: "question", qIndex: qIdx });
          });
          diagWrap.querySelector(".diag-remove-btn").addEventListener("click", () => {
            q.diagrams = [];
            syncUpdatedQuestionsAndViews(`Removed diagram from Question ${q.question_number || (qIdx + 1)}`);
          });
          body.appendChild(diagWrap);
        });
      }

      // Subquestions
      if (q.subquestions && q.subquestions.length > 0) {
        const subList = document.createElement("div");
        subList.className = "subquestions-list";

        q.subquestions.forEach((sq, sqIdx) => {
          const subCard = document.createElement("div");
          subCard.className = "subquestion-card";

          const subHeader = document.createElement("div");
          subHeader.className = "sub-q-header";
          const hasSqDiag = (sq.diagrams && sq.diagrams.length > 0);
          subHeader.innerHTML = `
            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;flex:1;">
              <span class="sub-q-badge">${escapeHtml(sq.subquestion_number || (sqIdx + 1))}</span>
              ${sq.subheading ? `<span class="subheading-badge">${escapeHtml(sq.subheading)}</span>` : ''}
              ${sq.marks ? `<span class="marks-badge">${escapeHtml(sq.marks)}</span>` : ''}
            </div>
            <button type="button" class="btn-diagram-trigger ${hasSqDiag ? 'has-diagram' : ''}">
              ${hasSqDiag ? '🖼️ ✏️ Edit Diagram' : '+ 🖼️ Diagram'}
            </button>
          `;
          subHeader.querySelector(".btn-diagram-trigger").addEventListener("click", () => {
            openDiagramPicker({ type: "subquestion", qIndex: qIdx, sqIndex: sqIdx });
          });
          subCard.appendChild(subHeader);

          // Process text and diagram positioning:
          // If subquestion has an attached diagram (like a logic circuit),
          // place the diagram directly below the problem statement and BEFORE (i), (ii), (iii).
          const visibleSqDiags = (sq.diagrams && sq.diagrams.length > 0)
            ? sq.diagrams.filter(d => shouldRenderQuestionDiagram(d, sq, mode))
            : [];

          function createDiagramWrap(sqDiag) {
            const sqDiagWrap = document.createElement("div");
            sqDiagWrap.className = "question-diagram-wrapper";
            let displayTitle = sqDiag.title || `Diagram for ${sq.subquestion_number}`;
            if (displayTitle.toLowerCase().includes('graph') || displayTitle.toLowerCase().includes('plot')) {
              displayTitle = `Formula / Diagram Reference (${sq.subquestion_number})`;
            }

            sqDiagWrap.innerHTML = `
              <div class="diagram-header-label">
                <span>🖼️ ${escapeHtml(displayTitle)}</span>
                <div class="diag-header-actions">
                  <button type="button" class="btn-secondary btn-sm diag-change-btn">✏️ Change</button>
                  <button type="button" class="btn-secondary btn-sm diag-remove-btn" title="Remove diagram">🗑️ Detach</button>
                  <button type="button" class="btn-secondary btn-sm diag-zoom-btn">🔍 View Full Size</button>
                </div>
              </div>
              <div class="diagram-image-container">
                <img src="${sqDiag.data_url || sqDiag.image_url}" alt="${escapeHtml(displayTitle)}">
                <span class="diagram-click-hint">Click to Zoom</span>
              </div>
            `;
            sqDiagWrap.querySelector(".diagram-image-container").addEventListener("click", () => {
              openDiagramModal(sqDiag);
            });
            sqDiagWrap.querySelector(".diag-zoom-btn").addEventListener("click", () => {
              openDiagramModal(sqDiag);
            });
            sqDiagWrap.querySelector(".diag-change-btn").addEventListener("click", () => {
              openDiagramPicker({ type: "subquestion", qIndex: qIdx, sqIndex: sqIdx });
            });
            sqDiagWrap.querySelector(".diag-remove-btn").addEventListener("click", () => {
              sq.diagrams = [];
              syncUpdatedQuestionsAndViews(`Removed diagram from Subquestion ${sq.subquestion_number || (sqIdx + 1)}`);
            });
            return sqDiagWrap;
          }

          let diagramInserted = false;

          // English text
          if (sq.text_en) {
            const parts = splitIntroAndSubPrompts(sq.text_en);
            if (parts.prompts && visibleSqDiags.length > 0 && !diagramInserted) {
              const divIntro = document.createElement("div");
              divIntro.className = "question-text-en markdown-content";
              divIntro.innerHTML = renderMarkdownContent(parts.intro);
              subCard.appendChild(divIntro);

              visibleSqDiags.forEach(d => subCard.appendChild(createDiagramWrap(d)));
              diagramInserted = true;

              const divPrompts = document.createElement("div");
              divPrompts.className = "question-text-en markdown-content";
              divPrompts.innerHTML = renderMarkdownContent(parts.prompts);
              subCard.appendChild(divPrompts);
            } else {
              const sqEn = document.createElement("div");
              sqEn.className = "question-text-en markdown-content";
              sqEn.innerHTML = renderMarkdownContent(sq.text_en);
              subCard.appendChild(sqEn);
            }
          }

          // Multilingual text (Hindi, Tamil, Telugu, Kannada)
          langConfigs.forEach(lc => {
            if (sq[lc.key]) {
              const parts = splitIntroAndSubPrompts(sq[lc.key]);
              if (parts.prompts && visibleSqDiags.length > 0 && !diagramInserted) {
                const divIntro = document.createElement("div");
                divIntro.className = `${lc.cls} markdown-content`;
                divIntro.innerHTML = renderMarkdownContent(parts.intro);
                subCard.appendChild(divIntro);

                visibleSqDiags.forEach(d => subCard.appendChild(createDiagramWrap(d)));
                diagramInserted = true;

                const divPrompts = document.createElement("div");
                divPrompts.className = `${lc.cls} markdown-content`;
                divPrompts.innerHTML = renderMarkdownContent(parts.prompts);
                subCard.appendChild(divPrompts);
              } else {
                const sqLang = document.createElement("div");
                sqLang.className = `${lc.cls} markdown-content`;
                sqLang.innerHTML = renderMarkdownContent(sq[lc.key]);
                subCard.appendChild(sqLang);
              }
            }
          });

          // If diagram was not inserted via split, insert it here before tables/formulas
          if (!diagramInserted && visibleSqDiags.length > 0) {
            visibleSqDiags.forEach(d => subCard.appendChild(createDiagramWrap(d)));
            diagramInserted = true;
          }

          if (sq.tables && sq.tables.length > 0) {
            sq.tables.forEach(t => {
              const tblDiv = document.createElement("div");
              tblDiv.innerHTML = renderTableHtml(t);
              subCard.appendChild(tblDiv);
            });
          }

          // Subquestion LaTeX formulas
          if (sq.latex_formulas && sq.latex_formulas.length > 0) {
            sq.latex_formulas.forEach((formula, sfIdx) => {
              const sqFormulaBox = document.createElement("div");
              sqFormulaBox.className = "math-formula-box";
              sqFormulaBox.innerHTML = `
                <div class="math-formula-header">
                  <span class="formula-tag">LaTeX Eq ${sfIdx + 1}</span>
                  <button class="copy-formula-btn" data-latex="${escapeHtml(formula)}">Copy LaTeX</button>
                </div>
                <div class="formula-math-render">${escapeHtml(formula.startsWith('$') ? formula : `$$${formula}$$`)}</div>
              `;
              sqFormulaBox.querySelector(".copy-formula-btn").addEventListener("click", (e) => {
                navigator.clipboard.writeText(formula);
                e.target.textContent = "Copied!";
                setTimeout(() => { e.target.textContent = "Copy LaTeX"; }, 1500);
              });
              subCard.appendChild(sqFormulaBox);
            });
          }

          subList.appendChild(subCard);
        });

        body.appendChild(subList);
      }

      card.appendChild(body);
      container.appendChild(card);
    });

    // Auto-render KaTeX on container
    triggerKaTeX(container);
  }

  // Helper Escape HTML
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Copy & Download Actions
  copyBtn.addEventListener("click", () => {
    if (combinedTextArea.value) {
      navigator.clipboard.writeText(combinedTextArea.value);
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.innerHTML = `Copy Text`; }, 1500);
    }
  });

  downloadBtn.addEventListener("click", () => {
    if (combinedTextArea.value) {
      const blob = new Blob([combinedTextArea.value], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, "") : "ocr_output"}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  });

  // Copy LaTeX Equations
  if (copyMathLatexBtn) {
    copyMathLatexBtn.addEventListener("click", () => {
      if (!lastResult || !lastResult.questions) return;
      const formulas = [];
      lastResult.questions.forEach((q) => {
        if (q.latex_formulas) formulas.push(...q.latex_formulas);
        if (q.subquestions) {
          q.subquestions.forEach((sq) => {
            if (sq.latex_formulas) formulas.push(...sq.latex_formulas);
          });
        }
      });
      if (formulas.length > 0) {
        navigator.clipboard.writeText(formulas.join("\n\n"));
        copyMathLatexBtn.textContent = "Copied All LaTeX!";
        setTimeout(() => { copyMathLatexBtn.textContent = "📋 Copy LaTeX Equations"; }, 1500);
      } else {
        alert("No extracted LaTeX formulas found in this document.");
      }
    });
  }

  // Safe Markdown renderer with LaTeX protection
  function renderMarkdownContent(text) {
    if (!text) return "";
    if (window.marked && typeof window.marked.parse === "function") {
      try {
        // Protect math blocks ($$...$$ and $...$) from marked underscores/formatting
        const mathPlaceholders = [];
        const protectedText = String(text)
          .replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
            mathPlaceholders.push(match);
            return `@@MATH_BLOCK_${mathPlaceholders.length - 1}@@`;
          })
          .replace(/\$([^\$\n]+?)\$/g, (match) => {
            mathPlaceholders.push(match);
            return `@@MATH_INLINE_${mathPlaceholders.length - 1}@@`;
          });

        let html = window.marked.parse(protectedText, { breaks: true, gfm: true });

        // Restore math blocks for KaTeX auto-render
        html = html.replace(/@@MATH_(?:BLOCK|INLINE)_(\d+)@@/g, (match, idx) => {
          return mathPlaceholders[parseInt(idx, 10)] || match;
        });

        return html;
      } catch (e) {
        console.warn("Markdown parse notice:", e);
      }
    }
    return `<p>${escapeHtml(text)}</p>`;
  }

  // Render Structured Table HTML
  function renderTableHtml(tbl) {
    if (!tbl) return "";
    if (tbl.headers && tbl.headers.length > 0) {
      const ths = tbl.headers.map(h => `<th>${escapeHtml(h)}</th>`).join("");
      const rowsHtml = (tbl.rows || []).map(row => {
        const tds = row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("");
        return `<tr>${tds}</tr>`;
      }).join("");
      return `
        <div class="table-wrapper">
          ${tbl.title ? `<div class="table-title">📊 ${escapeHtml(tbl.title)}</div>` : ""}
          <table class="q-table">
            <thead><tr>${ths}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `;
    } else if (tbl.markdown) {
      return `
        <div class="table-wrapper">
          ${tbl.title ? `<div class="table-title">📊 ${escapeHtml(tbl.title)}</div>` : ""}
          ${renderMarkdownContent(tbl.markdown)}
        </div>
      `;
    }
    return "";
  }

  // Full Markdown Document Generator
  function generateFullMarkdown(data, subjectName) {
    if (!data) return "";
    let md = `# ${data.exam_title || ((subjectName || 'Exam') + ' Paper')}\n\n`;
    if (data.subject_type) {
      md += `*Subject: ${data.subject_type.replace('_', ' ').toUpperCase()} | Engine: ${data.engine_used || 'OCR'}*\n\n`;
    }

    if (data.questions && data.questions.length > 0) {
      data.questions.forEach((q) => {
        md += `## Question ${q.question_number || '1'}${q.marks ? ` [${q.marks}]` : ''}\n\n`;
        if (q.section) md += `**Section:** ${q.section}\n\n`;
        if (q.subheading) md += `**Subheading:** ${q.subheading}\n\n`;
        if (q.text_en) md += `**English:**\n${q.text_en}\n\n`;
        if (q.text_hi) md += `**Hindi:**\n${q.text_hi}\n\n`;
        if (q.text_ta) md += `**Tamil:**\n${q.text_ta}\n\n`;
        if (q.text_te) md += `**Telugu:**\n${q.text_te}\n\n`;
        if (q.text_kn) md += `**Kannada:**\n${q.text_kn}\n\n`;

        if (q.latex_formulas && q.latex_formulas.length > 0) {
          md += `**Formulas:**\n\n`;
          q.latex_formulas.forEach(f => {
            md += `$$\n${f.replace(/^\$\$|\$\$$/g, '').trim()}\n$$\n\n`;
          });
        }

        if (q.tables && q.tables.length > 0) {
          q.tables.forEach(t => {
            if (t.title) md += `**Table: ${t.title}**\n\n`;
            if (t.markdown) {
              md += `${t.markdown}\n\n`;
            } else if (t.headers && t.headers.length > 0) {
              md += `| ${t.headers.join(' | ')} |\n`;
              md += `| ${t.headers.map(() => '---').join(' | ')} |\n`;
              (t.rows || []).forEach(row => {
                md += `| ${row.join(' | ')} |\n`;
              });
              md += `\n`;
            }
          });
        }

        if (q.diagrams && q.diagrams.length > 0) {
          const visibleDiags = q.diagrams.filter(d => shouldRenderQuestionDiagram(d, q, data.subject_type === 'formula_maths' ? 'maths' : ''));
          visibleDiags.forEach(d => {
            const title = (d.title || 'Diagram').replace(/Graph\s*\/\s*Plot/i, 'Formula / Diagram Reference');
            md += `![${title}](${d.image_url || d.data_url})\n*${title}*\n\n`;
          });
        }

        if (q.subquestions && q.subquestions.length > 0) {
          q.subquestions.forEach((sq) => {
            md += `### ${sq.subquestion_number || '(i)'}${sq.marks ? ` [${sq.marks}]` : ''}\n\n`;
            if (sq.subheading) md += `*${sq.subheading}*\n\n`;
            const visibleSqDiags = (sq.diagrams && sq.diagrams.length > 0)
              ? sq.diagrams.filter(d => shouldRenderQuestionDiagram(d, sq, data.subject_type === 'formula_maths' ? 'maths' : ''))
              : [];

            let mdDiagInserted = false;

            if (sq.text_en) {
              const parts = splitIntroAndSubPrompts(sq.text_en);
              if (parts.prompts && visibleSqDiags.length > 0 && !mdDiagInserted) {
                md += `${parts.intro}\n\n`;
                visibleSqDiags.forEach(d => {
                  const title = d.title || 'Circuit Diagram';
                  md += `![${title}](${d.image_url || d.data_url})\n*${title}*\n\n`;
                });
                mdDiagInserted = true;
                md += `${parts.prompts}\n\n`;
              } else {
                md += `${sq.text_en}\n\n`;
              }
            }

            if (sq.text_hi) {
              const parts = splitIntroAndSubPrompts(sq.text_hi);
              if (parts.prompts && visibleSqDiags.length > 0 && !mdDiagInserted) {
                md += `${parts.intro}\n\n`;
                visibleSqDiags.forEach(d => {
                  const title = d.title || 'Circuit Diagram';
                  md += `![${title}](${d.image_url || d.data_url})\n*${title}*\n\n`;
                });
                mdDiagInserted = true;
                md += `${parts.prompts}\n\n`;
              } else {
                md += `${sq.text_hi}\n\n`;
              }
            }
            if (sq.text_ta) md += `${sq.text_ta}\n\n`;
            if (sq.text_te) md += `${sq.text_te}\n\n`;
            if (sq.text_kn) md += `${sq.text_kn}\n\n`;

            if (!mdDiagInserted && visibleSqDiags.length > 0) {
              visibleSqDiags.forEach(d => {
                const title = d.title || 'Circuit Diagram';
                md += `![${title}](${d.image_url || d.data_url})\n*${title}*\n\n`;
              });
            }
          });
        }
        md += `---\n\n`;
      });
    } else if (data.raw_text) {
      md += `${data.raw_text}\n\n`;
    }
    return md;
  }

  // Render Markdown Tab
  function renderMarkdownPreview(data, subjectType) {
    if (!markdownRenderedView || !markdownRawView) return;
    const subjectName = subjectType === "formula_maths" ? "Mathematics" : (subjectType === "physics" ? "Physics" : (subjectType === "chemistry" ? "Chemistry" : "Exam"));
    const fullMd = generateFullMarkdown(data, subjectName);
    markdownRawView.value = fullMd;
    markdownRenderedView.innerHTML = renderMarkdownContent(fullMd);
    if (markdownExamTitle) {
      markdownExamTitle.textContent = `📝 ${data.exam_title || (subjectName + ' Markdown Document')}`;
    }
    triggerKaTeX(markdownRenderedView);
  }

  // Markdown Tab Controls (Toggle, Copy, Download)
  if (toggleMarkdownRawBtn) {
    toggleMarkdownRawBtn.addEventListener("click", () => {
      const isRawHidden = markdownRawView.classList.contains("hidden");
      if (isRawHidden) {
        markdownRawView.classList.remove("hidden");
        markdownRenderedView.classList.add("hidden");
        toggleMarkdownRawBtn.textContent = "👁️ View Rendered HTML";
      } else {
        markdownRawView.classList.add("hidden");
        markdownRenderedView.classList.remove("hidden");
        toggleMarkdownRawBtn.textContent = "👁️ Toggle Raw / Rendered";
        triggerKaTeX(markdownRenderedView);
      }
    });
  }

  if (copyFullMarkdownBtn) {
    copyFullMarkdownBtn.addEventListener("click", () => {
      if (!markdownRawView.value) return;
      navigator.clipboard.writeText(markdownRawView.value);
      copyFullMarkdownBtn.textContent = "Copied Markdown!";
      setTimeout(() => { copyFullMarkdownBtn.textContent = "📄 Copy Markdown"; }, 1500);
    });
  }

  if (downloadMarkdownBtn) {
    downloadMarkdownBtn.addEventListener("click", () => {
      if (!markdownRawView.value) return;
      const blob = new Blob([markdownRawView.value], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const baseName = (selectedFile && selectedFile.name.replace(/\.[^/.]+$/, "")) || "exam_paper";
      a.href = url;
      a.download = `${baseName}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // Copy Markdown for Subject Tabs
  function copyQuestionsAsMarkdown(subjectName) {
    if (!lastResult) return;
    const md = generateFullMarkdown(lastResult, subjectName);
    navigator.clipboard.writeText(md);
  }

  if (copyMathMarkdownBtn) {
    copyMathMarkdownBtn.addEventListener("click", () => {
      copyQuestionsAsMarkdown("Mathematics");
      copyMathMarkdownBtn.textContent = "Copied Markdown!";
      setTimeout(() => { copyMathMarkdownBtn.textContent = "📄 Copy as Markdown"; }, 1500);
    });
  }
  if (copyPhysicsMarkdownBtn) {
    copyPhysicsMarkdownBtn.addEventListener("click", () => {
      copyQuestionsAsMarkdown("Physics");
      copyPhysicsMarkdownBtn.textContent = "Copied Markdown!";
      setTimeout(() => { copyPhysicsMarkdownBtn.textContent = "📄 Copy as Markdown"; }, 1500);
    });
  }
  if (copyChemMarkdownBtn) {
    copyChemMarkdownBtn.addEventListener("click", () => {
      copyQuestionsAsMarkdown("Chemistry");
      copyChemMarkdownBtn.textContent = "Copied Markdown!";
      setTimeout(() => { copyChemMarkdownBtn.textContent = "📄 Copy as Markdown"; }, 1500);
    });
  }
});
