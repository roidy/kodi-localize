import * as vscode from 'vscode';
import fs = require('fs');
import lineReader = require('n-readlines');
import path = require('path');

export function getWord(): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return undefined;
    }
    const position = editor.selection.active;
    if (editor.selection.isEmpty) {
        const wordRange = editor.document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }
        const word = editor.document.getText(wordRange);
        return word;
    } else {
        const word = editor.document.getText(editor.selection);
        return word;
    }
}

// Search all files for occurances of word
export function findWordInFiles(dir: any, word: string, matcher: string, firstMatch: boolean) {
    if (!fs.existsSync(dir)) {
        return;
    }

    if (!matcher) {
        matcher = word;
    }

    const files = getFilesInDirectory(dir, '.xml');
    let locations: vscode.Location[] = [];

    for (const file of files) {
        let lineNumber = 0;
        let line;
        const lines = new lineReader(file);

        while (line = lines.next()) {
            lineNumber++;
            if (line.toString().toLowerCase().includes(matcher)) {
                line = line.toString().toLowerCase();
                let firstChar = line.indexOf(word);
                let lastChar = firstChar + word.length;
                let start = new vscode.Position(lineNumber - 1, firstChar);
                let end = new vscode.Position(lineNumber - 1, lastChar);
                let range = new vscode.Range(start, end);
                let loc = new vscode.Location(vscode.Uri.file(file), range);
                locations.push(loc);
                if (firstMatch) { break; }
            }
        }
        if (firstMatch && locations.length !== 0) { break; }
    }

    return locations;
}

// Using recursion, we find every file with the desired extention, even if its deeply nested in subfolders.
function getFilesInDirectory(dir: string, ext: string): string[] {
    if (!fs.existsSync(dir)) {
        return [];
    }

    let files: string[] = [];
    fs.readdirSync(dir).forEach((file: any) => {
        const filePath = path.join(dir, file);
        const stat = fs.lstatSync(filePath);

        // If we hit a directory, apply our function to that dir. If we hit a file, add it to the array of files.
        if (stat.isDirectory()) {
            const nestedFiles = getFilesInDirectory(filePath, ext);
            files = files.concat(nestedFiles);
        } else {
            if (path.extname(file) === ext) {
                files.push(filePath);
            }
        }
    });

    return files;
}