/*
 * Synesis Export Plugin for Zotero 7
 * Exports PDF annotations to Synesis format for qualitative research
 *
 * License: MIT
 */

var Services;
try {
    if (ChromeUtils.importESModule) {
        ({ Services } = ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs"));
    } else {
        ({ Services } = ChromeUtils.import("resource://gre/modules/Services.jsm"));
    }
} catch (e) {
    Services = globalThis.Services;
}
var SynesisExport;

function log(msg) {
    Zotero.debug("Synesis Export: " + msg);
}

async function startup({ id, version, resourceURI, rootURI = resourceURI.spec }) {
    log("Starting up version " + version);

    // Wait for Zotero to be ready
    await Zotero.initializationPromise;
    // Wait for UI to be ready so menus exist
    if (Zotero.uiReadyPromise) {
        await Zotero.uiReadyPromise;
    }

    // Store rootURI for later use
    if (Services && Services.scriptloader) {
        Services.scriptloader.loadSubScript(rootURI + "content/synesis-export.js", globalThis);
    } else if (Zotero && Zotero.loadSubScript) {
        Zotero.loadSubScript(rootURI + "content/synesis-export.js");
    } else {
        throw new Error("No subscript loader available");
    }

    SynesisExport.init({ id, version, rootURI });
    if (Zotero.PreferencePanes && typeof Zotero.PreferencePanes.register === "function") {
        try {
            SynesisExport.prefPaneID = await Zotero.PreferencePanes.register({
                pluginID: id,
                id: "synesis-export-preferences-pane",
                label: "Synesis Export",
                src: "content/preferences.xhtml"
            });
            log("Registered preferences pane: " + SynesisExport.prefPaneID);
        } catch (e) {
            log("Failed to register preferences pane: " + e);
        }
    }
    SynesisExport.addToAllWindows();

    // Register window listener for new windows
    if (Zotero.addMainWindowListener) {
        await Zotero.addMainWindowListener({
            onMainWindowLoad: async ({ window }) => {
                if (window.Zotero && window.Zotero.uiReadyPromise) {
                    await window.Zotero.uiReadyPromise;
                }
                SynesisExport.addToWindow(window);
            },
            onMainWindowUnload: ({ window }) => {
                SynesisExport.removeFromWindow(window);
            }
        });
    } else if (Services && Services.wm) {
        let windowListener = {
            onOpenWindow: function(xulWindow) {
                let domWindow = xulWindow.docShell.domWindow;
                domWindow.addEventListener("load", function onLoad() {
                    domWindow.removeEventListener("load", onLoad);
                    if (domWindow.ZoteroPane) {
                        SynesisExport.addToWindow(domWindow);
                    }
                }, { once: true });
            },
            onCloseWindow: function(xulWindow) {
                let domWindow = xulWindow.docShell.domWindow;
                if (domWindow && domWindow.ZoteroPane) {
                    SynesisExport.removeFromWindow(domWindow);
                }
            },
            onWindowTitleChange: function() {}
        };
        Services.wm.addListener(windowListener);
        SynesisExport.windowListener = windowListener;
    }
}

function shutdown() {
    log("Shutting down");
    if (SynesisExport && SynesisExport.prefPaneID &&
            Zotero.PreferencePanes && typeof Zotero.PreferencePanes.unregister === "function") {
        try {
            Zotero.PreferencePanes.unregister(SynesisExport.prefPaneID);
        } catch (e) {
            log("Failed to unregister preferences pane: " + e);
        }
    }
    SynesisExport.removeFromAllWindows();
    if (SynesisExport.windowListener && Services && Services.wm) {
        Services.wm.removeListener(SynesisExport.windowListener);
        SynesisExport.windowListener = null;
    }
    SynesisExport = undefined;
}

function install() {
    log("Installed");
}

function uninstall() {
    log("Uninstalled");
}
