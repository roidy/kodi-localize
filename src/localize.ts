import * as vscode from 'vscode';
import PO = require('pofile');
import * as path from 'path';
import fetch from 'node-fetch';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

//
// Load local skin PO file
//
export async function loadSkinPO(countryCode: string): Promise<any> {
    let editor = vscode.window.activeTextEditor;
    var poFile: string;
    if (editor?.document.uri) {
        const folder = vscode.workspace.getWorkspaceFolder(editor!.document.uri);
        poFile = folder!.uri.fsPath + `${path.sep}language${path.sep}resource.language.${countryCode}${path.sep}strings.po`;
    }
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
export async function loadKodiPO() {
    const response = await fetch('https://raw.githubusercontent.com/xbmc/xbmc/master/addons/resource.language.en_gb/resources/strings.po');
    if (response.status !== 200) {
        vscode.window.showErrorMessage('Error: Unable to load Kodi skin strings file from GitHub.');
    }
    const body = await response.text();
    const po = PO.parse(body);
    return po;
}

//
// Write new skin PO file
//
export function writeSkinPO(po: PO) {
    let editor = vscode.window.activeTextEditor;
    if (editor!.document.uri) {
        const folder = vscode.workspace.getWorkspaceFolder(editor!.document.uri);
        const stamp = new Date().toISOString().replace(/:/gi, '');
        const backupPoDirectory = folder!.uri.fsPath + `${path.sep}language${path.sep}resource.language.en_gb${path.sep}backup${path.sep}`;
        const backupPoFile = `${backupPoDirectory}${stamp}.po`;
        const poFile = folder!.uri.fsPath + `${path.sep}language${path.sep}resource.language.en_gb${path.sep}strings.po`;

        if (!existsSync(backupPoDirectory)) {
            mkdirSync(backupPoDirectory);
        }

        copyFileSync(poFile, backupPoFile);

        po.save(poFile, function (err) {
            if (err) {
                console.log('Error saving new PO');
            }
        });
    }
}

//
// Check a PO file for a matching string
//
export function checkPO(word: String, short: Boolean, po: PO) {
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
export function idToPoString(id: String, po: PO) {
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
export function createPO(word: String, po: PO) {
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
    return po;
}

//
// Do swap ID -> $LOCALISE[ID] / $LOCALIZE[ID] -> ID
//
export function doSwap() {
    let editor = vscode.window.activeTextEditor;

    if (editor) {
        const document = editor.document;
        if (!document) { return; }
        var selection = editor.selection;

        //Get the word within the selection
        const value = document.getText(selection);
        if (value === '') {
            return;
        }

        const selectionText = document.getText(selection);

        // if selection contains anything other than numbers then exit
        var r = /^[0-9]*$/g;
        var matches = selectionText.match(r);
        if (!matches) { return; }

        // find $LOCALIZE[xxxxx]
        const line = editor.document.lineAt(selection.active.line);
        var r = /(\$LOCALIZE\[)\d+(\])/ig;
        var matches = line.text.match(r);
        if (matches) {

            const start = selection.start.translate(0, -10);
            const end = selection.end.translate(0, 1);
            const value = document.getText(selection);
            selection = new vscode.Selection(start, end);
            editor.edit(editBuilder => {
                editBuilder.replace(selection, value);
            });
            return;
        }
        // find just ID number
        var r = /\d+/g;
        var matches = selectionText.match(r);
        if (matches) {
            editor.edit(editBuilder => {
                editBuilder.replace(selection, `$LOCALIZE[${selectionText}]`);
            });
            return;
        }
    }
}

//
// Check number and swap
//
export function checkNumber(selection: vscode.Selection): boolean {

    let editor = vscode.window.activeTextEditor;
    const document = editor!.document;

    if (!editor || !document) {
        return false;
    }

    const value = document.getText(selection);
    const line = editor.document.lineAt(selection.active.line).text;

    const findNumbers = /\d+/g;
    const onlyNumbers = /^[0-9]*$/g;
    const localizeWithID = /(\$LOCALIZE\[)\d+(\])/ig;

    // if selection contains $LOCALIZE[xxxxxx]
    var matches = value.match(localizeWithID);
    if (matches) {
        var innerMatches = value.match(findNumbers);
        if (innerMatches) {
            editor.edit(editBuilder => {
                editBuilder.replace(selection, innerMatches![0].toString());
            });
        }
    }


    // if line contains $LOCALIZE[xxxxxx]
    var r = /(\$LOCALIZE\[)\d+(\])/ig;
    var matches = line.match(localizeWithID);
    if (matches) {
        const start = selection.start.translate(0, -10);
        const end = selection.end.translate(0, 1);
        const value = document.getText(selection);
        selection = new vscode.Selection(start, end);
        editor.edit(editBuilder => {
            editBuilder.replace(selection, value);
        });
        return true;
    }

    // if selection is anything other than number then exit
    var matches = value.match(onlyNumbers);
    if (!matches) {
        return false;
    }

    // find just ID number
    var matches = value.match(findNumbers);
    if (matches) {
        editor.edit(editBuilder => {
            editBuilder.replace(selection, `$LOCALIZE[${value}]`);
        });
        return true;
    }

    return false;
}

//
// Main localization function
//
export async function doLocalize(kodiPO: PO, short: Boolean = false, countryCode: any) {
    // Load skin PO file and exit early on error
    var skinPO = await loadSkinPO(countryCode);
    if (skinPO instanceof Error) { return; }

    let editor = vscode.window.activeTextEditor;
    const document = editor!.document;
    if (!editor || !document) {
        return skinPO;
    }

    const selection = editor.selection;

    // Get the word within the selection
    const value = document.getText(selection);
    if (value === '') {
        return skinPO;
    }

    // Check if selection is a number
    var result = checkNumber(selection);
    if (result) {
        // Selction was a number exit early
        return skinPO;
    }

    // First check if the string exists in the Kodi String file
    var id = checkPO(value, short, kodiPO);
    if (id) {
        editor.edit(editBuilder => {
            editBuilder.replace(selection, id!);
        });
        return skinPO;
    }
    // Next check if the string exists in the skin String file
    var id = checkPO(value, short, (skinPO as PO));
    if (id) {
        editor.edit(editBuilder => {
            editBuilder.replace(selection, id!);
        });
        return skinPO;
    }
    // If no string exists create a new one in the skin string file
    skinPO = createPO(value, (skinPO as PO));
    var id = checkPO(value, short, skinPO);
    if (id) {
        editor.edit(editBuilder => {
            editBuilder.replace(selection, id!);
        });
        return skinPO;
    }

    return skinPO;
}