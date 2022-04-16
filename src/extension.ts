// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import PO = require('pofile');
import fetch from 'node-fetch';
import path = require('path');
import { TextDecoder } from 'util';

var kodiPO: PO;
var globalSkinPO: PO | Error;
var skinPOUpdated: Boolean = true;
var sep = path.sep;

//
// Load local skin PO file
//
async function loadSkinPO(): Promise<PO | Error> {
    let editor = vscode.window.activeTextEditor;
    const folder = vscode.workspace.getWorkspaceFolder(editor!.document.uri);

    const poFile = folder!.uri.fsPath + `${sep}language${sep}resource.language.en_gb${sep}strings.po`;

    return new Promise((resolve, reject) => {
        PO.load(poFile,
            (err, po) => {
                if (err) {
                    // on error return the error
                    vscode.window.showErrorMessage('Error: Unable to open skin string file.');
                    resolve(err);
                } else {
                    resolve(po);
                }
            }
        );
    });

}

//
// Load remote Kodi skin PO from github
//
async function loadKodiPO() {
    const response = await fetch('https://raw.githubusercontent.com/xbmc/xbmc/master/addons/resource.language.en_gb/resources/strings.po');
    const body = await response.text();
    const po = PO.parse(body);
    return po;
}

//
// Write new skin PO file
//
function writeSkinPO(po: PO) {
    let editor = vscode.window.activeTextEditor;
    const folder = vscode.workspace.getWorkspaceFolder(editor!.document.uri);
    const stamp = new Date().toISOString().replace(/:/gi, '');
    const backupPoDirectory = folder!.uri.fsPath + `${sep}language${sep}resource.language.en_gb${sep}backup${sep}`;
    const backupPoFile = `${backupPoDirectory}${stamp}.po`;
    const poFile = folder!.uri.fsPath + `${sep}language${sep}resource.language.en_gb${sep}strings.po`;

    if (!existsSync(backupPoDirectory)) {
        mkdirSync(backupPoDirectory);
    }

    copyFileSync(poFile, backupPoFile);

    po.save(poFile, function (err) {
        if (err) {
            console.log('Error saving new PO');
        }
    });
    // Update global skin po
    globalSkinPO = po;
}


//
// Check a PO file for a matching string
//
function checkPO(word: String, short: Boolean, po: PO) {
    // Find word in po
    const item = po.items.find((v) => v.msgid === word);
    if (item) {
        if (short) {
            return `${item.msgctxt?.substring(1)}`;
        } else {
            return `$LOCALIZE[${item.msgctxt?.substring(1)}]`;
        }
    }
}

//
// Given an ID value look up the string 
//
function idToPoString(id: String, po: PO) {
    // console.log(`idToPoString: id=${id}`);
    // console.log(po);
    // Find word in po
    const item = po.items.find((v) => v.msgctxt === `#${id}`);
    if (item) {
        return item.msgid;
    }
    return '';
}

//
// Create a new localization and resave the skin string file
//
function createPO(word: String, po: PO) {
    // Find first free #id in po file
    var item;
    for (var i = 31000; i < 32000; i++) {
        item = po.items.find((v) => v.msgctxt === `#${i}`);
        if (!item) {
            var newItem = new PO.Item();
            newItem.msgctxt = `#${i}`;
            newItem.msgid = (word as string);
            var newPO = po.items.concat(newItem);
            po.items = newPO;
            po.items.sort((a, b) => (a > b ? 1 : -1));
            writeSkinPO(po);
            break;
        }
    }

}

//
// Main localization function
//
async function doLocalize(short: Boolean = false) {
    // Load skin PO file and exit early on error
    var skinPO = await loadSkinPO();
    if (skinPO instanceof Error) { return; }

    let editor = vscode.window.activeTextEditor;
    if (editor) {
        const document = editor.document;
        const selection = editor.selection;

        //Get the word within the selection
        const value = document.getText(selection);
        if (value === '') {
            return;
        }

        // First check if the string exists in the Kodi String file
        var id = checkPO(value, short, kodiPO);
        if (id) {
            editor.edit(editBuilder => {
                editBuilder.replace(selection, id!);
            });
            return;
        }
        // Next check if the string exists in the skin String file
        var id = checkPO(value, short, (skinPO as PO));
        if (id) {
            editor.edit(editBuilder => {
                editBuilder.replace(selection, id!);
            });
            return;
        }
        // If no string exists create a new one in the skin string file
        createPO(value, (skinPO as PO));
        var id = checkPO(value, short, (skinPO as PO));
        if (id) {
            editor.edit(editBuilder => {
                editBuilder.replace(selection, id!);
            });
            return;
        }
    }
}

export async function activate(context: vscode.ExtensionContext) {

    // load kodi po from github, only done once pre activation
    kodiPO = await loadKodiPO();
    // load skin po in to global space
    globalSkinPO = await loadSkinPO();

    // Register 'Localize Id Only' command
    context.subscriptions.push(
        vscode.commands.registerCommand('kodi-localize.LocalizeIDOnly', () => {
            doLocalize(true);
        })
    );
    // Register 'Localize $LOCALIZE[]' command
    context.subscriptions.push(
        vscode.commands.registerCommand('kodi-localize.LocalizeFull', () => {
            doLocalize();
        })
    );

    // Set up line decoration
    let timeout: NodeJS.Timer | undefined = undefined;
    let activeEditor = vscode.window.activeTextEditor;
    const decorationType = vscode.window.createTextEditorDecorationType({});

    function decorationMessage(text: string) {
        const msgOut = (s: string) => ({
            after: {
                contentText: s,
                margin: "20",
                color: "#ffffff60"
            }
        });
        return msgOut(text);
    }

    function decoration(line: number, text: string) {
        const a = {
            renderOptions: {
                ...decorationMessage(text)
            },
            range: new vscode.Range(
                new vscode.Position(line, 1024),
                new vscode.Position(line, 1024)
            )
        };
        return a;
    }

    function checkForLocalizeID(i: number, line: vscode.TextLine) {
        // early test for number in line, if no number then exit early
        // var r= /\d+/g;
        var r = /(\$LOCALIZE\[)\d+(\])|(\<label\>)\d+(\<\/label\>)|(\$INFO\[.*)\d+(.*\])|(label=\")\d+(\")/ig;
        var matches = line.text.match(r);
        if (!matches) {
            return undefined;
        }

        var dtext: string = '';
        matches.forEach((m) => {
            var r = /\d+/g;
            var matches = m.match(r);
            if (matches) {
                matches.forEach((m) => {
                    // console.log(`m=${m}`);
                    var id = parseInt(m);
                    var t: string = '';
                    if (id < 31000 || id > 31999) {
                        t = idToPoString(m, kodiPO);
                    } else {
                        t = idToPoString(m, (globalSkinPO as PO));
                    }
                    // console.log(t);
                    if (t !== '') {
                        dtext = dtext.concat(' • ', t);
                    }
                });
            }
        });

        return decoration(i, `${dtext}`);
    }

    async function updateDecorations() {
        if (!activeEditor) {
            return;
        }

        const decorations: vscode.DecorationOptions[] = [];
        activeEditor.setDecorations(decorationType, []);

        const text = activeEditor.document.getText();
        let arr = {};
        for (let i = 0; i < activeEditor.document.lineCount; ++i) {
            const line = activeEditor.document.lineAt(i);
            var decObj = checkForLocalizeID(i, line);
            if (decObj) {
                decorations.push(decObj);
            }
        }
        activeEditor.setDecorations(decorationType, decorations);
    }

    function triggerUpdateDecorations(throttle = false) {
        if (timeout) {
            clearTimeout(timeout);
            timeout = undefined;
        }
        if (throttle) {
            timeout = setTimeout(updateDecorations, 500);
        } else {
            updateDecorations();
        }
    }

    if (activeEditor) {
        triggerUpdateDecorations();
    }

    vscode.window.onDidChangeActiveTextEditor(async editor => {
        activeEditor = editor;
        if (editor) {
            globalSkinPO = await loadSkinPO();
            triggerUpdateDecorations();
        }
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument(event => {
        if (activeEditor && event.document === activeEditor.document) {
            triggerUpdateDecorations(true);
        }
    }, null, context.subscriptions);
}

// Extention deactivated
export function deactivate() { }


