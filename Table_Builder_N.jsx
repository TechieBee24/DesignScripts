#target photoshop
//Scrip developed by Wanyoike. Like and follow me on my socials. W24 Arts
// This script builds a table in Photoshop from ANY CSV.
//
// HOW IT WORKS
//  1. In your PSD, make ONE template row: a group containing one layer per CSV column.
//     Layer names must match the CSV headers (capitals and spaces are ignored).
//  2. Run this script, pick the CSV, name the template group, set the row offset.
//  3. The script duplicates the template once per CSV row and fills every column.
//
// COLUMN TYPES
//  - Text column : text layer, filled with the cell value.
//  - Image column: header starts with "@" (e.g. @Badge), or every cell ends in .png/.jpg/etc.
//                  The layer is a placeholder; each image is scaled to fit inside it.
//                  Image paths are relative to the CSV's folder (or absolute).
//  - Any number of columns is fine. CSV columns with no matching layer are ignored,
//    and template layers with no CSV column are left untouched (both are reported first).

app.bringToFront();

var VER = "[Table Builder v9]";
var IMG_EXT = /\.(png|jpe?g|gif|tiff?|psd|bmp|webp)$/i;
var where = "start";

function trim(s) { return String(s).replace(/^\s+|\s+$/g, ""); }
function squash(s) { return trim(s).toLowerCase().replace(/\s+/g, ""); }
function bw(b) { return b[2].as("px") - b[0].as("px"); }
function bh(b) { return b[3].as("px") - b[1].as("px"); }

function parseCSV(text, delim) {
    var rows = [], row = [], field = "", inQ = false, i, ch;
    text = text.replace(/^\uFEFF/, "");
    for (i = 0; i < text.length; i++) {
        ch = text.charAt(i);
        if (inQ) {
            if (ch == '"') {
                if (text.charAt(i + 1) == '"') { field += '"'; i++; } else inQ = false;
            } else field += ch;
        } else if (ch == '"') inQ = true;
        else if (ch == delim) { row.push(field); field = ""; }
        else if (ch == "\n" || ch == "\r") {
            if (ch == "\r" && text.charAt(i + 1) == "\n") i++;
            row.push(field); field = "";
            if (row.length > 1 || row[0] !== "") rows.push(row);
            row = [];
        } else field += ch;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
}

function collectLayers(grp, out) {
    var k;
    for (k = 0; k < grp.artLayers.length; k++) out.push(grp.artLayers[k]);
    for (k = 0; k < grp.layerSets.length; k++) collectLayers(grp.layerSets[k], out);
    return out;
}

function findLayer(grp, want) {
    var all = collectLayers(grp, []), k, w = squash(want);
    for (k = 0; k < all.length; k++) {
        if (squash(all[k].name) == w) return all[k];
    }
    return null;
}

function findGroup(container, nm) {
    var k, hit;
    for (k = 0; k < container.layerSets.length; k++) {
        if (container.layerSets[k].name == nm) return container.layerSets[k];
    }
    for (k = 0; k < container.layerSets.length; k++) {
        hit = findGroup(container.layerSets[k], nm);
        if (hit) return hit;
    }
    return null;
}

function listGroups(doc) {
    var k, out = [];
    for (k = 0; k < doc.layerSets.length; k++) out.push("[" + doc.layerSets[k].name + "]");
    return out.join(" ");
}

function renameLayer(doc, lyr, newName) {
    try { lyr.name = newName; if (lyr.name == newName) return; } catch (e1) {}
    doc.activeLayer = lyr;
    var d = new ActionDescriptor();
    var r = new ActionReference();
    r.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    d.putReference(charIDToTypeID("null"), r);
    var t = new ActionDescriptor();
    t.putString(charIDToTypeID("Nm  "), newName);
    d.putObject(charIDToTypeID("T   "), charIDToTypeID("Lyr "), t);
    executeAction(charIDToTypeID("setd"), d, DialogModes.NO);
}

function moveGroup(doc, grp, dx, dy) {
    try { grp.translate(dx, dy); return; } catch (e1) {}
    try {
        doc.activeLayer = grp;
        var d = new ActionDescriptor();
        var r = new ActionReference();
        r.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        d.putReference(charIDToTypeID("null"), r);
        var o = new ActionDescriptor();
        o.putUnitDouble(charIDToTypeID("Hrzn"), charIDToTypeID("#Pxl"), dx);
        o.putUnitDouble(charIDToTypeID("Vrtc"), charIDToTypeID("#Pxl"), dy);
        d.putObject(charIDToTypeID("T   "), charIDToTypeID("Ofst"), o);
        executeAction(charIDToTypeID("move"), d, DialogModes.NO);
        return;
    } catch (e2) {}
    var k;
    for (k = 0; k < grp.artLayers.length; k++) grp.artLayers[k].translate(dx, dy);
    for (k = 0; k < grp.layerSets.length; k++) moveGroup(doc, grp.layerSets[k], dx, dy);
}

// Duplicates the template group and returns the NEW group (taken from the active layer).
function duplicateGroup(doc, tplName) {
    var tplG = findGroup(doc, tplName);
    if (!tplG) throw new Error("Template group '" + tplName + "' not found. Top-level groups: " + listGroups(doc));
    var done = false, err = "";
    try {
        doc.activeLayer = tplG;
        executeAction(charIDToTypeID("CpTL"), undefined, DialogModes.NO);
        done = true;
    } catch (e1) { err += "CpTL: " + e1.message + " | "; }
    if (!done) {
        try {
            doc.activeLayer = tplG;
            var d = new ActionDescriptor();
            var r = new ActionReference();
            r.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
            d.putReference(charIDToTypeID("null"), r);
            d.putInteger(charIDToTypeID("Vrsn"), 5);
            executeAction(charIDToTypeID("Dplc"), d, DialogModes.NO);
            done = true;
        } catch (e2) { err += "Dplc: " + e2.message + " | "; }
    }
    if (!done) {
        try {
            var dup = tplG.duplicate();
            try { doc.activeLayer = dup; } catch (e3) {}
            done = true;
        } catch (e4) { err += "DOM: " + e4.message + " | "; }
    }
    if (!done) throw new Error("All duplicate methods failed. " + err);
    var g = doc.activeLayer;
    if (g.name == tplName) {
        throw new Error("Duplicate not selected after copying. Active layer is '" + g.name + "' (" + g.typename + ").");
    }
    return g;
}

function pasteImage(doc, file, target) {
    var src = app.open(file);
    src.selection.selectAll();
    src.selection.copy();
    src.close(SaveOptions.DONOTSAVECHANGES);
    app.activeDocument = doc;
    doc.activeLayer = target;
    doc.paste();
    return doc.activeLayer;
}

function main() {
    if (app.documents.length == 0) throw new Error("Open your PSD first.");
    var doc = app.activeDocument;
    var oldUnits = app.preferences.rulerUnits;
    app.preferences.rulerUnits = Units.PIXELS;
    try {
        // ---- 1. CSV ----
        where = "choosing the CSV";
        var csvFile = File.openDialog("Choose the CSV file");
        if (!csvFile) return;
        csvFile.encoding = "UTF-8";
        csvFile.open("r");
        var rawText = csvFile.read();
        csvFile.close();
        var firstLine = rawText.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/)[0];
        var delim = ",";
        if (firstLine.split(";").length > firstLine.split(",").length) delim = ";";
        if (firstLine.split("\t").length > firstLine.split(delim).length) delim = "\t";
        var rows = parseCSV(rawText, delim);

        // ---- 2. template group ----
        where = "finding the template group";
        var tplName = prompt("Name of the template row group in your PSD:", "Row", VER);
        if (!tplName) return;
        tplName = trim(tplName);
        var tpl = findGroup(doc, tplName);
        if (!tpl) throw new Error("No group named '" + tplName + "'. Top-level groups: " + listGroups(doc));
        var tplLayers = collectLayers(tpl, []);

        // ---- 3. header row + columns ----
        where = "reading CSV headers";
        var hr = -1, r2, c2, k2, hits;
        for (r2 = 0; r2 < rows.length && hr < 0; r2++) {
            hits = 0;
            for (c2 = 0; c2 < rows[r2].length; c2++) {
                var cell = squash(String(rows[r2][c2]).replace(/^\s*@/, ""));
                for (k2 = 0; k2 < tplLayers.length; k2++) {
                    if (squash(tplLayers[k2].name) == cell) hits++;
                }
            }
            if (hits >= 1) hr = r2;
        }
        if (hr < 0) {
            throw new Error("No CSV row matches the layer names inside '" + tplName + "'.\nFile: " + csvFile.fsName +
                            "\nStart of file: " + rawText.substring(0, 150).replace(/[\r\n]+/g, " / "));
        }
        rows = rows.slice(hr);
        var headers = rows[0], n = rows.length - 1;
        if (n < 1) throw new Error("The CSV has a header row but no data rows.");

        var cols = [], ignored = [], usedKeys = {}, c, r, v, allImg, anyVal;
        for (c = 0; c < headers.length; c++) {
            var rawHead = trim(headers[c]);
            if (rawHead === "") continue;
            var isImg = rawHead.charAt(0) == "@";
            var field = trim(isImg ? rawHead.substring(1) : rawHead);
            if (field === "") continue;
            if (!isImg) {
                allImg = true; anyVal = false;
                for (r = 1; r < rows.length; r++) {
                    v = trim(rows[r][c] === undefined ? "" : rows[r][c]);
                    if (v === "") continue;
                    anyVal = true;
                    if (!IMG_EXT.test(v)) { allImg = false; break; }
                }
                isImg = anyVal && allImg;
            }
            if (!findLayer(tpl, field)) { ignored.push(field); continue; }
            cols.push({ idx: c, field: field, img: isImg });
            usedKeys[squash(field)] = true;
        }
        if (cols.length == 0) throw new Error("None of the CSV columns match a layer in '" + tplName + "'.");

        var untouched = [];
        for (k2 = 0; k2 < tplLayers.length; k2++) {
            if (!usedKeys[squash(tplLayers[k2].name)]) untouched.push(tplLayers[k2].name);
        }

        // ---- 4. row offset ----
        where = "setting the row offset";
        var tb = tpl.bounds;
        var offStr = prompt("Offset between rows in pixels, as X,Y\n(0,48 stacks downward; 120,0 goes sideways)",
                            "0," + (Math.round(bh(tb)) + 4), VER);
        if (offStr === null) return;
        var parts = String(offStr).split(",");
        var dx = parseFloat(parts[0]), dy = parseFloat(parts[1]);
        if (isNaN(dx)) dx = 0;
        if (isNaN(dy)) dy = 0;
        if (dx == 0 && dy == 0) throw new Error("The offset can't be 0,0 - the rows would sit on top of each other.");

        var warn = "";
        var lastR = tb[2].as("px") + dx * (n - 1), lastB = tb[3].as("px") + dy * (n - 1);
        var lastL = tb[0].as("px") + dx * (n - 1), lastT = tb[1].as("px") + dy * (n - 1);
        if (lastR > doc.width.as("px") || lastB > doc.height.as("px") || lastL < 0 || lastT < 0) {
            warn = "\n\nWARNING: the last row will fall outside the canvas.";
        }

        // ---- 5. summary ----
        var used = [];
        for (c = 0; c < cols.length; c++) used.push(cols[c].field + (cols[c].img ? " (image)" : ""));
        var msg = VER + "\nFile: " + csvFile.fsName + "\nData rows: " + n + "\nTemplate group: " + tplName +
                  "\n\nColumns filled (" + used.length + "): " + used.join(", ");
        if (ignored.length) msg += "\nCSV columns with no layer (ignored): " + ignored.join(", ");
        if (untouched.length) msg += "\nTemplate layers with no CSV column (left as is): " + untouched.join(", ");
        msg += warn + "\n\nBuild the table?";
        if (!confirm(msg)) return;

        // ---- 6. duplicate rows ----
        var i, k;
        for (i = 1; i < n; i++) {
            where = "duplicating row " + (i + 1);
            var g = duplicateGroup(doc, tplName);
            where = "renaming row " + (i + 1);
            renameLayer(doc, g, tplName + " " + (i + 1));
            where = "moving row " + (i + 1);
            g = findGroup(doc, tplName + " " + (i + 1)) || g;
            moveGroup(doc, g, dx * i, dy * i);
        }
        where = "renaming row 1";
        try { renameLayer(doc, findGroup(doc, tplName), tplName + " 1"); } catch (e5) {}

        // ---- 7. fill ----
        for (i = 0; i < n; i++) {
            var grp = findGroup(doc, tplName + " " + (i + 1));
            if (!grp) throw new Error("Could not find group '" + tplName + " " + (i + 1) + "'.");
            for (k = 0; k < cols.length; k++) {
                var col = cols[k];
                where = "row " + (i + 1) + ", column '" + col.field + "'";
                var val = rows[i + 1][col.idx];
                if (val === undefined) val = "";
                var lyr = findLayer(grp, col.field);
                if (!lyr) throw new Error("Layer '" + col.field + "' not found in group '" + grp.name + "'.");

                if (!col.img) {
                    if (lyr.kind != LayerKind.TEXT) {
                        throw new Error("Layer '" + col.field + "' is not a text layer. For image columns, start the header with @.");
                    }
                    lyr.textItem.contents = val;
                } else {
                    val = trim(val);
                    if (val === "") { lyr.visible = false; continue; }
                    var isAbs = /^([A-Za-z]:[\\\/]|[\\\/]|~)/.test(val);
                    var imgFile = new File(isAbs ? val : csvFile.path + "/" + val);
                    if (!imgFile.exists) throw new Error("Image not found: " + imgFile.fsName);
                    var pb = lyr.bounds, pw = bw(pb), ph = bh(pb);
                    var cx = (pb[0].as("px") + pb[2].as("px")) / 2;
                    var cy = (pb[1].as("px") + pb[3].as("px")) / 2;
                    var placed = pasteImage(doc, imgFile, lyr);
                    var ib = placed.bounds;
                    var pct = Math.min(pw / bw(ib), ph / bh(ib)) * 100;
                    placed.resize(pct, pct, AnchorPosition.MIDDLECENTER);
                    ib = placed.bounds;
                    placed.translate(cx - (ib[0].as("px") + ib[2].as("px")) / 2,
                                     cy - (ib[1].as("px") + ib[3].as("px")) / 2);
                    try { placed.move(lyr, ElementPlacement.PLACEBEFORE); } catch (e6) {}
                    placed.name = col.field;
                    lyr.remove();
                }
            }
        }
        alert(VER + "\nDone: built " + n + " rows, " + cols.length + " columns each.");
    } finally {
        app.preferences.rulerUnits = oldUnits;
    }
}

try {
    main();
} catch (e) {
    alert(VER + "\nStopped at: " + where + "\n\n" + e.message + (e.line ? "\n(line " + e.line + ")" : ""));
}
