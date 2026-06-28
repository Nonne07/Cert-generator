// --------------------------------------------------------------
// Certificate Generator App Logic
// --------------------------------------------------------------

// Layout Coordinates (based on 1600 x 1131 resolution)
// Layout Coordinates (based on 1600 x 1131 resolution)
const CONFIG = {
  canvasWidth: 1600,
  canvasHeight: 1131,
  name: {
    y: 520, // Centered vertically
    font: '700 90px "Dancing Script", cursive',
    color: '#184551',
    align: 'center'
  },
  course: {
    y: 670, // Moved down to avoid overlapping the line above
    font: 'bold 28px Inter, sans-serif',
    color: '#000000',
    align: 'center'
  },
  date: {
    x: 625, // Moved back slightly right to 625px
    y: 707, 
    font: '27px Inter, sans-serif',
    color: '#000000',
    align: 'center',
    letterSpacing: '1.5px'
  },
  rank: {
    x: 885, // Right after the colon
    y: 747, 
    font: 'bold 28px Inter, sans-serif',
    color: '#d34b32',
    align: 'left'
  }
};

// Global State
let isGridView = false;
let currentIndex = 0;
let isFileLoaded = false;
let records = []; // Array of {Name, Course, Date, Rank}
let bgImage = null; // Image object for background

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
const downloadBtn = document.getElementById('download-btn');

// --------------------------------------------------------------
// Fetch Configurations
// --------------------------------------------------------------
let globalCourses = [];
let globalRanks = [];

fetch('./courses.json').then(res => res.json()).then(data => {
  globalCourses = data;
  const select = document.getElementById('input-course');
  data.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item;
    opt.textContent = item;
    select.appendChild(opt);
  });
  if(data.length > 0) drawSingle();
}).catch(console.error);

fetch('./ranks.json').then(res => res.json()).then(data => {
  globalRanks = data;
  const select = document.getElementById('input-rank');
  data.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item;
    opt.textContent = item;
    select.appendChild(opt);
  });
  if(data.length > 0) drawSingle();
}).catch(console.error);

// Set default date to today
const today = new Date().toISOString().split('T')[0];
document.getElementById('input-date').value = today;

// --------------------------------------------------------------
// Theme
// --------------------------------------------------------------
const setTheme = t => {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('theme', t);
};
themeBtn.addEventListener('click', () => {
  const newT = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(newT);
});
setTheme(localStorage.getItem('theme') || 'light');


// --------------------------------------------------------------
// Background Template Loading
// --------------------------------------------------------------
bgImage = new Image();
bgImage.onload = () => {
  refreshViews();
};
// Use a local template image file with cache busting to avoid browser caching
bgImage.src = './template.png?v=' + new Date().getTime();


// --------------------------------------------------------------
// Tabs & Views
// --------------------------------------------------------------
const tableDrawer = document.getElementById('table-drawer');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panes.forEach(p => p.style.display = 'none');
    tab.classList.add('active');
    document.getElementById(tab.dataset.target).style.display = 'block';
    
    // Switch to single view if returning to manual
    if (tab.dataset.target === 'tab-manual') {
      if (isGridView) switchView('single');
      tableDrawer.style.display = 'none';
      document.querySelectorAll('.csv-only').forEach(el => el.style.display = 'none');
    } else {
      if (isFileLoaded && records.length > 0) {
        tableDrawer.style.display = 'flex';
        document.querySelectorAll('.csv-only').forEach(el => el.style.display = 'block');
      }
      refreshViews();
    }
  });
});

function switchView(view) {
  if(view === 'grid') {
    isGridView = true;
    btnGrid.classList.add('active');
    btnSingle.classList.remove('active');
    singleNav.style.display = 'none';
    singleWrapper.style.display = 'none';
    gridWrapper.style.display = 'grid';
    previewArea.style.alignItems = 'flex-start';
    renderGrid();
  } else {
    isGridView = false;
    btnSingle.classList.add('active');
    btnGrid.classList.remove('active');
    singleNav.style.display = 'block';
    gridWrapper.style.display = 'none';
    singleWrapper.style.display = 'block';
    previewArea.style.alignItems = 'center';
    drawSingle();
  }
}

btnSingle.addEventListener('click', () => switchView('single'));
btnGrid.addEventListener('click', () => switchView('grid'));

function refreshViews() {
  if (isGridView) {
    renderGrid();
  } else {
    drawSingle();
  }
}


// --------------------------------------------------------------
// Data Input Handling
// --------------------------------------------------------------
document.querySelectorAll('#student-form input, #student-form select').forEach(el => {
  el.addEventListener('input', () => {
    if(!isGridView) drawSingle();
  });
});

document.getElementById('csv-upload').addEventListener('change', (e) => {
  const file = e.target.files[0];
  document.getElementById('upload-status').textContent = file ? file.name : 'No file chosen';
  if(file) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        records = results.data;
        isFileLoaded = true;
        currentIndex = 0;
        document.getElementById('csv-controls').style.display = 'block';
        
        // Show and expand table drawer
        tableDrawer.classList.remove('collapsed');
        document.getElementById('btn-table-toggle').textContent = '▼';
        renderTable();
        
        document.querySelectorAll('.csv-only').forEach(el => el.style.display = 'block');
        
        refreshViews();
      }
    });
  }
});

document.getElementById('prev-btn').addEventListener('click', () => {
  if(isFileLoaded && !isGridView && records.length > 0) {
    currentIndex = (currentIndex - 1 + records.length) % records.length;
    drawSingle();
  }
});

document.getElementById('next-btn').addEventListener('click', () => {
  if(isFileLoaded && !isGridView && records.length > 0) {
    currentIndex = (currentIndex + 1) % records.length;
    drawSingle();
  }
});


// --------------------------------------------------------------
// Rendering
// --------------------------------------------------------------
function formatAppDate(dateString) {
  if (!dateString) return '';
  // If dateString is YYYY-MM-DD from the date picker
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
  }
  return dateString; // fallback
}

function getCurrentData() {
  const isManual = document.querySelector('.tab.active').dataset.target === 'tab-manual';
  if (isManual) {
    return {
      Name: document.getElementById('input-name').value || '',
      Course: document.getElementById('input-course').value || '',
      Date: formatAppDate(document.getElementById('input-date').value) || '',
      Rank: document.getElementById('input-rank').value || ''
    };
  } else if (isFileLoaded && records.length > 0) {
    // If CSV data needs formatting, do it here too, but assume CSV provides exact string for now
    return records[currentIndex];
  }
  return { Name: 'Name', Course: 'FUNDAMENTAL OF IC DESIGN AND VERIFICATION', Date: '08/06/2026', Rank: 'GOOD' };
}

function drawSingle() {
  const ctx = mainCanvas.getContext('2d');
  const data = getCurrentData();
  
  if (isFileLoaded && document.querySelector('.tab.active').dataset.target === 'tab-csv') {
    document.getElementById('record-count').textContent = `${currentIndex + 1} / ${records.length}`;
    updateActiveRow();
  }

  renderToContext(ctx, CONFIG.canvasWidth, CONFIG.canvasHeight, data);
}

function renderGrid() {
  if (!isFileLoaded || records.length === 0) return;
  gridWrapper.innerHTML = '';
  
  records.forEach((data, index) => {
    const item = document.createElement('div');
    item.className = 'grid-item';
    
    const canvas = document.createElement('canvas');
    canvas.width = CONFIG.canvasWidth;
    canvas.height = CONFIG.canvasHeight;
    const ctx = canvas.getContext('2d');
    renderToContext(ctx, canvas.width, canvas.height, data);
    
    const info = document.createElement('div');
    info.className = 'grid-item-info';
    info.textContent = `${index + 1}. ${data.Name || 'Unknown'}`;

    item.appendChild(canvas);
    item.appendChild(info);
    gridWrapper.appendChild(item);
  });
}

function renderToContext(ctx, w, h, data) {
  // Clear
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  
  // Draw Background if uploaded
  if (bgImage) {
    ctx.drawImage(bgImage, 0, 0, w, h);
  } else {
    // Draw placeholder outline if no background
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#a0aec0';
    ctx.font = '24px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('Please upload the blank certificate template in the "Manual Entry" tab.', w/2, 60);
  }

  // Restore default baseline
  ctx.textBaseline = 'alphabetic';
  const centerX = w / 2;

  // 1. Name
  if (data.Name) {
    ctx.font = CONFIG.name.font;
    ctx.fillStyle = CONFIG.name.color;
    ctx.textAlign = CONFIG.name.align;
    ctx.fillText(data.Name, centerX, CONFIG.name.y);
  }

  // 2. Course
  if (data.Course) {
    ctx.font = CONFIG.course.font;
    ctx.fillStyle = CONFIG.course.color;
    ctx.textAlign = CONFIG.course.align;
    ctx.fillText(data.Course, centerX, CONFIG.course.y);
  }

  // 3. Date (in the gap)
  if (data.Date) {
    ctx.font = CONFIG.date.font;
    ctx.fillStyle = CONFIG.date.color;
    ctx.textAlign = CONFIG.date.align;
    if ('letterSpacing' in ctx && CONFIG.date.letterSpacing) {
      ctx.letterSpacing = CONFIG.date.letterSpacing;
    }
    ctx.fillText(data.Date, CONFIG.date.x, CONFIG.date.y);
    if ('letterSpacing' in ctx && CONFIG.date.letterSpacing) {
      ctx.letterSpacing = '0px';
    }
  }

  // 4. Rank (after CLASSIFICATION:)
  if (data.Rank) {
    ctx.font = CONFIG.rank.font;
    ctx.fillStyle = CONFIG.rank.color;
    ctx.textAlign = CONFIG.rank.align;
    ctx.fillText(data.Rank, CONFIG.rank.x, CONFIG.rank.y);
  }
}

// --------------------------------------------------------------
// Table Drawer UI Logic
// --------------------------------------------------------------
const btnTableToggle = document.getElementById('btn-table-toggle');
btnTableToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleTableDrawer();
});

document.querySelector('.drawer-header').addEventListener('click', (e) => {
  if (!e.target.closest('button')) {
    toggleTableDrawer();
  }
});

function toggleTableDrawer() {
  tableDrawer.classList.toggle('collapsed');
  const isCollapsed = tableDrawer.classList.contains('collapsed');
  btnTableToggle.textContent = isCollapsed ? '▲' : '▼';
}

document.getElementById('btn-table-add').addEventListener('click', addRecord);

// Helper to remove Vietnamese diacritics and convert to lowercase for fuzzy search
function cleanString(str) {
  if (!str) return '';
  return str.normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "D")
            .toLowerCase();
}

// Bind Search Event Listeners
const searchInput = document.getElementById('table-search-input');
const searchClearBtn = document.getElementById('btn-search-clear');

searchInput.addEventListener('input', () => {
  const query = searchInput.value;
  searchClearBtn.style.display = query ? 'block' : 'none';
  renderTable();
});

searchClearBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchClearBtn.style.display = 'none';
  renderTable();
  searchInput.focus();
});

function renderTable() {
  const tbody = document.getElementById('data-table-body');
  tbody.innerHTML = '';
  
  const badge = document.getElementById('table-record-count');
  
  if (!isFileLoaded || records.length === 0) {
    tableDrawer.style.display = 'none';
    return;
  }
  
  tableDrawer.style.display = 'flex';
  
  const query = searchInput ? searchInput.value.trim() : '';
  const cleanQuery = cleanString(query);
  
  let visibleCount = 0;
  
  records.forEach((record, index) => {
    // Check search query
    if (cleanQuery) {
      const cleanName = cleanString(record.Name || '');
      if (!cleanName.includes(cleanQuery)) {
        return; // Skip rendering
      }
    }
    
    visibleCount++;
    
    const tr = document.createElement('tr');
    tr.dataset.index = index;
    if (index === currentIndex) {
      tr.className = 'active-row';
    }
    
    tr.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT' && !e.target.closest('.trash-btn')) {
        currentIndex = index;
        switchView('single');
        updateActiveRow();
      }
    });
    
    // 1. Index
    const tdIndex = document.createElement('td');
    tdIndex.style.textAlign = 'center';
    tdIndex.textContent = index + 1;
    tr.appendChild(tdIndex);
    
    // 2. Student Name
    const tdName = document.createElement('td');
    const inputName = document.createElement('input');
    inputName.type = 'text';
    inputName.value = record.Name || '';
    inputName.addEventListener('input', (e) => {
      records[index].Name = e.target.value;
      refreshViews();
    });
    tdName.appendChild(inputName);
    tr.appendChild(tdName);
    
    // 3. Course / Program
    const tdCourse = document.createElement('td');
    const selectCourse = document.createElement('select');
    globalCourses.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (c === record.Course) opt.selected = true;
      selectCourse.appendChild(opt);
    });
    selectCourse.addEventListener('change', (e) => {
      records[index].Course = e.target.value;
      refreshViews();
    });
    tdCourse.appendChild(selectCourse);
    tr.appendChild(tdCourse);
    
    // 4. Date
    const tdDate = document.createElement('td');
    const inputDate = document.createElement('input');
    inputDate.type = 'text';
    inputDate.value = record.Date || '';
    inputDate.addEventListener('input', (e) => {
      records[index].Date = e.target.value;
      refreshViews();
    });
    tdDate.appendChild(inputDate);
    tr.appendChild(tdDate);
    
    // 5. Classification
    const tdRank = document.createElement('td');
    const selectRank = document.createElement('select');
    globalRanks.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      if (r === record.Rank) opt.selected = true;
      selectRank.appendChild(opt);
    });
    selectRank.addEventListener('change', (e) => {
      records[index].Rank = e.target.value;
      refreshViews();
    });
    tdRank.appendChild(selectRank);
    tr.appendChild(tdRank);
    
    // 6. Actions
    const tdDelete = document.createElement('td');
    tdDelete.style.textAlign = 'center';
    const trashBtn = document.createElement('button');
    trashBtn.className = 'trash-btn';
    trashBtn.title = 'Delete Student';
    trashBtn.innerHTML = `<svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>`;
    trashBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteRecord(index);
    });
    tdDelete.appendChild(trashBtn);
    tr.appendChild(tdDelete);
    
    tbody.appendChild(tr);
  });
  
  if (visibleCount === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.style.textAlign = 'center';
    td.style.padding = '20px';
    td.style.color = 'var(--text-secondary)';
    td.textContent = `No students found matching "${query}"`;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
  
  badge.textContent = cleanQuery 
    ? `${visibleCount} found of ${records.length}` 
    : `${records.length} records`;
}

function updateActiveRow() {
  const rows = document.querySelectorAll('#data-table-body tr');
  rows.forEach((row) => {
    if (row.cells.length === 1) return; // ignore no results row
    
    const idx = parseInt(row.dataset.index);
    if (!isNaN(idx) && idx === currentIndex) {
      row.classList.add('active-row');
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      row.classList.remove('active-row');
    }
  });
  
  if (isFileLoaded && records.length > 0) {
    tableDrawer.style.display = 'flex';
  } else {
    tableDrawer.style.display = 'none';
  }
}

function addRecord() {
  const todayStr = formatAppDate(document.getElementById('input-date').value) || '08/06/2026';
  const newRec = {
    Name: 'New Student',
    Course: globalCourses[0] || 'FUNDAMENTAL OF IC DESIGN AND VERIFICATION',
    Date: todayStr,
    Rank: globalRanks[0] || 'GOOD'
  };
  
  if (!isFileLoaded) {
    records = [];
    isFileLoaded = true;
    document.getElementById('csv-controls').style.display = 'block';
  }
  
  records.push(newRec);
  currentIndex = records.length - 1;
  renderTable();
  switchView('single');
  updateActiveRow();
}

function deleteRecord(index) {
  if (confirm(`Are you sure you want to delete student "${records[index].Name || 'Unknown'}"?`)) {
    records.splice(index, 1);
    if (records.length === 0) {
      isFileLoaded = false;
      document.getElementById('csv-controls').style.display = 'none';
      tableDrawer.style.display = 'none';
      currentIndex = 0;
      refreshViews();
    } else {
      if (currentIndex >= records.length) {
        currentIndex = records.length - 1;
      }
      renderTable();
      refreshViews();
      updateActiveRow();
    }
  }
}

// --------------------------------------------------------------
// Export Dropdown & Progress Modal Logic
// --------------------------------------------------------------
const downloadDropdown = document.getElementById('download-dropdown');
const downloadBtnElement = document.getElementById('download-btn');

downloadBtnElement.addEventListener('click', (e) => {
  e.stopPropagation();
  downloadDropdown.classList.toggle('show');
});

window.addEventListener('click', () => {
  downloadDropdown.classList.remove('show');
});

// Progress Modal Controls
const progressModal = document.getElementById('progress-modal');
const progressTitle = document.getElementById('progress-title');
const progressStatus = document.getElementById('progress-status');
const progressBarFill = document.getElementById('progress-bar-fill');
const btnProgressCancel = document.getElementById('btn-progress-cancel');

let isGenerationCancelled = false;

btnProgressCancel.addEventListener('click', () => {
  isGenerationCancelled = true;
  hideProgressModal();
});

function showProgressModal(title, initialStatus) {
  isGenerationCancelled = false;
  progressTitle.textContent = title;
  progressStatus.textContent = initialStatus;
  progressBarFill.style.width = '0%';
  progressModal.style.display = 'flex';
}

function updateProgress(status, percent) {
  progressStatus.textContent = status;
  progressBarFill.style.width = `${percent}%`;
}

function hideProgressModal() {
  progressModal.style.display = 'none';
}

// Export Trigger Event Listeners
document.getElementById('download-png-current').addEventListener('click', (e) => {
  e.preventDefault();
  const data = getCurrentData();
  downloadCanvas(mainCanvas, `${data.Name || 'certificate'}.png`);
});

document.getElementById('download-pdf-current').addEventListener('click', (e) => {
  e.preventDefault();
  const data = getCurrentData();
  
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  
  const imgData = mainCanvas.toDataURL('image/png');
  pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
  pdf.save(`${data.Name || 'certificate'}.pdf`);
});

document.getElementById('download-zip-all').addEventListener('click', async (e) => {
  e.preventDefault();
  if (!isFileLoaded || records.length === 0) return;
  
  showProgressModal("Generating ZIP Archive", "Preparing files...");
  
  const zip = new JSZip();
  const folder = zip.folder("certificates");
  
  const offscreen = document.createElement('canvas');
  offscreen.width = CONFIG.canvasWidth;
  offscreen.height = CONFIG.canvasHeight;
  const ctx = offscreen.getContext('2d');
  
  for (let i = 0; i < records.length; i++) {
    if (isGenerationCancelled) {
      return;
    }
    
    const record = records[i];
    updateProgress(`Rendering certificate ${i + 1} of ${records.length}...`, Math.round((i / records.length) * 80));
    
    renderToContext(ctx, offscreen.width, offscreen.height, record);
    
    const blob = await new Promise(resolve => offscreen.toBlob(resolve, 'image/png'));
    const safeName = (record.Name || `cert_${i}`).trim().replace(/[/\\?%*:|"<>]/g, '-');
    folder.file(`${i + 1}_${safeName}.png`, blob);
    
    await new Promise(r => setTimeout(r, 15));
  }
  
  if (isGenerationCancelled) return;
  updateProgress("Compressing files into ZIP...", 85);
  
  const content = await zip.generateAsync({type: "blob"}, (metadata) => {
    updateProgress(`Compressing ZIP: ${Math.round(metadata.percent)}%`, 85 + Math.round(metadata.percent * 0.14));
  });
  
  if (isGenerationCancelled) return;
  updateProgress("Downloading ZIP file...", 100);
  
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = "certificates.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  setTimeout(hideProgressModal, 500);
});

document.getElementById('download-pdf-all').addEventListener('click', async (e) => {
  e.preventDefault();
  if (!isFileLoaded || records.length === 0) return;
  
  showProgressModal("Generating Multi-page PDF", "Preparing pages...");
  
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  
  const offscreen = document.createElement('canvas');
  offscreen.width = CONFIG.canvasWidth;
  offscreen.height = CONFIG.canvasHeight;
  const ctx = offscreen.getContext('2d');
  
  for (let i = 0; i < records.length; i++) {
    if (isGenerationCancelled) {
      return;
    }
    
    const record = records[i];
    updateProgress(`Adding page ${i + 1} of ${records.length}...`, Math.round((i / records.length) * 95));
    
    if (i > 0) {
      pdf.addPage();
    }
    
    renderToContext(ctx, offscreen.width, offscreen.height, record);
    
    const imgData = offscreen.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, 297, 210);
    
    await new Promise(r => setTimeout(r, 15));
  }
  
  if (isGenerationCancelled) return;
  updateProgress("Saving PDF document...", 98);
  
  await new Promise(r => setTimeout(r, 100));
  if (isGenerationCancelled) return;
  
  pdf.save("certificates.pdf");
  hideProgressModal();
});

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
}

// Initial draw
document.fonts.ready.then(() => {
  drawSingle();
});


