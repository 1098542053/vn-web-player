var VR = (function() {
  "use strict";
  var audioUnlocked = false;
  var pendingAudio = [];
  function unlockAudio() { if (audioUnlocked) return; audioUnlocked = true; pendingAudio.forEach(function(a) { doPlayAudio(a.id, a.src, a.loop); }); pendingAudio = []; }
  var lines = [], lineIdx = 0, isAuto = false, isSkipping = false, autoTimer = null, textTimer = null;
  var settings = { textSpeed: 40, autoDelay: 2000, fontSize: 20 };
  var currentType = '', currentId = '';
  function stop() { exitReader(); }
  function play(type, id, title) {
    unlockAudio(); currentType = type; currentId = id;
    var path;
    if (type === 'main') path = '/scenario/main/' + id + '.txt';
    else if (type === 'event') path = '/scenario/Event/' + id + '.txt';
    else if (type === 'r18') path = '/scenario/R18/' + id + '.txt';
    else path = '/scenario/Normal/' + id + '.txt';
    loadScenario(path);
  }
  function onClick() { nextLine(); }
  function loadScenario(filePath) {
    if (!filePath) return;
    isAuto = false; isSkipping = false;
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (textTimer) { clearInterval(textTimer); textTimer = null; }
    if (Live2DRenderer && Live2DRenderer.clearAll) Live2DRenderer.clearAll();
    ['bgm-player','se-player','voice-player'].forEach(function(id) { var e = document.getElementById(id); if (e) { e.pause(); e.currentTime = 0; } });
    document.getElementById('reader-title').textContent = filePath.split('/').pop();
    fetch(filePath).then(function(r) { if (!r.ok) throw Error('HTTP ' + r.status); return r.text(); }).then(function(text) {
      lines = text.split(/\r?\n/).filter(function(l) { return l.trim() && !l.startsWith('//'); });
      lineIdx = 0; showLine();
    }).catch(function(e) { console.error('Scenario load error:', e); });
  }
  function showLine() {
    if (lineIdx >= lines.length) { exitReader(); if (typeof window.exitReader === 'function') window.exitReader(); return; }
    if (isSkipping) { processLine(); return; }
    processLine();
  }
  function processLine() {
    var line = lines[lineIdx] || ''; lineIdx++;
    if (!line.trim() || line.startsWith('//')) { showLine(); return; }
    if (line.indexOf(',') > 0) {
      var a = line.split(',');
      var cmd = a[0].trim().toLowerCase();
      switch (cmd) {
        case 'bg': { var bg = a[1]; if (bg) { var img = document.getElementById('reader-bg-img'); img.src = '/texture/BG/' + bg + '.png'; img.style.display = 'block'; img.onerror = function() { this.src = '/cg/' + bg + '.png'; this.onerror = function() { this.style.display = 'none'; }; }; } break; }
        case 'cg': { var cg = a[1]; if (cg) { document.getElementById('reader-bg-img').src = '/cg/' + cg + '.png'; document.getElementById('reader-bg-img').style.display = 'block'; } break; }
        case 'bgcolor': { var r = parseFloat(a[1]) || 0, g = parseFloat(a[2]) || 0, b = parseFloat(a[3]) || 0; var el = document.getElementById('reader-bg-color'); if (el) el.style.background = 'rgb(' + (r*255|0) + ',' + (g*255|0) + ',' + (b*255|0) + ')'; break; }
        case 'live2d': { var modelId = a[1], slotName = a[2], x = parseFloat(a[3]), y = parseFloat(a[4]), sx = parseFloat(a[5]), sy = parseFloat(a[6]); if (Live2DRenderer && Live2DRenderer.load) Live2DRenderer.load(slotName, modelId, x, y, sx, sy); break; }
        case 'live2dmotion': { var slotName = a[1], motionName = a[2], loopFlag = a[3] || 'off'; if (Live2DRenderer && Live2DRenderer.motion) Live2DRenderer.motion(slotName, motionName, loopFlag); break; }
        case 'live2ddelete': { var slotName = a[1]; if (Live2DRenderer && Live2DRenderer.remove) Live2DRenderer.remove(slotName); break; }
        case 'live2dmove': { var slotName = a[1], x = parseFloat(a[2]), y = parseFloat(a[3]), dur = parseFloat(a[4]) || 0; if (Live2DRenderer && Live2DRenderer.move) Live2DRenderer.move(slotName, x, y, dur); break; }
        case 'bgmplay': { if (a[1]) playAudio('bgm-player', '/bgm/' + a[1] + '.ogg', true); break; }
        case 'bgmstop': { stopAudio('bgm-player'); break; }
        case 'seplay': { if (a[1]) playAudio('se-player', '/se/' + a[1] + '.ogg', false); break; }
        case 'window': { document.getElementById('reader-dialog').style.display = a[1] === 'off' ? 'none' : 'block'; break; }
        case 'wait': { scheduleNext((parseFloat(a[1]) || 1) * 1000); return; }
        case 'message': { var speaker = a[1] || ''; var text = a.slice(2, a.length - 1).join(','); var faceIcon = a[a.length - 1] || ''; displayMessage(speaker, text || '', faceIcon); return; }
        case 'msgvoicesync': { var speaker = a[2] || ''; var text = a.slice(3, a.length - 2).join(','); var faceIcon = a[a.length - 2] || ''; var voiceName = a[a.length - 1] || ''; displayMessage(speaker, text, faceIcon); if (voiceName) playVoice(voiceName); return; }
        case 'voice': { if (a[1]) playVoice(a[1]); break; }
        case 'endof': { exitReader(); if (typeof window.exitReader === 'function') window.exitReader(); return; }
        default: break;
      }
      showLine();
    } else { displayMessage('', line, ''); }
  }
  function displayMessage(speaker, text, faceIcon) {
    document.getElementById('dialog-name').textContent = speaker || '';
    var textEl = document.getElementById('dialog-text');
    textEl.innerHTML = ''; textEl.dataset.fullText = text || '';
    var head = document.getElementById('dialog-headicon');
    if (faceIcon && faceIcon.startsWith('fc')) { head.src = '/texture/chara_icon_image/' + faceIcon.substring(2) + '.png'; head.style.display = 'block'; head.onerror = function() { this.style.display = 'none'; }; } else { head.style.display = 'none'; }
    if (textTimer) clearInterval(textTimer);
    if (isSkipping || settings.textSpeed >= 90) { textEl.innerHTML = text; return; }
    var chars = text.split(''), idx = 0;
    textTimer = setInterval(function() { if (idx < chars.length) { textEl.innerHTML += chars[idx]; idx++; } else { clearInterval(textTimer); textTimer = null; } }, Math.max(10, 100 - settings.textSpeed));
  }
  function playAudio(id, src, loop) {
    var el = document.getElementById(id) || (function() { var e = document.createElement('audio'); e.id = id; document.body.appendChild(e); return e; })();
    el.src = src; el.loop = !!loop; el.volume = 0.5;
    var playPromise = el.play();
    if (playPromise) playPromise.catch(function(e) { console.warn('Audio play blocked (' + src + '):', e.message); });
  }
  function stopAudio(id) { var el = document.getElementById(id); if (el) { el.pause(); el.currentTime = 0; } }
  function playVoice(name) {
    if (!name) return;
    var typeDir = 'Normal';
    if (currentType === 'main') typeDir = 'main';
    else if (currentType === 'r18') typeDir = 'R18';
    else if (currentType === 'event') typeDir = 'Event';
    var candidates = ['/voice/' + typeDir + '/' + currentId + '/' + name + '.ogg', '/voice/' + typeDir + '/' + currentId + '/' + name.replace(/_(i_men|men)$/, '') + '.ogg', '/voice/' + name + '.ogg', '/voice/' + name.replace(/_(i_men|men)$/, '') + '.ogg'];
    tryPath(0);
    function tryPath(idx) { if (idx >= candidates.length) { console.warn('Voice not found:', name); return; } var xhr = new XMLHttpRequest(); xhr.open('HEAD', candidates[idx], true); xhr.onreadystatechange = function() { if (xhr.readyState === 4) { if (xhr.status === 200) playAudio('voice-player', candidates[idx], false); else tryPath(idx + 1); } }; xhr.send(); }
  }
  function scheduleNext(delay) { if (autoTimer) clearTimeout(autoTimer); autoTimer = setTimeout(function() { autoTimer = null; showLine(); }, delay); }
  function nextLine() {
    unlockAudio();
    if (textTimer) { clearInterval(textTimer); textTimer = null; document.getElementById('dialog-text').innerHTML = document.getElementById('dialog-text').dataset.fullText || ''; return; }
    if (isAuto) scheduleNext(settings.autoDelay);
    showLine();
  }
  function prevLine() { if (lineIdx > 1) lineIdx -= 2; showLine(); }
  function toggleAuto() { isAuto = !isAuto; document.getElementById('btn-auto').classList.toggle('active', isAuto); if (isAuto) scheduleNext(settings.autoDelay); else if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; } }
  function toggleSkip() { isSkipping = !isSkipping; document.getElementById('btn-skip').classList.toggle('active', isSkipping); }
  function exitReader() {
    isAuto = false; isSkipping = false;
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (textTimer) { clearInterval(textTimer); textTimer = null; }
    if (Live2DRenderer && Live2DRenderer.clearAll) Live2DRenderer.clearAll();
    ['bgm-player','se-player','voice-player'].forEach(function(id) { var e = document.getElementById(id); if (e) { e.pause(); e.currentTime = 0; } });
  }
  function updateSettings(speed, delay, fontSize) {
    if (typeof speed === 'object') { var o = speed; if (o.textSpeed !== undefined) speed = o.textSpeed; if (o.autoDelay !== undefined) delay = o.autoDelay; if (o.fontSize !== undefined) fontSize = o.fontSize; }
    if (speed !== undefined) settings.textSpeed = speed;
    if (delay !== undefined) settings.autoDelay = delay;
    if (fontSize !== undefined) { settings.fontSize = fontSize; document.getElementById('dialog-text').style.fontSize = fontSize + 'px'; }
  }
  return {
    loadScenario: loadScenario, nextLine: nextLine, prevLine: prevLine,
    toggleAuto: toggleAuto, toggleSkip: toggleSkip, exitReader: exitReader,
    getSettings: function() { return settings; }, updateSettings: updateSettings,
    stop: stop, play: play, onClick: onClick
  };
})();
window.VR = VR;
window.reader = VR;