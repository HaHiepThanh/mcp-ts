// Shared slide helpers for the phase-2 deck (pptxgenjs, 16:9 wide). Same visual language as the phase-1 deck.
const pptxgen = require('pptxgenjs');

const COL = {
    dark: '1F2A44', ink: '1F2937', muted: '5B6475', accent: '0F8B8D', accent2: 'E07A1F',
    card: 'EEF2F6', white: 'FFFFFF', line: '8A94A6', todo: 'D9480F', todoFill: 'FFF4E6', yes: '2F855A', no: 'C53030'
};
const MONO = 'Courier New';

function createDeck(footer) {
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
    pres.theme = { headFontFace: 'Calibri', bodyFontFace: 'Calibri' };
    pres.defineSlideMaster({
        title: 'CONTENT',
        background: { color: COL.white },
        objects: [{ text: { text: footer, options: { x: 0.5, y: 7.05, w: 8, h: 0.3, fontSize: 10, color: COL.muted } } }],
        slideNumber: { x: 12.3, y: 7.05, w: 0.6, h: 0.3, fontSize: 10, color: COL.muted, align: 'right' }
    });
    pres.defineSlideMaster({ title: 'DARK', background: { color: COL.dark } });

    const h = {};
    h.content = (title, kicker, notes) => {
        const s = pres.addSlide({ masterName: 'CONTENT' });
        if (kicker) s.addText(kicker.toUpperCase(), { x: 0.5, y: 0.3, w: 12.3, h: 0.3, fontSize: 12, bold: true, color: COL.accent, charSpacing: 2, margin: 0, isTextBox: true });
        s.addText(title, { x: 0.5, y: 0.6, w: 12.3, h: 0.7, fontSize: 30, bold: true, color: COL.ink, margin: 0, isTextBox: true });
        if (notes) s.addNotes(notes);
        return s;
    };
    h.divider = (num, title, sub, notes) => {
        const s = pres.addSlide({ masterName: 'DARK' });
        s.addText(num, { x: 0.8, y: 2.0, w: 4, h: 1.2, fontSize: 72, bold: true, color: COL.accent, margin: 0, isTextBox: true });
        s.addText(title, { x: 0.8, y: 3.2, w: 11.5, h: 0.9, fontSize: 40, bold: true, color: COL.white, margin: 0, isTextBox: true });
        if (sub) s.addText(sub, { x: 0.8, y: 4.15, w: 11.5, h: 0.6, fontSize: 18, color: 'C9D3E6', margin: 0, isTextBox: true });
        if (notes) s.addNotes(notes);
        return s;
    };
    h.card = (s, x, y, w, hh, head, body, o = {}) => {
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: hh, fill: { color: o.fill ?? COL.card }, line: { color: o.fill ?? COL.card }, rectRadius: 0.08 });
        s.addText(head, { x: x + 0.2, y: y + 0.15, w: w - 0.4, h: 0.5, fontSize: o.hfs ?? 18, bold: true, color: o.hc ?? COL.accent, margin: 0, valign: 'top', isTextBox: true });
        if (body) s.addText(body, { x: x + 0.2, y: y + 0.7, w: w - 0.4, h: hh - 0.85, fontSize: o.fs ?? 14, color: o.bc ?? COL.ink, margin: 0, valign: 'top', isTextBox: true });
    };
    h.code = (s, text, x, y, w, hh, fs = 12, caption) => {
        s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: hh, fill: { color: 'F6F8FA' }, line: { color: 'D0D7DE', width: 1 } });
        s.addText(text, { x: x + 0.15, y: y + 0.1, w: w - 0.3, h: hh - 0.2, fontFace: MONO, fontSize: fs, color: '24292F', valign: 'top', margin: 0, isTextBox: true });
        if (caption) s.addText(caption, { x, y: y + hh + 0.05, w, h: 0.3, fontSize: 11, italic: true, color: COL.muted, margin: 0, isTextBox: true });
    };
    h.todo = (s, text, x, y, w, hh) => {
        s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: hh, fill: { color: COL.todoFill }, line: { color: COL.todo, width: 2, dashType: 'dash' } });
        s.addText([{ text: 'TODO (Thanh): ', options: { bold: true } }, { text }], { x: x + 0.2, y, w: w - 0.4, h: hh, fontSize: 14, color: COL.todo, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    };
    h.table = (s, rows, o) => {
        const head = rows[0].map(t => ({ text: String(t), options: { bold: true, color: COL.white, fill: { color: COL.dark } } }));
        const body = rows.slice(1).map((r, i) => r.map(t => (typeof t === 'object' && t !== null ? t : { text: String(t ?? '—'), options: { fill: { color: i % 2 ? 'F7F9FB' : COL.white } } })));
        s.addTable([head, ...body], { x: o.x ?? 0.5, y: o.y ?? 1.5, w: o.w ?? 12.3, colW: o.colW, fontSize: o.fs ?? 13, color: COL.ink, border: { type: 'solid', pt: 0.75, color: 'D0D7DE' }, valign: 'middle', margin: 0.06, rowH: o.rowH });
    };
    h.mono = (t, fill) => ({ text: t, options: { fontFace: MONO, fontSize: 12, color: COL.ink, fill: fill ? { color: fill } : undefined } });
    h.stat = (s, x, y, w, big, label, color = COL.accent) =>
        s.addText([{ text: big, options: { fontSize: 34, bold: true, color, breakLine: true } }, { text: label, options: { fontSize: 14, color: COL.muted } }], { x, y, w, h: 1.1, margin: 0, isTextBox: true });
    h.bar = (s, labels, series, o) =>
        s.addChart(pres.charts.BAR, series.map(([name, values]) => ({ name, labels, values })), {
            x: o.x, y: o.y, w: o.w, h: o.h, barDir: o.dir ?? 'col', barGrouping: 'clustered',
            showTitle: !!o.title, title: o.title, titleFontSize: 14, titleColor: COL.ink, titleFontFace: '+mn-lt',
            showValue: o.values ?? series.length === 1, dataLabelPosition: 'outEnd', dataLabelFontSize: 11, dataLabelFormatCode: o.fmt ?? '0.0', dataLabelColor: COL.ink,
            chartColors: o.colors ?? [COL.accent, COL.accent2, COL.dark, '7AA6C2'], showLegend: series.length > 1, legendPos: 'b', legendFontSize: 11,
            catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, catAxisLabelColor: COL.muted, valAxisLabelColor: COL.muted, catAxisLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt',
            valGridLine: { color: 'E5E7EB', size: 0.5 }, catGridLine: { style: 'none' }, valAxisMaxVal: o.max, valAxisMinVal: 0, catAxisOrientation: o.dir === 'bar' ? 'maxMin' : 'minMax'
        });
    h.note = (s, text, y = 6.45) => s.addText(text, { x: 0.5, y, w: 12.3, h: 0.5, fontSize: 14, color: COL.ink, margin: 0, isTextBox: true });
    return { pres, h };
}

module.exports = { createDeck, COL, MONO };
