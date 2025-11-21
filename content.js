// Wait for the page to fully load before running
console.log('[FastMail Delimiters] Extension loaded');

// Wait for emails to actually appear in the DOM
function waitForEmails() {
  console.log('[FastMail Delimiters] Waiting for emails to load...');
  const checkInterval = setInterval(() => {
    const rows = document.querySelectorAll('li.v-MailboxItem');
    if (rows.length > 0) {
      console.log('[FastMail Delimiters] Emails detected, running addDelimiters');
      clearInterval(checkInterval);
      addDelimiters();
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

// Function to add delimiters
function addDelimiters() {
  console.log('[FastMail Delimiters] Running addDelimiters()');

  // Remove all existing delimiters
  const existingDelimiters = document.querySelectorAll('.date-divider');
  existingDelimiters.forEach(d => d.remove());
  console.log('[FastMail Delimiters] Removed', existingDelimiters.length, 'existing delimiters');

  // Find all email rows (using the class from the HTML example)
  const rows = document.querySelectorAll('li.v-MailboxItem');

  console.log('[FastMail Delimiters] Found', rows.length, 'email rows');
  if (rows.length === 0) return; // No rows found

  // Clear processed flags so emails can be re-processed
  rows.forEach(r => {
    delete r.dataset.delimiterProcessed;
    delete r.dataset.originalTop;
  });

  let prevDate = null;
  let prevRow = null;

  rows.forEach((row, index) => {
    // Store original position if not already stored
    if (!row.dataset.originalTop) {
      row.dataset.originalTop = row.style.top;
    }

    // Skip if already processed
    if (row.dataset.delimiterProcessed === 'true') {
      console.log('[FastMail Delimiters] Skipping row', index, 'at', row.style.top, '(already processed)');
      // Still track date for comparison
      const dateElem = row.querySelector('.v-MailboxItem-time');
      if (dateElem) {
        const dateTitle = dateElem.getAttribute('title');
        if (dateTitle) {
          const dateMatch = dateTitle.match(/^([^,]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/);
          if (dateMatch) {
            prevDate = new Date(dateMatch[1]).toDateString();
            prevRow = row;
            console.log('[FastMail Delimiters] Updated prevDate to', prevDate, 'prevRow index', index);
          }
        }
      }
      return;
    }
    console.log('[FastMail Delimiters] Processing row', index, 'at', row.style.top);
    // Extract date from the time element
    const dateElem = row.querySelector('.v-MailboxItem-time');
    if (!dateElem) {
      if (index === 0) console.log('[FastMail Delimiters] No .v-MailboxItem-time found in first row');
      return;
    }

    // Get the full date from the title attribute
    // Format: "Friday, November 21, 2025 1:06 PM (2 hours ago)"
    const dateTitle = dateElem.getAttribute('title');
    if (index === 0) console.log('[FastMail Delimiters] First row date title:', dateTitle);
    if (!dateTitle) return;

    // Parse the date - extract just the date part (before the time)
    let currentDate;
    try {
      // Match pattern like "Friday, November 21, 2025"
      const dateMatch = dateTitle.match(/^([^,]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/);
      if (dateMatch) {
        const parsedDate = new Date(dateMatch[1]);
        // Use just the date part (ignore time) for comparison
        currentDate = parsedDate.toDateString();
      }
    } catch (e) {
      console.error('Error parsing date:', dateTitle, e);
      return;
    }

    if (!currentDate) return;

    // Insert delimiter if date changes OR if this is the first email
    if ((prevDate && currentDate !== prevDate && prevRow) || (index === 0 && !prevDate)) {
      console.log('[FastMail Delimiters] Date changed from', prevDate, 'to', currentDate, '- inserting delimiter');

      // Use CURRENT position of prevRow (it may have been shifted already in this run)
      const prevCurrentTop = prevRow ? parseInt(prevRow.style.top) || 0 : 0;
      const currentCurrentTop = parseInt(row.style.top) || 0;
      const currentOriginalTop = parseInt(row.dataset.originalTop) || 0;
      const actualGap = currentCurrentTop - prevCurrentTop;

      console.log('[FastMail Delimiters] prevCurrentTop:', prevCurrentTop, 'currentCurrentTop:', currentCurrentTop, 'currentOriginalTop:', currentOriginalTop, 'actualGap:', actualGap, 'index:', index);

      // Position delimiter just above current row - NO SHIFTING
      const delimiterTop = currentCurrentTop - 3; // 3px overlap to sit on the border

      // Check if there's already a delimiter at this position
      const delimiterKey = `delim-${delimiterTop}`;
      if (row.parentNode.querySelector(`[data-delimiter-key="${delimiterKey}"]`)) {
        console.log('[FastMail Delimiters] Delimiter already exists at', delimiterTop);
      } else {
        // Create and insert new divider
        const divider = document.createElement('div');
        divider.className = 'date-divider';
        divider.textContent = formatDateLabel(currentDate);
        divider.dataset.delimiterKey = delimiterKey;

        // Use absolute positioning like the email rows, but don't shift anything
        divider.style.position = 'absolute';
        divider.style.top = delimiterTop + 'px';
        divider.style.left = '0px';
        divider.style.right = '0px';
        divider.style.width = '100%';
        divider.style.zIndex = '10'; // Above emails but below selection

        row.parentNode.appendChild(divider);
        console.log('[FastMail Delimiters] Delimiter inserted at top:', delimiterTop);
      }
    }

    prevDate = currentDate;
    prevRow = row;

    // Mark this row as processed
    row.dataset.delimiterProcessed = 'true';
  });
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
    let additionCount = 0;
    let removalCount = 0;

    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList') {
        // Count added email rows
        mutation.addedNodes.forEach(function(node) {
          if (node.classList && node.classList.contains('v-MailboxItem')) {
            additionCount++;
          }
        });
        // Count removed email rows
        mutation.removedNodes.forEach(function(node) {
          if (node.classList && node.classList.contains('v-MailboxItem')) {
            removalCount++;
          }
        });
      }
    });

    // Check how many email rows remain
    const currentRowCount = document.querySelectorAll('li.v-MailboxItem').length;

    // Only clear delimiters if all (or almost all) rows were removed (folder switch)
    // Don't clear for partial removals (scrolling)
    if (removalCount > 0 && currentRowCount < 3) {
      const existingDelimiters = document.querySelectorAll('.date-divider');
      existingDelimiters.forEach(d => d.remove());
      console.log('[FastMail Delimiters] Cleared delimiters - all emails removed');
    }

    // If there were any changes (additions or removals), recalculate after delay
    if (additionCount > 0 || removalCount > 0) {
      setTimeout(addDelimiters, 300);
    }
  });

  const container = document.querySelector('body');
  if (container) {
    observer.observe(container, { childList: true, subtree: true });
  }
}
