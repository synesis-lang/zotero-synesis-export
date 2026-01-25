/*
 * Synesis Export - Main Script
 *
 * Exports PDF annotations from Zotero to Synesis format
 * for qualitative research analysis.
 *
 * License: MIT
 */

SynesisExport = {
    id: null,
    version: null,
    rootURI: null,

    // Menu item IDs for cleanup
    menuItemId: "synesis-export-menuitem",
    menuItemIdSingle: "synesis-export-menuitem-single",
    menuItemIdCollection: "synesis-export-collection-menuitem",
    menuItemIdTools: "synesis-export-tools-menuitem",
    menuItemIdToolsCollection: "synesis-export-tools-collection-menuitem",
    menuItemIdPrefs: "synesis-export-prefs-menuitem",

    // Preference keys
    PREF_BRANCH: "extensions.synesis-export.",
    PREF_QUOTATION_FIELD: "fieldName.quotation",
    PREF_MEMO_FIELD: "fieldName.memo",
    PREF_CODE_FIELD: "fieldName.code",

    // Default field names
    defaults: {
        quotation: "QUOTATION",
        memo: "MEMO",
        code: "CODE"
    },

    init: function({ id, version, rootURI }) {
        this.id = id;
        this.version = version;
        this.rootURI = rootURI;

        // Initialize preferences with defaults
        this.initPreferences();
    },

    log: function(msg) {
        Zotero.debug("Synesis Export: " + msg);
    },

    getDialogWindow: function(preferredWindow) {
        if (preferredWindow && preferredWindow.document) {
            return preferredWindow;
        }
        if (Zotero.getMainWindow) {
            let mainWindow = Zotero.getMainWindow();
            if (mainWindow) return mainWindow;
        }
        let windows = Zotero.getMainWindows && Zotero.getMainWindows();
        if (windows && windows.length) return windows[0];
        if (typeof Services !== "undefined" && Services.wm) {
            let mostRecent = Services.wm.getMostRecentWindow("Zotero:Main") ||
                Services.wm.getMostRecentWindow("navigator:browser") ||
                Services.wm.getMostRecentWindow(null);
            if (mostRecent) return mostRecent;
        }
        return preferredWindow || null;
    },

    showAlert: function(window, message) {
        let dialogWindow = this.getDialogWindow(window);
        if (dialogWindow && typeof dialogWindow.alert === "function") {
            dialogWindow.alert(message);
            return;
        }
        if (typeof Services !== "undefined" && Services.prompt) {
            try {
                Services.prompt.alert(dialogWindow, "Synesis Export", message);
                return;
            } catch (e) {
                this.log("Prompt alert failed: " + e);
            }
        }
        this.log(message);
    },

    isAbsolutePath: function(filePath) {
        if (!filePath || typeof filePath !== "string") return false;
        if (/^[a-zA-Z]:[\\/]/.test(filePath)) return true;
        if (filePath.startsWith("\\\\")) return true;
        if (filePath.startsWith("/")) return true;
        return false;
    },

    joinPath: function(basePath, leafName) {
        if (!basePath) return leafName;
        let sep = basePath.indexOf("\\") !== -1 ? "\\" : "/";
        if (basePath.endsWith("/") || basePath.endsWith("\\")) {
            return basePath + leafName;
        }
        return basePath + sep + leafName;
    },

    getDefaultExportDir: function() {
        if (typeof Services === "undefined" || !Services.dirsvc) return null;
        if (typeof Components === "undefined" || !Components.interfaces) return null;
        let dirs = ["Desk", "Home", "ProfD"];
        for (let key of dirs) {
            try {
                let dir = Services.dirsvc.get(key, Components.interfaces.nsIFile);
                if (dir && dir.path) return dir.path;
            } catch (e) {
                this.log("Dir lookup failed: " + key + " " + e);
            }
        }
        return null;
    },

    getCollectionMenu: function(doc) {
        let ids = [
            "zotero-collectionmenu",
            "zotero-collectionmenu-popup",
            "collectionmenu",
            "collection-menu"
        ];
        for (let id of ids) {
            let menu = doc.getElementById(id);
            if (menu) return menu;
        }
        return null;
    },

    getSelectedCollection: function(window) {
        if (!window || !window.ZoteroPane) return null;
        let zoteroPane = window.ZoteroPane;
        if (typeof zoteroPane.getSelectedCollection === "function") {
            return zoteroPane.getSelectedCollection();
        }
        if (zoteroPane.collectionsView && typeof zoteroPane.collectionsView.getSelectedCollection === "function") {
            return zoteroPane.collectionsView.getSelectedCollection();
        }
        return null;
    },

    normalizeItems: async function(items) {
        if (!items || !Array.isArray(items) || items.length === 0) return [];
        if (typeof items[0] === "number") {
            let resolved = [];
            for (let itemID of items) {
                try {
                    let item = await Zotero.Items.getAsync(itemID);
                    if (item) resolved.push(item);
                } catch (e) {
                    this.log("Failed to load item " + itemID + ": " + e);
                }
            }
            return resolved;
        }
        return items;
    },

    getItemsFromCollection: async function(collection) {
        if (!collection) return [];
        let items = [];
        if (typeof collection.getChildItems === "function") {
            let childItems = collection.getChildItems();
            if (childItems && typeof childItems.then === "function") {
                childItems = await childItems;
            }
            items = await this.normalizeItems(childItems);
        }
        if ((!items || items.length === 0) && Zotero.Items.getByCollection && collection.id) {
            let byCollection = Zotero.Items.getByCollection(collection.id);
            if (byCollection && typeof byCollection.then === "function") {
                byCollection = await byCollection;
            }
            items = await this.normalizeItems(byCollection);
        }
        return items;
    },

    /**
     * Initialize preferences with default values if not set
     */
    initPreferences: function() {
        // Set defaults if preferences don't exist
        if (!Zotero.Prefs.get(this.PREF_BRANCH + this.PREF_QUOTATION_FIELD, true)) {
            Zotero.Prefs.set(this.PREF_BRANCH + this.PREF_QUOTATION_FIELD, this.defaults.quotation, true);
        }
        if (!Zotero.Prefs.get(this.PREF_BRANCH + this.PREF_MEMO_FIELD, true)) {
            Zotero.Prefs.set(this.PREF_BRANCH + this.PREF_MEMO_FIELD, this.defaults.memo, true);
        }
        if (!Zotero.Prefs.get(this.PREF_BRANCH + this.PREF_CODE_FIELD, true)) {
            Zotero.Prefs.set(this.PREF_BRANCH + this.PREF_CODE_FIELD, this.defaults.code, true);
        }
    },

    /**
     * Get current field names from preferences
     */
    getFieldNames: function() {
        return {
            quotation: Zotero.Prefs.get(this.PREF_BRANCH + this.PREF_QUOTATION_FIELD, true) || this.defaults.quotation,
            memo: Zotero.Prefs.get(this.PREF_BRANCH + this.PREF_MEMO_FIELD, true) || this.defaults.memo,
            code: Zotero.Prefs.get(this.PREF_BRANCH + this.PREF_CODE_FIELD, true) || this.defaults.code
        };
    },

    /**
     * Save field names to preferences
     */
    setFieldNames: function(quotation, memo, code) {
        Zotero.Prefs.set(this.PREF_BRANCH + this.PREF_QUOTATION_FIELD, quotation, true);
        Zotero.Prefs.set(this.PREF_BRANCH + this.PREF_MEMO_FIELD, memo, true);
        Zotero.Prefs.set(this.PREF_BRANCH + this.PREF_CODE_FIELD, code, true);
    },

    addToAllWindows: function() {
        var windows = Zotero.getMainWindows();
        for (let win of windows) {
            if (!win.ZoteroPane) continue;
            this.addToWindow(win);
        }
    },

    removeFromAllWindows: function() {
        var windows = Zotero.getMainWindows();
        for (let win of windows) {
            if (!win.ZoteroPane) continue;
            this.removeFromWindow(win);
        }
    },

    addToWindow: function(window) {
        let doc = window.document;

        // Add menu item to item context menu (right-click on items)
        let itemMenu = doc.getElementById("zotero-itemmenu");
        if (itemMenu) {
            if (!doc.getElementById(this.menuItemIdSingle)) {
                let menuItemSingle = doc.createXULElement("menuitem");
                menuItemSingle.id = this.menuItemIdSingle;
                menuItemSingle.setAttribute("label", "Export This Item to Synesis...");
                menuItemSingle.addEventListener("command", () => {
                    this.exportSingleItem(window);
                });
                itemMenu.appendChild(menuItemSingle);
            }
            if (!doc.getElementById(this.menuItemId)) {
                let menuItem = doc.createXULElement("menuitem");
                menuItem.id = this.menuItemId;
                menuItem.setAttribute("label", "Export Selected Items to Synesis...");
                menuItem.addEventListener("command", () => {
                    this.exportSelectedItems(window);
                });
                itemMenu.appendChild(menuItem);
            }
        }

        // Add menu item to collection context menu (right-click on collections)
        let collectionMenu = this.getCollectionMenu(doc);
        if (collectionMenu && !doc.getElementById(this.menuItemIdCollection)) {
            let menuItemCollection = doc.createXULElement("menuitem");
            menuItemCollection.id = this.menuItemIdCollection;
            menuItemCollection.setAttribute("label", "Export This Collection to Synesis...");
            menuItemCollection.addEventListener("command", () => {
                this.exportSelectedCollection(window);
            });
            collectionMenu.appendChild(menuItemCollection);
        }

        // Add menu items to Tools menu
        let toolsMenu = doc.getElementById("menu_ToolsPopup");
        if (toolsMenu) {
            if (!doc.getElementById(this.menuItemIdTools + "-separator")) {
                let separator = doc.createXULElement("menuseparator");
                separator.id = this.menuItemIdTools + "-separator";
                toolsMenu.appendChild(separator);
            }

            if (!doc.getElementById(this.menuItemIdToolsCollection)) {
                let menuItemCollection = doc.createXULElement("menuitem");
                menuItemCollection.id = this.menuItemIdToolsCollection;
                menuItemCollection.setAttribute("label", "Export Selected Collection to Synesis...");
                menuItemCollection.addEventListener("command", () => {
                    this.exportSelectedCollection(window);
                });
                toolsMenu.appendChild(menuItemCollection);
            }

            if (!doc.getElementById(this.menuItemIdTools)) {
                let menuItem = doc.createXULElement("menuitem");
                menuItem.id = this.menuItemIdTools;
                menuItem.setAttribute("label", "Export All Annotations to Synesis...");
                menuItem.addEventListener("command", () => {
                    this.exportAllAnnotations(window);
                });
                toolsMenu.appendChild(menuItem);
            }

            // Add preferences menu item
            if (!doc.getElementById(this.menuItemIdPrefs)) {
                let prefsItem = doc.createXULElement("menuitem");
                prefsItem.id = this.menuItemIdPrefs;
                prefsItem.setAttribute("label", "Synesis Export Preferences...");
                prefsItem.addEventListener("command", () => {
                    this.openPreferencesDialog(window);
                });
                toolsMenu.appendChild(prefsItem);
            }
        }

        this.log("Added menu items to window");
    },

    removeFromWindow: function(window) {
        let doc = window.document;

        // Remove context menu item
        let menuItem = doc.getElementById(this.menuItemId);
        if (menuItem) {
            menuItem.remove();
        }
        let menuItemSingle = doc.getElementById(this.menuItemIdSingle);
        if (menuItemSingle) {
            menuItemSingle.remove();
        }
        let menuItemCollection = doc.getElementById(this.menuItemIdCollection);
        if (menuItemCollection) {
            menuItemCollection.remove();
        }

        // Remove tools menu items
        let separator = doc.getElementById(this.menuItemIdTools + "-separator");
        if (separator) {
            separator.remove();
        }

        let toolsMenuItemCollection = doc.getElementById(this.menuItemIdToolsCollection);
        if (toolsMenuItemCollection) {
            toolsMenuItemCollection.remove();
        }

        let toolsMenuItem = doc.getElementById(this.menuItemIdTools);
        if (toolsMenuItem) {
            toolsMenuItem.remove();
        }

        let prefsMenuItem = doc.getElementById(this.menuItemIdPrefs);
        if (prefsMenuItem) {
            prefsMenuItem.remove();
        }

        this.log("Removed menu items from window");
    },

    /**
     * Open preferences dialog
     */
    openPreferencesDialog: function(window) {
        try {
            let fields = this.getFieldNames();
            let dialogWindow = this.getDialogWindow(window);
            let promptService = null;

            if (typeof Services !== "undefined" && Services.prompt) {
                promptService = Services.prompt;
            } else if (typeof Components !== "undefined" && Components.classes && Components.interfaces) {
                let promptClass = Components.classes["@mozilla.org/embedcomp/prompt-service;1"];
                if (promptClass) {
                    promptService = promptClass.getService(Components.interfaces.nsIPromptService);
                }
            }

            let promptValue = (label, defaultValue) => {
                if (dialogWindow && typeof dialogWindow.prompt === "function") {
                    let response = dialogWindow.prompt(label, defaultValue);
                    if (response === null) return { cancelled: true };
                    return { cancelled: false, value: response.trim() };
                }
                if (promptService) {
                    let input = { value: defaultValue };
                    let ok = promptService.prompt(
                        dialogWindow,
                        "Synesis Export Preferences",
                        label,
                        input,
                        null,
                        { value: false }
                    );
                    if (!ok) return { cancelled: true };
                    return { cancelled: false, value: (input.value || "").trim() };
                }
                return { cancelled: true, error: "Prompt service not available." };
            };

            let quotationPrompt = promptValue("Quotation field (highlighted text):", fields.quotation);
            if (quotationPrompt.cancelled) {
                if (quotationPrompt.error) {
                    this.showAlert(dialogWindow, quotationPrompt.error);
                }
                return;
            }

            let memoPrompt = promptValue("Memo field (user comments):", fields.memo);
            if (memoPrompt.cancelled) return;

            let codePrompt = promptValue("Code field (tags):", fields.code);
            if (codePrompt.cancelled) return;

            let quotation = quotationPrompt.value || this.defaults.quotation;
            let memo = memoPrompt.value || this.defaults.memo;
            let code = codePrompt.value || this.defaults.code;

            this.setFieldNames(quotation, memo, code);

            this.showAlert(
                dialogWindow,
                "Preferences saved!\n\n" +
                "Quotation field: " + quotation + "\n" +
                "Memo field: " + memo + "\n" +
                "Code field: " + code
            );
        } catch (e) {
            this.log("Error opening preferences: " + e);
            this.showAlert(window, "Error opening preferences: " + e.message);
        }
    },

    /**
     * Export annotations from selected items
     */
    exportSelectedItems: async function(window) {
        let zoteroPane = window.ZoteroPane;
        let items = zoteroPane.getSelectedItems();

        if (!items || items.length === 0) {
            this.showAlert(window, "Please select one or more items to export.");
            return;
        }

        await this.exportItemsToFile(window, items, "No annotations found in selected items.");
    },

    /**
     * Export annotations from a single selected item
     */
    exportSingleItem: async function(window) {
        let zoteroPane = window.ZoteroPane;
        let items = zoteroPane.getSelectedItems();

        if (!items || items.length !== 1) {
            this.showAlert(window, "Please select exactly one item to export.");
            return;
        }

        await this.exportItemsToFile(window, [items[0]], "No annotations found in selected item.");
    },

    /**
     * Export all annotations from library
     */
    exportAllAnnotations: async function(window) {
        try {
            // Get all regular items from the library
            let libraryID = Zotero.Libraries.userLibraryID;
            let items = await Zotero.Items.getAll(libraryID, false, false);

            // Filter to only regular items (not notes, attachments)
            items = items.filter(item => item.isRegularItem());

            if (!items || items.length === 0) {
                this.showAlert(window, "No items found in library.");
                return;
            }

            await this.exportItemsToFile(window, items, "No annotations found in library.");

        } catch (e) {
            this.log("Error exporting all: " + e);
            this.showAlert(window, "Error exporting annotations: " + e.message);
        }
    },

    /**
     * Export annotations from selected collection
     */
    exportSelectedCollection: async function(window) {
        let collection = this.getSelectedCollection(window);
        if (!collection) {
            this.showAlert(window, "Please select a collection to export.");
            return;
        }

        try {
            let items = await this.getItemsFromCollection(collection);

            if (!items || items.length === 0) {
                this.showAlert(window, "No items found in selected collection.");
                return;
            }

            await this.exportItemsToFile(window, items, "No annotations found in selected collection.");
        } catch (e) {
            this.log("Error exporting collection: " + e);
            this.showAlert(window, "Error exporting annotations: " + e.message);
        }
    },

    exportItemsToFile: async function(window, items, emptyMessage) {
        try {
            let output = await this.generateSynesisOutput(items);

            if (!output || output.trim() === "") {
                this.showAlert(window, emptyMessage);
                return;
            }

            await this.saveToFile(window, output);
        } catch (e) {
            this.log("Error exporting: " + e);
            this.showAlert(window, "Error exporting annotations: " + e.message);
        }
    },

    /**
     * Generate Synesis formatted output from items
     */
    generateSynesisOutput: async function(items) {
        let output = "";
        let processedSources = new Set();
        let fields = this.getFieldNames();

        for (let item of items) {
            // Skip non-regular items
            if (!item.isRegularItem()) continue;

            // Generate citekey
            let citekey = this.generateCitekey(item);

            // Get all PDF attachments
            let attachmentIDs = item.getAttachments();

            for (let attID of attachmentIDs) {
                let attachment = await Zotero.Items.getAsync(attID);

                // Check if it's a PDF
                if (!attachment || !attachment.isPDFAttachment()) continue;

                // Get annotations for this PDF
                let annotations = attachment.getAnnotations();

                if (!annotations || annotations.length === 0) continue;

                // Add SOURCE block if not already added
                if (!processedSources.has(citekey)) {
                    output += this.generateSourceBlock(citekey);
                    processedSources.add(citekey);
                }

                // Process each annotation
                for (let annotation of annotations) {
                    // Only process highlight annotations
                    if (annotation.annotationType !== "highlight") continue;

                    output += this.generateItemBlock(citekey, annotation, fields);
                }
            }
        }

        return output;
    },

    /**
     * Generate citekey in format authorYear (e.g., aly2019)
     */
    generateCitekey: function(item) {
        let author = "";
        let year = "";

        // Get first author's last name
        let creators = item.getCreators();
        if (creators && creators.length > 0) {
            let firstCreator = creators[0];
            if (firstCreator.lastName) {
                author = firstCreator.lastName.toLowerCase();
            } else if (firstCreator.name) {
                // Corporate author - use first word
                author = firstCreator.name.split(/\s+/)[0].toLowerCase();
            }
        }

        // Get year from date
        let date = item.getField("date");
        if (date) {
            let yearMatch = date.match(/\d{4}/);
            if (yearMatch) {
                year = yearMatch[0];
            }
        }

        // Clean author name - remove non-alphanumeric
        author = author.replace(/[^a-z]/g, "");

        // Fallback to item key if no author/year
        if (!author && !year) {
            return item.key.toLowerCase();
        }

        return author + year;
    },

    /**
     * Generate SOURCE block
     */
    generateSourceBlock: function(citekey) {
        return "SOURCE @" + citekey + "\nEND SOURCE\n\n";
    },

    /**
     * Generate ITEM block for an annotation
     */
    generateItemBlock: function(citekey, annotation, fields) {
        let block = "ITEM @" + citekey + "\n";

        // quotation field - the highlighted text (required)
        let text = annotation.annotationText || "";
        text = this.cleanText(text);

        if (text) {
            block += "    " + fields.quotation + ": " + text + "\n";
        }

        // memo field - user's comment (optional)
        let comment = annotation.annotationComment || "";
        comment = this.cleanText(comment);

        if (comment) {
            block += "    " + fields.memo + ": " + comment + "\n";
        }

        // code fields - tags (optional, one per line)
        let tags = annotation.getTags();
        if (tags && tags.length > 0) {
            for (let tag of tags) {
                let tagName = tag.tag || "";
                tagName = this.cleanTagName(tagName);

                if (tagName) {
                    block += "    " + fields.code + ": " + tagName + "\n";
                }
            }
        }

        block += "END ITEM\n\n";
        return block;
    },

    /**
     * Clean text - remove HTML, normalize whitespace
     */
    cleanText: function(text) {
        if (!text) return "";

        // Remove HTML tags
        text = text.replace(/<[^>]*>/g, "");

        // Convert HTML entities
        text = text.replace(/&nbsp;/g, " ");
        text = text.replace(/&amp;/g, "&");
        text = text.replace(/&lt;/g, "<");
        text = text.replace(/&gt;/g, ">");
        text = text.replace(/&quot;/g, '"');
        text = text.replace(/&#39;/g, "'");

        // Normalize whitespace - replace newlines and multiple spaces
        text = text.replace(/[\r\n]+/g, " ");
        text = text.replace(/\s+/g, " ");

        // Trim
        text = text.trim();

        return text;
    },

    /**
     * Clean tag name for use as code
     * Preserves accented characters (Portuguese, Spanish, etc.)
     */
    cleanTagName: function(tag) {
        if (!tag) return "";

        // Trim
        tag = tag.trim();

        // Replace spaces with underscores
        tag = tag.replace(/\s+/g, "_");

        // Convert to lowercase (works with Unicode)
        tag = tag.toLowerCase();

        // Remove multiple underscores
        tag = tag.replace(/_+/g, "_");

        // Remove leading/trailing underscores
        tag = tag.replace(/^_+|_+$/g, "");

        return tag;
    },

    /**
     * Save output to file using file picker
     */
    saveToFile: async function(window, content) {
        let dialogWindow = this.getDialogWindow(window);
        if (!dialogWindow || !dialogWindow.document) {
            this.showAlert(window, "No dialog window available for file picker.");
            return;
        }
        let filePath = null;

        let filePickerClass = Zotero.FilePicker;
        if (!filePickerClass && dialogWindow.Zotero && dialogWindow.Zotero.FilePicker) {
            filePickerClass = dialogWindow.Zotero.FilePicker;
        }

        if (filePickerClass) {
            try {
                let fp = new filePickerClass();
                fp.init(dialogWindow, "Save Synesis Export", fp.modeSave);
                fp.appendFilter("Synesis Files", "*.syn");
                fp.appendFilter("All Files", "*.*");
                fp.defaultExtension = "syn";
                fp.defaultString = "annotations.syn";

                let result = fp.show();
                if (result && typeof result.then === "function") {
                    result = await result;
                }

                if (result === fp.returnOK || result === fp.returnReplace) {
                    let pickedFile = fp.file || fp.filePath;
                    if (typeof pickedFile === "string") {
                        filePath = pickedFile;
                    } else if (pickedFile && pickedFile.path) {
                        filePath = pickedFile.path;
                    }
                }
            } catch (e) {
                this.log("FilePicker error: " + e);
            }
        } else if (typeof Components !== "undefined" && Components.classes && Components.interfaces) {
            try {
                let fp = Components.classes["@mozilla.org/filepicker;1"]
                    .createInstance(Components.interfaces.nsIFilePicker);
                fp.init(dialogWindow, "Save Synesis Export", Components.interfaces.nsIFilePicker.modeSave);
                fp.appendFilter("Synesis Files", "*.syn");
                fp.appendFilter("All Files", "*.*");
                fp.defaultExtension = "syn";
                fp.defaultString = "annotations.syn";

                let result = await new Promise(resolve => {
                    fp.open(resolve);
                });

                if (result === Components.interfaces.nsIFilePicker.returnOK ||
                    result === Components.interfaces.nsIFilePicker.returnReplace) {
                    let pickedFile = fp.file || fp.filePath;
                    if (typeof pickedFile === "string") {
                        filePath = pickedFile;
                    } else if (pickedFile && pickedFile.path) {
                        filePath = pickedFile.path;
                    }
                }
            } catch (e) {
                this.log("nsIFilePicker error: " + e);
            }
        }

        if (!filePath && dialogWindow && typeof dialogWindow.prompt === "function") {
            let defaultDir = this.getDefaultExportDir();
            let defaultPath = defaultDir ? this.joinPath(defaultDir, "annotations.syn") : "annotations.syn";
            let manualPath = dialogWindow.prompt("Save Synesis Export as:", defaultPath);
            if (manualPath) {
                filePath = manualPath;
            }
        }

        if (!filePath) return;
        if (!this.isAbsolutePath(filePath)) {
            let defaultDir = this.getDefaultExportDir();
            if (defaultDir) {
                filePath = this.joinPath(defaultDir, filePath);
            } else {
                this.showAlert(dialogWindow, "Please provide a full path for the export file.");
                return;
            }
        }

        // Write to file
        await Zotero.File.putContentsAsync(filePath, content);

        this.log("Exported to: " + filePath);

        // Show success message
        let filename = filePath.split(/[\/\\]/).pop();
        this.showAlert(dialogWindow, "Annotations exported successfully to:\n" + filename);
    }
};
