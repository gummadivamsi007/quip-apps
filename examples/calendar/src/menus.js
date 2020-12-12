/* @flow */
// Copyright 2017 Quip

// $FlowIssueQuipModule
import quip from "quip";
import isEqual from "date-fns/isEqual";
import {localizedColorLabel} from "quip-apps-compat";

import {EventRecord, colors} from "./model";

let selectedEvent: EventRecord;

let displayMonth: Date;
export function setMenuDisplayMonth(d: Date) {
    displayMonth = d;
    refreshToolbar();
}

export function allMenuCommands() {
    return [
        {
            id: "set-display-month",
            label: quiptext("Set Default Month"),
            handler: () => {
                quip.apps.getRootRecord().setDisplayMonth(displayMonth);
                refreshToolbar();
            },
        },
        {
            id: "delete-event",
            label: quiptext("Delete"),
            handler: () => {
                selectedEvent.delete();
            },
        },
        {
            id: "comment",
            label: quiptext("Comment"),
            handler: () => {
                quip.apps.showComments(selectedEvent.id());
            },
        },
        ...colors.map(color => ({
            id: color,
            label: localizedColorLabel(color),
            handler: () => {
                selectedEvent.setColor(color);
                refreshToolbar();
            },
        })),
    ];
}

export function refreshToolbar() {
    quip.apps.updateToolbar({
        menuCommands: allMenuCommands(),
        toolbarCommandIds: getToolbarComandIds(),
        disabledCommands: getDisabledCommands(),
        highlightedCommands: getHighlightedCommands(),
    });
}

export function showEventContextMenu(
    e: Event,
    eventRecord: EventRecord,
    onDismiss: Function
) {
    selectedEvent = eventRecord;

    const commands = [...colors, quip.apps.DocumentMenuCommands.SEPARATOR];
    if (quip.apps.viewerCanSeeComments()) {
        commands.push("comment");
    }
    commands.push("delete-event");

    quip.apps.showContextMenuFromButton(
        e,
        commands,
        getHighlightedCommands(),
        [],
        onDismiss);
}

function getHighlightedCommands() {
    if (!selectedEvent) {
        return [];
    } else {
        return [selectedEvent.getColor()];
    }
}

function getDisabledCommands() {
    let disabledCommandIds = [];
    return disabledCommandIds;
}

function getToolbarComandIds() {
    let toolbarCommandIds = [];
    const rootRecordDate = quip.apps.getRootRecord().getDisplayMonth();
    if (displayMonth.getFullYear() !== rootRecordDate.getFullYear() ||
        displayMonth.getMonth() !== rootRecordDate.getMonth()) {
        toolbarCommandIds.push("set-display-month");
    }
    return toolbarCommandIds;
}
