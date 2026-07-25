function navigateTo(screen, params) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  if (screen !== 'reader') reader.stop();
  switch (screen) {
    case 'title': document.getElementById('screen-title').classList.add('active'); break;
    case 'characters': document.getElementById('screen-characters').classList.add('active'); loadCharacters(); break;
    case 'char-select': document.getElementById('screen-char-select').classList.add('active'); if (params) showCharSelect(params.charId, params.charName, params.motion); break;
    case 'main-story': document.getElementById('screen-story-list').classList.add('active'); document.getElementById('story-list-title').textContent = '\u4e3b\u7dda\u6545\u4e8b\u7ae0\u7bc0'; loadMainStory(); break;
    case 'events': document.getElementById('screen-events').classList.add('active'); loadEvents(); break;
    case 'event-chapters': document.getElementById('screen-story-list').classList.add('active'); document.getElementById('story-list-title').textContent = (params && params.title) ? params.title : '\u4e8b\u4ef6\u7ae0\u7bc0'; loadEventChapters(params ? params.eventId : null); break;
    case 'reader': document.getElementById('screen-reader').classList.add('active'); if (params) reader.play(params.type, params.id, params.title); break;
    case 'settings': document.getElementById('screen-settings').classList.add('active'); break;
    default: document.getElementById('screen-title').classList.add('active');
  }
}
async function loadCharacters() {
  const grid = document.getElementById('char-grid');
  grid.innerHTML = '<div class="loading">\u8f09\u5165\u4e2d...</div>';
  try { const res = await fetch('/api/characters'); const chars = await res.json(); window._allChars = chars; renderCharacters(chars); } catch (e) { grid.innerHTML = '<div class="error">\u8f09\u5165\u5931\u6557\uff1a' + e.message + '</div>'; }
}
function renderCharacters(chars) {
  const grid = document.getElementById('char-grid');
  const search = (document.getElementById('char-search').value || '').toLowerCase();
  const checkedStars = document.querySelectorAll('#filter-stars input:checked');
  const activeStars = Array.from(checkedStars).map(cb => parseInt(cb.value));
  const filtered = chars.filter(c => { if (!activeStars.includes(c.rarity)) return false; if (search && !c.name.toLowerCase().includes(search)) return false; return true; });
  if (filtered.length === 0) { grid.innerHTML = '<div class="empty">\u7121\u7b26\u5408\u689d\u4ef6\u7684\u89d2\u8272</div>'; return; }
  grid.innerHTML = filtered.map(c => { const stars = '\u2605'.repeat(c.rarity); const hasCG = c.motion !== '\u65e0'; const imgUrl = '/texture/ButtonUi/' + c.id + '.png'; return '<div class="char-card" onclick="onCharClick(\'' + c.id + '\',\'' + c.name.replace(/'/g,"\\'") + '\',\'' + c.motion + '\')"><img class="char-card-img" src="' + imgUrl + '" onerror="this.style.display=\'none\'"><div class="char-card-info"><div class="char-card-name">' + c.name + '</div><div class="char-card-rarity">' + stars + '</div>' + (hasCG ? '<span class="char-card-type">CG</span>' : '') + '</div></div>'; }).join('');
}
function filterCharacters() { if (window._allChars) renderCharacters(window._allChars); }
function onCharClick(charId, charName, motion) {
  const picId = charId.substring(2, 7);
  const hasCG = motion !== '\u65e0';
  if (!hasCG) { openReader('normal', 'har_' + picId, charName + ' - Normal'); return; }
  navigateTo('char-select', { charId, charName, motion });
}
function showCharSelect(charId, charName, motion) {
  const picId = charId.substring(2, 7);
  document.getElementById('select-char-name').textContent = charName;
  const normalBtn = document.getElementById('btn-select-normal');
  const normalImg = normalBtn.querySelector('.select-btn-img');
  normalImg.src = '/texture/image_unit_harem/harem_' + picId + '.png';
  normalImg.onerror = function() { this.style.display = 'none'; };
  normalBtn.onclick = function() { openReader('normal', 'har_' + picId, charName + ' - Normal'); };
  normalBtn.querySelector('.select-btn-label').textContent = 'Normal';
  const cgBtn = document.getElementById('btn-select-cg');
  if (motion !== '\u65e0') {
    cgBtn.style.display = 'flex';
    const cgImg = cgBtn.querySelector('.select-btn-img');
    cgImg.src = '/texture/image_unit_harem_r18/harem_' + picId + '.png';
    cgImg.onerror = function() { this.style.display = 'none'; };
    cgBtn.onclick = function() { openReader('r18', 'har_' + picId, charName + ' - R18'); };
    cgBtn.querySelector('.select-btn-label').textContent = 'R18/CG';
  } else { cgBtn.style.display = 'none'; }
}
async function loadMainStory() {
  const list = document.getElementById('story-list');
  list.innerHTML = '<div class="loading">\u8f09\u5165\u4e2d...</div>';
  try { const res = await fetch('/api/main-story'); const chapters = await res.json(); if (!chapters || chapters.length === 0) { list.innerHTML = '<div class="empty">\u7121\u4e3b\u7dda\u6545\u4e8b\u8cc7\u6599</div>'; return; } list.innerHTML = chapters.map(ch => { const chapTxt = ch.chapter || ''; const secTxt = ch.section || ''; return '<div class="story-item" onclick="openReader(\'main\',\'' + ch.id + '\')"><div class="story-item-id">' + ch.id + '</div><div class="story-item-title">' + chapTxt + '</div>' + (secTxt ? '<div class="story-item-sub">' + secTxt + '</div>' : '') + '</div>'; }).join(''); } catch (e) { list.innerHTML = '<div class="error">\u8f09\u5165\u5931\u6557\uff1a' + e.message + '</div>'; }
}
async function loadEvents() {
  const grid = document.getElementById('event-grid');
  grid.innerHTML = '<div class="loading">\u8f09\u5165\u4e2d...</div>';
  try { const res = await fetch('/api/events'); const events = await res.json(); if (!events || events.length === 0) { grid.innerHTML = '<div class="empty">\u7121\u4e8b\u4ef6\u8cc7\u6599</div>'; return; } grid.innerHTML = events.map(eId => '<div class="event-card" onclick="navigateTo(\'event-chapters\',{eventId:\'' + eId + '\'})"><div class="event-card-id">' + eId + '</div><div class="event-card-title">\u67e5\u770b\u7ae0\u7bc0 \u2192</div></div>').join(''); } catch (e) { grid.innerHTML = '<div class="error">\u8f09\u5165\u5931\u6557\uff1a' + e.message + '</div>'; }
}
async function loadEventChapters(eventId) {
  const list = document.getElementById('story-list');
  list.innerHTML = '<div class="loading">\u8f09\u5165\u4e2d...</div>';
  if (!eventId) { list.innerHTML = '<div class="empty">\u7121\u6548\u4e8b\u4ef6ID</div>'; return; }
  try { const res = await fetch('/api/event-chapters/' + eventId); const chapters = await res.json(); if (!chapters || chapters.length === 0) { list.innerHTML = '<div class="empty">\u7121\u7ae0\u7bc0\u8cc7\u6599</div>'; return; } list.innerHTML = chapters.map(ch => '<div class="story-item" onclick="openReader(\'event\',\'' + ch.id + '\',\'' + ch.title.replace(/'/g,"\\'") + '\')"><div class="story-item-title">' + ch.title + '</div><div class="story-item-id">' + ch.id + '</div></div>').join(''); } catch (e) { list.innerHTML = '<div class="error">\u8f09\u5165\u5931\u6557\uff1a' + e.message + '</div>'; }
}
function openReader(type, id, title) { navigateTo('reader', { type: type, id: id, title: title || id }); }
function exitReader() { reader.stop(); navigateTo('title'); }
function toggleAuto() { reader.toggleAuto(); }
function toggleSkip() { reader.toggleSkip(); }
function nextLine() { reader.nextLine(); }
function prevLine() { reader.prevLine(); }
function updateSettings() {
  const speed = parseInt(document.getElementById('text-speed').value);
  const delay = parseInt(document.getElementById('auto-delay').value);
  const fontSize = parseInt(document.getElementById('font-size').value);
  document.getElementById('text-speed-label').textContent = speed <= 20 ? '\u5feb' : speed <= 50 ? '\u4e2d\u7b49' : '\u6162';
  document.getElementById('auto-delay-label').textContent = (delay / 1000).toFixed(1) + 's';
  document.getElementById('font-size-label').textContent = fontSize + 'px';
  reader.updateSettings(speed, delay, fontSize);
}
document.addEventListener('keydown', function(e) {
  if (!document.getElementById('screen-reader').classList.contains('active')) return;
  switch (e.key) { case ' ': case 'Enter': e.preventDefault(); reader.onClick(); break; case 'ArrowDown': e.preventDefault(); reader.nextLine(); break; case 'ArrowUp': e.preventDefault(); reader.prevLine(); break; case 'a': case 'A': reader.toggleAuto(); break; case 's': case 'S': reader.toggleSkip(); break; case 'Escape': exitReader(); break; }
});
document.addEventListener('DOMContentLoaded', function() {
  document.querySelector('.reader-dialog').addEventListener('click', function(e) { if (e.target.closest('.reader-controls')) return; reader.onClick(); });
  updateSettings();
});