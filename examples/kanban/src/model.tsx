// Copyright 2017 Quip
// @ts-nocheck TODO(GASPAR) remove

import React from "react";
import quip from "quip-apps-api";
import quiptext from "quiptext";
import PropTypes from "prop-types";
import debounce from "lodash.debounce";

export const kDefaultColumnColors = [
    quip.apps.ui.ColorMap.RED.KEY,
    quip.apps.ui.ColorMap.YELLOW.KEY,
    quip.apps.ui.ColorMap.BLUE.KEY,
    quip.apps.ui.ColorMap.GREEN.KEY,
    quip.apps.ui.ColorMap.ORANGE.KEY,
    quip.apps.ui.ColorMap.VIOLET.KEY,
];

const ACTIVITY_LOG_MESSAGES = {
    // TODO translate with quiptext if we reenable.
    ADD_COLUMN: () => {
        return "added a column.";
    },
    REMOVE_COLUMN: columnText => {
        return `removed a column: "${columnText}".`;
    },
    ADD_CARD: () => {
        return "added a card.";
    },
    REMOVE_CARD: cardText => {
        return `removed a card: "${cardText}".`;
    },
    MOVE_CARD: (prevColumnName, nextColumnName) => {
        return `moved a card from "${prevColumnName}" to "${nextColumnName}".`;
    },
};

const newTitleText = quiptext("New Title");
const newCardText = quiptext("New Card");

export class BoardRecord extends quip.apps.RootRecord {
    static getProperties() {
        return {
            columns: quip.apps.RecordList.Type(ColumnRecord),
            // TODO(elsigh): why not just compute this?
            nextColumnColor: "string",
        };
    }

    static getDefaultProperties() {
        return {columns: []};
    }

    static DATA_VERSION = 2;

    initialize() {
        this.get("columns").listen(() => this.notifyListeners());
        this.listener = this.listen(this.setStatePayload_);
    }

    setStatePayload_ = debounce(() => {
        if (typeof quip.apps.setPayload === "function") {
            quip.apps.setPayload(this.getExportState());
        }
    }, 2000);

    getColumns() {
        return this.get("columns").getRecords();
    }

    addColumn(headerText) {
        const color = this.getNextColumnColor_();
        let index = this.get("columns").count();
        let newColumn = this.get("columns").add({color}, index);
        newColumn.addCard(true, headerText, 0);
        newColumn.addCard(false, "", 1);
        //quip.apps.sendMessage(ACTIVITY_LOG_MESSAGES.ADD_COLUMN());
        quip.apps.recordQuipMetric("add_column");
        return newColumn;
    }

    moveColumn(columnRecord, index) {
        this.get("columns").move(columnRecord, index);
        quip.apps.recordQuipMetric("move_column");
    }

    calculateHeight() {
        let height = 0;
        this.getColumns().forEach(column => {
            height = Math.max(column.calculateHeight(), height);
        });
        return height;
    }

    getNextColumnColor_() {
        const color = this.get("nextColumnColor") || kDefaultColumnColors[0];
        const index = kDefaultColumnColors.indexOf(color);
        const nextColor =
            index === kDefaultColumnColors.length - 1
                ? kDefaultColumnColors[0]
                : kDefaultColumnColors[index + 1];
        this.set("nextColumnColor", nextColor);
        return color;
    }

    getExportState(): String {
        let columns = this.getColumns().map(column => {
            return {
                color: column.getColor(),
                headerContent: column.getHeader().getTextContent(),
                cards: column
                    .getCards()
                    .filter(card => !card.isHeader())
                    .map(card => {
                        return {
                            "color": card.getColor(),
                            "content": card.getTextContent(),
                        };
                    }),
            };
        });
        return JSON.stringify({
            columns,
        });
    }

    populateColumns(columns: []): Array<ColumnRecord> {
        columns.forEach(column => {
            let newColumn = this.get("columns").add(
                {color: column.color},
                this.get("columns").count());
            newColumn.addCard(true, column.headerContent, 0);
            column.cards.forEach((card, index) => {
                newColumn.addCard(false, card.content, index + 1, card.color);
            });
        });

        quip.apps.recordQuipMetric("kanban_columns_populated");
        return this.get("columns");
    }
}

export class ColumnRecord extends quip.apps.Record {
    static getProperties() {
        return {
            color: "string",
            cards: quip.apps.RecordList.Type(CardRecord),
        };
    }

    static getDefaultProperties() {
        return {cards: []};
    }

    initialize() {
        const listener = quip.apps
            .getRootRecord()
            .notifyListeners.bind(quip.apps.getRootRecord());
        this.listen(listener);
        this.get("cards").listen(listener);
    }

    getColor() {
        return this.get("color");
    }

    setColor(color) {
        quip.apps.recordQuipMetric("set_color");
        this.set("color", color);
    }

    getCards() {
        return this.get("cards").getRecords();
    }

    getHeader() {
        const cards = this.getCards();
        return cards.length > 0 ? cards[0] : null;
    }

    getFirstCard() {
        const cards = this.getCards();
        return cards.length ? cards[0] : null;
    }

    getLastCard() {
        const cards = this.getCards();
        return cards.length ? cards[cards.length - 1] : null;
    }

    addCard(isHeader, defaultText, index, color) {
        let defaultPlaceholderText = isHeader ? newTitleText : newCardText;
        quip.apps.recordQuipMetric("add_card");
        return this.get("cards").add(
            {
                isHeader,
                color,
                RichText_defaultText: defaultText ? defaultText : null,
                RichText_placeholderText: !defaultText
                    ? defaultPlaceholderText
                    : null,
            },
            index);
    }

    insertCard(cardRecord, index) {
        const prevColumnName = cardRecord
            .getColumn()
            .getHeader()
            .getTextContent()
            .trim();
        this.get("cards").move(cardRecord, index);
        const nextColumnName = cardRecord
            .getColumn()
            .getHeader()
            .getTextContent()
            .trim();
        //quip.apps.sendMessage(
        //    ACTIVITY_LOG_MESSAGES.MOVE_CARD(prevColumnName, nextColumnName),
        //);
        quip.apps.recordQuipMetric("move_card");
    }

    moveCard(cardRecord, index) {
        this.get("cards").move(cardRecord, index);
    }

    calculateHeight() {
        let height = 0;
        this.getCards().forEach(card => {
            height += card.getHeight();
        });
        return height;
    }

    deleteColumn() {
        /*quip.apps.sendMessage(
            ACTIVITY_LOG_MESSAGES.REMOVE_COLUMN(
                this.getHeader()
                    .getTextContent()
                    .trim(),
            ),
        );*/
        super.delete();
        quip.apps.recordQuipMetric("delete_column");
    }

    getNextColumn() {
        return this.getNextSibling();
    }

    getPreviousColumn() {
        return this.getPreviousSibling();
    }
}
ColumnRecord.CONSTRUCTOR_KEY = "kanban-column";

export class CardRecord extends quip.apps.RichTextRecord {
    static getProperties() {
        return {
            isHeader: "boolean",
            color: "string",
        };
    }

    initialize() {
        this.height = 0;
        this.domNode = undefined;
        this.commentsListener = this.listenToComments(this.notifyParent);
        this.contentListener = this.listenToContent(this.notifyParent);
    }

    notifyParent = () => {
        this.getParentRecord().notifyListeners();
    };

    getDom() {
        return this.domNode;
    }

    supportsComments() {
        return !this.isHeader();
    }

    isHeader() {
        return this.get("isHeader");
    }

    getColor() {
        return this.isHeader()
            ? undefined
            : this.getIntrinsicColor() || this.getParentRecord().getColor();
    }

    getIntrinsicColor() {
        return this.get("color");
    }

    setColor(color) {
        if (!this.isHeader()) {
            this.set("color", color);
        }
    }

    clearColor() {
        this.setColor(undefined);
    }

    getColumn() {
        return this.getParentRecord();
    }

    getHeight() {
        if (this.isHeader()) {
            // All headers should match the height of the tallest header.
            const headers = quip.apps
                .getRootRecord()
                .getColumns()
                .map(column => column.getHeader());
            return headers
                .map(header => (header ? header.height : 0))
                .reduce((height1, height2) => Math.max(height1, height2));
        } else {
            return this.height;
        }
    }

    setHeight(height) {
        this.height = height;
    }

    deleteCard() {
        /*quip.apps.sendMessage(
            ACTIVITY_LOG_MESSAGES.REMOVE_CARD(this.getTextContent().trim()),
        );*/
        if (this.commentsListener) {
            this.unlistenToComments(this.notifyParent);
        }
        if (this.contentListener) {
            this.unlistenToContent(this.notifyParent);
        }
        super.delete();
        quip.apps.recordQuipMetric("delete_card");
    }

    getPreviousSibling() {
        let prev = super.getPreviousSibling();
        if (!prev) {
            const previousColumn = this.getColumn().getPreviousSibling();
            if (previousColumn) {
                prev = previousColumn.getLastCard();
            }
            if (!prev) {
                const cols = this.getColumn().getContainingList().getRecords();
                prev = cols[cols.length - 1].getLastCard();
            }
        }
        while (prev && prev.isHeader()) {
            prev = prev.getPreviousSibling();
        }
        return prev;
    }

    getNextSibling() {
        let next = super.getNextSibling();
        if (!next) {
            const nextColumn = this.getColumn().getNextSibling();
            if (nextColumn) {
                next = nextColumn.getHeader().getNextSibling();
            }
            if (!next) {
                next = this.getColumn()
                    .getContainingList()
                    .getRecords()[0]
                    .getFirstCard();
            }
        }
        while (next && next.isHeader()) {
            next = next.getNextSibling();
        }
        return next;
    }
}
CardRecord.CONSTRUCTOR_KEY = "kanban-card";

export function entityListener(WrappedComponent) {
    return class RecordListenerComponent extends React.Component {
        static propTypes = {
            entity: PropTypes.instanceOf(quip.apps.Record),
        };

        componentDidMount() {
            this.props.entity.listen(this.onRecordChange_);
        }

        componentWillUnmount() {
            this.props.entity.unlisten(this.onRecordChange_);
        }

        render() {
            return <WrappedComponent {...this.props}/>;
        }

        onRecordChange_ = () => {
            this.forceUpdate();
        };
    };
}
