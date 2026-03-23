// content/page-scanner.js
// Proactive continuous scanning for dark patterns, code blocks, etc.

const DARK_PATTERN_KEYWORDS = [
    'only %d left in stock',
    'offer expires in',
    'other people are looking at this',
    'by continuing, you agree to our terms and to recurring payments'
];

function scanForPatterns() {
    const textNodes = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    let warningCount = 0;
    
    while ((node = textNodes.nextNode())) {
        const text = node.nodeValue.toLowerCase();
        for (const kw of DARK_PATTERN_KEYWORDS) {
            // Very naive check for "timer/countdown/scarcity" patterns
            if (kw.includes('%d') ? text.match(/only \d+ left/i) : text.includes(kw)) {
                warningCount++;
                // Add visual marker
                if (node.parentElement && !node.parentElement.classList.contains('potts-scam-alert')) {
                    node.parentElement.style.borderBottom = '2px dashed #ffc107';
                    node.parentElement.title = "POTTS: Potential Dark Pattern/Scarcity Tactic";
                    node.parentElement.classList.add('potts-scam-alert');
                }
            }
        }
    }
    return warningCount;
}

// Code Review Mode: detects <pre> / <code> blocks
function highlightCodeBlocks() {
    const blocks = document.querySelectorAll('pre, code');
    blocks.forEach(b => {
        // Only target larger blocks
        if (b.innerText.length > 50 && !b.classList.contains('potts-code-highlight')) {
             b.classList.add('potts-code-highlight');
             // Could add click-to-review button attached to element
        }
    });
}

// Initial observer
const scannerObserver = new MutationObserver(() => {
    // Debounce scanning so we don't kill performance
    clearTimeout(window.pottsScanTimer);
    window.pottsScanTimer = setTimeout(() => {
        scanForPatterns();
        highlightCodeBlocks();
    }, 1000);
});

if (document.body) {
    scannerObserver.observe(document.body, { childList: true, subtree: true });
}
