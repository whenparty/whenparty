(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#primary-navigation');
  const closeMenu = (returnFocus = false) => {
    nav.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
    if (returnFocus) menuButton.focus();
  };

  menuButton.addEventListener('click', () => {
    const willOpen = menuButton.getAttribute('aria-expanded') !== 'true';
    nav.classList.toggle('is-open', willOpen);
    menuButton.setAttribute('aria-expanded', String(willOpen));
    menuButton.setAttribute('aria-label', willOpen ? 'Close navigation' : 'Open navigation');
  });
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => closeMenu());
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      closeMenu(true);
    }
  });
  document.addEventListener('click', event => {
    if (nav.classList.contains('is-open') && !nav.contains(event.target) && !menuButton.contains(event.target)) {
      closeMenu();
    }
  });
  window.matchMedia('(min-width: 871px)').addEventListener('change', event => {
    if (event.matches) closeMenu();
  });

  const prompts = [
    'Draw the view from your window. Add one impossible thing.',
    'Find three shapes in the room. Turn them into a friendly creature.',
    'Sketch a map of a place that only exists in your imagination.',
    'Fold a scrap of paper into a home for a little idea.',
    'Choose an everyday object. Draw its secret double life.'
  ];
  let promptIndex = 0;
  const promptText = document.querySelector('#prompt-text');
  const copyStatus = document.querySelector('#copy-status');
  const copyButton = document.querySelector('#copy-prompt');
  const nextButton = document.querySelector('#another-prompt');

  nextButton.addEventListener('click', () => {
    promptIndex = (promptIndex + 1) % prompts.length;
    promptText.textContent = prompts[promptIndex];
    copyStatus.textContent = '';
    copyButton.textContent = 'Copy this prompt ↗';
  });

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
    // Fallback also works when the prototype is opened as a local file.
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    return ok;
  }

  copyButton.addEventListener('click', async () => {
    try {
      const copied = await copyText(promptText.textContent.trim());
      copyStatus.textContent = copied ? 'Copied. Now go make something!' : 'Select the prompt text to copy it.';
    } catch {
      copyStatus.textContent = 'Copying is unavailable here. You can select the prompt text.';
    }
  });
})();


(() => {
  const scene = document.querySelector('[data-story-scene]');
  const sticky = scene.querySelector('.scroll-pin');
  const poster = scene.querySelector('.story-poster');
  const video = document.querySelector('#scrub-video');
  const range = document.querySelector('#journey-slider');
  const time = document.querySelector('#journey-time');
  const cue = document.querySelector('[data-cue]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Keep in sync with the <picture> source and preloads in index.html and with styles.css.
  const mobile = window.matchMedia('(max-width:700px) and (orientation:portrait)');
  // codecs (profile, level, bit depth) and bitrate describe the AV1 streams for
  // decodingInfo(); see scripts/encode-media.sh.
  const media = {
    desktop:{h264:'/media/journey-desktop.mp4',av1:'/media/journey-desktop.av1.mp4',
      codecs:'av01.0.05M.08',width:1280,height:720,bitrate:1300000},
    mobile:{h264:'/media/journey-mobile.mp4',av1:'/media/journey-mobile.av1.mp4',
      codecs:'av01.0.04M.08',width:576,height:720,bitrate:620000}
  };
  // The mobile video is a 576x720 slice (x 544-1120) of the 1280x720 master; see scripts/encode-media.sh.
  const MASTER_WIDTH=1280, CROP_LEFT=544, CROP_WIDTH=576, CROP_HEIGHT=720;
  const cues = {
    start:'SCROLL TO TRAVEL <span aria-hidden="true">↓</span>',
    loading:'LOADING THE JOURNEY <span aria-hidden="true">·</span>',
    moving:'A WORLD IN MOTION <span aria-hidden="true">↘</span>'
  };
  let mode=mobile.matches?'mobile':'desktop';
  let progress=0;
  let raf=0;
  let scrollRaf=0;
  let measure=null;
  let pendingTime=0;
  let sourceLoaded=false;
  let ready=false;
  let download=null;
  let objectUrl='';
  let file='';
  let av1Failed=false;
  let cueState='';
  let pageLoaded=false;
  const FRAMES=241;
  const FPS=24;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function useSource(target,src) {
    if (target!==mode) return;
    video.src=src;
    video.load();
  }
  // Use AV1 only where it decodes in hardware: every scroll seek decodes up to
  // 11 frames from the last keyframe, which is too slow in software on phones.
  function chooseFile(target) {
    const item=media[target];
    if (av1Failed || !('mediaCapabilities' in navigator)) return Promise.resolve(item.h264);
    return navigator.mediaCapabilities.decodingInfo({
      type:'file',
      video:{contentType:`video/mp4; codecs="${item.codecs}"`,width:item.width,height:item.height,bitrate:item.bitrate,framerate:FPS}
    }).then(info => info.supported && info.powerEfficient ? item.av1 : item.h264, () => item.h264);
  }
  // Download the whole file and play it from memory, so scroll seeks never wait on the network.
  function beginVideo() {
    if (sourceLoaded || reduced.matches) return;
    sourceLoaded=true;
    const target=mode;
    const signal=(download=new AbortController()).signal;
    chooseFile(target)
      .then(choice => {
        if (signal.aborted) throw new DOMException('Mode changed','AbortError');
        file=choice;
        return fetch(choice,{signal});
      })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then(blob => {
        if (target!==mode) return;
        objectUrl=URL.createObjectURL(blob);
        useSource(target,objectUrl);
      })
      .catch(error => {
        if (error.name==='AbortError' || target!==mode) return;
        file=media[target].h264;
        useSource(target,file);
      });
  }
  function resetVideo() {
    if (download) download.abort();
    download=null;
    sourceLoaded=false;ready=false;
    video.classList.remove('is-ready');
    video.removeAttribute('src');video.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl='';file='';
  }
  function updateCue() {
    const next=progress>.01&&!ready?'loading':progress>.12?'moving':'start';
    if (next===cueState) return;
    cueState=next;
    cue.innerHTML=cues[next];
  }
  // Ask the service worker to keep the video this page decoded, for offline visits.
  function keepOffline(path) {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(registration => registration.active.postMessage({cache:path}));
  }
  function showVideo() {
    video.classList.add('is-ready');
    ready=true;
    updateCue();
    if (objectUrl) keepOffline(file);
  }
  function synchronize() {
    raf=0;
    if (reduced.matches) return;
    if (!sourceLoaded) beginVideo();
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) return;
    if (video.seeking && Math.abs(video.currentTime-pendingTime) < .035) return;
    if (Math.abs(video.currentTime-pendingTime) > .035) {
      try {video.currentTime=pendingTime;} catch (_) {}
    }
  }
  function requestSync() {if (!raf) raf=requestAnimationFrame(synchronize);}
  // Pan the mobile crop so every phone sees the same window of the master
  // as the original landscape framing, which moved from 82% to 59%.
  function mobilePosition(value) {
    const visibleWidth=CROP_HEIGHT*measure.aspect;
    if (visibleWidth>=CROP_WIDTH) return 50;
    const left=(MASTER_WIDTH-visibleWidth)*(.82-.23*value)-CROP_LEFT;
    return 100*clamp(left/(CROP_WIDTH-visibleWidth),0,1);
  }
  function measureScene() {
    measure={
      top:scene.getBoundingClientRect().top+scrollY,
      length:Math.max(1,scene.offsetHeight-innerHeight),
      aspect:sticky.clientWidth/Math.max(1,sticky.clientHeight)
    };
    poster.style.objectPosition=mode==='mobile'?`${mobilePosition(0).toFixed(2)}% center`:'';
  }
  function applyProgress(value) {
    progress=reduced.matches?0:clamp(value,0,1);
    pendingTime=Math.round(progress*(FRAMES-1))/FPS;
    const intro=1-clamp((progress-.06)/.23,0,1);
    const ending=clamp((progress-.78)/.18,0,1);
    sticky.style.setProperty('--journey-progress',progress.toFixed(5));
    sticky.style.setProperty('--intro-opacity',intro.toFixed(4));
    sticky.style.setProperty('--end-opacity',ending.toFixed(4));
    range.value=String(Math.round(progress*(FRAMES-1)));
    range.style.setProperty('--fill',(100*progress).toFixed(2)+'%');
    range.setAttribute('aria-valuetext',`${pendingTime.toFixed(1)} seconds of 10 seconds`);
    time.textContent=`00:${String(Math.min(10,Math.floor(pendingTime))).padStart(2,'0')}`;
    updateCue();
    video.style.objectPosition=mode==='mobile'?`${mobilePosition(progress).toFixed(2)}% center`:'center center';
    if (!reduced.matches) {
      if (progress > 0.001) beginVideo();
      if (sourceLoaded) requestSync();
    }
  }
  function update() {
    if (!measure) measureScene();
    applyProgress((scrollY-measure.top)/measure.length);
  }
  function onScroll() {
    if (scrollRaf) return;
    scrollRaf=requestAnimationFrame(() => {scrollRaf=0;update();});
  }
  // Fetch the video once the first screen is done, unless the visitor asked to save data.
  function prefetchVideo() {
    if (reduced.matches) return;
    const connection=navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection && (connection.saveData || ['slow-2g','2g','3g'].includes(connection.effectiveType))) return;
    if ('requestIdleCallback' in window) requestIdleCallback(beginVideo,{timeout:1900});
    else setTimeout(beginVideo,800);
  }
  video.addEventListener('loadedmetadata',() => { video.pause();requestSync(); });
  video.addEventListener('seeked',() => {
    if (!ready) showVideo();
    // Reconcile if the user has moved the slider while the decoder was seeking.
    if (Math.abs(video.currentTime-pendingTime)>.045) requestSync();
  });
  video.addEventListener('loadeddata',() => {
    if (progress===0 && !ready) showVideo();
    requestSync();
  });
  // decodingInfo() can promise more than the decoder delivers; start over with H.264.
  video.addEventListener('error',() => {
    if (file!==media[mode].av1) return;
    av1Failed=true;
    resetVideo();
    beginVideo();
  });
  range.addEventListener('input',() => {
    if (reduced.matches) return;
    if (!measure)measureScene();
    const p=Number(range.value)/(FRAMES-1);
    window.scrollTo({top:measure.top+p*measure.length,behavior:'instant'});
    applyProgress(p);
  });
  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',()=>{measureScene();onScroll();},{passive:true});
  mobile.addEventListener('change',()=> {
    mode=mobile.matches?'mobile':'desktop';
    resetVideo();
    measureScene();update();
    if (pageLoaded) prefetchVideo();
  });
  reduced.addEventListener('change',()=>{
    if (reduced.matches) {video.pause();video.classList.remove('is-ready');}
    measureScene();update();
  });
  window.addEventListener('load',() => {pageLoaded=true;prefetchVideo();},{once:true});
  window.__sketchPerf=() => ({
    mode,file,source:objectUrl?'blob':video.currentSrc,
    desiredTime:pendingTime,actualTime:video.currentTime,
    loaded:sourceLoaded,readyState:video.readyState,seeking:video.seeking,visible:ready
  });
  measureScene();update();
})();


// Offline support and installing as an app; see sw.js.
(() => {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load',() => {navigator.serviceWorker.register('/sw.js').catch(() => {});},{once:true});
})();
