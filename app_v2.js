// --------------------------------------------------------------
// Certificate Generator App Logic (Unified Version v2)
// --------------------------------------------------------------

// ---------------------------------------------------------------
// Template Configuration - Map courses to their template files
// ---------------------------------------------------------------
const TEMPLATE_MAP = {
  'PHYSICAL DESIGN': './PDTemplate.png'
};
const DEFAULT_TEMPLATE = './Template.png';

const CONFIG = {
  canvasWidth: 1600,
  canvasHeight: 1131,
  name: { y: 520, font: '700 90px "Dancing Script", cursive', color: '#184551', align: 'center' },
  course: { y: 670, font: 'bold 28px Inter, sans-serif', color: '#000000', align: 'center' },
  date:   { x: 625, y: 707, font: '27px Inter, sans-serif', color: '#000000', align: 'center', letterSpacing: '1.5px' },
  datePD: { x: 627, y: 707, font: '27px Inter, sans-serif', color: '#000000', align: 'center', letterSpacing: '1.5px' },
  rank: { x: 885, y: 749, font: 'bold 28px Inter, sans-serif', color: '#e55627', align: 'left' }
};

const templateCache = {};

function getTemplateUrlForCourse(courseName) {
  if (!courseName) return DEFAULT_TEMPLATE;
  const upper = courseName.trim().toUpperCase();
  for (const key of Object.keys(TEMPLATE_MAP)) {
    if (upper === key.toUpperCase()) return TEMPLATE_MAP[key];
  }
  return DEFAULT_TEMPLATE;
}

function loadTemplate(url) {
  return new Promise((resolve) => {
    if (templateCache[url] && templateCache[url].complete) {
      resolve(templateCache[url]); return;
    }
    const img = new Image();
    img.onload = () => { templateCache[url] = img; refreshViews(); resolve(img); };
    img.onerror = () => { console.warn(`Failed to load template: ${url}`); resolve(null); };
    img.src = url + '?v=' + Date.now();
  });
}

(async () => {
  await loadTemplate(DEFAULT_TEMPLATE);
  for (const url of Object.values(TEMPLATE_MAP)) await loadTemplate(url);
})();

// ---------------------------------------------------------------
// Global State
// ---------------------------------------------------------------
let isGridView = false;
let currentIndex = 0;
let isFileLoaded = false;
let records = []; 
let filteredRecords = []; // For search
let globalCourses = [];
let globalRanks = [];

// DOM Elements
const themeBtn = document.getElementById('theme-toggle');
const tabs = document.querySelectorAll('.tab');
const panes = document.querySelectorAll('.tab-pane');
const singleNav = document.getElementById('single-nav');
const singleWrapper = document.getElementById('single-view-wrapper');
const gridWrapper = document.getElementById('grid-view-wrapper');
const previewArea = document.getElementById('preview-area');
const btnSingle = document.getElementById('btn-single');
const btnGrid = document.getElementById('btn-grid');
const mainCanvas = document.getElementById('preview-canvas');
const templateBadge = document.getElementById('template-badge');

// Export Elements
const downloadBtn = document.getElementById('download-btn');
const downloadDropdown = document.getElementById('download-dropdown');
const downloadMenu = document.getElementById('download-menu');
const dlPngCurrent = document.getElementById('download-png-current');
const dlPdfCurrent = document.getElementById('download-pdf-current');
const dlZipAll = document.getElementById('download-zip-all');
const dlPdfAll = document.getElementById('download-pdf-all');

// Table Elements
const tableDrawer = document.getElementById('table-drawer');
const btnTableToggle = document.getElementById('btn-table-toggle');
const btnTableAdd = document.getElementById('btn-table-add');
const btnTableClear = document.getElementById('btn-table-clear');
const dataTableBody = document.getElementById('data-table-body');
const tableRecordCount = document.getElementById('table-record-count');
const tableSearchInput = document.getElementById('table-search-input');
const btnSearchClear = document.getElementById('btn-search-clear');

// Modal Elements
const progressModal = document.getElementById('progress-modal');
const progressTitle = document.getElementById('progress-title');
const progressStatus = document.getElementById('progress-status');
const progressBarFill = document.getElementById('progress-bar-fill');
const btnProgressCancel = document.getElementById('btn-progress-cancel');
let cancelExport = false;

// ---------------------------------------------------------------
// LocalStorage Persistence
// ---------------------------------------------------------------
function saveData() {
  localStorage.setItem('cert_records', JSON.stringify(records));
  localStorage.setItem('cert_isFileLoaded', isFileLoaded);
}

function loadData() {
  const savedRecords = localStorage.getItem('cert_records');
  const savedLoaded = localStorage.getItem('cert_isFileLoaded');
  if (savedRecords) {
    try {
      records = JSON.parse(savedRecords);
      isFileLoaded = savedLoaded === 'true';
      if(records.length > 0) {
        document.getElementById('csv-controls').style.display = 'block';
        updateDownloadMenuVisibility();
      }
    } catch(e) { console.error("Could not parse saved records", e); }
  }
}

// ---------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------
Promise.all([
  fetch('./courses.json').then(res => res.json()).then(data => { globalCourses = data; }),
  fetch('./ranks.json').then(res => res.json()).then(data => { globalRanks = data; })
]).then(() => {
  // Populate manual select
  const selectCourse = document.getElementById('input-course');
  globalCourses.forEach(item => { selectCourse.appendChild(new Option(item, item)); });
  const selectRank = document.getElementById('input-rank');
  globalRanks.forEach(item => { selectRank.appendChild(new Option(item, item)); });
  
  loadData();
  
  if(isFileLoaded && records.length > 0) {
    document.querySelector('[data-target="tab-csv"]').click();
    updateTemplateBadge(records[currentIndex].Course);
  } else {
    updateTemplateBadge(selectCourse.value);
  }
  
  // Trigger initial search filter & render
  handleSearch(); 
}).catch(console.error);

const today = new Date().toISOString().split('T')[0];
document.getElementById('input-date').value = today;

// ---------------------------------------------------------------
// Template Badge
// ---------------------------------------------------------------
function updateTemplateBadge(courseName) {
  if (!templateBadge) return;
  const url = getTemplateUrlForCourse(courseName);
  const filename = url.replace('./', '').replace(/\?.*$/, '');
  const isPD = url !== DEFAULT_TEMPLATE;
  templateBadge.textContent = '🖼 ' + filename;
  templateBadge.className = 'template-badge' + (isPD ? ' template-badge--alt' : '');
}
document.getElementById('input-course').addEventListener('change', (e) => {
  updateTemplateBadge(e.target.value);
  if (!isGridView) refreshViews();
});

// ---------------------------------------------------------------
// Theme
// ---------------------------------------------------------------
const setTheme = t => {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('theme', t);
};
themeBtn.addEventListener('click', () => {
  const newT = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(newT);
});
setTheme(localStorage.getItem('theme') || 'light');

// ---------------------------------------------------------------
// Tabs & Views
// ---------------------------------------------------------------
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panes.forEach(p => p.style.display = 'none');
    tab.classList.add('active');
    document.getElementById(tab.dataset.target).style.display = 'block';

    if (tab.dataset.target === 'tab-manual') {
      if (isGridView) switchView('single');
      const courseVal = document.getElementById('input-course').value;
      updateTemplateBadge(courseVal);
      tableDrawer.style.display = 'none';
    } else {
      tableDrawer.style.display = 'flex';
      handleSearch(); // refresh table
    }
    updateDownloadMenuVisibility();
    refreshViews();
  });
});

function switchView(view) {
  if (view === 'grid') {
    isGridView = true;
    btnGrid.classList.add('active');
    btnSingle.classList.remove('active');
    singleNav.style.display = 'none';
    singleWrapper.style.display = 'none';
    gridWrapper.style.display = 'grid';
    previewArea.style.alignItems = 'flex-start';
    previewArea.style.overflowY = 'auto';
  } else {
    isGridView = false;
    btnSingle.classList.add('active');
    btnGrid.classList.remove('active');
    singleNav.style.display = 'block';
    gridWrapper.style.display = 'none';
    singleWrapper.style.display = 'block';
    previewArea.style.alignItems = 'center';
    previewArea.style.overflowY = 'hidden';
  }
  refreshViews();
}
btnSingle.addEventListener('click', () => switchView('single'));
btnGrid.addEventListener('click', () => switchView('grid'));

function refreshViews() {
  if (isGridView) {
    renderGrid();
  } else {
    drawSingle();
    updateActiveTableRow();
  }
}

// ---------------------------------------------------------------
// Search Functionality
// ---------------------------------------------------------------
function cleanString(str) {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
}

function handleSearch() {
  if (!isFileLoaded) {
    filteredRecords = [];
    renderTable();
    return;
  }
  const query = cleanString(tableSearchInput.value);
  btnSearchClear.style.display = query ? 'block' : 'none';
  
  if (!query) {
    filteredRecords = records.map((r, i) => ({ record: r, index: i }));
  } else {
    filteredRecords = records.map((r, i) => ({ record: r, index: i })).filter(item => {
      const name = cleanString(item.record.Name);
      return name.includes(query);
    });
    
    // Auto-sync preview to first search result if in Single View
    if (!isGridView && filteredRecords.length > 0) {
      // Only switch if current index is not already in filtered results
      const currentInFiltered = filteredRecords.find(item => item.index === currentIndex);
      if (!currentInFiltered) {
        currentIndex = filteredRecords[0].index;
      }
    }
  }
  
  renderTable();
  refreshViews();
}
tableSearchInput.addEventListener('input', handleSearch);
btnSearchClear.addEventListener('click', () => {
  tableSearchInput.value = '';
  handleSearch();
});

// ---------------------------------------------------------------
// Data Input Handling (CSV & Manual)
// ---------------------------------------------------------------
document.querySelectorAll('#student-form input, #student-form select').forEach(el => {
  el.addEventListener('input', () => {
    if (!isGridView) refreshViews();
  });
});

document.getElementById('csv-upload').addEventListener('change', (e) => {
  const file = e.target.files[0];
  document.getElementById('upload-status').textContent = file ? file.name : 'No file chosen';
  if (file) {
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: function(results) {
        records = results.data;
        isFileLoaded = true;
        currentIndex = 0;
        document.getElementById('csv-controls').style.display = 'block';
        updateDownloadMenuVisibility();
        saveData();
        handleSearch();
      }
    });
  }
});

document.getElementById('prev-btn').addEventListener('click', () => {
  if (isFileLoaded && !isGridView && filteredRecords.length > 0) {
    const currentFilteredIdx = filteredRecords.findIndex(item => item.index === currentIndex);
    if (currentFilteredIdx > 0) {
      currentIndex = filteredRecords[currentFilteredIdx - 1].index;
    } else {
      currentIndex = filteredRecords[filteredRecords.length - 1].index;
    }
    refreshViews();
  }
});
document.getElementById('next-btn').addEventListener('click', () => {
  if (isFileLoaded && !isGridView && filteredRecords.length > 0) {
    const currentFilteredIdx = filteredRecords.findIndex(item => item.index === currentIndex);
    if (currentFilteredIdx >= 0 && currentFilteredIdx < filteredRecords.length - 1) {
      currentIndex = filteredRecords[currentFilteredIdx + 1].index;
    } else {
      currentIndex = filteredRecords[0].index;
    }
    refreshViews();
  }
});

// ---------------------------------------------------------------
// Interactive Data Table
// ---------------------------------------------------------------
btnTableToggle.addEventListener('click', () => tableDrawer.classList.toggle('collapsed'));

btnTableClear.addEventListener('click', () => {
  if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
    records = [];
    isFileLoaded = false;
    currentIndex = 0;
    document.getElementById('csv-controls').style.display = 'none';
    saveData();
    handleSearch();
  }
});

btnTableAdd.addEventListener('click', () => {
  const newRecord = { Name: 'New Student', Course: globalCourses[0] || '', Date: today, Rank: globalRanks[0] || '' };
  records.unshift(newRecord); // add to top
  isFileLoaded = true;
  document.getElementById('csv-controls').style.display = 'block';
  saveData();
  
  // Clear search to show the new record at the top
  tableSearchInput.value = '';
  currentIndex = 0; 
  handleSearch();
  
  // Open drawer if collapsed
  if (tableDrawer.classList.contains('collapsed')) {
    tableDrawer.classList.remove('collapsed');
  }
});

function renderTable() {
  tableRecordCount.textContent = `${filteredRecords.length} records`;
  dataTableBody.innerHTML = '';
  
  if (filteredRecords.length === 0) {
    dataTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#a0aec0; padding:20px;">No records found.</td></tr>`;
    return;
  }
  
  filteredRecords.forEach((item, displayIndex) => {
    const data = item.record;
    const originalIndex = item.index;
    const tr = document.createElement('tr');
    tr.dataset.index = originalIndex;
    tr.className = originalIndex === currentIndex ? 'active-row' : '';
    
    // Cell 1: Index & Select
    const tdIndex = document.createElement('td');
    tdIndex.style.textAlign = 'center';
    tdIndex.innerHTML = `<strong>${displayIndex + 1}</strong>`;
    tdIndex.style.cursor = 'pointer';
    tdIndex.title = "Click to preview this student";
    tdIndex.addEventListener('click', () => {
      currentIndex = originalIndex;
      if (isGridView) switchView('single');
      refreshViews();
    });
    
    // Cell 2: Name
    const tdName = document.createElement('td');
    const inputName = document.createElement('input');
    inputName.type = 'text';
    inputName.value = data.Name || '';
    inputName.addEventListener('change', (e) => {
      records[originalIndex].Name = e.target.value;
      saveData(); refreshViews();
    });
    tdName.appendChild(inputName);
    
    // Cell 3: Course (Select)
    const tdCourse = document.createElement('td');
    const selectCourse = document.createElement('select');
    globalCourses.forEach(c => selectCourse.appendChild(new Option(c, c)));
    selectCourse.value = data.Course || globalCourses[0];
    selectCourse.addEventListener('change', (e) => {
      records[originalIndex].Course = e.target.value;
      saveData(); refreshViews();
    });
    tdCourse.appendChild(selectCourse);
    
    // Cell 4: Date
    const tdDate = document.createElement('td');
    const inputDate = document.createElement('input');
    inputDate.type = 'date';
    // attempt to format DD/MM/YYYY back to YYYY-MM-DD for input
    let dVal = data.Date;
    if (dVal && dVal.includes('/')) {
      const p = dVal.split('/');
      if(p.length===3) dVal = `${p[2]}-${p[1]}-${p[0]}`;
    }
    inputDate.value = dVal || '';
    inputDate.addEventListener('change', (e) => {
      const parts = e.target.value.split('-');
      records[originalIndex].Date = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : e.target.value;
      saveData(); refreshViews();
    });
    tdDate.appendChild(inputDate);
    
    // Cell 5: Rank (Select)
    const tdRank = document.createElement('td');
    const selectRank = document.createElement('select');
    globalRanks.forEach(r => selectRank.appendChild(new Option(r, r)));
    selectRank.value = data.Rank || globalRanks[0];
    selectRank.addEventListener('change', (e) => {
      records[originalIndex].Rank = e.target.value;
      saveData(); refreshViews();
    });
    tdRank.appendChild(selectRank);
    
    // Cell 6: Actions
    const tdActions = document.createElement('td');
    tdActions.style.textAlign = 'center';
    const btnDel = document.createElement('button');
    btnDel.className = 'btn-icon';
    btnDel.innerHTML = '🗑️';
    btnDel.title = "Delete Student";
    btnDel.addEventListener('click', () => {
      records.splice(originalIndex, 1);
      if (currentIndex >= records.length) currentIndex = Math.max(0, records.length - 1);
      saveData();
      handleSearch(); // redraws table & canvas
    });
    tdActions.appendChild(btnDel);
    
    tr.appendChild(tdIndex);
    tr.appendChild(tdName);
    tr.appendChild(tdCourse);
    tr.appendChild(tdDate);
    tr.appendChild(tdRank);
    tr.appendChild(tdActions);
    
    dataTableBody.appendChild(tr);
  });
}

function updateActiveTableRow() {
  document.querySelectorAll('#data-table-body tr').forEach(tr => {
    if (parseInt(tr.dataset.index) === currentIndex) {
      tr.classList.add('active-row');
      // Scroll into view if needed
      tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      tr.classList.remove('active-row');
    }
  });
}

// ---------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------
function formatAppDate(dateString) {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateString;
}

function getCurrentData() {
  const isManual = document.querySelector('.tab.active').dataset.target === 'tab-manual';
  if (isManual) {
    return {
      Name:   document.getElementById('input-name').value   || '',
      Course: document.getElementById('input-course').value || '',
      Date:   formatAppDate(document.getElementById('input-date').value) || '',
      Rank:   document.getElementById('input-rank').value   || ''
    };
  } else if (isFileLoaded && records.length > 0) {
    if(filteredRecords.length > 0) {
      const active = filteredRecords.find(i => i.index === currentIndex);
      if(active) return active.record;
    }
    // Fallback if search hides current
    return records[currentIndex] || {};
  }
  return { Name: 'Name', Course: globalCourses[0], Date: '08/06/2026', Rank: 'GOOD' };
}

function drawSingle() {
  const ctx = mainCanvas.getContext('2d');
  const data = getCurrentData();

  if (isFileLoaded && document.querySelector('.tab.active').dataset.target === 'tab-csv') {
    const activeIndexInFiltered = filteredRecords.findIndex(i => i.index === currentIndex);
    if(activeIndexInFiltered >= 0) {
      document.getElementById('record-count').textContent = `${activeIndexInFiltered + 1} / ${filteredRecords.length} (Total: ${records.length})`;
    } else {
      document.getElementById('record-count').textContent = `0 / ${filteredRecords.length}`;
    }
    updateTemplateBadge(data.Course);
  }

  renderToContext(ctx, CONFIG.canvasWidth, CONFIG.canvasHeight, data);
}

function renderGrid() {
  if (!isFileLoaded || records.length === 0) return;
  gridWrapper.innerHTML = '';

  try {
    const scale = 0.5;

    // Single shared offscreen canvas for rendering (avoids GPU memory limits)
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = CONFIG.canvasWidth * scale;
    offscreenCanvas.height = CONFIG.canvasHeight * scale;
    const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

    // Use IntersectionObserver with the preview-area as root so lazy-loading
    // works within the scrollable container rather than the full viewport.
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const index = img.dataset.index;
          if (!index) return;
          
          const data = filteredRecords[index].record;
          
          // Clear and redraw on the shared canvas
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
          ctx.scale(scale, scale);
          
          renderToContext(ctx, CONFIG.canvasWidth, CONFIG.canvasHeight, data);
          
          // Extract as JPEG and assign to img element
          img.src = offscreenCanvas.toDataURL('image/jpeg', 0.9);
          
          // Stop observing after render
          obs.unobserve(img); 
        }
      });
    }, { root: previewArea, rootMargin: '500px' });

    filteredRecords.forEach((item, displayIndex) => {
      const data = item.record;
      const gridItem = document.createElement('div');
      gridItem.className = 'grid-item';

      const img = document.createElement('img');
      img.dataset.index = displayIndex;
      img.style.width = '100%';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.aspectRatio = '1600 / 1131';
      img.style.backgroundColor = 'var(--bg-app)';
      img.alt = '';
      
      observer.observe(img);

      const info = document.createElement('div');
      info.className = 'grid-item-info';

      const templateUrl = getTemplateUrlForCourse(data.Course);
      const isAlt = templateUrl !== DEFAULT_TEMPLATE;
      const templateTag = isAlt ? '<span class="grid-template-tag alt-tag">PD</span>' : '<span class="grid-template-tag">IC</span>';
      
      info.innerHTML = `${templateTag} ${displayIndex + 1}. ${data.Name || 'Unknown'}`;

      gridItem.appendChild(img);
      gridItem.appendChild(info);
      gridWrapper.appendChild(gridItem);
    });

  } catch (err) {
    gridWrapper.innerHTML = `<div style="padding:20px;color:red;">Error rendering grid: ${err.message}</div>`;
    console.error(err);
  }
}

function renderToContext(ctx, w, h, data) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  const templateUrl = getTemplateUrlForCourse(data.Course);
  const img = templateCache[templateUrl] || templateCache[DEFAULT_TEMPLATE];

  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 4; ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#a0aec0'; ctx.font = '24px Inter'; ctx.textAlign = 'center';
    ctx.fillText('Loading template...', w / 2, h / 2);
  }

  ctx.textBaseline = 'alphabetic';
  const centerX = w / 2;

  if (data.Name) {
    ctx.font = CONFIG.name.font; ctx.fillStyle = CONFIG.name.color; ctx.textAlign = CONFIG.name.align;
    ctx.fillText(data.Name, centerX, CONFIG.name.y);
  }
  if (data.Course) {
    ctx.font = CONFIG.course.font; ctx.fillStyle = CONFIG.course.color; ctx.textAlign = CONFIG.course.align;
    ctx.fillText(data.Course, centerX, CONFIG.course.y);
  }
  if (data.Date) {
    const dateCfg = (templateUrl !== DEFAULT_TEMPLATE) ? CONFIG.datePD : CONFIG.date;
    ctx.font = dateCfg.font; ctx.fillStyle = dateCfg.color; ctx.textAlign = dateCfg.align;
    if ('letterSpacing' in ctx && dateCfg.letterSpacing) ctx.letterSpacing = dateCfg.letterSpacing;
    ctx.fillText(data.Date, dateCfg.x, dateCfg.y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  if (data.Rank) {
    ctx.font = CONFIG.rank.font; ctx.fillStyle = CONFIG.rank.color; ctx.textAlign = CONFIG.rank.align;
    ctx.fillText(data.Rank, CONFIG.rank.x, CONFIG.rank.y);
  }
}

// ---------------------------------------------------------------
// Export Dropdown Logic
// ---------------------------------------------------------------
downloadBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  downloadMenu.classList.toggle('show');
});
window.addEventListener('click', () => {
  if (downloadMenu.classList.contains('show')) downloadMenu.classList.remove('show');
});

function updateDownloadMenuVisibility() {
  const isManual = document.querySelector('.tab.active').dataset.target === 'tab-manual';
  document.querySelectorAll('.csv-only').forEach(el => {
    el.style.display = isManual ? 'none' : 'block';
  });
}

// ---------------------------------------------------------------
// File Generation Handlers
// ---------------------------------------------------------------
// Helper to create Offscreen Canvas
function getOffscreenCanvas(data) {
  const c = document.createElement('canvas');
  c.width = CONFIG.canvasWidth;
  c.height = CONFIG.canvasHeight;
  renderToContext(c.getContext('2d'), c.width, c.height, data);
  return c;
}

// Single PNG
dlPngCurrent.addEventListener('click', (e) => {
  e.preventDefault();
  const data = getCurrentData();
  const canvas = getOffscreenCanvas(data);
  const link = document.createElement('a');
  link.download = `${cleanString(data.Name || 'certificate')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

// Single PDF
dlPdfCurrent.addEventListener('click', (e) => {
  e.preventDefault();
  const data = getCurrentData();
  const canvas = getOffscreenCanvas(data);
  const pdf = new jspdf.jsPDF({ orientation: 'l', unit: 'px', format: [CONFIG.canvasWidth, CONFIG.canvasHeight] });
  pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  pdf.save(`${cleanString(data.Name || 'certificate')}.pdf`);
});

// Bulk ZIP
dlZipAll.addEventListener('click', async (e) => {
  e.preventDefault();
  if (filteredRecords.length === 0) return alert("No records to export.");
  
  cancelExport = false;
  progressModal.style.display = 'flex';
  progressTitle.textContent = 'Generating ZIP File';
  const zip = new JSZip();
  const folder = zip.folder("Certificates");

  for (let i = 0; i < filteredRecords.length; i++) {
    if (cancelExport) break;
    const data = filteredRecords[i].record;
    
    progressStatus.textContent = `Processing: ${data.Name || 'Unknown'} (${i+1}/${filteredRecords.length})`;
    progressBarFill.style.width = `${((i) / filteredRecords.length) * 100}%`;
    
    // Yield to UI thread
    await new Promise(r => setTimeout(r, 20));
    
    const canvas = getOffscreenCanvas(data);
    const dataUrl = canvas.toDataURL('image/png');
    const b64Data = dataUrl.split(',')[1];
    folder.file(`${cleanString(data.Name || 'cert_'+i)}.png`, b64Data, {base64: true});
  }

  if (!cancelExport) {
    progressStatus.textContent = "Zipping files... please wait.";
    progressBarFill.style.width = "100%";
    await new Promise(r => setTimeout(r, 50));
    
    zip.generateAsync({ type: "blob" }).then(content => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = "Certificates.zip";
      link.click();
      progressModal.style.display = 'none';
    });
  } else {
    progressModal.style.display = 'none';
  }
});

// Bulk PDF
dlPdfAll.addEventListener('click', async (e) => {
  e.preventDefault();
  if (filteredRecords.length === 0) return alert("No records to export.");
  
  cancelExport = false;
  progressModal.style.display = 'flex';
  progressTitle.textContent = 'Generating Multi-page PDF';
  const pdf = new jspdf.jsPDF({ orientation: 'l', unit: 'px', format: [CONFIG.canvasWidth, CONFIG.canvasHeight] });

  for (let i = 0; i < filteredRecords.length; i++) {
    if (cancelExport) break;
    const data = filteredRecords[i].record;
    
    progressStatus.textContent = `Processing: ${data.Name || 'Unknown'} (${i+1}/${filteredRecords.length})`;
    progressBarFill.style.width = `${((i) / filteredRecords.length) * 100}%`;
    
    await new Promise(r => setTimeout(r, 20));
    
    const canvas = getOffscreenCanvas(data);
    if (i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  }

  if (!cancelExport) {
    progressStatus.textContent = "Saving PDF... please wait.";
    progressBarFill.style.width = "100%";
    await new Promise(r => setTimeout(r, 50));
    pdf.save("All_Certificates.pdf");
  }
  progressModal.style.display = 'none';
});

btnProgressCancel.addEventListener('click', () => { cancelExport = true; });

// Initial Trigger
document.fonts.ready.then(() => { refreshViews(); });
