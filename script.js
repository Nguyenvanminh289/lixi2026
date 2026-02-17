(() => {
  const pool = [1000,20000,3000,10000,5000,50000]; // full pool (includes special 50k & 10k)
  const smallAmounts = [1000,3000,5000]; // user can only get these (10k & 50k locked)

  const el = id => document.getElementById(id);
  const modal = el('nameModal');
  const startBtn = el('startBtn');
  const playerNameInput = el('playerName');
  const cardsRoot = el('cards');
  const resultEl = el('result');
  const greeting = el('greeting');
  const playerInfo = el('playerInfo');
  const proofEl = el('proof');
  const proofText = el('proofText');
  const proofImage = el('proofImage');
  const scrollBanner = el('scrollBanner');
  const bgAudio = el('bgAudio');
  const revealAudio = el('revealAudio');
  const audioPrompt = el('audioPrompt');
  const audioEnableBtn = el('audioEnableBtn');
  // WebAudio fallback context (used if no audio file available or browser blocks autoplay)
  let audioCtx = null;
  let bgOsc = null;

  let playerName = '';
  let deck = [null,null,null,null,null,null];
  let hasSelected = false;
  let selectedIndex = -1;
  let revealTimer = null;

  function formatVND(n){
    return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
  }

  function shuffle(array){
    for(let i = array.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [array[i],array[j]] = [array[j],array[i]];
    }
    return array;
  }

  function prepareDeck(){
    // keep deck empty until a user clicks; we render blanks
    deck = [null,null,null,null,null,null];
  }

  function renderCards(){
    cardsRoot.innerHTML = '';
    for(let i=0;i<6;i++){
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.index = i;

      const inner = document.createElement('div');
      inner.className = 'card-inner';

      const front = document.createElement('div');
      front.className = 'card-face card-front';
      front.innerHTML = `<div class="motif">🧧</div>`;

      const back = document.createElement('div');
      back.className = 'card-face card-back';
      back.innerHTML = `<div class="back-text">?</div>`;

      inner.appendChild(front);
      inner.appendChild(back);
      card.appendChild(inner);

      card.addEventListener('click', onCardClick);

      cardsRoot.appendChild(card);
    }
  }

  function disableAllClicks(){
    document.querySelectorAll('.card').forEach(c=>c.style.pointerEvents='none');
  }

  function revealCard(card, index){
    const value = deck[index];
    card.classList.add('flipped','selected');
    const backText = card.querySelector('.back-text');
    backText.textContent = formatVND(value);
    resultEl.textContent = `${playerName} nhận được ${formatVND(value)} !!!`;

    // show proof message
    proofText.textContent = `Chúc mừng ${playerName} đã nhận được ${formatVND(value)} từ Nguyễn Văn Minh. Bây giờ hãy chụp màn hình và liên hệ cho Minh để nhận số tiền này.`;
    proofEl.style.display = 'block';
    // show proof image if available (image src set in index.html). Make it visible.
    if(proofImage){ proofImage.style.display = 'block'; }

    // Show scroll down banner to notify user
    if(scrollBanner){ scrollBanner.style.display = 'block'; }

    // Play reveal sound: prefer file `revealAudio`, otherwise use WebAudio beep
    playRevealSound();
  }

  function revealOthers(excludeIndex){
    document.querySelectorAll('.card').forEach(c=>{
      const idx = Number(c.dataset.index);
      if(idx === excludeIndex) return;
      if(!c.classList.contains('flipped')){
        const backText = c.querySelector('.back-text');
        const value = deck[idx];
        backText.textContent = formatVND(value);
        c.classList.add('flipped');
      }
      c.style.pointerEvents = 'none';
    });
  }

  function onCardClick(e){
    if(hasSelected) return; // only allow one pick total
    const card = e.currentTarget;
    const index = Number(card.dataset.index);
    hasSelected = true;
    selectedIndex = index;

    // Randomize user's value at click time (never 50k)
    const userValue = smallAmounts[Math.floor(Math.random()*smallAmounts.length)];
    // build remaining pool: copy full pool and remove one occurrence of userValue
    const remaining = pool.slice();
    const ridx = remaining.indexOf(userValue);
    if(ridx > -1) remaining.splice(ridx,1);
    shuffle(remaining);
    // assign deck values: user's index gets userValue, others get remaining values
    deck = [null,null,null,null,null,null];
    deck[index] = userValue;
    for(let i=0;i<6;i++){
      if(i===index) continue;
      deck[i] = remaining.shift();
    }

    // reveal selected card
    revealCard(card, index);
    // disable clicking others while waiting
    document.querySelectorAll('.card').forEach((c,i)=>{ if(i!==index) c.style.pointerEvents='none'; });

    // set timer to trigger fireworks after 2s and then reveal others
    revealTimer = setTimeout(()=>{
      launchFireworks(card);
      revealOthers(index);
      disableAllClicks();
    },2000);
  }

  function launchFireworks(card){
    const rect = card.getBoundingClientRect();
    const wrapper = document.createElement('div');
    wrapper.className = 'firework-wrapper';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    document.body.appendChild(wrapper);

    // create confetti elements positioned at card center
    const count = 30;
    const cx = rect.left + rect.width/2 + window.scrollX;
    const cy = rect.top + rect.height/2 + window.scrollY;
    for(let i=0;i<count;i++){
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = (cx + (Math.random()-0.5)*rect.width) + 'px';
      c.style.top = (cy + (Math.random()-0.5)*rect.height) + 'px';
      c.style.background = ['#ff4757','#ff6b6b','#ffd166','#7bed9f','#70a1ff'][Math.floor(Math.random()*5)];
      c.style.transform = `translateY(0) rotate(${Math.random()*360}deg)`;
      c.style.animationDuration = (900+Math.random()*800)+'ms';
      wrapper.appendChild(c);
    }

    // remove wrapper after animation
    setTimeout(()=>{ wrapper.remove(); },2200);
  }

  // Play background music. Start on user gesture (click Start) to avoid autoplay block.
  function startBackgroundMusic(){
    // Try HTMLAudio element first (attempt unmuted autoplay)
    if(bgAudio && bgAudio.src){
      bgAudio.volume = 0.7; // reduce volume
      // ensure unmuted attempt
      try{ bgAudio.muted = false; }catch(e){}
      const p = bgAudio.play();
      if(p && p.catch){
        p.catch(()=>{
          // If play is blocked by autoplay policy, show a small prompt for the user
          if(audioPrompt) audioPrompt.style.display = 'flex';
          // fallback to gentle WebAudio ambient in case element can't play
          startWebAudioBg();
        });
      }
      return;
    }
    // Fallback: create a simple WebAudio ambient tone
    startWebAudioBg();
  }

  function startWebAudioBg(){
    try{
      if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      bgOsc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      bgOsc.type = 'sine';
      bgOsc.frequency.value = 220; // low tone
      gain.gain.value = 0.02; // very quiet
      bgOsc.connect(gain);
      gain.connect(audioCtx.destination);
      bgOsc.start();
    }catch(e){/* ignore */}
  }

  // Play a short reveal sound (chime). Try audio element, fallback to WebAudio oscillator burst.
  function playRevealSound(){
    if(revealAudio && revealAudio.src){
      revealAudio.volume = 0.9;
      revealAudio.currentTime = 0;
      revealAudio.play().catch(()=>{
        playBeep();
      });
      return;
    }
    playBeep();
  }

  function playBeep(){
    try{
      if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.value = 0.0015;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      // ramp down
      g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.6);
      setTimeout(()=>{ try{o.stop();}catch(e){} },650);
    }catch(e){/* ignore */}
  }

  // Cancel button removed per user request

  // NOTE: 'Chơi lại' đã bị loại bỏ theo yêu cầu - không có chức năng replay

  function openNameModal(){
    modal.style.display = 'flex';
    playerNameInput.focus();
    // Unmute audio khi user tương tác lần đầu
    if(bgAudio) bgAudio.muted = false;
  }

  function closeNameModal(){
    modal.style.display = 'none';
  }

  startBtn.addEventListener('click', ()=>{
    const name = playerNameInput.value.trim();
    if(!name){
      playerNameInput.focus();
      return;
    }
    playerName = name;
    greeting.textContent = `Tên human : ${playerName}`;
    playerInfo.hidden = false;
    closeNameModal();
    prepareDeck();
    renderCards();
    resultEl.textContent = '';
    // Try to start/unmute music now that this is a user gesture
    if(bgAudio){
      try{ bgAudio.muted = false; bgAudio.volume = 0.35; bgAudio.play().catch(()=>{}); }catch(e){}
    }
    if(audioCtx && audioCtx.state === 'suspended' && audioCtx.resume){
      audioCtx.resume().catch(()=>{});
    }
    // do not allow reopening modal (no change name)
  });

  // helper: listen for first user interaction to enable audio (best-effort for autoplay policies)
  function enableOnFirstInteraction(){
    function onFirst(){
      if(bgAudio){
        try{ bgAudio.muted = false; bgAudio.volume = 0.35; bgAudio.play().catch(()=>{}); }catch(e){}
      }
      if(audioCtx && audioCtx.state === 'suspended' && audioCtx.resume){
        audioCtx.resume().catch(()=>{}).then(()=>startBackgroundMusic());
      } else {
        startBackgroundMusic();
      }
      window.removeEventListener('pointerdown', onFirst);
      window.removeEventListener('touchstart', onFirst);
    }
    window.addEventListener('pointerdown', onFirst, {once:true});
    window.addEventListener('touchstart', onFirst, {once:true});
  }

  // If user taps the overlay, try to play the bgAudio unmuted and hide overlay
  if(typeof audioEnableBtn !== 'undefined' && audioEnableBtn){
    audioEnableBtn.addEventListener('click', ()=>{
      if(bgAudio){
        try{ bgAudio.muted = false; bgAudio.volume = 0.35; bgAudio.play().then(()=>{ if(audioPrompt) audioPrompt.style.display='none'; }).catch(()=>{ if(audioPrompt) audioPrompt.style.display='none'; }); }catch(e){ if(audioPrompt) audioPrompt.style.display='none'; }
      } else if(audioCtx && audioCtx.state === 'suspended'){
        audioCtx.resume().catch(()=>{}).then(()=>{ startBackgroundMusic(); if(audioPrompt) audioPrompt.style.display='none'; });
      } else {
        startBackgroundMusic(); if(audioPrompt) audioPrompt.style.display='none';
      }
    });
  }

  // init - start music ngay khi page load
  window.addEventListener('load', ()=>{
    // Khởi động nhạc ngay lập tức (với autoplay muted)
    startBackgroundMusic();
    // Mở modal nhập tên
    openNameModal();
    // Enable play/unmute on first real user interaction (click/tap)
    enableOnFirstInteraction();
  });

})();

