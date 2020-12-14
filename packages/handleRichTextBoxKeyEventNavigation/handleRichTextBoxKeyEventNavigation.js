// Copyright 2017 Quip

const TAB = 9;
const ESCAPE = 27;

// Sync with quip/static/ts/src/core/a11y.ts
const TABBABLE_ELEMENT_SELECTOR = [
    "a[href]",
    "button",
    "[contenteditable]:not([contenteditable='false'])",
    "input",
    "select",
    "textarea",
]
    .map(
        tagName =>
            `${tagName}:not([disabled]):not([tabindex^='-'])` +
            `:not(.a11y-skip):not(.a11y-no-auto-focus)`
    )
    .concat([
        "[tabindex='0']:not([class*='a11y-hidden'])" +
            ":not([class*='a11y-no-auto-focus'])",
    ])
    .join(", ");

export default function (e, record) {
    let next;

    if (e.keyCode === TAB) {
        if (e.shiftKey) {
            next = findAdjcentFocusableElem_(record, true);
            if (!next) {
                next = record.getPreviousSibling();
            }
            if (!next) {
                const records = record.getContainingList().getRecords();
                next = records[records.length - 1];
            }
        } else {
            next = findAdjcentFocusableElem_(record, false);
            if (!next) {
                next = record.getNextSibling();
            }
            if (!next) {
                next = record.getContainingList().getRecords()[0];
            }
        }
    }

    if (next) {
        e.preventDefault();
        if (next.getRichTextRecord) {
            next = next.getRichTextRecord();
        }
        // Clear the focus of the record just in case it was focused before.
        if (next.clearFocus) {
            next.clearFocus();
        }
        next.focus();
        return true;
    }

    if (e.keyCode === ESCAPE) {
        for (var i = 0; i < e.path.length - 1; i++) {
            const node = e.path[i];
            const nextNode = e.path[i + 1];
            if (nextNode.id === "quip-element-root") {
                node.focus();
                return true;
            }
        }
    }
    return false;
}

// Depends on the implementation, there might be nested elements for a record's
// rich text box DOMNode. Therefore, we need to skip all elements contained in
// the current record's DOMNode to navigate to a focusable element outside the
// record
function findAdjcentFocusableElem_(record, findPrev) {
    const tabbableElems = [
        ...document.querySelectorAll(TABBABLE_ELEMENT_SELECTOR),
    ];
    const recordDom = record.getDom();
    if (!recordDom) {
        return null;
    }

    const recordElems = [
        ...recordDom.querySelectorAll(TABBABLE_ELEMENT_SELECTOR),
    ];

    const tabbableEls = findPrev ? tabbableElems : tabbableElems.reverse();

    for (let i = 0; i < tabbableEls.length; i++) {
        if (tabbableEls[i] === recordDom) {
            if (i > 0) {
                return tabbableEls[i - 1];
            }
        }
        if (recordElems.includes(tabbableEls[i])) {
            const recordEl = findPrev
                ? recordElems[0]
                : recordElems[recordElems.length - 1];
            const index = tabbableEls.findIndex(item => item === recordEl);
            if (index > 0) {
                return tabbableEls[index - 1];
            }
        }
    }

    return null;
}
