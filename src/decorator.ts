import PO = require('pofile');
import * as vscode from 'vscode';
import {idToPoString} from './localize';

//
// Create the decoration message

function decorationMessage(text: string) {
    const msgOut = (s: string) => ({
        after: {
            margin: '16px',
            contentText: s,
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

export function checkForLocalizeID(i: number, line: vscode.TextLine, skinPO: PO, kodiPO: PO) {
    // var r= /\d+/g;
    // test for number in line, if no number then exit early
    var r = /(\$LOCALIZE\[)\d+(\])|(\<label\>)\d+(\<\/label\>)|(\$INFO\[.*)\d+(.*\])|(label=\")\d+(\")/ig;
    var matches = line.text.match(r);
    if (!matches) {
        return undefined;
    }
    var dtext: string = '';
    matches.forEach((m) => {
        // massive hack for my lack of regex knowlage
        // remove false positives for 'Property(xxxxx)', 'Control(xxxxx)' and 'Container(xxxxx)'
        var r = /(\Property\(.*)\d+(.*\))|(\Control\(.*)\d+(.*\))|(\Container\(.*)\d+(.*\))/ig;
        var pM = m.match(r);
        if (pM) {
            m = m.replace(pM[0], '');
        }

        var r = /\d+/g;
        var matches = m.match(r);
        if (matches) {
            matches.forEach((m) => {
                var id = parseInt(m);
                var t: string = '';
                if (id < 31000 || id > 31999) {
                    t = idToPoString(m, kodiPO);
                } else {
                    t = idToPoString(m, skinPO);
                }
                if (t !== '') {
                    dtext = dtext.concat(' • ', t);
                }
            });
        }
    });

    return decoration(i, `${dtext}`);
}
