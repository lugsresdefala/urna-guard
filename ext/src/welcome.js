/* Onboarding em 3 passos. Grava só a sensibilidade escolhida e onboarded=true em chrome.storage.local. */
const $ = id => document.getElementById(id);
const S = UrnaGuardScoring;
const HINT = { low: 'sensLowHint', medium: 'sensMediumHint', high: 'sensHighHint' };
let step = 1;
function show(n, focus) {
  step = n;
  [1, 2, 3].forEach(i => { $('step' + i).hidden = i !== n; });
  document.querySelectorAll('.ob-dots li').forEach((li, i) => li.classList.toggle('on', i < n));
  $('progress').textContent = `${ugT('obStep')} ${n} ${ugT('obOf')} 3`;
  $('back').hidden = n === 1;
  $('next').textContent = ugT(n === 3 ? 'finish' : 'next');
  if (focus) $('h' + n).focus();
}
function sensHint() { const v = document.querySelector('input[name=sens]:checked').value; $('sensHint').textContent = ugT(HINT[v]); }
function finish() {
  const v = document.querySelector('input[name=sens]:checked').value;
  chrome.storage.local.get(['settings'], r => chrome.storage.local.set({
    onboarded: true,
    settings: Object.assign({}, S.DEFAULT_SETTINGS, r.settings || {}, { sensitivity: v }, S.SENSITIVITY[v])
  }, () => { location.href = 'https://x.com/home'; }));
}
chrome.storage.local.get(['settings'], r => {
  const lvl = S.sensitivityOf(Object.assign({}, S.DEFAULT_SETTINGS, r.settings || {}));
  const i = document.querySelector(`input[name=sens][value=${lvl}]`); if (i) i.checked = true; sensHint();
});
document.querySelectorAll('input[name=sens]').forEach(i => i.addEventListener('change', sensHint));
$('next').onclick = () => step < 3 ? show(step + 1, true) : finish();
$('back').onclick = () => show(step - 1, true);
$('skip').onclick = () => chrome.storage.local.set({ onboarded: true }, () => window.close());
show(1);
