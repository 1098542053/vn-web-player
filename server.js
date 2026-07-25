const express = require('express');
const path = require('path');
const fs = require('fs');
const iconv = require('iconv-lite');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SD = {
  normal: path.join(DATA_DIR, 'Scenario', 'Normal'),
  r18: path.join(DATA_DIR, 'Scenario', 'R18'),
  event: path.join(DATA_DIR, 'Scenario', 'Event'),
  main: path.join(DATA_DIR, 'Scenario', 'main'),
};
const SET = path.join(DATA_DIR, 'Setting');
const BGM = path.join(DATA_DIR, 'Sound', 'BGM');
const FONT_SRC = path.join(__dirname, 'public', 'fonts', 'PerfectDOSVGA437.ttf');
const FONT_DST = path.join(__dirname, 'public', 'fonts', 'PerfectDOSVGA437.ttf');

app.use(express.static(path.join(__dirname, 'public')));
app.use('/npm/pixi.js', express.static(path.join(__dirname, 'node_modules', 'pixi.js', 'dist', 'browser')));
app.use('/npm/pixi-live2d-display', express.static(path.join(__dirname, 'node_modules', 'pixi-live2d-display', 'dist')));
app.use('/texture', express.static(path.join(DATA_DIR, 'Texture2D')));
app.use('/live2d', express.static(path.join(DATA_DIR, 'Live2D')));
app.use('/voice', express.static(path.join(DATA_DIR, 'Sound', 'Voice')));
app.use('/bgm', express.static(path.join(DATA_DIR, 'Sound', 'BGM')));
app.use('/scenario', express.static(path.join(DATA_DIR, 'Scenario')));

var L2D_ROOT = path.join(DATA_DIR, 'Live2D');

app.get('/live2d-model/:modelId/*', function(req, res) {
  var modelDir = path.join(L2D_ROOT, req.params.modelId);
  var filePath = req.params[0];
  if (!filePath) return res.status(404).json({ error: 'No file specified' });
  var ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') {
    var exactPath = path.join(modelDir, filePath);
    if (fs.existsSync(exactPath)) return res.sendFile(exactPath);
    var rootPng = path.join(modelDir, path.basename(filePath));
    if (fs.existsSync(rootPng)) return res.sendFile(rootPng);
    return res.status(404).json({ error: 'Texture not found', file: filePath });
  }
  var candidates = [
    path.join(modelDir, filePath),
    path.join(modelDir, filePath + '.bytes'),
    path.join(modelDir, filePath.replace(/\.(moc|mtn|physics|pose)$/, '.$1.bytes'))
  ];
  var seen = {};
  var unique = [];
  candidates.forEach(function(p) {
    if (!seen[p]) { seen[p] = true; unique.push(p); }
  });
  for (var i = 0; i < unique.length; i++) {
    var p = unique[i];
    if (fs.existsSync(p)) {
      var mimeExt = path.extname(p).toLowerCase();
      if (mimeExt === '.bytes') {
        var base = path.basename(p, '.bytes');
        mimeExt = path.extname(base) || '.bytes';
      }
      var mimeTypes = { '.moc': 'application/octet-stream', '.mtn': 'application/octet-stream', '.png': 'image/png', '.json': 'application/json' };
      res.type(mimeTypes[mimeExt] || 'application/octet-stream');
      return res.sendFile(p);
    }
  }
  res.status(404).json({ error: 'Live2D file not found', file: filePath });
});

function readText(p) { const raw = fs.readFileSync(p); return iconv.decode(raw, 'utf-8'); }
function getLines(p) { return readText(p).split(/\r?\n/).filter(function(l) { return l.trim(); }); }
function splitCSV(line) {
  var r = [], c = '', q = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') { q = !q; }
    else if (ch === ',' && !q) { r.push(c.trim()); c = ''; }
    else { c += ch; }
  }
  r.push(c.trim());
  return r;
}

app.get('/api/characters', function(req, res) {
  try {
    var lines = getLines(path.join(SET, 'List.txt'));
    var chars = lines.map(function(line) {
      var parts = line.split(',');
      return { id: parts[0], type: parseInt(parts[1]) || 0, name: parts[2] || '', rarity: parseInt(parts[3]) || 0, motion: parts[4] || '' };
    });
    res.json(chars);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/main-story', function(req, res) {
  try {
    var lines = getLines(path.join(SET, 'mainList.txt'));
    var chapters = lines.map(function(line) {
      var parts = line.split(',');
      var ch = (parts[1] || '').split('\t');
      return { id: parts[0], chapter: ch[0] || '', section: ch[1] || '' };
    });
    res.json(chapters);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/events', function(req, res) {
  try { res.json(getLines(path.join(SET, 'eventList.txt'))); } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/event-chapters/:eid', function(req, res) {
  try {
    var fp = path.join(SET, 'event', req.params.eid + '.txt');
    if (!fs.existsSync(fp)) return res.status(404).json({error:'Not found'});
    var chs = getLines(fp).map(function(l) { var p = l.split(','); return {title: p[0], id: p[1]}; });
    res.json(chs);
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/scenario/:type/:id', function(req, res) {
  try {
    var dir = SD[req.params.type];
    if (!dir) return res.status(400).json({error:'Bad type: '+req.params.type});
    var fp = path.join(dir, req.params.id + '.txt');
    if (!fs.existsSync(fp)) return res.status(404).json({error:'Not found'});
    var lines = getLines(fp);
    var cmds = lines.map(function(l) { var p = splitCSV(l); return {type: p[0], args: p.slice(1)}; });
    res.json({id: req.params.id, type: req.params.type, commands: cmds, total: cmds.length});
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.get('/api/scenario-files/:type', function(req, res) {
  try {
    var dir = SD[req.params.type];
    if (!dir) return res.status(400).json({error:'Bad type'});
    if (!fs.existsSync(dir)) return res.json([]);
    var files = fs.readdirSync(dir).filter(function(f) { return f.endsWith('.txt'); }).map(function(f) { return f.replace('.txt',''); });
    res.json(files);
  } catch(e) { res.status(500).json({error: e.message}); }
});

function ensureFont() {
  var d = path.dirname(FONT_DST);
  if (!fs.existsSync(d)) fs.mkdirSync(d, {recursive:true});
  if (fs.existsSync(FONT_SRC) && !fs.existsSync(FONT_DST)) fs.copyFileSync(FONT_SRC, FONT_DST);
}

ensureFont();
app.listen(PORT, '0.0.0.0', function() {
  console.log('VN-Web running on http://0.0.0.0:' + PORT);
  console.log('Data: ' + DATA_DIR);
});