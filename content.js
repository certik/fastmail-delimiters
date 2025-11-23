// Wait for the page to fully load before running
console.log('[FastMail Delimiters] Extension loaded');

// Global state for robust update management
let updateTimeout = null;        // Tracks pending debounced update
let isUpdating = false;           // Execution lock to prevent overlapping updates
let delimiterRegistry = new Map(); // Tracks current delimiters: key → {element, position, dateLabel}

// Wait for emails to actually appear in the DOM
function waitForEmails() {
  console.log('[FastMail Delimiters] Waiting for emails to load...');
  const checkInterval = setInterval(() => {
    const rows = document.querySelectorAll('li.v-MailboxItem');
    if (rows.length > 0) {
      console.log('[FastMail Delimiters] Emails detected, scheduling initial update');
      clearInterval(checkInterval);
      scheduleUpdate();
      startObserver();
    }
  }, 500);

  // Stop checking after 30 seconds
  setTimeout(() => clearInterval(checkInterval), 30000);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForEmails);
} else {
  waitForEmails();
}

// Debounced update scheduler - prevents multiple rapid update calls
function scheduleUpdate() {
  // Clear any pending update
  if (updateTimeout !== null) {
    clearTimeout(updateTimeout);
  }

  // Schedule new update after delay
  updateTimeout = setTimeout(() => {
    updateTimeout = null;
    executeUpdate();
  }, 0); // Low delay for responsiveness while still batching rapid changes
}

// Execution wrapper with lock and RAF for stable layout
function executeUpdate() {
  // If already updating, reschedule and exit
  if (isUpdating) {
    console.log('[FastMail Delimiters] Update already in progress, rescheduling...');
    scheduleUpdate();
    return;
  }

  // Set lock
  isUpdating = true;

  // Wait for stable layout before calculating positions
  requestAnimationFrame(() => {
    try {
      updateDelimiters();
    } finally {
      // Always release lock, even if error occurs
      isUpdating = false;
    }
  });
}

// Main update function - calculates and reconciles delimiters
function updateDelimiters() {
  console.log('[FastMail Delimiters] Running updateDelimiters()');

  const desiredDelimiters = calculateDesiredDelimiters();
  reconcileDelimiters(desiredDelimiters);
}

// Calculate where delimiters should be (pure calculation, no DOM modification)
function calculateDesiredDelimiters() {
  const delimiters = [];
  const rows = document.querySelectorAll('li.v-MailboxItem');

  console.log('[FastMail Delimiters] Calculating delimiters for', rows.length, 'email rows');

  if (rows.length === 0) {
    return delimiters;
  }

  let prevDate = null;
  let prevRow = null;

  rows.forEach((row, index) => {
    // Extract date from the time element
    const dateElem = row.querySelector('.v-MailboxItem-time');
    if (!dateElem) {
      return;
    }

    // Get the full date from the title attribute
    const dateTitle = dateElem.getAttribute('title');
    if (!dateTitle) {
      return;
    }

    // Parse the date - extract just the date part (before the time)
    let currentDate;
    try {
      // Match pattern like "Friday, November 21, 2025"
      const dateMatch = dateTitle.match(/^([^,]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/);
      if (dateMatch) {
        const parsedDate = new Date(dateMatch[1]);
        currentDate = parsedDate.toDateString();
      }
    } catch (e) {
      console.error('[FastMail Delimiters] Error parsing date:', dateTitle, e);
      return;
    }

    if (!currentDate) {
      return;
    }

    // Insert delimiter if date changes OR if this is the first email
    if ((prevDate && currentDate !== prevDate && prevRow) || (index === 0 && !prevDate)) {
      // Get current position of this row
      const currentTop = parseInt(row.style.top);

      if (isNaN(currentTop)) {
        console.warn('[FastMail Delimiters] Invalid position for row', index);
        return;
      }

      // Position delimiter just above current row (3px overlap to sit on border)
      const position = currentTop - 3;
      const dateLabel = formatDateLabel(currentDate);

      delimiters.push({ position, dateLabel });

      console.log('[FastMail Delimiters] Delimiter needed at', position, 'for', dateLabel);
    }

    prevDate = currentDate;
    prevRow = row;
  });

  console.log('[FastMail Delimiters] Calculated', delimiters.length, 'delimiters');
  return delimiters;
}

// Reconcile desired delimiters with current registry (surgical DOM updates)
function reconcileDelimiters(desiredDelimiters) {
  // Build desired registry from array
  const desiredRegistry = new Map();
  desiredDelimiters.forEach(({ position, dateLabel }) => {
    const key = `pos-${position}-${dateLabel}`;
    desiredRegistry.set(key, { position, dateLabel });
  });

  console.log('[FastMail Delimiters] Reconciling:', desiredRegistry.size, 'desired vs', delimiterRegistry.size, 'current');

  // Find the email list container for inserting delimiters
  const container = document.querySelector('ul.v-MailboxList') ||
                   document.querySelector('li.v-MailboxItem')?.parentNode;

  if (!container) {
    console.warn('[FastMail Delimiters] Could not find email container');
    return;
  }

  // Track what we need to do
  const toRemove = [];
  const toUpdate = [];
  const toKeep = [];

  // 1. Check current registry - identify what to remove/update/keep
  delimiterRegistry.forEach((data, key) => {
    if (!desiredRegistry.has(key)) {
      // Not in desired → REMOVE
      toRemove.push(key);
    } else {
      const desired = desiredRegistry.get(key);
      // Check if position or label changed
      if (data.position !== desired.position || data.dateLabel !== desired.dateLabel) {
        // Changed → UPDATE
        toUpdate.push({ key, desired });
      } else {
        // Unchanged → KEEP
        toKeep.push(key);
      }
    }
  });

  // 2. Identify what to ADD (in desired but not in current)
  const toAdd = [];
  desiredRegistry.forEach((data, key) => {
    if (!delimiterRegistry.has(key)) {
      toAdd.push({ key, ...data });
    }
  });

  console.log('[FastMail Delimiters] Actions: remove=' + toRemove.length +
              ', update=' + toUpdate.length + ', keep=' + toKeep.length + ', add=' + toAdd.length);

  // 3. Execute: REMOVE
  toRemove.forEach(key => {
    const data = delimiterRegistry.get(key);
    if (data && data.element && data.element.parentNode) {
      data.element.remove();
    }
    delimiterRegistry.delete(key);
    console.log('[FastMail Delimiters] Removed delimiter:', key);
  });

  // 4. Execute: UPDATE
  toUpdate.forEach(({ key, desired }) => {
    const data = delimiterRegistry.get(key);
    if (data && data.element) {
      data.element.style.top = desired.position + 'px';
      const labelSpan = data.element.querySelector('.date-label');
      if (labelSpan) {
        labelSpan.textContent = desired.dateLabel;
      }
      data.position = desired.position;
      data.dateLabel = desired.dateLabel;
      console.log('[FastMail Delimiters] Updated delimiter:', key);
    }
  });

  // 5. Execute: ADD
  toAdd.forEach(({ key, position, dateLabel }) => {
    const divider = document.createElement('div');
    divider.className = 'date-divider';

    // Create a span for the date label
    const labelSpan = document.createElement('span');
    labelSpan.className = 'date-label';
    labelSpan.textContent = dateLabel;
    divider.appendChild(labelSpan);

    divider.style.position = 'absolute';
    divider.style.top = position + 'px';
    divider.style.left = '0px';
    divider.style.right = '0px';
    divider.style.width = '100%';
    divider.style.zIndex = '10';

    container.appendChild(divider);
    delimiterRegistry.set(key, { element: divider, position, dateLabel });
    console.log('[FastMail Delimiters] Added delimiter:', key, 'at', position);
  });

  console.log('[FastMail Delimiters] Reconciliation complete. Registry size:', delimiterRegistry.size);
}

// Format the date label for display
function formatDateLabel(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Check if it's today or yesterday
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    // Format as "Month Day, Year"
    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  }
}

// Handle dynamic loading (new emails as you scroll) and folder changes
function startObserver() {
  console.log('[FastMail Delimiters] Starting MutationObserver');

  const observer = new MutationObserver(function(mutations) {
    let rowsAdded = 0;
    let rowsRemoved = 0;

    // Count changes to email rows only
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(function(node) {
          if (node.classList && node.classList.contains('v-MailboxItem')) {
            rowsAdded++;
          }
        });
        mutation.removedNodes.forEach(function(node) {
          if (node.classList && node.classList.contains('v-MailboxItem')) {
            rowsRemoved++;
          }
        });
      }
    });

    // Only proceed if email rows actually changed
    if (rowsAdded === 0 && rowsRemoved === 0) {
      return;
    }

    const currentTotalRows = document.querySelectorAll('li.v-MailboxItem').length;

    // Smart change detection
    let changeType = 'UNKNOWN';
    if (rowsRemoved > 10 && currentTotalRows < 5) {
      changeType = 'FOLDER_SWITCH';
      // Clear registry for efficiency (everything will be rebuilt)
      delimiterRegistry.forEach(data => {
        if (data.element && data.element.parentNode) {
          data.element.remove();
        }
      });
      delimiterRegistry.clear();
      console.log('[FastMail Delimiters] Detected folder switch, cleared registry');
    } else if (rowsAdded > 0 && rowsRemoved < 5) {
      changeType = 'SCROLL_LOAD';
    } else if (rowsAdded < 3 && rowsRemoved < 3) {
      changeType = 'INDIVIDUAL_ACTION';
    }

    console.log('[FastMail Delimiters] Change detected:', changeType,
                '(+' + rowsAdded + ', -' + rowsRemoved + ', total=' + currentTotalRows + ')');

    // Schedule update for any email row changes
    scheduleUpdate();
  });

  // Try to find specific email container first for narrower observation scope
  let container = document.querySelector('ul.v-MailboxList');
  if (!container) {
    const firstEmail = document.querySelector('li.v-MailboxItem');
    container = firstEmail?.parentNode;
  }

  // Fallback to body if specific container not found
  if (!container) {
    console.log('[FastMail Delimiters] Specific container not found, observing body');
    container = document.querySelector('body');
  } else {
    console.log('[FastMail Delimiters] Observing specific container:', container.tagName + '.' + container.className);
  }

  if (container) {
    observer.observe(container, { childList: true, subtree: true });
  }
}
